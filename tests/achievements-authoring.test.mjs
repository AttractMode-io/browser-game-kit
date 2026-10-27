import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runAchievementCLI} from '../tooling/achievements.mjs';
import {installSkill,availableSkills} from '../agents/install.mjs';
const manifest=new URL('../examples/achievements/manifest.json',import.meta.url).pathname;
const events=new URL('../examples/achievements/events.json',import.meta.url).pathname;
const token='am_ach_'+'a'.repeat(43),env={AM_ACHIEVEMENTS_AUTHORING_TOKEN:token};
test('fixture grants exactly one achievement and XP despite replay and negative events',async()=>{
 const result=await runAchievementCLI(['simulate',manifest,events]);assert.equal(result.valid,true);assert.equal(result.state.xp,25);assert.equal(Object.keys(result.state.earned).length,1);assert.equal(result.receipts[2].replayed,true);
});
test('draft is preview by default and execution needs explicit environment and scoped authoring token',async()=>{
 const args=['draft',manifest,'--project','game-project','--revision','0'];let calls=0;const fetch=async()=>{calls++;return Response.json({revision:1});};
 const preview=await runAchievementCLI(args,{env,fetch});assert.equal(preview.executed,false);assert.equal(preview.request.action,'draft.save');assert.equal(calls,0);
 await assert.rejects(runAchievementCLI([...args,'--execute'],{env,fetch}),/explicit --environment/);
 await assert.rejects(runAchievementCLI([...args,'--execute','--environment','sandbox'],{env:{AM_ACHIEVEMENTS_AUTHORING_TOKEN:'am_pg_runtime'},fetch}),/authoring token/);
 const result=await runAchievementCLI([...args,'--execute','--environment','sandbox'],{env,fetch});assert.equal(result.result.revision,1);assert.equal(calls,1);
});
test('publication binds exact hash/revision/project/environment; refuses token exfiltration and production ambiguity',async()=>{
 const args=['publish','--project','game-project','--set','harbor-base','--revision','3','--hash','a'.repeat(64),'--idempotency','release-3','--execute','--environment','production'];let sent;
 const fetch=async(url,init)=>{sent={url:String(url),...init};return Response.json({releaseId:'release-3'});};
 await assert.rejects(runAchievementCLI(args,{env,fetch}),/confirm-production/);
 await assert.rejects(runAchievementCLI([...args,'--confirm-production','game-project','--origin','https://evil.test'],{env,fetch}),/only target/);
 const result=await runAchievementCLI([...args,'--confirm-production','game-project'],{env,fetch});
 assert.equal(result.executed,true);assert.equal(sent.url,'https://attractmode.io/api/achievements/authoring');assert.equal(sent.redirect,'error');assert.equal(sent.headers.Authorization,`Bearer ${token}`);assert.deepEqual(JSON.parse(sent.body),{action:'release.publish',expectedEnvironment:'production',data:{projectId:'game-project',expectedRevision:3,setId:'harbor-base',expectedHash:'a'.repeat(64),idempotencyKey:'release-3'}});assert.doesNotMatch(JSON.stringify(result),/am_ach_/);
});
test('remote error details cannot echo token into CLI errors',async()=>{
 await assert.rejects(runAchievementCLI(['get','--project','p','--set','s','--execute','--environment','sandbox'],{env,fetch:async()=>Response.json({error:token},{status:403})}),e=>!e.message.includes(token)&&e.message.includes('403'));
});
test('export never overwrites an existing manifest',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'am-ach-cli-'));try{const out=join(dir,'export.json');await runAchievementCLI(['export',manifest,out]);const before=await readFile(out,'utf8');await assert.rejects(runAchievementCLI(['export',manifest,out]));assert.equal(await readFile(out,'utf8'),before);}finally{await rm(dir,{recursive:true,force:true});}
});
test('all new skills install project-locally with overwrite and path-traversal protection',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'am-ach-skills-'));try{for(const skill of availableSkills.slice(1)){const path=installSkill('codex',dir,skill);assert.match(await readFile(join(path,'SKILL.md'),'utf8'),/docs\/achievements.md/);assert.throws(()=>installSkill('codex',dir,skill),/already exists/);}assert.throws(()=>installSkill('codex',dir,'../../steal'),/Usage/);}finally{await rm(dir,{recursive:true,force:true});}
});
