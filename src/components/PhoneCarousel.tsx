import { useCallback, useEffect, useRef, useState } from 'react';
import { CAROUSEL_SLIDES, type CarouselSlide } from './carouselData';

/* Phone-mockup carousel: 30 screens cycling "It's a Match" → candidate profile →
   company job description. Swipe on touch, arrows + counter under the phone. */

function Avatar({ initials, hue, size = 74 }: { initials: string; hue: number; size?: number }) {
  return (
    <span
      className="pc-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${(hue + 40) % 360} 85% 48%))`,
      }}
    >
      {initials}
    </span>
  );
}

function MatchScreen({ slide }: { slide: Extract<CarouselSlide, { kind: 'match' }> }) {
  const { candidate, hr } = slide.story;
  return (
    <div className="pc-screen pc-screen-match">
      <div className="pc-script">It&rsquo;s a Match!</div>
      <p className="pc-sub">You and {candidate.name.split(' ')[0]} have mutually matched.</p>
      <div className="pc-pair">
        <div className="pc-person"><Avatar initials={candidate.initials} hue={candidate.hue} /><strong>{candidate.name}</strong><span>{candidate.title}</span></div>
        <span className="pc-heart">♥</span>
        <div className="pc-person"><Avatar initials={hr.initials} hue={hr.hue} /><strong>{hr.name}</strong><span>{hr.title}</span></div>
      </div>
      <button type="button" className="pc-btn pc-btn-grad">✈ SEND A MESSAGE</button>
      <button type="button" className="pc-btn pc-btn-ghost">KEEP SWIPING</button>
    </div>
  );
}

function CandidateScreen({ slide }: { slide: Extract<CarouselSlide, { kind: 'candidate' }> }) {
  const { candidate } = slide.story;
  return (
    <div className="pc-screen pc-screen-profile">
      <span className="pc-kicker">CANDIDATE PROFILE</span>
      <Avatar initials={candidate.initials} hue={candidate.hue} size={86} />
      <strong className="pc-name">{candidate.name}</strong>
      <span className="pc-role">{candidate.title}</span>
      <span className="pc-meta">📍 {candidate.city} · within {candidate.km} km · {candidate.salary}</span>
      <div className="pc-chips">{candidate.skills.map((s) => <i key={s}>{s}</i>)}</div>
      <div className="pc-fit"><b>{candidate.fit}%</b> role fit · explainable</div>
      <div className="pc-actions"><button type="button" aria-label="Pass">×</button><button type="button" className="pc-like" aria-label="Interested">♥</button></div>
    </div>
  );
}

function JobScreen({ slide }: { slide: Extract<CarouselSlide, { kind: 'job' }> }) {
  const { company } = slide.story;
  return (
    <div className="pc-screen pc-screen-job">
      <span className="pc-kicker">OPEN ROLE</span>
      <span className="pc-logo" style={{ background: `hsl(${company.hue} 75% 52%)` }}>{company.logo}</span>
      <span className="pc-company">{company.name.toUpperCase()} · {company.city.toUpperCase()}</span>
      <strong className="pc-name">{company.role}</strong>
      <span className="pc-meta">{company.salary} · {company.mode}</span>
      <p className="pc-blurb">{company.blurb}</p>
      <div className="pc-chips">{company.skills.map((s) => <i key={s}>{s}</i>)}</div>
      <div className="pc-actions"><button type="button" aria-label="Pass">×</button><button type="button" className="pc-like" aria-label="Interested">♥</button></div>
    </div>
  );
}

export function PhoneCarousel() {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const total = CAROUSEL_SLIDES.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + total) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const slide = CAROUSEL_SLIDES[index];
  const label = slide.kind === 'match' ? "It's a Match" : slide.kind === 'candidate' ? 'Candidate profile' : 'Company job description';

  return (
    <div className="phone-carousel">
      <div
        className="pc-phone"
        role="group"
        aria-roledescription="carousel"
        aria-label={`Product preview ${index + 1} of ${total}: ${label}`}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 42) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div className="pc-notch" />
        <div className="pc-brand"><span className="pc-brand-mark">♥</span><b>Jobs</b><b className="pc-mid">Match</b><b className="pc-now">Now</b></div>
        <div className="pc-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {CAROUSEL_SLIDES.map((s, i) => (
            <div className="pc-slide" key={i} aria-hidden={i !== index}>
              {s.kind === 'match' ? <MatchScreen slide={s} /> : s.kind === 'candidate' ? <CandidateScreen slide={s} /> : <JobScreen slide={s} />}
            </div>
          ))}
        </div>
      </div>
      <div className="pc-nav" aria-label="Browse product screens">
        <button type="button" onClick={() => go(-1)} aria-label="Previous screen">‹</button>
        <span className="pc-count"><b>{index + 1}</b> / {total} · {label}</span>
        <button type="button" onClick={() => go(1)} aria-label="Next screen">›</button>
      </div>
    </div>
  );
}
