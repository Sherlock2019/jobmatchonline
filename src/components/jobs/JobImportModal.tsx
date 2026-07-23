import { useState } from 'react';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, FileUp, Linkedin, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { api } from '../../api';
import type { JobImportResult, Person } from '../../types';

type Mode = 'choose' | 'feed' | 'linkedin' | 'success';
type LinkedInDraft = { url: string; title: string; description: string };
const emptyLinkedIn = (): LinkedInDraft => ({ url: '', title: '', description: '' });

export function JobImportModal({ viewer, onClose, onImported, onManual }: {
  viewer: Person;
  onClose: () => void;
  onImported: () => void;
  onManual: () => void;
}) {
  const [mode, setMode] = useState<Mode>('choose');
  const [sourceSystem, setSourceSystem] = useState('greenhouse');
  const [file, setFile] = useState<File | null>(null);
  const [linkedInJobs, setLinkedInJobs] = useState<LinkedInDraft[]>([emptyLinkedIn()]);
  const [result, setResult] = useState<JobImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = (value: JobImportResult) => {
    setResult(value);
    setMode('success');
  };
  const importFile = async () => {
    if (!file) { setError('Choose a CSV, XML, or JSON job feed.'); return; }
    if (!/\.(csv|xml|json)$/i.test(file.name)) { setError('Choose a CSV, XML, or JSON file.'); return; }
    if (file.size > 3 * 1024 * 1024) { setError('Choose a file smaller than 3 MB.'); return; }
    setBusy(true); setError('');
    try { finish(await api.importJobFile(viewer.id, sourceSystem, file)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Import failed'); }
    finally { setBusy(false); }
  };
  const importLinkedIn = async () => {
    setBusy(true); setError('');
    try {
      finish(await api.importLinkedInJobs(viewer.id, linkedInJobs.map((item) => ({
        url: item.url,
        title: item.title || undefined,
        description: item.description,
      }))));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Import failed'); }
    finally { setBusy(false); }
  };
  const updateLinkedIn = (index: number, changes: Partial<LinkedInDraft>) => setLinkedInJobs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));

  return <div className="job-import-overlay" role="dialog" aria-modal="true" aria-labelledby="job-import-title">
    <button className="job-import-scrim" aria-label="Close job importer" onClick={onClose} />
    <section className="job-import-modal">
      <header>
        <div>
          {mode !== 'choose' && mode !== 'success' && <button className="job-import-back" onClick={() => { setMode('choose'); setError(''); }}><ArrowLeft size={16} /> Back</button>}
          <span className="overline">Recruiting</span>
          <h1 id="job-import-title">Add New Job Offers</h1>
          <p>{mode === 'choose' ? 'Choose the easiest way to add your roles.' : mode === 'feed' ? 'Import an official export from your ATS or job feed.' : mode === 'linkedin' ? 'Add the links and paste the descriptions. We never scrape LinkedIn.' : 'Your offers are ready to review.'}</p>
        </div>
        <button className="job-import-close" aria-label="Close" onClick={onClose}><X size={20} /></button>
      </header>

      {mode === 'choose' && <div className="job-import-choices">
        <button onClick={() => setMode('feed')}><span className="blue"><FileUp /></span><strong>ATS or job feed</strong><small>Upload CSV, XML, or JSON</small><ArrowRight /></button>
        <button onClick={() => setMode('linkedin')}><span className="linkedin"><Linkedin /></span><strong>LinkedIn jobs</strong><small>Paste links and descriptions</small><ArrowRight /></button>
        <button onClick={onManual}><span className="pink"><BriefcaseBusiness /></span><strong>Create manually</strong><small>Build one offer from scratch</small><ArrowRight /></button>
      </div>}

      {mode === 'feed' && <div className="job-import-form">
        <label><span>Where are the jobs from?</span>
          <select value={sourceSystem} onChange={(event) => setSourceSystem(event.target.value)}>
            <option value="greenhouse">Greenhouse</option><option value="lever">Lever</option><option value="ashby">Ashby</option>
            <option value="workable">Workable</option><option value="smartrecruiters">SmartRecruiters</option>
            <option value="teamtailor">Teamtailor</option><option value="ats_export">Another ATS</option>
          </select>
        </label>
        <label className="job-feed-drop">
          <input type="file" accept=".csv,.xml,.json,text/csv,application/xml,application/json" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <FileUp size={28} /><strong>{file?.name || 'Choose your job feed'}</strong><small>CSV, XML, or JSON · up to 3 MB</small>
        </label>
        <button className="primary-button" onClick={() => void importFile()} disabled={busy}>{busy ? <Loader2 className="spin" /> : <Sparkles />} Import job offers</button>
      </div>}

      {mode === 'linkedin' && <div className="job-import-form">
        <div className="linkedin-import-note"><Linkedin size={17} /><span><strong>No scraping.</strong> Paste each job description so we can create its five cards.</span></div>
        <div className="linkedin-job-list">{linkedInJobs.map((item, index) => <article key={index}>
          <header><strong>Job {index + 1}</strong>{linkedInJobs.length > 1 && <button aria-label={`Remove job ${index + 1}`} onClick={() => setLinkedInJobs((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button>}</header>
          <input value={item.url} onChange={(event) => updateLinkedIn(index, { url: event.target.value })} placeholder="https://www.linkedin.com/jobs/view/..." aria-label={`LinkedIn URL ${index + 1}`} />
          <input value={item.title} onChange={(event) => updateLinkedIn(index, { title: event.target.value })} placeholder="Job title (optional)" aria-label={`Job title ${index + 1}`} />
          <textarea rows={5} value={item.description} onChange={(event) => updateLinkedIn(index, { description: event.target.value })} placeholder="Paste the complete job description" aria-label={`Job description ${index + 1}`} />
        </article>)}</div>
        <div className="job-import-actions">
          <button className="secondary-button" onClick={() => setLinkedInJobs((current) => [...current, emptyLinkedIn()])} disabled={linkedInJobs.length >= 20}><Plus size={15} /> Add another job</button>
          <button className="primary-button" onClick={() => void importLinkedIn()} disabled={busy}>{busy ? <Loader2 className="spin" /> : <Sparkles />} Create five-card drafts</button>
        </div>
      </div>}

      {mode === 'success' && result && <div className="job-import-success">
        <span><Check size={30} /></span>
        <h2>{result.jobs.length} job {result.jobs.length === 1 ? 'offer' : 'offers'} ready</h2>
        <p>We created reviewable drafts. Complete any missing salary, work mode, culture, or hiring details before publishing.</p>
        {result.skipped > 0 && <small>{result.skipped} existing {result.skipped === 1 ? 'job was' : 'jobs were'} skipped to prevent duplicates.</small>}
        <button className="primary-button" onClick={onImported}>Review job offers <ArrowRight size={16} /></button>
      </div>}
      {error && <p className="job-import-error">{error}</p>}
    </section>
  </div>;
}
