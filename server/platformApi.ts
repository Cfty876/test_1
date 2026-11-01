import { INITIATIVE_DIRECTIONS, isInitiativeDirection, directionCover } from '../src/utils/initiativeDirections.ts';
import { getSnapshot, saveSnapshot, snapshotNotModified } from './snapshotCache.ts';
import { sendJson, readJsonBody } from './httpSupport.ts';
import { makePasswordHash } from './passwords.ts';
import { hasAdminSession } from './authApi.ts';
import { guardMaintenance, sendMaintenance } from './maintenance.ts';
import { withMaintenanceAccess, MaintenanceModeError } from './maintenanceContext.ts';
import { DEFAULT_MAINTENANCE, type MaintenanceSettings } from '../src/utils/siteStatus.ts';
import { hasPrivacyAcknowledgement, PRIVACY_VERSION, PRIVACY_ACKNOWLEDGEMENT_ERROR } from '../src/utils/legal.ts';
import { handleProfile } from './profileApi.ts';
import { handleMemberHub } from './memberHubApi.ts';
import { APPLICATION_CATEGORIES } from '../src/utils/participationCategories.ts';
import { isInitiativeCoverId, initiativeCover } from '../src/utils/initiativeCovers.ts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApplicationItem, AccessUser, BaseMember } from '../src/components/DashboardView.tsx';
import type { Role } from '../src/utils/auth.ts';
import { createSessionUser, getConfiguredUser, getSessionSubject, getSessionVersion } from './authApi.ts';
import { readPlatformState, updatePlatformState, type StoredAccount, type StoredApplication } from './platformStore.ts';
import type { ApplicationEvent, TrackedApplication } from '../src/utils/applicationJourney.ts';
import { handleInitiativeWorkflow } from './initiativeWorkflowApi.ts';
import type { PlatformNotification } from '../src/utils/implementations.ts';
import { readPublishedInitiatives } from './initiativeProjection.ts';
import type { FeaturedSelection } from '../src/utils/homepage.ts';
import { generateWordPassword, issueAccessCredentials, readAccessCredentials } from './accessCredentials.ts';
import { canManageHomepage, canReviewAllApplications, canOverseeImplementations, isSchoolMember } from '../src/utils/permissions.ts';
import { normalizeVkUrl } from '../src/utils/contactFields.ts';

type Environment = Record<string, string | undefined>;
type Request = IncomingMessage & { url?: string; method?: string; body?: unknown };
type Next = () => void;
const AVATAR_COLORS = ['#FEE2E2', '#E0E7FF', '#FEF3C7', '#DCFCE7', '#F3E8FF', '#CFFAFE'];
const AREAS = new Set(['Мероприятия', 'Медиа', 'IT', 'Волонтёрство']);

function applicationSummary(application: StoredApplication): ApplicationItem {
  const { trackingCodeHash: _hash, ...summary } = application;
  return summary;
}
function trackingHash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
function trackedSummary(application: StoredApplication, notifications: PlatformNotification[] = []): TrackedApplication {
  return {
    id: application.id, status: application.status, category: application.category, direction: application.direction,
    area: application.area || 'Мероприятия', description: application.description,
    helpAreas: application.helpAreas || [application.area || 'Мероприятия'],
    isInitiative: Boolean(application.isInitiative), version: application.version || 1,
    createdAt: application.createdAt, updatedAt: application.updatedAt, history: application.history || [],
    updates: notifications.filter((item) => item.audience === 'author' && item.recipient === application.id),
  };
}
function journeyEvent(status: ApplicationItem['status'], actor: ApplicationEvent['actor'], message: string): ApplicationEvent {
  return { id: randomUUID(), at: new Date().toISOString(), status, actor, message };
}

const send = sendJson;
const readBody = (request: Request) => readJsonBody(request, 32_768);

async function resolveUser(request: Request, env: Environment) {
  const subject = getSessionSubject(request, env);
  if (!subject) return null;
  const version = getSessionVersion(request, env);
  const bootstrapUser = getConfiguredUser(env);
  if (bootstrapUser?.login === subject) return version === env.AUTH_PASSWORD_SALT?.trim() ? bootstrapUser : null;
  const state = await readPlatformState(env);
  const account = state.accounts.find((item) => item.login === subject);
  return account && version === account.salt ? createSessionUser(account.login, account.name, account.role, account) : null;
}

function userSummary(account: StoredAccount): AccessUser {
  const { salt: _salt, passwordHash: _hash, ...publicUser } = account;
  return { ...publicUser, accessVersion: account.accessVersion || 1, credentialVersion: account.credentialVersion || 1 };
}

function validRoleInfo(): Exclude<Role, 'admin'> {
  return 'chairman';
}

