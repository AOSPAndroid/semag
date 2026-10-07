import assert from 'node:assert/strict';
import test from 'node:test';
import { aimFraction, aimLookMultiplier, combatEventPerspective, combatReadout, cleanAim, composeInput, controlForKey, createContinuousInputPacer, FPS_BUTTONS, hasGunshotReport, interpolatedState, isFormTarget, loadoutForKey, matchClock, neutralInput, reconcilePlayer, roundResult, tacticalMapPlayers } from '../public/voxel-client.js';
import { createState, emptyInput, MAPS, predictLocalMovement } from '../public/voxel-engine.js';

test('FPS controls use printed French letters and preserve arrows and actions', () => {
  assert.equal(controlForKey({ key: 'z', code: 'KeyW' }, 'zqsd'), 'up');
  assert.equal(controlForKey({ key: 'q', code: 'KeyA' }, 'zqsd'), 'left');
  assert.equal(controlForKey({ key: 'w', code: 'KeyZ' }, 'zqsd'), null);
  assert.equal(controlForKey({ key: 'a', code: 'KeyQ' }, 'zqsd'), null);
  assert.equal(controlForKey({ key: 'ArrowLeft', code: 'ArrowLeft' }, 'zqsd'), 'left');
  for (const [key, action] of [[' ', 'jump'], ['Control', 'crouch'], ['Shift', 'walk'], ['r', 'reload'], ['e', 'interact'], ['g', 'grenade'], ['v', 'swap'], ['h', 'heal']]) assert.equal(controlForKey({ key }, 'zqsd'), action);
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
    for (const [key, weapon] of [['4', 'pistol'], ['5', 'shotgun'], ['6', 'burst']]) assert.equal(loadoutForKey({ key, code: `Numpad${key}` }, phase), weapon);
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
  assert.equal(hasGunshotReport({ type: 'shot', pellet: 0, pelletCount: 8 }), true);
  for (let pellet = 1; pellet < 8; pellet++) assert.equal(hasGunshotReport({ type: 'shot', pellet, pelletCount: 8 }), false);
  assert.equal(hasGunshotReport({ type: 'damage', pellet: 0 }), false);
  assert.equal(hasGunshotReport(null), false);
  const volley = Array.from({ length: 6 }, (_, playerId) => Array.from({ length: 8 }, (_, pellet) => ({ type: 'shot', playerId, weapon: 'shotgun', pellet }))).flat();
  assert.equal(volley.filter(hasGunshotReport).length, 6, 'a full 3v3 volley needs six gun reports rather than 48');
  assert.equal(volley.length, 48, 'audio gating never removes pellet contact events');
});
