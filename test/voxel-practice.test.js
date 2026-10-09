import assert from 'node:assert/strict';
import test from 'node:test';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice, getPracticeStats, PRACTICE_DIFFICULTIES, TICK_RATE, emptyInput } from '../public/voxel-practice-engine.js';
import { MAPS as BREACH_MAPS, WORLD, PLAYER_HEALTH, eyeHeight } from '../public/voxel-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { WEAPONS, weaponDamage } from '../public/voxel-weapons.js';
import { initializeInventory, selectInventorySlot } from '../public/voxel-inventory.js';

const openArena = Object.freeze({ id: 'practice-fixture', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [], sites: [] });
function advance(state, ticks, input = {}) {
  for (let index = 0; index < ticks; index++) stepPractice(state, typeof input === 'function' ? input(state, index) : input);
  return state;
}
function fight(options = {}) {
  const state = createPractice({ bots: 1, mode: 'targets', seed: 7521, ...options }); startPractice(state);
  advance(state, state.phaseTicks);
  assert.equal(state.phase, 'fight'); state.map = openArena;
  if (state.gameId === 'voxel-royale') state.loot = [];
  Object.assign(state.players[0], { x: 0, y: 0, z: 6, yaw: 0, pitch: 0, grounded: true, previousInput: emptyInput() });
  for (const bot of state.players.filter(player => player.bot)) Object.assign(bot, { x: (bot.id - 1) * 6, y: 0, z: -6, yaw: Math.PI, pitch: 0, grounded: true, previousInput: emptyInput({ yaw: Math.PI }) });
  return state;
}
function aimAt(state, target, fire = true) {
  const player = state.players[0], dx = target.x - player.x, dz = target.z - player.z;
  return { fire, aim: true, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(target.y + 1.02 - player.y - eyeHeight(player), Math.hypot(dx, dz)) - player.recoil, reload: !player.ammo && player.reserve > 0 };
}
function bodyClear(arena, player) {
  assert.ok(player.x >= arena.bounds.minX + player.radius - 1e-6 && player.x <= arena.bounds.maxX - player.radius + 1e-6);
  assert.ok(player.z >= arena.bounds.minZ + player.radius - 1e-6 && player.z <= arena.bounds.maxZ - player.radius + 1e-6);
  for (const box of arena.colliders) {
    if (player.y >= box.y + box.h - 1e-7 || player.y + WORLD.standHeight <= box.y + 1e-7) continue;
    const dx = player.x - Math.max(box.x, Math.min(box.x + box.w, player.x)), dz = player.z - Math.max(box.z, Math.min(box.z + box.d, player.z));
    assert.ok(dx * dx + dz * dz >= player.radius ** 2 - 1e-6, `${arena.id}/${player.id} penetrates ${box.id}`);
  }
}
function equip(player, weapon = 'carbine') {
  initializeInventory(player, { weapon, potions: player.potions, grenades: player.grenades, melee: player.meleeWeapon });
}

test('local practice is explicitly started, with valid map options and 1–5 bots', () => {
  for (const game of ['voxel', 'voxel-royale']) for (const bots of [1, 5]) {
    const state = createPractice({ game, bots, seed: 12 });
    assert.equal(state.phase, 'ready'); assert.equal(state.tick, 0); assert.equal(state.players, state.fighters);
    const before = JSON.stringify(state); advance(state, 300, { up: true, fire: true }); assert.equal(JSON.stringify(state), before);
    assert.equal(startPractice(state), state); assert.equal(state.phase, 'countdown');
    assert.equal(state.players.filter(player => player.bot && player.alive).length, bots);
    assert.equal(state.players.filter(player => player.alive).length, bots + 1);
    assert.equal(getPracticeStats(state).sessionId, 1);
    const started = JSON.stringify(state); startPractice(state); assert.equal(JSON.stringify(state), started);
  }
  for (const options of [{ game: 'bad' }, { game: '__proto__' }, { mapId: '__proto__' }, { bots: 0 }, { bots: 6 }, { bots: 1.5 }, { mode: 'bad' }, { weapon: '__proto__' }, { difficulty: '__proto__' }, { seed: NaN }]) assert.throws(() => createPractice(options), RangeError);
  assert.equal(createPractice({ game: 'breach' }).gameId, 'voxel-breach'); assert.equal(createPractice({ game: 'royale' }).gameId, 'voxel-royale');
});

