import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequestGuard } from './requestGuard.ts';
import { requestContext } from './httpSupport.ts';
import { imageFormat } from './imageFormat.ts';
test('login throttling ignores forged forwarding headers and recovers service for other routes',async()=>{
 const guard=createRequestGuard({});const server=createServer((req,res)=>requestContext.run(req,()=>guard(req,res,()=>{res.statusCode=200;req.resume();res.end('{}');})));
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const a=server.address();assert.ok(a&&typeof a==='object');const root=`http://127.0.0.1:${a.port}`;
 try{
  for(let i=0;i<121;i++){const r=await fetch(root+'/api/auth/login',{method:'POST',headers:{'X-Forwarded-For':`192.0.2.${i}`},body:'{}'});assert.equal(r.status,i===120?429:200);await r.text();if(i===120)assert.equal(r.headers.get('Retry-After'),'60');}
  assert.equal((await fetch(root+'/api/platform/site-status')).status,200);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
test('photo validation rejects decompression bombs, fake/truncated headers and non-image uploads',()=>{
 assert.equal(imageFormat(Buffer.from('<svg/>')),null);assert.equal(imageFormat(Buffer.from([255,216,255,0])),null);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');assert.equal(imageFormat(png)?.width,1);
 png.writeUInt32BE(1000000,16);assert.equal(imageFormat(png),null);
});
