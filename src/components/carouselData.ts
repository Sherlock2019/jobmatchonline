/* 10 candidate↔company stories × 3 phone screens (match → candidate profile → job description) = 30 slides. */
export type CarouselStory = {
  candidate: { name: string; title: string; initials: string; hue: number; city: string; km: number; skills: string[]; salary: string; fit: number };
  hr: { name: string; title: string; initials: string; hue: number };
  company: { name: string; logo: string; hue: number; city: string; role: string; salary: string; mode: string; blurb: string; skills: string[] };
};

export const CAROUSEL_STORIES: CarouselStory[] = [
  { candidate: { name: 'Alex Martinez', title: 'Senior Software Engineer', initials: 'AM', hue: 214, city: 'Singapore', km: 8, skills: ['TypeScript', 'React', 'AWS'], salary: '$120k–$150k', fit: 94 },
    hr: { name: 'Sarah Thompson', title: 'HR Talent Partner', initials: 'ST', hue: 340 },
    company: { name: 'Northstar', logo: 'N', hue: 224, city: 'Singapore', role: 'Senior Software Engineer', salary: '$120k–$150k', mode: 'Hybrid · Full-time', blurb: 'Own the matching platform end to end with a product-minded team.', skills: ['TypeScript', 'React', 'AWS'] } },
  { candidate: { name: 'Linh Tran', title: 'Product Designer', initials: 'LT', hue: 158, city: 'Ho Chi Minh City', km: 5, skills: ['Figma', 'Design systems', 'Research'], salary: '$70k–$95k', fit: 91 },
    hr: { name: 'Marcus Webb', title: 'Design Director', initials: 'MW', hue: 262 },
    company: { name: 'Canvas', logo: 'C', hue: 16, city: 'Ho Chi Minh City', role: 'Product Designer', salary: '$70k–$95k', mode: 'Onsite · Full-time', blurb: 'Shape a design system used by 40+ product squads.', skills: ['Figma', 'Design systems', 'Prototyping'] } },
  { candidate: { name: 'Priya Sharma', title: 'Data Scientist', initials: 'PS', hue: 288, city: 'Bengaluru', km: 12, skills: ['Python', 'ML', 'SQL'], salary: '₹35L–₹45L', fit: 96 },
    hr: { name: 'Daniel Kim', title: 'Head of Analytics', initials: 'DK', hue: 200 },
    company: { name: 'Relay', logo: 'R', hue: 262, city: 'Bengaluru', role: 'Senior Data Scientist', salary: '₹35L–₹45L', mode: 'Hybrid · Full-time', blurb: 'Build explainable ranking models for two-sided matching.', skills: ['Python', 'ML', 'Feature stores'] } },
  { candidate: { name: 'Tom Becker', title: 'DevOps Engineer', initials: 'TB', hue: 30, city: 'Berlin', km: 3, skills: ['Kubernetes', 'Terraform', 'CI/CD'], salary: '€75k–€95k', fit: 89 },
    hr: { name: 'Anna Fischer', title: 'Engineering Manager', initials: 'AF', hue: 190 },
    company: { name: 'Orbit', logo: 'O', hue: 145, city: 'Berlin', role: 'Platform Engineer', salary: '€75k–€95k', mode: 'Remote-first', blurb: 'Run the GitOps platform for 200 microservices.', skills: ['Kubernetes', 'Flux', 'Terraform'] } },
  { candidate: { name: 'Maya Chen', title: 'Mobile Engineer', initials: 'MC', hue: 350, city: 'Taipei', km: 6, skills: ['React Native', 'Swift', 'Kotlin'], salary: '$90k–$115k', fit: 92 },
    hr: { name: 'James Liu', title: 'Talent Acquisition Lead', initials: 'JL', hue: 220 },
    company: { name: 'Stride', logo: 'S', hue: 330, city: 'Taipei', role: 'Senior Mobile Engineer', salary: '$90k–$115k', mode: 'Hybrid · Full-time', blurb: 'Ship the swipe experience used by 2M matches a month.', skills: ['React Native', 'Animations', 'Offline-first'] } },
  { candidate: { name: 'Omar Haddad', title: 'Security Engineer', initials: 'OH', hue: 250, city: 'Dubai', km: 15, skills: ['AppSec', 'Cloud security', 'SOC2'], salary: '$110k–$140k', fit: 88 },
    hr: { name: 'Fatima Noor', title: 'People Operations', initials: 'FN', hue: 30 },
    company: { name: 'Vaultline', logo: 'V', hue: 260, city: 'Dubai', role: 'Product Security Engineer', salary: '$110k–$140k', mode: 'Onsite · Full-time', blurb: 'Protect candidate data with privacy-first architecture.', skills: ['Threat modeling', 'SOPS', 'Zero trust'] } },
  { candidate: { name: 'Sofia Rossi', title: 'Frontend Engineer', initials: 'SR', hue: 20, city: 'Milan', km: 4, skills: ['React', 'CSS', 'Accessibility'], salary: '€55k–€70k', fit: 93 },
    hr: { name: 'Luca Bianchi', title: 'Hiring Manager', initials: 'LB', hue: 205 },
    company: { name: 'Lumen', logo: 'L', hue: 48, city: 'Milan', role: 'Frontend Engineer', salary: '€55k–€70k', mode: 'Hybrid · Full-time', blurb: 'Craft accessible interfaces for a design-led product.', skills: ['React', 'A11y', 'Design tokens'] } },
  { candidate: { name: 'Kwame Mensah', title: 'Backend Engineer', initials: 'KM', hue: 130, city: 'Accra', km: 9, skills: ['Node.js', 'PostgreSQL', 'APIs'], salary: '$60k–$80k', fit: 90 },
    hr: { name: 'Grace Owusu', title: 'Recruiting Partner', initials: 'GO', hue: 320 },
    company: { name: 'Harbor', logo: 'H', hue: 180, city: 'Accra', role: 'Backend Engineer', salary: '$60k–$80k', mode: 'Remote · Full-time', blurb: 'Scale the matching API from thousands to millions of swipes.', skills: ['Node.js', 'PostgreSQL', 'Queues'] } },
  { candidate: { name: 'Hana Sato', title: 'Product Manager', initials: 'HS', hue: 300, city: 'Tokyo', km: 7, skills: ['Roadmaps', 'Analytics', 'B2B2C'], salary: '¥12M–¥15M', fit: 95 },
    hr: { name: 'Ken Watanabe', title: 'VP of Product', initials: 'KW', hue: 210 },
    company: { name: 'Meridian', logo: 'M', hue: 210, city: 'Tokyo', role: 'Senior Product Manager', salary: '¥12M–¥15M', mode: 'Hybrid · Full-time', blurb: 'Own the employer-side funnel from discovery to hire.', skills: ['Product strategy', 'Experiments', 'SQL'] } },
  { candidate: { name: 'Elena Petrova', title: 'QA Automation Engineer', initials: 'EP', hue: 175, city: 'Warsaw', km: 11, skills: ['Playwright', 'CI', 'API testing'], salary: '€45k–€60k', fit: 87 },
    hr: { name: 'Piotr Nowak', title: 'Engineering Recruiter', initials: 'PN', hue: 5 },
    company: { name: 'Beacon', logo: 'B', hue: 285, city: 'Warsaw', role: 'QA Automation Engineer', salary: '€45k–€60k', mode: 'Hybrid · Full-time', blurb: 'Guard release quality across web, iOS, and Android.', skills: ['Playwright', 'Appium', 'GitHub Actions'] } },
];

export type CarouselSlide =
  | { kind: 'match'; story: CarouselStory }
  | { kind: 'candidate'; story: CarouselStory }
  | { kind: 'job'; story: CarouselStory };

export const CAROUSEL_SLIDES: CarouselSlide[] = CAROUSEL_STORIES.flatMap((story) => [
  { kind: 'match' as const, story },
  { kind: 'candidate' as const, story },
  { kind: 'job' as const, story },
]);
