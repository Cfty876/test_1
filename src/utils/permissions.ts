import type { Role } from './auth.ts';

export type CabinetSection = 'overview' | 'applications' | 'base' | 'users' | 'homepage' | 'implementations' | 'ranking' | 'calendar';

const SECTIONS: Record<Role, readonly CabinetSection[]> = {
  admin: ['overview', 'applications', 'base', 'implementations', 'users', 'homepage', 'ranking', 'calendar'],
  chairman: ['implementations', 'applications', 'base', 'ranking', 'calendar'],
};

export function cabinetSections(role: Role): readonly CabinetSection[] { return SECTIONS[role]; }
export function canManageHomepage(role: Role): boolean { return role === 'admin'; }
export function canReviewAllApplications(user: { role: Role; canReviewApplications?: boolean }): boolean {
  return user.role === 'admin' || (user.role === 'chairman' && user.canReviewApplications === true);
}
export function isCuratorRoleInfo(roleInfo = ''): boolean { return /^куратор(?:\s|·|$)/iu.test(roleInfo.trim()); }

/** A school chair is not the chair of the city council. Only the assigned city office grants oversight. */
export function canOverseeImplementations(user: { role: Role; councilStatus?: string }): boolean {
  return user.role === 'admin' || (user.role === 'chairman' && user.councilStatus === 'Председатель Екатеринбурга');
}
export function canManageImplementation(user: { role: Role; login: string; councilStatus?: string; canReviewApplications?: boolean }, implementation: { ownerLogin: string }): boolean {
  return canOverseeImplementations(user) || (user.role === 'chairman' && user.login === implementation.ownerLogin && !isSchoolMember(user));
}

export function canScoreMembers(user: {role:Role;councilStatus?:string;canReviewApplications?:boolean}):boolean {
 return canOverseeImplementations(user) || (user.role==='chairman' && (user.councilStatus==='Заместитель председателя' || user.canReviewApplications===true));
}
export function canEditCalendar(user: {role:Role;councilStatus?:string;canReviewApplications?:boolean}):boolean { return canOverseeImplementations(user) || user.canReviewApplications===true; }
export function isSchoolMember(user: {role:Role;councilStatus?:string;canReviewApplications?:boolean}):boolean { return user.role==='chairman' && !canScoreMembers(user); }
