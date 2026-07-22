import type { Person } from '../../types';
import { CandidateCards } from './CandidateCards';

/**
 * The candidate's own profile — rendered as the same 5-card Tinder deck that
 * recruiters see, but fully unlocked (own contacts/name) and editable per card.
 */
export function CandidateProfilePage({ viewer, onEdit }: { viewer: Person; onEdit: (step: number) => void }) {
  return <div className="page profile-page">
    <div className="profile-topline">
      <div><span className="overline">Your candidate profile</span><h1>This is how recruiters see you</h1><p>Swipe through your five cards. Tap the pencil on any card to edit that section.</p></div>
      <div className="pf-completeness">
        <div className="ring" style={{ '--progress': `${viewer.completeness ?? 0}%` } as React.CSSProperties}><strong>{viewer.completeness ?? 0}%</strong></div>
        <small>Profile complete</small>
      </div>
    </div>
    <CandidateCards person={viewer} onEdit={onEdit} unlocked />
  </div>;
}
