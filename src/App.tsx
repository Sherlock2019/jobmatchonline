import { useEffect, useMemo, useState } from 'react';
import { PhoneMockup } from './components/PhoneMockup';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { Activity, ArrowRight, BarChart3, Bell, BriefcaseBusiness, Check, ChevronDown, CircleHelp, Clock3, Command, Compass, Filter, Heart, Inbox, Layers3, Linkedin, MapPin, Menu, MessageCircle, MoreHorizontal, RotateCcw, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Star, Target, Users, X, Zap } from 'lucide-react';
import { api } from './api';
import { apiBase } from './api';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as NativeApp } from '@capacitor/app';
import { LoginModal, RegisterModal } from './components/AuthModals';
import { MobileLanding } from './components/MobileLanding';
import { comparisonRows } from './content/landingContent';
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
  const signOut = () => { saveSession(null); setSession(null); };
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
  if (!session) return <Landing onLogin={signIn} />;
  return <Workspace key={session.id} session={session} onSwitchUser={signIn} onExit={signOut} />;
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
    <nav className="landing-nav"><Brand /><div className="landing-links"><a href="#how">How it works</a><a href="#compare">Why JobsMatchNow</a><a href="#trust">Trust & fairness</a><button className="mobile-toggle" onClick={() => setMobilePreview(true)} aria-pressed="false"><Smartphone size={15} /> Mobile view</button><button className="text-button" onClick={openLogin}>Log in</button><button className="primary-button small" onClick={openRegister}>Register free <ArrowRight size={16} /></button></div></nav>
    {linkedinState && <div className="integration-notice">{linkedinState === 'connected' ? 'LinkedIn connected. Your professional identity is ready to use.' : 'Add LinkedIn app credentials to enable live account connection. The demo remains available.'}<button onClick={() => history.replaceState({}, '', '/')}>×</button></div>}
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={14} /> Mutual intent. Better hiring.</div>
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
  const role: Role = data?.viewer.role ?? session.role;

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
      <div className="sidebar-bottom"><button><CircleHelp size={18} />Help center</button><button><Settings size={18} />Settings</button><button className="profile-button" onClick={onExit}><img src={data?.viewer.photo} /><div><strong>{data?.viewer.name || 'Loading'}</strong><small>View public page</small></div><MoreHorizontal size={17} /></button></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <section className="app-main"><header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}><Menu /></button><div className="search-box"><Search size={17} /><input aria-label="Search" placeholder={role === 'candidate' ? 'Search jobs, companies, skills…' : 'Search talent, jobs, messages…'} /><kbd><Command size={12} /> K</kbd></div><div className="topbar-actions"><button aria-label="Notifications"><Bell size={19} /><i /></button><button className="role-chip" onClick={() => changeRole(role === 'candidate' ? 'employer' : 'candidate')}>{role === 'candidate' ? 'Candidate view' : 'Recruiter view'}<ChevronDown size={14} /></button></div></header>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={load} /> : data && <ViewRouter view={view} role={role} data={data} setData={setData} navigate={setView} />}
    </section>
  </div>;
}

function ViewRouter({ view, role, data, setData, navigate }: { view: View; role: Role; data: Bootstrap; setData: (d: Bootstrap) => void; navigate: (v: View) => void }) {
  if (view === 'discover') return <Discover role={role} data={data} setData={setData} navigate={navigate} />;
  if (view === 'pipeline') return <Pipeline data={data} setData={setData} />;
  if (view === 'messages') return <Messages data={data} setData={setData} />;
  if (view === 'analytics') return <Analytics data={data} />;
  if (view === 'jobs') return <Jobs data={data} />;
  if (view === 'matches') return <Matches data={data} navigate={navigate} />;
  return <Profile data={data} />;
}

