import { useEffect, useRef, useState } from 'react';
import { Award, BadgeCheck, BriefcaseBusiness, CalendarClock, CheckCircle2, Clock3, Coffee, Home, Layers, Lock, MapPin, Music2, Pencil, Plane, PlusCircle, Quote, ShieldCheck, Sparkles, Star, Target, Users, Wallet, XCircle } from 'lucide-react';
import type { Job } from '../../types';
import { JobHeaderBadge } from './JobHeaderBadge';

function Card({ label, icon: Icon, step, onEdit, children, tone }: { label: string; icon: typeof Star; step?: number; onEdit?: (step: number) => void; children: React.ReactNode; tone?: string }) {
  return <div className={tone ? `tcard tcard-${tone}` : 'tcard'}>
    <header className="tcard-head"><span className="tcard-label"><Icon size={15} /> {label}</span>
      {onEdit && step !== undefined && <button className="tcard-edit" onClick={() => onEdit(step)} aria-label={`Edit ${label}`}><Pencil size={13} /></button>}
    </header>
    <div className="tcard-scroll">{children}</div>
  </div>;
}

/** Spotify/YouTube link kept as an external link (no autoplay), mirrors the candidate card. */
function songLabel(url?: string): string | null {
  if (!url) return null;
  try { const u = new URL(url); if (u.hostname.includes('spotify')) return 'Open in Spotify'; if (u.hostname.includes('youtu')) return 'Open on YouTube'; return 'Open link'; }
  catch { return null; }
}

const NAV = [{ icon: BriefcaseBusiness, label: 'Snapshot' }, { icon: Target, label: 'Requirements' }, { icon: Wallet, label: 'Compensation' }, { icon: Users, label: 'Team & culture' }, { icon: Star, label: 'Reviews' }];

/**
 * The job as a horizontal deck of five Tinder-style cards with a 5-icon
 * navigator — the job-side mirror of CandidateCards. Used for the employer's
 * own job posting (onEdit set) and for a candidate viewing a job in detail
 * (match set → skill split + %; salary stays masked pre-match when salaryHidden).
 */
