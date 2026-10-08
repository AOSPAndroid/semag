import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_BOLTS, launchBolt, advanceBolts } from '../public/voxel-projectiles.js';
import { createState, MAPS, WEAPONS, traceShot, rayBox, resetLobby, startMatch, selectLoadout, step, emptyInput, TICK_RATE } from '../public/voxel-engine.js';

const weapon = () => ({ ...WEAPONS.crossbow });
const close = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const direction = { x: 0, y: 0, z: -1 };
function lane({ teamSize = 1, targetY = 0, targetZ = -1, originY = 1.62 } = {}) {
  const state = createState({ teamSize }); state.phase = 'fight'; state.tick = 100;
  for (const player of state.players) Object.assign(player, { x: -20, y: 0, z: player.id * 3 - 10 });
  Object.assign(state.players[0], { x: 20, y: Math.max(0, originY - 1.62), z: 1 });
  Object.assign(state.players[teamSize], { x: 20, y: targetY, z: targetZ });
  const origin = { x: 20, y: originY, z: 1 };
  return { state, origin, shooter: state.players[0], target: state.players[teamSize] };
}
function run(state, ticks, { trace = traceShot, ...options } = {}) {
  const events = [], hits = [];
  for (let index = 0; index < ticks; index++) {
    state.tick++;
    advanceBolts(state, { trace, arena: MAPS[state.mapId], emit: (type, data) => events.push({ type, ...data }), queueDamage: hit => hits.push(hit), ...options });
  }
  return { events, hits };
}
// The actual production ray/box solver also exercises very thin and overhead
// fixtures, while production traceShot still handles all real map/player hits.
function withBoxes(boxes) {
  return (state, ownerId, origin, aim, maxDistance) => {
    let result = traceShot(state, ownerId, origin, aim, maxDistance);
    for (const box of boxes) {
      const distance = rayBox(origin, aim, box, maxDistance);
      if (distance !== null && distance <= result.distance) result = { distance, kind: 'wall', playerId: null, colliderId: box.id };
    }
    return result;
  };
}
function liveCrossbows() {
  const state = createState();
  for (const player of state.players) selectLoadout(state, player.id, 'crossbow');
  startMatch(state);
  for (let tick = 0; tick < 11 * TICK_RATE; tick++) step(state, state.players.map(player => emptyInput(player)));
  Object.assign(state.players[0], { x: 20, y: 0, z: 5, yaw: 0, pitch: 0 });
  Object.assign(state.players[1], { x: 20, y: 0, z: -5, yaw: Math.PI, pitch: 0 });
  return state;
}
function liveTicks(state, ticks, controls = {}) {
  for (let tick = 0; tick < ticks; tick++) step(state, state.players.map(player => ({ ...emptyInput(player), ...(controls[player.id] || {}) })));
}

test('launch snapshots ballistic metadata and normalizes aim without consuming ammunition', () => {
  const { state, shooter, origin } = lane(), events = [], catalog = weapon();
  const bolt = launchBolt(state, shooter, catalog, origin, { x: 0, y: 0, z: -2 }, { emit: (type, data) => events.push({ type, ...data }) });
  assert.equal(bolt, state.bolts[0]); assert.equal(state.boltId, 1); assert.equal(shooter.ammo, 24);
  assert.equal(bolt.weapon, 'crossbow'); assert.equal(bolt.vz, -48); assert.equal(bolt.gravity, 9);
  assert.equal(bolt.ttlTicks, 240); assert.equal(bolt.damage, 75); assert.equal(bolt.headMultiplier, 2);
  catalog.damage = 1; shooter.team = 1; assert.equal(bolt.damage, 75); assert.equal(bolt.team, 0);
  assert.equal(events.length, 1); assert.equal(events[0].type, 'boltLaunch'); assert.equal(events[0].boltId, 1);
});

test('invalid launch inputs and a dead shooter cannot create nonfinite flight', () => {
  const { state, shooter, origin } = lane();
  for (const aim of [null, { x: 0, y: 0, z: 0 }, { x: NaN, y: 0, z: -1 }, { x: 0, y: Infinity, z: 0 }]) assert.equal(launchBolt(state, shooter, weapon(), origin, aim), null);
  assert.equal(launchBolt(state, shooter, weapon(), { ...origin, y: -1 }, direction), null);
  shooter.alive = false; assert.equal(launchBolt(state, shooter, weapon(), origin, direction), null);
  assert.equal((state.bolts || []).length, 0);
});

