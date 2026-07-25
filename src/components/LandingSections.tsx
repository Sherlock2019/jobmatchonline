import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BarChart3, Bell, BriefcaseBusiness, Check, Coffee, Eye, FileText, Heart, Layers3, Loader2, LogIn, MapPin, MessageCircle, PenLine, Send, ShieldCheck, Sparkles, Star, Target, UserPlus, X } from 'lucide-react';
import { api } from '../api';
import { appleColor } from '../lib/colors';
import type { Job, Person, Review } from '../types';
import { JobHeaderBadge } from './jobs/JobHeaderBadge';

// Apple iOS system colors, one per step.
const JOURNEY = [
  { icon: UserPlus, title: 'Register free', text: 'One click with Google, LinkedIn, or email.', hue: '#FF3B30' },
  { icon: FileText, title: 'Build your profile', text: 'Upload a resume and we auto-fill it.', hue: '#FF9500' },
  { icon: Sparkles, title: 'Get matched', text: 'A ranked deck with explainable fit scores.', hue: '#FF2D55' },
  { icon: Heart, title: 'Mutual interest', text: 'A connection opens only when both swipe.', hue: '#34C759' },
  { icon: MessageCircle, title: 'Start chatting', text: 'Salaries revealed, contact shared, ice broken.', hue: '#00C7BE' },
  { icon: BriefcaseBusiness, title: 'Interview', text: 'Prep tools and interview kits, built in.', hue: '#32ADE6' },
  { icon: Star, title: 'Offer', text: 'Move through the pipeline to an offer.', hue: '#007AFF' },
  { icon: Check, title: 'Sign the contract', text: 'From first hello to signed — one place.', hue: '#AF52DE' },
];

export function JourneyPipeline() {
  return <section className="section journey-section" id="journey">
    <div className="section-heading centered"><span className="eyebrow"><Sparkles size={14} /> The whole journey</span><h2>From register to signed — one lively flow.</h2><p>Every step from your first swipe to a signed contract lives in a single, respectful experience.</p></div>
    <div className="journey-track">
      {JOURNEY.map((step, index) => <div className="journey-step" key={step.title}>
        <div className="journey-node" style={{ ['--hue' as string]: step.hue }}>
          <span className="journey-num">{index + 1}</span>
          <step.icon size={22} />
        </div>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
        {index < JOURNEY.length - 1 && <ArrowRight className="journey-arrow" size={18} />}
      </div>)}
    </div>
  </section>;
}

const CANDIDATE_FEATURES = [
  { icon: Heart, title: 'Mutual Matching', text: 'No cold applications, no recruiter spam — a conversation only opens once both sides say yes.' },
  { icon: Target, title: 'Explainable Match Score', text: 'See exactly why you matched — a transparent skills, salary, location, and work-mode breakdown.' },
  { icon: Sparkles, title: 'Salary Revealed Up Front', text: 'Salary fit is scored before you ever talk, so you don’t invest in a conversation over a comp mismatch.' },
  { icon: MapPin, title: 'Geolocation of Opportunities', text: 'Set a private distance range for on-site or hybrid roles, then meet nearby for a real coffee — your exact address stays yours.' },
  { icon: FileText, title: 'Resume Autofill', text: 'Upload once, and your whole profile fills itself in — skip the retyping.' },
  { icon: Eye, title: 'Visibility Inspector', text: 'See your profile exactly as a recruiter will, before you ever match — full control over what’s shown and when.' },
  { icon: Layers3, title: 'Multiple Profile Variants', text: 'One account, several tailored personas — switch your title and skills instantly per role you’re chasing.' },
  { icon: ShieldCheck, title: 'Verified Recommendations', text: 'Real testimonials from real colleagues, tied to a verifiable email — social proof, not self-reported claims.' },
];

const RECRUITER_FEATURES = [
  { icon: BriefcaseBusiness, title: 'Instant Job Import', text: 'Bulk-import from an ATS feed, paste a LinkedIn post, or add manually — a role is live in minutes, not hours.' },
  { icon: Heart, title: 'Candidates Worth Your Time', text: 'Only see candidates who’ve genuinely opted in — no résumé blasts, no ghosted outreach.' },
  { icon: Target, title: 'Explainable Match Score', text: 'The same transparent breakdown for every candidate — less guesswork, faster shortlisting.' },
  { icon: BarChart3, title: 'Hiring Insights', text: 'Real funnel, response-rate, and match-quality dashboards for every role you post.' },
  { icon: Sparkles, title: 'Salary Set Up Front', text: 'Fewer offers falling apart over comp surprises late in the process.' },
  { icon: MapPin, title: 'Geolocation of Opportunities', text: 'Find candidates genuinely close enough for on-site or hybrid roles, then meet nearby for a real coffee instead of another cold call.' },
  { icon: Coffee, title: '“Let’s Have a Coffee” Scheduling', text: 'One tap to a real conversation — proposes a time and drops straight into your calendar.' },
  { icon: Bell, title: 'Coffee Requests', text: 'See who already likes your roles, ranked by fit, before you spend a minute reaching out.' },
];

