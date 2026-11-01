import { imageFormat } from './imageFormat.ts';
import {dobroGuideImages} from './dobroGuideAssets.ts';
import {canReviewAllApplications} from '../src/utils/permissions.ts';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {UserSession} from '../src/utils/auth.ts';
import type {MemberProfile} from '../src/utils/profile.ts';
import {readPlatformState,updatePlatformState} from './platformStore.ts';
import {getSessionVersion} from './authApi.ts';
type Env=Record<string,string|undefined>;
interface Helpers {resolveUser:(r:IncomingMessage,e:Env)=>Promise<UserSession|null>;readBody:(r:IncomingMessage)=>Promise<Record<string,unknown>>;send:(r:ServerResponse,s:number,p:unknown)=>void}
export async function handleProfile(req:IncomingMessage,res:ServerResponse,env:Env,h:Helpers){
 const url=new URL(req.url||'/','http://localhost');const route=url.pathname;
 if(!['/api/platform/profile','/api/platform/profiles','/api/platform/profile-avatar','/api/platform/dobro-guide'].includes(route))return false;
 const reply=(status:number,data:unknown)=>{h.send(res,status,data);return true;};
 const user=await h.resolveUser(req,env);if(!user)return reply(401,{error:'Войдите в кабинет.'});
 if(route==='/api/platform/dobro-guide'){
  if(req.method!=='GET')return reply(405,{error:'Доступен только просмотр.'});
  const step=url.searchParams.get('step')||'';const data=Object.hasOwn(dobroGuideImages,step)?dobroGuideImages[step]:null;if(!data)return reply(404,{error:'Изображение не найдено.'});
  res.statusCode=200;res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(Buffer.from(data,'base64'));return true;
 }
 if(route!=='/api/platform/profile'){
  if(req.method!=='GET')return reply(405,{error:'Доступен только просмотр.'});
  if(!canReviewAllApplications(user))return reply(403,{error:'Просмотр профилей доступен администратору и кураторам.'});
  const state=await readPlatformState(env);
  if(route==='/api/platform/profile-avatar'){
   const account=state.accounts.find(a=>a.id===url.searchParams.get('id'));const profile=account&&state.profiles.find(p=>p.login===account.login);
   if(!profile?.avatar)return reply(404,{error:'Фото не загружено.'});
   const match=profile.avatar.match(/^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)return reply(404,{error:'Фото не найдено.'});
   res.statusCode=200;res.setHeader('Content-Type',`image/${match[1]}`);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(Buffer.from(match[2],'base64'));return true;
  }
  const profilesByLogin=new Map(state.profiles.map(p=>[p.login,p]));
  return reply(200,state.accounts.map(a=>{const p=profilesByLogin.get(a.login);return {id:a.id,name:a.name,branch:a.branch||'',role:a.councilStatus||a.roleInfo,roleInfo:a.roleInfo,councilStatus:a.councilStatus,phone:p?.phone||'',email:p?.email||'',dobroUrl:p?.dobroUrl||'',hasAvatar:Boolean(p?.avatar),version:p?.version||0};}));
 }
 const empty:MemberProfile={login:user.login,phone:'',email:'',dobroUrl:'',avatar:'',version:0};
 if(req.method==='GET'){const state=await readPlatformState(env);return reply(200,state.profiles.find(p=>p.login===user.login)||empty);}
 if(req.method!=='POST')return reply(405,{error:'Метод не поддерживается.'});
 const body=await h.readBody(req);
 const phone=typeof body.phone==='string'?body.phone.trim():'';
 const email=typeof body.email==='string'?body.email.trim():'';
 let dobroUrl=typeof body.dobroUrl==='string'?body.dobroUrl.trim():'';
 const avatar=typeof body.avatar==='string'?body.avatar:'';
 if(phone.length>40||(phone&&(!/^[+\d\s().-]+$/.test(phone)||phone.replace(/\D/g,'').length<6||phone.replace(/\D/g,'').length>20)))return reply(400,{error:'Укажите корректный телефон или оставьте поле пустым.'});
 if(email.length>160||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return reply(400,{error:'Укажите корректную почту или оставьте поле пустым.'});
 if(dobroUrl){try{const url=new URL(dobroUrl);if(dobroUrl.length>500||url.protocol!=='https:'||!['dobro.ru','www.dobro.ru'].includes(url.hostname)||url.username||url.password||url.port||url.pathname==='/')throw new Error();url.hash='';dobroUrl=url.href;}catch{return reply(400,{error:'Добавьте HTTPS-ссылку на свой профиль на dobro.ru.'});}}
 if(avatar){const match=avatar.match(/^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match||avatar.length>22000)return reply(400,{error:'Аватарка слишком большая или имеет неверный формат.'});const bytes=Buffer.from(match[2],'base64');if(!imageFormat(bytes)||bytes.length>16384||bytes.length<16||(match[1]==='webp'?(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'):!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)))return reply(400,{error:'Выберите другую фотографию для аватарки.'});}
 const result=await updatePlatformState<{status:number;error?:string;profile?:MemberProfile}>((state)=>{
  if(user.role!=='admin'&&!state.accounts.some(a=>a.login===user.login&&a.salt===getSessionVersion(req,env)))return {state,result:{status:401,error:'Сеанс завершён.'}};
  const current=state.profiles.find(p=>p.login===user.login)||empty;
  if(body.version!==current.version)return {state,result:{status:409,error:'Профиль уже изменился. Закройте и откройте его заново перед сохранением.'}};
  const profile:MemberProfile={login:user.login,phone,email,dobroUrl,avatar,version:current.version+1,updatedAt:new Date().toISOString()};
  return {state:{...state,profiles:[profile,...state.profiles.filter(p=>p.login!==user.login)]},result:{status:200,profile}};
 },env);
 return reply(result.status,result.status===200?result.profile:{error:result.error});
}