function Discover({ role, data, setData, navigate }: { role: Role; data: Bootstrap; setData: (d: Bootstrap) => void; navigate: (v: View) => void }) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [radius, setRadius] = useState(25);
  const rawDeck = role === 'candidate' ? data.jobs : data.candidates;
  const deck = rawDeck.filter((item) => item.distanceKm === undefined || item.distanceKm <= radius);
  useEffect(() => setIndex(0), [radius, role]);
  const current = deck[index];
  const next = deck[index + 1];
  const act = async (direction: 'like' | 'pass') => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const result = await api.swipe({ actorId: data.viewer.id, targetId: current.id, targetType: role === 'candidate' ? 'job' : 'candidate', direction });
      if (result.match) setMatch(result.match);
      setData({ ...data, likesRemaining: result.likesRemaining ?? data.likesRemaining - (direction === 'like' ? 1 : 0) });
      setIndex((value) => value + 1);
    } catch (e) { alert(e instanceof Error ? e.message : 'Swipe failed'); }
    finally { setBusy(false); }
  };

  return <div className="page discover-page"><div className="page-title"><div><span className="overline">{role === 'candidate' ? 'Your next move' : 'Recommended talent'}</span><h1>{role === 'candidate' ? 'Discover roles' : 'Discover people'}</h1><p>{role === 'candidate' ? 'Curated from your skills, goals, and work preferences.' : 'Ranked against Senior Product Designer · Northstar.'}</p></div><div className="title-actions"><button className="ghost-button"><SlidersHorizontal size={17} />Preferences</button><button className="ghost-button"><Filter size={17} />Filters <span>3</span></button></div></div>
    <section className="geo-control" aria-label="Geolocation of Opportunities"><div><MapPin size={18} /><span><small>Geolocation of Opportunities</small><strong>{role === 'candidate' ? 'Roles' : 'Candidates'} within {radius} km</strong></span></div><input aria-label="Maximum match distance in kilometres" type="range" min="5" max="100" step="5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /><p>City-level matching only. Exact locations stay private.</p></section>
    <div className="discover-layout"><section className="deck-area">
      <div className="deck-meta"><span><Sparkles size={15} />Personalized for you</span><small>{Math.max(deck.length - index, 0)} nearby recommendations</small></div>
      <div className="card-stack">{next && <div className="stack-card"><CardSummary item={next} role={role} /></div>}{current ? <SwipeCard key={current.id} item={current} role={role} onSwipe={act} /> : <EmptyDeck onReset={() => setIndex(0)} />}</div>
      {current && <div className="action-row"><button onClick={() => act('pass')} disabled={busy} className="pass-action" aria-label="Pass"><X /></button><button className="undo-action" aria-label="Undo" disabled><RotateCcw /></button><button onClick={() => act('like')} disabled={busy} className="like-action" aria-label="Like"><Heart fill="currentColor" /></button></div>}
      <div className="keyboard-hint"><span><kbd>←</kbd> Pass</span><span><kbd>→</kbd> Like</span><span><kbd>Space</kbd> View details</span></div>
    </section><aside className="insight-panel"><div className="daily-card"><div><span>Today’s activity</span><strong>{data.likesRemaining}</strong><small>likes remaining</small></div><div className="ring" style={{ '--progress': `${data.likesRemaining * 2}%` } as React.CSSProperties}><Heart size={18} /></div></div><div className="tip-card"><div className="tip-icon"><Zap size={17} /></div><strong>{role === 'candidate' ? 'Complete your preferences' : 'Calibrate your search'}</strong><p>{role === 'candidate' ? 'Add your preferred team size to improve recommendations by up to 18%.' : 'Review five profiles to help JobsMatchNow learn what great looks like for this role.'}</p><button>{role === 'candidate' ? 'Update preferences' : 'View calibration'} <ArrowRight size={14} /></button></div><div className="quality-card"><div className="quality-head"><span>Match quality</span><strong>Excellent</strong></div><div className="quality-bar"><i /></div><p>Your recommendations use 12 verified profile signals.</p></div></aside></div>
    <AnimatePresence>{match && <MatchModal match={match} onClose={() => setMatch(null)} onMessage={() => { setMatch(null); navigate('messages'); }} />}</AnimatePresence></div>;
}

