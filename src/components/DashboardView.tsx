import React, { useState, useMemo } from 'react';
import {
  InboxIcon,
  DatabaseIcon,
  SparklesIcon,
  UserIcon,
  PlusIcon,
  KeyIcon,
  CrossIcon,
  PhoneIcon,
  MailIcon,
  CopyIcon,
  SearchIcon,
  SendIcon,
  LightbulbIcon,
  BuildingIcon,
  CheckIcon,
} from './Icons.tsx';
import type { UserSession, ForwardedInitiative } from '../utils/auth.ts';
import { SendToPartnerModal } from './SendToPartnerModal.tsx';

export interface ApplicationItem {
  id: string;
  name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  initials: string;
  avatarBg: string;
  actionText: 'Добавить' | 'В работу' | 'В партнёры';
  status: 'pending' | 'accepted' | 'rejected';
  isInitiative?: boolean;
  helpArea?: string;
  area?: string;
}

export interface BaseMember {
  id: string;
  name: string;
  roleInfo: string;
  category: 'Мероприятия' | 'Медиа' | 'IT' | 'Волонтёрство' | 'Партнёры';
  isInitiative: boolean;
  phone: string;
  email: string;
  initials: string;
  avatarBg: string;
  branch?: string;
  organization?: string;
  description?: string;
  author?: string;
  dateAdded?: string;
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
}

