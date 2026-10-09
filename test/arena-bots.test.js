import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaBotController, arenaBotInput, ARENA_BOT_DIFFICULTIES } from '../public/arena-bots.js';
import * as relic from '../public/topdown-engine.js';
import * as vector from '../public/vector-engine.js';
import * as brawl from '../public/brawl-engine.js';

const engines = [['relic-duel', relic], ['vector-arena', vector], ['oddstock-rumble', brawl]];
function fight(id, engine, character = 'sprout', stage = 'rooftop', human = 'wrench') {
  const state = engine.createState();
  if (id === 'oddstock-rumble') { engine.select(state, 0, { character: human, stage }); engine.select(state, 1, { character }); }
  engine.startMatch(state);
  for (let ticks = 0; state.phase === 'countdown' && ticks < 400; ticks++) engine.step(state);
  assert.equal(state.phase, 'fight');
  return state;
}
function collect(state, engine, bot, ticks, human = () => engine.emptyInput()) {
  const events = [];
  for (let index = 0; index < ticks && state.phase !== 'matchEnd'; index++) {
    const last = state.eventId;
    engine.step(state, [human(state), bot.input(state)]);
    events.push(...state.events.filter(event => event.id > last));
  }
  return events;
}
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

for (const [id, engine] of engines) {
  test(`${id}: legal deterministic inputs without mutating or inspecting the human's controls`, () => {
    const state = fight(id, engine), a = createArenaBotController(id), b = createArenaBotController(id);
    Object.defineProperty(state.fighters[0], 'previousInput', { get() { throw new Error('A bot cannot read the human input.'); }, configurable: true });
    Object.defineProperty(state.fighters[0], 'buffers', { get() { throw new Error('A bot cannot read an opponent action buffer.'); }, configurable: true });
    // Deliberately serialize only the visible/state fields: the guarded accessors
    // above prove the controller never peeks at pending player commands.
    const snapshot = { ...state, fighters: state.fighters.map(f => Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(f)).filter(([, d]) => 'value' in d).map(([key, d]) => [key, d.value]))) };
    freeze(snapshot);
    for (let tick = state.tick; tick < state.tick + 90; tick++) {
      const view = { ...snapshot, tick, fighters: [state.fighters[0], snapshot.fighters[1]] };
      const before = structuredClone(snapshot);
      const first = a.input(view), second = b.input(view);
      assert.deepEqual(first, second);
      assert.deepEqual(snapshot, before);
      assert.deepEqual(Object.keys(first).sort(), Object.keys(engine.emptyInput()).sort());
      for (const key of engine.INPUT_KEYS) assert.equal(typeof first[key], 'boolean');
      if (id === 'vector-arena') { assert.ok(Number.isFinite(first.aimX) && Number.isFinite(first.aimY)); assert.ok(Math.abs(Math.hypot(first.aimX, first.aimY) - 1) < 1e-8); }
      assert.equal(first.left && first.right, false);
      assert.equal(first.up && first.down, false);
      assert.deepEqual(a.input(view), first, 'Multiple renders of one tick cannot create a new action.');
      first.attack = !first.attack;
      assert.deepEqual(a.input(view), second, 'Returned input does not expose held controller state.');
    }
  });

  test(`${id}: reaction window and lifecycle reset never replay a stale attack`, () => {
    const state = fight(id, engine), bot = createArenaBotController(id), start = state.tick;
    for (let tick = start; tick < start + ARENA_BOT_DIFFICULTIES.hard.reaction; tick++) { state.tick = tick; assert.deepEqual(bot.input(state), engine.emptyInput()); }
    state.tick = start + 30;
    bot.input(state);
    state.phase = 'matchEnd'; assert.deepEqual(bot.input(state), engine.emptyInput());
    state.phase = 'fight'; state.tick += 1; assert.deepEqual(bot.input(state), engine.emptyInput());
    state.tick = 0; assert.deepEqual(bot.input(state), engine.emptyInput());
    bot.reset(); assert.deepEqual(bot.input(state), engine.emptyInput());
  });

  test(`${id}: a real engine match rewards accepted bot attacks rather than direct damage`, () => {
    const state = fight(id, engine), bot = createArenaBotController(id);
    const events = collect(state, engine, bot, 6500);
    assert.equal(state.phase, 'matchEnd');
    assert.equal(state.winner, 1);
    assert.ok(events.some(event => event.type === 'hit' && event.fighter === 1));
    if (id === 'relic-duel') { assert.ok(events.some(event => event.type === 'swing' && event.fighter === 1)); assert.ok(events.some(event => event.type === 'shoot' && event.fighter === 1)); }
    if (id === 'vector-arena') { assert.ok(events.some(event => event.type === 'reloaded' && event.fighter === 1)); assert.ok(events.some(event => event.type === 'fire' && event.fighter === 1)); }
    if (id === 'oddstock-rumble') { assert.equal(state.fighters[0].stocks, 0); assert.ok(events.some(event => event.type === 'move' && event.fighter === 1)); }
  });
}

