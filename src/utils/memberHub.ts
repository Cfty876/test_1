export type MeritKind = 'school' | 'district' | 'city' | 'vk';
export const MERIT_LABELS: Record<MeritKind,string> = {school:'Инициатива в школе',district:'Инициатива в районе',city:'Городская инициатива',vk:'Публикация во ВКонтакте'};
export interface MeritClaim { id:string; accountId:string; kind:MeritKind; implementationId?:string; evidence:string; description:string; status:'pending'|'approved'|'rejected'|'revoked'; version:number; createdAt:string; reviewerName?:string; reason?:string; points?:number }
export interface MeritEntry { id:string; claimId:string; accountId:string; points:number; reason:string; reviewerName:string; createdAt:string; reversalOf?:string }
export interface CouncilEvent { id:string; title:string; description:string; startDate:string; endDate:string; location:string; version:number; cancelled:boolean; authorName:string; requestId?:string; authorLogin?:string }
export interface CalendarItem {id:string;title:string;startDate:string;endDate:string;location:string;description:string;source:'event'|'initiative';status?:string;version?:number}
export interface RankingRow {id:string;name:string;school:string;points:number;rank:number;mine:boolean}
export interface MeritProject {id:string;accountId:string;title:string;location:string;scope:Exclude<MeritKind,'vk'>;eventDate?:string;description:string;links:string[]}
export interface MeritClaimView extends MeritClaim {name:string;project?:MeritProject}
export interface MemberHubSnapshot {ranking:RankingRow[];claims:MeritClaimView[];projects:MeritProject[];ledger:MeritEntry[];calendar:CalendarItem[];canScore:boolean;canEditCalendar:boolean;myAccountId?:string}
export function validDateRange(start:unknown,end:unknown): boolean {
 return typeof start==='string' && typeof end==='string' && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && Number.isFinite(Date.parse(start)) && Number.isFinite(Date.parse(end)) && new Date(start).toISOString().slice(0,10)===start && new Date(end).toISOString().slice(0,10)===end && start<=end;
}
export function vkPost(value:unknown):string|null {
 if(typeof value!=='string'||value.length>1500)return null;
 try {const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||!['vk.com','vk.ru','www.vk.com','www.vk.ru','m.vk.com','m.vk.ru'].includes(url.hostname))return null;
 const match=(url.pathname+' '+(url.searchParams.get('w')||'')).match(/(?:^|\/|\s)(wall-?\d+_\d+)(?:$|[/?\s])/);return match?`https://vk.com/${match[1]}`:null;}catch{return null;}
}
