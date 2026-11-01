import { performance } from 'node:perf_hooks';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { parse } from 'dotenv';
const origin = process.env.AUDIT_ORIGIN || 'http://127.0.0.1:3101';
const url = new URL(origin);
if (!['127.0.0.1','localhost'].includes(url.hostname) || !['3101','3102'].includes(url.port)) throw new Error('Only isolated audit ports are permitted');
const env = parse(await readFile('.aistudio/production-audit/audit.env','utf8'));
const label = process.argv[2] || 'baseline';
const duration = Number(process.env.AUDIT_SECONDS || 12) * 1000;
const concurrency = Number(process.env.AUDIT_CONCURRENCY || 30);
const encoded = Buffer.from(JSON.stringify({sub:env.AUTH_USERNAME,version:env.AUTH_PASSWORD_SALT,exp:Math.floor(Date.now()/1000)+1800})).toString('base64url');
const cookie = `movement_session=${encoded}.${createHmac('sha256',env.AUTH_SESSION_SECRET).update(encoded).digest('base64url')}`;
let ready=false;for(let attempt=0;attempt<30;attempt++){try{if((await fetch(origin+'/readyz',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw Error('Audit server is not ready');
const results=[];
for(const [name,path,authenticated] of [['public','/api/platform/public-home',false],['status','/api/platform/site-status',false],['admin','/api/platform/bootstrap',true],['ranking','/api/platform/member-hub',true]]) {
  const times=[]; const statuses={}; let bytes=0; const started=performance.now(); const deadline=started+duration;
  await Promise.all(Array.from({length:concurrency},async()=>{
    let etag;
    while(performance.now()<deadline){
      const at=performance.now();
      try{const response=await fetch(origin+path,{headers:{...(authenticated?{Cookie:cookie}:{}),...(process.env.AUDIT_CONDITIONAL==='true'&&etag?{'If-None-Match':etag}:{})},signal:AbortSignal.timeout(20000)}); const body=await response.arrayBuffer(); etag=response.headers.get('etag'); bytes+=Number(response.headers.get('content-length')||body.byteLength); statuses[response.status]=(statuses[response.status]||0)+1;}
      catch{statuses.transport=(statuses.transport||0)+1;}
      times.push(performance.now()-at);
    }
  }));
  const elapsed=performance.now()-started;times.sort((a,b)=>a-b);const q=n=>Math.round(times[Math.min(times.length-1,Math.floor(times.length*n))]||0);
  const result={name,concurrency,requests:times.length,rps:Number((times.length/(elapsed/1000)).toFixed(1)),p50:q(.5),p95:q(.95),p99:q(.99),statuses,bytes,elapsedMs:Math.round(elapsed)};results.push(result);console.log(JSON.stringify(result));
}
await mkdir('deliverables/production-readiness',{recursive:true});
await writeFile(`deliverables/production-readiness/${label}.json`,JSON.stringify({label,synthetic:true,origin,duration,results},null,2));
