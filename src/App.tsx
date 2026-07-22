import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { PhoneMockup } from './components/PhoneMockup';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { Activity, ArrowRight, BadgeCheck, BarChart3, Bell, BriefcaseBusiness, Check, ChevronDown, CircleHelp, Clock3, Command, Compass, FileText, Filter, Heart, Inbox, Layers3, Linkedin, Loader2, Lock, LogOut, MapPin, Menu, MessageCircle, MoreHorizontal, RotateCcw, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Star, Target, Users, X, Zap } from 'lucide-react';
import { api } from './api';
import { apiBase } from './api';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as NativeApp } from '@capacitor/app';
import { LoginModal, RegisterModal, ResetPasswordModal, SettingsModal } from './components/AuthModals';
import { MobileLanding } from './components/MobileLanding';
import { FeedbackSection, JourneyPipeline, LatestShowcase } from './components/LandingSections';
import { CandidateWizard } from './components/profile/CandidateWizard';
import { CandidateProfilePage } from './components/profile/CandidateProfilePage';
import { RecruiterWizard } from './components/profile/RecruiterWizard';
import { RecruiterProfilePage } from './components/profile/RecruiterProfilePage';
// Lazy-loaded: pulls in pdf.js only when a resume is actually opened.
const ResumeViewerModal = lazy(() => import('./components/ResumeViewerModal').then((m) => ({ default: m.ResumeViewerModal })));
import { JobEditor } from './components/jobs/JobEditor';
import { GapCoach, JobDetailModal, MatchDetailModal, ScreeningModal } from './components/coach/CoachModals';
import type { ScreeningAnswer } from './types';
import { comparisonRows } from './content/landingContent';
import { appleColor, appleGradient } from './lib/colors';
import { loadSession, saveSession } from './lib/auth';
import type { Bootstrap, Job, JobMatch, Message, Person, Role, SessionUser, View } from './types';

const candidateNav: { view: View; label: string; icon: typeof Compass }[] = [
  { view: 'discover', label: 'Discover', icon: Compass }, { view: 'matches', label: 'Matches', icon: Heart }, { view: 'messages', label: 'Messages', icon: MessageCircle }, { view: 'profile', label: 'My profile', icon: Users },
];
const employerNav: { view: View; label: string; icon: typeof Compass }[] = [
  { view: 'discover', label: 'Talent', icon: Compass }, { view: 'pipeline', label: 'Pipeline', icon: Layers3 }, { view: 'messages', label: 'Messages', icon: MessageCircle }, { view: 'jobs', label: 'Jobs', icon: BriefcaseBusiness }, { view: 'analytics', label: 'Insights', icon: BarChart3 }, { view: 'profile', label: 'My profile', icon: Users },
];

/** Matches the mobile-landing breakpoint (<768px). */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

async function connectLinkedIn() {
  const url = `${apiBase}/api/auth/linkedin${Capacitor.isNativePlatform() ? '?platform=native' : ''}`;
  if (Capacitor.isNativePlatform()) await Browser.open({ url });
  else window.location.href = url;
}

