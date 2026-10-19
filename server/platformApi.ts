import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApplicationItem, AccessUser, BaseMember } from '../src/components/DashboardView.tsx';
import type { ForwardedInitiative, Role } from '../src/utils/auth.ts';
import { createSessionUser, getConfiguredUser, getSessionSubject, getSessionVersion } from './authApi.ts';
import { readPlatformState, updatePlatformState, type StoredAccount } from './platformStore.ts';
import { readPublicInitiatives, savePublicInitiative } from './publicInitiativesStore.ts';
import type { FeaturedSelection } from '../src/utils/homepage.ts';

type Environment = Record<string, string | undefined>;
type Request = IncomingMessage & { url?: string; method?: string; body?: unknown };
type Next = () => void;
const AVATAR_COLORS = ['#FEE2E2', '#E0E7FF', '#FEF3C7', '#DCFCE7', '#F3E8FF', '#CFFAFE'];
const AREAS = new Set(['Мероприятия', 'Медиа', 'IT', 'Волонтёрство']);

function send(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function readBody(request: Request): Promise<Record<string, unknown>> {
  function objectBody(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request body');
    return value as Record<string, unknown>;
  }
  if (request.body && typeof request.body === 'object' && !Array.isArray(request.body)) {
    return Promise.resolve(request.body as Record<string, unknown>);
  }
  if (typeof request.body === 'string') {
    try { return Promise.resolve(objectBody(JSON.parse(request.body))); }
    catch { return Promise.reject(new Error('Invalid request body')); }
  }
  if (request.body !== undefined) return Promise.reject(new Error('Invalid request body'));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 32_768) {
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(objectBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))); }
      catch { reject(new Error('Invalid request body')); }
    });
    request.on('error', reject);
  });
}

async function resolveUser(request: Request, env: Environment) {
  const subject = getSessionSubject(request, env);
  if (!subject) return null;
  const version = getSessionVersion(request, env);
  const bootstrapUser = getConfiguredUser(env);
  if (bootstrapUser?.login === subject) return version === env.AUTH_PASSWORD_SALT?.trim() ? bootstrapUser : null;
  const state = await readPlatformState(env);
  const account = state.accounts.find((item) => item.login === subject);
  return account && version === account.salt ? createSessionUser(account.login, account.name, account.role) : null;
}

function userSummary(account: StoredAccount): AccessUser {
  const { salt: _salt, passwordHash: _hash, ...publicUser } = account;
  return publicUser;
}

function validRoleInfo(roleInfo: string): Exclude<Role, 'admin'> {
  return roleInfo.toLocaleLowerCase('ru-RU').includes('партнёр') ? 'partner' : 'chairman';
}

function normalizeForm(body: Record<string, unknown>): Omit<ApplicationItem, 'id' | 'initials' | 'avatarBg' | 'actionText' | 'status'> | null {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 160) : '';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '';
  const category = typeof body.category === 'string' ? body.category.trim().slice(0, 120) : '';
  const customCategoryText = typeof body.customCategoryText === 'string' ? body.customCategoryText.trim().slice(0, 120) : '';
  const isInitiative = category === 'Есть своя инициатива';
  const selectedArea = typeof body.helpArea === 'string' ? body.helpArea : '';
  const isCustom = category.includes('Свой вариант');
  const area = isInitiative || isCustom || category === 'Хочу помочь инициативе' ? selectedArea
    : category.includes('Медиа') ? 'Медиа' : category.includes('IT') ? 'IT' : category.includes('Волонтёр') ? 'Волонтёрство' : 'Мероприятия';
  if (!name || !phone || !email || !description || !category || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if ((isInitiative || category.includes('Свой вариант')) && !AREAS.has(area)) return null;
  if (category.includes('Свой вариант') && !customCategoryText) return null;
  if (!/^[+\d\s().-]+$/u.test(phone) || phone.replace(/\D/g, '').length < 10 || phone.replace(/\D/g, '').length > 15) return null;
  return {
    name, phone, email, description,
    category: isCustom && customCategoryText ? `Свой: ${customCategoryText}` : category,
    isInitiative,
    area: AREAS.has(area) ? area : 'Мероприятия',
  };
}