test('every authored map provides distinct legal ground spawns for five practice bots', () => {
  for (const game of ['voxel', 'voxel-royale']) for (const mapId of Object.keys(game === 'voxel' ? BREACH_MAPS : Royale.MAPS)) {
    const state = createPractice({ game, mapId, bots: 5, seed: 32 }); startPractice(state);
    const players = state.players.filter(player => player.alive);
    assert.equal(players.length, 6); assert.equal(new Set(players.map(player => `${player.x}/${player.y}/${player.z}`)).size, 6);
    for (const player of players) { bodyClear(state.map, player); assert.equal(player.hp, PLAYER_HEALTH); }
    if (game === 'voxel') { assert.equal(state.bomb, null); assert.equal(state.players[0].team, 0); assert.ok(players.slice(1).every(player => player.team === 1)); }
    else assert.ok(players.every(player => player.team === player.id));
  }
});

test('countdowns freeze movement and held actions must be released before firing or jumping', () => {
  for (const game of ['voxel', 'voxel-royale']) {
    const state = createPractice({ game, bots: 1, seed: 88 }); startPractice(state);
    const player = state.players[0], pose = [player.x, player.y, player.z], countdown = state.phaseTicks;
    advance(state, countdown, { up: true, fire: true, jump: true, grenade: true, interact: true });
    assert.equal(state.phase, 'fight'); assert.deepEqual([player.x, player.y, player.z], pose); assert.equal(getPracticeStats(state).seconds, 0);
    stepPractice(state, { fire: true, jump: true, grenade: true, interact: true });
    assert.equal(player.shots, 0); assert.equal(player.y, 0); assert.equal(state.grenades.length, 0); assert.equal(player.meleePhase, 'idle');
    stepPractice(state); stepPractice(state, { jump: true }); assert.ok(player.y > 0);
  }
});

test('real moving targets patrol continuously without shooting or phasing through cover', () => {
  for (const mapId of ['courtyard', 'depot', 'rooftops', 'paris']) {
    const state = createPractice({ mapId, bots: 3, mode: 'targets', seed: 314 }); startPractice(state); advance(state, state.phaseTicks);
    const initial = state.players.slice(1).map(player => [player.x, player.z]);
    for (let tick = 0; tick < 900; tick++) {
      stepPractice(state);
      if (tick % 15 === 0) for (const bot of state.players.slice(1)) bodyClear(state.map, bot);
    }
    assert.ok(state.players.slice(1).some((bot, index) => Math.hypot(bot.x - initial[index][0], bot.z - initial[index][1]) > 2), `${mapId}: stationary targets`);
    assert.ok(state.players.slice(1).every(bot => bot.shots === 0 && bot.meleePhase === 'idle'));
    assert.equal(state.players[0].hp, PLAYER_HEALTH); assert.equal(getPracticeStats(state).seconds, 7.5);
  }
});

test('combat bots route around a physical wall before acquiring a shot', () => {
  const state = fight({ mode: 'combat', difficulty: 'veteran' });
  state.map = { ...openArena, colliders: [{ id: 'cover', x: -2, y: 0, z: -.5, w: 4, h: 3, d: 1 }] };
  state.players[0].hp = state.players[0].maxHp = 5000;
  let firstShot = null, passedSide = false;
  for (let tick = 0; tick < 1500; tick++) {
    const bot = state.players[1];
    const before = bot.shots; stepPractice(state); bodyClear(state.map, bot);
    if (Math.abs(bot.x) > 2 + bot.radius) passedSide = true;
    if (bot.shots > before && firstShot === null) firstShot = tick;
  }
  assert.ok(passedSide, 'bot stayed pinned to the center of the wall');
  assert.ok(firstShot !== null && firstShot > PRACTICE_DIFFICULTIES.veteran.reactionTicks);
  assert.ok(state.players[0].hp < 5000, 'actual combat damage never reached the player');
});

test('bots cannot acquire or fire at a player through a sealed wall', () => {
  const state = fight({ mode: 'combat', difficulty: 'veteran' });
  state.map = { ...openArena, colliders: [{ id: 'sealed-wall', x: -20, y: 0, z: -.5, w: 40, h: 4, d: 1 }] };
  advance(state, 900); bodyClear(state.map, state.players[1]);
  assert.equal(state.players[1].shots, 0); assert.equal(state.players[0].hp, PLAYER_HEALTH); assert.equal(state.practice.brains[0].seenTick, -1);
});

