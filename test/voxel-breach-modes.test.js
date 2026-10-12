import assert from 'node:assert/strict';
import test from 'node:test';
import * as Voxel from '../public/voxel-engine.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';

const { BREACH_MODES, GUN_GAME_LADDER, TICK_RATE } = Voxel;
const input = (f, fields = {}) => ({ ...Voxel.emptyInput(f), yaw: f.yaw, pitch: f.pitch, ...fields });
const toFight = state => { Voxel.startMatch(state); for (let guard = 0; state.phase !== 'fight' && guard < 5000; guard++) Voxel.step(state, state.players.map(f => input(f))); assert.equal(state.phase, 'fight'); };
const faceOff = (state, distance = 1.6) => {
  const [a, b] = state.players; Object.assign(a, { x: 0, y: 0, z: 0, yaw: 0, pitch: -.1, vx: 0, vz: 0 }); Object.assign(b, { x: 0, y: 0, z: -distance, yaw: Math.PI, pitch: -.1, vx: 0, vz: 0 });
  a.previousInput = Voxel.emptyInput(a); b.previousInput = Voxel.emptyInput(b);
};
const run = (state, ticks, controls = () => []) => { for (let tick = 0; tick < ticks && state.phase === 'fight'; tick++) { const c = controls(tick); Voxel.step(state, state.players.map((f, i) => input(f, c[i] || {}))); } };

test('classic stays the default bomb game and modes are validated', () => {
  const state = Voxel.createState();
  assert.equal(state.mode, undefined); assert.notEqual(state.bomb.status, 'disabled');
  assert.throws(() => Voxel.createState({ mode: 'deathmatch' }), RangeError);
  assert.deepEqual(Object.keys(BREACH_MODES), ['classic', 'blades', 'standoff', 'gungame']);
});

test('Blade Arena: each player brings a chosen blade, no gun and no charge', () => {
  const state = Voxel.createState({ mode: 'blades' });
  assert.equal(Voxel.selectMeleeLoadout(state, 0, 'spear').ok, true);
  assert.equal(Voxel.selectLoadout(state, 0, 'vandal').ok, false, 'guns are not part of Blade Arena');
  toFight(state);
  const [a, b] = state.players;
  assert.equal(a.meleeWeapon, 'spear'); assert.equal(b.meleeWeapon, 'knife', 'an unchosen blade is the knife');
  assert.ok(state.players.every(f => !f.hasGun && f.slot === 'sword'));
  assert.equal(state.bomb.status, 'disabled'); assert.equal(state.bomb.carrierId, null);
  faceOff(state, 3.4);
  run(state, 40, tick => [{ fire: tick === 0 }]);
  assert.equal(b.hp, b.maxHp - MELEE_WEAPONS.spear.damage);
});

test('Samurai Standoff: katanas only and one clean cut decides the round', () => {
  const state = Voxel.createState({ mode: 'standoff' });
  toFight(state);
  assert.ok(state.players.every(f => f.meleeWeapon === 'katana' && !f.hasGun));
  faceOff(state);
  run(state, 40, tick => [{ fire: tick === 0 }]);
  assert.equal(state.players[1].alive, false);
  assert.equal(state.phase, 'roundEnd'); assert.equal(state.roundWinner, state.players[0].team);
});

test('Gun Game: every kill climbs the ladder mid-fight; a knife kill on the last rung wins', () => {
  const state = Voxel.createState({ mode: 'gungame' });
  toFight(state);
  assert.equal(state.players[0].weapon, GUN_GAME_LADDER[0]); assert.equal(state.players[0].gunGameLevel, 0);
  // Climb to the last rung with real shots from each rung's gun. Each round respawns fresh player objects.
  for (let rung = 0; rung < GUN_GAME_LADDER.length - 1; rung++) {
    for (let guard = 0; state.phase !== 'fight' && guard < 5000; guard++) Voxel.step(state, state.players.map(f => input(f)));
    const [a, b] = state.players;
    assert.equal(a.weapon, GUN_GAME_LADDER[rung]); assert.equal(a.gunGameLevel, rung, 'the ladder survives each new round');
    faceOff(state, 3); a.pitch = b.pitch = 0; b.hp = 1;
    run(state, 400, tick => [{ fire: tick % 2 === 0, pitch: 0 }, { pitch: 0 }]);
    assert.equal(b.alive, false, `rung ${rung}: ${GUN_GAME_LADDER[rung]} kills`);
    assert.equal(a.gunGameLevel, rung + 1, `rung ${rung}`);
    assert.notEqual(state.phase, 'matchEnd');
  }
  assert.equal(state.players[0].slot, 'sword'); assert.equal(state.players[0].meleeWeapon, 'knife'); assert.equal(state.players[0].hasGun, false, 'the last rung swaps to the knife at once');
  for (let guard = 0; state.phase !== 'fight' && guard < 5000; guard++) Voxel.step(state, state.players.map(f => input(f)));
  const [a, b] = state.players;
  assert.equal(a.gunGameLevel, GUN_GAME_LADDER.length - 1); assert.equal(a.meleeWeapon, 'knife'); assert.equal(a.hasGun, false);
  faceOff(state, 1.2); b.hp = 1;
  run(state, 40, tick => [{ fire: tick === 0 }]);
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.winner, a.team); assert.equal(state.gunGameWinnerId, a.id);
  assert.ok(state.events.some(event => event.type === 'matchEnd' && event.mode === 'gungame'));
});

test('Gun Game never ends on round score alone', () => {
  const state = Voxel.createState({ mode: 'gungame' });
  toFight(state); state.scores = [3, 3];
  const [a, b] = state.players;
  faceOff(state, 3); a.pitch = b.pitch = 0; b.hp = 1;
  run(state, 400, tick => [{ fire: tick % 2 === 0, pitch: 0 }, { pitch: 0 }]);
  assert.equal(state.phase, 'roundEnd'); assert.equal(state.scores[a.team], 4);
  for (let tick = 0; tick < TICK_RATE * 5; tick++) Voxel.step(state, state.players.map(f => input(f)));
  assert.notEqual(state.phase, 'matchEnd');
});
