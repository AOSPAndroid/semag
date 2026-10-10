import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatPlayer, predictLocalMovement, emptyInput, PLAYER_HEALTH, HEAL } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { initializeInventory } from '../public/voxel-inventory.js';
import { cleanAim, neutralInput, controlForKey, controlsAllowed, composeInput, createInputPacer, aliveParticipants, canHostStart, roomPresentation, spectatorPlayer, lootPresentation, stormPresentation, healthPresentation, combatReadout, aimFraction, confirmedHitGroups, reconcilePlayer, interpolatedState } from '../public/voxel-royale-client.js';

const arena = { id: 'test-island', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [{ id: 'cover', x: -3, y: 0, z: -3, w: 6, h: 3, d: 1 }] };
const player = (id = 0, values = {}) => {
  const own = { ...createCombatPlayer(id), team: id };
  initializeInventory(own, { weapon: values.weapon || 'carbine', knifeOnly: values.hasGun !== true, potions: values.potions ?? 0, grenades: values.grenades ?? 0 });
  return Object.assign(own, values);
};
const active = { connected: true, entered: true, paused: false, modalOpen: false, graphicsError: '', hidden: false, alive: true, phase: 'fight', pointerLocked: true, fallback: false, touchMode: false };

test('French printed movement and close-hand utilities work while Control crouches', () => {
  for (const [key, code, expected] of [['z', 'KeyW', 'up'], ['q', 'KeyA', 'left'], ['a', 'KeyQ', 'grenade'], ['f', 'KeyF', 'heal'], ['e', 'KeyE', 'interact']]) assert.equal(controlForKey({ key, code, ctrlKey: true }, 'zqsd'), expected);
  assert.equal(controlForKey({ key: 'z', altKey: true }, 'zqsd'), null);
  assert.equal(controlForKey({ key: 'f', isComposing: true }), null);
  assert.equal(controlForKey({ key: 'ArrowUp' }), 'up');
});

test('capture, fallback and touch require live entered controls; all release boundaries neutralize', () => {
  assert.equal(controlsAllowed(active), true);
  assert.equal(controlsAllowed({ ...active, pointerLocked: false, fallback: true }), true);
  assert.equal(controlsAllowed({ ...active, pointerLocked: false, touchMode: true }), true);
  for (const change of [{ connected: false }, { entered: false }, { paused: true }, { modalOpen: true }, { graphicsError: 'lost' }, { hidden: true }, { alive: false }, { phase: 'lobby' }, { phase: 'matchEnd' }, { pointerLocked: false }]) assert.equal(controlsAllowed({ ...active, ...change }), false);
  const touch = { actions: new Set(['interact']), move: { x: 1, y: -1 } }, keys = new Set(['heal']), mouse = { fire: true, aim: true };
  const input = composeInput(keys, touch, mouse, { yaw: 8, pitch: 10 }, false);
  assert.deepEqual(input, neutralInput(8, 10)); assert.equal(input.pitch, 1.35);
  const live = composeInput(keys, touch, mouse, cleanAim(), true);
  for (const action of ['interact', 'heal', 'fire', 'aim', 'up', 'right']) assert.equal(live[action], true);
});

test('look, frame and heartbeat share 60 Hz budget while digital releases bypass it', () => {
  const pacer = createInputPacer(); let sends = 0;
  for (let ms = 0; ms < 1000; ms++) if (pacer.shouldSend(ms)) sends++;
  assert.ok(sends <= 60 && sends >= 58, `continuous sends=${sends}`);
  assert.equal(pacer.shouldSend(999, true), true);
  assert.equal(pacer.shouldSend(1000), false);
  pacer.reset(); assert.equal(pacer.shouldSend(1000), true);
});

