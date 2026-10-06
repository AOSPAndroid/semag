import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import { WORLD } from '../public/brawl-engine.js';
import { Peer, flushPeer as flush } from './ws-helper.js';

async function host(t) {
  const app = createServer({ autoTick: false }); await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const p of peers) p.socket.terminate(); await app.close(); });
  return { app, origin,
    async make(gameId = 'oddstock-rumble') {
      const response = await fetch(`${origin}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) });
      assert.equal(response.status, 201); const body = await response.json(); return app.rooms.get(body.room.id);
    },
    async peer(room, name = 'Mina') {
      const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`); peers.push(peer);
      const welcome = await peer.connect(); peer.send({ type: 'join', name });
      await peer.untilState(message => message.players[welcome.playerId]?.name === name);
      return { peer, welcome };
    },
    third(room) { const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${room.id}`); peers.push(peer); return peer; },
  };
}
async function selectBoth(first, second, stage = 'rooftop') {
  first.send({ type: 'brawl-select', character: 'wrench', stage }); second.send({ type: 'brawl-select', character: 'bulk' });
  await flush(first); await flush(second);
}
async function readyBoth(game, room, first, second) {
  const after = first.messages.length;
  first.send({ type: 'ready', ready: true }); second.send({ type: 'ready', ready: true });
  await first.untilState(message => message.state.phase === 'countdown', { after });
  room.state.phaseTicks = 1; game.app.tick(); assert.equal(room.state.phase, 'fight');
}
async function expectError(peer, payload, pattern = /./) {
  const after = peer.messages.length; peer.send(payload);
  const error = await peer.waitFor(message => message.type === 'error', { after }); assert.match(error.message, pattern);
}

test('Oddstock rooms require each player’s comic and host stage before readiness starts play', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first, welcome } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  assert.equal(welcome.gameId, 'oddstock-rumble');
  assert.ok((await (await fetch(`${game.origin}/health`)).json()).games.includes('oddstock-rumble'));
  await expectError(first, { type: 'ready', ready: true }, /comic.*stage/i);
  await expectError(first, { type: 'rematch' }, /comic.*stage/i);
  first.send({ type: 'brawl-select', character: 'sprout' }); await flush(first);
  await expectError(first, { type: 'ready', ready: true }, /stage/i);
  first.send({ type: 'brawl-select', stage: 'garden' }); await flush(first);
  first.send({ type: 'ready', ready: true }); await flush(first);
  assert.equal(room.players[0].ready, true); assert.equal(room.state.phase, 'lobby');
  await expectError(second, { type: 'ready', ready: true }, /comic/i);
  second.send({ type: 'brawl-select', character: 'moth' }); await flush(second);
  second.send({ type: 'ready', ready: true }); await flush(second);
  assert.equal(room.state.phase, 'countdown'); assert.equal(room.state.stageId, 'garden');
  room.state.phaseTicks = 1; game.app.tick(); assert.equal(room.state.phase, 'fight');
  assert.ok(room.players.every(player => !player.ready));
  assert.equal(room.state.fighters[0].stocks, 3); assert.equal(room.state.fighters[1].characterId, 'moth');
});

test('comic/stage selection validates type, vocabulary, ownership, unknown fields and match phase', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  for (const payload of [
    { type: 'brawl-select' }, { type: 'brawl-select', character: null }, { type: 'brawl-select', character: ['wrench'] },
    { type: 'brawl-select', character: '__proto__' }, { type: 'brawl-select', stage: 'missing' },
    { type: 'brawl-select', character: 'wrench', playerId: 1 }, { type: 'brawl-select', stage: 'rooftop', hp: 999 },
    { type: 'brawl-select', character: 'wrench', stage: false },
  ]) await expectError(first, payload);
  await expectError(second, { type: 'brawl-select', stage: 'garden' }, /player one/i);
  assert.equal(room.state.fighters[0].selected, false); assert.equal(room.state.stageSelected, false);
  await selectBoth(first, second); await readyBoth(game, room, first, second);
  const selected = room.state.fighters[0].characterId;
  await expectError(first, { type: 'brawl-select', character: 'zap' }, /lobby/i);
  assert.equal(room.state.fighters[0].characterId, selected);
});

test('changing a comic unreadies that player, and changing stage unreadies both', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  await selectBoth(first, second);
  first.send({ type: 'ready', ready: true }); await flush(first); assert.equal(room.players[0].ready, true);
  first.send({ type: 'brawl-select', character: 'parcel' }); await flush(first); assert.equal(room.players[0].ready, false);
  second.send({ type: 'ready', ready: true }); await flush(second);
  assert.equal(room.players[1].ready, true);
  first.send({ type: 'brawl-select', stage: 'foundry' }); await flush(first);
  assert.ok(room.players.every(player => !player.ready)); assert.equal(room.state.stageId, 'foundry');
  first.send({ type: 'ready', ready: true }); second.send({ type: 'ready', ready: true }); await flush(first); await flush(second);
  assert.equal(room.state.phase, 'countdown');
  first.send({ type: 'ready', ready: false }); await flush(first);
  assert.equal(room.state.phase, 'lobby'); assert.equal(room.state.stageId, 'foundry');
  assert.equal(room.state.fighters[0].characterId, 'parcel'); assert.equal(room.state.fighters[1].characterId, 'bulk');
});

test('strict boolean inputs are queued one per tick and cannot smuggle numeric aim or fighter stats', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  await selectBoth(first, second); await readyBoth(game, room, first, second);
  for (const buttons of [{ left: 1 }, { aimX: .5 }, { attack: 'yes' }, { stocks: 999 }, { roll: true }]) await expectError(first, { type: 'input', seq: 0, buttons }, /boolean/i);
  first.send({ type: 'input', seq: 0, buttons: { right: true, jump: true } });
  first.send({ type: 'input', seq: 1, buttons: { attack: true, down: true } });
  await flush(first); assert.equal(room.acks[0], -1);
  const x = room.state.fighters[0].x; game.app.tick();
  assert.equal(room.acks[0], 0); assert.ok(room.state.fighters[0].x > x); assert.equal(room.state.fighters[0].grounded, false);
  game.app.tick(); assert.equal(room.acks[0], 1); assert.equal(room.state.fighters[0].move.direction, 'down');
  first.send({ type: 'input', seq: 0, buttons: { special: true } }); await flush(first); game.app.tick();
  assert.equal(room.acks[0], 1); assert.equal(room.state.fighters[0].previousInput.special, false);
});

test('host authoritative stock losses finish the full match and rematch keeps choices with two ready votes', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  await selectBoth(first, second, 'garden'); await readyBoth(game, room, first, second);
  for (let stock = 3; stock > 0; stock--) {
    const f = room.state.fighters[1]; f.x = WORLD.blastRight + 10; game.app.tick();
    assert.equal(f.stocks, stock - 1);
    if (stock > 1) for (let i = 0; i < 121; i++) game.app.tick();
  }
  assert.equal(room.state.phase, 'matchEnd'); assert.equal(room.state.winner, 0);
  first.send({ type: 'rematch' }); await flush(first);
  assert.equal(room.state.phase, 'lobby'); assert.equal(room.players[0].ready, true); assert.equal(room.players[1].ready, false);
  assert.equal(room.state.stageId, 'garden'); assert.equal(room.state.stageSelected, true);
  assert.equal(room.state.fighters[0].characterId, 'wrench'); assert.equal(room.state.fighters[1].characterId, 'bulk');
  assert.equal(room.state.fighters[1].stocks, 3);
  second.send({ type: 'rematch' }); await flush(second); assert.equal(room.state.phase, 'countdown');
});

test('disconnect resets damage/stocks, clears only the departing comic, and host departure unconfirms stage', async t => {
  const game = await host(t), room = await game.make();
  const { peer: first } = await game.peer(room), { peer: second } = await game.peer(room, 'Rook');
  await selectBoth(first, second, 'foundry'); await readyBoth(game, room, first, second);
  room.state.fighters[0].damage = 160; room.state.fighters[0].stocks = 1;
  let after = first.messages.length; second.socket.close();
  await first.untilState(message => message.state.phase === 'lobby' && !message.players[1]?.connected, { after });
  assert.equal(room.state.fighters[0].characterId, 'wrench'); assert.equal(room.state.fighters[0].damage, 0); assert.equal(room.state.fighters[0].stocks, 3);
  assert.equal(room.state.fighters[1].selected, false); assert.equal(room.state.stageSelected, true); assert.equal(room.players[0].ready, false);
  const { peer: replacement, welcome } = await game.peer(room, 'Vale'); assert.equal(welcome.playerId, 1);
  await expectError(replacement, { type: 'ready', ready: true }, /comic/i);
  after = replacement.messages.length; first.socket.close();
  await replacement.untilState(message => !message.players[0]?.connected, { after });
  assert.equal(room.state.stageSelected, false); assert.equal(room.state.fighters[0].selected, false);
});

test('Oddstock room selections/combat are isolated and other games reject the new action', async t => {
  const game = await host(t), a = await game.make(), b = await game.make(), vector = await game.make('vector-arena');
  const { peer: first } = await game.peer(a), { peer: second } = await game.peer(a, 'Rook');
  const { peer: outsider } = await game.peer(b, 'Vale'), { peer: shooter } = await game.peer(vector, 'Vector');
  await selectBoth(first, second, 'garden'); await readyBoth(game, a, first, second);
  outsider.send({ type: 'brawl-select', character: 'moth', stage: 'foundry' }); await flush(outsider);
  assert.equal(a.state.stageId, 'garden'); assert.equal(b.state.stageId, 'foundry'); assert.equal(b.state.phase, 'lobby');
  assert.equal(b.state.fighters[0].characterId, 'moth'); assert.equal(a.state.fighters[0].characterId, 'wrench');
  await expectError(shooter, { type: 'brawl-select', character: 'zap' }, /only.*oddstock/i);
  first.send({ type: 'input', seq: 0, buttons: { right: true, attack: true } }); await flush(first);
  const untouched = structuredClone(b.state.fighters); game.app.tick(); assert.deepEqual(b.state.fighters, untouched);
  const third = game.third(a); const [code] = await once(third.socket, 'close'); assert.equal(code, 4403);
});

test('selection actions obey the existing per-connection rate limit', async t => {
  const game = await host(t), room = await game.make(), { peer } = await game.peer(room);
  const closed = once(peer.socket, 'close');
  for (let i = 0; i < 305; i++) peer.send({ type: 'brawl-select', character: 'wrench' });
  const [code] = await closed; assert.equal(code, 4408);
});
