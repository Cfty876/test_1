import { requestPagePositionUpdate, subscribePagePosition } from '../utils/pagePosition.ts';
import { InstallAppMenuButton } from './InstallApp.tsx';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { ArrowUpRight, LogIn, Mail, Phone, X } from 'lucide-react';
import { ModalDialog } from './ModalDialog.tsx';
import type { HelpArea } from '../utils/auth.ts';

const LINKS = [
  { id: 'how-to-join', label: 'Как участвовать', description: 'От первого шага до общего дела' },
  { id: 'need-team', label: 'Нужна команда', description: 'Проекты, которым нужна помощь' },
  { id: 'directions', label: 'Направления', description: 'Выбери, чем хочешь помочь' },
  { id: 'questions', label: 'Вопросы', description: 'Ответы о работе платформы' },
  { id: 'contacts', label: 'Контакты', description: 'Связаться с командой Совета' },
] as const;
const PRIMARY_LINKS = [
  { id: 'how-to-join', label: 'О платформе' },
  { id: 'need-team', label: 'Нужна команда' },
  { id: 'initiatives', label: 'Инициативы' },
  { id: 'contacts', label: 'Контакты' },
];

function SocialLinks({ expanded = false }: { expanded?: boolean }) {
  return <div className={expanded ? 'home-menu-socials' : 'home-nav-socials'}><a href="https://vk.ru/mypervie96_ekb" target="_blank" rel="noreferrer" aria-label="ВКонтакте Совета Первых местного отделения города Екатеринбург" title="ВКонтакте · Екатеринбург"><img src="/brand/vk-navigation.svg" alt="" />{expanded && <span>ВКонтакте · Екатеринбург</span>}</a><a href="https://max.ru/mypervie96" target="_blank" rel="noreferrer" aria-label="MAX Движения Первых Свердловской области" title="MAX · Свердловская область"><img src="/brand/max-navigation.svg" alt="" />{expanded && <span>MAX · Свердловская область</span>}</a></div>;
}

interface Props { signedIn: boolean; onLogin: () => void; onStart: (area?: HelpArea) => void; onTrack: () => void; onHome: () => void; onIdeas: () => void; isHome: boolean; onHomeSection: (id: string) => void }