export default function App() {
  const [session, setSession] = useState<SessionUser | null>(loadSession);
  const signIn = (user: SessionUser) => { saveSession(user); setSession(user); };
  const signOut = () => { api.logout().catch(() => undefined); saveSession(null); setSession(null); };
  // Restore a server session (cookie) after a refresh or an SSO redirect.
  useEffect(() => {
    if (session) return;
    api.me().then(({ user }) => { saveSession(user); setSession(user); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    NativeApp.addListener('appUrlOpen', ({ url }) => {
      const callback = new URL(url);
      if (callback.protocol === 'jobmatch:' && callback.hostname === 'auth') {
        Browser.close();
        if (callback.searchParams.get('success') === '1') api.login('candidate-demo').then(({ user }) => signIn(user));
      }
    }).then((handle) => { remove = () => handle.remove(); });
    return () => remove?.();
  }, []);
  // Password-reset deep link (?reset=<token>) — shown over whatever's rendered.
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '');
  const clearQuery = (key: string) => { const url = new URL(window.location.href); url.searchParams.delete(key); window.history.replaceState({}, '', url.pathname + url.search); };
  const finishReset = (user?: SessionUser) => { setResetToken(''); clearQuery('reset'); if (user) signIn(user); };

  return <>
    {!session ? <Landing onLogin={signIn} /> : <Workspace key={session.id} session={session} onSwitchUser={signIn} onExit={signOut} />}
    <AnimatePresence>{resetToken && <ResetPasswordModal token={resetToken} onClose={() => finishReset()} onComplete={finishReset} />}</AnimatePresence>
  </>;
}

function Landing({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const linkedinState = new URLSearchParams(window.location.search).get('linkedin');
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const isMobile = useIsMobile();
  const [mobilePreview, setMobilePreview] = useState(false);
  const openLogin = () => setAuthModal('login');
  const openRegister = () => setAuthModal('register');
  const complete = (user: SessionUser) => { setAuthModal(null); onLogin(user); };
  const modals = <AnimatePresence>
    {authModal === 'login' && <LoginModal onClose={() => setAuthModal(null)} onComplete={complete} />}
    {authModal === 'register' && <RegisterModal onClose={() => setAuthModal(null)} onComplete={complete} />}
  </AnimatePresence>;

  if (isMobile) return <>{<MobileLanding onRegister={openRegister} onLogin={openLogin} />}{modals}</>;

  if (mobilePreview) return <div className="preview-shell">
    <nav className="landing-nav"><Brand /><div className="landing-links"><button className="mobile-toggle active" onClick={() => setMobilePreview(false)} aria-pressed="true"><Smartphone size={15} /> Mobile view</button></div></nav>
    <div className="device-stage"><div className="device-frame"><div className="device-screen"><MobileLanding onRegister={openRegister} onLogin={openLogin} /></div></div></div>
    {modals}
  </div>;

  return <main className="landing">
    <header className="landing-header">
      <nav className="landing-nav"><Brand /></nav>
      <nav className="landing-subnav"><a href="#how">How it works</a><a href="#compare">Why JobsMatchNow</a><a href="#trust">Trust &amp; fairness</a><button className="mobile-toggle" onClick={() => setMobilePreview(true)} aria-pressed="false"><Smartphone size={15} /> Mobile view</button></nav>
    </header>
    {linkedinState && <div className="integration-notice">{linkedinState === 'connected' ? 'LinkedIn connected. Your professional identity is ready to use.' : 'Add LinkedIn app credentials to enable live account connection. The demo remains available.'}<button onClick={() => history.replaceState({}, '', '/')}>×</button></div>}
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={14} /> Find jobs you’ll love — and the people who’ll love the role and your company.</div>
        <h1>Stop chasing jobs and candidates.<br /><span>Let the perfect match chase you.</span></h1>
        <p>Job seekers, let the perfect role find you. Hiring teams, let the right candidates come to you. A connection opens only when both sides choose.</p>
        <div className="location-pitch-app"><MapPin size={18} /><span><small>Geolocation of Opportunities</small><strong>Match nearby. Meet for a cup of coffee in your city.</strong></span></div>
        <div className="hero-actions"><button className="primary-button" onClick={openRegister}>Register free <ArrowRight size={18} /></button><button className="secondary-button" onClick={openLogin}>Log in</button></div>
        <div className="proof-row"><span><Check size={14} /> Explainable fit</span><span><Check size={14} /> Private distance range</span><span><Check size={14} /> Salary up front</span></div>
      </div>
      <div className="hero-visual carousel-side" aria-label="JobsMatchNow product preview">
        <div className="floating-love love-one"><Heart size={16} fill="currentColor" /></div><div className="floating-love love-two"><Sparkles size={14} /></div>
        <PhoneMockup />
      </div>
    </section>
    <section className="logo-strip"><span>Built for the way modern teams hire</span><div><b>northstar</b><b>CANVAS</b><b>relay</b><b>ORBIT</b><b>stride</b></div></section>
    <JourneyPipeline />
    <LatestShowcase onRegister={openRegister} onLogin={openLogin} />
    <section className="comparison-section" id="compare">
      <div className="comparison-intro"><div><span className="section-kicker">The hiring upgrade</span><h2>Old hiring creates activity.<br />JobsMatchNow creates alignment.</h2></div><p>Everything candidates and hiring teams need—from first discovery to a qualified conversation—inside one respectful, intelligent experience.</p></div>
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead><tr><th>Experience</th><th><span className="old-dot" />Traditional hiring</th><th><span className="new-dot" />JobsMatchNow</th><th>What changes</th></tr></thead>
          <tbody>{comparisonRows.map((row) => <tr key={row.feature}><th scope="row">{row.feature}</th><td data-label="Traditional hiring"><X size={15} />{row.traditional}</td><td data-label="JobsMatchNow"><Check size={15} />{row.jobmatch}</td><td data-label="What changes"><span>{row.impact}</span></td></tr>)}</tbody>
        </table>
      </div>
      <div className="comparison-cta"><div><Sparkles size={19} /><span><strong>See the difference yourself.</strong> Switch between candidate and recruiter views in the live product.</span></div><button className="primary-button" onClick={openLogin}>Explore every feature <ArrowRight size={17} /></button></div>
    </section>
    <section className="value-section" id="how"><div><span className="section-kicker">A better signal</span><h2>Hiring works better when<br />both sides choose.</h2></div><div className="value-grid"><Feature icon={Target} title="Fit, explained" text="Go beyond keywords with transparent skill, experience, and preference signals." /><Feature icon={Zap} title="Intent, confirmed" text="A conversation opens only after both sides express interest. No cold outreach." /><Feature icon={MapPin} title="Geolocation of Opportunities" text="Choose a city and private distance range, then meet for coffee only when both sides agree." /><Feature icon={ShieldCheck} title="People, respected" text="Salary and work style are clear up front. Candidate controls stay at the center." /></div></section>
    <section className="trust-section" id="trust"><div className="trust-copy"><span className="section-kicker light">Designed for trust</span><h2>Less noise.<br />More possibility.</h2><p>Every recommendation carries its reason. Every connection starts with consent. Every candidate gets control over what employers can see.</p><button className="white-button" onClick={openLogin}>Open recruiter workspace <ArrowRight size={17} /></button></div><div className="metrics"><div><strong>3.2×</strong><span>more qualified conversations</span></div><div><strong>48h</strong><span>median time to first response</span></div><div><strong>42%</strong><span>fewer screening steps</span></div><small>Illustrative product targets for the demo experience.</small></div></section>
    <FeedbackSection />
    <footer><Brand /><span>Perfect matches should feel human.</span><small>© 2026 JobsMatchNow</small></footer>
    {modals}
  </main>;
}

function Feature({ icon: Icon, title, text }: { icon: typeof Target; title: string; text: string }) {
  return <article><div className="feature-icon"><Icon size={20} /></div><h3>{title}</h3><p>{text}</p></article>;
}

function Workspace({ session, onSwitchUser, onExit }: { session: SessionUser; onSwitchUser: (user: SessionUser) => void; onExit: () => void }) {
  // After ANY login the user lands on their own profile page first.
  const [view, setView] = useState<View>('profile');
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [editStep, setEditStep] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const role: Role = data?.viewer.role ?? session.role;
  const notifications = useMemo(() => {
    if (!data) return [] as { id: string; kind: 'match' | 'msg'; text: string; at: number }[];
    const list: { id: string; kind: 'match' | 'msg'; text: string; at: number }[] = [];
    for (const m of data.matches) {
      const who = role === 'candidate' ? (m.job?.company || 'A team') : (m.candidate?.name || 'A candidate');
      list.push({ id: `match-${m.id}`, kind: 'match', text: `It’s a match with ${who}`, at: m.createdAt });
      const thread = data.messages.filter((msg) => msg.matchId === m.id);
      const last = thread[thread.length - 1];
      if (last && last.senderId !== data.viewer.id) list.push({ id: `msg-${last.id}`, kind: 'msg', text: `New message from ${who}`, at: last.createdAt });
    }
    return list.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [data, role]);

  const load = () => { setLoading(true); setError(''); api.bootstrap(session.id).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, [session.id]);
  // Demo convenience: jump between the flagship candidate and recruiter personas.
  const changeRole = (next: Role) => { api.login(`${next}-demo`).then(({ user }) => onSwitchUser(user)); };
  const nav = role === 'candidate' ? candidateNav : employerNav;
  const initials = (session.name || '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return <div className={`app-shell role-${role}`}>
    <aside className={mobileNav ? 'sidebar open' : 'sidebar'}><div className="sidebar-head"><Brand /><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X /></button></div>
      <div className="workspace-switch"><span>Workspace</span><button onClick={() => changeRole(role === 'candidate' ? 'employer' : 'candidate')}><div className="avatar-mini">{initials}</div><div><strong>{data?.viewer.name || session.name}</strong><small>{role === 'candidate' ? 'Candidate' : 'Recruiter'}</small></div><ChevronDown size={15} /></button></div>
      <nav className="sidebar-nav">{nav.map(({ view: itemView, label, icon: Icon }) => <button key={itemView} className={view === itemView ? 'active' : ''} onClick={() => { setView(itemView); setMobileNav(false); }}><Icon size={19} /><span>{label}</span>{label === 'Messages' && <em>2</em>}</button>)}</nav>
      <div className="sidebar-bottom"><button><CircleHelp size={18} />Help center</button><button onClick={() => setSettingsOpen(true)}><Settings size={18} />Settings</button><button className="logout-button" onClick={onExit}><LogOut size={18} />Log out</button><button className="profile-button" onClick={() => { setView('profile'); setMobileNav(false); }}><img src={data?.viewer.photo} /><div><strong>{data?.viewer.name || 'Loading'}</strong><small>View my profile</small></div><MoreHorizontal size={17} /></button></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <section className="app-main">{session.emailVerified === false && <div className="verify-banner"><span><ShieldCheck size={15} /> Verify your email to secure your account and unlock everything.</span><button onClick={() => setSettingsOpen(true)}>Verify now</button></div>}<header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}><Menu /></button><div className="search-box"><Search size={17} /><input aria-label="Search" placeholder={role === 'candidate' ? 'Search jobs, companies, skills…' : 'Search talent, jobs, messages…'} /><kbd><Command size={12} /> K</kbd></div><div className="topbar-actions"><div className="notif-wrap"><button aria-label="Notifications" onClick={() => setNotifOpen((v) => !v)}><Bell size={19} />{notifications.length > 0 && <i />}</button>{notifOpen && <><button className="notif-scrim" aria-label="Close notifications" onClick={() => setNotifOpen(false)} /><div className="notif-dropdown"><header>Notifications</header>{notifications.length === 0 ? <p className="notif-empty">No notifications yet.</p> : notifications.map((n) => <button key={n.id} className="notif-item" onClick={() => { setNotifOpen(false); setView('messages'); }}><span className={`notif-icon ${n.kind}`}>{n.kind === 'match' ? <Heart size={14} fill="currentColor" /> : <MessageCircle size={14} />}</span><span className="notif-text">{n.text}<small>{timeAgo(n.at)}</small></span></button>)}</div></>}</div><button className="role-chip" onClick={() => changeRole(role === 'candidate' ? 'employer' : 'candidate')}>{role === 'candidate' ? 'Candidate view' : 'Recruiter view'}<ChevronDown size={14} /></button></div></header>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={load} /> : data && (
        (data.viewer.onboarding || editStep !== null)
          ? (data.viewer.role === 'candidate'
              ? <CandidateWizard viewer={data.viewer} initialStep={editStep ?? 0}
                  onDone={() => { setEditStep(null); setView('profile'); load(); }}
                  onCancel={data.viewer.onboarding ? undefined : () => setEditStep(null)} />
              : <RecruiterWizard viewer={data.viewer} initialStep={editStep ?? 0}
                  onDone={() => { setEditStep(null); setView('profile'); load(); }}
                  onCancel={data.viewer.onboarding ? undefined : () => setEditStep(null)} />)
          : <ViewRouter view={view} role={role} data={data} setData={setData} navigate={setView} onEditProfile={setEditStep} reload={load} />
      )}
    </section>
    <AnimatePresence>{settingsOpen && <SettingsModal user={session} onClose={() => setSettingsOpen(false)} onDeleted={() => { setSettingsOpen(false); onExit(); }} />}</AnimatePresence>
  </div>;
}

function ViewRouter({ view, role, data, setData, navigate, onEditProfile, reload }: { view: View; role: Role; data: Bootstrap; setData: (d: Bootstrap) => void; navigate: (v: View) => void; onEditProfile: (step: number) => void; reload: () => void }) {
  if (view === 'discover') return <Discover role={role} data={data} setData={setData} navigate={navigate} onEditProfile={onEditProfile} />;
  if (view === 'pipeline') return <Pipeline data={data} setData={setData} />;
  if (view === 'messages') return <Messages data={data} setData={setData} />;
  if (view === 'analytics') return <Analytics data={data} />;
  if (view === 'jobs') return <Jobs data={data} reload={reload} />;
  if (view === 'matches') return <Matches data={data} navigate={navigate} />;
  if (role === 'candidate') return <CandidateProfilePage viewer={data.viewer} onEdit={onEditProfile} />;
  return <RecruiterProfilePage viewer={data.viewer} onEdit={onEditProfile} />;
}

/** Item 18: pre-swipe readiness checklist for candidates, with fix links into the wizard. */
function ReadyChecklist({ viewer, onEditProfile }: { viewer: Person; onEditProfile: (step: number) => void }) {
  const items = [
    { label: 'Resume uploaded', done: Boolean(viewer.documents?.resume), step: 3 },
    { label: 'Salary expectation set', done: viewer.preferences?.salary?.min !== undefined, step: 2 },
    { label: 'Profile at least 90% complete', done: (viewer.completeness ?? 0) >= 90, step: 0 },
  ];
  if (items.every((item) => item.done)) return null;
  return <div className="ready-checklist">
    <strong><ShieldCheck size={15} /> Am I ready to swipe?</strong>
    <div className="ready-items">
      {items.map((item) => <span key={item.label} className={item.done ? 'ready-item done' : 'ready-item'}>
        {item.done ? <Check size={12} /> : <X size={12} />}{item.label}
        {!item.done && <button onClick={() => onEditProfile(item.step)}>Fix</button>}
      </span>)}
    </div>
  </div>;
}

function Discover({ role, data, setData, navigate, onEditProfile }: { role: Role; data: Bootstrap; setData: (d: Bootstrap) => void; navigate: (v: View) => void; onEditProfile: (step: number) => void }) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [resumeFor, setResumeFor] = useState<Person | null>(null);
  const [jobDetail, setJobDetail] = useState<Job | null>(null);
  const [screeningFor, setScreeningFor] = useState<Job | null>(null);
  const matchedCandidateIds = useMemo(() => new Set(data.matches.map((item) => item.candidateId)), [data.matches]);
  const [radius, setRadius] = useState(25);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterType, setFilterType] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersActive = Boolean(query.trim() || filterMode || filterType || minScore > 0);
  const rawDeck = role === 'candidate' ? data.jobs : data.candidates;
  // Remote roles are never gated by the distance slider — only place-based ones.
  const inRadius = rawDeck.filter((item) => ('workMode' in item && (item as Job).workMode === 'Remote') || item.distanceKm === undefined || item.distanceKm <= radius);
  const matchesSearch = (item: Job | Person) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const hay = role === 'candidate'
      ? [(item as Job).title, (item as Job).company, (item as Job).location, ...((item as Job).requiredSkills || [])]
      : [(item as Person).name, (item as Person).title, (item as Person).location, ...((item as Person).skills || [])];
    return hay.filter(Boolean).join(' ').toLowerCase().includes(q);
  };
  const passesFilters = (item: Job | Person) => {
    if ((item.match?.score ?? 0) < minScore) return false;
    if (role === 'candidate') { const j = item as Job; if (filterMode && j.workMode !== filterMode) return false; if (filterType && j.type !== filterType) return false; }
    return true;
  };
  const filtered = inRadius.filter(matchesSearch).filter(passesFilters).sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
  // Candidates get a curated Top 3 daily — unless they're actively searching/filtering.
  const deck = role === 'candidate' && !filtersActive ? filtered.slice(0, 3) : filtered;
  useEffect(() => setIndex(0), [radius, role, query, filterMode, filterType, minScore]);
  const current = deck[index];
  const next = deck[index + 1];
  const commitSwipe = async (direction: 'like' | 'pass', target: Job | Person, opts?: { superLike?: boolean; answers?: ScreeningAnswer[] }) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.swipe({ actorId: data.viewer.id, targetId: target.id, targetType: role === 'candidate' ? 'job' : 'candidate', direction, superLike: opts?.superLike || undefined, answers: opts?.answers?.length ? opts.answers : undefined });
      if (result.match) setMatch(result.match);
      setData({ ...data, likesRemaining: result.likesRemaining ?? data.likesRemaining - (direction === 'like' ? 1 : 0) });
      setIndex((value) => value + 1);
    } catch (e) { alert(e instanceof Error ? e.message : 'Swipe failed'); }
    finally { setBusy(false); }
  };
  const act = (direction: 'like' | 'pass', superLike = false) => {
    if (!current || busy) return;
    // Item 11: a plain right-swipe on a job with screening questions pauses for the 30-second form.
    if (direction === 'like' && !superLike && role === 'candidate' && (current as Job).screeningQuestions?.length) { setScreeningFor(current as Job); return; }
    void commitSwipe(direction, current, { superLike });
  };
  // Rewind/Undo: take back the last swipe (removes it server-side, incl. any match).
  const undo = async () => {
    if (index === 0 || busy) return;
    setBusy(true);
    try {
      await api.undoSwipe(data.viewer.id);
      const fresh = await api.bootstrap(data.viewer.id);
      setData(fresh);
      setIndex((value) => Math.max(0, value - 1));
    } catch (e) { alert(e instanceof Error ? e.message : 'Undo failed'); }
    finally { setBusy(false); }
  };
  // Item 10: after a gap skill is added, re-bootstrap so every fit score recalculates live.
  const refreshScores = () => api.bootstrap(data.viewer.id).then(setData).catch(() => undefined);

  return <div className="page discover-page"><div className="page-title"><div><span className="overline">{role === 'candidate' ? 'Your next move' : 'Recommended talent'}</span><h1>{role === 'candidate' ? 'Discover roles' : 'Discover people'}</h1><p>{role === 'candidate' ? 'Curated from your skills, goals, and work preferences.' : 'Ranked against Senior Product Designer · Northstar.'}</p></div><div className="title-actions"><button className={filtersOpen ? 'ghost-button active' : 'ghost-button'} onClick={() => setFiltersOpen((v) => !v)}><SlidersHorizontal size={17} />Filters{filtersActive && <span>{[query.trim(), filterMode, filterType, minScore > 0].filter(Boolean).length}</span>}</button></div></div>
    {role === 'candidate' && <ReadyChecklist viewer={data.viewer} onEditProfile={onEditProfile} />}
    <div className="discover-search"><div className="ds-input"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={role === 'candidate' ? 'Search roles, companies, skills…' : 'Search talent by name, title, skills…'} aria-label="Search" />{query && <button className="ds-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</div></div>
    {filtersOpen && <div className="discover-filters">
      <div className="df-group"><label>Minimum fit</label><div className="df-scores">{[0, 50, 70, 85].map((s) => <button key={s} className={minScore === s ? 'active' : ''} onClick={() => setMinScore(s)}>{s === 0 ? 'Any' : `${s}%+`}</button>)}</div></div>
      {role === 'candidate' && <>
        <div className="df-group"><label>Work mode</label><div className="df-chips">{['Remote', 'Hybrid', 'On-site', 'Flexible'].map((m) => <button key={m} className={filterMode === m ? 'active' : ''} onClick={() => setFilterMode(filterMode === m ? '' : m)}>{m}</button>)}</div></div>
        <div className="df-group"><label>Type</label><div className="df-chips">{['Full-time', 'Part-time', 'Contract', 'Freelance'].map((t) => <button key={t} className={filterType === t ? 'active' : ''} onClick={() => setFilterType(filterType === t ? '' : t)}>{t}</button>)}</div></div>
      </>}
      {filtersActive && <button className="df-clear" onClick={() => { setQuery(''); setFilterMode(''); setFilterType(''); setMinScore(0); }}>Clear all</button>}
    </div>}
    <section className="geo-control" aria-label="Geolocation of Opportunities"><div><MapPin size={18} /><span><small>Geolocation of Opportunities</small><strong>{role === 'candidate' ? 'Roles' : 'Candidates'} within {radius} km</strong></span></div><input aria-label="Maximum match distance in kilometres" type="range" min="5" max="100" step="5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /><p>City-level matching only. Exact locations stay private.</p></section>
    <div className="discover-layout"><section className="deck-area">
      <div className="deck-meta"><span><Sparkles size={15} />{filtersActive ? 'Search results' : role === 'candidate' ? 'Your Top 3 today' : 'Personalized for you'}</span><small>{filtersActive ? `${Math.max(deck.length - index, 0)} of ${deck.length} match` : role === 'candidate' ? `${Math.max(deck.length - index, 0)} of today's ${deck.length} left` : `${Math.max(deck.length - index, 0)} nearby recommendations`}</small></div>
      <div className="card-stack">{next && <div className="stack-card"><CardSummary item={next} role={role} /></div>}{current ? <SwipeCard key={current.id} item={current} role={role} onSwipe={act} onOpenResume={role === 'employer' ? setResumeFor : undefined} resumeUnlocked={role === 'employer' && matchedCandidateIds.has(current.id)} onOpenJob={role === 'candidate' ? setJobDetail : undefined} gapViewer={role === 'candidate' ? data.viewer : undefined} onSkillAdded={refreshScores} /> : <EmptyDeck role={role} onReset={() => setIndex(0)} />}</div>
      {current && <div className="action-row"><button onClick={() => act('pass')} disabled={busy} className="pass-action" aria-label="Pass"><X /></button><button onClick={undo} disabled={busy || index === 0} className="undo-action" aria-label="Undo last swipe" title="Rewind last swipe"><RotateCcw /></button><button onClick={() => act('like', true)} disabled={busy} className="superlike-action" aria-label="Super Like" title="Super Like — a stronger signal"><Star fill="currentColor" /></button><button onClick={() => act('like')} disabled={busy} className="like-action" aria-label="Like"><Heart fill="currentColor" /></button></div>}
      <div className="keyboard-hint"><span><kbd>←</kbd> Pass</span><span><kbd>★</kbd> Super</span><span><kbd>→</kbd> Like</span></div>
    </section><aside className="insight-panel"><div className="daily-card"><div><span>Today’s activity</span><strong>{data.likesRemaining}</strong><small>likes remaining</small></div><div className="ring" style={{ '--progress': `${data.likesRemaining * 2}%` } as React.CSSProperties}><Heart size={18} /></div></div><div className="tip-card"><div className="tip-icon"><Zap size={17} /></div><strong>{role === 'candidate' ? 'Complete your preferences' : 'Calibrate your search'}</strong><p>{role === 'candidate' ? 'Add your preferred team size to improve recommendations by up to 18%.' : 'Review five profiles to help JobsMatchNow learn what great looks like for this role.'}</p><button>{role === 'candidate' ? 'Update preferences' : 'View calibration'} <ArrowRight size={14} /></button></div><div className="quality-card"><div className="quality-head"><span>Match quality</span><strong>Excellent</strong></div><div className="quality-bar"><i /></div><p>Your recommendations use 12 verified profile signals.</p></div></aside></div>
    <AnimatePresence>{match && <MatchModal match={match} viewer={data.viewer} onClose={() => setMatch(null)} onMessage={() => { setMatch(null); navigate('messages'); }} />}</AnimatePresence>
    <AnimatePresence>{resumeFor && <Suspense fallback={null}><ResumeViewerModal person={resumeFor} viewerId={data.viewer.id} onClose={() => setResumeFor(null)} /></Suspense>}</AnimatePresence>
    <AnimatePresence>{jobDetail && <JobDetailModal job={jobDetail} onClose={() => setJobDetail(null)} />}</AnimatePresence>
    <AnimatePresence>{screeningFor && <ScreeningModal job={screeningFor} onCancel={() => setScreeningFor(null)} onSubmit={(answers) => { const target = screeningFor; setScreeningFor(null); void commitSwipe('like', target, { answers }); }} />}</AnimatePresence></div>;
}

