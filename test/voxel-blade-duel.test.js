import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { HEAVY, MELEE_WEAPONS, OVERHEAD, RIPOSTE, heavyChargeTicks, meleeProfile, meleeSlashGeometry } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const open = { id: 'duel-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const blade = (weapon, id, fields = {}) => { const player = Object.assign(createCombatPlayer(id, 1, 'carbine'), fields); setInventoryMeleeLoadout(player, weapon); selectInventorySlot(player, 0); return player; };
const fixture = players => ({ gameId: 'duel-fixture', phase: 'fight', tick: 0, map: open, mapId: open.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), yaw: player.yaw, pitch: -.15, ...(controls[index] || {}) })), open); };
const run = (state, ticks, controls = () => []) => { for (let tick = 0; tick < ticks; tick++) step(state, controls(tick)); };
const pair = (weapon = 'sword', victim = {}) => { const a = blade(weapon, 0, { z: 0, yaw: 0 }), b = blade('sword', 1, { z: -1.6, yaw: Math.PI, ...victim }); return { a, b, state: fixture([a, b]) }; };

test('holding the cut past a full light swing and releasing throws a heavy cut', () => {
  const { a, b, state } = pair();
  const hold = heavyChargeTicks(a);
  run(state, hold + 1, tick => [{ fire: true }]);
  const light = state.events.filter(event => event.type === 'meleeStart');
  assert.equal(light.length, 1, 'a held trigger throws exactly one light cut');
  assert.equal(b.hp, b.maxHp - MELEE_WEAPONS.sword.damage);
  b.hp = b.maxHp; b.hitStunReadyTicks = 0; b.knockbackReadyTicks = 0; b.z = -1.6; b.x = 0;
  run(state, 60);
  const heavy = state.events.filter(event => event.type === 'meleeStart').at(-1);
  assert.equal(heavy.heavy, true);
  assert.equal(b.hp, b.maxHp - Math.round(MELEE_WEAPONS.sword.damage * HEAVY.damage));
  assert.ok(state.events.some(event => event.type === 'meleeHit' && event.heavy === true));
});

test('releasing before the charge is ready throws nothing extra', () => {
  const { state } = pair();
  run(state, 30, tick => [{ fire: true }]); run(state, 80);
  assert.equal(state.events.filter(event => event.type === 'meleeStart').length, 1);
});

test('a heavy cut breaks a held sword guard outright; a light cut is softened by it', () => {
  const guarded = heavy => {
    const { a, b, state } = pair('sword');
    run(state, 50, () => [{}, { aim: true }]);
    assert.equal(b.guarding, true, 'the guard is up once the parry window has passed');
    const hold = heavy ? heavyChargeTicks(a) + 1 : 1;
    run(state, hold, () => [{ fire: true }, { aim: true }]);
    const before = state.events.length;
    run(state, 60, () => [{}, { aim: true }]);
    return { b, state, after: state.events.slice(before) };
  };
  const light = guarded(false);
  assert.ok(light.state.events.some(event => event.type === 'bulletBlock' && event.attack === 'sword'));
  assert.ok(light.b.hp > light.b.maxHp - MELEE_WEAPONS.sword.damage);
  const heavy = guarded(true);
  assert.ok(heavy.after.some(event => event.type === 'guardBreak'), 'the heavy cut breaks the guard');
  assert.ok(heavy.after.some(event => event.type === 'meleeHit' && event.heavy === true && event.damage === Math.round(MELEE_WEAPONS.sword.damage * HEAVY.damage)));
});

test('a clean parry opens a riposte that hits harder and stands alone', () => {
  const { a, b, state } = pair('sword');
  // b parries a's cut, then answers inside the window.
  run(state, 3, tick => [{ fire: tick === 0 }, { aim: tick === 0 }]);
  run(state, 30, () => [{}, {}]);
  assert.ok(state.events.some(event => event.type === 'meleeParry'), 'parried');
  assert.ok(b.riposteTicks > 0 && b.riposteTicks <= RIPOSTE.windowTicks);
  a.hp = a.maxHp;
  for (let tick = 0; tick < 80 && !state.events.some(event => event.type === 'meleeStart' && event.playerId === 1); tick++) step(state, [{}, { fire: !b.previousInput.fire }]);
  run(state, 40);
  const answer = state.events.find(event => event.type === 'meleeStart' && event.playerId === 1);
  assert.equal(answer.riposte, true); assert.equal(answer.comboStep, 0);
  assert.equal(a.hp, a.maxHp - Math.round(MELEE_WEAPONS.sword.damage * RIPOSTE.damage));
});

test('a strafe picks the sweep side and a jump turns the cut into an overhead chop', () => {
  const sideOf = controls => { const { state } = pair(); step(state, [{ fire: true, ...controls }]); return state.events.find(event => event.type === 'meleeStart'); };
  assert.equal(sideOf({ left: true }).slashDirection, -1);
  assert.equal(sideOf({ right: true }).slashDirection, 1);
  const overhead = meleeProfile({ meleeWeapon: 'katana', meleeAction: 'primary', meleeStyle: 'overhead' });
  assert.equal(overhead.slashTilt, OVERHEAD.tilt); assert.equal(overhead.damage, Math.round(MELEE_WEAPONS.katana.damage * OVERHEAD.damage));
  const flat = meleeSlashGeometry({ meleeWeapon: 'katana', meleeAction: 'primary', yaw: 0, pitch: 0 }, { origin: { x: 0, y: 1.5, z: 0 } });
  const chop = meleeSlashGeometry({ meleeWeapon: 'katana', meleeAction: 'primary', meleeStyle: 'overhead', yaw: 0, pitch: 0 }, { origin: { x: 0, y: 1.5, z: 0 } });
  const spread = (geometry, axis) => Math.max(...geometry.samples.map(sample => sample.outer[axis])) - Math.min(...geometry.samples.map(sample => sample.outer[axis]));
  assert.ok(spread(chop, 'y') > spread(flat, 'y') && spread(chop, 'x') < spread(flat, 'x'), 'the chop is vertical');
  const { a, state } = pair('katana'); a.grounded = false; a.vy = 4; a.y = .4;
  step(state, [{ fire: true }]);
  assert.equal(state.events.find(event => event.type === 'meleeStart').overhead, true);
});

test('the knife and the tonfas keep their own controls', () => {
  for (const weapon of ['knife', 'tonfas']) {
    const { a, state } = pair(weapon); a.grounded = false;
    step(state, [{ fire: true, left: true }]);
    const start = state.events.find(event => event.type === 'meleeStart');
    assert.ok(!start.overhead && !start.heavy, weapon);
  }
});
