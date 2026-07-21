import type { JobDraft } from '../types';

/** Bundled realistic postings for the "Demo import" adapter. */
export const jobSamples: JobDraft[] = [
  {
    title: 'Senior Backend Engineer', department: 'Engineering', seniority: 'senior',
    requiredSkillsDetail: [{ name: 'Node.js', weight: 3 }, { name: 'PostgreSQL', weight: 3 }, { name: 'AWS', weight: 2 }, { name: 'TypeScript', weight: 2 }],
    niceToHaves: ['Kubernetes', 'GraphQL', 'Event-driven architecture'],
    type: 'Full-time', workMode: 'Hybrid', location: 'Ho Chi Minh City, Vietnam', hiringRadiusKm: 40,
    salaryRange: { min: 70000, max: 95000, currency: 'USD' },
    description: 'Own the services powering real-time matching for hundreds of thousands of users. You will design APIs, tune queries, and mentor two mid-level engineers.',
    responsibilities: ['Design and evolve core matching APIs', 'Own reliability of the PostgreSQL data layer', 'Lead incident reviews and raise operational standards', 'Mentor mid-level engineers'],
    interviewProcess: ['Recruiter screen', 'Technical deep-dive', 'System design', 'Team fit + offer'],
    startDate: 'Within 2 months',
  },
  {
    title: 'Product Marketing Manager', department: 'Marketing', seniority: 'mid',
    requiredSkillsDetail: [{ name: 'Product strategy', weight: 3 }, { name: 'Analytics', weight: 3 }, { name: 'Communication', weight: 2 }, { name: 'UX writing', weight: 1 }],
    niceToHaves: ['B2B SaaS experience', 'Vietnamese market knowledge'],
    type: 'Full-time', workMode: 'Remote', location: 'Remote · Asia timezones', hiringRadiusKm: 500,
    salaryRange: { min: 45000, max: 65000, currency: 'USD' },
    description: 'Turn product truth into stories hiring teams remember. You will own positioning, launches, and the content engine for our recruiter-facing product line.',
    responsibilities: ['Own go-to-market for two product lines', 'Run customer interviews and win/loss analysis', 'Build the launch calendar with product and sales'],
    interviewProcess: ['Intro call', 'Portfolio walkthrough', 'Case exercise', 'Offer'],
    startDate: 'Flexible',
  },
  {
    title: 'Design Systems Lead', department: 'Design', seniority: 'lead',
    requiredSkillsDetail: [{ name: 'Design systems', weight: 3 }, { name: 'Figma', weight: 3 }, { name: 'Accessibility', weight: 2 }, { name: 'Leadership', weight: 2 }, { name: 'Prototyping', weight: 1 }],
    niceToHaves: ['Design tokens tooling', 'React component libraries'],
    type: 'Full-time', workMode: 'On-site', location: 'Singapore', hiringRadiusKm: 30,
    salaryRange: { min: 120000, max: 150000, currency: 'SGD' },
    description: 'Build the system a 40-person product org designs with every day: tokens, components, documentation, and the culture that keeps them alive.',
    responsibilities: ['Own the design system roadmap', 'Pair with engineering on the component library', 'Teach and document system usage across squads'],
    interviewProcess: ['Recruiter screen', 'Craft review', 'Systems thinking interview', 'Leadership panel', 'Offer'],
    startDate: 'Q4 2026',
  },
];

/** A pasteable raw posting for demoing the paste-import parser. */
export const samplePasteText = `Senior Frontend Engineer
Acme Analytics · Ho Chi Minh City (Hybrid, 2 days in office)
Location: Ho Chi Minh City, Vietnam
Department: Engineering
Full-time · $60,000 - $85,000 per year

About the role
We build dashboards used by 4,000 companies. As a senior engineer you will own our React + TypeScript design system integration and mentor two juniors.

What you'll do
- Ship features across our React and TypeScript front end
- Own performance budgets and Core Web Vitals
- Collaborate with designers in Figma
- Mentor junior engineers

Requirements
- 5+ years with JavaScript, React and TypeScript
- Experience with design systems and accessibility
- SQL and analytics familiarity a plus

Interview process: recruiter screen, technical interview, team interview, offer.`;
