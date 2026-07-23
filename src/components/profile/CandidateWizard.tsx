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
const INTEREST_SUGGESTIONS = ['Coffee', 'Cycling', 'Music', 'AI projects', 'Travel', 'Gaming', 'Reading', 'Cooking', 'Photography'] as const;

// Supporting traits offered on the About Me step (deterministic — no LLM involved yet).
const ABOUT_ME_TRAITS = ['Accountable', 'Adaptable', 'Analytical', 'Collaborative', 'Creative', 'Curious', 'Empathetic', 'Hands-on', 'Independent', 'Organized', 'Practical', 'Reliable', 'Resilient', 'Strategic', 'Supportive'] as const;

export type Archetype = { id: string; cardTitle: string; prefilled: string; defaultTraits: string[] };

// Prefilled "About Me" starting points — pick one, personalize, edit freely.
// Trimmed from 14 to 8: the most overlapping types are folded into a close neighbor
// (Reliable Operator -> Team Servant, Goal Achiever -> Doer, Strategist -> Problem Solver,
// Change Maker -> Leader, Explorer -> Innovator, Connector -> Customer Champion) so the
// picker is a quick scan instead of a wall of chips.
export const ARCHETYPES: Archetype[] = [
  { id: 'team-servant', cardTitle: 'I Help the Team Succeed', defaultTraits: ['Supportive', 'Reliable', 'Collaborative', 'Empathetic'],
    prefilled: 'I believe strong teams succeed when people support one another, communicate openly, and share responsibility. I am usually the person who helps remove blockers, listens carefully, and makes sure everyone has what they need to perform well. People can depend on me to follow through — I take pride in being careful and consistent with the work entrusted to me.\n\nI do not need to be the loudest person in the room. I prefer to contribute through reliability, practical support, and consistent follow-through, communicating early when risks appear rather than hiding problems. I value trust, respect, shared ownership, and celebrating team success rather than individual credit.' },
  { id: 'doer', cardTitle: 'I Turn Ideas Into Action', defaultTraits: ['Hands-on', 'Practical', 'Independent', 'Accountable'],
    prefilled: 'I am action-oriented and enjoy moving quickly from discussion to execution. When I see a problem, I prefer to understand it, define the next practical step, and start making progress toward a clear, measurable goal.\n\nI work well in environments where people take ownership and avoid unnecessary complexity. I am disciplined and persistent about seeing things through, comfortable learning while doing, and I believe achieving the right result matters more than simply completing a list of tasks.' },
  { id: 'problem-solver', cardTitle: 'I Enjoy Solving Difficult Problems', defaultTraits: ['Analytical', 'Curious', 'Strategic'],
    prefilled: 'I enjoy understanding complex problems, identifying their root causes, and finding solutions that are both effective and practical. I naturally ask questions, test assumptions, and connect daily decisions to the wider context and long-term goals behind them.\n\nI am comfortable working with uncertainty and I remain calm when the first solution does not work. I value evidence, clear thinking, and combining analysis with practical execution — strategy, to me, is a clear direction that helps people make better decisions, not a document.' },
  { id: 'builder', cardTitle: 'I Build Things That Last', defaultTraits: ['Creative', 'Hands-on'],
    prefilled: 'I enjoy creating products, systems, processes, and teams from the ground up. I like turning incomplete ideas into something useful, reliable, and scalable.\n\nI think beyond the first version and consider how the work will be maintained, improved, and used by others. I value strong foundations, simple design, clear documentation, and continuous improvement.' },
  { id: 'leader', cardTitle: 'I Create Direction and Enable Others', defaultTraits: ['Supportive', 'Strategic', 'Accountable', 'Adaptable'],
    prefilled: 'I see leadership as creating clarity, building trust, and helping people perform at their best. I enjoy aligning teams around a common objective, making difficult decisions, and helping organizations move from an existing way of working toward something better.\n\nI lead with accountability and transparency, focusing on building understanding and reducing resistance so progress happens without unnecessary disruption. I am comfortable taking responsibility when things go wrong and giving credit to the team when things go well.' },
  { id: 'mentor', cardTitle: 'I Help People Grow', defaultTraits: ['Supportive'],
    prefilled: 'I enjoy sharing knowledge, supporting colleagues, and helping people become more confident and capable. I believe mentoring is not about providing every answer, but helping others develop their own judgment and problem-solving skills.\n\nI am patient, approachable, and comfortable giving honest but constructive feedback. I value learning cultures where questions are welcomed and knowledge is shared openly.' },
  { id: 'innovator', cardTitle: 'I Look for Better Ways', defaultTraits: ['Curious', 'Creative', 'Adaptable'],
    prefilled: 'I am naturally curious and often look for better ways to solve problems, improve experiences, or create new opportunities. I enjoy entering unfamiliar situations and learning quickly — new technologies, industries, and challenges energize me.\n\nI am comfortable challenging assumptions, experimenting carefully, and adapting as I gain more information. I believe innovation should produce real value rather than novelty alone, and I work best in environments that encourage curiosity and continuous learning.' },
  { id: 'customer-champion', cardTitle: 'I Start With the Customer', defaultTraits: ['Empathetic', 'Reliable', 'Collaborative'],
    prefilled: 'I believe the best solutions begin with a clear understanding of people’s real needs. I enjoy listening, connecting people and ideas that can benefit from one another, and translating problems into practical solutions that create measurable value.\n\nI aim to build trust through honesty, reliability, and clear communication across technical, business, and leadership audiences. I am comfortable balancing expectations with technical, operational, and business realities.' },
];

