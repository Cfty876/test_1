import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAuthMiddleware } from './authApi.ts';
import { createPlatformApi } from './platformApi.ts';
import { savePublicInitiative, readPublicInitiatives } from './publicInitiativesStore.ts';

test('applications, organizer selection and public replies survive reload with role isolation', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pervik-platform-test-'));
  const salt = randomBytes(16);
  const password = randomBytes(18).toString('hex');
  const env = {
    PLATFORM_DATA_DIRECTORY: directory,
    AUTH_USERNAME: 'test-admin', AUTH_DISPLAY_NAME: 'Организатор', AUTH_ROLE: 'admin',
    AUTH_SESSION_SECRET: randomBytes(32).toString('hex'),
    AUTH_PASSWORD_SALT: salt.toString('base64url'),
    AUTH_PASSWORD_HASH: scryptSync(password, salt, 64).toString('hex'),
  };
  const platform = createPlatformApi(env);
  const auth = createAuthMiddleware(env);
  const server = createServer((request, response) => {
    void platform(request, response, () => { void auth(request, response, () => { response.statusCode = 404; response.end(); }); });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  let cookie = '';
  async function request(route: string, body?: unknown, session = cookie) {
    const response = await fetch(`${url}/api/${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(session ? { cookie: session } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
  }
  try {
    const login = await request('auth/login', { login: env.AUTH_USERNAME, password });
    assert.equal(login.status, 200);
    cookie = login.cookie;
    const applications: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const created = await request('platform/applications', { name: `Автор ${index}`, phone: '+7 999 123-45-67', email: 'fixture@example.org', category: 'Есть своя инициатива', helpArea: 'IT', isInitiative: true, description: `Проект ${index}. Полезный городской сервис.` }, '');
      assert.equal(created.status, 201);
      applications.push(created.body.id);
      const accepted = await request('platform/applications/status', { id: created.body.id, status: 'accepted' });
      assert.equal(accepted.status, 200);
    }
    await t.test('accepting publishes server-side and remains idempotent', async () => {
      assert.equal((await request('initiatives', undefined, '')).body.length, 4);
      assert.equal((await request('platform/applications/status', { id: applications[0], status: 'accepted' })).status, 200);
      assert.equal((await request('initiatives', undefined, '')).body.length, 4);
      assert.equal((await request('platform/applications/status', { id: applications[0], status: 'rejected' })).status, 409);
    });
    const selection = applications.slice(0, 3).map((initiativeId, index) => ({ initiativeId, helpNeeded: `Нужна помощь ${index}` }));
    await t.test('selection validates maximum, duplicates, unpublished records and text', async () => {
      for (const entries of [[...selection, { initiativeId: applications[3], helpNeeded: 'Ещё помощь' }], [selection[0], selection[0]], [{ initiativeId: 'missing', helpNeeded: 'Помощь' }], [{ initiativeId: applications[0], helpNeeded: ' ' }]]) {
        assert.equal((await request('platform/homepage', { featuredInitiatives: entries })).status, 400);
      }
      assert.equal((await request('platform/homepage', { featuredInitiatives: selection }, '')).status, 403);
      assert.equal((await request('platform/homepage', { featuredInitiatives: selection })).status, 200);
      const homepage = (await request('platform/homepage', undefined, '')).body;
      assert.deepEqual(homepage.featuredInitiatives.map((item: any) => item.id), applications.slice(0, 3));
      assert.equal(homepage.featuredInitiatives[0].helpNeeded, 'Нужна помощь 0');
      assert.equal(JSON.stringify(homepage).includes('fixture@example.org'), false);
      const state = await readFile(path.join(directory, 'platform-state.json'), 'utf8');
      assert.equal(state.includes('fixture@example.org'), false);
    });
    await t.test('support application refers to the actual published initiative', async () => {
      const body = { name: 'Помощник', phone: '+7 999 765-43-21', email: 'helper@example.org', category: 'Хочу помочь инициативе', helpArea: 'IT', isInitiative: false, description: 'Готов помочь с дизайном', supportInitiativeId: applications[1] };
      const created = await request('platform/applications', body, '');
      assert.equal(created.status, 201);
      assert.equal(created.body.supportInitiativeId, applications[1]);
      assert.equal(created.body.supportInitiativeTitle, 'Проект 1');
      assert.equal((await request('platform/applications', { ...body, supportInitiativeId: 'missing' }, '')).status, 400);
      assert.equal((await request('platform/applications', { ...body, phone: '123' }, '')).status, 400);
    });
    await t.test('chairman manages selection, partner cannot access applications or edit homepage', async () => {
      for (const [loginName, roleInfo] of [['chairman', 'Председатель'], ['partner', 'Партнёр']]) {
        const created = await request('platform/users', { name: loginName, login: loginName, roleInfo, password, branch: 'Тест' });
        assert.equal(created.status, 201);
        const session = await request('auth/login', { login: loginName, password });
        assert.equal(session.status, 200);
        const bootstrap = (await request('platform/bootstrap', undefined, session.cookie)).body;
        assert.equal(bootstrap.applications.length, 0);
        if (loginName === 'partner') {
          assert.equal(bootstrap.baseMembers.length, 0);
          assert.equal((await request('platform/homepage', { featuredInitiatives: [] }, session.cookie)).status, 403);
        } else {
          assert.equal((await request('platform/homepage', { featuredInitiatives: selection.slice().reverse() }, session.cookie)).status, 200);
          assert.equal((await request('platform/applications/status', { id: applications[0], status: 'accepted' }, session.cookie)).status, 403);
        }
      }
      assert.deepEqual((await request('platform/homepage', undefined, '')).body.featuredInitiatives.map((item: any) => item.id), applications.slice(0, 3).reverse());
      assert.equal((await request('platform/users', { name: 'Дубликат', login: 'test-admin', roleInfo: 'Председатель', password })).status, 409);
    });
    await t.test('empty selection removes all cards and malformed JSON returns a client error', async () => {
      assert.equal((await request('platform/homepage', { featuredInitiatives: [] })).status, 200);
      assert.deepEqual((await request('platform/homepage', undefined, '')).body.featuredInitiatives, []);
      assert.equal((await request('platform/applications', null, '')).status, 400);
    });
    await t.test('concurrent publications do not lose updates locally', async () => {
      await Promise.all(Array.from({ length: 8 }, (_, index) => savePublicInitiative({ id: `concurrent-${index}`, title: 'Тест', description: 'Тест', area: 'IT', author: 'Тест', publishedAt: new Date().toISOString() }, env)));
      assert.equal((await readPublicInitiatives(env)).length, 12);
    });
    await t.test('a publication failure leaves the application pending and allows retry', async () => {
      const created = await request('platform/applications', { name: 'Проверка публикации', phone: '+7 999 123-45-67', email: 'fixture@example.org', category: 'Есть своя инициатива', helpArea: 'Медиа', isInitiative: true, description: 'Инициатива с повторной публикацией.' }, '');
      const file = path.join(directory, 'public-initiatives.json');
      const original = await readFile(file, 'utf8');
      try {
        await writeFile(file, 'invalid-json');
        assert.equal((await request('platform/applications/status', { id: created.body.id, status: 'accepted' })).status, 503);
        const snapshot = (await request('platform/bootstrap')).body;
        assert.equal(snapshot.applications.find((item: any) => item.id === created.body.id).status, 'pending');
      } finally { await writeFile(file, original); }
      assert.equal((await request('platform/applications/status', { id: created.body.id, status: 'accepted' })).status, 200);
    });
    await t.test('partner receives only addressed initiatives and can mark support', async () => {
      const forwarded = await request('platform/forwarded-initiatives', { initiative: { title: 'Городской проект', description: 'Нужна поддержка площадкой', area: 'Мероприятия', authorName: 'Автор', authorPhone: '+7 999 123-45-67', authorEmail: 'fixture@example.org', partnerName: 'partner', senderNote: 'Просим рассмотреть' } });
      assert.equal(forwarded.status, 201);
      const partner = await request('auth/login', { login: 'partner', password });
      const inbox = (await request('platform/bootstrap', undefined, partner.cookie)).body.forwardedInitiatives;
      assert.equal(inbox.length, 1);
      assert.equal(inbox[0].title, 'Городской проект');
      assert.equal((await request('platform/partner-inbox/status', { id: forwarded.body.id }, partner.cookie)).status, 200);
      assert.equal((await request('platform/bootstrap', undefined, partner.cookie)).body.forwardedInitiatives[0].status, 'supported');
      await request('platform/users', { name: 'Другой партнёр', login: 'partner-2', roleInfo: 'Партнёр', password });
      const other = await request('auth/login', { login: 'partner-2', password });
      assert.equal((await request('platform/bootstrap', undefined, other.cookie)).body.forwardedInitiatives.length, 0);
      assert.equal((await request('platform/partner-inbox/status', { id: forwarded.body.id }, other.cookie)).status, 404);
    });
    await t.test('retrying the same submission creates one record without exposing an existing application', async () => {
      const before = (await request('platform/bootstrap')).body.applications.length;
      const payload = { submissionId: randomUUID(), name: 'Повтор запроса', phone: '+7 999 123-45-67', email: 'fixture@example.org', category: 'Волонтёр', helpArea: 'IT', isInitiative: false, description: 'Готов помогать' };
      const responses = await Promise.all([request('platform/applications', payload, ''), request('platform/applications', payload, '')]);
      assert.equal(responses[0].body.id, responses[1].body.id);
      assert.equal((await request('platform/bootstrap')).body.applications.length, before + 1);
      const repeat = await request('platform/applications', payload, '');
      assert.deepEqual(Object.keys(repeat.body), ['id']);
      assert.equal((await request('platform/applications', { ...payload, submissionId: 'invalid' }, '')).status, 400);
    });
    await t.test('participation categories override stale hidden fields and classify partners correctly', async () => {
      for (const [category, expectedArea] of [['Медиа, фото, видео', 'Медиа'], ['IT и техническая поддержка', 'IT'], ['Волонтёр', 'Волонтёрство'], ['Я — организация-партнёр', 'Мероприятия']]) {
        const created = await request('platform/applications', { name: 'Участник направления', phone: '+7 999 123-45-67', email: 'fixture@example.org', category, helpArea: 'Медиа', customCategoryText: 'Старый текст', isInitiative: false, description: 'Готов помогать' }, '');
        assert.equal(created.body.category, category);
        assert.equal(created.body.area, expectedArea);
        if (category.includes('партнёр')) {
          const accepted = await request('platform/applications/status', { id: created.body.id, status: 'accepted' });
          assert.equal(accepted.body.member.category, 'Партнёры');
        }
      }
    });
    await t.test('password reset revokes existing sessions and only the new password works', async () => {
      const oldLogin = await request('auth/login', { login: 'partner', password });
      const account = (await request('platform/bootstrap')).body.accessUsers.find((item: any) => item.login === 'partner');
      const reset = await request('platform/users/reset-password', { id: account.id });
      assert.equal(reset.status, 200);
      assert.equal((await request('auth/session', undefined, oldLogin.cookie)).body.user, null);
      assert.equal((await request('platform/bootstrap', undefined, oldLogin.cookie)).status, 401);
      assert.equal((await request('auth/login', { login: 'partner', password })).status, 401);
      assert.equal((await request('auth/login', { login: 'partner', password: reset.body.user.password })).status, 200);
      assert.equal((await request('auth/login', null, '')).status, 400);
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('pervik-platform-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});
