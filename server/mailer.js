/**
 * Pluggable mailer. Sends via SMTP when SMTP_HOST/SMTP_USER are configured;
 * otherwise logs the message to the server console (dev mode) so flows are
 * testable without an email provider — same optional-integration pattern as
 * SSO and the Claude API.
 */
export function mailerConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailerConfigured()) {
    console.log(`[mailer:dev] → ${to}\n  subject: ${subject}\n  ${text}`);
    return { delivered: false, dev: true };
  }
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
  return { delivered: true };
}
