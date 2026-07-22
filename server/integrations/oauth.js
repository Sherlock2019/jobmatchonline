/**
 * Real SSO via OAuth 2.0 / OpenID Connect for Google and LinkedIn.
 *
 * Both providers follow the same authorization-code flow:
 *   1. redirect the user to the provider's authorize URL (signed state cookie)
 *   2. callback: exchange the code for tokens
 *   3. fetch the OIDC userinfo → { sub, name, email, picture }
 * The app then finds-or-creates the account and issues its own session cookie.
 *
 * A provider is active as soon as its env vars exist — no code changes:
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
 *   LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_REDIRECT_URI
 * (Google credentials: console.cloud.google.com → OAuth consent + Web client.
 *  LinkedIn: developer app with the "Sign In with LinkedIn via OpenID Connect"
 *  product. Redirect URI: https://<host>/api/auth/oauth/<provider>/callback)
 */

const PROVIDERS = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    envPrefix: 'GOOGLE',
    extraAuthParams: { access_type: 'online', prompt: 'select_account' },
  },
  linkedin: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userinfoUrl: 'https://api.linkedin.com/v2/userinfo',
    envPrefix: 'LINKEDIN',
    extraAuthParams: {},
  },
};

export function oauthConfig(provider) {
  const spec = PROVIDERS[provider];
  if (!spec) return { configured: false };
  const clientId = process.env[`${spec.envPrefix}_CLIENT_ID`];
  const clientSecret = process.env[`${spec.envPrefix}_CLIENT_SECRET`];
  const redirectUri = process.env[`${spec.envPrefix}_REDIRECT_URI`];
  return { configured: Boolean(clientId && clientSecret && redirectUri), clientId, clientSecret, redirectUri, spec };
}

export function oauthProviders() {
  return Object.fromEntries(Object.keys(PROVIDERS).map((provider) => [provider, oauthConfig(provider).configured]));
}

export function oauthAuthorizationUrl(provider, state) {
  const { configured, clientId, redirectUri, spec } = oauthConfig(provider);
  if (!configured) throw new Error(`${provider} SSO is not configured`);
  const url = new URL(spec.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
    scope: 'openid profile email', state, ...spec.extraAuthParams,
  }).toString();
  return url.toString();
}

/** Exchange the callback code for the user's OIDC identity. */
export async function oauthExchangeCode(provider, code) {
  const { configured, clientId, clientSecret, redirectUri, spec } = oauthConfig(provider);
  if (!configured) throw new Error(`${provider} SSO is not configured`);
  const tokenResponse = await fetch(spec.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
  });
  if (!tokenResponse.ok) throw new Error(`${provider} token exchange failed`);
  const token = await tokenResponse.json();
  const profileResponse = await fetch(spec.userinfoUrl, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!profileResponse.ok) throw new Error(`${provider} userinfo request failed`);
  const profile = await profileResponse.json();
  return { sub: String(profile.sub), name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' '), email: profile.email ? String(profile.email).toLowerCase() : undefined, picture: profile.picture };
}
