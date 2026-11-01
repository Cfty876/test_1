import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
const source=process.argv[2],target=process.argv[3];
if(!/^pervik_audit_[a-z0-9_]+$/.test(source||'')||!/^pervik_audit_restore_[a-z0-9_]+$/.test(target||'')||source===target)throw Error('Only separate audit databases can be restored');
await mkdir('.aistudio/production-audit',{recursive:true});const file='.aistudio/production-audit/restore-check.dump';
function command(args,input,output){return new Promise((resolve,reject)=>{const child=spawn('docker',['compose','--env-file','.env.docker.local','exec','-T','database',...args],{windowsHide:true,stdio:[input?'pipe':'ignore',output?'pipe':'inherit','inherit']});const transfer=[];if(input)transfer.push(pipeline(input,child.stdin));if(output)transfer.push(pipeline(child.stdout,output));const exited=new Promise((r,j)=>{child.on('error',j);child.on('exit',c=>c===0?r():j(Error('Database verification command failed')));});Promise.all([...transfer,exited]).then(resolve,reject);});}
await command(['pg_dump','-U','pervik','-d',source,'-Fc'],null,createWriteStream(file,{mode:0o600}));
await command(['psql','-U','pervik','-d','pervik','-v','ON_ERROR_STOP=1','-c',`CREATE DATABASE ${target}`]);
await command(['pg_restore','-U','pervik','-d',target,'--exit-on-error','--no-owner'],createReadStream(file));
console.log('Audit backup restored successfully into a separate database');
