import type { InitiativeDirection } from '../utils/initiativeDirections.ts';
import { CouncilNavigation } from './CouncilNavigation.tsx';
import { MaintenanceControl } from './MaintenanceControl.tsx';
import { SchoolMemberPortal } from './SchoolMemberPortal.tsx';
import { CommunityPanel } from './MemberCommunity.tsx';
import { InitiativeCoverManager } from './InitiativeCoverPicker.tsx';
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Building2, ClipboardList, Database, Home, Lightbulb, RefreshCw, CalendarDays, Trophy, LayoutDashboard, ShieldCheck, Users, } from 'lucide-react';
import { KeyIcon, CrossIcon, CopyIcon } from './Icons.tsx';
import type { UserSession } from '../utils/auth.ts';
import { HomepageEditor } from './HomepageEditor.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import type { FeaturedSelection } from '../utils/homepage.ts';
import type { ApplicationStatus, ApplicationEvent } from '../utils/applicationJourney.ts';
import { AdminOverview } from './AdminOverview.tsx';
import { CABINET_COPY, CabinetGuide, CabinetSectionHelp } from './CabinetGuide.tsx';
import { ApplicationInbox } from './ApplicationInbox.tsx';
import type { CouncilStatus, ParticipationRole, Implementation, ImplementationParticipant, PhotoSummary, PlatformNotification } from '../utils/implementations.ts';
import { ImplementationBoard } from './ImplementationBoard.tsx';
import { BaseRegistry } from './BaseRegistry.tsx';
import { AccessRegistry } from './AccessRegistry.tsx';
import { cabinetSections, canReviewAllApplications, canOverseeImplementations, isSchoolMember, type CabinetSection } from '../utils/permissions.ts';
import { platformRequest } from '../utils/platformApi.ts';
import type { CreateAccessRequest, GeneratedAccessCredentials } from '../utils/accessCredentials.ts';

export interface ApplicationItem {
  direction?: InitiativeDirection;
  vkUrl?: string;
  id: string;
  name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  initials: string;
  avatarBg: string;
  actionText: 'Добавить' | 'В работу';
  status: ApplicationStatus;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  history?: ApplicationEvent[];
  isInitiative?: boolean;
  helpAreas?: string[];
  helpArea?: string;
  area?: string;
  supportInitiativeId?: string;
  supportInitiativeTitle?: string;
  supportImplementationId?: string;
  participationRole?: ParticipationRole;
}

export interface BaseMember {
  vkUrl?: string;
  id: string;
  name: string;
  roleInfo: string;
  category: 'Мероприятия' | 'Медиа' | 'IT' | 'Волонтёрство';
  isInitiative: boolean;
  helpAreas?: string[];
  phone: string;
  email: string;
  initials: string;
  avatarBg: string;
  branch?: string;
  organization?: string;
  description?: string;
  author?: string;
  dateAdded?: string;
  supportInitiativeId?: string;
  supportInitiativeTitle?: string;
}

export interface AccessUser {
  id: string;
  name: string;
  roleInfo: string;
  login: string;
  password?: string;
  branch?: string;
  initials: string;
  avatarBg: string;
  councilStatus?: CouncilStatus;
  accessVersion?: number;
  credentialVersion?: number;
}

export interface DashboardViewProps {
  implementations: Implementation[];
  implementationPhotos: PhotoSummary[];
  implementationParticipants: ImplementationParticipant[];
  notifications: PlatformNotification[];
  syncIssue?: string;
  onRefreshDashboard: () => Promise<void>;
  currentUser: UserSession;
  applications: ApplicationItem[];
  baseMembers: BaseMember[];
  accessUsers: AccessUser[];
  publishedInitiatives: PublicInitiative[];
  featuredInitiatives: FeaturedSelection[];
  publicLoadError: boolean;
  publicLoading: boolean;
  processingApplications: string[];
  onRetryPublicLoad: () => void;
  onSaveFeatured: (selection: FeaturedSelection[], expected: FeaturedSelection[]) => Promise<void>;
  onReviewApplication: (id: string, status: 'accepted' | 'rejected' | 'needs_changes', reason: string, version?: number, coverId?: string, direction?: InitiativeDirection) => Promise<void>;
  onResetPassword: (user: AccessUser) => Promise<void>;
  onCreateAccess: (user: CreateAccessRequest) => Promise<void>;
  showToast: (text: string) => void;
}