test('Delayed aim does not track a new direction or predict unread player inputs', () => {
  const state = fight('vector-arena', vector), bot = createArenaBotController('vector-arena');
  const start = state.tick;
  state.obstacles = []; Object.assign(state.fighters[1], { x: 480, y: 320 }); Object.assign(state.fighters[0], { x: 230, y: 320, vx: 0, vy: 0 });
  for (let tick = start; tick <= start + 14; tick++) { state.tick = tick; bot.input(state); }
  assert.ok(bot.input(state).aimX < -.98);
  Object.assign(state.fighters[0], { x: 740, y: 320, vx: 0, vy: 0 });
  for (let tick = start + 15; tick < start + 29; tick++) { state.tick = tick; assert.ok(bot.input(state).aimX < -.98, 'A newly visible change cannot bypass the reaction delay.'); }
  for (let tick = start + 29; tick < start + 39; tick++) { state.tick = tick; bot.input(state); }
  assert.ok(bot.input(state).aimX > .98);
});

test('Difficulty changes actual delayed observation, and expert still has a reaction window', () => {
  for (const [difficulty, profile] of Object.entries(ARENA_BOT_DIFFICULTIES)) {
    const state = fight('vector-arena', vector), bot = createArenaBotController('vector-arena', 1, difficulty), start = state.tick;
    for (let tick = start; tick < start + profile.reaction; tick++) { state.tick = tick; assert.deepEqual(bot.input(state), vector.emptyInput()); }
    state.tick += 1; assert.notDeepEqual(bot.input(state), vector.emptyInput());
    assert.ok(profile.reaction >= 10); assert.ok(profile.aimError > 0); assert.ok(profile.defend < 1);
  }
});

test('Relic routes around a pillar and damages through its real sword/bow contacts', () => {
  const state = fight('relic-duel', relic), bot = createArenaBotController('relic-duel');
  Object.assign(state.fighters[0], { x: 230, y: 215 }); Object.assign(state.fighters[1], { x: 390, y: 215 });
  const hits = []; let detour = false;
  for (let tick = 0; tick < 1600 && !hits.length; tick++) {
    const last = state.eventId;
    relic.step(state, [relic.emptyInput(), bot.input(state)]);
    const self = state.fighters[1]; detour ||= Math.abs(self.y - 215) > 45;
    for (const rect of state.obstacles) {
      const dx = self.x - Math.max(rect.x, Math.min(rect.x + rect.w, self.x)), dy = self.y - Math.max(rect.y, Math.min(rect.y + rect.h, self.y));
      assert.ok(Math.hypot(dx, dy) >= self.radius - .0001, 'Routing uses legal collision movement.');
    }
    hits.push(...state.events.filter(event => event.id > last && event.type === 'hit' && event.fighter === 1));
  }
  assert.ok(detour); assert.ok(hits.length > 0);
});

test('Vector flanks Steel Relay cover and reloads under the normal engine rules', () => {
  const state = fight('vector-arena', vector), bot = createArenaBotController('vector-arena');
  state.obstacles = vector.STAGES.relay.covers.map(rect => ({ ...rect }));
  const events = collect(state, vector, bot, 2200);
  assert.ok(events.some(event => event.type === 'hit' && event.fighter === 1));
  assert.ok(events.some(event => event.type === 'fire' && event.fighter === 1 && Math.abs(event.y - 320) > 40));
  assert.ok(events.some(event => event.type === 'reloaded' && event.fighter === 1));
});

