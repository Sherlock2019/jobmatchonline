import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './store.js';
import { PgStore } from './store-pg.js';
import { createSeed } from './seed.js';
import { detectMutualMatch, likesRemainingToday, scoreCandidateForJob, ValidationError, reqString, optString, oneOf } from './matching.js';
import { applyCandidateProfile, applyRecruiterProfile, candidateCompleteness, recruiterCompleteness } from './profile.js';
import { anonymizeText, convertDocxToPdf, detectTools, docxToHtml, extractDocxText, extractPdfText, makeSimplePdf, pdfThumbnail } from './resume.js';
import { applyJob, parseJobText } from './jobs.js';
import { generateIcebreakers, generateInterviewKit, generatePrep, suggestScreeningQuestions } from './coaching.js';
import { PASSWORD_MIN_LENGTH, hashPassword, rateLimit, validPassword, verifyPassword } from './auth.js';
import fs from 'node:fs';
import { exchangeLinkedinCode, linkedinAuthorizationUrl, readSignedValue, signedValue, toLinkedinJobPayload } from './integrations/linkedin.js';
import { oauthAuthorizationUrl, oauthExchangeCode, oauthProviders } from './integrations/oauth.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
// DATABASE_URL (RDS PostgreSQL) selects the durable production store; the JSON file remains the zero-dependency dev default.
const store = process.env.DATABASE_URL
  ? new PgStore(process.env.DATABASE_URL, createSeed)
  : new JsonStore(process.env.DB_PATH || path.join(root, 'data', 'db.json'), createSeed);
await store.init();
// Merge any seed entities added since the database was first created: add
// missing records by id, and backfill fields the seed has gained since —
// never overwriting values a user has edited.
await store.transaction((db) => {
  const seed = createSeed();
  for (const collection of ['users', 'jobs']) {
    const byId = new Map(db[collection].map((item) => [item.id, item]));
    for (const item of seed[collection]) {
      const existing = byId.get(item.id);
      if (!existing) db[collection].push(item);
      else for (const [key, value] of Object.entries(item)) if (existing[key] === undefined) existing[key] = value;
    }
  }
});
console.log(`JobMatch store: ${process.env.DATABASE_URL ? 'postgresql (RDS)' : 'json file'}`);
const demoDistances = { 'j-1': 7, 'j-2': 18, 'j-3': 42, 'j-4': 75, 'c-1': 5, 'c-2': 26, 'c-3': 12, 'c-4': 65 };
const sessionSecret = process.env.SESSION_SECRET || 'jobmatch-local-development-only-secret';
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production');

// Demo auth (profile dropdown, mock SSO, spoofable ids) is on by default in
// development and OFF in production. DEMO_AUTH=true/false overrides either way,
// so the live showcase can keep demo logins alongside real accounts.
const demoAuth = process.env.DEMO_AUTH !== undefined
  ? process.env.DEMO_AUTH === 'true'
  : process.env.NODE_ENV !== 'production';

const AUTH_COOKIE = 'jm_auth';
const SESSION_TTL_SECONDS = 7 * 24 * 3600;
// Where to land the browser after an SSO redirect. In production the SPA is
// served under /app/, so set APP_PATH=/app/ there; defaults to / for dev.
const APP_PATH = (process.env.APP_PATH || '/').replace(/\/?$/, '/');

function authSession(req) {
  const payload = readSignedValue(cookies(req)[AUTH_COOKIE], sessionSecret);
  if (!payload || typeof payload.sub !== 'string' || payload.expiresAt < Date.now()) return null;
  return payload;
}

function issueSession(res, user) {
  const session = signedValue({ sub: user.id, role: user.role, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }, sessionSecret);
  setCookie(res, AUTH_COOKIE, session, { maxAge: SESSION_TTL_SECONDS });
}

/**
 * Who is acting? A signed session always wins (claimed ids from the client are
 * ignored). Without a session, the claimed id is honored only in demo mode.
 */
function resolveActor(req, claimedId) {
  const session = authSession(req);
  if (session) return session.sub;
  if (demoAuth) return claimedId || '';
  const error = new Error('Sign in to continue'); error.status = 401; throw error;
}

/**
 * Coexistence guard: without a session, a claimed identity may only be a
 * demo-flagged account — real users' accounts always require their session.
 */
function assertDemoActor(req, db, actorId) {
  if (authSession(req)) return;
  const user = db.users.find((item) => item.id === actorId);
  if (user && user.demo !== true) { const error = new Error('Sign in to continue as this account'); error.status = 401; throw error; }
}

/** Guard for endpoints that operate on a specific user's own data. */
function requireSelf(req, userId) {
  const session = authSession(req);
  if (session) {
    if (session.sub !== userId) { const error = new Error('You can only modify your own profile'); error.status = 403; throw error; }
    return;
  }
  if (!demoAuth) { const error = new Error('Sign in to continue'); error.status = 401; throw error; }
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((part) => { const index = part.indexOf('='); return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))]; }));
}

