import assert from 'node:assert/strict';
import test from 'node:test';
import * as L from '../public/lockdown-engine.js';
import { MANIFEST, MANIFEST_BY_KEY } from '../public/lockdown-assets.js';

const { TICK_RATE, RULES, ABILITIES, WEAPONS, CLASSES, MAPS, TILE } = L;

/** Two-knight arena: seat 0 (Amber) against seat 4 (Cyan); every other seat is benched. */
function duel({ mapId = 'gate', a = {}, b = {}, gap = 50 } = {}) {
  const state = L.createState({ mapId, seed: 7 });
  L.setConnected(state, 0, true, 'Ada'); L.setConnected(state, 4, true, 'Bo');
  L.startMatch(state, [0, 4]);
  state.phase = 'fight'; state.phaseTicks = 0;
  const point = MAPS[mapId].points[1];
  for (const player of state.players) {
    if (player.id !== 0 && player.id !== 4) Object.assign(player, { bot: false, human: false, alive: false, respawnTicks: 1e9 });
  }
  const me = state.players[0], foe = state.players[4];
  Object.assign(me, { x: point.x - gap / 2, y: point.y, aim: 0, shieldTicks: 0 }, a);
  Object.assign(foe, { x: point.x + gap / 2, y: point.y, aim: Math.PI, shieldTicks: 0 }, b);
  for (const player of [me, foe]) { player.clips = Object.fromEntries(player.weapons.filter(id => WEAPONS[id].family === 'gun').map(id => [id, WEAPONS[id].clip])); }
  state.events = [];
  return { state, me, foe };
}
const input = (fields = {}) => ({ ...L.emptyInput(fields.aim ?? 0), ...fields });
function run(state, ticks, controls = () => ({})) {
  for (let t = 0; t < ticks; t++) {
    const c = controls(t), inputs = [];
    inputs[0] = input({ aim: state.players[0].aim, ...(c[0] || {}) });
    inputs[4] = input({ aim: state.players[4].aim, ...(c[4] || {}) });
    L.step(state, inputs);
  }
}
const events = (state, type) => state.events.filter(event => event.type === type);

test('maps are mirrored with three points and four spawn tiles a side', () => {
  for (const id of L.MAP_IDS) {
    const map = MAPS[id];
    assert.equal(map.points.length, 3);
    assert.deepEqual(map.points.map(point => point.id), ['A', 'B', 'C']);
    assert.ok(map.spawns[0].length >= 4 && map.spawns[1].length >= 4, `${id} has room to spawn a full team`);
    for (const point of map.points) {
      assert.equal(L.MAPS[id].grid[Math.floor(point.y / TILE)][Math.floor(point.x / TILE)] !== '#', true, `${id} point ${point.id} sits on floor`);
      const mirror = map.points.find(other => Math.abs(other.x - (map.width - point.x)) < 1 && Math.abs(other.y - point.y) < 1);
      assert.ok(mirror, `${id} point ${point.id} has a mirror`);
    }
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      assert.equal(map.grid[row][col] === '#', map.grid[row][map.cols - 1 - col] === '#', `${id} walls mirror at ${col},${row}`);
    }
  }
});

test('lobby setup validates class, three distinct weapons and team size', () => {
  const state = L.createState();
  assert.equal(state.players.length, L.CAPACITY);
  assert.ok(state.players.every(player => player.bot && !player.human));
  L.setConnected(state, 0, true, 'Ada');
  assert.equal(state.players[0].human, true); assert.equal(state.players[0].name, 'Ada');
  assert.equal(L.setPlayerSetup(state, 0, { cls: 'wizard' }).ok, false);
  assert.equal(L.setPlayerSetup(state, 0, { weapons: ['brand', 'brand', 'blast'] }).ok, false);
  assert.equal(L.setPlayerSetup(state, 0, { weapons: ['brand', 'blast'] }).ok, false);
  assert.equal(L.setPlayerSetup(state, 0, { weapons: ['brand', 'laser', 'blast'] }).ok, false);
  assert.equal(L.setPlayerSetup(state, 0, { team: 2 }).ok, false);
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'guardian', weapons: ['scatter', 'rapier', 'vortex'], team: 1 }), { ok: true });
  assert.equal(state.players[0].hp, CLASSES.guardian.hp);
  for (const id of [1, 2, 3]) { L.setConnected(state, id, true, `P${id}`); L.setPlayerSetup(state, id, { team: 1 }); }
  assert.equal(state.players.filter(player => player.human && player.team === 1).length, 4);
  L.setConnected(state, 6, true, 'Late');
  assert.equal(state.players[6].team, 0, 'a seat on a full team moves to the other side');
  assert.match(L.setPlayerSetup(state, 6, { team: 1 }).error, /full/);
  state.phase = 'fight';
  assert.match(L.setPlayerSetup(state, 0, { cls: 'recon' }).error, /lobby/);
});

