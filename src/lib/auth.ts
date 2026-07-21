import { api } from '../api';
import type { EmployerKind, Role, SessionUser } from '../types';

/**
 * Pluggable auth. Every way of signing in — demo profile pick, mock SSO,
 * email registration — implements AuthProvider, so a real OAuth flow can be
 * swapped in later by replacing `signIn` without touching the UI.
 */
export interface AuthProvider {
  id: 'demo' | 'linkedin' | 'google' | 'email';
  label: string;
  /** Resolves with the signed-in user. May take time (real or simulated OAuth). */
  signIn(options?: SignInOptions): Promise<SessionUser>;
}

export interface SignInOptions {
  userId?: string; // demo provider: which profile to log in as
  register?: { role: Role; kind?: EmployerKind; name: string; email: string }; // email provider
  registerRole?: Role; // SSO during registration: create/refresh account with this role
  registerKind?: EmployerKind;
}

const SESSION_KEY = 'jm-session-user';

export function loadSession(): SessionUser | null {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function saveSession(user: SessionUser | null) {
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(SESSION_KEY);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Instant login as an existing demo profile. */
export const demoProvider: AuthProvider = {
  id: 'demo',
  label: 'Demo profile',
  async signIn(options) {
    if (!options?.userId) throw new Error('Pick a profile to continue');
    const { user } = await api.login(options.userId);
    return user;
  },
};

/** Simulated OAuth: short fake redirect delay, then the pre-made provider account. */
function mockSso(id: 'linkedin' | 'google', label: string): AuthProvider {
  return {
    id,
    label,
    async signIn(options) {
      await wait(900); // simulate the provider round-trip
      const { user } = await api.ssoLogin(id);
      if (options?.registerRole) {
        // Registering via SSO: keep the provider identity but ensure the chosen role.
        const { user: registered } = await api.register({ role: options.registerRole, kind: options.registerKind, provider: id, name: user.name, email: user.email || `${id}@demo.jobsmatchnow.app`, photo: user.photo });
        return { ...registered, isNew: true };
      }
      return user;
    },
  };
}

export const linkedinProvider = mockSso('linkedin', 'Continue with LinkedIn');
export const googleProvider = mockSso('google', 'Continue with Google');

/** Near-instant email registration: name + email only. */
export const emailProvider: AuthProvider = {
  id: 'email',
  label: 'Continue with email',
  async signIn(options) {
    if (!options?.register) throw new Error('Name and email are required');
    const { user } = await api.register({ ...options.register, provider: 'email' });
    return { ...user, isNew: true };
  },
};

export const authProviders = { demo: demoProvider, linkedin: linkedinProvider, google: googleProvider, email: emailProvider };
