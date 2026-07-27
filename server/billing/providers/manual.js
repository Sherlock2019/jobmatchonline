import crypto from 'node:crypto';

/* The only payment provider implemented in v1: manual VietQR/bank-transfer
 * confirmation reviewed by an admin. Deliberately thin and self-contained so
 * a future automated provider (e.g. Stripe) can implement the same shape
 * (methodIds + instructions()) without reworking the subscription/payment
 * model above it — see PLAN "Known limitations". */

export const MANUAL_METHOD_IDS = ['vietqr', 'bank_transfer', 'international_bank_transfer'];

export const BANK_INSTRUCTION_FIELDS = ['bankAccountName', 'bankName', 'bankAccountNumber', 'bankSwift', 'vietQrImageUrl', 'supportEmail'];

/** Bank/VietQR instructions shown on the billing page — admin-editable
 * (db.siteSettings.bankInstructions, set from the admin dashboard) with env
 * vars as a fallback default for whichever fields haven't been set there yet.
 * Never stores more of the recruiter's own banking info than the reference
 * fields they type in themselves. */
export function paymentInstructions(db) {
  const stored = db?.siteSettings?.bankInstructions || {};
  return {
    bankAccountName: stored.bankAccountName || process.env.BILLING_BANK_ACCOUNT_NAME || '',
    bankName: stored.bankName || process.env.BILLING_BANK_NAME || '',
    bankAccountNumber: stored.bankAccountNumber || process.env.BILLING_BANK_ACCOUNT_NUMBER || '',
    bankSwift: stored.bankSwift || process.env.BILLING_BANK_SWIFT || '',
    vietQrImageUrl: stored.vietQrImageUrl || process.env.BILLING_VIETQR_IMAGE_URL || '',
    supportEmail: stored.supportEmail || process.env.BILLING_SUPPORT_EMAIL || '',
  };
}

/** `INV-YYYYMM-XXXXXX`: human-readable, not sequential/guessable (the suffix
 * is random), collision-checked against existing payments before use. */
export function generateInvoiceNumber(db) {
  const now = new Date();
  const prefix = `INV-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}-`;
  let invoiceNumber;
  do {
    invoiceNumber = `${prefix}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  } while ((db.payments || []).some((payment) => payment.invoiceNumber === invoiceNumber));
  return invoiceNumber;
}

/** A short reference the recruiter is asked to put in their transfer memo, so
 * an admin can match an incoming bank transfer back to this payment record. */
export function generateTransferReference(db) {
  let reference;
  do {
    reference = `JMN${crypto.randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()}`;
  } while ((db.payments || []).some((payment) => payment.paymentReference === reference));
  return reference;
}