test('newborn bolts wait until the next tick and then integrate gravity exactly', () => {
  const { state, shooter, origin } = lane({ originY: 20 }), bolt = launchBolt(state, shooter, weapon(), origin, direction);
  advanceBolts(state, { trace: traceShot }); assert.equal(bolt.ageTicks, 0); close(bolt.z, 1);
  run(state, 1); assert.equal(bolt.ageTicks, 1); close(bolt.z, .6); close(bolt.y, 20 - .5 * 9 / 120 ** 2); close(bolt.vy, -9 / 120);
  run(state, 119); close(bolt.z, -47); close(bolt.y, 15.5); close(bolt.vy, -9);
});

test('body and head damage arrive only after real travel through the production trace', () => {
  for (const [originY, expectedKind, expectedDamage] of [[.85, 'body', 75], [1.62, 'head', 150]]) {
    const { state, shooter, origin, target } = lane({ originY });
    launchBolt(state, shooter, weapon(), origin, direction);
    const early = run(state, 3); assert.equal(early.hits.length, 0); assert.equal(target.hp, 100); assert.equal(state.bolts.length, 1);
    const contact = run(state, 8); assert.equal(contact.hits.length, 1); assert.equal(contact.hits[0].damage, expectedDamage);
    assert.equal(contact.events[0].type, 'boltHit'); assert.equal(contact.events[0].hitKind, expectedKind);
    assert.equal(contact.events[0].targetId, target.id); assert.equal(target.hp, 100, 'the engine owns simultaneous damage application');
    assert.equal(state.bolts.length, 0); assert.equal(run(state, 30).hits.length, 0);
  }
});

test('elevated opponents use their actual head height and downhill flight can hit ground-level players', () => {
  const upper = lane({ originY: 4.62, targetY: 3 });
  launchBolt(upper.state, upper.shooter, weapon(), upper.origin, direction);
  assert.equal(run(upper.state, 12).hits[0].headshot, true);
  const lower = lane({ originY: 4.62 }), aim = { x: 0, y: -3, z: -2 };
  launchBolt(lower.state, lower.shooter, weapon(), lower.origin, aim);
  const hit = run(lower.state, 20).hits[0]; assert.equal(hit.targetId, lower.target.id); assert.equal(hit.headshot, true);
});

test('leading matters: a target who moves out of the flight path avoids a bolt', () => {
  const { state, shooter, origin, target } = lane({ targetZ: -9 });
  launchBolt(state, shooter, weapon(), origin, direction); assert.equal(run(state, 8).hits.length, 0);
  target.x = 21.2;
  const result = run(state, 70); assert.equal(result.hits.length, 0); assert.equal(target.hp, 100);
  assert.equal(result.events.find(event => event.type === 'boltHit').hitKind, 'wall');
});

test('an allied body absorbs a bolt without damaging a teammate or enemy behind them', () => {
  const { state, shooter, origin, target } = lane({ teamSize: 2, targetZ: -5, originY: .85 });
  Object.assign(state.players[1], { x: 20, y: 0, z: -1 });
  launchBolt(state, shooter, weapon(), origin, direction);
  const result = run(state, 30); assert.equal(result.hits.length, 0); assert.equal(result.events[0].targetId, 1);
  assert.equal(result.events[0].damage, 0); assert.equal(target.hp, 100); assert.equal(state.players[1].hp, 100); assert.equal(state.bolts.length, 0);
});

test('an in-flight bolt keeps its owner and damage after the shooter dies or swaps loadouts', () => {
  const { state, shooter, origin } = lane({ targetZ: -5, originY: .85 });
  launchBolt(state, shooter, weapon(), origin, direction); run(state, 4);
  shooter.alive = false; shooter.weapon = 'smg';
  const hit = run(state, 30).hits[0]; assert.equal(hit.playerId, shooter.id); assert.equal(hit.weapon, 'crossbow'); assert.equal(hit.damage, 75);
});

test('opposing bolts queue both contacts in one tick without prematurely killing either shooter', () => {
  const { state, shooter, origin, target } = lane({ originY: .85 });
  launchBolt(state, shooter, weapon(), origin, direction);
  launchBolt(state, target, weapon(), { x: target.x, y: .85, z: target.z }, { x: 0, y: 0, z: 1 });
  assert.equal(run(state, 4).hits.length, 0);
  const result = run(state, 1);
  assert.deepEqual(result.hits.map(hit => [hit.playerId, hit.targetId, hit.damage]), [[0, 1, 75], [1, 0, 75]]);
  assert.deepEqual(state.players.map(player => player.hp), [100, 100]);
  assert.equal(state.bolts.length, 0); assert.equal(result.events.length, 2);
});

