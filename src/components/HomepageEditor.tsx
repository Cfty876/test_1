import { directionLabel } from '../utils/initiativeDirections.ts';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Search, X } from 'lucide-react';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import type { FeaturedSelection } from '../utils/homepage.ts';
import { CabinetPagination } from './CabinetUI.tsx';

interface Props {
  initiatives: PublicInitiative[];
  selections: FeaturedSelection[];
  onSave: (selections: FeaturedSelection[], expected: FeaturedSelection[]) => Promise<void>;
  loadError: boolean;
  loading: boolean;
  onRetry: () => void;
}

export function HomepageEditor({ initiatives, selections, onSave, loadError, loading, onRetry }: Props) {
  const [draft, setDraft] = useState<FeaturedSelection[]>(() => selections.map((item) => ({ ...item })));
  const [baseline, setBaseline] = useState<FeaturedSelection[]>(selections);
  const [requestedPage, setRequestedPage] = useState(1);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const changed = JSON.stringify(draft) !== JSON.stringify(baseline);
  const conflict = JSON.stringify(baseline) !== JSON.stringify(selections);
  useEffect(() => {
    if (conflict && !changed) { setBaseline(selections); setDraft(selections.map(item => ({ ...item }))); }
  }, [selections, conflict, changed]);
  const needle = query.trim().toLocaleLowerCase('ru');
  const visible = initiatives.filter((item) => [item.title, item.author, directionLabel(item)].some((value) => value.toLocaleLowerCase('ru').includes(needle)));
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(visible.length / 12)));

  function toggle(id: string) {
    setError('');
    setDraft((items) => items.some((item) => item.initiativeId === id)
      ? items.filter((item) => item.initiativeId !== id)
      : items.length < 3 ? [...items, { initiativeId: id, helpNeeded: '' }] : items);
  }

  function move(index: number, offset: number) {
    setDraft((items) => {
      const next = [...items];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loadError || loading || conflict) return;
    setError('');
    setSaving(true);
    try { await onSave(draft, baseline); setBaseline(draft.map(item => ({ ...item }))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить подборку'); }
    finally { setSaving(false); }
  }

  return <form className="homepage-editor" onSubmit={save}>
    <div className="editor-heading">
      <div><span className="section-eyebrow">ГЛАВНАЯ САЙТА</span><h2>Идеи в блоке «Нужна команда»</h2><p>Выберите до трёх опубликованных инициатив и расскажите, какая помощь им нужна. Порядок карточек здесь совпадает с порядком на сайте.</p></div>
      <span className="editor-counter" aria-live="polite">Выбрано {draft.length} из 3</span>
    </div>
    {loadError && <p className="inline-error" role="alert">Не удалось загрузить опубликованные инициативы. <button type="button" onClick={onRetry}>Повторить загрузку</button></p>}
    {loading && <p className="board-loading" role="status">Загружаем опубликованные инициативы…</p>}
    {conflict && changed && <p className="inline-error" role="alert">Другой администратор обновил подборку. Ваш черновик сохранён в этой вкладке. <button type="button" onClick={() => { setBaseline(selections); setDraft(selections.map(item => ({ ...item }))); setError(''); }}>Загрузить актуальную подборку</button></p>}
    <fieldset disabled={saving || loadError || loading}>
      <legend className="sr-only">Подборка инициатив</legend>
      <div className="editor-slots">
        {draft.map((selection, index) => {
          const initiative = initiatives.find((item) => item.id === selection.initiativeId);
          return <article key={selection.initiativeId} className="editor-slot">
            <div className="editor-slot-title"><span className="editor-number">0{index + 1}</span><strong>{initiative?.title || 'Инициатива недоступна'}</strong>
              <div className="editor-order"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Поднять инициативу ${index + 1}`}><ArrowUp size={16} /></button><button type="button" disabled={index === draft.length - 1} onClick={() => move(index, 1)} aria-label={`Опустить инициативу ${index + 1}`}><ArrowDown size={16} /></button><button type="button" onClick={() => toggle(selection.initiativeId)} aria-label={`Убрать инициативу ${index + 1}`}><X size={16} /></button></div>
            </div>
            <label htmlFor={`help-needed-${index}`}>Кто нужен в команду?</label>
            <textarea id={`help-needed-${index}`} required maxLength={240} rows={3} value={selection.helpNeeded} onChange={(event) => setDraft((items) => items.map((item) => item.initiativeId === selection.initiativeId ? { ...item, helpNeeded: event.target.value } : item))} placeholder="Например: фотограф на мероприятие и два волонтёра для встречи гостей" />
            <span className="editor-character-count">{selection.helpNeeded.length} / 240</span>
          </article>;
        })}
        {draft.length < 3 && <div className="editor-slot-placeholder"><Plus size={24} /><strong>{draft.length ? 'Есть место для ещё одной идеи' : 'Начните с первой инициативы'}</strong><p>Добавьте проект из списка ниже.</p></div>}
      </div>
      <div className="editor-list-heading"><h3>Опубликованные инициативы</h3><label className="initiative-search"><Search size={16} /><input type="search" aria-label="Поиск инициатив для подборки" placeholder="Название, автор или направление" value={query} onChange={(event) => { setQuery(event.target.value); setRequestedPage(1); }} /></label></div>
      <div className="editor-initiative-list">
        {visible.slice((page - 1) * 12, page * 12).map((initiative) => {
          const selected = draft.some((item) => item.initiativeId === initiative.id);
          return <div key={initiative.id} className="editor-initiative-row"><div><span>{directionLabel(initiative)} · {initiative.author}</span><strong>{initiative.title}</strong></div><button type="button" aria-pressed={selected} disabled={!selected && draft.length >= 3} onClick={() => toggle(initiative.id)}>{selected ? <Check size={16} /> : <Plus size={16} />}{selected ? 'Выбрана' : 'Добавить'}</button></div>;
        })}
        {!visible.length && <p className="editor-empty">{initiatives.length ? 'По этому запросу ничего не найдено.' : 'Пока нет опубликованных инициатив. После одобрения заявки администратором её можно будет выбрать здесь.'}</p>}
      </div>
      <CabinetPagination total={visible.length} page={page} size={12} onChange={setRequestedPage} />
    </fieldset>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="editor-save-row"><p>{changed ? 'Есть несохранённые изменения' : 'Подборка соответствует главной странице'}<br /><small>Посетители увидят изменения только после сохранения. До трёх карточек; можно убрать все.</small></p><button type="submit" className="home-primary" disabled={!changed || saving || loadError || loading || conflict}>{saving ? 'Сохраняем…' : 'Сохранить на главной'}<Check size={17} /></button></div>
  </form>;
}
