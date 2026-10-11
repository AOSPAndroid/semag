import assert from 'node:assert/strict';
import test from 'node:test';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice, getPracticeStats, TICK_RATE } from '../public/voxel-practice-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { WORLD } from '../public/voxel-engine.js';
import { MAX_GRENADES } from '../public/voxel-ordnance.js';
import { selectedInventoryItem, initializeInventory } from '../public/voxel-inventory.js';

const ids = Array.from({ length: 11 }, (_, id) => id);
const openArena = { id: 'solo-royale-fixture', bounds: { minX: -48, maxX: 48, minZ: -48, maxZ: 48 }, colliders: [], sites: [] };
function advance(state, ticks, input = {}) {
  for (let index = 0; index < ticks; index++) stepPractice(state, typeof input === 'function' ? input(state, index) : input);
}
function tenBots(options = {}) {
  const state = createPractice({ game: 'voxel-royale', bots: 10, seed: 713, ...options });
  startPractice(state); advance(state, state.phaseTicks); assert.equal(state.phase, 'fight'); return state;
}
function bodyClear(arena, player) {
  assert.ok(player.x >= arena.bounds.minX + WORLD.radius - 1e-6 && player.x <= arena.bounds.maxX - WORLD.radius + 1e-6);
  assert.ok(player.z >= arena.bounds.minZ + WORLD.radius - 1e-6 && player.z <= arena.bounds.maxZ - WORLD.radius + 1e-6);
  for (const box of arena.colliders) {
    if (player.y >= box.y + box.h - 1e-7 || player.y + WORLD.standHeight <= box.y + 1e-7) continue;
    const dx = player.x - Math.max(box.x, Math.min(box.x + box.w, player.x));
    const dz = player.z - Math.max(box.z, Math.min(box.z + box.d, player.z));
    assert.ok(dx * dx + dz * dz >= WORLD.radius ** 2 - 1e-6, `${arena.id}/${player.id} penetrates ${box.id}`);
  }
}

test('solo Royale accepts 1–10 bots while Breach/Dojo and online rooms retain their existing limits', () => {
  for (const bots of [1, 6, 9, 10]) {
    const state = createPractice({ game: 'voxel-royale', bots, seed: 1 });
    assert.equal(state.phase, 'ready'); assert.equal(state.capacity, bots + 1); assert.equal(state.players.length, bots + 1);
    assert.equal(state.solo, true); assert.equal(state.practice.config.mode, 'combat');
  }
  for (const bots of [0, 11, 10.5, '10', NaN]) assert.throws(() => createPractice({ game: 'voxel-royale', bots }), RangeError);
  for (const mode of ['combat', 'targets', 'dojo']) assert.throws(() => createPractice({ game: 'voxel', mode, bots: 6 }), RangeError);
  assert.equal(Royale.ROYALE.maxPlayers, 10);
  assert.throws(() => Royale.createState({ capacity: 11, solo: true }), RangeError);
  assert.throws(() => Royale.createSoloState({ capacity: 12 }), RangeError);
  const online = Royale.createState({ capacity: 10, seed: 8 });
  assert.throws(() => Royale.startMatch(online, ids), RangeError);
  assert.equal(online.players.length, 10); assert.equal(online.matchId, 0); assert.equal(online.solo, undefined);
  const solo = Royale.createSoloState({ capacity: 11, seed: 8 });
  Royale.startMatch(solo, ids); Royale.resetLobby(solo); Royale.startMatch(solo, ids);
  assert.equal(solo.players.length, 11); assert.equal(solo.maxGrenades, MAX_GRENADES);
  assert.equal(solo.aliveCount, 11); assert.deepEqual(solo.participantIds, ids);
});

