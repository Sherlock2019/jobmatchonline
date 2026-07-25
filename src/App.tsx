import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { PhoneMockup } from './components/PhoneMockup';
import { DemoBadge } from './components/DemoBadge';
import { InviteFriendModal } from './components/InviteFriendModal';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { Activity, ArrowLeft, ArrowRight, BadgeCheck, BarChart3, Bell, Bookmark as BookmarkIcon, BriefcaseBusiness, Calendar, Check, ChevronDown, CircleHelp, Clock3, Coffee, Command, Compass, Download, ExternalLink, Eye, FileText, Filter, Gift, Handshake, Heart, Inbox, Layers3, Linkedin, Loader2, Lock, LogOut, Mail, Map as MapIcon, MapPin, Menu, MessageCircle, MessageCircleQuestion, MoreHorizontal, RotateCcw, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Star, Target, Trash2, Users, X, Zap } from 'lucide-react';
import { api } from './api';
import { apiBase } from './api';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as NativeApp } from '@capacitor/app';
import { LoginModal, RegisterModal, ResetPasswordModal, SettingsModal } from './components/AuthModals';
import { FeaturesTable, FeedbackSection, JourneyPipeline, LatestShowcase } from './components/LandingSections';
import { CandidateWizard } from './components/profile/CandidateWizard';
import { CandidateProfilePage } from './components/profile/CandidateProfilePage';
import { RecruiterWizard } from './components/profile/RecruiterWizard';
import { RecruiterProfilePage } from './components/profile/RecruiterProfilePage';
import { CandidateCards } from './components/profile/CandidateCards';
import { JobCards } from './components/jobs/JobCards';
import { CandidateHome, CandidateProfileModal, DashboardTitle, EmptyRow, RecruiterHome } from './components/home/MatchHome';
import { NotesBox } from './components/NotesBox';
// Lazy-loaded: pulls in pdf.js only when a resume is actually opened.
const ResumeViewerModal = lazy(() => import('./components/ResumeViewerModal').then((m) => ({ default: m.ResumeViewerModal })));
import { JobEditor } from './components/jobs/JobEditor';
import { JobImportModal } from './components/jobs/JobImportModal';
import { CompanyLogoMark, JobHeaderBadge } from './components/jobs/JobHeaderBadge';
import { GapCoach, JobDetailModal, MatchDetailModal, ScreeningModal } from './components/coach/CoachModals';
import { CandidateStarters, RecruiterStarters } from './components/messages/ConversationStarters';
import { ScheduleCallModal } from './components/messages/ScheduleCallModal';
import { googleCalendarUrl, icsDataUrl, outlookCalendarUrl } from './lib/calendar';
import type { ScreeningAnswer } from './types';
import { comparisonRows } from './content/landingContent';
import { loadSession, saveSession } from './lib/auth';
import type { Bootstrap, Job, JobMatch, Message, Person, Role, ScheduledCall, SessionUser, View } from './types';

// Nav items either open a dedicated view (`view`) or scroll to a section on the
// home dashboard (`anchor`). `short` is the compact label for the mobile bar.
type NavItem = { label: string; short?: string; icon: typeof Compass; view?: View; anchor?: string };
const candidateNav: NavItem[] = [
  { label: 'Home', icon: Compass, view: 'home' },
  { label: 'Job Matches', icon: Heart, anchor: 'td-matches' },
  { label: 'Jobs that like you', short: 'Likes You', icon: Target, anchor: 'td-chasing' },
  { label: 'Jobs You Should Consider', short: 'Swipe', icon: Sparkles, view: 'discover' },
  { label: 'Saved', icon: BookmarkIcon, view: 'saved' },
  { label: 'Conversations', short: 'Chat', icon: MessageCircle, anchor: 'td-conversations' },
  { label: 'Meetings', icon: Calendar, view: 'meetings' },
  { label: 'Reports', icon: BarChart3, view: 'analytics' },
];
const employerNav: NavItem[] = [
  { label: 'Home', icon: Compass, view: 'home' },
  { label: 'My Jobs', icon: BriefcaseBusiness, anchor: 'td-roles' },
  { label: 'Candidates', icon: Users, view: 'discover' },
  { label: 'Saved', icon: BookmarkIcon, view: 'saved' },
  { label: 'Conversations', short: 'Chat', icon: MessageCircle, anchor: 'td-conversations' },
  { label: 'Meetings', icon: Calendar, view: 'meetings' },
  { label: 'Reports', icon: BarChart3, view: 'analytics' },
];

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
  const openLogin = () => setAuthModal('login');
  const openRegister = () => setAuthModal('register');
  const complete = (user: SessionUser) => { setAuthModal(null); onLogin(user); };
  const trustPipeline = [
    { label: 'Steps to hire', classic: 8, jobsmatch: 3, unit: ' steps', color: '#FF3B30' },
    { label: 'Time to hire', classic: 32, jobsmatch: 9, unit: ' days', color: '#FF9500' },
    { label: 'Match-to-interview rate', classic: 18, jobsmatch: 61, unit: '%', color: '#34C759' },
    { label: 'Feedback ratio', classic: 22, jobsmatch: 89, unit: '%', color: '#32ADE6' },
    { label: 'Candidate satisfaction', classic: 58, jobsmatch: 96, unit: '%', color: '#AF52DE' },
    { label: 'Recruiter success rate', classic: 34, jobsmatch: 78, unit: '%', color: '#FF2D55' },
  ];
  const modals = <AnimatePresence>
    {authModal === 'login' && <LoginModal onClose={() => setAuthModal(null)} onComplete={complete} />}
    {authModal === 'register' && <RegisterModal onClose={() => setAuthModal(null)} onComplete={complete} />}
  </AnimatePresence>;

  // One responsive landing for every screen size — mobile gets the same hero,
  // stacked for phone width (no separate mobile layout).
  return <main className="landing">
    <header className="landing-header">
      <nav className="landing-nav"><Brand /></nav>
      <nav className="landing-subnav"><a href="#how">How it works</a><a href="#compare">Why JobsMatchNow</a><a href="#trust">Trust &amp; fairness</a></nav>
    </header>
    {linkedinState && <div className="integration-notice">{linkedinState === 'connected' ? 'LinkedIn connected. Your professional identity is ready to use.' : 'Add LinkedIn app credentials to enable live account connection. The demo remains available.'}<button onClick={() => history.replaceState({}, '', '/')}>×</button></div>}
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={14} /> Find jobs you’ll love — and the people who’ll love the role and your company.</div>
        <h1>Stop chasing jobs and candidates.<br /><span>Let the perfect match chase you.</span></h1>
        <p>Job seekers, let the perfect role find you. Hiring teams, let the right candidates come to you. A connection opens only when both sides choose. Your next dream job — or dream candidate — might be just a few clicks away.</p>
        <div className="location-pitch-app"><MapPin size={18} /><span><small>Geolocation of Opportunities</small><strong>Match nearby. Meet for a cup of coffee in your city.</strong></span></div>
        <div className="hero-actions"><button className="primary-button" onClick={openRegister}>Register free <ArrowRight size={18} /></button><button className="secondary-button" onClick={openLogin}>Log in</button><button className="secondary-button demo-test-button" onClick={openLogin}><Sparkles size={18} /> Test demo matching</button></div>
        <div className="proof-row"><span><Check size={14} /> Explainable fit</span><span><Check size={14} /> Private distance range</span><span><Check size={14} /> Salary up front</span></div>
      </div>
      <div className="hero-visual carousel-side" aria-label="JobsMatchNow product preview">
        <div className="floating-love love-one"><Heart size={16} fill="currentColor" /></div><div className="floating-love love-two"><Sparkles size={14} /></div>
        <PhoneMockup />
      </div>
    </section>
    <section className="logo-strip"><span>Built for the way modern teams hire</span><div><b>northstar</b><b>CANVAS</b><b>relay</b><b>ORBIT</b><b>stride</b></div></section>
    <section className="comparison-section" id="compare">
      <div className="comparison-intro"><div><h2>The Hiring Game Changer</h2></div><div className="comparison-copy"><p>Traditional hiring creates hurdles: endless searching, slow applications, repeated screenings, multiple exchanges, long delays — and too often, silence, no feedback. No sign of due respect.</p><p>JobsMatchNow removes the friction and creates Respect, Mutual Alignment, and a Clear, Fast Decision Cycle with Feedback.</p><p>Everything candidates and hiring teams need — from first discovery and mutual interest to a qualified conversation — is brought together in one simple, respectful, and intelligent experience.</p><p className="comparison-tagline">Less chasing. Fewer hurdles. Faster, better hires with feedback — more personalized, respectful hires with a human touch.</p></div></div>
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead><tr><th>Experience</th><th><span className="old-dot" />Traditional hiring</th><th><span className="new-dot" />JobsMatchNow</th><th>What changes</th></tr></thead>
          <tbody>{comparisonRows.map((row) => <tr key={row.feature}><th scope="row">{row.feature}</th><td data-label="Traditional hiring"><X size={15} />{row.traditional}</td><td data-label="JobsMatchNow"><Check size={15} />{row.jobmatch}</td><td data-label="What changes"><span>{row.impact}</span></td></tr>)}</tbody>
        </table>
      </div>
      <div className="comparison-cta"><div><Sparkles size={19} /><span><strong>See the difference yourself.</strong> Switch between candidate and recruiter views in the live product.</span></div><button className="primary-button" onClick={openLogin}>Explore every feature <ArrowRight size={17} /></button></div>
    </section>
    <FeaturesTable />
    <JourneyPipeline />
    <section className="value-section" id="how"><div className="section-heading centered"><span className="eyebrow"><Sparkles size={14} /> A better signal</span><h2>Hiring works better when<br />both sides choose.</h2></div><div className="value-grid"><Feature icon={BarChart3} title="Fit, explained" text="Go beyond keywords with transparent skill, experience, and preference signals." /><Feature icon={Handshake} title="Intent, confirmed" text="A conversation opens only after both sides express interest. No cold outreach." /><Feature icon={MapIcon} title="Geolocation of Opportunities" text="Choose a city and private distance range, then meet for coffee only when both sides agree." /><Feature icon={ShieldCheck} title="People, respected" text="Salary and work style are clear up front. Candidate controls stay at the center." /></div></section>
    <section className="trust-section" id="trust"><div className="trust-copy"><span className="section-kicker light">Better Results</span><h2>More, better, faster hiring — with human mutual job matching.</h2><p>Every recommendation carries its reason. Every connection starts with consent. Every candidate gets control over what employers can see.</p><button className="white-button" onClick={openLogin}>Open recruiter workspace <ArrowRight size={17} /></button></div><div className="gauge-grid">
      <Gauge pct={72} color="#0A84FF" value="9 days" label="Time to hire" />
      <Gauge pct={76} color="#32ADE6" value="11 days" label="Time to find a role" />
      <Gauge pct={46} color="#34C759" value="46%" label="Match-to-hire conversion" />
      <Gauge pct={94} color="#FF10F0" value="94%" label="Candidate satisfaction rate" />
      <Gauge pct={89} color="#AF52DE" value="89%" label="Recruiter satisfaction rate" />
      <Gauge pct={92} color="#FF9500" value="92%" label="Would recommend JobsMatchNow" />
      <small>Illustrative product targets for the demo experience.</small>
    </div><div className="trust-pipeline"><h3>Classic Hiring vs. New JobsMatchNow Process</h3><p>How the hiring pipeline itself compares, step for step.</p><div className="pipeline-rows">{trustPipeline.map((row) => { const max = Math.max(row.classic, row.jobsmatch) || 1; const deltaPct = row.classic ? Math.round(Math.abs(row.jobsmatch - row.classic) / row.classic * 100) : 0; return <div className="pipeline-row" key={row.label}><span className="pipeline-row-label">{row.label}</span><div className="pipeline-bar-track classic"><i style={{ width: `${(row.classic / max) * 100}%` }} /><b>{row.classic}{row.unit}</b></div><div className="pipeline-bar-track jobsmatch"><i style={{ width: `${(row.jobsmatch / max) * 100}%`, background: row.color }} /><b>{row.jobsmatch}{row.unit}</b></div><span className="pipeline-delta" style={{ color: row.color }}>{deltaPct}% better</span></div>; })}<div className="pipeline-legend"><span><i className="classic" /> Classic hiring</span><span><i className="jobsmatch" /> JobsMatchNow</span></div><div className="pipeline-popularity"><Star size={16} fill="currentColor" /><div><strong>4.8/5 popularity</strong><span>Average candidate rating from verified reviews, powered by our built-in recommendation &amp; review feature.</span></div></div></div></div></section>
    <LatestShowcase onRegister={openRegister} onLogin={openLogin} />
    <FeedbackSection />
    <footer><Brand /><span>Perfect matches should feel human.</span><small>© 2026 JobsMatchNow</small></footer>
    {modals}
  </main>;
}

