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
  getInitials,
  restoreSession,
  logoutSession,
  type UserSession,
  type ForwardedInitiative,
} from './utils/auth.ts';
import {
  INITIAL_APPLICATIONS,
  INITIAL_BASE_MEMBERS,
  INITIAL_ACCESS_USERS,
  INITIAL_FORWARDED_INITIATIVES,
} from './utils/initialData.ts';

const AVATAR_COLORS = [
  '#FEE2E2', // soft red
  '#E0E7FF', // soft indigo
  '#FEF3C7', // soft amber
  '#DCFCE7', // soft emerald
  '#F3E8FF', // soft purple
  '#CFFAFE', // soft cyan
];

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'form' | 'success' | 'cabinet'>('home');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [initialHelpArea, setInitialHelpArea] = useState<HelpArea>('Мероприятия');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Start with verified, real records only; no demonstration personal data.
  const [applications, setApplications] = useState<ApplicationItem[]>(INITIAL_APPLICATIONS);
  const [baseMembers, setBaseMembers] = useState<BaseMember[]>(INITIAL_BASE_MEMBERS);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>(INITIAL_ACCESS_USERS);
  const [forwardedInitiatives, setForwardedInitiatives] = useState<ForwardedInitiative[]>(INITIAL_FORWARDED_INITIATIVES);
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

  // Handlers for public flows
  const handleGoHome = () => {
    setCurrentView('home');
  };

  const handleGoToForm = (area?: HelpArea) => {
    setInitialHelpArea(area ?? 'Мероприятия');
    setCurrentView('form');
  };

  const handleFormSubmitSuccess = (formData: ApplicationFormData) => {
    const isInit = formData.isInitiative;
    const resolvedCategory = formData.customCategoryText
      ? `Свой: ${formData.customCategoryText}`
      : formData.category;

    const newApp: ApplicationItem = {
      id: `app-${Date.now()}`,
      name: formData.name,
      category: resolvedCategory,
      description: formData.description,
      phone: formData.phone,
      email: formData.email,
      initials: getInitials(formData.name),
      avatarBg: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      actionText: isInit ? 'Добавить' : formData.category.includes('партнёр') ? 'В партнёры' : 'В работу',
      status: 'pending',
      isInitiative: isInit,
      area: formData.helpArea || 'Мероприятия',
    };

    setApplications((prev) => [newApp, ...prev]);
    setCurrentView('success');
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
  const handleAcceptApplication = (id: string) => {
    const target = applications.find((a) => a.id === id);
    if (!target) return;

    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'accepted' } : a))
    );

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
    }

    // Determine category classification
    let baseCategory: 'Мероприятия' | 'Медиа' | 'IT' | 'Волонтёрство' | 'Партнёры' = 'Мероприятия';
    if (target.area === 'Медиа' || target.category.includes('Медиа')) baseCategory = 'Медиа';
    else if (target.area === 'IT' || target.category.includes('IT')) baseCategory = 'IT';
    else if (target.area === 'Волонтёрство' || target.category.includes('Волонтёр')) baseCategory = 'Волонтёрство';
    else if (target.category.includes('партнёр')) baseCategory = 'Партнёры';

    // Add to base members
    const newMember: BaseMember = {
      id: `base-${Date.now()}`,
      name: target.name,
      roleInfo: `${target.category} · Екатеринбург`,
      category: baseCategory,
      isInitiative: Boolean(target.isInitiative),
      phone: target.phone,
      email: target.email,
      initials: target.initials,
      avatarBg: target.avatarBg,
      description: target.description,
      branch: 'Новое поступление',
      author: target.name,
      dateAdded: 'Сегодня',
    };
    setBaseMembers((prev) => [newMember, ...prev]);

    if (!target.isInitiative) showToast('Добавлено в базу');
  };

  const handleRejectApplication = (id: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a))
    );
    showToast('Отклонено');
  };

  const handleResetPassword = (_user: AccessUser) => {
    showToast('Сброс пароля появится после подключения серверной авторизации.');
  };

  const handleCreateAccess = (user: { name: string; roleInfo: string; login: string; password: string; branch: string }) => {
    const newAccessUser: AccessUser = {
      id: `usr-${Date.now()}`,
      name: user.name,
      roleInfo: user.roleInfo,
      login: user.login,
      password: user.password,
      branch: user.branch,
      initials: getInitials(user.name),
      avatarBg: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    };
    setAccessUsers((prev) => [newAccessUser, ...prev]);
    showToast('Доступ добавлен в список. Для входа этому пользователю нужна настройка серверной авторизации.');
  };

  const handleSendInitiativeToPartner = (payload: {
    partnerName: string;
    senderNote: string;
    initiative: ForwardedInitiative;
  }) => {
    setForwardedInitiatives((prev) => [payload.initiative, ...prev]);
    showToast(`Инициатива отправлена: ${payload.partnerName}`);
  };

  const handleSupportInitiative = (id: string) => {
    setForwardedInitiatives((prev) =>
      prev.map((fwd) => (fwd.id === id ? { ...fwd, status: 'supported' } : fwd))
    );
    showToast('Инициатива взята в партнёрскую поддержку');
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
