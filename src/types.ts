export type Role = 'candidate' | 'employer' | 'admin';
export type View = 'home' | 'discover' | 'matches' | 'companies' | 'messages' | 'pipeline' | 'jobs' | 'analytics' | 'profile' | 'meetings' | 'saved' | 'selected' | 'coffee' | 'billing' | 'admin-billing';
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
  recruiterName: string; recommenderEmail?: string; company?: string; role?: string; text: string; date?: string; photo?: string;
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

export interface ProfileVariant { id: string; name: string; title: string; skills: string[]; desiredRoles?: string[]; updatedAt: number }
export interface RecommendationRequest { id: string; contact: string; method: 'email' | 'linkedin'; sentAt: number }

export interface Person {
  id: string; role: Role; kind?: EmployerKind; name: string; email?: string; provider?: string; title: string;
  demoOrder?: number;
  location?: string; distanceKm?: number; company?: string; photo: string; skills: string[]; languages: string[];
  experienceLevel: string; completeness?: number; availability?: string; match?: MatchEvidence; onboarding?: boolean; salaryHidden?: boolean; demo?: boolean; sample?: boolean; invitesSent?: number; superLikedYou?: boolean; likedYou?: boolean; viewedYou?: boolean; verified?: boolean;
  /** Paid placement. Moves the card up the deck; the match score is untouched. */
  promoted?: boolean;
  // Candidate profile model (item 4)
  headline?: string; phone?: string; city?: string; country?: string; distanceRangeKm?: number;
  birthdate?: string; discloseAge?: boolean; agePrivacy?: AgePrivacy; nationality?: string; contactChannels?: ContactChannel[];
  workAuthorization?: string; visaSponsorship?: boolean; pronouns?: string;
  languageDetail?: LanguageTag[]; yearsExperience?: number; seniority?: Seniority; skillsDetail?: SkillTag[];
  industries?: string[]; workExperience?: WorkExperience[]; education?: Education[]; certifications?: string[];
  links?: { github?: string; portfolio?: string; website?: string; linkedin?: string; appStore?: string; playStore?: string };
  /** Links to articles, papers, or talks — shown on the "What I Have Built" card. */
  publications?: string[];
  presentation?: string; aboutMeArchetype?: string; mindset?: string[]; humanSkills?: string[]; workingPrefer?: string[]; workingAvoid?: string[];
  interests?: string[]; motto?: string; favoriteSong?: string; recommendations?: Recommendation[];
  /** Pending "please recommend me" invites sent to a LinkedIn profile or email — private, owner-only. */
  recommendationRequests?: RecommendationRequest[];
  preferences?: CandidatePreferences; documents?: { resume?: ResumeMeta; coverLetter?: string }; privacy?: PrivacySettings;
  /** Named presets of title/skills/desired-roles a candidate can snapshot and
   * switch between — e.g. a "Frontend Engineer" persona vs a "Product
   * Manager" one — so the same account can present differently per job type. */
  profileVariants?: ProfileVariant[]; activeVariantId?: string;
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
  companyLogo?: string;
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
  sample?: boolean;
  superLikedYou?: boolean;
  likedYou?: boolean;
  verified?: boolean;
  /** Paid placement. Moves the card up the deck; the match score is untouched. */
  promoted?: boolean;
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
  sourceSystem?: string; sourceJobId?: string; sourceUrl?: string; sourceUpdatedAt?: string;
  internalJobId?: string; contentHash?: string; syncStatus?: string; lastImportedAt?: number;
  importNeedsReview?: string[];
  /** Public recruiter/hiring-contact info shown on the role's Team & culture card (no contact details pre-match). */
  recruiter?: { name?: string; title?: string; photo?: string; company?: string };
}
export interface JobReview { author?: string; role?: string; text: string; verified?: boolean; rating?: number; date?: string }

