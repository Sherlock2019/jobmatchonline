export type Role = 'candidate' | 'employer';
export type View = 'discover' | 'matches' | 'messages' | 'pipeline' | 'jobs' | 'analytics' | 'profile';
export type EmployerKind = 'company' | 'headhunter';
export type ProviderId = 'linkedin' | 'google' | 'email' | 'demo';

export interface FitFactor { factor: string; label: string; weight: number; score: number; evidence: string }
export type SalaryStatus = 'within' | 'below' | 'above' | 'unknown';
export interface MatchEvidence { score: number; matchedSkills: string[]; matchedLanguages: string[]; experienceFit: boolean; breakdown?: FitFactor[]; salaryStatus?: SalaryStatus }

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'exec';
export interface SkillTag { name: string; level: number }
export interface LanguageTag { name: string; level: string }
export interface WorkExperience { title?: string; company?: string; from?: string; to?: string; description?: string }
export interface Education { school?: string; degree?: string; from?: string; to?: string }
export interface ResumeMeta { id: string; originalName: string; storedName?: string; ext?: string; size: number; mime: string; uploadedAt: number; url: string; thumbnailUrl?: string; previewUrl?: string; needsClientThumbnail?: boolean; pdfName?: string; htmlName?: string; textName?: string; thumbName?: string }
export interface CandidatePreferences { desiredRoles?: string[]; employmentTypes?: string[]; workMode?: { mode: 'remote' | 'hybrid' | 'onsite'; hybridDays?: number }; salary?: { min?: number; max?: number; currency?: string }; availability?: string; relocate?: { open: boolean; locations?: string[] }; companySize?: string; workStyle?: string[] }
export interface PrivacySettings { visibility?: 'all' | 'after-swipe' | 'paused'; blockedCompanies?: string[]; openToWork?: boolean }

export interface Person {
  id: string; role: Role; kind?: EmployerKind; name: string; email?: string; provider?: string; title: string;
  location?: string; distanceKm?: number; company?: string; photo: string; skills: string[]; languages: string[];
  experienceLevel: string; completeness?: number; availability?: string; match?: MatchEvidence; onboarding?: boolean; salaryHidden?: boolean; demo?: boolean; superLikedYou?: boolean; verified?: boolean;
  // Candidate profile model (item 4)
  headline?: string; phone?: string; city?: string; country?: string; distanceRangeKm?: number;
  languageDetail?: LanguageTag[]; yearsExperience?: number; seniority?: Seniority; skillsDetail?: SkillTag[];
  industries?: string[]; workExperience?: WorkExperience[]; education?: Education[]; certifications?: string[];
  links?: { github?: string; portfolio?: string; website?: string; linkedin?: string };
  preferences?: CandidatePreferences; documents?: { resume?: ResumeMeta; coverLetter?: string }; privacy?: PrivacySettings;
  // Recruiter profile model (item 5)
  geo?: { lat: number; lng: number };
  companyLogo?: string; website?: string; industry?: string; companySize?: string; headquarters?: string;
  officeLocations?: string[]; foundedYear?: number; about?: string; benefits?: string[]; techStack?: string[];
  linkedinUrl?: string; specializations?: string[]; regions?: string[]; clients?: string[];
  contactName?: string; contactEmail?: string; calendarLink?: string;
}
export interface WeightedSkill { name: string; weight: number }
export interface SalaryRange { min: number; max: number; currency: string }
export interface Job {
  id: string; employerId: string; title: string; company: string; logo: string; accent: string; location: string;
  distanceKm?: number; workMode: string; salary: string; type: string; experienceLevel: string;
  requiredSkills: string[]; requiredLanguages: string[]; description: string; mission: string; culture: string[];
  responseTime: string; applicants: number; status: string; match: MatchEvidence;
  // Item 7 structured fields
  department?: string; seniority?: Seniority; requiredSkillsDetail?: WeightedSkill[]; niceToHaves?: string[];
  remoteScope?: 'country' | 'worldwide'; country?: string; geo?: { lat: number; lng: number };
  hiringRadiusKm?: number; salaryRange?: SalaryRange; responsibilities?: string[]; interviewProcess?: string[];
  startDate?: string; externalUrl?: string; createdAt?: number; coverImage?: string;
  /** true when the exact range is withheld pre-match (mutual salary reveal) */
  salaryHidden?: boolean;
  screeningQuestions?: string[];
  demo?: boolean;
  superLikedYou?: boolean;
  verified?: boolean;
}

export interface SkillQuestions { skill: string; questions: string[] }
export interface InterviewPrep { generator: string; topics: string[]; skillQuestions: SkillQuestions[]; askThem: string }
export interface InterviewKit { generator: string; skillQuestions: SkillQuestions[]; gapProbes?: { skill: string; question: string }[]; gaps: string[]; salarySummary: string; salaryStatus: SalaryStatus }
export interface ScreeningAnswer { question: string; answer: string }
export type JobDraft = Partial<Omit<Job, 'id' | 'match'>>;
export interface JobMatch { id: string; candidateId: string; employerId: string; jobId: string; stage: string; createdAt: number; stageChangedAt?: number; candidate: Person; job: Job; screeningAnswers?: ScreeningAnswer[] }
export interface Message { id: string; matchId: string; senderId: string; text: string; createdAt: number }
export interface Bootstrap { viewer: Person; jobs: Job[]; candidates: Person[]; matches: JobMatch[]; messages: Message[]; likesRemaining: number }

/** Minimal identity persisted for the demo session. */
export interface SessionUser { id: string; role: Role; kind?: EmployerKind; name: string; email?: string; photo?: string; provider?: string; isNew?: boolean; demo?: boolean; title?: string; company?: string; emailVerified?: boolean }

/** What the server allows for signing in (demo logins, real SSO availability). */
export interface AuthConfig { demoAuth: boolean; passwordMinLength: number; sso: { google: boolean; linkedin: boolean } }

export interface Review { id: string; name: string; role?: string; rating?: number; message: string; createdAt: number }
