// Display only: authorization, reward validation and save version checks belong to your server.
export function mountProgressionUI({ element }) {
  if (!element?.ownerDocument || typeof element.replaceChildren !== 'function') throw Error('Supply a progression UI element.');
  const doc = element.ownerDocument;
  const node = (tag, text) => { const n = doc.createElement(tag); if (text !== undefined) n.textContent = String(text); return n; };
  const section = (title) => { const n = node('section'); n.append(node('h2', title)); return n; };
  const level = section('Your game progress'), achievements = section('Achievements'), leaderboard = section('Leaderboard');
  const live = node('div'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
  const container = node('div'); container.className = 'am-progression'; container.append(level, achievements, leaderboard, live);
  element.replaceChildren(container);
  let disposed = false, pending = null;
  const reset = (target, title) => target.replaceChildren(node('h2', title));
  function renderLevel({ gameName = 'This game', level: value, xp, nextLevelXP } = {}) {
    if (disposed) return; reset(level, 'Your game progress');
    if (!Number.isSafeInteger(xp) || xp < 0) { level.append(node('p', 'Progress is unavailable. You can keep playing.')); return; }
    level.append(node('p', Number.isSafeInteger(value) && value > 0 ? `${gameName}: level ${value}` : gameName), node('p', `${xp} game XP`), node('p', 'Game XP does not change your Attract Mode reputation.'));
    if (Number.isSafeInteger(nextLevelXP) && nextLevelXP > xp) level.append(node('p', `${nextLevelXP - xp} XP to the next level`));
  }
  function renderAchievements(items = []) {
    if (disposed) return; reset(achievements, 'Achievements');
    const list = node('ul');
    for (const item of items) {
      const li = node('li');
      if (item.hidden === true && item.unlocked !== true) { li.append(node('strong', 'Hidden achievement'), node('p', 'Keep playing to discover this achievement.')); }
      else {
        li.append(node('strong', item.name || 'Achievement'), node('p', item.description || ''), node('p', item.unlocked === true ? 'Unlocked' : 'Locked'));
        if (item.unlocked !== true && Number.isSafeInteger(item.progress) && item.progress >= 0 && Number.isSafeInteger(item.target) && item.target > 0) li.append(node('p', `${Math.min(item.progress, item.target)} of ${item.target}`));
      }
      list.append(li);
    }
    achievements.append(items.length ? list : node('p', 'No achievements to show yet.'));
  }
  function showAchievement(item = {}) {
    if (disposed || item.unlocked !== true) return;
    live.textContent = `Achievement unlocked: ${item.name || 'Achievement'}. ${item.description || ''}`;
  }
  function renderLeaderboard({ entries = [], period = 'All time', provenance = 'client-reported' } = {}) {
    if (disposed) return; reset(leaderboard, 'Leaderboard');
    const labels = { 'client-reported': 'Client-reported scores. These results are not verified.', 'server-validated': 'Server-validated results', authoritative: 'Authoritative game-server results' };
    leaderboard.append(node('p', period), node('p', labels[provenance] || labels['client-reported']));
    const list = node('ol');
    // Require explicit public visibility. Never use a private ID as a display-name fallback.
    const visible = entries.filter(e => e.visibility === 'public' && typeof e.displayName === 'string' && Number.isFinite(e.score));
    for (const entry of visible) list.append(node('li', `${entry.displayName}: ${entry.score}`));
    leaderboard.append(visible.length ? list : node('p', 'No public scores yet.'));
  }
  function resolveSaveConflict({ slot = 'Save', localLabel = 'Progress on this device', remoteLabel = 'Progress in the cloud', onKeepLocal, onKeepRemote, localActionLabel = 'Keep device progress', remoteActionLabel = 'Keep cloud progress' } = {}) {
    if (disposed) throw Error('Progression UI is disposed.');
    if (pending) throw Error('Resolve the open save conflict first.');
    if (typeof onKeepLocal !== 'function' || typeof onKeepRemote !== 'function') throw Error('Supply both version-aware save callbacks.');
    const dialog = node('dialog'); dialog.className = 'am-save-dialog';
    const title = node('h2', 'Choose which progress to keep'); title.id = `am-save-title-${++dialogSequence}`; dialog.setAttribute('aria-labelledby', title.id);
    const status = node('p'); status.setAttribute('role', 'status');
    dialog.append(title, node('p', `${slot} has two versions. Nothing will be replaced until you choose.`), node('p', localLabel), node('p', remoteLabel), node('p', 'Keeping one version may replace the other. You can decide later without changing either version.'), status);
    const previous = doc.activeElement;
    let busy = false, finished = false, resolve;
    const result = new Promise(r => { resolve = r; });
    const finish = value => { if (finished) return; finished = true; dialog.close(); dialog.remove(); pending = null; resolve(value); if (!disposed && previous?.isConnected) previous.focus(); };
    const button = (label, handler) => { const b = node('button', label); b.type = 'button'; b.addEventListener('click', handler); dialog.append(b); return b; };
    const choose = async (which, action) => {
      if (busy || finished || disposed) return; busy = true; buttons.forEach(b => { b.disabled = true; }); status.textContent = 'Saving your choice…';
      try { await action(); if (!disposed && !finished) finish(which); }
      catch { if (!disposed && !finished) status.textContent = 'Could not save your choice. Your progress has not been confirmed as saved. Check the connection and refresh the versions before trying again.'; }
      finally { busy = false; buttons.forEach(b => { b.disabled = false; }); }
    };
    const buttons = [button(localActionLabel, () => choose('local', onKeepLocal)), button(remoteActionLabel, () => choose('remote', onKeepRemote)), button('Decide later', () => { if (!busy) finish('cancelled'); })];
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) finish('cancelled'); });
    pending = { cancel: () => finish('cancelled') }; container.append(dialog); dialog.showModal(); buttons[2].focus();
    return result;
  }
  renderLevel(); renderAchievements(); renderLeaderboard();
  function dispose() { if (disposed) return; disposed = true; pending?.cancel(); element.replaceChildren(); }
  return { renderLevel, renderAchievements, showAchievement, renderLeaderboard, resolveSaveConflict, dispose, destroy: dispose };
}
let dialogSequence = 0;
