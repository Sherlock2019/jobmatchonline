import { useState } from 'react';
import { Check, Eye, EyeOff, MessageCircle, Pencil, Plus, Users } from 'lucide-react';
import { api } from '../../api';
import { appleColor } from '../../lib/colors';
import { JobHeaderBadge } from '../jobs/JobHeaderBadge';
import type { Bootstrap, JobMatch, PipelineStep } from '../../types';

let stepSeq = 0;
function newStepId() { stepSeq += 1; return `step-${Date.now()}-${stepSeq}`; }

const DEFAULT_PIPELINE: PipelineStep[] = [
  { id: 'match', name: 'Mutual match confirmed', owner: '' },
  { id: 'screen', name: 'Recruiter screening call', owner: '' },
  { id: 'interview', name: 'Interview & assessment', owner: '' },
  { id: 'reference', name: 'Reference & background check', owner: '' },
  { id: 'offer', name: 'Offer negotiation', owner: '' },
  { id: 'hire', name: 'Offer acceptance & hire', owner: '' },
];

function pipelineOf(match: JobMatch): PipelineStep[] {
  return match.pipeline && match.pipeline.length ? match.pipeline : DEFAULT_PIPELINE;
}

export function SelectedCandidates({ data, setData, onOpenMessages }: { data: Bootstrap; setData: (d: Bootstrap) => void; onOpenMessages: (matchId: string) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const myMatches = data.matches.filter((match) => match.employerId === data.viewer.id);
  const byJob = new Map<string, JobMatch[]>();
  myMatches.forEach((match) => { const list = byJob.get(match.jobId) || []; list.push(match); byJob.set(match.jobId, list); });

  async function persist(match: JobMatch, pipeline: PipelineStep[], currentStepId: string) {
    const updated = await api.updateMatchPipeline(match.id, pipeline, currentStepId);
    setData({ ...data, matches: data.matches.map((entry) => (entry.id === match.id ? { ...entry, pipeline: updated.pipeline, currentStepId: updated.currentStepId } : entry)) });
  }

  function setCurrentStep(match: JobMatch, stepId: string) { void persist(match, pipelineOf(match), stepId); }

  function updateSteps(match: JobMatch, steps: PipelineStep[]) {
    const visible = steps.filter((step) => !step.hidden);
    const current = visible.some((step) => step.id === match.currentStepId) ? match.currentStepId! : (visible[0]?.id || steps[0]?.id || '');
    void persist(match, steps, current);
  }

  return <div className="page">
    <div className="page-title"><div><span className="overline">Talent pipeline</span><h1>Selected Candidates</h1><p>Every candidate you’ve matched with, grouped by role, with a hiring-stage timeline you can edit for each.</p></div></div>
    {myMatches.length === 0 ? <div className="sc-empty"><Users size={28} /><strong>No selected candidates yet</strong><p>Once you and a candidate both swipe yes, they’ll show up here with a stage timeline.</p></div>
      : [...byJob.entries()].map(([jobId, matches]) => {
        const job = matches[0].job;
        return <section className="sc-job-group" key={jobId}>
          <JobHeaderBadge job={job} compact />
          <div className="sc-candidate-list">
            {matches.map((match) => {
              const steps = pipelineOf(match);
              const visibleSteps = steps.filter((step) => !step.hidden);
              const currentId = match.currentStepId || visibleSteps[0]?.id;
              const editing = editingId === match.id;
              return <article className="sc-candidate" key={match.id}>
                <div className="sc-candidate-head">
                  <img className="sc-avatar" src={match.candidate.photo} alt="" style={{ boxShadow: `0 0 0 2px ${appleColor(match.candidate.id)}` }} />
                  <div className="sc-candidate-info"><strong>{match.candidate.name}</strong><span>{match.candidate.title}</span></div>
                  <button className="secondary-button small" onClick={() => onOpenMessages(match.id)}><MessageCircle size={14} /> Message</button>
                  <button className={editing ? 'sc-edit-btn active' : 'sc-edit-btn'} onClick={() => setEditingId(editing ? null : match.id)} aria-label="Edit hiring stages"><Pencil size={13} /></button>
                </div>
                {editing
                  ? <PipelineEditor steps={steps} onChange={(next) => updateSteps(match, next)} />
                  : <PipelineTimeline steps={visibleSteps} currentId={currentId} onSelect={(stepId) => setCurrentStep(match, stepId)} />}
              </article>;
            })}
          </div>
        </section>;
      })}
  </div>;
}

function PipelineTimeline({ steps, currentId, onSelect }: { steps: PipelineStep[]; currentId?: string; onSelect: (stepId: string) => void }) {
  const currentIndex = steps.findIndex((step) => step.id === currentId);
  return <ol className="sc-timeline">
    {steps.map((step, index) => {
      const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
      return <li key={step.id} className={`sc-timeline-step ${state}`}>
        <button className="sc-timeline-dot" onClick={() => onSelect(step.id)} aria-current={state === 'current'} aria-label={`Mark ${step.name} as current stage`}>
          {state === 'done' ? <Check size={13} /> : index + 1}
        </button>
        <div className="sc-timeline-copy"><button className="sc-timeline-name" onClick={() => onSelect(step.id)}>{step.name}</button>{step.owner && <span className="sc-timeline-owner">Owner: {step.owner}</span>}</div>
      </li>;
    })}
  </ol>;
}

function PipelineEditor({ steps, onChange }: { steps: PipelineStep[]; onChange: (steps: PipelineStep[]) => void }) {
  const update = (id: string, patch: Partial<PipelineStep>) => onChange(steps.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  const addStep = () => onChange([...steps, { id: newStepId(), name: 'New step', owner: '' }]);
  return <div className="sc-editor">
    {steps.map((step) => <div className={step.hidden ? 'sc-editor-row hidden' : 'sc-editor-row'} key={step.id}>
      <input className="sc-editor-name" value={step.name} onChange={(event) => update(step.id, { name: event.target.value })} placeholder="Step name" />
      <input className="sc-editor-owner" value={step.owner} onChange={(event) => update(step.id, { owner: event.target.value })} placeholder="Owner name" />
      <button className="sc-editor-toggle" onClick={() => update(step.id, { hidden: !step.hidden })} aria-label={step.hidden ? 'Unsuppress step' : 'Suppress step'}>{step.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
    </div>)}
    <button className="sc-editor-add" onClick={addStep}><Plus size={14} /> Add step</button>
  </div>;
}
