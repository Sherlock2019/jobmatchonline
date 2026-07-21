import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Download, FileText, Loader2, Lock, X } from 'lucide-react';
import { apiBase } from '../api';
import { renderPdf } from '../lib/pdf';
import type { Person } from '../types';

interface ViewDescriptor { mode: 'pdf' | 'html' | 'text' | 'preview'; name: string; pdfUrl?: string; htmlUrl?: string; textUrl?: string; previewUrl?: string; originalUrl?: string }

export function ResumeViewerModal({ person, viewerId, onClose }: { person: Person; viewerId: string; onClose: () => void }) {
  const [descriptor, setDescriptor] = useState<ViewDescriptor | null>(null);
  const [text, setText] = useState('');
  const [html, setHtml] = useState('');
  const [anonymized, setAnonymized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${apiBase}/api/users/${person.id}/resume/view?viewerId=${encodeURIComponent(viewerId)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not load resume');
        if (cancelled) return;
        setDescriptor(body);
        if (body.mode === 'pdf' && body.pdfUrl) {
          const canvases = await renderPdf(`${apiBase}${body.pdfUrl}`);
          if (cancelled) return;
          pagesRef.current?.replaceChildren(...canvases);
        } else if (body.mode === 'html' && body.htmlUrl) {
          const inner = await (await fetch(`${apiBase}${body.htmlUrl}`)).json();
          if (!cancelled) setHtml(inner.html || '');
        } else {
          const url = body.mode === 'preview' ? body.previewUrl : body.textUrl;
          const inner = await (await fetch(`${apiBase}${url}`)).json();
          if (!cancelled) { setText(inner.text || ''); setAnonymized(Boolean(inner.anonymized) || body.mode === 'preview'); }
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load resume'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [person.id, viewerId]);

  const locked = descriptor?.mode === 'preview';

  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="resume-modal" initial={{ y: 26, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: .97 }} onClick={(event) => event.stopPropagation()}>
      <header className="resume-modal-head">
        <div className="resume-modal-title"><FileText size={17} /><div><strong>{locked ? 'Anonymized resume preview' : descriptor?.name || 'Resume'}</strong><small>{person.name}{locked ? ' · contact details hidden until you match' : ''}</small></div></div>
        <div className="resume-modal-actions">
          {!locked && descriptor?.pdfUrl && <a className="secondary-button resume-dl" href={`${apiBase}${descriptor.pdfUrl}`} target="_blank" rel="noreferrer"><Download size={14} /> PDF</a>}
          {!locked && descriptor?.originalUrl && <a className="secondary-button resume-dl" href={`${apiBase}${descriptor.originalUrl}`}><Download size={14} /> Original</a>}
          <button className="modal-close resume-close" onClick={onClose} aria-label="Close"><X /></button>
        </div>
      </header>
      <div className="resume-modal-body">
        {loading && <div className="resume-loading"><Loader2 size={22} className="spin" /> Preparing resume…</div>}
        {error && <div className="resume-loading">{error}</div>}
        {locked && !loading && <div className="resume-lock-note"><Lock size={14} /> Consent-first: the full resume, name, and contact details unlock for both sides after a mutual match.</div>}
        <div ref={pagesRef} className="resume-pages" />
        {html && <div className="resume-html" dangerouslySetInnerHTML={{ __html: html }} />}
        {text && <pre className="resume-text">{text}</pre>}
        {anonymized && !loading && !error && <div className="resume-anon-badge">Anonymized text extraction</div>}
      </div>
    </motion.div>
  </motion.div>;
}