export function HomeNavigation({ signedIn, onLogin, onStart, onTrack, onHome, onIdeas, isHome, onHomeSection }: Props) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const actionFrame = useRef(0);
  const [activeId, setActiveId] = useState('');
  const linksRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const scrollIntent = useRef<{ id: string; until: number } | null>(null);

  useEffect(() => () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); cancelAnimationFrame(actionFrame.current); }, []);

  useEffect(() => {
    if (!isHome) { setActiveId('initiatives'); return; }
    setActiveId('');
    const desktop = window.matchMedia('(min-width: 1101px)');
    let headerHeight = 65;
    let targets: { id: string; top: number }[] = [];
    const unsubscribe = subscribePagePosition(({ scrollY, viewportHeight, documentHeight, layoutChanged }) => {
      if (!desktop.matches && !open) return;
      if (layoutChanged) {
        headerHeight = document.querySelector('.platform-topbar')?.getBoundingClientRect().height || 65;
        targets = LINKS.flatMap(link => {
          const target = document.getElementById(link.id);
          return target ? [{ id: link.id, top: target.getBoundingClientRect().top + scrollY }] : [];
        });
      }
      let selected = '';
      for (const target of targets) if (target.top <= scrollY + headerHeight + 55) selected = target.id;
      const maxScroll = documentHeight - viewportHeight;
      if (maxScroll > 0 && scrollY >= maxScroll - 3) selected = 'contacts';
      if (scrollIntent.current && Date.now() < scrollIntent.current.until) selected = scrollIntent.current.id;
      else scrollIntent.current = null;
      setActiveId(previous => previous === selected ? previous : selected);
    });
    const releaseIntent = () => { scrollIntent.current = null; requestPagePositionUpdate(); };
    const releaseOnKey = (event: KeyboardEvent) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) releaseIntent(); };
    window.addEventListener('pervik:home-top', releaseIntent);
    window.addEventListener('wheel', releaseIntent, { passive: true });
    window.addEventListener('touchstart', releaseIntent, { passive: true });
    window.addEventListener('keydown', releaseOnKey);
    return () => {
      unsubscribe();
      window.removeEventListener('pervik:home-top', releaseIntent);
      window.removeEventListener('wheel', releaseIntent); window.removeEventListener('touchstart', releaseIntent);
      window.removeEventListener('keydown', releaseOnKey);
    };
  }, [open, isHome]);

  useEffect(() => {
    const nav = linksRef.current;
    if (!nav) return;
    const measure = () => {
      const link = nav.querySelector<HTMLElement>('[aria-current]');
      if (!link) return;
      nav.style.setProperty('--nav-indicator-left', `${link.offsetLeft}px`);
      nav.style.setProperty('--nav-indicator-width', `${link.offsetWidth}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeId]);

  useEffect(() => {
    if (!isHome) return;
    let frame = 0;
    const restoreAnchor = () => {
      const id = window.location.hash.slice(1);
      if (!LINKS.some(link => link.id === id)) return;
      frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    };
    restoreAnchor();
    window.addEventListener('hashchange', restoreAnchor);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', restoreAnchor); };
  }, [isHome]);

  function closeMenu(after?: () => void) {
    if (closeTimer.current !== null) return;
    if (!open) { after?.(); return; }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null; setOpen(false); setClosing(false);
      if (after) actionFrame.current = requestAnimationFrame(after);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(id);
    event.preventDefault();
    if (!target || !isHome) { closeMenu(() => onHomeSection(id)); return; }
    closeMenu(() => {
      setActiveId(id); scrollIntent.current = { id, until: Date.now() + 1300 };
      const url = new URL(window.location.href); url.hash = id;
      if (url.href !== window.location.href) window.history.pushState({ ...window.history.state, platformView: 'home' }, '', url);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  function sectionLink(id: string, label: string) {
    return <a href={`/#${id}`} aria-current={activeId === id ? 'location' : undefined} onClick={event => navigate(event, id)}>{label}</a>;
  }
  function goHome(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    closeMenu(() => { onHome(); window.dispatchEvent(new Event('pervik:home-top')); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
  }

  return <div className="home-header-navigation">
    <nav ref={linksRef} id="home-navigation" aria-label="Навигация по сайту" className="home-nav-links" data-active={PRIMARY_LINKS.some(link => link.id === activeId)}>
      {PRIMARY_LINKS.map(link => <a key={link.id} href={link.id === 'initiatives' ? '/?view=initiatives' : `/#${link.id}`} aria-current={activeId === link.id ? (isHome ? 'location' : 'page') : undefined} onClick={event => { if (link.id !== 'initiatives') { navigate(event, link.id); return; } if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); closeMenu(onIdeas); }}><strong>{link.label}</strong></a>)}
      <span className="home-nav-indicator" aria-hidden="true" />
    </nav>
    <div className="home-nav-controls"><SocialLinks /><button type="button" className="home-nav-login-icon" aria-label={signedIn ? 'Открыть личный кабинет' : 'Войти в личный кабинет'} title={signedIn ? 'Личный кабинет' : 'Войти'} onClick={onLogin}><LogIn size={23} strokeWidth={1.8} /></button><button ref={toggleRef} type="button" className="home-nav-toggle" aria-label="Открыть меню" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'home-full-menu' : undefined} onClick={() => { setClosing(false); setOpen(true); }}><span /><span /><span /></button></div>
    {open && <ModalDialog fullScreen labelledBy="home-menu-title" className={`home-menu-dialog${closing ? ' is-closing' : ''}`} onClose={() => closeMenu()} busy={closing}>
      <div id="home-full-menu" className="home-menu-surface"><h2 id="home-menu-title" className="sr-only">Меню платформы Совета Первых местного отделения города Екатеринбург</h2>
        <header className="home-menu-header"><a href="/" className="home-menu-brand" onClick={goHome}><img src="/brand/ekb-council-logo.svg" alt="Совет Первых местного отделения города Екатеринбург — на главную" /><span>Совет Первых местного отделения города Екатеринбург<small>Екатеринбург</small></span></a><div className="home-menu-header-actions"><button type="button" className="home-menu-login" disabled={closing} onClick={() => closeMenu(onLogin)}><LogIn size={20} /><span>{signedIn ? 'Личный кабинет' : 'Войти в кабинет'}</span></button><button type="button" className="home-menu-close" disabled={closing} aria-label="Закрыть меню" onClick={() => closeMenu()}><X size={23} strokeWidth={1.6} /></button></div></header>
        <div className="home-menu-grid">
          <div className="home-menu-column" style={{ '--menu-index': 0 } as CSSProperties}>
            <section className="home-menu-group"><h3>Инициативы</h3><nav aria-label="Проекты и команды">
              <a href="/?view=initiatives" onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); closeMenu(onIdeas); }}>Все инициативы</a>
              {sectionLink('need-team', 'Нужна команда')}
              <button type="button" onClick={() => closeMenu(() => onStart())}>Предложить инициативу</button><a href="/?view=form&kind=activist">Стать активистом</a>
            </nav></section>
            <section className="home-menu-group"><h3>Моя заявка</h3><nav aria-label="Работа с заявкой"><button type="button" onClick={() => closeMenu(onTrack)}>Проверить статус</button></nav></section>
          </div>
          <div className="home-menu-column" style={{ '--menu-index': 1 } as CSSProperties}>
            <section className="home-menu-group"><h3>О платформе</h3><nav aria-label="О платформе">
              {sectionLink('how-to-join', 'Как участвовать')}{sectionLink('directions', 'Направления')}{sectionLink('questions', 'Вопросы и ответы')}{sectionLink('contacts', 'Контакты')}
            </nav></section>
          </div>
          <aside className="home-menu-column home-menu-aside" style={{ '--menu-index': 2 } as CSSProperties}><div className="home-menu-contact-card"><h3>Будь на связи</h3><p>Совет Первых местного отделения города Екатеринбург</p><SocialLinks expanded /><div className="home-menu-contact-line"><span>Служба заботы Движения Первых</span><a href="tel:88003336311"><Phone size={15} />8 800 333-63-11</a><a href="mailto:zabota@pervye.ru"><Mail size={15} />zabota@pervye.ru</a></div></div><a className="home-menu-official" href="https://будьвдвижении.рф/" target="_blank" rel="noreferrer">Сайт Движения Первых <ArrowUpRight size={16} /></a></aside>
        </div><InstallAppMenuButton /><footer className="home-menu-footer"><span>Екатеринбург · Совет Первых местного отделения города Екатеринбург</span></footer>
      </div>
    </ModalDialog>}
  </div>;
}