export function FeaturesTable() {
  return <section className="section features-section" id="features">
    <div className="section-heading centered">
      <span className="eyebrow"><Sparkles size={14} /> Why JobsMatchNow</span>
      <h2>Better, faster, easier job search and recruitment — powered by killer mutual matching.</h2>
      <p>Everything below exists for one reason: matches that are worth your time.</p>
    </div>
    <div className="features-columns">
      <div className="features-column">
        <h3>For Candidates</h3>
        <div className="features-table">
          {CANDIDATE_FEATURES.map((feature) => <div className="features-row" key={feature.title}>
            <div className="features-icon"><feature.icon size={18} /></div>
            <div><strong>{feature.title}</strong><p>{feature.text}</p></div>
          </div>)}
        </div>
      </div>
      <div className="features-column">
        <h3>For Recruiters</h3>
        <div className="features-table">
          {RECRUITER_FEATURES.map((feature) => <div className="features-row" key={feature.title}>
            <div className="features-icon"><feature.icon size={18} /></div>
            <div><strong>{feature.title}</strong><p>{feature.text}</p></div>
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

function workModeShort(job: Job) {
  if (job.workMode === 'Remote') return job.remoteScope === 'country' ? `Remote · ${job.country || 'country'}` : 'Remote';
  return job.workMode;
}

export function LatestShowcase({ onRegister, onLogin }: { onRegister?: () => void; onLogin?: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [tab, setTab] = useState<'jobs' | 'people'>('jobs');
  const [detail, setDetail] = useState<{ kind: 'job'; job: Job } | { kind: 'person'; person: Person } | null>(null);
  useEffect(() => { api.showcase().then((data) => { setJobs(data.jobs); setCandidates(data.candidates); }).catch(() => undefined); }, []);
  if (!jobs.length && !candidates.length) return null;
  return <section className="section showcase-section" id="latest">
    <div className="section-heading"><div><span className="eyebrow"><Sparkles size={14} /> Live on JobsMatchNow</span><h2>The latest roles and people.</h2></div>
      <div className="showcase-tabs"><button className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>Latest roles</button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>People matching</button></div>
    </div>
    {tab === 'jobs' ? <div className="showcase-grid">
      {jobs.map((job) => <article className="showcase-job clickable" key={job.id} role="button" tabIndex={0} onClick={() => setDetail({ kind: 'job', job })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail({ kind: 'job', job }); } }}>
        <JobHeaderBadge job={job} />
        <div className="showcase-job-body">
          <div className="showcase-meta"><span><MapPin size={13} />{job.location}</span><span className="mode-badge">{workModeShort(job)}</span></div>
          <div className="showcase-skills">{job.requiredSkills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div>
          <div className="showcase-job-foot"><b>{job.salary}</b><em>{job.type}</em></div>
        </div>
      </article>)}
    </div> : <div className="showcase-grid people">
      {candidates.map((person) => <article className="showcase-person clickable" key={person.id} role="button" tabIndex={0} style={{ ['--accent' as string]: appleColor(person.id) }} onClick={() => setDetail({ kind: 'person', person })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail({ kind: 'person', person }); } }}>
        <div className="showcase-person-photo" style={{ backgroundImage: `linear-gradient(transparent 50%, rgba(0,0,0,.78)), url(${person.photo})` }}>
          <div className="showcase-person-cap"><strong>{person.name}</strong><span>{person.title}</span></div>
        </div>
        <div className="showcase-person-body">
          <div className="showcase-meta"><span><MapPin size={13} />{person.location}</span>{person.availability && <span className="avail">Available {person.availability}</span>}</div>
          <div className="showcase-skills">{(person.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div>
        </div>
      </article>)}
    </div>}
    <AnimatePresence>{detail && <ShowcaseDetailModal detail={detail} onClose={() => setDetail(null)} onRegister={onRegister} onLogin={onLogin} />}</AnimatePresence>
  </section>;
}

function ShowcaseDetailModal({ detail, onClose, onRegister, onLogin }: { detail: { kind: 'job'; job: Job } | { kind: 'person'; person: Person }; onClose: () => void; onRegister?: () => void; onLogin?: () => void }) {
  const isJob = detail.kind === 'job';
  const job = isJob ? detail.job : undefined;
  const person = !isJob ? detail.person : undefined;
  const heroStyle = { backgroundImage: `linear-gradient(transparent 42%, rgba(0,0,0,.85)), url(${person?.photo || ''})` };
  const cta = () => { onClose(); (onRegister || (() => undefined))(); };
  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="showcase-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(e) => e.stopPropagation()}>
      <button className="modal-close showcase-modal-close" onClick={onClose} aria-label="Close"><X /></button>
      {isJob ? <JobHeaderBadge job={job!} className="showcase-detail-job-header" /> : <div className="showcase-modal-hero" style={heroStyle}>
        <div className="showcase-modal-cap"><span>{person!.title}</span><h2>{person!.name}</h2></div>
      </div>}
      <div className="showcase-modal-body">
        <div className="showcase-meta big">
          <span><MapPin size={14} />{isJob ? job!.location : person!.location}</span>
          {isJob ? <span className="mode-badge">{workModeShort(job!)}</span> : (person!.availability && <span className="avail">Available {person!.availability}</span>)}
          {isJob ? <span><BriefcaseBusiness size={14} />{job!.type}</span> : <span><BriefcaseBusiness size={14} />{person!.experienceLevel}</span>}
          {isJob && <span className="showcase-salary">{job!.salary}</span>}
        </div>
        {isJob && job!.description && <p className="showcase-modal-desc">{job!.description}</p>}
        {isJob && job!.responsibilities && job!.responsibilities.length > 0 && <><span className="card-label">What you'll do</span><ul className="showcase-modal-list">{job!.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></>}
        <span className="card-label">{isJob ? 'Required skills' : 'Top skills'}</span>
        <div className="showcase-skills modal">{(isJob ? job!.requiredSkills : (person!.skills || [])).map((skill) => <span key={skill}>{skill}</span>)}</div>
        <div className="showcase-cta">
          <div className="showcase-cta-copy"><Heart size={16} /><span>{isJob ? 'Register or log in to apply — and start matching with roles like this.' : 'Register or log in to connect with candidates like this.'}</span></div>
          <div className="showcase-cta-actions">
            <button className="primary-button" onClick={cta}>{isJob ? 'Register to apply' : 'Register to connect'} <ArrowRight size={17} /></button>
            <button className="secondary-button" onClick={() => { onClose(); (onLogin || (() => undefined))(); }}><LogIn size={16} /> Log in</button>
          </div>
        </div>
      </div>
    </motion.div>
  </motion.div>;
}

function Stars({ value, onChange }: { value: number; onChange?: (value: number) => void }) {
  return <div className={onChange ? 'stars input' : 'stars'}>
    {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={n <= value ? 'on' : ''} onClick={() => onChange?.(n)} disabled={!onChange} aria-label={`${n} star${n > 1 ? 's' : ''}`}><Star size={onChange ? 20 : 13} fill={n <= value ? 'currentColor' : 'none'} /></button>)}
  </div>;
}

export function FeedbackSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mode, setMode] = useState<'review' | 'suggestion'>('review');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.reviews().then((data) => setReviews(data.reviews)).catch(() => undefined); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 3) { setError('Please write a little more'); return; }
    setSending(true); setError('');
    try {
      await api.submitFeedback({ type: mode, message: message.trim(), name: name.trim() || undefined, role: role.trim() || undefined, rating: mode === 'review' ? rating : undefined });
      setDone(true); setMessage(''); setName(''); setRole('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send'); }
    finally { setSending(false); }
  };

  return <section className="section feedback-section" id="feedback">
    <div className="section-heading centered"><span className="eyebrow"><Heart size={14} /> Loved by early users</span><h2>Tell us what you think.</h2><p>Leave a review, or suggest the next feature you want. We read every one.</p></div>
    <div className="feedback-layout">
      <div className="review-wall">
        {reviews.map((review) => <article className="review-card" key={review.id}>
          {review.rating ? <Stars value={review.rating} /> : null}
          <p>“{review.message}”</p>
          <footer><strong>{review.name}</strong>{review.role ? <span>{review.role}</span> : null}</footer>
        </article>)}
      </div>
      <div className="feedback-form-wrap">
        <div className="feedback-toggle"><button className={mode === 'review' ? 'active' : ''} onClick={() => { setMode('review'); setDone(false); }}><Star size={14} /> Leave a review</button><button className={mode === 'suggestion' ? 'active' : ''} onClick={() => { setMode('suggestion'); setDone(false); }}><PenLine size={14} /> Suggest a feature</button></div>
        {done ? <div className="feedback-done"><div className="feedback-done-mark"><Check size={26} /></div><strong>Thank you!</strong><p>{mode === 'review' ? 'Your review will appear once it’s approved.' : 'Your idea is on our list.'}</p><button className="text-button" onClick={() => setDone(false)}>Send another</button></div>
          : <form className="feedback-form" onSubmit={submit}>
            {mode === 'review' && <label className="fb-field"><span>Your rating</span><Stars value={rating} onChange={setRating} /></label>}
            <div className="fb-row">
              <input className="fb-input" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="fb-input" placeholder="Role (optional)" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <textarea className="fb-input fb-textarea" rows={4} placeholder={mode === 'review' ? 'What did you love? What could be better?' : 'What feature should we build next?'} value={message} onChange={(e) => setMessage(e.target.value)} required />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="primary-button" disabled={sending}>{sending ? <Loader2 size={16} className="spin" /> : <><Send size={16} /> {mode === 'review' ? 'Post review' : 'Send suggestion'}</>}</button>
          </form>}
      </div>
    </div>
  </section>;
}