test('host starts with at least two connected people, never readiness or occupied slots', () => {
  const state = { phase: 'lobby' }, roster = [{ id: 0, connected: true, ready: false }, { id: 1, connected: true, ready: false }, { id: 2, connected: false, ready: true }];
  assert.equal(canHostStart(state, roster, 0, 0), true);
  assert.equal(canHostStart(state, roster, 1, 0), false);
  assert.equal(canHostStart(state, roster, 0, 0, false), false);
  assert.equal(canHostStart({ phase: 'fight' }, roster, 0, 0), false);
  assert.equal(canHostStart(state, [roster[0], roster[2]], 0, 0), false);
});

test('selected capacity governs visible seats and invitations, including smaller rooms and welcome fallback', () => {
  const roster = [{ id: 0, connected: true, name: 'Host' }, { id: 1, connected: true, name: 'Rival' }];
  const duel = roomPresentation({ capacity: 2 }, roster); assert.equal(duel.label, '2 / 2 PLAYERS'); assert.equal(duel.slots.length, 2); assert.deepEqual(duel.slots.map(slot => slot.person?.name), ['Host', 'Rival']);
  const nine = roomPresentation({ capacity: 9 }, roster); assert.equal(nine.label, '2 / 9 PLAYERS'); assert.equal(nine.slots.length, 9); assert.equal(nine.slots.filter(slot => !slot.person).length, 7);
  assert.equal(roomPresentation(null, roster, 4).capacity, 4);
  for (const invalid of [0, 1, 11, 2.5, NaN, '2']) assert.equal(roomPresentation({ capacity: invalid }, roster).capacity, 10);
});

test('living HUD remains own, eliminated spectators can follow any living participant only', () => {
  const state = { participantIds: [0, 2, 5], players: [player(0), player(2), player(5), player(9)] };
  assert.deepEqual(aliveParticipants(state).map(p => p.id), [0, 2, 5]);
  assert.equal(spectatorPlayer(state, 0, 5).id, 0);
  state.players[0].alive = false;
  assert.equal(spectatorPlayer(state, 0, 5).id, 5);
  assert.equal(spectatorPlayer(state, 0, 9).id, 2);
  state.players[1].alive = false; state.players[2].alive = false;
  assert.equal(spectatorPlayer(state, 0, 9).id, 0);
  assert.deepEqual(aliveParticipants({ players: state.players }), []);
});

test('gun placeholder does not become owned inventory or sights until scavenged', () => {
  const unarmed = player(0, { weapon: 'sniper', aimTicks: 18, slot: 'primary' });
  const sword = combatReadout(unarmed); assert.equal(sword.label, 'KNIFE'); assert.equal(sword.ammo, 'READY'); assert.equal(sword.inventory, 'KNIFE'); assert.equal(aimFraction(unarmed), 0);
  const gun = player(0, { hasGun: true, weapon: 'shotgun', slot: 'primary', ammo: 4, reserve: 12 });
  const armed = combatReadout(gun); assert.equal(armed.label, WEAPONS.shotgun.label); assert.equal(armed.ammo, 4); assert.equal(armed.reserve, 12);
  assert.equal(aimFraction({ ...gun, aimTicks: 18 }), 1);
  assert.equal(aimFraction({ ...gun, aimTicks: 18, reloadTicks: 1 }), 0);
});

test('small-knife progress uses its quicker profile and remains in inventory after finding a gun', () => {
  const own = player(0, { meleeTicks: 22, meleePhase: 'startup' });
  let readout = combatReadout(own);
  assert.equal(readout.label, 'KNIFE'); assert.equal(readout.progress.total, 44); assert.equal(readout.progress.percent, 50); assert.equal(readout.progress.label, 'Knife attack and recovery');
  readout = combatReadout(player(0, { hasGun: true, weapon: 'smg', slot: 'primary', meleeTicks: 0 }));
  assert.equal(readout.inventory, `KNIFE · ${WEAPONS.smg.label}`);
});