test('real map cover blocks the bolt at the nearest contact, including a zero-distance inside start', () => {
  const { state, shooter } = lane();
  launchBolt(state, shooter, weapon(), { x: -4, y: 1.62, z: 8 }, direction);
  const result = run(state, 15); assert.equal(result.hits.length, 0); assert.equal(result.events[0].colliderId, 'central-west');
  close(result.events[0].z, 6); close(result.events[0].nz, 1);
  launchBolt(state, shooter, weapon(), { x: -4, y: 1.62, z: 5 }, direction);
  const inside = run(state, 1); assert.equal(inside.events[0].ageTicks, 1); assert.equal(inside.events[0].colliderId, 'central-west'); assert.equal(state.bolts.length, 0);
});

test('swept segments cannot tunnel through centimetre cover even at high speed', () => {
  const { state, shooter, origin } = lane({ originY: .85 }), wall = { id: 'thin-cover', x: 19, y: 0, z: .09, w: 2, h: 2, d: .01 };
  launchBolt(state, shooter, { ...weapon(), projectileSpeed: 600 }, origin, direction);
  const result = run(state, 1, { trace: withBoxes([wall]), arena: { colliders: [wall] } });
  assert.equal(result.hits.length, 0); assert.equal(result.events[0].colliderId, wall.id); close(result.events[0].z, .1); close(result.events[0].nz, 1);
});

test('bolts strike real elevated deck tops and ceiling undersides', () => {
  const deck = { id: 'catwalk', x: 19, y: 3, z: -2, w: 2, h: .3, d: 4 };
  const upper = lane({ originY: 4.62 });
  launchBolt(upper.state, upper.shooter, weapon(), upper.origin, { x: 0, y: -1, z: 0 });
  const top = run(upper.state, 10, { trace: withBoxes([deck]), arena: { colliders: [deck] } });
  assert.equal(top.events[0].colliderId, deck.id); close(top.events[0].y, 3.3); close(top.events[0].ny, 1);
  const under = lane();
  launchBolt(under.state, under.shooter, weapon(), under.origin, { x: 0, y: 1, z: 0 });
  const bottom = run(under.state, 10, { trace: withBoxes([deck]), arena: { colliders: [deck] } });
  assert.equal(bottom.events[0].colliderId, deck.id); close(bottom.events[0].y, 3); close(bottom.events[0].ny, -1);
});

test('floor contact is swept even when the trace adapter only supplies bodies and cover', () => {
  const { state, shooter } = lane(), origin = { x: 20, y: .02, z: 1 };
  launchBolt(state, shooter, weapon(), origin, { x: 0, y: -1, z: 0 });
  const result = run(state, 1, { trace: (match, id, from, aim, distance) => ({ distance, kind: 'none', playerId: null, colliderId: null }) });
  assert.equal(result.events[0].colliderId, 'floor'); close(result.events[0].y, 0); close(result.events[0].ny, 1); assert.equal(state.bolts.length, 0);
});

test('range limits shorten the final sweep and expired flight never causes late damage', () => {
  const { state, shooter, origin } = lane({ originY: .85 });
  launchBolt(state, shooter, { ...weapon(), range: 1 }, origin, direction);
  const result = run(state, 10); assert.equal(result.hits.length, 0); assert.equal(result.events.length, 0); assert.equal(state.bolts.length, 0);
  const bolt = launchBolt(state, shooter, weapon(), origin, direction); bolt.ageTicks = bolt.ttlTicks;
  assert.equal(run(state, 10).hits.length, 0); assert.equal(state.bolts.length, 0);
});

test('flight has a hard two-second lifetime without phantom impact events', () => {
  const { state, shooter, origin } = lane({ originY: 100 });
  launchBolt(state, shooter, weapon(), origin, direction);
  run(state, 239); assert.equal(state.bolts.length, 1);
  const result = run(state, 1); assert.equal(state.bolts.length, 0); assert.equal(result.events.length, 0); assert.equal(result.hits.length, 0);
});

test('the 24-bolt cap bounds launch and simulation work and rejects corrupt snapshots', () => {
  const { state, shooter, origin } = lane({ originY: 100 });
  for (let index = 0; index < MAX_BOLTS; index++) assert.ok(launchBolt(state, shooter, weapon(), origin, direction));
  assert.equal(launchBolt(state, shooter, weapon(), origin, direction), null); assert.equal(state.boltId, MAX_BOLTS);
  const template = state.bolts[0]; state.bolts.push(...Array.from({ length: 100 }, (_, index) => ({ ...template, id: MAX_BOLTS + index + 1 })));
  let calls = 0; run(state, 1, { trace: (...args) => { calls++; return traceShot(...args); } });
  assert.equal(calls, MAX_BOLTS); assert.equal(state.bolts.length, MAX_BOLTS);
  state.bolts[0].x = NaN; state.bolts[1].gravity = Infinity; state.bolts[2].traveledDistance = -1;
  run(state, 1); assert.equal(state.bolts.length, MAX_BOLTS - 3); assert.ok(state.bolts.every(bolt => Number.isFinite(bolt.x)));
});

