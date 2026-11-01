import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit',...process.argv.slice(2)],{env:{...process.env,GOMAXPROCS:process.env.GOMAXPROCS||'2',GOMEMLIMIT:process.env.GOMEMLIMIT||'384MiB'},stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
