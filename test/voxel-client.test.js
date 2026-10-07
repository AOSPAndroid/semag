import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanAim, composeInput, controlForKey, createContinuousInputPacer, FPS_BUTTONS, interpolatedState, isFormTarget, loadoutForKey, matchClock, neutralInput, reconcilePlayer, roundResult, tacticalMapPlayers } from '../public/voxel-client.js';
import { createState, emptyInput, MAPS, predictLocalMovement } from '../public/voxel-engine.js';

test('FPS controls use printed French letters and preserve arrows and actions', () => {
  assert.equal(controlForKey({ key: 'z', code: 'KeyW' }, 'zqsd'), 'up');
  assert.equal(controlForKey({ key: 'q', code: 'KeyA' }, 'zqsd'), 'left');
  assert.equal(controlForKey({ key: 'w', code: 'KeyZ' }, 'zqsd'), null);
  assert.equal(controlForKey({ key: 'a', code: 'KeyQ' }, 'zqsd'), null);
  assert.equal(controlForKey({ key: 'ArrowLeft', code: 'ArrowLeft' }, 'zqsd'), 'left');
  for (const [key, action] of [[' ', 'jump'], ['Control', 'crouch'], ['Shift', 'walk'], ['r', 'reload'], ['e', 'interact']]) assert.equal(controlForKey({ key }, 'zqsd'), action);
});

test('all movement, touch and mouse inputs release together without changing aim', () => {
  const keys = new Set(FPS_BUTTONS); const touch = { move: { x: .8, y: -.8 }, actions: new Set(['fire']) }; const mouse = { fire: true };
  const active = composeInput(keys, touch, mouse, { yaw: .4, pitch: -.2 }, true);
  for (const action of FPS_BUTTONS) assert.equal(active[action], true);
  const released = composeInput(keys, touch, mouse, { yaw: .4, pitch: -.2 }, false);
  for (const action of FPS_BUTTONS) assert.equal(released[action], false);
  assert.ok(Math.abs(released.yaw - .4) < 1e-12); assert.equal(released.pitch, -.2);
});

test('touch movement has a dead zone, diagonals and independent held actions', () => {
  const touch = { move: { x: .1, y: -.1 }, actions: new Set(['crouch', 'interact']) };
  let input = composeInput(new Set(), touch, { fire: false }, { yaw: 0, pitch: 0 });
  assert.equal(input.up, false); assert.equal(input.right, false); assert.equal(input.crouch, true); assert.equal(input.interact, true);
  touch.move = { x: -.8, y: -.7 }; input = composeInput(new Set(), touch, { fire: false }, { yaw: 0, pitch: 0 });
  assert.equal(input.up, true); assert.equal(input.left, true); assert.equal(input.down, false); assert.equal(input.right, false);
});

test('two 120 Hz touch pads share a 60 Hz packet budget below the server rate limit', () => {
  const pacer = createContinuousInputPacer(); let padPackets = 0;
  for (let frame = 0; frame < 120; frame++) {
    const now = frame * 1000 / 120;
    if (pacer.shouldSend(now)) padPackets++;
    if (pacer.shouldSend(now)) padPackets++;
  }
  assert.equal(padPackets, 60);
  const fullContinuousBudget = padPackets + 120 /* maximum simulation/render sends */ + 20 /* held-input heartbeat */;
  assert.equal(fullContinuousBudget, 200);
  assert.ok(fullContinuousBudget < 300);
});

test('touch direction transitions bypass pacing while suppressing redundant analogue packets', () => {
  const pacer = createContinuousInputPacer();
  assert.equal(pacer.shouldSend(0), true);
  assert.equal(pacer.shouldSend(2), false);
  assert.equal(pacer.shouldSend(3, true), true, 'a direction press is immediate');
  assert.equal(pacer.shouldSend(4, true), true, 'a direction release is immediate');
  assert.equal(pacer.shouldSend(10), false);
  assert.equal(pacer.shouldSend(21), true);
  pacer.reset(); assert.equal(pacer.shouldSend(22), true, 'resuming a released pad never waits on an old sample');
});

test('aim wraps continuously and clamps pitch before crossing the network', () => {
  const aim = cleanAim(Math.PI + .03, 20); assert.ok(Math.abs(aim.yaw - (-Math.PI + .03)) < 1e-12); assert.equal(aim.pitch, 1.35);
  assert.deepEqual(cleanAim(NaN, Infinity), { yaw: 0, pitch: 0 });
  assert.equal(neutralInput(0, -20).pitch, -1.35);
});

