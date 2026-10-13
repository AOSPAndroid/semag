import assert from 'node:assert/strict';
import test from 'node:test';
import * as L from '../public/lockdown-engine.js';
import { MANIFEST, MANIFEST_BY_KEY } from '../public/lockdown-assets.js';

const { TICK_RATE, RULES, ABILITIES, WEAPONS, CLASSES, MAPS, TILE, GUARD, STATUS } = L;

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
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'guardian', weapons: ['pulsar', 'rapier', 'vortex'], team: 1 }), { ok: true });
  assert.equal(state.players[0].hp, CLASSES.guardian.hp);
  for (const id of [1, 2, 3]) { L.setConnected(state, id, true, `P${id}`); L.setPlayerSetup(state, id, { team: 1 }); }
  assert.equal(state.players.filter(player => player.human && player.team === 1).length, 4);
  L.setConnected(state, 6, true, 'Late');
  assert.equal(state.players[6].team, 0, 'a seat on a full team moves to the other side');
  assert.match(L.setPlayerSetup(state, 6, { team: 1 }).error, /full/);
  state.phase = 'fight';
  assert.match(L.setPlayerSetup(state, 0, { team: 0 }).error, /lobby/);
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

const swingTicks = move => move.startup + move.active + move.recovery;

test('a blade cut lands as the arc sweeps, with knockback, stun and hit-stop; a queued press chains the combo', () => {
  const { state, me, foe } = duel({ gap: 50 });
  const first = WEAPONS.brand.combo[0];
  run(state, first.startup, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.hp, foe.maxHp, 'nothing lands during the wind-up');
  run(state, first.active);
  assert.equal(foe.hp, foe.maxHp - first.damage);
  assert.ok(foe.stunTicks > 0 && foe.pushX > 0, 'pushed away from the cut');
  assert.ok(events(state, 'damage').at(-1).kind === 'blade');
  // Press again while the first cut recovers: the second cut follows on its own.
  run(state, 2, t => ({ 0: { attack: t === 0 } }));
  run(state, swingTicks(first) + 8);
  assert.deepEqual(events(state, 'swing').map(event => event.step), [0, 1]);
  assert.equal(events(state, 'swing')[1].dir, -1, 'alternate cuts sweep the other way');
});

test('blades only hit what the sweep covers', () => {
  const { state, foe } = duel({ gap: 50 });
  Object.assign(foe, { x: state.players[0].x - 50 }); // behind the swing
  run(state, swingTicks(WEAPONS.brand.combo[0]) + 2, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.hp, foe.maxHp);
});

test('a full Knight Brand charge lunges into the target and ends in a burning burst', () => {
  const { state, me, foe } = duel({ gap: 120 });
  const swing = swingTicks(WEAPONS.brand.combo[0]);
  run(state, swing + WEAPONS.brand.chargeTicks + 3, () => ({ 0: { attack: true } }));
  assert.ok(me.charging && me.chargeTicks >= WEAPONS.brand.chargeTicks);
  const startX = me.x;
  run(state, 60);
  assert.ok(me.x > startX + 60, 'the lunge carries you forward');
  assert.ok(events(state, 'damage').some(event => event.kind === 'lunge' && event.targetId === 4));
  assert.ok(events(state, 'explosion').some(event => event.burst));
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
  run(state, swingTicks(WEAPONS.rapier.combo[0]) + 6);
  assert.ok(foe.markTicks > 0);
  const before = foe.hp;
  run(state, 24, t => ({ 0: { attack: t === 0 } }));
  assert.equal(before - foe.hp, Math.round(WEAPONS.rapier.combo[1].damage * (1 + ABILITIES.cloak.markBonus)));
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
  foe.hp = 5; run(state, 1, () => ({ 0: { attack: true } })); run(state, 30);
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
  for (const map of Object.values(MAPS)) for (const key of [`tile_floor_${map.theme}`, `tile_floor_${map.theme}_alt`, `tile_wall_top_${map.theme}`, `tile_wall_front_${map.theme}`]) assert.ok(MANIFEST_BY_KEY[key], key);
  const keys = new Set();
  for (const entry of MANIFEST) {
    assert.ok(!keys.has(entry.key), `${entry.key} is unique`); keys.add(entry.key);
    assert.equal(entry.file, `${entry.key}.png`);
    assert.equal(entry.size[0] % entry.frames, 0, `${entry.key} splits into ${entry.frames} frames`);
    assert.equal(entry.size[1] % (entry.rows || 1), 0, `${entry.key} splits into ${entry.rows} rows`);
    assert.ok(entry.anchor[0] <= entry.size[0] / entry.frames && entry.anchor[1] <= entry.size[1] / (entry.rows || 1), `${entry.key} anchor is inside a frame`);
    assert.ok(entry.description.length > 10);
  }
});