interface DashboardViewProps {
  currentUser: UserSession;
  applications: ApplicationItem[];
  baseMembers: BaseMember[];
  accessUsers: AccessUser[];
  forwardedInitiatives: ForwardedInitiative[];
  onAcceptApplication: (id: string) => void;
  onRejectApplication: (id: string) => void;
  onResetPassword: (user: AccessUser) => void;
  onCreateAccess: (user: { name: string; roleInfo: string; login: string; password: string; branch: string }) => void;
  onSendInitiativeToPartner: (payload: {
    partnerName: string;
    senderNote: string;
    initiative: ForwardedInitiative;
  }) => void;
  onSupportInitiative: (id: string) => void;
  showToast: (text: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  applications,
  baseMembers,
  accessUsers,
  forwardedInitiatives,
  onAcceptApplication,
  onRejectApplication,
  onResetPassword,
  onCreateAccess,
  onSendInitiativeToPartner,
  onSupportInitiative,
  showToast,
}) => {
  // Determine available tabs based on role
  // Admin: applications, base, users
  // Chairman: base only
  // Partner: initiatives only
  const isChairman = currentUser.role === 'chairman';
  const isPartner = currentUser.role === 'partner';
  const isAdmin = currentUser.role === 'admin';

  const [activeMainTab, setActiveMainTab] = useState<'applications' | 'base' | 'users' | 'partner_initiatives'>(
    isPartner ? 'partner_initiatives' : isChairman ? 'base' : 'applications'
  );

  // Sub-tab in Base: 'all_non_initiatives' vs 'only_initiatives'
  const [baseSection, setBaseSection] = useState<'non_initiatives' | 'initiatives'>('non_initiatives');
  const [baseCategoryFilter, setBaseCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Modal states
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [selectedInitiativeToSend, setSelectedInitiativeToSend] = useState<BaseMember | null>(null);

  // User creation form
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Председатель');
  const [newUserBranch, setNewUserBranch] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  const generatePassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    const password = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
    setNewUserPassword(password);
    return password;
  };

  const pendingApps = useMemo(() => applications.filter((app) => app.status === 'pending'), [applications]);
  const nonInitiativesCount = useMemo(() => baseMembers.filter((m) => !m.isInitiative).length, [baseMembers]);
  const initiativesCount = useMemo(() => baseMembers.filter((m) => m.isInitiative).length, [baseMembers]);
  const partnerInbox = useMemo(
    () => forwardedInitiatives.filter((initiative) => initiative.partnerName === currentUser.name),
    [forwardedInitiatives, currentUser.name],
  );
  const filteredAccessUsers = useMemo(() => {
    const query = userSearchQuery.trim().toLocaleLowerCase('ru');
    if (!query) return accessUsers;
    return accessUsers.filter((user) =>
      [user.name, user.login, user.roleInfo, user.branch || '']
        .some((value) => value.toLocaleLowerCase('ru').includes(query)),
    );
  }, [accessUsers, userSearchQuery]);

  // Filtered base members
  const filteredBaseList = useMemo(() => {
    return baseMembers.filter((item) => {
      // 1. Separate initiatives from other members
      if (baseSection === 'non_initiatives' && item.isInitiative) return false;
      if (baseSection === 'initiatives' && !item.isInitiative) return false;

      // 2. Category filter
      if (baseCategoryFilter !== 'all' && item.category !== baseCategoryFilter) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesRole = item.roleInfo.toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        const matchesPhone = item.phone.toLowerCase().includes(q);
        const matchesEmail = item.email.toLowerCase().includes(q);
        const matchesBranch = (item.branch || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesDesc && !matchesPhone && !matchesEmail && !matchesBranch) {
          return false;
        }
      }

      return true;
    });
  }, [baseMembers, baseSection, baseCategoryFilter, searchQuery]);

  const handleCopy = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      showToast(`${label} скопирован`);
    } catch {
      showToast(`Скопировано: ${text}`);
    }
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserLogin.trim()) return;
    const password = newUserPassword || generatePassword();

    const fullRoleInfo = newUserBranch.trim()
      ? `${newUserRole} · ${newUserBranch.trim()}`
      : newUserRole;

    onCreateAccess({
      name: newUserName.trim(),
      roleInfo: fullRoleInfo,
      login: newUserLogin.trim(),
      password,
      branch: newUserBranch.trim(),
    });

    setNewUserName('');
    setNewUserBranch('');
    setNewUserLogin('');
    setNewUserPassword('');
    setIsCreateUserModalOpen(false);
  };

  return (
    <div className="platform-dashboard w-full flex-1 text-left">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* Header with Title and dynamic Subtitle */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-[#0F1115] tracking-tight leading-tight">
              {currentUser.pageTitle}
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              {currentUser.pageSubtitle}
            </p>
          </div>

          {/* Quick city tag */}
          <div className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#F7F8FA] border border-[#E8EAEE] text-[12px] font-medium text-[#6B7280]">
            <BuildingIcon size={14} strokeWidth={2} />
            <span>Екатеринбург · Совет первых</span>
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-6 border-b border-[#E8EAEE] mb-8 overflow-x-auto">
          {/* Admin Tab: Заявки */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveMainTab('applications')}
              className={`pb-3 text-[14px] font-medium transition-colors relative cursor-pointer whitespace-nowrap ${
                activeMainTab === 'applications'
                  ? 'text-[#0F1115] font-semibold'
                  : 'text-[#6B7280] hover:text-[#0F1115]'
              }`}
            >
              <span>Заявки</span>
              {pendingApps.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#E60023] text-white">
                  {pendingApps.length}
                </span>
              )}
              {activeMainTab === 'applications' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E60023]" />
              )}
            </button>
          )}

          {/* Base Tab: For Admin & Chairman (Chairman can only view base!) */}
          {(isAdmin || isChairman) && (
            <button
              type="button"
              onClick={() => setActiveMainTab('base')}
              className={`pb-3 text-[14px] font-medium transition-colors relative cursor-pointer whitespace-nowrap ${
                activeMainTab === 'base'
                  ? 'text-[#0F1115] font-semibold'
                  : 'text-[#6B7280] hover:text-[#0F1115]'
              }`}
            >
              <span>База отделения</span>
              <span className="ml-2 px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#F7F8FA] border border-[#E8EAEE] text-[#6B7280]">
                {baseMembers.length}
              </span>
              {activeMainTab === 'base' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E60023]" />
              )}
            </button>
          )}

          {/* Partner Tab: Only initiatives for Partner */}
          {isPartner && (
            <button
              type="button"
              onClick={() => setActiveMainTab('partner_initiatives')}
              className={`pb-3 text-[14px] font-medium transition-colors relative cursor-pointer whitespace-nowrap ${
                activeMainTab === 'partner_initiatives'
                  ? 'text-[#0F1115] font-semibold'
                  : 'text-[#6B7280] hover:text-[#0F1115]'
              }`}
            >
              <span>Инициативы от отделений</span>
              <span className="ml-2 px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#E60023] text-white">
                {partnerInbox.length}
              </span>
              {activeMainTab === 'partner_initiatives' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E60023]" />
              )}
            </button>
          )}

          {/* Users tab: visible ONLY to admin */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveMainTab('users')}
              className={`pb-3 text-[14px] font-medium transition-colors relative cursor-pointer whitespace-nowrap ${
                activeMainTab === 'users'
                  ? 'text-[#0F1115] font-semibold'
                  : 'text-[#6B7280] hover:text-[#0F1115]'
              }`}
            >
              <span>Пользователи</span>
              <span className="ml-2 px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#F7F8FA] border border-[#E8EAEE] text-[#6B7280]">
                {accessUsers.length}
              </span>
              {activeMainTab === 'users' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E60023]" />
              )}
            </button>
          )}
        </div>

        {/* ============================================================== */}
        {/* TAB 1: Applications (Admin only)                               */}
        {/* ============================================================== */}
        {activeMainTab === 'applications' && isAdmin && (
          <div className="space-y-8">
            {/* 4 Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-[12px] border border-[#E8EAEE]">
                <div className="w-8 h-8 rounded-[8px] bg-[#FDE8EC] border border-[#FDE8EC] flex items-center justify-center text-[#E60023] mb-3">
                  <InboxIcon size={16} strokeWidth={2.2} />
                </div>
                <div className="text-[24px] font-extrabold text-[#0F1115] tracking-tight leading-none mb-1">
                  {pendingApps.length}
                </div>
                <div className="text-[12px] sm:text-[13px] text-[#6B7280]">
                  Новых заявок
                </div>
              </div>

              <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-[12px] border border-[#E8EAEE]">
                <div className="w-8 h-8 rounded-[8px] bg-[#F7F8FA] border border-[#E8EAEE] flex items-center justify-center text-[#0F1115] mb-3">
                  <DatabaseIcon size={16} strokeWidth={2.2} />
                </div>
                <div className="text-[24px] font-extrabold text-[#0F1115] tracking-tight leading-none mb-1">
                  {baseMembers.length}
                </div>
                <div className="text-[12px] sm:text-[13px] text-[#6B7280]">
                  В единой базе
                </div>
              </div>

              <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-[12px] border border-[#E8EAEE]">
                <div className="w-8 h-8 rounded-[8px] bg-[#F7F8FA] border border-[#E8EAEE] flex items-center justify-center text-[#0F1115] mb-3">
                  <LightbulbIcon size={16} strokeWidth={2.2} />
                </div>
                <div className="text-[24px] font-extrabold text-[#0F1115] tracking-tight leading-none mb-1">
                  {initiativesCount}
                </div>
                <div className="text-[12px] sm:text-[13px] text-[#6B7280]">
                  Инициатив
                </div>
              </div>

              <div className="bg-[#FFFFFF] p-4 sm:p-5 rounded-[12px] border border-[#E8EAEE]">
                <div className="w-8 h-8 rounded-[8px] bg-[#F7F8FA] border border-[#E8EAEE] flex items-center justify-center text-[#0F1115] mb-3">
                  <SparklesIcon size={16} strokeWidth={2.2} />
                </div>
                <div className="text-[24px] font-extrabold text-[#0F1115] tracking-tight leading-none mb-1">
                  {forwardedInitiatives.length}
                </div>
                <div className="text-[12px] sm:text-[13px] text-[#6B7280]">
                  Партнёрских проектов
                </div>
              </div>
            </div>

            {/* Incoming Applications Panel */}
            <div className="bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] overflow-hidden">
              <div className="p-5 sm:px-6 border-b border-[#E8EAEE] flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F1115]">
                    Входящие заявки на рассмотрение
                  </h2>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">
                    Заявки от участников, волонтёров и партнёров Екатеринбурга
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F7F8FA] border border-[#E8EAEE] text-[12px] font-semibold text-[#0F1115]">
                  {pendingApps.length}
                </span>
              </div>

              {pendingApps.length === 0 ? (
                <div className="py-12 text-center text-[#6B7280] text-[14px]">
                  Все входящие заявки обработаны
                </div>
              ) : (
                <div className="divide-y divide-[#E8EAEE]">
                  {pendingApps.map((app) => (
                    <div
                      key={app.id}
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F7F8FA] transition-colors"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className="w-10 h-10 rounded-[10px] flex-none flex items-center justify-center font-bold text-[13px] text-[#0F1115]"
                          style={{ backgroundColor: app.avatarBg }}
                        >
                          {app.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[15px] font-bold text-[#0F1115]">
                              {app.name}
                            </span>
                            <span
                              className={`text-[12px] px-2 py-0.5 rounded-[6px] font-medium border ${
                                app.isInitiative
                                  ? 'bg-[#FDE8EC] text-[#E60023] border-[#FCD0D8]'
                                  : 'bg-[#F7F8FA] border-[#E8EAEE] text-[#6B7280]'
                              }`}
                            >
                              {app.category}
                            </span>
                            {app.area && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E8EAEE] text-[#0F1115]">
                                Сфера: {app.area}
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] text-[#4B5563] mt-1.5 leading-snug">
                            {app.description}
                          </p>
                          <div className="flex items-center gap-4 text-[12px] text-[#6B7280] mt-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <PhoneIcon size={12} strokeWidth={2} />
                              <span className="font-medium text-[#0F1115]">{app.phone}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <MailIcon size={12} strokeWidth={2} />
                              <span>{app.email}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center w-full md:w-auto">
                        <button
                          type="button"
                          onClick={() => onRejectApplication(app.id)}
                          className="flex-1 md:flex-none h-9 px-3.5 rounded-[8px] bg-[#FFFFFF] hover:bg-[#F7F8FA] border border-[#E8EAEE] text-[13px] font-medium text-[#0F1115] transition-colors cursor-pointer"
                        >
                          Отклонить
                        </button>
                        <button
                          type="button"
                          onClick={() => onAcceptApplication(app.id)}
                          className="flex-1 md:flex-none h-9 px-4 rounded-[8px] bg-[#E60023] hover:bg-[#CC001F] text-[13px] font-semibold text-white transition-all shadow-sm active:scale-[0.99] cursor-pointer"
                        >
                          {app.actionText}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: Base (For Admin & Chairman)                             */}
        {/* Divided into: «Всё кроме инициатив» & «Все инициативы»         */}
        {/* Plus: Category filtering & phone/email display                 */}
        {/* ============================================================== */}
        {activeMainTab === 'base' && (
          <div className="space-y-6">
            {/* Stat Row for Base */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-[#FFFFFF] p-4 rounded-[12px] border border-[#E8EAEE]">
                <div className="text-[12px] text-[#6B7280]">Всего в базе</div>
                <div className="text-[22px] font-extrabold text-[#0F1115] mt-0.5">
                  {baseMembers.length}
                </div>
              </div>
              <div className="bg-[#FFFFFF] p-4 rounded-[12px] border border-[#E8EAEE]">
                <div className="text-[12px] text-[#6B7280]">Участники и партнёры</div>
                <div className="text-[22px] font-extrabold text-[#0F1115] mt-0.5">
                  {nonInitiativesCount}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-[#FFFFFF] p-4 rounded-[12px] border border-[#E8EAEE]">
                <div className="text-[12px] text-[#E60023] font-semibold">Инициативы</div>
                <div className="text-[22px] font-extrabold text-[#E60023] mt-0.5">
                  {initiativesCount}
                </div>
              </div>
            </div>

            {/* Sub-division toggle: «Всё кроме инициатив» vs «Все инициативы» */}
            <div className="bg-[#F7F8FA] p-1.5 rounded-[12px] border border-[#E8EAEE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-transparent">
                <button
                  type="button"
                  onClick={() => setBaseSection('non_initiatives')}
                  className={`px-4 py-2 rounded-[9px] text-[13px] font-semibold transition-all cursor-pointer ${
                    baseSection === 'non_initiatives'
                      ? 'bg-[#FFFFFF] text-[#0F1115] shadow-xs'
                      : 'text-[#6B7280] hover:text-[#0F1115]'
                  }`}
                >
                  <span>Участники и партнёры</span>
                  <span className="ml-2 text-[11px] px-1.5 py-0.2 rounded-full bg-[#F7F8FA] border border-[#E8EAEE]">
                    {nonInitiativesCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBaseSection('initiatives')}
                  className={`px-4 py-2 rounded-[9px] text-[13px] font-semibold transition-all cursor-pointer ${
                    baseSection === 'initiatives'
                      ? 'bg-[#FFFFFF] text-[#E60023] shadow-xs'
                      : 'text-[#6B7280] hover:text-[#0F1115]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <LightbulbIcon size={14} strokeWidth={2.4} />
                    <span>Все инициативы</span>
                  </span>
                  <span className="ml-2 text-[11px] px-1.5 py-0.2 rounded-full bg-[#FDE8EC] text-[#E60023]">
                    {initiativesCount}
                  </span>
                </button>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                  <SearchIcon size={14} strokeWidth={2} />
                </span>
                <input
                  type="text"
                  placeholder="Поиск по имени, школе, теме..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-white rounded-[8px] border border-[#E8EAEE] outline-none focus:border-[#E60023]"
                />
              </div>
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[13px]">
              <span className="text-[12px] font-medium text-[#6B7280] mr-1">Категория:</span>
              {[
                { id: 'all', label: 'Все' },
                { id: 'Мероприятия', label: 'Мероприятия' },
                { id: 'Медиа', label: 'Медиа' },
                { id: 'IT', label: 'IT' },
                { id: 'Волонтёрство', label: 'Волонтёрство' },
                { id: 'Партнёры', label: 'Партнёры' },
              ].map((cat) => {
                const isActive = baseCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setBaseCategoryFilter(cat.id)}
                    className={`px-3 py-1 rounded-[8px] border transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#0F1115] text-white border-[#0F1115] font-semibold'
                        : 'bg-white text-[#4B5563] border-[#E8EAEE] hover:border-[#D1D5DB]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Base List Card */}
            <div className="bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-[#E8EAEE] flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-[#0F1115]">
                  {baseSection === 'initiatives' ? 'Реестр инициатив отделений' : 'Реестр активистов и партнёров'}
                </h3>
                <span className="text-[12px] text-[#6B7280]">
                  Найдено: {filteredBaseList.length}
                </span>
              </div>

              {filteredBaseList.length === 0 ? (
                <div className="py-12 text-center text-[#6B7280] text-[14px]">
                  По выбранным фильтрам ничего не найдено
                </div>
              ) : (
                <div className="divide-y divide-[#E8EAEE]">
                  {filteredBaseList.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F7F8FA] transition-colors"
                    >
                      {/* Left: Avatar & Details */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className="w-10 h-10 rounded-[10px] flex-none flex items-center justify-center font-bold text-[13px] text-[#0F1115]"
                          style={{ backgroundColor: member.avatarBg }}
                        >
                          {member.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[15px] font-bold text-[#0F1115]">
                              {member.name}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-[6px] bg-[#F7F8FA] border border-[#E8EAEE] text-[#6B7280] font-medium">
                              {member.category}
                            </span>
                            {member.branch && (
                              <span className="text-[11px] text-[#6B7280]">
                                · {member.branch}
                              </span>
                            )}
                          </div>

                          {/* Role / Description */}
                          <p className="text-[13px] text-[#4B5563] mt-1 leading-snug">
                            {member.description || member.roleInfo}
                          </p>

                          {/* Phone and Email with quick-copy (Requirement!) */}
                          <div className="flex items-center gap-4 text-[12px] mt-2.5 flex-wrap">
                            {/* Phone */}
                            <div className="flex items-center gap-1.5 text-[#0F1115] bg-[#F7F8FA] px-2.5 py-1 rounded-[6px] border border-[#E8EAEE]">
                              <PhoneIcon size={12} strokeWidth={2} className="text-[#6B7280]" />
                              <a href={`tel:${member.phone}`} className="font-semibold hover:text-[#E60023]">
                                {member.phone}
                              </a>
                              <button
                                type="button"
                                title="Скопировать телефон"
                                onClick={() => handleCopy(member.phone, 'Телефон')}
                                className="text-[#9CA3AF] hover:text-[#0F1115] ml-1 p-0.5 cursor-pointer"
                              >
                                <CopyIcon size={12} strokeWidth={2} />
                              </button>
                            </div>

                            {/* Email */}
                            <div className="flex items-center gap-1.5 text-[#0F1115] bg-[#F7F8FA] px-2.5 py-1 rounded-[6px] border border-[#E8EAEE]">
                              <MailIcon size={12} strokeWidth={2} className="text-[#6B7280]" />
                              <a href={`mailto:${member.email}`} className="hover:text-[#E60023]">
                                {member.email}
                              </a>
                              <button
                                type="button"
                                title="Скопировать email"
                                onClick={() => handleCopy(member.email, 'Email')}
                                className="text-[#9CA3AF] hover:text-[#0F1115] ml-1 p-0.5 cursor-pointer"
                              >
                                <CopyIcon size={12} strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Action: Send initiative to partner */}
                      {member.isInitiative && (
                        <div className="self-end md:self-center flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedInitiativeToSend(member)}
                            className="h-9 px-3.5 rounded-[8px] bg-[#FFFFFF] hover:bg-[#FDE8EC] border border-[#E8EAEE] hover:border-[#FCD0D8] text-[13px] font-semibold text-[#E60023] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <SendIcon size={14} strokeWidth={2.4} />
                            <span>Отправить партнёру</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: Partner Cabinet (Only Initiatives!)                     */}
        {/* ============================================================== */}
        {activeMainTab === 'partner_initiatives' && isPartner && (
          <div className="space-y-6">
            <div className="bg-[#F7F8FA] p-4 rounded-[12px] border border-[#E8EAEE] flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#0F1115]">
                  Проекты и инициативы от первичных отделений
                </h2>
                <p className="text-[13px] text-[#6B7280] mt-0.5">
                  Сюда поступают отобранные председателями и кураторами инициативы, которым требуется поддержка партнёра
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#E60023] text-white text-[12px] font-bold">
                {partnerInbox.filter((initiative) => initiative.status !== 'supported').length} активных
              </span>
            </div>

            {partnerInbox.length === 0 ? (
              <div className="py-16 text-center text-[#6B7280] text-[14px] bg-white rounded-[16px] border border-[#E8EAEE]">
                Пока нет переданных инициатив
              </div>
            ) : (
              <div className="space-y-4">
                {partnerInbox.map((fwd) => (
                  <div
                    key={fwd.id}
                    className="p-5 sm:p-6 bg-white rounded-[16px] border border-[#E8EAEE] shadow-xs space-y-4 text-left"
                  >
                    {/* Header line */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8EAEE] pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FDE8EC] text-[#E60023] text-[11px] font-bold">
                          {fwd.area}
                        </span>
                        <span className="text-[12px] font-semibold text-[#0F1115]">
                          От: {fwd.senderName} ({fwd.senderRole})
                        </span>
                      </div>
                      <span className="text-[12px] text-[#9CA3AF]">
                        Передано: {fwd.sentDate}
                      </span>
                    </div>

                    {/* Content */}
                    <div>
                      <h3 className="text-[17px] font-bold text-[#0F1115] mb-1.5">
                        {fwd.title}
                      </h3>
                      <p className="text-[14px] text-[#4B5563] leading-relaxed">
                        {fwd.description}
                      </p>
                    </div>

                    {/* Sender note if available */}
                    {fwd.senderNote && (
                      <div className="p-3 bg-[#F7F8FA] rounded-[10px] border border-[#E8EAEE] text-[13px] text-[#0F1115]">
                        <span className="font-semibold text-[#6B7280] block text-[11px] mb-0.5">
                          Комментарий председателя:
                        </span>
                        «{fwd.senderNote}»
                      </div>
                    )}

                    {/* Author contacts & Support button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                      <div className="flex items-center gap-3 text-[13px] flex-wrap">
                        <span className="text-[#6B7280]">Автор:</span>
                        <span className="font-bold text-[#0F1115]">{fwd.authorName}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(fwd.authorPhone, 'Телефон')}
                          className="flex items-center gap-1 text-[#0F1115] bg-[#F7F8FA] px-2.5 py-1 rounded-[6px] border border-[#E8EAEE] hover:border-[#D1D5DB] cursor-pointer"
                        >
                          <PhoneIcon size={12} strokeWidth={2} className="text-[#6B7280]" />
                          <span>{fwd.authorPhone}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(fwd.authorEmail, 'Email')}
                          className="flex items-center gap-1 text-[#0F1115] bg-[#F7F8FA] px-2.5 py-1 rounded-[6px] border border-[#E8EAEE] hover:border-[#D1D5DB] cursor-pointer"
                        >
                          <MailIcon size={12} strokeWidth={2} className="text-[#6B7280]" />
                          <span>{fwd.authorEmail}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {fwd.status === 'supported' ? (
                          <span className="h-9 px-4 rounded-[8px] bg-[#E6F7EE] text-[#059669] text-[13px] font-semibold flex items-center gap-1.5">
                            <CheckIcon size={15} strokeWidth={2.5} />
                            <span>В поддержке</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSupportInitiative(fwd.id)}
                            className="h-9 px-4 rounded-[8px] bg-[#E60023] hover:bg-[#CC001F] text-white text-[13px] font-semibold transition-all shadow-sm active:scale-[0.99] cursor-pointer"
                          >
                            Поддержать инициативу
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: Users (Admin only)                                      */}
        {/* ============================================================== */}
        {activeMainTab === 'users' && isAdmin && (
          <div className="bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] overflow-hidden">
            <div className="p-5 sm:px-6 border-b border-[#E8EAEE] flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#0F1115]">
                  Управление доступами
                </h2>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  Учётные записи председателей отделений и партнёров
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateUserModalOpen(true)}
                className="h-9 px-3.5 rounded-[8px] bg-[#E60023] hover:bg-[#CC001F] text-white text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <PlusIcon size={15} strokeWidth={2.5} />
                <span>Создать доступ</span>
              </button>
            </div>

            <div className="border-b border-[#E8EAEE] bg-[#FAFAFB] p-4 sm:px-6">
              <label className="relative block">
                <SearchIcon size={16} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A9099]" />
                <input
                  type="search"
                  value={userSearchQuery}
                  onChange={(event) => setUserSearchQuery(event.target.value)}
                  placeholder="Поиск по имени, логину, роли или организации"
                  aria-label="Поиск пользователей"
                  className="pervik-input !h-10 !pl-9 !bg-white"
                />
              </label>
              <div className="mt-2 text-[11px] text-[#7B818B]">
                {userSearchQuery.trim() ? `Найдено: ${filteredAccessUsers.length}` : `Всего аккаунтов: ${accessUsers.length}`}
              </div>
            </div>

            <div className="grid gap-3 bg-[#F7F8FA] p-4 sm:p-5 lg:grid-cols-2">
              {filteredAccessUsers.map((user) => (
                <div
                  key={user.id}
                  className="rounded-[14px] border border-[#E8EAEE] bg-white p-4 shadow-[0_2px_8px_rgba(15,17,21,0.035)] transition-all hover:-translate-y-0.5 hover:border-[#F0B5BF] hover:shadow-[0_8px_24px_rgba(15,17,21,0.07)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] font-bold text-[13px] text-[#0F1115] ring-1 ring-black/5"
                        style={{ backgroundColor: user.avatarBg }}
                      >
                        {user.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-bold text-[#17191D]">{user.name}</div>
                        <div className="mt-1 inline-flex max-w-full rounded-full bg-[#FFF0F2] px-2 py-0.5 text-[10px] font-semibold text-[#C90020]">
                          <span className="truncate">{user.roleInfo.replace(/\s*·\s*логин:\s*\S+/i, '').trim() || 'Пользователь'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onResetPassword(user)}
                      className="h-8 flex-none rounded-[8px] border border-[#E8EAEE] bg-white px-2.5 text-[11px] font-medium text-[#4B5563] transition-colors hover:border-[#E60023] hover:text-[#C90020]"
                    >Сбросить пароль</button>
                  </div>
                  <div className="mt-4 grid gap-2 rounded-[10px] bg-[#F8F9FA] p-3 text-[12px] sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8A9099]">Логин</div>
                      <div className="mt-0.5 truncate font-medium text-[#30343B]">{user.login}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8A9099]">Пароль</div>
                      <div className="mt-0.5 break-all font-mono text-[11px] font-medium text-[#30343B]">{user.password || 'Не сохранён'}</div>
                    </div>
                    {user.branch && (
                      <div className="min-w-0 sm:col-span-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8A9099]">Организация</div>
                        <div className="mt-0.5 truncate font-medium text-[#30343B]">{user.branch}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filteredAccessUsers.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-[#D9DDE3] bg-white px-5 py-10 text-center lg:col-span-2">
                  <div className="text-[14px] font-semibold text-[#30343B]">{accessUsers.length ? 'Ничего не найдено' : 'Пока нет созданных аккаунтов'}</div>
                  <p className="mt-1 text-[12px] text-[#7B818B]">{accessUsers.length ? 'Измените запрос и попробуйте ещё раз.' : 'Создайте доступ — аккаунт появится в этом списке.'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Send Initiative to Partner */}
      <SendToPartnerModal
        isOpen={Boolean(selectedInitiativeToSend)}
        onClose={() => setSelectedInitiativeToSend(null)}
        initiative={
          selectedInitiativeToSend
            ? {
                id: selectedInitiativeToSend.id,
                title: selectedInitiativeToSend.name,
                authorName: selectedInitiativeToSend.author || selectedInitiativeToSend.name,
                authorPhone: selectedInitiativeToSend.phone,
                authorEmail: selectedInitiativeToSend.email,
                area: selectedInitiativeToSend.category,
                description: selectedInitiativeToSend.description || selectedInitiativeToSend.roleInfo,
              }
            : null
        }
        senderName={currentUser.name}
        senderRole={currentUser.roleBadge}
        partnerOptions={accessUsers
          .filter((user) => user.roleInfo.includes('Партнёр'))
          .map((user) => ({ name: user.name, specialization: user.roleInfo }))}
        onSend={(payload) => {
          onSendInitiativeToPartner(payload);
          setSelectedInitiativeToSend(null);
        }}
      />

      {/* Modal: Create Access (Admin only) */}
      {isCreateUserModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left"
        >
          <div
            onClick={() => setIsCreateUserModalOpen(false)}
            className="fixed inset-0 bg-[#000000]/45 backdrop-blur-[6px]"
          />
          <div className="relative w-full max-w-[420px] bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] p-6 sm:p-8 shadow-2xl modal-animate z-10">
            <button
              type="button"
              onClick={() => setIsCreateUserModalOpen(false)}
              aria-label="Закрыть"
              className="absolute top-5 right-5 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B7280] hover:text-[#0F1115] hover:bg-[#F7F8FA] cursor-pointer"
            >
              <CrossIcon size={18} strokeWidth={2} />
            </button>

            <h3 className="text-[20px] font-bold text-[#0F1115] mb-1">
              Создать доступ
            </h3>
            <p className="text-[13px] text-[#6B7280] mb-5">
              Сгенерировать логин и пароль для председателя или партнёра
            </p>

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[13px] font-medium text-[#0F1115] mb-1">
                  ФИО пользователя
                </label>
                <input
                  type="text"
                  required
                  placeholder="Сергей Васильев"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="pervik-input"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#0F1115] mb-1">
                  Роль
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="pervik-input pervik-select cursor-pointer"
                >
                  <option value="Председатель">Председатель отделения</option>
                  <option value="Куратор района">Куратор района</option>
                  <option value="Партнёр">Партнёр</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#0F1115] mb-1">
                  Отделение или организация
                </label>
                <input
                  type="text"
                  placeholder="Гимназия №99"
                  value={newUserBranch}
                  onChange={(e) => setNewUserBranch(e.target.value)}
                  className="pervik-input"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#0F1115] mb-1">
                  Логин
                </label>
                <input
                  type="text"
                  required
                  placeholder="vasiliev_g99"
                  value={newUserLogin}
                  onChange={(e) => setNewUserLogin(e.target.value)}
                  className="pervik-input"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-[13px] font-medium text-[#0F1115]">Пароль</label>
                  <button type="button" onClick={generatePassword} className="text-[12px] font-semibold text-[#E60023] hover:underline">
                    Сгенерировать случайный
                  </button>
                </div>
                <input
                  type="text"
                  required
                  autoComplete="new-password"
                  placeholder="Нажмите «Сгенерировать случайный» или введите свой"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="pervik-input font-mono"
                />
                <p className="mt-1 text-[11px] text-[#6B7280]">Пароль показывается при создании и сбросе. Сохраните его: в базе хранится только защищённый хеш.</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-11 rounded-[10px] bg-[#E60023] hover:bg-[#CC001F] text-white font-semibold text-[14px] transition-all cursor-pointer shadow-sm"
                >
                  Сгенерировать доступ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
