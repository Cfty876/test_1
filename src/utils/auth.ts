/**
 * Authentication and role management logic for the Movement of the First platform.
 */

export type Role = 'admin' | 'chairman' | 'partner';

export type HelpArea = 'Мероприятия' | 'Медиа' | 'IT' | 'Волонтёрство';

export interface UserSession {
  role: Role;
  login: string;
  name: string;
  initials: string;
  roleBadge: string;
  pageTitle: string;
  pageSubtitle: string;
}

export interface CredentialConfig {
  role: Role;
  name: string;
  initials: string;
  roleBadge: string;
  pageTitle: string;
  pageSubtitle: string;
}

export interface ForwardedInitiative {
  id: string;
  title: string;
  authorName: string;
  authorPhone: string;
  authorEmail: string;
  area: HelpArea | string;
  description: string;
  senderName: string;
  senderRole: string;
  senderNote?: string;
  sentDate: string;
  status: 'new' | 'reviewed' | 'supported';
  partnerName: string;
}

export const ROLE_CONFIGS: Record<Role, CredentialConfig> = {
  admin: {
    role: 'admin',
    name: 'Администратор',
    initials: 'АД',
    roleBadge: 'Главный доступ',
    pageTitle: 'Обзор',
    pageSubtitle: 'Полный доступ ко всем заявкам, базе и пользователям Екатеринбурга',
  },
  chairman: {
    role: 'chairman',
    name: 'Председатель',
    initials: 'П',
    roleBadge: 'Председатель отделения',
    pageTitle: 'Моё отделение',
    pageSubtitle: 'База активистов, инициативы и отправка проектов партнёрам',
  },
  partner: {
    role: 'partner',
    name: 'Партнёр',
    initials: 'ПТ',
    roleBadge: 'Партнёр',
    pageTitle: 'Инициативы для партнёра',
    pageSubtitle: 'Проекты и запросы на поддержку от отделений и кураторов',
  },
};

/**
 * Role permissions helpers
 */
export function canProcessApplications(role: Role): boolean {
  return role === 'admin';
}

export function canViewBase(role: Role): boolean {
  return role === 'admin' || role === 'chairman';
}

export function canSendInitiativesToPartner(role: Role): boolean {
  return role === 'admin' || role === 'chairman';
}

export function isPartnerOnlyView(role: Role): boolean {
  return role === 'partner';
}

/** Verify credentials with the server. Passwords never enter client storage. */
export async function authenticate(loginRaw: string, passRaw: string): Promise<UserSession | null> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginRaw, password: passRaw }),
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (response.status === 503 && result?.error === 'Authentication is not configured') {
      throw new Error('Авторизация не настроена в переменных окружения проекта Vercel.');
    }
    throw new Error('Сервер авторизации недоступен. Попробуйте позже.');
  }
  const result = await response.json() as { user?: UserSession };
  return result.user ?? null;
}

export async function restoreSession(): Promise<UserSession | null> {
  try {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
    if (!response.ok) return null;
    const result = await response.json() as { user?: UserSession | null };
    return result.user ?? null;
  } catch {
    return null;
  }
}

export async function logoutSession(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
}

/**
 * Generates initials from a full name (e.g. "Мария Ковалёва" -> "МК")
 */
export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Filters list of items by initiative flag and optional category.
 */
export function filterBaseItems<T extends { isInitiative: boolean; category: string; name: string; description?: string }>(
  items: T[],
  filterType: 'all_non_initiatives' | 'only_initiatives',
  categoryFilter: string = 'all',
  searchQuery: string = ''
): T[] {
  return items.filter((item) => {
    // 1. Initiative separation
    if (filterType === 'all_non_initiatives' && item.isInitiative) return false;
    if (filterType === 'only_initiatives' && !item.isInitiative) return false;

    // 2. Category filter
    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = item.name.toLowerCase().includes(q);
      const descMatch = (item.description || '').toLowerCase().includes(q);
      const catMatch = item.category.toLowerCase().includes(q);
      if (!nameMatch && !descMatch && !catMatch) return false;
    }

    return true;
  });
}
