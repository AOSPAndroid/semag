/** Learnable spray patterns shared by authority, presentation and the loadout preview.
 * Each accepted round adds a fixed kick chosen by its position in the current
 * spray. The same gun always walks the same path, so players can learn to pull
 * against it. Kicks are multiples of the weapon's base `recoil` impulse. */
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

export const RECOIL = Object.freeze({
  pitchCap: .13, yawCap: .07, recoveryPerSecond: .04, adsMultiplier: .62,
  // A pause longer than this many ticks beyond the gun's own cycle begins to
  // rewind the spray: one pattern step per `rewindTicks`.
  resetDelayTicks: 24, rewindTicks: 5,
});

/** Pattern families. `pitch` and `yaw` are kick multipliers per spray step.
 * `side` flips the horizontal direction so similar guns can still differ. */
const TEMPLATES = Object.freeze({
  // Rifles: a straight climb, then a wide sweep one way and back the other.
  rifle: step => step < 6 ? { pitch: 1, yaw: .06 }
    : step < 12 ? { pitch: .45, yaw: .55 }
      : { pitch: .3, yaw: Math.floor((step - 12) / 6) % 2 === 0 ? -.65 : .6 },
  // SMGs: a short climb, then a tight three-shot zigzag.
  smg: step => step < 4 ? { pitch: .9, yaw: 0 }
    : { pitch: .4, yaw: Math.floor((step - 4) / 3) % 2 === 0 ? .7 : -.7 },
  // Machine guns: a long climb, then a slow wide drift that reverses every twelve rounds.
  lmg: step => step < 9 ? { pitch: 1, yaw: .04 }
    : { pitch: .2, yaw: Math.floor((step - 9) / 12) % 2 === 0 ? .4 : -.4 },
  // Bursts: each three-round group climbs and leans slightly to one side.
  burst: step => ({ pitch: 1, yaw: step % 3 === 0 ? 0 : .22 }),
  // One-shot guns: vertical kick with a small, consistent side bias.
  single: () => ({ pitch: 1, yaw: .16 }),
});

/** Every gun names its pattern and first sweep direction (+1 right, -1 left). */
const PATTERNS = Object.freeze({
  carbine: ['rifle', -1], battlerifle: ['rifle', 1], bulldog: ['rifle', 1], phantom: ['rifle', -1], vandal: ['rifle', 1], warden: ['rifle', -1],
  smg: ['smg', 1], pdw: ['smg', -1], dualsmg: ['smg', 1], frenzy: ['smg', -1], stinger: ['smg', 1], spectre: ['smg', -1],
  lmg: ['lmg', 1], ares: ['lmg', -1], odin: ['lmg', 1],
  burst: ['burst', 1],
  marksman: ['single', -1], pistol: ['single', 1], shotgun: ['single', -1], sniper: ['single', 1], crossbow: ['single', 0], revolver: ['single', 1],
  autoshotgun: ['single', -1], dualpistols: ['single', 0], slugshotgun: ['single', 1],
  classic: ['single', 1], shorty: ['single', -1], ghost: ['single', -1], sheriff: ['single', 1], bandit: ['single', -1],
  railgun: ['single', 1], leveraction: ['single', -1], throwingknife: ['single', 0], grapple: ['single', 0],
  bucky: ['single', 1], judge: ['single', -1], guardian: ['single', 1], marshal: ['single', -1], outlaw: ['single', 1], operator: ['single', -1],
});

export function weaponRecoilPattern(weapon) {
  const [template, side] = PATTERNS[weapon?.id] || [weapon?.mode === 'auto' ? 'rifle' : 'single', 1];
  return Object.freeze({ template, side });
}

/** The kick a round adds at `step` (0 = opening round of a spray), in radians. */
export function recoilKick(weapon, step = 0, { ads = 0 } = {}) {
  const base = finite(weapon?.recoil), { template, side } = weaponRecoilPattern(weapon);
  const shape = TEMPLATES[template](Math.max(0, Math.floor(finite(step))));
  const brace = 1 - clamp(finite(ads), 0, 1) * (1 - RECOIL.adsMultiplier);
  return { pitch: base * shape.pitch * brace, yaw: base * shape.yaw * side * brace };
}

/** Advance a player's accumulated aim offset after one accepted round. */
export function applyRecoilKick(player, weapon, ads = 0) {
  const kick = recoilKick(weapon, player.sprayShots, { ads });
  player.recoil = Math.min(RECOIL.pitchCap, finite(player.recoil) + kick.pitch);
  player.recoilYaw = clamp(finite(player.recoilYaw) + kick.yaw, -RECOIL.yawCap, RECOIL.yawCap);
  player.sprayShots = Math.max(0, Math.floor(finite(player.sprayShots))) + 1;
  player.sprayIdleTicks = 0;
  return kick;
}

/** One 120 Hz recovery tick. Both axes ease back linearly to exactly zero. */
export function recoverRecoil(player, weapon, cycleTicks = finite(weapon?.fireIntervalTicks, finite(weapon?.cooldown, 12))) {
  const shots = Math.max(0, Math.floor(finite(player.sprayShots)));
  // An idle gun with no spray to rewind keeps a constant state.
  const idle = shots > 0 ? finite(player.sprayIdleTicks) + 1 : 0;
  // A held trigger keeps its climb: the aim settles only once rounds stop.
  if (idle > Math.ceil(cycleTicks) + 1 || shots === 0) {
    const step = RECOIL.recoveryPerSecond / 120;
    player.recoil = Math.max(0, finite(player.recoil) - step);
    const yaw = finite(player.recoilYaw);
    player.recoilYaw = Math.abs(yaw) <= step ? 0 : yaw - Math.sign(yaw) * step;
  }
  const beyond = idle - Math.ceil(cycleTicks) - RECOIL.resetDelayTicks;
  if (shots > 0 && beyond > 0 && beyond % RECOIL.rewindTicks === 0) player.sprayShots = shots - 1;
  player.sprayIdleTicks = player.sprayShots > 0 ? Math.min(idle, 100000) : 0;
}

/** Cumulative aim offsets of a full uncorrected spray, for previews and drills.
 * Recovery between rounds is included so the drawing matches what players feel. */
export function sprayPath(weapon, rounds = finite(weapon?.magazine, 30), { ads = 0 } = {}) {
  const cycle = Math.max(1, finite(weapon?.fireIntervalTicks, finite(weapon?.cooldown, 12)));
  const player = { recoil: 0, recoilYaw: 0, sprayShots: 0, sprayIdleTicks: 0 }, path = [];
  for (let round = 0; round < Math.max(0, Math.floor(rounds)); round++) {
    path.push({ pitch: player.recoil, yaw: player.recoilYaw });
    applyRecoilKick(player, weapon, ads);
    for (let tick = 0; tick < Math.round(cycle); tick++) recoverRecoil(player, weapon, cycle);
  }
  return path;
}
