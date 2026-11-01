import { sendJson, readJsonBody } from './httpSupport.ts';
import { passwordHash, PasswordBusyError } from './passwords.ts';
import { guardMaintenance, readMaintenance, sendMaintenance } from './maintenance.ts';
import { withMaintenanceAccess, MaintenanceModeError } from './maintenanceContext.ts';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readPlatformState, updatePlatformState } from './platformStore.ts';
import { hasPrivacyAcknowledgement, PRIVACY_VERSION, PRIVACY_ACKNOWLEDGEMENT_ERROR } from '../src/utils/legal.ts';
import { savePublicInitiative } from './publicInitiativesStore.ts';
import { readPublishedInitiatives } from './initiativeProjection.ts';
import type { CouncilStatus } from '../src/utils/implementations.ts';
import { isCuratorRoleInfo } from '../src/utils/permissions.ts';

type AuthEnvironment = Record<string, string | undefined>;
type AuthRequest = IncomingMessage & { url?: string; body?: unknown };
type Next = (error?: Error) => void;

const ROLE_DETAILS = {
  admin: {
    roleBadge: 'Главный доступ',
    pageTitle: 'Обзор',
    pageSubtitle: 'Полный доступ ко всем заявкам, базе и пользователям Екатеринбурга',
  },
  chairman: {
    roleBadge: 'Председатель отделения',
    pageTitle: 'Моё отделение',
    pageSubtitle: 'База активистов и инициатив отделения',
  },
} as const;

export function getConfiguredUser(env: AuthEnvironment) {
  const login = env.AUTH_USERNAME?.trim();
  const role = env.AUTH_ROLE?.trim() as keyof typeof ROLE_DETAILS | undefined;
  if (!login || !role || !(role in ROLE_DETAILS)) return null;

  const name = env.AUTH_DISPLAY_NAME?.trim() || (role === 'admin' ? 'Администратор' : 'Председатель');
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '??';
  return { role, login, name, initials, ...ROLE_DETAILS[role] };
}

export function createSessionUser(login: string, name: string, role: keyof typeof ROLE_DETAILS, details?: { branch?: string; councilStatus?: CouncilStatus; roleInfo?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '??';
  const curator = role === 'chairman' && isCuratorRoleInfo(details?.roleInfo);
  return { role, login, name, initials, ...ROLE_DETAILS[role], ...(curator ? { roleBadge: 'Куратор района', pageTitle: 'Кабинет куратора', pageSubtitle: 'Заявки, база отделений и реализация инициатив' } : {}), ...(role === 'chairman' && details?.councilStatus === 'Председатель Екатеринбурга' ? { roleBadge: 'Председатель городского Совета', pageTitle: 'Кабинет председателя Екатеринбурга', pageSubtitle: 'Проекты города, согласование запуска, команды и проверка отчётов' } : {}), branch: details?.branch, councilStatus: details?.councilStatus, canReviewApplications: role === 'admin' || curator };
}

function makeToken(payload: object, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readToken(token: string | undefined, secret: string): { sub: string; exp: number; version?: string } | null {
  if (!token) return null;
  const [encoded, providedSignature, ...extra] = token.split('.');
  if (!encoded || !providedSignature || extra.length) return null;

  const expectedSignature = createHmac('sha256', secret).update(encoded).digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { sub?: string; exp?: number; version?: string };
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, exp: payload.exp, version: payload.version };
  } catch {
    return null;
  }
}

