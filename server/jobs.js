/**
 * Job posting model: sanitize/validate create+update payloads, and parse
 * pasted job-board text into structured fields (Claude API when
 * ANTHROPIC_API_KEY is set, heuristic parser otherwise).
 */
import { ValidationError } from './matching.js';

export const JOB_STATUSES = ['draft', 'active', 'paused', 'filled'];
const SENIORITIES = ['junior', 'mid', 'senior', 'lead', 'exec'];
const WORK_MODES = ['Remote', 'Hybrid', 'On-site', 'Flexible'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];

const str = (value, max = 500) => (typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined);
const num = (value, min, max) => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : undefined);
const strArray = (value, maxItems = 30, maxLen = 200) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim() && item.length <= maxLen).map((item) => item.trim()).slice(0, maxItems) : undefined);

function formatSalary({ min, max, currency }) {
  const compact = (value) => (value >= 1000 && value % 1000 === 0 ? `${value / 1000}k` : value.toLocaleString());
  const symbol = { USD: '$', EUR: '€', GBP: '£', AUD: 'A$', SGD: 'S$', VND: '₫' }[currency];
  const prefix = symbol || `${currency} `;
  return `${prefix}${compact(min)}–${prefix}${compact(max)}`;
}

/** Whitelist-merge a job payload; `strict` enforces the required-field contract. */
export function applyJob(job, body, { strict = false } = {}) {
  const set = (field, value) => { if (value !== undefined) job[field] = value; };
  set('title', str(body.title, 140));
  set('department', str(body.department, 80));
  if (body.seniority !== undefined) {
    if (!SENIORITIES.includes(body.seniority)) throw new ValidationError('seniority', `seniority must be one of ${SENIORITIES.join(', ')}`);
    job.seniority = body.seniority;
    job.experienceLevel = body.seniority; // fit score input
  }
  if (body.requiredSkillsDetail !== undefined) {
    if (!Array.isArray(body.requiredSkillsDetail)) throw new ValidationError('requiredSkillsDetail', 'must be an array');
    job.requiredSkillsDetail = body.requiredSkillsDetail
      .map((item) => ({ name: str(item?.name, 60), weight: num(item?.weight, 1, 3) ?? 2 }))
      .filter((item) => item.name).slice(0, 25);
    job.requiredSkills = job.requiredSkillsDetail.map((item) => item.name);
  }
  set('niceToHaves', strArray(body.niceToHaves, 15, 60));
  if (body.type !== undefined) {
    if (!EMPLOYMENT_TYPES.includes(body.type)) throw new ValidationError('type', `type must be one of ${EMPLOYMENT_TYPES.join(', ')}`);
    job.type = body.type;
  }
  if (body.workMode !== undefined) {
    if (!WORK_MODES.includes(body.workMode)) throw new ValidationError('workMode', `workMode must be one of ${WORK_MODES.join(', ')}`);
    job.workMode = body.workMode;
  }
  if (body.remoteScope !== undefined) {
    if (!['country', 'worldwide'].includes(body.remoteScope)) throw new ValidationError('remoteScope', 'remoteScope must be country or worldwide');
    job.remoteScope = body.remoteScope;
  }
  set('country', str(body.country, 80));
  set('location', str(body.location, 120));
  if (body.geo && typeof body.geo === 'object') {
    const lat = num(body.geo.lat, -90, 90); const lng = num(body.geo.lng, -180, 180);
    if (lat !== undefined && lng !== undefined) job.geo = { lat, lng };
  }
  set('hiringRadiusKm', num(body.hiringRadiusKm, 5, 500));
  if (body.salaryRange !== undefined) {
    const min = num(body.salaryRange?.min, 0, 100000000);
    const max = num(body.salaryRange?.max, 0, 100000000);
    const currency = str(body.salaryRange?.currency, 8);
    if (min === undefined || max === undefined || !currency) throw new ValidationError('salaryRange', 'salaryRange needs min, max, and currency');
    if (min > max) throw new ValidationError('salaryRange', 'salary min cannot exceed max');
    job.salaryRange = { min, max, currency };
    job.salary = formatSalary(job.salaryRange);
  }
  set('description', str(body.description, 5000));
  set('responsibilities', strArray(body.responsibilities, 15, 300));
  set('interviewProcess', strArray(body.interviewProcess, 10, 120));
  set('startDate', str(body.startDate, 40));
  set('externalUrl', str(body.externalUrl, 400));
  set('screeningQuestions', strArray(body.screeningQuestions, 5, 300));
  if (body.status !== undefined) {
    if (!JOB_STATUSES.includes(body.status)) throw new ValidationError('status', `status must be one of ${JOB_STATUSES.join(', ')}`);
    job.status = body.status;
  }
  set('requiredLanguages', strArray(body.requiredLanguages, 8, 40));

  if (strict) {
    if (!job.title) throw new ValidationError('title', 'Title is required');
    if (!job.seniority && !job.experienceLevel) throw new ValidationError('seniority', 'Seniority is required');
    if (!job.requiredSkills || job.requiredSkills.length < 3) throw new ValidationError('requiredSkillsDetail', 'At least 3 required skills');
    if (!job.type) throw new ValidationError('type', 'Employment type is required');
    if (!job.workMode) throw new ValidationError('workMode', 'Work mode is required');
    if (!job.location) throw new ValidationError('location', 'Location is required');
    // Radius only matters for on-site/hybrid; remote roles use scope instead.
    if (job.workMode !== 'Remote' && job.hiringRadiusKm === undefined) throw new ValidationError('hiringRadiusKm', 'Hiring radius is required for on-site or hybrid roles');
    if (job.workMode === 'Remote' && !job.remoteScope) job.remoteScope = 'worldwide';
    if (!job.salaryRange) throw new ValidationError('salaryRange', 'Salary range is mandatory');
    if (!job.description) throw new ValidationError('description', 'Description is required');
    if (!job.status) job.status = 'draft';
  }
  return job;
}