test('your own base heals you; the enemy base does not', () => {
  const { state, me, foe } = duel();
  const home = MAPS.gate.spawns[0][0], away = MAPS.gate.spawns[1][0];
  Object.assign(me, { x: home.x, y: home.y, hp: 40 });
  assert.equal(L.inBase(state, me), true);
  run(state, TICK_RATE);
  assert.ok(Math.abs(me.hp - (40 + RULES.baseHealPerSecond)) < .01, `healed to ${me.hp}`);
  run(state, TICK_RATE * 10); assert.equal(me.hp, me.maxHp, 'never past full');
  Object.assign(foe, { x: home.x + 48, y: home.y, hp: 40 });
  assert.equal(L.inBase(state, foe), false, 'an enemy standing in your base is not in theirs');
  run(state, TICK_RATE); assert.equal(foe.hp, 40);
  Object.assign(me, { x: away.x, y: away.y, hp: 40 }); run(state, TICK_RATE); assert.equal(me.hp, 40);
});

test('class and weapons change mid-match only in base or while respawning', () => {
  const { state, me } = duel({ a: { weapons: ['brand', 'blaster', 'blast'] } });
  assert.match(L.setPlayerSetup(state, 0, { cls: 'recon' }).error, /base/);
  assert.match(L.setPlayerSetup(state, 0, { weapons: ['rapier', 'magnus', 'shard'] }).error, /base/);
  const home = MAPS.gate.spawns[0][0];
  Object.assign(me, { x: home.x, y: home.y, hp: 50, slot: 1 });
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'guardian', weapons: ['rapier', 'magnus', 'shard'] }), { ok: true });
  assert.equal(me.cls, 'guardian'); assert.equal(me.maxHp, CLASSES.guardian.hp);
  assert.equal(me.hp, 50 / CLASSES.striker.hp * CLASSES.guardian.hp, 'keeps the same health fraction');
  assert.deepEqual(me.weapons, ['rapier', 'magnus', 'shard']); assert.equal(me.slot, 0);
  assert.equal(me.clips.magnus, WEAPONS.magnus.clip);
  assert.ok(events(state, 'loadoutChange').length === 1);
  assert.match(L.setPlayerSetup(state, 0, { team: 1 }).error, /lobby/, 'teams stay fixed');
  // Knocked out: the choice is stored and used on respawn.
  Object.assign(me, { x: MAPS.gate.points[1].x, y: MAPS.gate.points[1].y, alive: false, respawnTicks: 3 });
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'recon' }), { ok: true });
  run(state, 4);
  assert.equal(me.alive, true); assert.equal(me.cls, 'recon'); assert.equal(me.hp, CLASSES.recon.hp);
});

test('a knockout drops a heart that heals whoever grabs it, and fades if nobody does', () => {
  const { state, me, foe } = duel();
  foe.hp = 5; run(state, 1, () => ({ 0: { attack: true } })); run(state, 30);
  assert.equal(foe.alive, false);
  assert.equal(state.pickups.length, 1); assert.ok(events(state, 'heartDrop').length === 1);
  const heart = state.pickups[0];
  run(state, 10); assert.equal(state.pickups.length, 1, 'a full-health knight leaves it for someone who needs it');
  Object.assign(me, { hp: 50, x: heart.x, y: heart.y }); run(state, 1);
  assert.equal(me.hp, 50 + RULES.heart.heal); assert.equal(state.pickups.length, 0);
  assert.equal(events(state, 'heartPickup').at(-1).playerId, 0);
  state.pickups.push({ id: 999, kind: 'heart', x: 100, y: 100, ttl: 5 });
  run(state, 6); assert.equal(state.pickups.length, 0);
});

