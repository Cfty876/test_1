import { scrypt, randomBytes } from 'node:crypto';

let active = 0;
const waiting: (() => void)[] = [];
export class PasswordBusyError extends Error { constructor() { super('PASSWORD_QUEUE_FULL'); } }
/** Keep expensive password work off the event loop and bound worker-pool memory. */
export async function passwordHash(password: string, salt: Buffer, length = 64): Promise<Buffer> {
  if (active >= 2) {
    if (waiting.length >= 24) throw new PasswordBusyError();
    await new Promise<void>(resolve => waiting.push(resolve));
  } else active++;
  try {
    return await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, length, (error, hash) => error ? reject(error) : resolve(hash)));
  } finally {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
}
export async function makePasswordHash(password: string, salt = randomBytes(16)) {
  return { salt: salt.toString('base64url'), passwordHash: (await passwordHash(password, salt)).toString('hex') };
}
