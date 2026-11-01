import type { PublicInitiative } from './publicInitiatives.ts';
import type { PublicImplementation } from './implementations.ts';

export function openImplementations(initiative: PublicInitiative): PublicImplementation[] {
  return (initiative.implementations || []).filter(item => item.status === 'active'
    && (item.activistSlots > item.activistsAccepted || item.volunteerSlots > item.volunteersAccepted));
}
export function initiativeVacancies(initiative: PublicInitiative) {
  return openImplementations(initiative).reduce((sum, item) => ({
    activists: sum.activists + Math.max(0, item.activistSlots - item.activistsAccepted),
    volunteers: sum.volunteers + Math.max(0, item.volunteerSlots - item.volunteersAccepted),
  }), { activists: 0, volunteers: 0 });
}
export function initiativeStage(initiative: PublicInitiative): string {
  if (openImplementations(initiative).length) return 'Идёт набор';
  if (initiative.implementations?.some(item => item.status === 'active')) return 'Реализуется';
  if (initiative.implementations?.some(item => ['report_pending', 'changes_requested'].includes(item.status))) return 'Подводим итоги';
  if (initiative.implementations?.some(item => item.status === 'completed')) return 'Есть результат';
  return 'Открытая инициатива';
}
export function authorInitials(author: string): string {
  return author.trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toLocaleUpperCase('ru');
}
export function initiativeHref(id: string): string {
  return `/?view=initiative&initiative=${encodeURIComponent(id)}`;
}
