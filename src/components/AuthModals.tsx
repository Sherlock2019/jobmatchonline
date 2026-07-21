import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BriefcaseBusiness, Linkedin, Loader2, Mail, User, X } from 'lucide-react';
import { api } from '../api';
import { authProviders } from '../lib/auth';
import type { Role, SessionUser } from '../types';

function GoogleMark() {
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.5z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.4 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2L1.2 17C3.1 21.1 7.2 24 12 24z"/><path fill="#FBBC05" d="M4.9 14.3c-.3-.8-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.2 6.9C.4 8.5 0 10.2 0 12s.4 3.5 1.2 5.1l3.7-2.8z"/><path fill="#EA4335" d="M12 4.6c2.3 0 3.9 1 4.8 1.9l3.2-3.2C18 1.3 15.2 0 12 0 7.2 0 3.1 2.9 1.2 6.9l3.7 2.8c1-3 3.8-5.1 7.1-5.1z"/></svg>;
}

type SsoBusy = 'linkedin' | 'google' | null;

function SsoButtons({ busy, onSso }: { busy: SsoBusy; onSso: (provider: 'linkedin' | 'google') => void }) {
  return <div className="sso-stack">
    <button type="button" className="sso-button sso-linkedin" disabled={busy !== null} onClick={() => onSso('linkedin')}>
      {busy === 'linkedin' ? <Loader2 size={16} className="spin" /> : <Linkedin size={16} fill="currentColor" />}
      {busy === 'linkedin' ? 'Connecting to LinkedIn…' : 'Continue with LinkedIn'}
    </button>
    <button type="button" className="sso-button sso-google" disabled={busy !== null} onClick={() => onSso('google')}>
      {busy === 'google' ? <Loader2 size={16} className="spin" /> : <GoogleMark />}
      {busy === 'google' ? 'Connecting to Google…' : 'Continue with Google'}
    </button>
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
  const [profiles, setProfiles] = useState<SessionUser[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState<SsoBusy>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.authProfiles().then(({ profiles: list }) => { setProfiles(list); if (list[0]) setSelected(list[0].id); }).catch((e) => setError(e.message)); }, []);

  const run = async (action: () => Promise<SessionUser>) => {
    setError('');
    try { onComplete(await action()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed'); }
    finally { setBusy(null); setSubmitting(false); }
  };

  return <ModalShell title="Welcome back" subtitle="Pick a demo profile, or continue with a provider." onClose={onClose}>
    <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (!selected) return; setSubmitting(true); run(() => authProviders.demo.signIn({ userId: selected })); }}>
      <label className="auth-label" htmlFor="demo-profile">Demo profile</label>
      <select id="demo-profile" className="auth-select" value={selected} onChange={(event) => setSelected(event.target.value)}>
        {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} — {profile.role === 'candidate' ? 'Candidate' : 'Recruiter'}</option>)}
      </select>
      <button type="submit" className="primary-button auth-submit" disabled={submitting || !selected}>{submitting ? <Loader2 size={16} className="spin" /> : <>Continue <ArrowRight size={16} /></>}</button>
    </form>
    <div className="auth-divider"><span>or</span></div>
    <SsoButtons busy={busy} onSso={(provider) => { setBusy(provider); run(() => authProviders[provider].signIn()); }} />
    {error && <p className="auth-error">{error}</p>}
  </ModalShell>;
}

export function RegisterModal({ onClose, onComplete }: { onClose: () => void; onComplete: (user: SessionUser) => void }) {
  const [role, setRole] = useState<Role>('candidate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<SsoBusy>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<SessionUser>) => {
    setError('');
    try { onComplete(await action()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Registration failed'); }
    finally { setBusy(null); setSubmitting(false); }
  };

  return <ModalShell title="Join JobsMatchNow" subtitle="One click and you're in. No forms, no waiting." onClose={onClose}>
    <div className="role-choice" role="radiogroup" aria-label="I am a">
      <button type="button" className={role === 'candidate' ? 'role-option active' : 'role-option'} onClick={() => setRole('candidate')} aria-pressed={role === 'candidate'}><User size={17} /><strong>Candidate</strong><small>Find your next role</small></button>
      <button type="button" className={role === 'employer' ? 'role-option active' : 'role-option'} onClick={() => setRole('employer')} aria-pressed={role === 'employer'}><BriefcaseBusiness size={17} /><strong>Company / Headhunter</strong><small>Find great people</small></button>
    </div>
    <SsoButtons busy={busy} onSso={(provider) => { setBusy(provider); run(() => authProviders[provider].signIn({ registerRole: role })); }} />
    <div className="auth-divider"><span>or continue with email</span></div>
    <form className="auth-form" onSubmit={(event) => { event.preventDefault(); if (!name.trim() || !email.trim()) return; setSubmitting(true); run(() => authProviders.email.signIn({ register: { role, name: name.trim(), email: email.trim() } })); }}>
      <input className="auth-input" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} required aria-label="Full name" />
      <input className="auth-input" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required aria-label="Email address" />
      <button type="submit" className="primary-button auth-submit" disabled={submitting || !name.trim() || !email.trim()}>{submitting ? <Loader2 size={16} className="spin" /> : <><Mail size={16} /> Create my account</>}</button>
    </form>
    {error && <p className="auth-error">{error}</p>}
  </ModalShell>;
}
