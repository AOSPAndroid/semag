import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../server.js';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage } from '../public/voxel-engine.js';
import { navigationPath } from '../public/voxel-navigation.js';
import { Peer, flushPeer } from './ws-helper.js';

async function intermission(t) {
  const app = createServer({ autoTick: false }); await app.listen(0, '127.0.0.1');
  const room = app.createRoom('voxel-horde', 'Restock', { capacity: 3, mapId: 'courtyard', difficulty: 'veteran' });
  const peer = new Peer(`ws://127.0.0.1:${app.server.address().port}/ws?room=${room.id}`);
  t.after(async () => { peer.socket.terminate(); await app.close(); });
  await peer.connect(); peer.send({ type: 'ready', ready: true }); await flushPeer(peer);
  peer.send({ type: 'start' }); await flushPeer(peer);
  while (room.state.phase === 'countdown') app.tick();
  assert.equal(room.state.phase, 'fight');
  // All monsters spawn through their real rift warnings. Authoritative lethal
  // damage emits actual kills/drops and naturally completes the whole wave.
  for (let tick = 0; tick < 2000 && room.state.phase === 'fight'; tick++) {
    app.tick();
    const targets = room.state.players.filter(player => player.monster && player.alive);
    if (targets.length) applyCombatDamage(room.state, targets.map(player => ({ targetId: player.id, playerId: 0, damage: player.maxHp + 1 })));
  }
  assert.equal(room.state.phase, 'intermission'); assert.equal(room.state.horde.wavesCleared, 1);
  assert.equal(room.state.horde.totalKills, 10); assert.equal(room.state.horde.alive, 0);
  const game = { app, room, peer, sequence: 0,
    async input(buttons = {}, options = {}, ticks = 1) {
      peer.send({ type: 'input', seq: this.sequence++, buttons, ...options }); await flushPeer(peer);
      for (let tick = 0; tick < ticks; tick++) app.tick();
    },
    async tap(action) {
      peer.send({ type: 'input', seq: this.sequence++, buttons: { [action]: true } });
      peer.send({ type: 'input', seq: this.sequence++, buttons: {} }); await flushPeer(peer); app.tick();
    },
  };
  await game.input({}); return game;
}

async function reachAmmo(game) {
  const { room } = game, player = room.state.players[0], map = Horde.MAPS[room.state.mapId];
  const options = room.state.loot.filter(drop => drop.type === 'ammo').map(drop => ({ drop, route: navigationPath(map, player, drop) })).filter(choice => choice.route.length);
  options.sort((a, b) => Math.hypot(a.drop.x - player.x, a.drop.z - player.z) - Math.hypot(b.drop.x - player.x, b.drop.z - player.z));
  assert.ok(options.length, 'real kills must produce a reachable ammunition drop');
  const { drop, route } = options[0];
  for (const point of route) {
    let attempts = 0;
    while (Math.hypot(point.x - player.x, point.z - player.z) > .2 && attempts++ < 60) {
      const distance = Math.hypot(point.x - player.x, point.z - player.z), yaw = Math.atan2(point.x - player.x, -(point.z - player.z));
      await game.input({ up: true, yaw, jump: !!point.jump && player.grounded && !player.previousInput.jump }, {}, Math.max(1, Math.min(24, Math.floor(distance / 5.4 * 120))));
      assert.equal(room.state.phase, 'intermission', 'the actual route must fit inside the eight-second restock interval');
    }
    assert.ok(attempts < 60, 'actual physical movement reaches each safe waypoint');
  }
  await game.input({}, {}, 8);
  assert.equal(Horde.findNearbyLoot(room.state, 0)?.id, drop.id);
  return drop;
}

test('Online intermission preserves a pressed-and-released jump between two acknowledged packets', async t => {
  const game = await intermission(t), player = game.room.state.players[0], before = player.y;
  assert.equal(player.grounded, true);
  await game.tap('jump');
  assert.equal(game.room.acks[0], game.sequence - 1);
  assert.equal(game.room.slots[0].latestButtons.jump, false);
  assert.equal(game.room.slots[0].buttons.jump, true, 'a short jump survives packet coalescing during intermission');
  assert.ok(player.y > before, 'the shared physical engine must commit that retained jump');
});

test('Online intermission preserves an E tap and consumes an actual reachable ammunition drop', async t => {
  const game = await intermission(t), drop = await reachAmmo(game), player = game.room.state.players[0], before = player.reserve;
  await game.tap('interact');
  assert.equal(game.room.acks[0], game.sequence - 1);
  assert.equal(game.room.slots[0].buttons.interact, true, 'a short E press survives intermission packet coalescing');
  assert.ok(player.reserve > before); assert.equal(game.room.state.loot.some(item => item.id === drop.id), false);
  assert.ok(game.room.state.events.some(event => event.type === 'loot' && event.lootId === drop.id));
});

test('Intermission still cancels owned taps, suppresses combat and fences a held trigger across the next wave', async t => {
  const game = await intermission(t), { room, app } = game, player = room.state.players[0], before = { y: player.y, shots: player.shots, ammo: player.ammo, grenades: player.grenades, potions: player.potions, slot: player.slot };
  const pressed = game.sequence; game.peer.send({ type: 'input', seq: game.sequence++, buttons: { jump: true } });
  game.peer.send({ type: 'input', seq: game.sequence++, buttons: {}, cancelPress: { action: 'jump', seq: pressed } }); await flushPeer(game.peer); app.tick();
  assert.equal(player.y, before.y); assert.equal(room.slots[0].buttons.jump, false);
  await game.input({ fire: true, grenade: true, heal: true, swap: true, reload: true }, {}, 12);
  assert.equal(player.shots, before.shots); assert.equal(player.ammo, before.ammo); assert.equal(player.grenades, before.grenades); assert.equal(player.potions, before.potions); assert.equal(player.slot, before.slot);
  while (room.state.phase === 'intermission') app.tick();
  assert.equal(room.state.phase, 'fight');
  for (let tick = 0; tick < 12; tick++) app.tick();
  assert.equal(player.shots, before.shots, 'a trigger held from restock cannot fire on the next wave');
  assert.equal(player.grenades, before.grenades, 'a held grenade cannot leak into the next wave');
  await game.input({}); await game.input({ fire: true });
  assert.equal(player.shots, before.shots + 1, 'a genuine new fight press fires immediately after release');
});

test('An owned E cancellation during intermission leaves loot intact and the next valid tap collects it once', async t => {
  const game = await intermission(t), drop = await reachAmmo(game), player = game.room.state.players[0], before = player.reserve;
  const pressed = game.sequence; game.peer.send({ type: 'input', seq: game.sequence++, buttons: { interact: true } });
  game.peer.send({ type: 'input', seq: game.sequence++, buttons: {}, cancelPress: { action: 'interact', seq: pressed } }); await flushPeer(game.peer); game.app.tick();
  assert.equal(player.reserve, before); assert.equal(game.room.state.loot.some(item => item.id === drop.id), true);
  assert.equal(game.room.slots[0].buttons.interact, false);
  await game.tap('interact');
  assert.ok(player.reserve > before); assert.equal(game.room.state.loot.some(item => item.id === drop.id), false);
  await game.input({}, { cancelPress: { action: 'interact', seq: game.sequence - 2 } });
  assert.equal(game.room.state.events.filter(event => event.type === 'loot' && event.lootId === drop.id).length, 1);
});
