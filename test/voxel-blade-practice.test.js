import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice, getPracticeStats, TICK_RATE, emptyInput } from '../public/voxel-practice-engine.js';
import { MAPS, WORLD, PLAYER_HEALTH } from '../public/voxel-engine.js';
import { MELEE_WEAPONS, meleeComboLength, meleeProfile } from '../public/voxel-melee.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { selectInventorySlot } from '../public/voxel-inventory.js';

const advance = (state, ticks, controls = {}) => {
  for (let tick = 0; tick < ticks; tick++) stepPractice(state, typeof controls === 'function' ? controls(state, tick) : controls);
  return state;
};
function begin(options = {}) {
  const state = createPractice({ mode: 'blades', bots: 1, melee: 'sword', seed: 31415, ...options });
  startPractice(state); advance(state, state.phaseTicks);
  assert.equal(state.phase, 'fight'); return state;
}
function bodyClear(map, player) {
  assert.ok(player.x >= map.bounds.minX + WORLD.radius - 1e-6 && player.x <= map.bounds.maxX - WORLD.radius + 1e-6);
  assert.ok(player.z >= map.bounds.minZ + WORLD.radius - 1e-6 && player.z <= map.bounds.maxZ - WORLD.radius + 1e-6);
  for (const box of map.colliders) {
    if (player.y >= box.y + box.h - 1e-7 || player.y + WORLD.standHeight <= box.y + 1e-7) continue;
    const dx = player.x - Math.max(box.x, Math.min(box.x + box.w, player.x)), dz = player.z - Math.max(box.z, Math.min(box.z + box.d, player.z));
    assert.ok(dx * dx + dz * dz >= WORLD.radius ** 2 - 1e-6, `${map.id}/${player.id} penetrates ${box.id}`);
  }
}
function equippedKit(state, blade, gun) {
  const player = state.players[0];
  assert.equal(player.inventory[0].kind, 'melee'); assert.equal(player.inventory[0].weapon, blade);
  assert.equal(player.inventory[1].kind, 'weapon'); assert.equal(player.inventory[1].weapon, gun);
  assert.equal(player.inventory[1].ammo, WEAPONS[gun].magazine); assert.equal(player.inventory[1].reserve, WEAPONS[gun].reserve);
  assert.deepEqual(player.inventory.slice(2), [null, null]); assert.equal(player.potions, 0); assert.equal(player.grenades, 0);
}

test('blade training is a Breach-only, explicit 1–5-target drill with real inventory selection', () => {
  for (const melee of Object.keys(MELEE_WEAPONS)) for (const bots of [1, 5]) {
    const state = createPractice({ mode: 'blades', melee, weapon: 'vandal', bots, seed: 27 });
    assert.equal(state.phase, 'ready'); assert.equal(state.players[0].slot, 'primary'); equippedKit(state, melee, 'vandal');
    const ready = JSON.stringify(state); advance(state, 180, { fire: true, up: true }); assert.equal(JSON.stringify(state), ready);
    startPractice(state); assert.equal(state.phase, 'countdown'); assert.equal(state.players[0].inventoryIndex, 0); assert.equal(state.players[0].slot, 'sword');
    assert.equal(state.players[0].meleeWeapon, melee); assert.equal(state.practice.brains.length, bots); equippedKit(state, melee, 'vandal');
    assert.ok(selectInventorySlot(state.players[0], 1)); assert.equal(state.players[0].weapon, 'vandal'); assert.equal(state.players[0].slot, 'primary');
  }
  for (const options of [{ game: 'voxel-royale', mode: 'blades' }, { game: 'royale', mode: 'blades' }, { mode: 'blades', melee: '__proto__' }, { mode: 'blades', melee: 'unknown' }]) assert.throws(() => createPractice(options), RangeError);
});

test('blade targets approach and continue strafing on every authored map without attacking, clipping or teleporting', () => {
  for (const mapId of Object.keys(MAPS)) {
    const state = begin({ mapId, bots: 5 }), initial = state.players.slice(1).map(player => ({ x: player.x, z: player.z }));
    let closest = Infinity, lateMovement = 0;
    for (let tick = 0; tick < 960; tick++) {
      const before = state.players.slice(1).map(player => ({ x: player.x, z: player.z }));
      stepPractice(state);
      for (const bot of state.players.slice(1)) {
        bodyClear(state.map, bot);
        const moved = Math.hypot(bot.x - before[bot.id - 1].x, bot.z - before[bot.id - 1].z);
        assert.ok(moved < .08, `${mapId}: target teleported`);
        if (tick > 600) lateMovement += moved;
        closest = Math.min(closest, Math.hypot(bot.x - state.players[0].x, bot.z - state.players[0].z));
        assert.equal(bot.shots, 0); assert.equal(bot.meleeIndex, 0); assert.equal(bot.damageDealt, 0);
      }
    }
    assert.ok(closest < 1.6, `${mapId}: no target entered cutting range (${closest})`);
    assert.ok(lateMovement > 2, `${mapId}: targets stopped moving at close range`);
    assert.ok(state.players.slice(1).some((bot, index) => Math.hypot(bot.x - initial[index].x, bot.z - initial[index].z) > 3));
    assert.equal(state.players[0].hp, PLAYER_HEALTH); assert.equal(getPracticeStats(state).damageTaken, 0);
  }
});

