import { getSnapshot, saveSnapshot, snapshotNotModified } from './snapshotCache.ts';
import {randomUUID} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {UserSession} from '../src/utils/auth.ts';
import {canScoreMembers,canEditCalendar,isCuratorRoleInfo} from '../src/utils/permissions.ts';
import {MERIT_LABELS,validDateRange,vkPost,type MeritKind,type MeritClaim,type MemberHubSnapshot,type MeritProject} from '../src/utils/memberHub.ts';
import {readPlatformState,updatePlatformState,type PlatformState} from './platformStore.ts';
import {getSessionVersion,createSessionUser} from './authApi.ts';
type Env=Record<string,string|undefined>;
interface Helpers {resolveUser:(req:IncomingMessage,env:Env)=>Promise<UserSession|null>;readBody:(req:IncomingMessage)=>Promise<Record<string,unknown>>;send:(res:ServerResponse,status:number,payload:unknown)=>void}
function actorFor(user:UserSession,state:PlatformState,req:IncomingMessage,env:Env) {if(user.role==='admin')return user;const a=state.accounts.find(a=>a.login===user.login&&a.salt===getSessionVersion(req,env));return a?createSessionUser(a.login,a.name,a.role,a):null;}
function eligible(state:PlatformState){return state.accounts.filter(a=>a.role==='chairman'&&!isCuratorRoleInfo(a.roleInfo));}
export async function handleMemberHub(req:IncomingMessage,res:ServerResponse,env:Env,h:Helpers):Promise<boolean>{
 const route=new URL(req.url||'/','http://localhost').pathname.slice('/api/platform'.length);if(!['/member-hub','/merit-claim','/merit-review','/merit-reverse','/calendar-event'].includes(route))return false;
 const reply=(status:number,payload:unknown)=>{h.send(res,status,payload);return true;};const user=await h.resolveUser(req,env);if(!user)return reply(401,{error:'Войдите в кабинет.'});
 if(route==='/member-hub'&&req.method==='GET'){
  const state=await readPlatformState(env);const actor=actorFor(user,state,req,env);if(!actor)return reply(401,{error:'Сеанс завершён.'});
  const cacheKey=`hub:${actor.login}`;if(snapshotNotModified(state,cacheKey,res))return true;const cached=getSnapshot(state,cacheKey);if(cached)return reply(200,cached);
  const accountsByLogin=new Map(state.accounts.map(a=>[a.login,a]));const accountsById=new Map(state.accounts.map(a=>[a.id,a]));
  const my=state.accounts.find(a=>a.login===actor.login);const scoring=canScoreMembers(actor);const totals=new Map<string,number>();for(const entry of state.meritLedger)totals.set(entry.accountId,(totals.get(entry.accountId)||0)+entry.points);
  let lastPoints:number|undefined,rank=0;const ranking=eligible(state).map(a=>({id:a.id,name:a.name,school:a.branch||'Школа не указана',points:totals.get(a.id)||0,rank:0,mine:a.id===my?.id})).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'ru')).map((row,index)=>{if(row.points!==lastPoints){rank=index+1;lastPoints=row.points;}return {...row,rank};});
  const calendar=state.councilEvents.filter(e=>!e.cancelled).map(e=>({id:e.id,title:e.title,description:e.description,location:e.location,startDate:e.startDate,endDate:e.endDate,version:e.version,source:'event' as const}));
  const projects=state.implementations.filter(i=>i.status!=='cancelled'&&i.startDate&&i.endDate).map(i=>({id:i.id,title:i.initiativeTitle,startDate:i.startDate!,endDate:i.endDate!,location:i.organization,description:i.status==='proposed'?'Дата предложена, запуск ещё не согласован.':'Реализация инициативы.',source:'initiative' as const,status:i.status}));
  const meritProjects:MeritProject[]=state.implementations.filter(i=>i.status==='completed'&&(scoring||i.ownerLogin===actor.login)).flatMap(i=>{const owner=accountsByLogin.get(i.ownerLogin);return owner?[{id:i.id,accountId:owner.id,title:i.initiativeTitle,location:i.organization,scope:i.scope,eventDate:i.report?.eventDate,description:i.report?.description||'',links:i.report?.links||[]}]:[];});
  const projectsById=new Map(meritProjects.map(p=>[p.id,p]));
  const snapshot:MemberHubSnapshot={ranking,projects:meritProjects,claims:state.meritClaims.filter(c=>scoring||c.accountId===my?.id).map(c=>({...c,name:accountsById.get(c.accountId)?.name||'Участник',project:c.implementationId?projectsById.get(c.implementationId):undefined})),ledger:state.meritLedger.filter(e=>scoring||e.accountId===my?.id),calendar:[...calendar,...projects].sort((a,b)=>a.startDate.localeCompare(b.startDate)),canScore:scoring,canEditCalendar:canEditCalendar(actor),myAccountId:my?.id};return reply(200,saveSnapshot(state,cacheKey,snapshot));
 }
 if(req.method!=='POST')return reply(405,{error:'Метод не поддерживается.'});const body=await h.readBody(req);
 const result=await updatePlatformState<{status:number;error?:string}>((state)=>{
  const actor=actorFor(user,state,req,env);if(!actor)return {state,result:{status:401,error:'Сеанс завершён.'}};
  const deny=(status:number,error:string)=>({state,result:{status,error}});const now=new Date().toISOString();
  if(route==='/calendar-event'){
   if(!canEditCalendar(actor))return deny(403,'События добавляют кураторы, председатель Екатеринбурга и администратор.');
   const requestId=typeof body.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(body.requestId)?body.requestId:undefined;
   if(!body.id&&!requestId)return deny(400,'Откройте форму события заново.');
   if(!body.id&&state.councilEvents.some(e=>e.requestId===requestId&&e.authorLogin===actor.login))return {state,result:{status:200}};
   const current=state.councilEvents.find(e=>e.id===body.id);if(body.id&&!current)return deny(404,'Событие не найдено.');if(current&&current.version!==body.version)return deny(409,'Событие уже изменено. Откройте его заново.');
   if(current&&body.cancel===true){return {state:{...state,councilEvents:state.councilEvents.map(e=>e.id===current.id?{...e,cancelled:true,version:e.version+1}:e)},result:{status:200}};}
   const title=typeof body.title==='string'?body.title.trim():'';const location=typeof body.location==='string'?body.location.trim():'';const description=typeof body.description==='string'?body.description.trim():'';
   if(title.length<3||title.length>160||!location||location.length>200||description.length>3000||!validDateRange(body.startDate,body.endDate))return deny(400,'Укажите название, место и корректную дату или период.');
   const event={id:current?.id||randomUUID(),title,description,location,startDate:body.startDate as string,endDate:body.endDate as string,version:(current?.version||0)+1,cancelled:false,authorName:actor.name,authorLogin:actor.login,requestId:current?.requestId||requestId};return {state:{...state,councilEvents:[event,...state.councilEvents.filter(e=>e.id!==event.id)]},result:{status:200}};
  }
  if(route==='/merit-claim'){
   const self=state.accounts.find(a=>a.login===actor.login);const recipient=eligible(state).find(a=>a.id===(body.accountId||self?.id));if(!recipient)return deny(400,'Выберите председателя из рейтинга.');if(recipient.id!==self?.id&&!canScoreMembers(actor))return deny(403,'Заявку можно подать только за себя.');
   const kind=body.kind as MeritKind;const description=typeof body.description==='string'?body.description.trim():'';if(typeof kind!=='string'||!Object.hasOwn(MERIT_LABELS,kind)||description.length<10||description.length>3000)return deny(400,'Выберите основание и опишите результат: 10–3000 символов.');
   const project=state.implementations.find(i=>i.id===body.implementationId);let evidence='';
   if(kind==='vk'){evidence=vkPost(body.evidence)||'';if(!evidence)return deny(400,'Добавьте прямую HTTPS-ссылку на пост ВКонтакте вида vk.com/wall… или vk.ru/wall….');}
   else {if(!project||project.status!=='completed'||project.ownerLogin!==recipient.login||project.scope!==kind)return deny(400,'Баллы за инициативу можно запросить после подтверждения её проведения, в её фактическом масштабе.');}
   if(state.meritClaims.some(c=>c.accountId===recipient.id&&['pending','approved'].includes(c.status)&&(kind==='vk'?c.kind==='vk'&&c.evidence===evidence:c.implementationId===project?.id)))return deny(409,'По этому результату уже есть заявка или начисление.');
   const claim:MeritClaim={id:randomUUID(),accountId:recipient.id,kind,implementationId:kind==='vk'?undefined:project!.id,evidence,description,status:'pending',version:1,createdAt:now};return {state:{...state,meritClaims:[claim,...state.meritClaims]},result:{status:201}};
  }
  if(!canScoreMembers(actor))return deny(403,'Баллы выставляют председатель, заместитель, кураторы и администратор.');
  if(route==='/merit-review'){
   const claim=state.meritClaims.find(c=>c.id===body.id);if(!claim)return deny(404,'Заявка не найдена.');if(claim.status!=='pending'||claim.version!==body.version)return deny(409,'По заявке уже принято решение. Обновите список.');
   const recipient=state.accounts.find(a=>a.id===claim.accountId);if(!recipient)return deny(404,'Участник не найден.');if(recipient.login===actor.login&&actor.role!=='admin')return deny(403,'Собственные баллы должен проверить другой проверяющий.');
   const reason=typeof body.reason==='string'?body.reason.trim():'';const points=body.points;if(reason.length<10||reason.length>1000||!['approved','rejected'].includes(String(body.decision)))return deny(400,'Напишите основание решения: 10–1000 символов.');
   if(body.decision==='approved'&&(!Number.isSafeInteger(points)||Number(points)<1||Number(points)>1000000))return deny(400,'Укажите целое положительное число баллов, не больше 1 000 000.');
   if(body.decision==='approved'&&claim.kind!=='vk'&&!state.implementations.some(i=>i.id===claim.implementationId&&i.status==='completed'&&i.scope===claim.kind&&i.ownerLogin===recipient.login))return deny(409,'Результат проекта больше не подтверждён.');
   const updated={...claim,status:body.decision as 'approved'|'rejected',version:claim.version+1,reason,reviewerName:actor.name,points:body.decision==='approved'?Number(points):undefined};
   const ledger=body.decision==='approved'?[{id:randomUUID(),claimId:claim.id,accountId:claim.accountId,points:Number(points),reason,reviewerName:actor.name,createdAt:now},...state.meritLedger]:state.meritLedger;
   return {state:{...state,meritClaims:state.meritClaims.map(c=>c.id===claim.id?updated:c),meritLedger:ledger},result:{status:200}};
  }
  if(route==='/merit-reverse'){
   if(actor.role!=='admin')return deny(403,'Отменить ошибочное начисление может администратор.');const entry=state.meritLedger.find(e=>e.id===body.id);const reason=typeof body.reason==='string'?body.reason.trim():'';
   if(!entry||entry.reversalOf)return deny(404,'Начисление не найдено.');if(state.meritLedger.some(e=>e.reversalOf===entry.id))return deny(409,'Начисление уже отменено.');if(reason.length<10||reason.length>1000)return deny(400,'Укажите причину отмены: 10–1000 символов.');
   return {state:{...state,meritLedger:[{id:randomUUID(),claimId:entry.claimId,accountId:entry.accountId,points:-entry.points,reason,reviewerName:actor.name,createdAt:now,reversalOf:entry.id},...state.meritLedger],meritClaims:state.meritClaims.map(c=>c.id===entry.claimId?{...c,status:'revoked',version:c.version+1,reason}:c)},result:{status:200}};
  }
  return deny(404,'Действие не найдено.');
 },env);return reply(result.status,result.error?{error:result.error}:{saved:true});
}
