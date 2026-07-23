/**
 * Deterministic conversation-starter content for the empty-chat state after a match.
 * No LLM involved yet — recruiter starters are picked by the candidate's About Me
 * archetype (src/components/profile/CandidateWizard.tsx), candidate starters are
 * organized into themed cards. `{name}` is replaced with the candidate's first name.
 */

export type StarterSet = { openers: string[]; coffee: string };

// Keyed by Archetype.id from CandidateWizard.tsx. The 6 folded-away archetypes
// (Reliable Operator, Goal Achiever, Strategist, Change Maker, Explorer, Connector)
// share their nearest surviving neighbor's set.
export const RECRUITER_STARTERS: Record<string, StarterSet> = {
  'team-servant': {
    openers: [
      'Hi {name}, your team-first approach stood out to me. Can you tell me about a time you helped a colleague or team succeed without needing to take the credit?',
      'You describe yourself as someone who removes blockers for others. What kind of team environment helps you contribute at your best?',
      'Our team values collaboration and shared ownership. How do you normally support teammates when a project is under pressure?',
    ],
    coffee: 'You sound like someone who cares about the people behind the work. Would you be open to a relaxed coffee chat about how our team works together?',
  },
  doer: {
    openers: [
      'Hi {name}, your action-oriented style caught my attention. What is a recent idea you turned into a working result?',
      'This role needs someone who can move from discussion to execution quickly. How do you decide when you have enough information to start?',
      'Your focus on measurable outcomes matches this role well. Which professional goal are you most proud of achieving, and how did you track progress?',
    ],
    coffee: 'I like your hands-on, results-driven approach. Would you be open to a coffee chat about a challenge we need someone to take ownership of quickly?',
  },
  'problem-solver': {
    openers: [
      'Hi {name}, your profile suggests you enjoy complex challenges. What is the most difficult problem you have solved recently?',
      'When the first solution fails, how do you decide what to investigate next?',
      'This role involves diagnosing issues across several systems. How do you separate symptoms from the real root cause?',
    ],
    coffee: 'We have an interesting problem that could use your way of thinking. Would you be open to an informal coffee chat about it?',
  },
  builder: {
    openers: [
      'Hi {name}, you describe yourself as someone who builds things that last. What have you created that continued delivering value after you moved on?',
      'When building a new product or platform, how do you balance speed, quality, and long-term maintainability?',
      'This role involves creating a new capability from the ground up. Which part of zero-to-one work do you enjoy most?',
    ],
    coffee: 'We are building something new, and your profile feels highly relevant. Would you be open to a coffee chat about the vision and foundation?',
  },
  leader: {
    openers: [
      'Hi {name}, your leadership philosophy emphasizes clarity and trust. How do you create direction when a team is uncertain or divided?',
      'Tell me about a difficult decision you made as a leader and how you communicated it.',
      'How do you balance accountability with giving people enough autonomy to succeed?',
    ],
    coffee: 'Your leadership approach looks compatible with our team. Would you be open to an informal conversation about the people and challenges involved?',
  },
  mentor: {
    openers: [
      'Hi {name}, your interest in developing others stood out. Can you share an example of someone you helped grow professionally?',
      'How do you adjust your mentoring approach for people with different experience levels?',
      'This role includes coaching junior team members. What makes feedback useful rather than discouraging?',
    ],
    coffee: 'Our team values leaders who help others grow. Would you be open to a coffee conversation about our mentoring culture?',
  },
  innovator: {
    openers: [
      'Hi {name}, you describe yourself as someone who looks for better ways. What improvement or new idea have you introduced recently?',
      'How do you decide whether a new technology creates real value or is simply interesting?',
      'This role encourages experimentation. How do you run small tests while controlling risk?',
    ],
    coffee: 'We are exploring a few new ideas and your profile caught my attention. Would you be open to exchanging thoughts over coffee?',
  },
  'customer-champion': {
    openers: [
      'Hi {name}, your customer-first mindset matches this position well. How do you uncover what a customer truly needs when their initial request is unclear?',
      'Tell me about a time you had to balance customer expectations with technical or commercial constraints.',
      'What does building long-term customer trust look like in your work?',
    ],
    coffee: 'This role is highly customer-facing, and your approach feels relevant. Would you be open to a coffee chat about the customers we serve?',
  },
};

// Generic fallback for older profiles without an About Me archetype set.
export const RECRUITER_STARTERS_FALLBACK: StarterSet = {
  openers: [
    'Hi {name}, thanks for matching! What are you most looking for in your next role?',
    'What part of your background are you most excited to bring to a new team?',
    'What does your ideal role look like day to day?',
  ],
  coffee: 'Would you be open to a quick coffee chat to see if this could be a good mutual fit?',
};

export type StarterCard = { id: string; emoji: string; title: string; questions: string[] };

// Candidate-side starters: Company -> Team -> Culture -> Role -> Growth -> Compensation -> Environment -> Hiring -> Coffee.
export const CANDIDATE_STARTER_CARDS: StarterCard[] = [
  { id: 'company', emoji: '💙', title: 'I Love What Your Company Does', questions: [
    'What problem were you originally trying to solve when you built your core product?',
    'What makes your approach different from your competitors?',
    'Where do you see the company in the next two or three years?',
    'Which company value do employees actually experience every day, rather than just seeing on the website?',
  ] },
  { id: 'team', emoji: '👥', title: 'Tell Me About the Team', questions: [
    "Could you tell me more about the team I'd be joining?",
    'What makes someone successful within this team?',
    'What is your management style?',
    'How does the team normally collaborate?',
  ] },
  { id: 'culture', emoji: '🌱', title: 'Company Culture', questions: [
    'What does a typical day look like for someone in this role?',
    'Is decision-making generally fast, or does it involve several stakeholders?',
    'How does the company handle mistakes or failures?',
    'How flexible are working hours?',
  ] },
  { id: 'role', emoji: '💼', title: 'The Role', questions: [
    'What would be my biggest priorities during the first 90 days?',
    'What would success look like after six months?',
    'Which technical skills are absolutely essential, and which can be learned after joining?',
    'What surprised previous hires most about this role?',
  ] },
  { id: 'growth', emoji: '🚀', title: 'Career Growth', questions: [
    'How do people typically grow within the company?',
    'Could you share an example of someone who has grown their career here?',
    'Is there a formal mentoring program?',
  ] },
  { id: 'compensation', emoji: '💰', title: 'Compensation & Benefits', questions: [
    'Could you explain how the salary range for this role was determined?',
    'Is there a performance bonus, profit-sharing, or equity program?',
    'Which employee benefits are most appreciated by the team?',
  ] },
  { id: 'environment', emoji: '🏡', title: 'Working Environment', questions: [
    'How does the hybrid schedule work in practice?',
    'Which tools does the team use daily, and how modern is the current stack?',
    'Does the company provide home-office equipment or hardware?',
  ] },
  { id: 'hiring', emoji: '📋', title: 'Hiring Process', questions: [
    'Could you walk me through the remaining interview stages?',
    'Approximately how long does the hiring process usually take?',
    'When should I expect feedback after each interview?',
  ] },
  { id: 'coffee', emoji: '☕', title: 'Coffee Chat', questions: [
    "I'd love to learn more about your team and the projects you're working on. Would you be open to a quick coffee chat sometime this week?",
    'Your company culture sounds like a great fit for how I enjoy working. Would you be open to a short informal conversation before moving further in the process?',
  ] },
];
