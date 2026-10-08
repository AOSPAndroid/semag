import assert from 'node:assert/strict';
import test from 'node:test';
import * as afterimage from '../public/engine.js';
import * as vector from '../public/vector-engine.js';
import * as relic from '../public/topdown-engine.js';

const EPS = 1e-6;
function fighting(engine, mode) {
  const state = engine.createState(mode);
  engine.startMatch(state); state.phaseTicks = 1; engine.step(state);
  return state;
}
function pose(state, positions) {
  return state.fighters.map(f => ({ ...f, ...positions[f.id] }));
}
function nearestGap(f, rect) {
  return Math.hypot(f.x - Math.max(rect.x, Math.min(f.x, rect.x + rect.w)), f.y - Math.max(rect.y, Math.min(f.y, rect.y + rect.h)));
}
function legalTopdown(engine, state, pair, bodies = true) {
  const bounds = engine.WORLD || engine.ARENA;
  for (const f of pair) {
    assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
    assert.ok(f.x >= bounds.minX - EPS && f.x <= bounds.maxX + EPS);
    assert.ok(f.y >= bounds.minY - EPS && f.y <= bounds.maxY + EPS);
    for (const rect of state.obstacles) assert.ok(nearestGap(f, rect) >= f.radius - EPS, `inside ${rect.id}`);
  }
  if (bodies) assert.ok(Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y) >= pair[0].radius + pair[1].radius - EPS);
}
function nextDuelRound(engine, state) {
  state.phase = 'roundEnd'; state.phaseTicks = 1;
  state.fighters.forEach(f => { f.wins = 0; });
  engine.step(state); state.phaseTicks = 1; engine.step(state);
}

for (const [name, engine] of [['Vector', vector], ['Relic', relic]]) {
  test(`${name} presentation uses each authored duel stage's real cover faces and rounded corners`, () => {
    const state = fighting(engine);
    for (let round = 0; round < 3; round++) {
      for (const rect of state.obstacles) {
        const [a, b] = state.fighters;
        Object.assign(a, { x: rect.x - a.radius - 1, y: rect.y + rect.h / 2 });
        Object.assign(b, { x: 850, y: 550 });
        const displayed = engine.sweepPresentationFighters(state, pose(state, { 0: { x: a.x + 100 }, 1: {} }));
        legalTopdown(engine, state, displayed);
        assert.ok(Math.abs(displayed[0].x - (rect.x - a.radius)) < EPS, 'correction cannot tunnel to the opposite face');
        const retreat = engine.sweepPresentationFighters({ ...state, fighters: displayed }, pose({ fighters: displayed }, { 0: { x: displayed[0].x - 12 }, 1: {} }));
        assert.ok(Math.abs(retreat[0].x - (displayed[0].x - 12)) < EPS, 'touching cover does not trap a retreat');
        Object.assign(a, { x: rect.x - a.radius - 1, y: rect.y - a.radius + .5 });
        const corner = engine.sweepPresentationFighters(state, pose(state, { 0: { x: a.x + 8 }, 1: {} }));
        legalTopdown(engine, state, corner);
        assert.ok(corner[0].x > rect.x - a.radius, 'true circular corner stays usable');
      }
      if (round < 2) nextDuelRound(engine, state);
    }
  });

  test(`${name} presentation keeps a local anchor still while delayed opponents press into it`, () => {
    for (const anchorId of [0, 1]) {
      const state = fighting(engine), [a, b] = state.fighters;
      Object.assign(a, { x: 460, y: 320 }); Object.assign(b, { x: 500, y: 320 });
      const positions = anchorId === 0 ? { 0: {}, 1: { x: 440 } } : { 0: { x: 520 }, 1: {} };
      const displayed = engine.sweepPresentationFighters(state, pose(state, positions), { anchorId });
      legalTopdown(engine, state, displayed);
      assert.equal(displayed[anchorId].x, state.fighters[anchorId].x);
      assert.equal(displayed[anchorId].y, state.fighters[anchorId].y);
    }
  });

  test(`${name} presentation preserves local tangential movement and free retreat at body contact`, () => {
    const state = fighting(engine), [a, b] = state.fighters;
    Object.assign(a, { x: 450, y: 320 }); Object.assign(b, { x: 450 + a.radius + b.radius, y: 320 });
    const displayed = engine.sweepPresentationFighters(state, pose(state, { 0: { y: 332 }, 1: { x: b.x - 12 } }), { anchorId: 0 });
    legalTopdown(engine, state, displayed);
    assert.ok(Math.abs(displayed[0].y - 332) < EPS);
    const retreat = engine.sweepPresentationFighters(state, pose(state, { 0: { x: a.x - 24 }, 1: {} }), { anchorId: 0 });
    assert.ok(Math.abs(retreat[0].x - (a.x - 24)) < EPS);
  });

  test(`${name} pinned body contact stays legal at the outer wall and each authored cover`, () => {
    const state = fighting(engine), bounds = engine.WORLD || engine.ARENA;
    const cases = [{ x: bounds.minX, y: 320 }, ...state.obstacles.map(rect => ({ x: rect.x - state.fighters[0].radius, y: rect.y + rect.h / 2 }))];
    for (const point of cases) {
      const [a, b] = state.fighters;
      Object.assign(a, point); Object.assign(b, { x: point.x + a.radius + b.radius + 1, y: point.y });
      // Cover on the anchor's right would make this base invalid; approach its left face instead.
      const atWall = point.x === bounds.minX;
      if (!atWall) b.x = point.x - a.radius - b.radius - 1;
      const displayed = engine.sweepPresentationFighters(state, pose(state, { 0: {}, 1: { x: b.x + (atWall ? -24 : 24) } }), { anchorId: 0 });
      legalTopdown(engine, state, displayed);
      assert.ok(Math.abs(displayed[0].x - a.x) < EPS);
    }
  });
}

