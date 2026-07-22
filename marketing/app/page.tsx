import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Coffee,
  Globe2,
  Heart,
  Layers3,
  Linkedin,
  LockKeyhole,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { DownloadActions } from "./DownloadActions";
import { PhoneCarousel } from "./PhoneCarousel";

export const metadata: Metadata = {
  title: "JobsMatchNow",
  description:
    "Stop chasing jobs and candidates. Let the perfect role—or candidate—chase you with mutual matching built for both sides.",
};

const comparisons = [
  ["Discovery", "Search, scroll, repeat", "Personalized recommendations"],
  ["Fit", "Keyword filters and guesswork", "Explainable 0–100 fit score"],
  ["Geolocation of Opportunities", "Broad city filters or exact-address risk", "Private city and distance-range matching"],
  ["Applying", "Forms and cover letters", "One profile, one intentional swipe"],
  ["Interest", "One-way applications", "A match only when both sides choose"],
  ["Privacy", "Details copied across portals", "Candidate-controlled visibility"],
  ["Conversation", "Email and calendar ping-pong", "Contextual chat and scheduling"],
  ["Recruiting", "Spreadsheets and hand-offs", "Live discovery and visual pipeline"],
  ["Intelligence", "Application volume", "Quality, response, and funnel insight"],
] as const;

const candidateFeatures = [
  "A clear reason behind every recommendation",
  "Salary, location, and work style up front",
  "Choose a city and private distance range",
  "Contact details hidden until mutual interest",
  "One profile across web, desktop, iOS, and Android",
];

const recruiterFeatures = [
  "Ranked talent for each open role",
  "Discover opted-in nearby talent by distance",
  "Mutual interest before the first message",
  "Visual pipeline from match to hire",
  "LinkedIn-ready job distribution adapter",
];


