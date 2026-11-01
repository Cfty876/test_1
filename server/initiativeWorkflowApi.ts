import { imageFormat } from './imageFormat.ts';
import { getSnapshot, saveSnapshot, snapshotNotModified } from './snapshotCache.ts';
import { validDateRange } from '../src/utils/memberHub.ts';
import { createSessionUser, getSessionVersion } from './authApi.ts';
import { canOverseeImplementations, canManageImplementation } from '../src/utils/permissions.ts';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { UserSession } from '../src/utils/auth.ts';
import { COUNCIL_STATUSES, type CouncilStatus, type Implementation, type PlatformNotification } from '../src/utils/implementations.ts';
import { readPlatformState, updatePlatformState, type PlatformState } from './platformStore.ts';
import { readPublishedInitiatives } from './initiativeProjection.ts';
import { savePhoto, loadPhoto, removePhoto } from './implementationPhotos.ts';

type Environment = Record<string, string | undefined>;
type Request = IncomingMessage & { body?: unknown };
interface Helpers {
  readBody: (request: Request) => Promise<Record<string, unknown>>;
  resolveUser: (request: Request, env: Environment) => Promise<UserSession | null>;
  send: (response: ServerResponse, status: number, payload: unknown) => void;
}
function notify(state: PlatformState, implementation: Implementation, audience: PlatformNotification['audience'], message: string): PlatformState {
  const notification: PlatformNotification = { id: randomUUID(), audience, recipient: audience === 'author' ? implementation.initiativeId : audience === 'user' ? implementation.ownerLogin : 'admin', initiativeId: implementation.initiativeId, implementationId: implementation.id, message, createdAt: new Date().toISOString() };
  return { ...state, notifications: [notification, ...state.notifications] };
}
function changed(state: PlatformState, implementation: Implementation): PlatformState { return { ...state, implementations: state.implementations.map((item) => item.id === implementation.id ? implementation : item) }; }
function notifyParticipants(state: PlatformState, implementation: Implementation, message: string): PlatformState {
  const updates = state.applications.filter((item) => item.supportImplementationId === implementation.id && !['rejected','withdrawn'].includes(item.status)).map((item): PlatformNotification => ({ id: randomUUID(), audience: 'author', recipient: item.id, initiativeId: implementation.initiativeId, implementationId: implementation.id, message, createdAt: new Date().toISOString() }));
  return { ...state, notifications: [...updates, ...state.notifications] };
}
function currentActor(user: UserSession, state: PlatformState, sessionVersion: string | undefined): UserSession | null {
  if (user.role === 'admin') return user;
  const account = state.accounts.find(item => item.login === user.login && item.role === 'chairman' && item.salt === sessionVersion);
  return account ? createSessionUser(account.login,account.name,account.role,account) : null;
}
function owns(user: UserSession, implementation: Implementation): boolean { return implementation.ownerLogin === user.login; }
function cityPermission(user: UserSession, state: PlatformState): boolean { return user.role === 'admin' || state.accounts.some((item) => item.login === user.login && item.role === 'chairman' ); }
function signature(value: string, env: Environment): string {
  if (!env.AUTH_SESSION_SECRET) throw new Error('Session secret is required');
  return createHmac('sha256', env.AUTH_SESSION_SECRET).update(`initiative-like:${value}`).digest('hex');
}
function voter(request: Request, env: Environment): string | null {
  const cookie = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('pervik_voter='))?.slice('pervik_voter='.length);
  if (!cookie) return null;
  const [id, proof] = cookie.split('.');
  if (!/^[a-f0-9]{64}$/.test(id || '') || !/^[a-f0-9]{64}$/.test(proof || '')) return null;
  return timingSafeEqual(Buffer.from(proof), Buffer.from(signature(id, env))) ? signature(`voter:${id}`, env) : null;
}
async function photoBody(request: Request): Promise<Buffer> {
  const maximum = 3 * 1024 * 1024;
  if (Number(request.headers['content-length']) > maximum) throw new Error('PHOTO_TOO_LARGE');
  if (Buffer.isBuffer(request.body)) { if (request.body.length > maximum) throw new Error('PHOTO_TOO_LARGE'); return request.body; }
  if (request.body !== undefined) throw new Error('PHOTO_INVALID');
  const chunks: Buffer[] = []; let size = 0;
  for await (const value of request) { const chunk = Buffer.from(value); size += chunk.length; if (size > maximum) throw new Error('PHOTO_TOO_LARGE'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

const ROUTES = new Set(['/public-home', '/initiative-community', '/initiative-like', '/implementation-propose', '/implementation-manage', '/implementation-report', '/implementation-review', '/implementation-photo', '/implementation-photo-remove', '/council-access']);

export async function handleInitiativeWorkflow(request: Request, response: ServerResponse, env: Environment, helpers: Helpers): Promise<boolean> {
  const url = new URL(request.url || '/', 'http://localhost'); const route = url.pathname.slice('/api/platform'.length);
  if (!ROUTES.has(route)) return false;
  const { readBody, resolveUser, send } = helpers;
  const reply = (status: number, payload: unknown) => { send(response, status, payload); return true; };
  if (route === '/public-home' && request.method === 'GET') {
    const state = await readPlatformState(env);
    const hash = voter(request, env);
    const cacheKey = `public:${hash || ''}`;
    const initiatives = await readPublishedInitiatives(env, state);
    if (snapshotNotModified(state, cacheKey, response, initiatives)) return true;
    const cached = getSnapshot<{ initiatives: unknown }>(state, cacheKey); if (cached && cached.initiatives === initiatives) return reply(200, cached);
    const byId = new Map(initiatives.map(initiative => [initiative.id, initiative]));
    const featuredInitiatives = state.featuredInitiatives.flatMap(selection => {
      const initiative = byId.get(selection.initiativeId);
      return initiative ? [{ ...initiative, helpNeeded: selection.helpNeeded }] : [];
    });
    const likedIds = hash ? state.initiativeLikes.filter(like => like.voterHash === hash && byId.has(like.initiativeId)).map(like => like.initiativeId) : [];
    // Only the established public projection and this browser's liked IDs leave the server.
    return reply(200, saveSnapshot(state, cacheKey, { initiatives, featuredInitiatives, likedIds }));
  }
  if (route === '/initiative-community' && request.method === 'GET') {
    const state = await readPlatformState(env); const hash = voter(request, env);
    return reply(200, { likedIds: hash ? state.initiativeLikes.filter((item) => item.voterHash === hash).map((item) => item.initiativeId) : [] });
  }
  if (route === '/initiative-like' && request.method === 'POST') {
    const body = await readBody(request);
    if (typeof body.initiativeId !== 'string' || typeof body.liked !== 'boolean') return reply(400, { error: 'Не указана инициатива или действие.' });
    if (!(await readPublishedInitiatives(env)).some((item) => item.id === body.initiativeId)) return reply(404, { error: 'Инициатива не найдена.' });
    let hash = voter(request, env);
    if (!hash) { const id = randomBytes(32).toString('hex'); hash = signature(`voter:${id}`, env); response.setHeader('Set-Cookie', `pervik_voter=${id}.${signature(id, env)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${env.VERCEL === '1' || env.AUTH_COOKIE_SECURE === 'true' ? '; Secure' : ''}`); }
    const voterHash = hash; const initiativeId = body.initiativeId; const liked = body.liked;
    const count = await updatePlatformState((state) => {
      const existing = state.initiativeLikes.filter((item) => item.initiativeId !== initiativeId || item.voterHash !== voterHash);
      const likes = liked ? [...existing, { initiativeId, voterHash }] : existing;
      return { state: { ...state, initiativeLikes: likes }, result: likes.filter((item) => item.initiativeId === initiativeId).length };
    }, env);
    return reply(200, { initiativeId, liked, count });
  }
  const user = await resolveUser(request, env);
  if (!user) return reply(401, { error: 'Войдите в кабинет, чтобы продолжить.' });
  if (user.role !== 'admin' && user.role !== 'chairman') return reply(403, { error: 'Реализация инициатив доступна председателям и администратору.' });

  if (route === '/implementation-photo' && request.method === 'GET') {
    const state = await readPlatformState(env); const photo = state.implementationPhotos.find((item) => item.id === url.searchParams.get('id'));
    const implementation = photo && state.implementations.find((item) => item.id === photo.implementationId);
    if (!photo || !implementation || (!canOverseeImplementations(currentActor(user, state, getSessionVersion(request, env)) || { role: 'chairman' }) && !owns(user, implementation))) return reply(404, { error: 'Фотография не найдена.' });
    const buffer = await loadPhoto(photo.storageKey, env);
    response.statusCode = 200; response.setHeader('Content-Type', photo.contentType); response.setHeader('Cache-Control', 'private, no-store'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Content-Disposition', 'inline'); response.end(buffer); return true;
  }
  if (request.method !== 'POST') { response.setHeader('Allow', route === '/implementation-photo' ? 'GET, POST' : 'POST'); return reply(405, { error: 'Метод не поддерживается.' }); }

  if (route === '/implementation-photo') {
    const id = request.headers['x-implementation-id'];
    const state = await readPlatformState(env); const implementation = state.implementations.find((item) => item.id === id);
    if (!implementation || !owns(user, implementation)) return reply(404, { error: 'Реализация не найдена.' });
    if (!['active','changes_requested'].includes(implementation.status)) return reply(409, { error: 'Фото можно добавлять при подготовке или доработке отчёта.' });
    if (state.implementationPhotos.filter((item) => item.implementationId === id && !item.hiddenFromDraft).length >= 8) return reply(400, { error: 'Можно загрузить не больше 8 фотографий. Удалите лишние.' });
    let buffer: Buffer;
    try { buffer = await photoBody(request); } catch (error) { return reply(error instanceof Error && error.message === 'PHOTO_TOO_LARGE' ? 413 : 400, { error: 'Выберите фотографию JPG, PNG или WebP размером до 3 МБ.' }); }
    const format = imageFormat(buffer); if (!format) return reply(400, { error: 'Выберите JPG, PNG или WebP: до 20 мегапикселей и 8192 пикселей по стороне.' });
    const photoId = randomUUID(); const storageKey = `${photoId}.${format.extension}`;
    await savePhoto(storageKey, buffer, format.type, env);
    try {
      const saved = await updatePlatformState((current) => {
        const target = current.implementations.find((item) => item.id === id);
        if (!target || !owns(user, target) || !['active','changes_requested'].includes(target.status) || current.implementationPhotos.filter((item) => item.implementationId === id && !item.hiddenFromDraft).length >= 8) return { state: current, result: false };
        const photo = { id: photoId, implementationId: target.id, ownerLogin: user.login, storageKey, contentType: format.type, size: buffer.length, createdAt: new Date().toISOString() };
        return { state: { ...current, implementationPhotos: [...current.implementationPhotos, photo] }, result: true };
      }, env);
      if (!saved) { await removePhoto(storageKey, env); return reply(409, { error: 'Состояние отчёта изменилось. Обновите кабинет.' }); }
    } catch (error) { await removePhoto(storageKey, env).catch(() => undefined); throw error; }
    return reply(201, { id: photoId, implementationId: implementation.id, contentType: format.type, size: buffer.length, createdAt: new Date().toISOString() });
  }

  const body = await readBody(request);
  if (route === '/council-access') {
    if (user.role !== 'admin') return reply(403, { error: 'Статус Совета назначает только главный администратор.' });
    if (body.councilStatus !== null && !COUNCIL_STATUSES.includes(body.councilStatus as CouncilStatus)) return reply(400, { error: 'Выберите статус Совета.' });
    if (typeof body.branch !== 'string' || body.branch.trim().length > 160) return reply(400, { error: 'Укажите корректное название школы.' });
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120)) return reply(400, { error: 'Укажите ФИО: от 2 до 120 символов.' });
    if (body.staffRole !== undefined && !['Председатель', 'Куратор района'].includes(String(body.staffRole))) return reply(400, { error: 'Выберите тип доступа.' });
    const result = await updatePlatformState((state) => {
      const account = state.accounts.find((item) => item.id === body.id && item.role === 'chairman');
      if (!account) return { state, result: null };
      if (body.version !== (account.accessVersion || 1)) throw new Error('ACCESS_CONFLICT');
      const name = typeof body.name === 'string' ? body.name.trim() : account.name;
      const updated = { ...account, name, initials: name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(), roleInfo: (typeof body.staffRole === 'string' ? body.staffRole : account.roleInfo.split('·')[0].trim()) + ((body.branch as string).trim() ? ` · ${(body.branch as string).trim()}` : ''), accessVersion: (account.accessVersion || 1) + 1, branch: (body.branch as string).trim(), councilStatus: body.councilStatus ? body.councilStatus as CouncilStatus : undefined };
      const { salt: _salt, passwordHash: _password, ...summary } = updated;
      return { state: { ...state, accounts: state.accounts.map((item) => item.id === account.id ? updated : item), implementations: state.implementations.map(item=>item.ownerLogin===account.login?{...item,ownerName:updated.name,councilStatus:updated.councilStatus,version:item.version+1,updatedAt:new Date().toISOString()}:item), notifications: [{ id: randomUUID(), audience: 'user', recipient: account.login, initiativeId: '', implementationId: '', message: `Ваши права обновлены. Должность: ${updated.councilStatus || 'проекты своей школы'}. Школа: ${updated.branch || 'не указана'}.`, createdAt: new Date().toISOString() }, ...state.notifications] }, result: summary };
    }, env);
    return result ? reply(200, { user: result }) : reply(404, { error: 'Учётная запись председателя не найдена.' });
  }
  if (route === '/implementation-propose') {
    const state = await readPlatformState(env); const account = state.accounts.find((item) => item.login === user.login);
    const scope = body.scope; const plan = typeof body.plan === 'string' ? body.plan.trim() : '';
    if ((!['school','district','city'].includes(String(scope))) || plan.length < 20 || plan.length > 3000) return reply(400, { error: 'Выберите формат и опишите план реализации (20–3000 символов).' });
    if (scope === 'city' && !cityPermission(user, state)) return reply(403, { error: 'Для городской реализации нужен статус Совета, назначенный администратором.' });
    if (!validDateRange(body.startDate, body.endDate)) return reply(400, { error: 'Укажите дату начала и окончания проекта. Для одного дня выберите одинаковые даты.' });
    const district = typeof body.district === 'string' ? body.district.trim() : '';
    if (scope === 'district' && (district.length < 3 || district.length > 160)) return reply(400, { error: 'Укажите район проведения.' });
    const organization = scope === 'city' ? 'Екатеринбург' : scope === 'district' ? district : account?.branch?.trim() || '';
    if (!organization) return reply(400, { error: 'Администратору нужно указать вашу школу в настройках доступа.' });
    const initiative = (await readPublishedInitiatives(env, state)).find((item) => item.id === body.initiativeId);
    if (!initiative) return reply(404, { error: 'Опубликованная инициатива не найдена.' });
    const implementation: Implementation = { id: `impl-${randomUUID()}`, initiativeId: initiative.id, initiativeTitle: initiative.title, scope: scope as Implementation['scope'], organization, startDate: body.startDate as string, endDate: body.endDate as string, district: scope === 'district' ? district : undefined, ownerLogin: user.login, ownerName: user.name, councilStatus: account?.councilStatus, plan, status: 'proposed', activistSlots: 0, volunteerSlots: 0, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const saved = await updatePlatformState((current) => {
      if (!currentActor(user,current,getSessionVersion(request,env))) throw new Error('WORKFLOW_PERMISSION');
      if (scope === 'city' && !cityPermission(user, current)) throw new Error('WORKFLOW_PERMISSION');
      if (scope === 'school' && !current.accounts.some((item) => item.login === user.login && item.role === 'chairman' && item.branch?.trim() === organization)) throw new Error('WORKFLOW_PERMISSION');
      const duplicate = current.implementations.find((item) => item.initiativeId === initiative.id && item.scope === scope && item.organization.toLocaleLowerCase('ru') === organization.toLocaleLowerCase('ru') && !['completed','cancelled'].includes(item.status));
      if (duplicate) return { state: current, result: duplicate.ownerLogin === user.login && duplicate.plan === plan ? duplicate : null };
      let next: PlatformState = { ...current, implementations: [implementation, ...current.implementations] };
      next = notify(next, implementation, 'author', `${user.name} предлагает реализовать инициативу: ${scope === 'city' ? 'на уровне города' : organization}.`);
      next = notify(next, implementation, 'admin', `${user.name}: новая реализация «${initiative.title}» — ${organization}.`);
      return { state: next, result: implementation };
    }, env);
    return saved ? reply(201, { implementation: saved }) : reply(409, { error: 'Для этой школы или города уже есть действующая реализация инициативы.' });
  }

  if (route === '/implementation-photo-remove') {
    const removed = await updatePlatformState((state) => {
      const photo = state.implementationPhotos.find((item) => item.id === body.id);
      const target = photo && state.implementations.find((item) => item.id === photo.implementationId);
      if (!photo || !target || !owns(user, target) || !['active','changes_requested'].includes(target.status)) return { state, result: null };
      if (target.report?.photoIds.includes(photo.id) || target.reportHistory?.some((report) => report.photoIds.includes(photo.id))) return { state: { ...state, implementationPhotos: state.implementationPhotos.map((item) => item.id === photo.id ? { ...item, hiddenFromDraft: true } : item) }, result: { ...photo, hiddenFromDraft: true } };
      return { state: { ...state, implementationPhotos: state.implementationPhotos.filter((item) => item.id !== photo.id) }, result: photo };
    }, env);
    if (!removed) return reply(409, { error: 'Фотографию нельзя удалить после передачи отчёта на проверку.' });
    if (!removed.hiddenFromDraft) await removePhoto(removed.storageKey, env).catch(() => undefined); return reply(200, { ok: true });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const result = await updatePlatformState<{ status: number; error?: string; implementation?: Implementation }>((state) => {
    const target = state.implementations.find((item) => item.id === id);
    const actor = currentActor(user, state, getSessionVersion(request, env));
    if (!target || !actor || (!owns(actor, target) && !canOverseeImplementations(actor))) return { state, result: { status: 404, error: 'Реализация не найдена.' } };
    if (body.version !== target.version) return { state, result: { status: 409, error: 'Реализация уже изменилась. Обновите данные перед действием.' } };
    let updated: Implementation = { ...target, version: target.version + 1, updatedAt: new Date().toISOString() }; let next = state;
    if (route === '/implementation-manage') {
      if (!canManageImplementation(actor, target)) return { state, result: { status: 403, error: 'Запуск подтверждают ответственный, председатель городского Совета или администратор.' } };
      if (!['proposed','active'].includes(target.status) || (body.status !== 'active' && body.status !== 'cancelled')) return { state, result: { status: 409, error: 'Недоступный переход статуса.' } };
      if (!validDateRange(body.startDate, body.endDate)) return { state, result: { status: 400, error: 'Укажите корректные даты проведения проекта.' } };
      const activistSlots = Number(body.activistSlots), volunteerSlots = Number(body.volunteerSlots);
      if (![activistSlots,volunteerSlots].every((number) => Number.isInteger(number) && number >= 0 && number <= 500)) return { state, result: { status: 400, error: 'Укажите от 0 до 500 мест каждого типа.' } };
      const accepted = state.applications.filter((app) => app.supportImplementationId === id && app.status === 'accepted');
      if (activistSlots < accepted.filter((app) => app.participationRole === 'activist').length || volunteerSlots < accepted.filter((app) => app.participationRole === 'volunteer').length) return { state, result: { status: 409, error: 'Количество мест не может быть меньше уже принятых участников.' } };
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (note.length > 1000) return { state, result: { status: 400, error: 'Комментарий должен быть не длиннее 1000 символов.' } };
      if (body.status === 'cancelled' && (note.length < 10 || note.length > 1000)) return { state, result: { status: 400, error: 'Укажите причину отмены (10–1000 символов).' } };
      if (body.status === 'active' && target.scope === 'city' && !state.accounts.some((account) => account.login === target.ownerLogin && account.role === 'chairman') && !(target.ownerLogin === env.AUTH_USERNAME?.trim() && env.AUTH_ROLE?.trim() === 'admin')) return { state, result: { status: 403, error: 'Учётная запись ответственного больше недоступна.' } };
      updated = { ...updated, startDate: body.startDate as string, endDate: body.endDate as string, approvedBy: body.status === 'active' && target.status === 'proposed' ? { login: user.login, name: user.name, at: updated.updatedAt } : target.approvedBy, status: body.status, activistSlots, volunteerSlots, reviewNote: note || undefined };
      next = changed(next, updated);
      const message = body.status === 'active' ? `${target.ownerName} реализует инициативу: ${target.organization}. Набор: активисты — ${activistSlots}, волонтёры — ${volunteerSlots}.` : `Реализация в ${target.organization} отменена. ${note}`;
      next = notify(next, updated, 'author', message); next = notify(next, updated, 'user', message);
      next = notify(next, updated, 'admin', `${user.name}: ${message}`);
      if (body.status === 'cancelled') next = notifyParticipants(next, updated, message);
    } else if (route === '/implementation-report') {
      if (!owns(user, target) || !['active','changes_requested'].includes(target.status)) return { state, result: { status: 403, error: 'Отчёт может отправить ответственный за действующую реализацию.' } };
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const links = Array.isArray(body.links) ? body.links : []; const photoIds = Array.isArray(body.photoIds) ? body.photoIds : [];
      const validLinks = links.length >= 1 && links.length <= 10 && new Set(links).size === links.length && links.every((value) => { try { const link = new URL(value); return typeof value === 'string' && value.length <= 1000 && link.protocol === 'https:' && !link.username && !link.password; } catch { return false; } });
      const validPhotos = photoIds.length >= 1 && photoIds.length <= 8 && new Set(photoIds).size === photoIds.length && photoIds.every((photoId) => state.implementationPhotos.some((photo) => photo.id === photoId && photo.implementationId === id && photo.ownerLogin === user.login && !photo.hiddenFromDraft));
      const eventDate = typeof body.eventDate === 'string' ? body.eventDate : '';
      if (description.length < 30 || description.length > 5000 || !validLinks || !validPhotos || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate)) || new Date(eventDate).toISOString().slice(0,10) !== eventDate || eventDate > new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yekaterinburg', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date())) return { state, result: { status: 400, error: 'Добавьте описание (30–5000 символов), дату проведения, 1–8 фотографий и 1–10 разных HTTPS-ссылок на публикации.' } };
      updated = { ...updated, status: 'report_pending', report: { description, links: links as string[], photoIds: photoIds as string[], eventDate, submittedAt: new Date().toISOString() }, reportHistory: target.report ? [...(target.reportHistory || []), { ...target.report, reviewNote: target.reviewNote }] : target.reportHistory, reviewNote: undefined };
      next = notify(changed(next, updated), updated, 'admin', `${target.ownerName} отправил фотоотчёт: «${target.initiativeTitle}», ${target.organization}.`);
      next = notify(next, updated, 'author', `Реализация «${target.organization}» проведена. Отчёт передан администратору и председателю городского Совета на проверку.`);
    } else if (route === '/implementation-review') {
      if (!canOverseeImplementations(actor)) return { state, result: { status: 403, error: 'Результат проверяют администратор и председатель городского Совета.' } };
      const decision = body.decision; const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (target.status !== 'report_pending' || (decision !== 'completed' && decision !== 'changes_requested')) return { state, result: { status: 409, error: 'Отчёт уже обработан или ещё не отправлен.' } };
      if (note.length > 1000 || (decision === 'changes_requested' && note.length < 10)) return { state, result: { status: 400, error: 'Объясните, что нужно доработать (10–1000 символов).' } };
      updated = { ...updated, reviewedBy: { login: user.login, name: user.name, at: updated.updatedAt }, status: decision, reviewNote: note || undefined };
      const message = decision === 'completed' ? `Реализация в ${target.organization} подтверждена: ${user.name}. Спасибо команде!` : `Фотоотчёт по ${target.organization} нужно доработать: ${note}`;
      next = notify(changed(next, updated), updated, 'user', message); next = notify(next, updated, 'author', message);
      next = notify(next, updated, 'admin', `${user.name}: ${message}`);
      if (decision === 'completed') next = notifyParticipants(next, updated, message);
    } else return { state, result: { status: 404, error: 'Действие не найдено.' } };
    return { state: next, result: { status: 200, implementation: updated } };
  }, env);
  return reply(result.status, result.error ? { error: result.error } : { implementation: result.implementation });
}
