import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

/** Live camera capture via getUserMedia — works for a laptop webcam and a
 * phone browser's front/rear camera alike, no native app handoff needed.
 * Falls back to a clear error (with the caller's Upload button as the
 * escape hatch) if the camera can't be reached or permission is denied. */
export function CameraCaptureModal({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      })
      .catch(() => setError('Could not access your camera — check permissions, or use Upload instead.'));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

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
        ? <p className="camera-error">{error}</p>
        : <>
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
          <button type="button" className="primary-button camera-capture-btn" onClick={capture} disabled={!ready}><Camera size={16} /> Capture</button>
        </>}
    </div>
  </div>;
}