test('every Royale map starts ten combat bots and a human at eleven safe unique knife-only spawns', () => {
  for (const mapId of Royale.MAP_IDS) {
    const state = createPractice({ game: 'voxel-royale', mapId, bots: 10, seed: 151 });
    const untouched = JSON.stringify(state); advance(state, 500, { up: true, fire: true }); assert.equal(JSON.stringify(state), untouched);
    startPractice(state);
    assert.equal(state.aliveCount, 11, mapId); assert.equal(getPracticeStats(state).botsRemaining, 10);
    assert.equal(new Set(state.players.map(player => `${player.x}/${player.y}/${player.z}`)).size, 11, mapId);
    for (const player of state.players) {
      bodyClear(state.map, player);
      assert.equal(player.team, player.id); assert.equal(player.bot, player.id > 0); assert.equal(player.hp, 200);
      assert.equal(player.slot, 'sword'); assert.equal(player.meleeWeapon, 'knife'); assert.equal(player.hasGun, false);
      assert.equal(player.ammo + player.reserve + player.potions + player.grenades, 0);
      assert.equal(player.inventory.filter(Boolean).length, 1);
    }
    assert.ok(state.loot.filter(loot => loot.kind === 'weapon').length >= 11, `${mapId}: too few native gun caches`);
    for (const kind of ['heal', 'ammo', 'grenade', 'melee']) assert.ok(state.loot.some(loot => loot.kind === kind), `${mapId}/${kind}`);
    const poses = state.players.map(({ x, y, z }) => [x, y, z]);
    advance(state, state.phaseTicks, { up: true, fire: true, interact: true });
    assert.deepEqual(state.players.map(({ x, y, z }) => [x, y, z]), poses); assert.equal(state.phase, 'fight');
  }
});

test('all ten bots move on authored larger ground maps and collect real caches without collision penetration', () => {
  for (const mapId of ['forest', 'maze', 'desert']) {
    const state = tenBots({ mapId, difficulty: 'rookie' });
    const initial = state.players.slice(1).map(player => [player.x, player.z]);
    let pickups = 0;
    for (let tick = 0; tick < 600 && state.phase === 'fight'; tick++) {
      stepPractice(state);
      if (tick % 20 === 0) for (const bot of state.players.slice(1).filter(player => player.alive)) bodyClear(state.map, bot);
      pickups = Math.max(pickups, state.events.filter(event => event.type === 'lootPickup' && event.playerId > 0).length);
    }
    assert.ok(state.players.slice(1).every((bot, index) => Math.hypot(bot.x - initial[index][0], bot.z - initial[index][1]) > .5), `${mapId}: an idle bot never left its spawn`);
    assert.ok(pickups > 0, `${mapId}: no real bot loot pickup`);
  }
});

test('all Royale gun caches require travel from every knife-only start, including sewer and office spawn caches', () => {
  for (const mapId of Royale.MAP_IDS) for (const seed of [1, 7, 12, 151]) {
    const state = createPractice({ game: 'voxel-royale', mapId, bots: 10, seed }); startPractice(state);
    const spawns = state.players.map(({ x, z }) => ({ x, z }));
    const guns = state.loot.filter(loot => loot.kind === 'weapon');
    assert.ok(guns.length >= 11, `${mapId}/${seed}: not enough actual gun caches`);
    assert.equal(state.loot.length, state.map.lootPoints.length);
    const authored = new Set(state.map.lootPoints.map(point => `${point.x}/${point.y}/${point.z}`));
    for (const loot of state.loot) assert.ok(authored.has(`${loot.x}/${loot.y}/${loot.z}`), 'loot was teleported to an unauthored point');
    for (const gun of guns) for (const spawn of spawns) assert.ok(Math.hypot(gun.x - spawn.x, gun.z - spawn.z) >= Royale.ROYALE.gunSpawnClearance, `${mapId}/${seed}: gun at a start`);
    advance(state, state.phaseTicks); stepPractice(state);
    for (const player of state.players) {
      assert.equal(player.hasGun, false); assert.equal(selectedInventoryItem(player)?.weapon, 'knife'); assert.equal(player.shots, 0);
    }
    assert.ok(!state.events.some(event => event.type === 'lootPickup' && event.kind === 'weapon'));
  }
});

