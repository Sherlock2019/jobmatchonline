/**
 * Landing/marketing copy, stored verbatim so the mobile and desktop layouts
 * render exactly the same message.
 */

export const pitch = {
  eyebrow: 'Mutual intent. Better hiring.',
  headline: 'Stop chasing jobs and candidates.',
  headlineAccent: 'Let the perfect match chase you.',
  subtext: 'Job seekers, let the perfect role find you. Hiring teams, let the right candidates come to you. A connection opens only when both sides choose.',
  geo: { kicker: 'Geolocation of Opportunities', text: 'Match nearby. Meet for a cup of coffee in your city.' },
  badges: ['Explainable fit', 'Private distance range', 'Salary up front'],
} as const;

export const howItWorksIntro = {
  kicker: 'The hiring upgrade',
  heading: 'Old hiring creates activity. JobsMatchNow creates alignment.',
  body: 'Everything candidates and hiring teams need—from first discovery to a qualified conversation—inside one respectful, intelligent experience.',
} as const;

export const comparisonRows = [
  { feature: 'Discovery', traditional: 'Search boxes, job-board scrolling, and generic alerts', jobmatch: 'Personalized card deck ranked by skills, goals, location, and work style', impact: 'Less noise' },
  { feature: 'Geolocation of Opportunities', traditional: 'Broad city filters or sharing an exact address too early', jobmatch: 'Private city and distance matching before a mutual coffee or interview', impact: 'Closer matches' },
  { feature: 'Fit signal', traditional: 'CV keyword filters and recruiter guesswork', jobmatch: 'Transparent 0–100 fit score with matched skills and experience evidence', impact: 'Better decisions' },
  { feature: 'Applying', traditional: 'Repeated forms, cover letters, and resume uploads', jobmatch: 'One complete profile and a single intentional swipe', impact: 'Minutes, not hours' },
  { feature: 'Interest', traditional: 'One-way applications or unsolicited recruiter messages', jobmatch: 'A conversation opens only after both sides choose each other', impact: 'Mutual intent' },
  { feature: 'Privacy', traditional: 'Personal details copied across portals and inboxes', jobmatch: 'Candidate-controlled visibility; contact details stay hidden until a match', impact: 'Consent first' },
  { feature: 'Conversation', traditional: 'Email chains, missed follow-ups, and calendar ping-pong', jobmatch: 'Contextual chat, interview scheduling, and read status in one place', impact: 'Faster response' },
  { feature: 'Recruiting workflow', traditional: 'Spreadsheets, disconnected inboxes, and ATS hand-offs', jobmatch: 'Live talent discovery, mutual matches, and a visual hiring pipeline', impact: 'One workspace' },
  { feature: 'Distribution', traditional: 'Manually repost every role on every job site', jobmatch: 'Integration-ready job adapters for LinkedIn and future job-site partners', impact: 'Publish once' },
  { feature: 'Experience', traditional: 'Desktop-first portals that fight the user', jobmatch: 'Responsive web, installable desktop PWA, iOS, and Android from one product', impact: 'Hire anywhere' },
  { feature: 'Intelligence', traditional: 'Volume metrics: applications received and resumes viewed', jobmatch: 'Match quality, response rate, funnel conversion, and time-to-hire insights', impact: 'Quality over volume' },
] as const;

export const betterSignal = {
  kicker: 'A better signal',
  heading: 'Hiring works better when both sides choose.',
  features: [
    { icon: 'target', title: 'Fit, explained', text: 'Go beyond keywords with transparent skill, experience, and preference signals.' },
    { icon: 'zap', title: 'Intent, confirmed', text: 'A conversation opens only after both sides express interest. No cold outreach.' },
    { icon: 'map-pin', title: 'Geolocation of Opportunities', text: 'Choose a city and private distance range, then meet for coffee only when both sides agree.' },
    { icon: 'shield-check', title: 'People, respected', text: 'Salary and work style are clear up front. Candidate controls stay at the center.' },
  ],
} as const;

export const trust = {
  kicker: 'Designed for trust',
  heading: 'Less noise. More possibility.',
  body: 'Every recommendation carries its reason. Every connection starts with consent. Every candidate gets control over what employers can see.',
} as const;

export const stats = {
  items: [
    { value: '3.2×', label: 'more qualified conversations' },
    { value: '48h', label: 'median time to first response' },
    { value: '42%', label: 'fewer screening steps' },
  ],
  note: 'Illustrative product targets for the demo experience.',
} as const;
