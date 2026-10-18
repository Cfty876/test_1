import type { IncomingMessage, ServerResponse } from 'node:http';
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

const STORE_KEY = 'pervik:public-initiatives';
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ALLOWED_AREAS = new Set<Area>(['Мероприятия', 'Медиа', 'IT', 'Волонтёрство']);

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

async function readStore(): Promise<Initiative[]> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Initiative storage is not configured');
  const response = await fetch(`${UPSTASH_URL}/get/${STORE_KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!response.ok) throw new Error('Could not read initiative storage');
  const payload = await response.json() as { result?: string | null };
  if (!payload.result) return [];
  const data: unknown = JSON.parse(payload.result);
  return Array.isArray(data) ? data as Initiative[] : [];
}

async function writeStore(initiatives: Initiative[]): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Initiative storage is not configured');
  const response = await fetch(`${UPSTASH_URL}/set/${STORE_KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'text/plain; charset=utf-8' },
    body: JSON.stringify(initiatives),
  });
  if (!response.ok) throw new Error('Could not write initiative storage');
}

export default async function handler(request: VercelRequest, response: ServerResponse) {
  if (request.method === 'GET') {
    try {
      return send(response, 200, await readStore());
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
    const current = await readStore();
    await writeStore([initiative, ...current.filter((item) => item.id !== id)]);
    return send(response, 201, initiative);
  } catch {
    return send(response, 503, { error: 'Не удалось сохранить инициативу. Проверьте настройки хранилища.' });
  }
}