function Feature({ icon: Icon, title, text }: { icon: typeof Target; title: string; text: string }) {
  return <article><div className="feature-icon"><Icon size={32} /></div><h3>{title}</h3><p>{text}</p></article>;
}

function Gauge({ pct, color, value, label }: { pct: number; color: string; value: string; label: string }) {
  const deg = Math.max(0, Math.min(100, pct)) * 3.6;
  return <div className="gauge-tile">
    <div className="gauge-ring" style={{ background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,.12) ${deg}deg 360deg)` }}>
      <div className="gauge-inner"><strong style={{ color }}>{value}</strong></div>
    </div>
    <span>{label}</span>
  </div>;
}

function Workspace({ session, onSwitchUser, onExit }: { session: SessionUser; onSwitchUser: (user: SessionUser) => void; onExit: () => void }) {
  const [view, setView] = useState<View>('home');
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [editStep, setEditStep] = useState<number | null>(null);
  const [profileCard, setProfileCard] = useState(0);
  const [profileSaved, setProfileSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [jobImportOpen, setJobImportOpen] = useState(false);
  const [manualJobRequest, setManualJobRequest] = useState(0);
  const [activeAnchor, setActiveAnchor] = useState('');
  const [openMatchId, setOpenMatchId] = useState<string | undefined>(undefined);
  const openMessages = (matchId: string) => { setOpenMatchId(matchId); setView('messages'); };
  const [editJobId, setEditJobId] = useState<string | undefined>(undefined);
  const openJobEditor = (jobId: string) => { setEditJobId(jobId); setView('jobs'); };
  const role: Role = data?.viewer.role ?? session.role;
  const notifications = useMemo(() => {
    if (!data) return [] as { id: string; kind: 'match' | 'msg'; text: string; at: number; matchId: string }[];
    const list: { id: string; kind: 'match' | 'msg'; text: string; at: number; matchId: string }[] = [];
    for (const m of data.matches) {
      const who = role === 'candidate' ? (m.job?.company || 'A team') : (m.candidate?.name || 'A candidate');
      list.push({ id: `match-${m.id}`, kind: 'match', text: `It’s a match with ${who}`, at: m.createdAt, matchId: m.id });
      const thread = data.messages.filter((msg) => msg.matchId === m.id);
      const last = thread[thread.length - 1];
      if (last && last.senderId !== data.viewer.id) list.push({ id: `msg-${last.id}`, kind: 'msg', text: `New message from ${who}`, at: last.createdAt, matchId: m.id });
    }
    return list.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [data, role]);

  const load = () => { setLoading(true); setError(''); api.bootstrap(session.id).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, [session.id]);
  // Demo convenience: jump between the flagship candidate and recruiter personas.
  const changeRole = (next: Role) => { api.login(`${next}-demo`).then(({ user }) => onSwitchUser(user)); };
  const nav = role === 'candidate' ? candidateNav : employerNav;
  // Anchor items scroll to a home-dashboard section; view items open a page.
  const gotoNav = (item: NavItem) => {
    setMobileNav(false);
    if (item.anchor) {
      const wasHome = view === 'home';
      setView('home');
      setActiveAnchor(item.anchor);
      const anchor = item.anchor;
      setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), wasHome ? 0 : 160);
    } else {
      setActiveAnchor('');
      if (item.view) setView(item.view);
    }
  };
  const navActive = (item: NavItem) => item.anchor
    ? view === 'home' && activeAnchor === item.anchor
    : view === item.view && !(item.view === 'home' && activeAnchor);
  const initials = (session.name || '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return <div className={`app-shell role-${role}`}>
    <aside className={mobileNav ? 'sidebar open' : 'sidebar'}><div className="sidebar-head"><Brand /><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X /></button></div>
      <div className="workspace-switch"><span>Profile</span><button onClick={() => { setView('profile'); setMobileNav(false); }}>{data?.viewer.photo ? <img className="avatar-mini" src={data.viewer.photo} alt="" /> : <div className="avatar-mini">{initials}</div>}<div><strong>{data?.viewer.name || session.name}</strong><small>{role === 'candidate' ? 'Candidate' : 'Recruiter'}</small></div><ArrowRight size={15} /></button></div>
      <nav className="sidebar-nav">{nav.map((item) => { const Icon = item.icon; return <button key={item.label} className={navActive(item) ? 'active' : ''} onClick={() => gotoNav(item)}><Icon size={19} /><span>{item.label}</span>{item.anchor === 'td-conversations' && notifications.length > 0 && <em>{Math.min(notifications.length, 9)}</em>}</button>; })}</nav>
      <button className="sidebar-invite-btn" onClick={() => setInviteOpen(true)}><Gift size={17} /> Invite a Friend to Join Us — Bonus!</button>
      <div className="sidebar-bottom"><button onClick={() => { window.location.href = 'mailto:support@jobsmatchnow.com'; }}><CircleHelp size={18} />Help center</button><button onClick={() => setSettingsOpen(true)}><Settings size={18} />Settings</button><button className="logout-button" onClick={onExit}><LogOut size={18} />Log out</button></div>
    </aside>
    {inviteOpen && data && <InviteFriendModal userId={data.viewer.id} onClose={() => setInviteOpen(false)} />}
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <section className="app-main">{session.emailVerified === false && <div className="verify-banner"><span><ShieldCheck size={15} /> Verify your email to secure your account and unlock everything.</span><button onClick={() => setSettingsOpen(true)}>Verify now</button></div>}<header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}><Menu /></button><div className="search-box"><Search size={17} /><input aria-label="Search" placeholder={role === 'candidate' ? 'Search jobs, companies, skills…' : 'Search talent, jobs, messages…'} onKeyDown={(event) => { if (event.key === 'Enter') setView('discover'); }} /><kbd><Command size={12} /> K</kbd></div><div className="topbar-actions"><div className="notif-wrap"><button aria-label="Notifications" onClick={() => setNotifOpen((v) => !v)}><Bell size={19} />{notifications.length > 0 && <i />}</button>{notifOpen && <><button className="notif-scrim" aria-label="Close notifications" onClick={() => setNotifOpen(false)} /><div className="notif-dropdown"><header>Notifications</header>{notifications.length === 0 ? <p className="notif-empty">No notifications yet.</p> : notifications.map((n) => <button key={n.id} className="notif-item" onClick={() => { setNotifOpen(false); openMessages(n.matchId); }}><span className={`notif-icon ${n.kind}`}>{n.kind === 'match' ? <Heart size={14} fill="currentColor" /> : <MessageCircle size={14} />}</span><span className="notif-text">{n.text}<small>{timeAgo(n.at)}</small></span></button>)}</div></>}</div>{data?.viewer.demo && <button className="role-chip" onClick={() => changeRole(role === 'candidate' ? 'employer' : 'candidate')}>{role === 'candidate' ? 'Candidate view' : 'Recruiter view'}<ChevronDown size={14} /></button>}</div></header>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={load} /> : data && (
        (data.viewer.onboarding || editStep !== null)
          ? (data.viewer.role === 'candidate'
              ? <CandidateWizard viewer={data.viewer} initialStep={editStep ?? 0}
                  onDone={() => { setEditStep(null); setView('profile'); setProfileSaved(true); window.setTimeout(() => setProfileSaved(false), 2600); load(); }}
                  onCancel={data.viewer.onboarding ? undefined : () => setEditStep(null)} />
              : <RecruiterWizard viewer={data.viewer} initialStep={editStep ?? 0}
                  onDone={() => { setEditStep(null); setView('profile'); setProfileSaved(true); window.setTimeout(() => setProfileSaved(false), 2600); load(); }}
                  onCancel={data.viewer.onboarding ? undefined : () => setEditStep(null)} />)
          : <ViewRouter view={view} role={role} data={data} setData={setData} navigate={setView} onEditProfile={setEditStep} profileCard={profileCard} onProfileCardChange={setProfileCard} reload={load} onAddJobs={() => setJobImportOpen(true)} manualJobRequest={manualJobRequest} openMatchId={openMatchId} onOpenMessages={openMessages} editJobId={editJobId} onEditJob={openJobEditor} />
      )}
    </section>
    {profileSaved && <div className="profile-saved-toast" role="status"><Check size={15} /> Profile updated. Recruiter view refreshed.</div>}
    {jobImportOpen && data && <JobImportModal viewer={data.viewer} onClose={() => setJobImportOpen(false)} onImported={() => { setJobImportOpen(false); setView('jobs'); load(); }} onManual={() => { setJobImportOpen(false); setView('jobs'); setManualJobRequest((value) => value + 1); }} />}
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">{nav.slice(0, 5).map((item) => { const Icon = item.icon; return <button key={item.label} className={navActive(item) ? 'active' : ''} onClick={() => gotoNav(item)}><Icon size={19} /><span>{item.short || item.label}</span></button>; })}</nav>
    <AnimatePresence>{settingsOpen && <SettingsModal user={session} onClose={() => setSettingsOpen(false)} onDeleted={() => { setSettingsOpen(false); onExit(); }} />}</AnimatePresence>
  </div>;
}

function ViewRouter({ view, role, data, setData, navigate, onEditProfile, profileCard, onProfileCardChange, reload, onAddJobs, manualJobRequest, openMatchId, onOpenMessages, editJobId, onEditJob }: { view: View; role: Role; data: Bootstrap; setData: (d: Bootstrap) => void; navigate: (v: View) => void; onEditProfile: (step: number) => void; profileCard: number; onProfileCardChange: (card: number) => void; reload: () => void; onAddJobs: () => void; manualJobRequest: number; openMatchId?: string; onOpenMessages: (matchId: string) => void; editJobId?: string; onEditJob: (jobId: string) => void }) {
  if (view === 'home') return role === 'candidate'
    ? <CandidateHome key={data.viewer.activeVariantId || 'base'} data={data} setData={setData} navigate={navigate} onEditProfile={onEditProfile} />
    : <RecruiterHome data={data} setData={setData} navigate={navigate} onEditProfile={onEditProfile} onAddJobs={onAddJobs} onOpenMessages={onOpenMessages} onEditJob={onEditJob} />;
  if (view === 'discover') return <Discover role={role} data={data} setData={setData} navigate={navigate} onEditProfile={onEditProfile} />;
  if (view === 'companies') return <Companies data={data} navigate={navigate} />;
  if (view === 'pipeline') return <Pipeline data={data} setData={setData} />;
  if (view === 'messages') return <Messages role={role} data={data} setData={setData} initialMatchId={openMatchId} />;
  if (view === 'meetings') return <Meetings role={role} data={data} setData={setData} onOpenMessages={onOpenMessages} />;
  if (view === 'saved') return <Saved role={role} data={data} setData={setData} navigate={navigate} />;
  if (view === 'analytics') return <Analytics role={role} data={data} />;
  if (view === 'jobs') return <Jobs data={data} reload={reload} onAddJobs={onAddJobs} manualJobRequest={manualJobRequest} onOpenMessages={onOpenMessages} editJobId={editJobId} />;
  if (view === 'matches') return <Matches data={data} navigate={navigate} onOpenMessages={onOpenMessages} />;
  if (role === 'candidate') return <CandidateProfilePage
    viewer={data.viewer} jobs={data.jobs} onEdit={onEditProfile} initialCard={profileCard} onCardChange={onProfileCardChange}
    onDeleteProfile={data.viewer.activeVariantId ? async () => { await api.deleteProfileVariant(data.viewer.activeVariantId!, data.viewer.id); reload(); navigate('home'); } : undefined}
  />;
  return <RecruiterProfilePage viewer={data.viewer} onEdit={onEditProfile} />;
}

/** Item 18: pre-swipe readiness checklist for candidates, with fix links into the wizard. */
function ReadyChecklist({ viewer, onEditProfile }: { viewer: Person; onEditProfile: (step: number) => void }) {
  const items = [
    { label: 'Resume uploaded', done: Boolean(viewer.documents?.resume), step: 1 },
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
  // Recruiters only see candidates worth considering by default — 80%+ fit.
  const [minScore, setMinScore] = useState(role === 'employer' ? 80 : 0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const scoreOptions = role === 'employer' ? [0, 50, 70, 80] : [0, 50, 70, 85];
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
  const [asking, setAsking] = useState(false);
  const toggleBookmark = async (target: Job | Person) => {
    const targetType = role === 'candidate' ? 'job' : 'candidate';
    const { bookmarked } = await api.toggleBookmark({ userId: data.viewer.id, targetId: target.id, targetType });
    setData({ ...data, bookmarkedIds: bookmarked ? [...data.bookmarkedIds, target.id] : data.bookmarkedIds.filter((id) => id !== target.id) });
  };
  const askThenLike = (text: string) => {
    if (!current) return;
    setAsking(false);
    void commitSwipe('like', current, { answers: [{ question: 'A quick question before we match', answer: text }] });
  };

  return <div className="page discover-page"><div className="page-title"><div><span className="overline">{role === 'candidate' ? 'For Candidates' : 'For Recruiters'}</span><h1>{role === 'candidate' ? 'Jobs You Should Consider' : 'Candidates to be considered'}</h1><p>{role === 'candidate' ? 'Swipe roles that fit you — like to signal interest.' : 'Find the perfect talent for your team.'}</p></div>
    <div className="preference-chip"><small>{role === 'candidate' ? 'Your preferences' : "You're hiring for"}</small><strong>{role === 'candidate' ? [data.viewer.preferences?.desiredRoles?.[0], data.viewer.preferences?.workMode?.mode].filter(Boolean).join(' · ') || 'Any role' : data.jobs.find((j) => j.employerId === data.viewer.id)?.title || 'Open roles'}</strong><button onClick={() => role === 'candidate' ? onEditProfile(2) : navigate('jobs')} aria-label="Edit preferences"><ChevronDown size={13} style={{ transform: 'rotate(-90deg)' }} /></button></div>
    <div className="title-actions"><button className={filtersOpen ? 'ghost-button active' : 'ghost-button'} onClick={() => setFiltersOpen((v) => !v)}><SlidersHorizontal size={17} />Filters{filtersActive && <span>{[query.trim(), filterMode, filterType, minScore > 0].filter(Boolean).length}</span>}</button></div></div>
    {role === 'candidate' && <ReadyChecklist viewer={data.viewer} onEditProfile={onEditProfile} />}
    <div className="discover-search"><div className="ds-input"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={role === 'candidate' ? 'Search roles, companies, skills…' : 'Search talent by name, title, skills…'} aria-label="Search" />{query && <button className="ds-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</div></div>
    {filtersOpen && <div className="discover-filters">
      <div className="df-group"><label>Minimum fit</label><div className="df-scores">{scoreOptions.map((s) => <button key={s} className={minScore === s ? 'active' : ''} onClick={() => setMinScore(s)}>{s === 0 ? 'Any' : `${s}%+`}</button>)}</div></div>
      {role === 'candidate' && <>
        <div className="df-group"><label>Work mode</label><div className="df-chips">{['Remote', 'Hybrid', 'On-site', 'Flexible'].map((m) => <button key={m} className={filterMode === m ? 'active' : ''} onClick={() => setFilterMode(filterMode === m ? '' : m)}>{m}</button>)}</div></div>
        <div className="df-group"><label>Type</label><div className="df-chips">{['Full-time', 'Part-time', 'Contract', 'Freelance'].map((t) => <button key={t} className={filterType === t ? 'active' : ''} onClick={() => setFilterType(filterType === t ? '' : t)}>{t}</button>)}</div></div>
      </>}
      {filtersActive && <button className="df-clear" onClick={() => { setQuery(''); setFilterMode(''); setFilterType(''); setMinScore(0); }}>Clear all</button>}
    </div>}
    <section className="geo-control" aria-label="Geolocation of Opportunities"><div><MapPin size={18} /><span><small>Geolocation of Opportunities</small><strong>{role === 'candidate' ? 'Roles' : 'Candidates'} within {radius} km</strong></span></div><input aria-label="Maximum match distance in kilometres" type="range" min="5" max="100" step="5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /><p>City-level matching only. Exact locations stay private.</p></section>
    <div className="discover-layout"><section className="deck-area">
      <div className="deck-progress-row">
        <div className="deck-progress" role="progressbar" aria-valuenow={Math.min(index + 1, deck.length)} aria-valuemin={1} aria-valuemax={deck.length || 1}><i style={{ width: deck.length ? `${(Math.min(index + 1, deck.length) / deck.length) * 100}%` : '0%' }} /></div>
        <small>{Math.min(index + 1, deck.length)} / {deck.length}</small>
        <button className="undo-action" onClick={undo} disabled={busy || index === 0} aria-label="Undo last swipe" title="Rewind last swipe"><RotateCcw size={15} /></button>
      </div>
      <div className="card-stack">{next && <div className="stack-card"><CardSummary item={next} role={role} /></div>}{current ? <SwipeCard key={current.id} item={current} role={role} resumeUnlocked={role === 'employer' && matchedCandidateIds.has(current.id)} /> : <EmptyDeck role={role} onReset={() => setIndex(0)} />}</div>
      {current && <div className="action-row five"><button onClick={() => act('pass')} disabled={busy} className="pass-action" aria-label="Pass"><X /></button><button onClick={() => act('like', true)} disabled={busy} className="superlike-action" aria-label="Super Like" title="Super Like — a stronger signal"><Star fill="currentColor" /></button><button onClick={() => setAsking(true)} disabled={busy} className="ask-action" aria-label="Ask" title="Ask a quick question"><MessageCircleQuestion /></button><button onClick={() => toggleBookmark(current)} disabled={busy} className={data.bookmarkedIds.includes(current.id) ? 'save-action active' : 'save-action'} aria-label="Save for later" title="Save for later"><BookmarkIcon fill={data.bookmarkedIds.includes(current.id) ? 'currentColor' : 'none'} /></button><button onClick={() => act('like')} disabled={busy} className="like-action" aria-label="Like"><Heart fill="currentColor" /></button></div>}
      <div className="keyboard-hint"><span><kbd>←</kbd> Pass</span><span>Swipe left or right</span><span><kbd>→</kbd> Like</span></div>
    </section><aside className="insight-panel"><div className="daily-card"><div><span>Today’s activity</span><strong>{data.likesRemaining}</strong><small>likes remaining</small></div><div className="ring" style={{ '--progress': `${data.likesRemaining * 2}%` } as React.CSSProperties}><Heart size={18} /></div></div><div className="tip-card"><div className="tip-icon"><Zap size={17} /></div><strong>{role === 'candidate' ? 'Complete your preferences' : 'Calibrate your search'}</strong><p>{role === 'candidate' ? 'Add your preferred team size to improve recommendations by up to 18%.' : 'Review five profiles to help JobsMatchNow learn what great looks like for this role.'}</p><button>{role === 'candidate' ? 'Update preferences' : 'View calibration'} <ArrowRight size={14} /></button></div><div className="quality-card"><div className="quality-head"><span>Match quality</span><strong>Excellent</strong></div><div className="quality-bar"><i /></div><p>Your recommendations use 12 verified profile signals.</p></div></aside></div>
    <AnimatePresence>{match && <MatchModal match={match} viewer={data.viewer} onClose={() => setMatch(null)} onMessage={() => { setMatch(null); navigate('messages'); }} />}</AnimatePresence>
    <AnimatePresence>{resumeFor && <Suspense fallback={null}><ResumeViewerModal person={resumeFor} viewerId={data.viewer.id} onClose={() => setResumeFor(null)} /></Suspense>}</AnimatePresence>
    <AnimatePresence>{jobDetail && <JobDetailModal job={jobDetail} onClose={() => setJobDetail(null)} />}</AnimatePresence>
    <AnimatePresence>{screeningFor && <ScreeningModal job={screeningFor} onCancel={() => setScreeningFor(null)} onSubmit={(answers) => { const target = screeningFor; setScreeningFor(null); void commitSwipe('like', target, { answers }); }} />}</AnimatePresence>
    <AnimatePresence>{asking && current && <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAsking(false)}>
      <motion.div className="ask-modal" initial={{ y: 20, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: .97 }} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setAsking(false)} aria-label="Close"><X /></button>
        <h3>Ask a quick question</h3>
        <p>Picking one sends a like along with your question — it'll show up if you match.</p>
        {role === 'employer' ? <RecruiterStarters candidateName={(current as Person).name} archetype={(current as Person).aboutMeArchetype} onPick={askThenLike} /> : <CandidateStarters onPick={askThenLike} />}
      </motion.div>
    </motion.div>}</AnimatePresence></div>;
}

function SwipeCard({ item, role, resumeUnlocked }: { item: Job | Person; role: Role; resumeUnlocked?: boolean }) {
  // Both sides show the same 5-card deck for the item being reviewed — recruiters
  // browse the candidate's deck, candidates browse the role's deck (Snapshot /
  // Requirements / Compensation / Team & culture / Reviews). Like / Pass / Super
  // Like / Ask / Save all happen via the action buttons below the deck.
  if (role === 'employer') return <motion.article className="swipe-card canonical-candidate-card">
    <CandidateCards person={item as Person} match={item.match} unlocked={resumeUnlocked} />
  </motion.article>;
  return <motion.article className="swipe-card canonical-job-card">
    <JobCards job={item as Job} />
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

/** Age from an ISO birthdate, or undefined — pre-match privacy rule (public or explicitly disclosed only). */
function ageFrom(person: Person): number | undefined {
  if (!person.birthdate || (person.agePrivacy !== 'public' && !person.discloseAge)) return undefined;
  const born = new Date(person.birthdate);
  if (Number.isNaN(born.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
  return age >= 14 && age <= 100 ? age : undefined;
}

function BookmarkButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return <button type="button" className={active ? 'bookmark-toggle active' : 'bookmark-toggle'} onPointerDownCapture={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label={active ? 'Remove from saved' : 'Save for later'} aria-pressed={active}>
    <BookmarkIcon size={15} fill={active ? 'currentColor' : 'none'} />
  </button>;
}

function CardSummary({ item, role, detailed = false, onOpenResume, resumeUnlocked = false, onOpenJob, gapViewer, onSkillAdded, bookmarked, onToggleBookmark }: { item: Job | Person; role: Role; detailed?: boolean; onOpenResume?: (person: Person) => void; resumeUnlocked?: boolean; onOpenJob?: (job: Job) => void; gapViewer?: Person; onSkillAdded?: () => void; bookmarked?: boolean; onToggleBookmark?: () => void }) {
  if (role === 'candidate') {
    const job = item as Job;
    const missing = job.match?.missingSkills?.length ?? 0;
    const matched = job.match?.matchedSkills?.length ?? 0;
    const topSkills = job.requiredSkills.slice(0, 4);
    const moreSkills = job.requiredSkills.length - topSkills.length;
    return <>
      <JobHeaderBadge job={job} className="swipe-job-header" actions={<>{onToggleBookmark && <BookmarkButton active={Boolean(bookmarked)} onToggle={onToggleBookmark} />}{job.demo && <span className="demo-badge">Demo</span>}</>} />
      <div className="card-body">
        <div className="job-meta"><span><BriefcaseBusiness size={15} />{job.type}</span>{job.salaryHidden ? <SalaryBadge status={job.match?.salaryStatus} /> : <span>{job.salary}</span>}{job.status?.toLowerCase() === 'active' && <span className="hiring-pill"><i />Actively hiring</span>}</div>
        <div className="job-meta soft"><span>{job.experienceLevel} exp</span>{job.responseTime && <span>{job.responseTime} response</span>}</div>
        {detailed && <>
          <div className="card-quote"><Sparkles size={15} /><div><span className="card-label">About the role</span><p>{job.description}</p></div></div>
          <span className="card-label">Top skills</span>
          <div className="skill-list">{topSkills.map((skill) => <span key={skill}>{skill}</span>)}{moreSkills > 0 && <span className="skill-more">+{moreSkills}</span>}</div>
          {job.benefits?.length ? <><span className="card-label">Why you might love this</span><div className="skill-list soft">{job.benefits.slice(0, 4).map((b) => <span key={b}>{b}</span>)}</div></> : null}
          <div className="match-count-line">{matched} matching skill{matched === 1 ? '' : 's'}{missing > 0 ? ` · ${missing} missing` : ''}</div>
          {gapViewer && onSkillAdded && <GapCoach job={job} viewer={gapViewer} onSkillAdded={onSkillAdded} />}
          <div className="card-foot"><div><strong>{job.mission}</strong><small>{job.culture.join(' · ')}</small></div><button onPointerDownCapture={(event) => event.stopPropagation()} onClick={() => onOpenJob?.(job)}>Full role <ArrowRight size={14} /></button></div>
        </>}
      </div>
    </>;
  }
  const person = item as Person;
  const age = ageFrom(person);
  const languages = person.languageDetail?.length ? person.languageDetail : (person.languages || []).map((name) => ({ name, level: '' }));
  const topSkills = person.skills.slice(0, 4);
  const moreSkills = person.skills.length - topSkills.length;
  const matched = person.match?.matchedSkills?.length ?? 0;
  const missing = person.match?.missingSkills?.length ?? 0;
  const salary = person.preferences?.salary;
  const wm = person.preferences?.workMode;
  return <>
    <div className="card-hero" style={{ backgroundImage: `linear-gradient(transparent 38%, rgba(0,0,0,.82)), url(${person.photo})` }}>
      <div className="card-hero-top"><div className="fit-badge"><span>{person.match?.score}%</span> match</div>{onToggleBookmark && <BookmarkButton active={Boolean(bookmarked)} onToggle={onToggleBookmark} />}</div>
      <div className="card-hero-overlay">
        {person.availability && <span className="avail-pill"><i />Available {person.availability}</span>}
        <h2>{person.name}{age !== undefined && <span className="card-age">{age}</span>}{person.verified && <BadgeCheck size={18} className="verified-mark" />}{person.demo && <span className="demo-badge">Demo</span>}</h2>
        <p className="card-hero-sub">{person.title}</p>
        <div className="card-hero-meta"><span><MapPin size={14} />{person.location}</span>{person.distanceKm !== undefined && <span className="distance-badge">{person.distanceKm} km away</span>}</div>
        {languages.length > 0 && <div className="card-hero-langs">{languages.map((l) => <span key={l.name}>{l.name}{l.level ? ` (${l.level})` : ''}</span>)}</div>}
      </div>
    </div>
    <div className="card-body">
      <div className="skill-list">{topSkills.map((skill) => <span key={skill}>{skill}</span>)}{moreSkills > 0 && <span className="skill-more">+{moreSkills}</span>}</div>
      {person.presentation && <div className="card-quote"><Heart size={15} /><div><span className="card-label">About {person.name.split(' ')[0]}</span><p>{person.presentation}</p></div></div>}
      <div className="stat-grid">
        {person.yearsExperience !== undefined && <div><small>Exp</small><strong>{person.yearsExperience}+ years</strong></div>}
        {salary?.min !== undefined && !person.salaryHidden && <div><small>Salary</small><strong>{salary.min.toLocaleString()}–{salary.max?.toLocaleString()} {salary.currency}</strong></div>}
        {wm?.mode && <div><small>Work mode</small><strong>{wm.mode === 'hybrid' ? `Hybrid · ${wm.hybridDays ?? 2}d` : wm.mode === 'onsite' ? 'On-site' : 'Remote'}</strong></div>}
        {person.distanceRangeKm !== undefined && <div><small>Commute</small><strong>&lt; {person.distanceRangeKm} km</strong></div>}
      </div>
      {detailed && <>
        {(matched > 0 || missing > 0) && <div className="match-count-line">{matched} matching skill{matched === 1 ? '' : 's'}{missing > 0 ? ` · ${missing} missing` : ''}</div>}
        {onOpenResume && <ResumeChip person={person} unlocked={resumeUnlocked} onOpen={onOpenResume} />}
      </>}
    </div>
  </>;
}

function EmptyDeck({ role, onReset }: { role: Role; onReset: () => void }) {
  if (role === 'candidate') return <div className="empty-deck"><div><Check /></div><h2>That’s your Top 3 for today</h2><p>Quality over volume: a fresh, curated batch of matches lands tomorrow.</p><button className="primary-button" onClick={onReset}><RotateCcw size={16} />Review again (demo)</button></div>;
  return <div className="empty-deck"><div><Check /></div><h2>You’re all caught up</h2><p>We’ll bring you fresh recommendations as soon as the fit is strong enough.</p><button className="primary-button" onClick={onReset}><RotateCcw size={16} />Review again</button></div>;
}

function MatchModal({ match, viewer, onClose, onMessage }: { match: JobMatch; viewer: Person; onClose: () => void; onMessage: () => void }) {
  const counterpart = viewer.role === 'candidate' ? (match.employer?.name || match.job?.company || 'The team') : (match.candidate?.name || 'The candidate');
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
  const candidateName = match.candidate?.name || viewer.name;
  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Confetti /><motion.div className="match-modal" initial={{ y: 30, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: .96 }}><button className="modal-close on-dark" onClick={onClose}><X /></button>
    <div className="match-hero">
      <div className="match-script">It&rsquo;s a Match!</div>
      <p className="match-sub">You and {counterpart.split(' ')[0]} have mutually matched.</p>
      <div className="match-faces">
        <div className="match-face"><img src={match.candidate?.photo || viewer.photo} alt="" /><strong>{candidateName}</strong><span>{match.candidate?.title || viewer.title}</span></div>
        <span className="match-heart-mid"><Heart size={20} fill="currentColor" /></span>
        <div className="match-face">
          {match.employer?.photo ? <img src={match.employer.photo} alt="" /> : match.job ? <CompanyLogoMark job={match.job} /> : <div className="match-face-logo"><BriefcaseBusiness /></div>}
          <strong>{match.employer?.name || match.job?.company || counterpart}</strong>
          {match.employer && match.job ? <div className="match-badge job-match-badge"><CompanyLogoMark job={match.job} small /><span>{match.employer.title || `Recruiter at ${match.job.company}`}</span></div> : match.job?.title && <span>{match.job.title}</span>}
          {match.employer && <em className="match-tag"><b>Role</b> &middot; Recruiter</em>}
        </div>
      </div>
    </div>
    <div className="match-body">
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
      <button className="primary-button" onClick={onMessage}><MessageCircle size={17} />Let&rsquo;s Talk</button>
      <button className="secondary-button match-keep-swiping" onClick={onClose}>Keep Swiping</button>
    </div>
  </motion.div></motion.div>;
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

function Messages({ role, data, setData, initialMatchId }: { role: Role; data: Bootstrap; setData: (d: Bootstrap) => void; initialMatchId?: string }) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | undefined>(initialMatchId);
  useEffect(() => { if (initialMatchId) setSelectedMatchId(initialMatchId); }, [initialMatchId]);
  const match = data.matches.find((m) => m.id === selectedMatchId) || data.matches[0];
  const [text, setText] = useState('');
  const thread = data.messages.filter((m) => m.matchId === match?.id);
  // The person on the other side of this chat: for a candidate that's the employer/job, for an employer it's the candidate.
  const otherName = role === 'candidate' ? match?.job?.company : match?.candidate?.name;
  const otherPhoto = role === 'candidate' ? undefined : match?.candidate?.photo;
  const otherEmail = role === 'candidate' ? match?.employer?.email : match?.candidate?.email;
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!text.trim() || !match) return; const message = await api.message({ matchId: match.id, senderId: data.viewer.id, text }); setData({ ...data, messages: [...data.messages, message] }); setText(''); };
  // Auto-open when the thread is empty (nothing to say yet); stays reachable via the header
  // toggle afterward so the same questions double as prep notes before a scheduled call.
  const [showStarters, setShowStarters] = useState(thread.length === 0);
  useEffect(() => { setShowStarters(thread.length === 0); }, [match?.id]);
  const [scheduling, setScheduling] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(false);
  const [schedulingCoffee, setSchedulingCoffee] = useState(false);
  // One click: propose tomorrow at the next half-hour, persist it (shows in
  // this thread + Meetings for both sides), and open a pre-filled Google
  // Calendar quick-add so it lands on the real calendar too.
  const quickCoffee = async () => {
    if (!match || schedulingCoffee) return;
    setSchedulingCoffee(true);
    try {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setSeconds(0, 0);
      if (start.getMinutes() > 30) { start.setHours(start.getHours() + 1); start.setMinutes(0); }
      else if (start.getMinutes() > 0) start.setMinutes(30);
      const title = `Coffee chat${otherName ? ` — ${otherName}` : ''}`;
      const call = await api.scheduleCall({ matchId: match.id, createdBy: data.viewer.id, title, startAt: start.getTime(), durationMinutes: 25 });
      setData({ ...data, calls: [...data.calls, call] });
      window.open(googleCalendarUrl({ title, startAt: call.startAt, durationMinutes: call.durationMinutes }), '_blank', 'noopener');
    } catch (e) { alert(e instanceof Error ? e.message : 'Could not create that invite'); }
    finally { setSchedulingCoffee(false); }
  };
  const calls = data.calls.filter((c) => c.matchId === match?.id).sort((a, b) => a.startAt - b.startAt);
  return <div className="messages-page">
    <aside className="threads">
      <div className="threads-head"><div><span className="overline">Inbox</span><h1>Messages</h1></div><button><Filter size={17} /></button></div>
      <div className="thread-search"><Search size={16} /><input placeholder="Search conversations" /></div>
      {data.matches.map((item) => {
        const label = role === 'candidate' ? item.job?.company : item.candidate?.name;
        return <button className={item.id === match?.id ? 'thread active' : 'thread'} key={item.id} onClick={() => setSelectedMatchId(item.id)}>
          {role === 'candidate' && item.job ? <CompanyLogoMark job={item.job} small /> : <img src={item.candidate?.photo} />}
          <div><div><strong>{label}</strong></div><p>{item.job?.title}</p></div>
        </button>;
      })}
    </aside>
    <section className="conversation">{match ? <>
      <header>{role === 'candidate' && match.job ? <CompanyLogoMark job={match.job} small /> : <img src={match.candidate?.photo} />}
        <div><strong>{otherName}</strong><span><i />{match.job?.title}</span></div>
        <button className={showStarters ? 'starter-toggle active' : 'starter-toggle'} onClick={() => setShowStarters((v) => !v)} title="Conversation starters — also handy to prep for a call"><Sparkles size={16} /></button>
        <button className="starter-toggle" onClick={() => setScheduling(true)} title="Schedule a call"><Calendar size={16} /></button>
        {otherEmail && <a className="starter-toggle" href={`mailto:${otherEmail}`} title={`Email ${otherName || 'them'}`}><Mail size={16} /></a>}
      </header>
      <div className="conversation-body">
        <div className="date-divider">Today</div>
        {thread.map((message) => { const own = message.senderId === data.viewer.id; return <div className={own ? 'bubble-row own' : 'bubble-row'} key={message.id}>{!own && otherPhoto && <img src={otherPhoto} />}<div><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></div>; })}
        {calls.map((call) => {
          const event = { title: call.title, description: call.notes, startAt: call.startAt, durationMinutes: call.durationMinutes };
          return <div className="schedule-card" key={call.id}>
            <div><BriefcaseBusiness size={18} /></div>
            <section><span>Scheduled call</span><strong>{call.title}</strong><p>{new Date(call.startAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {call.durationMinutes} min</p></section>
            <div className="schedule-card-links">
              <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" title="Add to Google Calendar"><ExternalLink size={14} /> Google</a>
              <a href={outlookCalendarUrl(event)} target="_blank" rel="noreferrer" title="Add to Outlook"><ExternalLink size={14} /> Outlook</a>
              <a href={icsDataUrl(event)} download={`${call.title}.ics`} title="Download .ics"><Download size={14} /> .ics</a>
            </div>
          </div>;
        })}
      </div>
      <div className="coffee-quick-row">
        <button type="button" className="coffee-quick-btn" onClick={() => void quickCoffee()} disabled={schedulingCoffee}>
          <Coffee size={15} /> {schedulingCoffee ? 'Creating invite…' : "Let's have a cup of Coffee"}
        </button>
      </div>
      {showStarters && (role === 'employer'
        ? <RecruiterStarters candidateName={match.candidate?.name || 'there'} archetype={match.candidate?.aboutMeArchetype} onPick={setText} />
        : <CandidateStarters onPick={setText} />)}
      <form className="composer" onSubmit={send}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" /><button type="submit" disabled={!text.trim()}><Send size={17} /></button></form>
      {scheduling && <ScheduleCallModal match={match} viewer={data.viewer} onClose={() => setScheduling(false)}
        onScheduled={(call) => { setData({ ...data, calls: [...data.calls, call] }); setScheduling(false); }}
        onShareLink={async (shareText) => { const message = await api.message({ matchId: match.id, senderId: data.viewer.id, text: shareText }); setData({ ...data, messages: [...data.messages, message] }); setScheduling(false); }} />}
    </> : <EmptyState title="No conversations yet" />}</section>
    <aside className="context-panel">
      {role === 'candidate' && match?.job ? <CompanyLogoMark job={match.job} /> : <img src={match?.candidate?.photo} />}
      <h3>{otherName}</h3><p>{role === 'candidate' ? match?.job?.location : match?.candidate?.title}</p>
      <span className="fit-pill">{match?.candidate?.match?.score ?? 94}% role match</span>
      <div className="context-details"><label>Matched for</label><strong>{match?.job?.title}</strong><label>Location</label><strong>{match?.candidate?.location}</strong><label>Stage</label><strong>{match?.stage}</strong></div>
      <button className="secondary-button" onClick={() => setViewingProfile(true)} disabled={!match}>View full profile</button>
    </aside>
    {viewingProfile && match && (role === 'candidate' && match.job
      ? <JobDetailModal job={match.job} onClose={() => setViewingProfile(false)} viewerId={data.viewer.id} notes={data.notes} onNoteSaved={(note) => setData({ ...data, notes: [...data.notes.filter((n) => n.id !== note.id), note] })} />
      : match.candidate
        ? <CandidateProfileModal candidate={match.candidate} onClose={() => setViewingProfile(false)} unlocked viewerId={data.viewer.id} notes={data.notes} onNoteSaved={(note) => setData({ ...data, notes: [...data.notes.filter((n) => n.id !== note.id), note] })} />
        : null)}
  </div>;
}

/** Every scheduled call across every match, in one place — plus a way to
 * propose a time for any match that doesn't have one yet. Deliberately its
 * own page (not folded into Conversations): meetings are a cross-match
 * concept, so "what's on my calendar this week" shouldn't require opening
 * every thread one by one to check. */
function Meetings({ role, data, setData, onOpenMessages }: { role: Role; data: Bootstrap; setData: (d: Bootstrap) => void; onOpenMessages: (matchId: string) => void }) {
  const [schedulingFor, setSchedulingFor] = useState<JobMatch | null>(null);
  const now = Date.now();
  const upcoming = [...data.calls].filter((call) => call.startAt >= now).sort((a, b) => a.startAt - b.startAt);
  const past = [...data.calls].filter((call) => call.startAt < now).sort((a, b) => b.startAt - a.startAt);
  const scheduledMatchIds = new Set(data.calls.map((call) => call.matchId));
  const unscheduled = data.matches.filter((match) => !scheduledMatchIds.has(match.id));

  const otherParty = (match: JobMatch) => role === 'candidate'
    ? { name: match.job?.company || match.employer?.name || 'Recruiter', sub: match.job?.title, photo: match.employer?.photo, email: match.employer?.email }
    : { name: match.candidate?.name || 'Candidate', sub: match.job?.title, photo: match.candidate?.photo, email: match.candidate?.email };

  const CallCard = ({ call, past: isPast }: { call: ScheduledCall; past?: boolean }) => {
    const match = data.matches.find((m) => m.id === call.matchId);
    const other = match ? otherParty(match) : undefined;
    const event = { title: call.title, description: call.notes, startAt: call.startAt, durationMinutes: call.durationMinutes };
    return <div className="schedule-card" key={call.id}>
      {other?.photo ? <img className="meeting-photo" src={other.photo} alt="" /> : <div><Calendar size={16} /></div>}
      <section><span>{other?.name}{other?.sub ? ` · ${other.sub}` : ''}</span><strong>{call.title}</strong>
        <p>{new Date(call.startAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {call.durationMinutes} min</p>
      </section>
      {!isPast && <div className="schedule-card-links">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" title="Add to Google Calendar"><ExternalLink size={14} /> Google</a>
        <a href={outlookCalendarUrl(event)} target="_blank" rel="noreferrer" title="Add to Outlook"><ExternalLink size={14} /> Outlook</a>
        <a href={icsDataUrl(event)} download={`${call.title}.ics`} title="Download .ics"><Download size={14} /> .ics</a>
      </div>}
      {other?.email && <a className="meeting-btn" href={`mailto:${other.email}`}>Email To</a>}
      <button className="meeting-btn" onClick={() => onOpenMessages(call.matchId)}>Open chat</button>
    </div>;
  };

  return <div className="page meetings-page">
    <div className="page-title"><div><span className="overline">Calendar</span><h1>Meetings</h1><p>Every scheduled call across your matches, with one-click add to Google, Outlook, or Apple Calendar.</p></div></div>

    <section className="td-section" id="meetings-upcoming">
      <DashboardTitle icon={Calendar} title="Upcoming" subtitle={`${upcoming.length} scheduled`} />
      {upcoming.length
        ? <div className="meetings-list">{upcoming.map((call) => <CallCard call={call} key={call.id} />)}</div>
        : <EmptyRow>No meetings scheduled yet — propose a time with a match below.</EmptyRow>}
    </section>

    <section className="td-section" id="meetings-schedule">
      <DashboardTitle icon={Users} title="Schedule a meeting" subtitle="Pick a match to propose a time." />
      {unscheduled.length
        ? <div className="meetings-list">{unscheduled.map((match) => {
          const other = otherParty(match);
          return <div className="schedule-card" key={match.id}>
            {other.photo ? <img className="meeting-photo" src={other.photo} alt="" /> : <div><Calendar size={16} /></div>}
            <section><span>{other.sub}</span><strong>{other.name}</strong></section>
            <button className="meeting-btn solid" onClick={() => setSchedulingFor(match)}><Calendar size={15} /> Schedule</button>
          </div>;
        })}</div>
        : <EmptyRow>Every match already has a meeting on the calendar.</EmptyRow>}
    </section>

    {past.length > 0 && <section className="td-section" id="meetings-past">
      <DashboardTitle icon={Clock3} title="Past meetings" subtitle={`${past.length} completed`} />
      <div className="meetings-list">{past.map((call) => <CallCard call={call} past key={call.id} />)}</div>
    </section>}

    {schedulingFor && <ScheduleCallModal match={schedulingFor} viewer={data.viewer} onClose={() => setSchedulingFor(null)}
      onScheduled={(call) => { setData({ ...data, calls: [...data.calls, call] }); setSchedulingFor(null); }}
      onShareLink={async (shareText) => { const message = await api.message({ matchId: schedulingFor.id, senderId: data.viewer.id, text: shareText }); setData({ ...data, messages: [...data.messages, message] }); setSchedulingFor(null); }} />}
  </div>;
}

/** Bookmarking (the bookmark icon on job/candidate cards) was fully wired
 * end to end but had nowhere to review everything you'd saved — this is
 * that list, for both roles. */
function Saved({ role, data, setData, navigate }: { role: Role; data: Bootstrap; setData: (d: Bootstrap) => void; navigate: (v: View) => void }) {
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [detailPerson, setDetailPerson] = useState<Person | null>(null);
  const savedJobs = data.jobs.filter((job) => data.bookmarkedIds.includes(job.id));
  const savedCandidates = data.candidates.filter((person) => data.bookmarkedIds.includes(person.id));
  const unsave = async (targetId: string, targetType: 'job' | 'candidate') => {
    await api.toggleBookmark({ userId: data.viewer.id, targetId, targetType });
    setData({ ...data, bookmarkedIds: data.bookmarkedIds.filter((id) => id !== targetId) });
  };
  return <div className="page">
    <div className="page-title"><div><span className="overline">{role === 'candidate' ? 'Saved for later' : 'Saved candidates'}</span><h1>Saved</h1><p>{role === 'candidate' ? 'Roles you bookmarked while browsing.' : 'Candidates you bookmarked while browsing.'}</p></div></div>
    {role === 'candidate'
      ? (savedJobs.length
        ? <div className="jobs-table"><header><span>Role</span><span>Status</span><span>Salary</span><span>Skills</span><span /></header>
          {savedJobs.map((job) => <div className="job-row job-row-clickable" key={job.id} role="button" tabIndex={0} onClick={() => setDetailJob(job)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailJob(job); } }}>
            <div><JobHeaderBadge job={job} compact /></div>
            <span className={`status status-${job.status.toLowerCase()}`}><i />{job.status[0].toUpperCase()}{job.status.slice(1)}</span>
            <span>{job.salaryHidden ? 'Hidden' : job.salary}</span>
            <span>{job.requiredSkills.length} weighted</span>
            <button aria-label={`Remove ${job.title} from saved`} onClick={(event) => { event.stopPropagation(); void unsave(job.id, 'job'); }}><BookmarkIcon fill="currentColor" /></button>
          </div>)}</div>
        : <EmptyState title="Nothing saved yet — bookmark a role from Discover to find it here." />)
      : (savedCandidates.length
        ? <div className="jobs-table"><header><span>Candidate</span><span>Fit</span><span>Location</span><span>Skills</span><span /></header>
          {savedCandidates.map((person) => <div className="job-row job-row-clickable" key={person.id} role="button" tabIndex={0} onClick={() => setDetailPerson(person)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailPerson(person); } }}>
            <div className="td-recruiter-line"><img src={person.photo} alt="" /><span><strong>{person.name}</strong><small>{person.title}</small></span></div>
            <span>{person.match?.score ?? 0}% match</span>
            <span>{person.location}</span>
            <span>{person.skills.length} skills</span>
            <button aria-label={`Remove ${person.name} from saved`} onClick={(event) => { event.stopPropagation(); void unsave(person.id, 'candidate'); }}><BookmarkIcon fill="currentColor" /></button>
          </div>)}</div>
        : <EmptyState title="Nothing saved yet — bookmark a candidate from Discover to find them here." />)}
    {detailJob && <JobDetailModal job={detailJob} onClose={() => setDetailJob(null)} viewerId={data.viewer.id} notes={data.notes} onNoteSaved={(note) => setData({ ...data, notes: [...data.notes.filter((n) => n.id !== note.id), note] })} />}
    {detailPerson && <div className="mh-modal-scrim" role="presentation" onMouseDown={() => setDetailPerson(null)}>
      <section className="mh-profile-modal" role="dialog" aria-modal="true" aria-label={`${detailPerson.name}'s profile`} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span className="overline">Candidate profile</span><h2>{detailPerson.name}</h2></div><button onClick={() => setDetailPerson(null)} aria-label="Close profile"><X /></button></header>
        <CandidateCards person={detailPerson} match={detailPerson.match} />
        <NotesBox viewerId={data.viewer.id} targetId={detailPerson.id} targetType="candidate" notes={data.notes} onSaved={(note) => setData({ ...data, notes: [...data.notes.filter((n) => n.id !== note.id), note] })} />
        <footer><button className="secondary-button" onClick={() => setDetailPerson(null)}>Close</button><button className="primary-button" onClick={() => navigate('discover')}>Go to Discover <ArrowRight size={15} /></button></footer>
      </section>
    </div>}
  </div>;
}

