import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { get, put } from '@vercel/blob';
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

const BLOB_PATH = 'pervik/private-platform-state.enc';
const LOCAL_PATH = path.join(process.cwd(), 'data', 'platform-state.json');
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

async function readBlobState(env: Record<string, string | undefined>): Promise<{ state: PlatformState; etag?: string }> {
  const blob = await get(BLOB_PATH, { access: 'public', useCache: false });
  if (!blob) return { state: { ...EMPTY_STATE } };
  return { state: decrypt(await new Response(blob.stream).text(), env), etag: blob.blob.etag };
}

export async function readPlatformState(env: Record<string, string | undefined> = process.env): Promise<PlatformState> {
  if (env.VERCEL === '1') return (await readBlobState(env)).state;
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
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await readBlobState(env);
      const updated = update(current.state);
      try {
        await put(BLOB_PATH, encrypt(updated.state, env), {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: Boolean(current.etag),
          ...(current.etag ? { ifMatch: current.etag } : {}),
          contentType: 'application/json; charset=utf-8',
          cacheControlMaxAge: 60,
        });
        return updated.result;
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
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
