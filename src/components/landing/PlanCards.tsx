import { Check } from 'lucide-react';
import { POPULAR_PLAN, usd, vnd, type PlanCard } from '../../lib/plans';

/** One recruiter tier on the pricing page. Every CTA registers rather than
 *  charging: the trial starts first and the plan is chosen at the end of it,
 *  so no card is ever asked for on this page. */
export function PlanCardView({ plan, onRegister }: { plan: PlanCard; onRegister: () => void }) {
  const free = plan.usd === 0;
  const popular = plan.key === POPULAR_PLAN;
  return <article className={`plan-card${popular ? ' popular' : ''}`}>
    {popular && <span className="plan-badge">Most popular</span>}
    <span className="plan-name">{plan.display}</span>
    <p className="plan-price">{usd(plan.usd)}{!free && <small> / month</small>}</p>
    <p className="plan-vnd">{free ? 'Free forever' : `${vnd(plan.vnd)} / month`}</p>
    <p className="plan-tagline">{plan.tagline}</p>
    <ul className="plan-perks">
      {plan.perks.map((perk) => <li key={perk}><Check size={14} /> {perk}</li>)}
    </ul>
    <button type="button" className={popular ? 'primary-button' : 'secondary-button'} onClick={onRegister}>
      {free ? 'Start free' : 'Start free trial'}
    </button>
  </article>;
}
