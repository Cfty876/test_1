import type { IncomingMessage, ServerResponse } from 'node:http';
import { readPlatformState } from './platformStore.ts';
import { DEFAULT_MAINTENANCE, type MaintenanceSettings } from '../src/utils/siteStatus.ts';

export async function readMaintenance(env: Record<string, string | undefined>): Promise<MaintenanceSettings> {
  return (await readPlatformState(env)).maintenance[0] || { ...DEFAULT_MAINTENANCE };
}
export function sendMaintenance(response: ServerResponse, maintenance: MaintenanceSettings) {
  response.statusCode = 503;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Retry-After', '60');
  response.end(JSON.stringify({ code: 'MAINTENANCE_MODE', error: 'На платформе идут технические работы.', maintenance }));
}
export async function guardMaintenance(_request: IncomingMessage, response: ServerResponse, env: Record<string, string | undefined>, administrator: boolean): Promise<boolean> {
  if (administrator) return false;
  const maintenance = await readMaintenance(env);
  if (!maintenance.enabled) return false;
  sendMaintenance(response, maintenance); return true;
}
