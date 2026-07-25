import { useCallback, useMemo, useState } from 'react';
import { Check, Eye, Loader2, Lock, Pencil, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import type { Job, Person } from '../../types';
import { CandidateCards } from './CandidateCards';
import { DemoBadge } from '../DemoBadge';

// Card index (0-5, matches CandidateCards' NAV order) -> wizard step. Must
// stay in sync with the step= props on each <Card> in CandidateCards.tsx.
const EDIT_STEPS = [0, 3, 1, 6, 2, 5];

export function CandidateProfilePage({ viewer, jobs, onEdit, initialCard = 0, onCardChange, onDeleteProfile }: { viewer: Person; jobs: Job[]; onEdit: (step: number) => void; initialCard?: number; onCardChange?: (card: number) => void; onDeleteProfile?: () => Promise<void> }) {
  const [jobId, setJobId] = useState('');
  const [inspector, setInspector] = useState(false);
  const [activeCard, setActiveCard] = useState(initialCard);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const doDelete = async () => {
    if (!onDeleteProfile) return;
    setDeleting(true);
    try { await onDeleteProfile(); } finally { setDeleting(false); setConfirmingDelete(false); }
  };
  const changeCard = useCallback((card: number) => { setActiveCard(card); onCardChange?.(card); }, [onCardChange]);
  const comparisonJob = useMemo(() => jobs.find((job) => job.id === jobId), [jobId, jobs]);
  const completion = viewer.completeness || 0;
  const strengths = [
    { label: 'Profile Basics', value: Math.min(100, completion + 18), step: 0 },
    { label: 'Technical Stack', value: viewer.skillsDetail?.length ? 85 : 45, step: 1 },
    { label: 'Preferences', value: viewer.preferences?.salary?.min ? 82 : 58, step: 2 },
    { label: 'Human Stack', value: viewer.presentation ? 78 : 40, step: 3 },
    { label: 'Recommendations', value: Math.min(100, (viewer.recommendations?.length || 0) * 25), step: 5 },
  ];

  return <main className="page recruiter-preview-page">
    <header className="rp-page-head">
      <div><span className="overline">Your published candidate profile</span><h1>How Recruiters See You</h1><p>Review the same five-card profile, field visibility, and job-specific match evidence recruiters receive.</p></div>
      <div className="rp-head-actions">
        {onDeleteProfile && (confirmingDelete
          ? <span className="settings-confirm"><button className="danger-button" disabled={deleting} onClick={() => void doDelete()}>{deleting ? <Loader2 size={14} className="spin" /> : 'Confirm delete'}</button><button className="text-button" onClick={() => setConfirmingDelete(false)}><X size={14} /></button></span>
          : <button className="secondary-button danger-outline" onClick={() => setConfirmingDelete(true)}><Trash2 size={15} /> Delete This Profile</button>)}
        <button className={inspector ? 'secondary-button active' : 'secondary-button'} onClick={() => setInspector((value) => !value)}><Eye size={16} /> Visibility Inspector</button>
        <button className="primary-button" onClick={() => onEdit(EDIT_STEPS[activeCard])}><Pencil size={15} /> Edit This Card</button>
      </div>
    </header>

    <div className="rp-visibility">
      <strong>Recruiter visibility</strong><span><i className="public" /> Public before match</span><span><i className="after" /> Visible after mutual match</span><span><i className="private" /> Private</span>
      {(viewer.demo || viewer.sample) && <DemoBadge label={viewer.sample ? 'Starter sample profile — auto-generated for you' : 'Demo profile — not a real candidate'} />}
      <label>Preview against<select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">General recruiter view</option>{jobs.slice(0, 12).map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company}</option>)}</select></label>
    </div>

    <section className="rp-layout">
      <div className="rp-deck-wrap">
        <CandidateCards person={viewer} match={comparisonJob?.match} onEdit={onEdit} visibilityInspector={inspector} initialCard={initialCard} onActiveChange={changeCard} />
        <p className="rp-privacy-note"><Lock size={14} /> Private contact values remain hidden in owner preview exactly as they are before a mutual match.</p>
      </div>
      <aside className="rp-context">
        <div className="rp-completion-head"><div className="mh-ring" style={{ '--value': `${completion * 3.6}deg` } as React.CSSProperties}><strong>{completion}%</strong></div><div><span className="overline">Profile strength</span><h2>Make recruiters fall in love with your profile</h2></div></div>
        <div className="rp-strength-list">{strengths.map((item) => <button key={item.label} onClick={() => onEdit(item.step)}><span><strong>{item.label}</strong><small>{item.value >= 100 ? 'Complete' : `${item.value}%`}</small></span><i><b style={{ width: `${item.value}%` }} /></i></button>)}</div>
        <div className="rp-recommendations"><h3><Sparkles size={16} /> Highest-impact improvements</h3>
          {[
            { text: 'Add or confirm a recruiter-safe contact method', done: Boolean(viewer.contactChannels?.length), step: 0 },
            { text: 'Complete salary and work-mode preferences', done: Boolean(viewer.preferences?.salary?.min && viewer.preferences?.workMode), step: 2 },
            { text: 'Add your Human Stack introduction', done: Boolean(viewer.presentation), step: 3 },
          ].map((item) => <button key={item.text} onClick={() => onEdit(item.step)}><span className={item.done ? 'done' : ''}>{item.done ? <Check size={13} /> : <ShieldCheck size={13} />}</span><b>{item.text}</b></button>)}
        </div>
        {comparisonJob ? <div className="rp-comparison"><span className="overline">Personalized view</span><strong>{comparisonJob.match.score}% match with {comparisonJob.title}</strong><p>{comparisonJob.match.matchedSkills.length} matching skills · {comparisonJob.match.missingSkills?.length || 0} development gaps · {comparisonJob.match.salaryStatus || 'salary pending'} salary fit</p></div>
          : <div className="rp-comparison neutral"><span className="overline">General recruiter view</span><strong>No fabricated match score</strong><p>Select a matched role to inspect skills, salary, work-mode, and availability compatibility.</p></div>}
        <button className="primary-button wide" onClick={() => onEdit(EDIT_STEPS[activeCard])}>Edit This Card</button>
      </aside>
    </section>
  </main>;
}
