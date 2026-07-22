import { Building2, CalendarClock, Globe, Linkedin, MapPin, Pencil, Phone, UserSearch } from 'lucide-react';
import type { Person } from '../../types';

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (step: number) => void; children: React.ReactNode }) {
  return <section className="pf-section">
    <header><h2>{title}</h2><button className="ghost-button pf-edit" onClick={() => onEdit(step)}><Pencil size={13} /> Edit</button></header>
    {children}
  </section>;
}

export function RecruiterProfilePage({ viewer, onEdit }: { viewer: Person; onEdit: (step: number) => void }) {
  const p = viewer;
  const headhunter = p.kind === 'headhunter';
  return <div className="page profile-page">
    <div className="profile-hero">
      <img src={headhunter ? p.photo : (p.companyLogo || p.photo)} alt="" />
      <div>
        <span className="overline">{headhunter ? 'Headhunter / agency profile' : 'Company profile'}</span>
        <h1>{headhunter ? p.name : (p.company || p.name)}</h1>
        <p>{headhunter ? `${p.title} · ${p.company}` : `${p.industry || ''}${p.headquarters ? ` · HQ ${p.headquarters}` : ''}`}</p>
        <div className="skill-list">{(headhunter ? p.specializations : p.techStack)?.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div>
      </div>
      <div className="pf-completeness">
        <div className="ring" style={{ '--progress': `${p.completeness ?? 0}%` } as React.CSSProperties}><strong>{p.completeness ?? 0}%</strong></div>
        <small>Profile complete</small>
      </div>
    </div>

    <div className="pf-grid">
      <Section title={headhunter ? 'Agency' : 'Company'} step={0} onEdit={onEdit}>
        {headhunter ? <dl className="pf-dl">
          <div><dt><UserSearch size={13} /> Recruiter</dt><dd>{p.name} · {p.title}</dd></div>
          <div><dt>Agency</dt><dd>{p.company || '—'}</dd></div>
          <div><dt>Specializations</dt><dd>{p.specializations?.join(' · ') || '—'}</dd></div>
          <div><dt><MapPin size={13} /> Regions</dt><dd>{p.regions?.join(' · ') || '—'}</dd></div>
          <div><dt>Clients</dt><dd>{p.clients?.length ? p.clients.join(', ') : '—'}</dd></div>
          {p.linkedinUrl && <div><dt><Linkedin size={13} /> LinkedIn</dt><dd><a href={/^https?:/.test(p.linkedinUrl) ? p.linkedinUrl : `https://${p.linkedinUrl}`} target="_blank" rel="noreferrer">{p.linkedinUrl}</a></dd></div>}
        </dl> : <dl className="pf-dl">
          <div><dt><Building2 size={13} /> Company</dt><dd>{p.company || '—'}</dd></div>
          <div><dt><Globe size={13} /> Website</dt><dd>{p.website ? <a href={/^https?:/.test(p.website) ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer">{p.website}</a> : '—'}</dd></div>
          <div><dt>Industry</dt><dd>{p.industry || '—'} {p.companySize ? `· ${p.companySize} people` : ''}</dd></div>
          <div><dt><MapPin size={13} /> HQ</dt><dd>{p.headquarters || '—'}</dd></div>
          <div><dt>Offices</dt><dd>{p.officeLocations?.join(' · ') || '—'}</dd></div>
          {p.foundedYear && <div><dt>Founded</dt><dd>{p.foundedYear}</dd></div>}
          {p.linkedinUrl && <div><dt><Linkedin size={13} /> LinkedIn</dt><dd><a href={/^https?:/.test(p.linkedinUrl) ? p.linkedinUrl : `https://${p.linkedinUrl}`} target="_blank" rel="noreferrer">{p.linkedinUrl}</a></dd></div>}
        </dl>}
        {!headhunter && p.about && <><span className="card-label">About & culture</span><p className="pf-about">{p.about}</p></>}
        {!headhunter && p.benefits && p.benefits.length > 0 && <><span className="card-label">Benefits</span><div className="skill-list">{p.benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}</div></>}
        {!headhunter && p.techStack && p.techStack.length > 0 && <><span className="card-label">Tech stack</span><div className="skill-list">{p.techStack.map((tech) => <span key={tech}>{tech}</span>)}</div></>}
      </Section>

      <Section title="Contact" step={1} onEdit={onEdit}>
        <dl className="pf-dl">
          <div><dt>Contact person</dt><dd>{p.contactName || p.name}</dd></div>
          <div><dt>Email</dt><dd>{p.contactEmail || p.email || '—'}</dd></div>
          <div><dt><MapPin size={13} /> Distance matching</dt><dd>{p.geo ? 'Location set — postings match by real distance' : 'Not set (add it in your profile)'}</dd></div>
          <div><dt><Phone size={13} /> Phone</dt><dd>{p.phone ? `${p.phone} · hidden until match` : 'Not added'}</dd></div>
          <div><dt><CalendarClock size={13} /> Calendar</dt><dd>{p.calendarLink ? <a href={/^https?:/.test(p.calendarLink) ? p.calendarLink : `https://${p.calendarLink}`} target="_blank" rel="noreferrer">{p.calendarLink}</a> : 'Not added'}</dd></div>
        </dl>
      </Section>
    </div>
  </div>;
}
