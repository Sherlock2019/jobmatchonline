import type { Bootstrap, JobMatch, Message, Role } from './types';

export const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body as T;
}

export const api = {
  bootstrap: (role: Role) => request<Bootstrap>(`/api/bootstrap?role=${role}`),
  swipe: (payload: { actorId: string; targetId: string; targetType: 'job' | 'candidate'; direction: 'like' | 'pass' }) => request<{ match: JobMatch | null; likesRemaining: number; duplicate: boolean }>('/api/swipes', { method: 'POST', body: JSON.stringify(payload) }),
  updateStage: (id: string, stage: string) => request<JobMatch>(`/api/matches/${id}`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  message: (payload: { matchId: string; senderId: string; text: string }) => request<Message>('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
};
