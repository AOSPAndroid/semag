import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { createFpsInputQueue, releaseFpsTouchAction } from '../public/voxel-input-queue.js';
import { interpolatedVoxelState } from '../public/voxel-presentation.js';
import { hordeLobbyPresentation, hordeSpectatorPlayer, hordeInterpolationSamples, hordeWavePresentation, hordeResultPresentation, hordeOverlayPresentation, hordeRevivePresentation, hordeInputForPhase } from '../public/voxel-horde-client.js';

function active(participants = [0], options = {}) {
  const state = Horde.createState({ seed: 51931, ...options });
  for (const id of participants) Horde.setConnected(state, id, true);
  Horde.startMatch(state, participants);
  while (state.phase === 'countdown') Horde.step(state);
  assert.equal(state.phase, 'fight');
  state.map = Horde.MAPS[state.mapId];
  return state;
}
function spawn(state) {
  for (let tick = 0; tick < 300 && !state.players.some(player => player.monster && player.alive); tick++) Horde.step(state);
  const monster = state.players.find(player => player.monster && player.alive);
  assert.ok(monster, 'real rift spawns a monster');
  return monster;
}
const snapshot = state => structuredClone({ ...state, map: undefined, fighters: undefined });

test('co-op start follows connected ready humans for squads of one, two and three', () => {
  for (const count of [1, 2, 3]) {
    const state = Horde.createState(), roster = Array.from({ length: count }, (_, id) => ({ id, connected: true, ready: true }));
    for (const person of roster) Horde.setConnected(state, person.id, true);
    const view = hordeLobbyPresentation(state, roster, 0, 0);
    assert.equal(view.canStart, true); assert.equal(view.count, count); assert.equal(view.slots.length, 3);
    assert.equal(hordeLobbyPresentation(state, roster, 1, 0).canStart, false);
    assert.equal(hordeLobbyPresentation(state, roster, 0, 0, false).canStart, false);
    roster[count - 1].ready = false;
    assert.equal(hordeLobbyPresentation(state, roster, 0, 0).canStart, false);
    roster[count - 1].connected = false;
    assert.equal(hordeLobbyPresentation(state, roster, 0, 0).canStart, count > 1);
    Horde.startMatch(state, [0]);
    assert.equal(hordeLobbyPresentation(state, roster, 0, 0).canStart, false);
  }
  assert.equal(hordeLobbyPresentation(Horde.createState(), [], 0, 0).canStart, false);
  assert.equal(hordeLobbyPresentation(Horde.createState(), [{ id: 0, connected: true, ready: true }], null, null).canStart, false);
});