test('pickup readout explains gun exchanges, consumables and ammunition without inventing availability', () => {
  const own = player(0, { hasGun: true, weapon: 'carbine', potions: 1, grenades: 1 });
  const exchange = lootPresentation({ id: 'sniper-cache', kind: 'weapon', weapon: 'sniper', ammo: 2, reserve: 8 }, own);
  assert.equal(exchange.name, WEAPONS.sniper.name); assert.match(exchange.detail, /Replace Kestrel Carbine.*slot 2.*2 \/ 8/);
  assert.match(lootPresentation({ id: 1, kind: 'weapon', weapon: 'smg' }, player()).detail, /Pick up/);
  assert.match(lootPresentation({ id: 1, kind: 'ammo', amount: 24 }, own).detail, /\+24 RESERVE/);
  assert.match(lootPresentation({ id: 1, kind: 'heal' }, own).detail, /STACK TO 2.*F TO HEAL/);
  assert.equal(lootPresentation(null, own), null);
  assert.equal(lootPresentation({ kind: 'weapon', weapon: 'unknown' }, own), null);
  assert.equal(lootPresentation({ kind: 'heal' }, { ...own, alive: false }), null);
});

test('storm readout follows authoritative circle, countdown and changing damage', () => {
  const state = { phase: 'fight', storm: { x: 2, z: 3, radius: 10, stage: 0, mode: 'waiting', ticksUntilShrink: 121, damagePerSecond: 4 } };
  let readout = stormPresentation(state, player(0, { x: 12, z: 3 })); assert.equal(readout.outside, false); assert.equal(readout.text, '0:02'); assert.equal(readout.label, 'ZONE CLOSES IN');
  readout = stormPresentation(state, player(0, { x: 12.01, z: 3 })); assert.equal(readout.outside, true); assert.match(readout.detail, /4 HP \/ SEC/);
  state.storm.mode = 'shrinking'; state.storm.ticksUntilNext = 7200; state.storm.ticksUntilShrink = 0; assert.equal(stormPresentation(state, player()).text, '1:00');
  state.storm.mode = 'final'; assert.equal(stormPresentation(state, player()).text, 'SURVIVE');
  state.phase = 'lobby'; assert.equal(stormPresentation(state, player()).visible, false);
});

test('HP responds immediately, recent loss decays and spectator or rematch never inherits a trail', () => {
  let health = healthPresentation(player(), null, { now: 0, matchId: 1 });
  health = healthPresentation(player(0, { hp: 72 }), health, { now: 100, matchId: 1 }); assert.equal(health.hp, 72); assert.equal(health.trailHp, PLAYER_HEALTH);
  health = healthPresentation(player(0, { hp: 23 }), health, { now: 200, matchId: 1 }); assert.equal(health.low, true); assert.equal(health.percent, 11.5);
  health = healthPresentation(player(0, { hp: 23 }), health, { now: 1150, matchId: 1 }); assert.equal(health.trailHp, 23);
  health = healthPresentation(player(0, { hp: 63 }), health, { now: 1200, matchId: 1 }); assert.equal(health.trailHp, 63);
  health = healthPresentation(player(2, { hp: 90 }), health, { now: 1250, matchId: 1 }); assert.equal(health.trailHp, 90);
  health = healthPresentation(player(2, { hp: 10 }), health, { now: 1300, matchId: 2 }); assert.equal(health.trailHp, 10);
});

test('reload and healing progress follow actual simulation ticks and reserves', () => {
  const own = player(0, { hasGun: true, weapon: 'crossbow', slot: 'primary', ammo: 0, reserve: 4, reloadTicks: WEAPONS.crossbow.reloadTicks / 2 });
  let readout = combatReadout(own); assert.equal(readout.progress.percent, 50); assert.match(readout.status, /RELOADING/);
  own.hp = 80; own.healTicks = HEAL.ticks / 2; own.potions = 1; readout = combatReadout(own); assert.equal(readout.ammo, '+60'); assert.equal(readout.progress.percent, 50); assert.equal(readout.healing, true);
  own.hp = 185; assert.equal(combatReadout(own).ammo, '+15', 'healing stops at authoritative maximum health');
});

