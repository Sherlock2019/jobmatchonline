import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './store.js';
import { PgStore } from './store-pg.js';
import { createSeed } from './seed.js';
import { matchingPool, targetIsInMatchingPool } from './matching-pool.js';
import { importMetadata, normalizeLinkedInImports, parseJobImportFile } from './job-import.js';
import { detectMutualMatch, isStrongRoleMatch, likesRemainingToday, scoreCandidateForJob, ValidationError, reqString, optString, optStringArray, oneOf } from './matching.js';
import { applyCandidateProfile, applyRecruiterProfile, candidateCompleteness, recruiterCompleteness } from './profile.js';
import { anonymizeText, convertDocxToPdf, detectTools, docxToHtml, extractDocxText, extractPdfText, makeSimplePdf, pdfThumbnail } from './resume.js';
import { applyJob, parseJobText } from './jobs.js';
import { backupToS3, mirrorToS3, restoreFromS3, s3Enabled } from './storage.js';
import { parseResumeToProfile } from './resume-parse.js';
import os from 'node:os';
import { generateIcebreakers, generateInterviewKit, generatePrep, suggestScreeningQuestions } from './coaching.js';
import { PASSWORD_MIN_LENGTH, hashPassword, rateLimit, validPassword, verifyPassword } from './auth.js';
import { mailerConfigured, sendMail } from './mailer.js';
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
  for (const collection of ['users', 'jobs', 'swipes', 'matches', 'messages', 'calls']) {
    if (!Array.isArray(db[collection])) db[collection] = [];
    const byId = new Map(db[collection].map((item) => [item.id, item]));
    for (const item of seed[collection]) {
      const existing = byId.get(item.id);
      if (!existing) db[collection].push(item);
      else if (item.demoTemplate) Object.assign(existing, item);
      else for (const [key, value] of Object.entries(item)) if (existing[key] === undefined) existing[key] = value;
    }
  }
  // Remove the retired flagship demo relationships that were replaced by the
  // Sofia/Sarah reference dataset. User-created records are never touched.
  const retiredDemoIds = {
    swipes: new Set(['s-seed-1']),
    matches: new Set(['m-candidate', 'm-existing', 'm-priya']),
    messages: new Set(['msg-candidate-1', 'msg-1', 'msg-2']),
    calls: new Set(['call-existing']),
  };
  for (const [collection, ids] of Object.entries(retiredDemoIds)) {
    db[collection] = db[collection].filter((item) => !ids.has(item.id));
  }
  // Merge seed reviews by id and backfill `approved` on them, so the starter
  // reviews stay visible after the moderation field was introduced.
  if (!Array.isArray(db.feedback)) db.feedback = [];
  for (const f of seed.feedback || []) {
    const existing = db.feedback.find((entry) => entry.id === f.id);
    if (!existing) db.feedback.push(f);
    else if (existing.approved === undefined) existing.approved = f.approved;
  }
  // Scheduled calls were introduced after the store may already exist on disk.
  if (!Array.isArray(db.bookmarks)) db.bookmarks = [];
});
console.log(`JobMatch store: ${process.env.DATABASE_URL ? 'postgresql (RDS)' : 'json file'}`);
const demoDistances = { 'j-1': 7, 'j-2': 18, 'j-3': 42, 'j-4': 75, 'c-1': 5, 'c-2': 26, 'c-3': 12, 'c-4': 65 };

/** A profile counts as verified once it's SSO-authenticated or well filled in. */
function verifiedUser(user) {
  return Boolean(user && (user.authProvider || user.provider === 'google' || user.provider === 'linkedin' || (user.completeness ?? 0) >= 80));
}

/** Great-circle distance in km between two {lat,lng} points. */
function haversineKm(a, b) {
  if (!a || !b) return undefined;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
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

// Public landing showcase: recent active jobs + demo candidate cards (no PII).
app.get('/api/showcase', async (_req, res, next) => {
  try {
    const db = await store.read();
    const jobs = db.jobs
      .filter((job) => job.demo || String(job.status).toLowerCase() === 'active')
      .slice(-10).reverse()
      .map((job) => {
        const employer = db.users.find((user) => user.id === job.employerId);
        return { id: job.id, employerId: job.employerId, title: job.title, company: job.company, companyLogo: employer?.companyLogo, logo: job.logo, accent: job.accent, location: job.location, workMode: job.workMode, remoteScope: job.remoteScope, country: job.country, salary: job.salary, type: job.type, department: job.department, status: job.status, createdAt: job.createdAt, requiredSkills: (job.requiredSkills || []).slice(0, 8), description: job.description, responsibilities: (job.responsibilities || []).slice(0, 5), coverImage: job.coverImage, verified: verifiedUser(employer) };
      });
    const candidates = db.users
      .filter((user) => user.role === 'candidate' && user.demo)
      .slice(0, 10)
      .map((user) => ({ id: user.id, name: user.name, title: user.title, photo: user.photo, location: user.location, skills: (user.skills || []).slice(0, 4), availability: user.availability, experienceLevel: user.experienceLevel }));
    res.json({ jobs, candidates });
  } catch (error) { next(error); }
});

const publicReview = (f) => ({ id: f.id, name: f.name || 'Anonymous', role: f.role, rating: f.rating, message: f.message, createdAt: f.createdAt });
const feedbackLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, bucket: 'feedback' });

