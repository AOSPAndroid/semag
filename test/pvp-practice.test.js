import assert from 'node:assert/strict';
import test from 'node:test';
import { createPvpPractice, PVP_PRACTICE_GAME_IDS, TICK_RATE } from '../public/hub/pvp-practice.js';
import { legalMoves } from '../public/checkers-engine.js';
import { canPlay } from '../public/cards-engine.js';
import { CHARACTERS, STAGES } from '../public/brawl-engine.js';
import { WORLD as SHINOBI_WORLD } from '../public/shinobi-engine.js';

function advance(session, ticks, input = {}) {
  for (let tick = 0; tick < ticks; tick++) session.step(typeof input === 'function' ? input(session.getState()) : input);
  return session.getState();
}
function fight(gameId, settings = {}) {
  const session = createPvpPractice(gameId, { seed: 1, ...settings }); session.start();
  const countdown = session.getState().phaseTicks;
  assert.ok(countdown > 0); advance(session, countdown);
  assert.equal(session.getState().phase, 'fight'); return session;
}
function humanEights(session) {
  const state = session.getState(), playable = state.hands[0].find(card => canPlay(card, state.topCard, state.activeSuit));
  return session.action({ type: 'card-action', action: playable ? { kind: 'play', cardId: playable.id, ...(playable.rank === 8 ? { suit: 0 } : {}), revision: state.revision } : { kind: state.drawn[0] ? 'pass' : 'draw', revision: state.revision } });
}

test('all eight local games require explicit start and reset to a fresh frozen lobby', async t => {
  assert.equal(TICK_RATE, 120); assert.ok(Object.isFrozen(PVP_PRACTICE_GAME_IDS)); assert.equal(PVP_PRACTICE_GAME_IDS.length, 8);
  for (const gameId of PVP_PRACTICE_GAME_IDS) await t.test(gameId, () => {
    const session = createPvpPractice(gameId, { seed: 921 });
    assert.equal(session.getState().phase, 'lobby'); assert.equal(session.settings.difficulty, 'hard');
    assert.equal(session.settings.bots, 1); assert.ok(Object.isFrozen(session.settings));
    const waiting = JSON.stringify(session.getState()); advance(session, 100, { attack: true, fire: true, right: true });
    assert.equal(JSON.stringify(session.getState()), waiting, 'lobby is a preview, not a running bot match');
    session.start(); const countdown = session.getState().phaseTicks;
    advance(session, countdown - 1); assert.equal(session.getState().phase, 'countdown');
    session.step(); assert.equal(session.getState().phase, 'fight');
    assert.equal(session.getState().gameId, gameId);
    session.reset({ difficulty: 'normal' }); assert.equal(session.getState().phase, 'lobby');
    assert.equal(session.getState().tick, 0); assert.equal(session.settings.difficulty, 'normal');
    const reset = JSON.stringify(session.getState()); advance(session, 100); assert.equal(JSON.stringify(session.getState()), reset);
  });
});

test('invalid games/configuration never replace a live session or admit unsupported extra seats', () => {
  for (const gameId of ['__proto__', 'afterimage', 'voxel-breach', 'dungeon-run']) assert.throws(() => createPvpPractice(gameId), RangeError);
  const session = fight('oddstock-rumble');
  for (const options of [null, [], { seed: NaN }, { seed: -1 }, { seed: 4294967296 }, { bots: 2 }, { difficulty: '__proto__' }, { character: '__proto__' }, { stageId: 'missing' }, { botCharacter: 'missing' }]) {
    const before = session.getState(), settings = session.settings;
    assert.throws(() => session.start(options)); assert.equal(session.getState(), before); assert.equal(session.settings, settings);
  }
  for (const options of [{ bots: 0 }, { bots: 5 }, { bots: 1.5 }, { stageId: '__proto__' }]) assert.throws(() => createPvpPractice('shinobi-showdown', options), RangeError);
});