test('bot reaction, paced bursts and aim mistakes leave human-scale windows', () => {
  const firstShots = {};
  for (const difficulty of Object.keys(PRACTICE_DIFFICULTIES)) {
    const state = fight({ mode: 'combat', difficulty }); state.players[0].hp = state.players[0].maxHp = 5000;
    const settings = PRACTICE_DIFFICULTIES[difficulty], fightStart = state.tick;
    advance(state, settings.reactionTicks); assert.equal(state.players[1].shots, 0, difficulty);
    advance(state, 600 - settings.reactionTicks);
    const shots = state.events.filter(event => event.type === 'shot' && event.playerId === 1);
    assert.ok(shots.length >= 2, difficulty); firstShots[difficulty] = shots[0].tick - fightStart;
    assert.ok(shots[0].tick - fightStart >= settings.reactionTicks);
    assert.ok(shots.slice(1).some((shot, index) => shot.tick - shots[index].tick >= settings.restTicks), `${difficulty}: no rest between bursts`);
    assert.ok(state.practice.brains[0].aimYaw !== 0); assert.ok(Math.abs(state.practice.brains[0].aimYaw) <= settings.aimError);
    if (difficulty !== 'veteran') assert.ok(shots.some(shot => shot.targetId !== 0), `${difficulty}: every moving shot was perfect`);
  }
  assert.ok(firstShots.veteran < firstShots.regular && firstShots.regular < firstShots.rookie);
});

test('a genuinely body-blocked melee bot detects the contact and chooses a recovery route', () => {
  const state = fight({ mode: 'combat', difficulty: 'rookie' });
  state.map = { ...openArena, bounds: { minX: -.5, maxX: .5, minZ: -5, maxZ: 5 } };
  Object.assign(state.players[0], { x: 0, z: -2, hp: 5000, maxHp: 5000 });
  selectInventorySlot(state.players[1], 0);
  Object.assign(state.players[1], { x: 0, z: 0, yaw: 0, meleeCooldown: 100000 });
  advance(state, 450);
  assert.ok(state.practice.brains[0].blockedCount > 0);
  assert.ok(Math.hypot(state.players[0].x - state.players[1].x, state.players[0].z - state.players[1].z) >= WORLD.radius * 2 - 1e-6);
  bodyClear(state.map, state.players[1]); assert.ok(Number.isFinite(state.players[1].x));
});

test('a legal wall contact remains navigable and never traps a bot in a padded planning rectangle', () => {
  const state = fight({ mode: 'combat', difficulty: 'rookie' });
  state.map = { ...openArena, colliders: [{ id: 'long-wall', x: 2, y: 0, z: -10, w: 1, h: 3, d: 20 }] };
  Object.assign(state.players[0], { x: -5, z: 6, hp: 5000, maxHp: 5000 });
  Object.assign(state.players[1], { x: 2 - WORLD.radius, z: -6 });
  const origin = [state.players[1].x, state.players[1].z];
  let maximumTravel = 0;
  advance(state, 360, current => { maximumTravel = Math.max(maximumTravel, Math.hypot(current.players[1].x - origin[0], current.players[1].z - origin[1])); return {}; });
  bodyClear(state.map, state.players[1]); assert.ok(maximumTravel > 2);
});

test('local practice shots use the shipped distinct weapon damages and real contacts', () => {
  for (const weapon of ['carbine', 'smg', 'pistol', 'marksman']) {
    const state = fight({ weapon });
    stepPractice(state, aimAt(state, state.players[1]));
    const event = state.events.find(event => event.type === 'damage' && event.playerId === 0);
    assert.ok(event, weapon); assert.equal(event.hitKind, 'body', weapon);
    assert.equal(event.damage, weaponDamage(weapon, 'body', 12), weapon);
    assert.equal(state.players[1].hp, PLAYER_HEALTH - event.damage); assert.equal(state.players[0].shots, 1);
    assert.equal(getPracticeStats(state).hits, 1); assert.equal(getPracticeStats(state).accuracy, 100);
  }
});

test('friendly bodies stop bullets and receive no damage from another Breach bot', () => {
  const state = fight({ bots: 2, mode: 'combat', difficulty: 'veteran' });
  state.map = { ...openArena, bounds: { minX: -.5, maxX: .5, minZ: -10, maxZ: 10 } };
  Object.assign(state.players[0], { x: 0, z: 6, hp: 5000, maxHp: 5000 }); Object.assign(state.players[1], { x: 0, z: -6 }); Object.assign(state.players[2], { x: 0, z: 0 });
  const firstBot = state.players[1], secondBot = state.players[2];
  // The front bot sees and engages the human; the rear bot sees the friendly body.
  advance(state, 180);
  assert.equal(firstBot.shots, 0); assert.equal(firstBot.damageDealt, 0); assert.equal(secondBot.hp, PLAYER_HEALTH); assert.ok(secondBot.shots > 0);
  assert.ok(state.events.every(event => event.type !== 'damage' || !(event.playerId === 1 && event.targetId === 2)));
});

