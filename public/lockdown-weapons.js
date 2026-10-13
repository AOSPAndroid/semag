/** Lockdown armoury: the same weapon types as Spiral Knights, with original names.
 * Pure data, read by the engine, renderer, bots, art manifest and lobby. All times are
 * simulation ticks (120 per second); distances are world units (a floor tile is 48).
 *
 * Blades swing a combo of steps. Each step winds up (`startup`), sweeps its arc across
 * `active` ticks (hits land where the blade actually is), then recovers. Pressing again
 * during a swing queues the next step. Holding the button charges a special.
 * Guns hold a clip and reload on their own after a short pause or when empty, even while
 * holstered. Bombs only plant from a full charge; you move slowly while charging. */
export const TICKS = 120;

const step = (damage, startup, active, recovery, reach, arc, push, stun, lunge) => Object.freeze({ damage, startup, active, recovery, reach, arc, push, stun, lunge });

export const WEAPONS = Object.freeze({
  // ---------- blades ----------
  brand: Object.freeze({ id: 'brand', family: 'blade', type: 'Normal sword', name: 'Knight Brand', chargeTicks: 108,
    combo: [step(17, 6, 6, 12, 72, 1.9, 150, 14, 16), step(17, 6, 6, 12, 72, 1.9, 150, 14, 16), step(24, 8, 7, 18, 76, 2.3, 240, 18, 22)],
    charge: Object.freeze({ kind: 'lungeBurst', distance: 120, ticks: 14, damage: 22, reach: 50, arc: 1.6, push: 180, stun: 16, recovery: 16,
      burst: Object.freeze({ radius: 76, damage: 20, push: 260, status: 'burn', chance: 1 }) }),
    description: 'Balanced three-cut combo. Charge: lunge forward and end in a burning burst.' }),
  cleaver: Object.freeze({ id: 'cleaver', family: 'blade', type: 'Heavy sword', name: 'Troll Cleaver', chargeTicks: 132,
    combo: [step(31, 14, 8, 22, 78, 2.0, 300, 24, 10), step(38, 16, 9, 28, 82, 2.3, 380, 30, 14)],
    charge: Object.freeze({ kind: 'slam', distance: 70, ticks: 30, radius: 104, offset: 34, damage: 42, push: 380, stun: 40, recovery: 24 }),
    description: 'Slow, brutal overhead chain that stuns. Charge: leap and slam the ground around you.' }),
  rapier: Object.freeze({ id: 'rapier', family: 'blade', type: 'Fast sword', name: 'Needle Rapier', chargeTicks: 96,
    combo: [step(10, 4, 4, 7, 82, .62, 80, 8, 14), step(10, 4, 4, 7, 82, .62, 80, 8, 14), step(10, 4, 4, 7, 82, .62, 80, 8, 14), step(13, 5, 4, 10, 86, .62, 130, 10, 22)],
    charge: Object.freeze({ kind: 'lunge', distance: 190, ticks: 18, damage: 28, reach: 36, arc: 1.2, push: 200, stun: 16, recovery: 14 }),
    description: 'Quick narrow thrusts that step you forward. Charge: a long lunge straight through the target.' }),
  thorn: Object.freeze({ id: 'thorn', family: 'blade', type: 'Thorn sword', name: 'Briar Blade', chargeTicks: 108,
    combo: [step(16, 6, 6, 12, 70, 1.9, 140, 14, 14), step(16, 6, 6, 12, 70, 1.9, 140, 14, 14), step(22, 8, 7, 18, 74, 2.2, 220, 18, 20)],
    charge: Object.freeze({ kind: 'thorns', count: 9, spread: 1.1, damage: 7, speed: 520, range: 220, size: 5, status: 'poison', chance: .5, recovery: 20 }),
    description: 'Balanced combo. Charge: spray a short, wide shower of poison thorns.' }),
  greatblade: Object.freeze({ id: 'greatblade', family: 'blade', type: 'Dark sword', name: 'Umbral Greatblade', chargeTicks: 132,
    combo: [step(29, 12, 8, 20, 80, 2.0, 260, 20, 12), step(34, 14, 9, 24, 84, 2.3, 320, 24, 14)],
    charge: Object.freeze({ kind: 'wave', damage: 30, speed: 300, range: 420, size: 26, push: 160, status: 'shock', chance: .5, recovery: 26 }),
    description: 'Heavy two-hit chain. Charge: a slow wave of shadow that carries knights along with it.' }),
  spur: Object.freeze({ id: 'spur', family: 'blade', type: 'Spin sword', name: 'Gyre Spur', chargeTicks: 108,
    combo: [step(8, 4, 5, 6, 66, 1.7, 70, 6, 10), step(8, 4, 5, 6, 66, 1.7, 70, 6, 10), step(8, 4, 5, 6, 66, 1.7, 70, 6, 10), step(12, 5, 6, 10, 68, 2.2, 140, 10, 14)],
    charge: Object.freeze({ kind: 'spin', turns: 3, ticksPerTurn: 18, reach: 70, damage: 11, push: 120, stun: 8, speed: .6, recovery: 12 }),
    description: 'Fast light four-cut chain. Charge: spin three times, hitting everything around you each turn.' }),

  // ---------- guns ----------
  blaster: Object.freeze({ id: 'blaster', family: 'gun', type: 'Blaster', name: 'Pulse Blaster', chargeTicks: 120,
    clip: 3, interval: 16, reload: 54, reloadDelay: 60, damage: 9, speed: 760, range: 620, push: 80, spread: .02, size: 5, kind: 'bullet',
    charge: Object.freeze({ kind: 'pierce', damage: 24, speed: 880, range: 700, push: 220, size: 9, pierce: true }),
    description: 'Reliable three-shot gun. Charge: a big bolt that pierces every knight in its path.' }),
  pulsar: Object.freeze({ id: 'pulsar', family: 'gun', type: 'Pulsar', name: 'Ripple Caster', chargeTicks: 120,
    clip: 3, interval: 22, reload: 60, reloadDelay: 60, damage: 7, speed: 360, range: 340, push: 60, spread: 0, size: 8, grow: 14, kind: 'pulse', pierce: true,
    charge: Object.freeze({ kind: 'bigPulse', damage: 22, speed: 260, range: 380, push: 140, size: 16, grow: 32, pierce: true }),
    description: 'Slow waves that widen as they travel and pass through knights. Charge: one huge wave.' }),
  alchemer: Object.freeze({ id: 'alchemer', family: 'gun', type: 'Ricochet', name: 'Ricochet Coil', chargeTicks: 120,
    clip: 3, interval: 18, reload: 60, reloadDelay: 60, damage: 8, speed: 620, range: 760, push: 60, spread: .02, size: 5, kind: 'ricochet', bounces: 1,
    charge: Object.freeze({ kind: 'split', count: 4, spread: .5, damage: 10, speed: 600, range: 820, push: 70, size: 5, bounces: 2, status: 'shock', chance: .35 }),
    description: 'Bolts that bounce off walls. Charge: four shocking bolts that bounce twice.' }),
  autogun: Object.freeze({ id: 'autogun', family: 'gun', type: 'Autogun', name: 'Rattle Autogun', chargeTicks: 120,
    clip: 6, interval: 8, reload: 66, reloadDelay: 60, damage: 5, speed: 800, range: 560, push: 25, spread: .08, size: 4, kind: 'bullet',
    charge: Object.freeze({ kind: 'stream', count: 10, every: 4, damage: 5, speed: 820, range: 600, push: 30, size: 4, spread: .03 }),
    description: 'Six fast, light rounds. Charge: a focused ten-round stream.' }),
  catalyzer: Object.freeze({ id: 'catalyzer', family: 'gun', type: 'Catalyzer', name: 'Tether Catalyst', chargeTicks: 120,
    clip: 3, interval: 20, reload: 60, reloadDelay: 60, damage: 6, speed: 560, range: 520, push: 20, spread: .02, size: 6, kind: 'catalyst',
    charge: Object.freeze({ kind: 'detonator', damage: 10, speed: 720, range: 620, push: 80, size: 7, perCharge: 14, pushPerCharge: 180 }),
    description: 'Shots stick up to three charges on a knight. Charge: a detonator that blows them all at once.' }),
  magnus: Object.freeze({ id: 'magnus', family: 'gun', type: 'Hand-cannon', name: 'Thunder Hand-cannon', chargeTicks: 132,
    clip: 2, interval: 30, reload: 78, reloadDelay: 70, damage: 16, speed: 720, range: 640, push: 260, spread: .01, size: 6, kind: 'bullet',
    charge: Object.freeze({ kind: 'explosive', damage: 26, speed: 640, range: 640, push: 300, size: 9, radius: 72 }),
    description: 'Two heavy rounds with big knockback. Charge: a round that explodes on impact.' }),

  // ---------- bombs ----------
  blast: Object.freeze({ id: 'blast', family: 'bomb', type: 'Blast bomb', name: 'Blast Bomb', chargeTicks: 60, fuse: 72, radius: 100, damage: 30, push: 340, stun: 20,
    description: 'Charges fast. A big knockback blast after a short fuse.' }),
  haze: Object.freeze({ id: 'haze', family: 'bomb', type: 'Haze bomb', name: 'Ember Haze', chargeTicks: 120, fuse: 24, radius: 0, damage: 0, push: 0,
    cloud: Object.freeze({ radius: 92, ticks: 480, status: 'burn' }), description: 'Leaves a cloud that sets enemies on fire.' }),
  frost: Object.freeze({ id: 'frost', family: 'bomb', type: 'Haze bomb', name: 'Frost Haze', chargeTicks: 120, fuse: 24, radius: 0, damage: 0, push: 0,
    cloud: Object.freeze({ radius: 92, ticks: 480, status: 'freeze' }), description: 'Leaves a cloud that freezes enemies solid.' }),
  shard: Object.freeze({ id: 'shard', family: 'bomb', type: 'Shard bomb', name: 'Splinter Bomb', chargeTicks: 120, fuse: 84, radius: 40, damage: 10, push: 120, stun: 10,
    shards: Object.freeze({ count: 8, damage: 12, speed: 520, range: 230, size: 5, push: 120 }), description: 'Bursts into eight shards that cut across the point.' }),
  vortex: Object.freeze({ id: 'vortex', family: 'bomb', type: 'Vortex bomb', name: 'Vortex Bomb', chargeTicks: 150, fuse: 60, radius: 110, damage: 22, push: 320, stun: 20,
    pull: Object.freeze({ ticks: 180, radius: 150, speed: 260 }), description: 'Pulls every enemy in range to its centre and holds them, then blasts them apart.' }),
});
export const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));