test('card snapshots never expose authority, and modifying a returned human view cannot change the match', () => {
  for (const gameId of ['crazy-eights', 'twenty-one', 'memory']) {
    const session = fight(gameId), view = session.getState();
    for (const key of ['deck', 'discard', 'board']) assert.equal(Object.hasOwn(view, key), false, `${gameId}: private ${key}`);
    if (gameId === 'memory') assert.ok(view.cards.every(card => card === null));
    else assert.ok(view.hands[1].every(card => card === null));
    const before = JSON.stringify(session.getState());
    view.scores[0] = 99; if (view.hands) view.hands[0][0].rank = 99; else view.cards[0] = { id: 'forged', rank: 1, suit: 1 };
    assert.equal(JSON.stringify(session.getState()), before);
    assert.equal(session.action({ type: 'move', from: 0, to: 1 }).ok, false);
    assert.equal(JSON.stringify(session.getState()), before);
  }
});

test('seeded live card engines retain identical deals and subsequent bot/round decisions', () => {
  for (const gameId of ['crazy-eights', 'twenty-one', 'memory']) {
    const sessions = [fight(gameId, { seed: 2731 }), fight(gameId, { seed: 2731 })];
    for (const session of sessions) {
      if (gameId === 'crazy-eights') { while (session.getState().turn === 0) assert.equal(humanEights(session).ok, true); }
      else if (gameId === 'twenty-one') { if (!session.getState().stood[0]) assert.equal(session.action({ type: 'card-action', action: { kind: 'stand', round: 1 } }).ok, true); }
      else for (const index of [0, 1]) assert.equal(session.action({ type: 'card-action', action: { kind: 'flip', index } }).ok, true);
      advance(session, 1000);
    }
    assert.deepEqual(sessions[0].getState(), sessions[1].getState());
    for (const session of sessions) { session.reset(); session.start(); advance(session, 240); }
    assert.deepEqual(sessions[0].getState(), sessions[1].getState());
  }
});

test('checkers uses legal human and delayed CPU moves and ignores forged seat identity', () => {
  const session = fight('checkers'), state = session.getState(), first = legalMoves(state, 0)[0];
  assert.equal(session.action({ type: 'move', from: first.from, to: first.to, playerId: 1 }).ok, true);
  assert.equal(state.lastMove.playerId, 0); const candidates = legalMoves(state, 1), before = JSON.stringify(state.board);
  advance(session, 59); assert.equal(JSON.stringify(state.board), before); assert.equal(state.turn, 1);
  session.step(); assert.equal(state.lastMove.playerId, 1); assert.equal(state.turn, 0);
  assert.ok(candidates.some(move => move.from === state.lastMove.from && move.to === state.lastMove.to));
  const committed = JSON.stringify(state);
  assert.equal(session.action({ type: 'move', from: 0, to: 63 }).ok, false); assert.equal(JSON.stringify(state), committed);
});

test('CPU forced captures remain legal, retain its turn, and receive a fresh delay between jumps', () => {
  const session = fight('checkers'), state = session.getState();
  state.board.fill(null); state.board[17] = { owner: 1, king: false };
  for (const square of [26, 44, 56]) state.board[square] = { owner: 0, king: false };
  state.turn = 1; state.forcedFrom = null; state.positionCounts = {};
  advance(session, 60); assert.equal(state.lastMove.from, 17); assert.equal(state.lastMove.to, 35); assert.equal(state.lastMove.capture, 26);
  assert.equal(state.forcedFrom, 35); assert.equal(state.turn, 1);
  advance(session, 59); assert.equal(state.lastMove.to, 35);
  session.step(); assert.equal(state.lastMove.from, 35); assert.equal(state.lastMove.to, 53); assert.equal(state.lastMove.capture, 44);
  assert.equal(state.forcedFrom, null); assert.equal(state.turn, 0); assert.equal(state.board[53].owner, 1);
});

test('Crazy Eights routes legal human cards and permits only a delayed real CPU play/draw', () => {
  const session = fight('crazy-eights');
  while (session.getState().turn === 0) assert.equal(humanEights(session).ok, true);
  const before = session.getState(); advance(session, 59); assert.equal(session.getState().revision, before.revision);
  session.step(); const after = session.getState(); assert.equal(after.revision, before.revision + 1);
  assert.ok(after.turn === 0 || after.drawn[1], 'CPU must actually play or draw through card rules');
  assert.ok(after.hands[1].every(card => card === null));
  const accepted = JSON.stringify(after);
  assert.equal(session.action({ type: 'card-action', action: { kind: 'play', cardId: 'invented' } }).ok, false);
  assert.equal(JSON.stringify(session.getState()), accepted);
});