test('the planted charge owns the primary clock even when the pre-plant round expires', () => {
  const state = createState(); state.phase = 'fight'; state.roundTicks = 120 * 100;
  assert.equal(matchClock(state).text, '1:40');
  state.bomb.status = 'planted'; state.bomb.siteId = 'B'; state.bomb.timerTicks = 120 * 35;
  let clock = matchClock(state); assert.equal(clock.text, '35'); assert.equal(clock.label, 'SITE B · DEVICE PLANTED'); assert.equal(clock.planted, true);
  state.roundTicks = 0; state.bomb.timerTicks = 120 * 9 + 1;
  clock = matchClock(state); assert.equal(clock.text, '10'); assert.equal(clock.urgent, true);
  state.bomb.timerTicks = 0; assert.equal(matchClock(state).text, '00');
  state.phase = 'roundEnd'; state.phaseTicks = 4 * 120;
  assert.equal(matchClock(state).text, '04'); assert.equal(matchClock(state).planted, false);
  state.phase = 'matchEnd'; assert.equal(matchClock(state).text, '—'); assert.equal(matchClock(state).urgent, false);
});

test('round outcomes follow the local team and the current swapped attack role', () => {
  const state = createState(); assert.equal(roundResult(state, 0), null);
  state.round = 4; state.attackTeam = 1; state.roundWinner = 1; state.roundReason = 'elimination';
  assert.deepEqual(roundResult(state, 1), { won: true, title: 'Round secured.', team: 'TEAL', role: 'BREACH', reason: 'Opposing squad eliminated.' });
  assert.equal(roundResult(state, 0).title, 'Round lost.'); assert.equal(roundResult(state, 0).reason, 'Your squad was eliminated.');
  state.roundWinner = 0; state.roundReason = 'defuse';
  assert.equal(roundResult(state, 0).role, 'HOLD'); assert.equal(roundResult(state, 0).reason, 'Device defused.');
});

test('tactical navigation never reveals enemies, dead bodies, disconnected seats or invalid poses', () => {
  const state = createState({ teamSize: 3 });
  state.players[1].alive = false; state.players[2].x = 8;
  const markers = tacticalMapPlayers(state, 0, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(markers.map(player => player.id), [0, 2]); assert.equal(markers[0].self, true); assert.equal(markers[1].self, false);
  markers[1].x = 200; assert.equal(state.players[2].x, 8, 'markers are copied navigation data');
  assert.deepEqual(tacticalMapPlayers(state, 0, [0, 3, 4, 5]).map(player => player.id), [0]);
  state.players[2].x = NaN; assert.deepEqual(tacticalMapPlayers(state, 0, [0, 2]).map(player => player.id), [0]);
  assert.deepEqual(tacticalMapPlayers(state, 5, [0, 1, 2, 3, 4, 5]).map(player => player.id), [3, 4, 5]);
  assert.deepEqual(tacticalMapPlayers(state, null), []);
});

test('arena loadout shortcuts respect setup phases, French digits, form focus and repeat/modifiers', () => {
  for (const phase of ['countdown', 'buy', 'roundEnd']) {
    assert.equal(loadoutForKey({ key: '1' }, phase), 'carbine');
    assert.equal(loadoutForKey({ key: '&', code: 'Digit1' }, phase), 'carbine');
    assert.equal(loadoutForKey({ key: 'é', code: 'Digit2' }, phase), 'smg');
    assert.equal(loadoutForKey({ key: '"', code: 'Digit3' }, phase), 'marksman');
  }
  for (const phase of ['lobby', 'fight', 'matchEnd']) assert.equal(loadoutForKey({ key: '2', code: 'Digit2' }, phase), null);
  for (const blocked of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { target: { closest() { return {}; } } }]) assert.equal(loadoutForKey({ key: '1', ...blocked }, 'buy'), null);
});

test('form, buttons and dialog targets never supply game input', () => {
  let selector = '';
  assert.equal(isFormTarget({ closest(value) { selector = value; return {}; } }), true);
  for (const name of ['input', 'select', 'textarea', 'button', 'a', '[role="dialog"]']) assert.ok(selector.includes(name));
  assert.equal(isFormTarget({ closest() { return null; } }), false);
  assert.equal(isFormTarget(null), false);
});

