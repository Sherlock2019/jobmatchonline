/**
 * Coaching content generation: interview prep (candidate), screening
 * questions (recruiter), and interview kits (recruiter). Uses the Claude API
 * when ANTHROPIC_API_KEY is set; otherwise a skill-keyed template bank.
 * Results are cached by the callers (per job / per match).
 */
import { salaryCompatibility } from './matching.js';

// Skill-specific question banks; anything not listed falls back to templates.
const SKILL_QUESTIONS = {
  react: ['How do you decide between local state, context, and an external store in a React app?', 'Walk me through debugging a React rendering performance problem you actually hit.', 'How do you structure a component so it stays testable as it grows?'],
  typescript: ['Where has TypeScript caught a real bug for you that JavaScript would have missed?', 'How do you type a function that transforms deeply nested data?', 'When do you reach for generics versus keeping types simple?'],
  'node.js': ['How do you handle backpressure or long-running work in a Node service?', 'Describe how you structured error handling in a production Node API.', 'What did you monitor to know your Node service was healthy?'],
  postgresql: ['Tell me about a slow query you diagnosed — what did EXPLAIN show?', 'How do you decide between normalizing and denormalizing a schema?', 'How have you handled a migration on a table with live traffic?'],
  figma: ['How do you keep a Figma file usable for a team of five designers?', 'Describe your handoff process from Figma to engineering.', 'How do you use components and variables to keep designs consistent?'],
  'design systems': ['How do you decide when a pattern earns a place in the design system?', 'Tell me about driving adoption of a system across reluctant teams.', 'How do you version and communicate breaking changes to components?'],
  research: ['How do you choose between qualitative and quantitative methods for a question?', 'Tell me about a study whose results changed a product decision.', 'How do you keep research findings from being ignored?'],
  'product strategy': ['Walk me through a bet you made that required saying no to something popular.', 'How do you connect discovery work to a roadmap commitment?', 'Describe how you measured whether a strategy actually worked.'],
  leadership: ['Tell me about growing someone on your team into a bigger role.', 'How do you handle disagreement between strong senior people?', 'What does your first 90 days leading a new team look like?'],
  analytics: ['Describe a metric you defined that changed how a team worked.', 'How do you sanity-check a surprising number before sharing it?', 'Tell me about balancing data with intuition in a decision.'],
  prototyping: ['What fidelity do you prototype at, and how do you decide?', 'Tell me about a prototype that killed a bad idea early.', 'How do you test a prototype with users without leading them?'],
  accessibility: ['How do you build accessibility into the workflow rather than auditing at the end?', 'Which assistive technologies do you test with, and why?', 'Tell me about an accessibility fix that improved the product for everyone.'],
};

const TEMPLATE_QUESTIONS = [
  'Walk me through a recent project where {skill} was central — what was your specific contribution?',
  'What separates adequate from excellent {skill} work, in your experience?',
  'Tell me about a time your {skill} approach failed — what did you change?',
];

const ASK_THEM = [
  'How does the team measure success for this role in the first six months?',
  'What is the hardest problem the team expects to face this year?',
  'How do decisions get made when the team disagrees?',
  'What made the last person who thrived here so effective?',
];

function questionsForSkill(skill) {
  return SKILL_QUESTIONS[skill.toLowerCase()] || TEMPLATE_QUESTIONS.map((template) => template.replace(/\{skill\}/g, skill));
}

function topSkills(job, count) {
  const detail = job.requiredSkillsDetail || (job.requiredSkills || []).map((name) => ({ name, weight: 2 }));
  return [...detail].sort((a, b) => (b.weight || 2) - (a.weight || 2)).slice(0, count);
}

async function claudeJson(prompt, maxTokens = 1200) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const raw = body.content?.[0]?.text || '';
    return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch { return null; }
}

/** Item 9: per-job interview prep for candidates. */
export async function generatePrep(job) {
  const generated = await claudeJson(`Create interview prep for a candidate applying to "${job.title}" (${job.seniority || job.experienceLevel} level). Required skills: ${(job.requiredSkills || []).join(', ')}. Interview process: ${(job.interviewProcess || []).join(' → ') || 'unspecified'}. Reply with ONLY JSON: {"topics": [6 short revision topics], "skillQuestions": [{"skill": name, "questions": [3 likely interview questions]} for the top 3 skills], "askThem": "one strong question the candidate should ask"}`);
  if (generated?.topics && generated?.skillQuestions) return { ...generated, generator: 'claude' };

  const skills = topSkills(job, 3);
  return {
    generator: 'templates',
    topics: [
      ...skills.map((skill) => `Refresh your strongest ${skill.name} examples — outcomes, numbers, and your exact role.`),
      ...(job.interviewProcess || []).slice(0, 2).map((step) => `Prepare for the "${step}" stage — ask who you'll meet and what they care about.`),
      `Re-read the role description and map each responsibility to something you have shipped.`,
    ].slice(0, 6),
    skillQuestions: skills.map((skill) => ({ skill: skill.name, questions: questionsForSkill(skill.name) })),
    askThem: ASK_THEM[(job.title || '').length % ASK_THEM.length],
  };
}

/** Item 11: 3 screening questions from a job's required skills (template bank). */
export function suggestScreeningQuestions(job) {
  return topSkills(job, 3).map((skill) => questionsForSkill(skill.name)[0]);
}

/** Item 12: interview kit for a matched candidate. */
export async function generateInterviewKit(candidate, job) {
  const claimed = (candidate.skillsDetail || (candidate.skills || []).map((name) => ({ name, level: 3 })));
  const matched = claimed.filter((skill) => (job.requiredSkills || []).some((required) => required.toLowerCase() === skill.name.toLowerCase()));
  const gaps = (job.requiredSkills || []).filter((required) => !claimed.some((skill) => skill.name.toLowerCase() === required.toLowerCase()));
  const salary = salaryCompatibility(candidate.preferences?.salary, job.salaryRange);
  const format = (range) => range ? `${range.min.toLocaleString()}–${range.max.toLocaleString()} ${range.currency}` : 'not shared';
  const salarySummary = `Candidate expects ${format(candidate.preferences?.salary)}; the role offers ${format(job.salaryRange)}. ${salary.evidence}`;

  const generated = await claudeJson(`Create an interview kit for interviewing ${candidate.name} (${candidate.title}) for "${job.title}". Claimed skills: ${claimed.map((skill) => `${skill.name} (${skill.level}/5)`).join(', ')}. Skill gaps vs the role: ${gaps.join(', ') || 'none'}. Reply with ONLY JSON: {"skillQuestions": [{"skill": name, "questions": [2 probing questions grounded in their claimed level]} for up to 4 matched skills], "gapProbes": [{"skill": gap, "question": one honest question to assess it}]}`);
  if (generated?.skillQuestions) return { ...generated, gaps, salarySummary, salaryStatus: salary.status, generator: 'claude' };

  return {
    generator: 'templates',
    skillQuestions: (matched.length ? matched : claimed).slice(0, 4).map((skill) => ({
      skill: skill.name,
      questions: questionsForSkill(skill.name).slice(0, 2).map((question) => skill.level >= 4 ? `${question} (They rate themselves ${skill.level}/5 — push for depth.)` : question),
    })),
    gapProbes: gaps.slice(0, 4).map((skill) => ({ skill, question: `The role needs ${skill}, which isn't on their profile — ask how they would close that gap or what adjacent experience applies.` })),
    gaps, salarySummary, salaryStatus: salary.status,
  };
}
