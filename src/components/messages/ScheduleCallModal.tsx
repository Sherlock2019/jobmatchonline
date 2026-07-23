import { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, ExternalLink, Loader2, X } from 'lucide-react';
import { api } from '../../api';
import { Field, TextInput } from '../profile/fields';
import type { JobMatch, Person, ScheduledCall } from '../../types';

const DURATIONS = [15, 25, 30, 45, 60] as const;

/**
 * Recruiter-only: propose a specific call time (persisted, shows to both sides with
 * add-to-calendar links), or — if the recruiter has a Calendly/cal.com link on their
 * profile — just share it so the candidate books directly on the recruiter's real
 * connected calendar. No OAuth: see src/lib/calendar.ts for why.
 */
export function ScheduleCallModal({ match, viewer, onClose, onScheduled, onShareLink }: {
  match: JobMatch; viewer: Person; onClose: () => void; onScheduled: (call: ScheduledCall) => void; onShareLink: (text: string) => void;
}) {
  const candidateFirst = match.candidate?.name?.split(' ')[0] || 'the candidate';
  const [title, setTitle] = useState(`Intro call — ${match.job?.title || 'the role'}`);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const propose = async () => {
    if (!date || !time || !title.trim()) { setError('Pick a title, date, and time'); return; }
    const startAt = new Date(`${date}T${time}`).getTime();
    if (Number.isNaN(startAt)) { setError('That date/time did not parse — check the format'); return; }
    setSaving(true); setError('');
    try {
      const call = await api.scheduleCall({ matchId: match.id, createdBy: viewer.id, title: title.trim(), startAt, durationMinutes: duration, notes: notes.trim() || undefined });
      onScheduled(call);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not schedule that call'); }
    finally { setSaving(false); }
  };

  const shareBookingLink = () => {
    const link = /^https?:/.test(viewer.calendarLink || '') ? viewer.calendarLink! : `https://${viewer.calendarLink}`;
    onShareLink(`Hi ${candidateFirst} — feel free to grab a time that works for you here: ${link}`);
  };

  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="coach-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <header className="coach-head"><div><span className="overline">Schedule a call</span><h2>With {match.candidate?.name || candidateFirst}</h2></div></header>
      <div className="coach-body">
        {viewer.calendarLink && <div className="job-import-bar" style={{ marginBottom: 16 }}>
          <button type="button" className="secondary-button job-import-btn" onClick={shareBookingLink}><ExternalLink size={15} /> Share my booking link instead</button>
          <span className="job-import-note">Lets {candidateFirst} pick a slot on your real connected calendar ({viewer.calendarLink}).</span>
        </div>}
        <Field label="Title" required><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="wz-row">
          <Field label="Date" required><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time" required><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Field label="Duration"><select className="wz-input wz-select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}</select></Field>
        <Field label="Notes (optional)"><textarea className="wz-input wz-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to prepare, or how to join" /></Field>
        {error && <p className="auth-error">{error}</p>}
        <button type="button" className="primary-button" onClick={propose} disabled={saving} style={{ marginTop: 10 }}>
          {saving ? <Loader2 size={16} className="spin" /> : <><Calendar size={16} /> Propose this time</>}
        </button>
      </div>
    </motion.div>
  </motion.div>;
}
