import assert from 'node:assert/strict';
import test from 'node:test';
import { BLADE_MOVEMENT, LUNGE, createCombatPlayer, combatStep, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const open = { id: 'blade-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const bladeRunner = (weapon = 'sword', id = 0) => { const player = createCombatPlayer(id, 1, 'carbine'); setInventoryMeleeLoadout(player, weapon); selectInventorySlot(player, 0); return player; };
const fixture = players => ({ gameId: 'blade-fixture', phase: 'fight', tick: 0, map: open, mapId: open.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), ...(controls[index] || {}) })), open); };
const sprint = { up: true, sprint: true };

test('holding a blade moves you faster than holding a gun', () => {
  const blade = fixture([bladeRunner('sword')]), gun = fixture([createCombatPlayer(0, 1, 'carbine')]);
  for (let tick = 0; tick < 120; tick++) { step(blade, [{ up: true }]); step(gun, [{ up: true }]); }
  const bladeSpeed = Math.hypot(blade.players[0].vx, blade.players[0].vz);
  assert.ok(Math.abs(bladeSpeed - MELEE_WEAPONS.sword.speed * BLADE_MOVEMENT.speedMultiplier) < 1e-6, `${bladeSpeed}`);
  assert.ok(Math.abs(blade.players[0].z) > Math.abs(gun.players[0].z) * 1.05);
});

test('a sprinting right-click lunges forward into a real cut that lands on the target', () => {
  const attacker = bladeRunner('sword'), target = Object.assign(createCombatPlayer(1, 1, 'carbine'), { z: -9, hp: 1000, maxHp: 1000 });
  const state = fixture([attacker, target]);
  for (let tick = 0; tick < 50; tick++) step(state, [sprint]);
  const startZ = attacker.z, stamina = attacker.stamina;
  step(state, [{ ...sprint, aim: true }]);
  assert.equal(attacker.bladeLungeTicks, LUNGE.ticks - 1);
  assert.ok(attacker.stamina <= stamina - LUNGE.stamina + 1e-9);
  assert.ok(!state.events.some(event => event.type === 'parryStart'), 'the lunge click is not also a parry');
  for (let tick = 0; tick < LUNGE.ticks + 20; tick++) step(state, [{ aim: true }]);
  // The cut is timed to arrive as the lunge lands.
  assert.ok(state.events.some(event => event.type === 'meleeLunge'));
  assert.ok(state.events.some(event => event.type === 'meleeStart' && event.playerId === 0), 'the lunge starts a cut');
  assert.ok(startZ - attacker.z > 3, `covered ${startZ - attacker.z} m`);
  assert.ok(target.hp < 1000, 'the lunge cut connected');
  assert.ok(attacker.bladeLungeCooldown > 0);
});

test('the lunge needs a sprint, has a cooldown and never fires from a gun', () => {
  const standing = fixture([bladeRunner('sword')]);
  step(standing, [{ aim: true }]);
  assert.equal(standing.players[0].bladeLungeTicks, 0, 'a standing right-click is the ordinary parry');
  const gun = fixture([createCombatPlayer(0, 1, 'carbine')]);
  for (let tick = 0; tick < 50; tick++) step(gun, [sprint]);
  step(gun, [{ ...sprint, aim: true }]);
  assert.equal(gun.players[0].bladeLungeTicks, 0);
  const state = fixture([bladeRunner('katana')]);
  for (let tick = 0; tick < 50; tick++) step(state, [sprint]);
  step(state, [{ ...sprint, aim: true }]);
  for (let tick = 0; tick < LUNGE.ticks + 10; tick++) step(state, [sprint]);
  step(state, [{ ...sprint, aim: true }]);
  assert.equal(state.players[0].bladeLungeTicks, 0, 'the cooldown blocks a second lunge');
});

test('client prediction reproduces the lunge path exactly', () => {
  const state = fixture([bladeRunner('sword')]), authority = state.players[0], predicted = structuredClone(authority);
  const script = tick => tick < 50 ? sprint : tick === 50 ? { ...sprint, aim: true } : { aim: true };
  for (let tick = 0; tick < 90; tick++) {
    step(state, [script(tick)]);
    predictLocalMovement(predicted, { ...emptyInput(), ...script(tick) }, open, 1);
    for (const field of ['x', 'z', 'bladeLungeTicks']) assert.ok(Math.abs(predicted[field] - authority[field]) < 1e-9, `${field} @${tick}`);
  }
});

test('a cut started mid-slide hits harder', () => {
  const damageFrom = slide => {
    const attacker = bladeRunner('sword'), target = Object.assign(createCombatPlayer(1, 1, 'carbine'), { z: -7, hp: 1000, maxHp: 1000 });
    const state = fixture([attacker, target]);
    for (let tick = 0; tick < 50; tick++) step(state, [sprint]);
    if (slide) step(state, [{ ...sprint, crouch: true }]);
    for (let tick = 0; tick < 80 && target.hp === 1000; tick++) step(state, [{ ...(slide ? { crouch: true } : sprint), fire: tick === 2 }]);
    return { damage: 1000 - target.hp, slid: state.events.some(event => event.type === 'meleeStart' && event.slideSlash) };
  };
  const sliding = damageFrom(true);
  assert.ok(sliding.slid, 'the cut was flagged as a slide slash');
  assert.equal(sliding.damage, Math.round(MELEE_WEAPONS.sword.damage * BLADE_MOVEMENT.slideSlashDamage));
});