// ---------------------------------------------------------------------------
// Paste-import parsing
// ---------------------------------------------------------------------------

const SKILL_DICTIONARY = ['React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Go', 'Java', 'Kotlin', 'Swift', 'SQL', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes', 'Figma', 'Design systems', 'Product strategy', 'Research', 'Prototyping', 'Analytics', 'Leadership', 'Service design', 'UX writing', 'Accessibility', 'GraphQL', 'CI/CD', 'Machine learning', 'Data analysis', 'Agile', 'Scrum', 'Communication', 'Stakeholder management'];

/** Regex/heuristic fallback parser for pasted job text. */
export function heuristicParse(text, url) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  const parsed = { externalUrl: url || undefined };

  parsed.title = lines[0]?.slice(0, 140);

  const seniorityMap = [['exec', /\b(vp|vice president|head of|director|chief|cxo)\b/], ['lead', /\b(lead|principal|staff)\b/], ['senior', /\bsenior|sr\.?\b/], ['junior', /\b(junior|jr\.?|entry[- ]level|graduate)\b/]];
  parsed.seniority = (seniorityMap.find(([, pattern]) => pattern.test(lower)) || ['mid'])[0];

  if (/remote/.test(lower) && /hybrid/.test(lower)) parsed.workMode = 'Hybrid';
  else if (/hybrid/.test(lower)) parsed.workMode = 'Hybrid';
  else if (/remote/.test(lower)) parsed.workMode = 'Remote';
  else if (/on[- ]?site|in[- ]office/.test(lower)) parsed.workMode = 'On-site';

  parsed.type = /part[- ]time/.test(lower) ? 'Part-time' : /contract/.test(lower) ? 'Contract' : /freelance/.test(lower) ? 'Freelance' : /intern/.test(lower) ? 'Internship' : 'Full-time';

  const locationMatch = text.match(/(?:location|based in|office)[:\s]+([A-Za-zÀ-ỹ ,'-]{3,60})/i);
  if (locationMatch) parsed.location = locationMatch[1].trim().replace(/[.,]$/, '');

  const salaryMatch = text.match(/(?:[$€£]|USD|EUR|GBP|A\$|S\$|VND)\s?([\d.,]+)\s?(k)?\s?(?:-|–|to)\s?(?:[$€£]|USD|EUR|GBP|A\$|S\$|VND)?\s?([\d.,]+)\s?(k)?/i);
  if (salaryMatch) {
    const parseNumber = (raw, kFlag) => { let value = Number(raw.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')); if (kFlag || value < 1000) value *= 1000; return Math.round(value); };
    const min = parseNumber(salaryMatch[1], salaryMatch[2]);
    const max = parseNumber(salaryMatch[3], salaryMatch[4]);
    const currency = /€|EUR/i.test(salaryMatch[0]) ? 'EUR' : /£|GBP/i.test(salaryMatch[0]) ? 'GBP' : /A\$/i.test(salaryMatch[0]) ? 'AUD' : /S\$/i.test(salaryMatch[0]) ? 'SGD' : /VND|₫/i.test(salaryMatch[0]) ? 'VND' : 'USD';
    if (min && max && min <= max) parsed.salaryRange = { min, max, currency };
  }

  const foundSkills = SKILL_DICTIONARY.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  parsed.requiredSkillsDetail = foundSkills.slice(0, 10).map((name, index) => ({ name, weight: index < 4 ? 3 : 2 }));

  const bulletLines = lines.filter((line) => /^[-•*·]/.test(line)).map((line) => line.replace(/^[-•*·]\s*/, ''));
  const responsibilitiesStart = lines.findIndex((line) => /responsibilit|what you.ll do|your role/i.test(line));
  if (responsibilitiesStart >= 0) {
    parsed.responsibilities = [];
    for (const line of lines.slice(responsibilitiesStart + 1)) {
      if (/^[A-Z][^-•*·]{0,40}:?$/.test(line) && parsed.responsibilities.length) break;
      if (/^[-•*·]/.test(line)) parsed.responsibilities.push(line.replace(/^[-•*·]\s*/, '').slice(0, 300));
      if (parsed.responsibilities.length >= 8) break;
    }
  } else if (bulletLines.length) parsed.responsibilities = bulletLines.slice(0, 6).map((line) => line.slice(0, 300));

  const departmentMatch = text.match(/(?:department|team)[:\s]+([A-Za-z &]{3,50})/i);
  if (departmentMatch) parsed.department = departmentMatch[1].trim();

  parsed.description = lines.slice(1).join(' ').slice(0, 1200) || text.slice(0, 1200);
  parsed.interviewProcess = /screen/i.test(lower) || /interview process/i.test(lower)
    ? ['Recruiter screen', 'Technical / craft interview', 'Team conversation', 'Offer']
    : undefined;
  return parsed;
}

/** Parse with the Claude API when a key is configured. Falls back to heuristics on any failure. */
export async function parseJobText(text, url) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { parser: 'heuristic', parsed: heuristicParse(text, url) };
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: `Parse this job posting into JSON with keys: title, department, seniority (junior|mid|senior|lead|exec), requiredSkillsDetail (array of {name, weight 1-3}, most important first), niceToHaves (string array), type (Full-time|Part-time|Contract|Freelance|Internship), workMode (Remote|Hybrid|On-site|Flexible), location, salaryRange ({min, max, currency} annual, numbers), description (2-3 sentence summary), responsibilities (string array), interviewProcess (string array of stage names). Omit unknown fields. Reply with ONLY the JSON object.\n\nJob posting:\n${text.slice(0, 8000)}` }],
      }),
    });
    if (!response.ok) throw new Error(`Claude API ${response.status}`);
    const body = await response.json();
    const raw = body.content?.[0]?.text || '';
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    parsed.externalUrl = url || undefined;
    return { parser: 'claude', parsed };
  } catch {
    return { parser: 'heuristic', parsed: heuristicParse(text, url) };
  }
}
