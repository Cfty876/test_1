import { subscribePlatformChanges } from '../utils/liveSync.ts';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { DEFAULT_MAINTENANCE, type SiteStatus } from '../utils/siteStatus.ts';
import { fetchApi } from '../utils/http.ts';
import { useLiveRefresh } from '../utils/useLiveRefresh.ts';
import { LoginModal } from './LoginModal.tsx';
import { FormFeedback } from './FormFeedback.tsx';

export function SiteAccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [error, setError] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const request = ++generation.current;
    const response = await fetchApi('/api/platform/site-status', { credentials: 'same-origin', cache: 'no-store', signal });
    if (!response.ok) throw new Error('Не удалось проверить доступ к платформе.');
    const next = await response.json() as SiteStatus;
    if (signal?.aborted || request !== generation.current) return;
    setStatus(previous => previous && previous.version > next.version ? previous : next); setError('');
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch(() => { if (!controller.signal.aborted) setError('Не удалось подключиться к платформе. Проверь интернет и попробуй ещё раз.'); });
    const blocked = (event: Event) => {
      ++generation.current;
      const detail = (event as CustomEvent<SiteStatus>).detail;
      setStatus(previous => previous && previous.version > detail?.version ? previous : { ...DEFAULT_MAINTENANCE, ...detail, enabled: true, canManage: false });
    };
    const sessionChanged = () => { void refresh().catch(() => {}); };
    const unsubscribe = subscribePlatformChanges(kind => { if (kind === 'auth') sessionChanged(); });
    window.addEventListener('pervik:session-changed', sessionChanged);
    window.addEventListener('pervik:maintenance', blocked);
    return () => { controller.abort(); unsubscribe(); window.removeEventListener('pervik:session-changed', sessionChanged); window.removeEventListener('pervik:maintenance', blocked); };
  }, [refresh]);
  useLiveRefresh(refresh, true);
  useEffect(() => { if (status?.enabled && !status.canManage) heading.current?.focus({ preventScroll: true }); }, [status?.enabled, status?.canManage]);
  if (status && (!status.enabled || status.canManage)) return <>
    {status.enabled && <div className="maintenance-admin-banner" role="status"><Wrench size={18} aria-hidden="true" /><span><strong>Техработы включены.</strong> Для участников платформа закрыта. У администратора полный доступ.</span><a href="/?view=cabinet&section=overview">Управление сайтом<ArrowRight size={16} /></a></div>}
    {children}
  </>;
  return <div className="platform-shell maintenance-shell">
    <FormFeedback />
    <header className="maintenance-brand"><img src="/brand/ekb-council-logo.svg" alt="Совет Первых местного отделения города Екатеринбург" /><span>Первик · Екатеринбург</span></header>
    <main className="maintenance-page" aria-labelledby="maintenance-title">
      <div className="maintenance-mark" aria-hidden="true"><Wrench size={48} strokeWidth={1.5} /></div>
      <span className="maintenance-caption">{status ? 'Небольшая пауза для важного' : 'Подключаемся к платформе'}</span>
      <h1 id="maintenance-title" ref={heading} tabIndex={-1}>{status ? 'Скоро снова в движении' : error ? 'Не удалось подключиться' : 'Проверяем доступ…'}</h1>
      <p role={error && !status ? 'alert' : 'status'}>{status ? status.message : error || 'Это займёт несколько секунд.'}</p>
      {status && <div className="maintenance-reassurance"><ShieldCheck size={20} aria-hidden="true" /><span>Сохранённые заявки, проекты и баллы остаются в базе. Страница откроется автоматически, когда работы закончатся.</span></div>}
      <button className="maintenance-retry" type="button" onClick={() => { setError(''); void refresh().catch(() => setError('Сервер пока недоступен. Повторим подключение автоматически.')); }}><RefreshCw size={17} />Проверить доступ</button>
      {status && error && <p className="maintenance-small" role="alert">{error}</p>}
    </main>
    <footer className="maintenance-footer"><span>Совет Первых местного отделения города Екатеринбург</span><button type="button" onClick={() => setLoginOpen(true)}>Вход администратора<ArrowRight size={16} /></button></footer>
    <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={session => { if (session.role === 'admin') { setLoginOpen(false); void refresh().catch(() => setError('Не удалось обновить доступ. Попробуй ещё раз.')); } }} showToast={setError} />
  </div>;
}
