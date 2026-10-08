import assert from 'node:assert/strict';
import test from 'node:test';
import { aimFraction, aimLookMultiplier, confirmedHitGroups, healthHUDPlayer, healthPresentation, weaponComparison, combatEventPerspective, combatReadout, cleanAim, composeInput, controlForKey, createContinuousInputPacer, FPS_BUTTONS, hasGunshotReport, interpolatedState, isFormTarget, loadoutForKey, matchClock, neutralInput, reconcilePlayer, roundResult, tacticalSquadHealth, tacticalMapPlayers } from '../public/voxel-client.js';
import { createState, emptyInput, MAPS, predictLocalMovement, traceShot, WEAPONS } from '../public/voxel-engine.js';
import { advanceBolts, launchBolt } from '../public/voxel-projectiles.js';

function boltSamples() {
  const state = createState(); state.phase = 'fight'; state.tick = 10;
  launchBolt(state, state.players[0], WEAPONS.crossbow, { x: 20, y: 3, z: 5 }, { x: 0, y: 0, z: -1 });
  const before = structuredClone(state);
  for (let tick = 0; tick < 4; tick++) { state.tick++; advanceBolts(state, { trace: traceShot }); }
  return [{ time: 0, state: before }, { time: 1000 / 30, state: structuredClone(state) }];
}

test('live bolts interpolate at frame time on copied positions and velocity', () => {
  const samples = boltSamples(), original = JSON.stringify(samples);
  const rendered = interpolatedState(samples, 1000 / 60, 0);
  assert.ok(Math.abs(rendered.bolts[0].z - 4.2) < 1e-10);
  assert.ok(Math.abs(rendered.bolts[0].y - 2.9975) < 1e-10);
  assert.ok(Math.abs(rendered.bolts[0].vy - -.15) < 1e-10);
  assert.notEqual(rendered.bolts, samples[1].state.bolts); assert.notEqual(rendered.bolts[0], samples[1].state.bolts[0]);
  assert.equal(JSON.stringify(samples), original);
});

test('deleted bolts never reappear and a new birth or owner never inherits old flight', () => {
  const samples = boltSamples(); samples[1].state.bolts = [];
  assert.deepEqual(interpolatedState(samples, 10, 0).bolts, []);
  for (const field of ['bornTick', 'playerId']) {
    const reused = boltSamples(); reused[1].state.bolts[0][field]++;
    assert.equal(interpolatedState(reused, 10, 0).bolts[0].z, reused[1].state.bolts[0].z);
  }
});

test('round and phase transitions do not interpolate or project reused bolt identities', () => {
  for (const change of [{ round: 2 }, { phase: 'countdown' }]) {
    const samples = boltSamples(); Object.assign(samples[1].state, change);
    const rendered = interpolatedState(samples, 15, 0, { traceProjectile: traceShot });
    assert.equal(rendered.bolts[0].z, samples[1].state.bolts[0].z);
  }
});

test('bolt projection follows gravity between snapshots and stops after 25 milliseconds', () => {
  const [sample] = boltSamples(), original = JSON.stringify(sample.state);
  const rendered = interpolatedState([sample], 25, 0, { traceProjectile: traceShot });
  assert.ok(Math.abs(rendered.bolts[0].z - 3.8) < 1e-10);
  assert.ok(Math.abs(rendered.bolts[0].y - (3 - .5 * 9 * .025 ** 2)) < 1e-10);
  const stalled = interpolatedState([sample], 1000, 0, { traceProjectile: traceShot, maxExtrapolationMs: 1000 });
  assert.deepEqual(stalled.bolts, rendered.bolts); assert.equal(JSON.stringify(sample.state), original);
  const paused = interpolatedState([{ ...sample, state: { ...sample.state, phase: 'roundEnd' } }], 25, 0, { traceProjectile: traceShot });
  assert.equal(paused.bolts[0].z, 5);
});

