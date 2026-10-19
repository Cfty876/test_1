import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { del, put } from '@vercel/blob';
import { readBlobDocument } from './blobDocument.ts';
import type { PublicInitiative } from '../src/utils/publicInitiatives.ts';

type Environment = Record<string, string | undefined>;
const LEGACY_KEY = 'pervik/public-initiatives.json';
let localQueue: Promise<void> = Promise.resolve();

function storeId(env: Environment): string {
  const key = `BLOB_${env.VERCEL_ENV === 'production' ? 'PRODUCTION' : 'PREVIEW'}_STORE_ID`;
  const id = env[key]?.trim();
  if (!id) throw new Error(`${key} is required for initiative storage`);
  return id;
}

function storeKey(env: Environment): string {
  return `pervik/${env.VERCEL_ENV === 'production' ? 'production' : 'preview'}/public-initiatives.json`;
}

async function readBlob(key: string, env: Environment) {
  const blob = await readBlobDocument(key, storeId(env), 'public');
  if (!blob) return null;
  const value: unknown = JSON.parse(blob.value);
  if (!Array.isArray(value)) throw new Error('Invalid initiative board');
  return { initiatives: value as PublicInitiative[], etag: blob.etag };
}

async function readStore(env: Environment) {
  if (env.VERCEL !== '1') {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(env.PLATFORM_DATA_DIRECTORY || path.join(process.cwd(), 'data'), 'public-initiatives.json'), 'utf8'));
      if (!Array.isArray(value)) throw new Error('Invalid initiative board');
      return { initiatives: value as PublicInitiative[], etag: undefined, legacy: false };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { initiatives: [] as PublicInitiative[], etag: undefined, legacy: false };
    }
  }
  const current = await readBlob(storeKey(env), env);
  if (current) return { ...current, legacy: false };
  const legacy = env.VERCEL_ENV === 'production' ? await readBlob(LEGACY_KEY, env) : null;
  return legacy ? { ...legacy, legacy: true } : { initiatives: [] as PublicInitiative[], etag: undefined, legacy: false };
}

export async function readPublicInitiatives(env: Environment = process.env): Promise<PublicInitiative[]> {
  return (await readStore(env)).initiatives;
}

export async function savePublicInitiative(initiative: PublicInitiative, env: Environment = process.env): Promise<PublicInitiative> {
  const write = async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const current = await readStore(env);
      // Retrying publication must not move the original publication date.
      const saved = { ...initiative, publishedAt: current.initiatives.find((item) => item.id === initiative.id)?.publishedAt || initiative.publishedAt };
      const initiatives = [saved, ...current.initiatives.filter((item) => item.id !== saved.id)];
      if (env.VERCEL !== '1') {
        const directory = env.PLATFORM_DATA_DIRECTORY || path.join(process.cwd(), 'data');
        await mkdir(directory, { recursive: true });
        const file = path.join(directory, 'public-initiatives.json');
        const temporary = `${file}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(initiatives), 'utf8');
        await rename(temporary, file);
        return saved;
      }
      try {
        const etag = current.legacy ? undefined : current.etag;
        await put(storeKey(env), JSON.stringify(initiatives), {
          access: 'public', storeId: storeId(env), addRandomSuffix: false,
          allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}),
          contentType: 'application/json; charset=utf-8', cacheControlMaxAge: 60,
        });
        if (current.legacy) await del(LEGACY_KEY, { storeId: storeId(env) }).catch(() => undefined);
        return saved;
      } catch (error) {
        if (attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
      }
    }
    throw new Error('Could not publish initiative');
  };
  if (env.VERCEL === '1') return write();
  const task = localQueue.then(write);
  localQueue = task.then(() => undefined, () => undefined);
  return task;
}
