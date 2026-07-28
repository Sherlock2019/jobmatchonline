/* Display copy for the recruiter plans.
 *
 * `server/billing/plans.js` is the ENFORCEMENT authority — nothing here is ever
 * trusted server-side. This file exists so the marketing page renders instantly
 * without an API round-trip for six static numbers. `plans.sync.test.js` fails
 * the build if the two ever disagree, so this is a mirror, not a second truth. */

export type PlanKey = 'starter' | 'solo' | 'duo' | 'trio' | 'team';

export type PlanCard = {
  key: PlanKey;
  display: string;
  seats: number;
  liveJobSlots: number;
  usd: number;
  vnd: number;
  /** Short line under the price — what you're actually buying at this step. */
  tagline: string;
  perks: string[];
};

export const PLAN_CARDS: PlanCard[] = [
  {
    key: 'starter', display: 'Starter', seats: 1, liveJobSlots: 1, usd: 0, vnd: 0,
    tagline: 'One job, live free forever.',
    perks: ['1 live job', '1 recruiter seat', 'Mutual-likes matching', 'Messaging and interview scheduling'],
  },
  {
    key: 'solo', display: 'Solo', seats: 1, liveJobSlots: 5, usd: 20, vnd: 490000,
    tagline: 'For one recruiter hiring steadily.',
    perks: ['5 live jobs', '1 recruiter seat', 'Unlimited matches', 'Message candidates first', 'Cancel anytime'],
  },
  {
    key: 'duo', display: 'Duo', seats: 2, liveJobSlots: 10, usd: 35, vnd: 850000,
    tagline: 'Two people, one pipeline.',
    perks: ['10 live jobs', '2 recruiter seats', 'Everything in Solo'],
  },
  {
    key: 'trio', display: 'Trio', seats: 3, liveJobSlots: 15, usd: 49, vnd: 1190000,
    tagline: 'A small hiring team with reporting.',
    perks: ['15 live jobs', '3 recruiter seats', 'Hiring analytics', 'Everything in Duo'],
  },
  {
    key: 'team', display: 'Team', seats: 5, liveJobSlots: 25, usd: 75, vnd: 1790000,
    tagline: 'In-house teams hiring across roles.',
    perks: ['25 live jobs', '5 recruiter seats', 'Hiring analytics', 'ATS export', 'Everything in Trio'],
  },
];

/* The ladder tops out at Team. Anyone needing more seats than that is a
 * conversation, not a self-serve checkout. */
export const HEADLINE_PLANS: PlanKey[] = ['starter', 'solo', 'duo', 'trio'];
export const MORE_SEAT_PLANS: PlanKey[] = ['team'];
export const POPULAR_PLAN: PlanKey = 'solo';

/** Annual bills 10 months — two free. */
export const ANNUAL_MONTHS_CHARGED = 10;

export const BOOST = { hours: 72, usd: 12, vnd: 300000 };

/** A posting runs this long and then pauses. Renewal is free and unlimited. */
export const POSTING_TERM_DAYS = 60;

/* Priced above Solo on purpose: USD 25 for one job against USD 20/month for
 * five makes the subscription the obvious choice. It sells the plan. */
export const SINGLE_POSTING = { termDays: 60, usd: 25, vnd: 590000 };

export const PAY_PER_HIRE = { feePercent: 5 };

/** One trial, one length, the same for everybody. */
export const TRIAL = { days: 90 };

export const planCard = (key: PlanKey) => PLAN_CARDS.find((plan) => plan.key === key)!;

export const usd = (amount: number) => (amount === 0 ? 'Free' : `USD ${amount}`);
export const vnd = (amount: number) => `${amount.toLocaleString('en-US')} ₫`;
