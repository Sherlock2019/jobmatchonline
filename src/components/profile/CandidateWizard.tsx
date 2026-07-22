import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, MapPin, Sparkles, Upload } from 'lucide-react';
import { api } from '../../api';
import { Chips, Field, LevelTagInput, Repeat, Segmented, TagInput, TextInput, Toggle } from './fields';
import type { AgePrivacy, ContactChannel, ContactChannelType, Education, LanguageTag, Person, Recommendation, ResumeMeta, Seniority, SkillTag, WorkExperience } from '../../types';

const SENIORITY_LABELS = { junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead', exec: 'Exec' };
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'] as const;
const AVAILABILITIES = ['Now', '2 weeks', '1 month', '3 months'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'VND', 'SGD', 'AUD'] as const;
const SALARY_PERIODS = ['year', 'month', 'day', 'hour'] as const;
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;
const LANGUAGE_LEVELS = ['Basic', 'Intermediate/B1', 'Professional/B2', 'Advanced/C1', 'Fluent/C2', 'Native'] as const;
const SKILL_SUGGESTIONS = ['Figma', 'Design systems', 'Research', 'Product strategy', 'React', 'TypeScript', 'Prototyping', 'Analytics'] as const;
const WORK_STYLES = ['Autonomous', 'Collaborative', 'Fast-paced', 'Structured', 'Async-first', 'Mentorship'] as const;
const CONTACT_TYPES: readonly ContactChannelType[] = ['whatsapp', 'telegram', 'phone', 'signal', 'wechat', 'zalo', 'other'];
const AGE_PRIVACY_LABELS = { public: 'Show publicly', 'after-match': 'Only after matching', private: 'Keep private' } as const;
const WORK_AUTH_OPTIONS = ['Citizen', 'Permanent resident', 'Work visa held', 'Needs sponsorship', 'Working-holiday visa'] as const;
const MINDSET_SUGGESTIONS = ['Curious', 'Accountable', 'Resilient', 'Empathetic', 'Pragmatic', 'Driven', 'Calm under pressure', 'Growth-minded'] as const;
const HUMAN_SKILLS = ['Leadership', 'Communication', 'Collaboration', 'Creativity', 'Problem solving', 'Adaptability', 'Mentoring', 'Ownership', 'Strategic thinking', 'Attention to detail'] as const;
const INTEREST_SUGGESTIONS = ['Coffee', 'Cycling', 'Music', 'AI projects', 'Travel', 'Gaming', 'Reading', 'Cooking', 'Photography'] as const;

// The five wizard steps mirror the five profile cards recruiters swipe through.
export const CANDIDATE_STEPS = ['Snapshot', 'Technical stack', 'Preferences', 'Human stack', 'Reviews & visibility'] as const;

type Form = {
  name: string; photo: string; headline: string; email: string; phone: string; city: string; country: string;
  nationality: string; birthdate: string; agePrivacy: AgePrivacy; workAuthorization: string; visaSponsorship: boolean;
  pronouns: string; contactChannels: ContactChannel[];
  distanceRangeKm: number; geo?: { lat: number; lng: number }; languageDetail: LanguageTag[];
  title: string; yearsExperience: string; seniority?: Seniority; skillsDetail: SkillTag[]; industries: string[];
  workExperience: WorkExperience[]; education: Education[]; certifications: string[];
  links: { github?: string; portfolio?: string; website?: string; linkedin?: string };
  desiredRoles: string[]; employmentTypes: string[]; workModeChoice?: 'remote' | 'hybrid' | 'onsite'; hybridDays: number;
  salaryMin: string; salaryMax: string; currency: string; salaryPeriod: string; salaryNegotiable: boolean;
  availability?: string; noticePeriod: string; travel: string;
  relocateOpen: boolean; relocateLocations: string[]; companySize: string; prefIndustries: string[]; workStyle: string[];
  presentation: string; mindset: string[]; humanSkills: string[]; workingPrefer: string[]; workingAvoid: string[];
  interests: string[]; motto: string; favoriteSong: string; recommendations: Recommendation[];
  resume?: ResumeMeta; coverLetter: string; visibility?: 'all' | 'after-swipe' | 'paused'; blockedCompanies: string[]; openToWork: boolean;
};

function fromPerson(p: Person): Form {
  return {
    name: p.name || '', photo: p.photo || '', headline: p.headline || '', email: p.email || '', phone: p.phone || '',
    city: p.city || (p.location ? p.location.split('·')[0].trim() : ''), country: p.country || '',
    nationality: p.nationality || '', birthdate: p.birthdate || '', agePrivacy: p.agePrivacy || (p.discloseAge ? 'public' : 'private'),
    workAuthorization: p.workAuthorization || '', visaSponsorship: p.visaSponsorship ?? false, pronouns: p.pronouns || '',
    contactChannels: p.contactChannels || (p.phone ? [{ type: 'phone', value: p.phone }] : []),
    distanceRangeKm: p.distanceRangeKm ?? 25, geo: p.geo,
    languageDetail: p.languageDetail || (p.languages || []).map((name) => ({ name, level: 'Fluent/C2' })),
    title: p.title === 'New member' ? '' : p.title || '', yearsExperience: p.yearsExperience !== undefined ? String(p.yearsExperience) : '',
    seniority: p.seniority || (['junior', 'mid', 'senior', 'lead', 'exec'].includes(p.experienceLevel) ? p.experienceLevel as Seniority : undefined),
    skillsDetail: p.skillsDetail || (p.skills || []).map((name) => ({ name, level: 3 })),
    industries: p.industries || [], workExperience: p.workExperience || [], education: p.education || [], certifications: p.certifications || [],
    links: p.links || {},
    desiredRoles: p.preferences?.desiredRoles || [], employmentTypes: p.preferences?.employmentTypes || [],
    workModeChoice: p.preferences?.workMode?.mode, hybridDays: p.preferences?.workMode?.hybridDays ?? 2,
    salaryMin: p.preferences?.salary?.min !== undefined ? String(p.preferences.salary.min) : '',
    salaryMax: p.preferences?.salary?.max !== undefined ? String(p.preferences.salary.max) : '',
    currency: p.preferences?.salary?.currency || 'USD', salaryPeriod: p.preferences?.salary?.period || 'year', salaryNegotiable: p.preferences?.salary?.negotiable ?? false,
    availability: p.preferences?.availability, noticePeriod: p.preferences?.noticePeriod || '', travel: p.preferences?.travel || '',
    relocateOpen: p.preferences?.relocate?.open ?? false, relocateLocations: p.preferences?.relocate?.locations || [],
    companySize: p.preferences?.companySize || '', prefIndustries: p.preferences?.industries || [], workStyle: p.preferences?.workStyle || [],
    presentation: p.presentation || '', mindset: p.mindset || [], humanSkills: p.humanSkills || [],
    workingPrefer: p.workingPrefer || [], workingAvoid: p.workingAvoid || [], interests: p.interests || [],
    motto: p.motto || '', favoriteSong: p.favoriteSong || '', recommendations: p.recommendations || [],
    resume: p.documents?.resume, coverLetter: p.documents?.coverLetter || '',
    visibility: p.privacy?.visibility, blockedCompanies: p.privacy?.blockedCompanies || [],
    openToWork: p.privacy?.openToWork ?? true,
  };
}

function stepPayload(step: number, form: Form, finishing: boolean) {
  if (step === 0) return {
    name: form.name, photo: form.photo || undefined, headline: form.headline, email: form.email,
    phone: form.contactChannels.find((c) => c.type === 'phone' || c.type === 'whatsapp')?.value || form.phone || undefined,
    city: form.city, country: form.country, nationality: form.nationality || undefined,
    birthdate: form.birthdate || undefined, agePrivacy: form.agePrivacy,
    workAuthorization: form.workAuthorization || undefined, visaSponsorship: form.visaSponsorship, pronouns: form.pronouns || undefined,
    contactChannels: form.contactChannels.filter((c) => c.value.trim()),
    distanceRangeKm: form.distanceRangeKm, geo: form.geo, languageDetail: form.languageDetail,
  };
  if (step === 1) return {
    title: form.title, yearsExperience: Number(form.yearsExperience), seniority: form.seniority, skillsDetail: form.skillsDetail,
    industries: form.industries, workExperience: form.workExperience, education: form.education, certifications: form.certifications, links: form.links,
    coverLetter: form.coverLetter,
  };
  if (step === 2) return {
    availability: form.availability,
    preferences: {
      desiredRoles: form.desiredRoles, employmentTypes: form.employmentTypes,
      workMode: form.workModeChoice ? { mode: form.workModeChoice, hybridDays: form.workModeChoice === 'hybrid' ? form.hybridDays : undefined } : undefined,
      salary: { min: Number(form.salaryMin), max: Number(form.salaryMax), currency: form.currency, period: form.salaryPeriod, negotiable: form.salaryNegotiable },
      availability: form.availability, noticePeriod: form.noticePeriod || undefined, travel: form.travel || undefined,
      relocate: { open: form.relocateOpen, locations: form.relocateLocations },
      companySize: form.companySize || undefined, industries: form.prefIndustries, workStyle: form.workStyle,
    },
  };
  if (step === 3) return {
    presentation: form.presentation || undefined, mindset: form.mindset, humanSkills: form.humanSkills,
    workingPrefer: form.workingPrefer, workingAvoid: form.workingAvoid, interests: form.interests,
    motto: form.motto || undefined, favoriteSong: form.favoriteSong || undefined,
  };
  return {
    recommendations: form.recommendations,
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
    if (!form.resume) errors.push('Upload your resume (PDF or DOCX)');
  }
  if (step === 2) {
    if (!form.desiredRoles.length) errors.push('Add at least one desired role');
    if (!form.employmentTypes.length) errors.push('Pick at least one employment type');
    if (!form.workModeChoice) errors.push('Pick a work mode');
    if (form.salaryMin === '' || form.salaryMax === '') errors.push('Salary expectation range is required');
    else if (Number(form.salaryMin) > Number(form.salaryMax)) errors.push('Salary minimum cannot exceed maximum');
    if (!form.availability) errors.push('Pick your availability');
    if (form.workStyle.length < 3) errors.push('Pick at least 3 work-style tags');
  }
  if (step === 3) {
    if (!form.presentation.trim()) errors.push('A short personal introduction is required');
  }
  if (step === 4) {
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
  const [autofilling, setAutofilling] = useState(false);
  const [autofillNote, setAutofillNote] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState('');
  const captureLocation = async () => {
    setGeoBusy(true); setError('');
    try { const { getBrowserLocation } = await import('../../lib/geo'); patch({ geo: await getBrowserLocation() }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not get your location'); }
    finally { setGeoBusy(false); }
  };
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
    try {
      const { resume } = await api.uploadResume(viewer.id, file);
      patch({ resume });
      // No pdftoppm on the server: render the page-1 thumbnail here with pdf.js.
      if (resume.needsClientThumbnail && file.type === 'application/pdf') {
        const { makePdfThumbnail } = await import('../../lib/pdf');
        const thumbnail = await makePdfThumbnail(file);
        if (thumbnail) await api.uploadResumeThumbnail(viewer.id, thumbnail);
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  // Upload a resume and pre-fill the whole wizard from it (review then continue).
  const autofillFromResume = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('Resume must be 10MB or smaller'); return; }
    setAutofilling(true); setError('');
    try {
      await uploadResume(file);
      const { fields } = await api.resumeAutofill(viewer.id);
      setForm((current) => ({
        ...current,
        headline: fields.headline || current.headline,
        title: fields.title || current.title,
        yearsExperience: fields.yearsExperience !== undefined ? String(fields.yearsExperience) : current.yearsExperience,
        seniority: (fields.seniority as Seniority) || current.seniority,
        skillsDetail: fields.skills?.length ? fields.skills : current.skillsDetail,
        languageDetail: fields.languages?.length ? fields.languages : current.languageDetail,
        industries: fields.industries?.length ? fields.industries : current.industries,
        workExperience: fields.workExperience?.length ? fields.workExperience : current.workExperience,
        education: fields.education?.length ? fields.education : current.education,
        certifications: fields.certifications?.length ? fields.certifications : current.certifications,
        links: fields.links ? { ...current.links, ...fields.links } : current.links,
      }));
      setAutofillNote('Filled from your resume — review each step and edit anything before continuing.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Auto-fill failed'); }
    finally { setAutofilling(false); }
  };

  return <div className="wizard-page">
    <div className="wizard-card">
      <header className="wz-head">
        <div><span className="overline">Set up your candidate profile</span><h1>{CANDIDATE_STEPS[step]}</h1></div>
        <span className="wz-step-count">Step {step + 1} of {CANDIDATE_STEPS.length}</span>
      </header>
      <div className="wz-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={CANDIDATE_STEPS.length}><i style={{ width: `${((step + 1) / CANDIDATE_STEPS.length) * 100}%` }} /></div>

      {step === 0 && <div className={autofillNote ? 'wz-autofill done' : 'wz-autofill'}>
        <Sparkles size={17} />
        <div className="wz-autofill-text"><strong>Have a resume? Skip the typing.</strong><span>{autofillNote || 'Upload it and we’ll fill in your skills, experience, and more — you review before saving.'}</span></div>
        <label className="secondary-button wz-autofill-btn">
          <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => e.target.files?.[0] && autofillFromResume(e.target.files[0])} />
          {autofilling ? <><Loader2 size={15} className="spin" /> Reading…</> : <><Upload size={15} /> Upload &amp; autofill</>}
        </label>
      </div>}

      {step === 0 && <div className="wz-body">
        <div className="wz-row">
          <Field label="Full name" required><TextInput value={form.name} onChange={(e) => patch({ name: e.target.value })} autoComplete="name" /></Field>
          <Field label="Email" required><TextInput type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} autoComplete="email" /></Field>
        </div>
        <div className="wz-row">
          <Field label="Photo URL" hint="Pre-filled from your provider when you signed in with LinkedIn or Google.">
            <div className="wz-photo-row">{form.photo && <img src={form.photo} alt="" />}<TextInput value={form.photo} onChange={(e) => patch({ photo: e.target.value })} placeholder="https://…" /></div>
          </Field>
          <Field label="Pronouns (optional)"><TextInput value={form.pronouns} onChange={(e) => patch({ pronouns: e.target.value })} placeholder="e.g. she/her, they/them" /></Field>
        </div>
        <Field label="Headline" required hint="One line that sells your craft."><TextInput value={form.headline} onChange={(e) => patch({ headline: e.target.value })} placeholder="e.g. Product designer who ships design systems" /></Field>
        <div className="wz-row">
          <Field label="City" required><TextInput value={form.city} onChange={(e) => patch({ city: e.target.value })} /></Field>
          <Field label="Country" required><TextInput value={form.country} onChange={(e) => patch({ country: e.target.value })} /></Field>
        </div>
        <div className="wz-row">
          <Field label="Nationality (optional)" hint="Never affects your match score."><TextInput value={form.nationality} onChange={(e) => patch({ nationality: e.target.value })} /></Field>
          <Field label="Date of birth (optional)"><TextInput type="date" value={form.birthdate} onChange={(e) => patch({ birthdate: e.target.value })} /></Field>
        </div>
        {form.birthdate && <Field label="Who can see your age" hint="Age never affects matching."><Segmented options={['public', 'after-match', 'private'] as const} value={form.agePrivacy} onChange={(agePrivacy) => patch({ agePrivacy })} labels={AGE_PRIVACY_LABELS} /></Field>}
        <div className="wz-row">
          <Field label="Work authorization" hint="Shown as a status, never a document."><select className="wz-input wz-select" value={form.workAuthorization} onChange={(e) => patch({ workAuthorization: e.target.value })}><option value="">Prefer not to say</option>{WORK_AUTH_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Visa sponsorship"><Toggle checked={form.visaSponsorship} onChange={(visaSponsorship) => patch({ visaSponsorship })} label={form.visaSponsorship ? 'I need sponsorship' : 'No sponsorship needed'} /></Field>
        </div>
        <Field label="Location for distance matching" hint="Enables real distance to roles. Your exact coordinates are never shown to anyone.">
          <button type="button" className={form.geo ? 'wz-geo-btn set' : 'wz-geo-btn'} onClick={captureLocation} disabled={geoBusy}>
            {geoBusy ? <><Loader2 size={15} className="spin" /> Locating…</> : form.geo ? <><MapPin size={15} /> Location set ✓ — tap to update</> : <><MapPin size={15} /> Use my current location</>}
          </button>
        </Field>
        <Field label={`Distance range: ${form.distanceRangeKm} km`} required hint="How far you'll match for on-site/hybrid roles. Shown on your profile; exact location stays private.">
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
          <TagInput value={[]} onChange={(tags) => tags[0] && !form.languageDetail.some((item) => item.name === tags[0]) && patch({ languageDetail: [...form.languageDetail, { name: tags[0], level: 'Fluent/C2' }] })} placeholder="Add a language, press Enter" />
        </Field>
        <Field label="Contact channels" hint="Email and these stay hidden until you and a company mutually match.">
          <Repeat items={form.contactChannels} onChange={(contactChannels) => patch({ contactChannels })} blank={() => ({ type: 'whatsapp' as ContactChannelType, value: '' })} addLabel="Add a contact channel"
            render={(item, update) => <div className="wz-contact-row">
              <select className="wz-input wz-select" value={item.type} onChange={(e) => update({ type: e.target.value as ContactChannelType })}>{CONTACT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select>
              <TextInput placeholder="Number or username" value={item.value} onChange={(e) => update({ value: e.target.value })} />
            </div>} />
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
        <Field label="Resume" required hint="PDF or DOCX, up to 10MB. Recruiters read it in-app and can download the PDF.">
          <label className={form.resume ? 'wz-upload has-file' : 'wz-upload'}>
            <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
            {uploading ? <><Loader2 size={17} className="spin" /> Uploading…</> : form.resume ? <><FileText size={17} /> {form.resume.originalName} <em>Replace</em></> : <><Upload size={17} /> Upload resume</>}
          </label>
        </Field>
        <Field label="Cover letter (optional)"><textarea className="wz-input wz-textarea" rows={4} value={form.coverLetter} onChange={(e) => patch({ coverLetter: e.target.value })} placeholder="A short default note recruiters see with your profile." /></Field>
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
            <span>/</span>
            <select className="wz-input wz-select" value={form.salaryPeriod} onChange={(e) => patch({ salaryPeriod: e.target.value })} aria-label="Pay period">{SALARY_PERIODS.map((period) => <option key={period}>{period}</option>)}</select>
          </div>
          <div className="wz-inline"><Toggle checked={form.salaryNegotiable} onChange={(salaryNegotiable) => patch({ salaryNegotiable })} label="Negotiable" /></div>
        </Field>
        <div className="wz-row">
          <Field label="Availability" required><Segmented options={AVAILABILITIES} value={form.availability as typeof AVAILABILITIES[number] | undefined} onChange={(availability) => patch({ availability })} /></Field>
          <Field label="Notice period"><TextInput value={form.noticePeriod} onChange={(e) => patch({ noticePeriod: e.target.value })} placeholder="e.g. 30 days" /></Field>
        </div>
        <div className="wz-row">
          <Field label="Preferred company size"><select className="wz-input wz-select" value={form.companySize} onChange={(e) => patch({ companySize: e.target.value })}><option value="">No preference</option>{COMPANY_SIZES.map((size) => <option key={size}>{size}</option>)}</select></Field>
          <Field label="Travel willingness"><TextInput value={form.travel} onChange={(e) => patch({ travel: e.target.value })} placeholder="e.g. Up to 25%" /></Field>
        </div>
        <Field label="Preferred industries"><TagInput value={form.prefIndustries} onChange={(prefIndustries) => patch({ prefIndustries })} suggestions={['SaaS', 'Fintech', 'Health', 'AI', 'E-commerce', 'Telecom']} /></Field>
        <Field label="Open to relocating">
          <Toggle checked={form.relocateOpen} onChange={(relocateOpen) => patch({ relocateOpen })} label={form.relocateOpen ? 'Yes — I would relocate for the right role' : 'No — match me near my city'} />
          {form.relocateOpen && <TagInput value={form.relocateLocations} onChange={(relocateLocations) => patch({ relocateLocations })} placeholder="Cities or countries you'd move to" />}
        </Field>
        <Field label="Work-style tags" required hint="Pick 3–6 that describe how you work best."><Chips options={WORK_STYLES} value={form.workStyle} onToggle={(option) => patch({ workStyle: form.workStyle.includes(option) ? form.workStyle.filter((item) => item !== option) : form.workStyle.length < 6 ? [...form.workStyle, option] : form.workStyle })} /></Field>
      </div>}

      {step === 3 && <div className="wz-body">
        <Field label="Personal introduction" required hint="A few sentences on who you are beyond the CV — how you work and what you value.">
          <textarea className="wz-input wz-textarea" rows={4} value={form.presentation} onChange={(e) => patch({ presentation: e.target.value })} placeholder="I enjoy turning hard problems into simple systems teams can operate confidently. I work best with transparent leaders and practical teams…" />
        </Field>
        <Field label="Mindset" hint="Pick a few traits that describe you."><Chips options={MINDSET_SUGGESTIONS} value={form.mindset} onToggle={(option) => patch({ mindset: form.mindset.includes(option) ? form.mindset.filter((item) => item !== option) : form.mindset.length < 5 ? [...form.mindset, option] : form.mindset })} /></Field>
        <Field label="Human capabilities" hint="Up to 8."><Chips options={HUMAN_SKILLS} value={form.humanSkills} onToggle={(option) => patch({ humanSkills: form.humanSkills.includes(option) ? form.humanSkills.filter((item) => item !== option) : form.humanSkills.length < 8 ? [...form.humanSkills, option] : form.humanSkills })} /></Field>
        <div className="wz-row">
          <Field label="I thrive with"><TagInput value={form.workingPrefer} onChange={(workingPrefer) => patch({ workingPrefer })} placeholder="e.g. Clear objectives — press Enter" /></Field>
          <Field label="I avoid"><TagInput value={form.workingAvoid} onChange={(workingAvoid) => patch({ workingAvoid })} placeholder="e.g. Constant meetings — press Enter" /></Field>
        </div>
        <Field label="Interests" hint="Optional conversation starters."><TagInput value={form.interests} onChange={(interests) => patch({ interests })} suggestions={INTEREST_SUGGESTIONS} /></Field>
        <div className="wz-row">
          <Field label="Personal motto (optional)"><TextInput value={form.motto} onChange={(e) => patch({ motto: e.target.value })} placeholder="Optional one-liner" /></Field>
          <Field label="Favorite song (optional)" hint="Spotify or YouTube link — opens externally, never autoplays."><TextInput value={form.favoriteSong} onChange={(e) => patch({ favoriteSong: e.target.value })} placeholder="https://…" /></Field>
        </div>
      </div>}

      {step === 4 && <div className="wz-body">
        <Field label="Recommendations (optional)" hint="Add recommendations former recruiters or managers have given you. Only ones you approve appear on your profile.">
          <Repeat items={form.recommendations} onChange={(recommendations) => patch({ recommendations })} blank={() => ({ recruiterName: '', role: '', company: '', relationship: '', text: '' })} addLabel="Add a recommendation"
            render={(item, update) => <div className="wz-repeat-grid">
              <TextInput placeholder="Their name" value={item.recruiterName || ''} onChange={(e) => update({ recruiterName: e.target.value })} />
              <TextInput placeholder="Their role" value={item.role || ''} onChange={(e) => update({ role: e.target.value })} />
              <TextInput placeholder="Company" value={item.company || ''} onChange={(e) => update({ company: e.target.value })} />
              <TextInput placeholder="Relationship (e.g. Former manager)" value={item.relationship || ''} onChange={(e) => update({ relationship: e.target.value })} />
              <textarea className="wz-input wz-textarea" placeholder="What they said about working with you" value={item.text || ''} onChange={(e) => update({ text: e.target.value })} />
            </div>} />
        </Field>
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
