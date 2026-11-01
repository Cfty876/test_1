import { useLiveRefresh } from './utils/useLiveRefresh.ts';
import { subscribePlatformChanges } from './utils/liveSync.ts';
import { PlatformApiError } from './utils/platformApi.ts';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { lazy, useState, useEffect, useCallback, useRef } from 'react';
import { AsyncScreen } from './components/AsyncScreen.tsx';
import { Topbar } from './components/Topbar.tsx';
import { HomeView } from './components/HomeView.tsx';
import type { ApplicationFormData, HelpArea } from './components/ApplicationFormView.tsx';
import { readReceipt, rememberReceipt, type ApplicationReceipt } from './utils/applicationJourney.ts';
import type {
  ApplicationItem,
  BaseMember,
  AccessUser,
} from './components/DashboardView.tsx';
import type { PublicInitiative } from './utils/publicInitiatives.ts';
import type { FeaturedInitiative, FeaturedSelection } from './utils/homepage.ts';
import { Toast, type ToastMessage } from './components/Toast.tsx';
import {
  restoreSession,
  logoutSession,
  type UserSession,
} from './utils/auth.ts';
import { platformRequest, type DashboardSnapshot } from './utils/platformApi.ts';
import type { PublicImplementation } from './utils/implementations.ts';
import type { CreateAccessRequest } from './utils/accessCredentials.ts';
const loadDashboard = () => import('./components/DashboardView.tsx').then(module => ({ default: module.DashboardView }));
const DashboardView = lazy(loadDashboard);
const ApplicationFormView = lazy(() => import('./components/ApplicationFormView.tsx').then(module => ({ default: module.ApplicationFormView })));
const SuccessView = lazy(() => import('./components/SuccessView.tsx').then(module => ({ default: module.SuccessView })));
const ApplicationTrackingView = lazy(() => import('./components/ApplicationTrackingView.tsx').then(module => ({ default: module.ApplicationTrackingView })));
const InitiativeCatalog = lazy(() => import('./components/InitiativeCatalog.tsx').then(module => ({ default: module.InitiativeCatalog })));
const InitiativePage = lazy(() => import('./components/InitiativePage.tsx').then(module => ({ default: module.InitiativePage })));
import { LoginModal } from './components/LoginModal.tsx';
import { FormFeedback } from './components/FormFeedback.tsx';
import { NotFoundView } from './components/NotFoundView.tsx';
import { isUnknownPlatformLocation } from './utils/routes.ts';
interface PublicHomeSnapshot { initiatives: PublicInitiative[]; featuredInitiatives: FeaturedInitiative[]; likedIds: string[] }

