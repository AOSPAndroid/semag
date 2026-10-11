/** Bounded first-person presentation only. Selection and combat remain immediate. */
import { WEAPONS } from './voxel-weapons.js';
import { MELEE_WEAPONS } from './voxel-melee.js';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const AXES = Object.freeze(['x', 'y', 'z', 'pitch', 'yaw', 'roll']);
const ZERO = Object.freeze(Object.fromEntries(AXES.map(axis => [axis, 0])));
const profile = (drawMs, offscreen, flourish = {}) => Object.freeze({
  holsterMs: 100, drawMs,
  offscreen: Object.freeze({ ...ZERO, ...offscreen }),
  flourish: Object.freeze({ ...ZERO, ...flourish }),
});
const PROFILES = Object.freeze({
  // The knife is pulled diagonally from the belt, then the wrist opens the grip.
  knife: profile(210, { x: .32, y: -.94, z: .16, pitch: -.82, yaw: -.30, roll: -.78 }, { x: .045, y: -.055, z: -.055, pitch: .14, yaw: .12, roll: .16 }),
  blade: profile(240, { x: .34, y: -1.95, z: .22, pitch: -1.02, yaw: -.45, roll: -.75 }, { x: .025, z: -.04, pitch: .11, roll: .12 }),
  dualBlade: profile(220, { y: -1.85, z: .18, pitch: -.82 }, { z: -.035, pitch: .10 }),
  sidearm: profile(195, { x: .14, y: -.78, z: .14, pitch: -.40, yaw: -.14, roll: -.22 }, { z: -.025, pitch: .06 }),
  gun: profile(230, { x: .10, y: -.88, z: .18, pitch: -.46, yaw: .12, roll: -.12 }, { y: -.025, z: -.035, pitch: .06 }),
  heavyGun: profile(260, { x: .08, y: -1.05, z: .22, pitch: -.52, yaw: .15, roll: -.15 }, { y: -.035, z: -.045, pitch: .065 }),
  dualGun: profile(225, { y: -.86, z: .16, pitch: -.42 }, { z: -.025, pitch: .055 }),
  potion: profile(180, { x: -.16, y: -.80, z: .12, pitch: -.14, yaw: .13, roll: .12 }, { x: -.025, z: -.025 }),
  grenade: profile(180, { x: .16, y: -.80, z: .12, pitch: -.24, yaw: -.16, roll: -.24 }, { x: .025, pitch: .055 }),
  empty: profile(160, { y: -.72, z: .10, pitch: -.15 }),
});
const HEAVY_GUNS = new Set(['marksman', 'sniper', 'lmg', 'shotgun', 'autoshotgun', 'slugshotgun']);
const SIDEARMS = new Set(['pistol', 'revolver']);

function identity(player) {
  const healing = finite(player?.healTicks) > 0;
  const kind = healing ? 'potion' : ['sword', 'potion', 'grenade', 'empty'].includes(player?.slot) ? player.slot : WEAPONS[player?.weapon] ? 'primary' : 'empty';
  const weapon = kind === 'primary' ? player.weapon : kind === 'sword' ? (Object.hasOwn(MELEE_WEAPONS, player?.meleeWeapon) ? player.meleeWeapon : 'sword') : null;
  const index = player?.inventoryIndex ?? null;
  return { kind, weapon, index };
}
const sameItem = (a, b) => a.kind === b.kind && a.weapon === b.weapon && a.index === b.index;
function itemProfile(item) {
  if (item.kind === 'sword') return item.weapon === 'knife' ? PROFILES.knife : MELEE_WEAPONS[item.weapon]?.dualWield ? PROFILES.dualBlade : PROFILES.blade;
  if (item.kind === 'primary') {
    const gun = WEAPONS[item.weapon];
    if (gun?.dualWield) return PROFILES.dualGun;
    if (HEAVY_GUNS.has(item.weapon) || ['heavy', 'sniper', 'shotgun'].includes(gun?.category)) return PROFILES.heavyGun;
    return SIDEARMS.has(item.weapon) || gun?.category === 'sidearm' ? PROFILES.sidearm : PROFILES.gun;
  }
  return PROFILES[item.kind] || PROFILES.empty;
}
const offscreenPose = (item, reducedMotion) => {
  const pose = itemProfile(item).offscreen;
  return reducedMotion ? { ...ZERO, y: pose.y } : pose;
};
const holsterDuration = reducedMotion => reducedMotion ? 40 : 100;
const drawDuration = (item, reducedMotion) => reducedMotion ? 80 : itemProfile(item).drawMs;
const mixPose = (from, to, amount) => Object.fromEntries(AXES.map(axis => [axis, from[axis] + (to[axis] - from[axis]) * amount]));
function drawPose(item, progress, reducedMotion) {
  const eased = smooth(progress), weight = 1 - eased, flourish = 4 * eased * weight;
  const start = offscreenPose(item, reducedMotion), arc = itemProfile(item).flourish;
  return Object.fromEntries(AXES.map(axis => [axis, start[axis] * weight + (reducedMotion ? 0 : arc[axis] * flourish)]));
}

