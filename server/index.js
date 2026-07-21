import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './store.js';
import { PgStore } from './store-pg.js';
import { createSeed } from './seed.js';
import { detectMutualMatch, likesRemainingToday, scoreCandidateForJob, ValidationError, reqString, optString, oneOf } from './matching.js';
import { applyCandidateProfile, applyRecruiterProfile, candidateCompleteness, recruiterCompleteness } from './profile.js';
import fs from 'node:fs';
import { exchangeLinkedinCode, linkedinAuthorizationUrl, readSignedValue, signedValue, toLinkedinJobPayload } from './integrations/linkedin.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
// DATABASE_URL (RDS PostgreSQL) selects the durable production store; the JSON file remains the zero-dependency dev default.
const store = process.env.DATABASE_URL
  ? new PgStore(process.env.DATABASE_URL, createSeed)
  : new JsonStore(process.env.DB_PATH || path.join(root, 'data', 'db.json'), createSeed);
await store.init();
// Merge any seed entities added since the database was first created (idempotent by id).
await store.transaction((db) => {
  const seed = createSeed();
  for (const collection of ['users', 'jobs']) {
    const known = new Set(db[collection].map((item) => item.id));
    for (const item of seed[collection]) if (!known.has(item.id)) db[collection].push(item);
  }
});
console.log(`JobMatch store: ${process.env.DATABASE_URL ? 'postgresql (RDS)' : 'json file'}`);
const demoDistances = { 'j-1': 7, 'j-2': 18, 'j-3': 42, 'j-4': 75, 'c-1': 5, 'c-2': 26, 'c-3': 12, 'c-4': 65 };
const sessionSecret = process.env.SESSION_SECRET || 'jobmatch-local-development-only-secret';
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production');

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((part) => { const index = part.indexOf('='); return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))]; }));
}

function setCookie(res, name, value, { maxAge = 600, httpOnly = true } = {}) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${secure}`);
}

export const app = express();
app.disable('x-powered-by');
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
  return { id: user.id, role: user.role, kind: user.kind, name: user.name, email: user.email, title: user.title, company: user.company, photo: user.photo, provider: user.provider, completeness: user.completeness };
}

app.get('/api/auth/profiles', async (_req, res, next) => {
  try {
    const db = await store.read();
    // SSO demo accounts stay out of the dropdown: they are reached via the provider buttons.
    res.json({ profiles: db.users.filter((user) => !String(user.id).startsWith('sso-')).map(publicProfile) });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const userId = reqString(req.body, 'userId', { max: 128 });
    const db = await store.read();
    const user = db.users.find((item) => item.id === userId);
    if (!user) { const error = new Error('Unknown profile'); error.status = 404; throw error; }
    res.json({ user: publicProfile(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/sso', async (req, res, next) => {
  try {
    const provider = oneOf(req.body, 'provider', ['linkedin', 'google']);
    const db = await store.read();
    const user = db.users.find((item) => item.id === `sso-${provider}-demo`);
    if (!user) { const error = new Error('SSO demo profile missing'); error.status = 500; throw error; }
    res.json({ user: publicProfile(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const role = oneOf(req.body, 'role', ['candidate', 'employer']);
    const kind = oneOf(req.body, 'kind', ['company', 'headhunter'], { optional: true });
    const provider = oneOf(req.body, 'provider', ['linkedin', 'google', 'email'], { optional: true });
    const name = reqString(req.body, 'name', { max: 120 });
    const email = reqString(req.body, 'email', { max: 200 });
    const photo = optString(req.body, 'photo', { max: 500 });
    const user = await store.transaction((db) => {
      const existing = db.users.find((item) => item.email && item.email.toLowerCase() === email.toLowerCase());
      if (existing) return existing;
      const created = {
        id: `u-${crypto.randomUUID().slice(0, 8)}`, role, name, email,
        ...(role === 'employer' ? { kind: kind || 'company' } : {}),
        provider: provider || 'email',
        title: role === 'candidate' ? 'New member' : 'Recruiter',
        photo: photo || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
        skills: [], languages: [], experienceLevel: 'mid', completeness: 15, onboarding: true, createdAt: Date.now(),
      };
      db.users.push(created);
      return created;
    });
    res.status(201).json({ user: publicProfile(user) });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Profile: wizard saves + resume upload
// ---------------------------------------------------------------------------

app.patch('/api/users/:id', async (req, res, next) => {
  try {
    const user = await store.transaction((db) => {
      const item = db.users.find((entry) => entry.id === req.params.id);
      if (!item) { const error = new Error('User not found'); error.status = 404; throw error; }
      if (item.role === 'candidate') { applyCandidateProfile(item, req.body); item.completeness = candidateCompleteness(item); }
      else { applyRecruiterProfile(item, req.body); item.completeness = recruiterCompleteness(item); }
      return item;
    });
    res.json({ user });
  } catch (error) { next(error); }
});

const RESUME_DIR = path.join(dirname, 'uploads', 'resumes');
await fs.promises.mkdir(RESUME_DIR, { recursive: true });
const RESUME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

app.post('/api/users/:id/resume', express.raw({ type: () => true, limit: '10mb' }), async (req, res, next) => {
  try {
    const ext = RESUME_TYPES[req.headers['content-type']];
    if (!ext) { const error = new Error('Only PDF or DOCX resumes are accepted'); error.status = 415; throw error; }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ValidationError('file', 'Empty upload');
    const originalName = decodeURIComponent(String(req.headers['x-filename'] || `resume.${ext}`)).replace(/[/\\]/g, '_').slice(0, 200);
    const id = crypto.randomUUID();
    const storedName = `${req.params.id}-${id}.${ext}`;
    await fs.promises.writeFile(path.join(RESUME_DIR, storedName), req.body);
    const meta = { id, originalName, storedName, ext, size: req.body.length, mime: req.headers['content-type'], uploadedAt: Date.now(), url: `/api/users/${req.params.id}/resume/original` };
    const user = await store.transaction((db) => {
      const item = db.users.find((entry) => entry.id === req.params.id);
      if (!item) { const error = new Error('User not found'); error.status = 404; throw error; }
      item.documents = { ...(item.documents || {}), resume: meta };
      if (item.role === 'candidate') item.completeness = candidateCompleteness(item);
      return item;
    });
    res.status(201).json({ resume: meta, completeness: user.completeness });
  } catch (error) { next(error); }
});

app.get('/api/users/:id/resume/original', async (req, res, next) => {
  try {
    const db = await store.read();
    const user = db.users.find((entry) => entry.id === req.params.id);
    const resume = user?.documents?.resume;
    if (!resume) { const error = new Error('No resume on file'); error.status = 404; throw error; }
    res.setHeader('Content-Type', resume.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resume.originalName)}"`);
    res.sendFile(path.join(RESUME_DIR, resume.storedName));
  } catch (error) { next(error); }
});

