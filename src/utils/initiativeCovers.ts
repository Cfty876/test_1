import type { HelpArea } from './auth.ts';

interface CoverTheme { id: string; label: string; area: HelpArea }
// Original illustrations; none is presented as a photo of the real event.
export const INITIATIVE_COVERS: readonly CoverTheme[] = [
  { id: 'cleanup', label: 'Чистый город', area: 'Волонтёрство' },
  { id: 'recycling', label: 'Раздельный сбор', area: 'Волонтёрство' },
  { id: 'planting', label: 'Озеленение', area: 'Волонтёрство' },
  { id: 'animals', label: 'Помощь животным', area: 'Волонтёрство' },
  { id: 'food', label: 'Сбор вещей и продуктов', area: 'Волонтёрство' },
  { id: 'elders', label: 'Забота о старших', area: 'Волонтёрство' },
  { id: 'volunteers', label: 'Команда волонтёров', area: 'Волонтёрство' },
  { id: 'festival', label: 'Городской фестиваль', area: 'Мероприятия' },
  { id: 'concert', label: 'Концерт и музыка', area: 'Мероприятия' },
  { id: 'theatre', label: 'Театр и сцена', area: 'Мероприятия' },
  { id: 'sport', label: 'Командный спорт', area: 'Мероприятия' },
  { id: 'running', label: 'Забеги и движение', area: 'Мероприятия' },
  { id: 'games', label: 'Настольные игры', area: 'Мероприятия' },
  { id: 'workshop', label: 'Творческая мастерская', area: 'Мероприятия' },
  { id: 'reading', label: 'Книги и чтение', area: 'Мероприятия' },
  { id: 'science', label: 'Наука и исследования', area: 'IT' },
  { id: 'education', label: 'Учёба и наставничество', area: 'Мероприятия' },
  { id: 'history', label: 'История и наследие', area: 'Мероприятия' },
  { id: 'tourism', label: 'Походы и маршруты', area: 'Мероприятия' },
  { id: 'photography', label: 'Фотография', area: 'Медиа' },
  { id: 'video', label: 'Видео и кино', area: 'Медиа' },
  { id: 'journalism', label: 'Журналистика', area: 'Медиа' },
  { id: 'design', label: 'Дизайн и визуальная культура', area: 'Медиа' },
  { id: 'podcast', label: 'Подкасты и звук', area: 'Медиа' },
  { id: 'coding', label: 'Программирование', area: 'IT' },
  { id: 'robotics', label: 'Робототехника', area: 'IT' },
  { id: 'apps', label: 'Сайты и приложения', area: 'IT' },
  { id: 'security', label: 'Цифровая безопасность', area: 'IT' },
  { id: 'community', label: 'Городские сообщества', area: 'Мероприятия' },
];
const DEFAULTS: Record<HelpArea, string> = {
  Мероприятия: 'community', Медиа: 'design', IT: 'coding', Волонтёрство: 'volunteers',
};
export function isInitiativeCoverId(value: unknown): value is string {
  return typeof value === 'string' && INITIATIVE_COVERS.some(cover => cover.id === value);
}
/** Text changes never affect the cover. Editors explicitly choose from the library. */
export function initiativeCover(initiative: { area: string; coverId?: string }) {
  const theme = INITIATIVE_COVERS.find(item => item.id === initiative.coverId)
    || INITIATIVE_COVERS.find(item => item.id === ((DEFAULTS as Record<string, string>)[initiative.area] || 'community'))!;
  return { id: theme.id, label: theme.label, src: `/illustrations/initiatives/${theme.id}.svg` };
}
