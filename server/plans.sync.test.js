import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EXTRA_SEAT_ADDON, ANNUAL_MONTHS_CHARGED, PAY_PER_HIRE_FEE_PERCENT, PLANS, SINGLE_POSTING } from './billing/plans.js';
import { BOOST_HOURS, BOOST_PRICE_USD, BOOST_PRICE_VND } from './billing/boosts.js';
import { POSTING_TERM_DAYS } from './billing/postings.js';
import { FOUNDING_TRIAL_DAYS, PUBLIC_TRIAL_DAYS } from './billing/trial.js';

/* The pricing page renders from src/lib/plans.ts so it doesn't need an API call
 * for six static numbers. That copy can silently drift from the plans the
 * server actually enforces — advertising one price and charging another. These
 * tests read the display file as text and fail the build the moment it does. */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/lib/plans.ts'), 'utf8');

/** Pull one plan's literal out of PLAN_CARDS by its key. */
function displayCard(key) {
  const start = source.indexOf(`key: '${key}'`);
  assert.notEqual(start, -1, `src/lib/plans.ts is missing the ${key} card`);
  const body = source.slice(start, source.indexOf('},', start));
  const num = (field) => {
    const match = body.match(new RegExp(`${field}: (\\d+)`));
    assert.ok(match, `${key} card is missing ${field}`);
    return Number(match[1]);
  };
  return { seats: num('seats'), liveJobSlots: num('liveJobSlots'), usd: num('usd'), vnd: num('vnd') };
}

for (const key of ['starter', 'solo', 'duo', 'trio', 'team', 'agency']) {
  test(`pricing page shows the same ${key} plan the server enforces`, () => {
    const shown = displayCard(key);
    const real = PLANS[key];
    assert.equal(shown.seats, real.seats);
    assert.equal(shown.liveJobSlots, real.liveJobSlots);
    assert.equal(shown.usd, real.prices.USD.monthly);
    assert.equal(shown.vnd, real.prices.VND.monthly);
  });
}

test('pricing page shows the same extra-seat add-on the server sells', () => {
  const body = source.slice(source.indexOf('export const EXTRA_SEAT ='));
  const num = (field) => Number(body.match(new RegExp(`${field}: (\\d+)`))[1]);
  assert.equal(num('seats'), EXTRA_SEAT_ADDON.seats);
  assert.equal(num('liveJobSlots'), EXTRA_SEAT_ADDON.liveJobSlots);
  assert.equal(num('usd'), EXTRA_SEAT_ADDON.prices.USD.monthly);
  assert.equal(num('vnd'), EXTRA_SEAT_ADDON.prices.VND.monthly);
});

test('pricing page shows the same boost and annual terms the server uses', () => {
  const boost = source.slice(source.indexOf('export const BOOST ='));
  const num = (field) => Number(boost.match(new RegExp(`${field}: (\\d+)`))[1]);
  assert.equal(num('hours'), BOOST_HOURS);
  assert.equal(num('usd'), BOOST_PRICE_USD);
  assert.equal(num('vnd'), BOOST_PRICE_VND);
  assert.equal(Number(source.match(/ANNUAL_MONTHS_CHARGED = (\d+)/)[1]), ANNUAL_MONTHS_CHARGED);
});

test('pricing page shows the same one-off posting the server sells', () => {
  const block = source.slice(source.indexOf('export const SINGLE_POSTING ='));
  const num = (field) => Number(block.match(new RegExp(`${field}: (\\d+)`))[1]);
  assert.equal(num('termDays'), SINGLE_POSTING.termDays);
  assert.equal(num('usd'), SINGLE_POSTING.prices.USD.once);
  assert.equal(num('vnd'), SINGLE_POSTING.prices.VND.once);
  // The one-off has to stay more expensive than a month of Solo, or it stops
  // selling the subscription and starts cannibalising it.
  assert.ok(SINGLE_POSTING.prices.USD.once > PLANS.solo.prices.USD.monthly);
  assert.ok(SINGLE_POSTING.prices.VND.once > PLANS.solo.prices.VND.monthly);
});

test('pricing page shows the same posting term, trial lengths and hire fee', () => {
  assert.equal(Number(source.match(/POSTING_TERM_DAYS = (\d+)/)[1]), POSTING_TERM_DAYS);
  const fee = source.slice(source.indexOf('export const PAY_PER_HIRE ='));
  assert.equal(Number(fee.match(/feePercent: (\d+)/)[1]), PAY_PER_HIRE_FEE_PERCENT);
  const trial = source.slice(source.indexOf('export const TRIAL ='));
  assert.equal(Number(trial.match(/foundingDays: (\d+)/)[1]), FOUNDING_TRIAL_DAYS);
  assert.equal(Number(trial.match(/publicDays: (\d+)/)[1]), PUBLIC_TRIAL_DAYS);
});
