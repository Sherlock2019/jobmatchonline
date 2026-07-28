/* Plan catalogue: the single source of truth for what each tier grants and
 * what it costs. Entitlements are DATA here, never `if (plan === 'trio')`
 * branches scattered through the code — every consumer reads this table.
 *
 * `null` means unlimited and is written as null deliberately: -1 and 999999
 * both read as "a number" at a call site and get compared with < or >, which
 * silently turns unlimited into a very large cap. null forces the caller to
 * handle it. */

/** Unlimited. Exported so call sites can express intent rather than compare to null inline. */
export const UNLIMITED = null;
export const isUnlimited = (value) => value === UNLIMITED;

/**
 * Prices are canonical per (planKey, currency, interval) and are NOT derived
 * from each other. The VND figures are deliberate round numbers chosen for the
 * local market — computing them from USD at any FX rate produces different,
 * wrong values, so they are stored, not calculated.
 */
export const PLANS = {
  starter: {
    key: 'starter', display: 'Starter', order: 0,
    seats: 1, liveJobSlots: 1, monthlyMatchCap: 20,
    outboundMessaging: false, analytics: false, atsExport: false, priorityPlacement: false,
    prices: { USD: { monthly: 0 }, VND: { monthly: 0 } },
  },
  solo: {
    key: 'solo', display: 'Solo', order: 1,
    seats: 1, liveJobSlots: 5, monthlyMatchCap: UNLIMITED,
    outboundMessaging: true, analytics: false, atsExport: false, priorityPlacement: false,
    prices: { USD: { monthly: 20 }, VND: { monthly: 490000 } },
  },
  duo: {
    key: 'duo', display: 'Duo', order: 2,
    seats: 2, liveJobSlots: 10, monthlyMatchCap: UNLIMITED,
    outboundMessaging: true, analytics: false, atsExport: false, priorityPlacement: false,
    prices: { USD: { monthly: 35 }, VND: { monthly: 850000 } },
  },
  trio: {
    key: 'trio', display: 'Trio', order: 3,
    seats: 3, liveJobSlots: 15, monthlyMatchCap: UNLIMITED,
    outboundMessaging: true, analytics: true, atsExport: false, priorityPlacement: false,
    prices: { USD: { monthly: 49 }, VND: { monthly: 1190000 } },
  },
  team: {
    key: 'team', display: 'Team', order: 4,
    seats: 5, liveJobSlots: 25, monthlyMatchCap: UNLIMITED,
    outboundMessaging: true, analytics: true, atsExport: false, priorityPlacement: false,
    prices: { USD: { monthly: 75 }, VND: { monthly: 1790000 } },
  },
  agency: {
    key: 'agency', display: 'Agency', order: 5,
    seats: 10, liveJobSlots: 50, monthlyMatchCap: UNLIMITED,
    outboundMessaging: true, analytics: true, atsExport: true, priorityPlacement: true,
    prices: { USD: { monthly: 130 }, VND: { monthly: 3190000 } },
  },
  pay_per_hire: {
    key: 'pay_per_hire', display: 'Pay per hire', order: 6,
    seats: 1, liveJobSlots: 5, monthlyMatchCap: UNLIMITED,
    outboundMessaging: true, analytics: false, atsExport: false, priorityPlacement: false,
    // No recurring charge. Owes a success fee per mutually-confirmed hire.
    prices: { USD: { monthly: 0 }, VND: { monthly: 0 } },
    hireFeePercent: 5,
  },
};

/* Live subscription rows predate this catalogue and carry the older plan codes
 * `trial`/`free`/`founding`/`pro`. They are never rewritten — instead every
 * seat/slot lookup runs the code through here first, so existing accounts keep
 * working untouched and a migration script is never needed.
 *
 * Founding and Pro both map to Solo: that is the USD 20 single seat they were
 * sold. Trial maps to Solo too — a trial should feel like the plan most people
 * end up on, not like a bigger one they will later be dropped from. */
const LEGACY_PLAN_CODES = { trial: 'solo', free: 'starter', founding: 'solo', pro: 'solo' };

/** Catalogue key for any plan code, old or new. Unknown codes fall back to the free tier. */
export function seatPlanKey(planCode) {
  if (PLANS[planCode]) return planCode;
  return LEGACY_PLAN_CODES[planCode] || 'starter';
}

/** Agency-only add-on. Each unit grants +1 seat and +5 job slots. */
export const EXTRA_SEAT_ADDON = {
  key: 'extra_seat', display: 'Additional seat',
  availableOn: ['agency'],
  seats: 1, liveJobSlots: 5,
  prices: { USD: { monthly: 12 }, VND: { monthly: 290000 } },
};

/** Annual is 10x monthly — two months free. Derived, not stored per plan. */
export const ANNUAL_MONTHS_CHARGED = 10;
export const BILLING_INTERVALS = ['monthly', 'annual'];

export function planPrice(planKey, currency = 'USD', interval = 'monthly') {
  const plan = PLANS[planKey];
  if (!plan) return null;
  const monthly = plan.prices[currency]?.monthly;
  if (monthly === undefined) return null;
  return interval === 'annual' ? monthly * ANNUAL_MONTHS_CHARGED : monthly;
}

export function addonPrice(currency = 'USD', interval = 'monthly') {
  const monthly = EXTRA_SEAT_ADDON.prices[currency]?.monthly;
  if (monthly === undefined) return null;
  return interval === 'annual' ? monthly * ANNUAL_MONTHS_CHARGED : monthly;
}

/** VN accounts are billed in VND; everyone else in USD. Never inferred client-side. */
export function currencyForCountry(country) {
  return String(country || '').trim().toLowerCase() === 'vietnam' ? 'VND' : 'USD';
}

/** Paid, recurring tiers in ascending seat order — the ladder the invariant guards. */
export const SEAT_LADDER = ['solo', 'duo', 'trio', 'team', 'agency'];

/** Total monthly cost of a plan plus N add-on seats (add-on only valid on agency). */
export function bundleCost(planKey, extraSeats = 0, currency = 'USD') {
  const base = planPrice(planKey, currency, 'monthly');
  if (base === null) return null;
  return base + extraSeats * (EXTRA_SEAT_ADDON.prices[currency]?.monthly ?? 0);
}

export function bundleSeats(planKey, extraSeats = 0) {
  const plan = PLANS[planKey];
  if (!plan) return null;
  return plan.seats + extraSeats * EXTRA_SEAT_ADDON.seats;
}

/**
 * Cheapest total cost to assemble at least `targetSeats` by stacking any
 * combination of paid tiers (no add-ons — add-ons are agency-only, and the
 * point of this is to prove a bundle is never beaten by buying smaller plans).
 * Exhaustive over the ladder via dynamic programming, so it cannot miss a
 * combination the way hand-picked comparisons do.
 */
export function cheapestStackCost(targetSeats, currency = 'USD') {
  if (targetSeats <= 0) return 0;
  const best = new Array(targetSeats + 1).fill(Infinity);
  best[0] = 0;
  for (let seats = 1; seats <= targetSeats; seats += 1) {
    for (const key of SEAT_LADDER) {
      const plan = PLANS[key];
      const price = planPrice(key, currency, 'monthly');
      const from = Math.max(0, seats - plan.seats);
      if (best[from] + price < best[seats]) best[seats] = best[from] + price;
    }
  }
  return best[targetSeats];
}
