import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'dotenv';

const file = '.env.docker.local';
let current = {};
try { current = parse(await readFile(file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!current.POSTGRES_PASSWORD) {
  const password = randomBytes(32).toString('hex');
  await writeFile(file, `POSTGRES_PASSWORD=${password}\nPOSTGRES_PORT=54329\nDATABASE_URL=postgresql://pervik:${password}@127.0.0.1:54329/pervik\n`, { mode: 0o600, flag: 'wx' });
}
console.log('Docker environment ready. Credentials stay in ignored .env.docker.local.');

const local = parse(await readFile('.env.local'));
const auth = Object.entries(local).filter(([key]) => key.startsWith('AUTH_'));
if (!auth.some(([key,value]) => key === 'AUTH_SESSION_SECRET' && value.trim())) throw new Error('Configure the local administrator first.');
await writeFile('.env.docker-app.local', auth.map(([key,value]) => `${key}=${JSON.stringify(value)}`).join('\n')+'\n', { mode: 0o600 });
