import { AsyncLocalStorage } from 'node:async_hooks';
import type { MaintenanceSettings } from '../src/utils/siteStatus.ts';

const access = new AsyncLocalStorage<{ administrator: boolean }>();
export function withMaintenanceAccess<T>(administrator: boolean, action: () => T): T { return access.run({ administrator }, action); }
export class MaintenanceModeError extends Error {
  readonly maintenance: MaintenanceSettings;
  constructor(maintenance: MaintenanceSettings) { super('MAINTENANCE_MODE'); this.maintenance = maintenance; }
}
/** Recheck inside the same state transaction as the write, including CAS retries. */
export function assertMaintenanceWriteAllowed(state: { maintenance: MaintenanceSettings[] }) {
  const current = state.maintenance[0];
  if (current?.enabled && access.getStore()?.administrator !== true) throw new MaintenanceModeError(current);
}
