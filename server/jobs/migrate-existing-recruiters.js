#!/usr/bin/env node
// One-time (but safe-to-rerun) migration: give every existing recruiter
// account a Subscription record if they don't already have one, so nobody
// is unexpectedly locked out the moment billing ships. Existing recruiters
// get the same fresh RECRUITER_TRIAL_DAYS trial a brand-new signup gets --
// a generous default since there's no record of what they've "already paid"
// for under the old, free-forever model. Run manually once after deploying
// the billing release: `node server/jobs/migrate-existing-recruiters.js`.
import { JsonStore } from '../store.js';
import { PgStore } from '../store-pg.js';
import { createSeed } from '../seed.js';
import { getOrCreateTrialSubscription } from '../billing/subscriptions.js';

const store = process.env.DATABASE_URL
  ? new PgStore(process.env.DATABASE_URL, createSeed)
  : new JsonStore(process.env.DB_PATH || 'data/db.json', createSeed);
await store.init();

const summary = await store.transaction((db) => {
  if (!Array.isArray(db.subscriptions)) db.subscriptions = [];
  let created = 0;
  const recruiters = db.users.filter((user) => user.role === 'employer' && !user.demo);
  for (const recruiter of recruiters) {
    const existing = db.subscriptions.find((sub) => sub.recruiterUserId === recruiter.id && sub.status !== 'cancelled');
    if (existing) continue;
    getOrCreateTrialSubscription(db, recruiter.id);
    created += 1;
  }
  return { totalRecruiters: recruiters.length, subscriptionsCreated: created };
});

console.log('migrate-existing-recruiters:', JSON.stringify(summary));
process.exit(0);
