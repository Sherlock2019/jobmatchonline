import { useMemo, useState } from 'react';
import {
  ArrowRight, Bell, Bookmark, BriefcaseBusiness, Building2, Check, ChevronDown, Coffee,
  Eye, Heart, MapPin, MessageCircle, Pencil, Sparkles, Star, Target, TrendingUp, User, X,
} from 'lucide-react';
import { api } from '../../api';
import type { Bootstrap, Job, MatchEvidence, Note, Person, RoleMatchGroup, View } from '../../types';
import { JobDetailModal } from '../coach/CoachModals';
import { CandidateCards } from '../profile/CandidateCards';
import { CompanyLogoMark, JobHeaderBadge } from '../jobs/JobHeaderBadge';
import { NotesBox } from '../NotesBox';

type HomeProps = {
  data: Bootstrap;
  setData: (data: Bootstrap) => void;
  navigate: (view: View) => void;
  onEditProfile: (step: number) => void;
  onAddJobs?: () => void;
  onOpenMessages?: (matchId: string) => void;
  onEditJob?: (jobId: string) => void;
};

function firstName(name = 'there') {
  return name.trim().split(/\s+/)[0];
}

function factorScore(match: MatchEvidence | undefined, factor: string) {
  return match?.breakdown?.find((item) => item.factor === factor)?.score || 0;
}

function isPreciseMatch(match?: MatchEvidence) {
  return (match?.score || 0) >= 90
    && factorScore(match, 'skills') >= .9
    && factorScore(match, 'salary') >= .6
    && (factorScore(match, 'distance') >= .85 || factorScore(match, 'workMode') >= .8);
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Stars({ score = 0 }: { score?: number }) {
  const filled = score >= 95 ? 5 : score >= 90 ? 4 : score >= 80 ? 3 : 2;
  return <span className="td-stars" aria-label={`${filled} out of 5 match stars`}>
    {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={10} fill={star <= filled ? 'currentColor' : 'none'} />)}
  </span>;
}

export function DashboardTitle({ icon: Icon, title, subtitle, action, onAction }: {
  icon: typeof Heart; title: string; subtitle?: string; action?: string; onAction?: () => void;
}) {
  return <header className="td-section-title">
    <div><Icon size={16} /><span><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span></div>
    {action && <button onClick={onAction}>{action}<ArrowRight size={13} /></button>}
  </header>;
}

function CandidateJobCard({ job, recruiter, saved, onSave, onView, onTalk }: {
  job: Job; recruiter?: Person; saved: boolean; onSave: () => void; onView: () => void; onTalk: () => void;
}) {
  const skills = job.match?.matchedSkills?.length || 0;
  return <article className="td-job-card">
    <div className="td-job-top">
      <span className="td-score">{job.match?.score || 0}% Match</span>
      <button onClick={onSave} aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="td-job-identity">
      <CompanyLogoMark job={job} />
      <span><strong>{job.company}</strong><small>{job.title}</small></span>
    </div>
    <Stars score={job.match?.score} />
    <div className="td-job-facts">
      <span><MapPin size={11} />{job.location || 'Location flexible'}</span>
      <span><BriefcaseBusiness size={11} />{job.workMode} · {job.type}</span>
      <span>{job.salaryHidden ? 'Salary shared after mutual match' : job.salary}</span>
      <span><Check size={11} />{skills} matching skills</span>
    </div>
    <div className="td-recruiter-line">
      {recruiter?.photo ? <img src={recruiter.photo} alt="" /> : <span className="td-avatar-fallback">{job.company.slice(0, 1)}</span>}
      <span><strong>{recruiter?.name || job.company}</strong><small>{recruiter?.title || 'Hiring team'}</small></span>
    </div>
    <div className="td-job-actions">
      <button className="secondary-button" onClick={onView}>View Match</button>
      <button className="primary-button" onClick={onTalk}>Let’s Talk</button>
    </div>
  </article>;
}

