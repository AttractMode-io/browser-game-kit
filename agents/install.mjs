import {cpSync, existsSync, lstatSync, mkdirSync, realpathSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const agentDirs = {codex: '.agents', claude: '.claude', cursor: '.cursor', gemini: '.gemini'};
export const availableSkills = ['attract-mode-integration','attract-mode-achievement-design','attract-mode-progression-integration','attract-mode-progression-qa','attract-mode-progression-release'];
export function installSkill(agent, projectPath, skill = 'attract-mode-integration') {
  if (!Object.hasOwn(agentDirs, agent) || !projectPath || !availableSkills.includes(skill)) throw new Error('Usage: node agents/install.mjs <codex|claude|cursor|gemini> <existing-game-directory> [skill-name]');
  const project = realpathSync(projectPath);
  if (!lstatSync(project).isDirectory()) throw new Error('Project must be an existing directory.');
  const segments = [agentDirs[agent], 'skills', skill];
  let target = project;
  for (const segment of segments) {
    target = join(target, segment);
    // lstat also catches dangling symlinks, unlike existsSync.
    let stat;
    try { stat = lstatSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error('Refusing non-directory or symlink destination.');
  }
  if (existsSync(target)) throw new Error('Skill already exists. Review and replace it manually; nothing was overwritten.');
  const source = fileURLToPath(new URL('../skills/' + skill, import.meta.url));
  mkdirSync(dirname(target), {recursive: true});
  cpSync(source, target, {recursive: true, force: false, errorOnExist: true});
  return target;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (![4,5].includes(process.argv.length)) throw new Error('Usage: node agents/install.mjs <codex|claude|cursor|gemini> <existing-game-directory> [skill-name]');
    console.log(`Installed project skill: ${installSkill(process.argv[2], process.argv[3], process.argv[4])}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
