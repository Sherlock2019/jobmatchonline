import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Mail } from 'lucide-react';
import { api } from '../../api';
import { Field, TextInput } from '../profile/fields';
import { isAndroidNative, isIosNative, purchaseAppleSubscription, purchaseGooglePlaySubscription } from '../../lib/nativeBilling';
import { LaunchOffers } from '../LaunchOffers';
import { TRIAL } from '../../lib/plans';
import type { Bootstrap, Payment, PaymentMethod, TeamInfo } from '../../types';

function money(amount: number, currency: string) {
  if (amount === 0) return 'Free';
  return currency === 'VND' ? `${amount.toLocaleString('en-US')} ₫` : `USD ${amount}`;
}

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Free trial', active: 'Active', grace_period: 'Grace period', past_due: 'Past due',
  expired: 'Expired', suspended: 'Suspended', cancelled: 'Cancelled',
};

function daysLeft(ts: number | null) {
  if (!ts) return null;
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000));
}

export function BillingPage({ data, setData, paymentResult, onDismissResult }: { data: Bootstrap; setData: (d: Bootstrap) => void; paymentResult?: 'success' | 'failed' | null; onDismissResult?: () => void }) {
  const viewer = data.viewer;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [payerName, setPayerName] = useState('');
  const [bankName, setBankName] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [proofPaymentId, setProofPaymentId] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<{ successfulReferrals: number; pendingReferrals: number } | null>(null);
  const [cardRedirecting, setCardRedirecting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  // Set only after an invite, so the seat list updates without a full reload.
  const [teamOverride, setTeamOverride] = useState<TeamInfo | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState('');

  useEffect(() => { api.myPayments(viewer.id).then((res) => setPayments(res.payments)).catch(() => undefined); }, [viewer.id]);
  useEffect(() => { api.billingReferral(viewer.id).then(setReferralStats).catch(() => undefined); }, [viewer.id]);

  const startTrial = async () => {
    const billing = await api.startTrial(viewer.id);
    setData({ ...data, billing });
  };

  if (!data.billing) {
    return <div className="page"><div className="page-title"><div><span className="overline">Recruiter plan</span><h1>Subscription</h1></div></div>
      <div className="billing-empty"><p>No subscription yet.</p><button className="primary-button" onClick={startTrial}>Start your free {TRIAL.days}-day trial</button></div>
    </div>;
  }

  const { subscription, effectiveStatus, credits, referralCode, instructions, vnpayEnabled, vnpayAmountVnd, stripeEnabled, paypalEnabled, googlePlayEnabled, googlePlayProductId, appleEnabled, appleProductId, plan, charge, selectablePlans, trial } = data.billing;
  const team = teamOverride ?? data.billing.team;
  const accessEndsAt = subscription.currentPeriodEndsAt || subscription.trialEndsAt;
  const referralLink = `${window.location.origin}/ref/${referralCode}`;
  // Every payment button reads from the same server-computed charge, so no two
  // of them can ever quote different amounts for the same subscription.
  const chargeLabel = charge ? money(charge.amount, charge.currency) : 'USD 20';
  const vndCharge = charge?.currency === 'VND' ? charge.amount.toLocaleString('en-US') : null;

  const choosePlan = async (planKey: string, interval?: 'monthly' | 'annual') => {
    setPlanSaving(true); setPlanError('');
    try { setData({ ...data, billing: await api.billingSelectPlan(viewer.id, planKey, interval) }); }
    catch (e) { setPlanError(e instanceof Error ? e.message : 'Could not change plan'); }
    finally { setPlanSaving(false); }
  };

  const invite = async () => {
    setInviting(true); setInviteError('');
    try { setTeamOverride(await api.billingInviteTeamMember(viewer.id, inviteEmail.trim())); setInviteEmail(''); }
    catch (e) { setInviteError(e instanceof Error ? e.message : 'Could not add that teammate'); }
    finally { setInviting(false); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const inviteViaEmail = () => {
    const subject = 'Thought you might like JobsMatchNow';
    const body = `Hi,\n\nI've been using JobsMatchNow to hire faster — thought you might want to try it too.\n\nSign up here and we're both connected as referrals:\n${referralLink}\n\nCheers`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const submit = async () => {
    setSubmitting(true); setError('');
    try {
      const payment = await api.submitPayment({ userId: viewer.id, paymentMethod: method, payerName: payerName || undefined, bankName: bankName || undefined, transferDate: transferDate || undefined });
      setPayments((prev) => [payment, ...prev]);
      setProofPaymentId(payment.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit payment'); }
    finally { setSubmitting(false); }
  };

  const uploadProof = async (file: File) => {
    if (!proofPaymentId) return;
    try {
      const updated = await api.uploadPaymentProof(proofPaymentId, file);
      setPayments((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
  };

  // Redirects to the provider's own hosted page — card numbers are entered
  // there, never on our site. Confirmation happens server-side via each
  // provider's webhook (or VNPay's IPN), never from this redirect alone.
  const payVia = async (provider: 'vnpay' | 'stripe' | 'paypal') => {
    setCardRedirecting(true); setError('');
    try {
      const { redirectUrl } = provider === 'vnpay' ? await api.startVnpayPayment(viewer.id)
        : provider === 'stripe' ? await api.startStripeCheckout(viewer.id)
        : await api.startPaypalSubscription(viewer.id);
      if (!redirectUrl) throw new Error('Could not start checkout');
      window.location.href = redirectUrl;
    } catch (e) { setError(e instanceof Error ? e.message : 'Card payment is not available yet'); setCardRedirecting(false); }
  };

  // Native purchase (Google Play / Apple In-App Purchase): the store's own
  // purchase sheet handles the card, we only ever send the resulting
  // token/transaction id to our server for verification afterward — see
  // src/lib/nativeBilling.ts and server/billing/providers/{googleplay,applestore}.js.
  const purchaseNative = async (platform: 'google_play' | 'apple_iap') => {
    setCardRedirecting(true); setError('');
    try {
      if (platform === 'google_play') {
        if (!googlePlayProductId) throw new Error('Google Play billing is not configured yet');
        const purchaseToken = await purchaseGooglePlaySubscription(googlePlayProductId);
        const result = await api.verifyGooglePlayPurchase(viewer.id, purchaseToken);
        setPayments((prev) => [result.payment, ...prev]);
      } else {
        if (!appleProductId) throw new Error('App Store billing is not configured yet');
        const transactionId = await purchaseAppleSubscription(appleProductId);
        const result = await api.verifyApplePurchase(viewer.id, transactionId);
        setPayments((prev) => [result.payment, ...prev]);
      }
      const billing = await api.billingSubscription(viewer.id);
      setData({ ...data, billing });
    } catch (e) { setError(e instanceof Error ? e.message : 'Purchase could not be completed'); }
    finally { setCardRedirecting(false); }
  };

  return <div className="page billing-page">
    <div className="page-title"><div><span className="overline">Recruiter plan</span><h1>Subscription</h1>
      <p>{charge ? `${charge.planDisplay} — ${money(charge.amount, charge.currency)} / ${charge.interval === 'annual' ? 'year' : 'month'}` : 'Choose a plan below.'}
        {trial?.days ? ` · your first ${trial.days} days are free.` : ''}</p></div></div>

    {paymentResult && <div className={`billing-result-banner billing-result-${paymentResult}`}>
      {paymentResult === 'success' ? 'Payment confirmed — thanks!' : 'The card payment did not go through. You can try again or use bank transfer / VietQR below.'}
      <button type="button" onClick={onDismissResult}>Dismiss</button>
    </div>}

    <LaunchOffers compact />

    <section className={`billing-status-card status-${effectiveStatus}`}>
      <span className="billing-status-badge">{STATUS_LABEL[effectiveStatus] || effectiveStatus}</span>
      {accessEndsAt && <p>{effectiveStatus === 'trialing' ? 'Trial ends' : 'Access through'} {new Date(accessEndsAt).toLocaleDateString()} · {daysLeft(accessEndsAt)} days left</p>}
      {effectiveStatus === 'grace_period' && <p className="billing-grace-warning">You're in a 7-day grace period — you can still view existing jobs and messages, but can't publish new jobs or contact new candidates until you renew.</p>}
      {credits.length > 0 && <p className="billing-credit-note">{credits.length} referral credit{credits.length > 1 ? 's' : ''} available — applied automatically before you're asked to pay again.</p>}
    </section>

    {selectablePlans && selectablePlans.length > 0 && <section className="billing-plan-picker">
      <h3>Choose your plan</h3>
      <p className="muted">
        Every plan costs less per seat than the one below it. Picking one here only sets what you'll be charged —
        nothing changes on your account until a payment goes through.
      </p>
      <div className="billing-plan-options">
        {selectablePlans.map((option) => {
          const chosen = charge?.planKey === option.key;
          return <button
            key={option.key}
            type="button"
            className={`billing-plan-option${chosen ? ' chosen' : ''}`}
            disabled={planSaving}
            onClick={() => choosePlan(option.key)}
          >
            <span className="plan-name">{option.display}</span>
            <strong>{option.monthly === null ? '—' : money(option.monthly, charge?.currency || 'USD')}<small> / mo</small></strong>
            <em>{option.seats} seat{option.seats > 1 ? 's' : ''} · {option.liveJobSlots} live jobs</em>
            {chosen && <span className="billing-plan-chosen">Selected</span>}
          </button>;
        })}
      </div>
      {charge && <div className="billing-interval-row">
        <button type="button" className={charge.interval === 'monthly' ? 'active' : ''} disabled={planSaving}
          onClick={() => choosePlan(charge.planKey, 'monthly')}>Monthly</button>
        <button type="button" className={charge.interval === 'annual' ? 'active' : ''} disabled={planSaving}
          onClick={() => choosePlan(charge.planKey, 'annual')}>Annual — two months free</button>
      </div>}
      {planError && <p className="billing-seat-error">{planError}</p>}
    </section>}

    {plan && <section className="billing-plan-card">
      <div className="billing-plan-headline">
        <div>
          <span className="pricing-kicker">Your plan</span>
          <h3>{plan.display}</h3>
          <p className="muted">{plan.monthly ? `${money(plan.monthly, plan.currency)} / month` : 'Free'}
            {plan.annual ? ` · ${money(plan.annual, plan.currency)} / year (two months free)` : ''}</p>
        </div>
        <ul className="billing-plan-facts">
          <li><b>{plan.liveJobSlots}</b> live jobs</li>
          <li><b>{team ? team.seatsAllowed : plan.seats}</b> recruiter seat{(team ? team.seatsAllowed : plan.seats) > 1 ? 's' : ''}</li>
          {plan.analytics && <li>Hiring analytics</li>}
          {plan.atsExport && <li>ATS export</li>}
        </ul>
      </div>

      {team && <div className="billing-seats">
        <h4>Seats — {team.seatsUsed} of {team.seatsAllowed} in use</h4>
        <ul className="billing-seat-list">
          {team.members.map((member) => <li key={member.userId}>
            <span>{member.name}</span>
            <small className={member.status === 'active' ? 'seat-active' : 'seat-readonly'}>
              {member.role === 'owner' ? 'Owner' : member.status === 'active' ? 'Active' : 'Read-only'}
            </small>
          </li>)}
        </ul>
        {team.isOwner && <>
          <div className="billing-seat-invite">
            <TextInput type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" />
            <button type="button" className="secondary-button" disabled={inviting || !inviteEmail.trim()} onClick={invite}>
              {inviting ? <Loader2 size={15} className="spin" /> : 'Add teammate'}
            </button>
          </div>
          {inviteError && <p className="billing-seat-error">{inviteError}</p>}
          <p className="muted">
            They need a recruiter account first. Over the seat limit they still join — read-only — so nobody is ever locked out;
            they get their seat back the moment you add one.
            {team.canBuyExtraSeats && team.extraSeatPrice !== null && ` Extra seats are ${money(team.extraSeatPrice, plan.currency)} / month each.`}
          </p>
        </>}
      </div>}
    </section>}

    <section className="billing-grid">
      <div className="billing-pay-card">
        {vnpayEnabled && <div className="billing-card-pay">
          {/* VNPay settles in VND only, so this rail always shows the plan's
              stored VND price rather than a converted USD figure. */}
          <h3>Pay by card — {vndCharge ?? vnpayAmountVnd?.toLocaleString('en-US')} ₫</h3>
          <p className="muted">Visa, Mastercard, JCB, or a linked wallet like Google Pay — via VNPay's secure page.</p>
          <button type="button" className="primary-button" onClick={() => payVia('vnpay')} disabled={cardRedirecting}>{cardRedirecting ? <Loader2 size={16} className="spin" /> : 'Pay by card (VNPay)'}</button>
        </div>}
        {stripeEnabled && <div className="billing-card-pay">
          <h3>Pay by card — {chargeLabel}</h3>
          <p className="muted">Visa, Mastercard, and more — via Stripe's secure checkout.</p>
          <button type="button" className="primary-button" onClick={() => payVia('stripe')} disabled={cardRedirecting}>{cardRedirecting ? <Loader2 size={16} className="spin" /> : 'Pay by card (Stripe)'}</button>
        </div>}
        {paypalEnabled && <div className="billing-card-pay">
          <h3>Pay with PayPal — {chargeLabel}</h3>
          <p className="muted">Pay via your PayPal balance or a linked card.</p>
          <button type="button" className="primary-button" onClick={() => payVia('paypal')} disabled={cardRedirecting}>{cardRedirecting ? <Loader2 size={16} className="spin" /> : 'Pay with PayPal'}</button>
        </div>}
        {googlePlayEnabled && isAndroidNative() && <div className="billing-card-pay">
          <h3>Subscribe via Google Play</h3>
          <p className="muted">Billed through your Google Play account.</p>
          <button type="button" className="primary-button" onClick={() => purchaseNative('google_play')} disabled={cardRedirecting}>{cardRedirecting ? <Loader2 size={16} className="spin" /> : 'Subscribe via Google Play'}</button>
        </div>}
        {appleEnabled && isIosNative() && <div className="billing-card-pay">
          <h3>Subscribe via App Store</h3>
          <p className="muted">Billed through your Apple account.</p>
          <button type="button" className="primary-button" onClick={() => purchaseNative('apple_iap')} disabled={cardRedirecting}>{cardRedirecting ? <Loader2 size={16} className="spin" /> : 'Subscribe via App Store'}</button>
        </div>}
        <h3>{vnpayEnabled || stripeEnabled || paypalEnabled ? `Or pay by bank transfer — ${chargeLabel}` : `Submit a payment — ${chargeLabel}`}</h3>
        <Field label="Payment method">
          <select className="wz-input wz-select" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            <option value="vietqr">VietQR</option>
            <option value="bank_transfer">Vietnam bank transfer</option>
            <option value="international_bank_transfer">International bank transfer</option>
          </select>
        </Field>
        {instructions && <div className="billing-instructions">
          {method === 'vietqr' && instructions.vietQrImageUrl && <img src={instructions.vietQrImageUrl} alt="VietQR code" />}
          {instructions.bankAccountName && <p><b>Account name:</b> {instructions.bankAccountName}</p>}
          {instructions.bankName && <p><b>Bank:</b> {instructions.bankName}</p>}
          {instructions.bankAccountNumber && <p><b>Account number:</b> {instructions.bankAccountNumber}</p>}
          {method === 'international_bank_transfer' && instructions.bankSwift && <p><b>SWIFT:</b> {instructions.bankSwift}</p>}
          {instructions.supportEmail && <p><b>Questions:</b> {instructions.supportEmail}</p>}
        </div>}
        <Field label="Payer name (optional)"><TextInput value={payerName} onChange={(event) => setPayerName(event.target.value)} /></Field>
        <Field label="Sending bank (optional)"><TextInput value={bankName} onChange={(event) => setBankName(event.target.value)} /></Field>
        <Field label="Transfer date (optional)"><TextInput type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} /></Field>
        {error && <p className="auth-error">{error}</p>}
        <button type="button" className="primary-button" onClick={submit} disabled={submitting}>{submitting ? <Loader2 size={16} className="spin" /> : 'Submit payment'}</button>
        {proofPaymentId && <Field label="Upload payment proof (optional)"><input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => event.target.files?.[0] && uploadProof(event.target.files[0])} /></Field>}
      </div>

      <div className="billing-referral-card">
        <div className="billing-referral-banner">
          <h2>Win 1 Free Month Subscription</h2>
          <p>Invite a friend to join us and win 1 month subscription using this referral link.</p>
          <button type="button" className="primary-button billing-referral-cta" onClick={inviteViaEmail}><Mail size={18} /> Send Invitation Email</button>
        </div>
        <h3>Your referral link</h3>
        <p>Earn one free month every time a recruiter you refer completes their first paid month.</p>
        <div className="billing-referral-link"><input readOnly value={referralLink} /><button type="button" onClick={copyLink}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button></div>
        {referralStats && <div className="billing-referral-stats"><span><b>{referralStats.successfulReferrals}</b> successful referrals</span><span><b>{referralStats.pendingReferrals}</b> pending</span></div>}
      </div>
    </section>

    <section className="billing-history">
      <h3>Payment history</h3>
      {payments.length === 0 ? <p className="muted">No payments yet.</p> : <table className="billing-history-table">
        <thead><tr><th>Invoice</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>{payments.map((payment) => <tr key={payment.id}>
          <td>{payment.invoiceNumber}</td><td>{payment.currency} {payment.amount}</td><td>{payment.paymentMethod.replace(/_/g, ' ')}</td>
          <td><span className={`billing-status-pill status-${payment.status}`}>{payment.status}</span></td>
          <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
        </tr>)}</tbody>
      </table>}
    </section>
  </div>;
}
