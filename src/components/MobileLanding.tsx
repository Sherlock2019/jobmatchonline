import { useState } from 'react';
import { Check, ChevronDown, MapPin, ShieldCheck, Sparkles, Target, X, Zap } from 'lucide-react';
import { PhoneMockup } from './PhoneMockup';
import { betterSignal, comparisonRows, howItWorksIntro, pitch, stats, trust } from '../content/landingContent';
import { FeedbackSection, JourneyPipeline, LatestShowcase } from './LandingSections';

const featureIcons = { target: Target, zap: Zap, 'map-pin': MapPin, 'shield-check': ShieldCheck } as const;

function Brand() { return <div className="brand"><span className="brand-heart-mark" aria-hidden="true" /><span className="brand-wordmark"><b>Jobs</b><b>Match</b><b>Now</b></span></div>; }

/**
 * Mobile-first landing: used below 768px and inside the desktop
 * "Mobile view" 390px device frame.
 */
export function MobileLanding({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  const [howOpen, setHowOpen] = useState(false);

  return <main className="m-landing">
    <header className="m-nav"><Brand /></header>

    <div className="m-mockup"><PhoneMockup /></div>

    <section className="m-pitch">
      <div className="eyebrow"><Sparkles size={14} /> {pitch.eyebrow}</div>
      <h1>{pitch.headline}<br /><span>{pitch.headlineAccent}</span></h1>
      <p>{pitch.subtext}</p>
      <div className="location-pitch-app"><MapPin size={18} /><span><small>{pitch.geo.kicker}</small><strong>{pitch.geo.text}</strong></span></div>
      <div className="proof-row m-badges">{pitch.badges.map((badge) => <span key={badge}><Check size={14} /> {badge}</span>)}</div>
    </section>

    <div className="m-cta">
      <button className="li-cta solid" onClick={onRegister}>Register now</button>
      <button className="li-cta outline" onClick={onLogin}>Log in</button>
    </div>

    <section className={howOpen ? 'm-how open' : 'm-how'}>
      <button className="m-how-toggle" aria-expanded={howOpen} onClick={() => setHowOpen((value) => !value)}>
        <span>How it works</span><ChevronDown size={19} className="m-how-chevron" />
      </button>
      {howOpen && <div className="m-how-body">
        <div className="m-how-intro">
          <span className="section-kicker">{howItWorksIntro.kicker}</span>
          <h2>{howItWorksIntro.heading}</h2>
          <p>{howItWorksIntro.body}</p>
        </div>

        <div className="m-compare-list">
          {comparisonRows.map((row) => <article className="m-compare-card" key={row.feature}>
            <h3>{row.feature}</h3>
            <p className="m-compare-old"><X size={14} /><span><small>Traditional</small>{row.traditional}</span></p>
            <p className="m-compare-new"><Check size={14} /><span><small>JobsMatchNow</small>{row.jobmatch}</span></p>
            <span className="m-impact-badge">{row.impact}</span>
          </article>)}
        </div>

        <div className="m-signal">
          <span className="section-kicker">{betterSignal.kicker}</span>
          <h2>{betterSignal.heading}</h2>
          <div className="m-signal-grid">
            {betterSignal.features.map((feature) => { const Icon = featureIcons[feature.icon]; return <article key={feature.title}><div className="feature-icon"><Icon size={18} /></div><h3>{feature.title}</h3><p>{feature.text}</p></article>; })}
          </div>
        </div>

        <div className="m-trust">
          <span className="section-kicker light">{trust.kicker}</span>
          <h2>{trust.heading}</h2>
          <p>{trust.body}</p>
          <div className="m-stats">
            {stats.items.map((item) => <div key={item.value}><strong>{item.value}</strong><span>{item.label}</span></div>)}
          </div>
          <small className="m-stats-note">{stats.note}</small>
        </div>
      </div>}
    </section>

    <div className="m-sections"><JourneyPipeline /><LatestShowcase onRegister={onRegister} onLogin={onLogin} /><FeedbackSection /></div>

    <footer className="m-footer"><Brand /><small>© 2026 JobsMatchNow</small></footer>
  </main>;
}
