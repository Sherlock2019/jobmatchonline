import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BriefcaseBusiness, Linkedin, Loader2, LogIn, Mail, User, X } from 'lucide-react';
import { api, apiBase } from '../api';
import { authProviders } from '../lib/auth';
import type { AuthConfig, Role, SessionUser } from '../types';

function GoogleMark() {
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.5z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.4 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2L1.2 17C3.1 21.1 7.2 24 12 24z"/><path fill="#FBBC05" d="M4.9 14.3c-.3-.8-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.2 6.9C.4 8.5 0 10.2 0 12s.4 3.5 1.2 5.1l3.7-2.8z"/><path fill="#EA4335" d="M12 4.6c2.3 0 3.9 1 4.8 1.9l3.2-3.2C18 1.3 15.2 0 12 0 7.2 0 3.1 2.9 1.2 6.9l3.7 2.8c1-3 3.8-5.1 7.1-5.1z"/></svg>;
}

type SsoBusy = 'linkedin' | 'google' | null;

const defaultConfig: AuthConfig = { demoAuth: true, passwordMinLength: 8, sso: { google: false, linkedin: false } };

function useAuthConfig() {
  const [config, setConfig] = useState<AuthConfig>(defaultConfig);
  useEffect(() => { api.authConfig().then(setConfig).catch(() => undefined); }, []);
  return config;
}

/**
 * SSO buttons: when a provider has real OAuth credentials configured, the
 * button starts the real OpenID Connect redirect flow; otherwise it falls back
 * to mock SSO (demo mode only).
 */
function SsoButtons({ config, role, busy, onMockSso }: { config: AuthConfig; role?: Role; busy: SsoBusy; onMockSso: (provider: 'linkedin' | 'google') => void }) {
  const start = (provider: 'linkedin' | 'google') => {
    if (config.sso[provider]) { window.location.href = `${apiBase}/api/auth/oauth/${provider}${role ? `?role=${role}` : ''}`; return; }
    onMockSso(provider);
  };
  const visible = (provider: 'linkedin' | 'google') => config.sso[provider] || config.demoAuth;
  if (!visible('linkedin') && !visible('google')) return null;
  return <div className="sso-stack">
    {visible('linkedin') && <button type="button" className="sso-button sso-linkedin" disabled={busy !== null} onClick={() => start('linkedin')}>
      {busy === 'linkedin' ? <Loader2 size={16} className="spin" /> : <Linkedin size={16} fill="currentColor" />}
      {busy === 'linkedin' ? 'Connecting to LinkedIn…' : `Continue with LinkedIn${config.sso.linkedin ? '' : ' (demo)'}`}
    </button>}
    {visible('google') && <button type="button" className="sso-button sso-google" disabled={busy !== null} onClick={() => start('google')}>
      {busy === 'google' ? <Loader2 size={16} className="spin" /> : <GoogleMark />}
      {busy === 'google' ? 'Connecting to Google…' : `Continue with Google${config.sso.google ? '' : ' (demo)'}`}
    </button>}
  </div>;
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="auth-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <span className="brand-heart-mark auth-mark" aria-hidden="true" />
      <h2>{title}</h2>
      <p className="auth-subtitle">{subtitle}</p>
      {children}
    </motion.div>
  </motion.div>;
}