type View = 'home' | 'form' | 'success' | 'cabinet' | 'track' | 'initiatives' | 'initiative' | 'not-found';
function publicView(): View {
  if (isUnknownPlatformLocation(new URL(window.location.href))) return 'not-found';
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('view');
  if (requested === 'form' || requested === 'success' || requested === 'track' || requested === 'initiatives') return requested;
  if (requested === 'initiative' || params.has('initiative')) return 'initiative';
  if ((!requested || requested === 'home') && window.location.hash === '#initiatives') return 'initiatives';
  return 'home';
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>(() => {
    return publicView();
  });
  const [initiativeId, setInitiativeId] = useState(() => new URLSearchParams(location.search).get('initiative') || '');
  const [submittedKind, setSubmittedKind] = useState<'initiative' | 'activist' | 'support'>('initiative');
  const [receipt, setReceipt] = useState<ApplicationReceipt | null>(readReceipt);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [initialHelpArea, setInitialHelpArea] = useState<HelpArea>('Мероприятия');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [baseMembers, setBaseMembers] = useState<BaseMember[]>([]);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [publishedInitiatives, setPublishedInitiatives] = useState<PublicInitiative[]>([]);
  const [featuredInitiatives, setFeaturedInitiatives] = useState<FeaturedInitiative[]>([]);
  const [featuredSelections, setFeaturedSelections] = useState<FeaturedSelection[]>([]);
  const [publicLoadError, setPublicLoadError] = useState(false);
  const [featuredLoadError, setFeaturedLoadError] = useState(false);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicRevision, setPublicRevision] = useState(0);
  const [workflow, setWorkflow] = useState<Pick<DashboardSnapshot, 'implementations' | 'implementationPhotos' | 'implementationParticipants' | 'notifications'>>({ implementations: [], implementationPhotos: [], implementationParticipants: [], notifications: [] });
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [likeReady, setLikeReady] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);
  const likeLock = useRef(false);
  const [dashboardStatus, setDashboardStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dashboardRevision, setDashboardRevision] = useState(0);
  const [processingApplications, setProcessingApplications] = useState<string[]>([]);
  const applicationLocks = useRef(new Set<string>());
  const pendingHomeSection = useRef<string | null>(null);
  const navigate = useCallback((view: View, supportId?: string, implementationId?: string, kind: 'initiative' | 'activist' = 'initiative') => {
    const url = new URL(window.location.href);
    url.pathname = '/';
    if (view === 'home') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    if (view === 'initiative' && supportId) url.searchParams.set('initiative', supportId);
    else url.searchParams.delete('initiative');
    for (const key of ['q', 'area', 'team', 'sort']) url.searchParams.delete(key);
    url.hash = '';
    if (view !== 'cabinet') url.searchParams.delete('section');
    if (view === 'form') url.searchParams.set('kind', supportId ? 'activist' : kind);
    else url.searchParams.delete('kind');
    if (view === 'form' && supportId) url.searchParams.set('support', supportId);
    else url.searchParams.delete('support');
    if (view === 'form' && implementationId) url.searchParams.set('event', implementationId);
    else url.searchParams.delete('event');
    if (window.location.href !== url.href || window.history.state?.platformView !== view) window.history.pushState({ platformView: view, ...(view === 'initiative' ? { initiativeReturnTo: window.location.href } : {}) }, '', url);
    setInitiativeId(view === 'initiative' ? supportId || '' : '');
    setCurrentView(view);
  }, []);

  useEffect(() => {
    const handlePop = () => {
      const target = new URLSearchParams(window.location.search).get('view');
      setCurrentView(target === 'cabinet' && currentUser && !isUnknownPlatformLocation(new URL(window.location.href)) ? 'cabinet' : publicView());
      setInitiativeId(new URLSearchParams(location.search).get('initiative') || '');
      setIsLoginOpen(false);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [currentUser]);

  useEffect(() => {
    if (window.location.hash !== '#initiatives' || publicView() !== 'initiatives') return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'initiatives'); url.hash = '';
    window.history.replaceState({ platformView: 'initiatives' }, '', url);
  }, [currentView]);

  const activeLoginRef = useRef(currentUser?.login);
  const activeViewRef = useRef(currentView);
  activeLoginRef.current = currentUser?.login;
  activeViewRef.current = currentView;
  const authGenerationRef = useRef(0);
  const publicReadyRef = useRef(false);
  const publicFlightRef = useRef<{ again: boolean; promise: Promise<void> } | null>(null);
  const dashboardFlightRef = useRef<{ login: string; again: boolean; promise: Promise<void> } | null>(null);
  const needsPublicData = currentView === 'home' || currentView === 'initiatives' || currentView === 'initiative' || currentView === 'form' || currentView === 'cabinet';
  const refreshPublic = useCallback((): Promise<void> => {
    if (publicFlightRef.current) { publicFlightRef.current.again = true; return publicFlightRef.current.promise; }
    const flight = { again: false, promise: Promise.resolve() };
    flight.promise = (async () => {
      do {
        flight.again = false;
        if (!publicReadyRef.current) setPublicLoading(true);
        const snapshot = await platformRequest<PublicHomeSnapshot>('/public-home');
        setPublishedInitiatives(snapshot.initiatives); setFeaturedInitiatives(snapshot.featuredInitiatives); setLikedIds(snapshot.likedIds);
        setLikeReady(true); setPublicLoadError(false); setFeaturedLoadError(false); publicReadyRef.current = true;
      } while (flight.again);
    })().catch(error => { setLikeReady(false); setPublicLoadError(true); setFeaturedLoadError(true); throw error; })
      .finally(() => { setPublicLoading(false); if (publicFlightRef.current === flight) publicFlightRef.current = null; });
    publicFlightRef.current = flight;
    return flight.promise;
  }, []);
  useEffect(() => { if (needsPublicData) void refreshPublic().catch(() => {}); }, [needsPublicData, publicRevision, refreshPublic]);
  useLiveRefresh(refreshPublic, needsPublicData);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [currentView]);
  useEffect(() => {
    if (currentView !== 'home' || !pendingHomeSection.current) return;
    const id = pendingHomeSection.current;
    pendingHomeSection.current = null;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      const url = new URL(window.location.href); url.hash = id;
      window.history.replaceState(window.history.state, '', url);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentView]);


  useEffect(() => {
    let active = true;
    const generation = authGenerationRef.current;
    void restoreSession().then((session) => {
      if (!active || !session || authGenerationRef.current !== generation || activeLoginRef.current) return;
      setCurrentUser(session);
      const requested = new URLSearchParams(window.location.search).get('view');
      if (requested === 'cabinet' && !isUnknownPlatformLocation(new URL(window.location.href))) {
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

  const refreshDashboard = useCallback((): Promise<void> => {
    const login = activeLoginRef.current;
    if (!login) return Promise.resolve();
    const existing = dashboardFlightRef.current;
    if (existing?.login === login) { existing.again = true; return existing.promise; }
    const flight = { login, again: false, promise: Promise.resolve() };
    flight.promise = (async () => {
      do {
        flight.again = false;
        const snapshot = await platformRequest<DashboardSnapshot>('/bootstrap');
        if (activeLoginRef.current !== login) return;
        setApplications(snapshot.applications); setBaseMembers(snapshot.baseMembers); setAccessUsers(previous => snapshot.accessUsers.map(account => { const local = previous.find(item => item.id === account.id); return local?.password && (local.credentialVersion || 1) === (account.credentialVersion || 1) ? { ...account, password: local.password } : account; }));
        setFeaturedSelections(snapshot.featuredInitiatives);
        setWorkflow({ implementations: snapshot.implementations || [], implementationPhotos: snapshot.implementationPhotos || [], implementationParticipants: snapshot.implementationParticipants || [], notifications: snapshot.notifications || [] });
        setCurrentUser(previous => JSON.stringify(previous) === JSON.stringify(snapshot.currentUser) ? previous : snapshot.currentUser);
        setDashboardStatus('ready');
      } while (flight.again && activeLoginRef.current === login);
    })().catch(error => {
      if (activeLoginRef.current === login && error instanceof PlatformApiError && (error.status === 401 || error.status === 403)) {
        activeLoginRef.current = undefined; setCurrentUser(null); setApplications([]); setBaseMembers([]); setAccessUsers([]);
        setWorkflow({ implementations: [], implementationPhotos: [], implementationParticipants: [], notifications: [] });
        navigate('home'); setIsLoginOpen(true);
      }
      throw error;
    }).finally(() => { if (dashboardFlightRef.current === flight) dashboardFlightRef.current = null; });
    dashboardFlightRef.current = flight;
    return flight.promise;
  }, [navigate]);
  const refreshAll = useCallback(async () => { await Promise.all([refreshDashboard(), refreshPublic()]); }, [refreshDashboard, refreshPublic]);
  const syncIssue = useLiveRefresh(refreshDashboard, currentView === 'cabinet' && Boolean(currentUser));
  useEffect(() => subscribePlatformChanges(kind => {
    if (kind !== 'auth') return;
    const generation = ++authGenerationRef.current;
    activeLoginRef.current = undefined; setCurrentUser(null); setApplications([]); setBaseMembers([]); setAccessUsers([]);
    setWorkflow({ implementations: [], implementationPhotos: [], implementationParticipants: [], notifications: [] });
    setDashboardStatus('loading');
    void restoreSession().then(session => {
      if (generation !== authGenerationRef.current) return;
      setCurrentUser(session);
      if (!session && activeViewRef.current === 'cabinet') { navigate('home'); setIsLoginOpen(true); }
    });
  }), [navigate]);
  useEffect(() => {
    if (!currentUser) {
      setApplications([]);
      setBaseMembers([]);
      setAccessUsers([]);
      setFeaturedSelections([]);
      setWorkflow({ implementations: [], implementationPhotos: [], implementationParticipants: [], notifications: [] });
      return;
    }
    if (currentView !== 'cabinet') return;
    let active = true;
    void loadDashboard().catch(() => {});
    setDashboardStatus('loading');
    void refreshDashboard().catch((error: unknown) => {
      if (active) { setDashboardStatus('error'); showToast(error instanceof Error ? error.message : 'Не удалось загрузить данные кабинета'); }
    });
    return () => { active = false; };
  }, [currentUser?.login, currentView === 'cabinet', dashboardRevision, showToast, refreshDashboard]);

  // Handlers for public flows
  const handleGoHome = () => {
    navigate('home');
  };

  const handleGoToForm = (area?: HelpArea, initiative?: PublicInitiative, implementation?: PublicImplementation, kind?: 'initiative' | 'activist') => {
    setInitialHelpArea(area ?? 'Мероприятия');
    navigate('form', initiative?.id, implementation?.id, kind || (area ? 'activist' : 'initiative'));
  };

  const handleFormSubmitSuccess = async (formData: ApplicationFormData) => {
    const result = await platformRequest<{ id: string; trackingAvailable?: boolean }>('/applications', formData);
    const confirmation = formData.trackingCode && result.trackingAvailable ? { id: result.id, code: formData.trackingCode } : null;
    setSubmittedKind(formData.isInitiative ? 'initiative' : formData.supportInitiativeId ? 'support' : 'activist');
    setReceipt(confirmation);
    if (confirmation) rememberReceipt(confirmation);
    navigate('success');
  };

  // Handlers for authentication
  const handleOpenLogin = () => {
    if (currentUser) navigate('cabinet');
    else { setIsLoginOpen(true); }
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
  const handleReviewApplication = async (id: string, status: 'accepted' | 'rejected' | 'needs_changes', reason: string, version?: number, coverId?: string) => {
    if (applicationLocks.current.has(id)) throw new Error('Решение уже сохраняется.');
    applicationLocks.current.add(id);
    setProcessingApplications([...applicationLocks.current]);
    try {
      const result = await platformRequest<{ application: ApplicationItem; member: BaseMember | null }>('/applications/status', { id, status, reason, version, coverId });
      setApplications((previous) => previous.map((item) => item.id === id ? result.application : item));
      if (result.member) setBaseMembers((previous) => [result.member as BaseMember, ...previous.filter((item) => item.id !== result.member?.id)]);
      if (status === 'accepted' && result.application.isInitiative) setPublicRevision((value) => value + 1);
      if (status === 'accepted' && result.application.supportImplementationId && result.application.participationRole) {
        const participant = { id: result.application.id, implementationId: result.application.supportImplementationId, name: result.application.name, phone: result.application.phone, email: result.application.email, role: result.application.participationRole };
        setWorkflow(previous => ({ ...previous, implementationParticipants: [...previous.implementationParticipants.filter(item => item.id !== participant.id), participant] }));
        setPublicRevision(value => value + 1);
      }
      showToast(status === 'needs_changes' ? 'Заявка возвращена на доработку. Автор увидит комментарий по личному коду.' : status === 'rejected' ? 'Решение и объяснение сохранены.' : 'Заявка одобрена.');
    } finally {
      applicationLocks.current.delete(id);
      setProcessingApplications([...applicationLocks.current]);
    }
  };

  const handleResetPassword = async (user: AccessUser) => {
    try {
      const result = await platformRequest<{ user: AccessUser }>('/users/reset-password', { id: user.id, credentialVersion: user.credentialVersion || 1 });
      setAccessUsers((prev) => prev.map((item) => item.id === user.id && (item.credentialVersion || 1) <= (result.user.credentialVersion || 1) ? result.user : item));
      showToast('Новый пароль создан и показан в настройках доступа пользователя');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось сбросить пароль');
      throw error;
    }
  };

  const handleCreateAccess = async (user: CreateAccessRequest) => {
    const result = await platformRequest<{ user: AccessUser }>('/users', user);
    setAccessUsers((prev) => [result.user, ...prev]);
    showToast('Учётная запись создана. Пароль доступен в «Доступ и настройки».');
  };

  const handleSaveFeatured = async (selections: FeaturedSelection[], expected: FeaturedSelection[]) => {
    const result = await platformRequest<{ featuredInitiatives: FeaturedSelection[] }>('/homepage', { featuredInitiatives: selections, expectedFeaturedInitiatives: expected });
    setFeaturedSelections(result.featuredInitiatives);
    setFeaturedInitiatives(result.featuredInitiatives.flatMap((selection) => {
      const initiative = publishedInitiatives.find((item) => item.id === selection.initiativeId);
      return initiative ? [{ ...initiative, helpNeeded: selection.helpNeeded }] : [];
    }));
    showToast('Подборка на главной странице обновлена');
  };

  const handleLike = async (id: string) => {
    if (likeLock.current) return;
    if (!likeReady) { showToast('Не удалось загрузить ваши лайки. Обновите каталог и попробуйте снова.'); setPublicRevision(value => value + 1); return; }
    likeLock.current = true; setLikingId(id);
    try {
      const result = await platformRequest<{ liked: boolean; count: number }>('/initiative-like', { initiativeId: id, liked: !likedIds.includes(id) });
      setLikedIds(previous => result.liked ? [...previous.filter(item => item !== id), id] : previous.filter(item => item !== id));
      setPublishedInitiatives(previous => previous.map(item => item.id === id ? { ...item, likeCount: result.count } : item));
      setFeaturedInitiatives(previous => previous.map(item => item.id === id ? { ...item, likeCount: result.count } : item));
    } catch (error) { showToast(error instanceof Error ? error.message : 'Не удалось сохранить лайк.'); }
    finally { likeLock.current = false; setLikingId(null); }
  };

  const requestedSupportId = currentView === 'form' ? new URLSearchParams(window.location.search).get('support') : null;
  const resolvedSupport = requestedSupportId ? publishedInitiatives.find((item) => item.id === requestedSupportId) || null : null;
  const requestedEventId = currentView === 'form' ? new URLSearchParams(window.location.search).get('event') : null;
  const resolvedImplementation = resolvedSupport?.implementations?.find(item => item.id === requestedEventId && item.status === 'active' && (item.activistSlots > item.activistsAccepted || item.volunteerSlots > item.volunteersAccepted)) || null;
  const unavailableSupport = (requestedSupportId && !resolvedSupport) || (requestedEventId && !resolvedImplementation);

  useEffect(() => {
    const title = currentView === 'initiative' ? publishedInitiatives.find(item => item.id === initiativeId)?.title || 'Инициатива'
      : currentView === 'initiatives' ? 'Все инициативы' : currentView === 'cabinet' ? 'Личный кабинет'
      : currentView === 'form' ? (new URLSearchParams(location.search).get('kind') === 'activist' ? 'Анкета активиста' : 'Предложить инициативу') : currentView === 'track' ? 'Моя заявка' : '';
    document.title = title ? `${title} — Первик · Совет Екатеринбурга` : 'Движение Первых — Совет Екатеринбурга';
  }, [currentView, initiativeId, publishedInitiatives]);
  const backFromForm = () => resolvedSupport ? navigate('initiative', resolvedSupport.id) : handleGoHome();
  const mobileNavigation = currentView !== 'form';
  const openIdeas = () => navigate('initiatives');
  const openInitiative = (initiative: PublicInitiative) => navigate('initiative', initiative.id);
  const backToIdeas = () => {
    const returnTo = window.history.state?.initiativeReturnTo;
    if (typeof returnTo === 'string') {
      const url = new URL(returnTo, location.origin);
      if (url.origin === location.origin && url.searchParams.get('view') === 'initiatives') {
        window.history.pushState({ platformView: 'initiatives' }, '', url);
        setInitiativeId(''); setCurrentView('initiatives'); return;
      }
    }
    openIdeas();
  };
  return (
    <div className={`platform-shell min-h-screen flex flex-col text-[#0F1115] selection:bg-[#E60023] selection:text-white ${mobileNavigation ? 'has-mobile-navigation' : ''}`}>
      <FormFeedback />
      {/* Topbar: dynamically styled for each view */}
      <Topbar
        currentView={currentView}
        currentUser={currentUser}
        onOpenLogin={handleOpenLogin}
        onGoHome={handleGoHome}
        onBack={currentView === 'form' ? backFromForm : handleGoHome}
        onLogout={handleLogout}
        onIdeas={openIdeas}
        onHomeSection={id => { pendingHomeSection.current = id; navigate('home'); }}
        onStart={handleGoToForm}
        onTrack={() => { setReceipt(readReceipt()); navigate('track'); }}
      />

      <AsyncScreen key={currentView}>
      {currentView === 'not-found' && <NotFoundView />}
      {/* Screen 1: Home */}
      {currentView === 'home' && (
        <HomeView onOpenInitiative={openInitiative} onCatalog={openIdeas} likedIds={likedIds} likingId={likingId} onLike={handleLike} onTrack={() => { setReceipt(readReceipt()); navigate('track'); }} onActivist={() => handleGoToForm(undefined, undefined, undefined, 'activist')} onGoToForm={handleGoToForm} onOpenLogin={handleOpenLogin} featuredInitiatives={featuredInitiatives} featuredLoadError={featuredLoadError} />
      )}

      {currentView === 'initiatives' && <InitiativeCatalog initiatives={publishedInitiatives} loading={publicLoading} loadError={publicLoadError} onRetry={() => setPublicRevision(value => value + 1)} likedIds={likedIds} likingId={likingId} onLike={handleLike} onOpen={openInitiative} onStart={() => handleGoToForm()} onHome={handleGoHome} />}
      {currentView === 'initiative' && <InitiativePage key={initiativeId} initiative={publishedInitiatives.find(item => item.id === initiativeId) || null} loading={publicLoading} loadError={publicLoadError} onRetry={() => setPublicRevision(value => value + 1)} liked={likedIds.includes(initiativeId)} liking={Boolean(likingId)} onLike={handleLike} onBack={backToIdeas} onJoin={(initiative, implementation) => handleGoToForm(initiative.area, initiative, implementation)} />}

      {/* Screen 2: Application Form */}
      {currentView === 'form' && unavailableSupport && <main className="cabinet-load-state" aria-live="polite"><h1>{publicLoading ? 'Загружаем инициативу…' : 'Не удалось открыть инициативу'}</h1>{!publicLoading && <><p>Открой каталог и выбери доступную инициативу.</p><button type="button" className="home-primary" onClick={handleGoHome}>На главную</button></>}</main>}
      {currentView === 'form' && !unavailableSupport && (
        <ApplicationFormView
          key={`${new URLSearchParams(location.search).get('kind')}:${resolvedSupport?.id || 'general'}:${resolvedImplementation?.id || 'general'}`}
          mode={new URLSearchParams(location.search).get('kind') === 'activist' ? 'activist' : 'initiative'}
          onGoHome={backFromForm}
          backLabel={resolvedSupport ? 'К инициативе' : 'На главную'}
          onSubmitSuccess={handleFormSubmitSuccess}
          initialHelpArea={resolvedSupport?.area || initialHelpArea}
          initialInitiative={resolvedSupport}
          initialImplementation={resolvedImplementation}
        />
      )}

      {/* Screen 3: Success Screen */}
      {currentView === 'success' && (
        <SuccessView kind={submittedKind} receipt={receipt} onTrack={() => navigate('track')} onGoHome={handleGoHome} />
      )}

      {currentView === 'track' && <ApplicationTrackingView receipt={receipt} onGoHome={handleGoHome} onClearReceipt={() => setReceipt(null)} />}

      {/* Screen 4: Personal Cabinet (Dynamic by role: admin, chairman) */}
      {currentView === 'cabinet' && currentUser && dashboardStatus !== 'ready' && <main className="cabinet-load-state" aria-live="polite"><h1>{dashboardStatus === 'loading' ? 'Загружаем кабинет…' : 'Не удалось загрузить кабинет'}</h1>{dashboardStatus === 'error' && <><p>Проверьте соединение и попробуйте ещё раз.</p><button type="button" className="home-primary" onClick={() => setDashboardRevision((value) => value + 1)}>Повторить загрузку</button></>}</main>}
      {currentView === 'cabinet' && currentUser && dashboardStatus === 'ready' && (
        <DashboardView
          key={currentUser.login}
          currentUser={currentUser}
          implementations={workflow.implementations}
          implementationPhotos={workflow.implementationPhotos}
          implementationParticipants={workflow.implementationParticipants}
          notifications={workflow.notifications}
          syncIssue={syncIssue}
          onRefreshDashboard={refreshAll}
          applications={applications}
          baseMembers={baseMembers}
          accessUsers={accessUsers}
          publishedInitiatives={publishedInitiatives}
          featuredInitiatives={featuredSelections}
          publicLoadError={publicLoadError}
          onRetryPublicLoad={() => setPublicRevision((value) => value + 1)}
          onSaveFeatured={handleSaveFeatured}
          processingApplications={processingApplications}
          publicLoading={publicLoading}
          onReviewApplication={handleReviewApplication}
          onResetPassword={handleResetPassword}
          onCreateAccess={handleCreateAccess}
          showToast={showToast}
        />
      )}

      </AsyncScreen>

      {mobileNavigation && currentView !== 'cabinet' && <MobileBottomNav view={currentView} signedIn={Boolean(currentUser)} onHome={() => { handleGoHome(); window.dispatchEvent(new Event('pervik:home-top')); window.scrollTo({ top: 0, behavior: 'instant' }); }} onIdeas={openIdeas} onStart={() => handleGoToForm()} onTrack={() => { setReceipt(readReceipt()); navigate('track'); }} onCabinet={handleOpenLogin} />}

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
