import { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Send, X } from 'lucide-react';
import { api } from '../../api';
import { Field, TextInput } from '../profile/fields';
import type { JobMatch } from '../../types';

/** A recruiter's personal note to a candidate who didn't move forward for a
 * specific role — sent as a real email to the candidate, not an in-app chat
 * message, so a "no" still reads as a considered, respectful decision. */
export function FeedbackEmailModal({ match, onClose, onSent }: { match: JobMatch; onClose: () => void; onSent: () => void }) {
  const [message, setMessage] = useState(`Hi ${match.candidate?.name?.split(' ')[0] || 'there'},\n\nThank you for taking the time to connect about the ${match.job?.title || 'role'} position. After careful consideration, we've decided to move forward with other candidates for this particular role.\n\n`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (message.trim().length < 3) { setError('Write a short note first'); return; }
    setSending(true); setError('');
    try { await api.sendFeedbackEmail(match.id, message.trim()); onSent(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send that feedback'); }
    finally { setSending(false); }
  };

  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="coach-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <header className="coach-head"><div><span className="overline">Send feedback</span><h2>To {match.candidate?.name || 'the candidate'}</h2></div></header>
      <div className="coach-body">
        <p className="modal-hint">Sent directly to {match.candidate?.email || 'their email'} — a personal note, not a chat message, for when someone didn’t pass the selection for this role.</p>
        <Field label="Your message" required><textarea className="wz-input wz-textarea" rows={8} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        {error && <p className="auth-error">{error}</p>}
        <button type="button" className="primary-button" onClick={send} disabled={sending} style={{ marginTop: 10 }}>
          {sending ? <Loader2 size={16} className="spin" /> : <><Send size={16} /> Send feedback email</>}
        </button>
      </div>
    </motion.div>
  </motion.div>;
}

/** Refer a candidate who wasn't right for this role to another recruiter's
 * inbox, for a different opening — an outbound email, not a JobsMatchNow
 * account action, so it works even if the other recruiter isn't on the platform. */
export function RecommendationEmailModal({ match, onClose, onSent }: { match: JobMatch; onClose: () => void; onSent: () => void }) {
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!/.+@.+\..+/.test(recruiterEmail)) { setError('Enter a valid recruiter email address'); return; }
    setSending(true); setError('');
    try { await api.sendRecommendationEmail(match.id, recruiterEmail.trim(), message.trim() || undefined); onSent(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send that recommendation'); }
    finally { setSending(false); }
  };

  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="coach-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <header className="coach-head"><div><span className="overline">Recommendation email</span><h2>Refer {match.candidate?.name || 'this candidate'}</h2></div></header>
      <div className="coach-body">
        <p className="modal-hint">Not the right fit for this role? Pass them along to a recruiter hiring for something else — they’ll get an email introducing {match.candidate?.name || 'the candidate'}.</p>
        <Field label="Recruiter's email" required><TextInput type="email" value={recruiterEmail} onChange={(e) => setRecruiterEmail(e.target.value)} placeholder="recruiter@company.com" /></Field>
        <Field label="Add a note (optional)"><textarea className="wz-input wz-textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why you think they'd be a good fit for their team" /></Field>
        {error && <p className="auth-error">{error}</p>}
        <button type="button" className="primary-button" onClick={send} disabled={sending} style={{ marginTop: 10 }}>
          {sending ? <Loader2 size={16} className="spin" /> : <><Send size={16} /> Send recommendation</>}
        </button>
      </div>
    </motion.div>
  </motion.div>;
}