test('personal score comes from taking and neutralising zones, and leads the scoreboard', () => {
  const { state, me, foe } = duel();
  const point = state.points[0];
  Object.assign(me, { x: point.x, y: point.y }); Object.assign(foe, { alive: false, respawnTicks: 1e9 });
  run(state, RULES.captureTicks + 1);
  assert.equal(me.score, RULES.captureScore);
  Object.assign(me, { alive: false, respawnTicks: 1e9 }); Object.assign(foe, { alive: true, x: point.x, y: point.y, shieldTicks: 1e9 });
  run(state, RULES.captureTicks + 1);
  assert.equal(point.owner, null); assert.equal(foe.score, RULES.neutralizeScore);
  run(state, RULES.captureTicks + 1);
  assert.equal(point.owner, 1); assert.equal(foe.score, RULES.neutralizeScore + RULES.captureScore);
  foe.damage = 12.6;
  const board = L.getScoreboard(state);
  const row = board.find(entry => entry.id === 4);
  assert.deepEqual([row.score, row.captures, row.damage], [45, 1, 13]);
  assert.ok(board.every(entry => ['score', 'kills', 'deaths', 'damage', 'captures'].every(key => Number.isInteger(entry[key]))));
  const team1 = board.filter(entry => entry.team === 1);
  assert.deepEqual(team1.map(entry => entry.score), [...team1.map(entry => entry.score)].sort((a, b) => b - a));
});

test('a raised shield blocks hits and statuses, then breaks into a stun', () => {
  const { state, me, foe } = duel({ gap: 200, b: { weapons: ['blaster', 'brand', 'blast'] } });
  run(state, GUARD.raiseTicks + 1, () => ({ 0: { guard: true } }));
  assert.ok(me.guarding && me.guardRaise >= GUARD.raiseTicks);
  run(state, 40, t => ({ 0: { guard: true }, 4: { attack: t === 0 } }));
  assert.equal(me.hp, me.maxHp, 'the shield took the round');
  assert.equal(me.guardHp, GUARD.max - WEAPONS.blaster.damage);
  assert.ok(events(state, 'block').length === 1);
  me.guardHp = 5;
  run(state, 40, t => ({ 0: { guard: true }, 4: { attack: t === 0 } }));
  assert.ok(events(state, 'guardBreak').length === 1);
  assert.equal(me.guarding, false); assert.ok(me.stunTicks > 0 && me.guardBroken);
  run(state, 2, () => ({ 0: { guard: true } })); assert.equal(me.guarding, false, 'a broken shield cannot be raised');
  // It regenerates after a pause and comes back at half strength.
  run(state, GUARD.regenDelay + Math.ceil(GUARD.max * GUARD.recover / GUARD.regenPerSecond * TICK_RATE) + GUARD.breakStun + 5);
  assert.equal(me.guardBroken, false);
  run(state, GUARD.raiseTicks + 1, () => ({ 0: { guard: true } })); assert.ok(me.guarding);
});

test('statuses: burn ticks damage, poison stops healing, freeze holds you until hit', () => {
  const { state, me, foe } = duel();
  L.step(state, []); // settle
  // Burn: a few points every half second.
  state.events = [];
  const hazeBomb = { id: 77, ownerId: 0, team: 0, weapon: 'haze', x: foe.x, y: foe.y, fuse: 1, total: 1, phase: 'fuse', pullTicks: 0 };
  state.bombs.push(hazeBomb); run(state, 2);
  assert.equal(state.clouds.length, 1); assert.ok(foe.status.burn > 0);
  run(state, STATUS.burn.every * 2 + 1);
  assert.ok(events(state, 'damage').filter(event => event.kind === 'burn').length >= 2);
  // Poison: no healing from hearts or base.
  foe.status.poison = STATUS.poison.ticks; foe.hp = 40;
  state.pickups.push({ id: 900, kind: 'heart', x: foe.x, y: foe.y, ttl: 500 }); run(state, 2);
  assert.equal(state.pickups.some(pickup => pickup.id === 900), true, 'a poisoned knight cannot take a heart');
  // Freeze: no movement until the ice breaks; a hit thaws it.
  state.clouds = []; foe.status.burn = 0;
  const start = foe.x; foe.status.freeze = STATUS.freeze.ticks;
  run(state, 20, () => ({ 4: { right: true } }));
  assert.equal(foe.x, start, 'frozen knights cannot move');
  me.weapons = ['brand', 'blaster', 'blast']; Object.assign(me, { x: foe.x - 50, y: foe.y, aim: 0 });
  run(state, 20, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.status.freeze, 0); assert.ok(foe.freezeImmune > 0, 'a thawed knight is briefly immune');
});

