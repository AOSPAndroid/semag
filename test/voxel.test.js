import assert from 'node:assert/strict';
import test from 'node:test';
import * as game from '../public/voxel-engine.js';
const input = (buttons = {}, player = null) => ({ ...game.emptyInput(player || {}), ...buttons });
const neutral = state => state.players.map(f => input({}, f));
function advance(state, ticks, inputs = null) { for (let i = 0; i < ticks; i++) game.step(state, inputs || neutral(state)); }
function fighting(options = {}) { const state = game.createState(options); game.startMatch(state); advance(state, 11 * game.TICK_RATE); assert.equal(state.phase, 'fight'); return state; }
function lane(state, { ax = 20, az = 5, bx = 20, bz = -5 } = {}) { Object.assign(state.players[0], { x: ax, y: 0, z: az, yaw: 0, pitch: 0 }); Object.assign(state.players[state.teamSize], { x: bx, y: 0, z: bz, yaw: Math.PI, pitch: 0 }); return state; }
const shot = (state, id = 0, buttons = {}) => { const keys = neutral(state); keys[id] = input({ fire: true, ...buttons }, state.players[id]); game.step(state, keys); };
const fixtureMap = colliders => ({ bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders });
const fixturePlayer = () => game.cloneState(game.createState()).players[0];
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
function collectUtility(state, player = state.players[0], kinds = ['heal', 'grenade']) {
  for (const kind of kinds) {
    const loot = game.addInventoryLoot(state, player, { kind, amount: 1 });
    assert.ok(game.pickupCombatLoot(state, player, loot), `fixture collects its physical ${kind} supply`);
  }
  return player;
}

