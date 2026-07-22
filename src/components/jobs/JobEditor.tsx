import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ClipboardPaste, Download, Loader2, Sparkles } from 'lucide-react';
import { api } from '../../api';
import { Chips, Field, LevelTagInput, Segmented, TagInput, TextInput } from '../profile/fields';
import { demoAdapter, pasteAdapter } from '../../lib/jobSources';
import { samplePasteText } from '../../content/jobSamples';
import type { Job, JobDraft, Person, Seniority } from '../../types';

const SENIORITY_LABELS = { junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead', exec: 'Exec' };
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'] as const;
const WORK_MODES = ['Remote', 'Hybrid', 'On-site', 'Flexible'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'VND', 'SGD', 'AUD'] as const;
const STATUSES = ['draft', 'active', 'paused', 'filled'] as const;

type Form = {
  title: string; department: string; seniority?: Seniority;
  requiredSkills: { name: string; level: number }[]; // level doubles as weight 1-3
  niceToHaves: string[]; type?: string; workMode?: string; remoteScope: 'country' | 'worldwide'; country: string; location: string; hiringRadiusKm: number;
  salaryMin: string; salaryMax: string; currency: string; description: string;
  responsibilities: string[]; interviewProcess: string[]; startDate: string; externalUrl: string;
  status: typeof STATUSES[number]; screeningQuestions: string[];
};

const emptyForm = (): Form => ({
  title: '', department: '', seniority: undefined, requiredSkills: [], niceToHaves: [], type: undefined,
  workMode: undefined, remoteScope: 'worldwide', country: '', location: '', hiringRadiusKm: 40, salaryMin: '', salaryMax: '', currency: 'USD',
  description: '', responsibilities: [], interviewProcess: [], startDate: '', externalUrl: '', status: 'draft', screeningQuestions: [],
});

function fromJob(job: Job): Form {
  return {
    ...emptyForm(),
    title: job.title, department: job.department || '', seniority: job.seniority || (job.experienceLevel as Seniority),
    requiredSkills: (job.requiredSkillsDetail || job.requiredSkills.map((name) => ({ name, weight: 2 }))).map((skill) => ({ name: skill.name, level: skill.weight })),
    niceToHaves: job.niceToHaves || [], type: job.type, workMode: job.workMode,
    remoteScope: job.remoteScope || 'worldwide', country: job.country || '', location: job.location,
    hiringRadiusKm: job.hiringRadiusKm ?? 40,
    salaryMin: job.salaryRange ? String(job.salaryRange.min) : '', salaryMax: job.salaryRange ? String(job.salaryRange.max) : '',
    currency: job.salaryRange?.currency || 'USD', description: job.description,
    responsibilities: job.responsibilities || [], interviewProcess: job.interviewProcess || [],
    startDate: job.startDate || '', externalUrl: job.externalUrl || '', status: (job.status as Form['status']) || 'draft',
    screeningQuestions: job.screeningQuestions || [],
  };
}

function applyDraft(form: Form, draft: JobDraft): Form {
  return {
    ...form,
    title: draft.title ?? form.title,
    department: draft.department ?? form.department,
    seniority: (draft.seniority as Seniority) ?? form.seniority,
    requiredSkills: draft.requiredSkillsDetail ? draft.requiredSkillsDetail.map((skill) => ({ name: skill.name, level: skill.weight })) : form.requiredSkills,
    niceToHaves: draft.niceToHaves ?? form.niceToHaves,
    type: draft.type ?? form.type, workMode: draft.workMode ?? form.workMode,
    remoteScope: (draft.remoteScope as 'country' | 'worldwide') ?? form.remoteScope, country: draft.country ?? form.country,
    location: draft.location ?? form.location, hiringRadiusKm: draft.hiringRadiusKm ?? form.hiringRadiusKm,
    salaryMin: draft.salaryRange ? String(draft.salaryRange.min) : form.salaryMin,
    salaryMax: draft.salaryRange ? String(draft.salaryRange.max) : form.salaryMax,
    currency: draft.salaryRange?.currency ?? form.currency,
    description: draft.description ?? form.description,
    responsibilities: draft.responsibilities ?? form.responsibilities,
    interviewProcess: draft.interviewProcess ?? form.interviewProcess,
    startDate: draft.startDate ?? form.startDate, externalUrl: draft.externalUrl ?? form.externalUrl,
  };
}

function formErrors(form: Form): string[] {
  const errors: string[] = [];
  if (!form.title.trim()) errors.push('Title is required');
  if (!form.seniority) errors.push('Seniority is required');
  if (form.requiredSkills.length < 3) errors.push('At least 3 required skills (weights feed the fit score)');
  if (!form.type) errors.push('Employment type is required');
  if (!form.workMode) errors.push('Work mode is required');
  if (!form.location.trim()) errors.push('Location is required');
  if (form.workMode === 'Remote' && form.remoteScope === 'country' && !form.country.trim()) errors.push('Enter the country for a country-restricted remote role');
  if (form.salaryMin === '' || form.salaryMax === '') errors.push('Salary range is mandatory');
  else if (Number(form.salaryMin) > Number(form.salaryMax)) errors.push('Salary min cannot exceed max');
  if (!form.description.trim()) errors.push('Description is required');
  return errors;
}

export function JobEditor({ viewer, job, onSaved, onCancel }: { viewer: Person; job?: Job; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<Form>(() => (job ? fromJob(job) : emptyForm()));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [importNote, setImportNote] = useState('');
  const [importing, setImporting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState('');
  const patch = (changes: Partial<Form>) => setForm((current) => ({ ...current, ...changes }));
  const errors = useMemo(() => formErrors(form), [form]);

  const runImport = async (adapter: typeof pasteAdapter, input?: { url?: string; text?: string }) => {
    setImporting(true); setError('');
    try {
      const { draft, source } = await adapter.importDraft(input);
      setForm((current) => applyDraft(current, draft));
      setImportNote(`${source} — review the fields below, then save.`);
      setPasteOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed'); }
    finally { setImporting(false); }
  };

  const save = async () => {
    setAttempted(true);
    if (errors.length) return;
    setSaving(true); setError('');
    const payload: JobDraft = {
      title: form.title, department: form.department || undefined, seniority: form.seniority,
      requiredSkillsDetail: form.requiredSkills.map((skill) => ({ name: skill.name, weight: Math.min(skill.level, 3) })),
      niceToHaves: form.niceToHaves, type: form.type, workMode: form.workMode, location: form.location,
      ...(form.workMode === 'Remote'
        ? { remoteScope: form.remoteScope, country: form.remoteScope === 'country' ? form.country : undefined }
        : { hiringRadiusKm: form.hiringRadiusKm }),
      salaryRange: { min: Number(form.salaryMin), max: Number(form.salaryMax), currency: form.currency },
      description: form.description, responsibilities: form.responsibilities, interviewProcess: form.interviewProcess,
      startDate: form.startDate || undefined, externalUrl: form.externalUrl || undefined, status: form.status,
      screeningQuestions: form.screeningQuestions,
    };
    try {
      if (job) await api.updateJob(job.id, payload);
      else await api.createJob({ ...payload, employerId: viewer.id });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return <div className="wizard-page">
    <div className="wizard-card job-editor">
      <header className="wz-head">
        <div><span className="overline">{job ? 'Edit job posting' : 'Create job posting'}</span><h1>{form.title || 'New role'}</h1></div>
        <button className="secondary-button" onClick={onCancel}><ArrowLeft size={15} /> Back to jobs</button>
      </header>

      <div className="job-import-bar">
        <button className="secondary-button job-import-btn" onClick={() => setPasteOpen((value) => !value)} disabled={importing}><ClipboardPaste size={15} /> {pasteAdapter.label}</button>
        <button className="secondary-button job-import-btn" onClick={() => runImport(demoAdapter)} disabled={importing}>{importing ? <Loader2 size={15} className="spin" /> : <Download size={15} />} {demoAdapter.label}</button>
        {importNote && <span className="job-import-note"><Sparkles size={13} /> {importNote}</span>}
      </div>

      {pasteOpen && <div className="job-paste-panel">
        <Field label="Job posting URL" hint="Reference only — nothing is scraped."><TextInput value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="https://www.linkedin.com/jobs/view/…" /></Field>
        <Field label="Full job text" hint="Copy the entire posting and paste it here.">
          <textarea className="wz-input wz-textarea" rows={7} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste the complete job description…" />
        </Field>
        <div className="job-paste-actions">
          <button className="text-button" onClick={() => setPasteText(samplePasteText)}>Use example text</button>
          <button className="primary-button small" onClick={() => runImport(pasteAdapter, { url: pasteUrl, text: pasteText })} disabled={importing}>{importing ? <Loader2 size={15} className="spin" /> : 'Parse into form'}</button>
        </div>
      </div>}

      <div className="wz-body">
        <div className="wz-row">
          <Field label="Job title" required><TextInput value={form.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
          <Field label="Department"><TextInput value={form.department} onChange={(e) => patch({ department: e.target.value })} placeholder="e.g. Engineering" /></Field>
        </div>
        <Field label="Seniority" required><Segmented options={['junior', 'mid', 'senior', 'lead', 'exec'] as const} value={form.seniority} onChange={(seniority) => patch({ seniority })} labels={SENIORITY_LABELS} /></Field>
        <Field label="Required skills" required hint="Min 3. Dots set the weight (1–3) that feeds the fit score.">
          <LevelTagInput value={form.requiredSkills} onChange={(requiredSkills) => patch({ requiredSkills: requiredSkills.map((skill) => ({ ...skill, level: Math.min(skill.level, 3) })) })} maxLevel={3} placeholder="Add a required skill, press Enter" />
        </Field>
        <Field label="Nice-to-haves"><TagInput value={form.niceToHaves} onChange={(niceToHaves) => patch({ niceToHaves })} placeholder="Bonus skills — press Enter" /></Field>
        <div className="wz-row">
          <Field label="Employment type" required><Segmented options={EMPLOYMENT_TYPES} value={form.type as typeof EMPLOYMENT_TYPES[number] | undefined} onChange={(type) => patch({ type })} /></Field>
          <Field label="Work mode" required><Segmented options={WORK_MODES} value={form.workMode as typeof WORK_MODES[number] | undefined} onChange={(workMode) => patch({ workMode })} /></Field>
        </div>
        {form.workMode === 'Remote' ? <>
          <Field label="Remote scope" required hint="Worldwide matches everyone; within-country limits to candidates in one country.">
            <Segmented options={['worldwide', 'country'] as const} value={form.remoteScope} onChange={(remoteScope) => patch({ remoteScope })} labels={{ worldwide: 'Worldwide', country: 'Within a country' }} />
          </Field>
          <div className="wz-row">
            <Field label="Location" required><TextInput value={form.location} onChange={(e) => patch({ location: e.target.value })} placeholder="e.g. Remote · Asia" /></Field>
            {form.remoteScope === 'country' && <Field label="Country" required><TextInput value={form.country} onChange={(e) => patch({ country: e.target.value })} placeholder="e.g. Vietnam" /></Field>}
          </div>
        </> : <div className="wz-row">
          <Field label="Location" required><TextInput value={form.location} onChange={(e) => patch({ location: e.target.value })} placeholder="City, country" /></Field>
          <Field label={`Max distance: ${form.hiringRadiusKm} km`} required hint="How far you'll consider on-site/hybrid candidates."><input className="wz-slider" type="range" min={5} max={500} step={5} value={form.hiringRadiusKm} onChange={(e) => patch({ hiringRadiusKm: Number(e.target.value) })} /></Field>
        </div>}
        <Field label="Salary range (mandatory)" required hint="Candidates see a compatibility badge pre-match; exact ranges reveal after a mutual match.">
          <div className="wz-salary">
            <TextInput type="number" min={0} placeholder="Min" value={form.salaryMin} onChange={(e) => patch({ salaryMin: e.target.value })} aria-label="Salary minimum" />
            <span>–</span>
            <TextInput type="number" min={0} placeholder="Max" value={form.salaryMax} onChange={(e) => patch({ salaryMax: e.target.value })} aria-label="Salary maximum" />
            <select className="wz-input wz-select" value={form.currency} onChange={(e) => patch({ currency: e.target.value })} aria-label="Currency">{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select>
          </div>
        </Field>
        <Field label="Description" required><textarea className="wz-input wz-textarea" rows={4} value={form.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
        <Field label="Responsibilities" hint="One bullet per line — press Enter to add.">
          <TagInput value={form.responsibilities} onChange={(responsibilities) => patch({ responsibilities })} placeholder="e.g. Own the matching API roadmap" />
        </Field>
        <Field label="Interview process" hint="Ordered steps, e.g. screen → tech → offer.">
          <TagInput value={form.interviewProcess} onChange={(interviewProcess) => patch({ interviewProcess })} placeholder="Add a stage, press Enter" />
        </Field>
        <Field label="Screening questions" hint="Up to 3 — candidates answer these in a 30-second form when they swipe right.">
          <TagInput value={form.screeningQuestions} onChange={(screeningQuestions) => patch({ screeningQuestions: screeningQuestions.slice(0, 3) })} placeholder="Add a question, press Enter" />
          <button type="button" className="wz-repeat-add" disabled={form.requiredSkills.length < 1 || suggesting}
            onClick={async () => { setSuggesting(true); try { const { questions } = await api.suggestScreening(form.requiredSkills.map((skill) => ({ name: skill.name, weight: skill.level }))); patch({ screeningQuestions: questions }); } finally { setSuggesting(false); } }}>
            {suggesting ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Suggest from required skills
          </button>
        </Field>
        <div className="wz-row">
          <Field label="Start date"><TextInput value={form.startDate} onChange={(e) => patch({ startDate: e.target.value })} placeholder="e.g. ASAP, Q4 2026" /></Field>
          <Field label="External posting URL"><TextInput value={form.externalUrl} onChange={(e) => patch({ externalUrl: e.target.value })} placeholder="https://…" /></Field>
        </div>
        <Field label="Status" required><Segmented options={STATUSES} value={form.status} onChange={(status) => patch({ status })} labels={{ draft: 'Draft', active: 'Active', paused: 'Paused', filled: 'Filled' }} /></Field>
      </div>

      {(attempted && errors.length > 0) && <ul className="wz-errors">{errors.map((message) => <li key={message}>{message}</li>)}</ul>}
      {error && <p className="auth-error">{error}</p>}

      <footer className="wz-foot">
        <button className="secondary-button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : <><Check size={16} /> {job ? 'Save changes' : 'Create posting'}</>}</button>
      </footer>
    </div>
  </div>;
}