function Matches({ data, navigate, onOpenMessages }: { data: Bootstrap; navigate: (v: View) => void; onOpenMessages?: (matchId: string) => void }) { return <div className="page"><div className="page-title"><div><span className="overline">Mutual interest</span><h1>Your matches</h1><p>These teams chose you back. Start a conversation when you’re ready.</p></div></div><div className="match-grid">{data.matches.map((match) => <article key={match.id}>{match.job && <JobHeaderBadge job={match.job} />}<div className="match-grid-actions"><button className="secondary-button" onClick={() => navigate('discover')}>View role</button><button className="primary-button" onClick={() => onOpenMessages ? onOpenMessages(match.id) : navigate('messages')}><MessageCircle size={16} />Message</button></div></article>)}</div></div>; }

function Companies({ data, navigate }: { data: Bootstrap; navigate: (v: View) => void }) {
  const companies = [...new Map(data.jobs.map((job) => [job.company, job])).values()];
  return <div className="page"><div className="page-title"><div><span className="overline">Companies</span><h1>Companies checking you out</h1><p>Explore teams with relevant opportunities.</p></div></div><div className="jobs-table">{companies.map((job) => <div className="job-row" key={job.company}><div><JobHeaderBadge job={job} compact /></div><span>{job.workMode}</span><span>{job.location}</span><span>{job.requiredSkills.length} matching signals</span><span>{job.salary}</span><button aria-label={`Explore ${job.company}`} onClick={() => navigate('discover')}><ArrowRight size={16} /></button></div>)}</div></div>;
}