test('remote interpolation crosses the yaw seam without changing local pose or combat', () => {
  const before = createState(); const after = structuredClone(before);
  before.phase = after.phase = 'fight'; before.players[1].x = 0; after.players[1].x = 2;
  before.players[1].yaw = Math.PI - .1; after.players[1].yaw = -Math.PI + .1;
  after.players[1].hp = 40; after.players[0].x = 3;
  const rendered = interpolatedState([{ time: 0, state: before }, { time: 100, state: after }], 50, 0);
  assert.equal(rendered.players[1].x, 1); assert.ok(Math.abs(Math.abs(rendered.players[1].yaw) - Math.PI) < 1e-12);
  assert.equal(rendered.players[1].hp, 40); assert.equal(rendered.players[0].x, 3);
  assert.equal(after.players[1].x, 2); assert.equal(rendered.fighters, rendered.players);
});

test('round transitions and teleports never interpolate through solid cover', () => {
  const before = createState(); const after = structuredClone(before);
  before.phase = after.phase = 'fight'; before.players[1].x = 0; after.players[1].x = 10;
  let rendered = interpolatedState([{ time: 0, state: before }, { time: 100, state: after }], 50, 0);
  assert.equal(rendered.players[1].x, 10);
  after.round = 2; after.players[1].x = 2;
  rendered = interpolatedState([{ time: 0, state: before }, { time: 100, state: after }], 50, 0);
  assert.equal(rendered.players[1].x, 2);
});

test('moving targets project close to the authoritative pose instead of a full frame behind', () => {
  const snapshot = createState(); snapshot.phase = 'fight';
  const target = snapshot.players[1]; target.x = 8; target.z = 8; target.yaw = 0;
  const input = { ...emptyInput(), right: true }; target.previousInput = input;
  predictLocalMovement(target, input, 'courtyard', 20);
  const expected = structuredClone(target); predictLocalMovement(expected, input, 'courtyard', 3);
  const rendered = interpolatedState([{ time: 0, state: snapshot }], 25, 0, { predictMovement: predictLocalMovement });
  assert.deepEqual(rendered.players[1], expected);
  assert.ok(Math.abs(rendered.players[1].x - target.x) > .08);
  assert.equal(snapshot.players[1].x, target.x);
  const stalled = interpolatedState([{ time: 0, state: snapshot }], 1000, 0, { predictMovement: predictLocalMovement });
  assert.deepEqual(stalled.players[1], expected, 'a stalled connection never extrapolates indefinitely');
});

test('remote projection respects map walls and never moves the local camera or dead players', () => {
  const snapshot = createState(); snapshot.phase = 'fight';
  const wallX = MAPS.courtyard.colliders.find(collider => collider.id === 'wall-east').x;
  const target = snapshot.players[1]; target.x = wallX - .34; target.z = 8; target.yaw = 0;
  target.previousInput = { ...emptyInput(), right: true }; target.vx = 5;
  const rendered = interpolatedState([{ time: 0, state: snapshot }], 25, 0, { predictMovement: predictLocalMovement });
  assert.ok(rendered.players[1].x <= wallX - target.radius + 1e-5, 'remote body stops at the east perimeter wall');
  assert.deepEqual(rendered.players[0], snapshot.players[0]);
  snapshot.players[1].alive = false;
  const dead = interpolatedState([{ time: 0, state: snapshot }], 25, 0, { predictMovement: predictLocalMovement });
  assert.deepEqual(dead.players[1], snapshot.players[1]);
});

test('server acknowledgement replays only pending movement on a copied player', () => {
  const player = createState().players[0];
  const buttons = { ...emptyInput(), up: true };
  const history = [1, 2, 3, 4].map(seq => ({ seq, buttons }));
  const result = reconcilePlayer(player, history, 2, 'courtyard', predictLocalMovement);
  const expected = structuredClone(player); predictLocalMovement(expected, buttons, 'courtyard', 2);
  assert.deepEqual(result.predicted, expected); assert.deepEqual(result.pending.map(frame => frame.seq), [3, 4]);
  assert.equal(player.z, createState().players[0].z); assert.equal(history.length, 4);
});

test('dead players and locked setup phases never predict movement; queues stay bounded', () => {
  const player = createState().players[0]; const buttons = { ...emptyInput(), up: true };
  const history = Array.from({ length: 600 }, (_, seq) => ({ seq, buttons }));
  let result = reconcilePlayer(player, history, -1, 'courtyard', predictLocalMovement, false);
  assert.equal(result.pending.length, 240); assert.equal(result.predicted.z, player.z);
  player.alive = false; result = reconcilePlayer(player, history, -1, 'courtyard', predictLocalMovement);
  assert.equal(result.predicted.z, player.z);
});