function SwipeCard({ item, role, onSwipe }: { item: Job | Person; role: Role; onSwipe: (direction: 'like' | 'pass') => void }) {
  const x = useMotionValue(0); const rotate = useTransform(x, [-220, 220], [-8, 8]); const likeOpacity = useTransform(x, [20, 120], [0, 1]); const passOpacity = useTransform(x, [-120, -20], [1, 0]);
  return <motion.article className="swipe-card" style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.85} onDragEnd={(_, info) => { if (info.offset.x > 110) onSwipe('like'); else if (info.offset.x < -110) onSwipe('pass'); }}>
    <motion.div className="swipe-stamp like-stamp" style={{ opacity: likeOpacity }}>INTERESTED</motion.div><motion.div className="swipe-stamp pass-stamp" style={{ opacity: passOpacity }}>PASS</motion.div><CardSummary item={item} role={role} detailed /></motion.article>;
}

function CardSummary({ item, role, detailed = false }: { item: Job | Person; role: Role; detailed?: boolean }) {
  if (role === 'candidate') { const job = item as Job; return <><div className="card-header"><div className="company-logo" style={{ background: job.accent }}>{job.logo}</div><div className="fit-badge"><span>{job.match.score}%</span> match</div><button aria-label="More"><MoreHorizontal /></button></div><div className="card-body"><div className="company-line">{job.company}<i />{job.responseTime} response</div><h2>{job.title}</h2><div className="job-meta"><span><MapPin size={15} />{job.location}</span>{job.distanceKm !== undefined && <span className="distance-badge">{job.distanceKm} km away</span>}<span><BriefcaseBusiness size={15} />{job.type}</span><span>{job.salary}</span></div><p className="description">{job.description}</p>{detailed && <><div className="match-reason"><div><Sparkles size={17} /></div><section><strong>Why you’re a strong match</strong><p>{job.match.matchedSkills.length} priority skills match, your experience level fits, and the role supports your preferred work style.</p></section></div><div className="card-section"><span className="card-label">Your matching skills</span><div className="skill-list">{job.match.matchedSkills.map((skill) => <span key={skill}><Check size={12} />{skill}</span>)}</div></div><div className="card-foot"><div><strong>{job.mission}</strong><small>{job.culture.join(' · ')}</small></div><button>Full role <ArrowRight size={14} /></button></div></>}</div></>; }
  const person = item as Person; return <><div className="talent-photo"><img src={person.photo} alt="" /><div className="availability"><i />Available {person.availability}</div></div><div className="card-body talent-body"><div className="fit-badge talent-fit"><span>{person.match?.score}%</span> match</div><h2>{person.name}</h2><p className="talent-title">{person.title}</p><div className="job-meta"><span><MapPin size={15} />{person.location}</span>{person.distanceKm !== undefined && <span className="distance-badge">{person.distanceKm} km away</span>}<span><BriefcaseBusiness size={15} />{person.experienceLevel}</span></div>{detailed && <><div className="match-reason"><div><Sparkles size={17} /></div><section><strong>Why they stand out</strong><p>{person.match?.matchedSkills.join(', ')} align with the role. Their background and availability fit your hiring plan.</p></section></div><div className="card-section"><span className="card-label">Top skills</span><div className="skill-list">{person.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div></>}</div></>;
}

function EmptyDeck({ onReset }: { onReset: () => void }) { return <div className="empty-deck"><div><Check /></div><h2>You’re all caught up</h2><p>We’ll bring you fresh recommendations as soon as the fit is strong enough.</p><button className="primary-button" onClick={onReset}><RotateCcw size={16} />Review again</button></div>; }

function MatchModal({ match, onClose, onMessage }: { match: JobMatch; onClose: () => void; onMessage: () => void }) { return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="match-modal" initial={{ y: 30, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: .96 }}><button className="modal-close" onClick={onClose}><X /></button><div className="match-glow"><Heart fill="currentColor" /></div><span className="overline">Mutual interest</span><h2>It’s a match.</h2><p>Northstar is interested too. Start a conversation while the momentum is fresh.</p><div className="match-faces"><img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop" /><div>N</div></div><button className="primary-button" onClick={onMessage}><MessageCircle size={17} />Send a message</button><button className="text-button" onClick={onClose}>Keep exploring</button></motion.div></motion.div>; }

function Pipeline({ data, setData }: { data: Bootstrap; setData: (d: Bootstrap) => void }) {
  const stages = ['Matched', 'Screen', 'Interview', 'Offer'];
  const move = async (match: JobMatch, stage: string) => { await api.updateStage(match.id, stage); setData({ ...data, matches: data.matches.map((item) => item.id === match.id ? { ...item, stage } : item) }); };
  return <div className="page"><div className="page-title"><div><span className="overline">Senior Product Designer</span><h1>Hiring pipeline</h1><p>Move mutual matches from first hello to signed offer.</p></div><div className="title-actions"><button className="ghost-button"><Users size={17} />Share</button><button className="primary-button small">Add candidate</button></div></div><div className="pipeline-summary"><Metric label="Active candidates" value="18" change="+4 this week" /><Metric label="Median response" value="19h" change="Top 12%" /><Metric label="Interview rate" value="38%" change="+8.4%" /><Metric label="Time to hire" value="21d" change="6d faster" /></div><div className="pipeline-board">{stages.map((stage, stageIndex) => <section key={stage} className="pipeline-column"><header><span>{stage}</span><em>{data.matches.filter((m) => m.stage === stage).length}</em><button><MoreHorizontal /></button></header><div>{data.matches.filter((m) => m.stage === stage).map((match) => <article className="candidate-tile" key={match.id}><div className="candidate-head"><img src={match.candidate?.photo} /><div><strong>{match.candidate?.name}</strong><small>{match.candidate?.title}</small></div><span>{match.candidate?.match?.score || 91}%</span></div><div className="tile-skills">{match.candidate?.skills?.slice(0, 2).map((skill) => <span key={skill}>{skill}</span>)}</div><div className="tile-foot"><span><Clock3 size={13} />{stage === 'Interview' ? 'Thu, 2:30 PM' : 'Updated today'}</span>{stageIndex < stages.length - 1 && <button onClick={() => move(match, stages[stageIndex + 1])} aria-label={`Move to ${stages[stageIndex + 1]}`}><ArrowRight size={15} /></button>}</div></article>)}<button className="add-tile">+ Add candidate</button></div></section>)}</div></div>;
}

function Messages({ data, setData }: { data: Bootstrap; setData: (d: Bootstrap) => void }) {
  const match = data.matches[0]; const [text, setText] = useState(''); const thread = data.messages.filter((m) => m.matchId === match?.id);
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!text.trim() || !match) return; const message = await api.message({ matchId: match.id, senderId: data.viewer.id, text }); setData({ ...data, messages: [...data.messages, message] }); setText(''); };
  return <div className="messages-page"><aside className="threads"><div className="threads-head"><div><span className="overline">Inbox</span><h1>Messages</h1></div><button><Filter size={17} /></button></div><div className="thread-search"><Search size={16} /><input placeholder="Search conversations" /></div>{data.matches.map((item, index) => <button className={index === 0 ? 'thread active' : 'thread'} key={item.id}><img src={item.candidate?.photo} /><div><div><strong>{item.candidate?.name || item.job?.company}</strong><time>{index === 0 ? '1h' : '1d'}</time></div><p>{index === 0 ? 'Thursday afternoon works well…' : 'Thanks for connecting — I’d love…'}</p></div>{index === 0 && <i />}</button>)}</aside><section className="conversation">{match ? <><header><img src={match.candidate?.photo} /><div><strong>{match.candidate?.name}</strong><span><i />Active now · {match.job?.title}</span></div><button><MoreHorizontal /></button></header><div className="conversation-body"><div className="date-divider">Today</div>{thread.map((message) => { const own = message.senderId === data.viewer.id; return <div className={own ? 'bubble-row own' : 'bubble-row'} key={message.id}>{!own && <img src={match.candidate?.photo} />}<div><p>{message.text}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></div>; })}<div className="schedule-card"><div><BriefcaseBusiness size={18} /></div><section><span>Interview</span><strong>Product conversation</strong><p>Thursday, July 23 · 2:30–3:00 PM</p></section><button>View</button></div></div><form className="composer" onSubmit={send}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" /><button type="submit" disabled={!text.trim()}><Send size={17} /></button></form></> : <EmptyState title="No conversations yet" />}</section><aside className="context-panel"><img src={match?.candidate?.photo} /><h3>{match?.candidate?.name}</h3><p>{match?.candidate?.title}</p><span className="fit-pill">94% role match</span><div className="context-details"><label>Matched for</label><strong>{match?.job?.title}</strong><label>Location</label><strong>{match?.candidate?.location}</strong><label>Stage</label><strong>{match?.stage}</strong></div><button className="secondary-button">View full profile</button></aside></div>;
}

function Matches({ data, navigate }: { data: Bootstrap; navigate: (v: View) => void }) { return <div className="page"><div className="page-title"><div><span className="overline">Mutual interest</span><h1>Your matches</h1><p>These teams chose you back. Start a conversation when you’re ready.</p></div></div><div className="match-grid">{data.matches.map((match) => <article key={match.id}><div className="match-company" style={{ background: match.job?.accent }}>{match.job?.logo}</div><span className="fit-pill">{match.candidate?.match?.score || 94}% match</span><h2>{match.job?.title}</h2><p>{match.job?.company} · {match.job?.location}</p><div className="match-grid-actions"><button className="secondary-button">View role</button><button className="primary-button" onClick={() => navigate('messages')}><MessageCircle size={16} />Message</button></div></article>)}</div></div>; }

function Jobs({ data }: { data: Bootstrap }) { return <div className="page"><div className="page-title"><div><span className="overline">Recruiting</span><h1>Open roles</h1><p>Manage jobs, recommendations, and candidate interest.</p></div><button className="primary-button small">+ Create job</button></div><div className="channel-bar"><div className="linkedin-mark"><Linkedin size={18} fill="currentColor" /></div><section><strong>LinkedIn Talent Solutions ready</strong><p>Sync job lifecycle and Apply Connect data after partner approval.</p></section><span>Adapter configured</span><button className="secondary-button">Integration settings</button></div><div className="jobs-table"><header><span>Role</span><span>Status</span><span>Matches</span><span>Applicants</span><span>Quality</span><span /></header>{data.jobs.filter((j) => j.employerId === data.viewer.id).map((job) => <div className="job-row" key={job.id}><div><div className="company-logo small-logo" style={{ background: job.accent }}>{job.logo}</div><section><strong>{job.title}</strong><small>{job.location} · Posted 8d ago</small></section></div><span className="status"><i />{job.status}</span><strong>18</strong><span>{job.applicants}</span><span className="quality">Excellent</span><button><MoreHorizontal /></button></div>)}</div><div className="job-empty"><div><Sparkles /></div><section><h3>Reach the right people, not the most people.</h3><p>JobsMatchNow recommends your role only to candidates with meaningful fit and verified intent.</p></section><button className="secondary-button">Preview candidate experience</button></div></div>; }

function Analytics({ data }: { data: Bootstrap }) { return <div className="page"><div className="page-title"><div><span className="overline">Talent intelligence</span><h1>Hiring insights</h1><p>Signals that help your team improve quality, speed, and candidate experience.</p></div><button className="ghost-button">Last 30 days <ChevronDown size={15} /></button></div><div className="analytics-grid"><Metric label="Profile views" value="1,284" change="↑ 18.2%" /><Metric label="Mutual match rate" value="24.8%" change="↑ 4.1%" /><Metric label="Candidate response" value="82%" change="↑ 6.7%" /><Metric label="Qualified conversations" value="36" change="↑ 12" /></div><div className="chart-grid"><section className="chart-card wide"><header><div><strong>Matching funnel</strong><p>From recommendation to qualified conversation</p></div><button><MoreHorizontal /></button></header><div className="bar-chart">{[62, 78, 49, 86, 72, 94, 81, 68, 90, 76, 88, 96].map((height, i) => <div key={i}><i style={{ height: `${height}%` }} /><span>{i % 2 === 0 ? ['Jul 1', '5', '9', '13', '17', '21'][i / 2] : ''}</span></div>)}</div></section><section className="chart-card"><header><div><strong>Match quality</strong><p>Recommended candidates</p></div></header><div className="donut"><div><strong>86</strong><span>avg. score</span></div></div><div className="legend"><span><i className="excellent" />Excellent <b>54%</b></span><span><i className="good" />Good <b>32%</b></span><span><i className="fair" />Developing <b>14%</b></span></div></section></div><section className="insight-callout"><div><Sparkles /></div><section><span>Opportunity insight</span><h3>Add “Design systems” to the role’s must-have skills.</h3><p>High-performing matches mention it 2.4× more often, and your strongest current candidates all have verified experience.</p></section><button className="secondary-button">Review suggestion</button></section></div>; }

function Profile({ data }: { data: Bootstrap }) { const p = data.viewer; return <div className="page profile-page"><div className="profile-hero"><img src={p.photo} /><div><span className="overline">{p.role === 'employer' ? 'Your recruiter profile' : 'Your candidate profile'}</span><h1>{p.name}</h1><p>{p.title}{p.location ? ` · ${p.location}` : p.company ? ` · ${p.company}` : ''}</p><div className="skill-list">{p.skills.map((s) => <span key={s}>{s}</span>)}</div></div><button className="secondary-button">Edit profile</button></div><div className="linkedin-connect"><div className="linkedin-mark"><Linkedin size={20} fill="currentColor" /></div><div><strong>Bring your professional identity</strong><p>Connect LinkedIn to import your basic profile and reduce onboarding friction. You stay in control of what employers see.</p></div><button className="linkedin-button" onClick={connectLinkedIn}>Connect LinkedIn</button></div><div className="profile-grid"><section><h2>Your profile strength</h2><div className="completion"><strong>{p.completeness}%</strong><div><i style={{ width: `${p.completeness}%` }} /></div></div><p>Your profile is ready to be shown to high-fit teams.</p></section><section><h2>Visibility & trust</h2><p><Linkedin size={16} />LinkedIn identity details supported</p><p><Check size={16} />Skills evidence added</p><p><ShieldCheck size={16} />Contact details hidden until match</p></section><section><h2>What you want next</h2><p>Senior or lead product roles at mission-led teams, with hybrid flexibility and strong design culture.</p><button className="text-button">Edit preferences <ArrowRight size={14} /></button></section></div></div>; }

function Metric({ label, value, change }: { label: string; value: string; change: string }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{change}</small></article>; }
function LoadingState() { return <div className="loading-state"><div className="loading-mark brand-heart-mark" /><p>Building your best matches…</p></div>; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="error-state"><div><Activity /></div><h2>We couldn’t load your workspace</h2><p>{message}</p><button className="primary-button" onClick={retry}>Try again</button></div>; }
function EmptyState({ title }: { title: string }) { return <div className="empty-state"><Inbox /><h3>{title}</h3></div>; }
function Brand() { return <div className="brand"><span className="brand-heart-mark" aria-hidden="true" /><span className="brand-wordmark"><b>Jobs</b><b>Match</b><b>Now</b></span></div>; }
