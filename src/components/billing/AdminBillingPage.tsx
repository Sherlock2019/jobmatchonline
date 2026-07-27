import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../api';
import { Field, TextInput } from '../profile/fields';

type Overview = Awaited<ReturnType<typeof api.adminBillingOverview>>;
type BankInstructions = Awaited<ReturnType<typeof api.adminBankInstructions>>;
type SectionId = 'bank' | 'pending' | 'confirmed' | 'rejected' | 'trials' | 'grace' | 'expired' | 'rewards' | 'flagged' | 'audit';

function fmt(ts?: number | null) { return ts ? new Date(ts).toLocaleDateString() : '—'; }

export function AdminBillingPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [bank, setBank] = useState<BankInstructions | null>(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [section, setSection] = useState<SectionId>('bank');

  const reload = () => { api.adminBillingOverview().then(setOverview).catch(() => undefined); };
  useEffect(reload, []);
  useEffect(() => { api.adminBankInstructions().then(setBank).catch(() => undefined); }, []);

  const saveBank = async () => {
    if (!bank) return;
    setBankSaving(true); setBankSaved(false);
    try { setBank(await api.adminSetBankInstructions(bank)); setBankSaved(true); window.setTimeout(() => setBankSaved(false), 2000); }
    catch (e) { alert(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBankSaving(false); }
  };

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try { await action(); reload(); } catch (e) { alert(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusyId(null); }
  };

  if (!overview) return <div className="page"><Loader2 className="spin" size={20} /></div>;

  const reasonFor = (id: string) => reasonDrafts[id] || '';
  const setReason = (id: string, value: string) => setReasonDrafts((prev) => ({ ...prev, [id]: value }));

  const sections: { id: SectionId; label: string; count?: number }[] = [
    { id: 'bank', label: 'Bank transfer instructions' },
    { id: 'pending', label: 'Pending payments', count: overview.pendingPayments.length },
    { id: 'confirmed', label: 'Confirmed payments', count: overview.confirmedPayments.length },
    { id: 'rejected', label: 'Rejected / refunded', count: overview.rejectedOrRefundedPayments.length },
    { id: 'trials', label: 'Trials ending ≤7 days', count: overview.trialsEndingSoon.length },
    { id: 'grace', label: 'Grace period', count: overview.graceAccounts.length },
    { id: 'expired', label: 'Expired', count: overview.expiredAccounts.length },
    { id: 'rewards', label: 'Referral rewards', count: overview.referralRewards.length },
    { id: 'flagged', label: 'Flagged referrals', count: overview.suspiciousReferrals.length },
    { id: 'audit', label: 'Recent audit log' },
  ];

  return <div className="page admin-billing-page">
    <div className="page-title"><div><span className="overline">Admin</span><h1>Billing &amp; Subscriptions</h1><p>Manual payment review, subscriptions, and referral rewards.</p></div></div>

    <div className="admin-stat-row">
      <div className="admin-stat"><strong>{overview.pendingPayments.length}</strong><span>Pending payments</span></div>
      <div className="admin-stat"><strong>{overview.activeTrials.length}</strong><span>Active trials</span></div>
      <div className="admin-stat"><strong>{overview.trialsEndingSoon.length}</strong><span>Trials ending ≤7d</span></div>
      <div className="admin-stat"><strong>{overview.graceAccounts.length}</strong><span>Grace period</span></div>
      <div className="admin-stat"><strong>{overview.expiredAccounts.length}</strong><span>Expired</span></div>
      <div className="admin-stat"><strong>{overview.referralRewards.length}</strong><span>Referral rewards</span></div>
      <div className="admin-stat"><strong>{overview.suspiciousReferrals.length}</strong><span>Flagged referrals</span></div>
      <div className="admin-stat"><strong>{overview.flaggedForJobReview.length}</strong><span>Fair-use flags</span></div>
    </div>

    <div className="admin-billing-layout">
      <nav className="admin-billing-subnav">
        {sections.map((s) => <button key={s.id} type="button" className={section === s.id ? 'active' : ''} onClick={() => setSection(s.id)}>
          {s.label}{s.count !== undefined && <em>{s.count}</em>}
        </button>)}
      </nav>

      <div className="admin-billing-content">
        {section === 'bank' && <section className="admin-section">
          <h3>Bank transfer instructions</h3>
          <p className="muted">Shown to recruiters on the Subscription page when they choose a bank-transfer payment method.</p>
          {!bank ? <Loader2 className="spin" size={18} /> : <>
            <Field label="Bank account name"><TextInput value={bank.bankAccountName} onChange={(event) => setBank({ ...bank, bankAccountName: event.target.value })} /></Field>
            <Field label="Bank name"><TextInput value={bank.bankName} onChange={(event) => setBank({ ...bank, bankName: event.target.value })} /></Field>
            <Field label="Account number"><TextInput value={bank.bankAccountNumber} onChange={(event) => setBank({ ...bank, bankAccountNumber: event.target.value })} /></Field>
            <Field label="SWIFT code (for international transfers)"><TextInput value={bank.bankSwift} onChange={(event) => setBank({ ...bank, bankSwift: event.target.value })} /></Field>
            <Field label="VietQR image URL"><TextInput value={bank.vietQrImageUrl} onChange={(event) => setBank({ ...bank, vietQrImageUrl: event.target.value })} /></Field>
            <Field label="Support email"><TextInput value={bank.supportEmail} onChange={(event) => setBank({ ...bank, supportEmail: event.target.value })} /></Field>
            <button type="button" className="primary-button small" disabled={bankSaving} onClick={saveBank}>{bankSaving ? <Loader2 size={13} className="spin" /> : bankSaved ? 'Saved' : 'Save'}</button>
          </>}
        </section>}

        {section === 'pending' && <section className="admin-section">
          <h3>Pending payments ({overview.pendingPayments.length})</h3>
          {overview.pendingPayments.length === 0 ? <p className="muted">Nothing waiting for review.</p> : <table className="admin-table">
            <thead><tr><th>Recruiter</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Reference</th><th>Submitted</th><th></th></tr></thead>
            <tbody>{overview.pendingPayments.map((payment) => <tr key={payment.id}>
              <td>{payment.recruiter?.name || payment.recruiterUserId}<br /><small className="muted">{payment.recruiter?.email}</small></td>
              <td>{payment.invoiceNumber}</td><td>{payment.currency} {payment.amount}</td><td>{payment.paymentMethod.replace(/_/g, ' ')}</td><td>{payment.paymentReference}</td><td>{fmt(payment.createdAt)}</td>
              <td className="admin-actions">
                <button type="button" className="primary-button small" disabled={busyId === payment.id} onClick={() => run(payment.id, () => api.adminConfirmPayment(payment.id))}>{busyId === payment.id ? <Loader2 size={13} className="spin" /> : 'Confirm'}</button>
                <input className="admin-reason-input" placeholder="Reject reason" value={reasonFor(payment.id)} onChange={(event) => setReason(payment.id, event.target.value)} />
                <button type="button" className="secondary-button small" disabled={busyId === payment.id || !reasonFor(payment.id)} onClick={() => run(payment.id, () => api.adminRejectPayment(payment.id, reasonFor(payment.id)))}>Reject</button>
              </td>
            </tr>)}</tbody>
          </table>}
        </section>}

        {section === 'confirmed' && <section className="admin-section">
          <h3>Confirmed payments ({overview.confirmedPayments.length})</h3>
          {overview.confirmedPayments.length === 0 ? <p className="muted">None yet.</p> : <table className="admin-table">
            <thead><tr><th>Recruiter</th><th>Invoice</th><th>Amount</th><th>Confirmed</th><th></th></tr></thead>
            <tbody>{overview.confirmedPayments.map((payment) => <tr key={payment.id}>
              <td>{payment.recruiter?.name || payment.recruiterUserId}</td><td>{payment.invoiceNumber}</td><td>{payment.currency} {payment.amount}</td><td>{fmt(payment.confirmedAt)}</td>
              <td className="admin-actions">
                <input className="admin-reason-input" placeholder="Refund reason (optional)" value={reasonFor(payment.id)} onChange={(event) => setReason(payment.id, event.target.value)} />
                <button type="button" className="secondary-button small" disabled={busyId === payment.id} onClick={() => run(payment.id, () => api.adminRefundPayment(payment.id, reasonFor(payment.id) || undefined))}>Refund</button>
              </td>
            </tr>)}</tbody>
          </table>}
        </section>}

        {section === 'rejected' && <section className="admin-section">
          <h3>Rejected / refunded ({overview.rejectedOrRefundedPayments.length})</h3>
          {overview.rejectedOrRefundedPayments.length === 0 ? <p className="muted">None.</p> : <table className="admin-table">
            <thead><tr><th>Recruiter</th><th>Invoice</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>{overview.rejectedOrRefundedPayments.map((payment) => <tr key={payment.id}><td>{payment.recruiter?.name || payment.recruiterUserId}</td><td>{payment.invoiceNumber}</td><td>{payment.status}</td><td>{payment.adminNote}</td></tr>)}</tbody>
          </table>}
        </section>}

        {section === 'trials' && <section className="admin-section">
          <h3>Trials ending within 7 days ({overview.trialsEndingSoon.length})</h3>
          {overview.trialsEndingSoon.length === 0 ? <p className="muted">None.</p> : <table className="admin-table">
            <thead><tr><th>Recruiter</th><th>Trial ends</th></tr></thead>
            <tbody>{overview.trialsEndingSoon.map((entry) => <tr key={entry.recruiter.id}><td>{entry.recruiter.name}</td><td>{fmt(entry.subscription?.trialEndsAt)}</td></tr>)}</tbody>
          </table>}
        </section>}

        {section === 'grace' && <section className="admin-section">
          <h3>Grace period ({overview.graceAccounts.length})</h3>
          {overview.graceAccounts.length === 0 ? <p className="muted">None.</p> : <table className="admin-table">
            <thead><tr><th>Recruiter</th><th>Grace ends</th><th></th></tr></thead>
            <tbody>{overview.graceAccounts.map((entry) => <tr key={entry.recruiter.id}>
              <td>{entry.recruiter.name}</td><td>{fmt(entry.subscription?.gracePeriodEndsAt)}</td>
              <td className="admin-actions"><button type="button" className="secondary-button small" onClick={() => run(entry.recruiter.id, () => api.adminSuspendSubscription(entry.subscription!.id, 'Suspended from grace period by admin'))}>Suspend</button></td>
            </tr>)}</tbody>
          </table>}
        </section>}

        {section === 'expired' && <section className="admin-section">
          <h3>Expired ({overview.expiredAccounts.length})</h3>
          {overview.expiredAccounts.length === 0 ? <p className="muted">None.</p> : <table className="admin-table">
            <thead><tr><th>Recruiter</th><th>Since</th></tr></thead>
            <tbody>{overview.expiredAccounts.map((entry) => <tr key={entry.recruiter.id}><td>{entry.recruiter.name}</td><td>{fmt(entry.subscription?.gracePeriodEndsAt)}</td></tr>)}</tbody>
          </table>}
        </section>}

        {section === 'rewards' && <section className="admin-section">
          <h3>Referral rewards ({overview.referralRewards.length})</h3>
          {overview.referralRewards.length === 0 ? <p className="muted">None yet.</p> : <table className="admin-table">
            <thead><tr><th>Referral</th><th>Qualified</th></tr></thead>
            <tbody>{overview.referralRewards.map((entry) => <tr key={entry.id}><td>{entry.referrerUserId} → {entry.referredUserId}</td><td>{fmt(entry.qualifiedAt)}</td></tr>)}</tbody>
          </table>}
        </section>}

        {section === 'flagged' && <section className="admin-section">
          <h3>Flagged referrals ({overview.suspiciousReferrals.length})</h3>
          {overview.suspiciousReferrals.length === 0 ? <p className="muted">None flagged.</p> : <table className="admin-table">
            <thead><tr><th>Referral</th><th>Status</th></tr></thead>
            <tbody>{overview.suspiciousReferrals.map((entry) => <tr key={entry.id}><td>{entry.referrerUserId} → {entry.referredUserId}</td><td>{entry.status}</td></tr>)}</tbody>
          </table>}
        </section>}

        {section === 'audit' && <section className="admin-section">
          <h3>Recent audit log</h3>
          <table className="admin-table admin-audit">
            <thead><tr><th>When</th><th>Event</th><th>Entity</th><th>Actor</th></tr></thead>
            <tbody>{overview.recentAuditLog.slice(0, 50).map((entry) => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString()}</td><td>{entry.eventType}</td><td>{entry.entityType}</td><td>{entry.userId}</td></tr>)}</tbody>
          </table>
        </section>}
      </div>
    </div>
  </div>;
}