function categoryFor(application: ApplicationItem): BaseMember['category'] {
  if (application.category.toLocaleLowerCase('ru-RU').includes('партнёр')) return 'Партнёры';
  if (application.area === 'Медиа' || application.category.includes('Медиа')) return 'Медиа';
  if (application.area === 'IT' || application.category.includes('IT')) return 'IT';
  if (application.area === 'Волонтёрство' || application.category.includes('Волонтёр')) return 'Волонтёрство';
  return 'Мероприятия';
}

function buildMember(application: ApplicationItem): BaseMember {
  const dateAdded = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date());
  return {
    id: `base-${application.id}`,
    name: application.name,
    roleInfo: `${application.category} · Екатеринбург`,
    category: categoryFor(application),
    isInitiative: Boolean(application.isInitiative),
    phone: application.phone,
    email: application.email,
    initials: application.initials,
    avatarBg: application.avatarBg,
    description: application.description,
    branch: 'Новое поступление',
    author: application.name,
    dateAdded,
    ...(application.supportInitiativeId ? { supportInitiativeId: application.supportInitiativeId, supportInitiativeTitle: application.supportInitiativeTitle } : {}),
  };
}

function makePasswordHash(password: string, salt = randomBytes(16)): { salt: string; passwordHash: string } {
  return { salt: salt.toString('base64url'), passwordHash: scryptSync(password, salt, 64).toString('hex') };
}

function generatePassword(): string {
  return randomBytes(18).toString('base64url');
}

