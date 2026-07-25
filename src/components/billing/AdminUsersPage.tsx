import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { api } from '../../api';
import type { AdminUserDetail, AdminUserSummary } from '../../types';

function fmt(ts?: number | null) { return ts ? new Date(ts).toLocaleDateString() : '—'; }

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [role, setRole] = useState<'' | 'candidate' | 'employer'>('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');

  const reload = () => { api.adminUsers({ role: role || undefined, q: q || undefined }).then((res) => setUsers(res.users)).catch(() => undefined); };
  useEffect(reload, [role]);
  useEffect(() => { const timer = window.setTimeout(reload, 300); return () => window.clearTimeout(timer); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = (id: string) => { api.adminUserDetail(id).then(setSelected).catch(() => undefined); };

  const suspend = async (id: string) => {
    if (!reasonDraft.trim()) return;
    setBusyId(id);
    try { await api.adminSuspendUser(id, reasonDraft.trim()); setReasonDraft(''); reload(); openDetail(id); }
    catch (e) { alert(e instanceof Error ? e.message : 'Could not suspend this account'); }
    finally { setBusyId(null); }
  };
  const reactivate = async (id: string) => {
    setBusyId(id);
    try { await api.adminReactivateUser(id); reload(); openDetail(id); }
    catch (e) { alert(e instanceof Error ? e.message : 'Could not reactivate this account'); }
    finally { setBusyId(null); }
  };

  return <div className="page admin-users-page">
    <div className="page-title"><div><span className="overline">Admin</span><h1>Candidates &amp; Recruiters</h1><p>Search, review, and suspend/reactivate accounts.</p></div></div>

    <div className="admin-users-filters">
      <div className="thread-search"><Search size={16} /><input placeholder="Search name, email, company" value={q} onChange={(event) => setQ(event.target.value)} /></div>
      <select className="wz-input wz-select" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
        <option value="">All roles</option>
        <option value="candidate">Candidates</option>
        <option value="employer">Recruiters</option>
      </select>
    </div>

    {!users ? <Loader2 className="spin" size={20} /> : <div className="admin-users-grid">
      <table className="admin-table">
        <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Joined</th><th>Status</th><th></th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id} className={selected?.user.id === user.id ? 'selected-row' : ''}>
          <td>{user.name}</td><td>{user.role === 'employer' ? 'Recruiter' : 'Candidate'}{user.company ? ` · ${user.company}` : ''}</td>
          <td>{user.email}</td><td>{fmt(user.createdAt)}</td>
          <td>{user.suspendedAt ? <span className="billing-status-pill status-suspended">Suspended</span> : <span className="billing-status-pill status-active">Active</span>}</td>
          <td><button type="button" className="secondary-button small" onClick={() => openDetail(user.id)}>View</button></td>
        </tr>)}</tbody>
      </table>
      {users.length === 0 && <p className="muted">No accounts match.</p>}

      {selected && <aside className="admin-user-detail">
        <h3>{selected.user.name}</h3>
        <p className="muted">{selected.user.email} · {selected.user.role === 'employer' ? 'Recruiter' : 'Candidate'}</p>
        <div className="admin-stat-row">
          {selected.user.role === 'employer' && <div className="admin-stat"><strong>{selected.jobsPosted}</strong><span>Jobs posted</span></div>}
          <div className="admin-stat"><strong>{selected.matchCount}</strong><span>Matches</span></div>
          <div className="admin-stat"><strong>{selected.messageCount}</strong><span>Messages</span></div>
          <div className="admin-stat"><strong>{selected.reportsSubmitted}</strong><span>Reports filed</span></div>
          <div className="admin-stat"><strong>{selected.reportsReceived}</strong><span>Reports received</span></div>
        </div>
        {selected.user.flaggedForJobReview && <p className="billing-grace-warning">Flagged for fair-use job review.</p>}
        {selected.user.suspendedAt ? <>
          <p className="billing-grace-warning">Suspended {fmt(selected.user.suspendedAt)} — {selected.user.suspendReason}</p>
          <button type="button" className="secondary-button small" disabled={busyId === selected.user.id} onClick={() => reactivate(selected.user.id)}>Reactivate</button>
        </> : <>
          <input className="admin-reason-input" placeholder="Suspension reason" value={reasonDraft} onChange={(event) => setReasonDraft(event.target.value)} />
          <button type="button" className="secondary-button small" disabled={busyId === selected.user.id || !reasonDraft.trim()} onClick={() => suspend(selected.user.id)}>Suspend account</button>
        </>}
      </aside>}
    </div>}
  </div>;
}
