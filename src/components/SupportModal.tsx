import { useState } from 'react';
import { motion } from 'motion/react';
import { CircleHelp, Loader2, X } from 'lucide-react';
import { api } from '../api';
import { Field, TextInput } from './profile/fields';
import type { Person } from '../types';

/** Minimal support contact form — replaces the old plain mailto link so
 * requests land in the admin support queue instead of only an inbox. */
export function SupportModal({ viewer, onClose }: { viewer?: Person; onClose: () => void }) {
  const [name, setName] = useState(viewer?.name || '');
  const [email, setEmail] = useState(viewer?.email || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) { setError('Fill in your name, email, and message'); return; }
    setSending(true); setError('');
    try {
      await api.submitSupportRequest({ name: name.trim(), email: email.trim(), message: message.trim(), userId: viewer?.id });
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send that — try emailing support@jobsmatchnow.com directly'); }
    finally { setSending(false); }
  };

  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="coach-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <header className="coach-head"><div><span className="overline">Help center</span><h2>Contact support</h2></div></header>
      <div className="coach-body">
        {sent ? <p>Thanks — we'll get back to you at {email}.</p> : <>
          <Field label="Your name" required><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Email" required><TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label="How can we help?" required><textarea className="wz-input wz-textarea" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
          {error && <p className="auth-error">{error}</p>}
          <button type="button" className="primary-button" onClick={submit} disabled={sending} style={{ marginTop: 10 }}>
            {sending ? <Loader2 size={16} className="spin" /> : <><CircleHelp size={16} /> Send message</>}
          </button>
        </>}
      </div>
    </motion.div>
  </motion.div>;
}