test('projected bolts respect real cover, the floor and bodies without applying render damage', () => {
  for (const contact of ['wall', 'floor', 'body']) {
    const state = createState(); state.phase = 'fight'; state.tick = 10;
    const origin = contact === 'wall' ? { x: -4, y: 1.62, z: 6.15 } : { x: 20, y: contact === 'floor' ? .02 : 1.62, z: 5 };
    const aim = contact === 'floor' ? { x: 0, y: -1, z: 0 } : { x: 0, y: 0, z: -1 };
    if (contact === 'body') Object.assign(state.players[1], { x: 20, y: 0, z: 4.3 });
    launchBolt(state, state.players[0], WEAPONS.crossbow, origin, aim);
    const original = JSON.stringify(state), rendered = interpolatedState([{ time: 0, state }], 25, 0, { traceProjectile: traceShot });
    assert.deepEqual(rendered.bolts, [], `${contact} absorbs the projected bolt`);
    assert.equal(rendered.players[1].hp, 100); assert.equal(JSON.stringify(state), original);
    assert.deepEqual(rendered.events, state.events);
  }
});

test('FPS controls use printed French letters and preserve arrows and actions', () => {
  assert.equal(controlForKey({ key: 'z', code: 'KeyW' }, 'zqsd'), 'up');
  assert.equal(controlForKey({ key: 'q', code: 'KeyA' }, 'zqsd'), 'left');
  assert.equal(controlForKey({ key: 'w', code: 'KeyZ' }, 'zqsd'), null);
  assert.equal(controlForKey({ key: 'a', code: 'KeyQ' }, 'zqsd'), 'grenade');
  assert.equal(controlForKey({ key: 'q', code: 'KeyQ' }, 'wasd'), 'grenade');
  assert.equal(controlForKey({ key: 'ArrowLeft', code: 'ArrowLeft' }, 'zqsd'), 'left');
  for (const [key, action] of [[' ', 'jump'], ['Control', 'crouch'], ['Shift', 'walk'], ['r', 'reload'], ['e', 'interact'], ['g', 'grenade'], ['v', 'swap'], ['f', 'heal'], ['h', 'heal']]) assert.equal(controlForKey({ key }, 'zqsd'), action);
});