export default function Home() {
  return (
    <main>
      <header className="site-nav">
        <a className="brand" href="#top" aria-label="JobsMatchNow home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-wordmark"><b>Jobs</b><b>Match</b><b>Now</b></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#product">How it works</a>
          <a href="#people">Job seekers</a>
          <a href="#teams">Employers</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="nav-actions">
          <a className="nav-login" href="https://jobsmatchnow.com/app/"><Globe2 size={15} /> Web app</a>
          <a className="button button-dark button-small" href="https://jobsmatchnow.com/app/">Start matching <ArrowRight size={15} /></a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={14} /> Mutual matching for people and teams</span>
          <h1>Stop chasing jobs and candidates.<br /><em>Let the perfect role—or candidate—chase you.</em></h1>
          <p>Job seekers, let the perfect role find you. Hiring teams, let the right candidates come to you. JobsMatchNow connects both sides only when the interest is mutual.</p>
          <p className="location-pitch"><MapPin size={17} /><span><strong>Match nearby.</strong> Meet for a cup of coffee in your city.</span></p>
          <div className="hero-actions">
            <a className="button button-dark" href="https://jobsmatchnow.com/app/">Start matching <ArrowRight size={18} /></a>
            <a className="button button-linkedin" href="#product"><span className="play-dot">▶</span> See how it works</a>
          </div>
          <div className="hero-proof">
            <span><Check size={14} /> Verified companies</span>
            <span><Check size={14} /> Explainable fit</span>
            <span><Check size={14} /> Salary up front</span>
          </div>
        </div>

        <div className="hero-product carousel-side" aria-label="JobsMatchNow application preview">
          <div className="fun-heart fun-heart-one" aria-hidden="true"><Heart size={17} fill="currentColor" /></div>
          <div className="fun-heart fun-heart-two" aria-hidden="true"><Heart size={12} fill="currentColor" /></div>
          <PhoneCarousel />
        </div>
      </section>

      <section className="platform-strip" aria-label="Available platforms">
        <span>One product. Every screen.</span>
        <div><b>Web</b><b>Windows</b><b>macOS</b><b>iPhone & iPad</b><b>Android</b><b className="location-label">Geolocation of Opportunities</b><b className="linkedin-label">LinkedIn-ready</b></div>
      </section>

      <section className="section product-section" id="product">
        <div className="section-heading centered">
          <span className="eyebrow">The complete hiring loop</span>
          <h2>From “maybe” to meaningful<br />in one connected product.</h2>
          <p>JobsMatchNow combines swipe-simple discovery with the structure serious hiring teams need.</p>
        </div>
        <div className="bento-grid">
          <article className="bento bento-large">
            <div className="bento-icon"><Target /></div>
            <span>EXPLAINABLE MATCHING</span>
            <h3>Understand the fit,<br />not just the score.</h3>
            <p>Skills, experience, languages, location, and work preferences become evidence people can understand and control.</p>
            <div className="score-demo"><strong>91</strong><div><span>Skill alignment</span><i style={{ width: "91%" }} /><span>Experience fit</span><i style={{ width: "86%" }} /><span>Work preferences</span><i style={{ width: "96%" }} /></div></div>
          </article>
          <article className="bento bento-green">
            <div className="bento-icon"><Heart fill="currentColor" /></div>
            <span>MUTUAL INTENT</span>
            <h3>No match without two yeses.</h3>
            <p>Every conversation begins with shared interest—not spam, pressure, or cold outreach.</p>
            <div className="match-people"><div>AM</div><span><Heart size={18} fill="currentColor" /></span><div>N</div></div>
          </article>
          <article className="bento">
            <div className="bento-icon"><MessageCircle /></div>
            <span>CONVERSATIONS</span>
            <h3>Keep momentum in context.</h3>
            <p>Chat, interview details, read status, and candidate context stay together.</p>
            <div className="chat-demo"><p>Your design systems work stood out. Open to a quick intro?</p><p>Absolutely—Thursday works well.</p></div>
          </article>
          <article className="bento bento-wide">
            <div><div className="bento-icon"><Layers3 /></div><span>RECRUITER PIPELINE</span><h3>Move great people forward.</h3><p>A visual, quality-first workspace from mutual match through offer.</p></div>
            <div className="pipeline-demo"><div><span>Matched</span><i><b>JL</b> Jordan Lee</i><i><b>PR</b> Priya Raman</i></div><div><span>Interview</span><i><b>MT</b> Minh Tran</i></div><div><span>Offer</span><i className="offer"><b>SD</b> Sofia Duarte</i></div></div>
          </article>
          <article className="bento">
            <div className="bento-icon"><BarChart3 /></div>
            <span>HIRING INTELLIGENCE</span>
            <h3>Measure quality, not traffic.</h3>
            <p>Track match strength, response, funnel conversion, and time to hire.</p>
            <div className="chart-demo">{[46, 70, 58, 82, 65, 94, 77, 88].map((h, index) => <i style={{ height: `${h}%` }} key={index} />)}</div>
          </article>
          <article className="bento bento-location">
            <div><div className="bento-icon"><MapPin /></div><span>GEOLOCATION OF OPPORTUNITIES</span><h3>Match nearby.<br />Meet for a cup of coffee in your city.</h3><p>Choose a city and distance range without exposing an exact address. After a mutual match, both sides can choose a convenient public place.</p></div>
            <div className="distance-demo"><div className="distance-rings"><i /><i /><i /><span><MapPin size={18} fill="currentColor" /></span></div><div className="distance-copy"><span>YOUR MATCH RADIUS</span><strong>25 km</strong><small>Singapore · private until matched</small><div><i style={{ width: "42%" }} /></div><p><Coffee size={15} /> Coffee meetup suggested after mutual interest</p></div></div>
          </article>
        </div>
      </section>

      <section className="audience-section">
        <div className="audience audience-people" id="people">
          <div className="audience-copy">
            <span className="eyebrow"><UserCheck size={14} /> For candidates</span>
            <h2>Find work that fits your life—not just your résumé.</h2>
            <p>See the opportunity, the expectations, and the reason it fits before you spend your time.</p>
            <ul>{candidateFeatures.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            <a href="https://jobsmatchnow.com/app/">Find my matches <ArrowRight size={16} /></a>
          </div>
          <div className="audience-visual candidate-visual professional-profile"><div className="profile-photo">AM<span>Available now</span></div><div className="profile-info"><span>Alex Morgan</span><small>Senior Product Designer</small><div><i>Figma</i><i>Strategy</i><i>Research</i></div></div></div>
        </div>
        <div className="audience audience-teams" id="teams">
          <div className="audience-visual team-visual"><div className="team-metric"><span>Mutual match rate</span><strong>24.8%</strong><em>↑ 4.1%</em></div><div className="team-metric"><span>Candidate response</span><strong>82%</strong><em>↑ 6.7%</em></div><div className="team-list"><span><i>JL</i>Jordan Lee <b>96%</b></span><span><i>PR</i>Priya Raman <b>92%</b></span><span><i>MT</i>Minh Tran <b>89%</b></span></div></div>
          <div className="audience-copy">
            <span className="eyebrow linkedin"><Users size={14} /> For hiring teams</span>
            <h2>Recruit with signal, speed, and respect.</h2>
            <p>Spend less time sorting and more time speaking with people who already see the possibility.</p>
            <ul>{recruiterFeatures.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            <a href="https://jobsmatchnow.com/app/">Meet matched talent <ArrowRight size={16} /></a>
          </div>
        </div>
      </section>

      <section className="section compare-section" id="compare">
        <div className="section-heading">
          <span className="eyebrow">The hiring upgrade</span>
          <h2>Old hiring creates activity.<br />JobsMatchNow creates alignment.</h2>
        </div>
        <div className="compare-table">
          <div className="compare-head"><span>Experience</span><span>Traditional hiring</span><span>JobsMatchNow</span></div>
          {comparisons.map(([label, oldWay, newWay]) => <div className="compare-row" key={label}><strong>{label}</strong><span className="old"><b>×</b>{oldWay}</span><span className="new"><b>✓</b>{newWay}</span></div>)}
        </div>
      </section>

      <section className="trust-section" id="trust">
        <div><span className="eyebrow light"><LockKeyhole size={14} /> Trust is a product feature</span><h2>Built around consent,<br />clarity, and control.</h2><p>Contact details and exact locations remain private until a match. Recommendations carry understandable reasons. Companies and job information can be verified before candidates commit their time.</p><p className="affiliation-note">JobsMatchNow is an independent product and is not affiliated with or endorsed by Tinder or LinkedIn. Tinder and LinkedIn are trademarks of their respective owners.</p></div>
        <div className="trust-grid"><article><ShieldCheck /><strong>Private by default</strong><span>People decide what teams can see and when.</span></article><article><Target /><strong>Explainable signals</strong><span>Every recommendation has a human-readable reason.</span></article><article><UserCheck /><strong>Verified companies</strong><span>Company and recruiter verification is designed into the experience.</span></article><article><BarChart3 /><strong>Salary clarity</strong><span>Compensation, location, and work style appear before interest.</span></article><article className="linkedin-card"><Linkedin /><strong>LinkedIn-ready</strong><span>Secure sign-in and partner integration architecture.</span></article><article><Globe2 /><strong>Available everywhere</strong><span>Web, desktop installation, iOS, and Android.</span></article></div>
      </section>

      <section className="section pricing-section" id="pricing">
        <div className="section-heading centered"><span className="eyebrow">Simple, transparent access</span><h2>Start matching without<br />paying to be discovered.</h2><p>Candidate access is free. Hiring-team plans will launch with clear pricing and no pay-to-spam model.</p></div>
        <div className="pricing-grid">
          <article><span>FOR JOB SEEKERS</span><h3>Candidate</h3><div className="price"><strong>$0</strong><small>to get started</small></div><ul><li><Check size={15} />Explainable role recommendations</li><li><Check size={15} />Private, reusable profile</li><li><Check size={15} />Mutual matches and messaging</li><li><Check size={15} />Web and installable app access</li></ul><a className="button button-dark" href="https://jobsmatchnow.com/app/">Find my matches <ArrowRight size={16} /></a></article>
          <article className="employer-price"><span>FOR HIRING TEAMS</span><h3>Employer pilot</h3><div className="price"><strong>Early access</strong><small>transparent plans at launch</small></div><ul><li><Check size={15} />Ranked, explainable candidate fit</li><li><Check size={15} />Mutual interest before outreach</li><li><Check size={15} />Visual recruiting pipeline</li><li><Check size={15} />LinkedIn-ready integration layer</li></ul><a className="button button-linkedin" href="https://jobsmatchnow.com/app/">Meet matched talent <ArrowRight size={16} /></a></article>
        </div>
      </section>

      <DownloadActions />

      <section className="section faq-section" id="faq">
        <div className="section-heading"><span className="eyebrow">Questions, answered</span><h2>Everything you need<br />to get started.</h2></div>
        <div className="faq-list">
          <details open><summary>Is JobsMatchNow free to try?<span>+</span></summary><p>Yes. Candidate access, the hosted web experience, and the installable web app can be tried without an app-store download.</p></details>
          <details><summary>Can I use JobsMatchNow on Windows and macOS?<span>+</span></summary><p>Yes. Install the web app directly from a supported browser for a dedicated window, app icon, and desktop launch experience.</p></details>
          <details><summary>When will the App Store and Google Play links work?<span>+</span></summary><p>The native iOS and Android projects are ready for signed release builds. Store buttons activate after Apple and Google approve the listings and provide official store IDs.</p></details>
          <details><summary>Does JobsMatchNow publish jobs to LinkedIn?<span>+</span></summary><p>The product includes a LinkedIn-ready adapter. Live job synchronization requires LinkedIn Talent Solutions partner approval and credentials.</p></details>
          <details><summary>How does a match happen?<span>+</span></summary><p>A candidate expresses interest in a role and the hiring team expresses interest in that candidate. Only reciprocal intent creates a match and opens communication.</p></details>
          <details><summary>Does JobsMatchNow share my exact location?<span>+</span></summary><p>No. You choose a city and distance range. Exact addresses are not used for discovery. After a mutual match, both sides can choose whether to meet for coffee in a convenient public place.</p></details>
        </div>
      </section>

      <section className="final-cta"><div className="cta-orbit one" /><div className="cta-orbit two" /><span className="eyebrow light"><Sparkles size={14} /> A better first step</span><h2>Stop chasing.<br />Start matching.</h2><p>Let the right match choose you. Match nearby and meet for a cup of coffee in your city.</p><div className="hero-actions"><a className="button button-lime" href="https://jobsmatchnow.com/app/">Find matches near me <ArrowRight size={18} /></a><a className="button button-ghost" href="https://jobsmatchnow.com/app/">Meet nearby talent <ArrowRight size={18} /></a></div></section>

      <footer><div className="footer-main"><a className="brand brand-light" href="#top"><span className="brand-mark" aria-hidden="true" /><span className="brand-wordmark"><b>Jobs</b><b>Match</b><b>Now</b></span></a><p>Let the right match choose you.</p><div><a href="#product">How it works</a><a href="#people">Job seekers</a><a href="#teams">Employers</a><a href="#pricing">Pricing</a><a href="#download">Download</a><a href="#faq">FAQ</a></div></div><div className="footer-bottom"><span>© 2026 JobsMatchNow. Find work and talent you&apos;ll love.</span><span>Independent product · Privacy · Terms · Accessibility</span></div></footer>
    </main>
  );
}