test('all ten bots travel to finite gun caches before shooting other bots in free-for-all combat', () => {
  const state = tenBots({ difficulty: 'rookie' }); state.map = openArena;
  Object.assign(state.players[0], { x: 0, z: 40, hp: 5000, maxHp: 5000 });
  for (const bot of state.players.slice(1)) Object.assign(bot, { x: -25 + bot.id * 5, y: 0, z: -8, hp: 1000, maxHp: 1000 });
  state.loot = state.players.slice(1).map(bot => ({ id: 200 + bot.id, kind: 'weapon', weapon: 'carbine', ammo: 24, reserve: 48, x: bot.x, y: 0, z: bot.z - 6 }));
  const origins = state.players.map(({ x, z }) => ({ x, z })), seen = new Map(), collected = new Set();
  for (let tick = 0; tick < 1000 && state.phase === 'fight'; tick++) {
    stepPractice(state);
    for (const event of state.events) {
      if (seen.has(event.id)) continue;
      seen.set(event.id, event);
      if (event.type === 'lootPickup' && event.kind === 'weapon') {
        assert.ok(!state.loot.some(loot => loot.id === event.lootId), 'picked-up gun still exists in the world');
        assert.ok(Math.hypot(state.players[event.playerId].x - origins[event.playerId].x, state.players[event.playerId].z - origins[event.playerId].z) >= 4, 'bot skipped the walk to the cache');
        collected.add(event.playerId);
      }
      if (event.type === 'shot' && event.playerId > 0) assert.ok(collected.has(event.playerId), 'bot shot before collecting an actual gun');
    }
    for (const bot of state.players.slice(1)) if (!bot.hasGun) { assert.equal(bot.shots, 0); assert.equal(bot.ammo + bot.reserve, 0); assert.equal(bot.slot, 'sword'); }
  }
  const events = [...seen.values()];
  assert.equal(state.players[10].hasGun, true); assert.ok(state.players[10].shots > 0);
  assert.ok(events.some(event => event.type === 'lootPickup' && event.playerId === 10));
  assert.ok(events.some(event => event.type === 'damage' && event.playerId === 10 && event.targetId > 0 && event.targetId !== 10 && event.damage > 0));
  assert.ok(state.players.slice(1).some(bot => bot.hp < 1000));
  assert.deepEqual([...collected].sort((a, b) => a - b), ids.slice(1));
  assert.ok(state.events.length <= Royale.ROYALE.eventLimit); assert.ok(state.bolts.length <= 24);
});

test('Royale survivors can only use their knife before looting even when stale gun fields or slot inputs request a gun', () => {
  const state = tenBots({ difficulty: 'rookie' }); state.map = openArena; state.loot = [];
  Object.assign(state.players[0], { x: 0, y: 0, z: 0, yaw: 0, hp: 5000, maxHp: 5000 });
  Object.assign(state.players[1], { x: 0, y: 0, z: -1.2, yaw: Math.PI, hp: 5000, maxHp: 5000 });
  for (const bot of state.players.slice(2)) Object.assign(bot, { x: bot.id * 4 - 20, y: 0, z: -30, hp: 5000, maxHp: 5000 });
  // Old active-gun scalar fields are compatibility state, never owned equipment.
  for (const player of state.players) Object.assign(player, { slot: 'primary', weapon: 'sniper', ammo: 99, reserve: 99 });
  const seen = new Map();
  for (let tick = 0; tick < 360; tick++) {
    const player = state.players[0], target = state.players[1], dx = target.x - player.x, dz = target.z - player.z;
    stepPractice(state, { fire: tick % 60 === 8, slot2: tick === 1, swap: tick === 2, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(target.y + 1.2 - player.y - WORLD.eyeHeight, Math.hypot(dx, dz)) });
    for (const event of state.events) seen.set(event.id, event);
  }
  const events = [...seen.values()];
  assert.ok(events.some(event => event.type === 'meleeHit' && event.playerId === 0 && event.weapon === 'knife'));
  assert.ok(events.some(event => event.type === 'meleeHit' && event.playerId === 1 && event.weapon === 'knife'));
  assert.ok(!events.some(event => event.type === 'shot'));
  for (const player of state.players) { assert.equal(player.hasGun, false); assert.equal(player.shots, 0); assert.equal(player.slot, 'sword'); assert.equal(player.ammo + player.reserve, 0); }
});