test('starting balances the bots to four a side and counts down into the fight', () => {
  const state = L.createState({ seed: 3 });
  for (const id of [0, 1, 2]) { L.setConnected(state, id, true, `H${id}`); L.setPlayerSetup(state, id, { team: 1 }); }
  L.startMatch(state, [0, 1, 2]);
  assert.equal(state.phase, 'countdown');
  assert.deepEqual([0, 1].map(team => state.players.filter(player => player.team === team).length), [4, 4]);
  assert.ok([0, 1, 2].every(id => state.players[id].team === 1 && state.players[id].human));
  assert.ok(state.players.every(player => player.alive && Number.isFinite(player.x)));
  for (const player of state.players) assert.equal(player.weapons.length, 3);
  for (let t = 0; t < RULES.countdownTicks; t++) L.step(state, []);
  assert.equal(state.phase, 'fight');
  assert.ok(events(state, 'fight').length === 1);
});

test('a blade combo cuts, pushes and stuns; a full charge spins all around', () => {
  const { state, me, foe } = duel({ gap: 50 });
  run(state, 2, t => ({ 0: { attack: t === 0 } }));
  run(state, WEAPONS.brand.startup + 2);
  assert.equal(foe.hp, foe.maxHp - WEAPONS.brand.combo[0]);
  assert.ok(foe.stunTicks > 0 && foe.pushX > 0, 'pushed away from the cut');
  // Hold for a full charge, then release behind you: the spin still lands.
  const after = foe.hp; Object.assign(foe, { x: me.x - 40, y: me.y, pushX: 0, stunTicks: 0 });
  run(state, 40);
  // Holding starts with the normal cut (facing away, so it whiffs) and charges once it recovers.
  const swing = WEAPONS.brand.startup + WEAPONS.brand.active + WEAPONS.brand.recovery;
  run(state, swing + WEAPONS.brand.chargeTicks + 3, () => ({ 0: { attack: true } }));
  assert.equal(me.charging, true); assert.ok(me.chargeTicks >= WEAPONS.brand.chargeTicks);
  run(state, 1);
  assert.equal(after - foe.hp, WEAPONS.brand.charge.damage);
  assert.ok(events(state, 'swing').some(event => event.charged && event.kind === 'spin'));
});

test('guns spend their clip, reload, and the charged blaster bolt pierces', () => {
  const { state, me, foe } = duel({ gap: 200, a: { weapons: ['blaster', 'brand', 'blast'] } });
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  assert.equal(me.clips.blaster, WEAPONS.blaster.clip - 1);
  assert.equal(foe.hp, foe.maxHp - WEAPONS.blaster.damage);
  for (let shot = 0; shot < 2; shot++) run(state, WEAPONS.blaster.interval + 2, t => ({ 0: { attack: t === 0 } }));
  assert.equal(me.clips.blaster, 0); assert.ok(me.reloadTicks.blaster > 0);
  run(state, WEAPONS.blaster.reload + 2);
  assert.equal(me.clips.blaster, WEAPONS.blaster.clip);
  const behind = state.players[5]; Object.assign(behind, { alive: true, x: foe.x + 60, y: foe.y, hp: 100, maxHp: 100, shieldTicks: 0, respawnTicks: 0 });
  Object.assign(foe, { hp: 100, pushX: 0 });
  run(state, WEAPONS.blaster.chargeTicks + 4, () => ({ 0: { attack: true } }));
  run(state, 60);
  // The press fires a normal round (stopped by the first knight); the release fires the bolt.
  assert.equal(foe.hp, 100 - WEAPONS.blaster.damage - WEAPONS.blaster.charge.damage);
  assert.equal(behind.hp, 100 - WEAPONS.blaster.charge.damage, 'the bolt carried through');
});

