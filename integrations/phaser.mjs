import { mountAccountUI } from './account-ui.mjs';
// Call from Scene.create(). Phaser emits shutdown when the scene stops/restarts.
export function attachPhaserAccountUI(scene, options) {
  if (!scene?.events?.once || !scene?.events?.off) throw Error('Supply a Phaser scene with an event emitter.');
  const ui = mountAccountUI(options);
  const dispose = () => { scene.events.off('shutdown', dispose); ui.dispose(); };
  scene.events.once('shutdown', dispose);
  return { ...ui, dispose };
}
