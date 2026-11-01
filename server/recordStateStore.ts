import type pg from 'pg';
import { databasePool, initializeDatabase, acquireDatabaseClient } from './database.ts';

type Shape = Record<string, unknown[]>;
type Env = Record<string, string | undefined>;
interface Codec { decodeLegacy: (payload: string) => Shape; encode: (value: unknown) => string; decode: (payload: string) => unknown; key: (collection: string, value: unknown) => string; scope: string }
interface Row { value: unknown; position: bigint }
interface Snapshot { revision: number; state: Shape; rows: Map<string, Map<string, Row>> }
const snapshots = new Map<string, Snapshot>();
const readers = new Map<string, Promise<Snapshot>>();
const keys = new WeakMap<object, Map<string, string>>();

function scope(env: Env, codec: Codec) { return `${env.DATABASE_URL}\0${codec.scope}`; }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function remember(key: string, snapshot: Snapshot) {
  const current = snapshots.get(key);
  if (!current || current.revision <= snapshot.revision) snapshots.set(key, snapshot);
  while (snapshots.size > 4) snapshots.delete(snapshots.keys().next().value!);
}
function itemKey(collection: string, value: unknown, codec: Codec): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid state record in ${collection}`);
  let saved = keys.get(value);
  const cacheKey = `${codec.scope}:${collection}`;
  const existing = saved?.get(cacheKey);
  if (existing) return existing;
  const key = codec.key(collection, value);
  if (!saved) { saved = new Map(); keys.set(value, saved); }
  saved.set(cacheKey, key); return key;
}
async function readRows(client: pg.PoolClient, blank: Shape, codec: Codec): Promise<Omit<Snapshot, 'revision'>> {
  const records = await client.query<{ collection: string; record_key: string; position: string; payload: string }>('SELECT collection, record_key, position, payload FROM platform_state_records ORDER BY collection, position, record_key');
  const state = Object.fromEntries(Object.keys(blank).map(collection => [collection, []])) as Shape;
  const rows = new Map<string, Map<string, Row>>();
  for (const record of records.rows) {
    if (!Object.hasOwn(state, record.collection)) continue;
    const value = codec.decode(record.payload);
    if (itemKey(record.collection, value, codec) !== record.record_key) throw new Error('State record identity mismatch');
    state[record.collection].push(value);
    let group = rows.get(record.collection); if (!group) { group = new Map(); rows.set(record.collection, group); }
    group.set(record.record_key, { value, position: BigInt(record.position) });
  }
  return { state: freeze(state), rows };
}
async function upsert(client: pg.PoolClient, collection: string, records: { key: string; position: bigint; payload: string }[]) {
  for (let offset = 0; offset < records.length; offset += 100) {
    const batch = records.slice(offset, offset + 100);
    const values: unknown[] = [];
    const tuples = batch.map((record, index) => { values.push(collection, record.key, record.position.toString(), record.payload); const n = index * 4; return `($${n + 1},$${n + 2},$${n + 3}::bigint,$${n + 4})`; });
    await client.query(`INSERT INTO platform_state_records(collection,record_key,position,payload) VALUES ${tuples.join(',')} ON CONFLICT(collection,record_key) DO UPDATE SET position=EXCLUDED.position,payload=EXCLUDED.payload`, values);
  }
}

async function migrate(client: pg.PoolClient, blank: Shape, codec: Codec): Promise<Snapshot> {
  await client.query("INSERT INTO platform_state_meta(id,revision) VALUES('main',0) ON CONFLICT DO NOTHING");
  const meta = await client.query<{ revision: string }>("SELECT revision FROM platform_state_meta WHERE id='main' FOR UPDATE");
  const revision = Number(meta.rows[0].revision);
  if (revision > 0) return { revision, ...await readRows(client, blank, codec) };
  const legacy = await client.query<{ payload: string }>("SELECT payload FROM platform_documents WHERE key='private-state' FOR UPDATE");
  const state = legacy.rows[0] ? codec.decodeLegacy(legacy.rows[0].payload) : Object.fromEntries(Object.keys(blank).map(key => [key, []])) as Shape;
  const rows = new Map<string, Map<string, Row>>();
  for (const [collection, entries] of Object.entries(state)) {
    const group = new Map<string, Row>(); const values = [];
    for (let index = 0; index < entries.length; index++) {
      const value = entries[index]; const key = itemKey(collection, value, codec); const position = BigInt(index) * 1024n;
      if (group.has(key)) throw new Error(`Duplicate legacy identity in ${collection}`);
      group.set(key, { value, position }); values.push({ key, position, payload: codec.encode(value) });
    }
    await upsert(client, collection, values); rows.set(collection, group);
  }
  if (legacy.rows[0]) {
    // The original encrypted snapshot is retained for recovery. Old application
    // versions must fail closed rather than silently writing a second database.
    await client.query("INSERT INTO platform_documents(key,payload) VALUES('private-state-legacy-v1',$1) ON CONFLICT DO NOTHING", [legacy.rows[0].payload]);
    await client.query("UPDATE platform_documents SET payload=$1,revision=revision+1,updated_at=now() WHERE key='private-state'", [JSON.stringify({ version: 2, storage: 'platform_state_records' })]);
  }
  await client.query("UPDATE platform_state_meta SET revision=1,updated_at=now() WHERE id='main'");
  return { revision: 1, state: freeze(state), rows };
}

export async function readRecordState(env: Env, blank: Shape, codec: Codec): Promise<Shape> {
  await initializeDatabase(env);
  const key = scope(env, codec);
  const running = readers.get(key); if (running) return (await running).state;
  const pending = (async () => {
    const metadataQuery: pg.QueryConfig & { query_timeout: number } = { text: "SELECT revision FROM platform_state_meta WHERE id='main'", query_timeout: 3000 };
    const meta = await databasePool(env).query<{ revision: string }>(metadataQuery);
    const current = snapshots.get(key);
    if (current && meta.rows[0] && current.revision === Number(meta.rows[0].revision)) return current;
    const client = await acquireDatabaseClient(env);
    try {
      if (!meta.rows[0]) {
        await client.query('BEGIN'); const migrated = await migrate(client, blank, codec); await client.query('COMMIT'); remember(key, migrated); return migrated;
      }
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const revision = await client.query<{ revision: string }>("SELECT revision FROM platform_state_meta WHERE id='main'");
      const loaded = { revision: Number(revision.rows[0].revision), ...await readRows(client, blank, codec) };
      await client.query('COMMIT'); remember(key, loaded); return loaded;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  })();
  readers.set(key, pending);
  try { return (await pending).state; } finally { if (readers.get(key) === pending) readers.delete(key); }
}

/** Keep the longest ordered group in place; inserting or moving one record must
 * not rewrite the positions of every older application or login acknowledgement. */
function positions(order: string[], old: Map<string, Row>): bigint[] {
  const tails: bigint[] = [], tailIndices: number[] = [], previous = new Map<number, number>();
  for (let index = 0; index < order.length; index++) {
    const row = old.get(order[index]); if (!row) continue;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (tails[mid] < row.position) lo = mid + 1; else hi = mid; }
    if (lo > 0) previous.set(index, tailIndices[lo - 1]);
    tails[lo] = row.position; tailIndices[lo] = index;
  }
  const anchored = new Set<number>(); let cursor = tailIndices[tails.length - 1];
  while (cursor !== undefined) { anchored.add(cursor); cursor = previous.get(cursor)!; }
  const output = new Array<bigint>(order.length); let before = -1;
  for (let next = 0; next <= order.length; next++) {
    if (next < order.length && !anchored.has(next)) continue;
    const count = next - before - 1;
    const left = before >= 0 ? output[before] : undefined;
    const right = next < order.length ? old.get(order[next])!.position : undefined;
    let step = 1024n;
    if (left !== undefined && right !== undefined) step = (right - left) / BigInt(count + 1);
    if (step <= 0n) return order.map((_, index) => BigInt(index) * 1024n);
    const start = left ?? (right !== undefined ? right - step * BigInt(count + 1) : -step);
    for (let offset = 1; offset <= count; offset++) output[before + offset] = start + step * BigInt(offset);
    if (next < order.length) output[next] = right!;
    before = next;
  }
  return output;
}

export async function updateRecordState<T>(env: Env, blank: Shape, codec: Codec, action: (state: Shape) => { state: Shape; result: T }): Promise<T> {
  await initializeDatabase(env);
  const client = await acquireDatabaseClient(env); const key = scope(env, codec);
  try {
    await client.query('BEGIN'); await client.query("SET LOCAL lock_timeout='5s'");
    let meta = await client.query<{ revision: string }>("SELECT revision FROM platform_state_meta WHERE id='main' FOR UPDATE");
    let current: Snapshot;
    if (!meta.rows[0]) current = await migrate(client, blank, codec);
    else {
      const revision = Number(meta.rows[0].revision); const cached = snapshots.get(key);
      current = cached?.revision === revision ? cached : { revision, ...await readRows(client, blank, codec) };
    }
    const updated = action(current.state);
    const nextRows = new Map(current.rows); let changed = false;
    for (const collection of Object.keys(blank)) {
      const next = updated.state[collection];
      if (!Array.isArray(next)) throw new Error(`Invalid state collection ${collection}`);
      if (next === current.state[collection]) continue;
      const old = current.rows.get(collection) || new Map<string, Row>();
      const order = next.map(value => itemKey(collection, value, codec));
      if (new Set(order).size !== order.length) throw new Error(`Duplicate state identity in ${collection}`);
      const placement = positions(order, old); const group = new Map<string, Row>();
      const writes: { key: string; position: bigint; payload: string }[] = [];
      const movedKeys: string[] = [], movedPositions: string[] = [];
      for (let index = 0; index < next.length; index++) {
        const recordKey = order[index], value = next[index], position = placement[index]; const prior = old.get(recordKey);
        group.set(recordKey, { value, position });
        if (!prior || prior.value !== value) writes.push({ key: recordKey, position, payload: codec.encode(value) });
        else if (prior.position !== position) { movedKeys.push(recordKey); movedPositions.push(position.toString()); }
      }
      const deleted = [...old.keys()].filter(id => !group.has(id));
      if (deleted.length) await client.query('DELETE FROM platform_state_records WHERE collection=$1 AND record_key=ANY($2::text[])', [collection, deleted]);
      await upsert(client, collection, writes);
      if (movedKeys.length) await client.query('UPDATE platform_state_records r SET position=m.position FROM unnest($2::text[],$3::bigint[]) AS m(key,position) WHERE r.collection=$1 AND r.record_key=m.key', [collection,movedKeys,movedPositions]);
      changed ||= writes.length > 0 || movedKeys.length > 0 || deleted.length > 0;
      nextRows.set(collection, group);
    }
    const revision = current.revision + (changed ? 1 : 0);
    if (changed) await client.query("UPDATE platform_state_meta SET revision=$1,updated_at=now() WHERE id='main'", [revision]);
    await client.query('COMMIT'); remember(key, { revision, state: freeze(updated.state), rows: nextRows });
    return updated.result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
