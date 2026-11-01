import type { InitiativeDirection } from './initiativeDirections.ts';
import type { HelpArea } from '../components/ApplicationFormView.tsx';
import { fetchApi } from './http.ts';
import type { PublicImplementation } from './implementations.ts';

export interface PublicInitiative {
  id: string;
  title: string;
  description: string;
  area: HelpArea;
  direction?: InitiativeDirection;
  author: string;
  publishedAt: string;
  coverId?: string;
  coverVersion?: number;
  likeCount?: number;
  implementations?: PublicImplementation[];
}

/** Same ordering for the API and the animated board, including deterministic ties. */
export function comparePublicInitiatives(left: PublicInitiative, right: PublicInitiative): number {
  const hearts = (right.likeCount || 0) - (left.likeCount || 0);
  if (hearts) return hearts;
  const leftTime = Date.parse(left.publishedAt), rightTime = Date.parse(right.publishedAt);
  const leftDate = Number.isFinite(leftTime) ? leftTime : Infinity;
  const rightDate = Number.isFinite(rightTime) ? rightTime : Infinity;
  if (leftDate !== rightDate) return leftDate < rightDate ? -1 : 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function initiativeTone(id: string): number {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return (hash >>> 0) % 4;
}

export async function fetchPublicInitiatives(): Promise<PublicInitiative[]> {
  const response = await fetchApi('/api/initiatives', { cache: 'no-store' });
  if (!response.ok) throw new Error('Не удалось загрузить каталог инициатив');
  const value: unknown = await response.json();
  return Array.isArray(value) ? value as PublicInitiative[] : [];
}

export async function publishPublicInitiative(initiative: PublicInitiative): Promise<PublicInitiative> {
  const response = await fetchApi('/api/initiatives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(initiative),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error || 'Не удалось опубликовать инициативу');
  }
  return await response.json() as PublicInitiative;
}
