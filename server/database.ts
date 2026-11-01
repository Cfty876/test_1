import pg from 'pg';

type Environment = Record<string, string | undefined>;
const pools = new Map<string, pg.Pool>();
const initialized = new WeakMap<pg.Pool, Promise<void>>();
const documents = new WeakMap<pg.Pool, Map<string, { revision: string; payload: string }>>();
const documentReaders = new WeakMap<pg.Pool, Map<string, Promise<string | null>>>();

export class DatabaseBusyError extends Error { constructor() { super('DATABASE_BUSY'); } }
function setting(env: Environment, key: string, fallback: number, max: number): number {
  const value = Number(env[key] || fallback);
  return Number.isSafeInteger(value) && value > 0 && value <= max ? value : fallback;
}

export function databasePool(env: Environment): pg.Pool {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is required');
  let pool = pools.get(url);
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: setting(env,'DB_POOL_MAX',8,50), connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 15000, query_timeout: 20000, application_name: 'pervik' });
    pool.on('error', () => console.error('PostgreSQL connection interrupted'));
    pools.set(url, pool);
  }
  return pool;
}

export async function acquireDatabaseClient(env: Environment): Promise<pg.PoolClient> {
  const pool = databasePool(env);
  if (pool.waitingCount >= setting(env,'DB_QUEUE_MAX',128,10000)) throw new DatabaseBusyError();
  return pool.connect();
}

export async function initializeDatabase(env: Environment): Promise<void> {
  const pool = databasePool(env);
  let pending = initialized.get(pool);
  if (!pending) {
    pending = pool.query(`CREATE TABLE IF NOT EXISTS platform_documents (
      key text PRIMARY KEY,
      payload text NOT NULL,
      revision bigint NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now()
    ); CREATE TABLE IF NOT EXISTS platform_files (key text PRIMARY KEY, content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS platform_state_meta (id text PRIMARY KEY, revision bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS platform_state_records (collection text NOT NULL, record_key text NOT NULL, position bigint NOT NULL, payload text NOT NULL, PRIMARY KEY(collection,record_key));
    CREATE INDEX IF NOT EXISTS platform_state_records_order ON platform_state_records(collection,position);
    `).then(() => undefined).catch(error => { initialized.delete(pool); throw error; });
    initialized.set(pool, pending);
  }
  await pending;
}

export async function readDatabaseDocument(key: string, env: Environment): Promise<string | null> {
  await initializeDatabase(env);
  const pool = databasePool(env);
  let readers = documentReaders.get(pool); if (!readers) { readers = new Map(); documentReaders.set(pool, readers); }
  if (readers.has(key)) return readers.get(key)!;
  const pending = (async () => {
    const client = await acquireDatabaseClient(env);
    try {
      const revision = await client.query<{ revision: string }>('SELECT revision FROM platform_documents WHERE key=$1', [key]);
      if (!revision.rows[0]) return null;
      const cache = documents.get(pool) || new Map(); documents.set(pool, cache);
      const previous = cache.get(key); if (previous?.revision === revision.rows[0].revision) return previous.payload;
      const result = await client.query<{ payload: string; revision: string }>('SELECT payload,revision FROM platform_documents WHERE key=$1', [key]);
      if (!result.rows[0]) return null;
      cache.set(key, result.rows[0]); return result.rows[0].payload;
    } finally { client.release(); }
  })();
  readers.set(key, pending);
  try { return await pending; } finally { readers.delete(key); }
}

// One connection and a row lock protect the existing synchronous state transitions.
// Private state remains AES-GCM encrypted, including accounts and contact details.
export async function updateDatabaseDocument<T>(key: string, initial: string, update: (payload: string) => { payload: string; result: T }, env: Environment): Promise<T> {
  await initializeDatabase(env);
  const client = await acquireDatabaseClient(env);
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query('INSERT INTO platform_documents(key,payload) VALUES($1,$2) ON CONFLICT(key) DO NOTHING', [key, initial]);
    const current = await client.query<{ payload: string }>('SELECT payload FROM platform_documents WHERE key=$1 FOR UPDATE', [key]);
    const next = update(current.rows[0].payload);
    await client.query('UPDATE platform_documents SET payload=$2, revision=revision+1, updated_at=now() WHERE key=$1', [key, next.payload]);
    await client.query('COMMIT');
    return next.result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function closeDatabase(): Promise<void> {
  await Promise.all([...pools.values()].map(pool => pool.end()));
  pools.clear();
}
