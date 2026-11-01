export const APPLICATION_CATEGORIES = new Set([
  'Есть своя инициатива', 'Хочу быть активистом', 'Хочу помочь инициативе',
  'Хочу быть ведущим', 'Медиа, фото, видео', 'IT и техническая поддержка',
  'Мастер-класс', 'Волонтёр', 'Свой вариант (указать область)',
]);
export function isStoredApplicationCategory(category: string): boolean {
  return APPLICATION_CATEGORIES.has(category) || category.startsWith('Свой: ');
}
