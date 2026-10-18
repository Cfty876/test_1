import type { IncomingMessage, ServerResponse } from 'node:http';
import { del, get, head, put } from '@vercel/blob';
import { hasAdminSession } from '../server/authApi.ts';

type Area = 'Мероприятия' | 'Медиа' | 'IT' | 'Волонтёрство';
interface Initiative {
  id: string;
  title: string;
  description: string;
  area: Area;
  author: string;
  publishedAt: string;
}
type VercelRequest = IncomingMessage & { method?: string; body?: unknown };

const LEGACY_STORE_KEY = 'pervik/public-initiatives.json';
const ALLOWED_AREAS = new Set<Area>(['Мероприятия', 'Медиа', 'IT', 'Волонтёрство']);
const MAX_WRITE_ATTEMPTS = 6;

function storeKey(): string {
  const environment = process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  return `pervik/${environment}/public-initiatives.json`;
}

function blobStoreId(): string {
  const environment = process.env.VERCEL_ENV === 'production' ? 'PRODUCTION' : 'PREVIEW';
  const storeId = process.env[`BLOB_${environment}_STORE_ID`]?.trim();
  if (!storeId) throw new Error(`BLOB_${environment}_STORE_ID is required for initiative storage`);
  return storeId;
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

async function readKey(key: string): Promise<{ initiatives: Initiative[]; etag?: string } | null> {
  const storeId = blobStoreId();
  let blob = await get(key, { access: 'public', useCache: false, storeId });
  if (!blob) return null;
  let metadata = await head(key, { storeId });
  if (metadata.etag !== blob.blob.etag) {
    blob = await get(key, { access: 'public', useCache: false, storeId });
    if (!blob) return null;
    metadata = await head(key, { storeId });
    if (metadata.etag !== blob.blob.etag) throw new Error('Initiative board changed while being read');
  }
  const data: unknown = await new Response(blob.stream).json();
  return { initiatives: Array.isArray(data) ? data as Initiative[] : [], etag: metadata.etag };
}

async function readStore(): Promise<{ initiatives: Initiative[]; etag?: string; legacy: boolean }> {
  const current = await readKey(storeKey());
  if (current) return { ...current, legacy: false };

  // Preserve the existing production board and move it on the next successful publish.
  if (process.env.VERCEL_ENV === 'production') {
    const legacy = await readKey(LEGACY_STORE_KEY);
    if (legacy) return { ...legacy, legacy: true };
  }
  return { initiatives: [], legacy: false };
}

async function writeStore(initiatives: Initiative[], etag?: string): Promise<void> {
  await put(storeKey(), JSON.stringify(initiatives), {
    access: 'public',
    storeId: blobStoreId(),
    addRandomSuffix: false,
    allowOverwrite: Boolean(etag),
    ...(etag ? { ifMatch: etag } : {}),
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
  });
}

export default async function handler(request: VercelRequest, response: ServerResponse) {
  if (request.method === 'GET') {
    try {
      return send(response, 200, (await readStore()).initiatives);
    } catch {
      return send(response, 503, { error: 'Инициативы пока недоступны: не настроено хранилище.' });
    }
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return send(response, 405, { error: 'Method not allowed' });
  }
  if (!hasAdminSession(request, process.env)) return send(response, 403, { error: 'Admin access required' });

  const body = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {};
  const id = typeof body.id === 'string' ? body.id.slice(0, 120) : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '';
  const area = body.area;
  const author = typeof body.author === 'string' ? body.author.trim().slice(0, 120) : '';
  if (!id || !title || !description || !author || typeof area !== 'string' || !ALLOWED_AREAS.has(area as Area)) {
    return send(response, 400, { error: 'Invalid initiative data' });
  }

  try {
    const initiative: Initiative = { id, title, description, area: area as Area, author, publishedAt: new Date().toISOString() };
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const current = await readStore();
      try {
        // A legacy ETag belongs to a different key and cannot guard this destination write.
        await writeStore([initiative, ...current.initiatives.filter((item) => item.id !== id)], current.legacy ? undefined : current.etag);
        if (current.legacy) {
          // The destination is committed before removing the old public snapshot.
          try {
            await del(LEGACY_STORE_KEY, { storeId: blobStoreId() });
          } catch (error) {
            console.error('Legacy initiative snapshot cleanup failed:', error instanceof Error ? error.name : 'UnknownError');
          }
        }
        return send(response, 201, initiative);
      } catch (error) {
        if (attempt === MAX_WRITE_ATTEMPTS - 1) throw error;
        const backoffMs = Math.min(100 * 2 ** attempt, 1_500);
        const jitterMs = Math.floor(Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
      }
    }
    throw new Error('Could not publish initiative');
  } catch {
    return send(response, 503, { error: 'Не удалось сохранить инициативу. Проверьте настройки хранилища.' });
  }
}
