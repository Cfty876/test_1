export const COUNCIL_STATUSES = ['Председатель Екатеринбурга', 'Заместитель председателя', 'Секретарь', 'Глава проектного штаба', 'Глава медиа штаба', 'Активист совета'] as const;
export type CouncilStatus = typeof COUNCIL_STATUSES[number];
export type ImplementationStatus = 'proposed' | 'active' | 'report_pending' | 'changes_requested' | 'completed' | 'cancelled';
export type ParticipationRole = 'activist' | 'volunteer';
export const IMPLEMENTATION_LABELS: Record<ImplementationStatus, string> = { proposed: 'Предложена реализация', active: 'Реализуется', report_pending: 'Отчёт на проверке', changes_requested: 'Доработка отчёта', completed: 'Реализована', cancelled: 'Отменена' };
export interface ImplementationReport { description: string; links: string[]; photoIds: string[]; eventDate: string; submittedAt: string }
export interface Implementation {
  id: string; initiativeId: string; initiativeTitle: string; scope: 'school' | 'district' | 'city'; organization: string;
  startDate?: string; endDate?: string; district?: string;
  ownerLogin: string; ownerName: string; councilStatus?: CouncilStatus; plan: string; status: ImplementationStatus;
  activistSlots: number; volunteerSlots: number; version: number; createdAt: string; updatedAt: string;
  approvedBy?: { login: string; name: string; at: string };
  reviewedBy?: { login: string; name: string; at: string };
  report?: ImplementationReport; reportHistory?: (ImplementationReport & { reviewNote?: string })[]; reviewNote?: string;
}
export interface PublicImplementation {
  id: string; scope: 'school' | 'district' | 'city'; organization: string; ownerName: string; status: ImplementationStatus;
  startDate?: string; endDate?: string; district?: string;
  activistSlots: number; volunteerSlots: number; activistsAccepted: number; volunteersAccepted: number;
}
export interface ImplementationPhoto { id: string; implementationId: string; ownerLogin: string; storageKey: string; contentType: string; size: number; createdAt: string; hiddenFromDraft?: boolean }
export type PhotoSummary = Omit<ImplementationPhoto, 'ownerLogin' | 'storageKey'>;
export interface ImplementationParticipant { id: string; implementationId: string; name: string; phone: string; email: string; role: ParticipationRole }
export interface PlatformNotification { id: string; audience: 'author' | 'admin' | 'user'; recipient: string; initiativeId: string; implementationId: string; message: string; createdAt: string }
export function photoUrl(id: string): string { return `/api/platform/implementation-photo?id=${encodeURIComponent(id)}`; }
export function recruitmentSummary(implementations: PublicImplementation[] = []): string {
  const active = implementations.filter((item) => item.status === 'active');
  const activists = active.reduce((sum, item) => sum + Math.max(0, item.activistSlots - item.activistsAccepted), 0);
  const volunteers = active.reduce((sum, item) => sum + Math.max(0, item.volunteerSlots - item.volunteersAccepted), 0);
  return [activists ? `активисты: ${activists}` : '', volunteers ? `волонтёры: ${volunteers}` : ''].filter(Boolean).join(' · ');
}
