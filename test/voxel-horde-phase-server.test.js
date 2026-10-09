import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../server.js';
import { Peer, flushPeer } from './ws-helper.js';

async function run(t, size = 1) {
  const app = createServer({ autoTick: false }); await app.listen(0, '127.0.0.1');
  const room = app.createRoom('voxel-horde', 'Natural last stand', { capacity: 3, mapId: 'courtyard', difficulty: 'veteran' });
  const peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  for (let id = 0; id < size; id++) {
    const peer = new Peer(`ws://127.0.0.1:${app.server.address().port}/ws?room=${room.id}`); await peer.connect();
    peers.push(peer); peer.send({ type: 'ready', ready: true }); await flushPeer(peer);
  }
  peers[0].send({ type: 'start' }); await flushPeer(peers[0]);
  assert.equal(room.state.phase, 'countdown');
  return { app, room, peers };
}

for (const size of [1, 3]) {
  test(`The natural ${size}-person squad wipe immediately delivers its terminal snapshot even though simulation ticks stop`, async t => {
    const { app, room, peers } = await run(t, size);
    for (let step = 0; step < 8000 && room.state.phase !== 'matchEnd'; step++) {
      app.tick();
      // Real sockets drain while gameplay advances. Preserve that behavior
      // without changing elapsed ticks, controls, AI, damage or the outcome.
      if (step % 32 === 31) for (const peer of peers) await flushPeer(peer);
    }
    assert.equal(room.state.phase, 'matchEnd', 'actual pursuing monsters must kill the idle human squad');
    assert.ok(room.state.events.some(event => event.type === 'monsterAttack' && event.hit));
    assert.ok(room.state.events.some(event => event.type === 'kill' && event.targetId < 3));
    const terminalTick = room.state.tick;
    for (const peer of peers) {
      await flushPeer(peer);
      const packet = peer.messages.findLast(message => message.type === 'state');
      assert.equal(packet.state.phase, 'matchEnd', `terminal authority at tick ${terminalTick} must reach each human immediately`);
      assert.equal(packet.state.tick, terminalTick);
      assert.equal(packet.state.horde.result, 'lost');
      assert.ok(packet.state.players.slice(0, 3).every(player => !player.alive));
      assert.equal(packet.state.events.findLast(event => event.type === 'hordeEnd')?.tick, terminalTick);
      assert.equal(peer.messages.filter(message => message.type === 'state' && message.state.phase === 'matchEnd').length, 1);
    }
    for (let step = 0; step < 120; step++) app.tick();
    assert.equal(room.state.tick, terminalTick, 'ended horde simulation correctly stays frozen');
    await flushPeer(peers[0]);
    assert.equal(peers[0].messages.filter(message => message.type === 'state' && message.state.phase === 'matchEnd').length, 1, 'immediate phase delivery does not create repeated terminal broadcasts');
  });
}

test('Countdown-to-fight phase commits reach clients on the exact transition tick before the next periodic snapshot', async t => {
  const { app, room, peers: [peer] } = await run(t);
  // An ordinary name update sends a countdown snapshot between periodic
  // ticks. The following phase transition must not depend on that cadence.
  app.tick(); peer.send({ type: 'join', name: 'Phase watcher' }); await flushPeer(peer);
  assert.equal(room.lastBroadcastTick, 1);
  while (room.state.phase === 'countdown' && room.state.phaseTicks > 1) app.tick();
  await flushPeer(peer);
  const after = peer.messages.length;
  app.tick(); assert.equal(room.state.phase, 'fight'); await flushPeer(peer);
  const packets = peer.messages.slice(after).filter(message => message.type === 'state');
  assert.equal(packets.length, 1); assert.equal(packets[0].state.phase, 'fight'); assert.equal(packets[0].state.tick, room.state.tick);
});
