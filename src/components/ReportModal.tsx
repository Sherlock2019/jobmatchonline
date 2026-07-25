import { useState } from 'react';
import { motion } from 'motion/react';
import { Flag, Loader2, X } from 'lucide-react';
import { api } from '../api';
import { Field } from './profile/fields';
import type { ReportCategory } from '../types';

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  fake_job: 'Fake or misleading job', scam_or_fraud: 'Scam or fraud', harassment: 'Harassment',
  discrimination: 'Discrimination', spam: 'Spam', payment_request: 'Asked me to pay money',
  impersonation: 'Impersonation', other: 'Other',
};

/** Minimal fraud/scam/safety report: category + optional description, lands
 * in one admin queue (open -> resolved/dismissed) — no severity levels or
 * incident workflow, see admin plan notes on keeping this scoped. */
export function ReportModal({ viewerId, targetType, targetId, onClose }: {
  viewerId: string; targetType: 'user' | 'job' | 'conversation'; targetId: string; onClose: () => void;
}) {
  const [category, setCategory] = useState<ReportCategory>('scam_or_fraud');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSending(true); setError('');
    try {
      await api.submitReport({ userId: viewerId, targetType, targetId, category, description: description.trim() || undefined });
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit this report'); }
    finally { setSending(false); }
  };

  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="coach-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <header className="coach-head"><div><span className="overline">Report</span><h2>Something wrong here?</h2></div></header>
      <div className="coach-body">
        {sent ? <p>Thanks — our team will review this.</p> : <>
          <Field label="What's going on" required>
            <select className="wz-input wz-select" value={category} onChange={(event) => setCategory(event.target.value as ReportCategory)}>
              {(Object.keys(CATEGORY_LABELS) as ReportCategory[]).map((key) => <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>)}
            </select>
          </Field>
          <Field label="Details (optional)"><textarea className="wz-input wz-textarea" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Anything that would help us look into this" /></Field>
          {error && <p className="auth-error">{error}</p>}
          <button type="button" className="primary-button" onClick={submit} disabled={sending} style={{ marginTop: 10 }}>
            {sending ? <Loader2 size={16} className="spin" /> : <><Flag size={16} /> Submit report</>}
          </button>
        </>}
      </div>
    </motion.div>
  </motion.div>;
}