function SwipeCard({ item, role, onSwipe, onOpenResume, resumeUnlocked, onOpenJob, gapViewer, onSkillAdded }: { item: Job | Person; role: Role; onSwipe: (direction: 'like' | 'pass') => void; onOpenResume?: (person: Person) => void; resumeUnlocked?: boolean; onOpenJob?: (job: Job) => void; gapViewer?: Person; onSkillAdded?: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const x = useMotionValue(0); const rotate = useTransform(x, [-220, 220], [-8, 8]); const likeOpacity = useTransform(x, [20, 120], [0, 1]); const passOpacity = useTransform(x, [-120, -20], [1, 0]);
  return <motion.article className="swipe-card" style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.85} onDragEnd={(_, info) => { if (info.offset.x > 110) onSwipe('like'); else if (info.offset.x < -110) onSwipe('pass'); }}>
    <motion.div className="swipe-stamp like-stamp" style={{ opacity: likeOpacity }}>INTERESTED</motion.div><motion.div className="swipe-stamp pass-stamp" style={{ opacity: passOpacity }}>PASS</motion.div>
    {item.superLikedYou && <div className="superlike-ribbon"><Star size={12} fill="currentColor" /> Super Liked you</div>}
    <div className={flipped ? 'card-flip flipped' : 'card-flip'}>
      <div className="card-face card-front">
        <CardSummary item={item} role={role} detailed onOpenResume={onOpenResume} resumeUnlocked={resumeUnlocked} onOpenJob={onOpenJob} gapViewer={gapViewer} onSkillAdded={onSkillAdded} />
        <button className="flip-button" onPointerDownCapture={(event) => event.stopPropagation()} onClick={() => setFlipped(true)}><Sparkles size={13} /> Why this match</button>
      </div>
      <div className="card-face card-back"><FitBreakdown item={item} role={role} onBack={() => setFlipped(false)} /></div>
    </div>
  </motion.article>;
}