function Jobs({ data, reload, onAddJobs, manualJobRequest, onOpenMessages, editJobId }: { data: Bootstrap; reload: () => void; onAddJobs: () => void; manualJobRequest: number; onOpenMessages?: (matchId: string) => void; editJobId?: string }) {
  const [editing, setEditing] = useState<Job | 'new' | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (manualJobRequest > 0) setEditing('new'); }, [manualJobRequest]);
  // Opened via "Edit" on a job row elsewhere (e.g. the Home dashboard's My Jobs list).
  useEffect(() => { if (editJobId) { const job = data.jobs.find((j) => j.id === editJobId); if (job) setEditing(job); } }, [editJobId]);
  const doDelete = async (id: string) => {
    setDeleting(true);
    try { await api.deleteJob(id); setConfirmDeleteId(null); setDetailJob(null); reload(); } finally { setDeleting(false); }
  };
  if (editing) return <JobEditor viewer={data.viewer} job={editing === 'new' ? undefined : editing} onSaved={() => { setEditing(null); setDetailJob(null); reload(); }} onCancel={() => setEditing(null)} />;
  if (detailJob) return <JobOfferDetail job={detailJob} data={data} onBack={() => setDetailJob(null)} onEdit={() => { setEditing(detailJob); }} onDelete={() => void doDelete(detailJob.id)} deleting={deleting} onOpenMessages={onOpenMessages} />;
  const mine = data.jobs.filter((j) => j.employerId === data.viewer.id);
  return <div className="page"><div className="page-title"><div><span className="overline">Recruiting</span><h1>My Job Offers</h1><p>Import, review, and manage every role in one place.</p></div><button className="primary-button small" onClick={onAddJobs}>+ Add New Job Offers</button></div>
    <section className="job-add-banner"><span><Sparkles size={19} /></span><div><strong>Add jobs in minutes</strong><p>Use an ATS feed, paste LinkedIn descriptions, or create an offer manually.</p></div><div className="job-add-methods"><small>CSV / XML / JSON</small><small>LinkedIn links</small><small>Manual</small></div><button className="secondary-button" onClick={onAddJobs}>Choose a method <ArrowRight size={15} /></button></section>
    <div className="channel-bar"><div className="linkedin-mark"><BriefcaseBusiness size={18} /></div><section><strong>JobMatchNow is your job hub</strong><p>Imported offers become reviewable five-card drafts. Nothing is scraped or published automatically.</p></section><span>Recruiter controlled</span></div>
    <div className="jobs-table"><header><span>Role</span><span>Status</span><span>Salary</span><span>Applicants</span><span>Skills</span><span /></header>{mine.map((job) => <div className="job-row job-row-clickable" key={job.id} role="button" tabIndex={0} onClick={() => setDetailJob(job)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailJob(job); } }}><div><JobHeaderBadge job={job} compact />{job.importNeedsReview?.length ? <small className="job-review-note">Review {job.importNeedsReview.join(', ')}</small> : null}</div><span className={`status status-${job.status.toLowerCase()}`}><i />{job.status[0].toUpperCase()}{job.status.slice(1)}</span><span>{job.salary}</span><span>{job.applicants}</span><span>{job.requiredSkills.length} weighted</span>
      <div className="job-row-actions" onClick={(event) => event.stopPropagation()}>
        {confirmDeleteId === job.id
          ? <><button className="confirm-yes" aria-label={`Confirm delete ${job.title}`} disabled={deleting} onClick={() => void doDelete(job.id)}><Check size={14} /></button><button className="confirm-no" aria-label="Cancel delete" onClick={() => setConfirmDeleteId(null)}><X size={14} /></button></>
          : <><button aria-label={`Edit ${job.title}`} onClick={() => setEditing(job)}><MoreHorizontal size={15} /></button><button className="danger" aria-label={`Delete ${job.title}`} onClick={() => setConfirmDeleteId(job.id)}><Trash2 size={14} /></button></>}
      </div>
    </div>)}{mine.length === 0 && <div className="job-row"><div><section><strong>No job offers yet</strong><small>Add your first role using the simplest method for you.</small></section></div></div>}</div><div className="job-empty"><div><Sparkles /></div><section><h3>Reach the right people, not the most people.</h3><p>JobsMatchNow recommends your role only to candidates with meaningful fit and verified intent.</p></section><button className="secondary-button" onClick={onAddJobs}>Add your first job offers</button></div></div>;
}

