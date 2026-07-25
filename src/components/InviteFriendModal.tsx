import { useState } from 'react';
import { Gift, Mail, X } from 'lucide-react';
import { api } from '../api';

const SUBJECT = 'Thought you might like JobsMatchNow ❤️';
const BODY = `Hi [First Name],

I've been enjoying using JobsMatchNow and thought you might find it worth trying too.

It's a faster, easier, more fun, and more humanizing way to find a job or meet the right candidates — whether virtually or over a real cup of coffee. Instead of spending hours chasing applications, profiles, or messages, you get matched with people and opportunities that actually fit.

For job seekers, it helps you find roles that match your skills, expectations, and personality.

For recruiters, it helps you discover candidates who are genuinely interested and better suited to the company and role.

The best part is that you only connect when both sides are interested, so the conversation already starts on a positive note.

You can also find nearby matches and even meet for a coffee if that feels easier than another formal interview.

Have a look here:
👉 https://jobsmatchnow.com

Let me know what you think. It would be great to see you there.

And here's a discount code for a 1-month free trial: JOBMATCHMENOW

Cheers,
[Your Name]`;

export function InviteFriendModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try { await api.sendInvite(userId); } catch { /* still open the email even if tracking fails */ }
    setSending(false);
    window.location.href = `mailto:?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`;
    onClose();
  };
  return <div className="modal-scrim" role="presentation" onMouseDown={onClose}>
    <div className="invite-modal" role="dialog" aria-modal="true" aria-label="Invite a friend" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
      <div className="invite-modal-icon"><Gift size={22} /></div>
      <h3>Invite a Friend to Join Us — Bonus!</h3>
      <p>Send this invite and you'll get <strong>1 week of free usage</strong> as a thank-you. Your friend also gets a discount code for a free trial, right in the email.</p>
      <button className="primary-button wide" onClick={() => void send()} disabled={sending}><Mail size={16} /> {sending ? 'Opening your email…' : 'Open Email & Invite'}</button>
      <small>Opens your default email app (Gmail, Outlook, or whatever you have set up) with the message pre-written — just add their address and your name.</small>
    </div>
  </div>;
}
