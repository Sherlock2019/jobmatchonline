/* Seed 100 demo candidates + 100 demo job offers into the PostgreSQL store (single-doc schema).
 *
 *   node server/seed-demo-100.mjs        (needs DATABASE_URL)
 *
 * - ids: dc-1..dc-100 (candidates), de-1..de-100 (employer accounts), dj-1..dj-100 (job offers)
 * - no credentials: demo accounts only, like the existing personas
 * - matching ratio 33%: exactly 33 candidates end in a MUTUAL match with their paired job
 *   (both swipes recorded + match row), 20 more have a one-sided like (funnel realism)
 * - deterministic (fixed PRNG seed) and idempotent (re-run replaces previous dc-/de-/dj- data)
 */
import pg from 'pg';

const MATCH_RATIO = 0.33;
const ONE_SIDED = 0.20;

/* deterministic PRNG so every run builds identical data */
let s = 20260719;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => rnd() - 0.5).slice(0, n);

const FIRST = ['Linh', 'Minh', 'An', 'Bao', 'Chi', 'Duc', 'Huy', 'Khanh', 'Lan', 'Mai', 'Nam', 'Ngoc', 'Phuc', 'Quan', 'Thao', 'Trang', 'Tuan', 'Vy', 'Alex', 'Sam', 'Jordan', 'Taylor', 'Priya', 'Arjun', 'Wei', 'Mei', 'Kenji', 'Yuki', 'Sofia', 'Mateo', 'Emma', 'Lucas', 'Amara', 'Kwame', 'Fatima', 'Omar', 'Elena', 'Piotr', 'Hana', 'Leila'];
const LAST = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vo', 'Dang', 'Bui', 'Do', 'Ho', 'Lee', 'Chen', 'Wang', 'Kim', 'Park', 'Tanaka', 'Sato', 'Sharma', 'Patel', 'Garcia', 'Silva', 'Muller', 'Rossi', 'Novak', 'Haddad', 'Okafor', 'Mensah', 'Kowalski', 'Petrov', 'Costa'];
const CITIES = [['Ho Chi Minh City', 'Vietnam'], ['Hanoi', 'Vietnam'], ['Da Nang', 'Vietnam'], ['Singapore', 'Singapore'], ['Bangkok', 'Thailand'], ['Jakarta', 'Indonesia'], ['Kuala Lumpur', 'Malaysia'], ['Manila', 'Philippines'], ['Tokyo', 'Japan'], ['Seoul', 'South Korea'], ['Bengaluru', 'India'], ['Sydney', 'Australia'], ['Berlin', 'Germany'], ['London', 'UK'], ['Lisbon', 'Portugal'], ['Warsaw', 'Poland'], ['Dubai', 'UAE'], ['Accra', 'Ghana'], ['Taipei', 'Taiwan'], ['Austin', 'USA']];
const LANGS = ['English', 'Vietnamese', 'Mandarin', 'Japanese', 'Korean', 'Hindi', 'Thai', 'German', 'French', 'Portuguese', 'Spanish', 'Polish', 'Arabic'];

