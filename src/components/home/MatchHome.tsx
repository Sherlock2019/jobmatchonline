import { useMemo, useState } from 'react';
import {
  ArrowRight, Bookmark, BriefcaseBusiness, Building2, Check, Coffee, Eye,
  Heart, MapPin, MessageCircle, Pencil, Sparkles, Star, Target, TrendingUp,
  UserRound, X,
} from 'lucide-react';
import { api } from '../../api';
import type { Bootstrap, Job, Person, RoleMatchGroup, View } from '../../types';
import { CandidateCards } from '../profile/CandidateCards';
import { JobDetailModal } from '../coach/CoachModals';

type HomeProps = {
  data: Bootstrap;
  setData: (data: Bootstrap) => void;
  navigate: (view: View) => void;
  onEditProfile: (step: number) => void;
};

function firstName(name?: string) {
  return (name || 'there').trim().split(/\s+/)[0];
}

function stars(score = 0) {
  if (score >= 95) return 5;
  if (score >= 85) return 4;
  if (score >= 75) return 3;
  if (score >= 65) return 2;
  return 1;
}

function MatchStars({ score }: { score?: number }) {
  const count = stars(score);
  return <span className="mh-stars" aria-label={`${count} out of 5 match stars`}>
    {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={12} fill={value <= count ? 'currentColor' : 'none'} />)}
  </span>;
}

function MatchScore({ score }: { score?: number }) {
  return <span className="mh-score" aria-label={`${score || 0} percent match`}>{score || 0}% Match</span>;
}

function EmptyMatchState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="mh-empty">
    <span><Sparkles size={20} /></span><div><strong>{title}</strong><p>{text}</p></div>
    <button className="secondary-button" onClick={onAction}>{action}</button>
  </div>;
}