function normalizeForm(body: Record<string, unknown>): Omit<ApplicationItem, 'id' | 'initials' | 'avatarBg' | 'actionText' | 'status'> | null {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 160) : '';
  if (body.vkUrl !== undefined && typeof body.vkUrl !== 'string') return null;
  const vkUrl = normalizeVkUrl(typeof body.vkUrl === 'string' ? body.vkUrl : '');
  if (vkUrl === null) return null;
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '';
  const category = typeof body.category === 'string' ? body.category.trim().slice(0, 120) : '';
  const customCategoryText = typeof body.customCategoryText === 'string' ? body.customCategoryText.trim().slice(0, 120) : '';
  const isInitiative = category === 'Есть своя инициатива';
  if (isInitiative && !isInitiativeDirection(body.direction)) return null;
  const selectedArea = isInitiative ? INITIATIVE_DIRECTIONS.find(item => item.id === body.direction)!.area : typeof body.helpArea === 'string' ? body.helpArea : '';
  const isCustom = category.includes('Свой вариант');
  const area = isInitiative || isCustom || category === 'Хочу помочь инициативе' || category === 'Хочу быть активистом' ? selectedArea
    : category.includes('Медиа') ? 'Медиа' : category.includes('IT') ? 'IT' : category.includes('Волонтёр') ? 'Волонтёрство' : 'Мероприятия';
  if (!APPLICATION_CATEGORIES.has(category)) return null;
  if (!name || !phone || !email || !description || !category || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if ((isInitiative || category === 'Хочу быть активистом' || category === 'Хочу помочь инициативе' || category.includes('Свой вариант')) && !AREAS.has(area)) return null;
  if (category.includes('Свой вариант') && !customCategoryText) return null;
  if (!/^[+\d\s().-]+$/u.test(phone) || phone.replace(/\D/g, '').length < 10 || phone.replace(/\D/g, '').length > 15) return null;
  const helpAreas = isInitiative || body.helpAreas === undefined ? [area] : body.helpAreas;
  if (!Array.isArray(helpAreas) || !helpAreas.length || helpAreas.length > 4 || helpAreas.some(value => typeof value !== 'string' || !AREAS.has(value)) || new Set(helpAreas).size !== helpAreas.length || !helpAreas.includes(area)) return null;
  if (isInitiative && helpAreas.length !== 1) return null;
  return {
    name, phone, email, description, ...(vkUrl ? { vkUrl } : {}),
    helpAreas,
    category: isCustom && customCategoryText ? `Свой: ${customCategoryText}` : category,
    isInitiative,
    ...(isInitiative && isInitiativeDirection(body.direction) ? { direction: body.direction } : {}),
    area: AREAS.has(area) ? area : 'Мероприятия',
  };
}

function categoryFor(application: ApplicationItem): BaseMember['category'] {
  if (application.area === 'Медиа' || application.category.includes('Медиа')) return 'Медиа';
  if (application.area === 'IT' || application.category.includes('IT')) return 'IT';
  if (application.area === 'Волонтёрство' || application.category.includes('Волонтёр')) return 'Волонтёрство';
  return 'Мероприятия';
}

function buildMember(application: ApplicationItem, organization?: string): BaseMember {
  const dateAdded = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date());
  return {
    id: `base-${application.id}`,
    name: application.name,
    roleInfo: `${application.category} · Екатеринбург`,
    category: categoryFor(application),
    helpAreas: application.helpAreas || [application.area || 'Мероприятия'],
    isInitiative: Boolean(application.isInitiative),
    phone: application.phone,
    ...(application.vkUrl ? { vkUrl: application.vkUrl } : {}),
    email: application.email,
    initials: application.initials,
    avatarBg: application.avatarBg,
    description: application.description,
    ...(organization ? { branch: organization } : {}),
    author: application.name,
    dateAdded,
    ...(application.supportInitiativeId ? { supportInitiativeId: application.supportInitiativeId, supportInitiativeTitle: application.supportInitiativeTitle } : {}),
  };
}


