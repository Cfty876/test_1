import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createPlatformApi } from './platformApi.ts';
import { createAuthMiddleware, hasAdminSession } from './authApi.ts';
import { readMaintenance } from './maintenance.ts';
import { readPlatformState } from './platformStore.ts';
import { closeDatabase } from './database.ts';
import { requestContext, sendJson } from './httpSupport.ts';
import { createRequestGuard } from './requestGuard.ts';
import { isUnknownPlatformLocation } from '../src/utils/routes.ts';

for (const key of ['AUTH_SESSION_SECRET', 'AUTH_USERNAME', 'AUTH_PASSWORD_SALT', 'AUTH_PASSWORD_HASH']) {
  if (!process.env[key]?.trim()) throw new Error(`Required configuration missing: ${key}`);
}
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) throw new Error('Production requires DATABASE_URL');
if (!/^[a-f0-9]{128}$/i.test(process.env.AUTH_PASSWORD_HASH || '') || Buffer.from(process.env.AUTH_PASSWORD_SALT || '', 'base64url').length < 16) throw new Error('Invalid password hash configuration');
if (!['admin', 'chairman'].includes(process.env.AUTH_ROLE || '')) throw new Error('Invalid AUTH_ROLE');
if ((process.env.AUTH_SESSION_SECRET || '').length < 32) throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters');
await readPlatformState(process.env);
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');
if (process.env.TRUST_PROXY === 'private') app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
let stopping = false;
let requests = 0, unavailable = 0, slow = 0;
const stats = setInterval(() => {
  if (requests) console.log(JSON.stringify({ event: 'server_stats', requests, unavailable, slow, rssMiB: Math.round(process.memoryUsage().rss / 1048576) }));
  requests = unavailable = slow = 0;
}, 60_000); stats.unref();
app.use((request, response, next) => {
  const started = performance.now();
  response.once('finish', () => { requests++; if (response.statusCode >= 500) unavailable++; if (performance.now() - started > 1000) slow++; });
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  requestContext.run(request, next);
});
app.get('/healthz', (_request, response) => { response.setHeader('Cache-Control', 'no-store'); response.status(stopping ? 503 : 200).json({ status: stopping ? 'stopping' : 'ok' }); });
let checking: Promise<boolean> | undefined;
app.get('/readyz', async (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (stopping) { response.status(503).json({ status: 'stopping' }); return; }
  checking ||= readPlatformState(process.env).then(() => true, () => false).finally(() => { checking = undefined; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 3000); timer.unref(); });
  const ok = await Promise.race([checking, deadline]); clearTimeout(timer);
  response.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'unavailable' });
});

app.use(createRequestGuard(process.env));
const wrap = (handler: ReturnType<typeof createPlatformApi>) => (request: Request, response: Response, next: NextFunction) => { Promise.resolve(handler(request, response, next)).catch(next); };
app.use(wrap(createPlatformApi(process.env)));
app.use(wrap(createAuthMiddleware(process.env)));
app.use('/api', (_request, response) => { sendJson(response, 404, { error: 'Маршрут не найден.' }); });
const dist = path.resolve('dist');
async function serveApp(request: Request, response: Response, next: NextFunction) {
  response.setHeader('Cache-Control', 'no-store');
  const missing = isUnknownPlatformLocation(new URL(request.originalUrl, 'http://localhost'));
  try {
    const maintenance = hasAdminSession(request, process.env) ? null : await readMaintenance(process.env);
    if (maintenance?.enabled) { response.setHeader('Retry-After', '60'); response.status(503); }
    else response.status(missing ? 404 : 200);
  } catch { response.status(503); }
  response.sendFile(path.join(dist, 'index.html'), error => { if (error) next(error); });
}
app.get(['/', '/index.html'], serveApp);
app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', index: false }));
app.use(express.static(dist, { index: false, maxAge: '1h' }));
app.get('*', serveApp);
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const id = randomUUID(); console.error(JSON.stringify({ event: 'request_failed', id, type: error instanceof Error ? error.name : 'UnknownError' }));
  if (response.headersSent) { response.destroy(); return; }
  response.setHeader('Retry-After', '5'); sendJson(response, 503, { error: 'Сервис временно недоступен. Повторите действие.', requestId: id });
});
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => console.log(`Pervik server listening on port ${port}`));
server.requestTimeout = 20_000; server.headersTimeout = 15_000; server.keepAliveTimeout = 5000; server.maxRequestsPerSocket = 1000;
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 25_000); deadline.unref();
  server.close(() => { void closeDatabase().then(() => process.exit(0), () => process.exit(1)); });
  server.closeIdleConnections();
});