/** Per-job detail: this role's mutual matches, and message threads scoped to it. */
function JobOfferDetail({ job, data, onBack, onEdit, onDelete, deleting, onOpenMessages }: { job: Job; data: Bootstrap; onBack: () => void; onEdit: () => void; onDelete: () => void; deleting?: boolean; onOpenMessages?: (matchId: string) => void }) {
  const matches = data.matches.filter((match) => match.jobId === job.id);
  const [confirming, setConfirming] = useState(false);
  return <div className="page job-offer-detail">
    <div className="page-title">
      <div><button className="secondary-button small" onClick={onBack}><ArrowLeft size={15} /> Back to My Jobs</button></div>
      <div style={{ display: 'flex', gap: 8 }}>
        {confirming
          ? <><span className="settings-confirm"><button className="danger-button small" disabled={deleting} onClick={onDelete}>{deleting ? <Loader2 size={14} className="spin" /> : 'Confirm delete'}</button><button className="text-button" onClick={() => setConfirming(false)}>Cancel</button></span></>
          : <><button className="danger-button small" onClick={() => setConfirming(true)}><Trash2 size={14} /> Delete role</button><button className="primary-button small" onClick={onEdit}>Edit role</button></>}
      </div>
    </div>
    {(job.demo || job.sample) && <DemoBadge label={job.sample ? 'Starter sample job — auto-generated for you' : 'Demo job offer — not a real opening'} />}
    <JobHeaderBadge job={job} />
    <section className="td-section" id="job-detail-matches">
      <DashboardTitle icon={Check} title="Job Matches" subtitle={`Candidates who mutually matched for ${job.title}.`} />
      {matches.length
        ? <div className="td-role-sublist">{matches.map((match) => <div className="td-cand-row" key={match.id}>
          <img src={match.candidate.photo} alt="" />
          <div className="td-cand-row-info"><strong>{match.candidate.name}</strong><small>{match.candidate.title}</small></div>
          <span className="td-cand-row-score">{match.candidate.match?.score || 0}%</span>
          <button className="td-cand-row-talk matched" onClick={() => onOpenMessages?.(match.id)}><MessageCircle size={13} /> Message</button>
        </div>)}</div>
        : <EmptyRow>No mutual matches yet for this role.</EmptyRow>}
    </section>
    <section className="td-section" id="job-detail-messages">
      <DashboardTitle icon={MessageCircle} title="Messages" subtitle="Conversations with candidates matched to this role." />
      {matches.length
        ? <div className="td-list-panel job-detail-threads">{matches.map((match) => {
          const last = data.messages.filter((message) => message.matchId === match.id).at(-1);
          return <button key={match.id} onClick={() => onOpenMessages?.(match.id)}>
            <img src={match.candidate.photo} alt="" />
            <span><strong>{match.candidate.name}</strong><small>{last?.text || 'No messages yet — say hello.'}</small></span>
            <ArrowRight size={12} />
          </button>;
        })}</div>
        : <EmptyRow>Messages with matched candidates will show up here.</EmptyRow>}
    </section>
  </div>;
}