test('eliminated co-op player follows a surviving participant, never a monster or unused seat', () => {
  const state = active([0, 2]);
  const monster = spawn(state);
  assert.equal(hordeSpectatorPlayer(state, 0, monster.id).id, 0, 'living local player keeps their own camera');
  applyCombatDamage(state, [{ playerId: monster.id, targetId: 0, damage: 1000, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(state.players[0].alive, false);
  assert.equal(hordeSpectatorPlayer(state, 0, monster.id).id, 2);
  assert.equal(hordeSpectatorPlayer(state, 0, 1).id, 2, 'unused human slot is not a spectator target');
  const before = snapshot(state); hordeSpectatorPlayer(state, 0, 2); assert.deepEqual(snapshot(state), before);
});

test('same-life interpolation samples remain usable without changing authoritative snapshots', () => {
  const state = active(), monster = spawn(state), first = snapshot(state);
  for (let tick = 0; tick < 4; tick++) Horde.step(state);
  const second = snapshot(state), samples = [{ state: first, time: first.tick * 1000 / 120 }, { state: second, time: second.tick * 1000 / 120 }];
  const prepared = hordeInterpolationSamples(samples);
  assert.equal(prepared[0], samples[0]); assert.equal(prepared[1], samples[1]);
  const shown = interpolatedVoxelState(prepared, (samples[0].time + samples[1].time) / 2, 0, { predictMovement: predictLocalMovement });
  assert.equal(shown.players[monster.id].lifeId, monster.lifeId);
  assert.deepEqual(samples[0].state, first); assert.deepEqual(samples[1].state, second);
});

test('recycled real monster slot cannot animate a new life from the previous body', () => {
  const state = active(), oldMonster = spawn(state), first = snapshot(state), oldLife = oldMonster.lifeId;
  applyCombatDamage(state, [{ playerId: 0, targetId: oldMonster.id, damage: 1000, attack: 'gun', weapon: 'carbine' }]);
  let newMonster;
  for (let tick = 0; tick < 300; tick++) { Horde.step(state); newMonster = state.players[oldMonster.id]; if (newMonster.alive && newMonster.lifeId !== oldLife) break; }
  assert.ok(newMonster.alive); assert.notEqual(newMonster.lifeId, oldLife); assert.notEqual(newMonster, oldMonster);
  const second = snapshot(state), samples = [{ state: first, time: 0 }, { state: second, time: 1000 / 30 }], prepared = hordeInterpolationSamples(samples);
  assert.equal(prepared[0].state.players[newMonster.id].alive, false, 'old bracket cannot present a recycled living body');
  assert.equal(samples[0].state.players[newMonster.id].alive, true, 'original received state remains untouched');
  const shown = interpolatedVoxelState(prepared, 1000 / 60, 0);
  for (const axis of ['x', 'y', 'z']) assert.equal(shown.players[newMonster.id][axis], newMonster[axis]);
  assert.equal(shown.players[newMonster.id].lifeId, newMonster.lifeId);
});

test('wave intro and threat count come from real simulation clocks, without advancing them', () => {
  const state = active(), tick = state.tick, before = snapshot(state), intro = hordeWavePresentation(state);
  assert.equal(intro.wave, 1); assert.equal(intro.threats, state.horde.pending + state.horde.alive); assert.equal(intro.banner.title, 'WAVE 1');
  assert.equal(state.tick, tick); assert.deepEqual(snapshot(state), before);
  for (let tick = 0; tick < 241 && state.phase === 'fight'; tick++) Horde.step(state);
  assert.equal(hordeWavePresentation(state).banner, null, 'short wave intro clears instead of covering the whole fight');
});

test('the terminal result shows each selected survivor’s accepted damage rather than overkill or squad totals', () => {
  const state = active([0, 2]), monster = spawn(state), health = monster.hp;
  assert.ok(health > 37);
  applyCombatDamage(state, [
    { playerId: 0, targetId: monster.id, targetLifeId: monster.lifeId, damage: 37, attack: 'gun', weapon: 'carbine' },
    { playerId: 2, targetId: monster.id, targetLifeId: monster.lifeId, damage: 9999, attack: 'gun', weapon: 'carbine' },
  ]);
  Horde.step(state);
  assert.equal(state.players[0].damageDealt, 37);
  assert.equal(state.players[2].damageDealt, health - 37, 'overkill credits only the target’s remaining health');
  assert.equal(state.horde.teamstats.damage, health);
  assert.equal(state.horde.totalKills, 1);
  const attacker = spawn(state);
  applyCombatDamage(state, [0, 2].map(targetId => ({ playerId: attacker.id, targetId, damage: 9999, attack: 'monster', weapon: attacker.monsterType })));
  Horde.step(state);
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.horde.result, 'lost');
  assert.equal(hordeOverlayPresentation(state, { solo: false, connected: true, entered: true, paused: true, alive: false }), 'result', 'the result takes precedence over released or paused controls');
  const before = snapshot(state), first = hordeResultPresentation(state, 0), second = hordeResultPresentation(state, 2);
  assert.equal(first.damage, 37);
  assert.equal(second.damage, health - 37);
  assert.notEqual(first.damage, state.horde.teamstats.damage);
  assert.notEqual(second.damage, state.horde.teamstats.damage);
  assert.equal(second.kills, 1);
  assert.equal(second.wave, state.horde.wave);
  assert.equal(second.elapsed, state.horde.elapsedTicks / Horde.TICK_RATE);
  const reordered = { ...state, players: [attacker, state.players[2], state.players[0], state.players[1]] };
  assert.equal(hordeResultPresentation(reordered, 2).damage, second.damage, 'selection follows the player ID, not its array position');
  assert.equal(hordeResultPresentation(state, attacker.id).damage, 0, 'a monster’s attacks are never presented as the survivor’s score');
  assert.deepEqual(snapshot(state), before, 'reading terminal results leaves the complete run untouched');
  for (let tick = 0; tick < 120; tick++) Horde.step(state);
  assert.deepEqual(hordeResultPresentation(state, 2), second, 'the stopped simulation retains its final personal damage');
});

test('replay creates a fresh Last Stand with the chosen arena, threat and gun while clearing run results', () => {
  const config = { capacity: 3, mapId: 'paris', difficulty: 'nightmare', seed: 51931 }, weapon = 'shotgun';
  const previous = Horde.createState(config);
  assert.equal(Horde.selectLoadout(previous, 0, weapon).ok, true);
  Horde.startMatch(previous, [0]);
  while (previous.phase === 'countdown') Horde.step(previous);
  const target = spawn(previous), targetHp = target.hp;
  applyCombatDamage(previous, [{ playerId: 0, targetId: target.id, targetLifeId: target.lifeId, damage: 9999, attack: 'gun', weapon }]);
  Horde.step(previous);
  const attacker = spawn(previous);
  applyCombatDamage(previous, [{ playerId: attacker.id, targetId: 0, damage: 9999, attack: 'monster', weapon: attacker.monsterType }]);
  Horde.step(previous);
  assert.equal(previous.phase, 'matchEnd');
  assert.equal(hordeResultPresentation(previous).damage, targetHp);
  assert.equal(hordeResultPresentation(previous).kills, 1);
  assert.ok(hordeResultPresentation(previous).elapsed > 0);
  const ended = snapshot(previous);

  // This is the real client replay sequence: fresh state, chosen gun, explicit start.
  const replay = Horde.createState({ ...config, seed: config.seed + 1 });
  assert.equal(Horde.selectLoadout(replay, 0, weapon).ok, true);
  Horde.startMatch(replay, [0]);
  assert.equal(replay.phase, 'countdown');
  assert.equal(replay.phaseTicks, Horde.HORDE_RULES.countdownTicks);
  assert.equal(replay.mapId, config.mapId);
  assert.equal(replay.horde.config.difficulty, config.difficulty);
  assert.equal(replay.capacity, config.capacity);
  assert.equal(replay.players[0].weapon, weapon);
  assert.equal(replay.players[0].hp, replay.players[0].maxHp);
  assert.equal(replay.players[0].alive, true);
  assert.equal(replay.players[0].damageDealt, 0);
  assert.equal(replay.players[0].kills, 0);
  assert.deepEqual(hordeResultPresentation(replay), { wave: 1, kills: 0, elapsed: 0, damage: 0 });
  assert.deepEqual(snapshot(previous), ended, 'starting the next run cannot overwrite the previous terminal result');
  while (replay.phase === 'countdown') Horde.step(replay);
  assert.equal(replay.phase, 'fight');
  assert.equal(replay.players[0].weapon, weapon);
  assert.equal(hordeResultPresentation(replay).damage, 0);
});

test('result presentation safely handles an absent state or survivor without falling back to squad damage', () => {
  const empty = { wave: 0, kills: 0, elapsed: 0, damage: 0 };
  assert.deepEqual(hordeResultPresentation(), empty);
  assert.deepEqual(hordeResultPresentation(null), empty);
  const state = active(), before = snapshot(state), wave = hordeWavePresentation(state);
  assert.deepEqual(hordeResultPresentation(state, 99), { wave: wave.wave, kills: wave.kills, elapsed: wave.elapsed, damage: 0 });
  assert.equal(hordeResultPresentation({ ...state, players: undefined, horde: { ...state.horde, teamstats: { damage: 9000 } } }).damage, 0);
  assert.deepEqual(snapshot(state), before);
});

test('a tap before the next horde physics sample fires once and preserves captured aim', () => {
  const state = active([0], { capacity: 1 }), queue = createFpsInputQueue();
  queue.observe({ fire: true, yaw: .3, pitch: .1 }, 0, { sequence: 1 });
  queue.observe({ fire: false, yaw: .7, pitch: -.2 }, 1, { sequence: 2 });
  const selected = queue.sample({ fire: false, yaw: .7, pitch: -.2 }, 2).buttons;
  assert.equal(selected.fire, true); assert.equal(selected.yaw, .3); assert.equal(selected.pitch, .1);
  Horde.step(state, [selected]); assert.equal(state.players[0].shots, 1);
  for (let tick = 0; tick < 25; tick++) Horde.step(state, [queue.sample({ fire: false }, tick + 3).buttons]);
  assert.equal(state.players[0].shots, 1);
});

test('cancelled pending touch commitments do not consume horde ammo, a grenade or a jump', () => {
  for (const action of ['fire', 'grenade', 'jump']) {
    const state = active(), queue = createFpsInputQueue(), actions = new Set([action]), element = { classList: { remove() {} } }, pointer = { action, element, pressSeq: 1 };
    const before = { ammo: state.players[0].ammo, grenades: state.players[0].grenades, y: state.players[0].y };
    queue.observe({ [action]: true }, 0, { sequence: 1 });
    const cancellation = releaseFpsTouchAction(pointer, new Map(), actions, name => actions.has(name), true);
    assert.deepEqual(cancellation, { action, seq: 1 }); assert.equal(queue.cancel(cancellation), true);
    queue.observe(emptyInput(state.players[0]), 1, { sequence: 2 }); Horde.step(state, [queue.sample(emptyInput(state.players[0]), 2).buttons]);
    assert.equal(state.players[0].ammo, before.ammo); assert.equal(state.players[0].grenades, before.grenades); assert.equal(state.players[0].y, before.y);
  }
});

test('a genuine normal touch release remains a real horde shot', () => {
  const state = active(), queue = createFpsInputQueue(), actions = new Set(['fire']), pointer = { action: 'fire', element: { classList: { remove() {} } }, pressSeq: 1 };
  queue.observe({ fire: true }, 0, { sequence: 1 });
  assert.equal(releaseFpsTouchAction(pointer, new Map(), actions, name => actions.has(name), false), null);
  queue.observe(emptyInput(state.players[0]), 1, { sequence: 2 }); Horde.step(state, [queue.sample(emptyInput(state.players[0]), 2).buttons]);
  assert.equal(state.players[0].shots, 1);
});

test('a co-op teammate who misses the countdown can enter from the fight resume card', () => {
  const state = Horde.createState(); Horde.setConnected(state, 1, true); Horde.startMatch(state, [0, 1]);
  const controls = { solo: false, connected: true, entered: false, paused: false, alive: state.players[1].alive };
  assert.equal(hordeOverlayPresentation(state, controls), 'countdown');
  while (state.phase === 'countdown') Horde.step(state);
  assert.equal(hordeOverlayPresentation(state, controls), 'pause', 'visible resume card is independent of hidden countdown parent');
  assert.equal(hordeOverlayPresentation(state, { ...controls, entered: true }), null);
  assert.equal(hordeOverlayPresentation(state, { ...controls, connected: false }), 'connection');
});

test('revive progress reflects real uninterrupted channel ticks and clears immediately on release', () => {
  const state = active([0, 1]);
  state.map = { ...Horde.MAPS.courtyard, id: 'client-revive-fixture', colliders: [], bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } };
  state.horde.nextSpawnTick = 1e9;
  Object.assign(state.players[0], { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true });
  Object.assign(state.players[1], { x: 1.2, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true });
  applyCombatDamage(state, [{ playerId: 99, targetId: 1, damage: 1000, attack: 'gun', weapon: 'carbine' }]);
  const target = Horde.findReviveTarget(state, 0), rules = { reviveTicks: Horde.HORDE_RULES.reviveTicks, tickRate: Horde.TICK_RATE };
  assert.equal(target.id, 1);
  assert.equal(hordeRevivePresentation(state.players[0], target, rules).active, false);
  for (let tick = 0; tick < 60; tick++) Horde.step(state, [{ interact: true }]);
  const before = snapshot(state), progress = hordeRevivePresentation(state.players[0], target, rules);
  assert.equal(progress.active, true); assert.equal(progress.percent, 16); assert.equal(progress.seconds, 2.5); assert.match(progress.text, /16%.*2\.5s/);
  assert.deepEqual(snapshot(state), before, 'reading the HUD never advances the revive');
  Horde.step(state, [emptyInput(state.players[0])]);
  const reset = hordeRevivePresentation(state.players[0], target, rules);
  assert.equal(reset.active, false); assert.equal(reset.percent, 0); assert.equal(reset.seconds, 3);
  assert.equal(hordeRevivePresentation(state.players[0], null, rules), null);
});

test('intermission permits a real carried-potion pickup while combat previews stay inert', () => {
  const state = active(), player = state.players[0];
  state.map = { ...Horde.MAPS.courtyard, id: 'client-intermission-fixture', colliders: [], bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } };
  Object.assign(player, { x: 0, y: 0, z: 0, yaw: 0, hp: 100, vx: 0, vy: 0, vz: 0, grounded: true });
  state.horde.pending = 0; state.horde.nextSpawnTick = 1e9; Horde.step(state);
  assert.equal(state.phase, 'intermission');
  // Isolate this health-pickup fixture from the separate wave-clear blade cache.
  state.loot = [];
  state.loot.push({ id: 55, type: 'potion', kind: 'heal', amount: 1, x: .5, y: 0, z: 0, expiresTick: state.tick + 1000 });
  const inventory = { ammo: player.ammo, grenades: player.grenades, potions: player.potions, shots: player.shots };
  const raw = { up: true, aim: true, fire: true, grenade: true, heal: true, reload: true, swap: true, yaw: 0, pitch: .2 }, rawCopy = { ...raw };
  const preview = hordeInputForPhase(raw, state.phase);
  for (const action of ['fire', 'aim', 'grenade', 'heal', 'reload', 'swap']) assert.equal(preview[action], false);
  assert.equal(preview.up, true); assert.equal(preview.pitch, .2); assert.deepEqual(raw, rawCopy);
  const predicted = structuredClone(player);
  for (let tick = 0; tick < 16; tick++) { predictLocalMovement(predicted, preview, state.map, 1, state.players); Horde.step(state, [raw]); }
  assert.ok(player.z < -.1); for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(player[axis] - predicted[axis]) < 1e-8, 'real regroup movement matches the reused prediction');
  assert.equal(Horde.findNearbyLoot(state, 0).id, 55);
  const hp = player.hp; Horde.step(state, [{ interact: true, yaw: 0, pitch: .2 }]);
  assert.equal(player.hp, hp, 'collecting a potion does not drink it'); assert.equal(player.potions, inventory.potions + 1); assert.equal(state.loot.some(loot => loot.id === 55), false);
  assert.deepEqual({ ammo: player.ammo, grenades: player.grenades, potions: player.potions, shots: player.shots }, { ...inventory, potions: inventory.potions + 1 });
  assert.equal(hordeInputForPhase(raw, 'fight'), raw, 'combat controls resume unchanged in the real fight');
});
