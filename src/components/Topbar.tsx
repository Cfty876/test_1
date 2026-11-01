import {isSchoolMember} from '../utils/permissions.ts';
import { FitText } from './FitText.tsx';
import React, { useEffect, useRef, useState } from 'react';
import { ProfileView } from './ProfileView.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import type { MemberProfile } from '../utils/profile.ts';
import { platformRequest } from '../utils/platformApi.ts';
import { useLiveRefresh } from '../utils/useLiveRefresh.ts';
import { ArrowLeftIcon, LogOutIcon } from './Icons.tsx';
import type { HelpArea, UserSession } from '../utils/auth.ts';
import { HomeNavigation } from './HomeNavigation.tsx';

interface TopbarProps {
  currentView: 'home' | 'form' | 'success' | 'cabinet' | 'track' | 'initiatives' | 'initiative' | 'not-found';
  currentUser: UserSession | null;
  onOpenLogin: () => void;
  onGoHome: () => void;
  onIdeas: () => void;
  onHomeSection: (id: string) => void;
  onBack: () => void;
  onLogout: () => void;
  onStart: (area?: HelpArea) => void;
  onTrack: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  currentUser,
  onOpenLogin,
  onGoHome, onIdeas, onHomeSection, onBack,
  onLogout,
  onStart, onTrack,
}) => {
  const [profileOpen,setProfileOpen]=useState(false);
  const [profile,setProfile]=useState<MemberProfile|null>(null);
  const [profileError,setProfileError]=useState('');
  const sequence=useRef(0);
  const login=currentUser?.login;
  const activeLogin=useRef(login);activeLogin.current=login;
  async function loadProfile(signal?:AbortSignal){
    if(!login)return;
    const request=++sequence.current;
    try{const data=await platformRequest<MemberProfile>('/profile',undefined,signal);if(!signal?.aborted&&activeLogin.current===login&&request===sequence.current){setProfile(data);setProfileError('');}}
    catch(e){if(!signal?.aborted&&activeLogin.current===login&&request===sequence.current)setProfileError(e instanceof Error?e.message:'Не удалось загрузить профиль.');}
  }
  useEffect(()=>{setProfile(null);setProfileError('');setProfileOpen(false);const controller=new AbortController();void loadProfile(controller.signal);return()=>controller.abort();},[login]);
  useLiveRefresh(loadProfile,Boolean(login)&&currentView==='cabinet');
  return (
    <header className={`platform-topbar w-full sticky top-0 z-30 ${['home', 'initiatives', 'initiative', 'not-found'].includes(currentView) ? 'platform-topbar-home' : ''}`}>
      <div className="platform-topbar-inner max-w-[1200px] mx-auto px-4 sm:px-8 h-[64px] max-[420px]:h-[56px] flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          onClick={() => { onGoHome(); if (currentView === 'home') { window.dispatchEvent(new Event('pervik:home-top')); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); } }}
          className="flex items-center gap-1.5 text-left focus:outline-none group cursor-pointer"
          aria-label="Совет Первых Екатеринбурга — на главную"
        >
          <img className="brand-logo" src="/brand/ekb-council-logo.svg" alt="Логотип Совета Первых Екатеринбурга" />
          <span className="brand-divider" />
          <span className="brand-location">Совет Первых<br />Екатеринбург</span>
        </button>

        {/* Right side controls by screen */}
        {['home', 'initiatives', 'initiative', 'not-found'].includes(currentView) && <HomeNavigation isHome={currentView === 'home'} onHomeSection={onHomeSection} signedIn={Boolean(currentUser)} onLogin={onOpenLogin} onStart={onStart} onTrack={onTrack} onHome={onGoHome} onIdeas={onIdeas} />}

        {currentView !== 'home' && currentView !== 'initiatives' && currentView !== 'initiative' && currentView !== 'not-found' && <div className="flex items-center gap-3">

          {(currentView === 'form' || currentView === 'track') && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-[14px] font-medium text-[#0F1115] hover:bg-[#F7F8FA] border border-transparent hover:border-[#E8EAEE] transition-colors cursor-pointer"
            >
              <ArrowLeftIcon size={16} strokeWidth={2} />
              <span>Назад</span>
            </button>
          )}

          {currentView === 'cabinet' && currentUser && (
            <div className="flex items-center gap-3">
              {/* User Chip */}
              <button type="button" className="profile-trigger" aria-haspopup="dialog" aria-label={`Открыть профиль: ${currentUser.name}`} onClick={()=>{setProfile(null);setProfileOpen(true);void loadProfile();}}><div className="user-chip flex items-center gap-2.5 px-3 py-1.5 rounded-[10px]">
                <div className="user-chip-avatar w-7 h-7 rounded-full text-[12px] font-semibold flex items-center justify-center tracking-tight">
                  {profile&&profile.login===login&&profile.avatar?<img src={profile.avatar} alt=""/>:currentUser.initials}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[13px] font-semibold text-[#0F1115] leading-none">
                    <FitText text={currentUser.name} name minSize={11} />
                  </span>
                  <span className="text-[11px] text-[#6B7280] leading-tight mt-0.5">
                    {isSchoolMember(currentUser)?<FitText text={currentUser.branch||'Школа пока не указана'} minSize={11}/>:currentUser.councilStatus || currentUser.roleBadge}
                  </span>
                </div>
              </div>

              </button>
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
        </div>}
      </div>
      {profileOpen&&currentUser&&(profile&&profile.login===login?<ProfileView key={login} user={currentUser} initial={profile} onClose={()=>setProfileOpen(false)} onSaved={setProfile}/>:<ModalDialog fullScreen className="profile-dialog" labelledBy="profile-loading-title" onClose={()=>setProfileOpen(false)}><div className="profile-page"><header><button type="button" onClick={()=>setProfileOpen(false)}>Назад в кабинет</button></header><h1 id="profile-loading-title">Мой профиль</h1>{profileError?<><p role="alert">{profileError}</p><button type="button" onClick={()=>void loadProfile()}>Повторить загрузку</button></>:<p role="status">Загружаем профиль…</p>}</div></ModalDialog>)}
    </header>
  );
};







