import type { Bootstrap, EmployerKind, JobMatch, Message, Role, SessionUser } from './types';

export const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body as T;
}

export const api = {
  bootstrap: (userId: string) => request<Bootstrap>(`/api/bootstrap?userId=${encodeURIComponent(userId)}`),
  authProfiles: () => request<{ profiles: SessionUser[] }>('/api/auth/profiles'),
  login: (userId: string) => request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ userId }) }),
  ssoLogin: (provider: 'linkedin' | 'google') => request<{ user: SessionUser }>('/api/auth/sso', { method: 'POST', body: JSON.stringify({ provider }) }),
  register: (payload: { role: Role; kind?: EmployerKind; provider?: string; name: string; email: string; photo?: string }) => request<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  swipe: (payload: { actorId: string; targetId: string; targetType: 'job' | 'candidate'; direction: 'like' | 'pass' }) => request<{ match: JobMatch | null; likesRemaining: number; duplicate: boolean }>('/api/swipes', { method: 'POST', body: JSON.stringify(payload) }),
  updateStage: (id: string, stage: string) => request<JobMatch>(`/api/matches/${id}`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  message: (payload: { matchId: string; senderId: string; text: string }) => request<Message>('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
};
