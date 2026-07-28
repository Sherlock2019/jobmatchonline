import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeFor, monthlyRecurringRevenue, selectedPlanKey, selectPlan, SELECTABLE_PLANS } from './billing/charge.js';
import { ANNUAL_MONTHS_CHARGED, PLANS } from './billing/plans.js';

const db = (over = {}) => ({ users: [], subscriptions: [], teams: [], billingEvents: [], ...over });
const usRecruiter = { id: 'r1', role: 'employer', country: 'United States' };
const vnRecruiter = { id: 'r2', role: 'employer', country: 'Vietnam' };
const sub = (over = {}) => ({ id: 's1', recruiterUserId: 'r1', planCode: 'trial', ...over });

/* The bug this module exists to prevent: every payment used to be created at a
 * flat USD 20, which was correct with one plan and silently wrong the moment a
 * ladder existed — an Agency account billed 20 for 130-worth of product. */

test('the charge follows the selected plan, not a flat price', () => {
  for (const key of SELECTABLE_PLANS) {
    const charge = chargeFor(db(), usRecruiter, sub({ selectedPlanKey: key }));
    assert.equal(charge.amount, PLANS[key].prices.USD.monthly, `${key} must be billed its own price`);
    assert.equal(charge.planKey, key);
  }
});

test('an account that never chose a plan is billed the cheapest paid tier', () => {
  assert.equal(selectedPlanKey(undefined), 'solo');
  assert.equal(selectedPlanKey(sub({ planCode: 'free' })), 'solo', 'never silently bill more than the entry tier');
  assert.equal(chargeFor(db(), usRecruiter, sub()).amount, PLANS.solo.prices.USD.monthly);
});

test('a Vietnam account is billed the stored VND price, not a converted one', () => {
  const charge = chargeFor(db(), vnRecruiter, sub({ recruiterUserId: 'r2', selectedPlanKey: 'trio' }));
  assert.equal(charge.currency, 'VND');
  assert.equal(charge.amount, PLANS.trio.prices.VND.monthly);
  // Deliberately NOT the USD price times any rate.
  assert.notEqual(charge.amount, PLANS.trio.prices.USD.monthly);
});

test('annual bills ten months and covers twelve', () => {
  const charge = chargeFor(db(), usRecruiter, sub({ selectedPlanKey: 'duo', billingInterval: 'annual' }));
  assert.equal(charge.amount, PLANS.duo.prices.USD.monthly * ANNUAL_MONTHS_CHARGED);
  assert.equal(charge.monthsCovered, 12, 'ten months paid, twelve months of access');
});

test('a retired plan code is charged as the tier it maps to, never as nothing', () => {
  // Agency is gone from the catalogue. A stray row carrying it must still
  // produce a real charge rather than 0 or NaN.
  const charge = chargeFor(db(), usRecruiter, sub({ planCode: 'agency' }));
  assert.ok(charge.amount > 0);
  assert.equal(charge.planKey, 'solo');
});

test('the charge never quotes a plan that is not in the catalogue', () => {
  const charge = chargeFor(db(), usRecruiter, sub({ selectedPlanKey: 'agency' }));
  assert.ok(PLANS[charge.planKey], 'whatever it resolves to must be sellable');
  assert.equal(SELECTABLE_PLANS.includes(charge.planKey), true);
});

test('selecting a plan records the intent but grants nothing', () => {
  const d = db();
  const subscription = sub();
  const result = selectPlan(d, subscription, 'team', 'annual', 'r1');
  assert.equal(result.outcome, 'selected');
  assert.equal(subscription.selectedPlanKey, 'team');
  assert.equal(subscription.billingInterval, 'annual');
  // planCode is what entitlements read, and it has NOT moved.
  assert.equal(subscription.planCode, 'trial', 'choosing Team must not hand out Team before it is paid for');
  assert.equal(d.billingEvents.at(-1).eventType, 'plan_selected');
});

test('an unknown plan or interval is refused', () => {
  const d = db();
  assert.equal(selectPlan(d, sub(), 'enterprise', null, 'r1').outcome, 'invalid_plan');
  assert.equal(selectPlan(d, sub(), 'solo', 'weekly', 'r1').outcome, 'invalid_interval');
});

test('starter is not something you can select — it is the free tier', () => {
  assert.equal(SELECTABLE_PLANS.includes('starter'), false);
});

test('MRR sums each plan price rather than counting accounts at one flat rate', () => {
  const d = db({
    users: [usRecruiter, { id: 'r3', role: 'employer', country: 'Vietnam' }],
    subscriptions: [
      { id: 'a', recruiterUserId: 'r1', selectedPlanKey: 'team' },
      { id: 'b', recruiterUserId: 'r3', selectedPlanKey: 'solo' },
    ],
  });
  const mrr = monthlyRecurringRevenue(d, d.subscriptions);
  assert.equal(mrr, PLANS.team.prices.USD.monthly + PLANS.solo.prices.USD.monthly);
  assert.notEqual(mrr, 2 * PLANS.solo.prices.USD.monthly, 'the old count-times-flat-price answer');
});

test('MRR normalises every account to USD so currencies are never mixed', () => {
  const d = db({
    users: [vnRecruiter],
    subscriptions: [{ id: 'a', recruiterUserId: 'r2', selectedPlanKey: 'solo' }],
  });
  // A VN account contributes its USD-equivalent plan price, not 490,000.
  assert.equal(monthlyRecurringRevenue(d, d.subscriptions), PLANS.solo.prices.USD.monthly);
});