test('room modes create stable teams, unique spawns and bounded state', () => {
  for (const teamSize of [1, 2, 3]) for (const mapId of Object.keys(game.MAPS)) {
    const state = game.createState({ teamSize, mapId }); assert.equal(state.players.length, 2 * teamSize); assert.equal(state.capacity, 2 * teamSize); assert.equal(state.players, state.fighters); assert.equal(state.phase, 'lobby');
    assert.deepEqual(state.players.map(f => f.team), [...Array(teamSize).fill(0), ...Array(teamSize).fill(1)]);
    for (const player of state.players) { assert.equal(player.hp, 200); assert.equal(player.maxHp, 200); assert.equal(player.meleeWeapon, 'knife'); }
    assert.equal(new Set(state.players.map(f => `${f.x},${f.z}`)).size, teamSize * 2);
    for (const f of state.players) assert.equal(game.traceShot(state, f.id, { x: f.x, y: f.y + game.eyeHeight(f), z: f.z }, { x: 0, y: -1, z: 0 }).colliderId, 'floor');
  }
  assert.throws(() => game.createState({ teamSize: 4 }), RangeError); assert.throws(() => game.createState({ mapId: '__proto__' }), RangeError);
});
test('lobby, countdown and weapon preparation cannot move or fire', () => {
  const state = game.createState(), position = { x: state.players[0].x, z: state.players[0].z };
  advance(state, 60, [input({ up: true, fire: true, jump: true }), input()]); assert.equal(state.players[0].ammo, 24); assert.deepEqual({ x: state.players[0].x, z: state.players[0].z }, position);
  game.startMatch(state); advance(state, 360, [input({ up: true, fire: true, jump: true }), input()]); assert.equal(state.phase, 'buy');
  advance(state, 960, [input({ up: true, fire: true, jump: true }), input()]); assert.equal(state.phase, 'fight'); assert.equal(state.players[0].ammo, 24); assert.deepEqual({ x: state.players[0].x, z: state.players[0].z }, position);
  advance(state, 10, [input({ fire: true }), input()]); assert.equal(state.players[0].ammo, 24);
  advance(state, 1); shot(state); assert.equal(state.players[0].ammo, 23);
});
test('free loadouts work between rounds and never refill during live play', () => {
  const state = game.createState(); assert.deepEqual(game.selectLoadout(state, 0, 'marksman'), { ok: true, changed: true }); assert.equal(state.players[0].ammo, 8);
  assert.equal(game.selectLoadout(state, 0, '__proto__').ok, false); assert.equal(game.selectLoadout(state, 5, 'smg').ok, false);
  game.startMatch(state); assert.equal(state.players[0].weapon, 'marksman'); advance(state, 1320); shot(state); assert.equal(state.players[0].ammo, 7);
  assert.equal(game.selectLoadout(state, 0, 'carbine').ok, false); assert.equal(state.players[0].ammo, 7);
  game.resetLobby(state); assert.equal(state.players[0].weapon, 'marksman'); assert.equal(state.players[0].ammo, 8); assert.equal(state.players, state.fighters);
});
test('cloned state is isolated and preserves players/fighters identity', () => {
  const state = game.createState({ teamSize: 3 }), copy = game.cloneState(state); copy.players[0].hp = 1; assert.equal(state.players[0].hp, 200); assert.equal(copy.players, copy.fighters);
});
test('slab rays handle finite range, parallel axes, inside starts and exact face contacts', () => {
  const box = { x: 2, y: 1, z: -5, w: 2, h: 2, d: 2 };
  close(game.rayBox({ x: 3, y: 2, z: 0 }, { x: 0, y: 0, z: -1 }, box), 3);
  assert.equal(game.rayBox({ x: 3, y: 2, z: 0 }, { x: 0, y: 0, z: -1 }, box, 2.99), null);
  assert.equal(game.rayBox({ x: 1.99, y: 2, z: 0 }, { x: 0, y: 0, z: -1 }, box), null);
  assert.equal(game.rayBox({ x: 3, y: 2, z: -4 }, { x: 1, y: 0, z: 0 }, box), 0);
  close(game.rayBox({ x: 2, y: 3, z: 0 }, { x: 0, y: 0, z: -1 }, box), 3);
});
test('world ray contacts are truly three dimensional and walls win ties', () => {
  const state = lane(fighting(), { ax: 0, az: 8, bx: 0, bz: -8 }), origin = { x: 0, y: 1.62, z: 8 }, dir = { x: 0, y: 0, z: -1 };
  assert.equal(game.traceShot(state, 0, origin, dir).colliderId, 'central-north');
  const low = { x: -15.2, y: 1.62, z: -6 }; assert.equal(game.traceShot(state, 0, low, dir).colliderId, 'wall-north');
  assert.equal(game.traceShot(state, 0, { ...low, y: .7 }, dir).colliderId, 'west-site-crate');
  Object.assign(state.players[1], { x: -15.2, y: 0, z: -10.62 });
  const tie = game.traceShot(state, 0, { x: -15.2, y: .7, z: -6 }, dir); assert.equal(tie.kind, 'wall'); assert.equal(tie.colliderId, 'west-site-crate');
});
test('the nearest physical body blocks a shot and crouched heads lower precisely', () => {
  const state = lane(fighting({ teamSize: 2 })); Object.assign(state.players[1], { x: 20, z: 0 }); Object.assign(state.players[3], { x: -20, z: -18 });
  const hit = game.traceShot(state, 0, { x: 20, y: 1.62, z: 5 }, { x: 0, y: 0, z: -1 }); assert.equal(hit.playerId, 1); assert.equal(hit.kind, 'head');
  shot(state); assert.equal(state.players[1].hp, 200); assert.equal(state.players[2].hp, 200);
  const solo = lane(fighting()); solo.players[1].crouching = true; assert.equal(game.traceShot(solo, 0, { x: 20, y: 1.62, z: 5 }, { x: 0, y: 0, z: -1 }).kind, 'wall');
  assert.equal(game.traceShot(solo, 0, { x: 20, y: .98, z: 5 }, { x: 0, y: 0, z: -1 }).kind, 'head');
});
test('stationary first shots are accurate and headshots use each weapon multiplier', () => {
  for (const weapon of ['carbine', 'smg', 'marksman', 'pistol', 'burst']) {
    const state = game.createState(); game.selectLoadout(state, 0, weapon); game.startMatch(state); advance(state, 1320); lane(state); shot(state);
    const hit = state.events.findLast(event => event.type === 'shot'); assert.equal(hit.hitKind, 'head'); close(hit.dx, 0); close(hit.dy, 0); assert.equal(state.players[1].hp, Math.max(0, 200 - Math.round(game.WEAPONS[weapon].damage * game.WEAPONS[weapon].headMultiplier)));
  }
});
test('body shots, moving inaccuracy and recoil are distinct from accurate opening shots', () => {
  const state = lane(fighting()); const pitch = Math.atan2(.85 - 1.62, 10); shot(state, 0, { pitch }); assert.equal(state.players[1].hp, 172); assert.equal(state.events.findLast(e => e.type === 'shot').hitKind, 'body');
  const f = state.players[0]; assert.ok(f.recoil > 0); assert.ok(f.heat > 0); advance(state, 12); shot(state, 0, { pitch }); const second = state.events.findLast(e => e.type === 'shot'); assert.notEqual(second.dy, Math.sin(pitch));
  advance(state, 120); close(f.recoil, 0); close(f.heat, 0);
  const moving = lane(fighting()); shot(moving, 0, { right: true }); advance(moving, 20, [input({ right: true }, moving.players[0]), input({}, moving.players[1])]); shot(moving, 0, { right: true }); assert.ok(Math.abs(moving.events.findLast(e => e.type === 'shot').dx) > .001);
});
test('symmetric lethal shots trade in one authoritative tick', () => {
  const state = game.createState(); game.selectLoadout(state, 0, 'marksman'); game.selectLoadout(state, 1, 'marksman'); game.startMatch(state); advance(state, 1320); lane(state);
  for (const player of state.players) player.hp = 100; // Wounded opponents still trade lethal headshots.
  game.step(state, [input({ fire: true }, state.players[0]), input({ fire: true }, state.players[1])]); assert.equal(state.players[0].alive, false); assert.equal(state.players[1].alive, false); assert.deepEqual(state.players.map(f => f.kills), [1, 1]); assert.equal(state.roundWinner, 1);
});
test('kill credit belongs to the actual lethal contact, not a later zero-damage shot', () => {
  const state = fighting({ teamSize: 2 }); Object.assign(state.players[0], { x: 19, z: 5, yaw: Math.atan2(1, 10), weapon: 'marksman', ammo: 8 }); Object.assign(state.players[1], { x: 21, z: 5, yaw: Math.atan2(-1, 10), pitch: Math.atan2(.85 - 1.62, Math.sqrt(101)) }); Object.assign(state.players[2], { x: 20, z: -5 });
  state.players[2].hp = 100; // The marksman contact is deliberately lethal before the later carbine contact.
  game.step(state, state.players.map(f => input({ fire: f.id < 2 }, f)));
  assert.equal(state.players[2].alive, false); assert.equal(state.players[0].kills, 1); assert.equal(state.players[1].kills, 0); const kill = state.events.findLast(e => e.type === 'kill'); assert.equal(kill.playerId, 0); assert.equal(kill.headshot, true); assert.equal(state.events.filter(e => e.type === 'damage' && e.targetId === 2).length, 1);
});
test('a solid intervening wall blocks fire and records its actual contact face', () => {
  const state = lane(fighting(), { ax: -4, az: 8, bx: -4, bz: -8 }); shot(state); assert.equal(state.players[1].hp, 200); const event = state.events.findLast(e => e.type === 'shot'); assert.equal(event.hitKind, 'wall'); close(event.hitZ, 6); assert.equal(event.colliderId, 'central-west');
});
test('SMG damage falls at long range without inventing hits beyond weapon range', () => {
  const results = [];
  for (const distance of [10, 35]) {
    const state = game.createState(); game.selectLoadout(state, 0, 'smg'); game.startMatch(state); advance(state, 1320); lane(state, { az: 20, bz: 20 - distance }); shot(state, 0, { pitch: Math.atan2(.85 - 1.62, distance) }); results.push(200 - state.players[1].hp);
  }
  assert.equal(results[0], 20); assert.ok(results[1] < results[0]);
});
test('finite magazines and reload conserve the actual reserve, including partial refills', () => {
  const state = lane(fighting()), f = state.players[0]; f.ammo = 1; f.reserve = 5;
  shot(state, 0, { yaw: Math.PI / 2 }); advance(state, 200, [input({ fire: true, yaw: Math.PI / 2 }), input({}, state.players[1])]); assert.equal(f.ammo, 0); assert.equal(f.shots, 1); assert.equal(f.reserve, 5);
  advance(state, 1); advance(state, 1, [input({ reload: true }, f), input({}, state.players[1])]); assert.equal(f.reloadTicks, game.WEAPONS.carbine.reloadTicks);
  advance(state, game.WEAPONS.carbine.reloadTicks - 1); assert.equal(f.ammo, 0); advance(state, 1); assert.equal(f.ammo, 5); assert.equal(f.reserve, 0);
  advance(state, 1, [input({ reload: true }, f), input({}, state.players[1])]); assert.equal(f.reloadTicks, 0);
});
test('movement is normalised, yaw relative and precision walking is slower', () => {
  const arena = fixtureMap([]), straight = fixturePlayer(), diagonal = fixturePlayer(), walking = fixturePlayer(); for (const f of [straight, diagonal, walking]) Object.assign(f, { x: 0, z: 0 });
  for (let i = 0; i < 120; i++) { game.predictLocalMovement(straight, input({ up: true }), arena); game.predictLocalMovement(diagonal, input({ up: true, right: true }), arena); game.predictLocalMovement(walking, input({ up: true, walk: true }), arena); }
  close(Math.hypot(straight.x, straight.z), Math.hypot(diagonal.x, diagonal.z), .08); assert.ok(-walking.z < -straight.z * .6);
  const turning = fixturePlayer(); Object.assign(turning, { x: 0, z: 0 }); game.predictLocalMovement(turning, input({ up: true, yaw: Math.PI / 2 }), arena, 30); assert.ok(turning.x > .8); close(turning.z, 0);
});
test('wall contacts slide and rounded corners leave real diagonal clearance', () => {
  const wall = { x: 0, y: 0, z: -2, w: 2, h: 3, d: 4 }, arena = fixtureMap([wall]), f = fixturePlayer(); Object.assign(f, { x: -1, z: -1, yaw: 0 });
  for (let i = 0; i < 35; i++) game.predictLocalMovement(f, input({ right: true, up: true }), arena); assert.ok(f.x < -.319999); assert.ok(f.z < -1.7);
  for (let i = 0; i < 85; i++) game.predictLocalMovement(f, input({ right: true, up: true }), arena); assert.ok(f.z < -3);
  const corner = fixturePlayer(); Object.assign(corner, { x: -.27, z: -2.27 }); game.predictLocalMovement(corner, input({ right: true, up: true }), arena, 1); assert.ok(corner.x > -.32, 'rounded corner is not an expanded square');
});
test('physical bodies cannot run through one another or be pushed through solid cover', () => {
  const state = lane(fighting(), { ax: 20, az: .4, bx: 20, bz: -.4 }); advance(state, 120, [input({ up: true, yaw: 0 }), input({ up: true, yaw: Math.PI })]); assert.ok(state.players[0].z > state.players[1].z); close(Math.hypot(state.players[0].x - state.players[1].x, state.players[0].z - state.players[1].z), .64, 1e-5);
  const covered = lane(fighting(), { ax: -4, az: 6.34, bx: -4, bz: 7 }); advance(covered, 120, [input({}, covered.players[0]), input({ up: true, yaw: 0 })]); assert.ok(covered.players[0].z >= 6.32 - 1e-7); assert.ok(covered.players[1].z >= covered.players[0].z + .64 - 1e-7);
});
test('crouching cannot expand into a ceiling and can pass under genuine low overhangs', () => {
  const arena = fixtureMap([{ x: -2, y: 1.25, z: -2, w: 4, h: 1, d: 4 }]), f = fixturePlayer(); Object.assign(f, { x: 0, z: 0, crouching: true });
  game.predictLocalMovement(f, input(), arena); assert.equal(f.crouching, true);
  for (let i = 0; i < 160; i++) game.predictLocalMovement(f, input({ up: true, crouch: true }), arena);
  assert.ok(f.z < -2.32); game.predictLocalMovement(f, input(), arena); assert.equal(f.crouching, false);
});
test('jump is a rising-edge action, respects gravity and lands on low crates', () => {
  const arena = fixtureMap([{ x: 0, y: 0, z: -2, w: 2, h: .8, d: 4 }]), f = fixturePlayer(); Object.assign(f, { x: -.65, z: 0, yaw: Math.PI / 2 });
  let maxY = 0; for (let i = 0; i < 90; i++) { game.predictLocalMovement(f, input({ jump: true, up: i < 55, yaw: Math.PI / 2 }), arena); maxY = Math.max(maxY, f.y); }
  assert.ok(maxY > 1); assert.ok(f.x > .2); close(f.y, .8); assert.equal(f.grounded, true); assert.equal(f.vy, 0);
  game.predictLocalMovement(f, input({ jump: true }), arena); close(f.y, .8); game.predictLocalMovement(f, input(), arena); game.predictLocalMovement(f, input({ jump: true }), arena); assert.ok(f.y > .8);
});
test('falling across a crate lip lands where horizontal and vertical trajectories meet', () => {
  const arena = fixtureMap([{ x: 0, y: 0, z: -2, w: 2, h: .8, d: 4 }]);
  for (const start of [{ x: -.325, y: .81, vy: -2 }, { x: -.32, y: .8, vy: 0 }]) {
    const f = fixturePlayer(); Object.assign(f, { ...start, z: 0, vx: 5.4, vz: 0, grounded: false });
    game.predictLocalMovement(f, input({ right: true }), arena);
    assert.ok(f.x > -.32, 'the foot crosses the lip before landing'); close(f.y, .8); close(f.vy, 0); assert.equal(f.grounded, true);
    game.predictLocalMovement(f, input({ right: true }), arena, 12); close(f.y, .8); assert.equal(f.grounded, true);
  }
});
test('leaving an exact crate edge falls immediately instead of gaining a floating jump', () => {
  const arena = fixtureMap([{ x: 0, y: 0, z: -2, w: 2, h: .8, d: 4 }]), f = fixturePlayer();
  Object.assign(f, { x: -.32, y: .8, z: 0, vx: -5.4, grounded: true });
  game.predictLocalMovement(f, input({ left: true }), arena);
  assert.ok(f.x < -.32); assert.ok(f.y < .8); assert.equal(f.grounded, false);
  game.predictLocalMovement(f, input({ left: true, jump: true }), arena); assert.ok(f.vy < 0);
});
test('a rising head entering an overhang contacts its underside while preserving lateral motion', () => {
  const arena = fixtureMap([{ x: 0, y: 1.82, z: -2, w: 2, h: 1, d: 4 }]), f = fixturePlayer();
  Object.assign(f, { x: -.325, z: 0, vx: 5.4 });
  game.predictLocalMovement(f, input({ right: true, jump: true }), arena);
  assert.ok(f.x > -.32); close(f.y, .02); close(f.vy, 0); assert.equal(f.grounded, false);
  game.predictLocalMovement(f, input({ right: true, jump: true }), arena, 24); close(f.y, 0); assert.equal(f.grounded, true);
});
test('a stationary body blocks pressure without moving, and prediction agrees at its contact', () => {
  const state = lane(fighting(), { ax: 20, az: .32, bx: 20, bz: -.32 }), predicted = game.cloneState(state.players[0]), peer = game.cloneState(state.players[1]);
  const before = game.cloneState(peer);
  for (let i = 0; i < 120; i++) {
    const keys = input({ up: true }, state.players[0]); game.predictLocalMovement(predicted, keys, state.mapId, 1, [peer]);
    game.step(state, [keys, input({}, state.players[1])]);
    close(state.players[1].z, -.32); assert.ok(state.players[0].z >= .32 - 1e-8); close(predicted.z, state.players[0].z, 2e-8); close(predicted.vz, 0);
  }
  assert.deepEqual(peer, before);
});
test('wall-pinned six-player queues preserve all body and solid clearances under continuous pressure', () => {
  const state = fighting({ teamSize: 3 });
  for (const f of state.players) Object.assign(f, { x: -4, y: 0, z: 6.32 + f.id * .64 });
  for (let tick = 0; tick < 240; tick++) {
    game.step(state, state.players.map(f => input({ up: true }, f)));
    for (let i = 0; i < state.players.length; i++) {
      assert.ok(state.players[i].z >= 6.32 - 1e-8);
      if (i) assert.ok(state.players[i].z - state.players[i - 1].z >= .64 - 1e-8);
    }
  }
});
test('prediction repairs stale peer overlap and slides around a body without changing peer state', () => {
  const arena = fixtureMap([]), peer = fixturePlayer(), f = fixturePlayer();
  Object.assign(peer, { id: 1, x: 0, z: 0 }); Object.assign(f, { x: 0, z: .25, vz: -5.4 });
  const before = game.cloneState(peer);
  game.predictLocalMovement(f, input({ up: true }), arena, 1, [peer]); close(f.z, .64, 2e-8); close(f.vz, 0);
  for (let i = 0; i < 120; i++) {
    game.predictLocalMovement(f, input({ up: true, right: true }), arena, 1, [peer]);
    assert.ok(Math.hypot(f.x - peer.x, f.z - peer.z) >= .64 - 1e-8);
  }
  assert.ok(f.x > 2); assert.ok(f.z < 0); assert.deepEqual(peer, before);
});
test('prediction respects peer headroom but lets airborne or dead bodies clear vertically', () => {
  const arena = fixtureMap([]), peer = fixturePlayer(), f = fixturePlayer();
  Object.assign(peer, { id: 1, x: 0, z: 0, y: 1.3, grounded: false }); Object.assign(f, { x: 0, z: 0, crouching: true });
  game.predictLocalMovement(f, input(), arena, 1, [peer]); assert.equal(f.crouching, true); close(f.x, 0); close(f.z, 0);
  peer.alive = false; game.predictLocalMovement(f, input(), arena, 1, [peer]); assert.equal(f.crouching, false);
  peer.alive = true; peer.y = 0;
  Object.assign(f, { x: -.34, y: 1.9, z: 0, vx: 5.4, vy: 0, grounded: false });
  game.predictLocalMovement(f, input({ right: true }), arena, 1, [peer]); assert.ok(f.x > -.32); assert.equal(f.grounded, false);
});
test('falling onto another player yields sideways without moving the lower body or granting a boost', () => {
  const state = lane(fighting(), { ax: 20, az: 0, bx: 20, bz: 0 }), [a, b] = state.players;
  Object.assign(a, { y: 1.8, grounded: false });
  const predicted = game.cloneState(a), peer = game.cloneState(b);
  game.predictLocalMovement(predicted, input(), state.mapId, 1, [peer]); game.step(state, neutral(state));
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz']) close(predicted[key], a[key], 2e-8);
  close(b.x, 20); close(b.z, 0); assert.ok(a.y < 1.8); assert.equal(a.grounded, false); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= .64 - 1e-8);
  game.step(state, [input({ jump: true }, a), input({}, b)]); assert.ok(a.vy < 0);
});
test('tiny stale-peer corrections cannot push a player through a rounded solid corner', () => {
  const arena = fixtureMap([{ x: 0, y: 0, z: 0, w: 2, h: 3, d: 2 }]);
  for (const overlap of [1e-6, 1e-5, 1e-4]) {
    const f = fixturePlayer(), peer = fixturePlayer(), corner = -.32 / Math.SQRT2;
    Object.assign(f, { x: corner, z: corner }); Object.assign(peer, { id: 1, x: corner - (.64 - overlap) / Math.SQRT2, z: corner - (.64 - overlap) / Math.SQRT2 });
    const before = game.cloneState(peer);
    game.predictLocalMovement(f, input(), arena, 1, [peer]);
    assert.ok(Math.hypot(f.x, f.z) >= .32 - 1e-8); assert.deepEqual(peer, before);
  }
});
test('oblique airborne player contacts against the canal boundary converge without penetration', () => {
  const state = fighting({ mapId: 'canal' }), [a, b] = state.players;
  Object.assign(a, { x: -24.68, y: .7415, z: 15.85910775469209, vx: -1.4271347465374, vy: 3.64, vz: 3.3048976299044037, grounded: false });
  Object.assign(b, { x: -24.09389368513133, y: 0, z: 16.116166867876334, vx: -.051151399110349605, vy: 0, vz: .11845422311820819, grounded: true });
  game.step(state, [input({ left: true, right: true, jump: true, yaw: .3396092126011499 }, a), input({ up: true, yaw: -1.4999219264544963 }, b)]);
  assert.ok(a.x >= -24.68 - 1e-8); assert.ok(b.x >= -24.68 - 1e-8); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= .64 - 1e-8);
});
test('body correction off a crate refreshes grounded state before the next jump', () => {
  const state = fighting(), [a, b] = state.players;
  Object.assign(a, { x: 1.5, y: 1.2, z: 12.2, grounded: true }); Object.assign(b, { x: 1.05, y: 1.2, z: 12.2, grounded: true });
  game.step(state, neutral(state)); assert.ok(a.x > 1.52); assert.equal(a.grounded, false); close(a.y, 1.2);
  game.step(state, [input({ jump: true }, a), input({}, b)]); assert.ok(a.vy < 0); assert.ok(a.y < 1.2);
});
test('prediction and authority use the same local movement physics', () => {
  const state = lane(fighting(), { ax: 20, az: 10, bx: -20, bz: -18 }), predicted = game.cloneState(state.players[0]);
  for (let i = 0; i < 240; i++) { const keys = input({ up: true, walk: i > 90, jump: i === 30, yaw: .2 }, state.players[0]); game.predictLocalMovement(predicted, keys, state.mapId); game.step(state, [keys, input({}, state.players[1])]); }
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz']) close(predicted[key], state.players[0][key]);
});
function atSite(state, id = 0) { const f = state.players[id], site = game.MAPS[state.mapId].sites[0]; Object.assign(f, { x: site.x, z: site.z, y: 0, vx: 0, vy: 0, vz: 0, grounded: true }); return f; }
const hold = (state, id, ticks, extra = {}) => { for (let i = 0; i < ticks; i++) { const keys = neutral(state); keys[id] = input({ interact: true, ...extra }, state.players[id]); game.step(state, keys); } };
test('plant needs three continuous stationary seconds inside a real site', () => {
  const state = fighting(), f = atSite(state); hold(state, 0, 359); assert.equal(state.bomb.status, 'carried'); assert.equal(state.bomb.plantTicks, 359);
  advance(state, 1); assert.equal(state.bomb.plantTicks, 0); hold(state, 0, 360); assert.equal(state.bomb.status, 'planted'); assert.equal(state.bomb.siteId, 'A'); assert.equal(state.bomb.timerTicks, 4200); assert.equal(f.interaction, null);
});
test('movement, jumping, fire and damage interrupt site interaction', () => {
  for (const extra of [{ up: true }, { jump: true }, { fire: true }]) { const state = fighting(); atSite(state); hold(state, 0, 100); hold(state, 0, 25, extra); assert.equal(state.bomb.plantTicks, 0); }
  const state = fighting(), f = atSite(state); Object.assign(state.players[1], { x: f.x, z: f.z - 6, yaw: Math.PI, pitch: Math.atan2(.85 - 1.62, 6) }); hold(state, 0, 100);
  game.step(state, [input({ interact: true }, f), input({ fire: true }, state.players[1])]); assert.equal(f.hp, 172); assert.equal(state.bomb.plantTicks, 0);
});
test('the carrier drops on death and an alive teammate can physically recover the charge', () => {
  const state = fighting({ teamSize: 2 }); Object.assign(state.players[0], { x: 20, z: 0 }); Object.assign(state.players[1], { x: 20, z: 2 }); Object.assign(state.players[2], { x: 20, z: -5, yaw: Math.PI }); Object.assign(state.players[3], { x: -20, z: -18 });
  state.players[0].hp = 100;
  state.players[2].weapon = 'marksman'; state.players[2].ammo = 8; shot(state, 2); assert.equal(state.players[0].alive, false); assert.equal(state.bomb.status, 'dropped');
  advance(state, 30, [input({}, state.players[0]), input({ up: true }, state.players[1]), input({}, state.players[2]), input({}, state.players[3])]); assert.equal(state.bomb.status, 'carried'); assert.equal(state.bomb.carrierId, 1);
});
test('an airborne carrier death drops a charge that falls to reachable solid ground', () => {
  const state = fighting({ teamSize: 2 }); Object.assign(state.players[0], { x: 20, y: 4, z: 0, grounded: false }); Object.assign(state.players[2], { x: 20, z: -5, yaw: Math.PI, pitch: Math.atan2(4.15, 5), weapon: 'marksman', ammo: 8 });
  state.players[0].hp = 100;
  shot(state, 2); assert.equal(state.players[0].alive, false); assert.equal(state.bomb.status, 'dropped'); assert.ok(state.bomb.y > 3);
  advance(state, 120); assert.equal(state.bomb.status, 'dropped'); close(state.bomb.y, 0); close(state.bomb.vy, 0);
});
test('a planted charge remains live after the last attacker dies and can win by detonation', () => {
  const state = fighting(), f = atSite(state); hold(state, 0, 360); f.hp = 100; Object.assign(state.players[1], { x: f.x, z: f.z - 5, yaw: Math.PI }); state.players[1].weapon = 'marksman'; state.players[1].ammo = 8; shot(state, 1);
  assert.equal(f.alive, false); assert.equal(state.phase, 'fight'); advance(state, state.bomb.timerTicks); assert.equal(state.phase, 'roundEnd'); assert.equal(state.roundWinner, 0); assert.equal(state.roundReason, 'explosion');
});
test('defuse requires five continuous seconds and release or distance resets progress', () => {
  const state = fighting(), f = atSite(state); hold(state, 0, 360); Object.assign(state.players[1], { x: f.x + 1, z: f.z, vx: 0, vz: 0 });
  hold(state, 1, 300); assert.equal(state.bomb.defuseTicks, 300); advance(state, 1); assert.equal(state.bomb.defuseTicks, 0);
  hold(state, 1, 599); assert.equal(state.phase, 'fight'); hold(state, 1, 1); assert.equal(state.bomb.status, 'defused'); assert.equal(state.roundWinner, 1); assert.equal(state.roundReason, 'defuse');
});
test('a nearby charge cannot be defused through a solid low-cover corner', () => {
  const state = fighting(); Object.assign(state.players[0], { x: -14.4, z: -10.9 }); hold(state, 0, 360); assert.equal(state.bomb.status, 'planted');
  Object.assign(state.players[1], { x: -13.6, z: -9.9, crouching: true }); assert.equal(game.canInteractWithBomb(state, state.players[1]), false); hold(state, 1, 600, { crouch: true }); assert.equal(state.bomb.defuseTicks, 0); assert.equal(state.bomb.status, 'planted');
  Object.assign(state.players[1], { x: -13.5, z: -10.9 }); assert.equal(game.canInteractWithBomb(state, state.players[1]), true); hold(state, 1, 600); assert.equal(state.bomb.status, 'defused');
});
test('bomb expiry beats an unfinished defuse and preplant timeout rewards defenders', () => {
  const expired = fighting(), f = atSite(expired); hold(expired, 0, 360); Object.assign(expired.players[1], { x: f.x + 1, z: f.z }); expired.bomb.timerTicks = 10; hold(expired, 1, 10); assert.equal(expired.roundReason, 'explosion');
  const timeout = fighting(); advance(timeout, game.WORLD.roundSeconds * 120); assert.equal(timeout.roundWinner, 1); assert.equal(timeout.roundReason, 'time');
});
test('full seven-round normal-input match preserves scores, switches sides and requires a rematch', () => {
  const state = fighting({ teamSize: 3, mapId: 'depot' });
  // Legal inactivity is a complete defender strategy: every time-limit round is driven by step.
  for (let round = 1; round <= 7; round++) {
    assert.equal(state.round, round); advance(state, state.roundTicks); assert.equal(state.roundReason, 'time');
    if (round === 7) { assert.equal(state.phase, 'matchEnd'); break; }
    advance(state, 4 * 120 + 2 * 120 + 8 * 120); assert.equal(state.phase, 'fight');
  }
  assert.deepEqual(state.scores, [4, 3]); assert.equal(state.winner, 0); assert.equal(state.attackTeam, 1); assert.ok(state.events.length <= game.EVENT_LIMIT);
  const before = game.cloneState(state.players); advance(state, 100, state.players.map(f => input({ up: true, fire: true }, f))); assert.deepEqual(state.players, before);
  game.startMatch(state); assert.deepEqual(state.scores, [0, 0]); assert.equal(state.phase, 'countdown'); assert.equal(state.capacity, 6); assert.equal(state.mapId, 'depot');
});
test('authored maps have two reachable sites and distinct geometry for every mode', () => {
  for (const mapId of Object.keys(game.MAPS)) for (const siteIndex of [0, 1]) {
    const arena = game.MAPS[mapId], state = fighting({ mapId }); const f = state.players[0];
    // Use each arena's ground flank with ordinary direction buttons, then plant.
    const driveTo = (x, z) => {
      for (let i = 0; i < 2500 && Math.hypot(f.x - x, f.z - z) > .25; i++) {
        const dx = x - f.x, dz = z - f.z, keys = neutral(state); keys[0] = input({ up: Math.hypot(dx, dz) > .25, walk: Math.hypot(dx, dz) < 1, yaw: Math.atan2(dx, -dz) }, f); game.step(state, keys);
      }
      advance(state, 18); assert.ok(Math.hypot(f.x - x, f.z - z) < .3, `${mapId} route stopped ${f.x},${f.z}`);
    };
    const paris = mapId === 'paris', flank = (siteIndex ? 1 : -1) * (paris ? 23 : 20), crossing = paris ? -21 : siteIndex && mapId === 'depot' ? -10 : -7, site = arena.sites[siteIndex];
    if (arena.groundRoutes) {
      const route = arena.groundRoutes.find(route => route.siteId === site.id);
      assert.ok(route, `${mapId} authored ground flank to ${site.id}`);
      for (const point of route.waypoints) driveTo(point.x, point.z);
    } else if (mapId === 'market' || mapId === 'lockdown') {
      // Compact halls end at 18 m. Their outer delivery lanes bypass the
      // shops/workshops, while the north cross-lane reaches both sites.
      const deliveryFlank = (siteIndex ? 1 : -1) * (arena.bounds.maxX - .6);
      driveTo(deliveryFlank, 15.5); driveTo(deliveryFlank, site.z); driveTo(site.x, site.z);
    } else {
      // Paris delivery stairs occupy the inner lane, so skirt them at the perimeter.
      if (paris) driveTo(f.x, 20.5);
      driveTo(flank, paris ? 20.5 : 18); driveTo(flank, crossing); driveTo(site.x, crossing); driveTo(site.x, site.z);
    }
    hold(state, 0, 360); assert.equal(state.bomb.status, 'planted', `${mapId} ${site.id}`);
  }
  assert.equal(new Set(Object.values(game.MAPS).map(map => JSON.stringify(map.colliders))).size, Object.keys(game.MAPS).length);
});
test('every authored map screens all three-versus-three spawn headshot lanes', () => {
  for (const mapId of Object.keys(game.MAPS)) {
    const state = game.createState({ teamSize: 3, mapId });
    for (const a of state.players.filter(f => f.team === 0)) for (const b of state.players.filter(f => f.team === 1)) {
      const origin = { x: a.x, y: game.eyeHeight(a), z: a.z }, dx = b.x - a.x, dy = 1.64 - origin.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz), hit = game.traceShot(state, a.id, origin, { x: dx / len, y: dy / len, z: dz / len });
      assert.equal(hit.kind, 'wall', `${mapId} spawn ${a.id} -> ${b.id}`);
    }
  }
});
test('invalid input cannot poison finite player state or invent keypresses', () => {
  const state = fighting(); game.step(state, [{ up: 1, fire: 'true', yaw: Infinity, pitch: NaN }, {}]); assert.equal(state.players[0].ammo, 24); assert.equal(state.players[0].x, -3);
  game.step(state, [{ yaw: 400, pitch: -400 }, {}]); assert.equal(state.players[0].yaw, Math.PI); assert.equal(state.players[0].pitch, -1.35);
  for (const f of state.players) for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'hp', 'ammo']) assert.ok(Number.isFinite(f[key]));
});

