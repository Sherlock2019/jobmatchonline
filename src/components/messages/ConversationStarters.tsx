import { useState } from 'react';
import { Coffee, Sparkles } from 'lucide-react';
import { CANDIDATE_STARTER_CARDS, RECRUITER_STARTERS, RECRUITER_STARTERS_FALLBACK } from '../../content/conversationStarters';

/** Shown in an empty chat thread so a recruiter never faces a blank box after a match. */
export function RecruiterStarters({ candidateName, archetype, onPick }: { candidateName: string; archetype?: string; onPick: (text: string) => void }) {
  const set = (archetype && RECRUITER_STARTERS[archetype]) || RECRUITER_STARTERS_FALLBACK;
  const firstName = candidateName.trim().split(/\s+/)[0] || candidateName;
  const fill = (s: string) => s.replace('{name}', firstName);
  return <div className="starter-panel">
    <span className="starter-panel-label"><Sparkles size={13} /> Suggested openers</span>
    <div className="starter-chips">
      {set.openers.map((opener) => <button type="button" key={opener} onClick={() => onPick(fill(opener))}>{fill(opener)}</button>)}
      <button type="button" className="starter-chip-coffee" onClick={() => onPick(fill(set.coffee))}><Coffee size={13} /> {fill(set.coffee)}</button>
    </div>
  </div>;
}

/** Candidate-side starters, organized company -> team -> culture -> role -> growth -> comp -> environment -> hiring -> coffee. */
export function CandidateStarters({ onPick }: { onPick: (text: string) => void }) {
  const [active, setActive] = useState(CANDIDATE_STARTER_CARDS[0].id);
  const card = CANDIDATE_STARTER_CARDS.find((c) => c.id === active) || CANDIDATE_STARTER_CARDS[0];
  return <div className="starter-panel">
    <span className="starter-panel-label"><Sparkles size={13} /> Conversation starters</span>
    <div className="starter-tabs">
      {CANDIDATE_STARTER_CARDS.map((c) => <button type="button" key={c.id} className={c.id === active ? 'active' : ''} onClick={() => setActive(c.id)}>{c.emoji} {c.title}</button>)}
    </div>
    <div className="starter-chips">
      {card.questions.map((question) => <button type="button" key={question} onClick={() => onPick(question)}>{question}</button>)}
    </div>
  </div>;
}
