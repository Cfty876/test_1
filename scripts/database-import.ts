import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import { readPlatformState } from '../server/platformStore.ts';
import { readPublicInitiatives } from '../server/publicInitiativesStore.ts';
import { databasePool, initializeDatabase, closeDatabase } from '../server/database.ts';

// Only imports the existing LOCAL source. Never reads or modifies production.
const local = parse(await readFile('.env.local'));
const target: Record<string, string | undefined> = { ...process.env, ...local, ...parse(await readFile('.env.docker.local')) };
const source: Record<string, string | undefined> = { ...process.env, ...local, VERCEL: undefined, DATABASE_URL: undefined };
const directory = source.PLATFORM_DATA_DIRECTORY || path.join(process.cwd(), 'data');
const backup = path.join(directory, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
try {
  const state = await readPlatformState(source);
  const board = await readPublicInitiatives(source);
  const encrypted = await readFile(path.join(directory, 'platform-state.json'), 'utf8');
  await mkdir(backup, { recursive: true });
  await copyFile(path.join(directory, 'platform-state.json'), path.join(backup, 'platform-state.json'));
  await copyFile('.env.local', path.join(backup, 'local.env'));
  if (!local.AUTH_SESSION_SECRET?.trim()) throw new Error('Local encryption key missing. Import stopped.');
  await writeFile(path.join(backup, 'public-initiatives.json'), JSON.stringify(board));
  // The encryption key is required for both SQL state and recovery; do not print it.
  await writeFile(path.join(backup, 'recovery.env'), `AUTH_SESSION_SECRET=${local.AUTH_SESSION_SECRET}\n`, { mode: 0o600 });
  await initializeDatabase(target);
  const client = await databasePool(target).connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE platform_documents IN EXCLUSIVE MODE');
    const existing = await client.query('SELECT key FROM platform_documents UNION ALL SELECT id AS key FROM platform_state_meta LIMIT 1');
    if (existing.rowCount) throw new Error('Database already has records. Import stopped without replacing them.');
    await client.query('INSERT INTO platform_documents(key,payload) VALUES($1,$2),($3,$4)', ['private-state', encrypted, 'public-initiatives', JSON.stringify(board)]);
    let files: string[] = [];
    try { files = await readdir(path.join(directory, 'implementation-photos')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    for (const name of files.filter(name => /^[a-f0-9-]+\.(jpg|png|webp)$/.test(name))) {
      const bytes = await readFile(path.join(directory, 'implementation-photos', name));
      await client.query('INSERT INTO platform_files(key,content) VALUES($1,$2)', [name, bytes]);
      await mkdir(path.join(backup, 'implementation-photos'), { recursive: true });
      await writeFile(path.join(backup, 'implementation-photos', name), bytes);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  const imported = await readPlatformState(target);
  const importedBoard = await readPublicInitiatives(target);
  if (JSON.stringify(imported) !== JSON.stringify(state) || JSON.stringify(importedBoard) !== JSON.stringify(board)) throw new Error('Imported data verification failed; connection has not been switched.');
  const original = await readFile('.env.local', 'utf8');
  const next = original.replace(/^DATABASE_URL=.*(?:\r?\n|$)/gm, '').trimEnd();
  await writeFile('.env.local', `${next}\nDATABASE_URL=${target.DATABASE_URL}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ imported: Object.fromEntries(Object.entries(state).map(([key,value]) => [key,value.length])), publicInitiatives: board.length, backup, databaseConnected: true }, null, 2));
} finally { await closeDatabase(); }