/** One frozen shallow copy; no inventory array, actor or action state is written. */
function stowedSnapshot(player, item) {
  return Object.freeze({ ...player, slot: item.kind,
    reloadTicks: 0, shotCooldown: 0, burstRemaining: 0, spinTicks: 0, pendingFireTicks: 0,
    recoil: 0, heat: 0, shotIndex: 0, lastShotHand: 0,
    meleeTicks: 0, meleeCooldown: 0, pendingMeleeTicks: 0, meleeIndex: 0,
    meleePhase: 'idle', meleeAction: 'primary', meleeComboStep: 0, meleeComboConfirmed: false, meleeComboWindowTicks: 0,
    parryTicks: 0, parryCooldown: 0, meleeSecondaryCooldown: 0,
    healTicks: 0, healing: false, grenadeThrowTicks: 0,
  });
}

/**
 * Lower the old physical item before drawing the latest selected item. The
 * presenter retains at most one sanitized actor snapshot and one transition;
 * repeated wheel taps retarget that transition rather than enqueueing models.
 * Returned offsets belong to the hands/item root, never the camera or hit ray.
 */
export function createItemEquipPresenter() {
  let history = null;
  const output = (player, pose = ZERO) => Object.freeze({ player,
    phase: history?.phase || 'ready', progress: !history || history.phase === 'ready' ? 1 : clamp(history.elapsed / (history.phase === 'holster' ? holsterDuration(history.reducedMotion) : drawDuration(history.target, history.reducedMotion))),
    active: !!history && history.phase !== 'ready', suppressActions: !!history && history.phase !== 'ready',
    ...pose,
    visibleKind: history ? history.visible.kind : identity(player).kind, visibleWeapon: history ? history.visible.weapon : identity(player).weapon,
    targetKind: history ? history.target.kind : identity(player).kind, targetWeapon: history ? history.target.weapon : identity(player).weapon,
  });
  const bind = (player, time, contextKey, paused, reducedMotion) => {
    const item = identity(player);
    history = { id: player?.id, lifeId: player?.lifeId, deaths: player?.deaths, contextKey, time, paused, reducedMotion,
      phase: 'ready', elapsed: 0, visible: item, target: item, from: ZERO, snapshot: stowedSnapshot(player, item), pose: ZERO, output: null };
    history.output = output(player);
    return history.output;
  };
  const present = (player, time, contextKey = null, { paused = false, reducedMotion = false, actionActive = false } = {}) => {
    paused = paused === true; reducedMotion = reducedMotion === true;
    const valid = player && player.alive !== false && Number.isFinite(time);
    if (!valid) { history = null; return output(player); }
    const elapsed = history ? time - history.time : 0;
    const reset = !history || history.id !== player.id || history.lifeId !== player.lifeId || history.deaths !== player.deaths || history.contextKey !== contextKey
      || elapsed < 0 || (!paused && !history.paused && elapsed > 1000) || history.reducedMotion !== reducedMotion;
    if (reset) return bind(player, time, contextKey, paused, reducedMotion);
    if (paused) { history.time = time; history.paused = true; return history.output; }
    const advance = history.paused ? 0 : elapsed;
    history.time = time; history.paused = false;
    // Accepted firing, cutting, parrying, drinking and reload actions take
    // precedence over presentation. Never depict an old item doing a new hit.
    if (actionActive) return bind(player, time, contextKey, false, reducedMotion);
    const item = identity(player), changed = !sameItem(item, history.target);
    if (history.phase === 'holster') {
      // An unseen intermediate target never becomes a one-frame flash.
      history.target = item;
      history.elapsed += advance;
      const duration = holsterDuration(reducedMotion);
      if (history.elapsed < duration - 1e-9) history.pose = mixPose(history.from, offscreenPose(history.visible, reducedMotion), smooth(history.elapsed / duration));
      else {
        history.phase = 'draw'; history.elapsed = Math.max(0, history.elapsed - duration); history.visible = item;
        history.snapshot = stowedSnapshot(player, item);
        history.pose = drawPose(item, history.elapsed / drawDuration(item, reducedMotion), reducedMotion);
      }
    } else if (history.phase === 'draw') {
      history.elapsed += advance;
      history.pose = drawPose(history.visible, history.elapsed / drawDuration(history.visible, reducedMotion), reducedMotion);
      if (changed) {
        // Retarget from the actual current draw offset, retaining that one
        // visible item until it is safely stowed. No midpoint transform snap.
        history.phase = 'holster'; history.elapsed = 0; history.from = history.pose; history.target = item;
      }
    } else if (changed) {
      history.phase = 'holster'; history.elapsed = 0; history.from = ZERO; history.target = item; history.pose = ZERO;
    }
    if (history.phase === 'draw' && history.elapsed >= drawDuration(history.visible, reducedMotion) - 1e-9) {
      history.phase = 'ready'; history.elapsed = 0; history.pose = ZERO;
    }
    if (history.phase !== 'holster') {
      history.visible = item; history.target = item; history.snapshot = stowedSnapshot(player, item);
    }
    history.output = output(history.phase === 'holster' ? history.snapshot : player, history.pose);
    return history.output;
  };
  present.reset = () => { history = null; };
  return present;
}
