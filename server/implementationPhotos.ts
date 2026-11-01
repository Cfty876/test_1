import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { databasePool, initializeDatabase } from './database.ts';
import { get, put, del } from '@vercel/blob';

type Environment = Record<string, string | undefined>;
function storeId(env: Environment): string {
  const id = env[`PRIVATE_BLOB_${env.VERCEL_ENV === 'production' ? 'PRODUCTION' : 'PREVIEW'}_STORE_ID`]?.trim();
  if (!id) throw new Error('Private photo storage is not configured');
  return id;
}
function localPath(key: string, env: Environment): string {
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) throw new Error('Invalid photo key');
  return path.join(env.PLATFORM_DATA_DIRECTORY || path.join(process.cwd(), 'data'), 'implementation-photos', key);
}
function blobPath(key: string, env: Environment): string { return `pervik/${env.VERCEL_ENV === 'production' ? 'production' : 'preview'}/reports/${key}`; }
export async function savePhoto(key: string, buffer: Buffer, contentType: string, env: Environment) {
  if (env.DATABASE_URL?.trim()) { localPath(key, env); await initializeDatabase(env); await databasePool(env).query('INSERT INTO platform_files(key,content) VALUES($1,$2)', [key,buffer]); return; }
  if (env.VERCEL === '1') { await put(blobPath(key, env), buffer, { access: 'private', storeId: storeId(env), addRandomSuffix: false, contentType }); return; }
  const target = localPath(key, env); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, buffer, { flag: 'wx' });
}
export async function loadPhoto(key: string, env: Environment): Promise<Buffer> {
  if (env.DATABASE_URL?.trim()) { localPath(key,env); await initializeDatabase(env); const result = await databasePool(env).query<{content: Buffer}>('SELECT content FROM platform_files WHERE key=$1',[key]); if (!result.rows[0]) throw new Error('Photo not found'); return result.rows[0].content; }
  if (env.VERCEL !== '1') return readFile(localPath(key, env));
  const photo = await get(blobPath(key, env), { access: 'private', storeId: storeId(env), useCache: false });
  if (!photo) throw new Error('Photo not found');
  return Buffer.from(await new Response(photo.stream).arrayBuffer());
}
export async function removePhoto(key: string, env: Environment) {
  if (env.DATABASE_URL?.trim()) { localPath(key,env); await initializeDatabase(env); await databasePool(env).query('DELETE FROM platform_files WHERE key=$1',[key]); return; }
  if (env.VERCEL === '1') await del(blobPath(key, env), { storeId: storeId(env) });
  else await unlink(localPath(key, env)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
}
