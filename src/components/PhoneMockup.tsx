import { useCallback, useEffect, useRef, useState } from 'react';

/* Three-screen phone mockup: It's a Match -> candidate swipe card -> job swipe card.
   Slide 1 uses the supplied match artwork; slides 2-3 remain live-rendered but reuse the
   exact same Alex/Sarah photos (cropped from the match artwork) and dark card styling so
   all three screens read as one coherent story.
   Imported (not referenced from /public) so Vite content-hashes the filename —
   this busts the browser's 30-day immutable cache whenever the artwork changes. */
import MATCH_MOCKUP from '../assets/match-mockup.png';
import ALEX_PHOTO from '../assets/alex-martinez.png';
import SARAH_PHOTO from '../assets/sarah-thompson.png';

const CANDIDATE = { name: 'Alex Martinez', title: 'Senior Software Engineer', photo: ALEX_PHOTO, city: 'Singapore', km: 8, skills: ['TypeScript', 'React', 'AWS'], salary: '$120k–$150k', fit: 94, availability: '2 weeks', workMode: 'Hybrid', experience: '8 yrs experience' };
const RECRUITER = { name: 'Sarah Thompson', title: 'Lead AI Engineer', photo: SARAH_PHOTO };
const COMPANY = { name: 'AWS', city: 'Singapore', role: 'Senior Software Engineer', salary: '$120k–$150k', mode: 'Hybrid · Full-time', blurb: 'Own the matching platform end to end with a product-minded team.', skills: ['TypeScript', 'React', 'AWS'], openings: 2, applicants: 47, responseTime: '< 24h response' };

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
      <img className="pc-photo-lg" src={CANDIDATE.photo} alt="" />
      <strong className="pc-name">{CANDIDATE.name}</strong>
      <span className="pc-role">{CANDIDATE.title}</span>
      <span className="pc-meta">📍 {CANDIDATE.city} · within {CANDIDATE.km} km · {CANDIDATE.salary}</span>
      <div className="pc-facts"><span>{CANDIDATE.experience}</span><span>{CANDIDATE.workMode}</span><span>Available in {CANDIDATE.availability}</span></div>
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
      <img className="pc-photo-lg" src={RECRUITER.photo} alt="" />
      <div className="pc-identity-rows">
        <span><b>Role</b>{COMPANY.role}</span>
        <span><b>Company</b>{COMPANY.name}</span>
        <span><b>Recruiter</b>{RECRUITER.name}</span>
      </div>
      <span className="pc-meta">{COMPANY.city} · {COMPANY.salary}</span>
      <div className="pc-facts"><span>{COMPANY.openings} openings</span><span>{COMPANY.applicants} applicants</span><span>{COMPANY.responseTime}</span></div>
      <div className="pc-chips">{COMPANY.skills.map((s) => <i key={s}>{s}</i>)}</div>
      <div className="pc-actions pc-actions-five">
        <button type="button" aria-label="Pass">×</button>
        <button type="button" className="pc-super" aria-label="Super Like">★</button>
        <button type="button" className="pc-ask" aria-label="Ask a quick question">?</button>
        <button type="button" className="pc-save" aria-label="Save for later">▤</button>
        <button type="button" className="pc-like" aria-label="Interested">♥</button>
      </div>
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
