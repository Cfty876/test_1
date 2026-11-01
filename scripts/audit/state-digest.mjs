import { createHash } from 'node:crypto';
import { readPlatformState } from '../../server/platformStore.ts';
import { closeDatabase } from '../../server/database.ts';
if (!new URL(process.env.DATABASE_URL).pathname.startsWith('/pervik_audit_')) throw new Error('Audit database required');
const state = await readPlatformState(process.env);
console.log(JSON.stringify(Object.fromEntries(Object.entries(state).map(([name, records]) => [name, { count: records.length, sha256: createHash('sha256').update(JSON.stringify(records)).digest('hex') }]))));
await closeDatabase();
