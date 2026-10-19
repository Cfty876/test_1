import { useState, useEffect, useCallback, useRef } from 'react';
import { Topbar } from './components/Topbar.tsx';
import { HomeView } from './components/HomeView.tsx';
import { ApplicationFormView, type ApplicationFormData, type HelpArea } from './components/ApplicationFormView.tsx';
import { SuccessView } from './components/SuccessView.tsx';
import {
  DashboardView,
  type ApplicationItem,
  type BaseMember,
  type AccessUser,
} from './components/DashboardView.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { fetchPublicInitiatives, type PublicInitiative } from './utils/publicInitiatives.ts';
import type { FeaturedInitiative, FeaturedSelection } from './utils/homepage.ts';
import { Toast, type ToastMessage } from './components/Toast.tsx';
import {
  restoreSession,
  logoutSession,
  type UserSession,
  type ForwardedInitiative,
} from './utils/auth.ts';
import { platformRequest, type DashboardSnapshot } from './utils/platformApi.ts';
type View = 'home' | 'form' | 'success' | 'cabinet';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [initialHelpArea, setInitialHelpArea] = useState<HelpArea>('Мероприятия');
  const [supportInitiative, setSupportInitiative] = useState<PublicInitiative | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [baseMembers, setBaseMembers] = useState<BaseMember[]>([]);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [forwardedInitiatives, setForwardedInitiatives] = useState<ForwardedInitiative[]>([]);
  const [publishedInitiatives, setPublishedInitiatives] = useState<PublicInitiative[]>([]);
  const [featuredInitiatives, setFeaturedInitiatives] = useState<FeaturedInitiative[]>([]);
  const [featuredSelections, setFeaturedSelections] = useState<FeaturedSelection[]>([]);
  const [publicLoadError, setPublicLoadError] = useState(false);
  const [featuredLoadError, setFeaturedLoadError] = useState(false);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicRevision, setPublicRevision] = useState(0);
  const [dashboardStatus, setDashboardStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dashboardRevision, setDashboardRevision] = useState(0);
  const [processingApplications, setProcessingApplications] = useState<string[]>([]);
  const applicationLocks = useRef(new Set<string>());
  const navigate = useCallback((view: View) => {
    const url = new URL(window.location.href);
    if (view === 'home') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    if (window.location.href !== url.href || window.history.state?.platformView !== view) window.history.pushState({ platformView: view }, '', url);
    setCurrentView(view);
  }, []);

  useEffect(() => {
    const handlePop = () => {
      const target = new URLSearchParams(window.location.search).get('view');
      setCurrentView(target === 'form' || target === 'success' ? target : target === 'cabinet' && currentUser ? 'cabinet' : 'home');
      setIsLoginOpen(false);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [currentUser]);

  useEffect(() => {
    let active = true;
    setPublicLoading(true);
    void Promise.allSettled([fetchPublicInitiatives(), platformRequest<{ featuredInitiatives: FeaturedInitiative[] }>('/homepage')]).then(([board, homepage]) => {
      if (!active) return;
      if (board.status === 'fulfilled') setPublishedInitiatives(board.value);
      if (homepage.status === 'fulfilled') setFeaturedInitiatives(homepage.value.featuredInitiatives);
      setPublicLoadError(board.status === 'rejected');
      setFeaturedLoadError(homepage.status === 'rejected');
    }).finally(() => { if (active) setPublicLoading(false); });
    return () => { active = false; };
  }, [currentView, publicRevision]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [currentView]);

  // Public page links do not grant privileged cabinet access.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam === 'form') {
        setCurrentView('form');
      } else if (viewParam === 'success') {
        setCurrentView('success');
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  useEffect(() => {
    let active = true;
    void restoreSession().then((session) => {
      if (!active || !session) return;
      setCurrentUser(session);
      const requested = new URLSearchParams(window.location.search).get('view');
      if (requested === 'cabinet' || (!requested && !window.history.state?.platformView)) {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'cabinet');
        window.history.replaceState({ platformView: 'cabinet' }, '', url);
        setCurrentView('cabinet');
      }
    });
    return () => { active = false; };
  }, []);

  const showToast = useCallback((text: string) => {
    setToast({ id: Date.now(), text });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!currentUser) {
      setApplications([]);
      setBaseMembers([]);
      setAccessUsers([]);
      setForwardedInitiatives([]);
      setFeaturedSelections([]);
      return;
    }
    let active = true;
    setDashboardStatus('loading');
    void platformRequest<DashboardSnapshot>('/bootstrap').then((snapshot) => {
      if (!active) return;
      setApplications(snapshot.applications);
      setBaseMembers(snapshot.baseMembers);
      setAccessUsers(snapshot.accessUsers);
      setForwardedInitiatives(snapshot.forwardedInitiatives);
      setFeaturedSelections(snapshot.featuredInitiatives);
      setDashboardStatus('ready');
    }).catch((error: unknown) => {
      if (active) {
        setDashboardStatus('error');
        showToast(error instanceof Error ? error.message : 'Не удалось загрузить данные кабинета');
      }
    });
    return () => { active = false; };
  }, [currentUser, dashboardRevision, showToast]);

  // Handlers for public flows
  const handleGoHome = () => {
    navigate('home');
  };

  const handleGoToForm = (area?: HelpArea, initiative?: PublicInitiative) => {
    setInitialHelpArea(area ?? 'Мероприятия');
    setSupportInitiative(initiative ?? null);
    navigate('form');
  };

  const handleFormSubmitSuccess = async (formData: ApplicationFormData) => {
    await platformRequest<ApplicationItem>('/applications', formData);
    navigate('success');
  };

  // Handlers for authentication
  const handleOpenLogin = () => {
    if (currentUser) navigate('cabinet');
    else setIsLoginOpen(true);
  };

  const handleCloseLogin = () => {
    setIsLoginOpen(false);
  };

  const handleLoginSuccess = (session: UserSession) => {
    setCurrentUser(session);
    navigate('cabinet');
  };

  const handleLogout = async () => {
    try {
      await logoutSession();
      setCurrentUser(null);
      navigate('home');
    } catch {
      showToast('Не удалось завершить сеанс. Проверьте соединение и попробуйте ещё раз.');
    }
  };

  // Handlers for cabinet actions
  const handleAcceptApplication = async (id: string) => {
    if (applicationLocks.current.has(id)) return;
    applicationLocks.current.add(id);
    setProcessingApplications([...applicationLocks.current]);
    try {
      const result = await platformRequest<{ application: ApplicationItem; member: BaseMember | null }>('/applications/status', { id, status: 'accepted' });
      const target = result.application;
      setApplications((prev) => prev.map((item) => item.id === id ? target : item));
      if (result.member) setBaseMembers((prev) => [result.member as BaseMember, ...prev.filter((item) => item.id !== result.member?.id)]);

      if (target.isInitiative) {
        setPublicRevision((value) => value + 1);
        showToast('Инициатива принята и опубликована на общей доске');
      } else {
        showToast('Заявка принята и добавлена в базу');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось принять заявку');
    } finally {
      applicationLocks.current.delete(id);
      setProcessingApplications([...applicationLocks.current]);
    }
  };

  const handleRejectApplication = async (id: string) => {
    if (applicationLocks.current.has(id)) return;
    applicationLocks.current.add(id);
    setProcessingApplications([...applicationLocks.current]);
    try {
      const result = await platformRequest<{ application: ApplicationItem }>('/applications/status', { id, status: 'rejected' });
      setApplications((prev) => prev.map((item) => item.id === id ? result.application : item));
      showToast('Заявка отклонена');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось отклонить заявку');
    } finally {
      applicationLocks.current.delete(id);
      setProcessingApplications([...applicationLocks.current]);
    }
  };

  const handleResetPassword = async (user: AccessUser) => {
    try {
      const result = await platformRequest<{ user: AccessUser }>('/users/reset-password', { id: user.id });
      setAccessUsers((prev) => prev.map((item) => item.id === user.id ? result.user : item));
      showToast('Новый пароль создан и показан в карточке пользователя');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось сбросить пароль');
    }
  };

  const handleCreateAccess = async (user: { name: string; roleInfo: string; login: string; password: string; branch: string }) => {
    const result = await platformRequest<{ user: AccessUser }>('/users', user);
    setAccessUsers((prev) => [result.user, ...prev]);
    showToast('Учётная запись создана. Пароль отображается в списке пользователей.');
  };

  const handleSaveFeatured = async (selections: FeaturedSelection[]) => {
    const result = await platformRequest<{ featuredInitiatives: FeaturedSelection[] }>('/homepage', { featuredInitiatives: selections });
    setFeaturedSelections(result.featuredInitiatives);
    setFeaturedInitiatives(result.featuredInitiatives.flatMap((selection) => {
      const initiative = publishedInitiatives.find((item) => item.id === selection.initiativeId);
      return initiative ? [{ ...initiative, helpNeeded: selection.helpNeeded }] : [];
    }));
    showToast('Подборка на главной странице обновлена');
  };

  const handleSendInitiativeToPartner = async (payload: {
    partnerName: string;
    senderNote: string;
    initiative: ForwardedInitiative;
  }) => {
    const initiative = await platformRequest<ForwardedInitiative>('/forwarded-initiatives', payload);
    setForwardedInitiatives((prev) => [initiative, ...prev]);
    showToast(`Инициатива отправлена: ${payload.partnerName}`);
  };

  const handleSupportInitiative = async (id: string) => {
    try {
      await platformRequest<{ ok: boolean }>('/partner-inbox/status', { id });
      setForwardedInitiatives((prev) => prev.map((item) => item.id === id ? { ...item, status: 'supported' } : item));
      showToast('Инициатива взята в партнёрскую поддержку');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Не удалось обновить инициативу'); }
  };

  return (
    <div className="platform-shell min-h-screen flex flex-col text-[#0F1115] selection:bg-[#E60023] selection:text-white">
      {/* Topbar: dynamically styled for each view */}
      <Topbar
        currentView={currentView}
        currentUser={currentUser}
        onOpenLogin={handleOpenLogin}
        onGoHome={handleGoHome}
        onLogout={handleLogout}
      />

      {/* Screen 1: Home */}
      {currentView === 'home' && (
        <HomeView onGoToForm={handleGoToForm} onOpenLogin={handleOpenLogin} initiatives={publishedInitiatives} featuredInitiatives={featuredInitiatives} loading={publicLoading} loadError={publicLoadError} featuredLoadError={featuredLoadError} onRetry={() => setPublicRevision((value) => value + 1)} />
      )}

      {/* Screen 2: Application Form */}
      {currentView === 'form' && (
        <ApplicationFormView
          onGoHome={handleGoHome}
          onSubmitSuccess={handleFormSubmitSuccess}
          initialHelpArea={initialHelpArea}
          initialInitiative={supportInitiative}
        />
      )}

      {/* Screen 3: Success Screen */}
      {currentView === 'success' && (
        <SuccessView onGoHome={handleGoHome} />
      )}

      {/* Screen 4: Personal Cabinet (Dynamic by role: admin, chairman, partner) */}
      {currentView === 'cabinet' && currentUser && dashboardStatus !== 'ready' && <main className="cabinet-load-state" aria-live="polite"><h1>{dashboardStatus === 'loading' ? 'Загружаем кабинет…' : 'Не удалось загрузить кабинет'}</h1>{dashboardStatus === 'error' && <><p>Проверьте соединение и попробуйте ещё раз.</p><button type="button" className="home-primary" onClick={() => setDashboardRevision((value) => value + 1)}>Повторить загрузку</button></>}</main>}
      {currentView === 'cabinet' && currentUser && dashboardStatus === 'ready' && (
        <DashboardView
          key={currentUser.login}
          currentUser={currentUser}
          applications={applications}
          baseMembers={baseMembers}
          accessUsers={accessUsers}
          forwardedInitiatives={forwardedInitiatives}
          publishedInitiatives={publishedInitiatives}
          featuredInitiatives={featuredSelections}
          publicLoadError={publicLoadError}
          onRetryPublicLoad={() => setPublicRevision((value) => value + 1)}
          onSaveFeatured={handleSaveFeatured}
          processingApplications={processingApplications}
          publicLoading={publicLoading}
          onAcceptApplication={handleAcceptApplication}
          onRejectApplication={handleRejectApplication}
          onResetPassword={handleResetPassword}
          onCreateAccess={handleCreateAccess}
          onSendInitiativeToPartner={handleSendInitiativeToPartner}
          onSupportInitiative={handleSupportInitiative}
          showToast={showToast}
        />
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={handleCloseLogin}
        onSuccess={handleLoginSuccess}
        showToast={showToast}
      />

      {/* Toast Notifications */}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
