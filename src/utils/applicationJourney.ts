import type { InitiativeDirection } from './initiativeDirections.ts';
export type ApplicationStatus = 'pending' | 'needs_changes' | 'accepted' | 'rejected' | 'withdrawn';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'На рассмотрении', needs_changes: 'Нужна доработка', accepted: 'Одобрена',
  rejected: 'Не поддержана', withdrawn: 'Отозвана автором',
};

export interface ApplicationEvent {
  id: string;
  at: string;
  status: ApplicationStatus;
  actor: 'participant' | 'admin' | 'curator' | 'organizer';
  actorName?: string;
  message: string;
}

export interface ApplicationReceipt { id: string; code: string }
export interface TrackedApplication {
  direction?: InitiativeDirection;
  id: string;
  status: ApplicationStatus;
  category: string;
  area: string;
  helpAreas?: string[];
  description: string;
  isInitiative: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  history: ApplicationEvent[];
  updates?: PlatformNotification[];
}

const RECEIPT_KEY = 'pervik.application-receipt.v1';
export function createTrackingCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, '0')).join('');
}
export function readReceipt(): ApplicationReceipt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(RECEIPT_KEY) || 'null');
    return typeof value?.id === 'string' && /^[a-f0-9]{64}$/.test(value.code) ? value : null;
  } catch { return null; }
}
export function rememberReceipt(receipt: ApplicationReceipt): void {
  try { sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt)); } catch { /* Download remains available when storage is disabled. */ }
}
export function forgetReceipt(): void {
  try { sessionStorage.removeItem(RECEIPT_KEY); } catch { /* Storage may be unavailable. */ }
}
export function downloadReceipt(receipt: ApplicationReceipt): void {
  const file = new Blob([`Первик — Совет Первых местного отделения города Екатеринбург\nНомер заявки: ${receipt.id}\nЛичный код: ${receipt.code}\n\nПроверка статуса: ${window.location.origin}/?view=track\nВведите личный код на странице проверки. Не публикуйте его: он открывает статус, текст заявки и возможность доработки или отзыва.\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = 'pervik-zayavka.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
import type { PlatformNotification } from './implementations.ts';
