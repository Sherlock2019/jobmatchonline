export type Role = 'candidate' | 'employer';
export type View = 'discover' | 'matches' | 'messages' | 'pipeline' | 'jobs' | 'analytics' | 'profile';
export type EmployerKind = 'company' | 'headhunter';
export type ProviderId = 'linkedin' | 'google' | 'email' | 'demo';

export interface MatchEvidence { score: number; matchedSkills: string[]; matchedLanguages: string[]; experienceFit: boolean }
export interface Person { id: string; role: Role; kind?: EmployerKind; name: string; email?: string; provider?: string; title: string; location?: string; distanceKm?: number; company?: string; photo: string; skills: string[]; languages: string[]; experienceLevel: string; completeness?: number; availability?: string; match?: MatchEvidence }
export interface Job { id: string; employerId: string; title: string; company: string; logo: string; accent: string; location: string; distanceKm?: number; workMode: string; salary: string; type: string; experienceLevel: string; requiredSkills: string[]; requiredLanguages: string[]; description: string; mission: string; culture: string[]; responseTime: string; applicants: number; status: string; match: MatchEvidence }
export interface JobMatch { id: string; candidateId: string; employerId: string; jobId: string; stage: string; createdAt: number; candidate: Person; job: Job }
export interface Message { id: string; matchId: string; senderId: string; text: string; createdAt: number }
export interface Bootstrap { viewer: Person; jobs: Job[]; candidates: Person[]; matches: JobMatch[]; messages: Message[]; likesRemaining: number }

/** Minimal identity persisted for the demo session. */
export interface SessionUser { id: string; role: Role; kind?: EmployerKind; name: string; email?: string; photo?: string; provider?: string; isNew?: boolean }
