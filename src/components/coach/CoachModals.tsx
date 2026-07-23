import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, BriefcaseBusiness, Check, ClipboardList, GraduationCap, Loader2, MapPin, MessageSquareText, Plus, Sparkles, Wallet, X } from 'lucide-react';
import { api } from '../../api';
import type { InterviewKit, InterviewPrep, Job, JobMatch, Person, ScreeningAnswer } from '../../types';
import { JobCards } from '../jobs/JobCards';
import { JobHeaderBadge } from '../jobs/JobHeaderBadge';

function CoachModalShell({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className={wide ? 'coach-modal wide' : 'coach-modal'} initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      {children}
    </motion.div>
  </motion.div>;
}

/** Item 9: job detail with Overview + Prepare tabs (candidate side). */
export function JobDetailModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'prepare'>('overview');
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (tab !== 'prepare' || prep) return;
    setLoading(true);
    api.jobPrep(job.id).then(setPrep).catch(() => setPrep(null)).finally(() => setLoading(false));
  }, [tab, prep, job.id]);

  return <CoachModalShell onClose={onClose} wide>
    <JobHeaderBadge job={job} className="coach-job-header" />
    <div className="coach-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'overview'} className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><BriefcaseBusiness size={14} /> Overview</button>
      <button role="tab" aria-selected={tab === 'prepare'} className={tab === 'prepare' ? 'active' : ''} onClick={() => setTab('prepare')}><GraduationCap size={14} /> Prepare</button>
    </div>
    {tab === 'overview' && <div className="coach-body">
      <p className="coach-description">{job.description}</p>
      <JobCards job={job} unlocked />
    </div>}
    {tab === 'prepare' && <div className="coach-body">
      {loading && <div className="resume-loading"><Loader2 size={20} className="spin" /> Building your prep list…</div>}
      {prep && <>
        <span className="card-label"><BookOpen size={12} /> Topics to review</span>
        <ul className="coach-list">{prep.topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
        {prep.skillQuestions.map((entry) => <div key={entry.skill}>
          <span className="card-label">Likely questions · {entry.skill}</span>
          <ul className="coach-list numbered">{entry.questions.map((question) => <li key={question}>{question}</li>)}</ul>
        </div>)}
        <div className="coach-ask"><Sparkles size={15} /><div><strong>Ask them this</strong><p>{prep.askThem}</p></div></div>
        <small className="coach-generator">{prep.generator === 'claude' ? 'Generated with Claude' : 'Generated from the coaching template bank'} · cached for this job</small>
      </>}
    </div>}
  </CoachModalShell>;
}

/** Item 10: skill gaps under the fit score with one-click "Have it? Add to profile". */
export function GapCoach({ job, viewer, onSkillAdded }: { job: Job; viewer: Person; onSkillAdded: () => void }) {
  const [busy, setBusy] = useState('');
  const claimed = new Set((viewer.skills || []).map((skill) => skill.toLowerCase()));
  const gaps = job.requiredSkills.filter((skill) => !claimed.has(skill.toLowerCase()));
  if (!gaps.length) return null;
  const add = async (skill: string) => {
    setBusy(skill);
    try {
      const detail = viewer.skillsDetail || (viewer.skills || []).map((name) => ({ name, level: 3 }));
      await api.updateProfile(viewer.id, { skillsDetail: [...detail, { name: skill, level: 3 }] });
      onSkillAdded();
    } finally { setBusy(''); }
  };
  return <div className="gap-coach" onPointerDownCapture={(event) => event.stopPropagation()}>
    <span className="card-label">Skills this role needs that your profile doesn't show</span>
    <div className="gap-list">
      {gaps.map((skill) => <span className="gap-chip" key={skill}>
        {skill}
        <button onClick={() => add(skill)} disabled={busy !== ''} title="Have it? Add to profile">{busy === skill ? <Loader2 size={11} className="spin" /> : <><Plus size={11} /> Have it?</>}</button>
      </span>)}
    </div>
    <small>Adding a skill updates your fit score instantly. If it stays here, it's an honest gap.</small>
  </div>;
}

