export type Role = 'candidate' | 'employer';
export type View = 'home' | 'discover' | 'matches' | 'messages' | 'pipeline' | 'jobs' | 'analytics' | 'profile';
export type EmployerKind = 'company' | 'headhunter';
export type ProviderId = 'linkedin' | 'google' | 'email' | 'demo';

export interface FitFactor { factor: string; label: string; weight: number; score: number; evidence: string }
export type SalaryStatus = 'within' | 'below' | 'above' | 'unknown';
export interface MatchEvidence { score: number; matchedSkills: string[]; missingSkills?: string[]; extraSkills?: string[]; matchedLanguages: string[]; experienceFit: boolean; breakdown?: FitFactor[]; salaryStatus?: SalaryStatus }

export type ContactChannelType = 'whatsapp' | 'telegram' | 'phone' | 'signal' | 'wechat' | 'zalo' | 'email' | 'other';
export interface ContactChannel { type: ContactChannelType; value: string }
export type AgePrivacy = 'public' | 'after-match' | 'private';
export interface RecommendationRatings { technical?: number; communication?: number; reliability?: number; collaboration?: number; leadership?: number }
export interface Recommendation {
  recruiterName: string; company?: string; role?: string; text: string; date?: string; photo?: string;
  relationship?: string; wouldWorkAgain?: boolean; verified?: boolean; ratings?: RecommendationRatings; candidateResponse?: string;
}

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'exec';
export interface SkillTag { name: string; level: number; years?: number; lastUsed?: string }
export interface LanguageTag { name: string; level: string }
export interface WorkExperience { title?: string; company?: string; from?: string; to?: string; description?: string }
export interface Education { school?: string; degree?: string; from?: string; to?: string }
export interface ResumeMeta { id: string; originalName: string; storedName?: string; ext?: string; size: number; mime: string; uploadedAt: number; url: string; thumbnailUrl?: string; previewUrl?: string; needsClientThumbnail?: boolean; pdfName?: string; htmlName?: string; textName?: string; thumbName?: string }
export interface CandidatePreferences { desiredRoles?: string[]; employmentTypes?: string[]; workMode?: { mode: 'remote' | 'hybrid' | 'onsite'; hybridDays?: number }; salary?: { min?: number; max?: number; currency?: string; period?: string; negotiable?: boolean }; availability?: string; noticePeriod?: string; travel?: string; relocate?: { open: boolean; locations?: string[] }; companySize?: string; industries?: string[]; workStyle?: string[] }
export interface PrivacySettings { visibility?: 'all' | 'after-swipe' | 'paused'; blockedCompanies?: string[]; openToWork?: boolean }

export interface Person {
  id: string; role: Role; kind?: EmployerKind; name: string; email?: string; provider?: string; title: string;
  location?: string; distanceKm?: number; company?: string; photo: string; skills: string[]; languages: string[];
  experienceLevel: string; completeness?: number; availability?: string; match?: MatchEvidence; onboarding?: boolean; salaryHidden?: boolean; demo?: boolean; superLikedYou?: boolean; likedYou?: boolean; viewedYou?: boolean; verified?: boolean;
  // Candidate profile model (item 4)
  headline?: string; phone?: string; city?: string; country?: string; distanceRangeKm?: number;
  birthdate?: string; discloseAge?: boolean; agePrivacy?: AgePrivacy; nationality?: string; contactChannels?: ContactChannel[];
  workAuthorization?: string; visaSponsorship?: boolean; pronouns?: string;
  languageDetail?: LanguageTag[]; yearsExperience?: number; seniority?: Seniority; skillsDetail?: SkillTag[];
  industries?: string[]; workExperience?: WorkExperience[]; education?: Education[]; certifications?: string[];
  links?: { github?: string; portfolio?: string; website?: string; linkedin?: string };
  presentation?: string; aboutMeArchetype?: string; mindset?: string[]; humanSkills?: string[]; workingPrefer?: string[]; workingAvoid?: string[];
  interests?: string[]; motto?: string; favoriteSong?: string; recommendations?: Recommendation[];
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
  likedYou?: boolean;
  verified?: boolean;
  // Card-mirroring fields (job profile = 5 cards, like the candidate)
  openings?: number; urgency?: string; deadline?: string; // card 1
  successMeasures?: string[]; // card 2
  benefits?: string[]; workingHours?: string; flexibleHours?: string; probation?: string; // card 3
  bonus?: string; equity?: string; salaryNegotiable?: boolean; hybridDays?: number;
  visaSponsorship?: boolean; relocationSupport?: boolean; travel?: string; onCall?: string;
  teamSize?: string; teamComposition?: string[]; teamLocations?: string; // card 4
  managerName?: string; managerTitle?: string; managerStyle?: string;
  managementStyleTags?: string[]; teamStyle?: string[]; values?: string[]; teamSong?: string;
  hiringTimeline?: string; backgroundCheck?: boolean; referenceCheck?: boolean; // card 5
  companyRating?: number; reviewCount?: number; companyReviews?: JobReview[];
}
export interface JobReview { author?: string; role?: string; text: string; verified?: boolean; rating?: number; date?: string }

export interface SkillQuestions { skill: string; questions: string[] }
export interface InterviewPrep { generator: string; topics: string[]; skillQuestions: SkillQuestions[]; askThem: string }
export interface InterviewKit { generator: string; skillQuestions: SkillQuestions[]; gapProbes?: { skill: string; question: string }[]; gaps: string[]; salarySummary: string; salaryStatus: SalaryStatus }
export interface ScreeningAnswer { question: string; answer: string }
export type JobDraft = Partial<Omit<Job, 'id' | 'match'>>;
export interface JobMatch { id: string; candidateId: string; employerId: string; jobId: string; stage: string; createdAt: number; stageChangedAt?: number; candidate: Person; employer?: Person; job: Job; screeningAnswers?: ScreeningAnswer[] }
export interface Message { id: string; matchId: string; senderId: string; text: string; createdAt: number }
export interface ScheduledCall { id: string; matchId: string; createdBy: string; title: string; startAt: number; durationMinutes: number; notes?: string; createdAt: number }
export interface RoleMatchGroup { job: Job; candidates: Person[]; matchingCandidates?: Person[]; interestedCount: number; newCount: number }
export interface Bootstrap { viewer: Person; jobs: Job[]; candidates: Person[]; roleMatches?: RoleMatchGroup[]; matches: JobMatch[]; messages: Message[]; calls: ScheduledCall[]; bookmarkedIds: string[]; likesRemaining: number }

/** Minimal identity persisted for the demo session. */
export interface SessionUser { id: string; role: Role; kind?: EmployerKind; name: string; email?: string; photo?: string; provider?: string; isNew?: boolean; demo?: boolean; title?: string; company?: string; emailVerified?: boolean }

/** What the server allows for signing in (demo logins, real SSO availability). */
export interface AuthConfig { demoAuth: boolean; passwordMinLength: number; sso: { google: boolean; linkedin: boolean } }

export interface Review { id: string; name: string; role?: string; rating?: number; message: string; createdAt: number }