test('Memory observes actual human reveals, waits through mismatches, and then recalls a visible mate', () => {
  const session = fight('memory', { seed: 41, difficulty: 'hard' });
  for (const index of [0, 1]) assert.equal(session.action({ type: 'card-action', action: { kind: 'flip', index } }).ok, true);
  const faces = session.getState().cards;
  assert.notEqual(`${faces[0].rank}:${faces[0].suit}`, `${faces[1].rank}:${faces[1].suit}`);
  advance(session, 119); assert.deepEqual(session.getState().revealed, [0, 1]); assert.equal(session.getState().turn, 0);
  session.step(); assert.equal(session.getState().turn, 1); assert.deepEqual(session.getState().revealed, []);
  advance(session, 59); assert.deepEqual(session.getState().revealed, []);
  session.step(); const first = session.getState(); assert.deepEqual(first.revealed, [2]);
  assert.deepEqual([first.cards[2].rank, first.cards[2].suit], [faces[1].rank, faces[1].suit]);
  advance(session, 59); assert.deepEqual(session.getState().revealed, [2]);
  session.step(); const matched = session.getState();
  assert.equal(matched.matched[1], 1); assert.equal(matched.matched[2], 1); assert.equal(matched.scores[1], 1);
  assert.equal(matched.turn, 1); assert.deepEqual(matched.revealed, []);
  session.reset(); assert.ok(session.getState().cards.every(card => card === null));
});

test('21 allows a concurrent human choice without restarting the CPU delay or exposing its hand', () => {
  const session = fight('twenty-one', { seed: 1 }), initial = session.getState();
  assert.deepEqual(initial.stood, [false, false]); advance(session, 59);
  assert.equal(session.action({ type: 'card-action', action: { kind: 'stand', round: 1 } }).ok, true);
  const human = session.getState(); assert.equal(human.revision, initial.revision + 1);
  session.step(); const bot = session.getState();
  assert.equal(bot.revision, human.revision + 1); assert.equal(bot.handCounts[1], initial.handCounts[1] + 1);
  assert.equal(bot.stood[0], true); assert.ok(bot.hands[1].every(card => card === null));
  advance(session, 60); assert.equal(session.getState().phase, 'roundEnd');
  assert.ok(session.getState().hands[1].every(Boolean), 'finished hands reveal through the real rules');
  advance(session, session.getState().phaseTicks); assert.equal(session.getState().round, 2);
  const current = JSON.stringify(session.getState());
  assert.equal(session.action({ type: 'card-action', action: { kind: 'hit', round: 1 } }).ok, false);
  assert.equal(JSON.stringify(session.getState()), current);
});

test('a complete actual five-hand match can restart with clean scores, clocks and private hands', () => {
  const session = fight('twenty-one', { seed: 3 }); const rounds = new Set();
  for (let ticks = 0; ticks < 5000 && session.getState().phase !== 'matchEnd'; ticks++) {
    const state = session.getState(); rounds.add(state.round);
    if (state.phase === 'fight' && !state.stood[0]) assert.equal(session.action({ type: 'card-action', action: { kind: 'stand', round: state.round } }).ok, true);
    session.step();
  }
  assert.equal(session.getState().phase, 'matchEnd'); assert.equal(rounds.size, 5);
  const finished = JSON.stringify(session.getState()); advance(session, 100); assert.equal(JSON.stringify(session.getState()), finished);
  session.start(); assert.equal(session.getState().phase, 'countdown'); assert.equal(session.getState().tick, 0);
  assert.equal(session.getState().round, 1); assert.deepEqual(session.getState().scores, [0, 0]);
  assert.ok(session.getState().hands[1].every(card => card === null));
});

