import { useId } from 'react';
import { directionEntries, directionOptions, type DirectionKind, type DirectionRecord } from '../utils/participantDirections.ts';

export function DirectionPicker({ kind, selected, onChange, error = false }: { kind: DirectionKind; selected: readonly string[]; onChange: (values: string[]) => void; error?: boolean }) {
  const id = useId();
  const multiple = kind === 'activist';
  return <fieldset className="direction-picker" data-direction-picker={kind} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}>
    <legend>{multiple ? 'В каких направлениях готов помогать?' : 'Направление инициативы'} <span aria-hidden="true">*</span></legend>
    <p id={`${id}-hint`} className="direction-picker-hint">{multiple ? 'Можно выбрать несколько. Опыт не обязателен.' : 'Выбери одну тему проекта.'}</p>
    <div className="direction-picker-options">{directionOptions(kind).map(option => <label key={option.id} className={selected.includes(option.id) ? 'direction-option is-selected' : 'direction-option'}>
      <span className="direction-option-heading"><input type={multiple ? 'checkbox' : 'radio'} name={`${id}-direction`} value={option.id} checked={selected.includes(option.id)} required={!multiple} aria-invalid={error || undefined} onChange={event => onChange(multiple ? event.target.checked ? [...selected, option.id] : selected.filter(value => value !== option.id) : [option.id])} /><strong>{option.label}</strong></span>
      <span className="direction-option-description">{option.description}</span>
    </label>)}</div>
    {error && <p className="direction-picker-error" id={`${id}-error`} role="alert">Выбери хотя бы одно направление помощи.</p>}
  </fieldset>;
}

export function DirectionTags({ record, kind }: { record: DirectionRecord; kind: DirectionKind }) {
  return <ul className="direction-tags" aria-label={kind === 'initiative' ? 'Направление инициативы' : 'Все направления помощи'}>{directionEntries(record, kind).map(item => <li key={item.id} className={`direction-tag${item.id === 'unspecified' ? ' is-unspecified' : ''}`} title={item.description}>{item.label}</li>)}</ul>;
}

export function DirectionFilter({ kind, value, onChange, counts, total }: { kind: DirectionKind; value: string; onChange: (value: string) => void; counts: ReadonlyMap<string, number>; total: number }) {
  const label = kind === 'initiative' ? 'Темы инициатив' : 'Направления помощи';
  const options = [...directionOptions(kind), ...((counts.get('unspecified') || value === 'unspecified') ? [{ id: 'unspecified', label: 'Не указано', description: '' }] : [])];
  return <div className="direction-filter-group" role="group" aria-label={label}>
    <div className="direction-filter-heading"><strong>{label}</strong><span>{kind === 'activist' ? 'У человека может быть несколько направлений' : 'Выберите тему проекта'}</span></div>
    <div className="direction-filter-options"><button type="button" aria-pressed={value === 'Все'} onClick={() => onChange('Все')}>Все <span>{total}</span></button>{options.map(item => <button type="button" key={item.id} aria-pressed={value === item.id} onClick={() => onChange(item.id)}>{item.label}<span>{counts.get(item.id) || 0}</span></button>)}</div>
  </div>;
}