test('identical tick sequences replay exactly, including queued contact events', () => {
  const replay = () => {
    const { state, shooter, origin } = lane({ originY: .85 }), events = [];
    launchBolt(state, shooter, weapon(), origin, direction, { emit: (type, data) => events.push({ type, ...data }) });
    const result = run(state, 10); return JSON.stringify({ bolts: state.bolts, events: [...events, ...result.events], hits: result.hits });
  };
  assert.equal(replay(), replay());
});

test('the engine clears live bolts and their identity counter on lobby and match resets', () => {
  const { state, shooter, origin } = lane(); launchBolt(state, shooter, weapon(), origin, direction);
  resetLobby(state); assert.deepEqual(state.bolts, []); assert.equal(state.boltId, 0);
  launchBolt(state, state.players[0], weapon(), origin, direction);
  startMatch(state); assert.deepEqual(state.bolts, []); assert.equal(state.boltId, 0);
});

test('engine crossbow fire consumes one bolt with visible travel, delayed gravity-adjusted damage and finite reload', () => {
  const state = liveCrossbows(), shooter = state.players[0], target = state.players[1];
  liveTicks(state, 1, { 0: { fire: true } });
  assert.equal(shooter.ammo, 0); assert.equal(shooter.shots, 1); assert.equal(state.bolts.length, 1);
  assert.equal(state.events.filter(event => event.type === 'boltLaunch').length, 1);
  assert.equal(state.events.filter(event => event.type === 'shot').length, 0, 'crossbow must not also fire an instant hitscan tracer');
  assert.equal(target.hp, 100); assert.equal(state.bolts[0].ageTicks, 0);
  liveTicks(state, 20); assert.equal(target.hp, 100); assert.equal(state.bolts.length, 1);
  liveTicks(state, 10); assert.equal(target.hp, 25); assert.equal(state.bolts.length, 0);
  const impact = state.events.findLast(event => event.type === 'boltHit'); assert.equal(impact.hitKind, 'body'); assert.equal(impact.damage, 75);
  liveTicks(state, 1, { 0: { reload: true } }); assert.equal(shooter.reloadTicks, WEAPONS.crossbow.reloadTicks);
  liveTicks(state, WEAPONS.crossbow.reloadTicks); assert.equal(shooter.ammo, 1); assert.equal(shooter.reserve, 11);
});

test('engine opposing lethal crossbow contacts trade rather than letting the first impact suppress the second', () => {
  const state = liveCrossbows();
  for (const player of state.players) player.hp = 75;
  liveTicks(state, 1, { 0: { fire: true }, 1: { fire: true } });
  assert.equal(state.bolts.length, 2); liveTicks(state, 30);
  assert.deepEqual(state.players.map(player => player.alive), [false, false]);
  assert.deepEqual(state.players.map(player => player.kills), [1, 1]);
  assert.equal(state.events.filter(event => event.type === 'boltHit').length, 2);
});

test('engine launch at the active projectile cap preserves ammo, shot count and recovery', () => {
  const state = liveCrossbows(), shooter = state.players[0];
  for (let index = 0; index < MAX_BOLTS; index++) launchBolt(state, shooter, weapon(), { x: 20, y: 100, z: 1 }, direction);
  const eventId = state.eventId;
  liveTicks(state, 1, { 0: { fire: true } });
  assert.equal(shooter.ammo, 1); assert.equal(shooter.shots, 0); assert.equal(shooter.shotCooldown, 0);
  assert.equal(state.eventId, eventId); assert.equal(state.bolts.length, MAX_BOLTS);
});

test('round respawn clears old ballistic flight so it cannot damage the next round', () => {
  const state = liveCrossbows(), shooter = state.players[0];
  launchBolt(state, shooter, weapon(), { x: 20, y: 100, z: 1 }, direction);
  state.phase = 'roundEnd'; state.phaseTicks = 1; state.roundWinner = 0;
  liveTicks(state, 1); assert.equal(state.phase, 'countdown'); assert.equal(state.round, 2);
  assert.deepEqual(state.bolts, []); assert.equal(state.boltId, 0);
  assert.deepEqual(state.players.map(player => player.hp), [100, 100]);
});