function setCookie(res, name, value, { maxAge = 600, httpOnly = true } = {}) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${secure}`);
}

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // nginx/CloudFront in front — req.ip = real client IP for rate limiting
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://localhost,capacitor://localhost').split(',').map((origin) => origin.trim()));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  next();
});
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

app.get('/api/integrations', (_req, res) => res.json({
  linkedin: { signInConfigured: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && process.env.LINKEDIN_REDIRECT_URI), talentSyncEnabled: process.env.LINKEDIN_TALENT_SYNC_ENABLED === 'true' },
  platforms: { web: true, pwa: true, ios: true, android: true },
}));

app.get('/api/auth/linkedin', (req, res) => {
  const { LINKEDIN_CLIENT_ID: clientId, LINKEDIN_REDIRECT_URI: redirectUri } = process.env;
  if (!clientId || !redirectUri) return res.redirect('/?linkedin=configure');
  const state = signedValue({ nonce: crypto.randomUUID(), createdAt: Date.now(), native: req.query.platform === 'native' }, sessionSecret);
  setCookie(res, 'jm_oauth_state', state);
  res.redirect(linkedinAuthorizationUrl({ clientId, redirectUri, state, native: req.query.platform === 'native' }));
});

app.get('/api/auth/linkedin/callback', async (req, res, next) => {
  try {
    if (req.query.error) return res.redirect(`/?linkedin=${encodeURIComponent(String(req.query.error))}`);
    const state = String(req.query.state || '');
    const statePayload = readSignedValue(state, sessionSecret);
    if (!statePayload || cookies(req).jm_oauth_state !== state || Date.now() - statePayload.createdAt > 600000) {
      const error = new Error('Invalid or expired OAuth state'); error.status = 401; throw error;
    }
    const { profile, expiresIn } = await exchangeLinkedinCode({ code: String(req.query.code || ''), clientId: process.env.LINKEDIN_CLIENT_ID, clientSecret: process.env.LINKEDIN_CLIENT_SECRET, redirectUri: process.env.LINKEDIN_REDIRECT_URI });
    const session = signedValue({ sub: profile.sub, name: profile.name, email: profile.email, picture: profile.picture, provider: 'linkedin', expiresAt: Date.now() + Math.min(expiresIn * 1000, 86400000) }, sessionSecret);
    setCookie(res, 'jm_session', session, { maxAge: Math.min(expiresIn, 86400) });
    setCookie(res, 'jm_oauth_state', '', { maxAge: 0 });
    await store.transaction((db) => {
      const user = db.users.find((item) => item.id === 'candidate-demo');
      if (user) Object.assign(user, { name: profile.name || user.name, photo: profile.picture || user.photo, email: profile.email, linkedinSubject: profile.sub, linkedinConnected: true });
    });
    res.redirect(statePayload.native ? 'jobmatch://auth/linkedin?success=1' : '/?linkedin=connected');
  } catch (error) { next(error); }
});

app.get('/api/auth/session', (req, res) => {
  const session = readSignedValue(cookies(req).jm_session, sessionSecret);
  if (!session || session.expiresAt < Date.now()) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, user: { name: session.name, email: session.email, picture: session.picture, provider: session.provider } });
});

app.post('/api/integrations/linkedin/jobs/:jobId/sync', async (req, res, next) => {
  try {
    if (process.env.LINKEDIN_TALENT_SYNC_ENABLED !== 'true' || !process.env.LINKEDIN_JOB_POSTING_TOKEN) { const error = new Error('LinkedIn Talent Solutions partner access is required'); error.status = 403; throw error; }
    const db = await store.read();
    const job = db.jobs.find((item) => item.id === req.params.jobId);
    if (!job) { const error = new Error('Job not found'); error.status = 404; throw error; }
    const integrationContext = reqString(req.body, 'integrationContext', { max: 128 });
    const response = await fetch('https://api.linkedin.com/rest/simpleJobPostings', { method: 'POST', headers: { Authorization: `Bearer ${process.env.LINKEDIN_JOB_POSTING_TOKEN}`, 'Content-Type': 'application/json', 'LinkedIn-Version': '202603', 'X-Restli-Protocol-Version': '2.0.0' }, body: JSON.stringify(toLinkedinJobPayload(job, integrationContext)) });
    if (!response.ok) { const error = new Error('LinkedIn job sync failed'); error.status = 502; throw error; }
    res.status(202).json({ accepted: true });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Demo auth: instant profile login, mock SSO, near-instant registration.
// ---------------------------------------------------------------------------

function publicProfile(user) {
  return { id: user.id, role: user.role, kind: user.kind, name: user.name, email: user.email, title: user.title, company: user.company, photo: user.photo, provider: user.provider, completeness: user.completeness, demo: user.demo === true };
}

const authLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 30, bucket: 'auth' });

app.get('/api/auth/config', (_req, res) => res.json({ demoAuth, passwordMinLength: PASSWORD_MIN_LENGTH, sso: oauthProviders() }));

// ---------------------------------------------------------------------------
// Real SSO (Google / LinkedIn via OpenID Connect) — active when env vars exist.
// ---------------------------------------------------------------------------

app.get('/api/auth/oauth/:provider', (req, res, next) => {
  try {
    const provider = oneOf(req.params, 'provider', ['google', 'linkedin']);
    const role = req.query.role === 'employer' ? 'employer' : 'candidate';
    const state = signedValue({ nonce: crypto.randomUUID(), createdAt: Date.now(), provider, role }, sessionSecret);
    setCookie(res, 'jm_oauth_state', state);
    res.redirect(oauthAuthorizationUrl(provider, state));
  } catch (error) { next(error); }
});

app.get('/api/auth/oauth/:provider/callback', async (req, res, next) => {
  try {
    const provider = oneOf(req.params, 'provider', ['google', 'linkedin']);
    if (req.query.error) return res.redirect(`${APP_PATH}?sso=${encodeURIComponent(String(req.query.error))}`);
    const state = String(req.query.state || '');
    const statePayload = readSignedValue(state, sessionSecret);
    if (!statePayload || statePayload.provider !== provider || cookies(req).jm_oauth_state !== state || Date.now() - statePayload.createdAt > 600000) {
      const error = new Error('Invalid or expired OAuth state'); error.status = 401; throw error;
    }
    const identity = await oauthExchangeCode(provider, String(req.query.code || ''));
    const user = await store.transaction((db) => {
      // 1) returning SSO user; 2) existing real account with the same verified
      // email (link it); 3) brand-new account. Demo accounts can't be claimed.
      let found = db.users.find((item) => item.authProvider === provider && item.authSubject === identity.sub);
      if (!found && identity.email) found = db.users.find((item) => item.demo !== true && item.email && item.email.toLowerCase() === identity.email);
      if (found) {
        Object.assign(found, { authProvider: provider, authSubject: identity.sub, provider, photo: found.photo || identity.picture });
        return found;
      }
      const created = {
        id: `u-${crypto.randomUUID().slice(0, 8)}`, role: statePayload.role, name: identity.name || 'New member', email: identity.email,
        ...(statePayload.role === 'employer' ? { kind: 'company' } : {}),
        authProvider: provider, authSubject: identity.sub, provider,
        title: statePayload.role === 'candidate' ? 'New member' : 'Recruiter',
        photo: identity.picture || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(identity.name || 'user')}`,
        skills: [], languages: [], experienceLevel: 'mid', completeness: 15, onboarding: true, createdAt: Date.now(),
      };
      db.users.push(created);
      return created;
    });
    setCookie(res, 'jm_oauth_state', '', { maxAge: 0 });
    issueSession(res, user);
    res.redirect(`${APP_PATH}?sso=ok`);
  } catch (error) { next(error); }
});

