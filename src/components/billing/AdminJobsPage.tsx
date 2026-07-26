import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { api } from '../../api';
import type { AdminJobSummary } from '../../types';

function fmt(ts?: number | null) { return ts ? new Date(ts).toLocaleDateString() : '—'; }

export function AdminJobsPage() {
  const [jobs, setJobs] = useState<AdminJobSummary[] | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  const reload = () => { api.adminJobs({ status: status || undefined, q: q || undefined }).then((res) => setJobs(res.jobs)).catch(() => undefined); };
  useEffect(reload, [status]);
  useEffect(() => { const timer = window.setTimeout(reload, 300); return () => window.clearTimeout(timer); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const suspend = async (id: string) => {
    const reason = reasonDrafts[id];
    if (!reason?.trim()) return;
    setBusyId(id);
    try { await api.adminSuspendJob(id, reason.trim()); reload(); } catch (e) { alert(e instanceof Error ? e.message : 'Could not suspend this job'); }
    finally { setBusyId(null); }
  };
  const restore = async (id: string) => {
    setBusyId(id);
    try { await api.adminRestoreJob(id); reload(); } catch (e) { alert(e instanceof Error ? e.message : 'Could not restore this job'); }
    finally { setBusyId(null); }
  };

  return <div className="page admin-jobs-page">
    <div className="page-title"><div><span className="overline">Admin</span><h1>Jobs</h1><p>Suspend or restore a posting — never deletes it.</p></div></div>

    <div className="admin-users-filters">
      <div className="thread-search"><Search size={16} /><input placeholder="Search title or company" value={q} onChange={(event) => setQ(event.target.value)} /></div>
      <select className="wz-input wz-select" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="expired">Expired</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    {!jobs ? <Loader2 className="spin" size={20} /> : <table className="admin-table">
      <thead><tr><th>Title</th><th>Company</th><th>Recruiter</th><th>Status</th><th>Posted</th><th></th></tr></thead>
      <tbody>{jobs.map((job) => <tr key={job.id}>
        <td>{job.title}</td><td>{job.company}</td>
        <td>{job.employer?.name || '—'}{job.employer?.flaggedForJobReview && <span className="billing-status-pill status-pending"> flagged</span>}</td>
        <td><span className={`billing-status-pill status-${job.status}`}>{job.status}</span></td>
        <td>{fmt(job.createdAt)}</td>
        <td className="admin-actions">
          {job.status === 'suspended'
            ? <button type="button" className="secondary-button small" disabled={busyId === job.id} onClick={() => restore(job.id)}>Restore</button>
            : <>
              <input className="admin-reason-input" placeholder="Suspend reason" value={reasonDrafts[job.id] || ''} onChange={(event) => setReasonDrafts((prev) => ({ ...prev, [job.id]: event.target.value }))} />
              <button type="button" className="secondary-button small" disabled={busyId === job.id || !reasonDrafts[job.id]?.trim()} onClick={() => suspend(job.id)}>Suspend</button>
            </>}
        </td>
      </tr>)}</tbody>
    </table>}
    {jobs && jobs.length === 0 && <p className="muted">No jobs match.</p>}
  </div>;
}