for (const blade of Object.keys(MELEE_WEAPONS)) test(`${blade}: the authored drill produces real cuts, damage, a clear result and fresh replay`, () => {
  const state = begin({ melee: blade });
  for (let tick = 0; tick < 2400 && state.phase === 'fight'; tick++) {
    const player = state.players[0], target = state.players[1], distance = Math.hypot(target.x - player.x, target.z - player.z);
    stepPractice(state, { yaw: Math.atan2(target.x - player.x, -(target.z - player.z)), pitch: 0, up: distance > 1.1, fire: distance < 1.5 && !player.meleeTicks && !player.previousInput.fire });
    for (const peer of state.players) bodyClear(state.map, peer);
  }
  const stats = getPracticeStats(state);
  assert.equal(state.phase, 'matchEnd'); assert.equal(stats.result, 'won'); assert.equal(stats.kills, 1);
  assert.equal(stats.damageDealt, 200); assert.equal(stats.damageTaken, 0); assert.equal(stats.shots, 0);
  let expectedHits = 0, chainDamage = 0;
  while (chainDamage < PLAYER_HEALTH) { expectedHits++; chainDamage += meleeProfile({ meleeWeapon: blade, meleeComboWeapon: blade, meleeComboStep: (expectedHits - 1) % meleeComboLength(blade) + 1 }).damage; }
  assert.equal(stats.hits, expectedHits);
  assert.ok(stats.landedSwings > 0 && stats.landedSwings <= stats.swings); assert.equal(stats.accuracy, stats.landedSwings / stats.swings * 100);
  assert.ok(state.events.some(event => event.type === 'meleeHit' && event.weapon === blade && event.targetId === 1));
  const terminal = JSON.stringify(state); advance(state, 240, { fire: true }); assert.equal(JSON.stringify(state), terminal);
  startPractice(state); assert.equal(state.phase, 'countdown'); assert.equal(state.players[0].meleeWeapon, blade); assert.equal(state.players[0].inventoryIndex, 0);
  assert.equal(getPracticeStats(state).sessionId, 2); assert.equal(getPracticeStats(state).swings, 0); assert.equal(getPracticeStats(state).damageDealt, 0);
  assert.equal(state.players[0].pendingMeleeTicks, 0); equippedKit(state, blade, 'carbine');
});

test('blade targets use actual sight and last-seen memory instead of tracking a hidden player', () => {
  const state = begin(), bot = state.players[1], player = state.players[0], brain = state.practice.brains[0];
  state.map = { id: 'blade-cover-fixture', bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, colliders: [] };
  Object.assign(player, { x: 0, y: 0, z: 4, previousInput: emptyInput() }); Object.assign(bot, { x: 0, y: 0, z: -4 });
  stepPractice(state); assert.deepEqual(brain.lastKnownTarget, { x: 0, z: 4 });
  state.map = { ...state.map, colliders: [{ id: 'sealed-wall', x: -12, y: 0, z: -.1, w: 24, h: 4, d: .2 }] };
  // Changing a test pose verifies the bot cannot observe a hidden location;
  // production movement and collision remain the same shipped combatStep.
  Object.assign(player, { x: 6, z: 4 });
  advance(state, 180);
  assert.equal(brain.seenTick, -1); assert.deepEqual(brain.lastKnownTarget, { x: 0, z: 4 });
  assert.deepEqual(brain.goal, { x: 0, z: 4 }); assert.equal(player.hp, PLAYER_HEALTH); bodyClear(state.map, bot);
});

test('a physical barrier stops a real training slash and hidden targets stay on their legal side', () => {
  const state = begin(), player = state.players[0], bot = state.players[1];
  state.map = { id: 'blade-contact-cover', bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, colliders: [{ id: 'solid-wall', x: -10, y: 0, z: -.1, w: 20, h: 4, d: .2 }] };
  Object.assign(player, { x: 0, y: 0, z: .75, yaw: 0, pitch: 0, previousInput: emptyInput() });
  Object.assign(bot, { x: 0, y: 0, z: -.75, yaw: Math.PI, previousInput: emptyInput({ yaw: Math.PI }) });
  stepPractice(state, { fire: true }); advance(state, 72);
  assert.equal(player.meleeIndex, 1); assert.equal(bot.hp, PLAYER_HEALTH); assert.equal(getPracticeStats(state).damageDealt, 0);
  assert.equal(getPracticeStats(state).landedSwings, 0); assert.equal(getPracticeStats(state).accuracy, 0);
  assert.equal(state.practice.brains[0].lastKnownTarget, null); assert.ok(bot.z <= -.1 - WORLD.radius + 1e-6);
  bodyClear(state.map, player); bodyClear(state.map, bot);
});

