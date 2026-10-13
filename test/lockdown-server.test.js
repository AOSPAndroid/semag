import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../server.js';
import { RULES, CAPACITY, emptyInput } from '../public/lockdown-engine.js';
import { Peer, flushPeer as flush } from './ws-helper.js';

async function host(t) {
  const app = createServer({ autoTick: false }); await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const p of peers) p.socket.terminate(); await app.close(); });
  return { app, origin,
    async make(body = {}) {
      const response = await fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: 'lockdown', ...body }) });
      return { response, body: await response.json() };
    },
    async peer(roomId, name) {
      const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${roomId}`); peers.push(peer);
      const welcome = await peer.connect(); peer.send({ type: 'join', name });
      await peer.untilState(message => message.players[welcome.playerId]?.name === name);
      return { peer, welcome };
    },
  };
}
async function expectError(peer, payload, pattern) {
  const after = peer.messages.length; peer.send(payload);
  const error = await peer.waitFor(message => message.type === 'error', { after }); assert.match(error.message, pattern);
}

test('Lockdown rooms seat up to eight, take setup and map choices, and start with bots filling seats', async t => {
  const game = await host(t);
  assert.equal((await game.make({ teamSize: 3 })).response.status, 400, 'no unknown settings');
  assert.equal((await game.make({ mapId: 'nowhere' })).response.status, 400);
  const { response, body } = await game.make({ mapId: 'foundry' });
  assert.equal(response.status, 201);
  assert.equal(body.room.capacity, CAPACITY); assert.equal(body.room.mapId, 'foundry');
  const room = game.app.rooms.get(body.room.id);
  const { peer: first, welcome } = await game.peer(body.room.id, 'Ada');
  const { peer: second } = await game.peer(body.room.id, 'Bo');
  assert.equal(welcome.gameId, 'lockdown'); assert.equal(room.hostId, 0);
  assert.equal(room.state.players[0].name, 'Ada'); assert.equal(room.state.players[1].human, true);
  assert.equal(room.state.players[0].armor, 'none');

  await expectError(second, { type: 'start' }, /host/i);
  await expectError(second, { type: 'lockdown-map', mapId: 'keep' }, /host/i);
  await expectError(first, { type: 'lockdown-map', mapId: 'moon' }, /map/i);
  await expectError(first, { type: 'lockdown-setup', cls: 'wizard' }, /Striker/);
  await expectError(first, { type: 'lockdown-setup', weapons: ['brand', 'brand', 'blast'] }, /different/);
  await expectError(first, { type: 'lockdown-setup', cls: 'guardian', armor: 'unobtainium' }, /armor/);
  assert.equal(room.state.players[0].cls, 'striker', 'invalid armor does not partially apply the class');
  await expectError(first, { type: 'lockdown-setup', armor: 'heavy', gunResistance: 1 }, /only/);
  assert.equal(room.state.players[0].armor, 'none');
  await expectError(first, { type: 'lockdown-setup', cls: 'recon', hp: 999 }, /only/);
  await expectError(first, { type: 'start', mapId: 'keep' }, /no player, map/i);

  first.send({ type: 'lockdown-map', mapId: 'keep' });
  await expectError(first, { type: 'lockdown-setup', helmet: 'crown', armor: 'heavy' }, /helmet/);
  assert.equal(room.state.players[0].armor, 'none', 'an invalid helmet does not partially apply the armor');
  second.send({ type: 'lockdown-setup', team: 1, cls: 'guardian', armor: 'ballistic', helmet: 'bucket', pants: 'kilt', shoes: 'clogs', weapons: ['cleaver', 'pulsar', 'vortex'] });
  await flush(first); await flush(second);
  assert.deepEqual(['helmet', 'pants', 'shoes'].map(slot => room.state.players[1][slot]), ['bucket', 'kilt', 'clogs']);
  // Inventory: any order of the four slots, sent as a permutation.
  await expectError(second, { type: 'lockdown-inventory', order: [0, 0, 1, 2] }, /four/);
  await expectError(second, { type: 'lockdown-inventory', order: [3, 2, 1, 0], weapons: ['brand'] }, /order/);
  second.send({ type: 'lockdown-inventory', order: [3, 2, 1, 0] }); await flush(second);
  assert.deepEqual(room.state.players[1].weapons, [null, 'vortex', 'pulsar', 'cleaver']);
  assert.equal(room.state.mapId, 'keep'); assert.equal(room.mapId, 'keep');
  assert.deepEqual([room.state.players[1].team, room.state.players[1].cls], [1, 'guardian']);
  assert.equal(room.state.players[1].armor, 'ballistic');

  const beforeStart = first.messages.length;
  first.send({ type: 'start' });
  await first.untilState(message => message.state.phase === 'countdown', { after: beforeStart });
  assert.deepEqual([0, 1].map(team => room.state.players.filter(player => player.team === team).length), [4, 4]);
  assert.equal(room.state.players.filter(player => player.human).length, 2);
  // Everyone starts in base, so loadouts can still change; teams cannot.
  await expectError(second, { type: 'lockdown-setup', team: 0 }, /lobby/);
  second.send({ type: 'lockdown-setup', cls: 'recon', armor: 'scout' }); await flush(second);
  assert.equal(room.state.players[1].cls, 'recon');
  assert.equal(room.state.players[1].armor, 'scout');
  for (let t = 0; t <= RULES.countdownTicks; t++) game.app.tick();
  assert.equal(room.state.phase, 'fight');

  // Inputs move your knight; the snapshot carries events trimmed for the wire.
  const me = room.state.players[0], startX = me.x;
  for (let seq = 1; seq <= 40; seq++) { first.send({ type: 'input', seq, buttons: { ...emptyInput(0), right: true } }); }
  await flush(first);
  for (let t = 0; t < 40; t++) game.app.tick();
  assert.ok(me.x > startX + 20, `moved from ${startX} to ${me.x}`);
  await expectError(first, { type: 'input', seq: 41, buttons: { ...emptyInput(0), aim: 9 } }, /./);
  const mark = first.messages.length;
  for (let t = 0; t < 4; t++) game.app.tick();
  const snapshot = await first.untilState(message => message.state.phase === 'fight', { after: mark });
  assert.ok(snapshot.state.events.every(event => snapshot.state.tick - event.tick <= 240));
  assert.equal(snapshot.state.players[1].armor, 'scout', 'authoritative armor reaches other clients');
  // Out on the field, a loadout change waits for the base.
  Object.assign(me, { x: room.state.points[1].x, y: room.state.points[1].y });
  await expectError(first, { type: 'lockdown-setup', cls: 'guardian' }, /base/);
  await expectError(first, { type: 'lockdown-setup', armor: 'heavy' }, /base/);
  assert.equal(me.armor, 'none');

  // Leaving mid-match hands the seat to a bot and the match carries on for everyone else.
  const after = first.messages.length;
  second.socket.close();
  await first.untilState(message => message.players[1] === null, { after });
  assert.equal(room.state.phase, 'fight');
  assert.equal(room.state.players[1].bot, true); assert.equal(room.state.players[1].human, false);
  for (let t = 0; t < 10; t++) game.app.tick();

  // Finish, then only the host reopens the lobby.
  room.state.scores[0] = RULES.scoreToWin; game.app.tick();
  assert.equal(room.state.phase, 'matchEnd'); assert.equal(room.state.winner, 0);
  const beforeRematch = first.messages.length;
  first.send({ type: 'rematch' });
  await first.untilState(message => message.state.phase === 'lobby', { after: beforeRematch });
  assert.deepEqual(room.state.scores, [0, 0]);
});

test('the host role passes on when the host leaves the Lockdown lobby', async t => {
  const game = await host(t), { body } = await game.make();
  const room = game.app.rooms.get(body.room.id);
  const { peer: first } = await game.peer(body.room.id, 'Ada');
  const { peer: second } = await game.peer(body.room.id, 'Bo');
  const after = second.messages.length;
  first.socket.close();
  const message = await second.untilState(state => state.hostId === 1, { after });
  assert.equal(message.hostId, 1);
  assert.equal(room.state.players[0].human, false);
  second.send({ type: 'start' });
  await second.untilState(state => state.state.phase === 'countdown');
});
