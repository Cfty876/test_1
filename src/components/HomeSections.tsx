import { ArrowUpRight, ArrowRight, Lightbulb, Send, Users, HeartHandshake } from 'lucide-react';
import type { FeaturedInitiative } from '../utils/homepage.ts';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { InitiativeCard } from './InitiativeCard.tsx';

const IDEA_STEPS = [
  { title: 'Предложи идею', text: 'Заполни короткую анкету и расскажи, что хочешь изменить.', icon: Lightbulb },
  { title: 'Получи ответ', text: 'Команда рассмотрит заявку. Одобренная идея появится в каталоге.', icon: Send },
  { title: 'Найди команду', text: 'Пригласи единомышленников. Участники смогут откликнуться на проект.', icon: Users },
  { title: 'Действуй вместе', text: 'Согласуйте план и даты, распределите задачи и воплотите идею.', icon: HeartHandshake },
];
export function HowItWorks({ onStart }: { onStart: () => void }) {
  return <section id="how-to-join" tabIndex={-1} className="how-section idea-process home-nav-target" aria-labelledby="how-title">
    <div className="home-section-heading"><div><p className="process-eyebrow">От первого шага до общего дела</p><h2 id="how-title">Как идея становится делом</h2></div></div>
    <ol className="idea-process-steps">{IDEA_STEPS.map((step, index) => <li key={step.title}>
      <div className="idea-process-index"><span>{String(index + 1).padStart(2, '0')}</span><step.icon size={22} strokeWidth={1.5} aria-hidden="true" /></div>
      <h3>{step.title}</h3><p>{step.text}</p>
    </li>)}</ol>
    <a className="idea-process-start" href="/?view=form&kind=initiative" onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onStart(); }}>Сделать первый шаг <ArrowRight size={18} aria-hidden="true" /></a>
  </section>;
}

export function HelpWanted({ initiatives, onDetails, loadError, onLike, likedIds, likingId, onCatalog }: {
  initiatives: FeaturedInitiative[];
  onDetails: (initiative: PublicInitiative) => void;
  loadError: boolean;
  onLike: (id: string) => Promise<void>;
  likedIds: string[];
  likingId: string | null;
  onCatalog: () => void;
}) {
  return <section id="need-team" tabIndex={-1} className="help-section editorial-help home-nav-target" aria-labelledby="help-title">
    <div className="home-section-heading"><h2 id="help-title">Нужна команда</h2><a href="/?view=initiatives" className="ideas-all-link" onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onCatalog(); }}>Все инициативы <ArrowUpRight size={20} /></a></div>
    {initiatives.length ? <div className="help-grid">{initiatives.map(initiative => <InitiativeCard key={initiative.id} initiative={initiative} editorial helpNeeded={initiative.helpNeeded} onOpen={onDetails} onLike={onLike} liked={likedIds.includes(initiative.id)} liking={Boolean(likingId)} />)}</div>
      : <div className="help-empty"><HeartHandshake size={32} strokeWidth={1.4} /><div><h3>{loadError ? 'Не удалось загрузить подборку' : 'Пока нет подборки'}</h3><p>{loadError ? 'Попробуй обновить страницу немного позже.' : 'Другие проекты доступны в каталоге.'}</p><button type="button" className="ideas-all-link" onClick={onCatalog}>Все инициативы <ArrowUpRight size={17} /></button></div></div>}
  </section>;
}