export function createPlatformApi(env: Environment) {
  return async (request: Request, response: ServerResponse, next: Next) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/platform/')) return next();

    try {
      const method = request.method ?? 'GET';
      const route = url.pathname.slice('/api/platform'.length);

      if (route === '/homepage' && method === 'GET') {
        const [state, initiatives] = await Promise.all([readPlatformState(env), readPublicInitiatives(env)]);
        const featuredInitiatives = state.featuredInitiatives.flatMap((selection) => {
          const initiative = initiatives.find((item) => item.id === selection.initiativeId);
          return initiative ? [{ ...initiative, helpNeeded: selection.helpNeeded }] : [];
        });
        return send(response, 200, { featuredInitiatives });
      }

      if (route === '/homepage' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || (user.role !== 'admin' && user.role !== 'chairman')) return send(response, 403, { error: 'Управлять подборкой может только организатор.' });
        const body = await readBody(request);
        if (!Array.isArray(body.featuredInitiatives) || body.featuredInitiatives.length > 3) return send(response, 400, { error: 'Можно выбрать не больше трёх инициатив.' });
        const selections: FeaturedSelection[] = [];
        for (const value of body.featuredInitiatives) {
          if (!value || typeof value !== 'object' || typeof value.initiativeId !== 'string' || typeof value.helpNeeded !== 'string' || !value.helpNeeded.trim() || value.helpNeeded.length > 240 || selections.some((item) => item.initiativeId === value.initiativeId)) {
            return send(response, 400, { error: 'Выберите разные инициативы и укажите, какая помощь нужна (до 240 символов).' });
          }
          selections.push({ initiativeId: value.initiativeId, helpNeeded: value.helpNeeded.trim() });
        }
        const initiatives = await readPublicInitiatives(env);
        if (selections.some((selection) => !initiatives.some((initiative) => initiative.id === selection.initiativeId))) return send(response, 400, { error: 'В подборку можно добавить только опубликованные инициативы.' });
        await updatePlatformState((state) => ({ state: { ...state, featuredInitiatives: selections }, result: null }), env);
        return send(response, 200, { featuredInitiatives: selections });
      }

      if (route === '/applications' && method === 'POST') {
        const body = await readBody(request);
        const form = normalizeForm(body);
        if (!form) return send(response, 400, { error: 'Проверьте поля заявки и выбранную область помощи.' });
        const supportId = typeof body.supportInitiativeId === 'string' ? body.supportInitiativeId : '';
        const supportedInitiative = supportId ? (await readPublicInitiatives(env)).find((initiative) => initiative.id === supportId) : null;
        if (supportId && (!supportedInitiative || form.isInitiative)) return send(response, 400, { error: 'Инициатива для отклика не найдена. Откройте её заново на главной.' });
        if (supportedInitiative) form.area = supportedInitiative.area;
        const submissionId = body.submissionId;
        if (submissionId !== undefined && (typeof submissionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId))) return send(response, 400, { error: 'Неверный идентификатор заявки. Обновите форму.' });
        const id = `app-${submissionId || randomUUID()}`;
        const app: ApplicationItem = {
          ...form,
          id,
          initials: form.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '??',
          avatarBg: AVATAR_COLORS[randomBytes(1)[0] % AVATAR_COLORS.length],
          actionText: form.isInitiative ? 'Добавить' : form.category.toLocaleLowerCase('ru-RU').includes('партнёр') ? 'В партнёры' : 'В работу',
          status: 'pending',
          ...(supportedInitiative ? { supportInitiativeId: supportedInitiative.id, supportInitiativeTitle: supportedInitiative.title } : {}),
        };
        const result = await updatePlatformState((state) => {
          const existing = state.applications.find((item) => item.id === id);
          return existing ? { state, result: { id: existing.id } } : { state: { ...state, applications: [app, ...state.applications] }, result: app };
        }, env);
        return send(response, 201, result);
      }

      if (route === '/bootstrap' && method === 'GET') {
        const user = await resolveUser(request, env);
        if (!user) return send(response, 401, { error: 'Сеанс завершён. Войдите в кабинет заново.' });
        const state = await readPlatformState(env);
        const isAdmin = user.role === 'admin';
        const isChairman = user.role === 'chairman';
        const accessUsers = isAdmin
          ? state.accounts.map(userSummary)
          : isChairman ? state.accounts.filter((account) => account.role === 'partner').map(userSummary) : [];
        const partnerAccount = state.accounts.find((account) => account.login === user.login);
        const forwardedInitiatives = user.role === 'partner'
          ? state.forwardedInitiatives.filter((initiative) => initiative.partnerId === partnerAccount?.id || (!initiative.partnerId && initiative.partnerName === user.name))
          : isAdmin || isChairman ? state.forwardedInitiatives : [];
        return send(response, 200, {
          applications: isAdmin ? state.applications : [],
          baseMembers: isAdmin || isChairman ? state.baseMembers : [],
          accessUsers,
          forwardedInitiatives,
          featuredInitiatives: isAdmin || isChairman ? state.featuredInitiatives : [],
        });
      }

      if (route === '/applications/status' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || user.role !== 'admin') return send(response, 403, { error: 'Это действие доступно только администратору.' });
        const body = await readBody(request);
        const id = typeof body.id === 'string' ? body.id : '';
        const status = body.status;
        if (!id || (status !== 'accepted' && status !== 'rejected')) return send(response, 400, { error: 'Неверный статус заявки.' });
        const nextStatus: ApplicationItem['status'] = status;
        const existing = (await readPlatformState(env)).applications.find((item) => item.id === id);
        if (!existing) return send(response, 404, { error: 'Заявка не найдена.' });
        if (existing.status !== 'pending' && existing.status !== status) return send(response, 409, { error: 'Эта заявка уже обработана. Обновите страницу.' });
        if (status === 'accepted' && existing.isInitiative) {
          const firstLine = existing.description.split(/[.!?\n]/, 1)[0]?.trim() || 'Новая инициатива';
          await savePublicInitiative({
            id: existing.id, title: firstLine.length > 64 ? `${firstLine.slice(0, 61).trimEnd()}…` : firstLine,
            description: existing.description,
            area: AREAS.has(existing.area || '') ? existing.area as 'Мероприятия' | 'Медиа' | 'IT' | 'Волонтёрство' : 'Мероприятия',
            author: existing.name, publishedAt: new Date().toISOString(),
          }, env);
        }
        const result = await updatePlatformState<{ application: ApplicationItem | null; member: BaseMember | null } | null>((state) => {
          const target = state.applications.find((item) => item.id === id);
          if (!target) return { state, result: null };
          if (target.status !== 'pending' && target.status !== nextStatus) throw new Error('Application status changed concurrently');
          const applications = state.applications.map((item) => item.id === id ? { ...item, status: nextStatus } : item);
          const alreadyInBase = state.baseMembers.some((item) => item.id === `base-${target.id}`);
          const baseMembers = status === 'accepted' && !alreadyInBase
            ? [buildMember(target), ...state.baseMembers]
            : state.baseMembers;
          return {
            state: { ...state, applications, baseMembers },
            result: { application: applications.find((item) => item.id === id) ?? null, member: baseMembers.find((item) => item.id === `base-${target.id}`) ?? null },
          };
        }, env);
        if (!result?.application) return send(response, 404, { error: 'Заявка не найдена.' });
        return send(response, 200, result);
      }

      if (route === '/users' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || user.role !== 'admin') return send(response, 403, { error: 'Это действие доступно только администратору.' });
        const body = await readBody(request);
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
        const roleInfo = typeof body.roleInfo === 'string' ? body.roleInfo.trim().slice(0, 160) : '';
        const login = typeof body.login === 'string' ? body.login.trim().slice(0, 80) : '';
        const branch = typeof body.branch === 'string' ? body.branch.trim().slice(0, 160) : '';
        const password = typeof body.password === 'string' ? body.password : '';
        if (!name || !roleInfo || !login || password.length < 10) return send(response, 400, { error: 'Укажите имя, роль, логин и пароль длиной не менее 10 символов.' });
        if (login.toLocaleLowerCase('ru-RU') === env.AUTH_USERNAME?.trim().toLocaleLowerCase('ru-RU')) return send(response, 409, { error: 'Этот логин уже используется администратором.' });
        const account = await updatePlatformState((state) => {
          if (state.accounts.some((item) => item.login.toLocaleLowerCase('ru-RU') === login.toLocaleLowerCase('ru-RU') || (validRoleInfo(roleInfo) === 'partner' && item.role === 'partner' && item.name.toLocaleLowerCase('ru-RU') === name.toLocaleLowerCase('ru-RU')))) {
            return { state, result: null };
          }
          const salt = randomBytes(16);
          const role = validRoleInfo(roleInfo);
          const account: StoredAccount = {
            id: `usr-${randomUUID()}`, name, roleInfo, login, branch,
            initials: name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '??',
            avatarBg: AVATAR_COLORS[randomBytes(1)[0] % AVATAR_COLORS.length],
            role,
            ...makePasswordHash(password, salt),
          };
          return { state: { ...state, accounts: [account, ...state.accounts] }, result: account };
        }, env);
        if (!account) return send(response, 409, { error: 'Такой логин уже используется. Для партнёра также должно быть уникальным имя.' });
        return send(response, 201, { user: { ...userSummary(account), password }, generated: false });
      }

      if (route === '/users/reset-password' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || user.role !== 'admin') return send(response, 403, { error: 'Это действие доступно только администратору.' });
        const body = await readBody(request);
        const id = typeof body.id === 'string' ? body.id : '';
        const password = generatePassword();
        const account = await updatePlatformState((state) => {
          const target = state.accounts.find((item) => item.id === id);
          if (!target) return { state, result: null };
          const hash = makePasswordHash(password);
          const updated = { ...target, ...hash };
          return { state: { ...state, accounts: state.accounts.map((item) => item.id === id ? updated : item) }, result: updated };
        }, env);
        if (!account) return send(response, 404, { error: 'Пользователь не найден.' });
        return send(response, 200, { user: { ...userSummary(account), password } });
      }

      if (route === '/forwarded-initiatives' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || (user.role !== 'admin' && user.role !== 'chairman')) return send(response, 403, { error: 'Это действие доступно только организатору.' });
        const body = await readBody(request);
        const supplied = body.initiative && typeof body.initiative === 'object' ? body.initiative as Record<string, unknown> : {};
        const partnerName = typeof supplied.partnerName === 'string' ? supplied.partnerName.trim() : '';
        const title = typeof supplied.title === 'string' ? supplied.title.trim().slice(0, 160) : '';
        const description = typeof supplied.description === 'string' ? supplied.description.trim().slice(0, 5000) : '';
        const area = typeof supplied.area === 'string' ? supplied.area.trim().slice(0, 80) : '';
        const authorName = typeof supplied.authorName === 'string' ? supplied.authorName.trim().slice(0, 120) : '';
        const authorPhone = typeof supplied.authorPhone === 'string' ? supplied.authorPhone.trim().slice(0, 40) : '';
        const authorEmail = typeof supplied.authorEmail === 'string' ? supplied.authorEmail.trim().slice(0, 160) : '';
        if (!partnerName || !title || !description || !authorName) return send(response, 400, { error: 'Проверьте выбранного партнёра и данные инициативы.' });
        const forwarded = await updatePlatformState((state) => {
          const partner = state.accounts.find((account) => account.role === 'partner' && account.name === partnerName);
          if (!partner) return { state, result: null };
          const initiative: ForwardedInitiative = {
            id: `fwd-${randomUUID()}`, title, description, area, authorName, authorPhone, authorEmail,
            senderName: user.name,
            senderRole: user.role === 'admin' ? 'Администратор' : 'Председатель',
            senderNote: typeof supplied.senderNote === 'string' ? supplied.senderNote.trim().slice(0, 1000) || undefined : undefined,
            sentDate: new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date()),
            status: 'new', partnerName, partnerId: partner.id,
          };
          return { state: { ...state, forwardedInitiatives: [initiative, ...state.forwardedInitiatives] }, result: initiative };
        }, env);
        if (!forwarded) return send(response, 404, { error: 'Партнёр не найден.' });
        return send(response, 201, forwarded);
      }

      if (route === '/partner-inbox/status' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || user.role !== 'partner') return send(response, 403, { error: 'Это действие доступно только партнёру.' });
        const body = await readBody(request);
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) return send(response, 400, { error: 'Не указана инициатива.' });
        const result = await updatePlatformState((state) => {
          const account = state.accounts.find((item) => item.login === user.login);
          const found = state.forwardedInitiatives.some((item) => item.id === id && (item.partnerId === account?.id || (!item.partnerId && item.partnerName === user.name)));
          if (!found) return { state, result: false };
          return {
            state: { ...state, forwardedInitiatives: state.forwardedInitiatives.map((item) => item.id === id && (item.partnerId === account?.id || (!item.partnerId && item.partnerName === user.name)) ? { ...item, status: 'supported' } : item) },
            result: true,
          };
        }, env);
        return result ? send(response, 200, { ok: true }) : send(response, 404, { error: 'Инициатива не найдена.' });
      }

      response.setHeader('Allow', 'GET, POST');
      return send(response, 404, { error: 'Not found' });
    } catch (error) {
      if (error instanceof Error && error.message === 'Request body too large') return send(response, 413, { error: 'Заявка слишком большая. Сократите описание.' });
      if (error instanceof Error && error.message === 'Invalid request body') return send(response, 400, { error: 'Неверный формат запроса.' });
      // Keep personal data out of platform logs; record only the failure class.
      console.error('Platform API failed:', error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 240) }
        : 'UnknownError');
      return send(response, 503, { error: 'Сервис временно недоступен. Проверьте подключение хранилища.' });
    }
  };
}