/** Item 11: 30-second screening form shown when a candidate swipes right. */
export function ScreeningModal({ job, onSubmit, onCancel }: { job: Job; onSubmit: (answers: ScreeningAnswer[]) => void; onCancel: () => void }) {
  const questions = job.screeningQuestions || [];
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));
  return <CoachModalShell onClose={onCancel}>
    <header className="coach-head compact">
      <div><span className="overline">{job.company} asks</span><h2>30 seconds before you match</h2><p>Your answers go straight to the hiring team with your like.</p></div>
    </header>
    <form className="coach-body" onSubmit={(event) => { event.preventDefault(); onSubmit(questions.map((question, index) => ({ question, answer: answers[index].trim() })).filter((entry) => entry.answer)); }}>
      {questions.map((question, index) => <label className="screening-question" key={question}>
        <span>{index + 1}. {question}</span>
        <textarea className="wz-input wz-textarea" rows={2} value={answers[index]} onChange={(event) => setAnswers((current) => current.map((value, valueIndex) => valueIndex === index ? event.target.value : value))} placeholder="One or two sentences is plenty." />
      </label>)}
      <div className="screening-actions">
        <button type="button" className="text-button" onClick={() => onSubmit([])}>Skip &amp; just like</button>
        <button type="submit" className="primary-button"><Check size={16} /> Send with my like</button>
      </div>
    </form>
  </CoachModalShell>;
}

/** Items 11+12, recruiter side: screening answers + auto-generated interview kit. */
export function MatchDetailModal({ match, onClose }: { match: JobMatch; onClose: () => void }) {
  const [tab, setTab] = useState<'screening' | 'kit'>(match.screeningAnswers?.length ? 'screening' : 'kit');
  const [kit, setKit] = useState<InterviewKit | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (tab !== 'kit' || kit) return;
    setLoading(true);
    api.matchKit(match.id).then(setKit).catch(() => setKit(null)).finally(() => setLoading(false));
  }, [tab, kit, match.id]);

  return <CoachModalShell onClose={onClose} wide>
    <header className="coach-head">
      <img className="coach-avatar" src={match.candidate?.photo} alt="" />
      <div><span className="overline">{match.job?.title}</span><h2>{match.candidate?.name}</h2><p>{match.candidate?.title}{match.candidate?.location ? <> · <MapPin size={11} /> {match.candidate.location}</> : null}</p></div>
    </header>
    <div className="coach-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'screening'} className={tab === 'screening' ? 'active' : ''} onClick={() => setTab('screening')}><MessageSquareText size={14} /> Screening answers</button>
      <button role="tab" aria-selected={tab === 'kit'} className={tab === 'kit' ? 'active' : ''} onClick={() => setTab('kit')}><ClipboardList size={14} /> Interview kit</button>
    </div>
    {tab === 'screening' && <div className="coach-body">
      {match.screeningAnswers?.length ? match.screeningAnswers.map((entry) => <div className="screening-answer" key={entry.question}>
        <strong>{entry.question}</strong><p>{entry.answer}</p>
      </div>) : <p className="coach-empty">No screening answers — this match was made without the screening form.</p>}
    </div>}
    {tab === 'kit' && <div className="coach-body">
      {loading && <div className="resume-loading"><Loader2 size={20} className="spin" /> Building the interview kit…</div>}
      {kit && <>
        <div className={`coach-salary salary-${kit.salaryStatus === 'within' ? 'good' : kit.salaryStatus === 'below' ? 'bad' : 'info'}`}><Wallet size={14} /> {kit.salarySummary}</div>
        {kit.skillQuestions.map((entry) => <div key={entry.skill}>
          <span className="card-label">Probe · {entry.skill}</span>
          <ul className="coach-list numbered">{entry.questions.map((question) => <li key={question}>{question}</li>)}</ul>
        </div>)}
        {kit.gapProbes && kit.gapProbes.length > 0 && <>
          <span className="card-label">Gaps to probe honestly</span>
          <ul className="coach-list">{kit.gapProbes.map((probe) => <li key={probe.skill}><b>{probe.skill}:</b> {probe.question}</li>)}</ul>
        </>}
        <small className="coach-generator">{kit.generator === 'claude' ? 'Generated with Claude' : 'Generated from the coaching template bank'} · cached for this match</small>
      </>}
    </div>}
  </CoachModalShell>;
}