// Only approved reviews are shown publicly (moderation).
app.get('/api/feedback', async (_req, res, next) => {
  try {
    const db = await store.read();
    res.json({ reviews: (db.feedback || []).filter((f) => f.type === 'review' && f.approved).slice(-8).reverse().map(publicReview) });
  } catch (error) { next(error); }
});

const BLOCKED_WORDS = /\b(fuck|shit|bitch|cunt|nigger|faggot|asshole|whore)\b/i;

app.post('/api/feedback', feedbackLimiter, async (req, res, next) => {
  try {
    const type = oneOf(req.body, 'type', ['review', 'suggestion']);
    const message = reqString(req.body, 'message', { min: 3, max: 1000 });
    if (BLOCKED_WORDS.test(message)) throw new ValidationError('message', 'Please keep it respectful.');
    const name = optString(req.body, 'name', { max: 80 });
    const role = optString(req.body, 'role', { max: 80 });
    const rating = type === 'review' ? Math.max(1, Math.min(5, Math.round(Number(req.body.rating) || 5))) : undefined;
    // New submissions are held for moderation — never shown until approved.
    const entry = { id: `fb-${crypto.randomUUID().slice(0, 8)}`, type, name: name || 'Anonymous', role, rating, message, approved: false, createdAt: Date.now() };
    await store.transaction((db) => { db.feedback = Array.isArray(db.feedback) ? db.feedback : []; db.feedback.push(entry); });
    res.status(201).json({ ok: true, pending: true });
  } catch (error) { next(error); }
});

// Admin moderation (gated by ADMIN_TOKEN header). List + approve.
function requireAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.headers['x-admin-token'] !== token) { const error = new Error('Admin access required'); error.status = 403; throw error; }
}
app.get('/api/admin/feedback', async (req, res, next) => {
  try { requireAdmin(req); const db = await store.read(); res.json({ feedback: (db.feedback || []).slice().reverse() }); }
  catch (error) { next(error); }
});
app.post('/api/admin/feedback/:id/approve', async (req, res, next) => {
  try {
    requireAdmin(req);
    const entry = await store.transaction((db) => { const f = (db.feedback || []).find((item) => item.id === req.params.id); if (f) f.approved = true; return f; });
    if (!entry) { const error = new Error('Not found'); error.status = 404; throw error; }
    res.json({ ok: true, entry });
  } catch (error) { next(error); }
});

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
  return { id: user.id, role: user.role, kind: user.kind, name: user.name, email: user.email, title: user.title, company: user.company, photo: user.photo, provider: user.provider, completeness: user.completeness, demo: user.demo === true, emailVerified: user.emailVerified !== false };
}

// ---------------------------------------------------------------------------
// Email verification + password reset (mailer-optional).
// ---------------------------------------------------------------------------
const publicOrigin = (process.env.PUBLIC_ORIGIN || 'https://jobsmatchnow.com').replace(/\/$/, '');
function actionToken(purpose, userId, ttlMs) {
  return signedValue({ purpose, sub: userId, expiresAt: Date.now() + ttlMs }, sessionSecret);
}
function readActionToken(token, purpose) {
  const payload = readSignedValue(token, sessionSecret);
  if (!payload || payload.purpose !== purpose || payload.expiresAt < Date.now() || typeof payload.sub !== 'string') return null;
  return payload;
}
async function sendVerificationEmail(user) {
  const token = actionToken('verify', user.id, 48 * 3600 * 1000);
  const link = `${publicOrigin}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMail({ to: user.email, subject: 'Verify your JobsMatchNow email', text: `Welcome to JobsMatchNow! Confirm your email:\n${link}\n\nThis link expires in 48 hours.` });
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
        .filter((user) => user.demoTemplate === true && /^(candidate|employer)-demo(-\d+)?$/.test(user.id))
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
      // Password accounts need email verification once a mailer is configured;
      // without one (demo/dev) they're auto-verified so the flow stays usable.
      const needsVerification = Boolean(password) && mailerConfigured();
      const created = {
        id: `u-${crypto.randomUUID().slice(0, 8)}`, role, name, email,
        ...(role === 'employer' ? { kind: kind || 'company' } : {}),
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        provider: provider || 'email',
        emailVerified: !needsVerification,
        title: role === 'candidate' ? 'New member' : 'Recruiter',
        photo: photo || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
        skills: [], languages: [], experienceLevel: 'mid', completeness: 15, onboarding: true, createdAt: Date.now(),
      };
      db.users.push(created);
      return created;
    });
    if (user.emailVerified === false) await sendVerificationEmail(user).catch((e) => console.error('verify email failed', e.message));
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

app.get('/api/auth/verify', async (req, res, next) => {
  try {
    const payload = readActionToken(String(req.query.token || ''), 'verify');
    if (!payload) return res.redirect(`${APP_PATH}?verify=expired`);
    await store.transaction((db) => { const u = db.users.find((item) => item.id === payload.sub); if (u) u.emailVerified = true; });
    res.redirect(`${APP_PATH}?verify=ok`);
  } catch (error) { next(error); }
});

app.post('/api/auth/resend-verification', authLimiter, async (req, res, next) => {
  try {
    const session = authSession(req);
    if (!session) { const error = new Error('Sign in first'); error.status = 401; throw error; }
    const db = await store.read();
    const user = db.users.find((item) => item.id === session.sub);
    if (user && user.emailVerified === false) await sendVerificationEmail(user).catch(() => undefined);
    res.json({ ok: true, mailer: mailerConfigured() });
  } catch (error) { next(error); }
});

app.post('/api/auth/forgot', authLimiter, async (req, res, next) => {
  try {
    const email = reqString(req.body, 'email', { max: 200 }).toLowerCase();
    const db = await store.read();
    const user = db.users.find((item) => item.email && item.email.toLowerCase() === email && item.passwordHash);
    if (user) {
      const token = actionToken('reset', user.id, 3600 * 1000);
      const link = `${publicOrigin}${APP_PATH}?reset=${encodeURIComponent(token)}`;
      await sendMail({ to: user.email, subject: 'Reset your JobsMatchNow password', text: `Reset your password:\n${link}\n\nThis link expires in 1 hour. If you didn't ask, ignore this email.` }).catch(() => undefined);
    }
    // Never reveal whether the email exists.
    res.json({ ok: true, mailer: mailerConfigured() });
  } catch (error) { next(error); }
});