export interface SkillQuestions { skill: string; questions: string[] }
export interface InterviewPrep { generator: string; topics: string[]; skillQuestions: SkillQuestions[]; askThem: string }
export interface InterviewKit { generator: string; skillQuestions: SkillQuestions[]; gapProbes?: { skill: string; question: string }[]; gaps: string[]; salarySummary: string; salaryStatus: SalaryStatus }
export interface ScreeningAnswer { question: string; answer: string }
export type JobDraft = Partial<Omit<Job, 'id' | 'match'>>;
export interface JobImportResult { jobs: Job[]; found: number; skipped: number }
export interface PipelineStep { id: string; name: string; owner: string; hidden?: boolean }
export interface JobMatch { id: string; candidateId: string; employerId: string; jobId: string; stage: string; createdAt: number; stageChangedAt?: number; candidate: Person; employer?: Person; job: Job; screeningAnswers?: ScreeningAnswer[]; pipeline?: PipelineStep[]; currentStepId?: string }
export interface Message { id: string; matchId: string; senderId: string; text: string; createdAt: number }
export interface ScheduledCall { id: string; matchId: string; createdBy: string; title: string; startAt: number; durationMinutes: number; notes?: string; createdAt: number }
export interface RoleMatchGroup { job: Job; candidates: Person[]; matchingCandidates?: Person[]; interestedCount: number; newCount: number }
/** A viewer's private note about a specific job or candidate — visible only to its author. */
export interface Note { id: string; userId: string; targetId: string; targetType: 'job' | 'candidate'; text: string; updatedAt: number }
// Recruiter billing (candidates never see any of this).
export type SubscriptionStatus = 'trialing' | 'active' | 'grace_period' | 'past_due' | 'expired' | 'suspended' | 'cancelled';
export interface Subscription {
  id: string; recruiterUserId: string; planCode: string; status: SubscriptionStatus; priceAmount: number; priceCurrency: string;
  trialStartedAt: number; trialEndsAt: number; currentPeriodStartedAt: number | null; currentPeriodEndsAt: number | null;
  gracePeriodEndsAt: number | null; cancelledAt: number | null; suspendedAt: number | null; createdAt: number; updatedAt: number;
}
export interface SubscriptionCredit {
  id: string; recruiterUserId: string; sourceType: 'referral' | 'admin_credit'; sourceReferenceId: string; durationDays: number;
  status: 'available' | 'consumed' | 'revoked' | 'expired'; grantedAt: number; consumedAt: number | null; revokedAt: number | null;
}
export type PaymentMethod = 'vietqr' | 'bank_transfer' | 'international_bank_transfer' | 'admin_credit' | 'vnpay' | 'google_play' | 'apple_iap' | 'stripe' | 'paypal';
export type PaymentStatus = 'pending' | 'submitted' | 'confirmed' | 'rejected' | 'refunded' | 'reversed';
export interface Payment {
  id: string; recruiterUserId: string; subscriptionId: string; amount: number; currency: string; paymentMethod: PaymentMethod;
  status: PaymentStatus; paymentReference: string | null; invoiceNumber: string; payerName: string | null; bankName: string | null;
  transferDate: string | null; proofFileUrl: string | null; adminNote: string | null; confirmedByAdminId: string | null;
  confirmedBySource?: 'admin' | 'vnpay' | 'google_play' | 'apple_iap' | 'stripe' | 'paypal'; confirmedAt: number | null; createdAt: number; updatedAt: number;
  recruiter?: { id: string; name: string; email?: string; company?: string } | null;
}
export interface PaymentInstructions { bankAccountName: string; bankName: string; bankAccountNumber: string; bankSwift: string; vietQrImageUrl: string; supportEmail: string }
export interface BillingInfo {
  subscription: Subscription; effectiveStatus: SubscriptionStatus; canPublishJob?: boolean; credits: SubscriptionCredit[]; referralCode: string;
  instructions?: PaymentInstructions; vnpayEnabled?: boolean; vnpayAmountVnd?: number; stripeEnabled?: boolean; paypalEnabled?: boolean;
  googlePlayEnabled?: boolean; googlePlayProductId?: string; appleEnabled?: boolean; appleProductId?: string;
  entitlements?: RecruiterEntitlements;
  plan?: PlanSummary; team?: TeamInfo;
  verification?: RecruiterVerification; trial?: TrialInfo; postings?: PostingsInfo;
}
export interface Referral { id: string; referrerUserId: string; referredUserId: string; referralCode: string; status: string; suspicious?: boolean; qualifiedPaymentId: string | null; qualifiedAt: number | null; createdAt: number }
export interface BillingEvent { id: string; userId: string | null; eventType: string; entityType: string; entityId: string; metadata: Record<string, unknown>; createdAt: number }
export interface AdminRecruiterStatus { recruiter: { id: string; name: string; email?: string; company?: string }; subscription?: Subscription; effectiveStatus: SubscriptionStatus }