test('clearing all moving bots ends one real round and reports contact-derived stats', () => {
  const state = fight({ bots: 2 });
  for (let tick = 0; tick < 900 && state.phase === 'fight'; tick++) {
    const target = state.players.find(player => player.bot && player.alive);
    stepPractice(state, aimAt(state, target));
  }
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.winner, 0); assert.equal(state.bomb, null);
  const stats = getPracticeStats(state); assert.equal(stats.result, 'won'); assert.equal(stats.kills, 2); assert.equal(stats.botsRemaining, 0); assert.equal(stats.damageDealt, PLAYER_HEALTH * 2);
  assert.ok(stats.hits <= stats.shots && stats.hits > 0); assert.equal(stats.accuracy, stats.hits / stats.shots * 100);
  assert.ok(Object.isFrozen(stats)); const terminal = JSON.stringify(state); advance(state, 240, { up: true, fire: true }); assert.equal(JSON.stringify(state), terminal);
  startPractice(state); assert.equal(state.phase, 'countdown'); assert.equal(getPracticeStats(state).sessionId, 2); assert.equal(getPracticeStats(state).shots, 0); assert.equal(getPracticeStats(state).seconds, 0);
});

test('combat death ends the local drill, stops simulation and reports damage actually taken', () => {
  const state = fight({ mode: 'combat', difficulty: 'veteran' }); state.players[0].hp = 20;
  advance(state, 1200);
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.players[0].alive, false); assert.equal(getPracticeStats(state).result, 'lost'); assert.equal(getPracticeStats(state).damageTaken, 20);
  assert.equal(state.players[0].deaths, 1); const finished = JSON.stringify(state); advance(state, 100); assert.equal(JSON.stringify(state), finished);
});

test('Royale practice preserves one-life knife starts, seeded native loot and actual E pickups', () => {
  const state = createPractice({ game: 'voxel-royale', mapId: 'forest', bots: 3, seed: 17 }); startPractice(state);
  assert.equal(state.phaseTicks, Royale.ROYALE.countdownTicks); assert.deepEqual(state.participantIds, [0, 1, 2, 3]);
  assert.equal(state.loot.length, Royale.MAPS.forest.lootPoints.length);
  for (const player of state.players.filter(player => player.alive)) {
    assert.equal(player.slot, 'sword'); assert.equal(player.meleeWeapon, 'knife'); assert.equal(player.hasGun, false); assert.equal(player.potions, 0); assert.equal(player.ammo, 0);
  }
  advance(state, state.phaseTicks); state.map = openArena;
  Object.assign(state.players[0], { x: 0, y: 0, z: 6 }); Object.assign(state.players[1], { x: 0, y: 0, z: -6 });
  state.loot = [{ id: 500, kind: 'weapon', weapon: 'smg', ammo: 19, reserve: 31, x: 0, y: 0, z: -6.3 }, { id: 501, kind: 'weapon', weapon: 'marksman', ammo: 8, reserve: 24, x: 0, y: 0, z: 6.3 }];
  stepPractice(state, { interact: true });
  assert.equal(state.players[0].weapon, 'marksman'); assert.equal(state.players[0].hasGun, true);
  assert.equal(state.players[1].weapon, 'smg'); assert.equal(state.players[1].hasGun, true); assert.equal(state.players[1].ammo, 19); assert.equal(state.players[1].reserve, 31);
  assert.ok(state.events.some(event => event.type === 'lootPickup' && event.playerId === 1 && event.lootId === 500));
});

test('unarmed Royale bots traverse a doorway for a genuine supply pickup', () => {
  const state = fight({ game: 'voxel-royale', mode: 'targets' });
  Object.assign(state.players[1], { x: 0, z: -7 });
  state.map = { ...openArena, colliders: [{ id: 'left-wall', x: -8, y: 0, z: -1, w: 7, h: 3, d: 1 }, { id: 'right-wall', x: 1, y: 0, z: -1, w: 7, h: 3, d: 1 }] };
  state.loot = [{ id: 50, kind: 'weapon', weapon: 'pistol', ammo: 12, reserve: 24, x: 0, y: 0, z: 3 }];
  advance(state, 600);
  assert.equal(state.players[1].hasGun, true); assert.equal(state.players[1].weapon, 'pistol');
  assert.ok(state.events.some(event => event.type === 'lootPickup' && event.playerId === 1)); bodyClear(state.map, state.players[1]);
  assert.equal(state.players[1].shots, 0, 'targets mode attacked the local player');
});

