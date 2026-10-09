import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../server.js';
import { MELEE_IDS } from '../public/voxel-melee.js';
import { Peer, flushPeer } from './ws-helper.js';

async function host(t) {
  const app = createServer({ autoTick: false, creationLimit: 100 }); await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  return { app, origin,
    post(body) { return fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); },
    async connect(room) { const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`); peers.push(peer); const welcome = await peer.connect(); return { peer, welcome }; },
  };
}
async function rejected(peer, message) {
  const after = peer.messages.length; peer.send(message);
  const response = await peer.waitFor(value => value.type === 'error', { after }); assert.ok(response.message);
}

test('Last Stand room creation validates the starting blade and carries it to every human slot and room metadata', async t => {
  const game = await host(t);
  for (const melee of ['__proto__', 'katana ', '', null, 1, {}, ['axe']]) {
    const response = await game.post({ gameId: 'voxel-horde', melee }); assert.equal(response.status, 400);
  }
  assert.equal(game.app.rooms.size, 0);
  for (const melee of MELEE_IDS) {
    const response = await game.post({ gameId: 'voxel-horde', melee }); assert.equal(response.status, 201);
    const summary = (await response.json()).room, room = game.app.rooms.get(summary.id);
    assert.equal(summary.melee, melee); assert.equal(room.state.horde.config.melee, melee);
    assert.ok(room.state.players.every(player => player.inventory[0].weapon === melee));
    const { welcome } = await game.connect(room); assert.equal(welcome.melee, melee);
  }
  const response = await game.post({ gameId: 'voxel-horde' });
  assert.equal((await response.json()).room.melee, 'katana');
});

for (const gameId of ['voxel-breach', 'voxel-horde']) {
  test(`${gameId} accepts independent blade choices and paired loadouts, without mutating on malformed requests`, async t => {
    const game = await host(t), response = await game.post({ gameId }), summary = (await response.json()).room, room = game.app.rooms.get(summary.id);
    const one = await game.connect(room), two = await game.connect(room), other = JSON.stringify(room.state.players[two.welcome.playerId]);
    one.peer.send({ type: 'ready', ready: true }); await flushPeer(one.peer);
    assert.equal(room.players[one.welcome.playerId].ready, true);
    one.peer.send({ type: 'fps-loadout', meleeId: 'axe' }); await flushPeer(one.peer);
    assert.equal(room.state.players[one.welcome.playerId].inventory[0].weapon, 'axe'); assert.equal(room.players[one.welcome.playerId].ready, false);
    one.peer.send({ type: 'fps-loadout', weaponId: 'dualsmg', meleeId: 'tonfas' }); await flushPeer(one.peer);
    const player = room.state.players[one.welcome.playerId];
    assert.equal(player.inventory[0].weapon, 'tonfas'); assert.equal(player.inventory[1].weapon, 'dualsmg');
    assert.equal(JSON.stringify(room.state.players[two.welcome.playerId]), other, 'a loadout never changes another player');
    for (const message of [
      { type: 'fps-loadout' }, { type: 'fps-loadout', meleeId: '__proto__' },
      { type: 'fps-loadout', weaponId: 'carbine', meleeId: '__proto__' },
      { type: 'fps-loadout', weaponId: '__proto__', meleeId: 'katana' },
      { type: 'fps-loadout', meleeId: 'katana', hp: 999 },
      { type: 'fps-loadout', weaponId: null, meleeId: 'katana' },
    ]) {
      const before = JSON.stringify(room.state.players), revision = room.state.eventId;
      await rejected(one.peer, message); assert.equal(JSON.stringify(room.state.players), before); assert.equal(room.state.eventId, revision);
    }
    one.peer.send({ type: 'fps-loadout', weaponId: 'slugshotgun' }); await flushPeer(one.peer);
    assert.equal(player.inventory[1].weapon, 'slugshotgun'); assert.equal(player.inventory[0].weapon, 'tonfas', 'legacy gun-only messages preserve the chosen blade');
    room.state.phase = 'fight'; const before = JSON.stringify(room.state.players);
    await rejected(one.peer, { type: 'fps-loadout', weaponId: 'carbine', meleeId: 'katana' });
    assert.equal(JSON.stringify(room.state.players), before, 'live combat rejects the entire replacement');
  });
}
