import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../server.js';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage, HEAL, WEAPONS } from '../public/voxel-engine.js';
import { refreshInventory, storeInventoryGun } from '../public/voxel-inventory.js';
import { navigationPath } from '../public/voxel-navigation.js';
import { Peer, flushPeer } from './ws-helper.js';

async function intermission(t, size = 1) {
  const app = createServer({ autoTick: false }); await app.listen(0, '127.0.0.1');
  const room = app.createRoom('voxel-horde', 'Restock', { capacity: 3, mapId: 'courtyard', difficulty: 'veteran' });
  const peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  for (let id = 0; id < size; id++) {
    const peer = new Peer(`ws://127.0.0.1:${app.server.address().port}/ws?room=${room.id}`);
    peers.push(peer); const welcome = await peer.connect(); assert.equal(welcome.playerId, id);
    peer.send({ type: 'ready', ready: true }); await flushPeer(peer);
  }
  const peer = peers[0];
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
  assert.equal(room.state.horde.totalKills, 10 + (size - 1) * 5); assert.equal(room.state.horde.alive, 0);
  assert.deepEqual(room.state.horde.participantIds, Array.from({ length: size }, (_, id) => id));
  const game = { app, room, peer, peers, sequences: Array(size).fill(0),
    get sequence() { return this.sequences[0]; },
    set sequence(value) { this.sequences[0] = value; },
    async input(buttons = {}, options = {}, ticks = 1, id = 0) {
      const peer = peers[id];
      peer.send({ type: 'input', seq: this.sequences[id]++, buttons, ...options }); await flushPeer(peer);
      for (let tick = 0; tick < ticks; tick++) app.tick();
    },
    async tap(action, id = 0) {
      const peer = peers[id];
      peer.send({ type: 'input', seq: this.sequences[id]++, buttons: { [action]: true } });
      peer.send({ type: 'input', seq: this.sequences[id]++, buttons: {} }); await flushPeer(peer); app.tick();
    },
  };
  for (let id = 0; id < size; id++) await game.input({}, {}, 1, id);
  return game;
}

// Wave-clear rewards legitimately fill all magazines and grant 35 HP. These
// controlled recovery fixtures represent wounded survivors with spent ammo
// and a physically carried potion stack; they do not change those rewards,
// action durations, reserve caps, the real 960-tick break or socket handlers.
function recoveryFixture(game) {
  const [healer, reloader] = game.room.state.players;
  healer.hp = 70; healer.inventory[2] = { kind: 'heal', amount: 2 }; refreshInventory(healer);
  reloader.ammo = 3; reloader.reserve = 11; storeInventoryGun(reloader);
  return { healer, reloader, magazine: WEAPONS[reloader.weapon].magazine, duration: WEAPONS[reloader.weapon].reloadTicks };
}

async function enqueueTap(game, id, action, cancellation) {
  const peer = game.peers[id], pressed = game.sequences[id]++;
  peer.send({ type: 'input', seq: pressed, buttons: { [action]: true } });
  peer.send({ type: 'input', seq: game.sequences[id]++, buttons: {}, ...(cancellation ? { cancelPress: { action, seq: cancellation === true ? pressed : cancellation.seq } } : {}) });
  await flushPeer(peer);
  return pressed;
}

async function latestPackets(game) {
  // Use the real periodic snapshot cadence, then drain each real WebSocket.
  for (let step = 0; game.room.lastBroadcastTick !== game.room.state.tick && step < 4; step++) game.app.tick();
  assert.equal(game.room.lastBroadcastTick, game.room.state.tick, 'active recovery snapshots arrive within four simulation ticks');
  for (const peer of game.peers) await flushPeer(peer);
  const tick = game.room.state.tick;
  return game.peers.map(peer => {
    const message = peer.messages.findLast(message => message.type === 'state');
    assert.equal(message.state.tick, tick);
    return message;
  });
}

