import { ArrowUpRight, HeartHandshake } from 'lucide-react';
import type { FeaturedInitiative } from '../utils/homepage.ts';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { InitiativeCard } from './InitiativeCard.tsx';

export function HowItWorks({ onStart, onActivist }: { onStart: () => void; onActivist: () => void }) {
  return <section id="how-to-join" tabIndex={-1} className="how-section home-nav-target" aria-labelledby="how-title">
    <div className="home-section-heading"><h2 id="how-title">Два способа быть в движении</h2></div>
    <div className="participation-paths">
      <article className="participation-path"><h3>Есть идея?</h3><p>Предложи свой проект для города.</p><a href="/?view=form&kind=initiative" onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onStart(); }}>Предложить инициативу <ArrowUpRight size={20} /></a></article>
      <article className="participation-path"><h3>Хочешь помогать?</h3><p>Выбери направление и стань активистом.</p><a href="/?view=form&kind=activist" onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onActivist(); }}>Стать активистом <ArrowUpRight size={20} /></a></article>
    </div>
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
