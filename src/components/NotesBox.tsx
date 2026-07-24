import { useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { api } from '../api';
import type { Note } from '../types';

/** A viewer's own private scratchpad on a specific job or candidate — jot
 * something down before or after a conversation or interview. Only its
 * author ever sees it; it isn't part of the shared match record. */
export function NotesBox({ viewerId, targetId, targetType, notes, onSaved }: {
  viewerId: string; targetId: string; targetType: 'job' | 'candidate'; notes: Note[]; onSaved: (note: Note) => void;
}) {
  const existing = notes.find((n) => n.targetId === targetId && n.targetType === targetType);
  const [text, setText] = useState(existing?.text || '');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = text !== (existing?.text || '');

  const save = async () => {
    setSaving(true);
    try {
      const note = await api.saveNote({ userId: viewerId, targetId, targetType, text });
      onSaved(note);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } finally { setSaving(false); }
  };

  return <div className="notes-box">
    <label><NotebookPen size={13} /> Private notes{existing?.updatedAt && <small> · saved {new Date(existing.updatedAt).toLocaleDateString()}</small>}</label>
    <textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder={targetType === 'job' ? 'Anything worth remembering about this role — before or after talking to the team.' : 'Anything worth remembering about this candidate — before or after a conversation or interview.'} />
    <button type="button" className="secondary-button small" onClick={() => void save()} disabled={!dirty || saving}>{justSaved ? 'Saved' : saving ? 'Saving…' : 'Save note'}</button>
  </div>;
}
