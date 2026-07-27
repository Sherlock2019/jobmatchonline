import { ArrowRight, BarChart3, Check, CreditCard, Heart, MapPin, Sparkles, Users } from 'lucide-react';
import { PhoneMockup } from '../PhoneMockup';
import HERO_BANNER_TOP from '../../assets/hero-banner-top-talking-heads.png';
import HERO_BANNER_BOTTOM from '../../assets/hero-banner-bottom.png';

function Brand() { return <div className="brand"><span className="brand-heart-mark" aria-hidden="true" /><span className="brand-wordmark"><b>Jobs</b><b>Match</b><b>Now</b></span></div>; }

type HeroProps = { onRegister: () => void; onLogin: () => void };

/** Default hero banner — the original landing page. */
export function HeroDefault({ onRegister, onLogin }: HeroProps) {
  return <section className="hero">
    <div className="hero-copy">
      <div className="eyebrow"><Sparkles size={14} /> Find jobs you’ll love — and the people who’ll love the role and your company.</div>
      <h1>Stop chasing jobs and candidates.<br /><span>Let the perfect match chase you.</span></h1>
      <p>Job seekers, let the perfect role find you. Hiring teams, let the right candidates come to you. A connection opens only when both sides choose. Your next dream job — or dream candidate — might be just a few clicks away.</p>
      <div className="location-pitch-app"><MapPin size={18} /><span><small>Geolocation of Opportunities</small><strong>Match nearby. Meet for a cup of coffee in your city.</strong></span></div>
      <div className="hero-actions"><button className="primary-button" onClick={onRegister}>Register free <ArrowRight size={18} /></button><button className="secondary-button" onClick={onLogin}>Log in</button><button className="secondary-button demo-test-button" onClick={onLogin}><Sparkles size={18} /> Test demo matching</button></div>
      <div className="proof-row"><span><Check size={14} /> Explainable fit</span><span><Check size={14} /> Private distance range</span><span><Check size={14} /> Salary up front</span></div>
    </div>
    <div className="hero-visual carousel-side" aria-label="JobsMatchNow product preview">
      <div className="floating-love love-one"><Heart size={16} fill="currentColor" /></div><div className="floating-love love-two"><Sparkles size={14} /></div>
      <PhoneMockup />
    </div>
  </section>;
}

/** Custom-image hero banner — split into a top half (icon/tagline/phone) and
 * bottom half (the 6 feature screenshots) so the proof-row can sit as real,
 * accessible HTML between them instead of being baked into a flat image. */
export function HeroImage({ onRegister, onLogin }: HeroProps) {
  return <section className="hero hero-image">
    <img className="hero-image-art hero-image-art-top" src={HERO_BANNER_TOP} alt="JobsMatchNow" />
    <img className="hero-image-art hero-image-art-bottom" src={HERO_BANNER_BOTTOM} alt="" />
    <div className="hero-actions"><button className="primary-button" onClick={onRegister}>Register free <ArrowRight size={18} /></button><button className="secondary-button" onClick={onLogin}>Log in</button><button className="secondary-button demo-test-button" onClick={onLogin}><Sparkles size={18} /> Test demo matching</button></div>
  </section>;
}

/** Alternate hero banner — pink feature-card layout, admin-selectable via
 * the "Landing page banner" control in the Action Queue tab. */
export function HeroAlt({ onRegister, onLogin }: HeroProps) {
  const features = [
    { icon: Users, title: 'Mutual Matching', text: 'Connect when both sides are interested.' },
    { icon: BarChart3, title: 'Explainable Fit', text: 'See why a job or candidate is a great match.' },
    { icon: CreditCard, title: 'Salary Up Front', text: 'Transparent information, no surprises.' },
  ];
  return <section className="hero hero-alt">
    <div className="hero-copy">
      <Brand />
      <div className="eyebrow hero-alt-eyebrow"><Sparkles size={14} /> Find jobs you’ll love — and the people who’ll love the role and your company.</div>
      <div className="hero-alt-features">{features.map((f) => <div className="hero-alt-feature" key={f.title}><f.icon size={20} /><div><strong>{f.title}</strong><span>{f.text}</span></div></div>)}</div>
      <div className="hero-actions"><button className="primary-button" onClick={onRegister}>Register free <ArrowRight size={18} /></button><button className="secondary-button" onClick={onLogin}>Log in</button><button className="secondary-button demo-test-button" onClick={onLogin}><Sparkles size={18} /> Test demo matching</button></div>
      <div className="proof-row"><span><Check size={14} /> Explainable fit</span><span><Check size={14} /> Private distance range</span><span><Check size={14} /> Salary up front</span></div>
    </div>
    <div className="hero-visual carousel-side" aria-label="JobsMatchNow product preview">
      <div className="floating-love love-one"><Heart size={16} fill="currentColor" /></div><div className="floating-love love-two"><Sparkles size={14} /></div>
      <PhoneMockup />
    </div>
  </section>;
}