const SALARY_BADGES: Record<string, { label: string; tone: string }> = {
  within: { label: 'Within your expected range', tone: 'good' },
  above: { label: 'Above your expected range', tone: 'info' },
  below: { label: 'Below your minimum', tone: 'bad' },
  unknown: { label: 'Salary revealed after match', tone: 'muted' },
};

function SalaryBadge({ status }: { status?: string }) {
  const badge = SALARY_BADGES[status || 'unknown'] || SALARY_BADGES.unknown;
  return <span className={`salary-badge salary-${badge.tone}`}>{badge.label}</span>;
}

const CONFETTI_COLORS = ['#fd267a', '#ff4458', '#ff6036', '#0a66c2', '#00a0dc', '#f5c518', '#20b46a'];

/** Item 16: dependency-free confetti burst behind the "It's a Match" modal. */
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 60 }, (_, index) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.7,
    duration: 2.4 + Math.random() * 1.6,
    size: 6 + Math.random() * 7,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    spin: Math.random() > 0.5 ? 1 : -1,
  })), []);
  return <div className="confetti" aria-hidden="true">
    {pieces.map((piece, index) => <i key={index} style={{ left: `${piece.left}%`, width: piece.size, height: piece.size * 0.45, background: piece.color, animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`, ['--spin' as string]: piece.spin }} />)}
  </div>;
}

/** Item 14: straight-line distance → motorbike commute estimate (~30 km/h city average). */
function motorbikeMinutes(distanceKm: number) { return Math.max(3, Math.round(distanceKm * 2)); }

/** Human label for a job's work mode, including remote scope / hybrid radius. */
function workModeLabel(job: Job) {
  if (job.workMode === 'Remote') return job.remoteScope === 'country' ? `Remote · within ${job.country || 'country'}` : 'Remote · Worldwide';
  if (job.workMode === 'Hybrid') return job.hiringRadiusKm ? `Hybrid · within ${job.hiringRadiusKm} km` : 'Hybrid';
  return job.workMode; // On-site, Flexible
}
/** Distance/commute only makes sense when the role needs physical presence. */
function showsCommute(job: Job) { return job.workMode !== 'Remote' && job.distanceKm !== undefined; }

function formatRange(range?: { min: number; max: number; currency: string }) {
  if (!range) return null;
  const compact = (value: number) => (value >= 1000 && value % 1000 === 0 ? `${value / 1000}k` : value.toLocaleString());
  return `${compact(range.min)}–${compact(range.max)} ${range.currency}`;
}

/** Back of the flip card: per-factor score breakdown with evidence lines. */
function FitBreakdown({ item, role, onBack }: { item: Job | Person; role: Role; onBack: () => void }) {
  const match = item.match;
  const title = role === 'candidate' ? (item as Job).title : (item as Person).name;
  return <div className="fit-breakdown" onPointerDownCapture={(event) => event.stopPropagation()}>
    <header>
      <div><span className="overline">Why this match</span><h2>{match?.score}% fit · {title}</h2></div>
      <button className="modal-close" onClick={onBack} aria-label="Back to card"><RotateCcw size={16} /></button>
    </header>
    <div className="fit-factors">
      {(match?.breakdown || []).map((factor) => <div className="fit-factor" key={factor.factor}>
        <div className="fit-factor-head"><strong>{factor.label}</strong><span>{Math.round(factor.score * 100)}%</span></div>
        <div className="fit-factor-bar"><i style={{ width: `${Math.round(factor.score * 100)}%` }} /></div>
        <p>{factor.evidence}</p>
      </div>)}
    </div>
    {match && match.matchedSkills.length > 0 && <div className="card-section"><span className="card-label">Matched skills</span><div className="skill-list">{match.matchedSkills.map((skill) => <span key={skill}><Check size={12} />{skill}</span>)}</div></div>}
  </div>;
}

function ResumeChip({ person, unlocked, onOpen }: { person: Person; unlocked: boolean; onOpen: (person: Person) => void }) {
  const resume = person.documents?.resume;
  if (!resume) return null;
  return <button type="button" className="resume-chip" onPointerDownCapture={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpen(person); }}>
    {resume.thumbName ? <img className={unlocked ? 'resume-chip-thumb' : 'resume-chip-thumb blurred'} src={`${apiBase}/api/users/${person.id}/resume/thumbnail`} alt="" /> : <span className="resume-chip-icon"><FileText size={15} /></span>}
    <span className="resume-chip-text"><strong>Resume</strong><small>{unlocked ? 'Full access' : 'Anonymized preview'}</small></span>
    {!unlocked && <Lock size={12} />}
  </button>;
}

function CardSummary({ item, role, detailed = false, onOpenResume, resumeUnlocked = false, onOpenJob, gapViewer, onSkillAdded }: { item: Job | Person; role: Role; detailed?: boolean; onOpenResume?: (person: Person) => void; resumeUnlocked?: boolean; onOpenJob?: (job: Job) => void; gapViewer?: Person; onSkillAdded?: () => void }) {
  if (role === 'candidate') {
    const job = item as Job;
    const heroStyle = job.coverImage ? { backgroundImage: `linear-gradient(transparent 38%, rgba(0,0,0,.82)), url(${apiBase}${job.coverImage})` } : { background: appleGradient(job.id) };
    return <>
      <div className="card-hero" style={heroStyle}>
        {!job.coverImage && <span className="card-hero-logo" aria-hidden="true">{job.logo}</span>}
        <div className="card-hero-top"><div className="fit-badge"><span>{job.match.score}%</span> match</div>{job.demo && <span className="demo-badge">Demo</span>}</div>
        <div className="card-hero-overlay">
          <div className="card-hero-eyebrow">{job.company}{job.verified && <BadgeCheck size={14} className="verified-mark" />}</div>
          <h2>{job.title}</h2>
          <div className="card-hero-meta"><span><MapPin size={14} />{job.location}</span><span className="mode-badge">{workModeLabel(job)}</span>{showsCommute(job) && <span className="distance-badge">{job.distanceKm} km · ≈ {motorbikeMinutes(job.distanceKm!)} min</span>}</div>
        </div>
      </div>
      <div className="card-body">
        <div className="job-meta"><span><BriefcaseBusiness size={15} />{job.type}</span>{job.salaryHidden ? <SalaryBadge status={job.match?.salaryStatus} /> : <span>{job.salary}</span>}<span>{job.responseTime} response</span></div>
        <p className="description">{job.description}</p>
        {detailed && <><div className="match-reason"><div><Sparkles size={17} /></div><section><strong>Why you’re a strong match</strong><p>{job.match.matchedSkills.length} priority skills match, your experience level fits, and the role supports your preferred work style.</p></section></div><div className="card-section"><span className="card-label">Your matching skills</span><div className="skill-list">{job.match.matchedSkills.map((skill) => <span key={skill}><Check size={12} />{skill}</span>)}</div></div>{gapViewer && onSkillAdded && <GapCoach job={job} viewer={gapViewer} onSkillAdded={onSkillAdded} />}<div className="card-foot"><div><strong>{job.mission}</strong><small>{job.culture.join(' · ')}</small></div><button onPointerDownCapture={(event) => event.stopPropagation()} onClick={() => onOpenJob?.(job)}>Full role <ArrowRight size={14} /></button></div></>}
      </div>
    </>;
  }
  const person = item as Person;
  return <>
    <div className="card-hero" style={{ backgroundImage: `linear-gradient(transparent 38%, rgba(0,0,0,.82)), url(${person.photo})` }}>
      <div className="card-hero-top"><div className="fit-badge"><span>{person.match?.score}%</span> match</div>{person.availability && <span className="avail-pill"><i />Available {person.availability}</span>}</div>
      <div className="card-hero-overlay">
        <h2>{person.name}{person.verified && <BadgeCheck size={18} className="verified-mark" />}{person.demo && <span className="demo-badge">Demo</span>}</h2>
        <p className="card-hero-sub">{person.title}</p>
        {(person.preferences?.desiredRoles?.[0] || person.availability) && <div className="looking-for"><Target size={12} />Looking for: {person.preferences?.desiredRoles?.[0] || `available ${person.availability}`}</div>}
        <div className="card-hero-meta"><span><MapPin size={14} />{person.location}</span>{person.distanceKm !== undefined && <span className="distance-badge">{person.distanceKm} km away</span>}<span><BriefcaseBusiness size={14} />{person.experienceLevel}</span></div>
      </div>
    </div>
    <div className="card-body">
      {detailed && <><div className="match-reason"><div><Sparkles size={17} /></div><section><strong>Why they stand out</strong><p>{person.match?.matchedSkills.join(', ')} align with the role. Their background and availability fit your hiring plan.</p></section></div><div className="card-section"><span className="card-label">Top skills</span><div className="skill-list">{person.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div>{onOpenResume && <ResumeChip person={person} unlocked={resumeUnlocked} onOpen={onOpenResume} />}</>}
    </div>
  </>;
}

function EmptyDeck({ role, onReset }: { role: Role; onReset: () => void }) {
  if (role === 'candidate') return <div className="empty-deck"><div><Check /></div><h2>That’s your Top 3 for today</h2><p>Quality over volume: a fresh, curated batch of matches lands tomorrow.</p><button className="primary-button" onClick={onReset}><RotateCcw size={16} />Review again (demo)</button></div>;
  return <div className="empty-deck"><div><Check /></div><h2>You’re all caught up</h2><p>We’ll bring you fresh recommendations as soon as the fit is strong enough.</p><button className="primary-button" onClick={onReset}><RotateCcw size={16} />Review again</button></div>;
}

function MatchModal({ match, viewer, onClose, onMessage }: { match: JobMatch; viewer: Person; onClose: () => void; onMessage: () => void }) {
  const counterpart = viewer.role === 'candidate' ? (match.job?.company || 'The team') : (match.candidate?.name || 'The candidate');
  const jobRange = formatRange(match.job?.salaryRange);
  const candidateRange = formatRange(viewer.role === 'candidate' ? viewer.preferences?.salary as { min: number; max: number; currency: string } | undefined : match.candidate?.preferences?.salary as { min: number; max: number; currency: string } | undefined);
  // Item 13: tailored conversation starters from the profile/job overlap.
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [sendingIdx, setSendingIdx] = useState(-1);
  useEffect(() => { api.matchIcebreakers(match.id).then((result) => setIcebreakers(result.icebreakers)).catch(() => undefined); }, [match.id]);
  const sendIcebreaker = async (text: string, index: number) => {
    setSendingIdx(index);
    try { await api.message({ matchId: match.id, senderId: viewer.id, text }); onMessage(); }
    catch { setSendingIdx(-1); }
  };
  // Item 16: celebrate the moment — haptics on native builds.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Heavy })).catch(() => undefined);
  }, []);
  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Confetti /><motion.div className="match-modal" initial={{ y: 30, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: .96 }}><button className="modal-close" onClick={onClose}><X /></button><div className="match-glow"><Heart fill="currentColor" /></div><span className="overline">Mutual interest</span><h2>It’s a match.</h2><p>{counterpart} is interested too. Start a conversation while the momentum is fresh.</p>
    <div className="match-faces"><img src={match.candidate?.photo || viewer.photo} /><div style={{ background: match.job ? appleColor(match.job.id) : 'var(--blue)' }}>{match.job?.logo || counterpart[0]}</div></div>
    {(jobRange || candidateRange) && <div className="salary-reveal">
      <span className="overline">Mutual salary reveal</span>
      <div className="salary-reveal-rows">
        {jobRange && <div><small>{match.job?.title || 'Role'} offers</small><strong>{jobRange}</strong></div>}
        {candidateRange && <div><small>{viewer.role === 'candidate' ? 'Your expectation' : `${match.candidate?.name?.split(' ')[0]}'s expectation`}</small><strong>{candidateRange}</strong></div>}
      </div>
      <p>Both ranges are now visible to both sides — at the same time.</p>
    </div>}
    {icebreakers.length > 0 && <div className="icebreakers">
      <span className="overline">Break the ice</span>
      {icebreakers.map((text, index) => <button key={text} className="icebreaker" disabled={sendingIdx >= 0} onClick={() => sendIcebreaker(text, index)}>{sendingIdx === index ? <Loader2 size={13} className="spin" /> : <Send size={13} />}<span>{text}</span></button>)}
    </div>}
    <button className="primary-button" onClick={onMessage}><MessageCircle size={17} />Send a message</button><button className="text-button" onClick={onClose}>Keep exploring</button></motion.div></motion.div>;
}

function Pipeline({ data, setData }: { data: Bootstrap; setData: (d: Bootstrap) => void }) {
  const stages = ['Matched', 'Screen', 'Interview', 'Offer'];
  const [detail, setDetail] = useState<JobMatch | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(() => new Set());
  const move = async (match: JobMatch, stage: string) => { await api.updateStage(match.id, stage); setData({ ...data, matches: data.matches.map((item) => item.id === match.id ? { ...item, stage, stageChangedAt: Date.now() } : item) }); };
  // Item 17: flag matches idle >5 days in a stage; one tap sends a templated follow-up.
  const idleDays = (match: JobMatch) => Math.floor((Date.now() - (match.stageChangedAt ?? match.createdAt)) / 86400000);
  const nudge = async (match: JobMatch) => {
    const first = match.candidate?.name?.split(' ')[0] || 'there';
    const text = `Hi ${first} — just checking in. We're still excited about your profile for ${match.job?.title || 'the role'}. Would a quick chat this week work for you?`;
    const message = await api.message({ matchId: match.id, senderId: data.viewer.id, text });
    setData({ ...data, messages: [...data.messages, message] });
    setNudged((current) => new Set(current).add(match.id));
  };
  return <div className="page"><div className="page-title"><div><span className="overline">Senior Product Designer</span><h1>Hiring pipeline</h1><p>Move mutual matches from first hello to signed offer.</p></div><div className="title-actions"><button className="ghost-button"><Users size={17} />Share</button><button className="primary-button small">Add candidate</button></div></div><div className="pipeline-summary"><Metric label="Active candidates" value="18" change="+4 this week" /><Metric label="Median response" value="19h" change="Top 12%" /><Metric label="Interview rate" value="38%" change="+8.4%" /><Metric label="Time to hire" value="21d" change="6d faster" /></div><div className="pipeline-board">{stages.map((stage, stageIndex) => <section key={stage} className="pipeline-column"><header><span>{stage}</span><em>{data.matches.filter((m) => m.stage === stage).length}</em><button><MoreHorizontal /></button></header><div>{data.matches.filter((m) => m.stage === stage).map((match) => <article className="candidate-tile" key={match.id}><button className="candidate-head tile-open" onClick={() => setDetail(match)} title="Screening answers & interview kit"><img src={match.candidate?.photo} /><div><strong>{match.candidate?.name}</strong><small>{match.candidate?.title}</small></div><span>{match.candidate?.match?.score || 91}%</span></button><div className="tile-skills">{match.candidate?.skills?.slice(0, 2).map((skill) => <span key={skill}>{skill}</span>)}{match.screeningAnswers?.length ? <span className="tile-screening">✓ screening</span> : null}</div>{idleDays(match) > 5 && !nudged.has(match.id) && <div className="tile-nudge"><span><Clock3 size={11} /> Idle {idleDays(match)}d in {stage}</span><button onClick={() => nudge(match)}>Send follow-up</button></div>}{nudged.has(match.id) && <div className="tile-nudge sent"><Check size={11} /> Follow-up sent</div>}<div className="tile-foot"><span><Clock3 size={13} />{stage === 'Interview' ? 'Thu, 2:30 PM' : `Updated ${idleDays(match) === 0 ? 'today' : `${idleDays(match)}d ago`}`}</span>{stageIndex < stages.length - 1 && <button onClick={() => move(match, stages[stageIndex + 1])} aria-label={`Move to ${stages[stageIndex + 1]}`}><ArrowRight size={15} /></button>}</div></article>)}<button className="add-tile">+ Add candidate</button></div></section>)}</div>
    <AnimatePresence>{detail && <MatchDetailModal match={detail} onClose={() => setDetail(null)} />}</AnimatePresence></div>;
}

function Messages({ data, setData }: { data: Bootstrap; setData: (d: Bootstrap) => void }) {
  const match = data.matches[0]; const [text, setText] = useState(''); const thread = data.messages.filter((m) => m.matchId === match?.id);
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!text.trim() || !match) return; const message = await api.message({ matchId: match.id, senderId: data.viewer.id, text }); setData({ ...data, messages: [...data.messages, message] }); setText(''); };
  return <div className="messages-page"><aside className="threads"><div className="threads-head"><div><span className="overline">Inbox</span><h1>Messages</h1></div><button><Filter size={17} /></button></div><div className="thread-search"><Search size={16} /><input placeholder="Search conversations" /></div>{data.matches.map((item, index) => <button className={index === 0 ? 'thread active' : 'thread'} key={item.id}><img src={item.candidate?.photo} /><div><div><strong>{item.candidate?.name || item.job?.company}</strong><time>{index === 0 ? '1h' : '1d'}</time></div><p>{index === 0 ? 'Thursday afternoon works well…' : 'Thanks for connecting — I’d love…'}</p></div>{index === 0 && <i />}</button>)}</aside><section className="conversation">{match ? <><header><img src={match.candidate?.photo} /><div><strong>{match.candidate?.name}</strong><span><i />Active now · {match.job?.title}</span></div><button><MoreHorizontal /></button></header><div className="conversation-body"><div className="date-divider">Today</div>{thread.map((message) => { const own = message.senderId === data.viewer.id; return <div className={own ? 'bubble-row own' : 'bubble-row'} key={message.id}>{!own && <img src={match.candidate?.photo} />}<div><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></div>; })}<div className="schedule-card"><div><BriefcaseBusiness size={18} /></div><section><span>Interview</span><strong>Product conversation</strong><p>Thursday, July 23 · 2:30–3:00 PM</p></section><button>View</button></div></div><form className="composer" onSubmit={send}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" /><button type="submit" disabled={!text.trim()}><Send size={17} /></button></form></> : <EmptyState title="No conversations yet" />}</section><aside className="context-panel"><img src={match?.candidate?.photo} /><h3>{match?.candidate?.name}</h3><p>{match?.candidate?.title}</p><span className="fit-pill">94% role match</span><div className="context-details"><label>Matched for</label><strong>{match?.job?.title}</strong><label>Location</label><strong>{match?.candidate?.location}</strong><label>Stage</label><strong>{match?.stage}</strong></div><button className="secondary-button">View full profile</button></aside></div>;
}

function Matches({ data, navigate }: { data: Bootstrap; navigate: (v: View) => void }) { return <div className="page"><div className="page-title"><div><span className="overline">Mutual interest</span><h1>Your matches</h1><p>These teams chose you back. Start a conversation when you’re ready.</p></div></div><div className="match-grid">{data.matches.map((match) => <article key={match.id}><div className="match-company" style={{ background: match.job ? appleColor(match.job.id) : 'var(--blue)' }}>{match.job?.logo}</div><span className="fit-pill">{match.candidate?.match?.score || 94}% match</span><h2>{match.job?.title}</h2><p>{match.job?.company} · {match.job?.location}</p><div className="match-grid-actions"><button className="secondary-button">View role</button><button className="primary-button" onClick={() => navigate('messages')}><MessageCircle size={16} />Message</button></div></article>)}</div></div>; }

function Jobs({ data, reload }: { data: Bootstrap; reload: () => void }) {
  const [editing, setEditing] = useState<Job | 'new' | null>(null);
  if (editing) return <JobEditor viewer={data.viewer} job={editing === 'new' ? undefined : editing} onSaved={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />;
  const mine = data.jobs.filter((j) => j.employerId === data.viewer.id);
  return <div className="page"><div className="page-title"><div><span className="overline">Recruiting</span><h1>Open roles</h1><p>Manage jobs, recommendations, and candidate interest.</p></div><button className="primary-button small" onClick={() => setEditing('new')}>+ Create job</button></div><div className="channel-bar"><div className="linkedin-mark"><Linkedin size={18} fill="currentColor" /></div><section><strong>LinkedIn Talent Solutions ready</strong><p>Sync job lifecycle and Apply Connect data after partner approval.</p></section><span>Adapter configured</span><button className="secondary-button">Integration settings</button></div><div className="jobs-table"><header><span>Role</span><span>Status</span><span>Salary</span><span>Applicants</span><span>Skills</span><span /></header>{mine.map((job) => <div className="job-row" key={job.id}><div><div className="company-logo small-logo" style={{ background: appleColor(job.id) }}>{job.logo}</div><section><strong>{job.title}</strong><small>{job.location}{job.department ? ` · ${job.department}` : ''}</small></section></div><span className={`status status-${job.status.toLowerCase()}`}><i />{job.status[0].toUpperCase()}{job.status.slice(1)}</span><span>{job.salary}</span><span>{job.applicants}</span><span>{job.requiredSkills.length} weighted</span><button aria-label={`Edit ${job.title}`} onClick={() => setEditing(job)}><MoreHorizontal /></button></div>)}{mine.length === 0 && <div className="job-row"><div><section><strong>No postings yet</strong><small>Create one or use Demo import to fill the form instantly.</small></section></div></div>}</div><div className="job-empty"><div><Sparkles /></div><section><h3>Reach the right people, not the most people.</h3><p>JobsMatchNow recommends your role only to candidates with meaningful fit and verified intent.</p></section><button className="secondary-button" onClick={() => setEditing('new')}>Create your first posting</button></div></div>;
}

function Analytics({ data }: { data: Bootstrap }) {
  // Real figures derived from this recruiter's matches, pipeline, and messages.
  const totalMatches = data.matches.length;
  const inConversation = data.matches.filter((m) => data.messages.some((msg) => msg.matchId === m.id)).length;
  const replied = data.matches.filter((m) => data.messages.some((msg) => msg.matchId === m.id && msg.senderId === m.candidateId)).length;
  const responseRate = inConversation ? Math.round((replied / inConversation) * 100) : 0;
  const avgScore = totalMatches ? Math.round(data.matches.reduce((sum, m) => sum + (m.candidate?.match?.score ?? 80), 0) / totalMatches) : 0;
  const interviewing = data.matches.filter((m) => m.stage === 'Interview' || m.stage === 'Offer').length;
  return <div className="page"><div className="page-title"><div><span className="overline">Talent intelligence</span><h1>Hiring insights</h1><p>Signals that help your team improve quality, speed, and candidate experience.</p></div><button className="ghost-button">All time <ChevronDown size={15} /></button></div><div className="analytics-grid"><Metric label="Mutual matches" value={String(totalMatches)} change="live" /><Metric label="In conversation" value={String(inConversation)} change={`${totalMatches ? Math.round((inConversation / totalMatches) * 100) : 0}% of matches`} /><Metric label="Candidate response" value={`${responseRate}%`} change={`${replied}/${inConversation} replied`} /><Metric label="Interviewing +" value={String(interviewing)} change="Interview & offer" /></div><div className="chart-grid"><section className="chart-card wide"><header><div><strong>Matching funnel</strong><p>From recommendation to qualified conversation</p></div><button><MoreHorizontal /></button></header><div className="bar-chart">{[62, 78, 49, 86, 72, 94, 81, 68, 90, 76, 88, 96].map((height, i) => <div key={i}><i style={{ height: `${height}%` }} /><span>{i % 2 === 0 ? ['Jul 1', '5', '9', '13', '17', '21'][i / 2] : ''}</span></div>)}</div></section><section className="chart-card"><header><div><strong>Match quality</strong><p>Recommended candidates</p></div></header><div className="donut"><div><strong>{avgScore || 86}</strong><span>avg. score</span></div></div><div className="legend"><span><i className="excellent" />Excellent <b>54%</b></span><span><i className="good" />Good <b>32%</b></span><span><i className="fair" />Developing <b>14%</b></span></div></section></div><section className="insight-callout"><div><Sparkles /></div><section><span>Opportunity insight</span><h3>Add “Design systems” to the role’s must-have skills.</h3><p>High-performing matches mention it 2.4× more often, and your strongest current candidates all have verified experience.</p></section><button className="secondary-button">Review suggestion</button></section></div>; }

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function Metric({ label, value, change }: { label: string; value: string; change: string }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{change}</small></article>; }
function LoadingState() { return <div className="loading-state"><div className="loading-mark brand-heart-mark" /><p>Building your best matches…</p></div>; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="error-state"><div><Activity /></div><h2>We couldn’t load your workspace</h2><p>{message}</p><button className="primary-button" onClick={retry}>Try again</button></div>; }
function EmptyState({ title }: { title: string }) { return <div className="empty-state"><Inbox /><h3>{title}</h3></div>; }
function Brand() { return <div className="brand"><span className="brand-heart-mark" aria-hidden="true" /><span className="brand-wordmark"><b>Jobs</b><b>Match</b><b>Now</b></span></div>; }