const StaffDashboardView: React.FC<DashboardViewProps> = ({
  currentUser, implementations, implementationPhotos, implementationParticipants, notifications, onRefreshDashboard, syncIssue,
  applications, baseMembers, accessUsers, publishedInitiatives, featuredInitiatives,
  publicLoadError, publicLoading, processingApplications, onRetryPublicLoad, onSaveFeatured,
  onReviewApplication, onResetPassword, onCreateAccess, showToast,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const overseesProjects = canOverseeImplementations(currentUser);
  const canReviewAll = canReviewAllApplications(currentUser);
  const sections: readonly CabinetSection[] = isAdmin ? cabinetSections(currentUser.role) : ['overview', ...cabinetSections(currentUser.role), ...(canReviewAll ? ['users' as const] : [])];
  const initialTab: CabinetSection = 'overview';
  const [requestedTab, setRequestedTab] = useState<CabinetSection>(() => {
    const saved = new URLSearchParams(location.search).get('section') as CabinetSection;
    return sections.includes(saved) ? saved : initialTab;
  });
  const activeMainTab = sections.includes(requestedTab) ? requestedTab : initialTab;
  const panelAnchor = useRef<HTMLDivElement>(null);
  const pageTitle = useRef<HTMLHeadingElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusedApplication, setFocusedApplication] = useState('');
  const [applicationTarget, setApplicationTarget] = useState('');
  const [applicationKind, setApplicationKind] = useState<'all' | 'initiative' | 'help'>('all');
  const [queueRevision, setQueueRevision] = useState(0);
  const [implementationFilter, setImplementationFilter] = useState<Implementation['status'] | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Председатель');
  const [newUserBranch, setNewUserBranch] = useState('');
  const [generatedAccess, setGeneratedAccess] = useState<GeneratedAccessCredentials | null>(null);
  const [isGeneratingAccess, setIsGeneratingAccess] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [generationRevision, setGenerationRevision] = useState(0);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  const pendingCount = applications.filter(item => item.status === 'pending').length;
  const tabs = {
    ranking: { label: 'Рейтинг', icon: Trophy, count: null },
    calendar: { label: 'Календарь', icon: CalendarDays, count: null },
    overview: { label: 'Рабочий стол', icon: LayoutDashboard, count: null },
    applications: { label: canReviewAll ? 'Заявки' : overseesProjects ? 'Отклики города' : 'Отклики на проекты', icon: ClipboardList, count: pendingCount },
    base: { label: 'Люди и идеи', icon: Database, count: null },
    users: { label: 'Сотрудники', icon: Users, count: null },
    homepage: { label: 'Главная сайта', icon: Home, count: null },
    implementations: { label: 'Проекты', icon: Lightbulb, count: overseesProjects ? implementations.filter(item => item.status === 'proposed' || item.status === 'report_pending').length : null },
  };
  function selectTab(tab: CabinetSection) {
    if (!sections.includes(tab) || tab === activeMainTab) return;
    const url = new URL(location.href); url.searchParams.set('section', tab);
    history.pushState(history.state, '', url);
    setRequestedTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' }); requestAnimationFrame(() => pageTitle.current?.focus({ preventScroll: true }));
  }
  useEffect(() => { const back = () => { const saved = new URLSearchParams(location.search).get('section') as CabinetSection; const next = sections.includes(saved) ? saved : initialTab; setRequestedTab(next); }; window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back); }, [isAdmin, canReviewAll, currentUser.role]);
  function openRequests(kind: 'initiative' | 'help') {
    setFocusedApplication(''); setApplicationTarget(''); setApplicationKind(kind); setQueueRevision(value => value + 1); selectTab('applications');
  }
  function openProjects(filter: Implementation['status']) {
    setImplementationFilter(filter); setQueueRevision(value => value + 1); selectTab('implementations');
  }
  function openApplication(application: ApplicationItem) {
    setApplicationTarget(''); setApplicationKind('all'); setFocusedApplication(application.id); setQueueRevision(value => value + 1); selectTab('applications');
  }
  function addEmployee() {
    setNewUserName(''); setNewUserBranch(''); setNewUserRole('Председатель'); setGeneratedAccess(null); setGenerationError(''); setCreateUserError(''); setIsGeneratingAccess(true); setIsCreateUserModalOpen(true);
  }
  async function refresh() {
    if (refreshing) return; setRefreshing(true); setRefreshError('');
    try { await onRefreshDashboard(); } catch (failure) { setRefreshError(failure instanceof Error ? failure.message : 'Не удалось обновить кабинет. Попробуйте ещё раз.'); }
    finally { setRefreshing(false); }
  }
  useEffect(() => {
    if (!isCreateUserModalOpen) return;
    let active = true;
    setGeneratedAccess(null); setIsGeneratingAccess(true); setGenerationError(''); setCreateUserError('');
    void platformRequest<GeneratedAccessCredentials>('/users/credentials', {}).then(credentials => {
      if (active) setGeneratedAccess(credentials);
    }).catch((failure: unknown) => {
      if (active) setGenerationError(failure instanceof Error ? failure.message : 'Не удалось создать данные доступа.');
    }).finally(() => { if (active) setIsGeneratingAccess(false); });
    return () => { active = false; };
  }, [isCreateUserModalOpen, generationRevision]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} скопирован`);
    } catch {
      showToast('Не удалось скопировать. Выделите текст и скопируйте вручную.');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingUser || isGeneratingAccess || !newUserName.trim() || !generatedAccess) return;
    if (Date.parse(generatedAccess.expiresAt) <= Date.now()) { setGenerationRevision(value => value + 1); return; }

    const fullRoleInfo = newUserBranch.trim()
      ? `${newUserRole} · ${newUserBranch.trim()}`
      : newUserRole;

    setIsCreatingUser(true);
    setCreateUserError('');
    try {
      await onCreateAccess({
        name: newUserName.trim(),
        roleInfo: fullRoleInfo,
        credentialTicket: generatedAccess.ticket,
        branch: newUserBranch.trim(),
      });
      setNewUserName('');
      setNewUserBranch('');
      setGeneratedAccess(null);
      setIsCreateUserModalOpen(false);
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : 'Не удалось создать доступ');
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <main className={`platform-dashboard cabinet-workspace cabinet-redesign staff-workspace council-workspace${isAdmin ? " is-admin" : " is-curator"}`} data-council-tone="curator">
      <div className="cabinet-layout">
      <CouncilNavigation items={sections.map(id => ({ id, label: tabs[id].label, short: id === 'overview' ? 'Начало' : tabs[id].label, icon: tabs[id].icon, count: tabs[id].count }))} active={activeMainTab} onSelect={id => selectTab(id as CabinetSection)} tone="curator" primary={['overview','applications','implementations','ranking']} onHelp={() => setHelpOpen(true)} />
      <div className="cabinet-content"><div className="cabinet-container">
        <header className="cabinet-heading"><div><span className="cabinet-location">Первик · Личный кабинет · {isAdmin ? 'Администратор' : canReviewAll ? 'Куратор' : overseesProjects ? 'Председатель городского Совета' : 'Председатель'}</span><h1 ref={pageTitle} tabIndex={-1}>{CABINET_COPY[activeMainTab].title}</h1><p>{CABINET_COPY[activeMainTab].description}</p><span className="cabinet-sync-status" role="status">{syncIssue ? 'Ожидаем подключения к серверу' : 'Автообновление включено'}</span></div><button type="button" className="cabinet-button" disabled={refreshing} onClick={() => void refresh()} aria-label="Обновить данные кабинета"><RefreshCw size={16} /><span>{refreshing ? 'Обновляем…' : 'Обновить'}</span></button></header>
        {isAdmin && activeMainTab === 'overview' && <MaintenanceControl />}
        {syncIssue && <p className="inline-error" role="alert">{syncIssue}</p>}
        {activeMainTab !== 'overview' && <CabinetSectionHelp key={activeMainTab} section={activeMainTab} />}
        {!['overview','ranking','calendar','users'].includes(activeMainTab) && <div className="cabinet-overview">{(activeMainTab === 'applications' ? [
          { label: canReviewAll ? 'Ждут ответа' : 'Новых откликов', value: pendingCount },
          { label: 'На доработке', value: applications.filter(item => item.status === 'needs_changes').length },
          { label: 'Принято', value: applications.filter(item => item.status === 'accepted').length },
        ] : activeMainTab === 'base' ? [
          { label: 'Активистов', value: baseMembers.filter(item => !item.isInitiative).length },
          { label: 'Опубликованных идей', value: publishedInitiatives.length },
          { label: 'Всего людей и идей', value: baseMembers.filter(item => !item.isInitiative).length + publishedInitiatives.length },
        ] : activeMainTab === 'implementations' ? [
          { label: 'Ждут запуска', value: implementations.filter(item => item.status === 'proposed').length },
          { label: 'Реализуются', value: implementations.filter(item => item.status === 'active').length },
          { label: 'Отчётов на проверке', value: implementations.filter(item => item.status === 'report_pending').length },
        ] : activeMainTab === 'users' ? [
          { label: 'Выдано доступов', value: accessUsers.length },
          { label: 'Председателей', value: accessUsers.filter(item => !/^куратор/iu.test(item.roleInfo)).length },
          { label: 'Кураторов', value: accessUsers.filter(item => /^куратор/iu.test(item.roleInfo)).length },
        ] : [
          { label: 'Опубликовано инициатив', value: publishedInitiatives.length },
          { label: 'Выбрано для главной', value: featuredInitiatives.length },
          { label: 'Проектов с набором', value: publishedInitiatives.filter(item => item.implementations?.some(place => place.status === 'active' && (place.activistSlots > place.activistsAccepted || place.volunteerSlots > place.volunteersAccepted))).length },
        ]).map(item => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>}
        <div className="cabinet-messages"><details className="cabinet-permissions"><summary><ShieldCheck size={15} /> {currentUser.councilStatus || currentUser.roleBadge}<span>Ваши полномочия</span></summary><p>{isAdmin ? 'Все заявки и база, управление пользователями, публикациями, подборкой главной страницы и реализациями.' : overseesProjects ? 'Запуск и команды всех проектов, обработка откликов, проверка отчётов. Настройки сотрудников и главной сайта доступны только администратору.' : canReviewAll ? 'Приём и публикация заявок, просмотр базы и свои реализации. Главную страницу и пользователей настраивает администратор.' : 'Просмотр базы, свои реализации и обработка откликов на них. Общие заявки, пользователи и редактирование главной недоступны.'}{!isAdmin && <><br /><Building2 size={13} /> {currentUser.branch || 'Школа не указана — обратитесь к администратору.'}{currentUser.councilStatus && ' · Доступна городская реализация.'}</>}</p></details>
        <details className="cabinet-notifications"><summary><Bell size={16} /><strong><span className="desktop-copy">Сообщения команды</span><span className="mobile-copy">Сообщения</span></strong><span>{notifications.length}</span></summary><ol>{notifications.slice(0, 20).map(item => <li key={item.id}><p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ru-RU')}</time></li>)}{!notifications.length && <li><p>Новых сообщений пока нет.</p></li>}</ol></details></div>
        {refreshError && <p className="inline-error" role="alert">{refreshError}</p>}
        <div ref={panelAnchor} className="cabinet-panel-anchor">

          <div className="cabinet-panels">{sections.filter(tab => tab === activeMainTab).map(tab => <section key={tab} id={`cabinet-panel-${tab}`} aria-labelledby={`cabinet-nav-${tab}`} hidden={activeMainTab !== tab} className="cabinet-panel" data-active={activeMainTab === tab}>
            {(tab === 'ranking' || tab === 'calendar') && activeMainTab === tab && <CommunityPanel section={tab} user={currentUser} />}
            {tab === 'overview' && <AdminOverview canManage={isAdmin} canOversee={overseesProjects} applications={applications} implementations={implementations} initiatives={publishedInitiatives} onApplications={openRequests} onProjects={openProjects} onOpenApplication={openApplication} onNavigate={selectTab} onAddEmployee={addEmployee} onHelp={() => setHelpOpen(true)} />}
            {tab === 'applications' && <ApplicationInbox key={`${applicationTarget || 'all'}:${applicationKind}:${queueRevision}`} initialOpenedId={focusedApplication} initialKind={applicationKind} implementationId={applicationTarget} onClearImplementation={() => setApplicationTarget('')} applications={applications} processing={processingApplications} onReview={onReviewApplication} implementations={implementations} initiatives={publishedInitiatives} allProjects={overseesProjects} ownOnly={!canReviewAll} />}
            {tab === 'base' && canReviewAll && <InitiativeCoverManager initiatives={publishedInitiatives} onRefresh={onRefreshDashboard} />}
            {tab === 'base' && <BaseRegistry initiatives={publishedInitiatives} members={baseMembers} onCopy={handleCopy} />}
            {tab === 'users' && canReviewAll && <AccessRegistry canEdit={isAdmin} users={accessUsers} onCreate={addEmployee} onReset={onResetPassword} onRefresh={onRefreshDashboard} onCopy={handleCopy} />}
            {tab === 'homepage' && isAdmin && <HomepageEditor initiatives={publishedInitiatives} selections={featuredInitiatives} onSave={onSaveFeatured} loadError={publicLoadError} loading={publicLoading} onRetry={onRetryPublicLoad} />}
            {tab === 'implementations' && <ImplementationBoard key={`${implementationFilter}:${queueRevision}`} initialFilter={implementationFilter} onOpenResponses={id => { setApplicationTarget(id); selectTab('applications'); }} applications={applications} user={currentUser} initiatives={publishedInitiatives} implementations={implementations} photos={implementationPhotos} participants={implementationParticipants} notifications={[]} onRefresh={onRefreshDashboard} />}
          </section>)}</div>
        </div>
      </div>

      </div></div>

      {helpOpen && <CabinetGuide sections={sections} onClose={() => setHelpOpen(false)} onNavigate={selectTab} />}

      {/* Modal: Create Access (Admin only) */}
      {isAdmin && isCreateUserModalOpen && (
        <ModalDialog className="cabinet-dialog" labelledBy="create-access-title" onClose={() => setIsCreateUserModalOpen(false)} busy={isCreatingUser}>
          <div className="cabinet-access-form relative w-full max-w-[520px] bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] p-6 sm:p-8 shadow-2xl modal-animate z-10">
            <button
              type="button"
              onClick={() => setIsCreateUserModalOpen(false)}
              disabled={isCreatingUser}
              aria-label="Закрыть"
              className="absolute top-5 right-5 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B7280] hover:text-[#0F1115] hover:bg-[#F7F8FA] cursor-pointer"
            >
              <CrossIcon size={18} strokeWidth={2} />
            </button>

            <h3 id="create-access-title" className="text-[20px] font-bold text-[#0F1115] mb-1">
              Добавить сотрудника
            </h3>
            <p className="text-[13px] text-[#6B7280] mb-5">
              Укажите, кому нужен кабинет и что этот человек будет делать.
            </p>

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
              <fieldset disabled={isCreatingUser} className="space-y-3.5"><legend className="sr-only">Новая учётная запись</legend>
              <div>
                <label htmlFor="access-name" className="block text-[13px] font-medium text-[#0F1115] mb-1">
                  ФИО пользователя
                </label>
                <input
                  type="text"
                  required
                  placeholder="Сергей Васильев"
                  id="access-name"
                  maxLength={120}
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="pervik-input"
                />
              </div>

              <div>
                <label htmlFor="access-role" className="block text-[13px] font-medium text-[#0F1115] mb-1">
                  Роль
                </label>
                <select
                  id="access-role"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="pervik-input pervik-select cursor-pointer"
                >
                  <option value="Председатель">Председатель отделения</option>
                  <option value="Куратор района">Куратор района</option>
                </select>
              </div>

              <p className="journey-hint">{newUserRole === 'Куратор района' ? 'Рассматривает заявки, публикует идеи, проверяет заявки на баллы и добавляет события в календарь. Не управляет сотрудниками и главной сайта.' : 'Видит людей и идеи, предлагает проекты с датами, отправляет отчёты и заявки на баллы. Видит рейтинг и календарь. Не модерирует общие заявки.'}</p>
              <div>
                <label htmlFor="access-branch" className="block text-[13px] font-medium text-[#0F1115] mb-1">
                  Школа или организация
                </label>
                <input
                  type="text"
                  placeholder="Гимназия №99"
                  id="access-branch"
                  maxLength={160}
                  value={newUserBranch}
                  onChange={(e) => setNewUserBranch(e.target.value)}
                  className="pervik-input"
                />
              </div>

              <section className="generated-access" aria-label="Автоматически созданные данные доступа" aria-busy={isGeneratingAccess}>
                <div className="generated-access-heading"><KeyIcon size={17} /><strong>Данные создаются автоматически</strong></div>
                <p>Слова, цифры и русские символы. Логин и пароль можно скопировать; ручное изменение недоступно.</p>
                {isGeneratingAccess && <p role="status">Генерируем уникальный логин и пароль…</p>}
                {generationError && <><p className="inline-error" role="alert">{generationError}</p><button type="button" className="journey-secondary" onClick={() => setGenerationRevision(value => value + 1)}>Попробовать ещё раз</button></>}
                {generatedAccess && <>
                  <div className="generated-access-label"><label htmlFor="access-login">Логин</label><button type="button" onClick={() => void handleCopy(generatedAccess.login, 'Логин')}><CopyIcon size={13} /> Копировать</button></div>
                  <textarea id="access-login" readOnly rows={1} autoComplete="off" spellCheck={false} className="pervik-input generated-credential-value" value={generatedAccess.login} onFocus={event => event.target.select()} />
                  <div className="generated-access-label"><label htmlFor="access-password">Пароль</label><button type="button" onClick={() => void handleCopy(generatedAccess.password, 'Пароль')}><CopyIcon size={13} /> Копировать</button></div>
                  <textarea id="access-password" readOnly rows={1} autoComplete="off" spellCheck={false} className="pervik-input generated-credential-value" value={generatedAccess.password} onFocus={event => event.target.select()} />
                  <p>Эти логин и пароль заработают после нажатия «Добавить сотрудника». Сохраните их и передайте сотруднику лично. Позже можно будет создать новый пароль.</p>
                </>}
              </section>

              {createUserError && <div><p className="inline-error" role="alert">{createUserError}</p><button type="button" className="journey-secondary mt-2" disabled={isGeneratingAccess} onClick={() => setGenerationRevision(value => value + 1)}>Создать новый логин и пароль</button></div>}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCreatingUser || isGeneratingAccess || !generatedAccess}
                  className="w-full h-11 rounded-[10px] bg-[#E60023] hover:bg-[#CC001F] text-white font-semibold text-[14px] transition-all cursor-pointer shadow-sm"
                >
                  {isCreatingUser ? 'Создаём доступ…' : 'Добавить сотрудника'}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </ModalDialog>
      )}
    </main>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = props => isSchoolMember(props.currentUser) ? <SchoolMemberPortal {...props}/> : <StaffDashboardView {...props}/>;