type AboutMeAnswers = { bestWhen: string; relyOnMe: string; proudResult: string };

/** Deterministic template composition — no LLM involved. Archetype paragraph + the candidate's own sentence endings. */
function composeAboutMe(archetype: Archetype, answers: AboutMeAnswers): string {
  const extra = [
    answers.bestWhen.trim() && `I am at my best when ${answers.bestWhen.trim()}.`,
    answers.relyOnMe.trim() && `People can rely on me to ${answers.relyOnMe.trim()}.`,
    answers.proudResult.trim() && `A result I am proud of is ${answers.proudResult.trim()}.`,
  ].filter(Boolean).join(' ');
  return extra ? `${archetype.prefilled}\n\n${extra}` : archetype.prefilled;
}

// The six wizard steps mirror the profile cards recruiters swipe through, plus the About Me step.
// The first four carry every must-have field; the last two are optional and skippable.
export const CANDIDATE_STEPS = ['Snapshot', 'Technical stack', 'Preferences', 'About me', 'Human stack', 'Reviews & visibility'] as const;
const CANDIDATE_REQUIRED_STEPS = 4;

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
  presentation: string; aboutMeArchetype?: string; mindset: string[]; humanSkills: string[]; workingPrefer: string[]; workingAvoid: string[];
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
    presentation: p.presentation || '', aboutMeArchetype: p.aboutMeArchetype, mindset: p.mindset || [], humanSkills: p.humanSkills || [],
    workingPrefer: p.workingPrefer || [], workingAvoid: p.workingAvoid || [], interests: p.interests || [],
    motto: p.motto || '', favoriteSong: p.favoriteSong || '', recommendations: p.recommendations || [],
    resume: p.documents?.resume, coverLetter: p.documents?.coverLetter || '',
    visibility: p.privacy?.visibility || 'all', blockedCompanies: p.privacy?.blockedCompanies || [],
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
    presentation: form.presentation || undefined, aboutMeArchetype: form.aboutMeArchetype, motto: form.motto || undefined, humanSkills: form.humanSkills,
  };
  if (step === 4) return {
    mindset: form.mindset, workingPrefer: form.workingPrefer, workingAvoid: form.workingAvoid,
    interests: form.interests, favoriteSong: form.favoriteSong || undefined,
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
    if (!/.+@.+\..+/.test(form.email)) errors.push('A valid email is required');
    if (!form.city.trim() || !form.country.trim()) errors.push('City and country are required');
    if (!form.nationality.trim()) errors.push('Nationality is required');
    if (!form.workAuthorization) errors.push('Work authorization status is required');
  }
  if (step === 1) {
    if (!form.title.trim()) errors.push('Current or last title is required');
    if (form.yearsExperience === '' || Number.isNaN(Number(form.yearsExperience))) errors.push('Years of experience is required');
    if (!form.seniority) errors.push('Pick a seniority level');
    if (form.skillsDetail.length < 1) errors.push('Add at least 1 skill');
  }
  if (step === 2) {
    if (!form.desiredRoles.length) errors.push('Add at least one desired role');
    if (!form.employmentTypes.length) errors.push('Pick at least one employment type');
    if (!form.workModeChoice) errors.push('Pick a work mode');
    if (form.salaryMin === '' || form.salaryMax === '') errors.push('Salary expectation range is required');
    else if (Number(form.salaryMin) > Number(form.salaryMax)) errors.push('Salary minimum cannot exceed maximum');
  }
  if (step === 3) {
    if (!form.presentation.trim()) errors.push('About Me is required — pick an identity to start from a template, or write your own');
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
  const [aboutMeAnswers, setAboutMeAnswers] = useState<AboutMeAnswers>({ bestWhen: '', relyOnMe: '', proudResult: '' });
  const pickArchetype = (archetype: Archetype) => {
    patch({
      aboutMeArchetype: archetype.id,
      motto: archetype.cardTitle,
      presentation: composeAboutMe(archetype, aboutMeAnswers),
      humanSkills: form.humanSkills.length ? form.humanSkills : archetype.defaultTraits,
    });
  };
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

  // Jumps straight to done from the first optional step, saving whatever's filled in
  // across the remaining (skippable) steps without forcing the user to click through them.
  const skipRest = async () => {
    setSaving(true); setError('');
    try {
      const payload = { ...stepPayload(4, form, false), ...stepPayload(5, form, true) };
      const { user } = await api.updateProfile(viewer.id, payload as Partial<Person>);
      onDone(user);
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
        <div><span className="overline">{step < CANDIDATE_REQUIRED_STEPS ? 'Set up your candidate profile' : 'Optional — add now or skip and edit later'}</span><h1>{CANDIDATE_STEPS[step]}</h1></div>
        <span className="wz-step-count">{step < CANDIDATE_REQUIRED_STEPS ? `Step ${step + 1} of ${CANDIDATE_REQUIRED_STEPS}` : `Optional ${step - CANDIDATE_REQUIRED_STEPS + 1} of ${CANDIDATE_STEPS.length - CANDIDATE_REQUIRED_STEPS}`}</span>
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
        <Field label="Headline (optional)" hint="One line that sells your craft."><TextInput value={form.headline} onChange={(e) => patch({ headline: e.target.value })} placeholder="e.g. Product designer who ships design systems" /></Field>
        <div className="wz-row">
          <Field label="City" required><TextInput value={form.city} onChange={(e) => patch({ city: e.target.value })} /></Field>
          <Field label="Country" required><TextInput value={form.country} onChange={(e) => patch({ country: e.target.value })} /></Field>
        </div>
        <div className="wz-row">
          <Field label="Nationality" required hint="Never affects your match score — recruiters need it to check work eligibility, like on LinkedIn."><TextInput value={form.nationality} onChange={(e) => patch({ nationality: e.target.value })} /></Field>
          <Field label="Date of birth (optional)"><TextInput type="date" value={form.birthdate} onChange={(e) => patch({ birthdate: e.target.value })} /></Field>
        </div>
        {form.birthdate && <Field label="Who can see your age" hint="Age never affects matching."><Segmented options={['public', 'after-match', 'private'] as const} value={form.agePrivacy} onChange={(agePrivacy) => patch({ agePrivacy })} labels={AGE_PRIVACY_LABELS} /></Field>}
        <div className="wz-row">
          <Field label="Work authorization" required hint="Your status relative to where you'll work — shown as a status, never a document."><select className="wz-input wz-select" value={form.workAuthorization} onChange={(e) => patch({ workAuthorization: e.target.value })}><option value="">Select one…</option>{WORK_AUTH_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></Field>
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
        <Field label="Skills" required hint="At least 1 — add more any time. Click the dots to set your level (1–5).">
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
        <Field label="Resume (optional)" hint="PDF or DOCX, up to 10MB. Speeds up recruiter review, but you can add it later.">
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
          <Field label="Availability (optional)"><Segmented options={AVAILABILITIES} value={form.availability as typeof AVAILABILITIES[number] | undefined} onChange={(availability) => patch({ availability })} /></Field>
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
        <Field label="Work-style tags (optional)" hint="Pick up to 6 that describe how you work best."><Chips options={WORK_STYLES} value={form.workStyle} onToggle={(option) => patch({ workStyle: form.workStyle.includes(option) ? form.workStyle.filter((item) => item !== option) : form.workStyle.length < 6 ? [...form.workStyle, option] : form.workStyle })} /></Field>
      </div>}

      {step === 3 && <div className="wz-body">
        <p className="wz-hint" style={{ margin: '-6px 0 4px' }}>Pick a professional identity for a prefilled starting point, personalize it, and edit anything — or skip the picker and write your own.</p>
        <Field label="Choose your professional identity" hint="Sets a prefilled About Me you can edit below.">
          <div className="wz-chips">
            {ARCHETYPES.map((a) => <button type="button" key={a.id} className={form.aboutMeArchetype === a.id ? 'active' : ''} aria-pressed={form.aboutMeArchetype === a.id} onClick={() => pickArchetype(a)}>{a.cardTitle}</button>)}
          </div>
        </Field>
        <Field label="Supporting traits (optional)" hint="Pick up to 6."><Chips options={ABOUT_ME_TRAITS} value={form.humanSkills} onToggle={(option) => patch({ humanSkills: form.humanSkills.includes(option) ? form.humanSkills.filter((item) => item !== option) : form.humanSkills.length < 6 ? [...form.humanSkills, option] : form.humanSkills })} /></Field>
        <div className="wz-row">
          <Field label="I am at my best when… (optional)"><TextInput value={aboutMeAnswers.bestWhen} onChange={(e) => setAboutMeAnswers({ ...aboutMeAnswers, bestWhen: e.target.value })} /></Field>
          <Field label="People can rely on me to… (optional)"><TextInput value={aboutMeAnswers.relyOnMe} onChange={(e) => setAboutMeAnswers({ ...aboutMeAnswers, relyOnMe: e.target.value })} /></Field>
        </div>
        <Field label="A result I am proud of is… (optional)"><TextInput value={aboutMeAnswers.proudResult} onChange={(e) => setAboutMeAnswers({ ...aboutMeAnswers, proudResult: e.target.value })} /></Field>
        {form.aboutMeArchetype && <button type="button" className="secondary-button" onClick={() => patch({ presentation: composeAboutMe(ARCHETYPES.find((a) => a.id === form.aboutMeArchetype)!, aboutMeAnswers) })}>Apply answers to About Me text</button>}
        <Field label="About Me" required hint="Recruiters read this first. Personalize the template above or write your own — either way, edit freely.">
          <textarea className="wz-input wz-textarea" rows={8} value={form.presentation} onChange={(e) => patch({ presentation: e.target.value })} placeholder="Choose an identity above to start from a template, or write your own." />
        </Field>
      </div>}

      {step === 4 && <div className="wz-body">
        <Field label="Mindset" hint="Pick a few traits that describe you."><Chips options={MINDSET_SUGGESTIONS} value={form.mindset} onToggle={(option) => patch({ mindset: form.mindset.includes(option) ? form.mindset.filter((item) => item !== option) : form.mindset.length < 5 ? [...form.mindset, option] : form.mindset })} /></Field>
        <div className="wz-row">
          <Field label="I thrive with"><TagInput value={form.workingPrefer} onChange={(workingPrefer) => patch({ workingPrefer })} placeholder="e.g. Clear objectives — press Enter" /></Field>
          <Field label="I avoid"><TagInput value={form.workingAvoid} onChange={(workingAvoid) => patch({ workingAvoid })} placeholder="e.g. Constant meetings — press Enter" /></Field>
        </div>
        <Field label="Interests" hint="Optional conversation starters."><TagInput value={form.interests} onChange={(interests) => patch({ interests })} suggestions={INTEREST_SUGGESTIONS} /></Field>
        <Field label="Favorite song (optional)" hint="Spotify or YouTube link — opens externally, never autoplays."><TextInput value={form.favoriteSong} onChange={(e) => patch({ favoriteSong: e.target.value })} placeholder="https://…" /></Field>
      </div>}

      {step === 5 && <div className="wz-body">
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
        <Field label="Who can see your profile" hint="Defaults to all recruiters — change anytime.">
          <Segmented options={['all', 'after-swipe', 'paused'] as const} value={form.visibility} onChange={(visibility) => patch({ visibility })} labels={{ all: 'All recruiters', 'after-swipe': 'Only after I swipe', paused: 'Paused' }} />
        </Field>
        <Field label="Blocked companies" hint="They will never see your profile."><TagInput value={form.blockedCompanies} onChange={(blockedCompanies) => patch({ blockedCompanies })} placeholder="Company name — press Enter" /></Field>
        <Field label="Open to work" required><Toggle checked={form.openToWork} onChange={(openToWork) => patch({ openToWork })} label={form.openToWork ? 'Actively looking' : 'Not looking right now'} /></Field>
      </div>}

      {(attempted && errors.length > 0) && <ul className="wz-errors">{errors.map((message) => <li key={message}>{message}</li>)}</ul>}
      {error && <p className="auth-error">{error}</p>}

      <footer className="wz-foot">
        {step > 0 ? <button className="secondary-button" onClick={() => { setStep(step - 1); setAttempted(false); }}><ArrowLeft size={16} /> Back</button> : onCancel ? <button className="secondary-button" onClick={onCancel}>Cancel</button> : <span />}
        <div className="wz-foot-actions">
          {step === CANDIDATE_REQUIRED_STEPS && <button className="secondary-button" onClick={skipRest} disabled={saving}>Skip &amp; finish</button>}
          <button className="primary-button" onClick={next} disabled={saving || uploading}>
            {saving ? <Loader2 size={16} className="spin" /> : finishing ? <><Check size={16} /> Finish profile</> : <>Continue <ArrowRight size={16} /></>}
          </button>
        </div>
      </footer>
    </div>
  </div>;
}
