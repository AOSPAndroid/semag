import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import { Peer, flushPeer as flush } from './ws-helper.js';

async function room(t, options = {}) {
  const app = createServer({ port: 0, host: '127.0.0.1', ...options });
  await app.listen(0, '127.0.0.1');
  const port = app.server.address().port;
  const peers = [];
  t.after(async () => {
    for (const peer of peers) peer.socket.terminate();
    await app.close();
  });
  return {
    app,
    origin: `http://127.0.0.1:${port}`,
    async peer(name) {
      const peer = new Peer(`ws://127.0.0.1:${port}/ws`);
      peers.push(peer);
      const welcome = await peer.connect();
      peer.send({ type: 'join', name });
      await peer.untilState(message => message.players[welcome.playerId]?.name === name);
      return { peer, welcome };
    },
    third() {
      const peer = new Peer(`ws://127.0.0.1:${port}/ws`);
      peers.push(peer);
      return peer;
    },
  };
}

async function readyBoth(first, second) {
  const after = first.messages.length;
  first.send({ type: 'ready', ready: true });
  second.send({ type: 'ready', ready: true });
  return first.untilState(message => message.state.phase === 'countdown', { after });
}

test('HTTP serves the game and both ready players start live combat', async t => {
  const game = await room(t);
  const response = await fetch(`${game.origin}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /<!doctype html/i);

  const { peer: first, welcome: firstWelcome } = await game.peer('Mina');
  const { peer: second, welcome: secondWelcome } = await game.peer('Rook');
  assert.equal(firstWelcome.playerId, 0);
  assert.equal(secondWelcome.playerId, 1);

  const before = first.messages.length;
  first.send({ type: 'ready', ready: true });
  const waiting = await first.untilState(message => message.players[0]?.ready, { after: before });
  assert.equal(waiting.state.phase, 'lobby');
  assert.equal(waiting.players[1].ready, false);

  const countdown = await readyBoth(first, second);
  assert.equal(countdown.players.every(player => player.ready), true);
  assert.ok(countdown.state.phaseTicks > 0);
  game.app.state.phaseTicks = 2;
  const after = first.messages.length;
  const fighting = await first.untilState(message => message.state.phase === 'fight', { after });
  assert.equal(fighting.players.every(player => player.ready === false), true);
  const startX = fighting.state.fighters[0].x;
  first.send({ type: 'input', seq: 1, buttons: { right: true } });
  const moved = await first.untilState(message => message.acks[0] >= 1 && message.state.fighters[0].x > startX, { after });
  assert.ok(moved.state.tick > countdown.state.tick);
  assert.equal(moved.state.fighters[0].hp, 100);
});

test('unready cancels countdown; disconnect releases its slot and resets the room', async t => {
  const game = await room(t);
  const { peer: first } = await game.peer('Mina');
  const { peer: second } = await game.peer('Rook');
  await readyBoth(first, second);

  let after = first.messages.length;
  first.send({ type: 'ready', ready: false });
  const cancelled = await first.untilState(message => message.state.phase === 'lobby' && !message.players[0].ready, { after });
  assert.equal(cancelled.state.round, 1);

  await readyBoth(first, second);
  after = first.messages.length;
  second.socket.close();
  const disconnected = await first.untilState(message => message.state.phase === 'lobby' && !message.players[1]?.connected, { after });
  assert.equal(disconnected.players[0].ready, false);
  assert.equal(disconnected.state.fighters[0].wins, 0);
  const replacement = await game.peer('Vale');
  assert.equal(replacement.welcome.playerId, 1);
});

test('a disconnect during a fight returns the other player to an unready lobby', async t => {
  const game = await room(t);
  const { peer: first } = await game.peer('Mina');
  const { peer: second } = await game.peer('Rook');
  await readyBoth(first, second);
  game.app.state.phaseTicks = 2;
  await first.untilState(message => message.state.phase === 'fight');
  game.app.state.fighters[0].hp = 42;
  const after = first.messages.length;
  second.socket.close();
  const returned = await first.untilState(message => message.state.phase === 'lobby', { after });
  assert.equal(returned.players[0].ready, false);
  assert.equal(returned.state.fighters[0].hp, 100);
});

test('a third connection is rejected without disturbing the two player slots', async t => {
  const game = await room(t);
  await game.peer('Mina');
  const { peer: second } = await game.peer('Rook');
  const third = game.third();
  const [code] = await once(third.socket, 'close');
  assert.equal(code, 4403);
  const snapshot = await second.untilState(message => message.players[0]?.name === 'Mina' && message.players[1]?.name === 'Rook');
  assert.equal(snapshot.players.filter(player => player?.connected).length, 2);
});

test('malformed JSON and invalid input fields are rejected, and the connection remains usable', async t => {
  const game = await room(t);
  const { peer } = await game.peer('Mina');
  const malformed = [
    '{broken-json',
    JSON.stringify({ type: 'input', seq: 1, buttons: { left: 'yes' } }),
    JSON.stringify({ type: 'input', seq: -1, buttons: {} }),
    JSON.stringify({ type: 'input', seq: 1.5, buttons: {} }),
    JSON.stringify({ type: 'input', seq: 1, buttons: null }),
  ];
  for (const payload of malformed) {
    const after = peer.messages.length;
    peer.socket.send(payload);
    const error = await peer.waitFor(message => message.type === 'error', { after });
    assert.equal(typeof error.message, 'string');
    assert.ok(error.message.length > 0);
  }
  const after = peer.messages.length;
  peer.send({ type: 'ping', time: 12345 });
  const pong = await peer.waitFor(message => message.type === 'pong', { after });
  assert.equal(pong.time, 12345);
  assert.equal(game.app.state.phase, 'lobby');
  assert.equal(game.app.state.fighters[0].hp, 100);
});

test('queued commands advance one per tick and stale sequences cannot replay input', async t => {
  const game = await room(t, { autoTick: false });
  const { peer: first } = await game.peer('Mina');
  const { peer: second } = await game.peer('Rook');
  await readyBoth(first, second);
  game.app.state.phaseTicks = 1;
  game.app.tick();
  assert.equal(game.app.state.phase, 'fight');
  first.send({ type: 'input', seq: 0, buttons: { right: true } });
  first.send({ type: 'input', seq: 1, buttons: {} });
  first.send({ type: 'input', seq: 2, buttons: { right: true } });
  await flush(first);
  assert.equal(game.app.acks[0], -1);
  for (const sequence of [0, 1, 2]) {
    game.app.tick();
    assert.equal(game.app.acks[0], sequence);
    assert.equal(game.app.state.fighters[0].previousInput.right, sequence !== 1);
  }
  first.send({ type: 'input', seq: 1, buttons: { left: true } });
  await flush(first);
  game.app.tick();
  assert.equal(game.app.acks[0], 2);
  assert.equal(game.app.state.fighters[0].previousInput.right, true);
  assert.equal(game.app.state.fighters[0].previousInput.left, false);
});

test('input queue has a hard bound and a rejected command can be retried after draining', async t => {
  const game = await room(t, { autoTick: false });
  const { peer } = await game.peer('Mina');
  const after = peer.messages.length;
  for (let sequence = 0; sequence <= 60; sequence++) {
    peer.send({ type: 'input', seq: sequence, buttons: { right: true } });
  }
  await flush(peer);
  await peer.waitFor(message => message.type === 'error' && /queue.*full/i.test(message.message), { after });
  assert.equal(game.app.acks[0], -1);
  for (let sequence = 0; sequence < 60; sequence++) {
    game.app.tick();
    assert.equal(game.app.acks[0], sequence);
  }
  peer.send({ type: 'input', seq: 60, buttons: {} });
  await flush(peer);
  game.app.tick();
  assert.equal(game.app.acks[0], 60);
  assert.equal(game.app.state.fighters[0].previousInput.right, false);
});

test('rematch stays in the lobby until both consent, then starts a fresh match', async t => {
  const game = await room(t, { autoTick: false });
  const { peer: first } = await game.peer('Mina');
  const { peer: second } = await game.peer('Rook');
  game.app.state.phase = 'matchEnd';
  game.app.state.winner = 0;
  game.app.state.fighters[0].wins = 2;
  game.app.state.fighters[1].wins = 1;
  game.app.broadcast();
  let after = first.messages.length;
  first.send({ type: 'rematch' });
  const waiting = await first.untilState(message => message.state.phase === 'lobby' && message.players[0].ready, { after });
  assert.equal(waiting.players[1].ready, false);
  after = first.messages.length;
  second.send({ type: 'rematch' });
  const rematch = await first.untilState(message => message.state.phase === 'countdown', { after });
  assert.deepEqual(rematch.state.fighters.map(fighter => fighter.wins), [0, 0]);
  assert.equal(rematch.state.round, 1);
});

test('readiness expires when combat starts and cannot cancel an automatic later round', async t => {
  const game = await room(t, { autoTick: false });
  const { peer: first } = await game.peer('Mina');
  const { peer: second } = await game.peer('Rook');
  await readyBoth(first, second);
  game.app.state.phaseTicks = 1;
  game.app.tick();
  assert.equal(game.app.state.phase, 'fight');
  assert.equal(game.app.players.every(player => player.ready === false), true);

  game.app.state.fighters[1].hp = 0;
  game.app.tick();
  assert.equal(game.app.state.phase, 'roundEnd');
  game.app.state.phaseTicks = 1;
  game.app.tick();
  assert.equal(game.app.state.round, 2);
  assert.equal(game.app.state.phase, 'countdown');
  const after = first.messages.length;
  first.send({ type: 'ready', ready: false });
  await first.waitFor(message => message.type === 'error' && /readiness/i.test(message.message), { after });
  assert.equal(game.app.state.phase, 'countdown');
  assert.equal(game.app.state.fighters[0].wins, 1);
  assert.equal(game.app.players.every(player => player.ready === false), true);
});