export function JobCards({ job: j, onEdit, unlocked = false }: { job: Job; onEdit?: (step: number) => void; unlocked?: boolean }) {
  const m = j.match;
  const deckRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = (i: number) => {
    const deck = deckRef.current; if (!deck) return;
    const target = deck.children[i] as HTMLElement | undefined;
    if (target) deck.scrollTo({ left: target.offsetLeft, behavior: 'auto' });
  };
  useEffect(() => {
    const deck = deckRef.current; if (!deck) return;
    const onScroll = () => setActive(Math.round(deck.scrollLeft / deck.clientWidth));
    deck.addEventListener('scroll', onScroll, { passive: true });
    return () => deck.removeEventListener('scroll', onScroll);
  }, []);

  const requiredCount = m ? m.matchedSkills.length + (m.missingSkills?.length ?? 0) : 0;
  const workMode = j.workMode === 'Remote' ? (j.remoteScope === 'country' ? `Remote (within ${j.country || 'country'})` : 'Remote (worldwide)')
    : j.workMode === 'Hybrid' && j.hiringRadiusKm ? `Hybrid (within ${j.hiringRadiusKm} km)` : j.workMode;
  const showSalary = !j.salaryHidden || unlocked;

  // Card 5 aggregate rating across company reviews.
  const avgRating = j.companyRating ?? (j.companyReviews?.length
    ? j.companyReviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / j.companyReviews.filter((r) => r.rating !== undefined).length
    : undefined);
  const song = songLabel(j.teamSong);

  return <div className="tcards">
    <div className="tcards-deck" ref={deckRef}>
      {/* ---------- Card 1 — Snapshot ---------- */}
      <div className="tcard-slide">
        <div className="tcard tcard-job-snapshot">
          {onEdit && <button className="tcard-edit on-photo" onClick={() => onEdit(0)} aria-label="Edit snapshot"><Pencil size={14} /></button>}
          <JobHeaderBadge job={{ ...j, salaryHidden: !showSalary }} />
          <div className="tcard-job-summary">
            {m && <span className="tcard-matchpct"><Sparkles size={13} /> {m.score}% match{requiredCount ? <b>{m.matchedSkills.length} of {requiredCount} skills</b> : null}</span>}
            <div className="tcard-snapshot-facts">
              {j.experienceLevel && <span>{j.experienceLevel} experience</span>}
              {j.openings !== undefined && <span>{j.openings} opening{j.openings === 1 ? '' : 's'}</span>}
              {j.deadline && <span><CalendarClock size={13} /> Apply by {j.deadline}</span>}
              <span>{j.applicants} applicant{j.applicants === 1 ? '' : 's'}</span>
              {j.responseTime && <span>{j.responseTime} response</span>}
            </div>
            {j.description && <p>{j.description}</p>}
          </div>
        </div>
      </div>

      {/* ---------- Card 2 — Requirements ---------- */}
      <div className="tcard-slide"><Card label="Requirements" icon={Target} step={1} onEdit={onEdit}>
        {m && <div className="tcard-counts"><span className="ok">{m.matchedSkills.length} matching</span><span className="miss">{m.missingSkills?.length ?? 0} missing</span><span className="extra">{m.extraSkills?.length ?? 0} extra</span></div>}
        {m ? <div className="tcard-skillsplit">
          <div className="tskill-group ok"><span className="tskill-h"><CheckCircle2 size={13} /> Matching</span><ul className="tskill-rows">{m.matchedSkills.length ? m.matchedSkills.map((s) => <li key={s}><b>{s}</b></li>) : <li><em>None yet</em></li>}</ul></div>
          {(m.missingSkills?.length ?? 0) > 0 && <div className="tskill-group miss"><span className="tskill-h"><XCircle size={13} /> Gaps to close</span><div className="skill-list">{m.missingSkills!.map((s) => <span key={s} className="miss">{s}</span>)}</div></div>}
          {(m.extraSkills?.length ?? 0) > 0 && <div className="tskill-group extra"><span className="tskill-h"><PlusCircle size={13} /> Bonus skills you bring</span><div className="skill-list">{m.extraSkills!.map((s) => <span key={s}>{s}</span>)}</div></div>}
        </div> : <div className="skill-list pf-skills">{(j.requiredSkillsDetail?.map((s) => s.name) ?? j.requiredSkills ?? []).map((s) => <span key={s}>{s}</span>)}</div>}
        {j.niceToHaves?.length ? <><span className="tcard-sub">Nice to have</span><div className="skill-list soft">{j.niceToHaves.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {j.requiredLanguages?.length ? <><span className="tcard-sub">Languages</span><div className="skill-list soft">{j.requiredLanguages.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {j.successMeasures?.length ? <><span className="tcard-sub">What success looks like</span><ul className="coach-list">{j.successMeasures.map((s) => <li key={s}>{s}</li>)}</ul></> : null}
      </Card></div>

      {/* ---------- Card 3 — Compensation & logistics ---------- */}
      <div className="tcard-slide"><Card label="Compensation" icon={Wallet} step={2} onEdit={onEdit}>
        <dl className="tcard-dl">
          {showSalary && j.salary ? <div><dt><Wallet size={12} /> Salary</dt><dd>{j.salary}{j.salaryNegotiable ? ' · negotiable' : ''}</dd></div> : null}
          {j.bonus ? <div><dt>Bonus</dt><dd>{j.bonus}</dd></div> : null}
          {j.equity ? <div><dt>Equity</dt><dd>{j.equity}</dd></div> : null}
          {j.workingHours ? <div><dt><Clock3 size={12} /> Hours</dt><dd>{j.workingHours}</dd></div> : null}
          {j.flexibleHours ? <div><dt>Flexibility</dt><dd>{j.flexibleHours}</dd></div> : null}
          {j.hybridDays !== undefined ? <div><dt><Home size={12} /> Office days</dt><dd>max {j.hybridDays}/wk</dd></div> : null}
          {j.probation ? <div><dt>Probation</dt><dd>{j.probation}</dd></div> : null}
          {j.travel ? <div><dt><Plane size={12} /> Travel</dt><dd>{j.travel}</dd></div> : null}
          {j.onCall ? <div><dt>On-call</dt><dd>{j.onCall}</dd></div> : null}
          {j.startDate ? <div><dt><CalendarClock size={12} /> Start date</dt><dd>{j.startDate}</dd></div> : null}
          {j.visaSponsorship !== undefined ? <div><dt><ShieldCheck size={12} /> Visa</dt><dd>{j.visaSponsorship ? 'Sponsorship available' : 'No sponsorship'}</dd></div> : null}
          {j.relocationSupport !== undefined ? <div><dt>Relocation</dt><dd>{j.relocationSupport ? 'Support available' : 'Not offered'}</dd></div> : null}
        </dl>
        {j.benefits?.length ? <><span className="tcard-sub">Benefits</span><div className="skill-list soft">{j.benefits.map((s) => <span key={s}>{s}</span>)}</div></> : null}
      </Card></div>

      {/* ---------- Card 4 — Team & culture ---------- */}
      <div className="tcard-slide"><Card label="Team & culture" icon={Users} step={3} onEdit={onEdit} tone="human">
        {j.recruiter?.name && <div className="tcard-recruiter">
          {j.recruiter.photo ? <img src={j.recruiter.photo} alt="" /> : <span className="tcard-recruiter-fallback">{(j.recruiter.name || j.company).charAt(0)}</span>}
          <div><strong>{j.recruiter.name}</strong><span>{j.recruiter.title || 'Hiring team'}{j.recruiter.company || j.company ? ` · ${j.recruiter.company || j.company}` : ''}</span></div>
          <em>Your recruiter</em>
        </div>}
        {j.mission ? <p className="tcard-presentation">{j.mission}</p> : onEdit ? <p className="tcard-empty">Add a mission statement — why this role matters.</p> : null}
        <dl className="tcard-dl">
          {j.teamSize ? <div><dt><Users size={12} /> Team size</dt><dd>{j.teamSize}</dd></div> : null}
          {j.teamLocations ? <div><dt><MapPin size={12} /> Team locations</dt><dd>{j.teamLocations}</dd></div> : null}
          {j.managerName ? <div><dt>Reports to</dt><dd>{j.managerName}{j.managerTitle ? ` · ${j.managerTitle}` : ''}</dd></div> : null}
        </dl>
        {j.managerStyle ? <p className="tcard-motto"><Quote size={13} /> {j.managerStyle}</p> : null}
        {j.teamComposition?.length ? <><span className="tcard-sub">Team composition</span><div className="skill-list soft">{j.teamComposition.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {j.managementStyleTags?.length ? <><span className="tcard-sub">Management style</span><div className="skill-list soft">{j.managementStyleTags.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {j.teamStyle?.length ? <><span className="tcard-sub">Team style</span><div className="skill-list soft">{j.teamStyle.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {j.values?.length ? <><span className="tcard-sub">Values</span><div className="skill-list soft">{j.values.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {j.culture?.length ? <><span className="tcard-sub">Culture</span><div className="skill-list soft">{j.culture.map((s) => <span key={s}>{s}</span>)}</div></> : null}
        {song ? <a className="tdoc-btn ghost tcard-song" href={j.teamSong} target="_blank" rel="noreferrer"><Music2 size={13} /> Team soundtrack — {song}</a> : null}
      </Card></div>

      {/* ---------- Card 5 — Reviews & process ---------- */}
      <div className="tcard-slide"><Card label="Reviews & process" icon={Star} step={4} onEdit={onEdit}>
        {avgRating !== undefined && <div className="tcard-rating"><strong>{avgRating.toFixed(1)}</strong><div className="tcard-stars">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} className={n <= Math.round(avgRating) ? 'on' : ''} />)}</div>{j.reviewCount !== undefined && <small>{j.reviewCount} review{j.reviewCount === 1 ? '' : 's'}</small>}</div>}
        {j.companyReviews?.length ? <ul className="tcard-recs">{j.companyReviews.map((r, i) => <li key={i}>
          <div className="trec-head"><div><strong>{r.author || 'Anonymous'}{r.verified && <BadgeCheck size={13} className="verified-mark" />}</strong>{r.role && <small>{r.role}</small>}</div></div>
          <p>“{r.text}”</p>
          <div className="trec-foot">{r.date && <time>{r.date}</time>}</div>
        </li>)}</ul> : <p className="tcard-empty"><Coffee size={14} /> {onEdit ? 'Invite past hires to leave a review (optional).' : 'No public reviews yet.'}</p>}
        {(j.hiringTimeline || j.interviewProcess?.length) ? <><span className="tcard-sub">Hiring process</span>
          {j.hiringTimeline && <p className="tcard-motto"><Clock3 size={13} /> {j.hiringTimeline}</p>}
          {j.interviewProcess?.length ? <div className="coach-steps">{j.interviewProcess.map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div> : null}
        </> : null}
        {(j.backgroundCheck !== undefined || j.referenceCheck !== undefined) && <div className="tcard-hero-meta" style={{ marginTop: 14 }}>
          {j.backgroundCheck && <span><Award size={13} /> Background check required</span>}
          {j.referenceCheck && <span><Award size={13} /> References required</span>}
        </div>}
      </Card></div>
    </div>

    {/* ---------- Navigator ---------- */}
    <nav className="tcards-nav" aria-label="Job cards">
      {NAV.map((item, i) => { const Icon = item.icon; return <button key={item.label} className={i === active ? 'on' : ''} onClick={() => goTo(i)} aria-label={item.label} aria-current={i === active}><Icon size={16} /><i /></button>; })}
    </nav>
  </div>;
}
