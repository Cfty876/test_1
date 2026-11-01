import { spawn } from 'node:child_process';
import { mkdir, rename, unlink, copyFile, chmod } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const folder = path.resolve('data/backups');
await mkdir(folder, { recursive: true });
const file = path.join(folder, `postgres-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
const process = spawn('docker', ['compose', '--env-file', '.env.docker.local', 'exec', '-T', 'database', 'pg_dump', '-U', 'pervik', '-d', 'pervik', '-Fc'], { windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] });
const completed = new Promise((resolve,reject) => { process.on('error',reject); process.on('exit',code => code === 0 ? resolve() : reject(new Error(`Backup failed (${code})`))); });
try { await Promise.all([pipeline(process.stdout,createWriteStream(`${file}.tmp`, { mode: 0o600 })),completed]); await rename(`${file}.tmp`,file); await copyFile('.env.docker-app.local', `${file}.env`); await chmod(`${file}.env`, 0o600); console.log(`Database backup: ${file}`); }
catch (error) { await unlink(`${file}.tmp`).catch(() => {}); throw error; }