// Demo login dropdown: demo-flagged accounts only — real users are never listed,
// and emails stay out of the listing.
app.get('/api/auth/profiles', async (_req, res, next) => {
  try {
    if (!demoAuth) { const error = new Error('Demo logins are disabled'); error.status = 403; throw error; }
    const db = await store.read();
    res.json({
      profiles: db.users
        .filter((user) => user.demo === true && !String(user.id).startsWith('sso-'))
        .map((user) => ({ id: user.id, role: user.role, kind: user.kind, name: user.name, title: user.title, company: user.company, demo: true })),
    });
  } catch (error) { next(error); }
});

// Login: { email, password } for real accounts; { userId } instant-login for
// demo-flagged accounts when demo auth is enabled. Both issue a session cookie.
app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const db = await store.read();
    let user;
    if (typeof req.body.userId === 'string' && req.body.userId) {
      if (!demoAuth) { const error = new Error('Demo logins are disabled — sign in with your email and password'); error.status = 403; throw error; }
      user = db.users.find((item) => item.id === req.body.userId && item.demo === true);
      if (!user) { const error = new Error('Unknown demo profile'); error.status = 404; throw error; }
    } else {
      const email = reqString(req.body, 'email', { max: 200 }).toLowerCase();
      const password = reqString(req.body, 'password', { max: 200 });
      user = db.users.find((item) => item.email && item.email.toLowerCase() === email);
      // Same error for wrong email and wrong password — no account probing.
      if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
        const error = new Error('Email or password is incorrect'); error.status = 401; throw error;
      }
    }
    issueSession(res, user);
    res.json({ user: publicProfile(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/sso', authLimiter, async (req, res, next) => {
  try {
    if (!demoAuth) { const error = new Error('Mock SSO is disabled'); error.status = 403; throw error; }
    const provider = oneOf(req.body, 'provider', ['linkedin', 'google']);
    const db = await store.read();
    const user = db.users.find((item) => item.id === `sso-${provider}-demo`);
    if (!user) { const error = new Error('SSO demo profile missing'); error.status = 500; throw error; }
    issueSession(res, user);
    res.json({ user: publicProfile(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const role = oneOf(req.body, 'role', ['candidate', 'employer']);
    const kind = oneOf(req.body, 'kind', ['company', 'headhunter'], { optional: true });
    const provider = oneOf(req.body, 'provider', ['linkedin', 'google', 'email'], { optional: true });
    const name = reqString(req.body, 'name', { max: 120 });
    const email = reqString(req.body, 'email', { max: 200 });
    if (!/.+@.+\..+/.test(email)) throw new ValidationError('email', 'A valid email address is required');
    const password = optString(req.body, 'password', { max: 200 });
    const photo = optString(req.body, 'photo', { max: 500 });
    // Real accounts require a password; demo mode keeps the near-instant flow.
    if (!demoAuth && !validPassword(password)) throw new ValidationError('password', `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    if (password !== undefined && !validPassword(password)) throw new ValidationError('password', `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    const user = await store.transaction((db) => {
      const existing = db.users.find((item) => item.email && item.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        // Demo accounts and real accounts can never be claimed by re-registering.
        if (existing.demo === true || existing.passwordHash || !demoAuth) {
          const error = new Error('An account with this email already exists — log in instead'); error.status = 409; throw error;
        }
        return existing; // demo-mode passwordless idempotency
      }
      const created = {
        id: `u-${crypto.randomUUID().slice(0, 8)}`, role, name, email,
        ...(role === 'employer' ? { kind: kind || 'company' } : {}),
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        provider: provider || 'email',
        title: role === 'candidate' ? 'New member' : 'Recruiter',
        photo: photo || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
        skills: [], languages: [], experienceLevel: 'mid', completeness: 15, onboarding: true, createdAt: Date.now(),
      };
      db.users.push(created);
      return created;
    });
    issueSession(res, user);
    res.status(201).json({ user: publicProfile(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/logout', (_req, res) => {
  setCookie(res, AUTH_COOKIE, '', { maxAge: 0 });
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res, next) => {
  try {
    const session = authSession(req);
    if (!session) return res.status(401).json({ authenticated: false });
    const db = await store.read();
    const user = db.users.find((item) => item.id === session.sub);
    if (!user) return res.status(401).json({ authenticated: false });
    res.json({ authenticated: true, user: publicProfile(user) });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Profile: wizard saves + resume upload
// ---------------------------------------------------------------------------

app.patch('/api/users/:id', async (req, res, next) => {
  try {
    requireSelf(req, req.params.id);
    const user = await store.transaction((db) => {
      const item = db.users.find((entry) => entry.id === req.params.id);
      if (!item) { const error = new Error('User not found'); error.status = 404; throw error; }
      assertDemoActor(req, db, item.id);
      if (item.role === 'candidate') { applyCandidateProfile(item, req.body); item.completeness = candidateCompleteness(item); }
      else { applyRecruiterProfile(item, req.body); item.completeness = recruiterCompleteness(item); }
      return item;
    });
    res.json({ user });
  } catch (error) { next(error); }
});

// UPLOADS_DIR keeps user files outside the release directory in production,
// so resumes survive deploys (e.g. /var/lib/jobsmatchnow/uploads).
const RESUME_DIR = process.env.UPLOADS_DIR
  ? path.join(process.env.UPLOADS_DIR, 'resumes')
  : path.join(dirname, 'uploads', 'resumes');
await fs.promises.mkdir(RESUME_DIR, { recursive: true });
const RESUME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/**
 * Demo access rule: the owner always sees their full resume; a recruiter sees
 * it only after a mutual match with that candidate. Everyone else gets the
 * anonymized preview. (Demo-level check via viewerId param — a real deployment
 * would derive the viewer from an authenticated session.)
 */
function fullResumeAccess(db, viewerId, ownerId) {
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;
  return db.matches.some((match) => match.candidateId === ownerId && match.employerId === viewerId);
}

async function processResume(userId, meta) {
  const originalPath = path.join(RESUME_DIR, meta.storedName);
  const base = path.join(RESUME_DIR, `${userId}-${meta.id}`);
  let pdfPath = meta.ext === 'pdf' ? originalPath : null;
  if (meta.ext === 'docx') {
    const converted = await convertDocxToPdf(originalPath, RESUME_DIR);
    if (converted) { meta.pdfName = path.basename(converted); pdfPath = converted; }
    else {
      // LibreOffice unavailable: mammoth HTML keeps DOCX viewable in-app.
      try { await fs.promises.writeFile(`${base}.html`, await docxToHtml(originalPath)); meta.htmlName = path.basename(`${base}.html`); } catch { /* viewer falls back to text */ }
    }
  }
  try {
    const text = meta.ext === 'docx' ? await extractDocxText(originalPath) : await extractPdfText(originalPath);
    await fs.promises.writeFile(`${base}.txt`, text);
    meta.textName = path.basename(`${base}.txt`);
  } catch { /* preview will report extraction unavailable */ }
  if (pdfPath) {
    const thumb = await pdfThumbnail(pdfPath, `${base}-thumb`);
    if (thumb) meta.thumbName = path.basename(thumb);
    else meta.needsClientThumbnail = true; // uploader's browser renders page 1 with pdf.js and posts it back
  }
  return meta;
}

const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, bucket: 'upload' });

app.post('/api/users/:id/resume', uploadLimiter, express.raw({ type: () => true, limit: '10mb' }), async (req, res, next) => {
  try {
    requireSelf(req, req.params.id);
    const ext = RESUME_TYPES[req.headers['content-type']];
    if (!ext) { const error = new Error('Only PDF or DOCX resumes are accepted'); error.status = 415; throw error; }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ValidationError('file', 'Empty upload');
    const originalName = decodeURIComponent(String(req.headers['x-filename'] || `resume.${ext}`)).replace(/[/\\]/g, '_').slice(0, 200);
    const id = crypto.randomUUID();
    const storedName = `${req.params.id}-${id}.${ext}`;
    await fs.promises.writeFile(path.join(RESUME_DIR, storedName), req.body);
    const meta = await processResume(req.params.id, {
      id, originalName, storedName, ext, size: req.body.length, mime: req.headers['content-type'], uploadedAt: Date.now(),
      url: `/api/users/${req.params.id}/resume/original`,
      thumbnailUrl: `/api/users/${req.params.id}/resume/thumbnail`,
    });
    const user = await store.transaction((db) => {
      const item = db.users.find((entry) => entry.id === req.params.id);
      if (!item) { const error = new Error('User not found'); error.status = 404; throw error; }
      assertDemoActor(req, db, item.id);
      item.documents = { ...(item.documents || {}), resume: meta };
      if (item.role === 'candidate') item.completeness = candidateCompleteness(item);
      return item;
    });
    res.status(201).json({ resume: meta, completeness: user.completeness });
  } catch (error) { next(error); }
});

app.post('/api/users/:id/resume/thumbnail', uploadLimiter, express.raw({ type: 'image/png', limit: '2mb' }), async (req, res, next) => {
  try {
    requireSelf(req, req.params.id);
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ValidationError('file', 'Empty thumbnail');
    const resume = await store.transaction((db) => {
      const item = db.users.find((entry) => entry.id === req.params.id);
      if (!item?.documents?.resume) { const error = new Error('No resume on file'); error.status = 404; throw error; }
      assertDemoActor(req, db, item.id);
      item.documents.resume.thumbName = `${req.params.id}-${item.documents.resume.id}-thumb.png`;
      delete item.documents.resume.needsClientThumbnail;
      return item.documents.resume;
    });
    await fs.promises.writeFile(path.join(RESUME_DIR, resume.thumbName), req.body);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

// Give every seed candidate a realistic on-disk resume (with contact details,
// so the pre-match anonymization is demonstrable). Idempotent.
await (async () => {
  const db = await store.read();
  const seedCandidates = db.users.filter((user) => user.role === 'candidate' && !user.documents?.resume);
  for (const candidate of seedCandidates) {
    const phone = `+84 90${String(Math.abs([...candidate.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % 10000000).padStart(7, '0')}`;
    const lines = [
      candidate.name,
      `${candidate.title} · ${candidate.location || ''}`,
      `Email: ${candidate.email || 'hello@example.com'}   Phone: ${phone}`,
      '',
      'SUMMARY',
      `${candidate.experienceLevel} professional focused on ${candidate.skills.slice(0, 3).join(', ')}.`,
      'Track record of shipping user-centred work with cross-functional teams.',
      '',
      'SKILLS',
      candidate.skills.join(' · '),
      '',
      'LANGUAGES',
      candidate.languages.join(' · '),
      '',
      'EXPERIENCE',
      `${candidate.title} — most recent role`,
      'Led projects end-to-end, from discovery through launch and iteration.',
      'Partnered with product and engineering to raise the craft bar.',
    ];
    const id = crypto.randomUUID();
    const storedName = `${candidate.id}-${id}.pdf`;
    await fs.promises.writeFile(path.join(RESUME_DIR, storedName), makeSimplePdf(lines));
    const meta = await processResume(candidate.id, {
      id, originalName: `${candidate.name.replace(/\s+/g, '-')}-Resume.pdf`, storedName, ext: 'pdf', size: 0, mime: 'application/pdf', uploadedAt: Date.now(),
      url: `/api/users/${candidate.id}/resume/original`, thumbnailUrl: `/api/users/${candidate.id}/resume/thumbnail`,
    });
    meta.size = (await fs.promises.stat(path.join(RESUME_DIR, storedName))).size;
    await store.transaction((inner) => {
      const item = inner.users.find((entry) => entry.id === candidate.id);
      if (item && !item.documents?.resume) item.documents = { ...(item.documents || {}), resume: meta };
    });
  }
})();

async function loadResume(req) {
  const db = await store.read();
  const user = db.users.find((entry) => entry.id === req.params.id);
  const resume = user?.documents?.resume;
  if (!resume) { const error = new Error('No resume on file'); error.status = 404; throw error; }
  // Session identity wins; the query param only counts in demo mode, and even
  // then only for demo-flagged viewers (real identities need their session).
  const session = authSession(req);
  let viewerId = session ? session.sub : (demoAuth && typeof req.query.viewerId === 'string' ? req.query.viewerId : '');
  if (!session && viewerId) {
    const claimed = db.users.find((item) => item.id === viewerId);
    if (claimed && claimed.demo !== true) viewerId = '';
  }
  return { db, user, resume, viewerId };
}

// Descriptor the in-app viewer uses to decide how to render.
app.get('/api/users/:id/resume/view', async (req, res, next) => {
  try {
    const { db, resume, viewerId } = await loadResume(req);
    const unlocked = fullResumeAccess(db, viewerId, req.params.id);
    const tools = await detectTools();
    if (!unlocked) return res.json({ mode: 'preview', name: 'Anonymized resume', previewUrl: `/api/users/${req.params.id}/resume/preview?viewerId=${encodeURIComponent(viewerId)}` });
    const hasPdf = resume.ext === 'pdf' || resume.pdfName;
    res.json({
      mode: hasPdf ? 'pdf' : resume.htmlName ? 'html' : 'text',
      name: resume.originalName, size: resume.size, uploadedAt: resume.uploadedAt, converter: tools.soffice ? 'libreoffice' : 'mammoth',
      pdfUrl: hasPdf ? `/api/users/${req.params.id}/resume/pdf?viewerId=${encodeURIComponent(viewerId)}` : undefined,
      htmlUrl: resume.htmlName ? `/api/users/${req.params.id}/resume/html?viewerId=${encodeURIComponent(viewerId)}` : undefined,
      textUrl: `/api/users/${req.params.id}/resume/preview?viewerId=${encodeURIComponent(viewerId)}`,
      originalUrl: `/api/users/${req.params.id}/resume/original?viewerId=${encodeURIComponent(viewerId)}`,
    });
  } catch (error) { next(error); }
});

app.get('/api/users/:id/resume/pdf', async (req, res, next) => {
  try {
    const { db, resume, viewerId } = await loadResume(req);
    if (!fullResumeAccess(db, viewerId, req.params.id)) { const error = new Error('Full resume unlocks after a mutual match'); error.status = 403; throw error; }
    const fileName = resume.ext === 'pdf' ? resume.storedName : resume.pdfName;
    if (!fileName) { const error = new Error('No PDF rendition available'); error.status = 404; throw error; }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resume.originalName.replace(/\.docx$/i, '.pdf'))}"`);
    res.sendFile(path.join(RESUME_DIR, fileName));
  } catch (error) { next(error); }
});

app.get('/api/users/:id/resume/html', async (req, res, next) => {
  try {
    const { db, resume, viewerId } = await loadResume(req);
    if (!fullResumeAccess(db, viewerId, req.params.id)) { const error = new Error('Full resume unlocks after a mutual match'); error.status = 403; throw error; }
    if (!resume.htmlName) { const error = new Error('No HTML rendition available'); error.status = 404; throw error; }
    res.json({ html: await fs.promises.readFile(path.join(RESUME_DIR, resume.htmlName), 'utf8') });
  } catch (error) { next(error); }
});

// Anonymized text preview: available pre-match (consent-first).
app.get('/api/users/:id/resume/preview', async (req, res, next) => {
  try {
    const { db, user, resume, viewerId } = await loadResume(req);
    if (!resume.textName) return res.json({ text: '', note: 'Text extraction unavailable for this file.' });
    const raw = await fs.promises.readFile(path.join(RESUME_DIR, resume.textName), 'utf8');
    const unlocked = fullResumeAccess(db, viewerId, req.params.id);
    res.json({ text: unlocked ? raw : anonymizeText(raw, user), anonymized: !unlocked });
  } catch (error) { next(error); }
});

app.get('/api/users/:id/resume/thumbnail', async (req, res, next) => {
  try {
    const { resume } = await loadResume(req);
    if (!resume.thumbName) { const error = new Error('No thumbnail'); error.status = 404; throw error; }
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(path.join(RESUME_DIR, resume.thumbName));
  } catch (error) { next(error); }
});

app.get('/api/users/:id/resume/original', async (req, res, next) => {
  try {
    const { db, resume, viewerId } = await loadResume(req);
    if (!fullResumeAccess(db, viewerId, req.params.id)) { const error = new Error('Full resume unlocks after a mutual match'); error.status = 403; throw error; }
    res.setHeader('Content-Type', resume.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resume.originalName)}"`);
    res.sendFile(path.join(RESUME_DIR, resume.storedName));
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Job postings: create, update, paste-import parsing
// ---------------------------------------------------------------------------

const JOB_ACCENTS = ['#3d5afe', '#ff5a5f', '#00a884', '#8b5cf6', '#f59e0b', '#0ea5e9', '#e11d48'];

app.post('/api/jobs', async (req, res, next) => {
  try {
    const employerId = resolveActor(req, reqString(req.body, 'employerId', { max: 128 }));
    const job = await store.transaction((db) => {
      const employer = db.users.find((user) => user.id === employerId && user.role === 'employer');
      if (!employer) throw new ValidationError('employerId', 'Unknown recruiter account');
      assertDemoActor(req, db, employerId);
      const created = applyJob({
        id: `j-${crypto.randomUUID().slice(0, 8)}`, employerId,
        company: employer.company || employer.name,
        logo: (employer.company || employer.name || '?').trim()[0].toUpperCase(),
        accent: JOB_ACCENTS[db.jobs.length % JOB_ACCENTS.length],
        requiredLanguages: [], culture: [], mission: employer.about ? employer.about.slice(0, 80) : 'Posted on JobsMatchNow.',
        responseTime: '< 1 week', applicants: 0, status: 'draft', createdAt: Date.now(),
      }, req.body, { strict: true });
      // Item 11: suggest screening questions from the required skills.
      if (!created.screeningQuestions?.length) created.screeningQuestions = suggestScreeningQuestions(created);
      db.jobs.push(created);
      return created;
    });
    res.status(201).json({ job });
  } catch (error) { next(error); }
});

app.patch('/api/jobs/:id', async (req, res, next) => {
  try {
    const session = authSession(req);
    if (!session && !demoAuth) { const error = new Error('Sign in to continue'); error.status = 401; throw error; }
    const job = await store.transaction((db) => {
      const item = db.jobs.find((entry) => entry.id === req.params.id);
      if (!item) { const error = new Error('Job not found'); error.status = 404; throw error; }
      if (session && item.employerId !== session.sub) { const error = new Error('You can only edit your own postings'); error.status = 403; throw error; }
      assertDemoActor(req, db, item.employerId); // a real user's posting needs their session
      return applyJob(item, req.body);
    });
    res.json({ job });
  } catch (error) { next(error); }
});

app.post('/api/jobs/parse', async (req, res, next) => {
  try {
    const text = reqString(req.body, 'text', { min: 40, max: 20000 });
    const url = optString(req.body, 'url', { max: 400 });
    res.json(await parseJobText(text, url));
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Coaching: interview prep (item 9), screening suggestions (11), kits (12)
// ---------------------------------------------------------------------------

app.get('/api/jobs/:id/prep', async (req, res, next) => {
  try {
    const db = await store.read();
    const job = db.jobs.find((item) => item.id === req.params.id);
    if (!job) { const error = new Error('Job not found'); error.status = 404; throw error; }
    if (job.prepCache) return res.json(job.prepCache); // cached per job
    const prep = await generatePrep(job);
    await store.transaction((inner) => {
      const item = inner.jobs.find((entry) => entry.id === req.params.id);
      if (item) item.prepCache = prep;
    });
    res.json(prep);
  } catch (error) { next(error); }
});

app.post('/api/coach/screening', (req, res, next) => {
  try {
    const skills = req.body?.requiredSkillsDetail;
    if (!Array.isArray(skills) || !skills.length) throw new ValidationError('requiredSkillsDetail', 'Provide the required skills first');
    res.json({ questions: suggestScreeningQuestions({ requiredSkillsDetail: skills }) });
  } catch (error) { next(error); }
});

app.get('/api/matches/:id/icebreakers', async (req, res, next) => {
  try {
    const db = await store.read();
    const match = db.matches.find((item) => item.id === req.params.id);
    if (!match) { const error = new Error('Match not found'); error.status = 404; throw error; }
    if (match.icebreakerCache) return res.json(match.icebreakerCache);
    const result = await generateIcebreakers(db.users.find((user) => user.id === match.candidateId) || {}, db.jobs.find((item) => item.id === match.jobId) || {});
    await store.transaction((inner) => {
      const item = inner.matches.find((entry) => entry.id === req.params.id);
      if (item) item.icebreakerCache = result;
    });
    res.json(result);
  } catch (error) { next(error); }
});

app.get('/api/matches/:id/kit', async (req, res, next) => {
  try {
    const db = await store.read();
    const match = db.matches.find((item) => item.id === req.params.id);
    if (!match) { const error = new Error('Match not found'); error.status = 404; throw error; }
    if (match.kitCache) return res.json(match.kitCache);
    const candidate = db.users.find((user) => user.id === match.candidateId);
    const job = db.jobs.find((item) => item.id === match.jobId);
    const kit = await generateInterviewKit(candidate || {}, job || {});
    await store.transaction((inner) => {
      const item = inner.matches.find((entry) => entry.id === req.params.id);
      if (item) item.kitCache = kit;
    });
    res.json(kit);
  } catch (error) { next(error); }
});

app.get('/api/bootstrap', async (req, res, next) => {
  try {
    const db = await store.read();
    const requestedId = resolveActor(req, typeof req.query.userId === 'string' ? req.query.userId : '');
    const fallbackRole = req.query.role === 'employer' ? 'employer' : 'candidate';
    const viewer = db.users.find((user) => user.id === requestedId) || (demoAuth ? db.users.find((user) => user.id === `${fallbackRole}-demo`) : undefined);
    if (!viewer) { const error = new Error('Sign in to continue'); error.status = 401; throw error; }
    assertDemoActor(req, db, viewer.id);
    const role = viewer.role === 'employer' ? 'employer' : 'candidate';
    const candidates = db.users.filter((user) => user.role === 'candidate');
    // Mutual salary reveal: exact ranges are hidden until both sides matched.
    const matchedJobIds = new Set(db.matches.filter((match) => match.candidateId === viewer.id).map((match) => match.jobId));
    const matchedCandidateIds = new Set(db.matches.filter((match) => match.employerId === viewer.id).map((match) => match.candidateId));
    const scoredJobs = db.jobs.map((job) => {
      const withDistance = { ...job, distanceKm: job.distanceKm ?? demoDistances[job.id] };
      const match = scoreCandidateForJob(viewer, withDistance);
      if (role === 'candidate' && !matchedJobIds.has(job.id)) {
        delete withDistance.salary; delete withDistance.salaryRange;
        withDistance.salaryHidden = true;
      }
      return { ...withDistance, match };
    });
    // Score candidates against this recruiter's own (first active) job when possible.
    const referenceJob = db.jobs.find((job) => job.employerId === viewer.id && String(job.status).toLowerCase() === 'active')
      || db.jobs.find((job) => job.employerId === viewer.id) || db.jobs[0];
    // Deck candidates: contact details and exact salary stay hidden until a mutual match.
    const scoredCandidates = candidates.filter((candidate) => candidate.id !== viewer.id).map(({ email, phone, ...candidate }) => {
      const withDistance = { ...candidate, distanceKm: candidate.distanceKm ?? demoDistances[candidate.id] };
      const match = scoreCandidateForJob(withDistance, { ...referenceJob, distanceKm: withDistance.distanceKm });
      if (!matchedCandidateIds.has(candidate.id) && withDistance.preferences?.salary) {
        withDistance.preferences = { ...withDistance.preferences, salary: undefined };
        withDistance.salaryHidden = true;
      }
      return { ...withDistance, match };
    });
    const matches = db.matches.filter((match) => role === 'candidate' ? match.candidateId === viewer.id : match.employerId === viewer.id).map((match) => ({
      ...match,
      candidate: db.users.find((user) => user.id === match.candidateId),
      job: db.jobs.find((job) => job.id === match.jobId),
      screeningAnswers: db.swipes.find((swipe) => swipe.actorId === match.candidateId && swipe.targetId === match.jobId && swipe.direction === 'like')?.answers,
    }));
    const matchIds = new Set(matches.map((match) => match.id));
    res.json({ viewer, jobs: scoredJobs, candidates: scoredCandidates, matches, messages: db.messages.filter((message) => matchIds.has(message.matchId)), likesRemaining: likesRemainingToday(db.swipes, viewer.id) });
  } catch (error) { next(error); }
});

app.post('/api/swipes', async (req, res, next) => {
  try {
    const actorId = resolveActor(req, reqString(req.body, 'actorId', { max: 128 }));
    const targetId = reqString(req.body, 'targetId', { max: 128 });
    const targetType = oneOf(req.body, 'targetType', ['job', 'candidate']);
    const direction = oneOf(req.body, 'direction', ['like', 'pass']);
    // Item 11: candidate answers to the job's screening questions ride on the like-swipe.
    const answers = Array.isArray(req.body.answers)
      ? req.body.answers.map((item) => ({ question: String(item?.question || '').slice(0, 300), answer: String(item?.answer || '').slice(0, 600) })).filter((item) => item.question && item.answer).slice(0, 5)
      : undefined;
    const result = await store.transaction((db) => {
      const actor = db.users.find((user) => user.id === actorId);
      if (!actor) throw new ValidationError('actorId', 'Unknown user');
      assertDemoActor(req, db, actorId);
      if (direction === 'like' && likesRemainingToday(db.swipes, actorId) <= 0) {
        const error = new Error('Daily like limit reached'); error.status = 429; throw error;
      }
      const existing = db.swipes.find((swipe) => swipe.actorId === actorId && swipe.targetType === targetType && swipe.targetId === targetId);
      if (existing) return { swipe: existing, match: null, duplicate: true };
      const swipe = { id: crypto.randomUUID(), actorId, targetId, targetType, direction, createdAt: Date.now(), ...(answers ? { answers } : {}) };
      const mutual = detectMutualMatch(swipe, db);
      db.swipes.push(swipe);
      let match = null;
      if (mutual && !db.matches.some((item) => item.candidateId === mutual.candidateId && item.jobId === mutual.jobId)) {
        match = { id: crypto.randomUUID(), ...mutual, stage: 'Matched', createdAt: Date.now() };
        db.matches.push(match);
        // Expand for the match screen: names, photos, and the mutual salary reveal.
        match = { ...match, candidate: db.users.find((user) => user.id === match.candidateId), job: db.jobs.find((job) => job.id === match.jobId) };
      }
      return { swipe, match, duplicate: false, likesRemaining: likesRemainingToday(db.swipes, actorId) };
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

app.patch('/api/matches/:id', async (req, res, next) => {
  try {
    const stage = oneOf(req.body, 'stage', ['Matched', 'Screen', 'Interview', 'Offer', 'Hired', 'Archived']);
    const session = authSession(req);
    if (!session && !demoAuth) { const error = new Error('Sign in to continue'); error.status = 401; throw error; }
    const match = await store.transaction((db) => {
      const item = db.matches.find((entry) => entry.id === req.params.id);
      if (!item) { const error = new Error('Match not found'); error.status = 404; throw error; }
      if (session && item.candidateId !== session.sub && item.employerId !== session.sub) { const error = new Error('Only the matched parties can update this match'); error.status = 403; throw error; }
      assertDemoActor(req, db, item.employerId); // matches involving a real account need a party session
      item.stage = stage;
      item.stageChangedAt = Date.now(); // idle-time tracking for pipeline nudges
      return item;
    });
    res.json(match);
  } catch (error) { next(error); }
});

app.post('/api/messages', async (req, res, next) => {
  try {
    const matchId = reqString(req.body, 'matchId', { max: 128 });
    const senderId = resolveActor(req, reqString(req.body, 'senderId', { max: 128 }));
    const text = reqString(req.body, 'text', { max: 2000 });
    const message = await store.transaction((db) => {
      const match = db.matches.find((item) => item.id === matchId);
      if (!match) { const error = new Error('Match not found'); error.status = 404; throw error; }
      assertDemoActor(req, db, senderId);
      if (authSession(req) && senderId !== match.candidateId && senderId !== match.employerId) {
        const error = new Error('Only the matched parties can message this thread'); error.status = 403; throw error;
      }
      const item = { id: crypto.randomUUID(), matchId, senderId, text, createdAt: Date.now() };
      db.messages.push(item);
      return item;
    });
    res.status(201).json(message);
  } catch (error) { next(error); }
});

app.use('/assets', express.static(path.join(root, 'dist', 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(path.join(root, 'dist')));
app.get('*', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(root, 'dist', 'index.html')));
app.use((error, _req, res, _next) => {
  const status = error.status || (error instanceof ValidationError ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? 'Unexpected server error' : error.message, field: error.field });
});

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 3001);
  app.listen(port, () => console.log(`JobMatch API listening on http://localhost:${port}`));
}
