import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { GeneratedAccessCredentials } from '../src/utils/accessCredentials.ts';

const WORD_GROUPS = [
  'барсук белка бобр волк выдра гепард енот ёж жираф заяц зубр кабан кенгуру коала кошка кролик куница ласка лев леопард лиса лось медведь морж мустанг норка олень панда песец пони пума рысь сайгак собака соболь сурикат суслик тигр тюлень хорёк хомяк ягуар альпака бизон бурундук верблюд дельфин дикобраз ехидна косуля котик лама мангуст нутрия оцелот пантера росомаха серна слон тапир тушканчик утконос фенек шиншилла',
  'подсолнух ромашка василёк пион сирень тюльпан лилия астра ирис крокус ландыш мак нарцисс незабудка орхидея роза фиалка хризантема георгин гладиолус гортензия жасмин клевер колокольчик космея лаванда люпин мальва мимоза одуванчик петуния примула резеда флокс цинния шалфей эдельвейс вереск гиацинт дельфиниум календула камелия лотос магнолия настурция пеларгония пролеска ранункулюс рудбекия сакура цикламен эхинацея бегония бальзамин бархатцы вербена гербера гвоздика дицентра ипомея канна клематис маргаритка фрезия',
  'компас фонарь карандаш альбом блокнот глобус зонт картина корзина книга кружка кувшин лампа лента линейка лодка ложка маяк мел мольберт мяч ноты палитра парус пенал перо подушка полка пуговица рюкзак самовар скамейка скрипка стол стул сундук тетрадь фонтан фотоаппарат часы чашка шарф шкатулка акварель барабан бинокль браслет веер велосипед ветряк гамак гитара горшок гребень домино значок калейдоскоп конверт кораблик кубик лупа мозаика пианино полотенце',
  'весна лето осень зима январь февраль март апрель май июнь июль август сентябрь октябрь ноябрь декабрь рассвет закат утро вечер полдень сумерки радуга облако солнце луна звезда комета планета ветер бриз гроза роса иней снежинка туман капель ручей река озеро море океан волна берег остров долина вершина гора луг поляна роща лес тайга степь тропинка песок камень кристалл янтарь жемчуг родник горизонт созвездие север',
].map((group) => group.split(' '));
const PASSWORD_WORDS = WORD_GROUPS.flat().filter((word) => word.length >= 3 && word.length <= 5);

type Ticket = { id: string; login: string; password: string; expiresAt: number };
type Environment = Record<string, string | undefined>;
function key(env: Environment): Buffer {
  if (!env.AUTH_SESSION_SECRET?.trim()) throw new Error('Access credential secret is required');
  return createHash('sha256').update('pervik-generated-access-v1\0').update(env.AUTH_SESSION_SECRET.trim()).digest();
}
function pick(group: string[]): string { return group[randomInt(group.length)]; }

export function generateWordPassword(): string {
  return `${pick(PASSWORD_WORDS)}${randomInt(10_000, 100_000)}`;
}

export function issueAccessCredentials(takenLogins: string[], env: Environment): GeneratedAccessCredentials {
  const taken = new Set(takenLogins.map((login) => login.normalize('NFC').toLocaleLowerCase('ru-RU')));
  let login = '';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const first = randomInt(WORD_GROUPS.length);
    const second = (first + 1 + randomInt(WORD_GROUPS.length - 1)) % WORD_GROUPS.length;
    const candidate = `${pick(WORD_GROUPS[first])}${randomInt(10_000, 100_000)}_${pick(WORD_GROUPS[second])}`;
    if (!taken.has(candidate)) { login = candidate; break; }
  }
  if (!login) throw new Error('Could not generate a unique login');
  const payload: Ticket = { id: randomUUID(), login, password: generateWordPassword(), expiresAt: Date.now() + 15 * 60_000 };
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(env), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const ticket = Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
  return { login, password: payload.password, ticket, expiresAt: new Date(payload.expiresAt).toISOString() };
}

export function readAccessCredentials(ticket: unknown, env: Environment): Ticket | null {
  if (typeof ticket !== 'string' || ticket.length < 40 || ticket.length > 2000 || !/^[A-Za-z0-9_-]+$/.test(ticket)) return null;
  try {
    const bytes = Buffer.from(ticket, 'base64url'); if (bytes[0] !== 1 || bytes.length < 30) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(env), bytes.subarray(1, 13)); decipher.setAuthTag(bytes.subarray(13, 29));
    const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(29)), decipher.final()]).toString('utf8')) as Ticket;
    // Accept previously issued tickets until their original expiry as well.
    const validPassword = typeof payload.password === 'string' && (/^[а-яё]{3,5}\d{5}$/.test(payload.password) || /^(?:[а-яё]+\d{6}_){3}[а-яё]+$/.test(payload.password));
    if (typeof payload.id !== 'string' || !/^[a-f0-9-]{36}$/.test(payload.id) || typeof payload.login !== 'string' || !/^[а-яё]+\d{5}_[а-яё]+$/.test(payload.login) || !validPassword || typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch { return null; }
}