test('pause cancels an accepted queued cut, freezes the current commitment, and requires fresh action on resume', () => {
  const state = begin({ melee: 'katana' }), player = state.players[0];
  stepPractice(state, { fire: true, yaw: Math.PI });
  while (player.meleeTicks > 7) stepPractice(state, { yaw: Math.PI });
  stepPractice(state, { fire: true, yaw: Math.PI }); assert.ok(player.pendingMeleeTicks > 0);
  const ticks = player.meleeTicks, index = player.meleeIndex;
  pausePractice(state); assert.equal(player.pendingMeleeTicks, 0); assert.equal(player.meleeTicks, ticks);
  const frozen = JSON.stringify(state); advance(state, 300, { fire: true, up: true }); assert.equal(JSON.stringify(state), frozen);
  resumePractice(state); advance(state, 120, { fire: true, aim: true, slot2: true });
  assert.equal(player.meleeIndex, index); assert.equal(player.inventoryIndex, 0); assert.equal(player.pendingMeleeTicks, 0);
  stepPractice(state); stepPractice(state, { fire: true }); assert.equal(player.meleeIndex, index + 1);
});

test('held start input cannot produce a latent cut after the blade countdown', () => {
  const state = createPractice({ mode: 'blades', melee: 'tonfas', seed: 91 }); startPractice(state);
  advance(state, state.phaseTicks + 90, { fire: true, jump: true });
  assert.equal(state.players[0].meleeIndex, 0); assert.equal(state.players[0].pendingMeleeTicks || 0, 0);
  stepPractice(state); stepPractice(state, { fire: true }); assert.equal(state.players[0].meleeIndex, 1);
});

test('existing target/combat starts and every Royale start still use the original knife kit', () => {
  for (const game of ['voxel', 'voxel-royale']) for (const mode of ['targets', 'combat']) {
    const state = createPractice({ game, mode, melee: 'axe', weapon: 'phantom', bots: 3, seed: 22 });
    assert.equal(state.practice.config.melee, 'knife'); startPractice(state);
    for (const player of state.players) { assert.equal(player.meleeWeapon, 'knife'); assert.equal(player.potions, 0); assert.equal(player.grenades, 0); }
    if (game === 'voxel') { equippedKit(state, 'knife', 'phantom'); assert.equal(state.players[0].inventoryIndex, 1); }
    else { assert.equal(state.players[0].hasGun, false); assert.equal(state.players[0].inventoryIndex, 0); assert.deepEqual(state.players[0].inventory.slice(1), [null, null, null]); }
    assert.ok(state.practice.brains.every(brain => !Object.hasOwn(brain, 'lastKnownTarget')));
  }
});

test('blade drill movement, contacts and stats are seed deterministic across presentation schedules', () => {
  const options = { mode: 'blades', melee: 'sword', bots: 5, seed: 0 }, first = createPractice(options), second = createPractice(options);
  startPractice(first); startPractice(second);
  const input = tick => ({ yaw: .12, pitch: -.08, right: tick % 240 < 60, fire: tick % 90 === 0 });
  for (let tick = 0; tick < 960; tick++) stepPractice(first, input(tick));
  for (let frame = 0; frame < 240; frame++) for (let sub = 0; sub < 4; sub++) stepPractice(second, input(frame * 4 + sub));
  assert.deepEqual(first.players, second.players); assert.deepEqual(first.practice, second.practice); assert.deepEqual(first.events, second.events);
});

test('blade setup is public, scoped to training, and exposes no state mutation API', async () => {
  const [html, client] = await Promise.all(['public/voxel-practice.html', 'public/voxel-practice-client.js'].map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  assert.match(html, /value="blades">Blade training/); assert.match(html, /id="practice-blade" aria-label="Blade training weapon"/);
  assert.match(client, /if \(royale\).*option\[value="blades"\].*remove/);
  assert.match(client, /Object\.entries\(MELEE_WEAPONS\)/); assert.match(client, /Training kit:/);
  assert.match(client, /local\.pendingMeleeTicks > 0/);
  assert.match(client, /const api = Object\.freeze\(\{ getState: inspect, getDisplayTiming:/);
});
