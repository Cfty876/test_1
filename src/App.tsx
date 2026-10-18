import { useState, useEffect, useCallback } from 'react';
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
import { fetchPublicInitiatives, publishPublicInitiative, type PublicInitiative } from './utils/publicInitiatives.ts';
import { Toast, type ToastMessage } from './components/Toast.tsx';
import {
  restoreSession,
  logoutSession,
  type UserSession,
  type ForwardedInitiative,
} from './utils/auth.ts';
import { platformRequest, type DashboardSnapshot } from './utils/platformApi.ts';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'form' | 'success' | 'cabinet'>('home');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [initialHelpArea, setInitialHelpArea] = useState<HelpArea>('Мероприятия');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [baseMembers, setBaseMembers] = useState<BaseMember[]>([]);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [forwardedInitiatives, setForwardedInitiatives] = useState<ForwardedInitiative[]>([]);
  const [publishedInitiatives, setPublishedInitiatives] = useState<PublicInitiative[]>([]);

  useEffect(() => {
    let active = true;
    void fetchPublicInitiatives().then((items) => {
      if (active) setPublishedInitiatives(items);
    }).catch(() => {
      // The public page remains usable when the initiative API is temporarily unavailable.
    });
    return () => { active = false; };
  }, []);

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
      setCurrentView('cabinet');
    });
    return () => { active = false; };
  }, []);

  const showToast = useCallback((text: string) => {
    setToast({ id: Date.now(), text });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setApplications([]);
      setBaseMembers([]);
      setAccessUsers([]);
      setForwardedInitiatives([]);
      return;
    }
    let active = true;
    void platformRequest<DashboardSnapshot>('/bootstrap').then((snapshot) => {
      if (!active) return;
      setApplications(snapshot.applications);
      setBaseMembers(snapshot.baseMembers);
      setAccessUsers(snapshot.accessUsers);
      setForwardedInitiatives(snapshot.forwardedInitiatives);
    }).catch((error: unknown) => {
      if (active) showToast(error instanceof Error ? error.message : 'Не удалось загрузить данные кабинета');
    });
    return () => { active = false; };
  }, [currentUser, showToast]);

  // Handlers for public flows
  const handleGoHome = () => {
    setCurrentView('home');
  };

  const handleGoToForm = (area?: HelpArea) => {
    setInitialHelpArea(area ?? 'Мероприятия');
    setCurrentView('form');
  };

  const handleFormSubmitSuccess = async (formData: ApplicationFormData) => {
    try {
      await platformRequest<ApplicationItem>('/applications', formData);
      setCurrentView('success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось отправить заявку. Попробуйте ещё раз.');
    }
  };

  // Handlers for authentication
  const handleOpenLogin = () => {
    setIsLoginOpen(true);
  };

  const handleCloseLogin = () => {
    setIsLoginOpen(false);
  };

  const handleLoginSuccess = (session: UserSession) => {
    setCurrentUser(session);
    setCurrentView('cabinet');
  };

  const handleLogout = () => {
    void logoutSession();
    setCurrentUser(null);
    setCurrentView('home');
  };

  // Handlers for cabinet actions
  const handleAcceptApplication = async (id: string) => {
    try {
      const result = await platformRequest<{ application: ApplicationItem; member: BaseMember | null }>('/applications/status', { id, status: 'accepted' });
      const target = result.application;
      setApplications((prev) => prev.map((item) => item.id === id ? target : item));
      if (result.member) setBaseMembers((prev) => [result.member as BaseMember, ...prev.filter((item) => item.id !== result.member?.id)]);

      if (target.isInitiative) {
        const firstLine = target.description.split(/[.!?\n]/, 1)[0]?.trim() || 'Новая инициатива';
        const title = firstLine.length > 64 ? `${firstLine.slice(0, 61).trimEnd()}…` : firstLine;
        const area: HelpArea = target.area === 'Медиа' || target.area === 'IT' || target.area === 'Волонтёрство'
          ? target.area
          : 'Мероприятия';
        const initiative = { id: target.id, title, description: target.description, area, author: target.name, publishedAt: new Date().toISOString() };
        void publishPublicInitiative(initiative).then((saved) => {
          setPublishedInitiatives((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
          showToast('Инициатива опубликована на общей доске');
        }).catch((error: unknown) => {
          showToast(error instanceof Error ? `Не удалось опубликовать: ${error.message}` : 'Не удалось опубликовать инициативу');
        });
      } else {
        showToast('Заявка принята и добавлена в базу');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось принять заявку');
    }
  };

  const handleRejectApplication = async (id: string) => {
    try {
      const result = await platformRequest<{ application: ApplicationItem }>('/applications/status', { id, status: 'rejected' });
      setApplications((prev) => prev.map((item) => item.id === id ? result.application : item));
      showToast('Заявка отклонена');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось отклонить заявку');
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
    try {
      const result = await platformRequest<{ user: AccessUser }>('/users', user);
      setAccessUsers((prev) => [result.user, ...prev]);
      showToast('Учётная запись создана. Пароль отображается в списке пользователей.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось создать доступ');
    }
  };

  const handleSendInitiativeToPartner = (payload: {
    partnerName: string;
    senderNote: string;
    initiative: ForwardedInitiative;
  }) => {
    void platformRequest<ForwardedInitiative>('/forwarded-initiatives', payload).then((initiative) => {
      setForwardedInitiatives((prev) => [initiative, ...prev]);
      showToast(`Инициатива отправлена: ${payload.partnerName}`);
    }).catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Не удалось отправить инициативу'));
  };

  const handleSupportInitiative = (id: string) => {
    void platformRequest<{ ok: boolean }>('/partner-inbox/status', { id }).then(() => {
      setForwardedInitiatives((prev) => prev.map((item) => item.id === id ? { ...item, status: 'supported' } : item));
      showToast('Инициатива взята в партнёрскую поддержку');
    }).catch((error: unknown) => showToast(error instanceof Error ? error.message : 'Не удалось обновить инициативу'));
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
        <HomeView onGoToForm={handleGoToForm} onOpenLogin={handleOpenLogin} initiatives={publishedInitiatives} />
      )}

      {/* Screen 2: Application Form */}
      {currentView === 'form' && (
        <ApplicationFormView
          onGoHome={handleGoHome}
          onSubmitSuccess={handleFormSubmitSuccess}
          initialHelpArea={initialHelpArea}
        />
      )}

      {/* Screen 3: Success Screen */}
      {currentView === 'success' && (
        <SuccessView onGoHome={handleGoHome} />
      )}

      {/* Screen 4: Personal Cabinet (Dynamic by role: admin, chairman, partner) */}
      {currentView === 'cabinet' && currentUser && (
        <DashboardView
          currentUser={currentUser}
          applications={applications}
          baseMembers={baseMembers}
          accessUsers={accessUsers}
          forwardedInitiatives={forwardedInitiatives}
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
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
