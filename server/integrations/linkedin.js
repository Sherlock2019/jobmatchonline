import crypto from 'node:crypto';

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

function base64url(value) { return Buffer.from(value).toString('base64url'); }
function signature(value, secret) { return crypto.createHmac('sha256', secret).update(value).digest('base64url'); }

export function signedValue(payload, secret) {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secret)}`;
}

export function readSignedValue(value, secret) {
  if (!value) return null;
  const [encoded, provided] = value.split('.');
  if (!encoded || !provided) return null;
  const expected = signature(encoded, secret);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { return null; }
}

export function linkedinAuthorizationUrl({ clientId, redirectUri, state, native = false }) {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state, scope: 'openid profile email', ...(native ? { enable_extended_login: 'true' } : {}) }).toString();
  return url.toString();
}

export async function exchangeLinkedinCode({ code, clientId, clientSecret, redirectUri }) {
  const tokenResponse = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }) });
  if (!tokenResponse.ok) throw new Error('LinkedIn token exchange failed');
  const token = await tokenResponse.json();
  const profileResponse = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!profileResponse.ok) throw new Error('LinkedIn profile request failed');
  return { profile: await profileResponse.json(), expiresIn: token.expires_in };
}

export function toLinkedinJobPayload(job, integrationContext) {
  return {
    elements: [{
      integrationContext,
      companyApplyUrl: `https://jobmatch.example/jobs/${job.id}`,
      externalJobPostingId: job.id,
      title: job.title,
      description: job.description,
      listedAt: Date.now(),
      location: job.location,
      workplaceTypes: [job.workMode.toUpperCase()],
      jobPostingOperationType: 'CREATE',
    }],
  };
}
