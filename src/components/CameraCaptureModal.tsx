import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, X } from 'lucide-react';

/** Live camera capture via getUserMedia — works for a laptop webcam and a
 * phone browser's front/rear camera alike, no native app handoff needed.
 * Falls back to a clear, retryable error (with the caller's Upload button
 * as the escape hatch) if the camera can't be reached or permission is
 * denied — a permission decision the browser/OS remembers is something
 * only the user can undo in their settings; this just explains how. */
export function CameraCaptureModal({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser doesn’t support camera capture here — use Upload instead.');
      return;
    }
    const attach = (stream: MediaStream) => {
      if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setReady(true);
    };
    // A strict facingMode constraint can be rejected outright on hardware
    // that doesn't report one (most desktop webcams) — prefer it, but fall
    // back to a plain, unconstrained request before giving up.
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false })
      .then(attach)
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(attach))
      .catch((err) => {
        const name = err instanceof DOMException ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera access is blocked for this site. Click the camera/lock icon in your browser’s address bar → Site settings → Camera → Allow (on Windows, also check Settings → Privacy & security → Camera is on for your browser), then try again.'
            : name === 'NotFoundError' ? 'No camera was found on this device — use Upload instead.'
              : 'Could not access your camera (it may be blocked in this preview window) — use Upload instead.'
        );
      });
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [attempt]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror horizontally so the capture matches what the user sees of themselves.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => { if (blob) onCapture(blob); }, 'image/jpeg', 0.92);
  };

  return <div className="modal-scrim" role="presentation" onMouseDown={onClose}>
    <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Take a photo" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <h3>Take a photo</h3>
      {error
        ? <>
          <p className="camera-error">{error}</p>
          <button type="button" className="secondary-button camera-capture-btn" onClick={() => setAttempt((n) => n + 1)}><RotateCcw size={15} /> Try again</button>
        </>
        : <>
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
          <button type="button" className="primary-button camera-capture-btn" onClick={capture} disabled={!ready}><Camera size={16} /> Capture</button>
        </>}
    </div>
  </div>;
}
