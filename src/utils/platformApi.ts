import type { ApplicationItem, AccessUser, BaseMember } from '../components/DashboardView.tsx';
import type { FeaturedSelection } from './homepage.ts';
import { fetchApi } from './http.ts';
import type { UserSession } from './auth.ts';
import type { Implementation, ImplementationParticipant, PhotoSummary, PlatformNotification } from './implementations.ts';

export interface DashboardSnapshot {
  applications: ApplicationItem[];
  baseMembers: BaseMember[];
  accessUsers: AccessUser[];
  featuredInitiatives: FeaturedSelection[];
  implementations: Implementation[];
  implementationPhotos: PhotoSummary[];
  implementationParticipants: ImplementationParticipant[];
  notifications: PlatformNotification[];
  currentUser: UserSession;
}

export class PlatformApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function platformRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetchApi(`/api/platform${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new PlatformApiError(payload?.error || `Ошибка сервера (${response.status})`, response.status);
  return payload as T;
}
