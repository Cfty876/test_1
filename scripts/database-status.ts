import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { readPlatformState } from '../server/platformStore.ts';
import { readPublicInitiatives } from '../server/publicInitiativesStore.ts';
import { closeDatabase, databasePool } from '../server/database.ts';
const env = { ...process.env, ...parse(await readFile('.env.local')), ...parse(await readFile('.env.docker.local')) };
try {
  const state = await readPlatformState(env);
  const board = await readPublicInitiatives(env);
  const files = await databasePool(env).query('SELECT count(*)::int AS count FROM platform_files');
  console.log(JSON.stringify({ storage: 'PostgreSQL', records: Object.fromEntries(Object.entries(state).map(([key,value]) => [key,value.length])), publicInitiatives: board.length, files: files.rows[0].count }, null, 2));
} finally { await closeDatabase(); }