test('Royale bots reserve their free slots for a real gun and never collect utility or full inventory caches by mistake', () => {
  const state = tenBots({ difficulty: 'rookie' }); state.map = openArena;
  for (const player of state.players) Object.assign(player, { x: player.id * 4 - 20, y: 0, z: -20, hp: 5000, maxHp: 5000 });
  const bot = state.players[10];
  state.loot = [{ id: 600, kind: 'heal', amount: 2, x: bot.x, y: 0, z: bot.z }, { id: 601, kind: 'grenade', amount: 2, x: bot.x, y: 0, z: bot.z + .4 }, { id: 602, kind: 'weapon', weapon: 'carbine', ammo: 24, reserve: 48, x: bot.x, y: 0, z: bot.z + 1.4 }];
  advance(state, 90);
  assert.equal(bot.hasGun, true); assert.equal(bot.weapon, 'carbine');
  assert.ok(state.events.some(event => event.type === 'lootPickup' && event.playerId === 10 && event.lootId === 602));
  assert.ok(state.loot.some(loot => loot.id === 600) && state.loot.some(loot => loot.id === 601));
  assert.equal(bot.inventory[0].weapon, 'knife');
  initializeInventory(bot, { weapon: 'carbine', potions: 2, grenades: 2 });
  bot.ammo = bot.reserve = 0;
  state.loot = [{ id: 700, kind: 'heal', amount: 2, x: bot.x, y: 0, z: bot.z }, { id: 701, kind: 'weapon', weapon: 'smg', ammo: 30, reserve: 60, x: bot.x, y: 0, z: bot.z + 1.4 }];
  state.practice.brains.find(brain => brain.id === 10).nextPlanTick = 0;
  advance(state, 30);
  assert.equal(bot.weapon, 'smg'); assert.ok(state.loot.some(loot => loot.id === 700));
  assert.ok(state.events.some(event => event.type === 'lootPickup' && event.playerId === 10 && event.lootId === 701));
  assert.ok(!state.events.some(event => event.type === 'inventoryFull' && event.playerId === 10));
});

test('ten-bot Royale freezes completely with P pause, resumes with input fences, and replay restores the knife start', () => {
  const state = tenBots({ difficulty: 'rookie' }); advance(state, 30);
  pausePractice(state); const paused = JSON.stringify(state); advance(state, 400, { fire: true, interact: true, jump: true });
  assert.equal(JSON.stringify(state), paused); resumePractice(state);
  const player = state.players[0], pose = [player.x, player.y, player.z];
  stepPractice(state, { fire: true, interact: true, jump: true });
  assert.equal(player.meleePhase, 'idle'); assert.deepEqual([player.x, player.y, player.z], pose);
  state.map = openArena; state.loot = [];
  for (const bot of state.players.slice(1)) Object.assign(bot, { x: bot.id * 3 - 15, z: -20, y: 0 });
  Object.assign(player, { x: 0, z: 20, y: 0, hp: 1 });
  state.matchTicks = Royale.STORM_STAGES.reduce((seconds, stage) => seconds + stage.wait + stage.shrink, 0) * TICK_RATE + TICK_RATE - 1;
  stepPractice(state);
  assert.equal(state.phase, 'matchEnd'); assert.equal(getPracticeStats(state).result, 'lost');
  assert.ok(state.placements.some(entry => entry.playerId === 0));
  const finished = JSON.stringify(state); advance(state, 500, { fire: true, interact: true }); assert.equal(JSON.stringify(state), finished);
  const sessionId = state.practice.sessionId; startPractice(state);
  assert.equal(state.phase, 'countdown'); assert.equal(state.practice.sessionId, sessionId + 1); assert.equal(state.aliveCount, 11);
  assert.equal(state.practice.config.bots, 10); assert.equal(getPracticeStats(state).result, null);
  assert.ok(state.players.every(peer => peer.hp === 200 && !peer.hasGun && peer.meleeWeapon === 'knife' && peer.inventory.filter(Boolean).length === 1));
  assert.equal(state.players[0].shots, 0); assert.equal(getPracticeStats(state).damageTaken, 0);
});

test('ten-bot seeded Royale remains deterministic at 120 Hz independent of render batching', () => {
  const first = tenBots({ seed: 891 }), second = tenBots({ seed: 891 });
  const input = tick => ({ yaw: -.25, pitch: -.1, right: tick % 160 < 35, up: tick % 210 < 80 });
  for (let tick = 0; tick < 600; tick++) stepPractice(first, input(tick));
  for (let frame = 0; frame < 150; frame++) for (let substep = 0; substep < 4; substep++) stepPractice(second, input(frame * 4 + substep));
  assert.deepEqual(first.players, second.players); assert.deepEqual(first.practice, second.practice);
  assert.deepEqual(first.loot, second.loot); assert.deepEqual(first.events, second.events); assert.deepEqual(first.storm, second.storm);
});
