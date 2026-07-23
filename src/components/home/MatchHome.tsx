import { useMemo, useState } from 'react';
import {
  ArrowRight, Bell, Bookmark, BriefcaseBusiness, Check, ChevronDown, Coffee,
  Eye, Heart, MapPin, MessageCircle, Pencil, Sparkles, Star, Target, TrendingUp, X,
} from 'lucide-react';
import { api } from '../../api';
import type { Bootstrap, Job, MatchEvidence, Person, RoleMatchGroup, View } from '../../types';
import { JobDetailModal } from '../coach/CoachModals';
import { CandidateCards } from '../profile/CandidateCards';
import { CompanyLogoMark, JobHeaderBadge } from '../jobs/JobHeaderBadge';

type HomeProps = {
  data: Bootstrap;
  setData: (data: Bootstrap) => void;
  navigate: (view: View) => void;
  onEditProfile: (step: number) => void;
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

function DashboardTitle({ icon: Icon, title, subtitle, action, onAction }: {
  icon: typeof Heart; title: string; subtitle?: string; action?: string; onAction?: () => void;
}) {
  return <header className="td-section-title">
    <div><Icon size={16} /><span><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span></div>
    {action && <button onClick={onAction}>{action}<ArrowRight size={13} /></button>}
  </header>;
}

function CandidateJobCard({ job, saved, onSave, onView, onTalk }: {
  job: Job; saved: boolean; onSave: () => void; onView: () => void; onTalk: () => void;
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
      <span className="td-avatar-fallback">{job.company.slice(0, 1)}</span>
      <span><strong>{job.company}</strong><small>Hiring team</small></span>
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

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="td-empty"><Sparkles size={18} /><span>{children}</span></div>;
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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const jobs = useMemo(() => [...data.jobs].sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0)), [data.jobs]);
  const chasing = jobs.filter((job) => job.likedYou || job.superLikedYou);
  const precise = jobs.filter((job) => isPreciseMatch(job.match));
  const saved = jobs.filter((job) => data.bookmarkedIds.includes(job.id));
  const conversations = data.matches.slice(0, 3);
  const completion = data.viewer.completeness || 0;

  const reload = async () => setData(await api.bootstrap(data.viewer.id));
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
    ? <div className="td-job-grid">{items.slice(0, 3).map((job) => <CandidateJobCard key={job.id} job={job} saved={data.bookmarkedIds.includes(job.id)} onSave={() => void toggleSave(job)} onView={() => setSelectedJob(job)} onTalk={() => void startTalk(job)} />)}</div>
    : <EmptyRow>No opportunities are available in this section yet.</EmptyRow>;

  const metrics = [
    { icon: Heart, label: 'Jobs Chasing You', value: chasing.length, note: 'active matches', action: 'View jobs', target: 'td-chasing' },
    { icon: Eye, label: 'Companies Checking You Out', value: Math.max(chasing.length * 3, 1), note: 'profile views', action: 'See activity', target: 'td-companies' },
    { icon: Target, label: 'Recruiters Like You', value: chasing.length, note: 'interested', action: 'See who', target: 'td-chasing' },
    { icon: Coffee, label: 'Let’s Talk Invitations', value: conversations.length, note: 'invitations', action: 'View invites', target: 'messages' },
  ];

  return <main className="td-dashboard td-candidate">
    <section className="td-candidate-hero">
      <div>
        <h1>Good morning, {firstName(data.viewer.name)} <span>👋</span></h1>
        <h2>The right roles are already looking for you.</h2>
        <p>Your profile is {completion}% complete and already matching with {precise.length} relevant opportunities.</p>
        <div><button className="primary-button" onClick={() => navigate('discover')}>Explore Matches</button><button className="secondary-button" onClick={() => navigate('profile')}>Preview as Recruiter</button></div>
      </div>
      <aside className="td-profile-strength">
        <div className="mh-ring" style={{ '--value': `${completion * 3.6}deg` } as React.CSSProperties}><strong>{completion}%</strong></div>
        <b>Profile strength</b>
        <span><Eye size={11} /> {Math.max(chasing.length * 3, 1)} profile views this week</span>
        <span><Heart size={11} /> {chasing.length} recruiters interested</span>
        <small>● Visible to recruiters</small>
      </aside>
      <div className="td-hero-faces">{conversations.slice(0, 3).map((match) => <img key={match.id} src={match.employer?.photo || data.viewer.photo} alt="" />)}{conversations.length > 2 && <span>+{conversations.length}</span>}</div>
    </section>

    <section className="td-metrics candidate" aria-label="Candidate summary">
      {metrics.map((metric) => <button key={metric.label} onClick={() => metric.target === 'messages' ? navigate('messages') : scrollTo(metric.target)}>
        <span><metric.icon size={15} /></span><small>{metric.label}</small><strong>{metric.value}</strong><p>{metric.note}</p><b>{metric.action}<ArrowRight size={10} /></b>
      </button>)}
    </section>

    <section className="td-section" id="td-chasing">
      <DashboardTitle icon={Heart} title="Jobs Chasing You" subtitle="Offers from recruiters who already liked your profile." action={`See all (${chasing.length})`} onAction={() => navigate('matches')} />
      {jobCards(chasing)}
    </section>

    <section className="td-bottom-grid">
      <article className="td-list-panel" id="td-companies">
        <DashboardTitle icon={Eye} title="Companies Checking You Out" />
        {chasing.slice(0, 4).map((job, index) => <button key={job.id} onClick={() => setSelectedJob(job)}><CompanyLogoMark job={job} small /><span><strong>{job.company}</strong><small>{index ? `${index + 1} hours ago` : 'Viewed your profile recently'}</small></span></button>)}
      </article>
      <article className="td-list-panel">
        <DashboardTitle icon={MessageCircle} title="Conversations" action="See all" onAction={() => navigate('messages')} />
        {conversations.map((match) => <button key={match.id} onClick={() => navigate('messages')}><img src={match.employer?.photo || data.viewer.photo} alt="" /><span><strong>{match.employer?.name || match.job.company}</strong><small>{data.messages.filter((message) => message.matchId === match.id).at(-1)?.text || match.job.title}</small></span></button>)}
      </article>
      <article className="td-list-panel td-improve">
        <DashboardTitle icon={Sparkles} title="Make Your Profile Stronger" />
        {[['Add salary expectations', '+15% match improvement', 2], ['Record a 60-sec introduction', '+27% recruiter response rate', 3], ['Add a recommendation', '+20% trust score', 5]].map(([title, note, step]) => <button key={title as string} onClick={() => onEditProfile(step as number)}><span><Pencil size={13} /></span><span><strong>{title}</strong><small>{note}</small></span></button>)}
        <button className="secondary-button" onClick={() => onEditProfile(0)}>Complete My Profile</button>
      </article>
    </section>

    <div className="td-tip"><Sparkles size={13} /> Tip: Profiles with salary and work-mode preferences get 3× more matches.</div>

    <section className="td-section td-secondary-section" id="td-precise">
      <DashboardTitle icon={Target} title="Jobs That Match Your Wants" subtitle="90%+ match based on skills, salary, location, and work mode." action="Explore all" onAction={() => navigate('discover')} />
      {jobCards(precise)}
    </section>
    <section className="td-section td-secondary-section" id="td-saved">
      <DashboardTitle icon={Bookmark} title="Saved Job Offers" subtitle="Offers saved for review before you apply." action="Find more roles" onAction={() => navigate('discover')} />
      {jobCards(saved)}
    </section>
    {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
  </main>;
}

export function RecruiterHome({ data, setData, navigate }: HomeProps) {
  const [selected, setSelected] = useState<Person | null>(null);
  const [expandedId, setExpandedId] = useState('');
  const [bestMatchFirst, setBestMatchFirst] = useState(true);
  const [matchingRoleId, setMatchingRoleId] = useState('');
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
  const save = async (person: Person) => {
    await api.toggleBookmark({ userId: data.viewer.id, targetId: person.id, targetType: 'candidate' });
    await reload();
  };
  const talk = async (person: Person) => {
    const result = await api.swipe({ actorId: data.viewer.id, targetId: person.id, targetType: 'candidate', direction: 'like' });
    await reload();
    navigate(result.match ? 'messages' : 'matches');
  };
  const personCards = (people: Person[], liked = false) => people.length
    ? <div className="td-people-row">{[...people].sort((a, b) => bestMatchFirst ? (b.match?.score || 0) - (a.match?.score || 0) : a.name.localeCompare(b.name)).slice(0, 4).map((person) => <PersonCard key={person.id} person={person} liked={liked} saved={data.bookmarkedIds.includes(person.id)} onSave={() => void save(person)} onView={() => setSelected(person)} onTalk={() => void talk(person)} />)}</div>
    : <EmptyRow>No candidates are available in this group yet.</EmptyRow>;

  const metrics = [
    { icon: Heart, label: 'People Who Love Your Jobs', value: interested.length, note: 'candidates' },
    { icon: Eye, label: 'Viewed Your Jobs', value: allPeople.length, note: 'today' },
    { icon: Coffee, label: 'Coffee Requests', value: data.calls.length, note: 'awaiting' },
    { icon: MessageCircle, label: 'Active Conversations', value: data.matches.length, note: 'ongoing' },
    { icon: TrendingUp, label: topRole?.job.title || 'Top Performing Role', value: topRole?.matchingCandidates?.length || 0, note: 'perfect matches' },
  ];

  return <main className="td-dashboard td-recruiter">
    <header className="td-recruiter-head">
      <div><h1>Good morning, {firstName(data.viewer.name)} <span>👋</span></h1><p>Here’s who loves your jobs today.</p></div>
      <button className="primary-button" onClick={() => navigate('jobs')}>+ Create a New Job</button>
    </header>

    <section className="td-metrics recruiter" aria-label="Recruiter summary">
      {metrics.map((metric, index) => <button key={metric.label} className={index === 4 ? 'highlight' : ''} onClick={() => index === 3 ? navigate('messages') : scrollTo('td-roles')}>
        <span><metric.icon size={15} /></span><small>{metric.label}</small><strong>{metric.value}</strong><p>{metric.note}</p>
      </button>)}
    </section>

    <section className="td-section td-role-section" id="td-roles">
      <DashboardTitle icon={Heart} title="People Who Love This Job" subtitle="Top candidates genuinely interested in your roles, ranked by match score." action={bestMatchFirst ? 'Sort by: Best Match' : 'Sort by: Name'} onAction={() => setBestMatchFirst((value) => !value)} />
      <div className="td-role-list">
        {roles.map((group) => {
          const open = group.job.id === openId;
          const precise = (group.matchingCandidates || []).filter((candidate) => isPreciseMatch(candidate.match));
          return <article className={open ? 'td-role open' : 'td-role'} key={group.job.id}>
            <button className="td-role-head" onClick={() => setExpandedId(open ? '__none__' : group.job.id)} aria-expanded={open}>
              <JobHeaderBadge job={group.job} compact />
              <span><Heart size={12} /> {group.candidates.length} love this job</span>
              <span>{group.newCount || precise.length} new today</span>
              <b>View all candidates <ArrowRight size={11} /></b>
              <ChevronDown size={16} />
            </button>
            {open && <div className="td-role-body">
              {personCards(group.candidates, true)}
              <button className="td-matching-toggle" onClick={() => setMatchingRoleId(matchingRoleId === group.job.id ? '' : group.job.id)}>
                <span><TrendingUp size={13} /> Candidates Matching This Role</span>
                <small>{precise.length} candidates at 90%+</small>
                <ChevronDown className={matchingRoleId === group.job.id ? 'open' : ''} size={15} />
              </button>
              {matchingRoleId === group.job.id && <div className="td-matching-lane">{personCards(precise)}</div>}
            </div>}
          </article>;
        })}
      </div>
    </section>

    <section className="td-bottom-grid recruiter">
      <article className="td-list-panel"><DashboardTitle icon={Eye} title="Recently Viewed Your Jobs" />{allPeople.slice(0, 4).map((person) => <button key={person.id} onClick={() => setSelected(person)}><img src={person.photo} alt="" /><span><strong>{person.name}</strong><small>Viewed a role recently</small></span><ArrowRight size={12} /></button>)}</article>
      <article className="td-list-panel"><DashboardTitle icon={Coffee} title="Coffee Requests" />{data.matches.slice(0, 4).map((match) => <button key={match.id} onClick={() => navigate('messages')}><img src={match.candidate.photo} alt="" /><span><strong>{match.candidate.name}</strong><small>{match.job.title}</small></span><ArrowRight size={12} /></button>)}</article>
      <article className="td-list-panel"><DashboardTitle icon={MessageCircle} title="Active Conversations" />{data.matches.slice(0, 4).map((match) => <button key={match.id} onClick={() => navigate('messages')}><img src={match.candidate.photo} alt="" /><span><strong>{match.candidate.name}</strong><small>{data.messages.filter((message) => message.matchId === match.id).at(-1)?.text || match.job.title}</small></span><Bell size={12} /></button>)}</article>
    </section>
    {selected && <CandidateProfileModal candidate={selected} onClose={() => setSelected(null)} onTalk={() => { const person = selected; setSelected(null); void talk(person); }} />}
  </main>;
}