test('confirmed hits group shotgun pellets and exclude speculative, self or storm damage', () => {
  const events = [{ type: 'shot', playerId: 0, targetId: 2, damage: 12 }, ...Array.from({ length: 3 }, () => ({ type: 'damage', attackerId: 0, targetId: 2, tick: 7, weapon: 'shotgun', damage: 12, hitKind: 'leg' })), { type: 'damage', attackerId: 0, targetId: 0, damage: 20 }, { type: 'damage', attackerId: null, targetId: 0, damage: 3 }, { type: 'damage', attackerId: 2, targetId: 5, damage: 20 }];
  assert.deepEqual(confirmedHitGroups(events, 0), [{ targetId: 2, damage: 36, headshot: false, legshot: true, label: 'LEG HIT' }]);
});

test('real shared prediction respects royale cover, copies source and bounds unacknowledged history', () => {
  const own = player(0, { x: 0, z: 0 }), before = structuredClone(own), history = Array.from({ length: 360 }, (_, i) => ({ seq: i + 1, buttons: emptyInput({ yaw: 0 }) }));
  for (const frame of history) frame.buttons.up = true;
  const result = reconcilePlayer(own, history, 0, arena, predictLocalMovement, true, []);
  assert.equal(result.pending.length, 240); assert.deepEqual(own, before); assert.ok(result.predicted.z >= -2 + own.radius - 1e-6, `cover blocks at z=${result.predicted.z}`); assert.equal(result.predicted.hp, PLAYER_HEALTH); assert.equal(result.predicted.ammo, 0);
  const acked = reconcilePlayer(own, history, 359, arena, predictLocalMovement); assert.equal(acked.pending.length, 1);
  assert.deepEqual(reconcilePlayer(own, history, 0, arena, predictLocalMovement, false).predicted, own);
});

test('remote interpolation crosses yaw wrap but never local aim, teleport, death or match boundary', () => {
  const old = { phase: 'fight', matchId: 1, map: arena, players: [player(0), player(2, { x: 0, yaw: 3.1 })], bolts: [] };
  const next = { ...old, players: [player(0, { x: 3 }), player(2, { x: 2, yaw: -3.1 })] };
  let result = interpolatedState([{ time: 0, state: old }, { time: 100, state: next }], 50, 0);
  assert.equal(result.players[0].x, 3); assert.equal(result.players[1].x, 1); assert.ok(Math.abs(result.players[1].yaw) > 3); assert.equal(next.players[1].x, 2);
  next.players[1].x = 10; result = interpolatedState([{ time: 0, state: old }, { time: 100, state: next }], 50, 0); assert.equal(result.players[1].x, 10);
  next.players[1].x = 2; next.matchId = 2; result = interpolatedState([{ time: 0, state: old }, { time: 100, state: next }], 50, 0); assert.equal(result.players[1].x, 2);
  next.matchId = 1; next.players[1].alive = false; result = interpolatedState([{ time: 0, state: old }, { time: 100, state: next }], 50, 0); assert.equal(result.players[1].x, 2);
});

test('remote projection uses actual royale map, fixed peers and no more than 25ms', () => {
  const own = player(0), remote = player(2, { x: 4 }); const state = { phase: 'fight', matchId: 1, map: arena, players: [own, remote], bolts: [] };
  const calls = []; const result = interpolatedState([{ time: 0, state }], 500, 0, { predictMovement: (p, buttons, map, ticks, peers) => { calls.push({ id: p.id, map, ticks, peers }); p.x++; } });
  assert.equal(calls.length, 1); assert.equal(calls[0].id, 2); assert.equal(calls[0].ticks, 3); assert.equal(calls[0].map, arena); assert.equal(calls[0].peers[1].x, 4); assert.equal(result.players[1].x, 5); assert.equal(remote.x, 4);
});
