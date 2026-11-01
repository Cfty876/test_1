import type { IncomingMessage, ServerResponse } from 'node:http';
import { hasAdminSession } from './authApi.ts';
import { sendJson } from './httpSupport.ts';
type Env = Record<string, string | undefined>;

/** Per-process admission and IP budgets. Deploy one app instance or use a shared
 * rate limiter at the ingress when adding replicas. Never trust client XFF. */
export function createRequestGuard(env: Env) {
  const buckets = new Map<string, { count: number; reset: number }>();
  let active = 0, photos = 0;
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (!pathname.startsWith('/api/')) return next();
    const deny = (status: number, message: string) => { response.setHeader('Retry-After', '60'); request.resume(); sendJson(response, status, { error: message }); };
    if (active >= 128) return deny(503, 'Сервер занят. Повторите действие чуть позже.');
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method || 'GET');
    const photo = pathname === '/api/platform/implementation-photo' && write;
    if (photo && photos >= 4) return deny(503, 'Фотографии загружаются. Повторите отправку чуть позже.');
    if (write) {
      const origin = request.headers.origin;
      let allowed = request.headers['sec-fetch-site'] !== 'cross-site';
      try { if (origin) allowed &&= new URL(origin).host === request.headers.host; } catch { allowed = false; }
      if (!allowed) return deny(403, 'Отправляйте данные со страницы платформы.');
      if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') return deny(415, 'Сжатые запросы не поддерживаются.');
    }
    if (env.RATE_LIMIT_ENABLED !== 'false') {
      const now = Date.now();
      const ip = (request as IncomingMessage & { ip?: string }).ip || request.socket.remoteAddress || 'unknown';
      const login = pathname === '/api/auth/login';
      const category = login ? 'login' : write ? 'write' : 'read';
      const key = `${ip}:${category}`;
      const limit = login ? 120 : write ? (hasAdminSession(request, env) ? 360 : 180) : 12000;
      let bucket = buckets.get(key);
      if (!bucket || bucket.reset <= now) { bucket = { count: 0, reset: now + 60_000 }; buckets.delete(key); buckets.set(key, bucket); }
      bucket.count++;
      while (buckets.size > 10_000) buckets.delete(buckets.keys().next().value!);
      if (bucket.count > limit) return deny(429, 'Слишком много запросов. Подождите минуту и попробуйте снова.');
    }
    active++;
    if (photo) photos++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; if (photo) photos--; } };
    response.once('close', release); response.once('finish', release);
    next();
  };
}
