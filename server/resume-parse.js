/**
 * Parse a resume's extracted text into structured candidate-profile fields.
 * Claude API when ANTHROPIC_API_KEY is set; a section/keyword heuristic
 * otherwise. Returns fields the onboarding wizard pre-fills for review — never
 * persisted server-side without the user confirming.
 */

const SKILL_DICTIONARY = [
  // Engineering
  'React', 'React Native', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Go', 'Java', 'Kotlin', 'Swift', 'Ruby', 'Rails', 'PHP', 'Laravel', 'C++', 'C#', '.NET', 'Rust', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST', 'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Git', 'Vue', 'Angular', 'Next.js', 'Express', 'Django', 'FastAPI', 'Spring', 'Machine learning', 'Deep learning', 'TensorFlow', 'PyTorch', 'LLM', 'NLP', 'Data engineering', 'Data analysis', 'Microservices', 'Kafka',
  // Design
  'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'Design systems', 'Prototyping', 'Wireframing', 'User research', 'UX research', 'Research', 'Service design', 'Interaction design', 'Visual design', 'UX writing', 'Accessibility', 'Usability testing', 'Design tokens',
  // Product / business
  'Product strategy', 'Product management', 'Roadmapping', 'Analytics', 'A/B testing', 'Stakeholder management', 'Agile', 'Scrum', 'Kanban', 'Leadership', 'Mentorship', 'Facilitation', 'Communication', 'Go-to-market', 'SEO', 'Content strategy', 'Growth', 'SQL', 'Excel', 'Tableau', 'Power BI', 'Project management', 'Jira',
];

const KNOWN_LANGUAGES = ['English', 'Vietnamese', 'French', 'Spanish', 'German', 'Mandarin', 'Chinese', 'Cantonese', 'Japanese', 'Korean', 'Hindi', 'Portuguese', 'Italian', 'Russian', 'Arabic', 'Thai', 'Indonesian', 'Malay', 'Dutch'];

const SENIORITY_RULES = [
  ['exec', /\b(chief|cxo|cto|ceo|coo|vp|vice president|head of|director)\b/i],
  ['lead', /\b(lead|principal|staff)\b/i],
  ['senior', /\b(senior|sr\.?)\b/i],
  ['junior', /\b(junior|jr\.?|intern|graduate|entry[- ]level)\b/i],
];

