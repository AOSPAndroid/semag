import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import * as Shinobi from '../public/shinobi-voxel-engine.js';
import { Peer, flushPeer } from './ws-helper.js';

async function host(t) {
  const app = createServer({ autoTick: false, creationLimit: 100 });
  await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => {
    for (const peer of peers) peer.socket.terminate();
    await app.close();
  });
  const post = body => fetch(`${origin}/api/rooms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const socket = room => {
    const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`);
    peers.push(peer); return peer;
  };
  return {
    app, origin, post, socket,
    async make(mapId = Shinobi.MAP_IDS[0]) {
      const response = await post({ gameId: 'shinobi-voxel', mapId });
      assert.equal(response.status, 201);
      const { room } = await response.json(); return app.rooms.get(room.id);
    },
    async peer(room, name = 'Akari') {
      const peer = socket(room), welcome = await peer.connect();
      const after = peer.messages.length;
      peer.send({ type: 'join', name });
      await peer.untilState(message => message.players[welcome.playerId]?.name === name, { after });
      return { peer, welcome };
    },
  };
}

async function ready(room, a, b) {
  const after = a.messages.length;
  a.send({ type: 'ready', ready: true });
  b.send({ type: 'ready', ready: true });
  await a.untilState(message => message.state.phase === 'countdown', { after });
  assert.equal(room.state.phase, 'countdown');
}

async function fight(t) {
  const game = await host(t), room = await game.make();
  const { peer: a } = await game.peer(room), { peer: b } = await game.peer(room, 'Ren');
  await ready(room, a, b);
  for (let index = 0; index < Shinobi.RULES.initialCountdownTicks; index++) game.app.tick();
  assert.equal(room.state.phase, 'fight');
  // A real neutral fight step releases the countdown's held-input fence.
  game.app.tick();
  return { game, room, a, b };
}

function approximately(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);
}

test('Shinobi 3D exposes every authored arena as a distinct, two-player online room', async t => {
  const game = await host(t);
  const health = await (await fetch(`${game.origin}/health`)).json();
  assert.ok(health.games.includes('shinobi-voxel'));
  assert.ok(health.games.includes('shinobi-showdown'));
  for (const path of ['/shinobi-voxel.html', '/shinobi-voxel-engine.js', '/shinobi-voxel-maps.js', '/shinobi-voxel-input.js']) {
    assert.equal((await fetch(game.origin + path)).status, 200, path);
  }
  for (const mapId of Shinobi.MAP_IDS) {
    const room = await game.make(mapId);
    assert.equal(room.mapId, mapId); assert.equal(room.mapName, Shinobi.MAPS[mapId].name);
    assert.equal(room.capacity, 2); assert.equal(room.teamSize, 1);
    assert.equal(room.state.online, true); assert.equal(room.state.bots, 0);
    assert.equal(room.state.players.length, 2); assert.equal(room.state.phase, 'lobby');
    const { welcome } = await game.peer(room);
    assert.equal(welcome.gameId, 'shinobi-voxel'); assert.equal(welcome.mapId, mapId);
    assert.equal(welcome.mapName, Shinobi.MAPS[mapId].name); assert.equal(welcome.capacity, 2);
  }
  const listed = await (await fetch(`${game.origin}/api/rooms`)).json();
  assert.deepEqual(listed.rooms.map(room => room.mapId), [...Shinobi.MAP_IDS]);
});

test('Shinobi 3D rejects invalid maps, unknown room fields and alternate capacities without creating a room', async t => {
  const game = await host(t);
  for (const extra of [
    { mapId: 'courtyard' }, { mapId: 'missing' }, { mapId: '__proto__' }, { mapId: 'constructor' },
    { mapId: '' }, { mapId: null }, { mapId: 1 }, { mapId: [] },
    { teamSize: 1 }, { teamSize: 2 }, { capacity: 2 }, { capacity: 10 },
    { bots: 4 }, { difficulty: 'expert' }, { weaponId: 'katana' }, { settings: {} }, { name: false },
  ]) {
    const response = await game.post({ gameId: 'shinobi-voxel', ...extra });
    assert.equal(response.status, 400, JSON.stringify(extra));
    assert.equal(game.app.rooms.size, 0);
  }
  assert.throws(() => game.app.createRoom('shinobi-voxel', 'Injected settings', { capacity: 2 }), /only an arena/i);
  const response = await game.post({ gameId: 'shinobi-voxel' });
  assert.equal(response.status, 201);
  const { room } = await response.json();
  assert.equal(room.mapId, Shinobi.MAP_IDS[0]); assert.equal(room.capacity, 2);
});

