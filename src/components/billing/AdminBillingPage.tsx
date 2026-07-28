import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../api';
import { Field, TextInput } from '../profile/fields';

type Overview = Awaited<ReturnType<typeof api.adminBillingOverview>>;
type BankInstructions = Awaited<ReturnType<typeof api.adminBankInstructions>>;
type Plans = Awaited<ReturnType<typeof api.adminBillingPlans>>;
type SectionId = 'bank' | 'catalog' | 'plans' | 'seats' | 'boosts' | 'credits' | 'pending' | 'confirmed' | 'rejected' | 'trials' | 'grace' | 'expired' | 'rewards' | 'flagged' | 'audit';

function fmt(ts?: number | null) { return ts ? new Date(ts).toLocaleDateString() : '—'; }
function money(amount: number, currency: string) { return amount === 0 ? 'Free' : currency === 'VND' ? `${amount.toLocaleString('en-US')} ₫` : `USD ${amount}`; }

const PLAN_LABEL: Record<string, string> = {
  trial: 'Trial', free: 'Free', pro: 'Pro',
  starter: 'Starter', solo: 'Solo', duo: 'Duo', trio: 'Trio', team: 'Team', pay_per_hire: 'Pay per hire',
};

export function AdminBillingPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [bank, setBank] = useState<BankInstructions | null>(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [section, setSection] = useState<SectionId>('catalog');
  const [boostKind, setBoostKind] = useState<'job' | 'candidate'>('job');
  const [boostTarget, setBoostTarget] = useState('');
  const [plans, setPlans] = useState<Plans | null>(null);
  const [grantTarget, setGrantTarget] = useState('');

  const loadPlans = () => { api.adminBillingPlans().then(setPlans).catch(() => undefined); };
  const reload = () => { api.adminBillingOverview().then(setOverview).catch(() => undefined); loadPlans(); };
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
    { id: 'catalog', label: 'Pricing & plans', count: plans?.catalog.plans.length },
    { id: 'plans', label: 'Plans & usage', count: plans?.recruiters.length },
    { id: 'seats', label: 'Seats & teams', count: plans?.teams.length },
    { id: 'boosts', label: 'Boosts', count: plans?.boosts.filter((b) => b.live).length },
    { id: 'credits', label: 'Job-post credits', count: plans?.creditLedger.length },
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
        {section === 'catalog' && <section className="admin-section">
          <h3>Pricing &amp; plans</h3>
          {!plans ? <Loader2 className="spin" size={18} /> : <>
            <p className="muted">
              Read straight from the server catalogue, so this is exactly what the product enforces and what the pricing page
              advertises — there is no second copy of these numbers to fall out of date.
            </p>
            <table className="admin-table">
              <thead><tr><th>Plan</th><th>USD / mo</th><th>VND / mo</th><th>Seats</th><th>Live jobs</th><th>Match cap</th><th>Extras</th></tr></thead>
              <tbody>{plans.catalog.plans.map((plan) => <tr key={plan.key}>
                <td><b>{plan.display}</b><br /><small className="muted">{plan.key}</small></td>
                <td>{money(plan.usd, 'USD')}</td>
                <td>{money(plan.vnd, 'VND')}</td>
                <td>{plan.seats}</td>
                <td>{plan.liveJobSlots}</td>
                <td>{plan.monthlyMatchCap === null ? 'Unlimited' : plan.monthlyMatchCap}</td>
                <td>{[plan.analytics && 'Analytics', plan.atsExport && 'ATS export', plan.priorityPlacement && 'Promoted placement',
                  plan.hireFeePercent !== null && `${plan.hireFeePercent}% per hire`].filter(Boolean).join(' · ') || '—'}</td>
              </tr>)}</tbody>
            </table>
            <p className="muted" style={{ marginTop: 16 }}>
              <b>Single posting</b>: {money(plans.catalog.singlePosting.usd, 'USD')} / {money(plans.catalog.singlePosting.vnd, 'VND')} once,
              live {plans.catalog.singlePosting.termDays} days. Priced above Solo on purpose — it sells the subscription.<br />
              <b>Pay per hire</b>: nothing up front, {plans.catalog.payPerHireFeePercent}% of first-year salary on a completed hire.<br />
              <b>Boost</b>: {money(plans.catalog.boost.usd, 'USD')} / {money(plans.catalog.boost.vnd, 'VND')} for {plans.catalog.boost.hours} hours,
              available for {plans.catalog.boost.kinds.join(' and ')}.<br />
              <b>Annual</b> billing charges 10 months — two are free.
            </p>
            <p className="muted">
              <b>Trial</b>: {plans.catalog.trialDays} days, the same for every recruiter. No cohorts, no seat counts,
              no second tier — one number.<br />
              <b>Postings</b> run {plans.catalog.postingTermDays} days and then <i>pause</i> — never expire, never delete.
              Renewal is free, one click, unlimited.
            </p>
            <p className="muted">
              Prices are set in <code>server/billing/plans.js</code> and change with a deploy, so a price is never edited by
              accident from this screen. Live subscriptions on the older plan codes ({['trial', 'free', 'pro'].join(', ')})
              keep their terms and are mapped onto this catalogue for seat and slot limits.
            </p>
          </>}
        </section>}

        {section === 'seats' && <section className="admin-section">
          <h3>Seats &amp; teams</h3>
          {!plans ? <Loader2 className="spin" size={18} /> : plans.teams.length === 0
            ? <p className="muted">No recruiter has invited a teammate yet. Solo recruiters have no team record at all — they behave exactly as before the seat model existed.</p>
            : <table className="admin-table">
              <thead><tr><th>Owner</th><th>Plan</th><th>Seats used</th><th>Members</th></tr></thead>
              <tbody>{plans.teams.map((team) => <tr key={team.id}>
                <td>{team.owner}</td>
                <td><span className="billing-status-pill">{PLAN_LABEL[team.planCode] || team.planCode}</span></td>
                <td>{team.active} / {team.seatsAllowed}</td>
                <td>{team.total}{team.total > team.active && <small className="muted"> ({team.total - team.active} read-only)</small>}</td>
              </tr>)}</tbody>
            </table>}
        </section>}

        {section === 'boosts' && <section className="admin-section">
          <h3>Boosts</h3>
          <p className="muted">
            A boost pins a job or a candidate profile to the front of the deck for {plans?.catalog.boost.hours ?? 72} hours.
            The match score is never changed — the card is labelled <b>Promoted</b> and shows the fit it actually earned.
            Boosts are started here rather than bought in-app because the card rails are still in test mode.
          </p>
          <div className="admin-actions" style={{ marginBottom: 16 }}>
            <select className="admin-reason-input" value={boostKind} onChange={(event) => setBoostKind(event.target.value as 'job' | 'candidate')}>
              <option value="job">Job</option>
              <option value="candidate">Candidate profile</option>
            </select>
            <input className="admin-reason-input" placeholder={boostKind === 'job' ? 'Job id' : 'Candidate user id'} value={boostTarget} onChange={(event) => setBoostTarget(event.target.value)} />
            <input className="admin-reason-input" placeholder="Reason (required)" value={reasonFor('boost')} onChange={(event) => setReason('boost', event.target.value)} />
            <button type="button" className="primary-button small" disabled={busyId === 'boost' || !boostTarget.trim() || reasonFor('boost').trim().length < 3}
              onClick={() => run('boost', async () => { await api.adminGrantBoost(boostKind, boostTarget.trim(), reasonFor('boost')); setBoostTarget(''); setReason('boost', ''); })}>
              Start boost
            </button>
          </div>
          {!plans ? <Loader2 className="spin" size={18} /> : plans.boosts.length === 0 ? <p className="muted">No boosts yet.</p> : <table className="admin-table">
            <thead><tr><th>Target</th><th>Kind</th><th>Bought by</th><th>Price</th><th>Started</th><th>Expires</th><th>Status</th><th /></tr></thead>
            <tbody>{plans.boosts.map((boost) => <tr key={boost.id}>
              <td>{boost.targetName}</td>
              <td>{boost.kind}</td>
              <td>{boost.buyerName}</td>
              <td>{money(boost.amount, boost.currency)}</td>
              <td>{fmt(boost.startedAt)}</td>
              <td>{new Date(boost.expiresAt).toLocaleString()}</td>
              <td><span className="billing-status-pill">{boost.live ? 'Live' : boost.status}</span></td>
              <td className="admin-actions">
                {boost.live && <>
                  <input className="admin-reason-input" placeholder="Reason" value={reasonFor(boost.id)} onChange={(event) => setReason(boost.id, event.target.value)} />
                  <button type="button" className="secondary-button small" disabled={busyId === boost.id || reasonFor(boost.id).trim().length < 3}
                    onClick={() => run(boost.id, () => api.adminRevokeBoost(boost.id, reasonFor(boost.id)))}>Revoke</button>
                </>}
              </td>
            </tr>)}</tbody>
          </table>}
        </section>}

        {section === 'plans' && <section className="admin-section">
          <h3>Plans &amp; usage</h3>
          {!plans ? <Loader2 className="spin" size={18} /> : <>
            <p className="muted">
              Enforcement is <b>{plans.enforced ? 'ON' : 'OFF (shadow mode)'}</b>.{' '}
              {plans.enforced
                ? 'Publishing and editing limits are being applied.'
                : 'Limits are evaluated and logged but never block — set ENTITLEMENTS_ENFORCED=true to enforce.'}
            </p>
            <div className="admin-stat-row">
              {Object.entries(plans.planCounts).map(([code, count]) => (
                <div className="admin-stat" key={code}><strong>{count}</strong><span>{PLAN_LABEL[code] || code}</span></div>
              ))}
            </div>
            {plans.recruiters.length === 0 ? <p className="muted">No recruiters yet.</p> : <table className="admin-table">
              <thead><tr><th>Recruiter</th><th>Plan</th><th>Status</th><th>Active jobs</th><th>Credits</th><th>Next free job</th><th>Access until</th></tr></thead>
              <tbody>{plans.recruiters.map((row) => <tr key={row.recruiter.id}>
                <td>{row.recruiter.name}<br /><small className="muted">{row.recruiter.email}</small></td>
                <td><span className="billing-status-pill">{PLAN_LABEL[row.planCode] || row.planCode}</span></td>
                <td>{row.effectiveStatus}</td>
                <td>{row.activeJobCount} / {row.activeJobLimit}</td>
                <td>{row.jobCreditBalance}</td>
                <td>{row.planCode === 'free' ? (row.freeJobAvailable ? 'Available now' : fmt(row.nextFreeJobAvailableAt)) : '—'}</td>
                <td>{fmt(row.currentPeriodEndsAt || row.trialEndsAt)}</td>
              </tr>)}</tbody>
            </table>}
            {plans.shadowBlocks.length > 0 && <>
              <h3 style={{ marginTop: 24 }}>Would have been blocked ({plans.shadowBlocks.length})</h3>
              <p className="muted">Publish/edit attempts the limits would have refused. Review before enabling enforcement.</p>
              <table className="admin-table">
                <thead><tr><th>When</th><th>Recruiter</th><th>Action</th><th>Reason</th></tr></thead>
                <tbody>{plans.shadowBlocks.map((event) => <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.userName}</td>
                  <td>{event.eventType === 'job_publish_blocked' ? 'Publish' : 'Edit'}</td>
                  <td>{String((event.metadata as Record<string, unknown>)?.code ?? '')}</td>
                </tr>)}</tbody>
              </table>
            </>}
          </>}
        </section>}

        {section === 'credits' && <section className="admin-section">
          <h3>Job-post credits</h3>
          <p className="muted">Immutable ledger — the balance is always derived from it, never stored as a counter.</p>
          <div className="admin-actions" style={{ marginBottom: 16 }}>
            <input className="admin-reason-input" placeholder="Recruiter user id" value={grantTarget} onChange={(event) => setGrantTarget(event.target.value)} />
            <input className="admin-reason-input" placeholder="Reason (required)" value={reasonFor('grant')} onChange={(event) => setReason('grant', event.target.value)} />
            <button type="button" className="primary-button small" disabled={busyId === 'grant' || !grantTarget.trim() || reasonFor('grant').trim().length < 3}
              onClick={() => run('grant', async () => { await api.adminGrantJobCredit(grantTarget.trim(), reasonFor('grant').trim()); setGrantTarget(''); setReason('grant', ''); })}>
              {busyId === 'grant' ? <Loader2 size={13} className="spin" /> : 'Grant credit'}
            </button>
          </div>
          {!plans ? <Loader2 className="spin" size={18} /> : plans.creditLedger.length === 0 ? <p className="muted">No credits granted yet.</p> : <table className="admin-table">
            <thead><tr><th>Recruiter</th><th>Source</th><th>Status</th><th>Granted</th><th>Used on</th><th></th></tr></thead>
            <tbody>{plans.creditLedger.map((credit) => <tr key={credit.id}>
              <td>{credit.recruiterName}</td>
              <td>{credit.sourceType.replace(/_/g, ' ')}</td>
              <td><span className={`billing-status-pill status-${credit.status}`}>{credit.status}</span></td>
              <td>{fmt(credit.grantedAt)}</td>
              <td>{credit.consumedByJobId || '—'}</td>
              <td className="admin-actions">
                {credit.status === 'available' && <>
                  <input className="admin-reason-input" placeholder="Revoke reason" value={reasonFor(credit.id)} onChange={(event) => setReason(credit.id, event.target.value)} />
                  <button type="button" className="secondary-button small" disabled={busyId === credit.id || reasonFor(credit.id).trim().length < 3}
                    onClick={() => run(credit.id, () => api.adminRevokeJobCredit(credit.id, reasonFor(credit.id).trim()))}>Revoke</button>
                </>}
              </td>
            </tr>)}</tbody>
          </table>}
        </section>}

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