export function LoginModal({ onClose, onComplete }: { onClose: () => void; onComplete: (user: SessionUser) => void }) {
  const config = useAuthConfig();
  const [profiles, setProfiles] = useState<SessionUser[]>([]);
  const [selected, setSelected] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<SsoBusy>(null);
  const [submitting, setSubmitting] = useState<'demo' | 'password' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!config.demoAuth) return;
    api.authProfiles().then(({ profiles: list }) => { setProfiles(list); if (list[0]) setSelected(list[0].id); }).catch(() => undefined);
  }, [config.demoAuth]);

  const run = async (action: () => Promise<SessionUser>) => {
    setError('');
    try { onComplete(await action()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed'); }
    finally { setBusy(null); setSubmitting(null); }
  };

  return <ModalShell title="Welcome back" subtitle={config.demoAuth ? 'Sign in with your account, or explore with a demo profile.' : 'Sign in with your email and password.'} onClose={onClose}>
    <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (!email.trim() || !password) return; setSubmitting('password'); run(async () => (await api.loginPassword(email.trim(), password)).user); }}>
      <input className="auth-input" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" aria-label="Email address" />
      <input className="auth-input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" aria-label="Password" />
      <button type="submit" className="primary-button auth-submit" disabled={submitting !== null || !email.trim() || !password}>{submitting === 'password' ? <Loader2 size={16} className="spin" /> : <><LogIn size={16} /> Log in</>}</button>
    </form>
    <div className="auth-divider"><span>or</span></div>
    <SsoButtons config={config} busy={busy} onMockSso={(provider) => { setBusy(provider); run(() => authProviders[provider].signIn()); }} />
    {config.demoAuth && profiles.length > 0 && <>
      <div className="auth-divider"><span>demo profiles</span></div>
      <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (!selected) return; setSubmitting('demo'); run(() => authProviders.demo.signIn({ userId: selected })); }}>
        <select className="auth-select" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Demo profile">
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} — {profile.role === 'candidate' ? 'Candidate' : 'Recruiter'} (demo)</option>)}
        </select>
        <button type="submit" className="secondary-button auth-submit" disabled={submitting !== null || !selected}>{submitting === 'demo' ? <Loader2 size={16} className="spin" /> : <>Continue as demo <ArrowRight size={16} /></>}</button>
      </form>
    </>}
    {error && <p className="auth-error">{error}</p>}
  </ModalShell>;
}

export function RegisterModal({ onClose, onComplete }: { onClose: () => void; onComplete: (user: SessionUser) => void }) {
  const config = useAuthConfig();
  const [role, setRole] = useState<Role>('candidate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<SsoBusy>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const needsPassword = !config.demoAuth;
  const passwordOk = !needsPassword || password.length >= config.passwordMinLength;

  const run = async (action: () => Promise<SessionUser>) => {
    setError('');
    try { onComplete(await action()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Registration failed'); }
    finally { setBusy(null); setSubmitting(false); }
  };

  return <ModalShell title="Join JobsMatchNow" subtitle={needsPassword ? 'Create your account in under a minute.' : "One click and you're in. No forms, no waiting."} onClose={onClose}>
    <div className="role-choice" role="radiogroup" aria-label="I am a">
      <button type="button" className={role === 'candidate' ? 'role-option active' : 'role-option'} onClick={() => setRole('candidate')} aria-pressed={role === 'candidate'}><User size={17} /><strong>Candidate</strong><small>Find your next role</small></button>
      <button type="button" className={role === 'employer' ? 'role-option active' : 'role-option'} onClick={() => setRole('employer')} aria-pressed={role === 'employer'}><BriefcaseBusiness size={17} /><strong>Company / Headhunter</strong><small>Find great people</small></button>
    </div>
    <SsoButtons config={config} role={role} busy={busy} onMockSso={(provider) => { setBusy(provider); run(() => authProviders[provider].signIn({ registerRole: role })); }} />
    <div className="auth-divider"><span>or continue with email</span></div>
    <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (!name.trim() || !email.trim() || !passwordOk) return; setSubmitting(true); run(() => authProviders.email.signIn({ register: { role, name: name.trim(), email: email.trim(), password: password || undefined } })); }}>
      <input className="auth-input" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} required aria-label="Full name" autoComplete="name" />
      <input className="auth-input" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required aria-label="Email address" autoComplete="email" />
      {needsPassword && <input className="auth-input" type="password" placeholder={`Password (min ${config.passwordMinLength} characters)`} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={config.passwordMinLength} aria-label="Password" autoComplete="new-password" />}
      <button type="submit" className="primary-button auth-submit" disabled={submitting || !name.trim() || !email.trim() || !passwordOk}>{submitting ? <Loader2 size={16} className="spin" /> : <><Mail size={16} /> Create my account</>}</button>
    </form>
    {error && <p className="auth-error">{error}</p>}
  </ModalShell>;
}