app.post('/api/auth/reset', authLimiter, async (req, res, next) => {
  try {
    const payload = readActionToken(reqString(req.body, 'token', { max: 4000 }), 'reset');
    if (!payload) { const error = new Error('This reset link is invalid or expired'); error.status = 400; throw error; }
    const password = reqString(req.body, 'password', { max: 200 });
    if (!validPassword(password)) throw new ValidationError('password', `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    const user = await store.transaction((db) => {
      const u = db.users.find((item) => item.id === payload.sub);
      if (!u) { const error = new Error('Account not found'); error.status = 404; throw error; }
      u.passwordHash = hashPassword(password);
      u.emailVerified = true; // proving email control also verifies it
      return u;
    });
    issueSession(res, user);
    res.json({ ok: true, user: publicProfile(user) });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// GDPR: export my data, delete my account.
// ---------------------------------------------------------------------------
app.get('/api/me/export', async (req, res, next) => {
  try {
    const session = authSession(req);
    if (!session) { const error = new Error('Sign in first'); error.status = 401; throw error; }
    const db = await store.read();
    const me = db.users.find((item) => item.id === session.sub);
    if (!me) { const error = new Error('Account not found'); error.status = 404; throw error; }
    const { passwordHash, ...profile } = me;
    res.setHeader('Content-Disposition', 'attachment; filename="jobsmatchnow-data.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      profile,
      jobs: db.jobs.filter((j) => j.employerId === me.id),
      swipes: db.swipes.filter((s) => s.actorId === me.id),
      matches: db.matches.filter((m) => m.candidateId === me.id || m.employerId === me.id),
      messages: db.messages.filter((m) => m.senderId === me.id),
    });
  } catch (error) { next(error); }
});

app.delete('/api/me', async (req, res, next) => {
  try {
    const session = authSession(req);
    if (!session) { const error = new Error('Sign in first'); error.status = 401; throw error; }
    await store.transaction((db) => {
      const me = db.users.find((item) => item.id === session.sub);
      if (!me) { const error = new Error('Account not found'); error.status = 404; throw error; }
      if (me.demo === true) { const error = new Error('Demo accounts cannot be deleted'); error.status = 403; throw error; }
      const myMatchIds = new Set(db.matches.filter((m) => m.candidateId === me.id || m.employerId === me.id).map((m) => m.id));
      db.users = db.users.filter((u) => u.id !== me.id);
      db.jobs = db.jobs.filter((j) => j.employerId !== me.id);
      db.swipes = db.swipes.filter((s) => s.actorId !== me.id && s.targetId !== me.id);
      db.matches = db.matches.filter((m) => !myMatchIds.has(m.id));
      db.messages = db.messages.filter((m) => !myMatchIds.has(m.matchId) && m.senderId !== me.id);
      db.calls = db.calls.filter((c) => !myMatchIds.has(c.matchId) && c.createdBy !== me.id);
      db.bookmarks = db.bookmarks.filter((b) => b.userId !== me.id);
    });
    setCookie(res, AUTH_COOKIE, '', { maxAge: 0 });
    res.json({ ok: true });
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
const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(dirname, 'uploads');
const RESUME_DIR = path.join(UPLOADS_ROOT, 'resumes');
const mirror = (localPath) => mirrorToS3(localPath, UPLOADS_ROOT); // durable copy to S3 when configured
await fs.promises.mkdir(RESUME_DIR, { recursive: true });
// Restore any previously-uploaded files from S3 (survives instance replacement).
if (s3Enabled()) { await restoreFromS3(UPLOADS_ROOT); await backupToS3(UPLOADS_ROOT); console.log(`uploads: S3 mirror enabled (${process.env.S3_BUCKET})`); }
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
  // Mirror the original + every derivative to S3 (no-op when S3 isn't configured).
  for (const name of [meta.storedName, meta.pdfName, meta.htmlName, meta.textName, meta.thumbName]) {
    if (name) await mirror(path.join(RESUME_DIR, name));
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
    await mirror(path.join(RESUME_DIR, storedName));
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
    await mirror(path.join(RESUME_DIR, resume.thumbName));
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

// Auto-fill the candidate profile from the uploaded resume's extracted text.
// Returns parsed fields for the wizard to pre-fill; never persisted here.
app.post('/api/users/:id/resume/autofill', async (req, res, next) => {
  try {
    requireSelf(req, req.params.id);
    const db = await store.read();
    const user = db.users.find((item) => item.id === req.params.id);
    const resume = user?.documents?.resume;
    if (!resume?.textName) throw new ValidationError('resume', 'Upload a resume first, then auto-fill');
    const text = await fs.promises.readFile(path.join(RESUME_DIR, resume.textName), 'utf8');
    res.json(await parseResumeToProfile(text));
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Job postings: create, update, paste-import parsing
// ---------------------------------------------------------------------------

const JOB_ACCENTS = ['#3d5afe', '#ff5a5f', '#00a884', '#8b5cf6', '#f59e0b', '#0ea5e9', '#e11d48'];
const importedJobMissing = (job) => [
  !job.salaryRange && 'salary',
  !job.workMode && 'work mode',
  (!job.location || job.location === 'Review location') && 'location',
  !job.requiredSkillsDetail?.length && 'skills',
  !job.culture?.length && 'culture',
  !job.interviewProcess?.length && 'hiring process',
].filter(Boolean);

async function importJobDrafts(employerId, sourceSystem, entries) {
  const prepared = [];
  for (let index = 0; index < entries.length; index += 4) {
    const batch = await Promise.all(entries.slice(index, index + 4).map(async (entry) => {
      const result = await parseJobText(entry.rawText, entry.url);
      const parsed = { ...result.parsed, title: result.parsed.title || entry.title, externalUrl: entry.url || result.parsed.externalUrl };
      const missing = [
        !parsed.salaryRange && 'salary',
        !parsed.workMode && 'work mode',
        !parsed.location && 'location',
        !parsed.requiredSkillsDetail?.length && 'skills',
        !parsed.culture?.length && 'culture',
        !parsed.interviewProcess?.length && 'hiring process',
      ].filter(Boolean);
      return { entry, parsed, missing, metadata: importMetadata(sourceSystem, entry) };
    }));
    prepared.push(...batch);
  }

  return store.transaction((db) => {
    const employer = db.users.find((user) => user.id === employerId && user.role === 'employer');
    if (!employer) throw new ValidationError('employerId', 'Unknown recruiter account');
    const jobs = [];
    let skipped = 0;
    for (const item of prepared) {
      const duplicate = db.jobs.find((job) => job.employerId === employerId
        && job.sourceSystem === item.metadata.sourceSystem
        && job.sourceJobId === item.metadata.sourceJobId);
      if (duplicate) { skipped += 1; continue; }
      const job = {
        id: `j-${crypto.randomUUID().slice(0, 8)}`,
        employerId,
        company: employer.company || employer.name,
        logo: (employer.company || employer.name || '?').trim()[0].toUpperCase(),
        accent: JOB_ACCENTS[db.jobs.length % JOB_ACCENTS.length],
        requiredSkills: [],
        requiredSkillsDetail: [],
        requiredLanguages: [],
        culture: [],
        mission: employer.about ? employer.about.slice(0, 80) : 'Imported for review.',
        responseTime: '< 1 week',
        applicants: 0,
        status: 'draft',
        type: 'Full-time',
        workMode: 'Flexible',
        location: 'Review location',
        salary: 'Review salary',
        experienceLevel: 'mid',
        description: item.parsed.description || item.entry.rawText.slice(0, 1200),
        createdAt: Date.now(),
      };
      applyJob(job, item.parsed);
      Object.assign(job, item.metadata, { internalJobId: job.id, importNeedsReview: item.missing });
      if (!job.screeningQuestions?.length && job.requiredSkillsDetail?.length) job.screeningQuestions = suggestScreeningQuestions(job);
      if (!job.geo && employer.geo) job.geo = employer.geo;
      db.jobs.push(job);
      jobs.push(job);
    }
    return { jobs, skipped };
  });
}

app.post('/api/jobs/import-file', express.raw({ type: 'application/octet-stream', limit: '3mb' }), async (req, res, next) => {
  try {
    const employerId = resolveActor(req, reqString(req.query, 'employerId', { max: 128 }));
    const filename = decodeURIComponent(reqString(req.headers, 'x-filename', { max: 200 }));
    const sourceSystem = optString(req.query, 'sourceSystem', { max: 40 }) || 'file';
    if (!/^[a-z0-9_-]+$/i.test(sourceSystem)) throw new ValidationError('sourceSystem', 'Choose a valid source');
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ValidationError('file', 'Choose a job feed file');
    const db = await store.read();
    const employer = db.users.find((user) => user.id === employerId && user.role === 'employer');
    if (!employer) throw new ValidationError('employerId', 'Unknown recruiter account');
    assertDemoActor(req, db, employerId);
    let entries;
    try { entries = parseJobImportFile(req.body.toString('utf8'), filename, sourceSystem); }
    catch (error) { throw new ValidationError('file', error.message); }
    if (!entries.length) throw new ValidationError('file', 'No jobs were found in that file');
    const result = await importJobDrafts(employerId, sourceSystem, entries.slice(0, 50));
    res.status(201).json({ ...result, found: entries.length });
  } catch (error) { next(error); }
});

app.post('/api/jobs/import-linkedin', async (req, res, next) => {
  try {
    const employerId = resolveActor(req, reqString(req.body, 'employerId', { max: 128 }));
    const db = await store.read();
    const employer = db.users.find((user) => user.id === employerId && user.role === 'employer');
    if (!employer) throw new ValidationError('employerId', 'Unknown recruiter account');
    assertDemoActor(req, db, employerId);
    let entries;
    try { entries = normalizeLinkedInImports(req.body.jobs); }
    catch (error) { throw new ValidationError('jobs', error.message); }
    const result = await importJobDrafts(employerId, 'linkedin_manual', entries);
    res.status(201).json({ ...result, found: entries.length });
  } catch (error) { next(error); }
});

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
      // Inherit the recruiter's location so distance matching works out of the box.
      if (!created.geo && employer.geo) created.geo = employer.geo;
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
      const updated = applyJob(item, req.body);
      if (updated.sourceSystem) updated.importNeedsReview = importedJobMissing(updated);
      return updated;
    });
    res.json({ job });
  } catch (error) { next(error); }
});

const COVER_DIR = path.join(UPLOADS_ROOT, 'covers');
await fs.promises.mkdir(COVER_DIR, { recursive: true });
const COVER_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Recruiter uploads a cover image for a job card (owner-only). Gradient fallback otherwise.
app.post('/api/jobs/:id/cover', uploadLimiter, express.raw({ type: () => true, limit: '6mb' }), async (req, res, next) => {
  try {
    const ext = COVER_TYPES[req.headers['content-type']];
    if (!ext) { const error = new Error('Cover must be PNG, JPG, or WEBP'); error.status = 415; throw error; }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ValidationError('file', 'Empty upload');
    const db0 = await store.read();
    const job = db0.jobs.find((item) => item.id === req.params.id);
    if (!job) { const error = new Error('Job not found'); error.status = 404; throw error; }
    const session = authSession(req);
    if (session && job.employerId !== session.sub) { const error = new Error('You can only edit your own postings'); error.status = 403; throw error; }
    if (!session && !demoAuth) { const error = new Error('Sign in to continue'); error.status = 401; throw error; }
    assertDemoActor(req, db0, job.employerId);
    const storedName = `${req.params.id}.${ext}`;
    await fs.promises.writeFile(path.join(COVER_DIR, storedName), req.body);
    await mirror(path.join(COVER_DIR, storedName));
    const coverImage = `/api/jobs/${req.params.id}/cover?v=${Date.now()}`;
    await store.transaction((db) => { const j = db.jobs.find((item) => item.id === req.params.id); if (j) { j.coverName = storedName; j.coverImage = coverImage; } });
    res.status(201).json({ coverImage });
  } catch (error) { next(error); }
});

app.get('/api/jobs/:id/cover', async (req, res, next) => {
  try {
    const db = await store.read();
    const job = db.jobs.find((item) => item.id === req.params.id);
    if (!job?.coverName) { const error = new Error('No cover image'); error.status = 404; throw error; }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(COVER_DIR, job.coverName));
  } catch (error) { next(error); }
});

app.post('/api/jobs/parse', async (req, res, next) => {
  try {
    const text = reqString(req.body, 'text', { min: 40, max: 20000 });
    const url = optString(req.body, 'url', { max: 400 });
    res.json(await parseJobText(text, url));
  } catch (error) { next(error); }
});

// Upload a job-description file (PDF / DOCX / TXT) → extract text → parse into a draft.
app.post('/api/jobs/parse-file', uploadLimiter, express.raw({ type: () => true, limit: '10mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ValidationError('file', 'Empty upload');
    const contentType = req.headers['content-type'] || '';
    let text;
    if (contentType.startsWith('text/')) {
      text = req.body.toString('utf8');
    } else {
      const ext = RESUME_TYPES[contentType];
      if (!ext) throw new ValidationError('file', 'Upload a PDF, DOCX, or plain-text job description');
      const tmp = path.join(os.tmpdir(), `jd-${crypto.randomUUID()}.${ext}`);
      await fs.promises.writeFile(tmp, req.body);
      try { text = ext === 'docx' ? await extractDocxText(tmp) : await extractPdfText(tmp); }
      finally { fs.promises.unlink(tmp).catch(() => undefined); }
    }
    if (!text || text.trim().length < 40) throw new ValidationError('file', 'Could not read enough text from that file');
    res.json(await parseJobText(text, undefined));
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
    const pool = matchingPool(db, viewer);
    const candidates = pool.users.filter((user) => user.role === 'candidate');
    // Mutual salary reveal: exact ranges are hidden until both sides matched.
    const matchedJobIds = new Set(pool.matches.filter((match) => match.candidateId === viewer.id).map((match) => match.jobId));
    const matchedCandidateIds = new Set(pool.matches.filter((match) => match.employerId === viewer.id).map((match) => match.candidateId));
    // Incoming super-likes: who signalled strong interest in the viewer already?
    const incomingEmployerLikes = pool.swipes.filter((s) => s.direction === 'like' && s.targetType === 'candidate' && s.targetId === viewer.id);
    const viewerJobIds = new Set(pool.jobs.filter((job) => job.employerId === viewer.id).map((job) => job.id));
    const candidatesWhoSuperLikedMyJobs = new Set(pool.swipes.filter((s) => s.superLike && s.targetType === 'job' && viewerJobIds.has(s.targetId)).map((s) => s.actorId));
    const scoredJobs = pool.jobs.map((job) => {
      const employer = pool.users.find((user) => user.id === job.employerId);
      // Real haversine distance when both sides have coordinates; else demo fallback.
      const realDist = haversineKm(viewer.geo, job.geo);
      const withDistance = { ...job, distanceKm: realDist ?? job.distanceKm ?? demoDistances[job.id] };
      const match = scoreCandidateForJob(viewer, withDistance);
      if (role === 'candidate' && !matchedJobIds.has(job.id)) {
        delete withDistance.salary; delete withDistance.salaryRange;
        withDistance.salaryHidden = true;
      }
      const incomingLike = incomingEmployerLikes.find((swipe) => swipe.actorId === job.employerId && swipe.jobId === job.id);
      // Public recruiter card shown on each role (photo/name/title only — no contact info pre-match).
      const recruiter = employer ? { name: employer.name, title: employer.title, photo: employer.photo, company: employer.company } : undefined;
      return { ...withDistance, companyLogo: employer?.companyLogo, recruiter, match, likedYou: Boolean(incomingLike), superLikedYou: Boolean(incomingLike?.superLike), verified: verifiedUser(employer) };
    });
    // Score candidates against this recruiter's own (first active) job when possible.
    const referenceJob = pool.jobs.find((job) => job.employerId === viewer.id && String(job.status).toLowerCase() === 'active')
      || pool.jobs.find((job) => job.employerId === viewer.id) || pool.jobs[0];
    // Deck candidates: contact details and exact salary stay hidden until a mutual match.
    const jobGeo = referenceJob?.geo || viewer.geo;
    const scoredCandidates = candidates.filter((candidate) => candidate.id !== viewer.id).map(({ email, phone, contactChannels, ...candidate }) => {
      if (candidate.agePrivacy !== 'public' && !candidate.discloseAge) delete candidate.birthdate; // age shown in deck only if public
      const realDist = haversineKm(jobGeo, candidate.geo);
      const withDistance = { ...candidate, distanceKm: realDist ?? candidate.distanceKm ?? demoDistances[candidate.id] };
      const match = scoreCandidateForJob(withDistance, { ...referenceJob, distanceKm: withDistance.distanceKm });
      if (!matchedCandidateIds.has(candidate.id) && withDistance.preferences?.salary) {
        withDistance.preferences = { ...withDistance.preferences, salary: undefined };
        withDistance.salaryHidden = true;
      }
      const unlockedContacts = matchedCandidateIds.has(candidate.id) ? { email, phone, contactChannels } : {};
      return { ...withDistance, ...unlockedContacts, match, superLikedYou: candidatesWhoSuperLikedMyJobs.has(candidate.id), verified: verifiedUser(candidate) };
    });
    // Every recruiter role receives its own correctly scored candidate list.
    // Candidate contact details remain stripped because these objects reuse the
    // same recruiter-safe payload as the discovery deck.
    const roleMatches = role === 'employer' ? pool.jobs
      .filter((job) => job.employerId === viewer.id && String(job.status).toLowerCase() === 'active')
      .map((job) => {
        const likedCandidateIds = new Set(pool.swipes
          .filter((swipe) => swipe.direction === 'like' && swipe.targetType === 'job' && swipe.targetId === job.id)
          .map((swipe) => swipe.actorId));
        const ranked = scoredCandidates.map((candidate) => {
          // Score with the private source profile, but return only the recruiter-safe
          // candidate payload. Salary expectations remain hidden until mutual match.
          const sourceCandidate = candidates.find((person) => person.id === candidate.id) || candidate;
          return {
            ...candidate,
            likedYou: likedCandidateIds.has(candidate.id),
            match: scoreCandidateForJob({ ...sourceCandidate, distanceKm: candidate.distanceKm }, { ...job, distanceKm: candidate.distanceKm }),
          };
        }).sort((a, b) => Number(b.likedYou) - Number(a.likedYou)
          || (job.demoTemplate ? (a.demoOrder || 99) - (b.demoOrder || 99) : 0)
          || (b.match?.score || 0) - (a.match?.score || 0));
        const interested = ranked.filter((candidate) => candidate.likedYou);
        const matchingCandidates = ranked.filter((candidate) => isStrongRoleMatch(candidate.match));
        return {
          job: { ...job, companyLogo: viewer.companyLogo, match: scoreCandidateForJob(viewer, job) },
          candidates: interested,
          matchingCandidates,
          interestedCount: interested.length,
          newCount: interested.slice(0, 4).length,
        };
      }) : [];
    const matches = pool.matches.filter((match) => role === 'candidate' ? match.candidateId === viewer.id : match.employerId === viewer.id).map((match) => {
      const candidateUser = pool.users.find((user) => user.id === match.candidateId);
      const job = pool.jobs.find((item) => item.id === match.jobId);
      const employer = pool.users.find((user) => user.id === match.employerId);
      return {
        ...match,
        // Recruiter-side match rows show a real fit % — score the candidate against
        // the specific job they matched on rather than leaving match undefined (0%).
        candidate: candidateUser && job ? { ...candidateUser, match: scoreCandidateForJob(candidateUser, job) } : candidateUser,
        employer,
        job: job ? { ...job, companyLogo: employer?.companyLogo } : job,
        screeningAnswers: db.swipes.find((swipe) => swipe.actorId === match.candidateId && swipe.targetId === match.jobId && swipe.direction === 'like')?.answers,
      };
    });
    const matchIds = new Set(matches.map((match) => match.id));
    const bookmarkedIds = db.bookmarks.filter((b) => b.userId === viewer.id).map((b) => b.targetId);
    const notes = (db.notes || []).filter((note) => note.userId === viewer.id);
    res.json({ viewer, jobs: scoredJobs, candidates: scoredCandidates, roleMatches, matches, messages: db.messages.filter((message) => matchIds.has(message.matchId)), calls: db.calls.filter((call) => matchIds.has(call.matchId)), notes, bookmarkedIds, likesRemaining: likesRemainingToday(pool.swipes, viewer.id) });
  } catch (error) { next(error); }
});

app.post('/api/swipes', async (req, res, next) => {
  try {
    const actorId = resolveActor(req, reqString(req.body, 'actorId', { max: 128 }));
    const targetId = reqString(req.body, 'targetId', { max: 128 });
    const targetType = oneOf(req.body, 'targetType', ['job', 'candidate']);
    const direction = oneOf(req.body, 'direction', ['like', 'pass']);
    const superLike = req.body.superLike === true; // Tinder-style stronger interest signal
    // Item 11: candidate answers to the job's screening questions ride on the like-swipe.
    const answers = Array.isArray(req.body.answers)
      ? req.body.answers.map((item) => ({ question: String(item?.question || '').slice(0, 300), answer: String(item?.answer || '').slice(0, 600) })).filter((item) => item.question && item.answer).slice(0, 5)
      : undefined;
    const result = await store.transaction((db) => {
      const actor = db.users.find((user) => user.id === actorId);
      if (!actor) throw new ValidationError('actorId', 'Unknown user');
      assertDemoActor(req, db, actorId);
      if (!targetIsInMatchingPool(db, actor, targetType, targetId)) {
        const error = new Error('Demo and live matching are separate'); error.status = 403; throw error;
      }
      if (direction === 'like' && likesRemainingToday(db.swipes, actorId) <= 0) {
        const error = new Error('Daily like limit reached'); error.status = 429; throw error;
      }
      const existing = db.swipes.find((swipe) => swipe.actorId === actorId && swipe.targetType === targetType && swipe.targetId === targetId);
      if (existing) return { swipe: existing, match: null, duplicate: true };
      const swipe = { id: crypto.randomUUID(), actorId, targetId, targetType, direction, createdAt: Date.now(), ...(superLike && direction === 'like' ? { superLike: true } : {}), ...(answers ? { answers } : {}) };
      const mutual = detectMutualMatch(swipe, db);
      db.swipes.push(swipe);
      let match = null;
      if (mutual && !db.matches.some((item) => item.candidateId === mutual.candidateId && item.jobId === mutual.jobId)) {
        match = { id: crypto.randomUUID(), ...mutual, stage: 'Matched', createdAt: Date.now() };
        db.matches.push(match);
        // Expand for the match screen: names, photos, and the mutual salary reveal.
        match = { ...match, candidate: db.users.find((user) => user.id === match.candidateId), employer: db.users.find((user) => user.id === match.employerId), job: db.jobs.find((job) => job.id === match.jobId) };
      }
      return { swipe, match, duplicate: false, likesRemaining: likesRemainingToday(db.swipes, actorId) };
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Rewind/Undo: remove the actor's most recent swipe, and any match it created.
app.post('/api/swipes/undo', async (req, res, next) => {
  try {
    const actorId = resolveActor(req, reqString(req.body, 'actorId', { max: 128 }));
    const result = await store.transaction((db) => {
      assertDemoActor(req, db, actorId);
      const mine = db.swipes.filter((swipe) => swipe.actorId === actorId).sort((a, b) => b.createdAt - a.createdAt);
      const last = mine[0];
      if (!last) return { undone: null };
      db.swipes = db.swipes.filter((swipe) => swipe.id !== last.id);
      // Drop any match this swipe completed (and its messages), so undo is clean.
      const removedMatches = db.matches.filter((m) => (last.targetType === 'job' ? m.candidateId === actorId && m.jobId === last.targetId : m.employerId === actorId && m.candidateId === last.targetId));
      const removedIds = new Set(removedMatches.map((m) => m.id));
      db.matches = db.matches.filter((m) => !removedIds.has(m.id));
      db.messages = db.messages.filter((msg) => !removedIds.has(msg.matchId));
      db.calls = db.calls.filter((c) => !removedIds.has(c.matchId));
      return { undone: { targetId: last.targetId, targetType: last.targetType, direction: last.direction }, likesRemaining: likesRemainingToday(db.swipes, actorId) };
    });
    res.json(result);
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

// Recruiter proposes a specific call time for a match; candidates see it read-only.
app.post('/api/calls', async (req, res, next) => {
  try {
    const matchId = reqString(req.body, 'matchId', { max: 128 });
    const createdBy = resolveActor(req, reqString(req.body, 'createdBy', { max: 128 }));
    const title = reqString(req.body, 'title', { max: 160 });
    const startAt = Number(req.body.startAt);
    if (!Number.isFinite(startAt)) throw new ValidationError('startAt', 'startAt must be a timestamp (ms)');
    const durationMinutes = Number.isFinite(Number(req.body.durationMinutes)) ? Math.min(240, Math.max(15, Number(req.body.durationMinutes))) : 30;
    const notes = typeof req.body.notes === 'string' ? req.body.notes.slice(0, 1000).trim() || undefined : undefined;
    const call = await store.transaction((db) => {
      const match = db.matches.find((item) => item.id === matchId);
      if (!match) { const error = new Error('Match not found'); error.status = 404; throw error; }
      assertDemoActor(req, db, createdBy);
      if (createdBy !== match.employerId) { const error = new Error('Only the recruiter on this match can schedule a call'); error.status = 403; throw error; }
      const item = { id: crypto.randomUUID(), matchId, createdBy, title, startAt, durationMinutes, notes, createdAt: Date.now() };
      db.calls.push(item);
      return item;
    });
    res.status(201).json(call);
  } catch (error) { next(error); }
});

// Save-for-later toggle on a job/candidate card. Idempotent-ish: posting again un-saves it.
app.post('/api/bookmarks/toggle', async (req, res, next) => {
  try {
    const userId = resolveActor(req, reqString(req.body, 'userId', { max: 128 }));
    const targetId = reqString(req.body, 'targetId', { max: 128 });
    const targetType = oneOf(req.body, 'targetType', ['job', 'candidate']);
    const bookmarked = await store.transaction((db) => {
      assertDemoActor(req, db, userId);
      const existing = db.bookmarks.find((b) => b.userId === userId && b.targetId === targetId && b.targetType === targetType);
      if (existing) { db.bookmarks = db.bookmarks.filter((b) => b !== existing); return false; }
      db.bookmarks.push({ id: crypto.randomUUID(), userId, targetId, targetType, createdAt: Date.now() });
      return true;
    });
    res.json({ bookmarked });
  } catch (error) { next(error); }
});

// Private notes: a viewer's own scratchpad on a specific job or candidate —
// before/after a conversation or interview. Visible only to their author.
app.post('/api/notes', async (req, res, next) => {
  try {
    const userId = resolveActor(req, reqString(req.body, 'userId', { max: 128 }));
    const targetId = reqString(req.body, 'targetId', { max: 128 });
    const targetType = oneOf(req.body, 'targetType', ['job', 'candidate']);
    const text = optString(req.body, 'text', { max: 4000 }) || '';
    const note = await store.transaction((db) => {
      assertDemoActor(req, db, userId);
      if (!Array.isArray(db.notes)) db.notes = [];
      const existing = db.notes.find((n) => n.userId === userId && n.targetId === targetId && n.targetType === targetType);
      if (existing) { existing.text = text; existing.updatedAt = Date.now(); return existing; }
      const item = { id: crypto.randomUUID(), userId, targetId, targetType, text, updatedAt: Date.now() };
      db.notes.push(item);
      return item;
    });
    res.json(note);
  } catch (error) { next(error); }
});

// Named profile-variant presets: a candidate can snapshot their current
// title/skills/desired-roles as a named preset (e.g. "Frontend Engineer"
// vs "Product Manager") and switch which one is live later, instead of
// hand-editing the same fields back and forth for every application type.
app.post('/api/profile-variants', async (req, res, next) => {
  try {
    const userId = resolveActor(req, reqString(req.body, 'userId', { max: 128 }));
    const name = reqString(req.body, 'name', { max: 80 });
    // Title/skills default to the live profile, but the candidate can set a
    // different persona right here instead of round-tripping through the
    // full edit wizard first — otherwise every variant looks identical.
    const title = optString(req.body, 'title', { max: 120 });
    const skills = optStringArray(req.body, 'skills', { maxItems: 20, maxLen: 60 });
    const variant = await store.transaction((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) { const error = new Error('User not found'); error.status = 404; throw error; }
      assertDemoActor(req, db, userId);
      if (!Array.isArray(user.profileVariants)) user.profileVariants = [];
      const item = {
        id: crypto.randomUUID(), name,
        title: title || user.title || '', skills: skills || [...(user.skills || [])],
        desiredRoles: [...(user.preferences?.desiredRoles || [])],
        updatedAt: Date.now(),
      };
      user.profileVariants.push(item);
      user.activeVariantId = item.id;
      return item;
    });
    res.json(variant);
  } catch (error) { next(error); }
});

app.post('/api/profile-variants/:id/activate', async (req, res, next) => {
  try {
    const userId = resolveActor(req, reqString(req.body, 'userId', { max: 128 }));
    const user = await store.transaction((db) => {
      const item = db.users.find((entry) => entry.id === userId);
      if (!item) { const error = new Error('User not found'); error.status = 404; throw error; }
      assertDemoActor(req, db, userId);
      const variant = (item.profileVariants || []).find((v) => v.id === req.params.id);
      if (!variant) { const error = new Error('Profile variant not found'); error.status = 404; throw error; }
      item.title = variant.title;
      item.skills = [...variant.skills];
      item.preferences = { ...(item.preferences || {}), desiredRoles: [...(variant.desiredRoles || [])] };
      item.activeVariantId = variant.id;
      if (item.role === 'candidate') item.completeness = candidateCompleteness(item);
      return item;
    });
    res.json({ user });
  } catch (error) { next(error); }
});

app.delete('/api/profile-variants/:id', async (req, res, next) => {
  try {
    const userId = resolveActor(req, reqString(req.query, 'userId', { max: 128 }));
    await store.transaction((db) => {
      const item = db.users.find((entry) => entry.id === userId);
      if (!item) { const error = new Error('User not found'); error.status = 404; throw error; }
      assertDemoActor(req, db, userId);
      item.profileVariants = (item.profileVariants || []).filter((v) => v.id !== req.params.id);
      if (item.activeVariantId === req.params.id) item.activeVariantId = undefined;
    });
    res.json({ ok: true });
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