function escapeRe(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function findSection(lines, headingRe) {
  const start = lines.findIndex((line) => headingRe.test(line) && line.length < 40);
  if (start < 0) return [];
  const body = [];
  for (const line of lines.slice(start + 1)) {
    // Stop at the next ALL-CAPS-ish heading.
    if (/^[A-Z][A-Za-z ]{2,30}:?$/.test(line) && /^(EXPERIENCE|EMPLOYMENT|WORK|EDUCATION|SKILLS|LANGUAGES|CERTIFICATIONS|PROJECTS|SUMMARY|PROFILE|CONTACT|AWARDS|INTERESTS)/i.test(line)) break;
    body.push(line);
  }
  return body;
}

function heuristicParse(text) {
  const rawLines = text.split('\n').map((l) => l.trim());
  const lines = rawLines.filter(Boolean);
  const flat = lines.join(' ');

  // Headline / title: a clean line that looks like a role, else a role phrase
  // pulled from the flat text (pdf.js extraction often loses line breaks).
  let title = lines.find((line) => /\b(engineer|designer|manager|developer|architect|analyst|researcher|lead|consultant|scientist|director|specialist|strategist|marketer|writer|founder)\b/i.test(line) && line.length < 80);
  if (!title) {
    const m = flat.match(/\b((?:Senior|Lead|Principal|Staff|Junior|Head of|Chief)\s+)?(?:[A-Z][a-z]+\s+){0,2}(Engineer|Designer|Developer|Manager|Architect|Analyst|Researcher|Scientist|Consultant|Strategist|Marketer)\b/);
    if (m) title = m[0].trim();
  }

  const yearsMatch = flat.match(/(\d{1,2})\+?\s*years?\b/i);
  const yearsExperience = yearsMatch ? Math.min(Number(yearsMatch[1]), 50) : undefined;

  const seniority = (SENIORITY_RULES.find(([, re]) => re.test(flat)) || [])[0];

  // Skills: dictionary hits + tokens from a Skills section.
  const found = new Set();
  for (const skill of SKILL_DICTIONARY) if (new RegExp(`\\b${escapeRe(skill)}\\b`, 'i').test(text)) found.add(skill);
  const skillSection = findSection(lines, /^skills\b|technical skills|core skills/i).join(' ');
  for (const token of skillSection.split(/[,•|/·•]+/).map((t) => t.trim()).filter((t) => t && t.length <= 40)) {
    const match = SKILL_DICTIONARY.find((s) => s.toLowerCase() === token.toLowerCase());
    found.add(match || token);
  }
  const skills = [...found].slice(0, 15).map((name) => ({ name, level: 3 }));

  // Languages
  const languages = [];
  const langSection = findSection(lines, /^languages\b/i).join(' ') || flat;
  for (const lang of KNOWN_LANGUAGES) {
    if (new RegExp(`\\b${escapeRe(lang)}\\b`, 'i').test(langSection)) {
      const near = langSection.match(new RegExp(`${escapeRe(lang)}[^A-Za-z]{0,3}(native|fluent|professional|conversational|basic|c1|c2|b1|b2|a1|a2)`, 'i'));
      const level = near ? near[1].replace(/^\w/, (c) => c.toUpperCase()) : 'Fluent';
      languages.push({ name: lang, level });
    }
  }

  // Work experience: lines with a date range in a work section.
  const workLines = findSection(lines, /^(experience|employment|work experience|professional experience)/i);
  const workExperience = [];
  for (let i = 0; i < workLines.length && workExperience.length < 6; i += 1) {
    const line = workLines[i];
    const range = line.match(/((?:19|20)\d{2}|present|current)\s*[-–—to]+\s*((?:19|20)\d{2}|present|current)/i);
    if (range) {
      const label = line.replace(range[0], '').replace(/[|,·•]/g, ' ').trim();
      const [titlePart, companyPart] = label.split(/\s+(?:at|@|,|-|–)\s+/i);
      workExperience.push({
        title: (titlePart || label).slice(0, 120),
        company: (companyPart || '').slice(0, 120),
        from: range[1], to: /present|current/i.test(range[2]) ? 'Present' : range[2],
        description: (workLines[i + 1] && !/((?:19|20)\d{2})/.test(workLines[i + 1]) ? workLines[i + 1] : '').slice(0, 400),
      });
    }
  }

  // Education
  const eduLines = findSection(lines, /^education\b/i);
  const education = [];
  for (const line of eduLines) {
    if (/\b(bachelor|master|b\.?sc|m\.?sc|b\.?a|m\.?a|phd|degree|university|college|institute)\b/i.test(line)) {
      const range = line.match(/((?:19|20)\d{2})\s*[-–—to]+\s*((?:19|20)\d{2}|present)/i);
      education.push({ degree: line.replace(range ? range[0] : '', '').slice(0, 140).trim(), school: '', from: range ? range[1] : '', to: range ? range[2] : '' });
      if (education.length >= 4) break;
    }
  }

  // Links
  const links = {};
  const github = flat.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,;)]+/i);
  const linkedin = flat.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,;)]+/i);
  const site = flat.match(/(?:https?:\/\/)[^\s,;)]+/i);
  if (github) links.github = github[0];
  if (linkedin) links.linkedin = linkedin[0];
  if (site && !/(github|linkedin)\.com/i.test(site[0])) links.portfolio = site[0];

  // Certifications
  const certifications = findSection(lines, /^certifications?\b/i)
    .map((l) => l.replace(/^[-•*·]\s*/, '').trim()).filter((l) => l && l.length <= 100).slice(0, 6);

  // Industries (best-effort keyword hits)
  const industries = ['SaaS', 'Fintech', 'Health', 'E-commerce', 'Education', 'Gaming', 'Logistics', 'AI'].filter((ind) => new RegExp(`\\b${escapeRe(ind)}\\b`, 'i').test(flat));

  return {
    headline: title ? title.slice(0, 120) : undefined,
    title: title ? title.slice(0, 120) : undefined,
    yearsExperience, seniority,
    skills, languages, industries,
    workExperience, education, certifications,
    links: Object.keys(links).length ? links : undefined,
  };
}

async function claudeParse(text) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 1800,
        messages: [{ role: 'user', content: `Extract structured profile data from this resume. Reply with ONLY JSON: {"headline": one-line professional headline, "title": current or most recent job title, "yearsExperience": integer, "seniority": "junior"|"mid"|"senior"|"lead"|"exec", "skills": [{"name": string, "level": 1-5}] (top 12), "industries": [string], "workExperience": [{"title","company","from","to","description"}], "education": [{"school","degree","from","to"}], "certifications": [string], "languages": [{"name","level"}], "links": {"github","linkedin","portfolio","website"}}. Omit unknown fields.\n\nResume:\n${text.slice(0, 9000)}` }],
      }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const raw = body.content?.[0]?.text || '';
    return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch { return null; }
}

export async function parseResumeToProfile(text) {
  if (!text || text.trim().length < 30) return { generator: 'none', fields: {} };
  const viaClaude = await claudeParse(text);
  if (viaClaude) return { generator: 'claude', fields: viaClaude };
  return { generator: 'heuristic', fields: heuristicParse(text) };
}
