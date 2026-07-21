export type Role = 'candidate' | 'employer';
export type View = 'discover' | 'matches' | 'messages' | 'pipeline' | 'jobs' | 'analytics' | 'profile';
export type EmployerKind = 'company' | 'headhunter';
export type ProviderId = 'linkedin' | 'google' | 'email' | 'demo';

export interface MatchEvidence { score: number; matchedSkills: string[]; matchedLanguages: string[]; experienceFit: boolean }

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'exec';
export interface SkillTag { name: string; level: number }
export interface LanguageTag { name: string; level: string }
export interface WorkExperience { title?: string; company?: string; from?: string; to?: string; description?: string }
export interface Education { school?: string; degree?: string; from?: string; to?: string }
export interface ResumeMeta { id: string; originalName: string; storedName?: string; ext?: string; size: number; mime: string; uploadedAt: number; url: string; thumbnailUrl?: string; previewUrl?: string }
export interface CandidatePreferences { desiredRoles?: string[]; employmentTypes?: string[]; workMode?: { mode: 'remote' | 'hybrid' | 'onsite'; hybridDays?: number }; salary?: { min?: number; max?: number; currency?: string }; availability?: string; relocate?: { open: boolean; locations?: string[] }; companySize?: string; workStyle?: string[] }
export interface PrivacySettings { visibility?: 'all' | 'after-swipe' | 'paused'; blockedCompanies?: string[]; openToWork?: boolean }

export interface Person {
  id: string; role: Role; kind?: EmployerKind; name: string; email?: string; provider?: string; title: string;
  location?: string; distanceKm?: number; company?: string; photo: string; skills: string[]; languages: string[];
  experienceLevel: string; completeness?: number; availability?: string; match?: MatchEvidence; onboarding?: boolean;
  // Candidate profile model (item 4)
  headline?: string; phone?: string; city?: string; country?: string; distanceRangeKm?: number;
  languageDetail?: LanguageTag[]; yearsExperience?: number; seniority?: Seniority; skillsDetail?: SkillTag[];
  industries?: string[]; workExperience?: WorkExperience[]; education?: Education[]; certifications?: string[];
  links?: { github?: string; portfolio?: string; website?: string; linkedin?: string };
  preferences?: CandidatePreferences; documents?: { resume?: ResumeMeta; coverLetter?: string }; privacy?: PrivacySettings;
  // Recruiter profile model (item 5)
  companyLogo?: string; website?: string; industry?: string; companySize?: string; headquarters?: string;
  officeLocations?: string[]; foundedYear?: number; about?: string; benefits?: string[]; techStack?: string[];
  linkedinUrl?: string; specializations?: string[]; regions?: string[]; clients?: string[];
  contactName?: string; contactEmail?: string; calendarLink?: string;
}
export interface Job { id: string; employerId: string; title: string; company: string; logo: string; accent: string; location: string; distanceKm?: number; workMode: string; salary: string; type: string; experienceLevel: string; requiredSkills: string[]; requiredLanguages: string[]; description: string; mission: string; culture: string[]; responseTime: string; applicants: number; status: string; match: MatchEvidence }
export interface JobMatch { id: string; candidateId: string; employerId: string; jobId: string; stage: string; createdAt: number; candidate: Person; job: Job }
export interface Message { id: string; matchId: string; senderId: string; text: string; createdAt: number }
export interface Bootstrap { viewer: Person; jobs: Job[]; candidates: Person[]; matches: JobMatch[]; messages: Message[]; likesRemaining: number }

/** Minimal identity persisted for the demo session. */
export interface SessionUser { id: string; role: Role; kind?: EmployerKind; name: string; email?: string; photo?: string; provider?: string; isNew?: boolean }