test('ricochet bolts bounce off walls; catalysts stick and the detonator sets them off', () => {
  const { state, me, foe } = duel({ a: { weapons: ['alchemer', 'catalyzer', 'blast'] } });
  // Fire straight into the nearest wall.
  const map = MAPS.gate; let wallX = me.x; while (!L.MAPS.gate.grid[Math.floor(me.y / TILE)][Math.floor(wallX / TILE)].includes('#')) wallX += 4;
  Object.assign(foe, { alive: false, respawnTicks: 1e9 });
  run(state, 1, () => ({ 0: { attack: true } })); run(state, 1);
  const shot = state.projectiles[0]; assert.equal(shot.kind, 'ricochet');
  run(state, Math.ceil((wallX - me.x) / WEAPONS.alchemer.speed * TICK_RATE) + 6);
  assert.ok(events(state, 'ricochet').length >= 1); assert.ok(state.projectiles[0]?.vx < 0, 'the bolt comes back');
  // Catalyst: three stuck charges, then the detonator.
  state.projectiles = []; Object.assign(foe, { alive: true, x: me.x + 140, y: me.y, hp: 300, maxHp: 300, shieldTicks: 0 });
  run(state, 2, t => ({ 0: { slot2: t === 0 } }));
  for (let i = 0; i < 3; i++) run(state, WEAPONS.catalyzer.interval + 2, t => ({ 0: { attack: t === 0 } }));
  run(state, 20);
  assert.equal(foe.catalysts, 3);
  const before = foe.hp;
  run(state, swingTicks({ startup: 0, active: 0, recovery: 0 }) + WEAPONS.catalyzer.chargeTicks + 3, () => ({ 0: { attack: true } }));
  run(state, 30);
  assert.ok(events(state, 'detonate').some(event => event.count === 3));
  assert.ok(before - foe.hp >= WEAPONS.catalyzer.charge.damage + WEAPONS.catalyzer.charge.perCharge * 3);
  assert.equal(foe.catalysts, 0);
});

test('the vortex drags enemies in, holds them, then blasts them apart', () => {
  const { state, foe } = duel();
  const centre = { x: foe.x - 100, y: foe.y };
  state.bombs.push({ id: 88, ownerId: 0, team: 0, weapon: 'vortex', ...centre, fuse: 1, total: 1, phase: 'fuse', pullTicks: 0 });
  run(state, 2); assert.equal(state.bombs[0].phase, 'pull');
  run(state, 60, () => ({ 4: { right: true } }));
  assert.ok(Math.hypot(foe.x - centre.x, foe.y - centre.y) < 30, 'pulled to the centre against its will');
  run(state, WEAPONS.vortex.pull.ticks);
  assert.equal(state.bombs.length, 0);
  assert.equal(foe.hp, foe.maxHp - WEAPONS.vortex.damage);
});

test('every weapon fires its charge without errors', () => {
  for (const id of L.WEAPON_IDS) {
    const { state, me } = duel({ gap: 140, a: { weapons: [id, ...L.WEAPON_IDS.filter(other => other !== id && WEAPONS[other].family !== WEAPONS[id].family).slice(0, 2)] } });
    me.clips = Object.fromEntries(me.weapons.filter(weaponId => WEAPONS[weaponId].family === 'gun').map(weaponId => [weaponId, WEAPONS[weaponId].clip]));
    run(state, 60 + WEAPONS[id].chargeTicks + 3, () => ({ 0: { attack: true } }));
    run(state, 400);
    assert.ok(events(state, 'chargeRelease').some(event => event.weapon === id), `${id} released its charge`);
    assert.ok(state.players.every(player => Number.isFinite(player.x) && Number.isFinite(player.hp)), `${id} stays finite`);
  }
});