test('Royale bots do not receive supplies remotely or through a wall', () => {
  const state = fight({ game: 'voxel-royale' }); Object.assign(state.players[1], { x: 0, z: -1 });
  state.map = { ...openArena, colliders: [{ id: 'sealed-wall', x: -20, y: 0, z: -.2, w: 40, h: 3, d: .4 }] };
  state.loot = [{ id: 50, kind: 'weapon', weapon: 'pistol', ammo: 12, reserve: 24, x: 0, y: 0, z: .4 }, { id: 51, kind: 'weapon', weapon: 'sniper', ammo: 5, reserve: 15, x: 0, y: 3.4, z: -1 }];
  advance(state, 360);
  assert.equal(state.players[1].hasGun, false); assert.equal(state.players[1].ammo, 0); assert.equal(state.loot.length, 2);
});

test('Royale continues the native storm clock while targets patrol and preserves winner placements', () => {
  const state = fight({ game: 'voxel-royale' }); advance(state, 31 * TICK_RATE);
  assert.equal(state.storm.active, true); assert.equal(state.storm.mode, 'shrinking'); assert.ok(state.storm.radius < state.storm.initialRadius); assert.equal(state.matchTicks, 31 * TICK_RATE);
  equip(state.players[0]); state.players[1].hp = 20;
  for (let tick = 0; tick < 300 && state.phase === 'fight'; tick++) stepPractice(state, aimAt(state, state.players[1]));
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.winnerId, 0); assert.equal(getPracticeStats(state).result, 'won'); assert.equal(state.aliveCount, 1);
  assert.deepEqual(state.placements.map(entry => [entry.playerId, entry.place]), [[1, 2], [0, 1]]);
});

test('Royale combat can kill a human using a genuinely picked-up weapon and keeps their placement', () => {
  const state = fight({ game: 'voxel-royale', mode: 'combat', difficulty: 'veteran' }); state.players[0].hp = 20;
  state.loot = [{ id: 42, kind: 'weapon', weapon: 'carbine', ammo: 24, reserve: 48, x: 0, y: 0, z: -6 }];
  advance(state, 1200);
  assert.equal(state.players[1].hasGun, true); assert.equal(state.players[0].alive, false); assert.equal(state.phase, 'matchEnd');
  assert.equal(getPracticeStats(state).result, 'lost'); assert.equal(getPracticeStats(state).damageTaken, 20);
  assert.ok(state.placements.some(entry => entry.playerId === 0 && entry.place === 2)); assert.equal(state.winnerId, 1);
});

test('pause truly freezes clocks, loot, health and bot brains; resume requires fresh action presses', () => {
  for (const game of ['voxel', 'voxel-royale']) {
    const state = fight({ game, mode: 'combat', seed: 491 });
    stepPractice(state, { fire: game === 'voxel', jump: true }); pausePractice(state); assert.equal(state.phase, 'paused');
    const paused = JSON.stringify(state); advance(state, 400, { up: true, fire: true, jump: true, interact: true }); assert.equal(JSON.stringify(state), paused);
    resumePractice(state); assert.equal(state.phase, 'fight');
    const shots = state.players[0].shots; stepPractice(state, { fire: true, jump: true, grenade: true, swap: true });
    assert.equal(state.players[0].shots, shots); assert.equal(state.grenades.length, 0); assert.equal(state.players[0].slot, game === 'voxel' ? 'primary' : 'sword');
    advance(state, 14); stepPractice(state, { fire: true });
    if (game === 'voxel') assert.equal(state.players[0].shots, shots + 1);
    else assert.equal(state.players[0].meleePhase, 'startup');
  }
});

test('seeded 120 Hz practice simulation is independent of presentation batch schedules', () => {
  for (const game of ['voxel', 'voxel-royale']) {
    const options = { game, bots: 3, seed: 0, mode: 'combat', difficulty: 'regular' }, first = createPractice(options), second = createPractice(options);
    startPractice(first); startPractice(second);
    const controls = tick => ({ yaw: .12, pitch: -.1, right: tick % 200 < 70, up: tick % 300 < 100, fire: tick % 120 < 12 });
    for (let tick = 0; tick < 960; tick++) stepPractice(first, controls(tick));
    for (let frame = 0; frame < 240; frame++) for (let substep = 0; substep < 4; substep++) stepPractice(second, controls(frame * 4 + substep));
    assert.deepEqual(first.players, second.players); assert.deepEqual(first.practice, second.practice); assert.deepEqual(first.events, second.events); assert.equal(first.tick, second.tick);
    if (game === 'voxel-royale') { assert.deepEqual(first.loot, second.loot); assert.deepEqual(first.storm, second.storm); }
  }
});
