import { useCallback, useEffect, useRef, useState } from 'react';

/* Three-screen phone mockup: It's a Match -> candidate swipe card -> job swipe card.
   Slide 1 uses the supplied match artwork; slides 2-3 remain live-rendered.
   Imported (not referenced from /public) so Vite content-hashes the filename —
   this busts the browser's 30-day immutable cache whenever the artwork changes. */
import MATCH_MOCKUP from '../assets/match-mockup.png';

const CANDIDATE = { name: 'Alex Martinez', title: 'Senior Software Engineer', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', city: 'Singapore', km: 8, skills: ['TypeScript', 'React', 'AWS'], salary: '$120k–$150k', fit: 94 };
const COMPANY = { name: 'Northstar', logo: 'N', accent: '#3d5afe', city: 'Singapore', role: 'Senior Software Engineer', salary: '$120k–$150k', mode: 'Hybrid · Full-time', blurb: 'Own the matching platform end to end with a product-minded team.', skills: ['TypeScript', 'React', 'AWS'] };

const SLIDES = [
  { kind: 'match', label: "It's a Match" },
  { kind: 'candidate', label: 'Candidate profile' },
  { kind: 'job', label: 'Open role' },
] as const;

function MatchScreen() {
  return (
    <img
      className="pc-match-img"
      src={MATCH_MOCKUP}
      alt="It's a Match — Alex Martinez and Sarah Thompson have mutually matched on JobsMatchNow"
    />
  );
}

function CandidateScreen() {
  return (
    <div className="pc-screen pc-screen-profile">
      <span className="pc-kicker">CANDIDATE PROFILE</span>
      <img className="pc-avatar-photo big" src={CANDIDATE.photo} alt="" />
      <strong className="pc-name">{CANDIDATE.name}</strong>
      <span className="pc-role">{CANDIDATE.title}</span>
      <span className="pc-meta">📍 {CANDIDATE.city} · within {CANDIDATE.km} km · {CANDIDATE.salary}</span>
      <div className="pc-chips">{CANDIDATE.skills.map((s) => <i key={s}>{s}</i>)}</div>
      <div className="pc-fit"><b>{CANDIDATE.fit}%</b> role fit · explainable</div>
      <div className="pc-actions"><button type="button" aria-label="Pass">×</button><button type="button" className="pc-like" aria-label="Interested">♥</button></div>
    </div>
  );
}

function JobScreen() {
  return (
    <div className="pc-screen pc-screen-job">
      <span className="pc-kicker">OPEN ROLE</span>
      <span className="pc-logo" style={{ background: COMPANY.accent }}>{COMPANY.logo}</span>
      <span className="pc-company">{COMPANY.name.toUpperCase()} · {COMPANY.city.toUpperCase()}</span>
      <strong className="pc-name">{COMPANY.role}</strong>
      <span className="pc-meta">{COMPANY.salary} · {COMPANY.mode}</span>
      <p className="pc-blurb">{COMPANY.blurb}</p>
      <div className="pc-chips">{COMPANY.skills.map((s) => <i key={s}>{s}</i>)}</div>
      <div className="pc-actions"><button type="button" aria-label="Pass">×</button><button type="button" className="pc-like" aria-label="Interested">♥</button></div>
    </div>
  );
}

export function PhoneMockup() {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const total = SLIDES.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + total) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const slide = SLIDES[index];

  return (
    <div className="phone-carousel">
      <div
        className="pc-phone"
        role="group"
        aria-roledescription="carousel"
        aria-label={`Product preview ${index + 1} of ${total}: ${slide.label}`}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 42) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div className="pc-notch" />
        {index !== 0 && <div className="pc-brand"><span className="pc-brand-mark">♥</span><b>Jobs</b><b className="pc-mid">Match</b><b className="pc-now">Now</b></div>}
        <div className="pc-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {SLIDES.map((s, i) => (
            <div className={`pc-slide${s.kind === 'match' ? ' pc-slide-match' : ''}`} key={s.kind} aria-hidden={i !== index}>
              {s.kind === 'match' ? <MatchScreen /> : s.kind === 'candidate' ? <CandidateScreen /> : <JobScreen />}
            </div>
          ))}
        </div>
      </div>
      <div className="pc-nav" aria-label="Browse product screens">
        <button type="button" onClick={() => go(-1)} aria-label="Previous screen">‹</button>
        <span className="pc-count"><b>{index + 1}</b> / {total} · {slide.label}</span>
        <button type="button" onClick={() => go(1)} aria-label="Next screen">›</button>
      </div>
    </div>
  );
}