async function holdThroughBreak(game, controls) {
  // Real clients refresh held controls at 60 Hz. Keep the socket's idle cutoff
  // from masquerading as a physical release while simulation advances quickly.
  let steps = 0;
  while (game.room.state.phase === 'intermission') {
    game.app.tick();
    if (++steps % 24 === 0 && game.room.state.phase === 'intermission') {
      for (const [id, buttons] of controls) await game.input(buttons, {}, 0, id);
    }
  }
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

test('Intermission still cancels owned taps, blocks attacks and fences held attacks across the next wave', async t => {
  const game = await intermission(t), { room, app } = game, player = room.state.players[0];
  player.inventory[3] = { kind: 'grenade', amount: 2 }; refreshInventory(player);
  const before = { y: player.y, shots: player.shots, ammo: player.ammo, grenades: player.grenades, potions: player.potions, slot: player.slot };
  const pressed = game.sequence; game.peer.send({ type: 'input', seq: game.sequence++, buttons: { jump: true } });
  game.peer.send({ type: 'input', seq: game.sequence++, buttons: {}, cancelPress: { action: 'jump', seq: pressed } }); await flushPeer(game.peer); app.tick();
  assert.equal(player.y, before.y); assert.equal(room.slots[0].buttons.jump, false);
  await game.input({ fire: true, aim: true, grenade: true }, {}, 12);
  assert.equal(player.shots, before.shots); assert.equal(player.ammo, before.ammo); assert.equal(player.grenades, before.grenades); assert.equal(player.potions, before.potions); assert.equal(player.slot, before.slot);
  assert.equal(player.aimTicks, 0); assert.equal(player.grenadeThrowTicks, 0); assert.equal(room.state.grenades.length, 0);
  while (room.state.phase === 'intermission') app.tick();
  assert.equal(room.state.phase, 'fight');
  for (let tick = 0; tick < 12; tick++) app.tick();
  assert.equal(player.shots, before.shots, 'a trigger held from restock cannot fire on the next wave');
  assert.equal(player.grenades, before.grenades, 'a held grenade cannot leak into the next wave');
  await game.input({}); await game.input({ fire: true });
  assert.equal(player.shots, before.shots + 1, 'a genuine new fight press fires immediately after release');
});

for (const weapon of ['carbine', 'judge']) test(`Two online teammates independently heal and reload ${weapon} from released F/R taps during the real break`, async t => {
  const game = await intermission(t, 2), { room, app } = game;
  game.peers[1].send({ type: 'fps-loadout', weaponId: weapon }); await flushPeer(game.peers[1]);
  const { healer, reloader, magazine, duration } = recoveryFixture(game), before = room.state.phaseTicks;
  await enqueueTap(game, 0, 'heal'); await enqueueTap(game, 1, 'reload'); app.tick();
  for (const [id, action] of [[0, 'heal'], [1, 'reload']]) {
    assert.equal(room.acks[id], game.sequences[id] - 1);
    assert.equal(room.slots[id].latestButtons[action], false);
    assert.equal(room.slots[id].buttons[action], true, 'a press released before physics still commits once');
  }
  assert.equal(healer.healTicks, HEAL.ticks); assert.equal(healer.hp, 70); assert.equal(healer.potions, 2);
  assert.equal(reloader.reloadTicks, duration); assert.equal(reloader.ammo, 3); assert.equal(reloader.reserve, 11);
  for (let tick = 0; tick < HEAL.ticks - 1; tick++) app.tick();
  assert.equal(healer.hp, 70); assert.equal(healer.healTicks, 1); assert.equal(healer.potions, 2);
  app.tick(); assert.equal(healer.hp, 130); assert.equal(healer.potions, 1);
  assert.equal(reloader.ammo, 3, 'healing another player never grants ammunition or skips the reload timer');
  while (reloader.reloadTicks > 1) app.tick();
  assert.equal(reloader.ammo, 3); assert.equal(reloader.reserve, 11);
  app.tick(); const loaded = Math.min(magazine - 3, 11);
  assert.equal(reloader.ammo, 3 + loaded); assert.equal(reloader.reserve, 11 - loaded);
  assert.equal(reloader.reloadTicks, 0); assert.equal(room.state.phase, 'intermission');
  assert.equal(room.state.phaseTicks, before - duration - 1);
  assert.equal(room.state.events.filter(event => event.type === 'healComplete' && event.playerId === 0).length, 1);
  assert.equal(room.state.events.filter(event => event.type === 'reloadComplete' && event.playerId === 1).length, 1);
  assert.equal(room.state.horde.wave, 1); assert.equal(room.state.horde.wavesCleared, 1);
  for (const packet of await latestPackets(game)) {
    assert.equal(packet.state.players[0].hp, 130); assert.equal(packet.state.players[0].potions, 1);
    assert.equal(packet.state.players[1].ammo, 3 + loaded); assert.equal(packet.state.players[1].reserve, 11 - loaded);
    assert.equal(packet.state.phase, 'intermission');
    assert.deepEqual(packet.acks.slice(0, 2), game.sequences.map(sequence => sequence - 1));
  }
});

test('Owned F/R cancellations withdraw only unconsumed presses and stale cancellations cannot remove a newer teammate recovery tap', async t => {
  const game = await intermission(t, 2), { app, room } = game, { healer, reloader } = recoveryFixture(game);
  const oldHeal = await enqueueTap(game, 0, 'heal', true), oldReload = await enqueueTap(game, 1, 'reload', true);
  app.tick(); assert.equal(healer.healTicks, 0); assert.equal(reloader.reloadTicks, 0);
  assert.equal(healer.hp, 70); assert.equal(healer.potions, 2); assert.equal(reloader.ammo, 3); assert.equal(reloader.reserve, 11);
  assert.equal(room.slots[0].buttons.heal, false); assert.equal(room.slots[1].buttons.reload, false);
  await enqueueTap(game, 0, 'heal', { seq: oldHeal }); await enqueueTap(game, 1, 'reload', { seq: oldReload });
  app.tick(); assert.equal(healer.healTicks, HEAL.ticks); assert.equal(reloader.reloadTicks, WEAPONS[reloader.weapon].reloadTicks);
  assert.equal(room.state.events.filter(event => event.type === 'healStart' && event.playerId === 0).length, 1);
  assert.equal(room.state.events.filter(event => event.type === 'reload' && event.playerId === 1).length, 1);
});

test('Accepted two-player healing and reloading continue through the natural next-wave boundary without repeating held F/R', async t => {
  const game = await intermission(t, 2), { app, room } = game, { healer, reloader, duration, magazine } = recoveryFixture(game);
  while (room.state.phaseTicks > 12) app.tick();
  // Accelerated ticking queues hundreds of real snapshots. Drain both peers
  // before sending fresh holds, so socket backlog cannot age the first hold
  // past the server's legitimate 350 ms input-idle cutoff while peer 2 drains.
  await Promise.all(game.peers.map(peer => flushPeer(peer)));
  // Each physical key remains held, unlike the short released taps above.
  await Promise.all([game.input({ heal: true }, {}, 0, 0), game.input({ reload: true }, {}, 0, 1)]);
  app.tick(); assert.equal(healer.healTicks, HEAL.ticks); assert.equal(reloader.reloadTicks, duration);
  await holdThroughBreak(game, [[0, { heal: true }], [1, { reload: true }]]);
  assert.equal(room.state.horde.wave, 2); assert.equal(room.state.horde.wavesCleared, 1);
  assert.equal(healer.healTicks, HEAL.ticks - 11); assert.equal(reloader.reloadTicks, duration - 11);
  assert.ok(room.state.horde.inputFences[0].includes('heal')); assert.ok(room.state.horde.inputFences[1].includes('reload'));
  // Match the online client's phase handoff: cancel stale queued actions but
  // preserve the physically held key, then refresh that same hold next frame.
  await game.input({ heal: true }, { cancelActions: true }, 0, 0);
  await game.input({ reload: true }, { cancelActions: true }, 0, 1);
  app.tick();
  await game.input({ heal: true }, {}, 0, 0); await game.input({ reload: true }, {}, 0, 1);
  while (reloader.reloadTicks > 0) app.tick();
  assert.equal(healer.hp, 130); assert.equal(healer.potions, 1);
  assert.equal(reloader.ammo, 3 + Math.min(magazine - 3, 11));
  assert.equal(room.state.events.filter(event => event.type === 'healStart' && event.playerId === 0).length, 1);
  assert.equal(room.state.events.filter(event => event.type === 'healComplete' && event.playerId === 0).length, 1);
  assert.equal(room.state.events.filter(event => event.type === 'reload' && event.playerId === 1).length, 1);
  assert.equal(room.state.events.filter(event => event.type === 'reloadComplete' && event.playerId === 1).length, 1);
  for (const packet of await latestPackets(game)) {
    assert.equal(packet.state.phase, 'fight'); assert.equal(packet.state.horde.wave, 2);
    assert.equal(packet.state.players[0].potions, 1); assert.equal(packet.state.players[1].reloadTicks, 0);
  }
});

test('Online phase handoff preserves a completed F hold and spends another potion only after a genuine release', async t => {
  const game = await intermission(t, 2), { app, room } = game, { healer } = recoveryFixture(game);
  await game.input({ heal: true }); for (let tick = 0; tick < HEAL.ticks; tick++) app.tick();
  assert.equal(healer.hp, 130); assert.equal(healer.potions, 1); assert.equal(healer.healTicks, 0);
  await holdThroughBreak(game, [[0, { heal: true }]]);
  assert.ok(room.state.horde.inputFences[0].includes('heal'));
  await game.input({ heal: true }, { cancelActions: true });
  await game.input({ heal: true }, {}, HEAL.ticks + 1);
  assert.equal(healer.hp, 130); assert.equal(healer.potions, 1); assert.equal(healer.healTicks, 0);
  assert.equal(room.state.events.filter(event => event.type === 'healStart' && event.playerId === 0).length, 1);
  await game.input({}); await game.input({ heal: true }); assert.equal(healer.healTicks, HEAL.ticks);
  for (let tick = 0; tick < HEAL.ticks; tick++) app.tick();
  assert.equal(healer.hp, 190); assert.equal(healer.potions, 0);
  assert.equal(room.state.events.filter(event => event.type === 'healComplete' && event.playerId === 0).length, 2);
});

test('Online phase handoff keeps held fire, ADS and grenades blocked until their real next-wave release', async t => {
  const game = await intermission(t, 2), { room } = game, player = room.state.players[0];
  player.inventory[3] = { kind: 'grenade', amount: 2 }; refreshInventory(player);
  const held = { fire: true, aim: true, grenade: true }, before = { ammo: player.ammo, shots: player.shots };
  await game.input(held, {}, 12); await holdThroughBreak(game, [[0, held]]);
  for (const action of ['fire', 'aim', 'grenade']) assert.ok(room.state.horde.inputFences[0].includes(action));
  await game.input(held, { cancelActions: true }); await game.input(held, {}, 24);
  assert.equal(player.ammo, before.ammo); assert.equal(player.shots, before.shots); assert.equal(player.aimTicks, 0);
  assert.equal(player.grenades, 2); assert.equal(player.grenadeThrowTicks, 0); assert.equal(room.state.grenades.length, 0);
  await game.input({}); await game.input({ fire: true }); assert.equal(player.shots, before.shots + 1);
  await game.input({}); await game.input({ grenade: true });
  assert.equal(player.grenades, 1); assert.equal(room.state.grenades.length, 1, 'a deliberate new grenade press still throws normally');
});

test('Reloading during the break interrupts a drink without consuming its reserved potion, which a fresh F tap can use', async t => {
  const game = await intermission(t, 2), { app, room } = game, { healer } = recoveryFixture(game);
  healer.ammo = 3; healer.reserve = 11; storeInventoryGun(healer);
  await game.tap('heal'); for (let tick = 0; tick < 5; tick++) app.tick();
  assert.ok(healer.healUseId); assert.equal(healer.potions, 2);
  await game.tap('reload'); assert.equal(healer.healTicks, 0); assert.equal(healer.healUseId, null);
  assert.equal(healer.inventory[2].healUseId, undefined); assert.equal(healer.hp, 70); assert.equal(healer.potions, 2);
  assert.equal(healer.reloadTicks, WEAPONS[healer.weapon].reloadTicks);
  await game.tap('heal'); for (let tick = 0; tick < HEAL.ticks; tick++) app.tick();
  assert.equal(healer.hp, 130); assert.equal(healer.potions, 1); assert.equal(healer.reloadTicks, 0);
  assert.equal(healer.ammo, 3); assert.equal(healer.reserve, 11, 'interrupting the reload never transfers ammunition');
  assert.equal(room.state.events.filter(event => event.type === 'healComplete' && event.playerId === 0).length, 1);
});

test('Online V equipment taps work between waves and cannot leak a held attack into blade selection', async t => {
  const game = await intermission(t, 2), player = game.room.state.players[0], before = { ammo: player.ammo, shots: player.shots };
  assert.equal(player.slot, 'primary'); await game.tap('swap'); assert.equal(player.slot, 'sword');
  await game.input({ fire: true, aim: true });
  game.peer.send({ type: 'input', seq: game.sequence++, buttons: { fire: true, aim: true, swap: true } });
  game.peer.send({ type: 'input', seq: game.sequence++, buttons: { fire: true, aim: true } });
  await flushPeer(game.peer); game.app.tick(); assert.equal(player.slot, 'primary');
  assert.equal(game.room.slots[0].latestButtons.fire, true); assert.equal(game.room.slots[0].latestButtons.aim, true);
  assert.equal(player.shots, before.shots); assert.equal(player.ammo, before.ammo);
  assert.equal(player.meleeTicks, 0); assert.equal(player.parryTicks, 0);
  assert.equal(game.room.state.events.filter(event => event.type === 'swap' && event.playerId === 0).length, 2);
});

test('Co-op control release neutralizes both players without pausing the break or abandoning accepted recovery', async t => {
  const game = await intermission(t, 2), { app, room } = game, { healer, reloader, duration } = recoveryFixture(game);
  await enqueueTap(game, 0, 'heal'); await enqueueTap(game, 1, 'reload'); app.tick();
  const before = room.state.phaseTicks;
  await game.input({}, { cancelActions: true }, 0, 0); await game.input({}, { cancelActions: true }, 0, 1);
  for (let tick = 0; tick < HEAL.ticks; tick++) app.tick();
  assert.equal(room.state.phase, 'intermission'); assert.equal(room.state.phaseTicks, before - HEAL.ticks);
  assert.equal(healer.hp, 130); assert.equal(healer.potions, 1); assert.equal(reloader.reloadTicks, duration - HEAL.ticks);
  assert.ok(room.players.slice(0, 2).every(player => player.connected));
  assert.ok(room.slots.slice(0, 2).every(slot => !slot.buttons.fire && !slot.buttons.heal && !slot.buttons.reload));
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
