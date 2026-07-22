import { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Check, FileText, Heart, Loader2, MapPin, MessageCircle, PenLine, Send, Sparkles, Star, UserPlus } from 'lucide-react';
import { api, apiBase } from '../api';
import type { Job, Person, Review } from '../types';

const JOURNEY = [
  { icon: UserPlus, title: 'Register free', text: 'One click with Google, LinkedIn, or email.', hue: '#fd267a' },
  { icon: FileText, title: 'Build your profile', text: 'Upload a resume and we auto-fill it.', hue: '#ff4458' },
  { icon: Sparkles, title: 'Get matched', text: 'A ranked deck with explainable fit scores.', hue: '#ff6036' },
  { icon: Heart, title: 'Mutual interest', text: 'A connection opens only when both swipe.', hue: '#f5a623' },
  { icon: MessageCircle, title: 'Start chatting', text: 'Salaries revealed, contact shared, ice broken.', hue: '#22c1a4' },
  { icon: BriefcaseBusiness, title: 'Interview', text: 'Prep tools and interview kits, built in.', hue: '#0a9bd8' },
  { icon: Star, title: 'Offer', text: 'Move through the pipeline to an offer.', hue: '#2b6ef5' },
  { icon: Check, title: 'Sign the contract', text: 'From first hello to signed — one place.', hue: '#7c3aed' },
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

function workModeShort(job: Job) {
  if (job.workMode === 'Remote') return job.remoteScope === 'country' ? `Remote · ${job.country || 'country'}` : 'Remote';
  return job.workMode;
}

export function LatestShowcase() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [tab, setTab] = useState<'jobs' | 'people'>('jobs');
  useEffect(() => { api.showcase().then((data) => { setJobs(data.jobs); setCandidates(data.candidates); }).catch(() => undefined); }, []);
  if (!jobs.length && !candidates.length) return null;
  return <section className="section showcase-section" id="latest">
    <div className="section-heading"><div><span className="eyebrow"><Sparkles size={14} /> Live on JobsMatchNow</span><h2>The latest roles and people.</h2></div>
      <div className="showcase-tabs"><button className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>Latest roles</button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>People matching</button></div>
    </div>
    {tab === 'jobs' ? <div className="showcase-grid">
      {jobs.map((job) => <article className="showcase-job" key={job.id}>
        <div className="showcase-job-hero" style={job.coverImage ? { backgroundImage: `linear-gradient(transparent 45%, rgba(0,0,0,.8)), url(${apiBase}${job.coverImage})` } : { background: `linear-gradient(150deg, ${job.accent}, ${job.accent}bb)` }}>
          {!job.coverImage && <span className="showcase-job-logo">{job.logo}</span>}
          <div className="showcase-job-cap"><strong>{job.title}</strong><span>{job.company}</span></div>
        </div>
        <div className="showcase-job-body">
          <div className="showcase-meta"><span><MapPin size={13} />{job.location}</span><span className="mode-badge">{workModeShort(job)}</span></div>
          <div className="showcase-skills">{job.requiredSkills.map((skill) => <span key={skill}>{skill}</span>)}</div>
          <div className="showcase-job-foot"><b>{job.salary}</b><em>{job.type}</em></div>
        </div>
      </article>)}
    </div> : <div className="showcase-grid people">
      {candidates.map((person) => <article className="showcase-person" key={person.id}>
        <div className="showcase-person-photo" style={{ backgroundImage: `linear-gradient(transparent 50%, rgba(0,0,0,.78)), url(${person.photo})` }}>
          <div className="showcase-person-cap"><strong>{person.name}</strong><span>{person.title}</span></div>
        </div>
        <div className="showcase-person-body">
          <div className="showcase-meta"><span><MapPin size={13} />{person.location}</span>{person.availability && <span className="avail">Available {person.availability}</span>}</div>
          <div className="showcase-skills">{(person.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div>
        </div>
      </article>)}
    </div>}
  </section>;
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
      const { entry } = await api.submitFeedback({ type: mode, message: message.trim(), name: name.trim() || undefined, role: role.trim() || undefined, rating: mode === 'review' ? rating : undefined });
      if (mode === 'review') setReviews((current) => [entry, ...current].slice(0, 8));
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
        {done ? <div className="feedback-done"><div className="feedback-done-mark"><Check size={26} /></div><strong>Thank you!</strong><p>{mode === 'review' ? 'Your review is live below.' : 'Your idea is on our list.'}</p><button className="text-button" onClick={() => setDone(false)}>Send another</button></div>
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
