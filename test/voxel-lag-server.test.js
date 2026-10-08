import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../server.js';
import * as Voxel from '../public/voxel-engine.js';
import { getLagCompensationDiagnostics } from '../public/voxel-lag-compensation.js';
import { Peer, flushPeer } from './ws-helper.js';

async function host(t, gameId = 'voxel-breach') {
  const app = createServer({ autoTick: false });
  await app.listen(0, '127.0.0.1');
  const room = app.createRoom(gameId, 'Compensated aim', gameId === 'voxel-breach' ? { teamSize: 1, mapId: 'courtyard' } : { capacity: 2, mapId: 'forest' });
  const peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  for (let id = 0; id < 2; id++) {
    const peer = new Peer(`ws://127.0.0.1:${app.server.address().port}/ws?room=${room.id}`);
    const welcome = await peer.connect(); assert.equal(welcome.playerId, id); peers.push(peer);
  }
  return { app, room, peers };
}

for (const gameId of ['voxel-breach', 'voxel-royale']) {
  test(`${gameId} accepts optional fractional view ticks while rejecting malformed metadata without acknowledgment`, async t => {
    const { app, room, peers: [peer] } = await host(t, gameId);
    for (const value of [-1, null, '0', [], {}, true, Number.MAX_SAFE_INTEGER + 1]) {
      const after = peer.messages.length;
      peer.send({ type: 'input', seq: 0, viewTick: value, buttons: {} });
      await peer.waitFor(message => message.type === 'error', { after });
      assert.equal(room.slots[0].lastAccepted, -1); assert.equal(room.acks[0], -1);
    }
    const after = peer.messages.length;
    peer.socket.send('{"type":"input","seq":0,"viewTick":1e999,"buttons":{}}');
    await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(room.slots[0].lastAccepted, -1);
    peer.send({ type: 'input', seq: 0, viewTick: .75, buttons: { yaw: .3, pitch: -.2 } });
    await flushPeer(peer);
    assert.equal(room.slots[0].queue[0].viewTick, .75);
    app.tick(); assert.equal(room.acks[0], 0); assert.equal(room.slots[0].buttons.yaw, .3);
    peer.send({ type: 'input', seq: 1, buttons: { yaw: -.5 } });
    await flushPeer(peer); app.tick(); assert.equal(room.acks[0], 1);
    assert.equal(room.slots[0].buttons.yaw, -.5, 'older clients keep their existing controls');
    const wire = await peer.untilState(() => true);
    assert.equal(JSON.stringify(wire).includes('lagCompensation'), false, 'server history never enters room snapshots');
    assert.equal(Object.hasOwn(room.state, 'viewTick'), false);
  });
}

async function movingHeadShot(t, view = 'valid') {
  const game = await host(t), { app, room, peers: [shooterPeer, targetPeer] } = game;
  shooterPeer.send({ type: 'fps-loadout', weaponId: 'marksman' }); await flushPeer(shooterPeer);
  for (const peer of game.peers) peer.send({ type: 'ready', ready: true });
  await flushPeer(targetPeer);
  while (room.state.phase !== 'fight') app.tick();
  const [shooter, target] = room.state.players;
  Object.assign(shooter, { x: -20, y: 0, z: 10, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, grounded: true });
  Object.assign(target, { x: -20, y: 0, z: 0, vx: 5.4, vy: 0, vz: 0, yaw: 0, pitch: 0, grounded: true });
  targetPeer.send({ type: 'input', seq: 0, buttons: { right: true, yaw: 0, pitch: 0 } }); await flushPeer(targetPeer);
  const poses = new Map();
  for (let tick = 0; tick < 24; tick++) { app.tick(); poses.set(room.state.tick, { x: target.x, y: target.y, z: target.z }); }
  const displayedTick = room.state.tick - 6, displayed = poses.get(displayedTick);
  const yaw = Math.atan2(displayed.x - shooter.x, -(displayed.z - shooter.z));
  const currentRay = Voxel.traceShot(room.state, 0, { x: shooter.x, y: shooter.y + Voxel.eyeHeight(shooter), z: shooter.z }, { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) }, 120, Voxel.MAPS.courtyard);
  assert.equal(currentRay.playerId, null, 'moving rendered head is outside the unrewound current head box');
  const metadata = view === 'valid' ? { viewTick: displayedTick } : view === 'stale' ? { viewTick: room.state.tick - 19 } : view === 'future' ? { viewTick: room.state.tick + 500 } : {};
  const hp = target.hp, ammo = shooter.ammo, currentX = target.x;
  shooterPeer.send({ type: 'input', seq: 0, buttons: { fire: true, yaw, pitch: 0 }, ...metadata }); await flushPeer(shooterPeer);
  app.tick();
  assert.equal(room.acks[0], 0); assert.equal(shooter.ammo, ammo - 1);
  assert.equal(target.x > currentX, true, 'historical tracing never rewinds authoritative movement');
  const shot = room.state.events.findLast(event => event.type === 'shot' && event.playerId === 0);
  assert.ok(shot);
  if (view === 'valid') {
    assert.equal(shot.hitKind, 'head'); assert.equal(shot.targetId, 1);
    assert.equal(target.hp, hp - Voxel.WEAPONS.marksman.damage * Voxel.WEAPONS.marksman.headMultiplier);
    assert.equal(target.hp < hp, true); assert.equal(shooter.damageDealt > 0, true);
  } else {
    assert.equal(shot.targetId, null); assert.equal(target.hp, hp);
  }
  return game;
}

test('real consumed input compensates a 50ms moving head without changing ammo, movement or cover authority', async t => {
  const { app, room } = await movingHeadShot(t);
  assert.equal(getLagCompensationDiagnostics(room.state).viewCount, 1);
  room.slots[0].lastInputTime -= 351;
  app.tick();
  assert.equal(room.slots[0].buttons.fire, false);
  assert.equal(getLagCompensationDiagnostics(room.state).viewCount, 0, 'stale held input releases historic shot metadata');
});
for (const view of ['absent', 'stale', 'future']) {
  test(`real ${view} view metadata uses the current hitscan rather than arbitrary history`, async t => {
    await movingHeadShot(t, view);
  });
}
