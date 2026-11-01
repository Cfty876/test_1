import { createHash, randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { requestContext } from './httpSupport.ts';
const cache = new WeakMap<object, Map<string, unknown>>();
const identities = new WeakMap<object, string>();
function identity(value: object) { let id = identities.get(value); if (!id) { id = randomUUID(); identities.set(value, id); } return id; }
/** Check after authorization, before building a large personalized projection. */
export function snapshotNotModified(state: object, key: string, response: ServerResponse, extra?: object): boolean {
  if (!Object.isFrozen(state)) return false;
  const tag = `"${createHash('sha256').update(identity(state)).update(key).update(extra ? identity(extra) : '').digest('base64url')}"`;
  response.setHeader('ETag', tag); response.setHeader('Cache-Control', 'private, no-store'); response.setHeader('Vary', 'Cookie, Accept-Encoding');
  const request = requestContext.getStore();
  if (request?.method === 'GET' && request.headers['if-none-match']?.split(/\s*,\s*/).includes(tag)) { response.statusCode = 304; response.end(); return true; }
  return false;
}
/** Immutable database snapshots are valid across requests until their revision
 * changes. Bound personalized projections so many logins cannot grow the cache. */
export function getSnapshot<T>(state: object, key: string): T | undefined { return cache.get(state)?.get(key) as T | undefined; }
export function saveSnapshot<T>(state: object, key: string, value: T): T {
  let entries = cache.get(state); if (!entries) { entries = new Map(); cache.set(state, entries); }
  entries.delete(key); entries.set(key, value);
  while (entries.size > 8) entries.delete(entries.keys().next().value!);
  return value;
}