test('Shinobi 3D requires both live players ready and the whole countdown before combat', async t => {
  const game = await host(t), room = await game.make();
  const { peer: a } = await game.peer(room), { peer: b } = await game.peer(room, 'Ren');
  a.send({ type: 'ready', ready: true });
  await a.untilState(message => message.players[0].ready);
  for (let index = 0; index < 400; index++) game.app.tick();
  assert.equal(room.state.phase, 'lobby');
  const overflow = game.socket(room), [code] = await once(overflow.socket, 'close');
  assert.equal(code, 4403);
  await ready(room, a, b);
  for (let index = 0; index < Shinobi.RULES.initialCountdownTicks - 1; index++) game.app.tick();
  assert.equal(room.state.phase, 'countdown');
  game.app.tick(); assert.equal(room.state.phase, 'fight');
  assert.ok(room.players.every(player => !player.ready));
  const after = a.messages.length;
  a.send({ type: 'start' });
  await a.waitFor(message => message.type === 'error' && /ready/.test(message.message), { after });
});

test('a coalesced, released dash keeps its pressed direction and executes only once', async t => {
  const { game, room, a } = await fight(t), player = room.state.players[0];
  a.send({ type: 'input', seq: 0, buttons: { dash: true, yaw: .4, pitch: -.2, moveYaw: -.7 } });
  a.send({ type: 'input', seq: 1, buttons: { yaw: 1.2, pitch: .3, moveYaw: .9 } });
  await flushPeer(a);
  assert.equal(room.acks[0], -1); assert.equal(room.slots[0].queue.length, 1);
  game.app.tick();
  assert.equal(room.acks[0], 1); assert.equal(player.dashes, 1);
  const event = room.state.events.find(event => event.type === 'dashStart' && event.playerId === 0);
  assert.ok(event); approximately(event.dx, Math.sin(-.7)); approximately(event.dz, -Math.cos(-.7));
  assert.equal(room.slots[0].buttons.moveYaw, -.7);
  assert.equal(player.yaw, .4); assert.equal(player.pitch, -.2);
  a.send({ type: 'input', seq: 1, buttons: { dash: true, yaw: -1.2, pitch: -.3 } });
  await flushPeer(a); game.app.tick();
  assert.equal(player.yaw, 1.2); assert.equal(player.pitch, .3);
  assert.equal(room.slots[0].buttons.moveYaw, .9);
  assert.equal(room.slots[0].lastAccepted, 1, 'a replayed sequence cannot alter the latest accepted look');
  for (let index = 0; index < Shinobi.DASH.cooldownTicks + 2; index++) game.app.tick();
  assert.equal(player.dashes, 1, 'the released dash does not restart after its cooldown');
});

test('a coalesced, released kunai throws one actual projectile in its captured direction', async t => {
  const { game, room, a } = await fight(t), player = room.state.players[0];
  a.send({ type: 'input', seq: 0, buttons: { kunai: true, yaw: -.45, pitch: -.1, moveYaw: -.9 } });
  a.send({ type: 'input', seq: 1, buttons: { right: true, yaw: .8, pitch: .25, moveYaw: .7 } });
  await flushPeer(a); game.app.tick();
  assert.equal(room.acks[0], 1); assert.equal(player.kunaiThrown, 1);
  assert.equal(player.kunai, Shinobi.KUNAI.capacity - 1); assert.equal(room.state.kunai.length, 1);
  const event = room.state.events.find(event => event.type === 'kunaiThrow' && event.playerId === 0);
  assert.ok(event); approximately(event.dx, Math.sin(-.45) * Math.cos(-.1));
  approximately(event.dy, Math.sin(-.1)); approximately(event.dz, -Math.cos(-.45) * Math.cos(-.1));
  assert.equal(room.slots[0].buttons.right, true, 'movement comes from the latest packet');
  assert.equal(room.slots[0].buttons.moveYaw, .7, 'a kunai commitment cannot restore stale movement direction');
  game.app.tick(); assert.equal(player.yaw, .8); assert.equal(player.pitch, .25);
  for (let index = 0; index < Shinobi.KUNAI.cooldownTicks + 2; index++) game.app.tick();
  assert.equal(player.kunaiThrown, 1, 'a released throwing press cannot repeat');
});