export function createPlatformApi(env: Environment) {
  return (request: Request, response: ServerResponse, next: Next) => withMaintenanceAccess(hasAdminSession(request, env), async () => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/platform/')) return next();

    try {
      const method = request.method ?? 'GET';
      const route = url.pathname.slice('/api/platform'.length);
      const administrator = hasAdminSession(request, env);
      if (route === '/site-status' && method === 'GET') {
        const state = await readPlatformState(env);
        return send(response, 200, { ...(state.maintenance[0] || DEFAULT_MAINTENANCE), canManage: administrator });
      }
      if (route === '/maintenance') {
        if (!administrator) return send(response, 403, { error: 'Режим технических работ доступен только администратору.' });
        if (method === 'GET') {
          const state = await readPlatformState(env);
          return send(response, 200, { ...(state.maintenance[0] || DEFAULT_MAINTENANCE), history: state.maintenanceHistory });
        }
        if (method !== 'POST') return send(response, 405, { error: 'Метод не поддерживается.' });
        const origin = request.headers.origin;
        let sameOrigin = request.headers['sec-fetch-site'] !== 'cross-site';
        if (origin) {
          try { const source = new URL(origin); sameOrigin = sameOrigin && ['http:', 'https:'].includes(source.protocol) && source.host === request.headers.host; }
          catch { sameOrigin = false; }
        }
        if (!sameOrigin) return send(response, 403, { error: 'Изменяйте доступ к сайту из кабинета администратора на этой платформе.' });
        const body = await readBody(request);
        const message = typeof body.message === 'string' ? body.message.trim() : '';
        if (typeof body.enabled !== 'boolean' || !Number.isSafeInteger(body.version) || Number(body.version) < 0 || message.length < 10 || message.length > 600) return send(response, 400, { error: 'Напишите сообщение от 10 до 600 символов и обновите состояние сайта.' });
        const result = await updatePlatformState(state => {
          const current = state.maintenance[0] || DEFAULT_MAINTENANCE;
          if (body.version !== current.version) return { state, result: { status: 409, current } };
          const next: MaintenanceSettings = { enabled: body.enabled as boolean, message, version: current.version + 1, updatedAt: new Date().toISOString() };
          return { state: { ...state, maintenance: [next], maintenanceHistory: [...state.maintenanceHistory.slice(-49), { enabled: next.enabled, at: next.updatedAt!, version: next.version }] }, result: { status: 200, current: next } };
        }, env);
        return send(response, result.status, result.status === 409 ? { error: 'Другой администратор уже изменил режим. Обновите состояние и повторите действие.', current: result.current } : result.current);
      }
      if (await guardMaintenance(request, response, env, administrator)) return;

      if (await handleProfile(request, response, env, { readBody, resolveUser, send })) return;
      if (await handleMemberHub(request, response, env, { readBody, resolveUser, send })) return;
      if (await handleInitiativeWorkflow(request, response, env, { readBody, resolveUser, send })) return;

      if (route === '/homepage' && method === 'GET') {
        const state = await readPlatformState(env);
        const initiatives = await readPublishedInitiatives(env, state);
        const featuredInitiatives = state.featuredInitiatives.flatMap((selection) => {
          const initiative = initiatives.find((item) => item.id === selection.initiativeId);
          return initiative ? [{ ...initiative, helpNeeded: selection.helpNeeded }] : [];
        });
        return send(response, 200, { featuredInitiatives });
      }

      if (route === '/homepage' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || !canManageHomepage(user.role)) return send(response, 403, { error: 'Управлять главной страницей может только администратор.' });
        const body = await readBody(request);
        if (!Array.isArray(body.featuredInitiatives) || body.featuredInitiatives.length > 3) return send(response, 400, { error: 'Можно выбрать не больше трёх инициатив.' });
        const selections: FeaturedSelection[] = [];
        for (const value of body.featuredInitiatives) {
          if (!value || typeof value !== 'object' || typeof value.initiativeId !== 'string' || typeof value.helpNeeded !== 'string' || !value.helpNeeded.trim() || value.helpNeeded.length > 240 || selections.some((item) => item.initiativeId === value.initiativeId)) {
            return send(response, 400, { error: 'Выберите разные инициативы и укажите, какая помощь нужна (до 240 символов).' });
          }
          selections.push({ initiativeId: value.initiativeId, helpNeeded: value.helpNeeded.trim() });
        }
        const initiatives = await readPublishedInitiatives(env);
        if (selections.some((selection) => !initiatives.some((initiative) => initiative.id === selection.initiativeId))) return send(response, 400, { error: 'В подборку можно добавить только опубликованные инициативы.' });
        await updatePlatformState((state) => {
          if (body.expectedFeaturedInitiatives !== undefined && JSON.stringify(body.expectedFeaturedInitiatives) !== JSON.stringify(state.featuredInitiatives)) throw new Error('HOMEPAGE_CONFLICT');
          return { state: { ...state, featuredInitiatives: selections }, result: null };
        }, env);
        return send(response, 200, { featuredInitiatives: selections });
      }

      if (route === '/applications' && method === 'POST') {
        const body = await readBody(request);
        if (!hasPrivacyAcknowledgement(body)) return send(response, 400, { error: PRIVACY_ACKNOWLEDGEMENT_ERROR });
        if (body.category === 'Есть своя инициатива' && !isInitiativeDirection(body.direction)) return send(response, 400, { error: 'Выберите направление инициативы. Если форма открыта давно, обновите страницу — введённый черновик сохранён.' });
        const form = normalizeForm(body);
        if (!form) return send(response, 400, { error: 'Проверьте поля заявки и выбранную область помощи.' });
        const supportId = typeof body.supportInitiativeId === 'string' ? body.supportInitiativeId : '';
        const supportedInitiative = supportId ? (await readPublishedInitiatives(env)).find((initiative) => initiative.id === supportId) : null;
        if (supportId && (!supportedInitiative || form.isInitiative)) return send(response, 400, { error: 'Инициатива для отклика не найдена. Откройте её заново на главной.' });
        const implementationId = typeof body.supportImplementationId === 'string' ? body.supportImplementationId : '';
        const participationRole = body.participationRole;
        const implementation = implementationId ? supportedInitiative?.implementations?.find((item) => item.id === implementationId) : null;
        if (implementationId && (!implementation || implementation.status !== 'active' || form.category !== 'Хочу помочь инициативе' || (participationRole !== 'activist' && participationRole !== 'volunteer'))) return send(response, 400, { error: 'Набор на эту реализацию недоступен. Откройте актуальную карточку инициативы.' });
        const submissionId = body.submissionId;
        if (submissionId !== undefined && (typeof submissionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId))) return send(response, 400, { error: 'Неверный идентификатор заявки. Обновите форму.' });
        const id = `app-${submissionId || randomUUID()}`;
        const code = body.trackingCode;
        if (code !== undefined && (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code))) return send(response, 400, { error: 'Не удалось создать личный код. Обновите форму.' });
        const timestamp = new Date().toISOString();
        const app: StoredApplication = {
          ...form,
          privacyAcknowledgement: { version: PRIVACY_VERSION, at: timestamp },
          id,
          initials: form.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '??',
          avatarBg: AVATAR_COLORS[randomBytes(1)[0] % AVATAR_COLORS.length],
          actionText: form.isInitiative ? 'Добавить' : 'В работу',
          status: 'pending',
          createdAt: timestamp, updatedAt: timestamp, version: 1,
          history: [journeyEvent('pending', 'participant', 'Заявка получена. Команда Совета рассмотрит её.')],
          ...(typeof code === 'string' ? { trackingCodeHash: trackingHash(code) } : {}),
          ...(supportedInitiative ? { supportInitiativeId: supportedInitiative.id, supportInitiativeTitle: supportedInitiative.title } : {}),
          ...(implementation ? { supportImplementationId: implementation.id, participationRole: participationRole as 'activist' | 'volunteer' } : {}),
        };
        const result = await updatePlatformState((state) => {
          const existing = state.applications.find((item) => item.id === id);
          if (!existing && implementation) {
            const current = state.implementations.find((item) => item.id === implementation.id);
            if (!current || current.status !== 'active') throw new Error('RECRUITMENT_CLOSED');
            const accepted = state.applications.filter((item) => item.supportImplementationId === current.id && item.status === 'accepted' && item.participationRole === participationRole).length;
            if (accepted >= (participationRole === 'activist' ? current.activistSlots : current.volunteerSlots)) throw new Error('RECRUITMENT_CLOSED');
            if (state.applications.some((item) => item.supportImplementationId === current.id && !['rejected','withdrawn'].includes(item.status) && (item.email.toLowerCase() === app.email.toLowerCase() || item.phone.replace(/\D/g,'') === app.phone.replace(/\D/g,'')))) throw new Error('PARTICIPATION_DUPLICATE');
          }
          return existing ? { state, result: { id: existing.id, trackingAvailable: typeof code === 'string' && existing.trackingCodeHash === trackingHash(code) } } : { state: { ...state, applications: [app, ...state.applications] }, result: { ...applicationSummary(app), trackingAvailable: Boolean(code) } };
        }, env);
        return send(response, 201, result);
      }

      // Codes are bearer credentials: accept only in POST bodies, never URLs or public responses.
      if (route === '/application-track' && method === 'POST') {
        const body = await readBody(request);
        const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
        if (!/^[a-f0-9]{64}$/.test(code)) return send(response, 400, { error: 'Введите личный код из подтверждения заявки: 64 символа.' });
        const hash = trackingHash(code);
        if (body.action !== undefined && body.action !== 'revise' && body.action !== 'withdraw') return send(response, 400, { error: 'Неизвестное действие.' });
        if (!body.action) {
          const state = await readPlatformState(env);
          const application = state.applications.find((item) => item.trackingCodeHash === hash);
          return application ? send(response, 200, trackedSummary(application, state.notifications)) : send(response, 404, { error: 'Заявка с таким кодом не найдена. Проверьте код в сохранённом файле.' });
        }
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        if (body.action === 'revise' && body.direction !== undefined && !isInitiativeDirection(body.direction)) return send(response, 400, { error: 'Выберите направление инициативы.' });
        if (body.action === 'revise' && (description.length < 10 || description.length > 5000)) return send(response, 400, { error: 'Описание должно содержать от 10 до 5000 символов.' });
        const action = body.action;
        const result = await updatePlatformState<{ status: number; error?: string; application?: TrackedApplication }>((state) => {
          const target = state.applications.find((item) => item.trackingCodeHash === hash);
          if (!target) return { state, result: { error: 'Заявка с таким кодом не найдена.', status: 404 } };
          if (body.version !== (target.version || 1)) return { state, result: { error: 'Заявка уже изменилась. Обновите статус перед действием.', status: 409 } };
          if ((action === 'revise' && target.status !== 'needs_changes') || (action === 'withdraw' && target.status !== 'pending' && target.status !== 'needs_changes')) return { state, result: { error: 'Это действие больше недоступно. Обновите статус заявки.', status: 409 } };
          const status = action === 'revise' ? 'pending' : 'withdrawn';
          const updated: StoredApplication = {
            ...target, status, ...(action === 'revise' ? { description, ...(target.isInitiative && isInitiativeDirection(body.direction) ? { direction: body.direction } : {}) } : {}),
            version: (target.version || 1) + 1, updatedAt: new Date().toISOString(),
            history: [...(target.history || []), journeyEvent(status, 'participant', action === 'revise' ? 'Автор дополнил описание и отправил заявку на повторное рассмотрение.' : 'Автор отозвал заявку.')],
          };
          return { state: { ...state, applications: state.applications.map((item) => item.id === target.id ? updated : item) }, result: { application: trackedSummary(updated, state.notifications), status: 200 } };
        }, env);
        return send(response, result.status, result.error ? { error: result.error } : result.application);
      }

      if (route === '/bootstrap' && method === 'GET') {
        let user = await resolveUser(request, env);
        if (!user) return send(response, 401, { error: 'Сеанс завершён. Войдите в кабинет заново.' });
        const state = await readPlatformState(env);
        if (user.role !== 'admin') {
          const account = state.accounts.find(item => item.login === user!.login && item.salt === getSessionVersion(request, env));
          if (!account) return send(response, 401, { error: 'Сеанс завершён. Войдите заново.' });
          user = createSessionUser(account.login, account.name, account.role, account);
        }
        const cacheKey = `bootstrap:${user.login}`;
        if (snapshotNotModified(state, cacheKey, response)) return;
        const cached = getSnapshot(state, cacheKey); if (cached) return send(response, 200, cached);
        const isAdmin = user.role === 'admin';
        const overseesProjects = canOverseeImplementations(user);
        const isChairman = user.role === 'chairman';
        const canReviewAll = canReviewAllApplications(user);
        const accountByLogin = new Map(state.accounts.map(account => [account.login, account]));
        const ownedImplementationIds = new Set(state.implementations.filter(item => overseesProjects || (isChairman && item.ownerLogin === user.login)).map(item => item.id));
        const accessUsers = isAdmin
          ? state.accounts.map(userSummary)
          : [];
        return send(response, 200, saveSnapshot(state, cacheKey, {
          applications: state.applications.filter(item => canReviewAll || (isChairman && Boolean(item.supportImplementationId) && ownedImplementationIds.has(item.supportImplementationId!))).map(applicationSummary),
          baseMembers: isAdmin || isChairman ? state.baseMembers : [],
          accessUsers,
          featuredInitiatives: isAdmin ? state.featuredInitiatives : [],
          implementations: (overseesProjects ? state.implementations : isChairman ? state.implementations.filter((item) => item.ownerLogin === user.login) : []).map(item => { const owner = accountByLogin.get(item.ownerLogin); return owner ? { ...item, ownerName: owner.name, councilStatus: owner.councilStatus } : item; }),
          implementationPhotos: state.implementationPhotos.filter((photo) => overseesProjects || (isChairman && photo.ownerLogin === user.login)).map(({ storageKey: _key, ownerLogin: _owner, ...photo }) => photo),
          implementationParticipants: state.applications.filter((app) => app.status === 'accepted' && app.supportImplementationId && ownedImplementationIds.has(app.supportImplementationId)).map((app) => ({ id: app.id, implementationId: app.supportImplementationId, name: app.name, phone: app.phone, email: app.email, role: app.participationRole })),
          notifications: state.notifications.filter((item) => (overseesProjects && item.audience === 'admin') || (item.audience === 'user' && item.recipient === user.login)).slice(0,100),
          currentUser: user,
        }));
      }

      if (route === '/initiative-cover' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || !canReviewAllApplications(user)) return send(response, 403, { error: 'Менять обложку могут администратор и куратор инициатив.' });
        const body = await readBody(request);
        const id = typeof body.id === 'string' ? body.id : '';
        const coverId = body.coverId;
        if (body.direction !== undefined && !isInitiativeDirection(body.direction)) return send(response, 400, { error: 'Выберите направление инициативы.' });
        if (!isInitiativeCoverId(coverId) || !Number.isSafeInteger(body.version) || Number(body.version) < 0) return send(response, 400, { error: 'Выберите обложку из библиотеки и обновите данные инициативы.' });
        const published = await readPublishedInitiatives(env);
        if (!published.some(item => item.id === id)) return send(response, 404, { error: 'Опубликованная инициатива не найдена.' });
        const result = await updatePlatformState((state) => {
          const application = state.applications.find(item => item.id === id);
          if (application && (!application.isInitiative || application.status !== 'accepted')) return { state, result: { status: 404, error: 'Инициатива больше не опубликована.' } };
          const previous = state.initiativeCovers.find(item => item.initiativeId === id);
          if ((previous?.version || 0) !== body.version) return { state, result: { status: 409, error: 'Обложка уже изменена. Обновите кабинет и выберите заново.' } };
          const cover = { initiativeId: id, coverId, direction: isInitiativeDirection(body.direction) ? body.direction : previous?.direction, version: (previous?.version || 0) + 1 };
          return { state: { ...state, applications: state.applications.map(item => item.id === id && item.isInitiative && isInitiativeDirection(body.direction) && item.direction !== body.direction ? { ...item, direction: body.direction, version: (item.version || 1) + 1, updatedAt: new Date().toISOString(), history: [...(item.history || []), journeyEvent(item.status, user.role === 'admin' ? 'admin' : 'curator', 'Команда уточнила направление инициативы.')] } : item), initiativeCovers: [...state.initiativeCovers.filter(item => item.initiativeId !== id), cover] }, result: { status: 200, error: '' } };
        }, env);
        return send(response, result.status, result.error ? { error: result.error } : { saved: true });
      }

      if (route === '/applications/status' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || (user.role !== 'admin' && user.role !== 'chairman')) return send(response, 403, { error: 'У вас нет доступа к обработке заявок.' });
        const body = await readBody(request);
        const id = typeof body.id === 'string' ? body.id : '';
        const status = body.status;
        if (!id || (status !== 'accepted' && status !== 'rejected' && status !== 'needs_changes')) return send(response, 400, { error: 'Неверный статус заявки.' });
        if (body.direction !== undefined && !isInitiativeDirection(body.direction)) return send(response, 400, { error: 'Выберите направление инициативы.' });
        if (body.coverId !== undefined && !isInitiativeCoverId(body.coverId)) return send(response, 400, { error: 'Выберите доступную обложку из библиотеки.' });
        if (!Number.isSafeInteger(body.version) || Number(body.version) < 1) return send(response, 400, { error: 'Обновите кабинет перед рассмотрением заявки.' });
        const nextStatus: ApplicationItem['status'] = status;
        const reviewState = await readPlatformState(env);
        const existing = reviewState.applications.find((item) => item.id === id);
        if (!existing) return send(response, 404, { error: 'Заявка не найдена.' });
        const canReview = (application: StoredApplication, state: typeof reviewState) => {
          const account = state.accounts.find(item => item.login === user.login && item.salt === getSessionVersion(request, env));
          const actor = user.role === 'admin' ? user : account ? createSessionUser(account.login, account.name, account.role, account) : null;
          return Boolean(actor && (canReviewAllApplications(actor) || (!isSchoolMember(actor) && !application.isInitiative && application.supportImplementationId && state.implementations.some(item => item.id === application.supportImplementationId && (item.ownerLogin === actor.login || canOverseeImplementations(actor))))));
        };
        if (!canReview(existing, reviewState)) return send(response, 403, { error: 'Можно обрабатывать только отклики на свою реализацию.' });
        if (existing.status !== 'pending' && existing.status !== status) return send(response, 409, { error: 'Эта заявка уже обработана. Обновите страницу.' });
        if (body.version !== undefined && body.version !== (existing.version || 1)) return send(response, 409, { error: 'Заявка уже изменилась. Обновите кабинет перед решением.' });
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (existing.status === 'pending' && (status === 'rejected' || status === 'needs_changes') && (reason.length < 10 || reason.length > 1000)) return send(response, 400, { error: 'Объясните решение участнику: от 10 до 1000 символов.' });
        if (reason.length > 1000) return send(response, 400, { error: 'Комментарий должен быть не длиннее 1000 символов.' });
        const result = await updatePlatformState<{ application: ApplicationItem | null; member: BaseMember | null } | null>((state) => {
          const target = state.applications.find((item) => item.id === id);
          if (!target) return { state, result: null };
          if (!canReview(target, state)) throw new Error('WORKFLOW_PERMISSION');
          if ((target.status !== 'pending' && target.status !== nextStatus) || (body.version !== undefined && body.version !== (target.version || 1))) throw new Error('APPLICATION_CONFLICT');
          if (nextStatus === 'accepted' && target.status !== 'accepted' && target.supportImplementationId) {
            const implementation = state.implementations.find((item) => item.id === target.supportImplementationId);
            const count = state.applications.filter((item) => item.id !== target.id && item.supportImplementationId === target.supportImplementationId && item.participationRole === target.participationRole && item.status === 'accepted').length;
            if (!implementation || implementation.status !== 'active' || count >= (target.participationRole === 'activist' ? implementation.activistSlots : implementation.volunteerSlots)) throw new Error('RECRUITMENT_CLOSED');
          }
          const updated: StoredApplication = target.status === nextStatus ? target : {
            ...target, ...(target.isInitiative && isInitiativeDirection(body.direction) ? { direction: body.direction } : {}), status: nextStatus, version: (target.version || 1) + 1, updatedAt: new Date().toISOString(),
            history: [...(target.history || []), { ...journeyEvent(nextStatus, user.role === 'admin' ? 'admin' : canReviewAllApplications(user) ? 'curator' : 'organizer', reason || (target.isInitiative ? 'Инициатива одобрена и опубликована на доске.' : 'Заявка одобрена и передана команде Совета.')), actorName: user.name }],
          };
          const applications = state.applications.map((item) => item.id === id ? updated : item);
          const alreadyInBase = state.baseMembers.some((item) => item.id === `base-${target.id}`);
          const baseMembers = status === 'accepted' && !alreadyInBase
            ? [buildMember(target, state.implementations.find(item => item.id === target.supportImplementationId)?.organization), ...state.baseMembers]
            : state.baseMembers;
          const implementation = target.supportImplementationId ? state.implementations.find((item) => item.id === target.supportImplementationId) : null;
          const notifications: PlatformNotification[] = nextStatus === 'accepted' && target.status !== 'accepted' && implementation
            ? [{ id: randomUUID(), audience: 'user', recipient: implementation.ownerLogin, initiativeId: implementation.initiativeId, implementationId: implementation.id, message: `В команду «${implementation.organization}» принят участник: ${target.name} · ${target.participationRole === 'activist' ? 'активист' : 'волонтёр'}. Контакты доступны в списке команды.`, createdAt: new Date().toISOString() }, ...state.notifications]
            : state.notifications;
          return {
            state: { ...state, applications, baseMembers, notifications,
              initiativeCovers: target.isInitiative && nextStatus === 'accepted' && target.status !== 'accepted'
                ? [...state.initiativeCovers.filter(item => item.initiativeId !== id), { initiativeId: id, coverId: isInitiativeCoverId(body.coverId) ? body.coverId : initiativeCover({ area: target.area || 'Мероприятия', coverId: directionCover(updated.direction) }).id, version: (state.initiativeCovers.find(item => item.initiativeId === id)?.version || 0) + 1 }]
                : state.initiativeCovers,
            },
            result: { application: applicationSummary(updated), member: baseMembers.find((item) => item.id === `base-${target.id}`) ?? null },
          };
        }, env);
        if (!result?.application) return send(response, 404, { error: 'Заявка не найдена.' });
        return send(response, 200, result);
      }

      if (route === '/users/credentials' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || user.role !== 'admin') return send(response, 403, { error: 'Создавать данные доступа может только администратор.' });
        await readBody(request);
        const state = await readPlatformState(env);
        return send(response, 200, issueAccessCredentials([env.AUTH_USERNAME?.trim() || '', ...state.accounts.map(account => account.login)], env));
      }

      if (route === '/users' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || user.role !== 'admin') return send(response, 403, { error: 'Это действие доступно только администратору.' });
        const body = await readBody(request);
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
        const roleInfo = typeof body.roleInfo === 'string' ? body.roleInfo.trim().slice(0, 160) : '';
        const branch = typeof body.branch === 'string' ? body.branch.trim().slice(0, 160) : '';
        if (!/^(Председатель|Куратор района)(?:\s*·.*)?$/u.test(roleInfo)) return send(response, 400, { error: 'Выберите действующую роль сотрудника.' });
        if (!name || !roleInfo) return send(response, 400, { error: 'Укажите имя пользователя и роль.' });
        const credentials = readAccessCredentials(body.credentialTicket, env);
        if (!credentials) return send(response, 400, { error: 'Данные доступа устарели или изменены. Получите новую автоматически созданную пару.' });
        if (body.login !== undefined || body.password !== undefined) return send(response, 400, { error: 'Логин и пароль создаются системой. Ручной ввод недоступен.' });
        const { login, password } = credentials;
        const previousAccount = (await readPlatformState(env)).accounts.find(account => account.id === `usr-${credentials.id}`);
        const ticketSalt = previousAccount ? Buffer.from(previousAccount.salt, 'base64url') : createHash('sha256').update('pervik-ticket-salt-v1\0').update(credentials.id).digest().subarray(0,16);
        const candidate: StoredAccount = {
          id: `usr-${credentials.id}`, name, roleInfo, login, branch,
          initials: name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '??',
          avatarBg: AVATAR_COLORS[randomBytes(1)[0] % AVATAR_COLORS.length],
          role: validRoleInfo(), accessVersion: 1, credentialVersion: 1, ...await makePasswordHash(password, ticketSalt),
        };
        const result = await updatePlatformState<{ account?: StoredAccount; error?: string; created?: boolean }>((state) => {
          const existing = state.accounts.find(account => account.id === candidate.id);
          if (existing) {
            if (existing.name !== name || existing.roleInfo !== roleInfo || existing.branch !== branch || (candidate.salt !== existing.salt || candidate.passwordHash !== existing.passwordHash)) return { state, result: { error: 'Этот доступ уже создан. Найдите пользователя в списке или получите новую пару для другого человека.' } };
            return { state, result: { account: existing, created: false } };
          }
          if (login.toLocaleLowerCase('ru-RU') === env.AUTH_USERNAME?.trim().toLocaleLowerCase('ru-RU') || state.accounts.some(account => account.login.toLocaleLowerCase('ru-RU') === login.toLocaleLowerCase('ru-RU'))) return { state, result: { error: 'Этот логин уже занят. Получите новую автоматически созданную пару.' } };
          return { state: { ...state, accounts: [candidate, ...state.accounts] }, result: { account: candidate, created: true } };
        }, env);
        if (!result.account) return send(response, 409, { error: result.error });
        return send(response, result.created ? 201 : 200, { user: { ...userSummary(result.account), password }, generated: true });
      }

      if (route === '/users/reset-password' && method === 'POST') {
        const user = await resolveUser(request, env);
        if (!user || user.role !== 'admin') return send(response, 403, { error: 'Это действие доступно только администратору.' });
        const body = await readBody(request);
        const id = typeof body.id === 'string' ? body.id : '';
        const password = generateWordPassword();
        const hash = await makePasswordHash(password);
        const account = await updatePlatformState((state) => {
          const target = state.accounts.find((item) => item.id === id);
          if (!target) return { state, result: null };
          if (body.credentialVersion !== (target.credentialVersion || 1)) throw new Error('CREDENTIAL_CONFLICT');
          const updated = { ...target, ...hash, accessVersion: (target.accessVersion || 1) + 1, credentialVersion: (target.credentialVersion || 1) + 1 };
          return { state: { ...state, accounts: state.accounts.map((item) => item.id === id ? updated : item) }, result: updated };
        }, env);
        if (!account) return send(response, 404, { error: 'Пользователь не найден.' });
        return send(response, 200, { user: { ...userSummary(account), password } });
      }

      response.setHeader('Allow', 'GET, POST');
      return send(response, 404, { error: 'Not found' });
    } catch (error) {
      response.setHeader('Retry-After', '5');
      if (error instanceof MaintenanceModeError) return sendMaintenance(response, error.maintenance);
      if (error instanceof Error && error.message === 'CREDENTIAL_CONFLICT') return send(response, 409, { error: 'Пароль уже изменён другим администратором. Обновите данные перед повторным сбросом.' });
      if (error instanceof Error && error.message === 'ACCESS_CONFLICT') return send(response, 409, { error: 'Права сотрудника уже изменены. Закройте окно и обновите кабинет перед сохранением.' });
      if (error instanceof Error && error.message === 'HOMEPAGE_CONFLICT') return send(response, 409, { error: 'Подборка уже обновлена другим администратором. Обновите кабинет перед сохранением.' });
      if (error instanceof Error && error.message === 'WORKFLOW_PERMISSION') return send(response, 403, { error: 'Полномочия изменились. Обновите кабинет и проверьте доступ к действию.' });
      if (error instanceof Error && error.message === 'RECRUITMENT_CLOSED') return send(response, 409, { error: 'Набор закрыт или все места уже заняты. Обновите инициативу.' });
      if (error instanceof Error && error.message === 'PARTICIPATION_DUPLICATE') return send(response, 409, { error: 'Ваш отклик на эту реализацию уже есть. Проверьте его по личному коду.' });
      if (error instanceof Error && error.message === 'APPLICATION_CONFLICT') return send(response, 409, { error: 'Заявка уже изменилась. Обновите кабинет перед решением.' });
      if (error instanceof Error && error.message === 'Request body too large') return send(response, 413, { error: 'Заявка слишком большая. Сократите описание.' });
      if (error instanceof Error && error.message === 'Invalid request body') return send(response, 400, { error: 'Неверный формат запроса.' });
      // Keep personal data out of platform logs; record only the failure class.
      console.error('Platform API failed:', error instanceof Error
        ? { name: error.name, message: error.message.slice(0, 240) }
        : 'UnknownError');
      return send(response, 503, { error: 'Сервис временно недоступен. Проверьте подключение хранилища.' });
    }
  });
}
