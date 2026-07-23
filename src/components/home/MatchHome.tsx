import { useMemo, useState } from 'react';
import {
  ArrowRight, Bookmark, Check, ChevronDown, Coffee, Eye, Heart, MapPin,
  MessageCircle, Pencil, Sparkles, Star, Target, TrendingUp, X,
} from 'lucide-react';
import { api } from '../../api';
import type { Bootstrap, Job, MatchEvidence, Person, RoleMatchGroup, View } from '../../types';
import { JobDetailModal } from '../coach/CoachModals';
import { JobHeaderBadge } from '../jobs/JobHeaderBadge';
import { CandidateCards } from '../profile/CandidateCards';

type HomeProps = {
  data: Bootstrap;
  setData: (data: Bootstrap) => void;
  navigate: (view: View) => void;
  onEditProfile: (step: number) => void;
};

function firstName(name?: string) {
  return (name || 'there').trim().split(/\s+/)[0];
}

function factorScore(match: MatchEvidence | undefined, factor: string) {
  return match?.breakdown?.find((item) => item.factor === factor)?.score || 0;
}

function isStrongMatch(match?: MatchEvidence) {
  return (match?.score || 0) >= 90
    && factorScore(match, 'skills') >= 0.9
    && factorScore(match, 'salary') >= 0.6
    && (factorScore(match, 'distance') >= 0.85 || factorScore(match, 'workMode') >= 0.8);
}

function stars(score = 0) {
  if (score >= 95) return 5;
  if (score >= 90) return 4;
  if (score >= 80) return 3;
  if (score >= 70) return 2;
  return 1;
}

function MatchStars({ score }: { score?: number }) {
  const count = stars(score);
  return <span className="mh-stars" aria-label={`${count} out of 5 match stars`}>
    {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={11} fill={value <= count ? 'currentColor' : 'none'} />)}
  </span>;
}

function MatchScore({ score }: { score?: number }) {
  return <span className="mh-score" aria-label={`${score || 0} percent match`}>{score || 0}% Match</span>;
}

function MatchEvidenceRow({ match }: { match?: MatchEvidence }) {
  const evidence = [
    ['Skills', factorScore(match, 'skills')],
    ['Salary', factorScore(match, 'salary')],
    ['Location', factorScore(match, 'distance')],
    ['Work mode', factorScore(match, 'workMode')],
  ] as const;
  return <div className="mh-evidence" aria-label="Match evidence">
    {evidence.map(([label, score]) => <span className={score >= (label === 'Salary' ? .6 : .8) ? 'fit' : 'partial'} key={label}>
      <Check size={10} />{label}<b>{Math.round(score * 100)}%</b>
    </span>)}
  </div>;
}

function EmptyMatchState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="mh-empty">
    <span><Sparkles size={20} /></span><div><strong>{title}</strong><p>{text}</p></div>
    <button className="secondary-button" onClick={onAction}>{action}</button>
  </div>;
}

function SectionHeading({ icon: Icon, title, subtitle, action, onAction }: {
  icon: typeof Heart; title: string; subtitle: string; action?: string; onAction?: () => void;
}) {
  return <header className="mh-section-head">
    <div><span className="mh-section-icon"><Icon size={17} /></span><div><h2>{title}</h2><p>{subtitle}</p></div></div>
    {action && <button onClick={onAction}>{action}<ArrowRight size={14} /></button>}
  </header>;
}

