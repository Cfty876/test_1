import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.local');
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
if (/^AUTH_PASSWORD_HASH\s*=/m.test(existing)) {
  console.error('.env.local already contains an admin password hash. Remove it only if you intend to replace the current account.');
  process.exit(1);
}

const login = 'admin';
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16);
const passwordHash = scryptSync(password, salt, 64).toString('hex');
const sessionSecret = randomBytes(48).toString('base64url');
const authConfig = [
  '# Local administrator account. Keep this file private; it is ignored by Git.',
  'AUTH_USERNAME=' + login,
  'AUTH_DISPLAY_NAME=Администратор',
  'AUTH_ROLE=admin',
  'AUTH_PASSWORD_SALT=' + salt.toString('base64url'),
  'AUTH_PASSWORD_HASH=' + passwordHash,
  'AUTH_SESSION_SECRET=' + sessionSecret,
  'AUTH_COOKIE_SECURE=false',
  '',
].join('\n');

const content = existing.trim() + (existing.trim() ? '\n\n' : '') + authConfig;
writeFileSync(envPath, content, { mode: 0o600 });
console.log(['Учётная запись создана', 'Логин: ' + login, 'Пароль: ' + password, '', 'Сохраните пароль: он больше не будет выводиться.'].join('\n'));
