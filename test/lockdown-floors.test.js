import assert from 'node:assert/strict';
import test from 'node:test';
import * as L from '../public/lockdown-engine.js';
import { STAIRS, levelCell, levelAt, canStep, isBlocked } from '../public/lockdown-maps.js';

const { MAPS, WEAPONS, RULES, TILE } = L;
const twoFloor = Object.values(MAPS).filter(map => map.twoFloors);

function arena(mapId, a = {}, b = {}) {
  const state = L.createState({ mapId, seed: 5 });
  L.setConnected(state, 0, true, 'Ada'); L.setConnected(state, 4, true, 'Bo');
  L.startMatch(state, [0, 4]); state.phase = 'fight';
  for (const player of state.players) if (player.id !== 0 && player.id !== 4) Object.assign(player, { bot: false, alive: false, respawnTicks: 1e9 });
  const me = state.players[0], foe = state.players[4];
  Object.assign(me, { shieldTicks: 0, slot: 0 }, a); Object.assign(foe, { shieldTicks: 0, hp: 400, maxHp: 400 }, b);
  for (const player of [me, foe]) player.clips = Object.fromEntries(player.weapons.filter(id => WEAPONS[id]?.family === 'gun').map(id => [id, WEAPONS[id].clip]));
  state.events = [];
  return { state, me, foe };
}
function run(state, ticks, controls = () => ({})) {
  for (let t = 0; t < ticks; t++) { const c = controls(t), inputs = []; for (const id of [0, 4]) inputs[id] = { ...L.emptyInput(state.players[id].aim), ...(c[id] || {}) }; L.step(state, inputs); }
}
const at = (col, row) => ({ x: (col + .5) * TILE, y: (row + .5) * TILE });

