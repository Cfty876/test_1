import type { ApplicationItem, AccessUser, BaseMember } from '../components/DashboardView.tsx';
import type { ForwardedInitiative } from './auth.ts';
import type { FeaturedSelection } from './homepage.ts';
import { fetchApi } from './http.ts';

export interface DashboardSnapshot {
  applications: ApplicationItem[];
  baseMembers: BaseMember[];
  accessUsers: AccessUser[];
  forwardedInitiatives: ForwardedInitiative[];
  featuredInitiatives: FeaturedSelection[];
}

export async function platformRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetchApi(`/api/platform${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error || `Ошибка сервера (${response.status})`);
  return payload as T;
}