function getCookie(request: IncomingMessage, key: string): string | undefined {
  const cookies = request.headers.cookie?.split(';') ?? [];
  const match = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${key}=`));
  return match?.slice(key.length + 1);
}

export function hasAdminSession(request: IncomingMessage, env: AuthEnvironment): boolean {
  const username = env.AUTH_USERNAME?.trim();
  const sessionSecret = env.AUTH_SESSION_SECRET?.trim();
  const user = getConfiguredUser(env);
  if (!username || !sessionSecret || !user || user.role !== 'admin') return false;
  const session = readToken(getCookie(request, 'movement_session'), sessionSecret);
  return Boolean(session && session.sub === username && session.version === env.AUTH_PASSWORD_SALT?.trim());
}

export function getSessionSubject(request: IncomingMessage, env: AuthEnvironment): string | null {
  const secret = env.AUTH_SESSION_SECRET?.trim();
  if (!secret) return null;
  return readToken(getCookie(request, 'movement_session'), secret)?.sub ?? null;
}

export function getSessionVersion(request: IncomingMessage, env: AuthEnvironment): string | undefined {
  const secret = env.AUTH_SESSION_SECRET?.trim();
  return secret ? readToken(getCookie(request, 'movement_session'), secret)?.version : undefined;
}


function sendStorageUnavailable(response: ServerResponse) {
  response.setHeader('Retry-After', '60');
  return sendJson(response, 503, {
    code: 'PLATFORM_STORAGE_UNAVAILABLE',
    error: 'Хранилище платформы временно недоступно. Обратитесь к администратору для проверки доступа и лимитов хранилища.',
  });
}

interface StoredInitiative {
  id: string;
  title: string;
  description: string;
  area: 'Мероприятия' | 'Медиа' | 'IT' | 'Волонтёрство';
  author: string;
  publishedAt: string;
}

const INITIATIVE_AREAS = new Set(['Мероприятия', 'Медиа', 'IT', 'Волонтёрство']);

const readJson = (request: AuthRequest) => readJsonBody(request, 16_384);

export function createAuthMiddleware(env: AuthEnvironment) {
  const attempts = new Map<string, { count: number; until: number }>();
  return (request: AuthRequest, response: ServerResponse, next: Next) => withMaintenanceAccess(hasAdminSession(request, env), async () => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/api/initiatives') {
      try { if (await guardMaintenance(request, response, env, hasAdminSession(request, env))) return; }
      catch { return sendStorageUnavailable(response); }
    }
    if (pathname === '/api/initiatives' && request.method === 'GET') {
      try {
        return sendJson(response, 200, await readPublishedInitiatives(env));
      } catch {
        return sendJson(response, 500, { error: 'Could not load initiatives' });
      }
    }

    if (pathname === '/api/initiatives' && request.method === 'POST') {
      const username = env.AUTH_USERNAME?.trim();
      const sessionSecret = env.AUTH_SESSION_SECRET?.trim();
      const user = getConfiguredUser(env);
      if (!username || !sessionSecret || !user) return sendJson(response, 503, { error: 'Authentication is not configured' });
      const session = readToken(getCookie(request, 'movement_session'), sessionSecret);
      if (!session || session.sub !== username || session.version !== env.AUTH_PASSWORD_SALT?.trim() || user.role !== 'admin') return sendJson(response, 403, { error: 'Admin access required' });

      try {
        const body = await readJson(request);
        const id = typeof body.id === 'string' ? body.id.slice(0, 120) : '';
        const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
        const description = typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '';
        const area = typeof body.area === 'string' ? body.area : '';
        const author = typeof body.author === 'string' ? body.author.trim().slice(0, 120) : '';
        if (!id || !title || !description || !author || !INITIATIVE_AREAS.has(area)) {
          return sendJson(response, 400, { error: 'Invalid initiative data' });
        }

        const initiative: StoredInitiative = {
          id, title, description, area: area as StoredInitiative['area'], author, publishedAt: new Date().toISOString(),
        };
        return sendJson(response, 201, await savePublicInitiative(initiative, env));
      } catch {
        return sendJson(response, 400, { error: 'Could not save initiative' });
      }
    }

    if (!pathname.startsWith('/api/auth/')) return next();

    const sessionSecret = env.AUTH_SESSION_SECRET?.trim();

    if (!sessionSecret) {
      return sendJson(response, 503, { error: 'Authentication is not configured' });
    }

    if (pathname === '/api/auth/login' && request.method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = await readJson(request);
      } catch {
        return sendJson(response, 400, { error: 'Invalid request' });
      }

      if (!hasPrivacyAcknowledgement(body)) return sendJson(response, 400, { error: PRIVACY_ACKNOWLEDGEMENT_ERROR });
      const login = typeof body.login === 'string' ? body.login.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!login || login.length > 160 || !password || password.length > 256) return sendJson(response, 401, { error: 'Invalid credentials' });
      const normalizedLogin = login.toLocaleLowerCase('ru-RU');
      if (env.RATE_LIMIT_ENABLED !== 'false') {
        const ip = (request as AuthRequest & { ip?: string }).ip || request.socket.remoteAddress || 'unknown';
        const key = createHmac('sha256', sessionSecret).update(`${ip}\0${normalizedLogin}`).digest('hex');
        const now = Date.now(); let bucket = attempts.get(key);
        if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + 60_000 }; attempts.delete(key); attempts.set(key, bucket); }
        bucket.count++; while (attempts.size > 10000) attempts.delete(attempts.keys().next().value!);
        if (bucket.count > 12) { response.setHeader('Retry-After', '60'); return sendJson(response, 429, { error: 'Слишком много попыток входа. Подождите минуту.' }); }
      }
      let state;
      try {
        state = await readPlatformState(env);
      } catch {
        return sendStorageUnavailable(response);
      }
      const account = state.accounts.find((item) => item.login.toLocaleLowerCase('ru-RU') === normalizedLogin);
      const bootstrapUser = getConfiguredUser(env);
      let user: ReturnType<typeof getConfiguredUser> | ReturnType<typeof createSessionUser> | null = null;
      let validPassword = false;

      try {
      if (account) {
        const expectedHash = Buffer.from(account.passwordHash, 'hex');
        const actualHash = await passwordHash(password, Buffer.from(account.salt, 'base64url'), expectedHash.length);
        validPassword = expectedHash.length > 0 && timingSafeEqual(actualHash, expectedHash);
        user = createSessionUser(account.login, account.name, account.role, account);
      } else if (bootstrapUser && normalizedLogin === bootstrapUser.login.toLocaleLowerCase('ru-RU')) {
        const configuredHash = env.AUTH_PASSWORD_HASH?.trim() ?? '';
        const passwordSalt = env.AUTH_PASSWORD_SALT?.trim() ?? '';
        const expectedHash = Buffer.from(configuredHash, 'hex');
        const actualHash = await passwordHash(password, Buffer.from(passwordSalt, 'base64url'), expectedHash.length);
        validPassword = expectedHash.length > 0 && timingSafeEqual(actualHash, expectedHash);
        user = bootstrapUser;
      }

      if (!user) await passwordHash(password, Buffer.alloc(16, 1));
      } catch (error) { if (error instanceof PasswordBusyError) return sendStorageUnavailable(response); throw error; }
      if (!user || !validPassword) return sendJson(response, 401, { error: 'Invalid credentials' });
      if (user.role !== 'admin') {
        try { const maintenance = await readMaintenance(env); if (maintenance.enabled) return sendMaintenance(response, maintenance); }
        catch { return sendStorageUnavailable(response); }
      }

      const signedInLogin = user.login;
      const credentialVersion = account?.salt || env.AUTH_PASSWORD_SALT?.trim();
      try {
        const recorded = await withMaintenanceAccess(user.role === 'admin', () => updatePlatformState(current => {
          const currentAccount = current.accounts.find(item => item.login.toLocaleLowerCase('ru-RU') === normalizedLogin);
          if (currentAccount ? currentAccount.salt !== credentialVersion : account !== undefined) return { state: current, result: false };
          return { state: { ...current, privacyAcknowledgements: [
            ...current.privacyAcknowledgements.filter(item => item.login.toLocaleLowerCase('ru-RU') !== normalizedLogin),
            { login: signedInLogin, version: PRIVACY_VERSION, at: new Date().toISOString() },
          ] }, result: true };
        }, env));
        if (!recorded) return sendJson(response, 401, { error: 'Invalid credentials' });
      } catch (error) {
        if (error instanceof MaintenanceModeError) return sendMaintenance(response, error.maintenance);
        return sendStorageUnavailable(response);
      }

      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
      const token = makeToken({ sub: user.login, exp: expiresAt, version: account?.salt || env.AUTH_PASSWORD_SALT?.trim() }, sessionSecret);
      const secure = env.AUTH_COOKIE_SECURE === 'true' || (env.AUTH_COOKIE_SECURE !== 'false' && env.NODE_ENV === 'production');
      response.setHeader('Set-Cookie', `movement_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure ? '; Secure' : ''}`);
      return sendJson(response, 200, { user });
    }

    if (pathname === '/api/auth/session' && request.method === 'GET') {
      const session = readToken(getCookie(request, 'movement_session'), sessionSecret);
      if (!session) return sendJson(response, 200, { user: null });
      try {
        const state = await readPlatformState(env);
        const account = state.accounts.find((item) => item.login === session.sub);
        const configured = getConfiguredUser(env);
        const user = account
          ? session.version === account.salt ? createSessionUser(account.login, account.name, account.role, account) : null
          : configured?.login === session.sub && session.version === env.AUTH_PASSWORD_SALT?.trim() ? configured : null;
        return sendJson(response, 200, { user });
      } catch {
        return sendStorageUnavailable(response);
      }
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      response.setHeader('Set-Cookie', 'movement_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      return sendJson(response, 200, { ok: true });
    }

    return sendJson(response, 404, { error: 'Not found' });
  });
}