export interface BillingNotification { id: string; kind: string; text: string; createdAt: number; read?: boolean; jobId?: string }

/** Plan limits and current usage, computed server-side (never trusted from the
 *  client) and returned alongside the subscription. */
export interface RecruiterEntitlements {
  planCode: 'trial' | 'free' | 'pro';
  activeJobLimit: number;
  activeJobCount: number;
  jobCreditBalance: number;
  nextFreeJobAvailableAt: number | null;
  freeJobAvailable: boolean;
  jobEditingAllowed: boolean;
  enforced: boolean;
}

export interface JobPostCredit {
  id: string; recruiterUserId: string; recruiterName?: string; sourceType: string; sourceReferenceId: string | null;
  status: 'available' | 'consumed' | 'revoked'; grantedAt: number; consumedAt: number | null;
  revokedAt: number | null; consumedByJobId: string | null;
}

export interface AdminPlanRow extends RecruiterEntitlements {
  recruiter: { id: string; name: string; email?: string; company?: string };
  effectiveStatus: SubscriptionStatus;
  trialEndsAt: number | null;
  currentPeriodEndsAt: number | null;
}

export interface CatalogPlan {
  key: string; display: string; order: number; seats: number; liveJobSlots: number;
  monthlyMatchCap: number | null; analytics: boolean; atsExport: boolean; priorityPlacement: boolean;
  usd: number; vnd: number; hireFeePercent: number | null;
}
export interface PlanCatalog {
  plans: CatalogPlan[];
  extraSeat: { seats: number; liveJobSlots: number; usd: number; vnd: number; availableOn: string[] };
  boost: { hours: number; usd: number; vnd: number; kinds: string[] };
  singlePosting: { termDays: number; usd: number; vnd: number };
  payPerHireFeePercent: number;
  postingTermDays: number;
  trialDays: number;
}
export interface AdminTeamRow {
  id: string; owner: string; planCode: string; extraSeats: number;
  seatsAllowed: number; active: number; total: number;
}
export interface BoostRecord {
  id: string; kind: 'job' | 'candidate'; targetId: string; targetName?: string;
  purchasedByUserId: string; buyerName?: string; amount: number; currency: string;
  status: 'active' | 'expired' | 'revoked'; startedAt: number; expiresAt: number; live?: boolean;
}

export interface AdminPlansOverview {
  enforced: boolean;
  planCounts: Record<string, number>;
  recruiters: AdminPlanRow[];
  creditLedger: JobPostCredit[];
  shadowBlocks: (BillingEvent & { userName?: string })[];
  catalog: PlanCatalog;
  teams: AdminTeamRow[];
  boosts: BoostRecord[];
}

