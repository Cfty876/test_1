import { useId, useState } from 'react';
import { directionEntries, directionOptions, type DirectionKind, type DirectionRecord } from '../utils/participantDirections.ts';

export function DirectionPicker({ kind, selected, onChange, error = false }: { kind: DirectionKind; selected: readonly string[]; onChange: (values: string[]) => void; error?: boolean }) {
  const id = useId();
  const multiple = kind === 'activist';
  return <fieldset className="direction-picker" data-direction-picker={kind} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}>
    <legend>{multiple ? 'В каких направлениях готов помогать?' : 'Направление инициативы'} <span aria-hidden="true">*</span></legend>
    <p id={`${id}-hint`} className="direction-picker-hint">{multiple ? 'Можно выбрать несколько. Опыт не обязателен.' : 'Выбери одну тему проекта.'}</p>
    <div className="direction-picker-options">{directionOptions(kind).map(option => <label key={option.id} className={selected.includes(option.id) ? 'direction-option is-selected' : 'direction-option'}>
      <input type={multiple ? 'checkbox' : 'radio'} name={`${id}-direction`} value={option.id} checked={selected.includes(option.id)} required={!multiple} aria-invalid={error || undefined} aria-describedby={`${id}-${option.id}-description${error ? ` ${id}-error` : ''}`} onChange={event => onChange(multiple ? event.target.checked ? [...selected, option.id] : selected.filter(value => value !== option.id) : [option.id])} />
      <span className="direction-option-copy"><span className="direction-option-heading">{option.label}</span><span className="direction-option-description" id={`${id}-${option.id}-description`}>{option.description}</span></span>
    </label>)}</div>
    {error && <p className="direction-picker-error" id={`${id}-error`} role="alert">Выбери хотя бы одно направление помощи.</p>}
  </fieldset>;
}

export function DirectionTags({ record, kind }: { record: DirectionRecord; kind: DirectionKind }) {
  return <ul className="direction-tags" aria-label={kind === 'initiative' ? 'Направление инициативы' : 'Все направления помощи'}>{directionEntries(record, kind).map(item => <li key={item.id} className={`direction-tag${item.id === 'unspecified' ? ' is-unspecified' : ''}`} title={item.description}>{item.label}</li>)}</ul>;
}

export function DirectionFilter({ kind, value, onChange, counts, total, compactOnMobile = false }: { kind: DirectionKind; value: string; onChange: (value: string) => void; counts: ReadonlyMap<string, number>; total: number; compactOnMobile?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const label = kind === 'initiative' ? 'Темы инициатив' : 'Направления помощи';
  const options = [...directionOptions(kind), ...((counts.get('unspecified') || value === 'unspecified') ? [{ id: 'unspecified', label: 'Не указано', description: '' }] : [])];
  const selectedLabel = value === 'Все' ? 'Все направления' : options.find(item => item.id === value)?.label || 'Все направления';
  return <div className={`direction-filter-group${compactOnMobile ? ' direction-filter-compact' : ''}`} role="group" aria-label={label}>
    {compactOnMobile && <button type="button" className="direction-filter-toggle" aria-expanded={expanded} aria-controls={`${id}-options`} onClick={() => setExpanded(open => !open)}><span>{selectedLabel}</span><span>{expanded ? 'Свернуть' : 'Изменить'}</span></button>}
    <div id={`${id}-options`} className={`direction-filter-content${expanded ? ' is-expanded' : ''}`}>
    <div className="direction-filter-heading"><strong>{label}</strong><span>{kind === 'activist' ? 'У человека может быть несколько направлений' : 'Выберите тему проекта'}</span></div>
    <div className="direction-filter-options"><button type="button" aria-pressed={value === 'Все'} onClick={() => onChange('Все')}>Все <span>{total}</span></button>{options.map(item => <button type="button" key={item.id} aria-pressed={value === item.id} onClick={() => onChange(item.id)}>{item.label}<span>{counts.get(item.id) || 0}</span></button>)}</div>
    </div>
  </div>;
}
