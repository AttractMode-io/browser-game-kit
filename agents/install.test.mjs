import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, mkdirSync, symlinkSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installSkill} from './install.mjs';
for (const agent of ['codex','claude','cursor','gemini']) test(`project install ${agent} preserves references and refuses overwrite`, () => {
  const root = mkdtempSync(join(tmpdir(),'am-skill-'));
  try {
    const target = installSkill(agent, root);
    assert.match(readFileSync(join(target,'SKILL.md'),'utf8'), /references\/integration.md/);
    assert.match(readFileSync(join(target,'references/integration.md'),'utf8'), /POST \/auth\/login/);
    assert.throws(() => installSkill(agent,root), /already exists/);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
test('invalid agent and linked destination rejected', () => {
  const root=mkdtempSync(join(tmpdir(),'am-skill-'));
  try {
    assert.throws(()=>installSkill('__proto__',root), /Usage/);
    mkdirSync(join(root,'elsewhere'));
    symlinkSync(join(root,'elsewhere'),join(root,'.agents'),'dir');
    assert.throws(()=>installSkill('codex',root), /symlink/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
