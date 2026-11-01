import { publishPlatformChange, subscribePlatformChanges } from './liveSync.ts';
const reads = new Map<string, { etag: string; body: ArrayBuffer; headers: Headers }>();
let cacheBytes = 0, generation = 0;
function clearReads() { reads.clear(); cacheBytes = 0; generation++; }
if (typeof window !== 'undefined') subscribePlatformChanges(clearReads);

/** Bound every request and release obsolete reads when a screen changes. */
export async function fetchApi(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const isRead = method === 'GET';
  if (!isRead) clearReads();
  const startedGeneration = generation;
  const saved = isRead ? reads.get(input) : undefined;
  const headers = new Headers(init.headers);
  if (saved) headers.set('If-None-Match', saved.etag);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
  try {
    const received = await fetch(input, { ...init, headers, cache: 'no-store', signal: controller.signal });
    const bytes = await received.arrayBuffer();
    const responseHeaders = new Headers(received.headers);
    responseHeaders.delete('Content-Encoding'); responseHeaders.delete('Content-Length');
    let response: Response;
    if (received.status === 304 && saved) {
      response = new Response(saved.body.slice(0), { status: 200, headers: saved.headers });
    } else {
      response = new Response([204,205,304].includes(received.status) ? null : bytes, { status: received.status, statusText: received.statusText, headers: responseHeaders });
      const etag = received.headers.get('etag');
      if (isRead && received.ok && etag && bytes.byteLength < 6 * 1024 * 1024 && startedGeneration === generation) {
        const previous = reads.get(input); if (previous) cacheBytes -= previous.body.byteLength;
        reads.delete(input); reads.set(input, { etag, body: bytes, headers: responseHeaders }); cacheBytes += bytes.byteLength;
        while (reads.size > 16 || cacheBytes > 16 * 1024 * 1024) { const key = reads.keys().next().value!; cacheBytes -= reads.get(key)!.body.byteLength; reads.delete(key); }
      }
    }
    if (response.status === 503) {
      const payload = await response.clone().json().catch(() => null);
      if (payload?.code === 'MAINTENANCE_MODE' && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pervik:maintenance', { detail: payload.maintenance }));
    }
    if (response.ok && ['POST', 'PUT', 'PATCH', 'DELETE'].includes((init.method || 'GET').toUpperCase())) {
      let trackingRead = false;
      if (input === '/api/platform/application-track' && typeof init.body === 'string') {
        try { trackingRead = !JSON.parse(init.body).action; } catch { trackingRead = true; }
      }
      if (!trackingRead) publishPlatformChange(input.startsWith('/api/auth/') ? 'auth' : 'data');
      if (input.startsWith('/api/auth/') && typeof window !== 'undefined') window.dispatchEvent(new Event('pervik:session-changed'));
    }
    return response;
  } catch (error) {
    if (init.signal?.aborted) throw error;
    if (timedOut) throw new Error('Сервер отвечает слишком долго. Попробуйте ещё раз — введённые данные сохранены.');
    throw new Error('Не удалось связаться с сервером. Проверьте подключение к интернету.');
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
}
