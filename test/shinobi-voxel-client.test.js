import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanShinobiOrbit, composeShinobiInput, hydrateShinobiSnapshot, mayResumeShinobi, shouldRenderShinobiFrame, shinobiAbilityReadout, shinobiControlForKey, shinobiMatchSummary } from '../public/shinobi-voxel-client.js';
import { createState, INPUT_KEYS, MAPS } from '../public/shinobi-voxel-engine.js';
import { createShinobiVoxelInputQueue } from '../public/shinobi-voxel-input.js';
const touch = () => ({ actions: new Set(), move: { x: 0, y: 0 } });
test('camera orbit wraps yaw, bounds pitch and keeps the authored shoulder angle', () => {
  assert.equal(cleanShinobiOrbit().pitch, -.13);
  assert.ok(Math.abs(cleanShinobiOrbit(Math.PI * 8 + .5).yaw - .5) < 1e-9);
  assert.equal(cleanShinobiOrbit(0, 12).pitch, .7);
  assert.equal(cleanShinobiOrbit(0, -12).pitch, -.92);
  assert.equal(cleanShinobiOrbit(NaN, NaN).yaw, 0);
});
test('AZERTY printed controls retain the same nearby dash, feint and mouse alternatives', () => {
  const key = key => ({ key });
  assert.equal(shinobiControlForKey(key('z'), 'zqsd'), 'up');
  assert.equal(shinobiControlForKey(key('q'), 'zqsd'), 'left');
  assert.equal(shinobiControlForKey(key('a'), 'zqsd'), 'kunai');
  assert.equal(shinobiControlForKey(key('E'), 'zqsd'), 'dash');
  assert.equal(shinobiControlForKey(key('F'), 'zqsd'), 'feint');
  assert.equal(shinobiControlForKey(key('k'), 'zqsd'), 'aim');
  assert.equal(shinobiControlForKey(key('ArrowUp'), 'wasd'), 'up');
  assert.equal(shinobiControlForKey({ key: 'w', ctrlKey: true }, 'wasd'), 'up');
  assert.equal(shinobiControlForKey({ key: 'q', altKey: true }), null);
});
test('movement follows camera yaw while sword and kunai use the collision-tested aim ray', () => {
  const input = composeShinobiInput(new Set(['up', 'dash']), touch(), {}, { yaw: .64, pitch: -.12, moveYaw: 0 });
  assert.equal(input.up, true); assert.equal(input.dash, true);
  assert.equal(input.yaw, .64); assert.equal(input.pitch, -.12); assert.equal(input.moveYaw, 0);
});
test('a released or paused controller sends every gameplay button neutral but retains both camera directions', () => {
  const input = composeShinobiInput(new Set(INPUT_KEYS), { actions: new Set(INPUT_KEYS), move: { x: 1, y: -1 } }, { fire: true, aim: true }, { yaw: .4, pitch: .2, moveYaw: .9 }, false);
  for (const action of INPUT_KEYS) assert.equal(input[action], false, action);
  assert.equal(input.yaw, .4); assert.equal(input.pitch, .2); assert.ok(Math.abs(input.moveYaw - .9) < 1e-9);
});
test('touch movement and mouse commitments compose without confusing aim and orbit', () => {
  const input = composeShinobiInput(new Set(['crouch']), { actions: new Set(['kunai']), move: { x: -.6, y: -.8 } }, { fire: true, aim: true }, { yaw: -.4, moveYaw: -.1 });
  for (const key of ['crouch', 'kunai', 'left', 'up', 'fire', 'aim']) assert.equal(input[key], true, key);
  assert.equal(input.down, false); assert.equal(input.right, false);
});
test('compact online snapshots hydrate the exact authored arena before physics or camera reads', () => {
  const state = createState({ mapId: 'shinobi-rooftops', online: true });
  const compact = { ...state, map: undefined, fighters: undefined };
  const hydrated = hydrateShinobiSnapshot(compact);
  assert.equal(hydrated.map, MAPS['shinobi-rooftops']); assert.equal(hydrated.fighters, compact.players);
  assert.equal(compact.map, undefined); assert.equal(compact.fighters, undefined);
  assert.equal(hydrateShinobiSnapshot({ ...compact, mapId: 'voxel-factory' }), null);
  assert.equal(hydrateShinobiSnapshot({ ...compact, gameId: 'voxel-breach' }), null);
});
test('a dead solo player can resume a legitimate paused inter-round clock and reach the next spawn', () => {
  assert.equal(mayResumeShinobi({ phase: 'paused', resumePhase: 'roundEnd', alive: false }), true);
  assert.equal(mayResumeShinobi({ phase: 'paused', resumePhase: 'countdown', alive: false }), true);
  assert.equal(mayResumeShinobi({ phase: 'paused', resumePhase: 'fight', alive: true }), true);
  assert.equal(mayResumeShinobi({ phase: 'paused', resumePhase: 'matchEnd' }), false);
  assert.equal(mayResumeShinobi({ phase: 'lobby', alive: true }), false);
});
test('online menus release only local controls and allow inter-round entry without reviving anyone', () => {
  assert.equal(mayResumeShinobi({ online: true, phase: 'roundEnd', alive: false }), true);
  assert.equal(mayResumeShinobi({ online: true, phase: 'fight', alive: false }), false);
  assert.equal(mayResumeShinobi({ online: true, phase: 'fight', alive: true }), true);
  assert.equal(mayResumeShinobi({ online: true, phase: 'fight', connected: false }), false);
});
test('online released-menu backdrop paints once per 15Hz while active play keeps higher display refresh', () => {
  assert.equal(shouldRenderShinobiFrame({ online: true, controlsPaused: true, now: 1050, lastRenderAt: 1000 }), false);
  assert.equal(shouldRenderShinobiFrame({ online: true, controlsPaused: true, now: 1067, lastRenderAt: 1000 }), true);
  assert.equal(shouldRenderShinobiFrame({ online: true, controlsPaused: false, now: 1004, lastRenderAt: 1000 }), true);
  assert.equal(shouldRenderShinobiFrame({ online: true, controlsPaused: true, ending: true, now: 1004, lastRenderAt: 1000 }), true);
  assert.equal(shouldRenderShinobiFrame({ online: false, now: 1004, lastRenderAt: 1000 }), true);
});
test('kunai readiness follows an available charge and actual throw cooldown, independent of reserve recovery', () => {
  assert.equal(shinobiAbilityReadout({ kunai: 2, kunaiRecoveryTicks: 120, kunaiCooldown: 0 }).kunaiReady, true);
  assert.equal(shinobiAbilityReadout({ kunai: 2, kunaiRecoveryTicks: 120, kunaiCooldown: 12 }).kunaiReady, false);
  assert.equal(shinobiAbilityReadout({ kunai: 0, kunaiCooldown: 0 }).kunaiReady, false);
});
test('dash readiness does not advertise a dash below its real stamina cost', () => {
  assert.equal(shinobiAbilityReadout({ stamina: 25, dashCooldown: 0 }).dashReady, false);
  assert.equal(shinobiAbilityReadout({ stamina: 26, dashCooldown: 0 }).dashReady, true);
  assert.equal(shinobiAbilityReadout({ stamina: 100, dashCooldown: 12 }).dashReady, false);
  assert.equal(shinobiAbilityReadout({ dashCooldown: 120 }).dash, '1.0s');
});
test('match results honor team zero and show the local team score first', () => {
  const state = { winner: 0, scores: [2, 1], players: [{ id: 0, team: 0, kills: 3 }, { id: 1, team: 1, kills: 2 }] };
  assert.equal(shinobiMatchSummary(state, 0).won, true); assert.equal(shinobiMatchSummary(state, 1).won, false);
  assert.deepEqual(shinobiMatchSummary(state, 1).scores, [1, 2]);
  assert.equal(shinobiMatchSummary({ ...state, winner: null }, 0).won, false);
  assert.equal(shinobiMatchSummary(state, 6).won, false);
});
test('match time and combat report use accepted per-match counters rather than the persistent server tick', () => {
  const state = { tick: 48000, fightTicks: 360, winner: 1, scores: [0, 2], mapName: 'Lantern Dojo', players: [{ id: 1, team: 1, kills: 2, deaths: 0, damageDealt: 440, damageTaken: 83, parries: 2, dashes: 4, kunaiThrown: 3 }] };
  const report = shinobiMatchSummary(state, 1);
  assert.equal(report.ticks, 360); assert.equal(report.damage, 440); assert.equal(report.taken, 83); assert.equal(report.parries, 2); assert.equal(report.kunai, 3);
  assert.equal(report.won, true); assert.equal(report.map, 'Lantern Dojo');
});
test('a very brief physical dash tap survives until a fixed physics step, then releases before another tap', () => {
  const queue = createShinobiVoxelInputQueue(), neutral = composeShinobiInput(new Set(), touch(), {}, { yaw: .2, moveYaw: -.4 });
  queue.observe(neutral, 0); queue.observe({ ...neutral, dash: true }, 1); queue.observe(neutral, 2);
  const first = queue.sample(neutral, 3).buttons;
  assert.equal(first.dash, true); assert.equal(first.yaw, .2); assert.equal(first.moveYaw, neutral.moveYaw);
  assert.equal(queue.sample(neutral, 12).buttons.dash, false);
});
test('pause release fencing cannot turn a held cut, parry, dash or kunai into a resumed commitment', () => {
  const queue = createShinobiVoxelInputQueue(), neutral = composeShinobiInput(new Set(), touch(), {}, { yaw: 0 }), held = { ...neutral, fire: true, aim: true, dash: true, kunai: true };
  queue.reset({ held, neutral: true }); queue.observe(held, 10);
  const blocked = queue.sample(held, 11).buttons;
  for (const action of ['fire', 'aim', 'dash', 'kunai']) assert.equal(blocked[action], false, action);
  queue.observe(neutral, 12); queue.sample(neutral, 13); queue.observe({ ...neutral, fire: true }, 14);
  assert.equal(queue.sample({ ...neutral, fire: true }, 15).buttons.fire, true);
});