for (const [name, engine] of [['Afterimage', afterimage], ['Vector', vector], ['Relic', relic]]) {
  test(`${name} projection preserves caller order, metadata and the entire authoritative state`, () => {
    const state = fighting(engine), before = structuredClone(state);
    const desired = pose(state, { 0: { x: state.fighters[0].x + .75, presentationTag: 'local' }, 1: { y: state.fighters[1].y - .5, presentationTag: 'remote' } }).reverse();
    const requested = structuredClone(desired);
    const displayed = engine.sweepPresentationFighters(state, desired, { anchorId: 0 });
    assert.deepEqual(state, before); assert.deepEqual(desired, requested);
    assert.deepEqual(displayed.map(f => f.id), [1, 0]);
    for (let index = 0; index < displayed.length; index++) {
      const { x, y, ...metadata } = displayed[index], { x: originalX, y: originalY, ...original } = desired[index];
      assert.deepEqual(metadata, original);
      assert.notEqual(displayed[index], desired[index]);
    }
  });

  test(`${name} invalid, teleport, round reset and death poses do not interpolate from stale coordinates`, () => {
    const state = fighting(engine), base = state.fighters[0];
    for (const change of [{ x: Infinity }, { y: NaN }, { x: base.x + 129 }, { x: base.x + 30, hp: 0 }, { x: base.x + 30, wins: base.wins + 1 }]) {
      const displayed = engine.sweepPresentationFighters(state, pose(state, { 0: change, 1: {} }));
      assert.equal(displayed[0].x, base.x); assert.equal(displayed[0].y, base.y);
    }
    for (const phase of ['lobby', 'countdown', 'roundEnd', 'matchEnd']) {
      const displayed = engine.sweepPresentationFighters({ ...state, phase }, pose(state, { 0: { x: base.x + 24 }, 1: {} }));
      assert.equal(displayed[0].x, base.x); assert.equal(displayed[0].y, base.y);
    }
    const dead = structuredClone(state); dead.fighters[0].hp = 0;
    const revived = engine.sweepPresentationFighters(dead, pose(dead, { 0: { x: base.x + 30, hp: 100 }, 1: {} }));
    assert.equal(revived[0].x, dead.fighters[0].x);
  });
}

test('Afterimage display contact respects ground bodies, arena walls and floor without changing airborne context', () => {
  const state = fighting(afterimage), [a, b] = state.fighters;
  Object.assign(a, { x: 500, y: afterimage.ARENA.floor }); Object.assign(b, { x: 550, y: afterimage.ARENA.floor });
  const contact = afterimage.sweepPresentationFighters(state, pose(state, { 0: {}, 1: { x: 460 } }), { anchorId: 0 });
  assert.equal(contact[0].x, 500); assert.ok(contact[1].x >= 544 - EPS);
  const ceiling = afterimage.sweepPresentationFighters(state, pose(state, { 0: { y: a.y + 50 }, 1: {} }));
  assert.equal(ceiling[0].y, afterimage.ARENA.floor);
  const wall = structuredClone(state); wall.fighters[0].x = afterimage.ARENA.minX + 1;
  const edge = afterimage.sweepPresentationFighters(wall, pose(wall, { 0: { x: afterimage.ARENA.minX - 40 }, 1: {} }));
  assert.equal(edge[0].x, afterimage.ARENA.minX);
  const airborne = structuredClone(state); airborne.fighters[0].y -= 100;
  const cross = afterimage.sweepPresentationFighters(airborne, pose(airborne, { 0: { x: 620, y: a.y - 90 }, 1: {} }), { anchorId: 0 });
  assert.ok(Math.abs(cross[0].x - 620) < EPS); assert.ok(Math.abs(cross[0].y - (a.y - 90)) < EPS);
  assert.equal(cross[0].action, airborne.fighters[0].action);
});

