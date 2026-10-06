import { mountProgressionUI } from '../integrations/progression-ui.mjs';
const ui = mountProgressionUI({ element: document.querySelector('#progression') });
const achievement = { name: 'First finish', description: 'Complete the practice course.', unlocked: true };
ui.renderLevel({ gameName: 'Synthetic practice game', level: 3, xp: 250, nextLevelXP: 400 });
ui.renderAchievements([achievement, { name: 'Explorer', description: 'Find five different routes.', progress: 2, target: 5 }, { hidden: true, name: 'This title must stay hidden', description: 'Private hidden criteria' }]);
ui.renderLeaderboard({ period: 'This week · synthetic example', provenance: 'client-reported', entries: [{ displayName: 'Example player', score: 120, visibility: 'public' }, { displayName: 'Private player', score: 999, visibility: 'private' }] });
document.querySelector('#unlock').addEventListener('click', () => ui.showAchievement(achievement));
const status = document.querySelector('#example-status');
async function compare(recovery) {
  try {
    const choice = await ui.resolveSaveConflict({ slot: recovery ? 'Recover training save' : 'Training save', localLabel: recovery ? 'Selected history version: checkpoint 2' : 'This device: checkpoint 4', remoteLabel: 'Current cloud version: checkpoint 3', localActionLabel: recovery ? 'Restore selected version' : 'Keep device progress', remoteActionLabel: recovery ? 'Keep current cloud version' : 'Keep cloud progress',
      // Production callbacks must recheck account scope and expected revision server-side.
      onKeepLocal: async () => {}, onKeepRemote: async () => {} });
    status.textContent = choice === 'cancelled' ? 'No changes made.' : `Synthetic ${recovery ? 'recovery' : 'save'} choice: ${choice}. No real save was changed.`;
  } catch { status.textContent = 'Finish the open comparison first.'; }
}
document.querySelector('#conflict').addEventListener('click', () => compare(false));
document.querySelector('#recovery').addEventListener('click', () => compare(true));
