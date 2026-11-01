import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { LayoutGroup, LazyMotion, m, useReducedMotion } from 'motion/react';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { comparePublicInitiatives } from '../utils/publicInitiatives.ts';
import { openImplementations } from '../utils/initiativePresentation.ts';
import { InitiativeCard } from './InitiativeCard.tsx';

const AREAS = ['Все', 'Мероприятия', 'Медиа', 'IT', 'Волонтёрство'] as const;
const loadAnimations = () => import('../utils/boardAnimationFeatures.ts').then(module => module.default);
interface Props {
  initiatives: PublicInitiative[]; loading: boolean; loadError: boolean; onRetry: () => void;
  likedIds: string[]; likingId: string | null; onLike: (id: string) => Promise<void>;
  onOpen: (initiative: PublicInitiative) => void; onStart: () => void; onHome: () => void;
}
export function InitiativeCatalog({ initiatives, loading, loadError, onRetry, likedIds, likingId, onLike, onOpen, onStart, onHome }: Props) {
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q')?.slice(0, 120) || '');
  const [area, setArea] = useState<string>(() => { const value = new URLSearchParams(location.search).get('area'); return AREAS.find(item => item === value) || 'Все'; });
  const [needsTeam, setNeedsTeam] = useState(() => new URLSearchParams(location.search).get('team') === '1');
  const [order, setOrder] = useState(() => new URLSearchParams(location.search).get('sort') === 'newest' ? 'newest' : 'popular');
  const [limit, setLimit] = useState(9);
  const deferredQuery = useDeferredValue(query);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  const reduced = useReducedMotion();
  const likedSet = useMemo(() => new Set(likedIds), [likedIds]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('view') !== 'initiatives') return;
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ q: query, area: area === 'Все' ? '' : area, team: needsTeam ? '1' : '', sort: order === 'popular' ? '' : order })) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(history.state, '', url);
  }, [query, area, needsTeam, order]);
  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase('ru');
    return initiatives.filter(item => (area === 'Все' || item.area === area)
      && (!needsTeam || openImplementations(item).length > 0)
      && (!needle || [item.title, item.description, item.author].some(value => value.toLocaleLowerCase('ru').includes(needle))))
      .sort(order === 'popular' ? comparePublicInitiatives : (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0) || comparePublicInitiatives(a, b));
  }, [initiatives, deferredQuery, area, needsTeam, order]);
  function reset() { setQuery(''); setArea('Все'); setNeedsTeam(false); setOrder('popular'); setLimit(9); }
  const activeFilters = Boolean(query || area !== 'Все' || needsTeam);
  return <main className="ideas-page">
    <button type="button" className="ideas-back" onClick={onHome}><ArrowLeft size={17} /> На главную</button>
    <header className="ideas-page-heading"><div><span className="ideas-eyebrow">СОВЕТ ПЕРВЫХ · ЕКАТЕРИНБУРГ</span><h1 ref={headingRef} tabIndex={-1}>Все инициативы</h1><p>Идеи ребят Екатеринбурга.</p></div><button type="button" className="home-primary" onClick={onStart}>Предложить идею <ArrowUpRight size={18} /></button></header>
    <div className="ideas-search-row"><label className="ideas-search"><Search size={21} aria-hidden="true" /><input type="search" aria-label="Найти инициативу" placeholder="Найти инициативу или автора" maxLength={120} value={query} onChange={event => { setQuery(event.target.value); setLimit(9); }} />{query && <button type="button" aria-label="Очистить поиск" onClick={() => { setQuery(''); setLimit(9); }}><X size={18} /></button>}</label><label className="ideas-sort"><SlidersHorizontal size={17} aria-hidden="true" /><span className="sr-only">Порядок инициатив</span><select aria-label="Порядок инициатив" value={order} onChange={event => { setOrder(event.target.value); setLimit(9); }}><option value="popular">По поддержке</option><option value="newest">Сначала новые</option></select></label></div>
    <div className="ideas-filter-row"><div className="ideas-filters" aria-label="Направления инициатив">{AREAS.map(item => <button key={item} type="button" aria-pressed={area === item} onClick={() => { setArea(item); setLimit(9); }}>{item === 'Все' ? 'Все инициативы' : item === 'Мероприятия' ? 'События' : item}</button>)}<button type="button" aria-pressed={needsTeam} className="ideas-team-filter" onClick={() => { setNeedsTeam(value => !value); setLimit(9); }}>Нужна команда</button></div><span className="ideas-result-count" role="status">{loading && !initiatives.length ? 'Загружаем…' : `Найдено: ${filtered.length}`}</span></div>
    {loadError && <div className="inline-error" role="alert">Не удалось обновить каталог. <button type="button" onClick={onRetry}>Попробовать снова</button></div>}
    {loading && !initiatives.length ? <div className="ideas-empty" role="status"><h2>Загружаем инициативы…</h2></div> : filtered.length ? <>
      <LazyMotion features={loadAnimations} strict><LayoutGroup id="initiative-catalog"><div className="ideas-grid">{filtered.slice(0, limit).map(initiative => <m.div key={initiative.id} className="idea-card-position" layout={reduced ? false : 'position'} initial={false} transition={{ layout: { type: 'spring', stiffness: 310, damping: 32 } }}><InitiativeCard initiative={initiative} onOpen={onOpen} onLike={onLike} liked={likedSet.has(initiative.id)} liking={Boolean(likingId)} /></m.div>)}</div></LayoutGroup></LazyMotion>
      {filtered.length > limit && <button type="button" className="ideas-more" onClick={() => setLimit(value => value + 9)}>Показать ещё <span>+{Math.min(9, filtered.length - limit)}</span></button>}
    </> : !loadError && <div className="ideas-empty"><h2>{initiatives.length ? 'Таких инициатив пока нет' : 'Пока нет инициатив'}</h2><p>{activeFilters ? 'Попробуй другое направление или измени поиск.' : 'Предложи инициативу: после одобрения она появится здесь.'}</p><button type="button" className="journey-secondary" onClick={activeFilters ? reset : onStart}>{activeFilters ? 'Сбросить фильтры' : 'Предложить идею'}</button></div>}
  </main>;
}