test('Relic rolling and downed actors retain their existing pass-through rules', () => {
  for (const kind of ['roll', 'downed']) {
    const state = fighting(relic), [a, b] = state.fighters;
    Object.assign(a, { x: 450, y: 320 }); Object.assign(b, { x: 485, y: 320 });
    if (kind === 'roll') a.action = 'roll'; else Object.assign(a, { hp: 0, downed: true, action: 'dead' });
    const displayed = relic.sweepPresentationFighters(state, pose(state, { 0: { x: 510 }, 1: {} }), { anchorId: 0 });
    assert.ok(Math.abs(displayed[0].x - 510) < EPS, kind);
    assert.equal(displayed[0].action, a.action); assert.equal(displayed[0].downed, a.downed);
  }
});

test('Dungeon projection honors all nine authored rooms and room-break reset boundaries', () => {
  const state = fighting(relic, 'coop');
  for (let wave = 1; wave <= 9; wave++) {
    assert.equal(state.wave, wave);
    const enemies = state.enemies;
    state.enemies = [];
    for (const rect of state.obstacles) {
      const [a, b] = state.fighters;
      Object.assign(a, { x: rect.x - a.radius - 1, y: rect.y + rect.h / 2 }); Object.assign(b, { x: 850, y: 550 });
      const displayed = relic.sweepPresentationFighters(state, pose(state, { 0: { x: a.x + 100 }, 1: {} }));
      legalTopdown(relic, state, displayed);
      assert.ok(Math.abs(displayed[0].x - (rect.x - a.radius)) < EPS);
    }
    state.enemies = enemies;
    if (wave === 9) break;
    for (const enemy of enemies) enemy.hp = 0;
    relic.step(state);
    assert.equal(state.roomBreak, true);
    const frozen = relic.sweepPresentationFighters(state, pose(state, { 0: { x: state.fighters[0].x + 20 }, 1: {} }));
    assert.equal(frozen[0].x, state.fighters[0].x);
    for (const id of [0, 1]) relic.chooseBoon(state, id, state.shrineChoices[0].id);
    state.waveDelay = 1; relic.step(state);
  }
});

test('Dungeon latest enemy bodies remain fixed while player display offsets respect contact', () => {
  const state = fighting(relic, 'coop'), enemy = state.enemies[0];
  Object.assign(state.fighters[0], { x: 450, y: 320 }); Object.assign(state.fighters[1], { x: 800, y: 550 });
  Object.assign(enemy, { x: 500, y: 320, hp: 40, action: 'idle' });
  state.enemies = [enemy];
  const before = structuredClone(state);
  const displayed = relic.sweepPresentationFighters(state, pose(state, { 0: { x: 535 }, 1: {} }), { anchorId: 0 });
  assert.ok(Math.hypot(displayed[0].x - enemy.x, displayed[0].y - enemy.y) >= displayed[0].radius + enemy.radius - EPS);
  assert.ok(displayed[0].x < enemy.x);
  assert.deepEqual(state, before);
});

function legalRelicScene(state, displayed) {
  const actors = [...displayed.fighters, ...displayed.enemies];
  for (const f of actors) {
    assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
    for (const rect of state.obstacles) assert.ok(nearestGap(f, rect) >= f.radius - EPS, `${f.id} inside ${rect.id}`);
  }
  for (let i = 0; i < actors.length; i++) for (let j = i + 1; j < actors.length; j++) {
    const a = actors[i], b = actors[j];
    if (a.hp <= 0 || a.downed || b.hp <= 0 || b.downed || a.action === 'roll' || b.action === 'roll') continue;
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - EPS, `${a.id}/${b.id} display contact overlap`);
  }
}

test('Dungeon scene projection keeps enemy interpolation chords outside actual pillar corners', () => {
  const state = fighting(relic, 'coop'), enemy = state.enemies[0], rect = state.obstacles[0];
  state.enemies = [enemy];
  Object.assign(state.fighters[0], { x: 420, y: 514 }); Object.assign(state.fighters[1], { x: 540, y: 514 });
  Object.assign(enemy, { x: rect.x - enemy.radius, y: rect.y + enemy.radius });
  const target = { x: rect.x + enemy.radius, y: rect.y - enemy.radius };
  for (const fraction of [0, .1, .25, .5, .75, .9, 1]) {
    const desired = { ...state, enemies: [{ ...enemy, x: enemy.x + (target.x - enemy.x) * fraction, y: enemy.y + (target.y - enemy.y) * fraction }] };
    const displayed = relic.sweepPresentationScene(state, desired, { anchorId: 0 });
    legalRelicScene(state, displayed);
    assert.equal(displayed.fighters[0].x, state.fighters[0].x);
    assert.equal(displayed.fighters[0].y, state.fighters[0].y);
  }
});

