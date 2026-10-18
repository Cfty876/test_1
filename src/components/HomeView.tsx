import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, Globe2, Lightbulb, LogIn, Mail, Phone, Search, X } from 'lucide-react';
import type { HelpArea } from './ApplicationFormView.tsx';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';

interface HomeViewProps {
  onGoToForm: (area?: HelpArea) => void;
  onOpenLogin: () => void;
  initiatives: PublicInitiative[];
}

const areas = [
  { number: '01', title: 'События', area: 'Мероприятия' as const, description: 'Придумать, собрать, провести', color: 'clay' },
  { number: '02', title: 'Медиа', area: 'Медиа' as const, description: 'Рассказывать о том, что важно', color: 'sage' },
  { number: '03', title: 'Технологии', area: 'IT' as const, description: 'Создавать полезные цифровые вещи', color: 'blue' },
  { number: '04', title: 'Волонтёрство', area: 'Волонтёрство' as const, description: 'Быть рядом и помогать делом', color: 'yellow' },
];

const boardAreas: Array<'Все' | HelpArea> = ['Все', 'Мероприятия', 'Медиа', 'IT', 'Волонтёрство'];

export const HomeView: React.FC<HomeViewProps> = ({ onGoToForm, onOpenLogin, initiatives }) => {
  const [selectedArea, setSelectedArea] = useState<'Все' | HelpArea>('Все');
  const [query, setQuery] = useState('');
  const [selectedInitiative, setSelectedInitiative] = useState<PublicInitiative | null>(null);
  const visibleInitiatives = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    return initiatives.filter((initiative) => {
      if (selectedArea !== 'Все' && initiative.area !== selectedArea) return false;
      return !needle || [initiative.title, initiative.description, initiative.area, initiative.author]
        .some((value) => value.toLocaleLowerCase('ru').includes(needle));
    });
  }, [initiatives, selectedArea, query]);

  return <div className="platform-home">
    <main className="platform-home-main">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-copy">
          <div className="home-kicker"><span className="home-kicker-dot" /> ЕКАТЕРИНБУРГ · СОВЕТ ПЕРВЫХ</div>
          <h1 id="home-title">
            <span className="home-title-line">Начни</span>
            <span className="home-title-line">перемены</span>
            <span className="home-title-line home-title-accent">в своём городе.</span>
          </h1>
          <p className="home-lede">
            Предложи инициативу, найди единомышленников и получи поддержку Совета Первых Екатеринбурга, чтобы воплотить её в жизнь.
          </p>
          <div className="home-actions">
            <button type="button" onClick={() => onGoToForm()} className="home-primary">
              Предложить идею <ArrowRight size={17} strokeWidth={2.2} />
            </button>
            <button type="button" onClick={onOpenLogin} className="home-login">
              <LogIn size={16} /> Войти в кабинет
            </button>
          </div>
        </div>

        <div className="home-art" aria-label="Участники Движения Первых" />
      </section>

      <section className="initiative-board-section" aria-labelledby="initiative-board-title">
        <div className="initiative-board-heading">
          <div>
            <div className="section-eyebrow"><span className="home-kicker-dot" /> ИДЕИ, КОТОРЫЕ СТАНОВЯТСЯ ДЕЛОМ</div>
            <h2 id="initiative-board-title">Доска инициатив</h2>
            <p>Идеи ребят Екатеринбурга, которые уже получили поддержку Совета Первых.</p>
          </div>
          <div className="initiative-board-count"><Lightbulb size={18} /><strong>{initiatives.length}</strong><span>{initiatives.length === 1 ? 'инициатива' : 'инициатив'}</span></div>
        </div>

        <div className="initiative-board-tools">
          <label className="initiative-search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти идею или автора" aria-label="Поиск инициатив" />
          </label>
          <div className="initiative-filters" aria-label="Фильтр по направлению">
            {boardAreas.map((area) => (
              <button key={area} type="button" aria-pressed={selectedArea === area} onClick={() => setSelectedArea(area)}>{area}</button>
            ))}
          </div>
        </div>

        {visibleInitiatives.length ? (
          <div className="initiative-sticker-grid">
            {visibleInitiatives.map((initiative, index) => (
              <button type="button" key={initiative.id} onClick={() => setSelectedInitiative(initiative)} className={`initiative-sticker sticker-tone-${index % 4}`}>
                <span className="sticker-pin" aria-hidden="true" />
                <span className="sticker-topline"><span>{initiative.area}</span><ArrowUpRight size={16} /></span>
                <strong>{initiative.title}</strong>
                <span className="sticker-description">{initiative.description}</span>
                <span className="sticker-author">{initiative.author}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="initiative-board-empty">
            <div className="initiative-empty-icon"><Lightbulb size={22} /></div>
            <h3>{initiatives.length ? 'По этому запросу идей пока нет' : 'Здесь появятся идеи ребят'}</h3>
            <p>{initiatives.length ? 'Попробуй другое направление или измени поиск.' : 'Предложи свою инициативу. После одобрения Советом она появится на этой доске.'}</p>
            {!initiatives.length && <button type="button" onClick={() => onGoToForm()} className="initiative-empty-cta">Предложить инициативу <ArrowRight size={16} /></button>}
          </div>
        )}
      </section>

      <section className="areas-section" aria-labelledby="areas-heading">
        <div className="areas-heading-row">
          <div>
            <div className="section-eyebrow">ТВОЁ МЕСТО ЗДЕСЬ</div>
            <h2 id="areas-heading">С чего начнём?</h2>
          </div>
          <p>Неважно, сколько у тебя опыта.<br />Важно, что тебе хочется сделать.</p>
        </div>
        <div className="area-grid">
          {areas.map((area) => (
            <button type="button" key={area.number} onClick={() => onGoToForm(area.area)} className={`area-card area-${area.color}`}>
              <span className="area-number">{area.number}</span>
              <span className="area-arrow"><ArrowUpRight size={17} /></span>
              <span className="area-title">{area.title}</span>
              <span className="area-description">{area.description}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="home-footer" aria-label="Информация о Движении Первых и контакты">
        <div className="footer-main">
          <section className="footer-about">
            <div className="footer-brandline">
              <img src="/brand/movement-logo.svg" alt="" className="footer-logo" />
              <div>
                <strong>Совет Первых Екатеринбурга</strong>
                <span>Движение Первых · Свердловская область</span>
              </div>
            </div>
            <p>Общероссийское общественно-государственное движение детей и молодёжи. Создаём возможности, чтобы идеи Первых становились делами — вместе с городом и для города.</p>
            <div className="footer-facts" aria-label="Данные регионального отделения">
              <span><b>466 154</b> участника</span>
              <span><b>16 689</b> наставников</span>
              <span><b>1 583</b> первичных отделения</span>
            </div>
            <a className="footer-official-link" href="https://будьвдвижении.рф" target="_blank" rel="noreferrer">
              <Globe2 size={16} /> Официальный сайт Движения Первых <ArrowUpRight size={14} />
            </a>
          </section>

          <section className="footer-contact" aria-labelledby="footer-contact-title">
            <h2 id="footer-contact-title">Контакты</h2>
            <a href="mailto:r66@pervye.ru"><Mail size={16} /><span>r66@pervye.ru</span></a>
            <p>Служба заботы Движения Первых</p>
            <a href="tel:88003336311"><Phone size={16} /><span>8 800 333-63-11<small>По России · будни, 7:00–21:00 МСК</small></span></a>
            <a href="tel:84955653010"><Phone size={16} /><span>+7 495 565-30-10<small>Москва и Московская область</small></span></a>
            <a href="mailto:zabota@pervye.ru"><Mail size={16} /><span>zabota@pervye.ru</span></a>
          </section>

          <section className="footer-social" aria-labelledby="footer-social-title">
            <h2 id="footer-social-title">Сообщества Екатеринбурга</h2>
            <p>Официальные страницы Движения Первых в Екатеринбурге и Свердловской области</p>
            <div className="footer-social-links">
              <a href="https://vk.ru/mypervie96_ekb" target="_blank" rel="noreferrer" aria-label="ВКонтакте Движения Первых Екатеринбурга" title="ВКонтакте · Екатеринбург">
                <img className="movement-social-icon" src="/brand/vk.svg" alt="" /><span>ВКонтакте · Екатеринбург</span><ArrowUpRight size={14} />
              </a>
              <a href="https://max.ru/mypervie96" target="_blank" rel="noreferrer" aria-label="MAX Движения Первых Свердловской области" title="MAX · Свердловская область">
                <img className="movement-social-icon movement-social-max" src="/brand/max-logo.png" alt="" /><span>MAX · область</span><ArrowUpRight size={14} />
              </a>
            </div>
          </section>
        </div>

        <div className="footer-bottom">
          <span>Движение Первых · Совет Екатеринбурга</span>
          <span>Информация об отделении — на <a href="https://xn--90acagbhgpca7c8c7f.xn--p1ai/regional-offices/regionalnoe-otdelenie-sverdlovskoy-oblasti_41/" target="_blank" rel="noreferrer">официальном сайте Движения</a></span>
          <button type="button" onClick={onOpenLogin}>Для команды <ArrowUpRight size={14} /></button>
        </div>
      </footer>
    </main>
      {selectedInitiative && (
        <div className="initiative-dialog-backdrop" role="presentation" onClick={() => setSelectedInitiative(null)}>
          <section className="initiative-dialog" role="dialog" aria-modal="true" aria-labelledby="initiative-dialog-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="initiative-dialog-close" aria-label="Закрыть" onClick={() => setSelectedInitiative(null)}><X size={19} /></button>
            <span className="initiative-dialog-area">{selectedInitiative.area}</span>
            <h2 id="initiative-dialog-title">{selectedInitiative.title}</h2>
            <p className="initiative-dialog-description">{selectedInitiative.description}</p>
            <div className="initiative-dialog-meta"><span>Автор: {selectedInitiative.author}</span><span><CalendarDays size={14} /> {new Date(selectedInitiative.publishedAt).toLocaleDateString('ru-RU')}</span></div>
            <button type="button" className="initiative-empty-cta" onClick={() => { setSelectedInitiative(null); onGoToForm(selectedInitiative.area); }}>Хочу помочь <ArrowRight size={16} /></button>
          </section>
        </div>
      )}
  </div>;
};
