import type { ApplicationItem, BaseMember, AccessUser } from '../components/DashboardView.tsx';
import type { ForwardedInitiative } from './auth.ts';

// Real contact information and operational counts should come from the
// production database. The app deliberately has no invented seed records.
export const INITIAL_APPLICATIONS: ApplicationItem[] = [];
export const INITIAL_BASE_MEMBERS: BaseMember[] = [];
export const INITIAL_ACCESS_USERS: AccessUser[] = [];
export const INITIAL_FORWARDED_INITIATIVES: ForwardedInitiative[] = [];
