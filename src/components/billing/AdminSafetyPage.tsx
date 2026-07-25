import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../api';
import type { Report, SupportRequest } from '../../types';

function fmt(ts?: number | null) { return ts ? new Date(ts).toLocaleString() : '—'; }

export function AdminSafetyPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

  const reload = () => {
    api.adminReports('open').then((res) => setReports(res.reports)).catch(() => undefined);
    api.adminSupportRequests('open').then((res) => setRequests(res.requests)).catch(() => undefined);
  };
  useEffect(reload, []);

  const resolveReport = async (id: string) => {
    const resolution = resolutionDrafts[id] || 'Reviewed';
    setBusyId(id);
    try { await api.adminResolveReport(id, resolution); reload(); } catch (e) { alert(e instanceof Error ? e.message : 'Could not resolve this report'); }
    finally { setBusyId(null); }
  };
  const dismissReport = async (id: string) => {
    setBusyId(id);
    try { await api.adminDismissReport(id); reload(); } catch (e) { alert(e instanceof Error ? e.message : 'Could not dismiss this report'); }
    finally { setBusyId(null); }
  };
  const resolveRequest = async (id: string) => {
    setBusyId(id);
    try { await api.adminResolveSupportRequest(id); reload(); } catch (e) { alert(e instanceof Error ? e.message : 'Could not resolve this request'); }
    finally { setBusyId(null); }
  };

  if (!reports || !requests) return <div className="page"><Loader2 className="spin" size={20} /></div>;

  return <div className="page admin-safety-page">
    <div className="page-title"><div><span className="overline">Admin</span><h1>Safety &amp; Support</h1><p>Fraud/scam reports and customer support requests — open items only.</p></div></div>

    <section className="admin-section">
      <h3>Open reports ({reports.length})</h3>
      {reports.length === 0 ? <p className="muted">Nothing open.</p> : <table className="admin-table">
        <thead><tr><th>Reported by</th><th>Target</th><th>Category</th><th>Details</th><th>Filed</th><th></th></tr></thead>
        <tbody>{reports.map((report) => <tr key={report.id}>
          <td>{report.reporterName || report.reporterUserId}</td>
          <td>{report.targetType} · {report.targetId}</td>
          <td>{report.category.replace(/_/g, ' ')}</td>
          <td>{report.description || '—'}</td>
          <td>{fmt(report.createdAt)}</td>
          <td className="admin-actions">
            <input className="admin-reason-input" placeholder="Resolution note" value={resolutionDrafts[report.id] || ''} onChange={(event) => setResolutionDrafts((prev) => ({ ...prev, [report.id]: event.target.value }))} />
            <button type="button" className="primary-button small" disabled={busyId === report.id} onClick={() => resolveReport(report.id)}>Resolve</button>
            <button type="button" className="secondary-button small" disabled={busyId === report.id} onClick={() => dismissReport(report.id)}>Dismiss</button>
          </td>
        </tr>)}</tbody>
      </table>}
    </section>

    <section className="admin-section">
      <h3>Open support requests ({requests.length})</h3>
      {requests.length === 0 ? <p className="muted">Nothing open.</p> : <table className="admin-table">
        <thead><tr><th>From</th><th>Message</th><th>Sent</th><th></th></tr></thead>
        <tbody>{requests.map((request) => <tr key={request.id}>
          <td>{request.name}<br /><small className="muted">{request.email}</small></td>
          <td>{request.message}</td>
          <td>{fmt(request.createdAt)}</td>
          <td className="admin-actions"><button type="button" className="primary-button small" disabled={busyId === request.id} onClick={() => resolveRequest(request.id)}>Mark resolved</button></td>
        </tr>)}</tbody>
      </table>}
    </section>
  </div>;
}
