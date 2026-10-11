/** Screen effects for smoke and flashbangs. Presentation only: authority already
 * decided who is blinded and where the clouds are. */
import { smokeRadius } from './voxel-ordnance.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

/** How strongly the view is filled: 1 is fully white or fully grey. */
export function utilityView(state, player, eye = null) {
  const at = eye || (player ? { x: finite(player.x) + finite(player.leanX), y: finite(player.y) + (player.crouching ? .98 : 1.62), z: finite(player.z) + finite(player.leanZ) } : null);
  let smoke = 0;
  if (at) for (const cloud of Array.isArray(state?.smokes) ? state.smokes : []) {
    const radius = smokeRadius(cloud); if (radius < .25) continue;
    const depth = 1 - Math.hypot(at.x - cloud.x, at.y - cloud.y, at.z - cloud.z) / radius;
    // The rim thins out; one step inside and the cloud is opaque.
    smoke = Math.max(smoke, clamp(depth / .22, 0, 1) * .97);
  }
  const total = finite(player?.flashTotal), remaining = finite(player?.flashTicks);
  // A flash holds full white, then fades through its last 55%.
  const flash = player?.alive !== false && total > 0 && remaining > 0 ? clamp(remaining / (total * .55), 0, 1) : 0;
  return { smoke, flash };
}

export function createUtilityOverlay(host) {
  const doc = host?.ownerDocument || globalThis.document;
  if (!doc?.createElement || !host?.appendChild) return { update() {}, element: null };
  const element = doc.createElement('div');
  element.className = 'voxel-utility-overlay'; element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '6', opacity: '0', transition: 'none' });
  host.appendChild(element);
  let last = '';
  return {
    element,
    update(view, { active = true } = {}) {
      const flash = active ? clamp(finite(view?.flash), 0, 1) : 0, smoke = active ? clamp(finite(view?.smoke), 0, 1) : 0;
      const key = `${flash.toFixed(3)}:${smoke.toFixed(3)}`; if (key === last) return; last = key;
      if (flash >= smoke * .9 && flash > 0) { element.style.background = '#fffdf6'; element.style.opacity = String(flash); }
      else { element.style.background = 'radial-gradient(circle at 50% 50%, #b9bec4 0%, #9aa0a6 70%, #8a9096 100%)'; element.style.opacity = String(smoke); }
    },
  };
}

/** A bright crack for every flash, a ringing tone for whoever it blinded, a hiss for smoke. */
export function utilityEventAudio(audio, event, playerId) {
  if (!audio?.enabled || !event) return;
  if (event.type === 'flashbang') {
    audio.noise?.(.22, { highpass: 900, lowpass: 6000, gain: .32 });
    const mine = (event.blinded || []).find(entry => entry.playerId === playerId);
    if (mine) audio.tone?.(3900, Math.min(2.4, mine.ticks / 120), { end: 3600, gain: .05, type: 'sine' });
  } else if (event.type === 'smokePop') audio.noise?.(1.1, { highpass: 300, lowpass: 2400, gain: .12 });
}