function JobMatchCard({ job, featured, saved, onSave, onLike, onPass, onView, onTalk }: {
  job: Job; featured?: boolean; saved: boolean; onSave: () => void; onLike: () => void; onPass: () => void; onView: () => void; onTalk: () => void;
}) {
  const matched = job.match?.matchedSkills?.length || 0;
  return <article className={featured ? 'mh-job-card featured' : 'mh-job-card'}>
    <JobHeaderBadge job={job} actions={<button className={saved ? 'mh-icon-btn saved' : 'mh-icon-btn'} onClick={onSave} aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button>} />
    <div className="mh-score-row"><MatchScore score={job.match?.score} /><MatchStars score={job.match?.score} /><span>{matched} matching skills</span></div>
    <MatchEvidenceRow match={job.match} />
    <div className="mh-skill-row">{(job.match?.matchedSkills?.length ? job.match.matchedSkills : job.requiredSkills).slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div>
    <div className="mh-card-actions">
      <button className="secondary-button" onClick={onView}>View Match</button>
      <button className="mh-like" onClick={onLike} aria-label={`Like ${job.title}`}><Heart size={16} fill="currentColor" /></button>
      <button className="mh-pass" onClick={onPass} aria-label={`Pass on ${job.title}`}><X size={16} /></button>
      <button className="primary-button" onClick={onTalk}><Coffee size={15} /> Let’s Talk</button>
    </div>
  </article>;
}

function CandidateMatchCard({ candidate, saved, likedLabel, onSave, onLike, onPass, onView, onTalk }: {
  candidate: Person; saved: boolean; likedLabel?: string; onSave: () => void; onLike: () => void; onPass: () => void; onView: () => void; onTalk: () => void;
}) {
  const parts = candidate.name.trim().split(/\s+/);
  const publicName = parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : candidate.name;
  return <article className="mh-person-card">
    <div className="mh-person-photo"><img src={candidate.photo} alt={`${publicName}, ${candidate.title}`} />{likedLabel && <span><Heart size={10} fill="currentColor" /> {likedLabel}</span>}</div>
    <div className="mh-person-score"><MatchScore score={candidate.match?.score} /><MatchStars score={candidate.match?.score} /></div>
    <h3>{publicName}</h3><p>{candidate.title}</p>
    <div className="mh-person-meta"><span><MapPin size={11} />{candidate.location || [candidate.city, candidate.country].filter(Boolean).join(', ')}</span><span className="available">● Available {candidate.availability || candidate.preferences?.availability || 'soon'}</span></div>
    <MatchEvidenceRow match={candidate.match} />
    <div className="mh-skill-row">{(candidate.match?.matchedSkills?.length ? candidate.match.matchedSkills : candidate.skills).slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div>
    <div className="mh-person-actions">
      <button onClick={onLike} aria-label={`Like ${publicName}`}><Heart size={16} /></button>
      <button onClick={onPass} aria-label={`Pass on ${publicName}`}><X size={16} /></button>
      <button onClick={onSave} className={saved ? 'saved' : ''} aria-label={`Save ${publicName}`}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button>
      <button onClick={onTalk} aria-label={`Start a conversation with ${publicName}`}><Coffee size={16} /></button>
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

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function CandidateHome({ data, setData, navigate, onEditProfile }: HomeProps) {
  const [busyId, setBusyId] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const jobs = useMemo(() => [...data.jobs].sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0)), [data.jobs]);
  const chasingJobs = jobs.filter((job) => job.likedYou || job.superLikedYou);
  const wantedJobs = jobs.filter((job) => isStrongMatch(job.match));
  const savedJobs = jobs.filter((job) => data.bookmarkedIds.includes(job.id));
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
      if (talk) navigate(result.match ? 'messages' : 'matches');
    } finally { setBusyId(''); }
  };
  const jobCard = (job: Job, index = 1) => <JobMatchCard key={job.id} job={job} featured={index === 0} saved={data.bookmarkedIds.includes(job.id)}
    onSave={() => void toggleSave(job)} onLike={() => void actOnJob(job, 'like')} onPass={() => void actOnJob(job, 'pass')}
    onView={() => setSelectedJob(job)} onTalk={() => void actOnJob(job, 'like', true)} />;
  const completion = data.viewer.completeness || 0;

  return <main className="page match-home candidate-home">
    <section className="mh-hero">
      <div><span className="overline">Your candidate home</span><h1>Good morning, {firstName(data.viewer.name)} <span aria-hidden="true">👋</span></h1>
        <h2>The right roles are already looking for you.</h2>
        <p>Your profile is {completion}% complete and currently has {wantedJobs.length} precise 90%+ opportunities.</p>
        <div className="mh-hero-actions"><button className="primary-button" onClick={() => navigate('discover')}>Explore Matches</button><button className="secondary-button" onClick={() => navigate('profile')}>Preview as Recruiter</button></div>
      </div>
      <aside className="mh-strength"><div className="mh-ring" style={{ '--value': `${completion * 3.6}deg` } as React.CSSProperties}><strong>{completion}%</strong></div><b>Profile strength</b><span><Eye size={13} />{Math.max(chasingJobs.length * 3, 1)} profile views this week</span><span><Heart size={13} />{chasingJobs.length} recruiters interested</span><small><i /> Visible to recruiters</small></aside>
    </section>

    <section className="mh-summary" aria-label="Candidate opportunity summary">
      {[
        { icon: Heart, label: 'Jobs Chasing You', value: chasingJobs.length, note: 'active offers', action: 'View jobs', target: 'chasing-jobs' },
        { icon: Eye, label: 'Companies Checking You Out', value: Math.max(chasingJobs.length * 3, 1), note: 'profile views', action: 'See activity', target: 'companies-checking' },
        { icon: Target, label: 'Recruiters Like You', value: chasingJobs.length, note: 'showed interest', action: 'See who', target: 'chasing-jobs' },
        { icon: Coffee, label: 'Let’s Talk Invitations', value: conversations.length, note: `${data.messages.length} recent messages`, action: 'View invites', target: 'messages' },
      ].map((item) => <button key={item.label} className="mh-summary-card" onClick={() => item.target === 'messages' ? navigate('messages') : scrollToSection(item.target)}><span><item.icon size={17} /></span><small>{item.label}</small><strong>{item.value}</strong><p>{item.note}</p><b>{item.action}<ArrowRight size={12} /></b></button>)}
    </section>

    <section className="mh-section" id="chasing-jobs">
      <SectionHeading icon={Heart} title="Jobs Chasing You" subtitle="Job offers from recruiters who already liked your profile." action="See all offers" onAction={() => navigate('matches')} />
      {chasingJobs.length ? <div className="mh-job-grid">{chasingJobs.slice(0, 3).map(jobCard)}</div>
        : <EmptyMatchState title="No recruiter likes yet" text="Your profile is visible. Strengthen it while the right recruiters discover you." action="Strengthen My Profile" onAction={() => onEditProfile(0)} />}
    </section>

    <section className="mh-section" id="wanted-jobs">
      <SectionHeading icon={Target} title="Jobs That Match Your Wants" subtitle="90%+ overall fit with strong skills, salary, location, and work-mode compatibility." action="Explore all matches" onAction={() => navigate('discover')} />
      {wantedJobs.length ? <div className="mh-job-grid compact">{wantedJobs.slice(0, 3).map(jobCard)}</div>
        : <EmptyMatchState title="No precise 90%+ matches yet" text="Add salary, location, and work-mode preferences so matching can be more exact." action="Update Preferences" onAction={() => onEditProfile(2)} />}
    </section>

    <section className="mh-section" id="saved-jobs">
      <SectionHeading icon={Bookmark} title="Saved Job Offers" subtitle="The opportunities you bookmarked and may want to apply to." action="Explore more jobs" onAction={() => navigate('discover')} />
      {savedJobs.length ? <div className="mh-job-grid saved">{savedJobs.slice(0, 3).map(jobCard)}</div>
        : <EmptyMatchState title="Nothing saved yet" text="Save promising offers to compare them here before you apply." action="Find Roles" onAction={() => navigate('discover')} />}
      {busyId && <span className="mh-saving" role="status">Updating your opportunities…</span>}
    </section>

    <section className="mh-lower-grid">
      <div className="mh-panel" id="companies-checking"><SectionHeading icon={Eye} title="Companies Checking You Out" subtitle="Companies showing genuine interest." />
        {chasingJobs.length ? <div className="mh-activity-list">{chasingJobs.slice(0, 4).map((job, index) => <button key={job.id} onClick={() => setSelectedJob(job)}><span className="mh-activity-logo"><JobHeaderBadge job={job} compact /></span><span><strong>{job.company}</strong><small>{job.superLikedYou ? 'sent a Super Match' : 'liked your profile'} · {index ? `${index + 1}h ago` : 'Recently'}</small></span><ArrowRight size={14} /></button>)}</div> : <p className="mh-panel-empty">Complete your profile to attract more relevant recruiters.</p>}
      </div>
      <div className="mh-panel"><SectionHeading icon={MessageCircle} title="Conversations" subtitle="Mutual matches ready to continue." action="See all" onAction={() => navigate('messages')} />
        {conversations.length ? <div className="mh-conversations">{conversations.map((match) => <button key={match.id} onClick={() => navigate('messages')}><img src={match.employer?.photo || data.viewer.photo} alt="" /><span><strong>{match.employer?.name || match.job.company}</strong><small>{match.job.title}</small></span><b>{data.messages.filter((message) => message.matchId === match.id).at(-1)?.text || 'Your match is ready to talk'}</b></button>)}</div> : <p className="mh-panel-empty">Your next conversation starts with a mutual match.</p>}
      </div>
      <div className="mh-panel mh-recommend"><SectionHeading icon={Sparkles} title="Make Your Profile Stronger" subtitle="Three quick improvements." />
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
  const groups: RoleMatchGroup[] = data.roleMatches?.length ? data.roleMatches : data.jobs.filter((job) => job.employerId === data.viewer.id).map((job) => {
    const candidates = data.candidates.filter((candidate) => candidate.likedYou);
    return { job, candidates, matchingCandidates: data.candidates.filter((candidate) => isStrongMatch(candidate.match)), interestedCount: candidates.length, newCount: 0 };
  });
  const activeGroups = groups.length ? groups : data.jobs.slice(0, 1).map((job) => ({ job, candidates: [], matchingCandidates: [], interestedCount: 0, newCount: 0 }));
  const [expandedRoleId, setExpandedRoleId] = useState(activeGroups[0]?.job.id || '');
  const allCandidates = activeGroups.flatMap((group) => [...group.candidates, ...(group.matchingCandidates || [])]);
  const uniqueCandidates = new Map(allCandidates.map((candidate) => [candidate.id, candidate]));
  const lovedCandidates = new Map(activeGroups.flatMap((group) => group.candidates).map((candidate) => [candidate.id, candidate]));
  const topGroup = [...activeGroups].sort((a, b) => ((b.matchingCandidates?.length || 0) + b.candidates.length) - ((a.matchingCandidates?.length || 0) + a.candidates.length))[0];
  const refresh = async () => setData(await api.bootstrap(data.viewer.id));

  const swipe = async (candidate: Person, direction: 'like' | 'pass', talk = false) => {
    setBusyId(candidate.id);
    try {
      const result = await api.swipe({ actorId: data.viewer.id, targetId: candidate.id, targetType: 'candidate', direction });
      await refresh();
      if (talk) navigate(result.match ? 'messages' : 'matches');
    } finally { setBusyId(''); }
  };
  const save = async (candidate: Person) => {
    setBusyId(candidate.id);
    try { await api.toggleBookmark({ userId: data.viewer.id, targetId: candidate.id, targetType: 'candidate' }); await refresh(); } finally { setBusyId(''); }
  };
  const candidateCard = (candidate: Person, liked = false, jobId = '') => <CandidateMatchCard key={`${jobId}-${candidate.id}-${liked ? 'liked' : 'matched'}`} candidate={candidate} likedLabel={liked ? 'Liked this job' : undefined}
    saved={data.bookmarkedIds.includes(candidate.id)} onSave={() => void save(candidate)} onLike={() => void swipe(candidate, 'like')}
    onPass={() => void swipe(candidate, 'pass')} onView={() => setSelected(candidate)} onTalk={() => void swipe(candidate, 'like', true)} />;

  return <main className="page match-home recruiter-home">
    <header className="mh-recruiter-head"><div><span className="overline">Your recruiter home</span><h1>Good morning, {firstName(data.viewer.name)} <span aria-hidden="true">👋</span></h1><p>Here’s who loves your jobs today.</p></div><button className="primary-button" onClick={() => navigate('jobs')}>+ Create a New Job</button></header>

    <section className="mh-summary recruiter" aria-label="Recruiter activity summary">
      {[
        { icon: Heart, label: 'People Who Love Your Jobs', value: lovedCandidates.size, note: 'showed intent first' },
        { icon: Eye, label: 'Viewed Your Jobs', value: uniqueCandidates.size, note: 'qualified people' },
        { icon: Coffee, label: 'Coffee Requests', value: data.calls.length, note: 'awaiting' },
        { icon: MessageCircle, label: 'Active Conversations', value: data.matches.length, note: 'ongoing' },
        { icon: TrendingUp, label: 'Top Performing Role', value: topGroup?.matchingCandidates?.length || 0, note: topGroup?.job.title || 'Create your first role' },
      ].map((item, index) => <button key={item.label} className={index === 4 ? 'mh-summary-card highlight' : 'mh-summary-card'} onClick={() => navigate(item.label.includes('Conversation') ? 'messages' : 'home')}><span><item.icon size={17} /></span><small>{item.label}</small><strong>{item.value}</strong><p>{item.note}</p></button>)}
    </section>

    <section className="mh-section recruiter-roles">
      <SectionHeading icon={Target} title="My Job Offers" subtitle="Open each role to compare genuine candidate interest with precise 90%+ matches." action="Manage job offers" onAction={() => navigate('jobs')} />
      {activeGroups.length ? <div className="mh-role-list">{activeGroups.map((group) => {
        const matching = (group.matchingCandidates || []).filter((candidate) => isStrongMatch(candidate.match));
        const expanded = expandedRoleId === group.job.id;
        return <section className={expanded ? 'mh-role-block expanded' : 'mh-role-block'} key={group.job.id}>
          <div className="mh-role-toggle" role="button" tabIndex={0} aria-expanded={expanded} onClick={() => setExpandedRoleId(expanded ? '' : group.job.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpandedRoleId(expanded ? '' : group.job.id); } }}>
            <JobHeaderBadge job={group.job} compact />
            <span className="mh-role-count"><Heart size={13} />{group.candidates.length} interested</span>
            <span className="mh-role-count match"><TrendingUp size={13} />{matching.length} precise matches</span>
            <ChevronDown className={expanded ? 'open' : ''} size={18} />
          </div>
          {expanded && <div className="mh-role-content">
            <section className="mh-candidate-lane">
              <SectionHeading icon={Heart} title="People Who Love This Job" subtitle="Candidates who explicitly liked this offer." action="View all candidates" onAction={() => navigate('discover')} />
              {group.candidates.length ? <div className="mh-candidate-row">{group.candidates.slice(0, 5).map((candidate) => candidateCard(candidate, true, group.job.id))}</div>
                : <p className="mh-role-empty">No candidate has liked this offer yet.</p>}
            </section>
            <section className="mh-candidate-lane matching">
              <SectionHeading icon={TrendingUp} title="Candidates Matching This Role" subtitle="90%+ overall score with skills, salary, location, and work-mode evidence." action="Explore candidates" onAction={() => navigate('discover')} />
              {matching.length ? <div className="mh-candidate-row">{matching.slice(0, 5).map((candidate) => candidateCard(candidate, false, group.job.id))}</div>
                : <p className="mh-role-empty">No candidates meet the full 90%+ rule yet. Refine the job’s salary, work mode, and required skills.</p>}
            </section>
          </div>}
        </section>;
      })}</div> : <EmptyMatchState title="No active job offers" text="Create a role to start matching with interested candidates." action="Create a Job Offer" onAction={() => navigate('jobs')} />}
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
