import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { applyCombatDamage, addInventoryLoot } from '../public/voxel-engine.js';
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
