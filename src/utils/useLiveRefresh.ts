import { useEffect, useRef, useState } from 'react';
import { subscribePlatformChanges } from './liveSync.ts';

/** Visible clients converge through the server; same-browser changes also invalidate immediately. */
export function useLiveRefresh(refresh: (signal: AbortSignal) => Promise<void>, enabled: boolean, interval = 5000) {
  const callback = useRef(refresh);
  useEffect(() => { callback.current = refresh; }, [refresh]);
  const [issue, setIssue] = useState('');
  useEffect(() => {
    if (!enabled) { setIssue(''); return; }
    let stopped = false, running = false, queued = false, failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    async function run() {
      clearTimeout(timer);
      if (stopped || document.visibilityState !== 'visible') return;
      if (running) { queued = true; return; }
      running = true; queued = false; controller = new AbortController();
      try { await callback.current(controller.signal); failures = 0; if (!stopped) setIssue(''); }
      catch { failures = Math.min(failures + 1, 4); if (!stopped) setIssue('Нет связи с сервером. Показаны последние загруженные данные. Повторяем подключение автоматически.'); }
      finally {
        running = false;
        if (!stopped) timer = setTimeout(() => void run(), queued ? 150 : Math.min(interval * 2 ** failures, 60000) + Math.random() * 500);
      }
    }
    const wake = () => {
      if (stopped || document.visibilityState !== 'visible') return;
      if (running) { queued = true; return; }
      clearTimeout(timer); timer = setTimeout(() => void run(), 150);
    };
    const unsubscribe = subscribePlatformChanges(kind => { if (kind === 'data') wake(); });
    window.addEventListener('focus', wake); window.addEventListener('online', wake); document.addEventListener('visibilitychange', wake);
    timer = setTimeout(() => void run(), interval);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); unsubscribe(); window.removeEventListener('focus', wake); window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); };
  }, [enabled, interval]);
  return issue;
}