for (const action of ['dash', 'kunai']) {
  test(`canceling a custom ${action} touch press prevents a ghost ability but permits a fresh press`, async t => {
    const { game, room, a } = await fight(t), player = room.state.players[0];
    a.send({ type: 'input', seq: 0, buttons: { [action]: true, yaw: .2 } });
    a.send({ type: 'input', seq: 1, buttons: { yaw: .6 }, cancelPress: { action, seq: 0 } });
    await flushPeer(a);
    for (let index = 0; index < 4; index++) game.app.tick();
    assert.equal(room.acks[0], 1); assert.equal(player.dashes, 0); assert.equal(player.kunaiThrown, 0);
    assert.equal(player.kunai, Shinobi.KUNAI.capacity); assert.equal(room.state.kunai.length, 0);
    assert.equal(player.yaw, .6);
    a.send({ type: 'input', seq: 2, buttons: { [action]: true, yaw: .4 } });
    a.send({ type: 'input', seq: 3, buttons: { yaw: .8 } });
    await flushPeer(a); game.app.tick();
    assert.equal(room.acks[0], 3);
    assert.equal(action === 'dash' ? player.dashes : player.kunaiThrown, 1);
    assert.equal(player.yaw, .4);
  });
}

test('Shinobi 3D validates game-specific controls and numeric sequences before accepting input', async t => {
  const game = await host(t), room = await game.make(), { peer } = await game.peer(room);
  for (const buttons of [
    { yaw: Math.PI + .001 }, { yaw: -Math.PI - .001 }, { pitch: 1.351 }, { pitch: -1.351 },
    { moveYaw: Math.PI + .001 }, { moveYaw: -Math.PI - .001 }, { moveYaw: '0' }, { moveYaw: null },
    { yaw: '0' }, { pitch: null }, { dash: 1 }, { kunai: 'yes' }, { feint: [] }, { crouch: 0 },
    { aimX: .5 }, { attack: true }, { reload: true }, { grenade: true }, { hp: 220 },
  ]) {
    const after = peer.messages.length;
    peer.send({ type: 'input', seq: 0, buttons });
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, -1); assert.equal(room.acks[0], -1);
  }
  for (const raw of ['{"type":"input","seq":0,"buttons":{"yaw":1e999}}', '{"type":"input","seq":0,"buttons":{"__proto__":true}}']) {
    const after = peer.messages.length; peer.socket.send(raw);
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, -1);
  }
  for (const seq of [-1, .5, 1_000_000_001, 601]) {
    const after = peer.messages.length; peer.send({ type: 'input', seq, buttons: {} });
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, -1);
  }
  peer.send({ type: 'input', seq: 0, buttons: { yaw: Math.PI, pitch: -1.35, moveYaw: -Math.PI, dash: false, kunai: false, feint: false } });
  await flushPeer(peer); game.app.tick();
  assert.equal(room.acks[0], 0); assert.equal(room.slots[0].buttons.yaw, Math.PI); assert.equal(room.slots[0].buttons.pitch, -1.35);
  assert.equal(room.slots[0].buttons.moveYaw, -Math.PI);
});