test('Oddstock uses genuine selections, keeps the human comic/stage on restart, and varies valid CPU comics', () => {
  const session = createPvpPractice('oddstock-rumble', { seed: 29 });
  assert.equal(session.action({ type: 'brawl-select', character: 'sprout', stage: 'foundry' }).ok, true);
  const setup = session.getState(); assert.equal(setup.fighters[0].selected, true); assert.equal(setup.stageSelected, true);
  assert.equal(session.settings.character, 'sprout'); assert.equal(session.settings.stageId, 'foundry');
  session.start({ difficulty: 'expert' }); let state = session.getState();
  assert.equal(state.phase, 'countdown'); assert.equal(state.fighters[0].characterId, 'sprout'); assert.equal(state.stageId, 'foundry');
  assert.ok(Object.hasOwn(CHARACTERS, state.fighters[1].characterId)); assert.ok(state.fighters[1].selected);
  const firstOpponent = state.fighters[1].characterId;
  assert.deepEqual(state.platforms, STAGES.foundry.platforms);
  assert.equal(session.action({ type: 'brawl-select', character: 'bulk' }).ok, false);
  advance(session, state.phaseTicks + 30); session.reset(); state = session.getState();
  assert.equal(state.phase, 'lobby'); assert.equal(state.fighters[0].characterId, 'sprout'); assert.equal(state.stageId, 'foundry');
  session.start(); assert.equal(session.getState().fighters[0].characterId, 'sprout');
  assert.equal(session.getState().fighters[1].characterId, firstOpponent, 'same seed retains a repeatable matchup');
  session.start({ seed: 2 }); assert.notEqual(session.getState().fighters[1].characterId, firstOpponent);
  assert.equal(session.getState().fighters[0].characterId, 'sprout'); assert.equal(session.getState().stageId, 'foundry');
  const choices = new Set(Array.from({ length: 6 }, (_, seed) => createPvpPractice('oddstock-rumble', { seed }).getState().fighters[1].characterId));
  assert.ok(choices.size >= 4); assert.ok([...choices].every(id => Object.hasOwn(CHARACTERS, id)));
});

test('the three real arena engines accept bot movement and combat rather than synthetic damage', () => {
  for (const gameId of ['relic-duel', 'vector-arena', 'oddstock-rumble']) {
    const session = fight(gameId, { seed: 9 }), state = session.getState(), human = state.fighters[0], bot = state.fighters[1];
    const origin = { x: bot.x, y: bot.y };
    for (let tick = 0; tick < 1500 && state.phase === 'fight'; tick++) session.step();
    assert.ok(Math.hypot(bot.x - origin.x, bot.y - origin.y) > 10, `${gameId}: CPU never moved`);
    assert.ok(human.hp < human.maxHp || human.stocks < 3 || human.damage > 0, `${gameId}: no actual accepted hit`);
    assert.ok(state.events.some(event => event.type === 'hit'), `${gameId}: no real combat event`);
    assert.equal(session.action({ type: 'card-action', action: { kind: 'stand' } }).ok, false);
    session.start(); assert.equal(session.getState().phase, 'countdown'); assert.equal(session.getState().fighters[1].id, 1);
  }
});

test('Shinobi practice delegates one or four real opponents with persistent selected stage and clean restart', () => {
  for (const bots of [1, 4]) {
    const session = fight('shinobi-showdown', { bots, stageId: 'garden', difficulty: 'expert', seed: 711 });
    const state = session.getState(); assert.equal(state.fighters.length, bots + 1); assert.equal(state.fighters[0].team, 0);
    assert.ok(state.fighters.slice(1).every(f => f.bot === true && f.team === 1));
    assert.equal(state.stageId, 'garden'); assert.equal(state.practice.bots, bots);
    assert.deepEqual(state.fighters.map(fighter => fighter.id), Array.from({ length: bots + 1 }, (_, id) => id));
    const human = state.fighters[0], origin = state.fighters.slice(1).map(f => ({ x: f.x, y: f.y }));
    for (let tick = 0; tick < 1000 && state.phase === 'fight'; tick++) session.step();
    assert.ok(state.fighters.slice(1).some((fighter, index) => Math.hypot(fighter.x - origin[index].x, fighter.y - origin[index].y) > 40));
    assert.ok(human.hp < human.maxHp); assert.ok(state.events.some(event => event.type === 'hit'));
    for (const fighter of state.fighters) {
      assert.ok(fighter.x >= SHINOBI_WORLD.minX - 1e-6 && fighter.x <= SHINOBI_WORLD.maxX + 1e-6);
      assert.ok(fighter.y >= SHINOBI_WORLD.minY - 1e-6 && fighter.y <= SHINOBI_WORLD.maxY + 1e-6);
    }
    session.start(); assert.equal(session.getState().phase, 'countdown'); assert.equal(session.getState().stageId, 'garden');
    assert.equal(session.getState().fighters.length, bots + 1); assert.ok(session.getState().fighters.every(f => f.hp === f.maxHp));
  }
});
