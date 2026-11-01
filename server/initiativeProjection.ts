import type { PublicInitiative } from '../src/utils/publicInitiatives.ts';
import type { PublicImplementation } from '../src/utils/implementations.ts';
import { comparePublicInitiatives } from '../src/utils/publicInitiatives.ts';
import { readPlatformState, type PlatformState } from './platformStore.ts';
import { readPublicInitiatives } from './publicInitiativesStore.ts';

const projections = new Map<string, { inputs: unknown[]; result: PublicInitiative[] }>();

// Approval and publication share one authoritative record. The legacy board remains
// readable, but cannot expose a pending/rejected/withdrawn application with the same ID.
export async function readPublishedInitiatives(env: Record<string, string | undefined>, snapshot?: PlatformState): Promise<PublicInitiative[]> {
  const [state, legacy] = await Promise.all([snapshot ? Promise.resolve(snapshot) : readPlatformState(env), readPublicInitiatives(env)]);
  const cacheKey = env.DATABASE_URL || env.PLATFORM_DATA_DIRECTORY || env.VERCEL_ENV || 'default';
  const inputs = [legacy, state.applications, state.accounts, state.initiativeLikes, state.implementations, state.initiativeCovers];
  const previous = projections.get(cacheKey);
  if (previous && inputs.every((value, index) => value === previous.inputs[index])) return previous.result;
  const accountByLogin = new Map(state.accounts.map(account => [account.login, account]));
  const coverById = new Map(state.initiativeCovers.map(cover => [cover.initiativeId, cover]));
  const legacyById = new Map(legacy.map(initiative => [initiative.id, initiative]));
  const likeCounts = new Map<string, number>();
  for (const like of state.initiativeLikes) likeCounts.set(like.initiativeId, (likeCounts.get(like.initiativeId) || 0) + 1);
  const accepted = new Map<string, { activists: number; volunteers: number }>();
  for (const application of state.applications) {
    if (application.status !== 'accepted' || !application.supportImplementationId) continue;
    const count = accepted.get(application.supportImplementationId) || { activists: 0, volunteers: 0 };
    if (application.participationRole === 'activist') count.activists++;
    if (application.participationRole === 'volunteer') count.volunteers++;
    accepted.set(application.supportImplementationId, count);
  }
  const implementationsByInitiative = new Map<string, PublicImplementation[]>();
  for (const item of state.implementations) {
    if (item.status === 'cancelled') continue;
    const group = implementationsByInitiative.get(item.initiativeId) || [];
    group.push({ startDate: item.startDate, endDate: item.endDate, district: item.district, id: item.id, scope: item.scope, organization: item.organization, ownerName: accountByLogin.get(item.ownerLogin)?.name || item.ownerName, status: item.status,
      activistSlots: item.activistSlots, volunteerSlots: item.volunteerSlots,
      activistsAccepted: accepted.get(item.id)?.activists || 0, volunteersAccepted: accepted.get(item.id)?.volunteers || 0 });
    implementationsByInitiative.set(item.initiativeId, group);
  }
  const applicationIds = new Set(state.applications.map((application) => application.id));
  const projected = state.applications.filter((application) => application.isInitiative && application.status === 'accepted').map((application): PublicInitiative => {
    const firstLine = application.description.split(/[.!?\n]/, 1)[0]?.trim() || 'Новая инициатива';
    const previous = legacyById.get(application.id);
    return {
      id: application.id, title: firstLine.length > 64 ? `${firstLine.slice(0, 61).trimEnd()}…` : firstLine,
      description: application.description, author: application.name,
      area: ['Медиа', 'IT', 'Волонтёрство'].includes(application.area || '') ? application.area as PublicInitiative['area'] : 'Мероприятия',
      publishedAt: application.history?.find((event) => event.status === 'accepted')?.at || previous?.publishedAt || application.updatedAt || application.createdAt || '',
    };
  });
  const result = [...projected, ...legacy.filter((initiative) => !applicationIds.has(initiative.id))].map((initiative) => ({
    ...initiative,
    coverId: coverById.get(initiative.id)?.coverId,
    coverVersion: coverById.get(initiative.id)?.version || 0,
    likeCount: likeCounts.get(initiative.id) || 0,
    implementations: implementationsByInitiative.get(initiative.id) || [],
  })).sort(comparePublicInitiatives);
  projections.set(cacheKey, { inputs, result });
  while (projections.size > 4) projections.delete(projections.keys().next().value!);
  return result;
}
