import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, createState, emptyInput, startMatch, traceShot } from '../public/voxel-engine.js';
import { FLASH, SMOKE, flashExposure, smokeBlocksSight, smokeRadius } from '../public/voxel-ordnance.js';
import { addInventoryStack, consumeInventoryStack, inventoryCanTake, nextThrowableType, pickupInventoryItem, refreshInventory, selectInventorySlot } from '../public/voxel-inventory.js';
import { utilityView } from '../public/voxel-utility-overlay.js';

const open = { id: 'utility-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const fixture = (players, arena = open) => ({ gameId: 'utility-fixture', phase: 'fight', tick: 0, map: arena, mapId: arena.id, capacity: 6, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), ...(controls[index] || {}) })), state.map); };
const carrying = (types, weapon = 'vandal') => {
  const player = createCombatPlayer(0, 1, weapon);
  for (const type of types) addInventoryStack(player, 'grenade', 1, type);
  refreshInventory(player); return player;
};

test('Breach keeps its scavenge economy unless the room opts into round utility', () => {
  const plain = createState({ teamSize: 1, mapId: 'courtyard' });
  startMatch(plain);
  for (const player of plain.players) { assert.equal(player.inventory[2], null); assert.equal(player.inventory[3], null); assert.equal(player.grenades, 0); }
});

test('a round-utility room issues one smoke and one flash in the two free slots every round', () => {
  const state = createState({ teamSize: 1, mapId: 'courtyard', roundUtility: true });
  startMatch(state);
  for (const player of state.players) {
    assert.deepEqual(player.inventory[2], { kind: 'grenade', amount: 1, type: 'smoke' });
    assert.deepEqual(player.inventory[3], { kind: 'grenade', amount: 1, type: 'flash' });
    assert.equal(player.grenades, 2);
  }
  assert.deepEqual(state.smokes, []);
});

test('grenade stacks keep their type; a quick throw uses the held stack, else the first carried', () => {
  const player = carrying(['smoke', 'flash', 'smoke']);
  assert.equal(player.inventory[2].amount, 2, 'two smokes share a stack');
  assert.equal(player.inventory[3].type, 'flash');
  assert.equal(nextThrowableType(player), 'smoke');
  selectInventorySlot(player, 3);
  assert.equal(nextThrowableType(player), 'flash');
  assert.equal(inventoryCanTake(player, { kind: 'grenade', type: 'flash', amount: 1 }), true, 'room in the flash stack');
  assert.equal(inventoryCanTake(player, { kind: 'grenade', amount: 1 }), false, 'a frag cannot join a smoke or flash stack in a full pack');
  consumeInventoryStack(player, 'grenade', 1, 'smoke');
  assert.equal(player.inventory[2].amount, 1);
  const picker = createCombatPlayer(1, 1, 'vandal');
  assert.equal(pickupInventoryItem(picker, { kind: 'grenade', type: 'flash', amount: 1 }).ok, true);
  assert.equal(picker.inventory.find(item => item?.kind === 'grenade').type, 'flash');
});

test('a thrown smoke bounces like a frag, pops into a growing cloud and thins away on time', () => {
  const thrower = carrying(['smoke']), state = fixture([thrower]);
  step(state, [{ grenade: true, pitch: .3 }]);
  assert.equal(state.grenades[0].type, 'smoke');
  assert.equal(thrower.grenades, 0);
  for (let tick = 0; tick < SMOKE.fuseTicks + 2 && !state.smokes?.length; tick++) step(state);
  assert.equal(state.smokes.length, 1);
  assert.ok(state.events.some(event => event.type === 'smokePop'));
  assert.ok(!state.events.some(event => event.type === 'grenadeExplosion'), 'a smoke never deals blast damage');
  const cloud = state.smokes[0];
  for (let tick = 0; tick < SMOKE.growTicks; tick++) step(state);
  assert.ok(Math.abs(smokeRadius(cloud) - SMOKE.radius) < 1e-9, 'fully grown');
  for (let tick = 0; tick < SMOKE.ticks; tick++) step(state);
  assert.equal(state.smokes.length, 0, 'the cloud expires');
});

test('smoke blocks sight but not bullets', () => {
  const state = fixture([createCombatPlayer(0, 1, 'carbine'), Object.assign(createCombatPlayer(1, 1, 'carbine'), { z: -12 })]);
  state.smokes = [{ id: 1, x: 0, y: 1.4, z: -6, ageTicks: SMOKE.growTicks }];
  assert.equal(smokeBlocksSight(state, { x: 0, y: 1.6, z: 0 }, { x: 0, y: 1.6, z: -12 }), true);
  assert.equal(smokeBlocksSight(state, { x: 8, y: 1.6, z: 0 }, { x: 8, y: 1.6, z: -12 }), false, 'a line beside the cloud is clear');
  assert.equal(traceShot(state, 0, { x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: -1 }, 30).playerId, 1, 'rounds still pass through');
});

test('a flash blinds hardest when you look at it, less side-on, and barely when turned away', () => {
  const grenade = { x: 0, y: 1.5, z: -6 };
  const facing = createCombatPlayer(0, 1, 'vandal'), side = Object.assign(createCombatPlayer(1, 1, 'vandal'), { yaw: Math.PI / 2 }), away = Object.assign(createCombatPlayer(2, 1, 'vandal'), { yaw: Math.PI });
  const state = fixture([facing, side, away]);
  const [front, flank, back] = [facing, side, away].map(player => flashExposure(state, grenade, player, open));
  assert.ok(front > flank && flank > back, `${front} > ${flank} > ${back}`);
  assert.ok(front > FLASH.maxTicks * .6);
  assert.ok(back <= FLASH.maxTicks * .2);
  assert.equal(flashExposure(state, { x: 0, y: 1.5, z: -FLASH.range - 1 }, facing, open), 0, 'out of range');
  const walled = { ...open, colliders: [{ id: 'wall', x: -3, y: 0, z: -3.5, w: 6, h: 4, d: .4 }] };
  assert.equal(flashExposure(state, grenade, facing, walled), 0, 'a wall shields you');
  state.smokes = [{ id: 1, x: 0, y: 1.5, z: -3, ageTicks: SMOKE.growTicks }];
  assert.equal(flashExposure(state, grenade, facing, open), 0, 'so does a smoke');
});

test('a thrown flash blinds through authority, then wears off on the tick clock', () => {
  const thrower = carrying(['flash']), victim = Object.assign(createCombatPlayer(1, 1, 'vandal'), { z: -12 });
  // The victim looks back toward the thrower and the incoming flash.
  victim.yaw = Math.PI;
  const state = fixture([thrower, victim]);
  step(state, [{ grenade: true, pitch: .1 }, { yaw: Math.PI }]);
  for (let tick = 0; tick < FLASH.fuseTicks + 2 && !state.events.some(event => event.type === 'flashbang'); tick++) step(state, [{}, { yaw: Math.PI }]);
  const bang = state.events.find(event => event.type === 'flashbang');
  assert.ok(bang.blinded.some(entry => entry.playerId === 1));
  assert.ok(victim.flashTicks > 0 && victim.flashTotal >= victim.flashTicks);
  const view = utilityView(state, victim);
  assert.ok(view.flash > .9, 'the screen whites out');
  for (let tick = 0; tick < FLASH.maxTicks + 2; tick++) step(state);
  assert.equal(victim.flashTicks, 0); assert.equal(victim.flashTotal, 0);
});

test('standing inside a cloud greys out the view; outside it does not', () => {
  const player = createCombatPlayer(0, 1, 'vandal');
  const state = { smokes: [{ id: 1, x: 0, y: 1.4, z: 0, ageTicks: SMOKE.growTicks }] };
  assert.ok(utilityView(state, player).smoke > .9);
  assert.equal(utilityView(state, Object.assign(createCombatPlayer(1, 1, 'vandal'), { x: 10 })).smoke, 0);
});
