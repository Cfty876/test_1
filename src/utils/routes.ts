const views = new Set(['home', 'form', 'success', 'cabinet', 'track', 'initiatives', 'initiative']);

export function isUnknownPlatformLocation(url: URL): boolean {
  if (url.pathname !== '/' && url.pathname !== '/index.html') return true;
  const view = url.searchParams.get('view');
  return view !== null && !views.has(view);
}
