import { directionLabel } from '../utils/initiativeDirections.ts';
import { NotFoundView } from './NotFoundView.tsx';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Heart, Link, Users } from 'lucide-react';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import type { PublicImplementation } from '../utils/implementations.ts';
import { authorInitials, initiativeStage, initiativeVacancies, openImplementations, initiativeHref } from '../utils/initiativePresentation.ts';
import { InitiativeArt } from './InitiativeArt.tsx';
import { InitiativeImplementations } from './InitiativeImplementations.tsx';

interface Props {
  initiative: PublicInitiative | null; loading: boolean; loadError: boolean; onRetry: () => void;
  liked: boolean; liking: boolean; onLike: (id: string) => Promise<void>;
  onBack: () => void; onJoin: (initiative: PublicInitiative, implementation?: PublicImplementation) => void;
}
export function InitiativePage({ initiative, loading, loadError, onRetry, liked, liking, onLike, onBack, onJoin }: Props) {
  const [shareNotice, setShareNotice] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [initiative?.id]);
  if (!initiative && !loading && !loadError) return <NotFoundView title="Инициатива не найдена" description="Возможно, идея снята с публикации или ссылка устарела. Посмотри другие инициативы — им тоже нужна твоя поддержка." />;
  if (!initiative) return <main className="ideas-page initiative-page"><button type="button" className="ideas-back" onClick={onBack}><ArrowLeft size={17} /> Все инициативы</button><div className="ideas-empty" role={loadError ? 'alert' : 'status'}><h1>{loading ? 'Загружаем инициативу…' : loadError ? 'Не удалось загрузить инициативу' : 'Инициатива недоступна'}</h1><p>{loading ? 'Скоро здесь появится описание проекта.' : loadError ? 'Проверь соединение и попробуй ещё раз.' : 'Возможно, она снята с публикации. Другие идеи доступны в каталоге.'}</p>{loadError && <button type="button" className="journey-secondary" onClick={onRetry}>Повторить загрузку</button>}</div></main>;
  const vacancies = initiativeVacancies(initiative);
  const available = openImplementations(initiative);
  const active = initiative.implementations?.filter(item => item.status === 'active').length || 0;
  const completed = initiative.implementations?.filter(item => item.status === 'completed').length || 0;
  const published = new Date(initiative.publishedAt);
  function join() {
    if (!initiative && !loading && !loadError) return <NotFoundView title="Инициатива не найдена" description="Возможно, идея снята с публикации или ссылка устарела. Посмотри другие инициативы — им тоже нужна твоя поддержка." />;
  if (!initiative) return;
    if (available.length > 1) document.getElementById('initiative-places')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    else onJoin(initiative, available[0]);
  }
  async function share() {
    if (!initiative && !loading && !loadError) return <NotFoundView title="Инициатива не найдена" description="Возможно, идея снята с публикации или ссылка устарела. Посмотри другие инициативы — им тоже нужна твоя поддержка." />;
  if (!initiative) return;
    const url = new URL(initiativeHref(initiative.id), location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: initiative.title, url });
      else { await navigator.clipboard.writeText(url); setShareNotice('Ссылка скопирована'); }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setShareNotice('Скопируй ссылку из адресной строки браузера.'); }
  }
  return <main className="ideas-page initiative-page">
    <button type="button" className="ideas-back" onClick={onBack}><ArrowLeft size={17} /> Все инициативы</button>
    {loadError && <p className="inline-error" role="alert">Не удалось обновить данные инициативы. <button type="button" onClick={onRetry}>Попробовать снова</button></p>}
    <div className="initiative-page-layout"><article className="initiative-story">
      <div className="initiative-page-tags"><span className="idea-category">{directionLabel(initiative)}</span><span>{initiativeStage(initiative)}</span></div>
      <h1 ref={headingRef} tabIndex={-1}>{initiative.title}</h1>
      <div className="initiative-published"><span className="idea-avatar" aria-hidden="true">{authorInitials(initiative.author)}</span><span>{initiative.author}</span>{Number.isFinite(published.getTime()) && <time dateTime={initiative.publishedAt}><CalendarDays size={15} />{published.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</time>}</div>
      <button type="button" className="home-primary initiative-mobile-action" onClick={join}>{available.length > 1 ? 'Выбрать площадку' : 'Хочу помочь'}<ArrowUpRight size={18} /></button>
      <InitiativeArt initiative={initiative} large />
      <section className="initiative-about"><span className="ideas-eyebrow">ОБ ИНИЦИАТИВЕ</span><h2>Что хотим сделать</h2><p>{initiative.description}</p></section>
      {!!initiative.implementations?.length && <div className="initiative-facts"><div><strong>{initiative.implementations.length}</strong><span>Всего реализаций</span></div><div><strong>{active}</strong><span>Сейчас в работе</span></div><div><strong>{completed}</strong><span>Подтверждённых результатов</span></div></div>}
      <div id="initiative-places" className="initiative-places"><InitiativeImplementations initiative={initiative} onJoin={implementation => onJoin(initiative, implementation)} /></div>
    </article><aside className="initiative-support" aria-labelledby="initiative-support-title">
      <h2 id="initiative-support-title">{available.length ? 'Присоединиться' : 'Поддержать инициативу'}</h2><p>{available.length ? 'Открытые места в команде.' : 'Предложи помощь или поставь лайк.'}</p>
      {available.length > 0 && <div className="initiative-vacancies"><span><Users size={16} />Свободные места</span>{vacancies.volunteers > 0 && <div>Волонтёры <strong>ещё {vacancies.volunteers}</strong></div>}{vacancies.activists > 0 && <div>Активисты <strong>ещё {vacancies.activists}</strong></div>}</div>}
      <button type="button" className="home-primary" onClick={join}>{available.length > 1 ? 'Выбрать площадку' : 'Хочу помочь'}<ArrowUpRight size={18} /></button>
      <button type="button" className="initiative-support-like" aria-pressed={liked} disabled={liking} onClick={() => void onLike(initiative.id)}>Поддержать идею · {initiative.likeCount || 0}<Heart size={19} fill={liked ? 'currentColor' : 'none'} /></button>
      <div className="initiative-support-author"><span className="idea-avatar" aria-hidden="true">{authorInitials(initiative.author)}</span><div><strong>{initiative.author}</strong><span>Автор инициативы</span></div></div>
      <p className="initiative-response-note">Ответственный рассмотрит отклик и свяжется с тобой.</p>
      <button type="button" className="initiative-share" onClick={() => void share()}><Link size={16} /> Поделиться инициативой</button>{shareNotice && <p className="journey-hint" role="status">{shareNotice}</p>}
    </aside></div>
  </main>;
}
