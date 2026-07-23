import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Brain, Briefcase, CalendarClock, CheckCircle2, Code2, Coffee, Download, FileText, Globe, Heart, Home, Languages, Link2, Lock, MapPin, MessageCircle, Music2, Pencil, Phone, Plane, PlusCircle, Quote, Send, ShieldCheck, Sparkles, Star, Target, User, Wallet, XCircle } from 'lucide-react';
import type { ContactChannel, MatchEvidence, Person } from '../../types';

/** Age from an ISO birthdate, or undefined. */
function ageFrom(birthdate?: string): number | undefined {
  if (!birthdate) return undefined;
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
  return age >= 14 && age <= 100 ? age : undefined;
}

const CONTACT_META: Record<ContactChannel['type'], { label: string; icon: typeof Phone }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle }, telegram: { label: 'Telegram', icon: Send },
  phone: { label: 'Phone', icon: Phone }, signal: { label: 'Signal', icon: MessageCircle },
  wechat: { label: 'WeChat', icon: MessageCircle }, zalo: { label: 'Zalo', icon: MessageCircle },
  email: { label: 'Email', icon: Send }, other: { label: 'Contact', icon: MessageCircle },
};

/** Spotify/YouTube link kept as an external link (no autoplay), per privacy guidance. */
function songLabel(url?: string): string | null {
  if (!url) return null;
  try { const u = new URL(url); if (u.hostname.includes('spotify')) return 'Open in Spotify'; if (u.hostname.includes('youtu')) return 'Open on YouTube'; return 'Open link'; }
  catch { return null; }
}

function Card({ label, icon: Icon, step, onEdit, children, tone }: { label: string; icon: typeof Star; step?: number; onEdit?: (step: number) => void; children: React.ReactNode; tone?: string }) {
  return <div className={tone ? `tcard tcard-${tone}` : 'tcard'}>
    <header className="tcard-head"><span className="tcard-label"><Icon size={15} /> {label}</span>
      {onEdit && step !== undefined && <button className="tcard-edit" onClick={() => onEdit(step)} aria-label={`Edit ${label}`}><Pencil size={13} /></button>}
    </header>
    <div className="tcard-scroll">{children}</div>
  </div>;
}

const NAV = [{ icon: User, label: 'Profile' }, { icon: Code2, label: 'Technical' }, { icon: Target, label: 'Preferences' }, { icon: Brain, label: 'Human Stack' }, { icon: Star, label: 'Reviews' }];

/**
 * The candidate as a horizontal deck of five Tinder-style cards with a 5-icon
 * navigator. Used for the candidate's own profile (onEdit set, unlocked) and for
 * a recruiter viewing a candidate (match set → skill split + %, unlocked only
 * after a mutual match, so name and contacts stay masked until then).
 */
