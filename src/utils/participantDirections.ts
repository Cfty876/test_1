import { INITIATIVE_DIRECTIONS } from './initiativeDirections.ts';

export const ACTIVIST_DIRECTIONS = [
  { id: 'Мероприятия', label: 'Мероприятия', description: 'Сцена, организация, ведение и логистика' },
  { id: 'Медиа', label: 'Медиа', description: 'Фото, видео, тексты, соцсети и дизайн' },
  { id: 'IT', label: 'IT', description: 'Разработка, боты, звук, свет и презентации' },
  { id: 'Волонтёрство', label: 'Волонтёрство', description: 'Регистрация, навигация и помощь участникам' },
] as const;
export type DirectionKind = 'initiative' | 'activist';
export interface DirectionOption { id: string; label: string; description: string }
export interface DirectionRecord { direction?: string; helpAreas?: readonly string[]; area?: string; helpArea?: string; category?: string }
export function directionOptions(kind: DirectionKind): readonly DirectionOption[] { return kind === 'initiative' ? INITIATIVE_DIRECTIONS : ACTIVIST_DIRECTIONS; }
/** Explicit multi-selection is authoritative; the old primary category can be stale. */
export function activistDirections(record: DirectionRecord): string[] {
  const allowed = new Set<string>(ACTIVIST_DIRECTIONS.map(item => item.id));
  const selected = record.helpAreas?.filter(value => allowed.has(value)) || [];
  if (selected.length) return [...new Set(selected)];
  const fallback = [record.area, record.helpArea, record.category].find(value => value && allowed.has(value));
  return fallback ? [fallback] : [];
}
export function directionEntries(record: DirectionRecord, kind: DirectionKind): readonly DirectionOption[] {
  const ids = kind === 'initiative' ? [record.direction] : activistDirections(record);
  const entries = directionOptions(kind).filter(item => ids.includes(item.id));
  return entries.length ? entries : [{ id: 'unspecified', label: kind === 'initiative' ? 'Направление уточняется' : 'Направления не указаны', description: 'Требует уточнения у участника' }];
}
export function matchesParticipantDirection(record: DirectionRecord, kind: DirectionKind, filter: string): boolean {
  return filter === 'Все' || directionEntries(record, kind).some(item => item.id === filter);
}
export function countDirections(records: readonly DirectionRecord[], kind: DirectionKind): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) for (const entry of directionEntries(record, kind)) counts.set(entry.id, (counts.get(entry.id) || 0) + 1);
  return counts;
}
export function directionSearchText(record: DirectionRecord, kind: DirectionKind): string {
  return directionEntries(record, kind).map(item => `${item.label} ${item.description}`).join(' ');
}
export function normalizeDirectionSearch(value: string): string { return value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim(); }