test('all primary loadouts preserve the original sixteen and keep finite ammunition between rounds', () => {
  const state = game.createState();
  assert.deepEqual(Object.keys(game.WEAPONS).slice(0, 16), ['carbine', 'smg', 'marksman', 'pistol', 'shotgun', 'burst', 'sniper', 'lmg', 'crossbow', 'revolver', 'pdw', 'autoshotgun', 'battlerifle', 'dualpistols', 'dualsmg', 'slugshotgun']);
  assert.equal(Object.keys(game.WEAPONS).length, 36);
  for (const weapon of Object.values(game.WEAPONS)) {
    assert.equal(game.selectLoadout(state, 0, weapon.id).ok, true);
    assert.equal(state.players[0].ammo, weapon.magazine); assert.equal(state.players[0].reserve, weapon.reserve);
  }
  game.selectLoadout(state, 0, 'burst');
  game.startMatch(state); advance(state, 1320); lane(state);
  shot(state, 0, { yaw: Math.PI / 2 }); assert.equal(state.players[0].ammo, game.WEAPONS.burst.magazine - 1);
  assert.equal(game.selectLoadout(state, 0, 'pistol').ok, false);
});
test('pistol and pump shotgun require release between attacks and respect their cycle', () => {
  for (const id of ['pistol', 'shotgun']) {
    const state = game.createState(); game.selectLoadout(state, 0, id); game.startMatch(state); advance(state, 1320); lane(state);
    const f = state.players[0], w = game.WEAPONS[id], held = [input({ fire: true, yaw: Math.PI / 2 }, f), input({}, state.players[1])];
    advance(state, w.cooldown * 3, held); assert.equal(f.shots, 1); assert.equal(f.ammo, w.magazine - 1);
    advance(state, 1); shot(state, 0, { yaw: Math.PI / 2 }); assert.equal(f.shots, 2);
    advance(state, 1); shot(state, 0, { yaw: Math.PI / 2 }); assert.equal(f.shots, 2, 'clicking during recovery cannot bypass the weapon cycle');
  }
});
test('a burst commits exactly three shots at indexed intervals, even after releasing fire', () => {
  const state = game.createState(); game.selectLoadout(state, 0, 'burst'); game.startMatch(state); advance(state, 1320); lane(state);
  const f = state.players[0]; shot(state, 0, { yaw: Math.PI / 2 }); const start = state.tick;
  advance(state, 7); assert.equal(f.shots, 1); advance(state, 1); assert.equal(f.shots, 2);
  advance(state, 8); assert.equal(f.shots, 3); assert.equal(f.burstRemaining, 0);
  assert.deepEqual(state.events.filter(e => e.type === 'shot' && e.playerId === 0).map(e => e.tick - start), [0, 8, 16]);
  advance(state, 100, [input({ fire: true, yaw: Math.PI / 2 }, f), input({}, state.players[1])]); assert.equal(f.shots, 3, 'holding through recovery does not start another burst');
  advance(state, 1); shot(state, 0, { yaw: Math.PI / 2 }); assert.equal(f.shots, 4);
});
test('short burst magazines and weapon swap conserve ammunition and cancel unfinished bursts', () => {
  const state = game.createState(); game.selectLoadout(state, 0, 'burst'); game.startMatch(state); advance(state, 1320); lane(state);
  const f = state.players[0]; f.ammo = 2; shot(state, 0, { yaw: Math.PI / 2 }); advance(state, 8); assert.equal(f.ammo, 0); assert.equal(f.shots, 2); assert.equal(f.burstRemaining, 0);
  f.ammo = 6; f.shotCooldown = 0; advance(state, 1); shot(state, 0, { yaw: Math.PI / 2 });
  game.step(state, [input({ swap: true }, f), input({}, state.players[1])]); assert.equal(f.slot, 'sword'); assert.equal(f.burstRemaining, 0);
  advance(state, 100); assert.equal(f.ammo, 5); assert.equal(f.shots, 3);
});
test('shotgun pellets have deterministic finite spread, individual cover contacts and close-range falloff', () => {
  const states = Array.from({ length: 2 }, () => {
    const state = game.createState(); game.selectLoadout(state, 0, 'shotgun'); game.startMatch(state); advance(state, 1320); lane(state); return state;
  });
  for (const state of states) shot(state);
  const pellets = states[0].events.filter(e => e.type === 'shot'); assert.equal(pellets.length, 8);
  assert.deepEqual(pellets, states[1].events.filter(e => e.type === 'shot'));
  const first = pellets[0]; close(first.dx, 0); close(first.dy, 0); assert.equal(first.hitKind, 'head');
  assert.ok(new Set(pellets.map(e => `${e.dx},${e.dy},${e.dz}`)).size > 6);
  assert.equal(states[0].players[0].ammo, 5); assert.equal(states[0].players[0].shots, 1);
  const covered = lane(fighting(), { ax: -4, az: 8, bx: -4, bz: -8 }); Object.assign(covered.players[0], { weapon: 'shotgun', ammo: 6 }); shot(covered);
  assert.equal(covered.players[1].hp, 200); assert.ok(covered.events.filter(e => e.type === 'shot').every(e => e.hitKind === 'wall'));
  const damages = [];
  for (const distance of [2, 15, 37]) {
    const state = lane(fighting(), { az: 20, bz: 20 - distance }); Object.assign(state.players[0], { weapon: 'shotgun', ammo: 6 }); shot(state, 0, { pitch: Math.atan2(.85 - 1.62, distance) }); damages.push(200 - state.players[1].hp);
  }
  assert.ok(damages[0] > damages[1]); assert.equal(damages[2], 0);
});
test('ADS settles over eighteen ticks, reduces spread and recoil, and prediction matches its speed tradeoff', () => {
  const state = lane(fighting()), f = state.players[0];
  advance(state, game.ADS.ticks, [input({ aim: true }, f), input({}, state.players[1])]); assert.equal(f.aiming, true); assert.equal(f.aimTicks, game.ADS.ticks);
  const predicted = game.cloneState(f);
  for (let tick = 0; tick < 60; tick++) {
    const keys = input({ right: true, aim: true }, f); game.predictLocalMovement(predicted, keys, state.mapId);
    game.step(state, [keys, input({}, state.players[1])]); close(predicted.x, f.x, 1e-7); close(predicted.vx, f.vx, 1e-7);
  }
  close(Math.hypot(f.vx, f.vz), game.WEAPONS.carbine.speed * game.ADS.speedMultiplier);
  const hip = game.cloneState(state); hip.players[0].aiming = false; hip.players[0].aimTicks = 0;
  shot(state, 0, { right: true, aim: true, yaw: Math.PI / 2 }); shot(hip, 0, { right: true, yaw: Math.PI / 2 });
  const adsShot = state.events.findLast(e => e.type === 'shot'), hipShot = hip.events.findLast(e => e.type === 'shot');
  assert.ok(Math.abs(adsShot.dz) < Math.abs(hipShot.dz)); assert.ok(f.recoil < hip.players[0].recoil);
  advance(state, 9); assert.equal(f.aiming, false); assert.equal(f.aimTicks, 0);
});
const equipSword = f => { f.meleeWeapon = 'sword'; f.inventory[0].weapon = 'sword'; return f; };
const swordReady = state => { const f = equipSword(state.players[0]); game.step(state, [input({ swap: true }, f), ...neutral(state).slice(1)]); advance(state, 1); assert.equal(f.slot, 'sword'); return f; };
test('sword windup, active contact and recovery apply one hit per swing without spending gun ammunition', () => {
  const state = lane(fighting(), { az: .7, bz: -.7 }), f = swordReady(state), ammo = f.ammo;
  shot(state); assert.equal(f.meleePhase, 'startup'); assert.equal(f.meleeTicks, 72); assert.equal(state.players[1].hp, 200);
  advance(state, game.MELEE.startupTicks - 1); assert.equal(state.players[1].hp, 200);
  advance(state, 1); assert.equal(f.meleePhase, 'active'); assert.equal(f.meleeTicks, game.MELEE.activeTicks + game.MELEE.recoveryTicks);
  assert.equal(state.players[1].hp, 200, 'the central target is hit when the finite blade path reaches it');
  advance(state, game.MELEE.activeTicks - 1); assert.equal(f.meleePhase, 'active'); assert.equal(state.players[1].hp, 145);
  const contact = state.events.find(e => e.type === 'meleeHit'), commitment = state.events.find(e => e.type === 'meleeStart');
  assert.ok(contact.tick >= commitment.tick + game.MELEE.startupTicks && contact.tick < commitment.tick + game.MELEE.startupTicks + game.MELEE.activeTicks);
  advance(state, 1); assert.equal(f.meleePhase, 'recovery'); assert.equal(f.meleeTicks, game.MELEE.recoveryTicks); assert.equal(state.players[1].hp, 145);
  advance(state, game.MELEE.recoveryTicks); assert.equal(f.meleePhase, 'idle'); assert.equal(f.meleeTicks, 0); assert.equal(f.ammo, ammo);
  assert.equal(state.events.filter(e => e.type === 'meleeHit').length, 1);
});
test('sword commits attack direction and cannot reach through solid cover, allies or vertical gaps', () => {
  const fullSwing = game.MELEE.startupTicks + game.MELEE.activeTicks;
  const turn = lane(fighting(), { az: .7, bz: -.7 }), f = swordReady(turn); shot(turn, 0, { yaw: Math.PI }); advance(turn, fullSwing, [input({ yaw: 0 }, f), input({}, turn.players[1])]); assert.equal(turn.players[1].hp, 200, 'turning after windup does not rotate a committed strike');
  const covered = lane(fighting({ mapId: 'canal' }), { ax: 5.27, az: -4.8, bx: 7.33, bz: -4.8 });
  Object.assign(covered.players[0], { yaw: Math.PI / 2 }); swordReady(covered); shot(covered); advance(covered, fullSwing);
  assert.ok(Math.hypot(covered.players[0].x - covered.players[1].x, covered.players[0].z - covered.players[1].z) < game.MELEE.reach, 'target is within the sword range across the narrow stone pillar');
  assert.equal(covered.players[1].hp, 200);
  const team = lane(fighting({ teamSize: 2 }), { az: 1.4, bz: -.65 }); Object.assign(team.players[1], { x: 20, z: .6 }); Object.assign(team.players[3], { x: -20, z: -18 }); swordReady(team); shot(team); advance(team, fullSwing); assert.equal(team.players[1].hp, 200); assert.equal(team.players[2].hp, 200, 'nearest friendly body blocks sword contact');
  const high = lane(fighting(), { az: .7, bz: -.7 }); Object.assign(high.players[1], { y: 4, grounded: false }); swordReady(high); shot(high); advance(high, fullSwing); assert.equal(high.players[1].hp, 200);
});
test('sword attacks trade in the same authoritative active tick and swap cannot bypass recovery', () => {
  const trade = lane(fighting(), { az: .7, bz: -.7 }); for (const f of trade.players) { equipSword(f); f.slot = 'sword'; f.hp = 50; }
  game.step(trade, trade.players.map(f => input({ fire: true }, f))); const commitmentTick = trade.tick;
  advance(trade, game.MELEE.startupTicks - 1); assert.deepEqual(trade.players.map(f => f.alive), [true, true]);
  advance(trade, 1); assert.ok(trade.players.every(f => f.meleePhase === 'active'));
  for (let tick = 1; tick < game.MELEE.activeTicks && trade.phase === 'fight'; tick++) advance(trade, 1);
  assert.deepEqual(trade.players.map(f => f.alive), [false, false]); assert.deepEqual(trade.players.map(f => f.kills), [1, 1]);
  const contacts = trade.events.filter(e => e.type === 'damage' && e.attack === 'sword');
  assert.equal(contacts.length, 2); assert.equal(contacts[0].tick, contacts[1].tick, 'both accepted contacts resolve before either lethal hit removes the opposing attack');
  assert.ok(contacts[0].tick >= commitmentTick + game.MELEE.startupTicks && contacts[0].tick < commitmentTick + game.MELEE.startupTicks + game.MELEE.activeTicks);
  assert.deepEqual(contacts.map(e => e.damage), [50, 50]); assert.deepEqual(trade.players.map(f => f.hp), [0, 0]);
  const state = lane(fighting()), f = swordReady(state); shot(state, 0, { yaw: Math.PI / 2 });
  advance(state, 1); game.step(state, [input({ swap: true }, f), input({}, state.players[1])]); advance(state, 1); game.step(state, [input({ swap: true }, f), input({}, state.players[1])]); advance(state, 1); shot(state, 0, { yaw: Math.PI / 2 });
  assert.equal(state.events.filter(e => e.type === 'meleeStart').length, 1); assert.ok(f.meleeCooldown > 0);
});
test('a potion costs one round charge, takes two seconds, heals sixty and slows movement', () => {
  const state = lane(fighting()), f = collectUtility(state, state.players[0], ['heal']); f.hp = 35;
  game.step(state, [input({ heal: true }, f), input({}, state.players[1])]); assert.equal(f.potions, 0); assert.equal(f.healTicks, game.HEAL.ticks); assert.equal(f.hp, 35); assert.equal(f.healing, true);
  advance(state, 100, [input({ right: true }, f), input({}, state.players[1])]); close(f.vx, game.WEAPONS.carbine.speed * game.HEAL.speedMultiplier);
  advance(state, game.HEAL.ticks - 101); assert.equal(f.hp, 35); advance(state, 1); assert.equal(f.hp, 95); assert.equal(f.healTicks, 0); assert.equal(f.healing, false);
  advance(state, 1); game.step(state, [input({ heal: true }, f), input({}, state.players[1])]); assert.equal(f.healTicks, 0);
  const full = lane(fighting()); collectUtility(full, full.players[0], ['heal']); game.step(full, [input({ heal: true }, full.players[0]), input({}, full.players[1])]); assert.equal(full.players[0].potions, 1, 'full-health input does not waste a potion');
});
test('potion healing is capped and fire, jump, swap, reload, interaction and grenade interrupt channels', () => {
  const capped = lane(fighting()), f = collectUtility(capped, capped.players[0], ['heal']); f.hp = 185; game.step(capped, [input({ heal: true }, f), input({}, capped.players[1])]); advance(capped, game.HEAL.ticks); assert.equal(f.hp, 200);
  for (const action of ['fire', 'jump', 'swap', 'reload', 'interact', 'grenade']) {
    const state = lane(fighting()), player = collectUtility(state); player.hp = 60;
    game.step(state, [input({ heal: true }, player), input({}, state.players[1])]); advance(state, 10);
    game.step(state, [input({ [action]: true, yaw: Math.PI / 2 }, player), input({}, state.players[1])]);
    assert.equal(player.healTicks, 0, action); assert.equal(player.healing, false); assert.equal(player.hp, 60); assert.equal(player.potions, 0);
  }
});
test('damage on the final potion tick cancels healing and lethal damage cannot revive its target', () => {
  for (const hp of [60, 20]) {
    const state = lane(fighting()), [f, attacker] = state.players; f.hp = hp; attacker.weapon = 'pistol'; attacker.ammo = 12;
    collectUtility(state, f, ['heal']);
    game.step(state, [input({ heal: true }, f), input({}, attacker)]); advance(state, game.HEAL.ticks - 1); assert.equal(f.healTicks, 1);
    game.step(state, [input({}, f), input({ fire: true, pitch: Math.atan2(.85 - 1.62, 10) }, attacker)]);
    assert.equal(f.hp, Math.max(0, hp - 34)); assert.equal(f.healTicks, 0); assert.equal(f.healing, false); assert.equal(f.alive, hp > 34);
    assert.equal(state.events.some(e => e.type === 'healComplete'), false);
  }
});
test('setup-held utility and sword edges cannot trigger latent actions when combat unlocks', () => {
  const state = game.createState(); game.startMatch(state);
  collectUtility(state);
  const held = [input({ swap: true, grenade: true, heal: true, fire: true }), input()]; advance(state, 1320, held); advance(state, 10, held);
  const f = state.players[0]; assert.equal(f.slot, 'primary'); assert.equal(f.grenades, 1); assert.equal(f.potions, 1); assert.equal(f.ammo, 24); assert.equal(state.grenades.length, 0);
  advance(state, 1); game.step(state, [input({ swap: true }, f), input({}, state.players[1])]); assert.equal(f.slot, 'sword');
});
test('quick grenade throws spend one charge, lock gun fire and honor the full 2.4 second fuse', () => {
  const state = lane(fighting()), f = collectUtility(state, state.players[0], ['grenade']);
  game.step(state, [input({ grenade: true, fire: true, pitch: .3 }, f), input({}, state.players[1])]); const thrownAt = state.tick;
  assert.equal(f.grenades, 0); assert.equal(f.grenadeThrowTicks, 24); assert.equal(f.ammo, 24); assert.equal(state.grenades.length, 1); assert.equal(state.grenades[0].fuseTicks, 288);
  advance(state, 23, [input({ fire: true }, f), input({}, state.players[1])]); assert.equal(f.ammo, 24);
  advance(state, 288 - 24); assert.equal(state.grenades.length, 1); advance(state, 1); assert.equal(state.grenades.length, 0);
  assert.equal(state.events.findLast(e => e.type === 'grenadeExplosion').tick - thrownAt, 288);
  advance(state, 1); game.step(state, [input({ grenade: true }, f), input({}, state.players[1])]); assert.equal(state.grenades.length, 0);
});
test('round reset restores knife and gun without free supplies, clears actions and preserves gun choice and statistics', () => {
  const state = lane(fighting()), f = state.players[0]; Object.assign(f, { weapon: 'pistol', ammo: 1, potions: 0, grenades: 0, slot: 'sword', kills: 2, damageDealt: 140, aimTicks: 18, aiming: true, meleeTicks: 30, meleePhase: 'active' });
  state.grenades.push({ id: 999, playerId: 0, team: 0, x: 20, y: .12, z: 10, vx: 0, vy: 0, vz: 0, radius: .12, fuseTicks: 2, bornTick: state.tick - 1, bounces: 0 });
  state.roundTicks = 1; game.step(state, neutral(state)); assert.equal(state.phase, 'roundEnd'); assert.equal(state.grenades.length, 0); assert.equal(f.meleeTicks, 0); assert.equal(f.aimTicks, 0);
  advance(state, 4 * game.TICK_RATE); const next = state.players[0]; assert.equal(next.slot, 'primary'); assert.equal(next.weapon, 'pistol'); assert.equal(next.ammo, 12); assert.equal(next.potions, 0); assert.equal(next.grenades, 0); assert.equal(next.kills, 2); assert.equal(next.damageDealt, 140);
  assert.equal(next.hp, 200); assert.equal(next.maxHp, 200); assert.equal(next.meleeWeapon, 'knife');
  assert.equal(next.meleeTicks, 0); assert.equal(next.healTicks, 0); assert.equal(next.aimTicks, 0); assert.equal(state.grenades.length, 0);
});

