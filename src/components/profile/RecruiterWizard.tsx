import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Camera, Check, Loader2, MapPin, Upload, UserSearch } from 'lucide-react';
import { api } from '../../api';
import { CameraCaptureModal } from '../CameraCaptureModal';
import { Field, Segmented, TagInput, TextInput } from './fields';
import type { EmployerKind, Person } from '../../types';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;
export const RECRUITER_STEPS = ['Organization', 'Contact & finish'] as const;
// Same teal used for the Company Profile home section, then brand pink for the finish step.
const STEP_COLORS = ['#00C7BE', '#FF2D55'];

type Form = {
  kind: EmployerKind;
  company: string; companyLogo: string; website: string; industry: string; companySize?: string;
  headquarters: string; officeLocations: string[]; foundedYear: string; about: string;
  benefits: string[]; techStack: string[]; linkedinUrl: string;
  name: string; photo: string; title: string; specializations: string[]; regions: string[]; clients: string[];
  contactName: string; contactEmail: string; phone: string; calendarLink: string;
  geo?: { lat: number; lng: number };
};

function fromPerson(p: Person): Form {
  return {
    kind: p.kind || 'company',
    company: p.company || '', companyLogo: p.companyLogo || '', website: p.website || '', industry: p.industry || '',
    companySize: p.companySize, headquarters: p.headquarters || '', officeLocations: p.officeLocations || [],
    foundedYear: p.foundedYear ? String(p.foundedYear) : '', about: p.about || '',
    benefits: p.benefits || [], techStack: p.techStack || [], linkedinUrl: p.linkedinUrl || '',
    name: p.name || '', photo: p.photo || '', title: p.title === 'Recruiter' ? '' : p.title || '',
    specializations: p.specializations || [], regions: p.regions || [], clients: p.clients || [],
    contactName: p.contactName || p.name || '', contactEmail: p.contactEmail || p.email || '', phone: p.phone || '', calendarLink: p.calendarLink || '',
    geo: p.geo,
  };
}

function stepErrors(step: number, form: Form): string[] {
  const errors: string[] = [];
  if (step === 0) {
    if (form.kind === 'company') {
      if (!form.company.trim()) errors.push('Company name is required');
      if (!form.website.trim()) errors.push('Website is required');
      if (!form.industry.trim()) errors.push('Industry is required');
      if (!form.companySize) errors.push('Pick a company size');
      if (!form.headquarters.trim()) errors.push('Headquarters is required');
      if (!form.officeLocations.length) errors.push('Add at least one office location');
      if (!form.about.trim()) errors.push('About / culture pitch is required');
    } else {
      if (!form.company.trim()) errors.push('Agency name is required (use your own name if independent)');
      if (!form.name.trim() || !form.title.trim()) errors.push('Recruiter name and title are required');
      if (!form.specializations.length) errors.push('Add at least one specialization');
      if (!form.regions.length) errors.push('Add at least one region covered');
    }
  }
  if (step === 1) {
    if (!form.contactName.trim()) errors.push('Contact person is required');
    if (!/.+@.+\..+/.test(form.contactEmail)) errors.push('A valid contact email is required');
  }
  return errors;
}

function stepPayload(step: number, form: Form, finishing: boolean): Partial<Person> & { onboarding?: boolean } {
  if (step === 0) {
    const base = { kind: form.kind, company: form.company, linkedinUrl: form.linkedinUrl || undefined, geo: form.geo };
    if (form.kind === 'company') return {
      ...base, companyLogo: form.companyLogo || undefined, website: form.website, industry: form.industry,
      companySize: form.companySize, headquarters: form.headquarters, officeLocations: form.officeLocations,
      foundedYear: form.foundedYear ? Number(form.foundedYear) : undefined, about: form.about,
      benefits: form.benefits, techStack: form.techStack,
    };
    return { ...base, name: form.name, photo: form.photo || undefined, title: form.title, specializations: form.specializations, regions: form.regions, clients: form.clients };
  }
  return {
    contactName: form.contactName, contactEmail: form.contactEmail, phone: form.phone || undefined,
    calendarLink: form.calendarLink || undefined, ...(finishing ? { onboarding: false } : {}),
  };
}