for (const stage of Object.keys(brawl.STAGES)) {
  test(`Oddstock ${stage}: every comic returns from offstage using actual jump/recovery resources`, () => {
    for (const character of Object.keys(brawl.CHARACTERS)) {
      const state = fight('oddstock-rumble', brawl, character, stage), bot = createArenaBotController('oddstock-rumble');
      const main = state.platforms.find(p => p.solid);
      Object.assign(state.fighters[1], { x: main.x - 45, y: main.y - 80, grounded: false, onPlatform: null, vx: -1, vy: 3 });
      let landed = false, jumped = false;
      for (let tick = 0; tick < 500; tick++) {
        const last = state.eventId;
        brawl.step(state, [brawl.emptyInput(), bot.input(state)]);
        const self = state.fighters[1];
        assert.equal(self.stocks, 3, character);
        assert.ok(self.jumpsLeft >= 0 && self.jumpsLeft <= brawl.CHARACTERS[character].airJumps);
        jumped ||= state.events.some(event => event.id > last && event.type === 'jump' && event.fighter === 1);
        landed ||= self.grounded && self.x > main.x && self.x < main.x + main.w;
      }
      assert.ok(jumped && landed, character);
    }
  });
}

test('Oddstock pursues elevated perches with real jumps and aerial attacks', () => {
  const state = fight('oddstock-rumble', brawl), bot = createArenaBotController('oddstock-rumble');
  Object.assign(state.fighters[0], { x: 820, y: 425 - state.fighters[0].height / 2, grounded: true, onPlatform: 'right' });
  const events = collect(state, brawl, bot, 900);
  assert.ok(events.some(event => event.type === 'jump' && event.fighter === 1));
  assert.ok(events.some(event => event.type === 'hit' && event.fighter === 1));
});

test('Oddstock drops through a perch when pursuing an opponent below', () => {
  const state = fight('oddstock-rumble', brawl), bot = createArenaBotController('oddstock-rumble');
  Object.assign(state.fighters[1], { x: 820, y: 425 - state.fighters[1].height / 2, grounded: true, onPlatform: 'right', vx: 0, vy: 0 });
  Object.assign(state.fighters[0], { x: 820, y: 580 - state.fighters[0].height / 2, grounded: true, onPlatform: 'main', vx: 0, vy: 0 });
  let dropped = false, landed = false;
  for (let tick = 0; tick < 130; tick++) {
    brawl.step(state, [brawl.emptyInput(), bot.input(state)]);
    dropped ||= state.fighters[1].dropTicks > 0;
    landed ||= dropped && state.fighters[1].onPlatform === 'main';
  }
  assert.ok(dropped && landed);
});

for (const [id, engine, defenses] of [['relic-duel', relic, ['roll', 'parry']], ['vector-arena', vector, ['dash']], ['oddstock-rumble', brawl, ['dodge']]]) {
  test(`${id}: fighting bots use accepted defenses and cannot fabricate stamina or recovery`, () => {
    const state = fight(id, engine, 'wrench', 'garden', 'sprout');
    const a = createArenaBotController(id, 0), b = createArenaBotController(id, 1);
    let defended = false;
    for (let tick = 0; tick < 6000 && state.phase !== 'matchEnd' && !defended; tick++) {
      const last = state.eventId;
      engine.step(state, [a.input(state), b.input(state)]);
      for (const self of state.fighters) {
        if (self.stamina !== undefined) assert.ok(self.stamina >= 0 && self.stamina <= 100);
        if (self.jumpsLeft !== undefined) assert.ok(self.jumpsLeft >= 0 && self.jumpsLeft <= brawl.CHARACTERS[self.characterId].airJumps);
      }
      defended ||= state.events.some(event => event.id > last && defenses.includes(event.type));
    }
    assert.ok(defended, 'Defenses must be genuine accepted engine actions.');
  });
}

test('Controllers and the convenience input keep separate seats and matches', () => {
  const a = fight('vector-arena', vector), b = fight('vector-arena', vector), start = a.tick;
  for (let tick = start; tick <= start + 14; tick++) { a.tick = tick; arenaBotInput('vector-arena', a); }
  assert.notDeepEqual(arenaBotInput('vector-arena', a), vector.emptyInput());
  assert.deepEqual(arenaBotInput('vector-arena', b), vector.emptyInput());
  assert.deepEqual(arenaBotInput('vector-arena', a, 0), vector.emptyInput());
  assert.throws(() => createArenaBotController('unsupported'), TypeError);
  assert.throws(() => createArenaBotController('relic-duel', 2), TypeError);
});
