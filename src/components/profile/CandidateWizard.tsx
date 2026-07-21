import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Upload } from 'lucide-react';
import { api } from '../../api';
import { Chips, Field, LevelTagInput, Repeat, Segmented, TagInput, TextInput, Toggle } from './fields';
import type { Education, LanguageTag, Person, ResumeMeta, Seniority, SkillTag, WorkExperience } from '../../types';

const SENIORITY_LABELS = { junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead', exec: 'Exec' };
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'] as const;
const AVAILABILITIES = ['Now', '2 weeks', '1 month', '3 months'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'VND', 'SGD', 'AUD'] as const;
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;
const LANGUAGE_LEVELS = ['Basic', 'Conversational', 'Fluent', 'Native'] as const;
const SKILL_SUGGESTIONS = ['Figma', 'Design systems', 'Research', 'Product strategy', 'React', 'TypeScript', 'Prototyping', 'Analytics'] as const;
const WORK_STYLES = ['Autonomous', 'Collaborative', 'Fast-paced', 'Structured', 'Async-first', 'Mentorship'] as const;

export const CANDIDATE_STEPS = ['Identity', 'Professional', 'Preferences', 'Documents & privacy'] as const;

type Form = {
  name: string; photo: string; headline: string; email: string; phone: string; city: string; country: string;
  distanceRangeKm: number; languageDetail: LanguageTag[];
  title: string; yearsExperience: string; seniority?: Seniority; skillsDetail: SkillTag[]; industries: string[];
  workExperience: WorkExperience[]; education: Education[]; certifications: string[];
  links: { github?: string; portfolio?: string; website?: string; linkedin?: string };
  desiredRoles: string[]; employmentTypes: string[]; workModeChoice?: 'remote' | 'hybrid' | 'onsite'; hybridDays: number;
  salaryMin: string; salaryMax: string; currency: string; availability?: string;
  relocateOpen: boolean; relocateLocations: string[]; companySize: string; workStyle: string[];
  resume?: ResumeMeta; coverLetter: string; visibility?: 'all' | 'after-swipe' | 'paused'; blockedCompanies: string[]; openToWork: boolean;
};

function fromPerson(p: Person): Form {
  return {
    name: p.name || '', photo: p.photo || '', headline: p.headline || '', email: p.email || '', phone: p.phone || '',
    city: p.city || (p.location ? p.location.split('·')[0].trim() : ''), country: p.country || '',
    distanceRangeKm: p.distanceRangeKm ?? 25,
    languageDetail: p.languageDetail || (p.languages || []).map((name) => ({ name, level: 'Fluent' })),
    title: p.title === 'New member' ? '' : p.title || '', yearsExperience: p.yearsExperience !== undefined ? String(p.yearsExperience) : '',
    seniority: p.seniority || (['junior', 'mid', 'senior', 'lead', 'exec'].includes(p.experienceLevel) ? p.experienceLevel as Seniority : undefined),
    skillsDetail: p.skillsDetail || (p.skills || []).map((name) => ({ name, level: 3 })),
    industries: p.industries || [], workExperience: p.workExperience || [], education: p.education || [], certifications: p.certifications || [],
    links: p.links || {},
    desiredRoles: p.preferences?.desiredRoles || [], employmentTypes: p.preferences?.employmentTypes || [],
    workModeChoice: p.preferences?.workMode?.mode, hybridDays: p.preferences?.workMode?.hybridDays ?? 2,
    salaryMin: p.preferences?.salary?.min !== undefined ? String(p.preferences.salary.min) : '',
    salaryMax: p.preferences?.salary?.max !== undefined ? String(p.preferences.salary.max) : '',
    currency: p.preferences?.salary?.currency || 'USD', availability: p.preferences?.availability,
    relocateOpen: p.preferences?.relocate?.open ?? false, relocateLocations: p.preferences?.relocate?.locations || [],
    companySize: p.preferences?.companySize || '', workStyle: p.preferences?.workStyle || [],
    resume: p.documents?.resume, coverLetter: p.documents?.coverLetter || '',
    visibility: p.privacy?.visibility, blockedCompanies: p.privacy?.blockedCompanies || [],
    openToWork: p.privacy?.openToWork ?? true,
  };
}

function stepPayload(step: number, form: Form, finishing: boolean) {
  if (step === 0) return {
    name: form.name, photo: form.photo || undefined, headline: form.headline, email: form.email, phone: form.phone || undefined,
    city: form.city, country: form.country, distanceRangeKm: form.distanceRangeKm, languageDetail: form.languageDetail,
  };
  if (step === 1) return {
    title: form.title, yearsExperience: Number(form.yearsExperience), seniority: form.seniority, skillsDetail: form.skillsDetail,
    industries: form.industries, workExperience: form.workExperience, education: form.education, certifications: form.certifications, links: form.links,
  };
  if (step === 2) return {
    availability: form.availability,
    preferences: {
      desiredRoles: form.desiredRoles, employmentTypes: form.employmentTypes,
      workMode: form.workModeChoice ? { mode: form.workModeChoice, hybridDays: form.workModeChoice === 'hybrid' ? form.hybridDays : undefined } : undefined,
      salary: { min: Number(form.salaryMin), max: Number(form.salaryMax), currency: form.currency },
      availability: form.availability, relocate: { open: form.relocateOpen, locations: form.relocateLocations },
      companySize: form.companySize || undefined, workStyle: form.workStyle,
    },
  };
  return {
    coverLetter: form.coverLetter,
    privacy: { visibility: form.visibility, blockedCompanies: form.blockedCompanies, openToWork: form.openToWork },
    ...(finishing ? { onboarding: false } : {}),
  };
}

function stepErrors(step: number, form: Form): string[] {
  const errors: string[] = [];
  if (step === 0) {
    if (!form.name.trim()) errors.push('Full name is required');
    if (!form.headline.trim()) errors.push('Headline is required');
    if (!/.+@.+\..+/.test(form.email)) errors.push('A valid email is required');
    if (!form.city.trim() || !form.country.trim()) errors.push('City and country are required');
  }
  if (step === 1) {
    if (!form.title.trim()) errors.push('Current or last title is required');
    if (form.yearsExperience === '' || Number.isNaN(Number(form.yearsExperience))) errors.push('Years of experience is required');
    if (!form.seniority) errors.push('Pick a seniority level');
    if (form.skillsDetail.length < 3) errors.push('Add at least 3 skills');
  }
  if (step === 2) {
    if (!form.desiredRoles.length) errors.push('Add at least one desired role');
    if (!form.employmentTypes.length) errors.push('Pick at least one employment type');
    if (!form.workModeChoice) errors.push('Pick a work mode');
    if (form.salaryMin === '' || form.salaryMax === '') errors.push('Salary expectation range is required');
    else if (Number(form.salaryMin) > Number(form.salaryMax)) errors.push('Salary minimum cannot exceed maximum');
    if (!form.availability) errors.push('Pick your availability');
  }
  if (step === 3) {
    if (!form.resume) errors.push('Upload your resume (PDF or DOCX)');
    if (!form.visibility) errors.push('Choose who can see your profile');
  }
  return errors;
}

export function CandidateWizard({ viewer, initialStep = 0, onDone, onCancel }: { viewer: Person; initialStep?: number; onDone: (user: Person) => void; onCancel?: () => void }) {
  const [step, setStep] = useState(Math.min(initialStep, CANDIDATE_STEPS.length - 1));
  const [form, setForm] = useState<Form>(() => fromPerson(viewer));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const patch = (changes: Partial<Form>) => setForm((current) => ({ ...current, ...changes }));
  const errors = useMemo(() => stepErrors(step, form), [step, form]);
  const finishing = step === CANDIDATE_STEPS.length - 1;

  const next = async () => {
    setAttempted(true);
    if (errors.length) return;
    setSaving(true); setError('');
    try {
      const { user } = await api.updateProfile(viewer.id, stepPayload(step, form, finishing) as Partial<Person>);
      if (finishing) onDone(user);
      else { setStep(step + 1); setAttempted(false); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const uploadResume = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('Resume must be 10MB or smaller'); return; }
    setUploading(true); setError('');
    try { const { resume } = await api.uploadResume(viewer.id, file); patch({ resume }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  return <div className="wizard-page">
    <div className="wizard-card">
      <header className="wz-head">
        <div><span className="overline">Set up your candidate profile</span><h1>{CANDIDATE_STEPS[step]}</h1></div>
        <span className="wz-step-count">Step {step + 1} of {CANDIDATE_STEPS.length}</span>
      </header>
      <div className="wz-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={CANDIDATE_STEPS.length}><i style={{ width: `${((step + 1) / CANDIDATE_STEPS.length) * 100}%` }} /></div>

      {step === 0 && <div className="wz-body">
        <div className="wz-row">
          <Field label="Full name" required><TextInput value={form.name} onChange={(e) => patch({ name: e.target.value })} autoComplete="name" /></Field>
          <Field label="Email" required><TextInput type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} autoComplete="email" /></Field>
        </div>
        <div className="wz-row">
          <Field label="Photo URL" hint="Pre-filled from your provider when you signed in with LinkedIn or Google.">
            <div className="wz-photo-row">{form.photo && <img src={form.photo} alt="" />}<TextInput value={form.photo} onChange={(e) => patch({ photo: e.target.value })} placeholder="https://…" /></div>
          </Field>
          <Field label="Phone" hint="Hidden until you match with a company."><TextInput value={form.phone} onChange={(e) => patch({ phone: e.target.value })} autoComplete="tel" placeholder="+84 …" /></Field>
        </div>
        <Field label="Headline" required hint="One line that sells your craft."><TextInput value={form.headline} onChange={(e) => patch({ headline: e.target.value })} placeholder="e.g. Product designer who ships design systems" /></Field>
        <div className="wz-row">
          <Field label="City" required><TextInput value={form.city} onChange={(e) => patch({ city: e.target.value })} /></Field>
          <Field label="Country" required><TextInput value={form.country} onChange={(e) => patch({ country: e.target.value })} /></Field>
        </div>
        <Field label={`Private distance range: ${form.distanceRangeKm} km`} required hint="Only used for matching. Your exact location is never shown.">
          <input className="wz-slider" type="range" min={5} max={100} step={5} value={form.distanceRangeKm} onChange={(e) => patch({ distanceRangeKm: Number(e.target.value) })} />
        </Field>
        <Field label="Languages">
          <div className="wz-langs">
            {form.languageDetail.map((language) => <span key={language.name} className="wz-leveltag">
              <b>{language.name}</b>
              <select value={language.level} onChange={(e) => patch({ languageDetail: form.languageDetail.map((item) => item.name === language.name ? { ...item, level: e.target.value } : item) })}>
                {LANGUAGE_LEVELS.map((level) => <option key={level}>{level}</option>)}
              </select>
              <button type="button" className="wz-tag-remove" aria-label={`Remove ${language.name}`} onClick={() => patch({ languageDetail: form.languageDetail.filter((item) => item.name !== language.name) })}>×</button>
            </span>)}
          </div>
          <TagInput value={[]} onChange={(tags) => tags[0] && !form.languageDetail.some((item) => item.name === tags[0]) && patch({ languageDetail: [...form.languageDetail, { name: tags[0], level: 'Fluent' }] })} placeholder="Add a language, press Enter" />
        </Field>
      </div>}

      {step === 1 && <div className="wz-body">
        <div className="wz-row">
          <Field label="Current / last title" required><TextInput value={form.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
          <Field label="Years of experience" required><TextInput type="number" min={0} max={60} value={form.yearsExperience} onChange={(e) => patch({ yearsExperience: e.target.value })} /></Field>
        </div>
        <Field label="Seniority" required><Segmented options={['junior', 'mid', 'senior', 'lead', 'exec'] as const} value={form.seniority} onChange={(seniority) => patch({ seniority })} labels={SENIORITY_LABELS} /></Field>
        <Field label="Skills" required hint="At least 3. Click the dots to set your level (1–5).">
          <LevelTagInput value={form.skillsDetail} onChange={(skillsDetail) => patch({ skillsDetail })} />
          <div className="wz-suggestions">{SKILL_SUGGESTIONS.filter((skill) => !form.skillsDetail.some((item) => item.name === skill)).slice(0, 5).map((skill) => <button type="button" key={skill} onClick={() => patch({ skillsDetail: [...form.skillsDetail, { name: skill, level: 3 }] })}>+ {skill}</button>)}</div>
        </Field>
        <Field label="Industries"><TagInput value={form.industries} onChange={(industries) => patch({ industries })} suggestions={['SaaS', 'Fintech', 'Health', 'E-commerce', 'Education', 'Agency']} /></Field>
        <Field label="Work experience">
          <Repeat items={form.workExperience} onChange={(workExperience) => patch({ workExperience })} blank={() => ({ title: '', company: '', from: '', to: '', description: '' })} addLabel="Add experience"
            render={(item, update) => <div className="wz-repeat-grid">
              <TextInput placeholder="Title" value={item.title || ''} onChange={(e) => update({ title: e.target.value })} />
              <TextInput placeholder="Company" value={item.company || ''} onChange={(e) => update({ company: e.target.value })} />
              <TextInput placeholder="From (e.g. 2021)" value={item.from || ''} onChange={(e) => update({ from: e.target.value })} />
              <TextInput placeholder="To (or Present)" value={item.to || ''} onChange={(e) => update({ to: e.target.value })} />
              <textarea className="wz-input wz-textarea" placeholder="What did you build or own?" value={item.description || ''} onChange={(e) => update({ description: e.target.value })} />
            </div>} />
        </Field>
        <Field label="Education">
          <Repeat items={form.education} onChange={(education) => patch({ education })} blank={() => ({ school: '', degree: '', from: '', to: '' })} addLabel="Add education"
            render={(item, update) => <div className="wz-repeat-grid">
              <TextInput placeholder="School" value={item.school || ''} onChange={(e) => update({ school: e.target.value })} />
              <TextInput placeholder="Degree" value={item.degree || ''} onChange={(e) => update({ degree: e.target.value })} />
              <TextInput placeholder="From" value={item.from || ''} onChange={(e) => update({ from: e.target.value })} />
              <TextInput placeholder="To" value={item.to || ''} onChange={(e) => update({ to: e.target.value })} />
            </div>} />
        </Field>
        <Field label="Certifications"><TagInput value={form.certifications} onChange={(certifications) => patch({ certifications })} placeholder="e.g. AWS SA, NN/g UX — press Enter" /></Field>
        <div className="wz-row">
          <Field label="GitHub"><TextInput value={form.links.github || ''} onChange={(e) => patch({ links: { ...form.links, github: e.target.value } })} placeholder="github.com/…" /></Field>
          <Field label="Portfolio"><TextInput value={form.links.portfolio || ''} onChange={(e) => patch({ links: { ...form.links, portfolio: e.target.value } })} /></Field>
        </div>
        <div className="wz-row">
          <Field label="Website"><TextInput value={form.links.website || ''} onChange={(e) => patch({ links: { ...form.links, website: e.target.value } })} /></Field>
          <Field label="LinkedIn"><TextInput value={form.links.linkedin || ''} onChange={(e) => patch({ links: { ...form.links, linkedin: e.target.value } })} placeholder="linkedin.com/in/…" /></Field>
        </div>
      </div>}

      {step === 2 && <div className="wz-body">
        <Field label="Desired roles" required><TagInput value={form.desiredRoles} onChange={(desiredRoles) => patch({ desiredRoles })} placeholder="e.g. Senior Product Designer — press Enter" /></Field>
        <Field label="Employment type" required><Chips options={EMPLOYMENT_TYPES} value={form.employmentTypes} onToggle={(option) => patch({ employmentTypes: form.employmentTypes.includes(option) ? form.employmentTypes.filter((item) => item !== option) : [...form.employmentTypes, option] })} /></Field>
        <Field label="Work mode" required>
          <Segmented options={['remote', 'hybrid', 'onsite'] as const} value={form.workModeChoice} onChange={(workModeChoice) => patch({ workModeChoice })} labels={{ remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }} />
          {form.workModeChoice === 'hybrid' && <div className="wz-hybrid"><span>{form.hybridDays} office day{form.hybridDays === 1 ? '' : 's'}/week</span><input className="wz-slider" type="range" min={0} max={5} value={form.hybridDays} onChange={(e) => patch({ hybridDays: Number(e.target.value) })} /></div>}
        </Field>
        <Field label="Salary expectation" required hint="Shared only as a compatibility badge until you match.">
          <div className="wz-salary">
            <TextInput type="number" min={0} placeholder="Min" value={form.salaryMin} onChange={(e) => patch({ salaryMin: e.target.value })} aria-label="Salary minimum" />
            <span>–</span>
            <TextInput type="number" min={0} placeholder="Max" value={form.salaryMax} onChange={(e) => patch({ salaryMax: e.target.value })} aria-label="Salary maximum" />
            <select className="wz-input wz-select" value={form.currency} onChange={(e) => patch({ currency: e.target.value })} aria-label="Currency">{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select>
          </div>
        </Field>
        <div className="wz-row">
          <Field label="Availability" required><Segmented options={AVAILABILITIES} value={form.availability as typeof AVAILABILITIES[number] | undefined} onChange={(availability) => patch({ availability })} /></Field>
          <Field label="Preferred company size"><select className="wz-input wz-select" value={form.companySize} onChange={(e) => patch({ companySize: e.target.value })}><option value="">No preference</option>{COMPANY_SIZES.map((size) => <option key={size}>{size}</option>)}</select></Field>
        </div>
        <Field label="Open to relocating">
          <Toggle checked={form.relocateOpen} onChange={(relocateOpen) => patch({ relocateOpen })} label={form.relocateOpen ? 'Yes — I would relocate for the right role' : 'No — match me near my city'} />
          {form.relocateOpen && <TagInput value={form.relocateLocations} onChange={(relocateLocations) => patch({ relocateLocations })} placeholder="Cities or countries you'd move to" />}
        </Field>
        <Field label="Work-style tags"><Chips options={WORK_STYLES} value={form.workStyle} onToggle={(option) => patch({ workStyle: form.workStyle.includes(option) ? form.workStyle.filter((item) => item !== option) : [...form.workStyle, option] })} /></Field>
      </div>}

      {step === 3 && <div className="wz-body">
        <Field label="Resume" required hint="PDF or DOCX, up to 10MB. Recruiters see an anonymized preview until you match.">
          <label className={form.resume ? 'wz-upload has-file' : 'wz-upload'}>
            <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
            {uploading ? <><Loader2 size={17} className="spin" /> Uploading…</> : form.resume ? <><FileText size={17} /> {form.resume.originalName} <em>Replace</em></> : <><Upload size={17} /> Upload resume</>}
          </label>
        </Field>
        <Field label="Cover letter (optional)"><textarea className="wz-input wz-textarea" rows={4} value={form.coverLetter} onChange={(e) => patch({ coverLetter: e.target.value })} placeholder="A short default note recruiters see with your profile." /></Field>
        <Field label="Who can see your profile" required>
          <Segmented options={['all', 'after-swipe', 'paused'] as const} value={form.visibility} onChange={(visibility) => patch({ visibility })} labels={{ all: 'All recruiters', 'after-swipe': 'Only after I swipe', paused: 'Paused' }} />
        </Field>
        <Field label="Blocked companies" hint="They will never see your profile."><TagInput value={form.blockedCompanies} onChange={(blockedCompanies) => patch({ blockedCompanies })} placeholder="Company name — press Enter" /></Field>
        <Field label="Open to work" required><Toggle checked={form.openToWork} onChange={(openToWork) => patch({ openToWork })} label={form.openToWork ? 'Actively looking' : 'Not looking right now'} /></Field>
      </div>}

      {(attempted && errors.length > 0) && <ul className="wz-errors">{errors.map((message) => <li key={message}>{message}</li>)}</ul>}
      {error && <p className="auth-error">{error}</p>}

      <footer className="wz-foot">
        {step > 0 ? <button className="secondary-button" onClick={() => { setStep(step - 1); setAttempted(false); }}><ArrowLeft size={16} /> Back</button> : onCancel ? <button className="secondary-button" onClick={onCancel}>Cancel</button> : <span />}
        <button className="primary-button" onClick={next} disabled={saving || uploading}>
          {saving ? <Loader2 size={16} className="spin" /> : finishing ? <><Check size={16} /> Finish profile</> : <>Continue <ArrowRight size={16} /></>}
        </button>
      </footer>
    </div>
  </div>;
}
