import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createServer } from '../server.js';
import { GAME_IDS, canPlay, cardTotal } from '../public/cards-engine.js';
import { Peer, flushPeer } from './ws-helper.js';

async function table(t, gameId) {
  const app = createServer({ port: 0, host: '127.0.0.1', autoTick: false });
  await app.listen(0, '127.0.0.1');
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const response = await fetch(`${origin}/api/rooms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }),
  });
  assert.equal(response.status, 201);
  const { room: info } = await response.json();
  const room = app.rooms.get(info.id), peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  const join = async name => {
    const peer = new Peer(`${origin.replace('http:', 'ws:')}/ws?room=${info.id}`);
    peers.push(peer);
    const { playerId } = await peer.connect();
    const after = peer.messages.length;
    peer.send({ type: 'join', name });
    const state = await peer.untilState(message => message.players[playerId]?.name === name, { after });
    return { peer, playerId, state };
  };
  const first = await join('First'), second = await join('Second');
  return { app, room, origin, first, second, join };
}

function assertPrivate(packet, internal, player) {
  const state = packet.state;
  for (const key of ['deck', 'board', 'discard']) assert.equal(Object.hasOwn(state, key), false, `${key} must never be sent`);
  if (internal.gameId === 'memory') {
    assert.equal(state.cards.length, 32);
    state.cards.forEach((card, index) => {
      const publicCard = internal.matched[index] !== null || internal.revealed.includes(index);
      assert.deepEqual(card, publicCard ? internal.board[index] : null);
    });
  } else {
    assert.deepEqual(state.hands[player], internal.hands[player]);
    const revealed = internal.gameId === 'twenty-one' && ['roundEnd', 'matchEnd'].includes(internal.phase);
    assert.deepEqual(state.hands[1 - player], revealed ? internal.hands[1 - player] : internal.hands[1 - player].map(() => null));
    if (internal.gameId === 'twenty-one') assert.equal(state.totals[1 - player], revealed ? cardTotal(internal.hands[1 - player]) : null);
  }
}

async function begin(table) {
  const after = table.first.peer.messages.length;
  table.first.peer.send({ type: 'ready', ready: true });
  table.second.peer.send({ type: 'ready', ready: true });
  const countdown = await table.first.peer.untilState(packet => packet.state.phase === 'countdown', { after });
  assertPrivate(countdown, table.room.state, 0);
  table.room.state.phaseTicks = 1;
  const start = table.first.peer.messages.length;
  table.app.tick();
  return table.first.peer.untilState(packet => packet.state.phase === 'fight' || table.room.gameId === 'twenty-one' && packet.state.phase === 'roundEnd', { after: start });
}

async function action(peer, action) {
  const after = peer.messages.length;
  peer.send({ type: 'card-action', action });
  await flushPeer(peer);
  return peer.messages.slice(after);
}

test('card tables hide decks, opponent hands and memory faces throughout ready, cancel and disconnect flows', async t => {
  for (const gameId of GAME_IDS) {
    await t.test(gameId, async t => {
      const game = await table(t, gameId);
      assertPrivate(game.first.state, game.room.state, 0);
      assertPrivate(game.second.state, game.room.state, 1);
      let after = game.first.peer.messages.length;
      game.first.peer.send({ type: 'ready', ready: true });
      game.second.peer.send({ type: 'ready', ready: true });
      const countdown = await game.first.peer.untilState(packet => packet.state.phase === 'countdown', { after });
      assertPrivate(countdown, game.room.state, 0);
      after = game.first.peer.messages.length;
      game.second.peer.send({ type: 'ready', ready: false });
      const canceled = await game.first.peer.untilState(packet => packet.state.phase === 'lobby', { after });
      assertPrivate(canceled, game.room.state, 0);
      assert.equal(game.room.players.some(player => player.ready), false);
      const active = await begin(game);
      assertPrivate(active, game.room.state, 0);
      assertPrivate(await game.second.peer.untilState(packet => packet.state.phase === game.room.state.phase), game.room.state, 1);
      after = game.first.peer.messages.length;
      const closed = once(game.second.peer.socket, 'close');
      game.second.peer.socket.close();
      await closed;
      const disconnected = await game.first.peer.untilState(packet => packet.state.phase === 'lobby' && !packet.players[1], { after });
      assertPrivate(disconnected, game.room.state, 0);
      assert.equal(game.room.players[0].ready, false);
      const replacement = await game.join('Replacement');
      assert.equal(replacement.playerId, 1);
      assertPrivate(replacement.state, game.room.state, 1);
    });
  }
});

test('card messages reject realtime controls, board moves, malformed actions and lobby actions without mutation', async t => {
  const game = await table(t, 'crazy-eights');
  for (const packet of [
    { type: 'input', seq: 0, buttons: {} }, { type: 'move', from: 1, to: 2 },
    { type: 'card-action', action: null }, { type: 'card-action', action: [] },
    { type: 'card-action', action: { kind: 42 } }, { type: 'card-action', action: { kind: 'draw' } },
  ]) {
    const before = JSON.stringify(game.room.state), after = game.first.peer.messages.length;
    game.first.peer.send(packet);
    const error = await game.first.peer.waitFor(message => message.type === 'error', { after });
    assert.equal(Object.hasOwn(error, 'state'), false);
    assert.equal(JSON.stringify(game.room.state), before);
    assert.equal(game.room.acks[0], -1);
  }
  const original = game.app.createRoom('afterimage');
  const peer = new Peer(`${game.origin.replace('http:', 'ws:')}/ws?room=${original.id}`);
  t.after(() => peer.socket.terminate());
  await peer.connect();
  const after = peer.messages.length;
  peer.send({ type: 'card-action', action: { kind: 'hit' } });
  await peer.waitFor(message => message.type === 'error', { after });
  assert.equal(original.state.phase, 'lobby');
});

test('Crazy Eights actions are turn-bound, card ownership is checked and accepted plays broadcast private views immediately', async t => {
  const game = await table(t, 'crazy-eights');
  await begin(game);
  const before = JSON.stringify(game.room.state);
  const wrongTurn = await action(game.second.peer, { kind: 'play', cardId: game.room.state.hands[1][0].id, suit: 0 });
  assert.ok(wrongTurn.some(packet => packet.type === 'error'));
  assert.equal(JSON.stringify(game.room.state), before);
  const forged = await action(game.first.peer, { kind: 'play', cardId: game.room.state.hands[1][0].id, suit: 0 });
  assert.ok(forged.some(packet => packet.type === 'error'));
  assert.equal(JSON.stringify(game.room.state), before);
  let card = game.room.state.hands[0].find(card => canPlay(card, game.room.state.discard.at(-1), game.room.state.activeSuit));
  if (!card) {
    const drawn = await action(game.first.peer, { kind: 'draw' });
    assert.ok(drawn.some(packet => packet.type === 'state'));
    card = game.room.state.hands[0].find(card => canPlay(card, game.room.state.discard.at(-1), game.room.state.activeSuit));
  }
  const accepted = await action(game.first.peer, card ? { kind: 'play', cardId: card.id, suit: 0 } : { kind: 'pass' });
  assert.equal(accepted.some(packet => packet.type === 'error'), false);
  const own = accepted.find(packet => packet.type === 'state');
  assert.ok(own);
  assertPrivate(own, game.room.state, 0);
  await flushPeer(game.second.peer);
  assertPrivate(game.second.peer.messages.filter(packet => packet.type === 'state').at(-1), game.room.state, 1);
  assert.equal(game.room.state.turn, 1);
});

test('21 hands stay private until showdown, reveal both totals, and become private again next round and rematch', async t => {
  const game = await table(t, 'twenty-one');
  await begin(game);
  for (let round = 1; round <= 5; round += 1) {
    for (const { peer, playerId } of [game.first, game.second]) {
      if (!game.room.state.stood[playerId]) await action(peer, { kind: 'stand' });
    }
    const phase = round === 5 ? 'matchEnd' : 'roundEnd';
    const shown = await game.first.peer.untilState(packet => packet.state.phase === phase && packet.state.round === round);
    assertPrivate(shown, game.room.state, 0);
    assert.equal(shown.state.totals.every(Number.isFinite), true);
    if (round < 5) {
      const after = game.first.peer.messages.length;
      game.room.state.phaseTicks = 1;
      game.app.tick();
      const next = await game.first.peer.untilState(packet => packet.state.round === round + 1, { after });
      assertPrivate(next, game.room.state, 0);
    }
  }
  let after = game.first.peer.messages.length;
  game.first.peer.send({ type: 'rematch' });
  const lobby = await game.first.peer.untilState(packet => packet.state.phase === 'lobby', { after });
  assertPrivate(lobby, game.room.state, 0);
  assert.deepEqual(lobby.state.scores, [0, 0]);
  after = game.first.peer.messages.length;
  game.second.peer.send({ type: 'rematch' });
  const countdown = await game.first.peer.untilState(packet => packet.state.phase === 'countdown', { after });
  assertPrivate(countdown, game.room.state, 0);
});

test('21 resolves simultaneous stands and clears ready flags when both initial hands are already 21', async t => {
  const game = await table(t, 'twenty-one');
  await begin(game);
  if (game.room.state.phase === 'fight') {
    const after = game.first.peer.messages.length, secondAfter = game.second.peer.messages.length;
    if (!game.room.state.stood[0]) game.first.peer.send({ type: 'card-action', action: { kind: 'stand' } });
    if (!game.room.state.stood[1]) game.second.peer.send({ type: 'card-action', action: { kind: 'stand' } });
    await game.first.peer.untilState(packet => packet.state.phase === 'roundEnd', { after });
    await flushPeer(game.second.peer);
    assert.equal(game.first.peer.messages.slice(after).some(packet => packet.type === 'error'), false);
    assert.equal(game.second.peer.messages.slice(secondAfter).some(packet => packet.type === 'error'), false);
  }
  // Exercise the countdown shortcut without depending on a rare random deal.
  game.room.adapter.engine.resetLobby(game.room.state);
  game.room.players.forEach(player => { player.ready = false; });
  game.app.broadcast(game.room);
  const after = game.first.peer.messages.length;
  game.first.peer.send({ type: 'ready', ready: true });
  game.second.peer.send({ type: 'ready', ready: true });
  await game.first.peer.untilState(packet => packet.state.phase === 'countdown', { after });
  game.room.state.hands = [[{ id: 'c0', rank: 1, suit: 0 }, { id: 'c9', rank: 10, suit: 0 }], [{ id: 'c13', rank: 1, suit: 1 }, { id: 'c22', rank: 10, suit: 1 }]];
  game.room.state.stood = [true, true];
  game.room.state.phaseTicks = 1;
  const start = game.first.peer.messages.length;
  game.app.tick();
  const showdown = await game.first.peer.untilState(packet => packet.state.phase === 'roundEnd', { after: start });
  assert.deepEqual(showdown.state.totals, [21, 21]);
  assert.equal(showdown.players.some(player => player.ready), false);
  assertPrivate(showdown, game.room.state, 0);
});

test('Memory routes flips by player and only reveals selected or matched cards', async t => {
  const game = await table(t, 'memory');
  await begin(game);
  const wrong = await action(game.second.peer, { kind: 'flip', index: 0 });
  assert.ok(wrong.some(packet => packet.type === 'error'));
  const first = await action(game.first.peer, { kind: 'flip', index: 0 });
  assertPrivate(first.find(packet => packet.type === 'state'), game.room.state, 0);
  const other = game.room.state.board.findIndex((card, index) => index !== 0 && (card.rank !== game.room.state.board[0].rank || card.suit !== game.room.state.board[0].suit));
  const second = await action(game.first.peer, { kind: 'flip', index: other });
  assertPrivate(second.find(packet => packet.type === 'state'), game.room.state, 0);
  assert.equal(game.room.state.mismatchTicks, 120);
  const after = game.first.peer.messages.length;
  for (let tick = 0; tick < 120; tick++) game.app.tick();
  const hidden = await game.first.peer.untilState(packet => packet.state.turn === 1 && packet.state.revealed.length === 0, { after });
  assertPrivate(hidden, game.room.state, 0);
  assert.ok(hidden.state.cards.every(card => card === null));
});

test('idle card tables broadcast a 10 Hz heartbeat and health lists all seven games', async t => {
  const game = await table(t, 'memory');
  const health = await (await fetch(`${game.origin}/health`)).json();
  assert.deepEqual(new Set(health.games), new Set(['afterimage', 'checkers', 'relic-duel', 'dungeon-run', ...GAME_IDS]));
  const after = game.first.peer.messages.length;
  for (let tick = 0; tick < 120; tick++) game.app.tick();
  await flushPeer(game.first.peer);
  const states = game.first.peer.messages.slice(after).filter(packet => packet.type === 'state');
  assert.equal(states.length, 10);
  assert.equal(states.at(-1).state.tick, 120);
  assert.ok(states.every(packet => packet.state.cards.every(card => card === null)));
});