test('grenade launch uses the current input aim and self damage never awards offensive statistics', () => {
  const launch = lane(fighting()); collectUtility(launch, launch.players[0], ['grenade']); game.step(launch, [input({ grenade: true, yaw: Math.PI / 2, pitch: .4 }, launch.players[0]), input({}, launch.players[1])]);
  assert.ok(launch.grenades[0].vx > 9); assert.ok(Math.abs(launch.grenades[0].vz) < 1e-6); assert.ok(launch.grenades[0].vy > 6);
  const self = lane(fighting()), f = self.players[0]; f.hp = 100;
  self.grenades.push({ id: 1, playerId: f.id, team: f.team, x: f.x, y: .12, z: f.z, vx: 0, vy: 0, vz: 0, radius: .12, fuseTicks: 1, bornTick: self.tick - 1, bounces: 0 });
  game.step(self, neutral(self)); assert.equal(f.alive, false); assert.equal(f.hp, 0); assert.equal(f.kills, 0); assert.equal(f.damageDealt, 0); assert.equal(f.deaths, 1);
  const kill = self.events.findLast(e => e.type === 'kill'); assert.equal(kill.attack, 'grenade'); assert.equal(kill.playerId, f.id);
});
test('utility attack events preserve kill credit and planted-round grenades remain live after their owner dies', () => {
  const state = lane(fighting({ teamSize: 2 }), { az: 5, bz: -5 }), thrower = state.players[0], target = state.players[2];
  Object.assign(state.bomb, { status: 'planted', carrierId: null, x: -13, y: 0, z: -12, siteId: 'A', timerTicks: 1000 });
  Object.assign(thrower, { hp: 0, alive: false });
  target.hp = 100;
  state.grenades.push({ id: 1, playerId: thrower.id, team: thrower.team, x: target.x, y: .12, z: target.z, vx: 0, vy: 0, vz: 0, radius: .12, fuseTicks: 2, bornTick: state.tick - 1, bounces: 0 });
  game.step(state, neutral(state)); assert.equal(state.grenades.length, 1); assert.equal(state.phase, 'fight');
  game.step(state, neutral(state)); assert.equal(target.alive, false); assert.equal(thrower.kills, 1); assert.equal(thrower.damageDealt, 100); assert.equal(state.phase, 'fight');
  const kill = state.events.findLast(e => e.type === 'kill'); assert.equal(kill.playerId, thrower.id); assert.equal(kill.weapon, 'grenade');
});
test('bomb channels cannot overlap sword startup, grenade release or potion actions', () => {
  for (const action of ['sword', 'grenade', 'heal']) {
    const state = fighting(), f = state.players[0]; Object.assign(f, { x: -13, z: -12, hp: 60 });
    if (action !== 'sword') collectUtility(state, f, [action]);
    if (action === 'sword') { f.slot = 'sword'; shot(state, 0, { yaw: Math.PI }); }
    else game.step(state, [input({ [action]: true }, f), input({}, state.players[1])]);
    game.step(state, [input({ interact: true }, f), input({}, state.players[1])]);
    if (action === 'heal') { assert.equal(f.healTicks, 0); assert.equal(f.healing, false); }
    else { assert.equal(state.bomb.plantTicks, 0); assert.equal(f.interaction, null); }
  }
});

