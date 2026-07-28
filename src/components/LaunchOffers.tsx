import { ArrowRight, BadgeCheck, Gift, Rocket, Sparkles } from 'lucide-react';

/* Launch-day offers, defined once and reused on the landing page, the
 * recruiter Subscription page, and the candidate dashboard — so a change to
 * the offer can never drift between the three places a user might read it.
 *
 * Every claim here must match what the entitlement service actually grants
 * (server/billing/entitlements.js). No countdowns, no invented scarcity: the
 * founding seat number is passed in from the real server count, and is simply
 * omitted when it isn't known. */

export type LaunchOffer = { icon: typeof Rocket; badge: string; title: string; body: string };

export const RECRUITER_OFFERS: LaunchOffer[] = [
  { icon: Rocket, badge: 'Free trial', title: '3 months free', body: 'Post jobs, match with candidates, and message them for a full 3 months. No credit card required to start.' },
  { icon: BadgeCheck, badge: 'Keep your data', title: 'Nothing is deleted', body: 'When the trial ends your jobs, matches, and conversations all stay exactly where they are. Subscribe whenever you are ready.' },
  { icon: Gift, badge: 'Referrals', title: 'Invite, earn free months', body: 'Every recruiter you refer earns you a free month once they complete their first paid month.' },
];

export const CANDIDATE_OFFERS: LaunchOffer[] = [
  { icon: BadgeCheck, badge: 'Always free', title: 'Free forever, genuinely', body: 'Profile, resume, matching, messaging, and interview scheduling. No paid tier, no limits waiting to appear.' },
  { icon: Sparkles, badge: 'Mutual only', title: 'You choose who reaches you', body: 'A conversation opens only when you and the company both say yes. No cold outreach, no salary guessing.' },
];

/** Founding-seat line. Rendered only when the caller has the real count. */
function FoundingLine({ remaining }: { remaining?: number }) {
  if (remaining === undefined) return null;
  if (remaining <= 0) return <p className="launch-founding">Founding Recruiter seats are all taken — standard pricing now applies.</p>;
  return <p className="launch-founding"><b>{remaining.toLocaleString()}</b> of the first 1,000 Founding Recruiter seats left — lock USD 20/month for as long as you stay subscribed.</p>;
}

export function LaunchOffers({ offers = RECRUITER_OFFERS, foundingRemaining, onRegister, compact }: {
  offers?: LaunchOffer[];
  foundingRemaining?: number;
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
    <FoundingLine remaining={foundingRemaining} />
    {onRegister && <button type="button" className="primary-button launch-offers-cta" onClick={onRegister}>Claim these offers <ArrowRight size={17} /></button>}
  </section>;
}