/** Status effects. Shields block them; a hit breaks freeze early. */
export const STATUS = Object.freeze({
  burn: Object.freeze({ id: 'burn', name: 'Burning', ticks: 3 * TICKS, every: 30, damage: 4 }),
  poison: Object.freeze({ id: 'poison', name: 'Poisoned', ticks: 5 * TICKS, damageScale: .7, noHeal: true }),
  shock: Object.freeze({ id: 'shock', name: 'Shocked', ticks: 3 * TICKS, every: 48, stun: 14, damage: 2 }),
  freeze: Object.freeze({ id: 'freeze', name: 'Frozen', ticks: 72, immuneTicks: 2 * TICKS }),
});
export const STATUS_IDS = Object.freeze(Object.keys(STATUS));

/** The Guardian's shield (its class ability; in Lockdown nobody else has one). Held, it
 * blocks hits and statuses from every side while it has health. After `expandTicks` it
 * grows into a dome of `radius` that shields teammates inside from outside fire and heals
 * everyone in it. Breaking it stuns; it then recharges (about eight seconds from empty). */
export const GUARD = Object.freeze({ raiseTicks: 6, max: 140, regenPerSecond: 20, regenDelay: 90, breakStun: 72, recover: .5, speed: .5, knockback: .3, bombScale: 1.5, bladeScale: 1.3,
  expandTicks: 120, radius: 92, healPerSecond: 10 });

/** Sword timing rules. Raising the shield or dodging cancels a cut's recovery (the
 * animation cancel), and a queued press may start the next cut once this fraction of
 * the recovery has passed (the last cut of a combo always recovers fully unless cancelled). */
export const BLADE = Object.freeze({ comboCancel: .4, comboWindow: 36, hitStop: 4 });

export const DEFAULT_LOADOUTS = Object.freeze({ striker: ['brand', 'blaster', 'blast'], guardian: ['cleaver', 'magnus', 'vortex'], recon: ['rapier', 'alchemer', 'shard'] });
