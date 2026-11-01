import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readRecordState, updateRecordState } from './recordStateStore.ts';
import { databasePool, initializeDatabase, closeDatabase } from './database.ts';
const url=process.env.AUDIT_RECORD_DATABASE_URL;
if(url&&!new URL(url).pathname.startsWith('/pervik_audit_records_'))throw Error('Record tests require a separate empty audit database');
test('SQL record store: migration, ordering, rollback, concurrent writes and cross-process invalidation',{skip:!url},async t=>{
 const env={DATABASE_URL:url};const codec={scope:'record-tests',encode:JSON.stringify,decode:JSON.parse,decodeLegacy:JSON.parse,key:(_c:string,v:unknown)=>(v as {id:string}).id};const blank={items:[]};
 try{
  await initializeDatabase(env);
  assert.equal((await databasePool(env).query('SELECT count(*)::int AS n FROM platform_state_meta')).rows[0].n,0,'Test database must be empty');
  const original={items:Array.from({length:100},(_,i)=>({id:`i-${i}`,value:i}))};
  await databasePool(env).query("INSERT INTO platform_documents(key,payload) VALUES('private-state',$1)",[JSON.stringify(original)]);
  assert.deepEqual(await readRecordState(env,blank,codec),original);
  assert.equal((await databasePool(env).query("SELECT payload FROM platform_documents WHERE key='private-state-legacy-v1'")).rows[0].payload,JSON.stringify(original));
  await t.test('repeat reads reuse an immutable snapshot; ordered moves and insertions survive reload',async()=>{
   const a=await readRecordState(env,blank,codec);assert.strictEqual(await readRecordState(env,blank,codec),a);assert.ok(Object.isFrozen(a.items[0]));
   for(let round=0;round<20;round++){
    await updateRecordState(env,blank,codec,s=>{const next=[...s.items];const moved=next.splice((round*7)%next.length,1)[0];next.splice((round*11)%next.length,0,moved);next.unshift({id:`new-${round}`,value:round});return {state:{items:next},result:null};});
    const state=await readRecordState(env,blank,codec);const rows=await databasePool(env).query("SELECT payload FROM platform_state_records WHERE collection='items' ORDER BY position,record_key");assert.deepEqual(rows.rows.map(r=>JSON.parse(r.payload)),state.items);
   }
  });
  await t.test('rollback leaves revision and values unchanged',async()=>{
   const a=await readRecordState(env,blank,codec);const revision=(await databasePool(env).query('SELECT revision FROM platform_state_meta')).rows[0].revision;
   await assert.rejects(updateRecordState(env,blank,codec,()=>{throw Error('deliberate rollback');}));assert.strictEqual(await readRecordState(env,blank,codec),a);
   assert.equal((await databasePool(env).query('SELECT revision FROM platform_state_meta')).rows[0].revision,revision);
   await assert.rejects(updateRecordState(env,blank,codec,s=>({state:{items:[s.items[0],s.items[0]]},result:null})),/Duplicate/);
  });
  await t.test('50 simultaneous writes lose no records',async()=>{
   await Promise.all(Array.from({length:50},(_,i)=>updateRecordState(env,blank,codec,s=>({state:{items:[...s.items,{id:`parallel-${i}`,value:i}]},result:null}))));
   const state=await readRecordState(env,blank,codec);assert.equal(state.items.length,170);assert.equal(new Set(state.items.map(v=>(v as {id:string}).id)).size,170);
  });
  await t.test('a second Node process invalidates the first process cache',async()=>{
   const module=new URL('./recordStateStore.ts',import.meta.url).href,dbModule=new URL('./database.ts',import.meta.url).href;
   const code=`import {updateRecordState} from ${JSON.stringify(module)};import {closeDatabase} from ${JSON.stringify(dbModule)};const codec={scope:'record-tests',encode:JSON.stringify,decode:JSON.parse,decodeLegacy:JSON.parse,key:(_c,v)=>v.id};await updateRecordState(process.env,{items:[]},codec,s=>({state:{items:[{id:'other-process',value:1},...s.items]},result:null}));await closeDatabase();`;
   await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',code],{env:{...process.env,DATABASE_URL:url},windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('exit',c=>c===0?resolve():reject(Error('Second process failed')));});
   assert.equal((await readRecordState(env,blank,codec)).items.length,171);
  });
 }finally{await closeDatabase();}
});
