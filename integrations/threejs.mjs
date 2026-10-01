import { mountAccountUI } from './account-ui.mjs';
// Mount beside the canvas once, never from your render loop.
export function mountThreeAccountUI(options) { return mountAccountUI(options); }
