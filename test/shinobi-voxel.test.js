import test from 'node:test';
import assert from 'node:assert/strict';
import * as Shinobi from '../public/shinobi-voxel-engine.js';
import * as Voxel from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath } from '../public/voxel-navigation.js';
import { createMovementPresenter } from '../public/voxel-presentation.js';
const input = (values = {}) => Object.assign(Shinobi.emptyInput(), values);
function fight(options = {}) {
  const state = Shinobi.createState({ online: true, ...options }); Shinobi.startMatch(state);
  while (state.phase === 'countdown') Shinobi.step(state);
  Shinobi.step(state, [input(), input({ yaw: Math.PI })]); return state;
}
function duel() {
  const state = fight();
  Object.assign(state.players[0], { x: 0, y: 0, z: 8, yaw: 0, vx: 0, vy: 0, vz: 0 });
  Object.assign(state.players[1], { x: 0, y: 0, z: 5.3, yaw: Math.PI, vx: 0, vy: 0, vz: 0 });
  return state;
}
function cut(state, tick, intervals = [0, 43, 86]) {
  const a = state.players[0], b = state.players[1], dx = b.x - a.x, dz = b.z - a.z;
  Shinobi.step(state, [input({ fire: intervals.includes(tick), up: Math.hypot(dx, dz) > 2.65, yaw: Math.atan2(dx, -dz) }), input({ yaw: Math.PI })]);
}
test('separate 3D catalog has distinct real geometry, legal spawns and connected climb routes', () => {
  assert.equal(Shinobi.MAP_IDS.length, 3);
  const signatures = new Set();
  for (const map of Object.values(Shinobi.MAPS)) {
    assert.equal(map.theme, 'dojo'); assert.ok(map.description.length > 70); assert.ok(map.routes.length);
    assert.ok(map.spawns.flat().every(spawn => navigationCanOccupy(map, spawn)));
    signatures.add(JSON.stringify(map.colliders.map(box => [box.x, box.y, box.z, box.w, box.h, box.d])));
    for (const route of map.routes) {
      assert.ok(navigationCanOccupy(map, route.start)); assert.ok(navigationCanOccupy(map, route.destination));
      const path = navigationPath(map, route.start, route.destination);
      assert.ok(path.length, route.id); assert.ok(path.some(point => point.jump), route.id);
      assert.equal(path.at(-1).y, route.destination.y);
    }
  }
  assert.equal(signatures.size, 3);
});
test('every authored second-floor route is climbed with actual jump and movement inputs', () => {
  for (const map of Object.values(Shinobi.MAPS)) for (const route of map.routes) {
    const state = fight({ mapId: map.id }), player = state.players[0];
    Object.assign(player, route.start, { vx: 0, vy: 0, vz: 0, grounded: true });
    Object.assign(state.players[1], map.spawns[1][1]);
    const path = navigationPath(map, route.start, route.destination); let jumps = 0;
    for (let tick = 0; tick < 1500 && path.length; tick++) {
      while (path.length && Math.hypot(path[0].x - player.x, path[0].z - player.z) < .35 && Math.abs(path[0].y - player.y) < .15) path.shift();
      if (!path.length) break;
      const next = path[0], command = input({ up: true, yaw: Math.atan2(next.x - player.x, -(next.z - player.z)) });
      command.jump = next.jump && next.y > player.y + .14 && player.grounded && !player.previousInput.jump;
      jumps += command.jump ? 1 : 0; Shinobi.step(state, [command, input(state.players[1])]);
    }
    assert.equal(path.length, 0, route.id); assert.ok(jumps >= 3, route.id); assert.ok(Math.abs(player.y - route.destination.y) < 1e-7);
    assert.ok(navigationCanOccupy(map, player), route.id);
  }
});
test('all fighters carry the same katana and no guns or consumables', () => {
  for (const bots of [1, 2, 3, 4]) {
    const state = Shinobi.createState({ bots }); assert.equal(state.players.length, bots + 1);
    for (const player of state.players) {
      assert.equal(player.slot, 'sword'); assert.equal(player.meleeWeapon, 'katana'); assert.equal(player.hp, Shinobi.RULES.health);
      assert.deepEqual(player.inventory.map(item => item?.kind || null), ['melee', null, null, null]);
      assert.equal(player.potions, 0); assert.equal(player.grenades, 0); assert.notEqual(player.bot, true);
    }
  }
  const online = Shinobi.createState({ online: true, bots: 4 }); assert.equal(online.players.length, 2); assert.equal(online.bots, 0); assert.ok(online.players.every(player => !player.shinobiBot));
});
test('movement, sprint, crouch, jump and physical collisions reuse exact Voxel combatStep', () => {
  const state = duel(); state.players[1].alive = false;
  // Keep a living separated peer so elimination does not replace the physical tick.
  state.players[1].alive = true; Object.assign(state.players[1], { x: 10, z: 10 });
  const reference = Shinobi.cloneState(state);
  for (let tick = 0; tick < 120; tick++) {
    const commands = [input({ up: true, right: tick < 25, sprint: tick < 40, jump: tick === 45, crouch: tick > 100, yaw: .28 }), input({ yaw: Math.PI })];
    Shinobi.step(state, commands); reference.tick++; Voxel.combatStep(reference, commands, reference.map);
    for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'grounded', 'crouching', 'stamina', 'sprinting']) assert.equal(state.players[0][key], reference.players[0][key], `${tick}:${key}`);
  }
  assert.ok(state.players[0].stamina < 100); assert.equal(state.players[0].crouching, true);
});
test('camera-relative movement and dash remain forward while crosshair combat aim turns sideways', () => {
  const state = duel(), player = state.players[0]; player.x = -3; state.players[1].x = 10;
  const start = { x: player.x, z: player.z };
  for (let tick = 0; tick < 40; tick++) Shinobi.step(state, [input({ up: true, moveYaw: 0, yaw: Math.PI / 2 }), input({ yaw: Math.PI })]);
  assert.equal(player.yaw, Math.PI / 2); assert.ok(Math.abs(player.x - start.x) < 1e-7); assert.ok(player.z < start.z - 1);
  const beforeDash = { x: player.x, z: player.z };
  Shinobi.step(state, [input({ dash: true, up: true, moveYaw: 0, yaw: Math.PI / 2 }), input({ yaw: Math.PI })]);
  assert.ok(player.z < beforeDash.z); assert.ok(Math.abs(player.x - beforeDash.x) < 1e-7); assert.equal(player.dashX, 0); assert.equal(player.dashZ, -1);
  const predicted = Voxel.copyMovementState(player); Shinobi.predictLocalMovement(predicted, input({ up: true, moveYaw: 0, yaw: Math.PI / 2 }), state.map);
  Shinobi.step(state, [input({ up: true, moveYaw: 0, yaw: Math.PI / 2 }), input({ yaw: Math.PI })]);
  assert.ok(Math.abs(predicted.x - player.x) < 1e-7); assert.ok(Math.abs(predicted.z - player.z) < 1e-7);
  const legacy = duel(), legacyPlayer = legacy.players[0]; legacyPlayer.x = -3; legacy.players[1].x = 10;
  const legacyStart = { x: legacyPlayer.x, z: legacyPlayer.z };
  for (let tick = 0; tick < 40; tick++) Shinobi.step(legacy, [input({ up: true, yaw: Math.PI / 2 }), input({ yaw: Math.PI })]);
  assert.ok(legacyPlayer.x > legacyStart.x + 1); assert.ok(Math.abs(legacyPlayer.z - legacyStart.z) < 1e-7);
});
test('dash is a finite stamina-funded swept movement and cannot cross solid cover or repeat while held', () => {
  const state = duel(), player = state.players[0]; Object.assign(player, { x: 7, z: 5.15, yaw: 0 });
  const startZ = player.z;
  Shinobi.step(state, [input({ dash: true }), input({ yaw: Math.PI })]);
  assert.equal(player.dashes, 1); assert.ok(player.z < startZ); assert.ok(startZ - player.z < .2);
  assert.ok(player.stamina <= 100 - Shinobi.DASH.staminaCost + .001);
  for (let i = 0; i < 120; i++) Shinobi.step(state, [input({ dash: true }), input({ yaw: Math.PI })]);
  assert.equal(player.dashes, 1); assert.ok(player.z >= 4.8 + player.radius - 1e-6); assert.equal(player.dashTicks, 0);
});
test('movement-only prediction follows accepted dash travel without creating combat or spending an extra charge', () => {
  const state = duel(); state.players[0].x = -3; state.players[1].x = 10;
  Shinobi.step(state, [input({ dash: true }), input({ yaw: Math.PI })]);
  const accepted = state.players[0], predicted = Voxel.copyMovementState(accepted), snapshot = JSON.stringify(state), initialDashes = predicted.dashes;
  for (let tick = 0; tick < Shinobi.DASH.ticks - 1; tick++) {
    Shinobi.predictLocalMovement(predicted, input({ dash: true, up: true }), state.map, 1, [state.players[1]]);
    if (tick === 0) assert.equal(JSON.stringify(state), snapshot);
    Shinobi.step(state, [input({ dash: true, up: true }), input({ yaw: Math.PI })]);
    for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'dashTicks', 'stamina']) assert.ok(Math.abs(predicted[key] - accepted[key]) < 1e-7, `${tick}:${key}`);
  }
  assert.equal(predicted.dashes, initialDashes); assert.equal(predicted.hp, accepted.hp); assert.equal(predicted.kunai, accepted.kunai);
});
test('display prediction invalidates when camera movement heading changes under the same crosshair aim', () => {
  const state = duel(), player = state.players[0]; player.x = -3; state.players[1].x = 10;
  const present = createMovementPresenter(), peers = [state.players[1]]; let calls = 0;
  const predict = (...args) => { calls++; return Shinobi.predictLocalMovement(...args); };
  const forward = input({ up: true, yaw: Math.PI / 2, moveYaw: 0 }), sideways = input({ up: true, yaw: Math.PI / 2, moveYaw: Math.PI / 2 }), snapshot = JSON.stringify(state);
  const first = present(player, forward, state.map, 1 / 240, predict, peers);
  present(player, { ...forward }, state.map, 1 / 240, predict, peers); assert.equal(calls, 1);
  const second = present(player, sideways, state.map, 1 / 240, predict, peers); assert.equal(calls, 2);
  assert.ok(first.z < player.z); assert.ok(Math.abs(first.x - player.x) < 1e-7);
  assert.ok(second.x > player.x); assert.ok(Math.abs(second.z - player.z) < 1e-7);
  assert.equal(JSON.stringify(state), snapshot);
});
test('display cache invalidates an accepted dash stop or direction correction at an unchanged wall pose', () => {
  const state = duel(), player = state.players[0]; Object.assign(player, { x: 7, y: 0, z: 5.12, dashTicks: 18, dashX: 0, dashZ: -1 });
  const present = createMovementPresenter(), peers = [state.players[1]], buttons = input(); let calls = 0;
  const predict = (...args) => { calls++; return Shinobi.predictLocalMovement(...args); };
  const first = present(player, buttons, state.map, 1 / 240, predict, peers);
  present(player, buttons, state.map, 1 / 240, predict, peers); assert.equal(calls, 1);
  assert.ok(Math.abs(first.z - player.z) < 1e-7); // Real cover stops the accepted dash.
  player.dashTicks = 0;
  present(player, buttons, state.map, 1 / 240, predict, peers); assert.equal(calls, 2);
  player.dashTicks = 18; player.dashX = -1; player.dashZ = 0;
  const corrected = present(player, buttons, state.map, 1 / 240, predict, peers); assert.equal(calls, 3);
  assert.ok(corrected.x < player.x); assert.equal(player.x, 7); assert.equal(player.z, 5.12);
});
test('primary requires fresh confirmed clicks to chain into the three-cut finisher with knockback and stun', () => {
  const state = duel();
  for (let tick = 0; tick < 145 && state.phase === 'fight'; tick++) cut(state, tick);
  const hits = state.events.filter(event => event.type === 'meleeHit' && event.playerId === 0);
  assert.deepEqual(hits.map(event => event.comboStep), [1, 2, 3]); assert.equal(hits.at(-1).comboFinisher, true);
  assert.ok(state.events.some(event => event.type === 'meleeStun')); assert.ok(state.events.some(event => event.type === 'meleeKnockback'));
  assert.equal(state.scores[0], 1); assert.equal(state.players[0].kills, 1); assert.equal(state.players[0].damageDealt, Shinobi.RULES.health); assert.equal(state.players[1].damageTaken, Shinobi.RULES.health);
  const held = duel(); for (let tick = 0; tick < 140; tick++) Shinobi.step(held, [input({ fire: true }), input({ yaw: Math.PI })]);
  assert.equal(held.players[0].meleeIndex, 1); assert.equal(held.players[1].hp, Shinobi.RULES.health - 75);
});
test('timed facing parry stops a real cut while an early or backwards guard fails', () => {
  const state = duel();
  for (let tick = 0; tick < 24; tick++) Shinobi.step(state, [input({ fire: tick === 0 }), input({ yaw: Math.PI, aim: tick === 4 })]);
  assert.equal(state.players[1].hp, Shinobi.RULES.health); assert.equal(state.players[1].parries, 1); assert.ok(state.events.some(event => event.type === 'meleeParry'));
  const backwards = duel(); for (let tick = 0; tick < 24; tick++) Shinobi.step(backwards, [input({ fire: tick === 0 }), input({ yaw: 0, aim: tick === 4 })]);
  assert.equal(backwards.players[1].hp, Shinobi.RULES.health - 75); assert.equal(backwards.players[1].parries, 0);
});
test('startup feint spends stamina, cancels damage and cannot be repeated during cooldown', () => {
  const state = duel(), player = state.players[0]; Shinobi.step(state, [input({ fire: true }), input({ yaw: Math.PI })]);
  assert.equal(player.meleePhase, 'startup'); Shinobi.step(state, [input({ feint: true }), input({ yaw: Math.PI })]);
  assert.equal(player.feints, 1); assert.equal(player.meleeTicks, 0); assert.equal(player.stamina, 100 - Shinobi.FEINT.staminaCost);
  for (let tick = 0; tick < 45; tick++) Shinobi.step(state, [input({ feint: true }), input({ yaw: Math.PI })]);
  assert.equal(player.feints, 1); assert.equal(state.players[1].hp, Shinobi.RULES.health);
});
test('kunai have finite travel, limited replenishing charges and wall contact blocks damage', () => {
  const state = duel(); Object.assign(state.players[0], { x: -10, z: 1, yaw: Math.PI / 2 }); Object.assign(state.players[1], { x: -6, z: 1, yaw: -Math.PI / 2 });
  Shinobi.step(state, [input({ kunai: true, yaw: Math.PI / 2 }), input({ yaw: -Math.PI / 2 })]); assert.equal(state.players[0].kunai, 2); assert.equal(state.kunai.length, 1);
  for (let tick = 0; tick < 65; tick++) Shinobi.step(state, [input(), input({ yaw: Math.PI })]);
  assert.equal(state.players[1].hp, Shinobi.RULES.health); assert.equal(state.kunai.length, 0);
  assert.ok(state.events.some(event => event.type === 'kunaiImpact' && event.colliderId === 'shinobi-courtyard-west-screen'));
  for (let tick = 65; tick < Shinobi.KUNAI.recoveryTicks; tick++) Shinobi.step(state, [input(), input({ yaw: Math.PI })]);
  assert.equal(state.players[0].kunai, Shinobi.KUNAI.capacity);
});
test('a real timed guard reflects a kunai once, crediting the new owner', () => {
  const state = duel(); state.players[1].z = 3.5;
  for (let tick = 0; tick < 40; tick++) Shinobi.step(state, [input({ kunai: tick === 0 }), input({ yaw: Math.PI, aim: tick === 5 })]);
  assert.equal(state.players[0].hp, Shinobi.RULES.health - Shinobi.KUNAI.damage); assert.equal(state.players[1].hp, Shinobi.RULES.health);
  assert.equal(state.players[1].parries, 1); assert.equal(state.players[1].kunaiHits, 1); assert.equal(state.players[1].damageDealt, Shinobi.KUNAI.damage);
  assert.equal(state.events.filter(event => event.type === 'kunaiParry').length, 1);
});
test('two actual eliminated rounds produce victory and preserve cumulative accepted stats', () => {
  const state = duel();
  for (let round = 0; round < 2; round++) {
    if (round) {
      while (state.phase === 'roundEnd' || state.phase === 'countdown') Shinobi.step(state);
      Shinobi.step(state, [input(), input({ yaw: Math.PI })]);
      Object.assign(state.players[0], { x: 0, y: 0, z: 8 }); Object.assign(state.players[1], { x: 0, y: 0, z: 5.3 });
    }
    for (let tick = 0; tick < 145 && state.phase === 'fight'; tick++) cut(state, tick);
  }
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.winner, 0); assert.deepEqual(state.scores, [2, 0]); assert.equal(state.players[0].kills, 2); assert.equal(state.players[0].damageDealt, Shinobi.RULES.health * 2);
  assert.ok(state.fightTicks > 100 && state.fightTicks < 300);
  const frozen = JSON.stringify(state); Shinobi.step(state, [input({ fire: true, dash: true })]); assert.equal(JSON.stringify(state), frozen);
});
test('solo pause freezes all accepted clocks and online cannot globally pause', () => {
  const state = fight({ online: false }); assert.equal(Shinobi.pauseMatch(state), true); const frozen = JSON.stringify(state);
  for (let i = 0; i < 100; i++) Shinobi.step(state, [input({ fire: true, dash: true })]); assert.equal(JSON.stringify(state), frozen);
  assert.equal(Shinobi.resumeMatch(state), true); assert.equal(state.phase, 'fight');
  assert.equal(Shinobi.pauseMatch(fight()), false);
});
test('seeded bots use human rules, navigate cover and punish an idle opponent on every arena', () => {
  for (const mapId of Shinobi.MAP_IDS) {
    const state = Shinobi.createState({ mapId, bots: 4, difficulty: 'expert' }); Shinobi.startMatch(state);
    for (let tick = 0; tick < 2400 && state.phase !== 'matchEnd'; tick++) Shinobi.step(state, Shinobi.botInputs(state));
    assert.equal(state.phase, 'matchEnd', mapId); assert.equal(state.winner, 1); assert.ok(state.players.slice(1).some(player => player.damageDealt > 0));
    assert.ok(state.players.slice(1).some(player => player.kunaiThrown || player.dashes));
    for (const player of state.players.filter(player => player.alive && player.grounded)) assert.ok(navigationCanOccupy(state.map, player), `${mapId}:${player.id}`);
  }
  const first = fight({ online: false, bots: 2, seed: 17 }), second = Shinobi.cloneState(first);
  for (let tick = 0; tick < 200; tick++) { Shinobi.step(first, Shinobi.botInputs(first)); Shinobi.step(second, Shinobi.botInputs(second)); }
  assert.deepEqual(first, second);
});
test('restart is a new session with stable event identity, fresh equipment and reset stats', () => {
  const state = duel(), matchId = state.matchId, tick = state.tick, eventId = state.eventId; Shinobi.startMatch(state);
  assert.equal(state.matchId, matchId + 1); assert.equal(state.tick, tick); assert.ok(state.eventId > eventId); assert.equal(state.fightTicks, 0); assert.ok(state.players.every(player => player.kills === 0 && player.kunai === 3));
  const currentId = state.matchId; Shinobi.resetLobby(state); assert.equal(state.phase, 'lobby'); assert.equal(state.matchId, currentId); assert.equal(state.fighters, state.players);
});