test('bombs plant on a full charge and blast enemies in range after the fuse', () => {
  const { state, me, foe } = duel({ gap: 60, a: { weapons: ['blast', 'brand', 'blaster'] } });
  run(state, 10, () => ({ 0: { attack: true } }));
  run(state, 1);
  assert.equal(state.bombs.length, 0, 'a short tap plants nothing');
  run(state, WEAPONS.blast.chargeTicks + 2, () => ({ 0: { attack: true } }));
  run(state, 1);
  assert.equal(state.bombs.length, 1);
  run(state, WEAPONS.blast.fuse + 1);
  assert.equal(state.bombs.length, 0);
  assert.equal(foe.hp, foe.maxHp - WEAPONS.blast.damage);
  assert.equal(me.hp, me.maxHp, 'your own bomb never hurts you');
});

test('switching weapons uses 1–3 and Q, and cancels a charge', () => {
  const { state, me } = duel();
  run(state, 2, t => ({ 0: { slot3: t === 0 } })); assert.equal(me.slot, 2);
  run(state, 2, t => ({ 0: { swap: t === 0 } })); assert.equal(me.slot, 0);
  run(state, 60, () => ({ 0: { attack: true } }));
  const charged = me.chargeTicks; assert.ok(charged > 20);
  run(state, 1, () => ({ 0: { attack: true, slot2: true } }));
  assert.equal(me.slot, 1); assert.ok(me.chargeTicks <= 1, 'the old charge is dropped; holding starts a fresh one');
});

test('Striker dash speeds you up, then waits for its cooldown', () => {
  const { state, me } = duel({ gap: 400 });
  const start = me.x; run(state, 60, () => ({ 0: { right: true } }));
  const normal = me.x - start;
  me.x = start; me.vx = 0; me.y = MAPS.gate.points[1].y; run(state, 60, t => ({ 0: { right: true, ability: t === 0 } }));
  assert.ok(me.x - start > normal * 1.3, `dash covered ${me.x - start} vs ${normal}`);
  assert.ok(me.abilityCooldown > 0);
  run(state, 2, t => ({ 0: { ability: t === 1 } }));
  assert.equal(events(state, 'dash').length, 1, 'no second dash on cooldown');
});

test('Guardian dome soaks shots from outside and heal pulse restores allies', () => {
  const { state, me, foe } = duel({ gap: 260, a: { cls: 'guardian', weapons: ['cleaver', 'magnus', 'vortex'], hp: 130, maxHp: 130 }, b: { weapons: ['blaster', 'brand', 'blast'] } });
  run(state, 2, t => ({ 0: { ability: t === 0 } }));
  assert.ok(me.bubbleTicks > 0);
  run(state, 40, t => ({ 4: { attack: t === 0 } }));
  assert.equal(me.hp, 130, 'the dome took the round');
  assert.equal(me.bubbleHp, ABILITIES.bubble.hp - WEAPONS.blaster.damage);
  const ally = state.players[1]; Object.assign(ally, { alive: true, x: me.x, y: me.y + 40, hp: 40, maxHp: 100, shieldTicks: 0, respawnTicks: 0 });
  run(state, 2, t => ({ 0: { ability2: t === 0 } }));
  assert.equal(ally.hp, 40 + ABILITIES.heal.amount);
  assert.ok(me.ability2Cooldown > 0);
});

test('Recon cloak hides you; the first hit out of it marks the target for extra damage', () => {
  const { state, me, foe } = duel({ gap: 50, a: { cls: 'recon', weapons: ['rapier', 'autogun', 'shard'], hp: 90, maxHp: 90 } });
  run(state, 2, t => ({ 0: { ability: t === 0 } }));
  assert.ok(me.cloakTicks > 0);
  run(state, 2, t => ({ 0: { attack: t === 0 } }));
  assert.equal(me.cloakTicks, 0, 'attacking breaks the cloak');
  run(state, WEAPONS.rapier.startup + 2);
  assert.ok(foe.markTicks > 0);
  const before = foe.hp;
  run(state, 12); // let the first thrust recover, still inside the combo window
  run(state, 20, t => ({ 0: { attack: t === 0 } }));
  assert.equal(before - foe.hp, Math.round(WEAPONS.rapier.combo[1] * (1 + ABILITIES.cloak.markBonus)));
});