test('custom cancellation validation cannot erase an accepted kunai or acknowledge malformed input', async t => {
  const { game, room, a } = await fight(t), player = room.state.players[0];
  a.send({ type: 'input', seq: 0, buttons: { kunai: true, yaw: .2 } });
  await flushPeer(a);
  for (const cancelPress of [
    null, true, 'kunai', [], {}, { action: 'kunai' }, { seq: 0 },
    { action: 'grenade', seq: 0 }, { action: 'up', seq: 0 }, { action: 'kunai', seq: '0' },
    { action: 'kunai', seq: -1 }, { action: 'kunai', seq: .5 },
    { action: 'kunai', seq: 1 }, { action: 'kunai', seq: 2 }, { action: 'kunai', seq: 0, extra: true },
  ]) {
    const after = a.messages.length;
    a.send({ type: 'input', seq: 1, buttons: { yaw: .8 }, cancelPress });
    await a.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, 0); assert.equal(room.acks[0], -1);
    assert.equal(room.slots[0].actionInputs.inspect().pending.length, 1);
  }
  for (const cancelActions of [1, 'true', null, {}]) {
    const after = a.messages.length;
    a.send({ type: 'input', seq: 1, buttons: {}, cancelActions });
    await a.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, 0);
    assert.equal(room.slots[0].actionInputs.inspect().pending.length, 1);
  }
  a.send({ type: 'input', seq: 1, buttons: { yaw: .6 }, cancelPress: { action: 'kunai', seq: 0 } });
  await flushPeer(a); game.app.tick();
  assert.equal(room.acks[0], 1); assert.equal(player.kunaiThrown, 0); assert.equal(player.yaw, .6);
});

test('phase cancellation fences held custom abilities and accepts only a genuinely released new press', async t => {
  const { game, room, a } = await fight(t), player = room.state.players[0];
  a.send({ type: 'input', seq: 0, buttons: { dash: true, kunai: true, yaw: .2 } });
  a.send({ type: 'input', seq: 1, buttons: { dash: true, kunai: true, yaw: .5 }, cancelActions: true });
  await flushPeer(a);
  for (let index = 0; index < 4; index++) game.app.tick();
  assert.equal(player.dashes, 0); assert.equal(player.kunaiThrown, 0);
  assert.equal(room.acks[0], 1); assert.equal(room.slots[0].actionInputs.inspect().pending.length, 0);
  a.send({ type: 'input', seq: 2, buttons: {} });
  a.send({ type: 'input', seq: 3, buttons: { dash: true, yaw: .3 } });
  a.send({ type: 'input', seq: 4, buttons: {} });
  await flushPeer(a); game.app.tick();
  assert.equal(player.dashes, 1); assert.equal(player.kunaiThrown, 0); assert.equal(room.acks[0], 4);
});

test('disconnect returns a Shinobi 3D duel to a clean lobby and admits a replacement opponent', async t => {
  const { game, room, a, b } = await fight(t);
  a.send({ type: 'input', seq: 0, buttons: { dash: true, kunai: true } });
  await flushPeer(a);
  const after = a.messages.length; b.socket.close();
  await a.untilState(message => message.state.phase === 'lobby' && !message.players[1]?.connected, { after });
  assert.equal(room.state.players[0].hp, Shinobi.RULES.health);
  assert.equal(room.state.players[0].kunai, Shinobi.KUNAI.capacity); assert.equal(room.state.players[0].dashes, 0);
  assert.deepEqual(room.state.scores, [0, 0]); assert.equal(room.players[0].ready, false);
  assert.equal(room.slots[0].queue.length, 0); assert.equal(room.slots[0].actionInputs.inspect().pending.length, 0);
  const replacement = await game.peer(room, 'Yuki');
  assert.equal(replacement.welcome.playerId, 1); assert.equal(room.state.phase, 'lobby');
  assert.equal(room.players[1].ready, false);
});

test('the original 2D Shinobi entry remains independent and keeps its own controls', async t => {
  const game = await host(t), voxel = await game.make();
  const response = await game.post({ gameId: 'shinobi-showdown' });
  assert.equal(response.status, 201);
  const { room: summary } = await response.json(), original = game.app.rooms.get(summary.id);
  assert.equal(original.gameId, 'shinobi-showdown');
  assert.equal(original.capacity, 2); assert.equal(original.state.phase, 'lobby');
  const { peer } = await game.peer(original), before = structuredClone(voxel.state);
  peer.send({ type: 'input', seq: 0, buttons: { aimX: .6, aimY: .8, attack: true } });
  await flushPeer(peer); game.app.tick();
  assert.equal(original.acks[0], 0); assert.equal(original.slots[0].buttons.aimX, .6);
  assert.deepEqual(voxel.state, before);
  const after = peer.messages.length;
  peer.send({ type: 'input', seq: 1, buttons: { kunai: true, yaw: .2 } });
  await peer.waitFor(message => message.type === 'error', { after });
  assert.equal(original.slots[0].lastAccepted, 0);
});
