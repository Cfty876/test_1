export const INITIATIVE_DIRECTIONS = [
  { id: 'education', label: 'Образование', description: 'Образование и знания', hint: 'Учёба, наставничество и обмен знаниями', area: 'IT' },
  { id: 'culture', label: 'Культура', description: 'Культура и искусство', hint: 'Творчество, выставки и выступления', area: 'Мероприятия' },
  { id: 'volunteering', label: 'Волонтёрство', description: 'Волонтёрство и добровольчество', hint: 'Добрые дела и помощь людям', area: 'Волонтёрство' },
  { id: 'sport', label: 'Спорт', description: 'Спорт', hint: 'Тренировки, турниры и спортивные события', area: 'Мероприятия' },
] as const;
export type InitiativeDirection = typeof INITIATIVE_DIRECTIONS[number]['id'];
export function isInitiativeDirection(value: unknown): value is InitiativeDirection { return INITIATIVE_DIRECTIONS.some(item => item.id === value); }
export function directionLabel(item: { direction?: string }): string { return INITIATIVE_DIRECTIONS.find(direction => direction.id === item.direction)?.label || 'Направление уточняется'; }
export const DIRECTION_FILTERS = [{ id: 'Все', label: 'Все' }, ...INITIATIVE_DIRECTIONS, { id: 'unspecified', label: 'Без направления' }];
export function matchesDirection(item: { direction?: string }, filter: string) { return filter === 'Все' || filter === 'Все направления' || (filter === 'unspecified' ? !isInitiativeDirection(item.direction) : item.direction === filter); }

export function directionCover(direction: string | undefined): string | undefined { return ({ education: 'education', culture: 'workshop', volunteering: 'volunteers', sport: 'sport' } as Record<string,string>)[direction || '']; }
