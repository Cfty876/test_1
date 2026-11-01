import { CouncilNavigation } from './CouncilNavigation.tsx';
import { FitText } from './FitText.tsx';
import '../school.css';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, CalendarDays, Check, ChevronRight, CircleHelp, Flag, Home, Radio, Trophy, Users, X } from 'lucide-react';
import type { DashboardViewProps } from './DashboardView.tsx';
import { ImplementationBoard } from './ImplementationBoard.tsx';
import { CouncilCalendar, MeritPanel, useMemberHub } from './MemberCommunity.tsx';
import { SchoolDirectory } from './SchoolDirectory.tsx';
import { InitiativeArt } from './InitiativeArt.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import { IMPLEMENTATION_LABELS, type Implementation } from '../utils/implementations.ts';

type Tab = 'home' | 'base' | 'projects' | 'ranking' | 'calendar';
type DirectorySection = 'ideas' | 'people';
const NAV = [
  { id: 'home', label: 'Мой кабинет', short: 'Главная', icon: Home },
  { id: 'base', label: 'Идеи', short: 'Идеи', icon: Users },
  { id: 'projects', label: 'Мои проекты', short: 'Проекты', icon: Flag },
  { id: 'ranking', label: 'Рейтинг', short: 'Рейтинг', icon: Trophy },
  { id: 'calendar', label: 'Календарь', short: 'Календарь', icon: CalendarDays },
] as const;
const PAGE_COPY: Record<Tab, { title: string; description: string }> = {
  home: { title: 'Твоя школа. Твоё движение.', description: 'Место, где идеи становятся общим делом.' },
  base: { title: 'Идеи', description: 'Выбери идею для своей школы или найди тех, кто поможет.' },
  projects: { title: 'Мои проекты', description: 'От первого плана до результата. Все шаги здесь.' },
  ranking: { title: 'Твой вклад. Общий рейтинг.', description: 'Твои баллы и общий рейтинг председателей.' },
  calendar: { title: 'Календарь движения', description: 'Все события Совета и даты проведения инициатив.' },
};
const MOBILE_TITLES: Record<Tab, string> = { home: 'Мой кабинет', base: 'Идеи', projects: 'Мои проекты', ranking: 'Рейтинг', calendar: 'Календарь' };
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yekaterinburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function formatDate(value?: string) {
  if (!value) return 'Даты ещё не назначены';
  return new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(value.slice(0, 4) !== today().slice(0, 4) ? { year: 'numeric' as const } : {}) });
}
function nextStep(project: Implementation) {
  return project.status === 'changes_requested' ? 'Дополни отчёт по замечаниям' : project.status === 'active' ? 'Подготовь событие и отправь отчёт' : project.status === 'report_pending' ? 'Отчёт проверяют. Решение появится здесь' : 'Дождись согласования запуска';
}
export function SchoolMemberPortal(props: DashboardViewProps) {
  const [tab, setTab] = useState<Tab>(() => {
    const saved = new URLSearchParams(location.search).get('member');
    return NAV.some(n => n.id === saved) ? saved as Tab : 'home';
  });
  const [directorySection, setDirectorySection] = useState<DirectorySection>('ideas');
  useEffect(() => { const back = () => { const saved = new URLSearchParams(location.search).get('member'); setTab(NAV.some(item => item.id === saved) ? saved as Tab : 'home'); setProposal(null); }; window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back); }, []);
  const [proposal, setProposal] = useState<{ initiativeId: string; key: number } | null>(null);
  const proposalNumber = useRef(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const { hub, refresh, error } = useMemberHub();
  const mainTitle = useRef<HTMLHeadingElement>(null);
  const { currentUser: user } = props;
  const me = hub?.ranking.find(r => r.mine);
  const liveIssue = error || props.syncIssue;
  const projects = props.implementations.filter(p => p.ownerLogin === user.login);
  const ongoing = projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled');
  const priority = [...ongoing].sort((a, b) => Number(b.status === 'changes_requested') - Number(a.status === 'changes_requested') || (a.startDate || '9999').localeCompare(b.startDate || '9999')).slice(0, 3);
  const upcoming = hub?.calendar.filter(e => e.endDate >= today()).slice(0, 3) || [];
  const recentPoints = hub?.ledger.filter(e => e.accountId === hub.myAccountId).slice(0, 2) || [];
  const pendingClaims = hub?.claims.filter(c => c.status === 'pending').length || 0;
  const peopleCount = props.baseMembers.filter(m => !m.isInitiative).length;
  function select(next: Tab) {
    setTab(next);
    if (next !== 'projects') setProposal(null);
    const url = new URL(location.href);
    url.searchParams.set('member', next);
    if (url.href !== location.href) history.pushState(history.state, '', url);
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => mainTitle.current?.focus({ preventScroll: true }));
  }
  function openDirectory(section: DirectorySection) { setDirectorySection(section); select('base'); }
  function takeIdea(initiativeId: string) { setProposal({ initiativeId, key: ++proposalNumber.current }); select('projects'); }
  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); props.showToast(`${label} скопирован`); }
    catch { props.showToast('Выделите текст и скопируйте вручную.'); }
  };
  return <main className="platform-dashboard cabinet-redesign member-workspace school-portal council-workspace" data-council-tone="school" data-school-page={tab}>
    <div className="school-layout">
      <CouncilNavigation items={NAV.map(item => ({ ...item }))} active={tab} onSelect={id => select(id as Tab)} tone="school" onHelp={() => setHelpOpen(true)} />
      <div className="school-main">
        <div className="school-context"><span><Flag size={16} aria-hidden="true" /><FitText text={user.branch || 'Твоё отделение'} minSize={12} /></span><span className={`school-live${liveIssue ? ' is-offline' : ''}`}><Radio size={14} aria-hidden="true" />{liveIssue ? 'Нет связи' : 'На связи'}</span></div>
        <header className="school-page-header"><div><h1 tabIndex={-1} ref={mainTitle}><span className="school-desktop-title">{PAGE_COPY[tab].title}</span><span className="school-mobile-title">{MOBILE_TITLES[tab]}</span></h1><p>{PAGE_COPY[tab].description}</p></div><button type="button" className="school-help-icon" aria-label="Как работать в кабинете" onClick={() => setHelpOpen(true)}><CircleHelp size={23} /></button></header>
        {liveIssue && <p className="school-connection" role="alert">{liveIssue} Последние данные сохранены на экране. Повторяем подключение.</p>}
        {tab === 'home' && <>
          <div className="school-home-lead">
            <section className="school-start"><div className="school-start-copy"><span className="school-overline">От идеи к действию</span><h2>{ongoing.length ? 'Твоя команда уже в деле' : 'Выбери дело. Собери команду.'}</h2><p>{ongoing.length ? 'Продолжай свои проекты или выбери новую идею для школьной команды.' : 'Выбери готовую идею, укажи даты и начни менять жизнь своей школы.'}</p><button type="button" className="school-button school-button-white" onClick={() => openDirectory('ideas')}>Выбрать идею<ArrowRight size={20} /></button></div><div className="school-start-mark" aria-hidden="true"><ArrowDownLeft strokeWidth={1.25} /></div></section>
            <section className="school-score"><div className="school-score-label"><span>Твой вклад</span><Trophy size={30} aria-hidden="true" /></div><div className="school-score-number">{hub ? (me?.points ?? 0).toLocaleString('ru-RU') : '…'}<span>баллов</span></div><p>{me?.points ? `Твоё место в рейтинге: ${me.rank}` : 'Каждое полезное дело — начало роста'}</p><button type="button" onClick={() => select('ranking')}>Мои баллы и рейтинг<ArrowRight size={18} /></button></section>
          </div>
          <div className="school-home-middle">
            <section className="school-panel school-project-preview"><div className="school-block-heading"><h2>Твои проекты{ongoing.length > 0 && <span>{ongoing.length} в работе</span>}</h2><button type="button" onClick={() => select('projects')}>Все проекты<ArrowRight size={17} /></button></div>{priority.length ? <div>{priority.map(project => <button type="button" className="school-project-row" key={project.id} onClick={() => select('projects')}><span className="school-project-state" data-status={project.status}>{IMPLEMENTATION_LABELS[project.status]}</span><strong>{project.initiativeTitle}</strong><span>{nextStep(project)}</span><small>{formatDate(project.startDate)}</small><ChevronRight size={20} aria-hidden="true" /></button>)}</div> : <div className="school-first-project"><Flag size={36} aria-hidden="true" /><div><h3>Здесь будет твоё первое дело</h3><p>Не нужно начинать с нуля: в каталоге есть идеи, которые можно провести в школе.</p><button type="button" onClick={() => openDirectory('ideas')}>Найти свою идею<ArrowRight size={17} /></button></div></div>}</section>
            <section className="school-agenda-preview"><div className="school-block-heading"><h2>Скоро в движении</h2><CalendarDays size={23} aria-hidden="true" /></div>{!hub ? <p role="status">Загружаем события…</p> : upcoming.length ? <ol>{upcoming.map(event => <li key={event.id}><span className="school-event-date">{formatDate(event.startDate)}</span><div><strong>{event.title}</strong><span>{event.location}</span>{event.status === 'proposed' && <small>Ждёт согласования</small>}</div></li>)}</ol> : <p className="school-agenda-empty">Новые события скоро появятся здесь. Даты твоих проектов тоже попадут в календарь.</p>}<button type="button" className="school-text-button" onClick={() => select('calendar')}>Открыть календарь<ArrowRight size={17} /></button></section>
          </div>
          <section className="school-ideas-preview"><div className="school-block-heading"><div><h2>Что проведём в школе?</h2><p>Готовые идеи, которым нужна твоя команда.</p></div><button type="button" onClick={() => openDirectory('ideas')}>Весь каталог<ArrowRight size={17} /></button></div>{props.publicLoadError && <p className="inline-error" role="alert">Каталог пока не загрузился. <button type="button" onClick={props.onRetryPublicLoad}>Загрузить ещё раз</button></p>}<div className="school-idea-teasers">{props.publishedInitiatives.slice(0, 3).map(idea => <button type="button" className="school-idea-teaser" key={idea.id} onClick={() => takeIdea(idea.id)}><InitiativeArt initiative={idea} /><span><small>{idea.area}</small><strong>{idea.title}</strong><span>Взять в работу<ArrowRight size={17} /></span></span></button>)}</div>{!props.publishedInitiatives.length && !props.publicLoadError && <p className="school-empty-line">{props.publicLoading ? 'Загружаем идеи…' : 'Опубликованные идеи появятся здесь после одобрения.'}</p>}</section>
          <div className="school-home-footer"><button type="button" onClick={() => openDirectory('people')}><Users size={21} /><span>Нужна команда?<small>{peopleCount ? `${peopleCount} участников в общей базе` : 'Знакомься с активистами Совета'}</small></span><ArrowRight size={18} /></button><button type="button" onClick={() => select('ranking')}><Check size={21} /><span>{pendingClaims ? `Заявок на баллы: ${pendingClaims} на проверке` : 'Сделал дело или опубликовал пост?'}<small>{recentPoints.length ? 'Посмотри историю начислений в рейтинге' : 'Расскажи о результате и подай заявку на баллы'}</small></span><ArrowRight size={18} /></button></div>
        </>}
        {tab === 'base' && <SchoolDirectory key={directorySection} initialSection={directorySection} members={props.baseMembers} initiatives={props.publishedInitiatives} onTakeIdea={takeIdea} onCopy={copy} loading={props.publicLoading} loadError={props.publicLoadError} onRetry={props.onRetryPublicLoad} />}
        {tab === 'projects' && <><ImplementationBoard memberMode key={proposal?.key ?? 'projects'} initialInitiativeId={proposal?.initiativeId} user={user} initiatives={props.publishedInitiatives} implementations={projects} applications={props.applications} photos={props.implementationPhotos} participants={props.implementationParticipants} notifications={props.notifications} onOpenResponses={() => {}} onRefresh={async () => { await props.onRefreshDashboard(); await refresh(); }} /></>}
        {tab === 'ranking' && (hub ? <MeritPanel schoolMode hub={hub} user={user} refresh={refresh} /> : <p className="school-loading" role="status">Загружаем твои баллы и рейтинг…</p>)}
        {tab === 'calendar' && (hub ? <CouncilCalendar hub={hub} refresh={refresh} /> : <p className="school-loading" role="status">Загружаем календарь…</p>)}
        <footer className="school-page-footer"><span>Первик · Совет Первых местного отделения города Екатеринбург</span><button type="button" onClick={() => setHelpOpen(true)}>Нужна подсказка?<CircleHelp size={16} /></button></footer>
      </div>
    </div>

    {helpOpen && <ModalDialog className="cabinet-dialog school-help-dialog council-help-dialog" labelledBy="school-help-title" onClose={() => setHelpOpen(false)}><div className="workflow-dialog"><div className="workflow-dialog-heading"><h2 id="school-help-title">Всё начинается с идеи</h2><button type="button" aria-label="Закрыть подсказку" onClick={() => setHelpOpen(false)}><X size={22} /></button></div><ol className="school-help-steps"><li><strong>Выбери, что провести</strong><p>Открой «Идеи» и нажми «Взять в работу».</p></li><li><strong>Расскажи о плане</strong><p>Укажи площадку, даты и план. Куратор или администратор согласует запуск.</p></li><li><strong>Проведи и покажи результат</strong><p>В «Проектах» отправь фотоотчёт и ссылки на публикации.</p></li><li><strong>Получи баллы за вклад</strong><p>Открой «Рейтинг» и подай заявку за проект или пост ВКонтакте.</p></li></ol><button type="button" className="school-button school-button-red" onClick={() => { setHelpOpen(false); openDirectory('ideas'); }}>Понятно, к идеям<ArrowRight size={19} /></button></div></ModalDialog>}
  </main>;
}
