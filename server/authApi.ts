import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readPlatformState } from './platformStore.ts';
import { readPublicInitiatives, savePublicInitiative } from './publicInitiativesStore.ts';

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
  partner: {
    roleBadge: 'Партнёр',
    pageTitle: 'Инициативы для партнёра',
    pageSubtitle: 'Проекты и запросы на поддержку от отделений и кураторов',
  },
} as const;

export function getConfiguredUser(env: AuthEnvironment) {
  const login = env.AUTH_USERNAME?.trim();
  const role = env.AUTH_ROLE?.trim() as keyof typeof ROLE_DETAILS | undefined;
  if (!login || !role || !(role in ROLE_DETAILS)) return null;

  const name = env.AUTH_DISPLAY_NAME?.trim() || (role === 'admin' ? 'Администратор' : role === 'chairman' ? 'Председатель' : 'Партнёр');
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '??';
  return { role, login, name, initials, ...ROLE_DETAILS[role] };
}

export function createSessionUser(login: string, name: string, role: keyof typeof ROLE_DETAILS) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '??';
  return { role, login, name, initials, ...ROLE_DETAILS[role] };
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

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
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

function readJson(request: AuthRequest): Promise<Record<string, unknown>> {
  const objectBody = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request body');
    return value as Record<string, unknown>;
  };
  // Vercel's Node runtime parses JSON into request.body before invoking the
  // function. Local Vite middleware still needs to read the incoming stream.
  if (request.body && typeof request.body === 'object' && !Array.isArray(request.body)) {
    return Promise.resolve(request.body as Record<string, unknown>);
  }
  if (typeof request.body === 'string') {
    try {
      const body: unknown = JSON.parse(request.body);
      return Promise.resolve(objectBody(body));
    } catch {
      return Promise.reject(new Error('Invalid request body'));
    }
  }
  if (request.body !== undefined) return Promise.reject(new Error('Invalid request body'));

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    request.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > 16_384) {
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(objectBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
      } catch {
        reject(new Error('Invalid request body'));
      }
    });
    request.on('error', reject);
  });
}

export function createAuthMiddleware(env: AuthEnvironment) {
  return async (request: AuthRequest, response: ServerResponse, next: Next) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/api/initiatives' && request.method === 'GET') {
      try {
        return sendJson(response, 200, await readPublicInitiatives(env));
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
      if (!session || session.sub !== username || user.role !== 'admin') return sendJson(response, 403, { error: 'Admin access required' });

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

      const login = typeof body.login === 'string' ? body.login.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const normalizedLogin = login.toLocaleLowerCase('ru-RU');
      let state;
      try {
        state = await readPlatformState(env);
      } catch {
        return sendJson(response, 503, { error: 'Platform storage is not configured' });
      }
      const account = state.accounts.find((item) => item.login.toLocaleLowerCase('ru-RU') === normalizedLogin);
      const bootstrapUser = getConfiguredUser(env);
      let user: ReturnType<typeof getConfiguredUser> | ReturnType<typeof createSessionUser> | null = null;
      let validPassword = false;

      if (account) {
        const expectedHash = Buffer.from(account.passwordHash, 'hex');
        const actualHash = scryptSync(password, Buffer.from(account.salt, 'base64url'), expectedHash.length);
        validPassword = expectedHash.length > 0 && timingSafeEqual(actualHash, expectedHash);
        user = createSessionUser(account.login, account.name, account.role);
      } else if (bootstrapUser && normalizedLogin === bootstrapUser.login.toLocaleLowerCase('ru-RU')) {
        const passwordHash = env.AUTH_PASSWORD_HASH?.trim() ?? '';
        const passwordSalt = env.AUTH_PASSWORD_SALT?.trim() ?? '';
        const expectedHash = Buffer.from(passwordHash, 'hex');
        const actualHash = scryptSync(password, Buffer.from(passwordSalt, 'base64url'), expectedHash.length);
        validPassword = expectedHash.length > 0 && timingSafeEqual(actualHash, expectedHash);
        user = bootstrapUser;
      }

      if (!user || !validPassword) return sendJson(response, 401, { error: 'Invalid credentials' });

      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
      const token = makeToken({ sub: user.login, exp: expiresAt, version: account?.salt || env.AUTH_PASSWORD_SALT?.trim() }, sessionSecret);
      const secure = env.AUTH_COOKIE_SECURE === 'true' || env.NODE_ENV === 'production';
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
          ? session.version === account.salt ? createSessionUser(account.login, account.name, account.role) : null
          : configured?.login === session.sub && session.version === env.AUTH_PASSWORD_SALT?.trim() ? configured : null;
        return sendJson(response, 200, { user });
      } catch {
        return sendJson(response, 503, { error: 'Platform storage is unavailable' });
      }
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      response.setHeader('Set-Cookie', 'movement_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      return sendJson(response, 200, { ok: true });
    }

    return sendJson(response, 404, { error: 'Not found' });
  };
}
