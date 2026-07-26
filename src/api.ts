import type { ActionQueueItem, AdminAnalyticsOverview, AdminJobSummary, AdminRecruiterStatus, AdminUserDetail, AdminUserSummary, AuthConfig, BillingEvent, BillingInfo, Bootstrap, EmployerKind, InterviewKit, InterviewPrep, Job, JobDraft, JobImportResult, JobMatch, Message, Note, Payment, PaymentMethod, PipelineStep, Person, ProfileVariant, RecommendationRequest, Referral, Report, ReportCategory, ResumeMeta, Review, Role, ScheduledCall, ScreeningAnswer, SessionUser, SupportRequest, WeightedSkill } from './types';

export const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  // credentials: session cookie must travel on native (Capacitor) origins too
  const response = await fetch(`${apiBase}${url}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body as T;
}

export const api = {
  bootstrap: (userId: string) => request<Bootstrap>(`/api/bootstrap?userId=${encodeURIComponent(userId)}`),
  authConfig: () => request<AuthConfig>('/api/auth/config'),
  showcase: () => request<{ jobs: Job[]; candidates: Person[] }>('/api/showcase'),
  reviews: () => request<{ reviews: Review[] }>('/api/feedback'),
  submitFeedback: (payload: { type: 'review' | 'suggestion'; message: string; name?: string; role?: string; rating?: number }) => request<{ ok: boolean; pending?: boolean }>('/api/feedback', { method: 'POST', body: JSON.stringify(payload) }),
  authProfiles: () => request<{ profiles: SessionUser[] }>('/api/auth/profiles'),
  login: (userId: string) => request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId }) }),
  loginPassword: (email: string, password: string) => request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  ssoLogin: (provider: 'linkedin' | 'google') => request<{ user: SessionUser }>('/api/auth/sso', { method: 'POST', body: JSON.stringify({ provider }) }),
  register: (payload: { role: Role; kind?: EmployerKind; provider?: string; name: string; email: string; password?: string; photo?: string; conductAccepted?: boolean }) => request<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request<{ authenticated: boolean; user: SessionUser }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) => request<{ ok: boolean; mailer: boolean }>('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) => request<{ ok: boolean; user: SessionUser }>('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) }),
  resendVerification: () => request<{ ok: boolean; mailer: boolean }>('/api/auth/resend-verification', { method: 'POST' }),
  deleteAccount: () => request<{ ok: boolean }>('/api/me', { method: 'DELETE' }),
  updateProfile: (userId: string, payload: Partial<Person> & { onboarding?: boolean }) => request<{ user: Person }>(`/api/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadResume: async (userId: string, file: File): Promise<{ resume: ResumeMeta; completeness: number }> => {
    const response = await fetch(`${apiBase}/api/users/${encodeURIComponent(userId)}/resume`, { method: 'POST', headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) }, body: file });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Upload failed');
    return body;
  },
  uploadResumeThumbnail: async (userId: string, blob: Blob): Promise<void> => {
    await fetch(`${apiBase}/api/users/${encodeURIComponent(userId)}/resume/thumbnail`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
  },
  uploadPhoto: async (userId: string, file: File | Blob): Promise<{ photo: string }> => {
    const response = await fetch(`${apiBase}/api/users/${encodeURIComponent(userId)}/photo`, { method: 'POST', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Photo upload failed');
    return body;
  },
  createJob: (payload: JobDraft & { employerId: string }) => request<{ job: Job }>('/api/jobs', { method: 'POST', body: JSON.stringify(payload) }),
  importJobFile: async (employerId: string, sourceSystem: string, file: File): Promise<JobImportResult> => {
    const params = new URLSearchParams({ employerId, sourceSystem });
    const response = await fetch(`${apiBase}/api/jobs/import-file?${params}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) }, body: file });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Could not import that file');
    return body as JobImportResult;
  },
  importLinkedInJobs: (employerId: string, jobs: { url: string; title?: string; description: string }[]) => request<JobImportResult>('/api/jobs/import-linkedin', { method: 'POST', body: JSON.stringify({ employerId, jobs }) }),
  updateJob: (id: string, payload: JobDraft) => request<{ job: Job }>(`/api/jobs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadJobCover: async (jobId: string, file: File): Promise<{ coverImage: string }> => {
    const response = await fetch(`${apiBase}/api/jobs/${encodeURIComponent(jobId)}/cover`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': file.type }, body: file });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Cover upload failed');
    return body;
  },
  parseJob: (payload: { text: string; url?: string }) => request<{ parser: 'claude' | 'heuristic'; parsed: JobDraft }>('/api/jobs/parse', { method: 'POST', body: JSON.stringify(payload) }),
  parseJobFile: async (file: File): Promise<{ parser: string; parsed: JobDraft }> => {
    const response = await fetch(`${apiBase}/api/jobs/parse-file`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': file.type || 'text/plain' }, body: file });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Could not parse that file');
    return body;
  },
  resumeAutofill: (userId: string) => request<{ generator: string; fields: Partial<Person> & { skills?: { name: string; level: number }[]; languages?: { name: string; level: string }[] } }>(`/api/users/${encodeURIComponent(userId)}/resume/autofill`, { method: 'POST' }),
  jobPrep: (jobId: string) => request<InterviewPrep>(`/api/jobs/${encodeURIComponent(jobId)}/prep`),
  suggestScreening: (requiredSkillsDetail: WeightedSkill[]) => request<{ questions: string[] }>('/api/coach/screening', { method: 'POST', body: JSON.stringify({ requiredSkillsDetail }) }),
  matchKit: (matchId: string) => request<InterviewKit>(`/api/matches/${encodeURIComponent(matchId)}/kit`),
  matchIcebreakers: (matchId: string) => request<{ icebreakers: string[]; generator: string }>(`/api/matches/${encodeURIComponent(matchId)}/icebreakers`),
  swipe: (payload: { actorId: string; targetId: string; targetType: 'job' | 'candidate'; direction: 'like' | 'pass'; superLike?: boolean; answers?: ScreeningAnswer[] }) => request<{ match: JobMatch | null; likesRemaining: number; duplicate: boolean }>('/api/swipes', { method: 'POST', body: JSON.stringify(payload) }),
  undoSwipe: (actorId: string) => request<{ undone: { targetId: string; targetType: string; direction: string } | null; likesRemaining?: number }>('/api/swipes/undo', { method: 'POST', body: JSON.stringify({ actorId }) }),
  updateStage: (id: string, stage: string) => request<JobMatch>(`/api/matches/${id}`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  updateMatchPipeline: (id: string, pipeline: PipelineStep[], currentStepId: string) => request<JobMatch>(`/api/matches/${id}/pipeline`, { method: 'PATCH', body: JSON.stringify({ pipeline, currentStepId }) }),
  sendFeedbackEmail: (matchId: string, message: string) => request<{ ok: boolean; mailer: boolean }>(`/api/matches/${matchId}/feedback-email`, { method: 'POST', body: JSON.stringify({ message }) }),
  sendRecommendationEmail: (matchId: string, recruiterEmail: string, message?: string) => request<{ ok: boolean; mailer: boolean }>(`/api/matches/${matchId}/recommend-email`, { method: 'POST', body: JSON.stringify({ recruiterEmail, message }) }),
  message: (payload: { matchId: string; senderId: string; text: string }) => request<Message>('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
  scheduleCall: (payload: { matchId: string; createdBy: string; title: string; startAt: number; durationMinutes: number; notes?: string }) => request<ScheduledCall>('/api/calls', { method: 'POST', body: JSON.stringify(payload) }),
  toggleBookmark: (payload: { userId: string; targetId: string; targetType: 'job' | 'candidate' }) => request<{ bookmarked: boolean }>('/api/bookmarks/toggle', { method: 'POST', body: JSON.stringify(payload) }),
  saveNote: (payload: { userId: string; targetId: string; targetType: 'job' | 'candidate'; text: string }) => request<Note>('/api/notes', { method: 'POST', body: JSON.stringify(payload) }),
  saveProfileVariant: (payload: { userId: string; name: string; title?: string; skills?: string[] }) => request<ProfileVariant>('/api/profile-variants', { method: 'POST', body: JSON.stringify(payload) }),
  activateProfileVariant: (id: string, userId: string) => request<{ user: Person }>(`/api/profile-variants/${id}/activate`, { method: 'POST', body: JSON.stringify({ userId }) }),
  deleteProfileVariant: (id: string, userId: string) => request<{ ok: boolean }>(`/api/profile-variants/${id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  requestRecommendation: (payload: { userId: string; contact: string }) => request<{ request: RecommendationRequest; mailer: boolean }>('/api/recommendation-requests', { method: 'POST', body: JSON.stringify(payload) }),
  cancelRecommendationRequest: (id: string, userId: string) => request<{ ok: boolean }>(`/api/recommendation-requests/${id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  deleteJob: (id: string) => request<{ ok: boolean }>(`/api/jobs/${id}`, { method: 'DELETE' }),
  sendInvite: (userId: string) => request<{ invitesSent: number }>(`/api/users/${encodeURIComponent(userId)}/invite`, { method: 'POST' }),

  // --- Recruiter billing (candidates never call any of this) ---
  billingSubscription: (userId: string) => request<BillingInfo>(`/api/billing/subscription?userId=${encodeURIComponent(userId)}`),
  startTrial: (userId: string) => request<BillingInfo>('/api/billing/start-trial', { method: 'POST', body: JSON.stringify({ userId }) }),
  billingReferral: (userId: string) => request<{ referralCode: string; successfulReferrals: number; pendingReferrals: number; credits: BillingInfo['credits'] }>(`/api/billing/referral?userId=${encodeURIComponent(userId)}`),
  trackReferral: (code: string) => request<{ ok: boolean }>('/api/billing/referral/track', { method: 'POST', body: JSON.stringify({ code }) }),
  submitPayment: (payload: { userId: string; paymentMethod: PaymentMethod; payerName?: string; bankName?: string; transferDate?: string }) => request<Payment>('/api/billing/payments', { method: 'POST', body: JSON.stringify(payload) }),
  startVnpayPayment: (userId: string) => request<{ payment: Payment; redirectUrl: string }>('/api/billing/payments/vnpay/create', { method: 'POST', body: JSON.stringify({ userId }) }),
  startStripeCheckout: (userId: string) => request<{ payment: Payment; redirectUrl: string }>('/api/billing/payments/stripe/create-checkout-session', { method: 'POST', body: JSON.stringify({ userId }) }),
  startPaypalSubscription: (userId: string) => request<{ payment: Payment; redirectUrl: string | null }>('/api/billing/payments/paypal/create-subscription', { method: 'POST', body: JSON.stringify({ userId }) }),
  verifyGooglePlayPurchase: (userId: string, purchaseToken: string) => request<{ payment: Payment; alreadyConfirmed?: boolean }>('/api/billing/payments/google-play/verify', { method: 'POST', body: JSON.stringify({ userId, purchaseToken }) }),
  verifyApplePurchase: (userId: string, transactionId: string) => request<{ payment: Payment; alreadyConfirmed?: boolean }>('/api/billing/payments/apple/verify', { method: 'POST', body: JSON.stringify({ userId, transactionId }) }),
  uploadPaymentProof: async (paymentId: string, file: File): Promise<Payment> => {
    const response = await fetch(`${apiBase}/api/billing/payments/${paymentId}/proof`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': file.type }, body: file });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Proof upload failed');
    return body;
  },
  myPayments: (userId: string) => request<{ payments: Payment[] }>(`/api/billing/payments?userId=${encodeURIComponent(userId)}`),

  // --- Admin billing dashboard (role: 'admin' only) ---
  adminBillingOverview: () => request<{
    pendingPayments: Payment[]; confirmedPayments: Payment[]; rejectedOrRefundedPayments: Payment[];
    activeTrials: AdminRecruiterStatus[]; trialsEndingSoon: AdminRecruiterStatus[]; graceAccounts: AdminRecruiterStatus[]; expiredAccounts: AdminRecruiterStatus[];
    referralRewards: Referral[]; suspiciousReferrals: Referral[]; flaggedForJobReview: { id: string; name: string; email?: string }[]; recentAuditLog: BillingEvent[];
  }>('/api/admin/billing/overview'),
  adminConfirmPayment: (id: string) => request<{ payment: Payment; alreadyConfirmed?: boolean }>(`/api/admin/billing/payments/${id}/confirm`, { method: 'POST' }),
  adminRejectPayment: (id: string, reason: string) => request<Payment>(`/api/admin/billing/payments/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminRefundPayment: (id: string, reason?: string) => request<Payment>(`/api/admin/billing/payments/${id}/refund`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminGrantCredit: (recruiterUserId: string, reason: string, durationDays?: number) => request<unknown>('/api/admin/billing/credits', { method: 'POST', body: JSON.stringify({ recruiterUserId, reason, durationDays }) }),
  adminRevokeCredit: (id: string, reason: string) => request<unknown>(`/api/admin/billing/credits/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminSuspendSubscription: (id: string, reason?: string) => request<unknown>(`/api/admin/billing/subscriptions/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminReactivateSubscription: (id: string) => request<unknown>(`/api/admin/billing/subscriptions/${id}/reactivate`, { method: 'POST' }),
  adminExtendTrial: (id: string, days: number, reason: string) => request<unknown>(`/api/admin/billing/subscriptions/${id}/extend-trial`, { method: 'POST', body: JSON.stringify({ days, reason }) }),
  adminAnalyticsOverview: () => request<AdminAnalyticsOverview>('/api/admin/analytics/overview'),

  // --- Admin: job moderation ---
  adminJobs: (params?: { status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ jobs: AdminJobSummary[] }>(`/api/admin/jobs${suffix}`);
  },
  adminSuspendJob: (id: string, reason: string) => request<AdminJobSummary>(`/api/admin/jobs/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminRestoreJob: (id: string) => request<AdminJobSummary>(`/api/admin/jobs/${id}/restore`, { method: 'POST' }),

  // --- Admin: unified action queue ---
  adminActionQueue: () => request<{ items: ActionQueueItem[] }>('/api/admin/action-queue'),

  // --- Admin: account management ---
  adminUsers: (params?: { role?: 'candidate' | 'employer'; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set('role', params.role);
    if (params?.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ users: AdminUserSummary[] }>(`/api/admin/users${suffix}`);
  },
  adminUserDetail: (id: string) => request<AdminUserDetail>(`/api/admin/users/${id}`),
  adminSuspendUser: (id: string, reason: string) => request<AdminUserSummary>(`/api/admin/users/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminReactivateUser: (id: string) => request<AdminUserSummary>(`/api/admin/users/${id}/reactivate`, { method: 'POST' }),

  // --- Fraud / scam / safety reports ---
  submitReport: (payload: { userId: string; targetType: 'user' | 'job' | 'conversation'; targetId: string; category: ReportCategory; description?: string }) =>
    request<Report>('/api/reports', { method: 'POST', body: JSON.stringify(payload) }),
  adminReports: (status?: string) => request<{ reports: Report[] }>(`/api/admin/reports${status ? `?status=${status}` : ''}`),
  adminResolveReport: (id: string, resolution: string) => request<Report>(`/api/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution }) }),
  adminDismissReport: (id: string) => request<Report>(`/api/admin/reports/${id}/dismiss`, { method: 'POST' }),

  // --- Customer support requests ---
  submitSupportRequest: (payload: { name: string; email: string; message: string; userId?: string }) =>
    request<SupportRequest>('/api/support/requests', { method: 'POST', body: JSON.stringify(payload) }),
  adminSupportRequests: (status?: string) => request<{ requests: SupportRequest[] }>(`/api/admin/support/requests${status ? `?status=${status}` : ''}`),
  adminResolveSupportRequest: (id: string) => request<SupportRequest>(`/api/admin/support/requests/${id}/resolve`, { method: 'POST' }),
};