export function RecruiterWizard({ viewer, initialStep = 0, onDone, onCancel }: { viewer: Person; initialStep?: number; onDone: (user: Person) => void; onCancel?: () => void }) {
  const [step, setStep] = useState(Math.min(initialStep, RECRUITER_STEPS.length - 1));
  const [form, setForm] = useState<Form>(() => fromPerson(viewer));
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'companyLogo' | 'photo' | null>(null);
  const [showCameraFor, setShowCameraFor] = useState<'companyLogo' | 'photo' | null>(null);
  const patch = (changes: Partial<Form>) => setForm((current) => ({ ...current, ...changes }));
  const uploadImage = async (file: File | Blob, target: 'companyLogo' | 'photo') => {
    if (file.size > 5 * 1024 * 1024) { setError('Image must be 5MB or smaller'); return; }
    setUploadingImage(target); setError('');
    try { const { photo } = await api.uploadPhoto(viewer.id, file); patch({ [target]: photo } as Partial<Form>); }
    catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploadingImage(null); }
  };
  const errors = useMemo(() => stepErrors(step, form), [step, form]);
  const finishing = step === RECRUITER_STEPS.length - 1;
  const captureLocation = async () => {
    setGeoBusy(true); setError('');
    try { const { getBrowserLocation } = await import('../../lib/geo'); patch({ geo: await getBrowserLocation() }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not get your location'); }
    finally { setGeoBusy(false); }
  };

  const next = async () => {
    setAttempted(true);
    if (errors.length) return;
    setSaving(true); setError('');
    try {
      const { user } = await api.updateProfile(viewer.id, stepPayload(step, form, finishing));
      if (finishing) onDone(user);
      else { setStep(step + 1); setAttempted(false); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return <div className="wizard-page">
    <div className="wizard-card" style={{ ['--step-accent' as string]: STEP_COLORS[step] }}>
      <header className="wz-head">
        <div><span className="overline">Set up your recruiter profile</span><h1>{RECRUITER_STEPS[step]}</h1></div>
        <span className="wz-step-count">Step {step + 1} of {RECRUITER_STEPS.length}</span>
      </header>
      <div className="wz-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={RECRUITER_STEPS.length}><i style={{ width: `${((step + 1) / RECRUITER_STEPS.length) * 100}%` }} /></div>

      {step === 0 && <div className="wz-body">
        <Field label="Account type" required>
          <div className="role-choice">
            <button type="button" className={form.kind === 'company' ? 'role-option active' : 'role-option'} aria-pressed={form.kind === 'company'} onClick={() => patch({ kind: 'company' })}><Building2 size={17} /><strong>Company</strong><small>In-house HR / hiring team</small></button>
            <button type="button" className={form.kind === 'headhunter' ? 'role-option active' : 'role-option'} aria-pressed={form.kind === 'headhunter'} onClick={() => patch({ kind: 'headhunter' })}><UserSearch size={17} /><strong>Headhunter / agency</strong><small>Recruiting on behalf of clients</small></button>
          </div>
        </Field>
        <Field label="Office location for distance matching" hint="New job postings inherit this so candidates see real distances. Exact coordinates stay private.">
          <button type="button" className={form.geo ? 'wz-geo-btn set' : 'wz-geo-btn'} onClick={captureLocation} disabled={geoBusy}>
            {geoBusy ? <><Loader2 size={15} className="spin" /> Locating…</> : form.geo ? <><MapPin size={15} /> Location set ✓ — tap to update</> : <><MapPin size={15} /> Use my current location</>}
          </button>
        </Field>

        {form.kind === 'company' ? <>
          <div className="wz-row">
            <Field label="Company name" required><TextInput value={form.company} onChange={(e) => patch({ company: e.target.value })} /></Field>
            <Field label="Company logo">
              <div className="wz-photo-row">
                {form.companyLogo && <img src={form.companyLogo} alt="" />}
                <div className="wz-photo-actions">
                  <div className="wz-photo-btn-row">
                    <button type="button" className="ios-photo-tile camera" onClick={() => setShowCameraFor('companyLogo')} disabled={uploadingImage === 'companyLogo'}>
                      <span className="ios-photo-tile-icon">{uploadingImage === 'companyLogo' ? <Loader2 size={18} className="spin" /> : <Camera size={18} />}</span>
                      Take Photo
                    </button>
                    <label className="ios-photo-tile upload">
                      <span className="ios-photo-tile-icon"><Upload size={18} /></span>
                      Upload Photo
                      <input type="file" accept="image/*" hidden onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], 'companyLogo')} />
                    </label>
                  </div>
                  <TextInput value={form.companyLogo} onChange={(e) => patch({ companyLogo: e.target.value })} placeholder="or paste a logo URL" />
                </div>
              </div>
            </Field>
          </div>
          <div className="wz-row">
            <Field label="Website" required><TextInput value={form.website} onChange={(e) => patch({ website: e.target.value })} placeholder="company.com" /></Field>
            <Field label="Industry" required><TextInput value={form.industry} onChange={(e) => patch({ industry: e.target.value })} placeholder="e.g. SaaS, Fintech" /></Field>
          </div>
          <Field label="Company size" required><Segmented options={COMPANY_SIZES} value={form.companySize as typeof COMPANY_SIZES[number] | undefined} onChange={(companySize) => patch({ companySize })} /></Field>
          <div className="wz-row">
            <Field label="Headquarters" required><TextInput value={form.headquarters} onChange={(e) => patch({ headquarters: e.target.value })} placeholder="City, country" /></Field>
            <Field label="Founded year"><TextInput type="number" min={1800} max={2100} value={form.foundedYear} onChange={(e) => patch({ foundedYear: e.target.value })} /></Field>
          </div>
          <Field label="Office locations" required><TagInput value={form.officeLocations} onChange={(officeLocations) => patch({ officeLocations })} placeholder="City — press Enter" /></Field>
          <Field label="About / culture pitch" required><textarea className="wz-input wz-textarea" rows={4} value={form.about} onChange={(e) => patch({ about: e.target.value })} placeholder="What you build, how the team works, why people stay." /></Field>
          <Field label="Benefits"><TagInput value={form.benefits} onChange={(benefits) => patch({ benefits })} suggestions={['Health insurance', 'Remote budget', 'Learning budget', 'Equity', 'Flexible hours', '13th month']} /></Field>
          <Field label="Tech stack"><TagInput value={form.techStack} onChange={(techStack) => patch({ techStack })} suggestions={['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Figma']} /></Field>
          <Field label="LinkedIn company URL"><TextInput value={form.linkedinUrl} onChange={(e) => patch({ linkedinUrl: e.target.value })} placeholder="linkedin.com/company/…" /></Field>
        </> : <>
          <Field label="Agency name" required hint="Use your own name if you work independently."><TextInput value={form.company} onChange={(e) => patch({ company: e.target.value })} /></Field>
          <div className="wz-row">
            <Field label="Recruiter name" required><TextInput value={form.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
            <Field label="Recruiter title" required><TextInput value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Principal Recruiter" /></Field>
          </div>
          <Field label="Profile photo">
            <div className="wz-photo-row">
              {form.photo && <img src={form.photo} alt="" />}
              <div className="wz-photo-actions">
                <div className="wz-photo-btn-row">
                  <button type="button" className="ios-photo-tile camera" onClick={() => setShowCameraFor('photo')} disabled={uploadingImage === 'photo'}>
                    <span className="ios-photo-tile-icon">{uploadingImage === 'photo' ? <Loader2 size={18} className="spin" /> : <Camera size={18} />}</span>
                    Take Photo
                  </button>
                  <label className="ios-photo-tile upload">
                    <span className="ios-photo-tile-icon"><Upload size={18} /></span>
                    Upload Photo
                    <input type="file" accept="image/*" hidden onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0], 'photo')} />
                  </label>
                </div>
                <TextInput value={form.photo} onChange={(e) => patch({ photo: e.target.value })} placeholder="or paste a photo URL" />
              </div>
            </div>
          </Field>
          <Field label="Specializations" required><TagInput value={form.specializations} onChange={(specializations) => patch({ specializations })} suggestions={['Product design', 'Engineering', 'Executive search', 'Data', 'Marketing']} /></Field>
          <Field label="Regions covered" required><TagInput value={form.regions} onChange={(regions) => patch({ regions })} suggestions={['Vietnam', 'APAC', 'Europe', 'Remote worldwide']} /></Field>
          <Field label="Clients represented" hint="Shown as social proof on your profile."><TagInput value={form.clients} onChange={(clients) => patch({ clients })} placeholder="Client or industry — press Enter" /></Field>
          <Field label="LinkedIn URL"><TextInput value={form.linkedinUrl} onChange={(e) => patch({ linkedinUrl: e.target.value })} placeholder="linkedin.com/in/…" /></Field>
        </>}
      </div>}

      {step === 1 && <div className="wz-body">
        <div className="wz-row">
          <Field label="Contact person" required><TextInput value={form.contactName} onChange={(e) => patch({ contactName: e.target.value })} /></Field>
          <Field label="Contact email" required><TextInput type="email" value={form.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} /></Field>
        </div>
        <div className="wz-row">
          <Field label="Phone" hint="Hidden until a match."><TextInput value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+84 …" /></Field>
          <Field label="Calendar link" hint="Optional — lets matched candidates book directly."><TextInput value={form.calendarLink} onChange={(e) => patch({ calendarLink: e.target.value })} placeholder="cal.com/… or calendly.com/…" /></Field>
        </div>
      </div>}

      {(attempted && errors.length > 0) && <ul className="wz-errors">{errors.map((message) => <li key={message}>{message}</li>)}</ul>}
      {error && <p className="auth-error">{error}</p>}

      <footer className="wz-foot">
        {step > 0 ? <button className="secondary-button" onClick={() => { setStep(step - 1); setAttempted(false); }}><ArrowLeft size={16} /> Back</button> : onCancel ? <button className="secondary-button" onClick={onCancel}>Cancel</button> : <span />}
        <button className="primary-button" onClick={next} disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : finishing ? <><Check size={16} /> Finish profile</> : <>Continue <ArrowRight size={16} /></>}
        </button>
      </footer>
    </div>
    {showCameraFor && <CameraCaptureModal onClose={() => setShowCameraFor(null)} onCapture={(blob) => { const target = showCameraFor; setShowCameraFor(null); void uploadImage(blob, target); }} />}
  </div>;
}
