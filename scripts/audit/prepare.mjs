import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import {parse} from 'dotenv';
import pg from 'pg';
const directory='.aistudio/production-audit';
try { await access(`${directory}/audit.env`); throw Error('An audit environment already exists. Preserve its key; use it or archive that folder before preparing a new one.'); } catch(error) { if(error.code!=='ENOENT')throw error; }
const local=parse(await readFile('.env.docker.local','utf8'));let address;try{address=new URL(local.DATABASE_URL);}catch{throw Error('Configure the local Docker database first');}
if(!['127.0.0.1','localhost'].includes(address.hostname))throw Error('Audit preparation supports only the local Docker database');
const name=`pervik_audit_${Date.now()}`;
const client=new pg.Client({connectionString:address.href,connectionTimeoutMillis:5000});await client.connect();
try{await client.query(`CREATE DATABASE ${name}`);}finally{await client.end();}
address.pathname=`/${name}`;address.hostname='database';address.port='5432';
const salt=randomBytes(16),password=randomBytes(24).toString('hex');const env={DATABASE_URL:address.href,AUTH_USERNAME:'audit-admin',AUTH_ROLE:'admin',AUTH_DISPLAY_NAME:'Тестовый администратор',AUTH_SESSION_SECRET:randomBytes(32).toString('hex'),AUTH_PASSWORD_SALT:salt.toString('base64url'),AUTH_PASSWORD_HASH:scryptSync(password,salt,64).toString('hex'),AUDIT_PASSWORD:password,AUTH_COOKIE_SECURE:'false',RATE_LIMIT_ENABLED:'false',NODE_OPTIONS:'--max-old-space-size=768'};
await mkdir(directory,{recursive:true});await writeFile(`${directory}/audit.env`,Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
await writeFile(`${directory}/compose.yaml`, `name: pervik-audit\nservices:\n  app:\n    image: pervik-app:audit-improved\n    env_file: audit.env\n    ports: ['127.0.0.1:3101:3000']\n    cpus: 2\n    mem_limit: 1g\n    read_only: true\n    tmpfs: ['/tmp:size=64m,mode=1777']\n    init: true\n    volumes: [../../scripts/audit:/app/scripts/audit:ro]\n    networks: [platform]\nnetworks:\n  platform: {external: true, name: pervik_default}\n`);
console.log('Isolated audit database and ignored environment prepared. No working records were copied.');
