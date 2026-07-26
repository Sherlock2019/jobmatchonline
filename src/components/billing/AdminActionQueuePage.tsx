import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../api';
import type { ActionQueueItem } from '../../types';

const TYPE_LABEL: Record<ActionQueueItem['type'], string> = {
  report: 'Report', support: 'Support request', payment: 'Payment', fair_use_flag: 'Fair-use flag', trial_ending: 'Trial ending',
};

function fmt(ts: number) { return new Date(ts).toLocaleString(); }

/** Read-only triage view combining open reports, open support requests,
 * pending payments, trials ending soon, and fair-use flags into one sorted
 * list — the actual resolve/confirm/etc. actions still live on their own
 * tabs (Billing, Safety & Support), this is just "what needs attention now". */
export function AdminActionQueuePage() {
  const [items, setItems] = useState<ActionQueueItem[] | null>(null);

  useEffect(() => { api.adminActionQueue().then((res) => setItems(res.items)).catch(() => undefined); }, []);

  if (!items) return <div className="page"><Loader2 className="spin" size={20} /></div>;

  return <div className="page admin-queue-page">
    <div className="page-title"><div><span className="overline">Admin</span><h1>Action Queue</h1><p>Everything waiting on you, most urgent first.</p></div></div>

    {items.length === 0 ? <p className="muted">Nothing needs attention right now.</p> : <table className="admin-table">
      <thead><tr><th>Priority</th><th>Type</th><th>Summary</th><th>From</th><th>When</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}>
        <td><span className={`billing-status-pill queue-priority-${item.priority}`}>{item.priority}</span></td>
        <td>{TYPE_LABEL[item.type]}</td>
        <td>{item.summary}{item.detail && <><br /><small className="muted">{item.detail}</small></>}</td>
        <td>{item.submittedBy}</td>
        <td>{fmt(item.createdAt)}</td>
      </tr>)}</tbody>
    </table>}
  </div>;
}