test('FPS nearby utility keys reject consumed input and work while crouch is held', () => {
  for (const modifier of ['altKey', 'metaKey', 'isComposing', 'defaultPrevented']) {
    for (const key of ['q', 'f', 'g', 'h', 'r', 'e', 'v']) {
      assert.equal(controlForKey({ key, [modifier]: true }, 'wasd'), null, `${modifier} + ${key}`);
    }
  }
  assert.equal(controlForKey({ key: 'Control', ctrlKey: true }, 'wasd'), 'crouch');
  assert.equal(controlForKey({ key: 'q', code: 'KeyA', ctrlKey: true }, 'zqsd'), 'left');
  assert.equal(controlForKey({ key: 'z', code: 'KeyW', ctrlKey: true }, 'zqsd'), 'up');
  for (const [key, action] of [['a', 'grenade'], ['f', 'heal'], ['g', 'grenade'], ['h', 'heal'], ['r', 'reload'], ['e', 'interact'], ['v', 'swap']]) {
    assert.equal(controlForKey({ key, ctrlKey: true }, 'zqsd'), action, `crouch + ${key}`);
  }
  assert.equal(controlForKey({ key: 'A', code: 'KeyQ', shiftKey: true }, 'zqsd'), 'grenade');
  assert.equal(controlForKey({ key: 'F', shiftKey: true }, 'zqsd'), 'heal');
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
    assert.equal(loadoutForKey({ key: "'", code: 'Digit4' }, phase), 'pistol');
    assert.equal(loadoutForKey({ key: '(', code: 'Digit5' }, phase), 'shotgun');
    assert.equal(loadoutForKey({ key: '-', code: 'Digit6' }, phase), 'burst');
    assert.equal(loadoutForKey({ key: 'è', code: 'Digit7' }, phase), 'sniper');
    assert.equal(loadoutForKey({ key: '_', code: 'Digit8' }, phase), 'lmg');
    assert.equal(loadoutForKey({ key: 'ç', code: 'Digit9' }, phase), 'crossbow');
    for (const [key, weapon] of [['4', 'pistol'], ['5', 'shotgun'], ['6', 'burst'], ['7', 'sniper'], ['8', 'lmg'], ['9', 'crossbow']]) {
      assert.equal(loadoutForKey({ key, code: `Numpad${key}` }, phase), weapon);
      assert.equal(loadoutForKey({ key }, phase), weapon);
    }
  }
  for (const phase of ['lobby', 'fight', 'matchEnd']) assert.equal(loadoutForKey({ key: '2', code: 'Digit2' }, phase), null);
  for (const blocked of [{ repeat: true }, { defaultPrevented: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { target: { closest() { return {}; } } }]) assert.equal(loadoutForKey({ key: '1', ...blocked }, 'buy'), null);
  for (const key of ['0', 'è', '_', 'ç', 'F7']) assert.equal(loadoutForKey({ key }, 'buy'), null, 'symbols require their physical number-row identity');
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

test('pending movement stops at a live body instead of predicting through it on every acknowledgement', () => {
  const snapshot = createState(); snapshot.phase = 'fight';
  const [local, blocker] = snapshot.players;
  Object.assign(local, { x: 20, z: .32, vz: -5.4 });
  Object.assign(blocker, { x: 20, z: -.32 });
  const before = structuredClone(snapshot);
  const buttons = { ...emptyInput(), up: true };
  const history = Array.from({ length: 8 }, (_, index) => ({ seq: index + 1, buttons }));
  const result = reconcilePlayer(local, history, 2, snapshot.mapId, predictLocalMovement, true, snapshot.players);
  assert.deepEqual(result.pending.map(frame => frame.seq), [3, 4, 5, 6, 7, 8]);
  assert.ok(result.predicted.z >= .32 - 1e-7, 'the camera stays outside the other cylinder');
  assert.ok(Math.hypot(result.predicted.x - blocker.x, result.predicted.z - blocker.z) >= local.radius + blocker.radius - 1e-7);
  assert.equal(result.predicted.vz, 0);
  assert.deepEqual(snapshot, before, 'prediction does not move authoritative bodies');
  blocker.alive = false;
  const unblocked = reconcilePlayer(local, history, 2, snapshot.mapId, predictLocalMovement, true, snapshot.players);
  assert.ok(unblocked.predicted.z < .1, 'eliminated players never obstruct movement');
});

test('remote projection respects frozen body contacts independently of player render order', () => {
  const snapshot = createState({ teamSize: 2 }); snapshot.phase = 'fight';
  const target = snapshot.players[1], blocker = snapshot.players[2];
  Object.assign(target, { x: 20, z: .32, vz: -5.4, previousInput: { ...emptyInput(), up: true } });
  Object.assign(blocker, { x: 20, z: -.32 });
  const before = structuredClone(snapshot);
  const render = state => interpolatedState([{ time: 0, state }], 25, 0, { predictMovement: predictLocalMovement });
  const rendered = render(snapshot);
  assert.ok(rendered.players[1].z >= .32 - 1e-7, 'a projected opponent stays on its side of contact');
  assert.deepEqual(rendered.players[0], snapshot.players[0]);
  const reversed = structuredClone(snapshot); reversed.players.reverse();
  const reordered = render(reversed);
  for (const player of rendered.players) assert.deepEqual(player, reordered.players.find(other => other.id === player.id));
  assert.deepEqual(snapshot, before);
});

test('dead players and locked setup phases never predict movement; queues stay bounded', () => {
  const player = createState().players[0]; const buttons = { ...emptyInput(), up: true };
  const history = Array.from({ length: 600 }, (_, seq) => ({ seq, buttons }));
  let result = reconcilePlayer(player, history, -1, 'courtyard', predictLocalMovement, false);
  assert.equal(result.pending.length, 240); assert.equal(result.predicted.z, player.z);
  player.alive = false; result = reconcilePlayer(player, history, -1, 'courtyard', predictLocalMovement);
  assert.equal(result.predicted.z, player.z);
});


test('ADS and utility controls compose independent sources and clear every new action', () => {
  assert.deepEqual(FPS_BUTTONS, Object.keys(emptyInput()).filter(key => !['yaw', 'pitch'].includes(key)), 'wire actions match the authoritative engine contract');
  const touch = { move: { x: 0, y: 0 }, actions: new Set(['swap', 'heal']) };
  const mouse = { fire: false, aim: true }; const aim = { yaw: 1, pitch: -.3 };
  let input = composeInput(new Set(['grenade']), touch, mouse, aim);
  for (const action of ['aim', 'swap', 'grenade', 'heal']) assert.equal(input[action], true);
  assert.equal(input.fire, false);
  mouse.aim = false; touch.actions.delete('swap');
  input = composeInput(new Set(['grenade']), touch, mouse, aim);
  assert.equal(input.aim, false); assert.equal(input.swap, false); assert.equal(input.heal, true);
  touch.actions.add('aim');
  assert.equal(composeInput(new Set(), touch, mouse, aim).aim, true, 'touch aim works without a mouse');
  for (const action of FPS_BUTTONS) assert.equal(composeInput(new Set(FPS_BUTTONS), touch, { fire: true, aim: true }, aim, false)[action], false, `${action} releases on inactive controls`);
  for (const action of ['aim', 'swap', 'grenade', 'heal']) assert.equal(neutralInput()[action], false);
});

test('aim sensitivity follows the finite camera zoom throughout ADS and release', () => {
  assert.equal(aimFraction({ aimTicks: Infinity }), 0);
  assert.equal(aimFraction({ aimTicks: -5 }), 0); assert.equal(aimFraction({ aimTicks: 50 }), 1);
  assert.equal(aimLookMultiplier({ weapon: 'carbine', aimTicks: 0 }), 1);
  assert.equal(aimLookMultiplier({ weapon: 'carbine', aimTicks: 18 }), 54 / 70);
  assert.equal(aimLookMultiplier({ weapon: 'marksman', aimTicks: 18 }), 40 / 70);
  assert.ok(Math.abs(aimLookMultiplier({ weapon: 'sniper', aimTicks: 18 }) - 32 / 70) < 1e-12);
  assert.ok(aimLookMultiplier({ weapon: 'sniper', aimTicks: 9 }) < aimLookMultiplier({ weapon: 'marksman', aimTicks: 9 }));
  assert.equal(aimLookMultiplier({ weapon: 'carbine', aimTicks: 9, aiming: false }), 1 + (54 / 70 - 1) / 2, 'releasing aim keeps look aligned with the still narrowing view');
  assert.ok(aimLookMultiplier({ weapon: 'marksman', aimTicks: 9 }) < aimLookMultiplier({ weapon: 'carbine', aimTicks: 9 }));
  assert.equal(aimLookMultiplier({ weapon: 'marksman', aimTicks: 5 }, { ticks: 5, scopedFovRatio: .5 }), .5);
  for (const blocked of [{ slot: 'sword' }, { healing: true }, { healTicks: 20 }, { reloadTicks: 20 }, { grenadeThrowTicks: 10 }, { alive: false }]) {
    assert.equal(aimFraction({ aimTicks: 18, ...blocked }), 0);
    assert.equal(aimLookMultiplier({ weapon: 'marksman', aimTicks: 18, ...blocked }), 1, 'look and scope release whenever the camera returns to hip fire');
  }
});

test('combat readout distinguishes a committed sword strike, gun ammo and potion channel', () => {
  const weapons = { pistol: { label: 'PISTOL', mode: 'semi', reloadTicks: 240 } };
  const player = { weapon: 'pistol', slot: 'primary', grounded: true, hp: 75, maxHp: 100, ammo: 6, reserve: 24, grenades: 1, potions: 1 };
  let readout = combatReadout(player, weapons);
  assert.equal(readout.label, 'PISTOL'); assert.equal(readout.ammo, 6); assert.equal(readout.status, 'CLICK EACH SHOT'); assert.equal(readout.progress, null);
  Object.assign(player, { slot: 'sword', meleeTicks: 54, meleePhase: 'active' });
  readout = combatReadout(player, weapons);
  assert.equal(readout.label, 'SWORD'); assert.equal(readout.ammo, 'STRIKE'); assert.equal(readout.progress.percent, 25); assert.equal(readout.status, '0.5S · BLADE ACTIVE');
  player.meleeTicks = 0; player.meleePhase = 'idle';
  readout = combatReadout(player, weapons); assert.equal(readout.ammo, 'READY'); assert.equal(readout.progress, null);
  player.meleeCooldown = 36;
  readout = combatReadout(player, weapons); assert.equal(readout.ammo, 'RECOVER'); assert.equal(readout.status, '0.3S · RECOVERING'); assert.equal(readout.progress.percent, 50, 'swapping away from a swing cannot hide its recovery');
  player.meleeCooldown = 0;
  Object.assign(player, { healing: true, healTicks: 120, potions: 0 });
  readout = combatReadout(player, weapons);
  assert.equal(readout.label, 'HEALING POTION'); assert.equal(readout.ammo, '+25'); assert.equal(readout.progress.percent, 50); assert.equal(readout.progress.label, 'Drinking healing potion'); assert.equal(readout.potions, 0);
  assert.equal(player.ammo, 6, 'readout cannot consume the primary gun magazine');
});

test('reload progress and empty ammo remain honest across utility and weapon states', () => {
  const weapons = { shotgun: { label: 'SHOTGUN', mode: 'pump', reloadTicks: 300 } };
  const player = { weapon: 'shotgun', slot: 'primary', grounded: true, hp: 40, ammo: 0, reserve: 8, grenades: 0, potions: 0 };
  let readout = combatReadout(player, weapons); assert.equal(readout.status, 'R TO RELOAD'); assert.equal(readout.grenades, 0); assert.equal(readout.potions, 0);
  player.reloadTicks = 225;
  readout = combatReadout(player, weapons); assert.equal(readout.progress.percent, 25); assert.equal(readout.progress.remaining, 225); assert.equal(readout.status, 'RELOADING 1.9S');
  player.reloadTicks = 0; player.reserve = 0;
  assert.equal(combatReadout(player, weapons).status, 'OUT OF AMMUNITION');
  player.ammo = 3; player.shotCooldown = 60;
  assert.equal(combatReadout(player, weapons).status, 'PUMPING 0.5S');
  player.shotCooldown = 0;
  assert.equal(combatReadout(player, weapons).status, 'CLICK EACH SHELL');
  player.reloadTicks = 600;
  assert.equal(combatReadout(player, weapons).progress.percent, 0, 'malformed or corrected remaining duration never paints negative progress');
});


test('self grenade hits count as hurt feedback and never as successful offense', () => {
  const ownFrag = { type: 'damage', attack: 'grenade', playerId: 0, targetId: 0, damage: 80 };
  assert.deepEqual(combatEventPerspective(ownFrag, 0), { source: 0, target: 0, self: true, outgoing: false, incoming: true });
  assert.deepEqual(combatEventPerspective({ ...ownFrag, type: 'kill' }, 0), { source: 0, target: 0, self: true, outgoing: false, incoming: true });
  const enemyHit = { ...ownFrag, targetId: 1 };
  assert.equal(combatEventPerspective(enemyHit, 0).outgoing, true);
  assert.equal(combatEventPerspective(enemyHit, 1).incoming, true);
  assert.equal(combatEventPerspective(enemyHit, null).outgoing, false, 'a disconnected seat cannot receive offensive feedback');
  assert.equal(combatEventPerspective({ type: 'grenadeExplosion', ownerId: 0 }, 0).outgoing, false, 'an explosion alone is not a confirmed hit');
});


test('one shotgun shell produces one report while legacy shots and pellets remain supported', () => {
  assert.equal(hasGunshotReport({ type: 'shot', weapon: 'carbine' }), true);
  assert.equal(hasGunshotReport({ type: 'fire', weapon: 'marksman' }), true);
  assert.equal(hasGunshotReport({ type: 'boltLaunch', weapon: 'crossbow' }), true);
  assert.equal(hasGunshotReport({ type: 'boltImpact', weapon: 'crossbow' }), false);
  assert.equal(hasGunshotReport({ type: 'shot', pellet: 0, pelletCount: 8 }), true);
  for (let pellet = 1; pellet < 8; pellet++) assert.equal(hasGunshotReport({ type: 'shot', pellet, pelletCount: 8 }), false);
  assert.equal(hasGunshotReport({ type: 'damage', pellet: 0 }), false);
  assert.equal(hasGunshotReport(null), false);
  const volley = Array.from({ length: 6 }, (_, playerId) => Array.from({ length: 8 }, (_, pellet) => ({ type: 'shot', playerId, weapon: 'shotgun', pellet }))).flat();
  assert.equal(volley.filter(hasGunshotReport).length, 6, 'a full 3v3 volley needs six gun reports rather than 48');
  assert.equal(volley.length, 48, 'audio gating never removes pellet contact events');
});

test('LMG feedback shows only authoritative wind-up, and utility interrupts its progress', () => {
  const player = { weapon: 'lmg', slot: 'primary', grounded: true, hp: 80, maxHp: 100, ammo: 48, reserve: 96, spinTicks: 12 };
  let readout = combatReadout(player);
  assert.equal(readout.status, 'SPINNING UP · HOLD FIRE');
  assert.equal(readout.progress.label, 'LMG wind-up');
  assert.equal(readout.progress.remaining, 12); assert.equal(readout.progress.percent, 50);
  player.spinTicks = 24;
  assert.equal(combatReadout(player).progress, null, 'a fully wound weapon has no fictitious loading progress');
  player.spinTicks = 0;
  assert.equal(combatReadout(player).status, 'HOLD FIRE · WIND-UP');
  player.spinTicks = 12; player.reloadTicks = 198;
  readout = combatReadout(player); assert.equal(readout.progress.label, 'Reload'); assert.equal(readout.progress.percent, 50);
  player.healTicks = 120;
  readout = combatReadout(player); assert.equal(readout.label, 'HEALING POTION'); assert.equal(readout.progress.label, 'Drinking healing potion');
});

test('sniper recovery and single-bolt crossbow reload are visible without anticipating hits', () => {
  const player = { weapon: 'sniper', slot: 'primary', grounded: true, ammo: 4, reserve: 15, shotCooldown: 120 };
  let readout = combatReadout(player);
  assert.equal(readout.label, 'BOLT SNIPER'); assert.equal(readout.status, 'CYCLING BOLT 1.0S');
  assert.equal(readout.progress.label, 'Bolt recovery'); assert.equal(readout.progress.percent, 20);
  player.shotCooldown = 0;
  assert.equal(combatReadout(player).status, 'SETTLE INTO SCOPE');
  Object.assign(player, { weapon: 'crossbow', ammo: 0, reserve: 12, shotCooldown: 90 });
  assert.equal(combatReadout(player).status, 'R TO RELOAD BOLT');
  player.reloadTicks = 99;
  readout = combatReadout(player); assert.equal(readout.progress.label, 'Reload'); assert.equal(readout.progress.percent, 50);
  Object.assign(player, { reloadTicks: 0, shotCooldown: 0, ammo: 1 });
  assert.equal(combatReadout(player).status, 'LEAD TARGET · CLICK EACH BOLT');
  assert.equal(combatEventPerspective({ type: 'boltLaunch', playerId: 0 }, 0).outgoing, false, 'firing a bolt is not a confirmed hit');
  assert.equal(combatEventPerspective({ type: 'damage', weapon: 'crossbow', playerId: 0, targetId: 1 }, 0).outgoing, true);
});


test('health meter paints actual HP immediately and keeps a bounded fading damage trail', () => {
  const player = { id: 0, hp: 150, maxHp: 150, alive: true };
  const full = healthPresentation(player, null, { now: 0, round: 1 });
  assert.equal(full.percent, 100); assert.equal(full.maxHp, 150);
  player.hp = 90;
  const hit = healthPresentation(player, full, { now: 100, round: 1 });
  assert.equal(hit.hp, 90); assert.equal(hit.percent, 60); assert.equal(hit.trailPercent, 100);
  const held = healthPresentation(player, hit, { now: 499, round: 1 });
  assert.equal(held.trailPercent, 100);
  const fading = healthPresentation(player, held, { now: 775, round: 1 });
  assert.equal(fading.trailPercent, 80);
  const done = healthPresentation(player, fading, { now: 1100, round: 1 });
  assert.equal(done.trailPercent, 60);
  player.hp = 40;
  assert.equal(healthPresentation(player, done, { now: 1200, round: 1 }).low, true);
  assert.equal(player.hp, 40, 'presentation cannot change simulation health');
});

test('healing, round restore and a different spectator reset the health trail truthfully', () => {
  const player = { id: 0, hp: 30, maxHp: 100, alive: true };
  const low = healthPresentation(player, null, { now: 100, round: 1 });
  player.hp = 70;
  const healed = healthPresentation(player, low, { now: 200, round: 1 });
  assert.equal(healed.hp, 70); assert.equal(healed.trailPercent, 70); assert.equal(healed.low, false);
  player.hp = 10;
  const hit = healthPresentation(player, healed, { now: 300, round: 1 });
  player.hp = 100;
  const newRound = healthPresentation(player, hit, { now: 350, round: 2 });
  assert.equal(newRound.trailHp, 100); assert.equal(newRound.damageAt, -Infinity);
  const other = healthPresentation({ ...player, id: 1, hp: 20 }, hit, { now: 350, round: 1 });
  assert.equal(other.trailHp, 20); assert.equal(other.hp, 20);
  assert.equal(healthPresentation({ ...player, hp: -30, alive: false }).hp, 0);
  assert.equal(healthPresentation({ ...player, hp: Infinity }).hp, 0);
});

test('spectated HP and ammunition belong only to the actual allied camera', () => {
  const state = { players: [{ id: 0, team: 0, alive: true, hp: 80 }, { id: 1, team: 0, alive: true, hp: 25 }, { id: 2, team: 1, alive: true, hp: 99 }] };
  assert.equal(healthHUDPlayer(state, 0, 1).id, 0, 'living player always sees their own health');
  state.players[0].alive = false;
  assert.equal(healthHUDPlayer(state, 0, 1).hp, 25);
  assert.equal(healthHUDPlayer(state, 0, 2).id, 0, 'an enemy cannot supply HUD health');
  state.players[1].alive = false;
  assert.equal(healthHUDPlayer(state, 0, 1).id, 0);
  assert.equal(healthHUDPlayer(state, null, 2), null);
});

test('shotgun feedback groups confirmed HP loss per target and excludes speculative and self hits', () => {
  const pellets = Array.from({ length: 8 }, (_, n) => ({ type: 'damage', tick: 20, playerId: 0, targetId: 1, weapon: 'shotgun', damage: n === 7 ? 4 : 12, headshot: n === 0 }));
  const events = [...pellets, { type: 'shot', tick: 20, playerId: 0, targetId: 1, damage: 999 }, { type: 'damage', tick: 20, playerId: 0, targetId: 0, weapon: 'grenade', damage: 80 }, { type: 'damage', tick: 20, playerId: 1, targetId: 0, damage: 28 }];
  const hits = confirmedHitGroups(events, 0);
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, 88); assert.equal(hits[0].contacts, 8); assert.equal(hits[0].label, 'HEADSHOT');
  assert.deepEqual(confirmedHitGroups(events, null), []);
  assert.equal(confirmedHitGroups([{ type: 'damage', tick: 21, playerId: 0, targetId: 1, weapon: 'carbine', damage: 21, hitKind: 'leg' }], 0)[0].label, 'LEG HIT');
});

test('all nine loadout comparison cards state damage, firing rhythm and real falloff', () => {
  for (const id of Object.keys(WEAPONS)) {
    const card = weaponComparison(id); assert.ok(card);
    assert.ok(Number.isFinite(card.body) && card.body > 0); assert.ok(card.head >= card.body); assert.ok(card.leg < card.body);
    assert.match(card.reload, / s$/); assert.ok(card.rate.length); assert.ok(card.handling.length);
  }
  const shotgun = weaponComparison('shotgun');
  assert.equal(shotgun.body, 12); assert.match(shotgun.damageLabel, /PELLET.*8 PELLETS/);
  assert.match(shotgun.range, /8 m.*25%/);
  assert.match(weaponComparison('crossbow').handling, /48 m\/s.*9 m\/s²/);
  assert.match(weaponComparison('lmg').handling, /0.20 s wind-up/);
  assert.equal(weaponComparison('invalid'), null);
});


test('the live squad health strip exposes at most two connected allies with honest death and HP', () => {
  const state = { players: [{ id: 0, team: 0, alive: true, hp: 100 }, { id: 1, team: 0, alive: true, hp: 25 }, { id: 2, team: 0, alive: false, hp: 0 }, { id: 3, team: 1, alive: true, hp: 10 }, { id: 4, team: 0, alive: true, hp: 100 }] };
  const squad = tacticalSquadHealth(state, 0, [0, 1, 2, 3, 4]);
  assert.deepEqual(squad.map(player => player.id), [1, 2]); assert.equal(squad[0].low, true); assert.equal(squad[1].dead, true); assert.equal(squad[1].percent, 0);
  assert.deepEqual(tacticalSquadHealth(state, 0, [0, 3]), []); assert.deepEqual(tacticalSquadHealth(state, null), []);
  state.players[1].hp = 999; assert.equal(tacticalSquadHealth(state, 0, [0, 1])[0].hp, 100);
});
