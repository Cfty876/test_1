import { InstallAppCard } from './InstallApp.tsx';
import React from 'react';
import { ArrowRight, ArrowUpRight, Globe2, Mail, Phone } from 'lucide-react';
import type { HelpArea } from './ApplicationFormView.tsx';
import { type PublicInitiative } from '../utils/publicInitiatives.ts';
import type { FeaturedInitiative } from '../utils/homepage.ts';
import { HelpWanted, HowItWorks } from './HomeSections.tsx';
import { type PublicImplementation } from '../utils/implementations.ts';

interface HomeViewProps {
  onOpenInitiative: (initiative: PublicInitiative) => void;
  onCatalog: () => void;
  onActivist: () => void;
  onGoToForm: (area?: HelpArea, initiative?: PublicInitiative, implementation?: PublicImplementation) => void;
  likedIds: string[];
  likingId: string | null;
  onLike: (id: string) => Promise<void>;
  onOpenLogin: () => void;
  featuredInitiatives: FeaturedInitiative[];
  featuredLoadError: boolean;
  onTrack: () => void;
}

const areas = [
  { number: '01', title: 'События', area: 'Мероприятия' as const, description: 'Организация мероприятий', color: 'clay' },
  { number: '02', title: 'Медиа', area: 'Медиа' as const, description: 'Фото, видео и тексты', color: 'sage' },
  { number: '03', title: 'Технологии', area: 'IT' as const, description: 'Разработка и дизайн', color: 'blue' },
  { number: '04', title: 'Волонтёрство', area: 'Волонтёрство' as const, description: 'Помощь на проектах', color: 'yellow' },
];

export const HomeView: React.FC<HomeViewProps> = ({ onOpenInitiative, onCatalog, onActivist, onGoToForm, onOpenLogin, featuredInitiatives, featuredLoadError, onTrack, likedIds, likingId, onLike }) => {
  return <div className="platform-home">
    <main className="platform-home-main">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-copy">
          <h1 id="home-title">
            <span className="home-title-line">Начни</span>
            <span className="home-title-line">перемены</span>
            <span className="home-title-line home-title-accent">в своём городе.</span>
          </h1>
          <p className="home-lede">
            <span className="desktop-copy">Предлагай инициативы или стань активистом: вместе меняем Екатеринбург.</span><span className="mobile-copy">Твоя идея. Твоя помощь. Наш город.</span>
          </p>
          <div className="home-actions">
            <a href="/?view=form&kind=initiative" onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onGoToForm(); }} className="home-primary home-participation-action">Предложить инициативу <ArrowRight size={17} /></a>
            <a href="/?view=form&kind=activist" onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onActivist(); }} className="home-login home-participation-action">Стать активистом <ArrowRight size={17} /></a>
          </div>
        </div>

        <div className="home-art" role="img" aria-label="Участники Движения Первых" />
      </section>

      <InstallAppCard />
      <HowItWorks onStart={() => onGoToForm()} onActivist={onActivist} />
      <div className="home-track-link"><span>Уже отправил заявку?</span><button type="button" onClick={onTrack}><span className="desktop-copy">Проверить статус и ответ команды</span><span className="mobile-copy">Проверить статус</span> <ArrowUpRight size={16} /></button></div>
      <HelpWanted initiatives={featuredInitiatives} loadError={featuredLoadError} onDetails={onOpenInitiative} onLike={onLike} likedIds={likedIds} likingId={likingId} onCatalog={onCatalog} />

      <section id="directions" tabIndex={-1} className="areas-section home-nav-target" aria-labelledby="areas-heading">
        <div className="areas-heading-row">
          <div>
            <h2 id="areas-heading">Найди своё направление</h2><p>Выбери, чем хочешь помогать. Можно отметить несколько направлений в анкете активиста.</p>
          </div>
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

      <section id="questions" tabIndex={-1} className="home-faq home-nav-target" aria-labelledby="home-faq-title"><div><h2 id="home-faq-title">Вопросы и ответы</h2></div><div className="home-faq-list">
        <details><summary>Нужно ли регистрироваться, чтобы предложить идею?</summary><p>Для инициативы и анкеты активиста аккаунт не нужен. Сохрани код заявки, чтобы проверить ответ, внести изменения или отозвать её.</p></details>
        <details><summary>Что происходит после отправки?</summary><p>Команда рассмотрит заявку. Решение и комментарии появятся в её истории.</p><button type="button" onClick={onTrack}>Проверить мою заявку <ArrowUpRight size={14} /></button></details>
        <details><summary>Одобрение означает, что проект уже получил поддержку?</summary><p>После одобрения инициатива появится в каталоге. Анкета активиста попадёт в закрытую базу команды. Команду, сроки, площадку и ресурсы согласуют отдельно.</p></details>
        <details><summary>Кто увидит мои данные?</summary><p>В каталоге видны имя автора и описание. Телефон и почта доступны только команде. Не указывай личные контакты в описании.</p></details>
      </div></section>

      <footer id="contacts" tabIndex={-1} className="home-footer home-nav-target" aria-label="Информация о Движении Первых и контакты">
        <div className="footer-main">
          <section className="footer-about">
            <div className="footer-brandline">
              <img src="/brand/movement-logo.svg" alt="" className="footer-logo" />
              <div>
                <strong>Совет Первых Екатеринбурга</strong>
                <span>Движение Первых · Свердловская область</span>
              </div>
            </div>
            <p>Инициативы и активисты Совета Первых Екатеринбурга.</p>
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
            <h2 id="footer-social-title">Сообщества</h2>

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
          <a href="/documents/2026-11-01/index.html" target="_blank" rel="noopener noreferrer">Документы · тестовая редакция</a>
          <span>Движение Первых · Совет Екатеринбурга</span>
          <span><a href="https://xn--90acagbhgpca7c8c7f.xn--p1ai/regional-offices/regionalnoe-otdelenie-sverdlovskoy-oblasti_41/" target="_blank" rel="noreferrer">Об отделении</a></span>
          <button type="button" onClick={onOpenLogin}>Для команды <ArrowUpRight size={14} /></button>
          <button type="button" onClick={onTrack}>Моя заявка <ArrowUpRight size={14} /></button>
        </div>
      </footer>
    </main>
  </div>;
};
