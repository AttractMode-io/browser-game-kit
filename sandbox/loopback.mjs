// Repair only this sandbox's published ports; never changes Docker daemon defaults.
import {execFileSync} from 'node:child_process';
import {request} from 'node:http';
const dockerHost=execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
if(!dockerHost.startsWith('unix://')||(process.env.DOCKER_HOST&&!process.env.DOCKER_HOST.startsWith('unix://')))throw Error('Local sandbox requires a Unix-socket Docker context.');
const socketPath=dockerHost.slice(7);
const suffix='_attractmode-kit-local-sandbox';
const call=(method,path,body)=>new Promise((resolve,reject)=>{const req=request({socketPath,path:'/v1.45'+path,method,headers:{'Content-Type':'application/json'}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>{if(res.statusCode>=400)return reject(Error('Sandbox Docker operation failed ('+res.statusCode+').'));resolve(text?JSON.parse(text):null);});});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
const names=execFileSync('docker',['ps','--format','{{.Names}}'],{encoding:'utf8'}).trim().split('\n').filter(n=>n.startsWith('supabase_')&&n.endsWith(suffix));
for(const name of names){
 const d=JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8'}))[0];
 const bindings=d.HostConfig.PortBindings||{};
 if(!Object.values(bindings).some(rows=>rows?.some(r=>r.HostIp!=='127.0.0.1')))continue;
 for(const rows of Object.values(bindings))for(const row of rows||[])row.HostIp='127.0.0.1';
 const endpoints=Object.fromEntries(Object.entries(d.NetworkSettings.Networks).map(([key,n])=>[key,{Aliases:n.Aliases}]));
 await call('POST','/containers/'+name+'/stop?t=10');
 await call('DELETE','/containers/'+name);
 await call('POST','/containers/create?name='+encodeURIComponent(name),{...d.Config,HostConfig:d.HostConfig,NetworkingConfig:{EndpointsConfig:endpoints}});
 await call('POST','/containers/'+name+'/start');
 console.log('Bound sandbox service to loopback: '+name);
}
for(const name of names){const d=JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8'}))[0];for(const rows of Object.values(d.NetworkSettings.Ports||{}))for(const row of rows||[])if(row.HostIp!=='127.0.0.1')throw Error('Sandbox port is not loopback-bound; stop the sandbox.');}
console.log('Sandbox published ports verified on 127.0.0.1 only.');