test('standing on a point captures it and scores every five seconds', () => {
  const { state, me, foe } = duel();
  const point = state.points[0];
  Object.assign(me, { x: point.x, y: point.y }); Object.assign(foe, { alive: false, respawnTicks: 1e9 });
  run(state, RULES.captureTicks + 1);
  assert.equal(point.owner, 0);
  assert.equal(me.captures, 1);
  const score = state.scores[0]; state.scoreTimer = 1; run(state, 1);
  assert.equal(state.scores[0] - score, RULES.scoreTable[1]);
  // Contesting stops progress; outnumbering flips it back to neutral then theirs.
  Object.assign(foe, { alive: true, x: point.x + 10, y: point.y, shieldTicks: 1e9 });
  const progress = point.progress; run(state, 30); assert.equal(point.progress, progress);
  Object.assign(me, { alive: false, respawnTicks: 1e9 });
  run(state, RULES.captureTicks + 1); assert.equal(point.owner, null);
  run(state, RULES.captureTicks + 1); assert.equal(point.owner, 1);
});

test('a knocked-out knight respawns at base after the delay with a spawn shield', () => {
  const { state, foe } = duel();
  foe.hp = 5; run(state, 1, () => ({ 0: { attack: true } })); run(state, WEAPONS.brand.startup + 2);
  assert.equal(foe.alive, false); assert.equal(state.players[0].kills, 1); assert.equal(foe.deaths, 1);
  assert.equal(foe.respawnTicks <= RULES.respawnBaseTicks, true);
  run(state, foe.respawnTicks + 1);
  assert.equal(foe.alive, true); assert.equal(foe.hp, foe.maxHp); assert.ok(foe.shieldTicks > 0);
  assert.ok(MAPS.gate.spawns[1].some(spot => spot.x === foe.x && spot.y === foe.y));
});

test('bot matches are deterministic, finite and reach a result', () => {
  const play = ticks => { const state = L.createState({ mapId: 'yard', seed: 99 }); L.startMatch(state, []); for (let t = 0; t < ticks; t++) L.step(state, []); return state; };
  const a = play(6000), b = play(6000);
  assert.deepEqual(a.scores, b.scores); assert.equal(a.eventId, b.eventId);
  assert.deepEqual(a.players.map(player => [player.x, player.y, player.hp]), b.players.map(player => [player.x, player.y, player.hp]));
  assert.ok(a.players.every(player => Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.hp)));
  assert.ok(a.points.some(point => point.owner !== null), 'bots take points');
  assert.ok(a.players.some(player => player.kills > 0), 'bots fight');
  const full = play(RULES.timeLimitTicks + RULES.countdownTicks + 10);
  assert.equal(full.phase, 'matchEnd');
  assert.ok(full.winner === null || [0, 1].includes(full.winner));
  const board = L.getScoreboard(full);
  assert.equal(board.length, L.CAPACITY);
  assert.ok(board.every(row => Number.isInteger(row.kills) && Number.isInteger(row.captures)));
  L.resetLobby(full);
  assert.equal(full.phase, 'lobby'); assert.deepEqual(full.scores, [0, 0]);
});

test('the art manifest covers every class, team, weapon and theme with valid strips', () => {
  for (const cls of Object.keys(CLASSES)) for (const team of [0, 1]) assert.ok(MANIFEST_BY_KEY[`knight_${cls}_team${team}`]);
  for (const id of L.WEAPON_IDS) { assert.ok(MANIFEST_BY_KEY[`weapon_${id}`]); assert.ok(MANIFEST_BY_KEY[`icon_weapon_${id}`]); }
  for (const map of Object.values(MAPS)) for (const key of [`tile_floor_${map.theme}`, `tile_floor_${map.theme}_alt`, `tile_wall_${map.theme}`]) assert.ok(MANIFEST_BY_KEY[key], key);
  const keys = new Set();
  for (const entry of MANIFEST) {
    assert.ok(!keys.has(entry.key), `${entry.key} is unique`); keys.add(entry.key);
    assert.equal(entry.file, `${entry.key}.png`);
    assert.equal(entry.size[0] % entry.frames, 0, `${entry.key} splits into ${entry.frames} frames`);
    assert.ok(entry.anchor[0] <= entry.size[0] / entry.frames && entry.anchor[1] <= entry.size[1], `${entry.key} anchor is inside a frame`);
    assert.ok(entry.description.length > 10);
  }
});
