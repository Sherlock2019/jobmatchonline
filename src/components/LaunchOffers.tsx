import { ArrowRight, BadgeCheck, Gift, Rocket, Sparkles } from 'lucide-react';

/* Launch-day offers, defined once and reused on the landing page, the
 * recruiter Subscription page, and the candidate dashboard — so a change to
 * the offer can never drift between the three places a user might read it.
 *
 * Every claim here must match what the entitlement service actually grants
 * (server/billing/entitlements.js). No countdowns and no invented scarcity —
 * every offer below is simply true for everyone, all the time. */

export type LaunchOffer = { icon: typeof Rocket; badge: string; title: string; body: string };

export const RECRUITER_OFFERS: LaunchOffer[] = [
  { icon: Rocket, badge: 'Free trial', title: '60 days free', body: 'Run up to 3 live roles, match with candidates and message them for a full 60 days — long enough to see whether it works for you.' },
  // Says "stays live", not "is kept". A stored job is worth nothing to a
  // candidate who can't see it, so this promises visibility, not storage.
  { icon: BadgeCheck, badge: 'After the trial', title: 'One job stays live free forever', body: 'When the trial ends one of your jobs stays visible to candidates at no cost. The rest pause — nothing is ever closed or deleted.' },
  { icon: Gift, badge: 'Referrals', title: 'Invite, earn free months', body: 'Every recruiter you refer earns you a free month once they complete their first paid month.' },
];

export const CANDIDATE_OFFERS: LaunchOffer[] = [
  { icon: BadgeCheck, badge: 'Always free', title: 'Free forever, genuinely', body: 'Profile, resume, matching, messaging, and interview scheduling. No paid tier, no limits waiting to appear.' },
  { icon: Sparkles, badge: 'Mutual only', title: 'You choose who reaches you', body: 'A conversation opens only when you and the company both say yes. No cold outreach, no salary guessing.' },
];

export function LaunchOffers({ offers = RECRUITER_OFFERS, onRegister, compact }: {
  offers?: LaunchOffer[];
  onRegister?: () => void;
  compact?: boolean;
}) {
  return <section className={compact ? 'launch-offers compact' : 'launch-offers'} aria-label="Launch day offers">
    <header className="launch-offers-head">
      <span className="launch-badge"><Rocket size={14} /> Launching day offers</span>
      <h3>Everything below is live right now.</h3>
    </header>
    <div className="launch-offer-grid">
      {offers.map((offer) => <article className="launch-offer" key={offer.title}>
        <div className="launch-offer-icon"><offer.icon size={20} /></div>
        <span className="launch-offer-badge">{offer.badge}</span>
        <strong>{offer.title}</strong>
        <p>{offer.body}</p>
      </article>)}
    </div>
    {onRegister && <button type="button" className="primary-button launch-offers-cta" onClick={onRegister}>Claim these offers <ArrowRight size={17} /></button>}
  </section>;
}