function PersonCard({ person, saved, liked, onSave, onView, onTalk }: {
  person: Person; saved: boolean; liked?: boolean; onSave: () => void; onView: () => void; onTalk: () => void;
}) {
  return <article className="td-person-card">
    <span className="td-score">{person.match?.score || 0}% Match</span>
    <div className="td-person-photo"><img src={person.photo} alt="" /><i /></div>
    <strong>{person.name}</strong>
    <small>{person.title}</small>
    {person.company && <b>{person.company}</b>}
    <Stars score={person.match?.score} />
    <p><MapPin size={10} />{person.location || [person.city, person.country].filter(Boolean).join(', ') || 'Flexible location'}</p>
    <p className="available">● Available {person.availability || person.preferences?.availability || 'soon'}</p>
    <div className="td-person-skills">{(person.match?.matchedSkills?.length ? person.match.matchedSkills : person.skills).slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div>
    <div className="td-person-actions">
      <button onClick={onTalk} aria-label={`Like ${person.name}`}><Heart size={14} fill={liked ? 'currentColor' : 'none'} /></button>
      <button onClick={onView} aria-label={`View ${person.name}`}><Eye size={14} /></button>
      <button onClick={onSave} aria-label={`Save ${person.name}`}><Bookmark size={14} fill={saved ? 'currentColor' : 'none'} /></button>
    </div>
  </article>;
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="td-empty"><Sparkles size={18} /><span>{children}</span></div>;
}

/** Lightweight candidate row for the recruiter's per-job Matches / Loves-this-job lists. */
function CandidateRow({ person, matched, onView, onTalk }: { person: Person; matched?: boolean; onView: () => void; onTalk: () => void }) {
  return <div className="td-cand-row">
    <img src={person.photo} alt="" />
    <div className="td-cand-row-info"><strong>{person.name}</strong><small>{person.title}{person.company ? ` · ${person.company}` : ''}</small></div>
    <span className="td-cand-row-score">{person.match?.score || 0}%</span>
    <button className="td-cand-row-view" onClick={onView} aria-label={`View ${person.name}`}><Eye size={14} /></button>
    <button className={matched ? 'td-cand-row-talk matched' : 'td-cand-row-talk'} onClick={onTalk}>
      {matched ? <><MessageCircle size={13} /> Message</> : <><Heart size={13} /> Like back</>}
    </button>
  </div>;
}

export function CandidateProfileModal({ candidate, onClose, onTalk, viewerId, notes, onNoteSaved, unlocked }: {
  candidate: Person; onClose: () => void; onTalk?: () => void; viewerId?: string; notes?: Note[]; onNoteSaved?: (note: Note) => void; unlocked?: boolean;
}) {
  return <div className="mh-modal-scrim" role="presentation" onMouseDown={onClose}>
    <section className="mh-profile-modal" role="dialog" aria-modal="true" aria-label={`Recruiter view of ${candidate.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="overline">Canonical recruiter profile</span><h2>{candidate.name}</h2></div><button onClick={onClose} aria-label="Close profile"><X /></button></header>
      <CandidateCards person={candidate} match={candidate.match} unlocked={unlocked} />
      {viewerId && notes && onNoteSaved && <NotesBox viewerId={viewerId} targetId={candidate.id} targetType="candidate" notes={notes} onSaved={onNoteSaved} />}
      <footer><button className="secondary-button" onClick={onClose}>Back</button>{onTalk && <button className="primary-button" onClick={onTalk}><Coffee size={16} /> Let’s Talk</button>}</footer>
    </section>
  </div>;
}

/** What a recruiter actually sees pre-match: same 5-card deck, unlocked=false
 * so name/contact stay masked exactly as they would for a real recruiter. */
function ProfilePreviewModal({ viewer, onClose }: { viewer: Person; onClose: () => void }) {
  return <div className="mh-modal-scrim" role="presentation" onMouseDown={onClose}>
    <section className="mh-profile-modal" role="dialog" aria-modal="true" aria-label="How recruiters see your profile" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="overline">Recruiter preview</span><h2>{viewer.name}</h2></div><button onClick={onClose} aria-label="Close preview"><X /></button></header>
      <CandidateCards person={viewer} unlocked={false} visibilityInspector />
      <footer><button className="secondary-button" onClick={onClose}>Close preview</button></footer>
    </section>
  </div>;
}

export function CandidateHome({ data, setData, navigate, onEditProfile }: HomeProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const jobs = useMemo(() => [...data.jobs].sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0)), [data.jobs]);
  const matchedJobIds = new Set(data.matches.map((match) => match.jobId));
  const matchedJobs = jobs.filter((job) => matchedJobIds.has(job.id));
  // Jobs whose recruiter liked this candidate but the candidate hasn't liked back yet.
  const likesYou = jobs.filter((job) => (job.likedYou || job.superLikedYou) && !matchedJobIds.has(job.id));
  const precise = jobs.filter((job) => isPreciseMatch(job.match));
  const conversations = data.matches.slice(0, 3);
  const upcomingCalls = [...data.calls].filter((call) => call.startAt >= Date.now()).sort((a, b) => a.startAt - b.startAt);
  const completion = data.viewer.completeness || 0;

  const reload = async () => setData(await api.bootstrap(data.viewer.id));
  const [addingVariant, setAddingVariant] = useState(false);
  const [variantName, setVariantName] = useState('');
  const [variantTitle, setVariantTitle] = useState('');
  const [variantSkills, setVariantSkills] = useState('');
  const activateVariant = async (id: string) => { await api.activateProfileVariant(id, data.viewer.id); await reload(); };
  const removeVariant = async (id: string) => { await api.deleteProfileVariant(id, data.viewer.id); await reload(); };
  const startAddingVariant = () => {
    setVariantName(''); setVariantTitle(data.viewer.title || ''); setVariantSkills((data.viewer.skills || []).join(', '));
    setAddingVariant(true);
  };
  const saveVariant = async () => {
    if (!variantName.trim()) return;
    await api.saveProfileVariant({
      userId: data.viewer.id, name: variantName.trim(),
      title: variantTitle.trim() || undefined,
      skills: variantSkills.trim() ? variantSkills.split(',').map((skill) => skill.trim()).filter(Boolean) : undefined,
    });
    setAddingVariant(false);
    await reload();
  };
  const toggleSave = async (job: Job) => {
    await api.toggleBookmark({ userId: data.viewer.id, targetId: job.id, targetType: 'job' });
    await reload();
  };
  const startTalk = async (job: Job) => {
    const result = await api.swipe({ actorId: data.viewer.id, targetId: job.id, targetType: 'job', direction: 'like' });
    await reload();
    navigate(result.match ? 'messages' : 'matches');
  };
  const jobCards = (items: Job[]) => items.length
    ? <div className="td-job-grid">{items.slice(0, 3).map((job) => <CandidateJobCard key={job.id} job={job} recruiter={data.matches.find((match) => match.jobId === job.id)?.employer} saved={data.bookmarkedIds.includes(job.id)} onSave={() => void toggleSave(job)} onView={() => setSelectedJob(job)} onTalk={() => void startTalk(job)} />)}</div>
    : <EmptyRow>No recruiter offers yet. Your profile remains visible to matching teams.</EmptyRow>;

  const metrics = [
    { icon: Heart, label: 'Matches', value: matchedJobs.length, note: 'both said yes', action: 'View all', target: 'td-matches' },
    { icon: Target, label: 'Jobs that like you', value: likesYou.length, note: 'liked your profile', action: 'See who', target: 'td-chasing' },
    { icon: Coffee, label: 'Let’s Talk Invitations', value: conversations.length, note: 'invitations', action: 'View invites', target: 'messages' },
  ];

  return <main className="td-dashboard td-candidate">
    <section className="td-candidate-hero">
      <div>
        <h1>Good morning, {firstName(data.viewer.name)} <span>👋</span></h1>
        <h2>The right roles are already looking for you.</h2>
        <p>Your profile is {completion}% complete and already matching with {precise.length} relevant opportunities.</p>
        <div><button className="primary-button" onClick={() => navigate('discover')}>Explore Matches</button><button className="secondary-button" onClick={() => setPreviewing(true)}>Preview as Recruiter</button></div>
      </div>
      <aside className="td-profile-strength">
        <div className="mh-ring" style={{ '--value': `${completion * 3.6}deg` } as React.CSSProperties}><strong>{completion}%</strong></div>
        <b>Profile strength</b>
        <span><Eye size={11} /> {Math.max(likesYou.length * 3, 1)} profile views this week</span>
        <span><Heart size={11} /> {likesYou.length} recruiters interested</span>
        <small>● Visible to recruiters</small>
      </aside>
      <div className="td-hero-faces">{conversations.slice(0, 3).map((match) => <img key={match.id} src={match.employer?.photo || data.viewer.photo} alt="" />)}{conversations.length > 2 && <span>+{conversations.length}</span>}</div>
    </section>

    <section className="td-section" id="td-profile">
      <DashboardTitle icon={User} title="My Profile" subtitle="How recruiters see you." action="Edit profile" onAction={() => navigate('profile')} />
      <div className="td-profile-card">
        <img src={data.viewer.photo} alt="" />
        <div className="td-profile-card-info">
          <strong>{data.viewer.name}</strong>
          <span>{data.viewer.title}</span>
          <div className="td-profile-card-meta"><span>{completion}% complete</span>{data.viewer.location && <span>{data.viewer.location}</span>}</div>
        </div>
        <button className="secondary-button small" onClick={() => navigate('profile')}>View profile</button>
      </div>
      <div className="td-profile-variants">
        <span className="td-profile-variants-label">Profiles for different roles — switch which title/skills recruiters and matching see</span>
        <div className="td-variant-pills">
          {(data.viewer.profileVariants || []).map((variant) => <span key={variant.id} className={variant.id === data.viewer.activeVariantId ? 'td-variant-pill active' : 'td-variant-pill'}>
            <button onClick={() => void activateVariant(variant.id)} title={variant.title}>{variant.name}</button>
            <button className="td-variant-remove" aria-label={`Delete ${variant.name}`} onClick={() => void removeVariant(variant.id)}><X size={11} /></button>
          </span>)}
          {!addingVariant && <button className="td-variant-add" onClick={startAddingVariant}>+ Create Another Profile</button>}
        </div>
        {addingVariant && <div className="td-variant-form">
          <input value={variantName} onChange={(event) => setVariantName(event.target.value)} placeholder="Profile name, e.g. Frontend Engineer" autoFocus />
          <input value={variantTitle} onChange={(event) => setVariantTitle(event.target.value)} placeholder="Title for this persona" />
          <input value={variantSkills} onChange={(event) => setVariantSkills(event.target.value)} placeholder="Skills, comma separated" />
          <div className="td-variant-form-actions">
            <button className="secondary-button small" onClick={() => setAddingVariant(false)}>Cancel</button>
            <button className="primary-button small" onClick={() => void saveVariant()} disabled={!variantName.trim()}>Save profile</button>
          </div>
        </div>}
      </div>
    </section>

    <section className="td-metrics candidate" aria-label="Candidate summary">
      {metrics.map((metric) => <button key={metric.label} onClick={() => metric.target === 'messages' ? navigate('messages') : scrollTo(metric.target)}>
        <span><metric.icon size={15} /></span><small>{metric.label}</small><strong>{metric.value}</strong><p>{metric.note}</p><b>{metric.action}<ArrowRight size={10} /></b>
      </button>)}
    </section>

    <section className="td-section" id="td-matches">
      <DashboardTitle icon={Heart} title="Job Matches" subtitle="You and these teams both said yes — start the conversation." action={`See all (${matchedJobs.length})`} onAction={() => navigate('matches')} />
      {matchedJobs.length
        ? jobCards(matchedJobs)
        : <EmptyRow>No mutual matches yet. Like a role that likes you back and it lands here.</EmptyRow>}
    </section>

    <section className="td-section" id="td-chasing">
      <DashboardTitle icon={Target} title="Jobs that like you" subtitle="Recruiters who liked your profile — like back to match." action={`See all (${likesYou.length})`} onAction={() => navigate('discover')} />
      {jobCards(likesYou)}
    </section>

    <section className="td-bottom-grid">
      <article className="td-list-panel" id="td-conversations">
        <DashboardTitle icon={MessageCircle} title="Conversations" action="See all" onAction={() => navigate('messages')} />
        {conversations.map((match) => <button key={match.id} onClick={() => navigate('messages')}><img src={match.employer?.photo || data.viewer.photo} alt="" /><span><strong>{match.employer?.name || match.job.company}</strong><small>{data.messages.filter((message) => message.matchId === match.id).at(-1)?.text || match.job.title}</small></span></button>)}
      </article>
      <article className="td-list-panel" id="td-coffee">
        <DashboardTitle icon={Coffee} title="Coffee Invitations" action="See all" onAction={() => navigate('meetings')} />
        {upcomingCalls.length
          ? upcomingCalls.slice(0, 4).map((call) => {
            const callMatch = data.matches.find((m) => m.id === call.matchId);
            return <button key={call.id} onClick={() => navigate('meetings')}>
              <img src={callMatch?.employer?.photo || data.viewer.photo} alt="" />
              <span><strong>{callMatch?.employer?.name || callMatch?.job.company}</strong><small>{new Date(call.startAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · {call.title}</small></span>
            </button>;
          })
          : <EmptyRow>No meet-ups scheduled yet.</EmptyRow>}
      </article>
      <article className="td-list-panel td-improve">
        <DashboardTitle icon={Sparkles} title="Make Your Profile Stronger" />
        {[['Add salary expectations', '+15% match improvement', 2], ['Record a 60-sec introduction', '+27% recruiter response rate', 3], ['Add a recommendation', '+20% trust score', 5]].map(([title, note, step]) => <button key={title as string} onClick={() => onEditProfile(step as number)}><span><Pencil size={13} /></span><span><strong>{title}</strong><small>{note}</small></span></button>)}
        <button className="secondary-button" onClick={() => onEditProfile(0)}>Complete My Profile</button>
      </article>
    </section>

    <div className="td-tip"><Sparkles size={13} /> Tip: Profiles with salary and work-mode preferences get 3× more matches.</div>

    {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} viewerId={data.viewer.id} notes={data.notes} onNoteSaved={(note) => setData({ ...data, notes: [...data.notes.filter((n) => n.id !== note.id), note] })} />}
    {previewing && <ProfilePreviewModal viewer={data.viewer} onClose={() => setPreviewing(false)} />}
  </main>;
}

export function RecruiterHome({ data, setData, navigate, onAddJobs, onOpenMessages, onEditJob }: HomeProps) {
  const [selected, setSelected] = useState<Person | null>(null);
  const [expandedId, setExpandedId] = useState('');
  const [bestMatchFirst, setBestMatchFirst] = useState(true);
  const groups: RoleMatchGroup[] = data.roleMatches?.length
    ? data.roleMatches
    : data.jobs.filter((job) => job.employerId === data.viewer.id).map((job) => ({
      job,
      candidates: data.candidates.filter((candidate) => candidate.likedYou),
      matchingCandidates: data.candidates.filter((candidate) => isPreciseMatch(candidate.match)),
      interestedCount: 0,
      newCount: 0,
    }));
  const roles = groups.length ? groups : data.jobs.slice(0, 1).map((job) => ({ job, candidates: [], matchingCandidates: [], interestedCount: 0, newCount: 0 }));
  const openId = expandedId === '__none__' ? '' : expandedId || roles[0]?.job.id || '';
  const allPeople = [...new Map(roles.flatMap((group) => [...group.candidates, ...(group.matchingCandidates || [])]).map((person) => [person.id, person])).values()];
  const interested = [...new Map(roles.flatMap((group) => group.candidates).map((person) => [person.id, person])).values()];
  const topRole = [...roles].sort((a, b) => ((b.matchingCandidates?.length || 0) + b.candidates.length) - ((a.matchingCandidates?.length || 0) + a.candidates.length))[0];

  const reload = async () => setData(await api.bootstrap(data.viewer.id));
  const talk = async (person: Person) => {
    const result = await api.swipe({ actorId: data.viewer.id, targetId: person.id, targetType: 'candidate', direction: 'like' });
    await reload();
    navigate(result.match ? 'messages' : 'matches');
  };
  const sortFn = (a: Person, b: Person) => data.viewer.demo && (a.demoOrder || b.demoOrder)
    ? (a.demoOrder || 99) - (b.demoOrder || 99)
    : bestMatchFirst ? (b.match?.score || 0) - (a.match?.score || 0) : a.name.localeCompare(b.name);

  const upcomingCalls = [...data.calls].filter((call) => call.startAt >= Date.now()).sort((a, b) => a.startAt - b.startAt);
  const metrics = [
    { icon: Heart, label: 'People Who Love Your Jobs', value: interested.length, note: 'candidates', target: 'td-roles' },
    { icon: Eye, label: 'Viewed Your Jobs', value: allPeople.length, note: 'today', target: 'td-recent' },
    { icon: Coffee, label: 'Coffee Requests', value: upcomingCalls.length, note: 'awaiting', target: 'td-coffee' },
    { icon: MessageCircle, label: 'Active Conversations', value: data.matches.length, note: 'ongoing', target: 'messages' },
    { icon: TrendingUp, label: topRole?.job.title || 'Top Performing Role', value: topRole?.matchingCandidates?.length || 0, note: 'perfect matches', target: 'td-roles' },
  ];

  return <main className="td-dashboard td-recruiter">
    <header className="td-recruiter-head">
      <div><h1>Good morning, {firstName(data.viewer.name)} <span>👋</span></h1><p>Here’s who loves your jobs today.</p></div>
      <button className="primary-button" onClick={onAddJobs}>+ Add New Job Offers</button>
    </header>

    <section className="td-section" id="td-company-profile">
      <DashboardTitle icon={Building2} title="Company Profile" subtitle="How candidates see your company." action="Edit profile" onAction={() => navigate('profile')} />
      <div className="td-profile-card">
        <img src={data.viewer.photo} alt="" />
        <div className="td-profile-card-info">
          <strong>{data.viewer.company || data.viewer.name}</strong>
          <span>{data.viewer.title}</span>
          <div className="td-profile-card-meta">{data.viewer.industry && <span>{data.viewer.industry}</span>}{data.viewer.headquarters && <span>{data.viewer.headquarters}</span>}</div>
        </div>
        <button className="secondary-button small" onClick={() => navigate('profile')}>View profile</button>
      </div>
    </section>

    <section className="td-section td-role-section" id="td-roles">
      <DashboardTitle icon={BriefcaseBusiness} title="My Jobs" subtitle="Each role, with its matches and the candidates who love it — not matched yet." action={bestMatchFirst ? 'Sort by: Best Match' : 'Sort by: Name'} onAction={() => setBestMatchFirst((value) => !value)} />
      <div className="td-role-list">
        {roles.map((group) => {
          const open = group.job.id === openId;
          const matchedForJob = data.matches.filter((match) => match.jobId === group.job.id);
          const matchedIds = new Set(matchedForJob.map((match) => match.candidateId));
          const lovesNotMatched = [...group.candidates].filter((candidate) => !matchedIds.has(candidate.id)).sort(sortFn);
          return <article className={open ? 'td-role open' : 'td-role'} key={group.job.id}>
            <div className="td-role-head" role="button" tabIndex={0} onClick={() => setExpandedId(open ? '__none__' : group.job.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpandedId(open ? '__none__' : group.job.id); } }} aria-expanded={open}>
              <JobHeaderBadge job={group.job} compact actions={<button className="td-role-edit" onClick={(event) => { event.stopPropagation(); onEditJob?.(group.job.id); }} aria-label={`Edit ${group.job.title}`}><Pencil size={12} /></button>} />
              <span><Check size={12} /> {matchedForJob.length} matched</span>
              <span><Heart size={12} /> {lovesNotMatched.length} love this job</span>
              <button onClick={(event) => { event.stopPropagation(); navigate('discover'); }}>Review candidates <ArrowRight size={11} /></button>
              <ChevronDown size={16} />
            </div>
            {open && <div className="td-role-body">
              <div className="td-role-sublist">
                <span className="td-sublabel"><Check size={12} /> Matches ({matchedForJob.length})</span>
                {matchedForJob.length
                  ? matchedForJob.map((match) => <CandidateRow key={match.id} person={match.candidate} matched onView={() => setSelected(match.candidate)} onTalk={() => onOpenMessages ? onOpenMessages(match.id) : navigate('messages')} />)
                  : <EmptyRow>No mutual matches yet for this role.</EmptyRow>}
              </div>
              <div className="td-role-sublist">
                <span className="td-sublabel"><Heart size={12} /> Loves this job · not matched yet ({lovesNotMatched.length})</span>
                {lovesNotMatched.length
                  ? lovesNotMatched.slice(0, 8).map((person) => <CandidateRow key={person.id} person={person} onView={() => setSelected(person)} onTalk={() => void talk(person)} />)
                  : <EmptyRow>No new admirers yet — candidates who like this role show up here.</EmptyRow>}
              </div>
            </div>}
          </article>;
        })}
      </div>
    </section>

    <section className="td-metrics recruiter" aria-label="Recruiter summary">
      {metrics.map((metric, index) => <button key={metric.label} className={index === 4 ? 'highlight' : ''} onClick={() => metric.target === 'messages' ? navigate('messages') : scrollTo(metric.target)}>
        <span><metric.icon size={15} /></span><small>{metric.label}</small><strong>{metric.value}</strong><p>{metric.note}</p>
      </button>)}
    </section>

    <section className="td-bottom-grid recruiter">
      <article className="td-list-panel" id="td-recent"><DashboardTitle icon={Eye} title="Recently Viewed Your Jobs" />{allPeople.slice(0, 4).map((person) => <button key={person.id} onClick={() => setSelected(person)}><img src={person.photo} alt="" /><span><strong>{person.name}</strong><small>Viewed a role recently</small></span><ArrowRight size={12} /></button>)}</article>
      <article className="td-list-panel" id="td-coffee">
        <DashboardTitle icon={Coffee} title="Coffee Requests" action="See all" onAction={() => navigate('meetings')} />
        {upcomingCalls.length
          ? upcomingCalls.slice(0, 4).map((call) => {
            const match = data.matches.find((m) => m.id === call.matchId);
            return <button key={call.id} onClick={() => navigate('meetings')}>
              <img src={match?.candidate.photo} alt="" />
              <span><strong>{match?.candidate.name}</strong><small>{new Date(call.startAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · {call.title}</small></span>
              <ArrowRight size={12} />
            </button>;
          })
          : <EmptyRow>No calls scheduled yet — propose one from a match.</EmptyRow>}
      </article>
      <article className="td-list-panel" id="td-conversations"><DashboardTitle icon={MessageCircle} title="Active Conversations" />{data.matches.slice(0, 4).map((match) => <button key={match.id} onClick={() => navigate('messages')}><img src={match.candidate.photo} alt="" /><span><strong>{match.candidate.name}</strong><small>{data.messages.filter((message) => message.matchId === match.id).at(-1)?.text || match.job.title}</small></span><Bell size={12} /></button>)}</article>
    </section>
    {selected && <CandidateProfileModal candidate={selected} onClose={() => setSelected(null)} onTalk={() => { const person = selected; setSelected(null); void talk(person); }} viewerId={data.viewer.id} notes={data.notes} onNoteSaved={(note) => setData({ ...data, notes: [...data.notes.filter((n) => n.id !== note.id), note] })} />}
  </main>;
}
