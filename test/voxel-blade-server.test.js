import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';
import { MELEE_WEAPONS, meleeProfile } from '../public/voxel-melee.js';
import { applyCombatDamage, addInventoryLoot, MAPS } from '../public/voxel-engine.js';
import { Peer, flushPeer } from './ws-helper.js';

async function host(t, gameId = 'voxel-breach') {
  const app = createServer({ autoTick: false, creationLimit: 100 }); await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  const response = await fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, ...(gameId === 'voxel-royale' ? { capacity: 2 } : {}) }) });
  assert.equal(response.status, 201); const room = app.rooms.get((await response.json()).room.id), seats = [];
  for (let id = 0; id < 2; id++) {
    const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`); peers.push(peer);
    const welcome = await peer.connect(); peer.send({ type: 'join', name: `Blade ${id + 1}` }); await flushPeer(peer); seats.push({ peer, welcome });
  }
  for (const { peer } of seats) { peer.send({ type: 'ready', ready: true }); await flushPeer(peer); }
  if (gameId !== 'voxel-breach') { seats[0].peer.send({ type: 'start' }); await flushPeer(seats[0].peer); }
  let guard = 0; while (room.state.phase !== 'fight' && guard++ < 2000) app.tick(); assert.equal(room.state.phase, 'fight');
  const game = { app, room, seats, peer: seats[0].peer, seq: 0, player: room.state.players[0] };
  await input(game, { slot1: true }); await input(game, {});
  assert.equal(game.player.slot, 'sword'); assert.equal(game.player.meleeWeapon, 'knife');
  return game;
}
async function input(game, buttons, extra = {}, ticks = 1) {
  const seq = game.seq++; game.peer.send({ type: 'input', seq, buttons, ...extra }); await flushPeer(game.peer);
  for (let index = 0; index < ticks; index++) game.app.tick(); return seq;
}
async function queueLate(game) {
  const player = game.player, index = player.meleeIndex;
  await input(game, { fire: true }); assert.equal(player.meleeIndex, index + 1);
  await input(game, {});
  let guard = 0; while (player.meleeTicks > 8 && guard++ < 120) game.app.tick(); assert.ok(player.meleeTicks > 0 && player.meleeTicks <= 8);
  await input(game, { fire: true }); assert.ok(player.pendingMeleeTicks > 0, 'a real WS edge is already accepted into authoritative recovery intent');
  return { index: player.meleeIndex, ticks: player.meleeTicks, cooldown: player.meleeCooldown, start: player.meleeStartTick, yaw: player.meleeYaw, pitch: player.meleePitch, parryTicks: player.parryTicks, parryCooldown: player.parryCooldown };
}
function settle(game, ticks = 100) { for (let tick = 0; tick < ticks; tick++) game.app.tick(); }

// A legal courtyard spawn lane isolates socket controls from navigation. Damage
// and combo confirmation still require the real blade band and authoritative tick.
function contactLane(game) {
  const positions = [{ x: -3, z: 18, yaw: 0 }, { x: -3, z: 16.75, yaw: Math.PI }];
  for (const player of game.room.state.players) {
    Object.assign(player, positions[player.id], { y: 0, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true });
    for (const box of MAPS[game.room.state.mapId].colliders) {
      if (box.y >= 1.8 || box.y + box.h <= 0) continue;
      const dx = player.x - Math.max(box.x, Math.min(box.x + box.w, player.x));
      const dz = player.z - Math.max(box.z, Math.min(box.z + box.d, player.z));
      assert.ok(dx * dx + dz * dz >= player.radius ** 2, 'the contact fixture must not place an actor inside cover');
    }
  }
}
function finishAcceptedCut(game) {
  let guard = 0;
  while ((game.player.meleeTicks || game.player.meleeCooldown) && guard++ < 150) game.app.tick();
  assert.ok(guard < 150, 'the accepted commitment must finish on the server clock');
}
async function confirmSocketCut(game, expectedStep) {
  const hp = game.room.state.players[1].hp;
  await input(game, { fire: true, yaw: 0, pitch: 0 });
  const index = game.player.meleeIndex;
  await input(game, { fire: false });
  let guard = 0;
  while (!game.player.meleeComboConfirmed && guard++ < 60) game.app.tick();
  assert.ok(game.player.meleeComboConfirmed, 'a real socket cut must contact enemy flesh before advancing a chain');
  const hit = game.room.state.events.findLast(event => event.type === 'meleeHit' && event.playerId === 0 && event.meleeIndex === index);
  assert.ok(hit); assert.equal(hit.targetId, 1); assert.equal(hit.comboStep, expectedStep);
  assert.equal(game.player.meleeComboStep, expectedStep);
  assert.equal(game.room.state.players[1].hp, hp - hit.damage);
  return hit;
}

test('confirmed socket blade contacts retain their combo through ordinary fire release and advance on a fresh press', async t => {
  const game = await host(t); contactLane(game);
  await confirmSocketCut(game, 1);
  await input(game, { fire: false });
  assert.equal(game.player.meleeComboConfirmed, true); assert.ok(game.player.meleeComboWindowTicks > 0);
  await input(game, { fire: false }, { cancelActions: false });
  assert.equal(game.player.meleeComboConfirmed, true);
  finishAcceptedCut(game);
  await confirmSocketCut(game, 2);
  assert.deepEqual(game.room.state.events.filter(event => event.type === 'meleeStart' && event.playerId === 0).map(event => event.comboStep), [1, 2]);
});

test('valid socket cancellation preserves an accepted return-cut profile but prevents its contact from rearming the combo', async t => {
  const game = await host(t); contactLane(game);
  await confirmSocketCut(game, 1); finishAcceptedCut(game);
  await input(game, { fire: true, yaw: 0, pitch: 0 });
  assert.equal(game.player.meleeComboStep, 2); assert.equal(game.player.meleePhase, 'startup');
  const profile = meleeProfile(game.player), before = structuredClone(game.player);
  await input(game, { fire: false }, { cancelActions: true }, 0);
  assert.equal(game.player.meleeComboConfirmed, false); assert.equal(game.player.meleeComboWindowTicks, 0);
  assert.equal(meleeProfile(game.player), profile); assert.equal(game.player.meleeComboStep, 2);
  for (const field of ['meleeTicks', 'meleePhase', 'meleeIndex', 'meleeStartTick', 'meleeCooldown', 'meleeYaw', 'meleePitch']) assert.equal(game.player[field], before[field], field);
  assert.deepEqual(game.player.inventory, before.inventory);
  finishAcceptedCut(game);
  const hit = game.room.state.events.findLast(event => event.type === 'meleeHit' && event.playerId === 0 && event.meleeIndex === before.meleeIndex);
  assert.ok(hit, 'canceling future intent does not delete the already accepted physical cut'); assert.equal(hit.comboStep, 2);
  assert.equal(game.player.meleeComboConfirmed, false); assert.equal(game.player.meleeComboWindowTicks, 0);
  await input(game, { fire: false }); await input(game, { fire: true });
  assert.equal(game.player.meleeComboStep, 1, 'the next deliberate attack starts a fresh chain');
});

test('the real stale-input fence removes confirmed socket combo continuation without rewriting its current return cut', async t => {
  const game = await host(t); contactLane(game);
  await confirmSocketCut(game, 1); finishAcceptedCut(game); await confirmSocketCut(game, 2);
  const profile = meleeProfile(game.player), before = structuredClone(game.player);
  assert.ok(before.meleeComboWindowTicks > 0 && before.meleeComboConfirmed);
  game.room.slots[0].lastInputTime -= 351; game.app.tick();
  assert.equal(game.player.meleeComboConfirmed, false); assert.equal(game.player.meleeComboWindowTicks, 0);
  assert.equal(meleeProfile(game.player), profile); assert.equal(game.player.meleeComboStep, 2);
  assert.equal(game.player.meleeTicks, before.meleeTicks - 1); assert.equal(game.player.meleeCooldown, before.meleeCooldown - 1);
  assert.equal(game.player.meleeIndex, before.meleeIndex); assert.equal(game.player.meleeStartTick, before.meleeStartTick);
  assert.equal(game.room.slots[0].actionInputs.inspect().pending.length, 0);
  finishAcceptedCut(game);
  await input(game, { fire: false }); await input(game, { fire: true });
  assert.equal(game.player.meleeComboStep, 1); assert.equal(game.player.meleeIndex, before.meleeIndex + 1);
});

for (const gameId of ['voxel-breach', 'voxel-royale', 'voxel-horde']) test(`${gameId}: accepted late blade intent is canceled by valid WS controls release without erasing the current cut`, async t => {
  const game = await host(t, gameId), before = await queueLate(game), player = game.player;
  await input(game, {}, { cancelActions: true }, 0);
  assert.equal(player.pendingMeleeTicks, 0);
  assert.equal(player.meleeTicks, before.ticks); assert.equal(player.meleeCooldown, before.cooldown); assert.equal(player.meleeStartTick, before.start);
  assert.equal(player.meleeYaw, before.yaw); assert.equal(player.meleePitch, before.pitch); assert.equal(player.parryTicks, before.parryTicks); assert.equal(player.parryCooldown, before.parryCooldown);
  settle(game); assert.equal(player.meleeIndex, before.index, 'recovery completion cannot emit a ghost cut after release');
});

test('ordinary mouse release preserves an already accepted cut; cancelActions=false retains the same meaning', async t => {
  const game = await host(t), before = await queueLate(game);
  await input(game, {}, { cancelActions: false }); settle(game);
  assert.equal(game.player.meleeIndex, before.index + 1); assert.equal(game.player.pendingMeleeTicks, 0);
});

test('controls release cancels accepted intent, fences held reentry, and accepts one genuinely fresh cut afterward', async t => {
  const game = await host(t), before = await queueLate(game);
  await input(game, { fire: true }, { cancelActions: true }, 0); assert.equal(game.player.pendingMeleeTicks, 0);
  settle(game); assert.equal(game.player.meleeIndex, before.index);
  await input(game, { fire: true }); settle(game); assert.equal(game.player.meleeIndex, before.index, 'still-held reentry cannot produce a replacement cut');
  await input(game, {}); await input(game, { fire: true }); assert.equal(game.player.meleeIndex, before.index + 1);
  await input(game, {}); settle(game); assert.equal(game.player.meleeIndex, before.index + 1);
});

test('invalid cancellation metadata and stale or too-far-ahead sequences cannot clear accepted blade intent', async t => {
  const game = await host(t), before = await queueLate(game), player = game.player, pending = player.pendingMeleeTicks;
  for (const extra of [{ cancelActions: 1 }, { cancelActions: 'true' }, { cancelActions: null }, { cancelActions: {} }, { cancelActions: true, cancelPress: { action: 'fire', seq: game.seq } }, { cancelActions: true, buttons: { hp: 900 } }, { cancelActions: true, seq: game.seq + 601 }]) {
    const after = game.peer.messages.length;
    game.peer.send({ type: 'input', seq: game.seq, buttons: {}, ...extra }); await game.peer.waitFor(message => message.type === 'error', { after });
    assert.equal(player.pendingMeleeTicks, pending); assert.equal(player.meleeTicks, before.ticks); assert.equal(player.meleeCooldown, before.cooldown);
    assert.equal(game.room.slots[0].lastAccepted, game.seq - 1);
  }
  game.peer.send({ type: 'input', seq: game.seq - 1, buttons: {}, cancelActions: true }); await flushPeer(game.peer);
  assert.equal(player.pendingMeleeTicks, pending, 'an old valid cancellation is ignored before touching intent');
  await input(game, {}, { cancelActions: true }); assert.equal(player.pendingMeleeTicks, 0); settle(game); assert.equal(player.meleeIndex, before.index);
});

test('the 350 ms stale-input fence clears already accepted blade intent while its current recovery keeps ticking', async t => {
  const game = await host(t), before = await queueLate(game), player = game.player;
  game.room.slots[0].lastInputTime -= 351; game.app.tick();
  assert.equal(player.pendingMeleeTicks, 0); assert.equal(player.meleeTicks, before.ticks - 1); assert.equal(player.meleeCooldown, before.cooldown - 1);
  assert.equal(game.room.slots[0].actionInputs.inspect().pending.length, 0);
  settle(game); assert.equal(player.meleeIndex, before.index);
});

test('death clears an accepted WS blade queue before any recovery followup can start', async t => {
  const game = await host(t), before = await queueLate(game), player = game.player;
  applyCombatDamage(game.room.state, [{ playerId: 1, targetId: player.id, damage: player.maxHp, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(player.alive, false); assert.equal(player.pendingMeleeTicks, 0); settle(game); assert.equal(player.meleeIndex, before.index);
});

test('a real WS physical selection discards accepted intent and preserves the old item recovery', async t => {
  const game = await host(t), before = await queueLate(game), item = game.player.inventory[0];
  await input(game, { slot2: true }); assert.equal(game.player.slot, 'primary'); assert.equal(game.player.pendingMeleeTicks, 0);
  assert.equal(item.meleeCooldown, before.cooldown - 1); assert.equal(Object.hasOwn(item, 'pendingMeleeTicks'), false);
  settle(game); assert.equal(game.player.meleeIndex, before.index);
});

test('returning to the lobby clears accepted intent in the old session and the fresh rematch', async t => {
  const game = await host(t), before = await queueLate(game), peer = game.seats[1].peer;
  const after = game.peer.messages.length; peer.socket.close(); await game.peer.untilState(message => message.state.phase === 'lobby', { after });
  assert.equal(game.room.state.phase, 'lobby'); assert.ok(game.room.state.players.every(player => !player.pendingMeleeTicks));
  assert.ok(game.room.state.players.every(player => player.inventory[0].weapon === 'knife'));
  settle(game); assert.ok(game.room.state.players.every(player => !player.pendingMeleeTicks)); assert.equal(game.player.meleeIndex, before.index);
});

test('cancelActions preserves an accepted active sword commitment, defense cooldowns and carried item fields', async t => {
  const game = await host(t), loot = addInventoryLoot(game.room.state, game.player, { kind: 'melee', weapon: 'sword' });
  assert.ok(loot);
  await input(game, { interact: true }); await input(game, {});
  assert.equal(game.player.inventory.some(item => item?.kind === 'melee' && item.weapon === 'sword'), true);
  const index = game.player.inventory.findIndex(item => item?.kind === 'melee' && item.weapon === 'sword');
  await input(game, { [`slot${index + 1}`]: true }); await input(game, {}); await input(game, { aim: true }); await input(game, {});
  assert.ok(game.player.parryTicks > 0);
  const before = structuredClone(game.player); await input(game, {}, { cancelActions: true }, 0);
  assert.equal(game.player.parryTicks, before.parryTicks); assert.equal(game.player.parryCooldown, before.parryCooldown); assert.equal(game.player.meleeCooldown, before.meleeCooldown); assert.deepEqual(game.player.inventory, before.inventory);
  settle(game); await input(game, { fire: true }); await input(game, {});
  for (let tick = 0; tick < MELEE_WEAPONS.sword.startupTicks; tick++) game.app.tick();
  assert.equal(game.player.meleePhase, 'active'); const active = structuredClone(game.player);
  await input(game, {}, { cancelActions: true }, 0);
  assert.equal(game.player.meleeTicks, active.meleeTicks); assert.equal(game.player.meleeStartTick, active.meleeStartTick); assert.deepEqual(game.player.inventory, active.inventory);
});