test('Dungeon displayed enemies and players resolve relative closing contact without moving the local anchor', () => {
  const state = fighting(relic, 'coop'), template = state.enemies[0];
  state.obstacles = [];
  Object.assign(state.fighters[0], { x: 450, y: 320 }); Object.assign(state.fighters[1], { x: 800, y: 550 });
  state.enemies = [{ ...template, id: 100, x: 500, y: 320 }, { ...template, id: 101, x: 548, y: 320 }];
  const desired = { ...state, fighters: pose(state, { 0: { y: 328 }, 1: {} }), enemies: state.enemies.map(enemy => ({ ...enemy, x: enemy.x - 50 })) };
  const displayed = relic.sweepPresentationScene(state, desired, { anchorId: 0 });
  legalRelicScene(state, displayed);
  assert.ok(Math.abs(displayed.fighters[0].x - 450) < EPS);
  assert.ok(Math.abs(displayed.fighters[0].y - 328) < EPS);
  assert.ok(displayed.enemies[0].x > displayed.fighters[0].x);
  assert.ok(displayed.enemies[1].x > displayed.enemies[0].x);
});

test('Dungeon scene projection preserves current enemy and fighter metadata, IDs, ordering and source objects', () => {
  const state = fighting(relic, 'coop'), before = structuredClone(state);
  const desired = { ...state, fighters: pose(state, { 0: { x: state.fighters[0].x + .25 }, 1: {} }).reverse(), enemies: state.enemies.map(enemy => ({ ...enemy, x: enemy.x + .5, y: enemy.y + .25 })).reverse() };
  const requested = structuredClone(desired), displayed = relic.sweepPresentationScene(state, desired, { anchorId: 0 });
  assert.deepEqual(state, before); assert.deepEqual(desired, requested);
  assert.notEqual(displayed, desired); assert.notEqual(displayed.fighters, desired.fighters); assert.notEqual(displayed.enemies, desired.enemies);
  for (const collection of ['fighters', 'enemies']) {
    assert.deepEqual(displayed[collection].map(e => e.id), desired[collection].map(e => e.id));
    for (let i = 0; i < displayed[collection].length; i++) {
      const { x, y, ...metadata } = displayed[collection][i], { x: oldX, y: oldY, ...original } = desired[collection][i];
      assert.deepEqual(metadata, original); assert.notEqual(displayed[collection][i], desired[collection][i]);
    }
  }
});

test('Dungeon scene guards enemy death, replacement, nonfinite poses and room transitions', () => {
  const state = fighting(relic, 'coop'), enemy = state.enemies[0];
  state.enemies = [enemy];
  for (const change of [{ x: Infinity }, { y: NaN }, { x: enemy.x + 129 }, { x: enemy.x + 24, hp: 0 }, { x: enemy.x + 24, type: 'boss' }]) {
    const desired = { ...state, enemies: [{ ...enemy, ...change }] };
    const displayed = relic.sweepPresentationScene(state, desired, { anchorId: 0 });
    assert.equal(displayed.enemies[0].x, enemy.x); assert.equal(displayed.enemies[0].y, enemy.y);
  }
  const boundary = { ...state, roomBreak: true };
  const displayed = relic.sweepPresentationScene(boundary, { ...boundary, enemies: [{ ...enemy, x: enemy.x + 20 }] }, { anchorId: 0 });
  assert.equal(displayed.enemies[0].x, enemy.x);
});

test('Afterimage wall-pinned fighters and separating airborne landings preserve legal body order', () => {
  for (const anchorId of [0, 1]) {
    const state = fighting(afterimage), edge = anchorId === 0 ? afterimage.ARENA.minX : afterimage.ARENA.maxX;
    state.fighters[anchorId].x = edge;
    state.fighters[1 - anchorId].x = edge + (anchorId === 0 ? 45 : -45);
    const displayed = afterimage.sweepPresentationFighters(state, pose(state, { [anchorId]: {}, [1 - anchorId]: { x: edge } }), { anchorId });
    assert.equal(displayed[anchorId].x, edge);
    assert.ok(Math.abs(displayed[0].x - displayed[1].x) >= afterimage.ARENA.fighterWidth - EPS);
  }
  const state = fighting(afterimage);
  Object.assign(state.fighters[0], { x: 500, y: 385 }); Object.assign(state.fighters[1], { x: 510, y: 470 });
  const landing = afterimage.sweepPresentationFighters(state, pose(state, { 0: { x: 480, y: 410 }, 1: {} }), { anchorId: 0 });
  assert.ok(Math.abs(landing[0].x - landing[1].x) >= afterimage.ARENA.fighterWidth - EPS);
  assert.ok(Math.abs(landing[0].x - 480) < EPS); assert.ok(Math.abs(landing[0].y - 410) < EPS);
});
