import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { ModalDialog } from './ModalDialog.tsx';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const InstallContext = createContext({ installed: false, openInstall: () => {} });

export function MobileAppProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [guide, setGuide] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [installing, setInstalling] = useState(false);
  const promptRef = useRef<InstallPrompt | null>(null);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const sync = () => setInstalled(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const capture = (event: Event) => { event.preventDefault(); promptRef.current = event as InstallPrompt; };
    const complete = () => { setInstalled(true); setGuide(false); promptRef.current = null; };
    const network = () => setOffline(!navigator.onLine);
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', complete); window.removeEventListener('online', network); window.removeEventListener('offline', network); };
  }, []);
  const openInstall = () => {
    if (installing) return;
    const prompt = promptRef.current;
    if (!prompt) { setGuide(true); return; }
    promptRef.current = null;
    setInstalling(true);
    void prompt.prompt().then(() => prompt.userChoice).then(result => { if (result.outcome === 'accepted') setGuide(false); }).catch(() => setGuide(true)).finally(() => setInstalling(false));
  };
  return <InstallContext.Provider value={{ installed, openInstall }}>
    {offline && <div className="mobile-network-status" role="status"><WifiOff size={15} /> Нет сети. Для отправки и обновления нужен интернет.</div>}
    {children}
    {guide && <ModalDialog labelledBy="install-title" onClose={() => setGuide(false)} className="install-dialog"><section className="install-sheet">
      <button className="install-close" type="button" aria-label="Закрыть" onClick={() => setGuide(false)}><X size={20} /></button>
      <img src="/app/icon-192.png" alt="Первик" width="72" height="72" />
      <h2 id="install-title">Первик на главном экране</h2>
      <p>Открывай инициативы одним касанием — в отдельном окне, как приложение.</p>
      <ol>{ios ? <><li>Открой этот сайт в Safari.</li><li>Нажми <Share size={16} aria-label="Поделиться" /> «Поделиться» и «На экран “Домой”».</li><li>Если есть переключатель «Открывать как веб-приложение», включи его. Нажми «Добавить».</li></> : <><li>Открой меню браузера рядом с адресной строкой.</li><li>Выбери «Установить приложение» или «Добавить на главный экран».</li><li>Подтверди добавление значка «Первик».</li></>}</ol>
      {!window.isSecureContext && <p className="install-note">Для установки открой опубликованный сайт по HTTPS.</p>}
      <p className="install-note">Если пункта нет, попробуй {ios ? 'Safari' : 'Chrome или другой браузер с поддержкой установки'}. Для заявок и кабинета нужен интернет.</p>
      <button type="button" className="home-primary" onClick={() => setGuide(false)}>Понятно</button>
    </section></ModalDialog>}
  </InstallContext.Provider>;
}

export function InstallAppCard() {
  const { installed, openInstall } = useContext(InstallContext);
  const [dismissed, setDismissed] = useState(() => { try { return Date.now() - Number(localStorage.getItem('pervik.install-dismissed.v1')) < 7 * 86400000; } catch { return false; } });
  if (installed || dismissed) return null;
  return <aside className="install-app-card" aria-label="Установка Первика"><img src="/app/icon-192.png" alt="" width="48" height="48" /><div><strong>Первик всегда рядом</strong><span>Добавь на главный экран</span></div><button type="button" className="install-card-action" onClick={openInstall} aria-label="Добавить Первик на главный экран"><Download size={20} /></button><button type="button" className="install-dismiss" aria-label="Скрыть предложение установки на неделю" onClick={() => { setDismissed(true); try { localStorage.setItem('pervik.install-dismissed.v1', String(Date.now())); } catch { /* Storage can be unavailable in private mode. */ } }}><X size={16} /></button></aside>;
}

export function InstallAppMenuButton() {
  const { installed, openInstall } = useContext(InstallContext);
  return installed ? null : <button type="button" className="install-menu-button" onClick={openInstall}><Smartphone size={19} /><span>Добавить на главный экран</span></button>;
}
