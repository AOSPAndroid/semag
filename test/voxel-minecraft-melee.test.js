import assert from 'node:assert/strict';
import test from 'node:test';
import { MELEE_FEEL, createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const open = { id: 'mc-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const blade = (weapon, id, fields = {}) => { const p = Object.assign(createCombatPlayer(id, 1, 'carbine'), fields); setInventoryMeleeLoadout(p, weapon); selectInventorySlot(p, 0); return p; };
const fixture = players => ({ gameId: 'mc', phase: 'fight', tick: 0, map: open, players, fighters: players, grenades: [], bolts: [], events: [], eventId: 0, loot: [] });
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((p, i) => ({ ...emptyInput(p), yaw: p.yaw, pitch: -.1, ...(controls[i] || {}) })), open); };
const run = (state, ticks, controls = () => []) => { for (let t = 0; t < ticks; t++) step(state, controls(t)); };

test('a cut thrown out of a sprint shoves much harder, and sprinting again needs a W-tap', () => {
  const travel = sprint => {
    const a = blade('sword', 0, { z: 0, yaw: 0 }), b = blade('sword', 1, { z: -6, yaw: Math.PI }), state = fixture([a, b]);
    if (sprint) { run(state, 40, () => [{ up: true, sprint: true }]); }
    else { a.z = -3.3; }
    const start = b.z; let hitAt = null;
    for (let t = 0; t < 90 && hitAt === null; t++) { step(state, [{ up: sprint && t < 1, sprint: sprint && t < 1, fire: t === 1 }]); if (b.hp < b.maxHp) hitAt = t; }
    assert.notEqual(hitAt, null, `${sprint ? 'sprint' : 'standing'} cut landed`);
    run(state, 40);
    return { pushed: start - b.z, a, state };
  };
  const standing = travel(false), sprinting = travel(true);
  assert.ok(sprinting.pushed > standing.pushed * 1.4, `sprint ${sprinting.pushed} vs standing ${standing.pushed}`);
  assert.ok(sprinting.state.events.some(e => e.type === 'meleeHit' && e.sprintHit === true));
});

test('after a sprint hit, holding W and Shift does not restart the sprint; a W-tap does', () => {
  const a = blade('sword', 0, { z: 0, yaw: 0 }), b = blade('sword', 1, { z: -9, yaw: Math.PI, hp: 5000, maxHp: 5000 }), state = fixture([a, b]);
  let hit = false;
  for (let t = 0; t < 200 && !hit; t++) { const close = Math.abs(b.z - a.z) < 2.6; step(state, [{ up: true, sprint: true, fire: close && !a.previousInput.fire }]); hit = state.events.some(e => e.type === 'meleeHit' && e.sprintHit); }
  assert.ok(hit, 'a sprint hit landed'); b.x = 30; b.z = 30;
  run(state, 60, () => [{ up: true, sprint: true }]);
  assert.equal(a.sprinting, false, 'sprint stays locked while W is held');
  b.x = 30; b.z = 30; step(state, [{ sprint: true }]); run(state, 10, () => [{ up: true, sprint: true }]);
  assert.equal(a.sprinting, true, `a W-tap restores sprint ${JSON.stringify({ lock: a.sprintLock, stamina: a.stamina, ex: a.sprintExhausted, g: a.grounded, m: a.meleeTicks, cd: a.meleeCooldown, stun: a.hitStunTicks })}`);
});

test('a cut landed while falling is a critical hit for 1.5x', () => {
  const a = blade('katana', 0, { z: 0, yaw: 0, y: 1.6, grounded: false, vy: -2 }), b = blade('sword', 1, { z: -1.8, yaw: Math.PI }), state = fixture([a, b]);
  run(state, 30, t => [{ fire: t === 0 }]);
  const hit = state.events.find(e => e.type === 'meleeHit');
  assert.equal(hit?.crit, true);
  assert.equal(b.maxHp - b.hp, Math.round(MELEE_WEAPONS.katana.damage * MELEE_FEEL.critDamage));
});

test('a hit pops the target off the ground and a short window ignores the next melee hit', () => {
  const a = blade('sword', 0, { z: 0, yaw: 0 }), c = blade('sword', 2, { x: .9, z: -.4, yaw: -.6 }), b = blade('sword', 1, { z: -1.6, yaw: Math.PI, team: 1 });
  a.team = 0; c.team = 0;
  const state = fixture([a, b, c]);
  let lifted = false;
  for (let t = 0; t < 40; t++) { step(state, [{ fire: t === 0 }, {}, { fire: t === 1 }]); if (b.y > .05) lifted = true; }
  assert.ok(lifted, 'the target was lifted');
  const hits = state.events.filter(e => e.type === 'damage' && e.targetId === 1);
  assert.equal(hits.length, 1, 'the second cut landed inside the window and was ignored');
});

test('a standing sword cut sweeps the enemies beside its target; a sprinting one does not', () => {
  const sweep = sprint => {
    const a = blade('sword', 0, { z: 0, yaw: 0, team: 0 }), b = blade('knife', 1, { z: -1.7, yaw: Math.PI, team: 1 }), c = blade('knife', 2, { x: 1, z: -2.2, yaw: Math.PI, team: 1 });
    const state = fixture([a, b, c]);
    if (sprint) a.lastSprintTick = state.tick + 1;
    run(state, 40, t => [{ fire: t === 0 }]);
    return { b, c, state };
  };
  const still = sweep(false);
  assert.ok(still.state.events.some(e => e.type === 'meleeSweep'));
  assert.ok(still.c.hp < still.c.maxHp, 'the bystander took sweep damage');
  assert.ok(still.c.maxHp - still.c.hp < still.b.maxHp - still.b.hp, 'sweep damage is lighter than the cut');
  const moving = sweep(true);
  assert.ok(!moving.state.events.some(e => e.type === 'meleeSweep'));
});

test('monsters keep their own stagger rules: no lift and no hit window', () => {
  const a = blade('sword', 0, { z: 0, yaw: 0 }), m = Object.assign(createCombatPlayer(1, 1, 'carbine'), { z: -1.6, monster: true, human: false, monsterType: 'stalker', hp: 500, maxHp: 500 }), state = fixture([a, m]);
  run(state, 30, t => [{ fire: t === 0 }]);
  assert.ok(m.hp < 500); assert.equal(m.meleeImmuneTicks || 0, 0); assert.ok(m.y <= .001);
});