function Analytics({ role, data }: { role: Role; data: Bootstrap }) {
  // Real figures derived from this viewer's matches and messages — same
  // shape for both roles, just framed from whichever side is looking.
  const totalMatches = data.matches.length;
  const inConversation = data.matches.filter((m) => data.messages.some((msg) => msg.matchId === m.id)).length;
  const otherReplied = data.matches.filter((m) => data.messages.some((msg) => msg.matchId === m.id && (role === 'candidate' ? msg.senderId !== data.viewer.id : msg.senderId === m.candidateId))).length;
  const responseRate = inConversation ? Math.round((otherReplied / inConversation) * 100) : 0;
  const avgScore = totalMatches ? Math.round(data.matches.reduce((sum, m) => sum + ((role === 'candidate' ? m.job?.match?.score : m.candidate?.match?.score) ?? 80), 0) / totalMatches) : 0;
  const interviewing = data.matches.filter((m) => m.stage === 'Interview' || m.stage === 'Offer').length;
  const copy = role === 'candidate'
    ? {
      overline: 'Career intelligence', title: 'Job search insights',
      subtitle: 'Signals that help you understand your search and strengthen your profile.',
      responseLabel: 'Recruiter response', funnelTitle: 'Application funnel', funnelSubtitle: 'From profile view to qualified conversation',
      qualityTitle: 'Role fit quality', qualitySubtitle: 'Your job matches',
      insightTitle: 'Add your salary expectations to your profile.',
      insightBody: 'Candidates with a salary range set get 3× more recruiter replies, and your top-matching roles all list one.',
      insightAction: 'Update preferences',
    }
    : {
      overline: 'Talent intelligence', title: 'Hiring insights',
      subtitle: 'Signals that help your team improve quality, speed, and candidate experience.',
      responseLabel: 'Candidate response', funnelTitle: 'Matching funnel', funnelSubtitle: 'From recommendation to qualified conversation',
      qualityTitle: 'Match quality', qualitySubtitle: 'Recommended candidates',
      insightTitle: 'Add “Design systems” to the role’s must-have skills.',
      insightBody: 'High-performing matches mention it 2.4× more often, and your strongest current candidates all have verified experience.',
      insightAction: 'Review suggestion',
    };
  // Illustrative comparison vs. a classic recruitment pipeline — response
  // rate blends in this viewer's own real number so it's not pure fiction.
  const pipelineCompare = [
    { label: 'Steps to hire', classic: 8, jobsmatch: 3, unit: ' steps', color: '#FF3B30' },
    { label: 'Time to hire', classic: 32, jobsmatch: 9, unit: ' days', color: '#FF9500' },
    { label: copy.responseLabel, classic: 18, jobsmatch: Math.max(responseRate, 61), unit: '%', color: '#34C759', higherIsBetter: true },
  ];
  return <div className="page"><div className="page-title"><div><span className="overline">{copy.overline}</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div><button className="ghost-button">All time <ChevronDown size={15} /></button></div><div className="analytics-grid"><Metric label="Mutual matches" value={String(totalMatches)} change="live" /><Metric label="In conversation" value={String(inConversation)} change={`${totalMatches ? Math.round((inConversation / totalMatches) * 100) : 0}% of matches`} /><Metric label={copy.responseLabel} value={`${responseRate}%`} change={`${otherReplied}/${inConversation} replied`} /><Metric label="Interviewing +" value={String(interviewing)} change="Interview & offer" /></div><div className="chart-grid"><section className="chart-card wide"><header><div><strong>{copy.funnelTitle}</strong><p>{copy.funnelSubtitle}</p></div><button><MoreHorizontal /></button></header><div className="bar-chart">{[62, 78, 49, 86, 72, 94, 81, 68, 90, 76, 88, 96].map((height, i) => <div key={i}><i style={{ height: `${height}%` }} /><span>{i % 2 === 0 ? ['Jul 1', '5', '9', '13', '17', '21'][i / 2] : ''}</span></div>)}</div></section><section className="chart-card"><header><div><strong>{copy.qualityTitle}</strong><p>{copy.qualitySubtitle}</p></div></header><div className="donut"><div><strong>{avgScore || 86}</strong><span>avg. score</span></div></div><div className="legend"><span><i className="excellent" />Excellent <b>54%</b></span><span><i className="good" />Good <b>32%</b></span><span><i className="fair" />Developing <b>14%</b></span></div></section></div><section className="chart-card wide pipeline-compare"><header><div><strong>Classic recruitment vs. JobsMatchNow</strong><p>How the hiring pipeline itself compares, step for step.</p></div></header><div className="pipeline-rows">{pipelineCompare.map((row) => { const max = Math.max(row.classic, row.jobsmatch) || 1; const better = row.higherIsBetter ? row.jobsmatch > row.classic : row.jobsmatch < row.classic; const deltaPct = row.classic ? Math.round(Math.abs(row.jobsmatch - row.classic) / row.classic * 100) : 0; return <div className="pipeline-row" key={row.label}><span className="pipeline-row-label">{row.label}</span><div className="pipeline-bar-track classic"><i style={{ width: `${(row.classic / max) * 100}%` }} /><b>{row.classic}{row.unit}</b></div><div className="pipeline-bar-track jobsmatch"><i style={{ width: `${(row.jobsmatch / max) * 100}%`, background: row.color }} /><b>{row.jobsmatch}{row.unit}</b></div>{better && <span className="pipeline-delta" style={{ color: row.color }}>{deltaPct}% better</span>}</div>; })}<div className="pipeline-legend"><span><i className="classic" /> Classic recruitment</span><span><i className="jobsmatch" /> JobsMatchNow</span></div></div></section><section className="insight-callout"><div><Sparkles /></div><section><span>Opportunity insight</span><h3>{copy.insightTitle}</h3><p>{copy.insightBody}</p></section><button className="secondary-button">{copy.insightAction}</button></section></div>; }

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