test('six shotgun volleys preserve every player fire event through a four-tick utility-heavy snapshot interval', () => {
  for (const detonate of [false, true]) {
    const state = fighting({ teamSize: 3 });
    for (const f of state.players) Object.assign(f, { x: 18 + f.id % 3 * 2, y: 0, z: f.team ? -1 : 1, yaw: f.team ? Math.PI : 0, pitch: Math.atan2(.85 - 1.62, 2), weapon: 'shotgun', ammo: 6 });
    for (const f of state.players) collectUtility(state, f);
    if (detonate) for (const f of state.players) state.grenades.push({ id: f.id + 1, playerId: f.id, team: f.team, x: f.x, y: .12, z: f.z, vx: 0, vy: 0, vz: 0, radius: .12, fuseTicks: 3, bornTick: state.tick - 1, bounces: 0 });
    const startId = state.eventId;
    game.step(state, state.players.map(f => input({ fire: true }, f)));
    assert.deepEqual(state.players.map(f => f.hp), [104, 104, 104, 104, 104, 104]);
    assert.equal(state.events.filter(e => e.id > startId && e.type === 'shot').length, 48);
    assert.equal(state.events.filter(e => e.id > startId && e.type === 'damage').length, 48);
    if (detonate) advance(state, 3);
    else {
      game.step(state, state.players.map(f => input({ heal: true }, f)));
      game.step(state, state.players.map(f => input({ swap: true, grenade: true }, f)));
      game.step(state, neutral(state));
    }
    assert.ok(state.events.length <= game.EVENT_LIMIT);
    assert.equal(state.eventId - startId, detonate ? 144 : 120, 'combat and twenty-four physical inventory drops fit the finite event history without losing shots');
    for (const f of state.players) assert.equal(state.events.filter(e => e.id > startId && e.type === 'shot' && e.playerId === f.id).length, 8, `seat ${f.id} keeps muzzle, sound and pellet feedback`);
    if (detonate) {
      assert.equal(state.events.filter(e => e.id > startId && e.type === 'grenadeExplosion').length, 6);
      assert.equal(state.events.filter(e => e.id > startId && e.type === 'kill').length, 6);
    } else assert.equal(state.events.filter(e => e.id > startId && e.type === 'healCancel').length, 6);
  }
});