/** Seats on the recruiter's own Subscription page. */
export interface TeamInfo {
  teamId: string | null; isOwner: boolean; seatsAllowed: number; seatsUsed: number;
  extraSeats: number; extraSeatPrice: number | null; canBuyExtraSeats: boolean;
  members: { userId: string; name: string; role: 'owner' | 'member'; status: 'active' | 'readonly'; joinedAt: number | null }[];
}
export interface PlanSummary {
  planCode: string; key: string; display: string; currency: string;
  monthly: number | null; annual: number | null;
  seats: number; liveJobSlots: number; analytics: boolean; atsExport: boolean;
}
export interface RecruiterVerification {
  verified: boolean; method: string | null; domain?: string; reason?: string; message?: string;
}
export interface TrialInfo {
  days: number | null; startedAt: number | null; endsAt: number | null; extendedForHire: boolean;
}
export interface PostingsInfo {
  termDays: number; live: number; paused: number; lockedSlots: number; verifiedHire: boolean;
}
export interface Bootstrap { viewer: Person; jobs: Job[]; candidates: Person[]; roleMatches?: RoleMatchGroup[]; matches: JobMatch[]; messages: Message[]; calls: ScheduledCall[]; notes: Note[]; bookmarkedIds: string[]; likesRemaining: number; billing?: BillingInfo; billingNotifications?: BillingNotification[] }

// Admin: account management, fraud/scam reports, support requests (minimal —
// no roles/invitations, no incident state machine, see admin plan notes).
export type ReportCategory = 'fake_job' | 'scam_or_fraud' | 'harassment' | 'discrimination' | 'spam' | 'payment_request' | 'impersonation' | 'other';
export interface Report {
  id: string; reporterUserId: string; reporterName?: string; targetType: 'user' | 'job' | 'conversation'; targetId: string;
  category: ReportCategory; description: string | null; status: 'open' | 'resolved' | 'dismissed';
  resolution: string | null; resolvedByAdminId: string | null; resolvedAt: number | null; createdAt: number;
}
export interface SupportRequest {
  id: string; userId: string | null; name: string; email: string; message: string;
  status: 'open' | 'resolved'; resolvedByAdminId: string | null; resolvedAt: number | null; createdAt: number;
}
export interface AdminUserSummary {
  id: string; role: Role; kind?: EmployerKind; name: string; email?: string; company?: string; photo?: string;
  completeness?: number; emailVerified: boolean; createdAt: number; suspendedAt: number | null; suspendReason: string | null; flaggedForJobReview: boolean;
}
export interface AdminUserDetail { user: AdminUserSummary; jobsPosted?: number; matchCount: number; messageCount: number; reportsSubmitted: number; reportsReceived: number }
export interface AdminJobSummary {
  id: string; title: string; company: string; status: string; createdAt?: number; applicants: number;
  employer: { id: string; name: string; email?: string; flaggedForJobReview: boolean } | null;
}
export type ActionQueueType = 'report' | 'support' | 'payment' | 'fair_use_flag' | 'trial_ending';
export interface ActionQueueItem {
  id: string; type: ActionQueueType; priority: 'urgent' | 'high' | 'medium'; summary: string;
  detail: string | null; submittedBy: string; createdAt: number;
}
export interface AdminAnalyticsOverview {
  totalCandidates: number; newCandidates7d: number; newCandidates30d: number;
  totalRecruiters: number; newRecruiters7d: number; newRecruiters30d: number;
  totalJobs: number; activeJobs: number; totalMatches: number; newMatches7d: number; totalMessages: number;
  mrr: number; mrrCurrency: string; activeSubscriptions: number; trialToPaidConversionPct: number;
  confirmedPaymentsCount: number; confirmedPayments30d: number;
}

/** Minimal identity persisted for the demo session. */
export interface SessionUser { id: string; role: Role; kind?: EmployerKind; name: string; email?: string; photo?: string; provider?: string; isNew?: boolean; demo?: boolean; title?: string; company?: string; emailVerified?: boolean }

/** What the server allows for signing in (demo logins, real SSO availability). */
export interface AuthConfig { demoAuth: boolean; passwordMinLength: number; sso: { google: boolean; linkedin: boolean } }

export interface Review { id: string; name: string; role?: string; rating?: number; message: string; createdAt: number }