function SectionHeading({ icon: Icon, title, subtitle, action, onAction }: { icon: typeof Heart; title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <header className="mh-section-head">
    <div><span className="mh-section-icon"><Icon size={18} /></span><div><h2>{title}</h2><p>{subtitle}</p></div></div>
    {action && <button onClick={onAction}>{action}<ArrowRight size={14} /></button>}
  </header>;
}

function JobMatchCard({ job, featured, saved, onSave, onLike, onPass, onView, onTalk }: {
  job: Job; featured?: boolean; saved: boolean; onSave: () => void; onLike: () => void; onPass: () => void; onView: () => void; onTalk: () => void;
}) {
  const matched = job.match?.matchedSkills?.length || 0;
  const newJob = Boolean(job.createdAt && Date.now() - job.createdAt < 72 * 60 * 60 * 1000);
  return <article className={featured ? 'mh-job-card featured' : 'mh-job-card'}>
    <div className="mh-job-top">
      <span className="mh-company-logo" style={{ background: job.accent }}>{job.logo || job.company.slice(0, 2).toUpperCase()}</span>
      <div><strong>{job.company}</strong><small>{job.status?.toLowerCase() === 'active' ? 'Actively hiring' : job.status}</small></div>
      <button className={saved ? 'mh-icon-btn saved' : 'mh-icon-btn'} onClick={onSave} aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>
    </div>
    <h3>{job.title}</h3>
    <div className="mh-score-row"><MatchScore score={job.match?.score} /><MatchStars score={job.match?.score} />{newJob && <span className="mh-new">New</span>}</div>
    <dl className="mh-facts">
      <div><MapPin size={14} /><span>{job.location}</span></div>
      <div><Building2 size={14} /><span>{job.workMode}{job.hybridDays ? ` · ${job.hybridDays} days/week` : ''}</span></div>
      <div><BriefcaseBusiness size={14} /><span>{job.salaryHidden ? 'Salary unlocks after mutual match' : job.salary}</span></div>
      <div><Check size={14} /><span>{matched} matching skill{matched === 1 ? '' : 's'}</span></div>
    </dl>
    {(job.requiredSkills || []).length > 0 && <div className="mh-skill-row">{job.requiredSkills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div>}
    <div className="mh-card-actions">
      <button className="secondary-button" onClick={onView}>View Match</button>
      <button className="mh-like" onClick={onLike} aria-label={`Like ${job.title}`}><Heart size={17} fill="currentColor" /></button>
      <button className="mh-pass" onClick={onPass} aria-label={`Pass on ${job.title}`}><X size={16} /></button>
      <button className="primary-button" onClick={onTalk}><Coffee size={16} /> Let’s Talk</button>
    </div>
  </article>;
}

function CandidateMatchCard({ candidate, saved, onSave, onLike, onPass, onView, onTalk }: {
  candidate: Person; saved: boolean; onSave: () => void; onLike: () => void; onPass: () => void; onView: () => void; onTalk: () => void;
}) {
  const parts = candidate.name.trim().split(/\s+/);
  const publicName = parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : candidate.name;
  return <article className="mh-person-card">
    <div className="mh-person-photo"><img src={candidate.photo} alt={`${publicName}, ${candidate.title}`} />{candidate.likedYou && <span><Heart size={11} fill="currentColor" /> Liked your role</span>}</div>
    <div className="mh-person-score"><MatchScore score={candidate.match?.score} /><MatchStars score={candidate.match?.score} /></div>
    <h3>{publicName}</h3><p>{candidate.title}</p>
    <div className="mh-person-meta"><span><MapPin size={12} />{candidate.location || [candidate.city, candidate.country].filter(Boolean).join(', ')}</span><span className="available">● Available {candidate.availability || candidate.preferences?.availability || 'soon'}</span></div>
    <div className="mh-skill-row">{(candidate.match?.matchedSkills?.length ? candidate.match.matchedSkills : candidate.skills).slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div>
    <div className="mh-compat"><span><Check size={12} /> Work mode</span><span><Check size={12} /> Salary fit</span></div>
    <div className="mh-person-actions">
      <button onClick={onLike} aria-label={`Like ${publicName}`}><Heart size={17} /></button>
      <button onClick={onPass} aria-label={`Pass on ${publicName}`}><X size={17} /></button>
      <button onClick={onSave} className={saved ? 'saved' : ''} aria-label={`Save ${publicName}`}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>
      <button onClick={onTalk} aria-label={`Start a conversation with ${publicName}`}><Coffee size={17} /></button>
    </div>
    <button className="mh-view-profile" onClick={onView}>View Profile <ArrowRight size={13} /></button>
  </article>;
}

function CandidateProfileModal({ candidate, onClose, onTalk }: { candidate: Person; onClose: () => void; onTalk: () => void }) {
  return <div className="mh-modal-scrim" role="presentation" onMouseDown={onClose}>
    <section className="mh-profile-modal" role="dialog" aria-modal="true" aria-label={`Recruiter view of ${candidate.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="overline">Canonical recruiter profile</span><h2>{candidate.name}</h2></div><button onClick={onClose} aria-label="Close profile"><X /></button></header>
      <CandidateCards person={candidate} match={candidate.match} />
      <footer><button className="secondary-button" onClick={onClose}>Back</button><button className="primary-button" onClick={onTalk}><Coffee size={16} /> Let’s Talk</button></footer>
    </section>
  </div>;
}

export function CandidateHome({ data, setData, navigate, onEditProfile }: HomeProps) {
  const [busyId, setBusyId] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const jobs = useMemo(() => [...data.jobs].sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0)), [data.jobs]);
  const visibleJobs = jobs.slice(0, 6);
  const interested = jobs.filter((job) => job.likedYou || job.superLikedYou);
  const conversations = data.matches.slice(0, 3);
  const reload = async () => setData(await api.bootstrap(data.viewer.id));
  const toggleSave = async (job: Job) => {
    setBusyId(job.id);
    try { await api.toggleBookmark({ userId: data.viewer.id, targetId: job.id, targetType: 'job' }); await reload(); } finally { setBusyId(''); }
  };
  const actOnJob = async (job: Job, direction: 'like' | 'pass', talk = false) => {
    setBusyId(job.id);
    try {
      const result = await api.swipe({ actorId: data.viewer.id, targetId: job.id, targetType: 'job', direction });
      await reload();
      if (talk && result.match) navigate('messages');
      else if (talk) navigate('matches');
    } finally { setBusyId(''); }
  };
  const completion = data.viewer.completeness || 0;
  return <main className="page match-home candidate-home">
    <section className="mh-hero">
      <div><span className="overline">Your JobMatch home</span><h1>Good morning, {firstName(data.viewer.name)} <span aria-hidden="true">👋</span></h1>
        <h2>The right roles are already looking for you.</h2>
        <p>Your profile is {completion}% complete and matching with {jobs.length} relevant opportunities.</p>
        <div className="mh-hero-actions"><button className="primary-button" onClick={() => navigate('discover')}>Explore Matches</button><button className="secondary-button" onClick={() => navigate('profile')}>Preview as Recruiter</button></div>
      </div>
      <aside className="mh-strength"><div className="mh-ring" style={{ '--value': `${completion * 3.6}deg` } as React.CSSProperties}><strong>{completion}%</strong></div><b>Profile strength</b><span><Eye size={13} />{Math.max(interested.length * 3, 1)} recruiter views</span><span><Heart size={13} />{interested.length} interested</span><small><i /> Visible to recruiters</small></aside>
    </section>

    <section className="mh-summary" aria-label="Your recent activity">
      {[
        { icon: Heart, label: 'Jobs Chasing You', value: jobs.length, note: `${Math.min(4, jobs.length)} new this week`, action: 'View jobs', view: 'discover' as View },
        { icon: Eye, label: 'Recruiters Checking You Out', value: Math.max(interested.length * 3, 1), note: `${interested.length} showing interest`, action: 'See activity', view: 'home' as View },
        { icon: UserRound, label: 'Recruiters Like You', value: interested.length, note: interested.length ? 'New interest waiting' : 'Keep strengthening', action: 'See who', view: 'matches' as View },
        { icon: Coffee, label: 'Let’s Talk Invitations', value: conversations.length, note: `${data.messages.length} recent messages`, action: 'Open conversations', view: 'messages' as View },
      ].map((item) => <button key={item.label} className="mh-summary-card" onClick={() => navigate(item.view)}><span><item.icon size={17} /></span><small>{item.label}</small><strong>{item.value}</strong><p>{item.note}</p><b>{item.action}<ArrowRight size={12} /></b></button>)}
    </section>

    <section className="mh-section">
      <SectionHeading icon={Heart} title="Jobs Chasing You" subtitle="Your strongest opportunities, ranked by compatibility." action="Explore all" onAction={() => navigate('discover')} />
      {visibleJobs.length ? <div className="mh-job-grid">{visibleJobs.map((job, index) => <JobMatchCard key={job.id} job={job} featured={index === 0} saved={data.bookmarkedIds.includes(job.id)} onSave={() => void toggleSave(job)} onLike={() => void actOnJob(job, 'like')} onPass={() => void actOnJob(job, 'pass')} onView={() => setSelectedJob(job)} onTalk={() => void actOnJob(job, 'like', true)} />)}</div>
        : <EmptyMatchState title="Your perfect role is still looking for you" text="Complete your skills and preferences to improve your matches." action="Improve My Profile" onAction={() => onEditProfile(1)} />}
      {busyId && <span className="mh-saving" role="status">Updating your matches…</span>}
    </section>

    <section className="mh-lower-grid">
      <div className="mh-panel">
        <SectionHeading icon={Eye} title="Recruiters Checking You Out" subtitle="Companies showing genuine interest." />
        {interested.length ? <div className="mh-activity-list">{interested.slice(0, 4).map((job, index) => <button key={job.id} onClick={() => navigate('discover')}><span className="mh-company-logo small" style={{ background: job.accent }}>{job.logo}</span><span><strong>{job.company}</strong><small>{job.superLikedYou ? 'sent you a Super Match' : 'liked your profile'} · {index ? `${index + 1}h ago` : 'Recently'}</small></span><ArrowRight size={14} /></button>)}</div>
          : <p className="mh-panel-empty">A stronger profile helps the right recruiters discover you.</p>}
      </div>
      <div className="mh-panel">
        <SectionHeading icon={MessageCircle} title="Conversations" subtitle="Mutual matches ready to continue." action="See all" onAction={() => navigate('messages')} />
        {conversations.length ? <div className="mh-conversations">{conversations.map((match) => <button key={match.id} onClick={() => navigate('messages')}><img src={match.employer?.photo || data.viewer.photo} alt="" /><span><strong>{match.employer?.name || match.job.company}</strong><small>{match.job.title}</small></span><b>{data.messages.filter((message) => message.matchId === match.id).at(-1)?.text || 'Your match is ready to talk'}</b></button>)}</div>
          : <p className="mh-panel-empty">Your next conversation starts with a mutual match.</p>}
      </div>
      <div className="mh-panel mh-recommend">
        <SectionHeading icon={Sparkles} title="Make Your Profile Stronger" subtitle="Three quick improvements." />
        {[
          { title: 'Add salary expectations', note: '+15% match clarity', step: 2 },
          { title: 'Polish your technical stack', note: 'Show verified strengths', step: 1 },
          { title: 'Add a recommendation', note: '+20% recruiter trust', step: 5 },
        ].map((item) => <button key={item.title} onClick={() => onEditProfile(item.step)}><span><Pencil size={14} /></span><div><strong>{item.title}</strong><small>{item.note}</small></div><ArrowRight size={14} /></button>)}
        <button className="secondary-button" onClick={() => onEditProfile(0)}>Complete My Profile</button>
      </div>
    </section>
    {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
  </main>;
}

export function RecruiterHome({ data, setData, navigate }: HomeProps) {
  const [selected, setSelected] = useState<Person | null>(null);
  const [busyId, setBusyId] = useState('');
  const groups: RoleMatchGroup[] = data.roleMatches?.length ? data.roleMatches : data.jobs.filter((job) => job.employerId === data.viewer.id).map((job) => ({ job, candidates: data.candidates, interestedCount: data.candidates.filter((candidate) => candidate.likedYou).length, newCount: 0 }));
  const activeGroups = groups.length ? groups : data.jobs.slice(0, 1).map((job) => ({ job, candidates: data.candidates, interestedCount: 0, newCount: 0 }));
  const candidates = activeGroups.flatMap((group) => group.candidates);
  const uniqueCandidates = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const refresh = async () => setData(await api.bootstrap(data.viewer.id));
  const swipe = async (candidate: Person, direction: 'like' | 'pass', talk = false) => {
    setBusyId(candidate.id);
    try {
      const result = await api.swipe({ actorId: data.viewer.id, targetId: candidate.id, targetType: 'candidate', direction });
      await refresh();
      if (talk && result.match) navigate('messages');
      else if (talk) navigate('matches');
    } finally { setBusyId(''); }
  };
  const save = async (candidate: Person) => {
    setBusyId(candidate.id);
    try { await api.toggleBookmark({ userId: data.viewer.id, targetId: candidate.id, targetType: 'candidate' }); await refresh(); } finally { setBusyId(''); }
  };
  const conversations = data.matches.length;
  return <main className="page match-home recruiter-home">
    <header className="mh-recruiter-head"><div><span className="overline">Your hiring home</span><h1>Good morning, {firstName(data.viewer.name)} <span aria-hidden="true">👋</span></h1><p>Here’s who loves your jobs today.</p></div><button className="primary-button" onClick={() => navigate('jobs')}>+ Create a New Job</button></header>
    <section className="mh-summary recruiter">
      {[
        { icon: Heart, label: 'People Who Love Your Jobs', value: [...uniqueCandidates.values()].filter((candidate) => candidate.likedYou).length, note: 'genuine interest' },
        { icon: Eye, label: 'Viewed Your Jobs', value: uniqueCandidates.size, note: 'qualified people' },
        { icon: Coffee, label: 'Coffee Requests', value: data.calls.length, note: 'awaiting' },
        { icon: MessageCircle, label: 'Active Conversations', value: conversations, note: 'ongoing' },
        { icon: TrendingUp, label: 'Perfect Matches', value: [...uniqueCandidates.values()].filter((candidate) => (candidate.match?.score || 0) >= 90).length, note: '90% and above' },
      ].map((item) => <button key={item.label} className="mh-summary-card" onClick={() => navigate(item.label.includes('Conversation') ? 'messages' : 'home')}><span><item.icon size={17} /></span><small>{item.label}</small><strong>{item.value}</strong><p>{item.note}</p></button>)}
    </section>

    <section className="mh-section">
      <SectionHeading icon={Heart} title="People Who Love This Job" subtitle="Interested candidates grouped by role and ranked by match quality." />
      {activeGroups.length ? <div className="mh-role-list">{activeGroups.map((group, groupIndex) => <section className={groupIndex === 0 ? 'mh-role-block expanded' : 'mh-role-block'} key={group.job.id}>
        <header><span className="mh-role-icon"><Target size={16} /></span><div><h3>{group.job.title}</h3><p>{group.interestedCount} people love this job · {group.newCount} new today</p></div><button onClick={() => navigate('discover')}>View all candidates <ArrowRight size={13} /></button></header>
        <div className="mh-candidate-row">{group.candidates.slice(0, groupIndex === 0 ? 5 : 4).map((candidate) => <CandidateMatchCard key={`${group.job.id}-${candidate.id}`} candidate={candidate} saved={data.bookmarkedIds.includes(candidate.id)} onSave={() => void save(candidate)} onLike={() => void swipe(candidate, 'like')} onPass={() => void swipe(candidate, 'pass')} onView={() => setSelected(candidate)} onTalk={() => void swipe(candidate, 'like', true)} />)}</div>
      </section>)}</div> : <EmptyMatchState title="The right people have not found this role yet" text="Improve the job profile, salary transparency, skills, and team culture." action="Improve Job Profile" onAction={() => navigate('jobs')} />}
      {busyId && <span className="mh-saving" role="status">Updating candidate activity…</span>}
    </section>

    <section className="mh-recruiter-lower">
      <div className="mh-panel"><SectionHeading icon={Eye} title="Recently Viewed Your Jobs" subtitle="Fresh candidate attention." />{[...uniqueCandidates.values()].slice(0, 4).map((candidate) => <button className="mh-mini-person" key={candidate.id} onClick={() => setSelected(candidate)}><img src={candidate.photo} alt="" /><span><strong>{candidate.name}</strong><small>Viewed a role recently</small></span><ArrowRight size={13} /></button>)}</div>
      <div className="mh-panel"><SectionHeading icon={Coffee} title="Coffee Requests" subtitle="Conversations moving forward." />{data.matches.slice(0, 4).map((match) => <button className="mh-mini-person" key={match.id} onClick={() => navigate('messages')}><img src={match.candidate.photo} alt="" /><span><strong>{match.candidate.name}</strong><small>{match.job.title}</small></span><ArrowRight size={13} /></button>)}</div>
      <div className="mh-panel"><SectionHeading icon={MessageCircle} title="Active Conversations" subtitle="Keep the momentum going." />{data.matches.slice(0, 4).map((match) => <button className="mh-mini-person" key={match.id} onClick={() => navigate('messages')}><img src={match.candidate.photo} alt="" /><span><strong>{match.candidate.name}</strong><small>{data.messages.filter((message) => message.matchId === match.id).at(-1)?.text || 'Ready to talk'}</small></span><ArrowRight size={13} /></button>)}</div>
    </section>
    {selected && <CandidateProfileModal candidate={selected} onClose={() => setSelected(null)} onTalk={() => { const candidate = selected; setSelected(null); void swipe(candidate, 'like', true); }} />}
  </main>;
}
