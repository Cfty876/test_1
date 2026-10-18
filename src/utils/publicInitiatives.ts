import type { HelpArea } from '../components/ApplicationFormView.tsx';

export interface PublicInitiative {
  id: string;
  title: string;
  description: string;
  area: HelpArea;
  author: string;
  publishedAt: string;
}

export async function fetchPublicInitiatives(): Promise<PublicInitiative[]> {
  const response = await fetch('/api/initiatives');
  if (!response.ok) throw new Error('Не удалось загрузить доску инициатив');
  const value: unknown = await response.json();
  return Array.isArray(value) ? value as PublicInitiative[] : [];
}

export async function publishPublicInitiative(initiative: PublicInitiative): Promise<PublicInitiative> {
  const response = await fetch('/api/initiatives', {
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
