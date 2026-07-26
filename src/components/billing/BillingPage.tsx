import { useEffect, useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { api } from '../../api';
import { Field, TextInput } from '../profile/fields';
import type { Bootstrap, Payment, PaymentMethod } from '../../types';

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

  useEffect(() => { api.myPayments(viewer.id).then((res) => setPayments(res.payments)).catch(() => undefined); }, [viewer.id]);
  useEffect(() => { api.billingReferral(viewer.id).then(setReferralStats).catch(() => undefined); }, [viewer.id]);

  const startTrial = async () => {
    const billing = await api.startTrial(viewer.id);
    setData({ ...data, billing });
  };

  if (!data.billing) {
    return <div className="page"><div className="page-title"><div><span className="overline">Recruiter plan</span><h1>Billing</h1></div></div>
      <div className="billing-empty"><p>No subscription yet.</p><button className="primary-button" onClick={startTrial}>Start free 30-day trial</button></div>
    </div>;
  }

  const { subscription, effectiveStatus, credits, referralCode, instructions, vnpayEnabled, vnpayAmountVnd, stripeEnabled, paypalEnabled } = data.billing;
  const accessEndsAt = subscription.currentPeriodEndsAt || subscription.trialEndsAt;
  const referralLink = `${window.location.origin}/ref/${referralCode}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
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

  return <div className="page billing-page">
    <div className="page-title"><div><span className="overline">Recruiter plan</span><h1>Billing</h1><p>USD 20/month per seat — your first 30 days are free.</p></div></div>

    {paymentResult && <div className={`billing-result-banner billing-result-${paymentResult}`}>
      {paymentResult === 'success' ? 'Payment confirmed — thanks!' : 'The card payment did not go through. You can try again or use bank transfer / VietQR below.'}
      <button type="button" onClick={onDismissResult}>Dismiss</button>
    </div>}

    <section className={`billing-status-card status-${effectiveStatus}`}>
      <span className="billing-status-badge">{STATUS_LABEL[effectiveStatus] || effectiveStatus}</span>
      {accessEndsAt && <p>{effectiveStatus === 'trialing' ? 'Trial ends' : 'Access through'} {new Date(accessEndsAt).toLocaleDateString()} · {daysLeft(accessEndsAt)} days left</p>}
      {effectiveStatus === 'grace_period' && <p className="billing-grace-warning">You're in a 7-day grace period — you can still view existing jobs and messages, but can't publish new jobs or contact new candidates until you renew.</p>}
      {credits.length > 0 && <p className="billing-credit-note">{credits.length} referral credit{credits.length > 1 ? 's' : ''} available — applied automatically before you're asked to pay again.</p>}
    </section>

    <section className="billing-grid">
      <div className="billing-pay-card">
        {vnpayEnabled && <div className="billing-card-pay">
          <h3>Pay by card — {vnpayAmountVnd?.toLocaleString('vi-VN')} VND</h3>
          <p className="muted">Visa, Mastercard, JCB, or a linked wallet like Google Pay — via VNPay's secure page.</p>
          <button type="button" className="primary-button" onClick={() => payVia('vnpay')} disabled={cardRedirecting}>{cardRedirecting ? <Loader2 size={16} className="spin" /> : 'Pay by card (VNPay)'}</button>
        </div>}
        {stripeEnabled && <div className="billing-card-pay">
          <h3>Pay by card — USD 20</h3>
          <p className="muted">Visa, Mastercard, and more — via Stripe's secure checkout.</p>
          <button type="button" className="primary-button" onClick={() => payVia('stripe')} disabled={cardRedirecting}>{cardRedirecting ? <Loader2 size={16} className="spin" /> : 'Pay by card (Stripe)'}</button>
        </div>}
        {paypalEnabled && <div className="billing-card-pay">
          <h3>Pay with PayPal — USD 20</h3>
          <p className="muted">Pay via your PayPal balance or a linked card.</p>
          <button type="button" className="primary-button" onClick={() => payVia('paypal')} disabled={cardRedirecting}>{cardRedirecting ? <Loader2 size={16} className="spin" /> : 'Pay with PayPal'}</button>
        </div>}
        <h3>{vnpayEnabled || stripeEnabled || paypalEnabled ? 'Or pay by bank transfer — USD 20' : 'Submit a payment — USD 20'}</h3>
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