test('two-floor maps are well formed: stairs join the floors, points sit on open low ground, everything connects', () => {
  assert.equal(twoFloor.length, Object.keys(MAPS).length, 'every arena has two floors');
  for (const map of twoFloor) {
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      const cell = levelCell(map, col, row);
      if (map.grid[row][col] === '~') assert.equal(cell, '0', `${map.id}: pits only on low ground (${col},${row})`);
      if (!Object.hasOwn(STAIRS, cell)) continue;
      const [dc, dr] = STAIRS[cell];
      assert.ok(['1', cell].includes(levelCell(map, col + dc, row + dr)) && !isBlocked(map, col + dc, row + dr), `${map.id}: stair (${col},${row}) climbs onto raised floor`);
      assert.ok(['0', cell].includes(levelCell(map, col - dc, row - dr)) && !isBlocked(map, col - dc, row - dr), `${map.id}: stair (${col},${row}) starts on low ground`);
    }
    for (const point of map.points) {
      assert.equal(levelAt(map, point.x, point.y), 0, `${map.id} ${point.id} is on low ground`);
      for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
        if (levelCell(map, col, row) === '0' && !isBlocked(map, col, row)) continue;
        const nx = Math.max(col * TILE, Math.min(point.x, (col + 1) * TILE)), ny = Math.max(row * TILE, Math.min(point.y, (row + 1) * TILE));
        assert.ok(Math.hypot(nx - point.x, ny - point.y) >= RULES.pointRadius, `${map.id} ${point.id}: (${col},${row}) cuts into the zone`);
      }
    }
    // From each base, every point and every raised tile is reachable by walking (stairs included).
    for (const spawns of map.spawns) {
      const start = [Math.floor(spawns[0].x / TILE), Math.floor(spawns[0].y / TILE)], seen = new Set([start.join()]), queue = [start];
      while (queue.length) { const [c, r] = queue.shift(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${c + dc},${r + dr}`; if (!seen.has(k) && canStep(map, c, r, c + dc, r + dr)) { seen.add(k); queue.push([c + dc, r + dr]); } } }
      for (const point of map.points) assert.ok(seen.has(`${Math.floor(point.x / TILE)},${Math.floor(point.y / TILE)}`), `${map.id}: ${point.id} reachable`);
      for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (levelCell(map, col, row) === '1' && !isBlocked(map, col, row)) assert.ok(seen.has(`${col},${row}`), `${map.id}: raised (${col},${row}) reachable`);
    }
  }
});

test('knights climb only by the stairs: cliffs stop you from below and from above', () => {
  const map = MAPS.ramparts;
  // Below the rampart, walking north runs into the cliff face.
  const low = arena('ramparts', at(12, 7));
  run(low.state, 90, () => ({ 0: { up: true } }));
  assert.equal(levelAt(map, low.me.x, low.me.y), 0); assert.ok(low.me.y > 6 * TILE, 'stopped at the foot of the rampart');
  // Up the stairs at (9,6): you end up on the rampart.
  const climb = arena('ramparts', at(9, 8));
  run(climb.state, 120, () => ({ 0: { up: true } }));
  assert.ok(climb.me.y < 6 * TILE && levelAt(map, climb.me.x, climb.me.y) === 1, 'reached the rampart'); assert.equal(climb.me.z, 1);
  // From the rampart you cannot step off the ledge.
  const edge = arena('ramparts', at(12, 4));
  run(edge.state, 90, () => ({ 0: { down: true } }));
  assert.equal(levelAt(map, edge.me.x, edge.me.y), 1); assert.ok(edge.me.y < 6 * TILE);
  // And the way down is the same stairs.
  run(climb.state, 140, () => ({ 0: { down: true } }));
  assert.equal(climb.me.z, 0);
});

test('high ground: shots from above land, shots from below hit the cliff unless the target stands at the edge', () => {
  const gun = ['blaster', 'brand', 'blast'];
  // From the rampart (row 3) down to the courtyard (row 9).
  const down = arena('ramparts', { ...at(13, 3), weapons: gun, aim: Math.PI / 2 }, at(13, 9));
  run(down.state, 60, t => ({ 0: { attack: t === 0, aim: Math.PI / 2 } }));
  assert.ok(down.foe.hp < 400, 'plunging fire hits');
  // From the courtyard up at a knight standing back from the edge: the cliff face stops it.
  const up = arena('ramparts', { ...at(12, 9), weapons: gun, aim: -Math.PI / 2 }, at(12, 2));
  run(up.state, 60, t => ({ 0: { attack: t === 0, aim: -Math.PI / 2 } }));
  assert.equal(up.foe.hp, 400, 'blocked by the rampart');
  // The same shot catches a knight standing right at the edge.
  const exposed = arena('ramparts', { ...at(12, 9), weapons: gun, aim: -Math.PI / 2 }, { x: 12.5 * TILE, y: 6 * TILE - 11 });
  run(exposed.state, 60, t => ({ 0: { attack: t === 0, aim: -Math.PI / 2 } }));
  assert.ok(exposed.foe.hp < 400, 'exposed at the edge');
  // Swords never reach across floors.
  const blade = arena('ramparts', { x: 12.5 * TILE, y: 6 * TILE + 11, weapons: ['brand', 'blaster', 'blast'], aim: -Math.PI / 2 }, { x: 12.5 * TILE, y: 6 * TILE - 11 });
  run(blade.state, 40, t => ({ 0: { attack: t === 0, aim: -Math.PI / 2 } }));
  assert.equal(blade.foe.hp, 400);
});

test('bots use both floors and still capture points on two-floor maps', () => {
  for (const map of twoFloor) {
    const state = L.createState({ mapId: map.id, seed: 3 }); L.startMatch(state, []);
    let high = 0, captures = 0;
    for (let t = 0; t < 120 * 150; t++) {
      L.step(state, []);
      for (const event of state.events) if (event.tick === state.tick && event.type === 'capture') captures++;
      if (t % 120 === 0) high += state.players.filter(player => player.alive && player.z >= .5).length;
    }
    assert.ok(captures >= 2, `${map.id}: ${captures} captures`);
    if (['ramparts', 'atrium'].includes(map.id)) assert.ok(high > 20, `${map.id}: bots went up (${high})`);
    for (const player of state.players) if (player.alive) assert.ok(levelAt(map, player.x, player.y) === player.z);
  }
});
