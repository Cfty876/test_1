import type { PublicInitiative } from './publicInitiatives.ts';

export interface FeaturedSelection {
  initiativeId: string;
  helpNeeded: string;
}

export interface FeaturedInitiative extends PublicInitiative {
  helpNeeded: string;
}
