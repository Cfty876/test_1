export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const register = () => { void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => { /* The website remains usable when installation is unavailable. */ }); };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