app.get('/api/bootstrap', async (req, res, next) => {
  try {
    const db = await store.read();
    const requestedId = typeof req.query.userId === 'string' ? req.query.userId : '';
    const fallbackRole = req.query.role === 'employer' ? 'employer' : 'candidate';
    const viewer = db.users.find((user) => user.id === requestedId) || db.users.find((user) => user.id === `${fallbackRole}-demo`);
    const role = viewer.role === 'employer' ? 'employer' : 'candidate';
    const candidates = db.users.filter((user) => user.role === 'candidate');
    const scoredJobs = db.jobs.map((job) => ({ ...job, distanceKm: job.distanceKm ?? demoDistances[job.id], match: scoreCandidateForJob(viewer, job) }));
    const scoredCandidates = candidates.filter((candidate) => candidate.id !== viewer.id).map((candidate) => ({ ...candidate, distanceKm: candidate.distanceKm ?? demoDistances[candidate.id], match: scoreCandidateForJob(candidate, db.jobs[0]) }));
    const matches = db.matches.filter((match) => role === 'candidate' ? match.candidateId === viewer.id : match.employerId === viewer.id).map((match) => ({ ...match, candidate: db.users.find((user) => user.id === match.candidateId), job: db.jobs.find((job) => job.id === match.jobId) }));
    const matchIds = new Set(matches.map((match) => match.id));
    res.json({ viewer, jobs: scoredJobs, candidates: scoredCandidates, matches, messages: db.messages.filter((message) => matchIds.has(message.matchId)), likesRemaining: likesRemainingToday(db.swipes, viewer.id) });
  } catch (error) { next(error); }
});

app.post('/api/swipes', async (req, res, next) => {
  try {
    const actorId = reqString(req.body, 'actorId', { max: 128 });
    const targetId = reqString(req.body, 'targetId', { max: 128 });
    const targetType = oneOf(req.body, 'targetType', ['job', 'candidate']);
    const direction = oneOf(req.body, 'direction', ['like', 'pass']);
    const result = await store.transaction((db) => {
      const actor = db.users.find((user) => user.id === actorId);
      if (!actor) throw new ValidationError('actorId', 'Unknown demo user');
      if (direction === 'like' && likesRemainingToday(db.swipes, actorId) <= 0) {
        const error = new Error('Daily like limit reached'); error.status = 429; throw error;
      }
      const existing = db.swipes.find((swipe) => swipe.actorId === actorId && swipe.targetType === targetType && swipe.targetId === targetId);
      if (existing) return { swipe: existing, match: null, duplicate: true };
      const swipe = { id: crypto.randomUUID(), actorId, targetId, targetType, direction, createdAt: Date.now() };
      const mutual = detectMutualMatch(swipe, db);
      db.swipes.push(swipe);
      let match = null;
      if (mutual && !db.matches.some((item) => item.candidateId === mutual.candidateId && item.jobId === mutual.jobId)) {
        match = { id: crypto.randomUUID(), ...mutual, stage: 'Matched', createdAt: Date.now() };
        db.matches.push(match);
      }
      return { swipe, match, duplicate: false, likesRemaining: likesRemainingToday(db.swipes, actorId) };
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

app.patch('/api/matches/:id', async (req, res, next) => {
  try {
    const stage = oneOf(req.body, 'stage', ['Matched', 'Screen', 'Interview', 'Offer', 'Hired', 'Archived']);
    const match = await store.transaction((db) => {
      const item = db.matches.find((entry) => entry.id === req.params.id);
      if (!item) { const error = new Error('Match not found'); error.status = 404; throw error; }
      item.stage = stage;
      return item;
    });
    res.json(match);
  } catch (error) { next(error); }
});

app.post('/api/messages', async (req, res, next) => {
  try {
    const matchId = reqString(req.body, 'matchId', { max: 128 });
    const senderId = reqString(req.body, 'senderId', { max: 128 });
    const text = reqString(req.body, 'text', { max: 2000 });
    const message = await store.transaction((db) => {
      if (!db.matches.some((match) => match.id === matchId)) { const error = new Error('Match not found'); error.status = 404; throw error; }
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
