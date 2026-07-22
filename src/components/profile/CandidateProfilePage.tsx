import { BadgeCheck, Briefcase, FileText, Globe, GraduationCap, Languages, Link2, MapPin, Pencil, ShieldCheck, Wallet } from 'lucide-react';
import type { Person } from '../../types';

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (step: number) => void; children: React.ReactNode }) {
  return <section className="pf-section">
    <header><h2>{title}</h2><button className="ghost-button pf-edit" onClick={() => onEdit(step)}><Pencil size={13} /> Edit</button></header>
    {children}
  </section>;
}

const VISIBILITY_LABELS = { all: 'Visible to all recruiters', 'after-swipe': 'Visible only after I swipe', paused: 'Visibility paused' } as const;

export function CandidateProfilePage({ viewer, onEdit }: { viewer: Person; onEdit: (step: number) => void }) {
  const p = viewer;
  const salary = p.preferences?.salary;
  return <div className="page profile-page">
    <div className="profile-hero">
      <img src={p.photo} alt="" />
      <div>
        <span className="overline">Your candidate profile</span>
        <h1>{p.name}{((p.completeness ?? 0) >= 80 || p.provider === 'google' || p.provider === 'linkedin') && <BadgeCheck size={22} className="verified-mark" />}</h1>
        <p>{p.headline || p.title}{p.city ? ` · ${p.city}${p.country ? `, ${p.country}` : ''}` : ''}</p>
        <div className="skill-list">{(p.skillsDetail?.map((skill) => skill.name) || p.skills || []).slice(0, 6).map((skill) => <span key={skill}>{skill}</span>)}</div>
      </div>
      <div className="pf-completeness">
        <div className="ring" style={{ '--progress': `${p.completeness ?? 0}%` } as React.CSSProperties}><strong>{p.completeness ?? 0}%</strong></div>
        <small>Profile complete</small>
      </div>
    </div>

    <div className="pf-grid">
      <Section title="Identity" step={0} onEdit={onEdit}>
        <dl className="pf-dl">
          <div><dt>Headline</dt><dd>{p.headline || '—'}</dd></div>
          <div><dt>Email</dt><dd>{p.email || '—'}</dd></div>
          <div><dt>Phone</dt><dd>{p.phone ? `${p.phone} · hidden until match` : 'Not added'}</dd></div>
          <div><dt><MapPin size={13} /> Location</dt><dd>{p.city ? `${p.city}, ${p.country || ''}` : '—'}</dd></div>
          <div><dt>Distance range</dt><dd>{p.distanceRangeKm ?? 25} km{p.geo ? ' · location set' : ''}</dd></div>
          <div><dt><Languages size={13} /> Languages</dt><dd>{p.languageDetail?.length ? p.languageDetail.map((language) => `${language.name} (${language.level})`).join(' · ') : (p.languages || []).join(' · ') || '—'}</dd></div>
        </dl>
      </Section>

      <Section title="Professional" step={1} onEdit={onEdit}>
        <dl className="pf-dl">
          <div><dt><Briefcase size={13} /> Title</dt><dd>{p.title}</dd></div>
          <div><dt>Experience</dt><dd>{p.yearsExperience !== undefined ? `${p.yearsExperience} years` : '—'} · {p.seniority || p.experienceLevel}</dd></div>
        </dl>
        <span className="card-label">Skills</span>
        <div className="skill-list pf-skills">{(p.skillsDetail || (p.skills || []).map((name) => ({ name, level: undefined as number | undefined }))).map((skill) => <span key={skill.name}>{skill.name}{skill.level ? <i className="pf-skill-level">{'●'.repeat(skill.level)}{'○'.repeat(5 - skill.level)}</i> : null}</span>)}</div>
        {p.industries && p.industries.length > 0 && <><span className="card-label">Industries</span><div className="skill-list">{p.industries.map((industry) => <span key={industry}>{industry}</span>)}</div></>}
        {p.workExperience && p.workExperience.length > 0 && <><span className="card-label">Experience</span>
          <ul className="pf-timeline">{p.workExperience.map((entry, index) => <li key={index}><strong>{entry.title}</strong> · {entry.company}<small>{entry.from} – {entry.to || 'Present'}</small>{entry.description && <p>{entry.description}</p>}</li>)}</ul></>}
        {p.education && p.education.length > 0 && <><span className="card-label"><GraduationCap size={12} /> Education</span>
          <ul className="pf-timeline">{p.education.map((entry, index) => <li key={index}><strong>{entry.degree}</strong> · {entry.school}<small>{entry.from} – {entry.to}</small></li>)}</ul></>}
        {p.certifications && p.certifications.length > 0 && <><span className="card-label"><BadgeCheck size={12} /> Certifications</span><div className="skill-list">{p.certifications.map((certification) => <span key={certification}>{certification}</span>)}</div></>}
        {p.links && Object.keys(p.links).length > 0 && <><span className="card-label"><Link2 size={12} /> Links</span>
          <div className="pf-links">{Object.entries(p.links).map(([key, url]) => url && <a key={key} href={/^https?:/.test(url) ? url : `https://${url}`} target="_blank" rel="noreferrer"><Globe size={12} /> {key}</a>)}</div></>}
      </Section>

      <Section title="Preferences" step={2} onEdit={onEdit}>
        <dl className="pf-dl">
          <div><dt>Desired roles</dt><dd>{p.preferences?.desiredRoles?.join(' · ') || '—'}</dd></div>
          <div><dt>Employment</dt><dd>{p.preferences?.employmentTypes?.join(' · ') || '—'}</dd></div>
          <div><dt>Work mode</dt><dd>{p.preferences?.workMode ? (p.preferences.workMode.mode === 'hybrid' ? `Hybrid · ${p.preferences.workMode.hybridDays ?? 2} office days/week` : p.preferences.workMode.mode === 'onsite' ? 'On-site' : 'Remote') : '—'}</dd></div>
          <div><dt><Wallet size={13} /> Salary</dt><dd>{salary && salary.min !== undefined ? `${salary.min?.toLocaleString()} – ${salary.max?.toLocaleString()} ${salary.currency}` : '—'}</dd></div>
          <div><dt>Availability</dt><dd>{p.preferences?.availability || p.availability || '—'}</dd></div>
          <div><dt>Relocation</dt><dd>{p.preferences?.relocate?.open ? `Open · ${p.preferences.relocate.locations?.join(', ') || 'anywhere'}` : 'Not open'}</dd></div>
          {p.preferences?.companySize && <div><dt>Company size</dt><dd>{p.preferences.companySize}</dd></div>}
        </dl>
        {p.preferences?.workStyle && p.preferences.workStyle.length > 0 && <div className="skill-list">{p.preferences.workStyle.map((style) => <span key={style}>{style}</span>)}</div>}
      </Section>

      <Section title="Documents & privacy" step={3} onEdit={onEdit}>
        <dl className="pf-dl">
          <div><dt><FileText size={13} /> Resume</dt><dd>{p.documents?.resume ? <a href={p.documents.resume.url}>{p.documents.resume.originalName}</a> : 'Not uploaded'}</dd></div>
          <div><dt>Cover letter</dt><dd>{p.documents?.coverLetter ? 'Added' : 'Not added'}</dd></div>
          <div><dt><ShieldCheck size={13} /> Visibility</dt><dd>{p.privacy?.visibility ? VISIBILITY_LABELS[p.privacy.visibility] : '—'}</dd></div>
          <div><dt>Blocked companies</dt><dd>{p.privacy?.blockedCompanies?.length ? p.privacy.blockedCompanies.join(', ') : 'None'}</dd></div>
          <div><dt>Open to work</dt><dd>{p.privacy?.openToWork === false ? 'Not looking' : 'Actively looking'}</dd></div>
        </dl>
      </Section>
    </div>
  </div>;
}