const FAMILIES = {
  engineering: { titles: ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Backend Engineer', 'Frontend Engineer', 'Full-stack Engineer', 'Mobile Engineer', 'DevOps Engineer', 'Platform Engineer', 'Security Engineer'], skills: ['TypeScript', 'React', 'Node.js', 'AWS', 'Kubernetes', 'PostgreSQL', 'Python', 'Go', 'Docker', 'CI/CD', 'GraphQL', 'Terraform'] },
  design: { titles: ['Product Designer', 'Senior Product Designer', 'UX Designer', 'UX Researcher', 'Design Lead', 'Service Designer'], skills: ['Figma', 'Design systems', 'Research', 'Prototyping', 'Product strategy', 'Interaction design', 'Accessibility'] },
  data: { titles: ['Data Scientist', 'Data Engineer', 'Analytics Engineer', 'ML Engineer', 'BI Analyst'], skills: ['Python', 'SQL', 'ML', 'Analytics', 'dbt', 'Spark', 'Feature engineering', 'Experimentation'] },
  product: { titles: ['Product Manager', 'Senior Product Manager', 'Product Owner', 'Growth PM', 'Technical PM'], skills: ['Roadmaps', 'Discovery', 'Analytics', 'B2B SaaS', 'Experiments', 'Stakeholder management'] },
  marketing: { titles: ['Growth Marketer', 'Content Strategist', 'Performance Marketer', 'Brand Manager', 'SEO Specialist'], skills: ['SEO', 'Content', 'Growth', 'Paid social', 'Email automation', 'Brand strategy'] },
};
const FAMILY_KEYS = Object.keys(FAMILIES);
const COMPANIES = ['Northwind', 'Skylight', 'BlueHarbor', 'Vertexa', 'Lumina', 'Quantia', 'HelioSoft', 'Driftwood', 'Papaya Labs', 'Cobalt Works', 'Nimbus AI', 'Fernbank', 'Atlas Grid', 'MangoPay VN', 'Saigon Digital', 'Hanoi Cloud', 'Mekong Tech', 'Redwood Systems', 'Ocean Gate', 'Starling'];
const SALARY = { 'Vietnam': ['$25k–$40k', '$40k–$60k', '$60k–$85k'], 'Singapore': ['$80k–$110k', '$110k–$150k', '$150k–$190k'], default: ['$60k–$85k', '$85k–$115k', '$115k–$150k'] };
const LEVELS = ['mid', 'senior', 'lead'];
const MODES = ['Remote', 'Hybrid', 'Onsite', 'Flexible'];
const AVAIL = ['Now', '2 weeks', '1 month', 'Exploring'];
const STAGES = ['Matched', 'Matched', 'Interview', 'Offer'];
const OPENERS = [
  'Your profile is a strong fit for this role — open to a quick intro call?',
  'We matched! Would love to walk you through the team and the role.',
  'Great to match with you. When works for a 20-minute chat this week?',
  'Your skills line up almost exactly with what we need. Coffee in your city?',
];

const now = Date.now();
const day = 86400000;
const candidates = [], employers = [], jobs = [], swipes = [], matches = [], messages = [];

for (let i = 1; i <= 100; i++) {
  const fam = FAMILIES[FAMILY_KEYS[i % FAMILY_KEYS.length]];
  const [city, country] = pick(CITIES);
  const level = pick(LEVELS);
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  /* mockup portrait photos: randomuser.me set (100 men + 100 women), deterministic per id */
  const photo = `https://randomuser.me/api/portraits/${i % 2 ? 'women' : 'men'}/${i % 100}.jpg`;
  candidates.push({
    id: `dc-${i}`, role: 'candidate', demo: true, name,
    title: `${pick(fam.titles)}`, location: `${city}${rnd() < 0.35 ? ' · Open to remote' : ''}`,
    distanceKm: 3 + Math.floor(rnd() * 77),
    photo, initials: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    skills: pickN(fam.skills, 4), languages: ['English', ...pickN(LANGS.slice(1), rnd() < 0.7 ? 1 : 2)],
    experienceLevel: level, availability: pick(AVAIL), completeness: 70 + Math.floor(rnd() * 30),
  });
  const company = `${pick(COMPANIES)}`;
  const hr = `${pick(FIRST)} ${pick(LAST)}`;
  employers.push({
    id: `de-${i}`, role: 'employer', demo: true, name: hr, title: `Talent Partner at ${company}`,
    company, photo: `https://randomuser.me/api/portraits/${i % 2 ? 'men' : 'women'}/${(i + 50) % 100}.jpg`,
    initials: hr.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    skills: [], languages: ['English'], experienceLevel: 'senior', completeness: 100,
  });
  const jfam = FAMILIES[FAMILY_KEYS[i % FAMILY_KEYS.length]]; // same family as its paired candidate → believable fit
  jobs.push({
    id: `dj-${i}`, employerId: `de-${i}`, demo: true,
    title: pick(jfam.titles), company, logo: company[0], accent: `hsl(${Math.floor(rnd() * 360)} 70% 50%)`,
    location: `${city} · ${pick(MODES)}`, distanceKm: 3 + Math.floor(rnd() * 77), workMode: pick(MODES),
    salary: pick(SALARY[country] || SALARY.default), type: rnd() < 0.9 ? 'Full-time' : 'Contract',
    experienceLevel: level, requiredSkills: pickN(jfam.skills, 4), requiredLanguages: ['English'],
    description: `Join ${company} in ${city} — ${jfam.titles[0].toLowerCase()} role focused on shipping real product outcomes with a collaborative team.`,
    mission: 'Connect the right people with the right work.',
    culture: pickN(['High trust', 'Remote first', 'Customer obsessed', 'Low ego', 'Evidence led', 'Kind', 'Ambitious'], 3),
    responseTime: `${1 + Math.floor(rnd() * 6)} days`, applicants: 5 + Math.floor(rnd() * 140), status: 'Active',
  });
}

/* 33% mutual matches: candidates dc-1..dc-33 ↔ their paired job dj-1..dj-33 */
const mutualCount = Math.round(100 * MATCH_RATIO);
const oneSidedCount = Math.round(100 * ONE_SIDED);
for (let i = 1; i <= mutualCount; i++) {
  const t = now - Math.floor(rnd() * 21) * day;
  swipes.push({ id: `ds-c-${i}`, actorId: `dc-${i}`, targetType: 'job', targetId: `dj-${i}`, direction: 'like', createdAt: t });
  swipes.push({ id: `ds-e-${i}`, actorId: `de-${i}`, targetType: 'candidate', targetId: `dc-${i}`, direction: 'like', createdAt: t + 3600000 });
  matches.push({ id: `dm-${i}`, candidateId: `dc-${i}`, employerId: `de-${i}`, jobId: `dj-${i}`, stage: pick(STAGES), createdAt: t + 3600000 });
  if (rnd() < 0.6) {
    messages.push({ id: `dmsg-${i}`, matchId: `dm-${i}`, senderId: `de-${i}`, text: pick(OPENERS), createdAt: t + 7200000 });
  }
}
/* one-sided likes: dc-34..dc-53 liked their job, employer undecided */
for (let i = mutualCount + 1; i <= mutualCount + oneSidedCount; i++) {
  swipes.push({ id: `ds-c-${i}`, actorId: `dc-${i}`, targetType: 'job', targetId: `dj-${i}`, direction: 'like', createdAt: now - Math.floor(rnd() * 10) * day });
}

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL required'); process.exit(1); }
/* RDS forces TLS; local/dev postgres does not use it */
const ssl = /amazonaws\.com/.test(url) ? { rejectUnauthorized: false } : undefined;
const pool = new pg.Pool({ connectionString: url, ssl });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query('SELECT doc FROM app_state WHERE id = 1 FOR UPDATE');
  if (!rows.length) throw new Error('app_state empty — start the API once first');
  const doc = rows[0].doc;
  const isDemo = (x) => /^d[cejm]|^ds-|^dmsg-|^dj-|^de-|^dm-/.test(x.id || '');
  doc.users = (doc.users || []).filter((u) => !isDemo(u)).concat(candidates, employers);
  doc.jobs = (doc.jobs || []).filter((j) => !isDemo(j)).concat(jobs);
  doc.swipes = (doc.swipes || []).filter((sw) => !isDemo(sw)).concat(swipes);
  doc.matches = (doc.matches || []).filter((m) => !isDemo(m)).concat(matches);
  doc.messages = (doc.messages || []).filter((m) => !isDemo(m)).concat(messages);
  await client.query('UPDATE app_state SET doc = $1, updated_at = now() WHERE id = 1', [doc]);
  await client.query('COMMIT');
  console.log(JSON.stringify({
    seeded: { candidates: candidates.length, employers: employers.length, jobs: jobs.length,
      mutualMatches: matches.length, oneSidedLikes: oneSidedCount,
      matchRatio: `${matches.length}/${candidates.length} = ${(matches.length / candidates.length * 100).toFixed(0)}%`,
      messages: messages.length },
    totals: { users: doc.users.length, jobs: doc.jobs.length, swipes: doc.swipes.length,
      matches: doc.matches.length, messages: doc.messages.length },
  }, null, 2));
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