export function CandidateCards({ person: p, match, onEdit, unlocked = false, visibilityInspector = false, initialCard = 0, onActiveChange }: { person: Person; match?: MatchEvidence; onEdit?: (step: number) => void; unlocked?: boolean; visibilityInspector?: boolean; initialCard?: number; onActiveChange?: (card: number) => void }) {
  const m = match || p.match;
  const deckRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(initialCard);

  const goTo = (i: number) => {
    const deck = deckRef.current; if (!deck) return;
    deck.scrollTo({ left: i * deck.clientWidth, behavior: 'smooth' });
  };
  useEffect(() => {
    const deck = deckRef.current; if (!deck) return;
    deck.scrollLeft = initialCard * deck.clientWidth;
    const onScroll = () => {
      const next = Math.max(0, Math.min(4, Math.round(deck.scrollLeft / deck.clientWidth)));
      setActive(next);
      onActiveChange?.(next);
    };
    deck.addEventListener('scroll', onScroll, { passive: true });
    return () => deck.removeEventListener('scroll', onScroll);
  }, [initialCard, onActiveChange]);

  const onDeckKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(Math.max(0, active - 1)); }
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(Math.min(4, active + 1)); }
    if (event.key === 'Home') { event.preventDefault(); goTo(0); }
    if (event.key === 'End') { event.preventDefault(); goTo(4); }
  };

  const showAge = p.birthdate && (p.agePrivacy === 'public' || p.discloseAge || (p.agePrivacy === 'after-match' && unlocked));
  const age = showAge ? ageFrom(p.birthdate) : undefined;
  const verified = p.verified || (p.completeness ?? 0) >= 80 || p.provider === 'google' || p.provider === 'linkedin';
  const parts = (p.name || '').trim().split(/\s+/);
  const displayName = unlocked || parts.length < 2 ? p.name : `${parts[0]} ${parts[parts.length - 1][0]}.`;
  const languages = p.languageDetail?.length ? p.languageDetail : (p.languages || []).map((name) => ({ name, level: '' }));
  const availability = p.preferences?.availability || p.availability;
  const salary = p.preferences?.salary;
  const wm = p.preferences?.workMode;
  const skill = (name: string) => p.skillsDetail?.find((s) => s.name === name);
  const requiredCount = m ? m.matchedSkills.length + (m.missingSkills?.length ?? 0) : 0;

  // Card 5 aggregate rating across recommendations that carry category ratings.
  const rated = (p.recommendations || []).map((r) => r.ratings ? Object.values(r.ratings) : []).filter((v) => v.length);
  const avgRating = rated.length ? rated.flat().reduce((a, b) => a + b, 0) / rated.flat().length : undefined;
  const song = songLabel(p.favoriteSong);

  return <div className="tcards">
    {visibilityInspector && <div className="tcards-inspector" role="status"><span>Public</span><span>After mutual match</span><span>Private</span></div>}
    <div className="tcards-deck" ref={deckRef} tabIndex={0} onKeyDown={onDeckKeyDown} aria-label={`Candidate profile card ${active + 1} of 5`}>
      {/* ---------- Card 1 — Snapshot ---------- */}
      <div className="tcard-slide">
        <div className="tcard tcard-hero" style={p.photo ? { backgroundImage: `url(${p.photo})` } : undefined}>
          {onEdit && <button className="tcard-edit on-photo" onClick={() => onEdit(0)} aria-label="Edit identity"><Pencil size={14} /></button>}
          {m && <span className="tcard-matchpct"><Sparkles size={13} /> {m.score}% match{requiredCount ? <b>{m.matchedSkills.length} of {requiredCount} skills</b> : null}</span>}
          <div className="tcard-hero-overlay">
            <h2>{displayName}{age !== undefined && <span className="tcard-age">{age}</span>}{verified && <BadgeCheck size={20} className="verified-mark" />}</h2>
            {p.pronouns && <span className="tcard-pronouns">{p.pronouns}</span>}
            <p className="tcard-hero-title"><Briefcase size={14} /> {p.title || p.headline}</p>
            <div className="tcard-hero-meta">
              {(p.city || p.country) && <span><MapPin size={13} /> {[p.city, p.country].filter(Boolean).join(', ')}</span>}
              {p.nationality && <span><Globe size={13} /> {p.nationality}</span>}
              {availability && <span className="avail"><i /> {availability === 'Now' ? 'Available now' : `Available ${availability}`}</span>}
            </div>
            {(p.workAuthorization || p.visaSponsorship !== undefined) && <div className="tcard-hero-meta">
              {p.workAuthorization && <span><ShieldCheck size={13} /> {p.workAuthorization}</span>}
              {p.visaSponsorship !== undefined && <span>{p.visaSponsorship ? 'Needs visa sponsorship' : 'No sponsorship needed'}</span>}
            </div>}
            {languages.length > 0 && <div className="tcard-langs"><Languages size={13} />{languages.map((l) => <span key={l.name}>{l.name}{l.level ? <i>{l.level}</i> : null}</span>)}</div>}
            <div className="tcard-contacts">
              {unlocked
                ? (p.contactChannels?.length || p.email)
                  ? <>{p.email && <a href={`mailto:${p.email}`} className="tcard-contact"><Send size={13} /> {p.email}</a>}
                    {(p.contactChannels || []).map((c, i) => { const Meta = CONTACT_META[c.type] || CONTACT_META.other; return <span key={i} className="tcard-contact"><Meta.icon size={13} /> {Meta.label}: {c.value}</span>; })}</>
                  : <span className="tcard-contact muted"><Phone size={13} /> No contact details added</span>
                : <span className="tcard-contact locked"><Lock size={13} /> Contact details available after mutual match {visibilityInspector && <b className="visibility-tag">After mutual match</b>}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Card 2 — Technical stack & documents ---------- */}
      <div className="tcard-slide"><Card label="Technical stack" icon={Code2} step={1} onEdit={onEdit}>
        {m && <div className="tcard-counts"><span className="ok">{m.matchedSkills.length} matching</span><span className="miss">{m.missingSkills?.length ?? 0} missing</span><span className="extra">{m.extraSkills?.length ?? 0} extra</span></div>}
        {m ? <div className="tcard-skillsplit">
          <div className="tskill-group ok"><span className="tskill-h"><CheckCircle2 size={13} /> Matching</span><ul className="tskill-rows">{m.matchedSkills.length ? m.matchedSkills.map((s) => { const d = skill(s); return <li key={s}><b>{s}</b>{d?.years ? <em>{d.years}y</em> : null}{d?.level ? <i>{'●'.repeat(d.level)}{'○'.repeat(5 - d.level)}</i> : null}</li>; }) : <li><em>None yet</em></li>}</ul></div>
          {(m.missingSkills?.length ?? 0) > 0 && <div className="tskill-group miss"><span className="tskill-h"><XCircle size={13} /> Development gaps</span><div className="skill-list">{m.missingSkills!.map((s) => <span key={s} className="miss">{s}</span>)}</div></div>}
          {(m.extraSkills?.length ?? 0) > 0 && <div className="tskill-group extra"><span className="tskill-h"><PlusCircle size={13} /> Additional value</span><div className="skill-list">{m.extraSkills!.map((s) => <span key={s}>{s}</span>)}</div></div>}
        </div> : <div className="skill-list pf-skills">{(p.skillsDetail || (p.skills || []).map((name) => ({ name, level: 0, years: undefined }))).map((s) => <span key={s.name}>{s.name}{s.years ? <em className="pf-skill-years">{s.years}y</em> : null}{s.level ? <i className="pf-skill-level">{'●'.repeat(s.level)}{'○'.repeat(5 - s.level)}</i> : null}</span>)}</div>}
        {(p.documents?.resume || (p.links && Object.keys(p.links).length > 0)) && <div className="tcard-docs">
          {p.documents?.resume && <><a className="tdoc-btn" href={p.documents.resume.previewUrl || p.documents.resume.url} target="_blank" rel="noreferrer"><FileText size={14} /> Read resume</a>
            <a className="tdoc-btn ghost" href={p.documents.resume.url} download><Download size={14} /> PDF</a></>}
          {p.links && Object.entries(p.links).map(([key, url]) => url && <a key={key} className="tdoc-btn ghost" href={/^https?:/.test(url) ? url : `https://${url}`} target="_blank" rel="noreferrer"><Link2 size={13} /> {key}</a>)}
        </div>}
        {p.documents?.coverLetter && <p className="tcard-cover"><Quote size={13} /> {p.documents.coverLetter}</p>}
      </Card></div>

      {/* ---------- Card 3 — Career & preferences ---------- */}
      <div className="tcard-slide"><Card label="Preferences" icon={Target} step={2} onEdit={onEdit}>
        {p.preferences?.desiredRoles?.length ? <><span className="tcard-sub">Target roles</span><div className="skill-list soft">{p.preferences.desiredRoles.map((r) => <span key={r}>{r}</span>)}</div></> : null}
        <dl className="tcard-dl">
          {p.preferences?.employmentTypes?.length ? <div><dt><Briefcase size={12} /> Employment</dt><dd>{p.preferences.employmentTypes.join(' · ')}</dd></div> : null}
          {wm ? <div><dt><Home size={12} /> Work mode</dt><dd>{wm.mode === 'hybrid' ? `Hybrid · max ${wm.hybridDays ?? 2} office days/wk` : wm.mode === 'onsite' ? 'On-site' : 'Remote'}</dd></div> : null}
          {salary && salary.min !== undefined ? <div><dt><Wallet size={12} /> Salary</dt><dd>{salary.min?.toLocaleString()}–{salary.max?.toLocaleString()} {salary.currency}/{salary.period || 'year'}{salary.negotiable ? ' · negotiable' : ''}</dd></div> : null}
          {availability ? <div><dt><CalendarClock size={12} /> Available</dt><dd>{availability}{p.preferences?.noticePeriod ? ` · ${p.preferences.noticePeriod} notice` : ''}</dd></div> : null}
          {p.distanceRangeKm !== undefined ? <div><dt><MapPin size={12} /> Max commute</dt><dd>{p.distanceRangeKm} km</dd></div> : null}
          {p.preferences?.relocate?.open ? <div><dt><Plane size={12} /> Relocation</dt><dd>Open · {p.preferences.relocate.locations?.join(', ') || 'anywhere'}</dd></div> : null}
          {p.preferences?.travel ? <div><dt>Travel</dt><dd>{p.preferences.travel}</dd></div> : null}
          {p.preferences?.companySize ? <div><dt>Company size</dt><dd>{p.preferences.companySize}</dd></div> : null}
        </dl>
        {(p.preferences?.industries?.length || p.industries?.length) ? <><span className="tcard-sub">Industries</span><div className="skill-list soft">{(p.preferences?.industries || p.industries || []).map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {p.preferences?.workStyle?.length ? <><span className="tcard-sub">Work style</span><div className="skill-list soft">{p.preferences.workStyle.map((s) => <span key={s}>{s}</span>)}</div></> : null}
      </Card></div>

      {/* ---------- Card 4 — Human stack ---------- */}
      <div className="tcard-slide"><Card label="Human stack" icon={Brain} step={3} onEdit={onEdit} tone="human">
        {p.presentation ? <p className="tcard-presentation">{p.presentation}</p> : onEdit ? <p className="tcard-empty">Add a short personal introduction — who you are beyond the CV.</p> : null}
        {p.motto ? <p className="tcard-motto"><Quote size={13} /> {p.motto}</p> : null}
        {p.mindset?.length ? <><span className="tcard-sub">Mindset</span><div className="skill-list soft">{p.mindset.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {p.humanSkills?.length ? <><span className="tcard-sub">Human capabilities</span><div className="skill-list soft">{p.humanSkills.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {(p.workingPrefer?.length || p.workingAvoid?.length) ? <div className="tcard-workprefs">
          {p.workingPrefer?.length ? <div><span className="tcard-sub ok">I thrive with</span><ul>{p.workingPrefer.map((s) => <li key={s}><CheckCircle2 size={12} /> {s}</li>)}</ul></div> : null}
          {p.workingAvoid?.length ? <div><span className="tcard-sub miss">I avoid</span><ul>{p.workingAvoid.map((s) => <li key={s}><XCircle size={12} /> {s}</li>)}</ul></div> : null}
        </div> : null}
        {p.interests?.length ? <><span className="tcard-sub">Interests</span><div className="skill-list soft">{p.interests.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {song ? <a className="tdoc-btn ghost tcard-song" href={p.favoriteSong} target="_blank" rel="noreferrer"><Music2 size={13} /> Soundtrack — {song}</a> : null}
      </Card></div>

      {/* ---------- Card 5 — Reviews ---------- */}
      <div className="tcard-slide"><Card label="Recommendations" icon={Star} step={5} onEdit={onEdit}>
        {avgRating !== undefined && <div className="tcard-rating"><strong>{avgRating.toFixed(1)}</strong><div className="tcard-stars">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} className={n <= Math.round(avgRating) ? 'on' : ''} />)}</div><small>{p.recommendations!.length} recommendation{p.recommendations!.length > 1 ? 's' : ''}</small></div>}
        {p.recommendations?.length ? <ul className="tcard-recs">{p.recommendations.map((r, i) => <li key={i}>
          <div className="trec-head">{r.photo && <img src={r.photo} alt="" />}<div><strong>{r.recruiterName}{r.verified && <BadgeCheck size={13} className="verified-mark" />}</strong>{(r.role || r.company) && <small>{[r.role, r.company].filter(Boolean).join(' · ')}</small>}{r.relationship && <em className="trec-rel">{r.relationship}</em>}</div></div>
          <p>“{r.text}”</p>
          {r.candidateResponse && <p className="trec-response"><Quote size={11} /> {r.candidateResponse}</p>}
          <div className="trec-foot">{r.wouldWorkAgain && <span className="trec-again"><Heart size={11} /> Would work with again</span>}{r.date && <time>{r.date}</time>}</div>
        </li>)}</ul> : <p className="tcard-empty"><Coffee size={14} /> {onEdit ? 'Invite former recruiters or managers to recommend you (optional).' : 'No public recommendations yet.'}</p>}
      </Card></div>
    </div>

    {/* ---------- Navigator ---------- */}
    <nav className="tcards-nav" aria-label="Profile cards">
      {NAV.map((item, i) => { const Icon = item.icon; return <button key={item.label} className={i === active ? 'on' : ''} onClick={() => goTo(i)} aria-label={item.label} aria-current={i === active ? 'page' : undefined}><Icon size={16} /><span>{item.label}</span><i /></button>; })}
    </nav>
  </div>;
}
