#!/usr/bin/env node
// Hits the internal daily-billing endpoint once. Invoked by an OS cron entry
// (see deploy/aws/00-cheap-mvp-ec2.sh) rather than an in-process scheduler,
// so it stays safe even if the app is ever scaled to multiple instances --
// only the crontab fires it, not each running process independently.
const API_URL = process.env.BILLING_CRON_URL || 'http://127.0.0.1:4174/api/internal/billing/run-daily';
const SECRET = process.env.BILLING_CRON_SECRET;

if (!SECRET) {
  console.error('BILLING_CRON_SECRET is not set -- refusing to run.');
  process.exit(1);
}

try {
  const response = await fetch(API_URL, { method: 'POST', headers: { 'X-Cron-Secret': SECRET } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`billing-daily failed: ${response.status}`, body);
    process.exit(1);
  }
  console.log('billing-daily summary:', JSON.stringify(body));
} catch (error) {
  console.error('billing-daily request failed:', error.message);
  process.exit(1);
}
