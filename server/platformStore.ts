import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { del, get, put } from '@vercel/blob';
import type { ApplicationItem, BaseMember, AccessUser } from '../src/components/DashboardView.tsx';
import type { ForwardedInitiative, Role } from '../src/utils/auth.ts';

export interface StoredAccount extends Omit<AccessUser, 'password'> {
  role: Exclude<Role, 'admin'>;
  salt: string;
  passwordHash: string;
}

export interface PlatformState {
  applications: ApplicationItem[];
  baseMembers: BaseMember[];
  accounts: StoredAccount[];
  forwardedInitiatives: ForwardedInitiative[];
}

const LEGACY_BLOB_PATH = 'pervik/private-platform-state.enc';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'platform-state.json');
const MAX_BLOB_WRITE_ATTEMPTS = 6;
const EMPTY_STATE: PlatformState = {
  applications: [],
  baseMembers: [],
  accounts: [],
  forwardedInitiatives: [],
};

let localQueue: Promise<void> = Promise.resolve();

function encryptionKey(env: Record<string, string | undefined>): Buffer {
  const secret = env.AUTH_SESSION_SECRET?.trim();
  if (!secret) throw new Error('AUTH_SESSION_SECRET is required to protect platform records');
  return createHash('sha256').update('pervik-platform-state-v1\0').update(secret).digest();
}

function encrypt(state: PlatformState, env: Record<string, string | undefined>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), data: ciphertext.toString('base64url') });
}

function decrypt(value: string, env: Record<string, string | undefined>): PlatformState {
  const envelope = JSON.parse(value) as { version?: number; iv?: string; tag?: string; data?: string };
  if (envelope.version !== 1 || !envelope.iv || !envelope.tag || !envelope.data) throw new Error('Invalid platform state envelope');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(env), Buffer.from(envelope.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64url')), decipher.final()]).toString('utf8');
  const state: unknown = JSON.parse(plaintext);
  if (!state || typeof state !== 'object') throw new Error('Invalid platform state');
  return { ...EMPTY_STATE, ...(state as Partial<PlatformState>) };
}

function privateBlobPath(env: Record<string, string | undefined>): string {
  const environment = env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  return `pervik/${environment}/private-platform-state.enc`;
}

function privateBlobStoreId(env: Record<string, string | undefined>): string {
  const environment = env.VERCEL_ENV === 'production' ? 'PRODUCTION' : 'PREVIEW';
  const storeId = env[`PRIVATE_BLOB_${environment}_STORE_ID`]?.trim();
  if (!storeId) throw new Error(`PRIVATE_BLOB_${environment}_STORE_ID is required for platform storage`);
  return storeId;
}

async function readBlobState(env: Record<string, string | undefined>): Promise<{ state: PlatformState; etag?: string; legacy?: boolean }> {
  const storeId = privateBlobStoreId(env);
  const blob = await get(privateBlobPath(env), { access: 'private', useCache: false, storeId });
  if (blob) return { state: decrypt(await new Response(blob.stream).text(), env), etag: blob.blob.etag };

  // Production can read the old encrypted snapshot from its former public store.
  // The first successful update writes it to the private store and removes the old copy.
  if (env.VERCEL_ENV === 'production') {
    const legacyToken = env.LEGACY_BLOB_READ_WRITE_TOKEN?.trim();
    const legacyStoreId = env.LEGACY_BLOB_STORE_ID?.trim() || env.BLOB_PRODUCTION_STORE_ID?.trim();
    if (legacyToken || legacyStoreId) {
      const legacyBlob = await get(LEGACY_BLOB_PATH, {
        access: 'public', useCache: false,
        ...(legacyToken ? { token: legacyToken } : { storeId: legacyStoreId }),
      });
      if (legacyBlob) return { state: decrypt(await new Response(legacyBlob.stream).text(), env), legacy: true };
    }
  }
  return { state: { ...EMPTY_STATE } };
}

async function removeLegacySnapshot(env: Record<string, string | undefined>): Promise<void> {
  const token = env.LEGACY_BLOB_READ_WRITE_TOKEN?.trim();
  const storeId = env.LEGACY_BLOB_STORE_ID?.trim() || env.BLOB_PRODUCTION_STORE_ID?.trim();
  if (!token && !storeId) return;
  try {
    await del(LEGACY_BLOB_PATH, token ? { token } : { storeId });
  } catch (error) {
    // The new private copy is authoritative even if old-ciphertext cleanup fails.
    console.error('Legacy platform snapshot cleanup failed:', error instanceof Error ? error.name : 'UnknownError');
  }
}

async function migrateLegacySnapshot(state: PlatformState, env: Record<string, string | undefined>): Promise<PlatformState> {
  try {
    await put(privateBlobPath(env), encrypt(state, env), {
      access: 'private',
      storeId: privateBlobStoreId(env),
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'application/json; charset=utf-8',
      cacheControlMaxAge: 60,
    });
    await removeLegacySnapshot(env);
    return state;
  } catch (error) {
    // Another invocation may have completed migration first; prefer its current copy.
    const current = await get(privateBlobPath(env), { access: 'private', useCache: false, storeId: privateBlobStoreId(env) });
    if (!current) throw error;
    await removeLegacySnapshot(env);
    return decrypt(await new Response(current.stream).text(), env);
  }
}

export async function readPlatformState(env: Record<string, string | undefined> = process.env): Promise<PlatformState> {
  if (env.VERCEL === '1') {
    const stored = await readBlobState(env);
    return stored.legacy ? migrateLegacySnapshot(stored.state, env) : stored.state;
  }
  try {
    return decrypt(await readFile(LOCAL_PATH, 'utf8'), env);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY_STATE };
    throw error;
  }
}

async function writeLocalState(state: PlatformState, env: Record<string, string | undefined>): Promise<void> {
  const directory = path.dirname(LOCAL_PATH);
  const temporaryPath = `${LOCAL_PATH}.${randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, encrypt(state, env), { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, LOCAL_PATH);
}

export async function updatePlatformState<T>(update: (state: PlatformState) => { state: PlatformState; result: T }, env: Record<string, string | undefined> = process.env): Promise<T> {
  if (env.VERCEL === '1') {
    // Compare-and-swap retries prevent concurrent Function requests from silently
    // overwriting each other's application or account updates.
    const storeId = privateBlobStoreId(env);
    for (let attempt = 0; attempt < MAX_BLOB_WRITE_ATTEMPTS; attempt += 1) {
      const current = await readBlobState(env);
      const updated = update(current.state);
      try {
        await put(privateBlobPath(env), encrypt(updated.state, env), {
          access: 'private',
          storeId,
          addRandomSuffix: false,
          allowOverwrite: Boolean(current.etag),
          ...(current.etag ? { ifMatch: current.etag } : {}),
          contentType: 'application/json; charset=utf-8',
          cacheControlMaxAge: 60,
        });
        if (current.legacy) await removeLegacySnapshot(env);
        return updated.result;
      } catch (error) {
        if (attempt === MAX_BLOB_WRITE_ATTEMPTS - 1) throw error;
        const backoffMs = Math.min(250 * 2 ** attempt, 4_000);
        const jitterMs = randomBytes(1)[0] % 150;
        await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
      }
    }
    throw new Error('Could not update platform state');
  }

  const task = localQueue.then(async () => {
    const updated = update(await readPlatformState(env));
    await writeLocalState(updated.state, env);
    return updated.result;
  });
  localQueue = task.then(() => undefined, () => undefined);
  return task;
}
