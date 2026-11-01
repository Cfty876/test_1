import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { INITIATIVE_COVERS, initiativeCover } from '../utils/initiativeCovers.ts';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { platformRequest } from '../utils/platformApi.ts';
import { ModalDialog } from './ModalDialog.tsx';

export function InitiativeCoverPicker({ value, onChange, disabled = false }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const name = useId();
  const selected = INITIATIVE_COVERS.find(item => item.id === value);
  return <fieldset className="cover-picker" disabled={disabled}>
    <legend>Обложка инициативы</legend>
    <p>Выбрано: <strong>{selected?.label}</strong>. Текст инициативы не меняет изображение.</p>
    <div className="cover-picker-grid">{INITIATIVE_COVERS.map(cover => <label key={cover.id} className={value === cover.id ? 'cover-option is-selected' : 'cover-option'}>
      <img src={`/illustrations/initiatives/${cover.id}.svg`} alt="" width={900} height={540} loading="lazy" />
      <span><input type="radio" name={name} value={cover.id} checked={value === cover.id} onChange={() => onChange(cover.id)} />{cover.label}</span>
    </label>)}</div>
  </fieldset>;
}

export function InitiativeCoverManager({ initiatives, onRefresh }: { initiatives: PublicInitiative[]; onRefresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<PublicInitiative | null>(null);
  const [coverId, setCoverId] = useState('community');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  async function save() {
    if (!editing || saving) return;
    setSaving(true); setError('');
    try {
      await platformRequest('/initiative-cover', { id: editing.id, coverId, version: editing.coverVersion || 0 });
      setEditing(null); setNotice('Обложка сохранена.');
      await onRefresh();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Не удалось сохранить обложку.';
      setError(message);
    } finally { setSaving(false); }
  }
  const filtered = initiatives.filter(item => `${item.title} ${item.author}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  return <section className="cabinet-section cover-manager">
    <details><summary>Обложки опубликованных инициатив · {initiatives.length}</summary>
      <p>Выберите инициативу, чтобы изменить её изображение в каталоге и на странице проекта.</p>
      <label className="cover-search">Найти инициативу<input type="search" className="pervik-input" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="cover-manager-list">{filtered.map(item => <div className="cover-manager-row" key={item.id}>
        <img src={initiativeCover(item).src} alt="" width={120} height={72} loading="lazy" />
        <div><strong>{item.title}</strong><span>{initiativeCover(item).label}</span></div>
        <button type="button" className="cabinet-button" aria-label={`Изменить обложку: ${item.title}`} onClick={() => { setEditing(item); setCoverId(initiativeCover(item).id); setError(''); setNotice(''); }}>Изменить</button>
      </div>)}</div>
      {!filtered.length && <p>Инициативы не найдены.</p>}
    </details>
    {notice && <p role="status">{notice}</p>}
    {error && !editing && <p className="inline-error" role="alert">Обложка сохранена, но данные не обновились: {error}</p>}
    {editing && <ModalDialog className="cabinet-dialog" labelledBy="cover-editor-title" busy={saving} onClose={() => setEditing(null)}><form className="review-form cover-editor" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="workflow-dialog-heading"><h2 id="cover-editor-title">Изменить обложку</h2><button type="button" disabled={saving} aria-label="Закрыть" onClick={() => setEditing(null)}><X size={20} /></button></div>
      <p>{editing.title}</p><InitiativeCoverPicker value={coverId} onChange={setCoverId} disabled={saving} />
      {error && <p className="inline-error" role="alert">{error} Закройте окно и обновите кабинет перед повторным сохранением.</p>}
      <div className="journey-actions"><button type="button" className="journey-secondary" disabled={saving} onClick={() => setEditing(null)}>Отмена</button><button type="submit" className="home-primary" disabled={saving || Boolean(error)}>{saving ? 'Сохраняем…' : 'Сохранить обложку'}</button></div>
    </form></ModalDialog>}
  </section>;
}
