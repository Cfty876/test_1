import React from 'react';
import { ArrowLeftIcon, LogOutIcon } from './Icons.tsx';
import type { UserSession } from '../utils/auth.ts';

interface TopbarProps {
  currentView: 'home' | 'form' | 'success' | 'cabinet';
  currentUser: UserSession | null;
  onOpenLogin: () => void;
  onGoHome: () => void;
  onLogout: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  currentUser,
  onOpenLogin,
  onGoHome,
  onLogout,
}) => {
  return (
    <header className="platform-topbar w-full sticky top-0 z-30">
      <div className="platform-topbar-inner max-w-[1200px] mx-auto px-4 sm:px-8 h-[64px] max-[420px]:h-[56px] flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-1.5 text-left focus:outline-none group cursor-pointer"
          aria-label="Совет Первых Екатеринбурга — на главную"
        >
          <img className="brand-logo" src="/brand/ekb-council-logo.svg" alt="Логотип Совета Первых Екатеринбурга" />
          <span className="brand-divider" />
          <span className="brand-location">Совет Первых<br />Екатеринбург</span>
        </button>

        {/* Right side controls by screen */}
        <div className="flex items-center gap-3">
          {currentView === 'home' && (
            <button
              type="button"
              onClick={onOpenLogin}
              className="topbar-login px-3.5 py-1.5 rounded-[10px] text-[14px] font-medium transition-colors cursor-pointer"
            >
              Войти
            </button>
          )}

          {currentView === 'form' && (
            <button
              type="button"
              onClick={onGoHome}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-[14px] font-medium text-[#0F1115] hover:bg-[#F7F8FA] border border-transparent hover:border-[#E8EAEE] transition-colors cursor-pointer"
            >
              <ArrowLeftIcon size={16} strokeWidth={2} />
              <span>Назад</span>
            </button>
          )}

          {currentView === 'cabinet' && currentUser && (
            <div className="flex items-center gap-3">
              {/* User Chip */}
              <div className="user-chip flex items-center gap-2.5 px-3 py-1.5 rounded-[10px]">
                <div className="user-chip-avatar w-7 h-7 rounded-full text-[12px] font-semibold flex items-center justify-center tracking-tight">
                  {currentUser.initials}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[13px] font-semibold text-[#0F1115] leading-none">
                    {currentUser.name}
                  </span>
                  <span className="text-[11px] text-[#6B7280] leading-tight mt-0.5">
                    {currentUser.roleBadge}
                  </span>
                </div>
              </div>

              {/* Logout button */}
              <button
                type="button"
                onClick={onLogout}
                aria-label="Выйти из кабинета"
                title="Выйти"
                className="w-9 h-9 rounded-[10px] border border-[#E8EAEE] hover:bg-[#F7F8FA] text-[#6B7280] hover:text-[#0F1115] flex items-center justify-center transition-colors cursor-pointer"
              >
                <LogOutIcon size={17} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};







