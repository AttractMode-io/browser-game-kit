import {execFileSync} from 'node:child_process';
const root=new URL('./',import.meta.url).pathname;
const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:600000});
let localReady=false;
try {
 const context=run('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}']).trim();
 if(!context.startsWith('unix://')||(process.env.DOCKER_HOST&&!process.env.DOCKER_HOST.startsWith('unix://')))throw Error('Local Docker context required.');
 localReady=true;
 try{run('docker',['network','inspect','attractmode-kit-loopback']);}catch{run('docker',['network','create','-o','com.docker.network.bridge.host_binding_ipv4=127.0.0.1','attractmode-kit-loopback']);}
 run('supabase',['start','--workdir',root,'--network-id','attractmode-kit-loopback','-x','studio,imgproxy,mailpit,storage-api,realtime,edge-runtime,logflare,vector,supavisor']);
 const result=run(process.execPath,[new URL('./loopback.mjs',import.meta.url).pathname]);console.log(result.trim());
 console.log('Local provider ready. Run npm run sandbox:dev for human sign-in or npm run test:sandbox for protocol checks.');
}catch{
 if(localReady)try{run('supabase',['stop','--workdir',root]);}catch{}
 console.error('Local sandbox startup or loopback verification failed; stop any remaining kit containers before continuing. Check Docker and local port availability. Raw service output was withheld because it can contain local credentials.');process.exitCode=1;
}
