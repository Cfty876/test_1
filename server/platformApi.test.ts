import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAuthMiddleware } from './authApi.ts';
import { createPlatformApi } from './platformApi.ts';
import { requestContext } from './httpSupport.ts';
import { createRequestGuard } from './requestGuard.ts';
import { closeDatabase } from './database.ts';
import { PRIVACY_VERSION } from '../src/utils/legal.ts';

const privacy = { privacyAcknowledged: true, privacyVersion: PRIVACY_VERSION };
const db = process.env.AUDIT_DATABASE_URL;
if (db && !new URL(db).pathname.startsWith('/pervik_audit_')) throw new Error('Tests require an isolated audit database');

test(db ? 'PostgreSQL: complete platform workflows and concurrent decisions' : 'Local fallback: complete platform workflows and concurrent decisions', async t => {
 const directory = await mkdtemp(path.join(os.tmpdir(), 'pervik-audit-'));
 const salt = randomBytes(16), password = randomBytes(20).toString('hex');
 const env = { PLATFORM_DATA_DIRECTORY: directory, ...(db ? { DATABASE_URL: db } : {}), AUTH_USERNAME: 'audit-admin', AUTH_DISPLAY_NAME: 'Тестовый администратор', AUTH_ROLE: 'admin', AUTH_SESSION_SECRET: process.env.AUDIT_SESSION_SECRET || randomBytes(32).toString('hex'), AUTH_PASSWORD_SALT: salt.toString('base64url'), AUTH_PASSWORD_HASH: scryptSync(password,salt,64).toString('hex'), AUTH_COOKIE_SECURE: 'false', RATE_LIMIT_ENABLED: 'false' };
 const platform = createPlatformApi(env), auth = createAuthMiddleware(env), guard = createRequestGuard(env);
 const server = createServer((req,res) => requestContext.run(req, () => guard(req,res, () => {
  Promise.resolve(platform(req,res, () => { Promise.resolve(auth(req,res, () => {res.statusCode=404;res.end('{}');})).catch(fail); })).catch(fail);
  function fail(error: unknown){console.error(error instanceof Error ? error.name : 'Error');if(!res.headersSent){res.statusCode=500;res.end('{}');}}
 })));
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r)); const address=server.address();assert.ok(address&&typeof address==='object'); const origin=`http://127.0.0.1:${address.port}`;
 let admin='';
 async function req(route:string, body?:unknown, cookie=admin, headers:Record<string,string>={}) {
  const response=await fetch(`${origin}/api/${route}`,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null,cookie:response.headers.get('set-cookie')?.split(';')[0]||'',etag:response.headers.get('etag')};
 }
 const login=(login:string,pw:string)=>req('auth/login',{login,password:pw,...privacy},'');
 let school='',curator='',schoolUser:any,curatorUser:any;
 let app:any,implementation:any,photo:any;
 const trackingCode=randomBytes(32).toString('hex');
 const form={submissionId:randomUUID(),trackingCode,name:'Тестов Тест Тестович',phone:'+7 (999) 123-45-67',email:'audit@example.invalid',category:'Есть своя инициатива',direction:'education',helpArea:'IT',description:'Школьная мастерская полезных цифровых проектов.',...privacy};
 try {
  await t.test('login requires acknowledgement, rejects wrong passwords and oversized input',async()=>{
   assert.equal((await req('auth/login',{login:env.AUTH_USERNAME,password},'')).status,400);
   assert.equal((await login(env.AUTH_USERNAME,'incorrect')).status,401);
   assert.equal((await login(env.AUTH_USERNAME,'x'.repeat(300))).status,401);
   const result=await login(env.AUTH_USERNAME,password);assert.equal(result.status,200);admin=result.cookie;
   assert.equal((await req('auth/session')).body.user.role,'admin');
  });
  await t.test('generated accounts preserve credential-ticket idempotency and school/curator permissions',async()=>{
   for(const role of ['Председатель','Куратор района']){
    const generated=await req('platform/users/credentials',{});assert.equal(generated.status,200);
    const payload={name:`Тестовый ${role}`,roleInfo:role,branch:'Тестовая школа',credentialTicket:generated.body.ticket};
    const parallel=await Promise.all([req('platform/users',payload),req('platform/users',payload)]);assert.deepEqual(parallel.map(r=>r.status).sort(),[200,201]);const created=parallel.find(r=>r.status===201)!;
    assert.equal((await req('platform/users',payload)).status,200);
    const session=await login(generated.body.login,generated.body.password);assert.equal(session.status,200);
    if(role==='Председатель'){school=session.cookie;schoolUser=created.body.user;}else{curator=session.cookie;curatorUser=created.body.user;}
   }
   assert.equal((await req('platform/users/credentials',{},school)).status,403);
   assert.equal((await req('platform/homepage',{featuredInitiatives:[]},school)).status,403);
   assert.equal((await req('platform/bootstrap',undefined,school)).body.accessUsers.length,0);
   assert.equal((await req('platform/profiles',undefined,school)).status,403);
  });
  await t.test('public validation, privacy, idempotent submission, private tracking and moderation',async()=>{
   assert.equal((await req('platform/applications',{...form,privacyAcknowledged:false},'')).status,400);
   assert.equal((await req('platform/applications',{...form,email:'invalid'},'')).status,400);
   assert.equal((await req('platform/applications',{...form,direction:'IT'},'')).status,400);
   assert.equal((await req('platform/applications',{...form,direction:undefined},'')).status,400);
   assert.equal((await req('platform/applications',{...form,phone:'123'},'')).status,400);
   const concurrent=await Promise.all([req('platform/applications',form,''),req('platform/applications',form,'')]);
   assert.equal(concurrent[0].status,201);assert.equal(concurrent[0].body.id,concurrent[1].body.id);app=concurrent[0].body;
   const tracked=await req('platform/application-track',{code:trackingCode},'');assert.equal(tracked.status,200);assert.equal(tracked.body.status,'pending');assert.equal('email' in tracked.body,false);
   assert.equal((await req('platform/applications/status',{id:app.id,status:'accepted',version:1},school)).status,403);
   assert.equal((await req('platform/applications/status',{id:app.id,status:'accepted',version:1,direction:'culture'},curator)).status,200);
   const board=await req('platform/public-home',undefined,'');assert.ok(board.body.initiatives.some((i:any)=>i.id===app.id));assert.equal(JSON.stringify(board.body).includes('audit@example.invalid'),false);
   assert.equal((await req('platform/applications/status',{id:app.id,status:'rejected',version:2,reason:'Проверка запрета повторного решения'})).status,409);
   assert.equal((await req('platform/public-home',undefined,'',{'If-None-Match':board.etag!})).status,304);
  });
  await t.test('revision requests, withdrawal, covers, featured cards and browser likes',async()=>{
   const code=randomBytes(32).toString('hex');const created=await req('platform/applications',{...form,submissionId:randomUUID(),trackingCode:code},'');assert.equal(created.status,201);
   assert.equal((await req('platform/applications/status',{id:created.body.id,status:'needs_changes',version:1,reason:'Добавьте место проведения и подробности.'})).status,200);
   const revised=await req('platform/application-track',{code,action:'revise',version:2,direction:'culture',description:'Дополненный план полезной школьной инициативы.'},'');assert.equal(revised.status,200);assert.equal(revised.body.status,'pending');assert.equal(revised.body.direction,'culture');
   assert.equal((await req('platform/application-track',{code,action:'withdraw',version:2},'')).status,409);
   assert.equal((await req('platform/application-track',{code,action:'withdraw',version:3},'')).status,200);
   assert.equal((await req('platform/applications/status',{id:created.body.id,status:'accepted',version:4})).status,409);
   const initiative=(await req('platform/public-home',undefined,'')).body.initiatives.find((i:any)=>i.id===app.id);
   assert.equal((await req('platform/initiative-cover',{id:app.id,coverId:'cleanup',direction:'sport',version:initiative.coverVersion},school)).status,403);
   assert.equal((await req('platform/initiative-cover',{id:app.id,coverId:'cleanup',direction:'sport',version:initiative.coverVersion},curator)).status,200);
   assert.equal((await req('platform/initiative-cover',{id:app.id,coverId:'cleanup',direction:'sport',version:initiative.coverVersion},curator)).status,409);
   assert.equal((await req('platform/public-home',undefined,'')).body.initiatives.find((i:any)=>i.id===app.id).direction,'sport');
   assert.equal((await req('platform/application-track',{code:trackingCode},'')).body.direction,'sport');
   const selected={featuredInitiatives:[{initiativeId:app.id,helpNeeded:'Помощь команды'}]};assert.equal((await req('platform/homepage',selected)).status,200);
   assert.equal((await req('platform/homepage',undefined,'')).body.featuredInitiatives[0].id,app.id);
   const liked=await req('platform/initiative-like',{initiativeId:app.id,liked:true},'');assert.equal(liked.status,200);
   assert.equal((await req('platform/initiative-like',{initiativeId:app.id,liked:true},liked.cookie)).body.count,1);
   assert.ok((await req('platform/public-home',undefined,liked.cookie)).body.likedIds.includes(app.id));
   assert.equal((await req('platform/initiative-like',{initiativeId:app.id,liked:false},liked.cookie)).body.count,0);
  });
  await t.test('all four project directions publish, while activist skills remain separate',async()=>{
   for(const direction of ['education','culture','volunteering','sport']){
    const r=await req('platform/applications',{...form,submissionId:randomUUID(),trackingCode:randomBytes(32).toString('hex'),direction},'');assert.equal(r.status,201);assert.equal(r.body.direction,direction);
    assert.equal((await req('platform/applications/status',{id:r.body.id,version:1,status:'accepted'})).status,200);
    assert.equal((await req('platform/public-home',undefined,'')).body.initiatives.find((i:any)=>i.id===r.body.id).direction,direction);
   }
   const person=await req('platform/applications',{...form,submissionId:randomUUID(),trackingCode:randomBytes(32).toString('hex'),category:'Хочу быть активистом',helpArea:'Медиа',helpAreas:['Медиа','IT']},'');assert.equal(person.status,201);assert.equal(person.body.direction,undefined);assert.deepEqual(person.body.helpAreas,['Медиа','IT']);
  });
  await t.test('profile validates contacts and optimistic version; authorized staff can view all profile data',async()=>{
   assert.equal((await req('platform/profile',{version:0,email:'wrong'},school)).status,400);
   const profile={version:0,phone:'+7 (999) 123-45-67',email:'school@example.invalid',dobroUrl:'https://dobro.ru/volunteers/123456'};
   assert.equal((await req('platform/profile',profile,school)).status,200);
   assert.equal((await req('platform/profile',profile,school)).status,409);
   const profiles=await req('platform/profiles',undefined,curator);assert.equal(profiles.status,200);assert.ok(profiles.body.some((p:any)=>p.id===schoolUser.id&&p.email===profile.email));
  });
  await t.test('school takes a project, city chair approves it, dates appear in calendar',async()=>{
   const dates={startDate:'2026-10-30',endDate:'2026-10-30'};
   const proposed=await req('platform/implementation-propose',{initiativeId:app.id,scope:'school',plan:'Проведём школьную мастерскую вместе с командой активистов.',...dates},school);assert.equal(proposed.status,201);implementation=proposed.body.implementation;
   assert.equal((await req('platform/implementation-manage',{id:implementation.id,version:implementation.version,status:'active',activistSlots:1,volunteerSlots:1,...dates},school)).status,403);
   assert.equal((await req('platform/council-access',{id:curatorUser.id,version:1,branch:'Тестовая школа',councilStatus:'Председатель Екатеринбурга'})).status,200);
   const approved=await req('platform/implementation-manage',{id:implementation.id,version:implementation.version,status:'active',activistSlots:1,volunteerSlots:1,...dates},curator);assert.equal(approved.status,200);implementation=approved.body.implementation;
   const hub=await req('platform/member-hub',undefined,school);assert.ok(hub.body.calendar.some((e:any)=>e.id===implementation.id&&e.startDate===dates.startDate));
  });
  await t.test('concurrent moderation cannot overbook an implementation',async()=>{
   const ids=[];for(let i=0;i<2;i++){const result=await req('platform/applications',{...form,submissionId:randomUUID(),trackingCode:randomBytes(32).toString('hex'),category:'Хочу помочь инициативе',isInitiative:false,phone:`+7 (999) 123-45-6${i}`,email:`helper${i}@example.invalid`,supportInitiativeId:app.id,supportImplementationId:implementation.id,participationRole:'activist'},'');assert.equal(result.status,201);ids.push(result.body.id);}
   const results=await Promise.all(ids.map(id=>req('platform/applications/status',{id,status:'accepted',version:1})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  });
  await t.test('private report photos, report submission and independent confirmation',async()=>{
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
   const upload=await fetch(`${origin}/api/platform/implementation-photo`,{method:'POST',headers:{cookie:school,'Content-Type':'image/png','X-Implementation-Id':implementation.id},body:png});assert.equal(upload.status,201);photo=await upload.json();
   assert.equal((await fetch(`${origin}/api/platform/implementation-photo?id=${photo.id}`)).status,401);
   const viewed=await fetch(`${origin}/api/platform/implementation-photo?id=${photo.id}`,{headers:{cookie:admin}});assert.equal(viewed.status,200);assert.deepEqual(Buffer.from(await viewed.arrayBuffer()),png);
   const report=await req('platform/implementation-report',{id:implementation.id,version:implementation.version,eventDate:'2026-10-30',description:'Провели мастерскую, собрали команду и подготовили полезные школьные проекты.',links:['https://vk.com/wall-123_456'],photoIds:[photo.id]},school);assert.equal(report.status,200);implementation=report.body.implementation;
   assert.equal((await req('platform/implementation-review',{id:implementation.id,version:implementation.version,decision:'completed'},school)).status,403);
   const reviewed=await req('platform/implementation-review',{id:implementation.id,version:implementation.version,decision:'completed'});assert.equal(reviewed.status,200);implementation=reviewed.body.implementation;
  });
  await t.test('merit claims: evidence validation, duplicate prevention, concurrent approval and reversal',async()=>{
   assert.equal((await req('platform/merit-claim',{kind:'vk',evidence:'https://evil.invalid/post',description:'Публикация о нашей работе.'},school)).status,400);
   const claim={kind:'school',implementationId:implementation.id,description:'Проведена школьная инициатива, отчёт подтверждён.'};
   assert.equal((await req('platform/merit-claim',claim,school)).status,201);assert.equal((await req('platform/merit-claim',claim,school)).status,409);
   let hub=(await req('platform/member-hub')).body;const item=hub.claims.find((c:any)=>c.accountId===schoolUser.id);assert.ok(item);
   const review={id:item.id,version:item.version,decision:'approved',points:5,reason:'Проведение подтверждено проверенным отчётом.'};
   assert.equal((await req('platform/merit-review',review,school)).status,403);
   const reviewed=await Promise.all([req('platform/merit-review',review),req('platform/merit-review',review)]);assert.deepEqual(reviewed.map(r=>r.status).sort(),[200,409]);
   hub=(await req('platform/member-hub',undefined,school)).body;assert.equal(hub.ranking.find((r:any)=>r.id===schoolUser.id).points,5);
   const entry=hub.ledger.find((e:any)=>e.claimId===item.id);const reverse={id:entry.id,reason:'Тестовая проверка отмены ошибочного начисления.'};
   assert.equal((await req('platform/merit-reverse',reverse,curator)).status,403);
   const reversed=await Promise.all([req('platform/merit-reverse',reverse),req('platform/merit-reverse',reverse)]);assert.deepEqual(reversed.map(r=>r.status).sort(),[200,409]);
   assert.equal((await req('platform/member-hub',undefined,school)).body.ranking.find((r:any)=>r.id===schoolUser.id).points,0);
  });
  await t.test('calendar permissions, idempotency, date validation and editing conflicts',async()=>{
   const event={requestId:randomUUID(),title:`Встреча Совета ${randomUUID().slice(0,8)}`,location:'Екатеринбург',description:'Обсуждаем школьные проекты',startDate:'2026-11-05',endDate:'2026-11-05'};
   assert.equal((await req('platform/calendar-event',event,school)).status,403);
   assert.equal((await req('platform/calendar-event',{...event,startDate:'2026-02-30'},curator)).status,400);
   assert.equal((await req('platform/calendar-event',event,curator)).status,200);assert.equal((await req('platform/calendar-event',event,curator)).status,200);
   const events=(await req('platform/member-hub',undefined,school)).body.calendar.filter((e:any)=>e.title===event.title);assert.equal(events.length,1);
   assert.equal((await req('platform/calendar-event',{...event,id:events[0].id,version:99},curator)).status,409);
  });
  await t.test('maintenance closes public reads and writes, preserves admin recovery, rejects stale changes',async()=>{
   const current=(await req('platform/maintenance')).body;const change={enabled:true,message:'Проводим тестовую проверку работоспособности сервиса.',version:current.version};
   assert.equal((await req('platform/maintenance',change,school)).status,403);
   const enabled=await req('platform/maintenance',change);assert.equal(enabled.status,200);
   assert.equal((await req('platform/public-home',undefined,'')).status,503);assert.equal((await req('platform/bootstrap',undefined,school)).status,503);
   assert.equal((await req('platform/applications',{...form,submissionId:randomUUID()},'')).status,503);
   assert.equal((await login(env.AUTH_USERNAME,password)).status,200);
   assert.equal((await req('platform/bootstrap')).status,200);
   assert.equal((await req('platform/maintenance',{...change,enabled:false})).status,409);
   assert.equal((await req('platform/maintenance',{...change,enabled:false,version:enabled.body.version})).status,200);
   assert.equal((await req('platform/public-home',undefined,'')).status,200);
  });
  await t.test('password reset revokes existing sessions and old passwords',async()=>{
   const reset=await req('platform/users/reset-password',{id:schoolUser.id,credentialVersion:1});assert.equal(reset.status,200);
   assert.equal((await req('platform/bootstrap',undefined,school)).status,401);
   assert.equal((await login(schoolUser.login,reset.body.user.password)).status,200);
  });
  await t.test('malformed JSON, oversized bodies and cross-site writes are rejected',async()=>{
   const malformed=await fetch(`${origin}/api/platform/applications`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,400);
   assert.equal((await req('platform/applications',{...form,description:'x'.repeat(40000)},'')).status,413);
   assert.equal((await req('platform/homepage',{featuredInitiatives:[]},admin,{Origin:'https://foreign.invalid'})).status,403);
  });
 } finally { await new Promise<void>(r=>server.close(()=>r()));await rm(directory,{recursive:true,force:true});await closeDatabase(); }
});
