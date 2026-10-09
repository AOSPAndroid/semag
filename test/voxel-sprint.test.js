import assert from 'node:assert/strict';
import test from 'node:test';
import * as Combat from '../public/voxel-engine.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { createMovementPresenter, projectedMovement, reconcileMovement } from '../public/voxel-presentation.js';

const arena = { id: 'sprint-physics-fixture', bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }, colliders: [], sites: [] };
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const movement = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'stamina', 'staminaRegenTicks', 'sprintExhausted', 'sprinting', 'grounded', 'crouching'];
function fixture({ knife = false, weapon = 'carbine', map = arena, fields = {}, peer = {} } = {}) {
  const players = [Combat.createCombatPlayer(0, 1, weapon), Combat.createCombatPlayer(1)];
  Object.assign(players[0], { human: true, ...fields }); Object.assign(players[1], { x: 100, z: 100, ...peer });
  if (knife) setInventoryMeleeLoadout(players[0], 'knife', { equip: true });
  return { state: { gameId: 'sprint-fixture', tick: 0, phase: 'fight', players, fighters: players, map, events: [], eventId: 0, grenades: [], bolts: [], loot: [] }, player: players[0], peer: players[1] };
}
function tick(state, buttons = {}, count = 1) {
  for (let index = 0; index < count; index++) {
    state.tick++;
    const inputs = state.players.map(player => ({ ...Combat.emptyInput(player), ...(player.id === 0 ? buttons : {}) }));
    Combat.combatStep(state, inputs, state.map);
  }
}

test('sprint uses one immutable shared contract and strict input booleans', () => {
  assert.ok(Object.isFrozen(Combat.SPRINT)); assert.ok(Combat.INPUT_KEYS.includes('sprint')); assert.equal(Combat.emptyInput().sprint, false);
  assert.deepEqual(Combat.SPRINT, { maxStamina: 100, speedMultiplier: 1.4, drainPerSecond: 24, regenPerSecond: 18, regenDelayTicks: 144, restartStamina: 25 });
  const { state, player } = fixture();
  assert.deepEqual([player.stamina, player.staminaRegenTicks, player.sprintExhausted, player.sprinting], [100, 0, false, false]);
  tick(state, { up: true, sprint: 'true' }, 60); close(Math.hypot(player.vx, player.vz), Combat.WEAPONS.carbine.speed); assert.equal(player.stamina, 100);
  Object.assign(player, { stamina: NaN, staminaRegenTicks: Infinity, sprintExhausted: 'true' }); tick(state);
  assert.deepEqual([player.stamina, player.staminaRegenTicks, player.sprintExhausted], [100, 0, false]);
});

test('grounded forward and diagonal sprint are faster without diagonal speed or stamina multiplication', () => {
  const normal = fixture(), straight = fixture(), diagonal = fixture();
  tick(normal.state, { up: true }, 60); tick(straight.state, { up: true, sprint: true }, 60); tick(diagonal.state, { up: true, right: true, sprint: true }, 60);
  const speed = Combat.WEAPONS.carbine.speed * Combat.SPRINT.speedMultiplier;
  close(Math.hypot(straight.player.vx, straight.player.vz), speed); close(Math.hypot(diagonal.player.vx, diagonal.player.vz), speed);
  assert.ok(-straight.player.z > -normal.player.z * 1.3); close(diagonal.player.stamina, straight.player.stamina);
  close(100 - straight.player.stamina, -straight.player.z / speed * Combat.SPRINT.drainPerSecond);
  assert.equal(straight.player.sprinting, true);
});

test('backwards, sideways, idle, bots and monsters cannot claim a sprint bonus or drain', () => {
  for (const [buttons, fields] of [[{ down: true, sprint: true }, {}], [{ right: true, sprint: true }, {}], [{ sprint: true }, {}], [{ up: true, sprint: true }, { bot: true }], [{ up: true, sprint: true }, { monster: true, human: false, monsterType: 'stalker' }]]) {
    const { state, player } = fixture({ fields }); tick(state, buttons, 60);
    assert.equal(player.stamina, 100); assert.equal(player.sprinting, false);
    if (!player.monster) assert.ok(Math.hypot(player.vx, player.vz) <= Combat.WEAPONS.carbine.speed + 1e-8);
  }
});

test('thin solid cover charges only reached ground distance and blocked held sprint cannot play a treadmill', () => {
  const map = { ...arena, colliders: [{ id: 'thin-screen', x: -10, y: 0, z: -1, w: 20, h: 4, d: .01 }] };
  const { state, player } = fixture({ map }); tick(state, { up: true, sprint: true }, 120);
  close(player.z, -.67, 1e-6); assert.equal(player.sprinting, false);
  close(100 - player.stamina, -player.z / (Combat.WEAPONS.carbine.speed * Combat.SPRINT.speedMultiplier) * Combat.SPRINT.drainPerSecond);
  const pose = [player.x, player.z]; tick(state, { up: true, sprint: true }, 400);
  assert.deepEqual([player.x, player.z], pose); assert.equal(player.stamina, 100); assert.equal(player.sprinting, false);
});

test('stationary peer shielding charges only actual corrected travel, preserves the peer and agrees with prediction', () => {
  const { state, player, peer } = fixture({ peer: { x: 0, z: -1 } }), predicted = structuredClone(player), peers = [structuredClone(peer)];
  for (let frame = 0; frame < 120; frame++) {
    Combat.predictLocalMovement(predicted, { up: true, sprint: true }, arena, 1, peers); tick(state, { up: true, sprint: true });
    close(predicted.z, player.z); close(predicted.stamina, player.stamina, 1e-5);
  }
  close(player.z, -.36, 1e-6); assert.deepEqual([peer.x, peer.z], [0, -1]); assert.equal(player.sprinting, false);
  close(100 - player.stamina, -player.z / (Combat.WEAPONS.carbine.speed * Combat.SPRINT.speedMultiplier) * Combat.SPRINT.drainPerSecond, 1e-5);
});

test('exhaustion cannot oscillate sprint under a held key and requires recovery plus release', () => {
  const { state, player } = fixture(); let exhaustedAt = 0;
  for (let frame = 1; frame < 800; frame++) { tick(state, { up: true, sprint: true }); if (player.sprintExhausted) { exhaustedAt = frame; break; } }
  assert.ok(exhaustedAt > 500 && exhaustedAt < 540); assert.equal(player.stamina, 0); assert.equal(player.sprinting, false);
  tick(state, { up: true }); assert.equal(player.sprintExhausted, true, 'releasing before sufficient recovery cannot restart');
  tick(state, { up: true, sprint: true }, 1000); assert.equal(player.stamina, 100); assert.equal(player.sprintExhausted, true); assert.equal(player.sprinting, false);
  close(Math.hypot(player.vx, player.vz), Combat.WEAPONS.carbine.speed);
  tick(state, { up: true }); assert.equal(player.sprintExhausted, false);
  tick(state, { up: true, sprint: true }); assert.equal(player.sprinting, true); assert.ok(player.stamina < 100);
});

test('regen starts only after the complete authoritative delay and stays bounded', () => {
  const { state, player } = fixture(); tick(state, { up: true, sprint: true }, 60); const stamina = player.stamina;
  assert.equal(player.staminaRegenTicks, Combat.SPRINT.regenDelayTicks);
  tick(state, {}, Combat.SPRINT.regenDelayTicks); close(player.stamina, stamina); assert.equal(player.staminaRegenTicks, 0);
  tick(state); close(player.stamina, stamina + Combat.SPRINT.regenPerSecond / Combat.TICK_RATE);
  tick(state, {}, 1000); assert.equal(player.stamina, 100);
});

test('quiet walk, crouch, aiming, firing and inventory or utility actions suppress sprint immediately', () => {
  for (const action of ['walk', 'crouch', 'aim', 'fire', 'reload', 'interact', 'heal', 'grenade', 'swap', 'drop']) {
    const { state, player } = fixture(); tick(state, { up: true, sprint: true, [action]: true }, 30);
    assert.equal(player.sprinting, false, action); assert.equal(player.stamina, 100, action);
    if (action === 'walk') close(Math.hypot(player.vx, player.vz), 2.8);
    if (action === 'crouch') close(Math.hypot(player.vx, player.vz), 2.35);
    if (action === 'aim') close(Math.hypot(player.vx, player.vz), Combat.WEAPONS.carbine.speed * Combat.ADS.speedMultiplier);
  }
  for (const field of ['reloadTicks', 'healTicks', 'grenadeThrowTicks', 'meleeTicks', 'burstRemaining', 'pendingFireTicks']) {
    const { state, player } = fixture({ fields: { [field]: 100 } }); tick(state, { up: true, sprint: true });
    assert.equal(player.sprinting, false, field); assert.equal(player.stamina, 100, field);
  }
});

test('jumping during sprint or one tick after releasing it cannot retain airborne sprint speed', () => {
  for (const releaseBeforeJump of [false, true]) {
    const { state, player } = fixture(); tick(state, { up: true, sprint: true }, 30);
    if (releaseBeforeJump) tick(state, { up: true });
    const stamina = player.stamina; tick(state, { up: true, jump: true, sprint: !releaseBeforeJump });
    assert.equal(player.grounded, false); assert.equal(player.sprinting, false); close(player.stamina, stamina);
    assert.ok(Math.hypot(player.vx, player.vz) <= Combat.WEAPONS.carbine.speed + 1e-8);
    tick(state, { up: true, sprint: true }, 15); assert.equal(player.sprinting, false); close(player.stamina, stamina);
    assert.ok(player.y > 0); assert.ok(player.vy < Combat.WORLD.jumpSpeed);
  }
});

test('leaving a real deck clears sprint carry without upward lift or midair drain', () => {
  const map = { ...arena, colliders: [{ id: 'deck', x: -5, y: 4, z: 0, w: 10, h: 1, d: 8 }] };
  const { state, player } = fixture({ map, fields: { y: 5, z: -.31, vz: -7.56, sprinting: true } }); tick(state, { up: true, sprint: true });
  assert.equal(player.grounded, false); assert.equal(player.sprinting, false); assert.equal(player.stamina, 100);
  assert.ok(Math.hypot(player.vx, player.vz) <= Combat.WEAPONS.carbine.speed + 1e-8); assert.ok(player.vy <= 0);
  tick(state, { up: true, sprint: true }, 8); assert.ok(player.y < 5); assert.equal(player.stamina, 100);
});

test('independent melee shove adds no stamina expense and remains physically separate from voluntary speed', () => {
  const base = fixture(), shoved = fixture({ fields: { knockbackZ: -2.4, knockbackTicks: 24, knockbackReadyTicks: 24 } });
  tick(base.state, { up: true, sprint: true }, 24); tick(shoved.state, { up: true, sprint: true }, 24);
  close(shoved.player.stamina, base.player.stamina); close(shoved.player.vz, base.player.vz);
  assert.ok(shoved.player.z < base.player.z - .15); assert.equal(shoved.player.knockbackTicks, 0);
});

test('local replay matches authoritative stamina and movement through acceleration, exhaustion and recovery', () => {
  const { state, player } = fixture({ knife: true }), predicted = structuredClone(player), originalKit = JSON.stringify([player.hp, player.inventory]);
  for (let frame = 0; frame < 1100; frame++) {
    const buttons = { up: true, sprint: frame < 700 || frame >= 1000, right: frame >= 40 && frame < 75, crouch: frame >= 100 && frame < 110, walk: frame >= 180 && frame < 200 };
    Combat.predictLocalMovement(predicted, buttons, arena); tick(state, buttons);
    for (const field of movement) typeof player[field] === 'number' ? close(predicted[field], player[field]) : assert.equal(predicted[field], player[field], field);
  }
  assert.equal(JSON.stringify([predicted.hp, predicted.inventory]), originalKit);
});

test('stamina and sprint/action input changes invalidate cached sub-tick movement without mutating authority', () => {
  const player = { ...Combat.createCombatPlayer(0), vz: -Combat.WEAPONS.carbine.speed }, buttons = { up: true }, peers = [];
  const present = createMovementPresenter(); const walking = present(player, buttons, arena, 1 / 240, Combat.predictLocalMovement, peers);
  buttons.sprint = true; const sprinting = present(player, buttons, arena, 1 / 240, Combat.predictLocalMovement, peers); assert.ok(sprinting.z < walking.z);
  buttons.fire = true; const shooting = present(player, buttons, arena, 1 / 240, Combat.predictLocalMovement, peers); close(shooting.z, walking.z);
  buttons.fire = false; Object.assign(player, { stamina: 0, sprintExhausted: true }); const received = structuredClone(player);
  close(present(player, buttons, arena, 1 / 240, Combat.predictLocalMovement, peers).z, walking.z); assert.deepEqual(player, received);
  Object.assign(player, { stamina: 30, sprintExhausted: false }); assert.ok(present(player, buttons, arena, 1 / 240, Combat.predictLocalMovement, peers).z < walking.z);
});

test('remote projection and acknowledgement replay carry current sprint state and leave source snapshots unchanged', () => {
  const { player } = fixture({ fields: { vz: -6, stamina: 60, staminaRegenTicks: 100, sprinting: true } }), received = structuredClone(player), expected = structuredClone(player), peers = [];
  const buttons = { up: true, sprint: true }; Combat.predictLocalMovement(expected, buttons, arena, 3);
  const view = projectedMovement(player, buttons, arena, 25, Combat.predictLocalMovement, peers);
  for (const field of movement) typeof expected[field] === 'number' ? close(view[field], expected[field]) : assert.equal(view[field], expected[field], field);
  assert.deepEqual(player, received);
  const history = [1, 2, 3].map(tick => ({ tick, seq: tick, buttons })), result = reconcileMovement(player, history, 0, arena, Combat.predictLocalMovement, true, peers, 0);
  for (const field of movement) typeof expected[field] === 'number' ? close(result.predicted[field], expected[field]) : assert.equal(result.predicted[field], expected[field], field);
  assert.deepEqual(player, received);
});

test('death clears sprint and new rounds or rematches refill it with only a knife and the chosen gun', () => {
  const state = Combat.createState(); state.players[0].stamina = 3; state.players[0].sprinting = true;
  state.players[0].meleeLoadout = 'axe'; Combat.selectLoadout(state, 0, 'dualpistols'); Combat.startMatch(state);
  assert.equal(state.players[0].weapon, 'dualpistols'); assert.deepEqual(state.players[0].inventory.map(item => item?.weapon ?? item?.kind ?? null), ['knife', 'dualpistols', null, null]);
  assert.equal(state.players[0].stamina, 100); assert.equal(state.players[0].sprinting, false);
  Combat.applyCombatDamage(state, [{ playerId: 1, targetId: 0, attack: 'gun', weapon: 'carbine', damage: 200 }]);
  assert.deepEqual([state.players[0].stamina, state.players[0].staminaRegenTicks, state.players[0].sprintExhausted, state.players[0].sprinting], [0, 0, false, false]);
  Combat.resetLobby(state); assert.equal(state.players[0].stamina, 100); assert.equal(state.players[0].meleeLoadout, 'knife');
});

test('Breach validates legacy starter-blade requests without granting or mutating collected equipment', () => {
  const state = Combat.createState(); setInventoryMeleeLoadout(state.players[0], 'katana'); const before = JSON.stringify(state);
  assert.equal(Combat.validateMeleeLoadout(state, 0, 'axe').ok, false); assert.equal(Combat.selectMeleeLoadout(state, 0, 'axe').ok, false); assert.equal(JSON.stringify(state), before);
  assert.equal(Combat.validateMeleeLoadout(state, 0, 'knife').ok, true); assert.equal(JSON.stringify(state), before);
  state.phase = 'fight'; assert.equal(Combat.validateMeleeLoadout(state, 0, 'knife').ok, false);
});

test('accepted action expiry follows exact movement order while every published combat field remains unchanged', () => {
  for (const field of ['reloadTicks', 'healTicks', 'grenadeThrowTicks', 'meleeTicks', 'pendingFireTicks', 'burstRemaining']) {
    const setup = field === 'meleeTicks' ? { knife: true } : {};
    const { state, player } = fixture(setup); Object.assign(player, { [field]: 1, hp: 100, vz: -Combat.WEAPONS.carbine.speed });
    if (field === 'pendingFireTicks') player.shotCooldown = 1;
    if (field === 'burstRemaining') { player.weapon = 'burst'; player.inventory[1].weapon = 'burst'; player.shotCooldown = 1; }
    const predicted = structuredClone(player), published = JSON.stringify([predicted.hp, predicted.ammo, predicted.reserve, predicted.inventory, predicted.reloadTicks, predicted.healTicks, predicted.grenadeThrowTicks, predicted.meleeTicks, predicted.pendingFireTicks, predicted.burstRemaining, predicted.shotCooldown]);
    for (let frame = 0; frame < 4; frame++) {
      Combat.predictLocalMovement(predicted, { up: true, sprint: true }, arena); tick(state, { up: true, sprint: true });
      for (const key of movement) typeof player[key] === 'number' ? close(predicted[key], player[key]) : assert.equal(predicted[key], player[key], `${field}: ${key}`);
      if (frame === 0) assert.equal(predicted.sprinting, field === 'grenadeThrowTicks', 'only grenade release ages before this movement tick');
    }
    assert.equal(JSON.stringify([predicted.hp, predicted.ammo, predicted.reserve, predicted.inventory, predicted.reloadTicks, predicted.healTicks, predicted.grenadeThrowTicks, predicted.meleeTicks, predicted.pendingFireTicks, predicted.burstRemaining, predicted.shotCooldown]), published, field);
    assert.equal(predicted.sprinting, true, `${field}: a finished action cannot indefinitely block replay`);
  }
});

test('holding the selected potion trigger preserves the accepted channel slow movement in prediction', () => {
  const { state, player } = fixture({ fields: { hp: 100 } });
  const loot = Combat.addInventoryLoot(state, player, { kind: 'heal', amount: 1 }); assert.ok(Combat.pickupCombatLoot(state, player, loot));
  tick(state, { slot3: true }); tick(state, { fire: true, up: true }); assert.equal(player.healTicks, Combat.HEAL.ticks);
  const predicted = structuredClone(player), published = JSON.stringify([predicted.healTicks, predicted.hp, predicted.ammo, predicted.inventory]);
  for (let frame = 0; frame < 30; frame++) {
    const buttons = { up: true, fire: true, sprint: true }; Combat.predictLocalMovement(predicted, buttons, arena); tick(state, buttons);
    close(predicted.z, player.z); close(predicted.vz, player.vz); assert.equal(predicted.sprinting, false);
  }
  assert.equal(JSON.stringify([predicted.healTicks, predicted.hp, predicted.ammo, predicted.inventory]), published);
});

test('post-reload ammo and cooldown eligibility keep fresh or uncancelled bursts locked without publishing combat changes', () => {
  for (const scenario of ['reload-completes', 'cooldown-completes', 'failed-reload']) {
    const { state, player } = fixture({ weapon: 'burst', fields: { vz: -Combat.WEAPONS.burst.speed } });
    if (scenario === 'reload-completes') Object.assign(player, { ammo: 0, reserve: 27, reloadTicks: 1 });
    if (scenario === 'cooldown-completes') player.shotCooldown = 1;
    if (scenario === 'failed-reload') Object.assign(player, { burstRemaining: 2, shotCooldown: 8, reserve: 0 });
    Object.assign(player.inventory[1], { ammo: player.ammo, reserve: player.reserve, reloadTicks: player.reloadTicks, burstRemaining: player.burstRemaining, shotCooldown: player.shotCooldown });
    const predicted = structuredClone(player), fields = ['ammo', 'reserve', 'reloadTicks', 'burstRemaining', 'shotCooldown', 'hp', 'inventory'];
    const published = JSON.stringify(fields.map(field => predicted[field]));
    for (let frame = 0; frame < 4; frame++) {
      const buttons = { up: true, sprint: true, fire: frame === 0 && scenario !== 'failed-reload', reload: frame === 0 && scenario === 'failed-reload' };
      Combat.predictLocalMovement(predicted, buttons, arena); tick(state, buttons);
      for (const field of movement) typeof player[field] === 'number' ? close(predicted[field], player[field]) : assert.equal(predicted[field], player[field], `${scenario}: ${field}`);
      assert.equal(predicted.sprinting, false); assert.equal(predicted.stamina, 100);
    }
    assert.equal(JSON.stringify(fields.map(field => predicted[field])), published, scenario);
  }
});

test('private action clocks are immutable across prediction branches and invisible to deep equality, JSON or wire copies', () => {
  const player = { ...Combat.createCombatPlayer(0), reloadTicks: 2 };
  Combat.predictLocalMovement(player, {}, arena); const revision = Combat.movementPredictionRevision(player); assert.ok(Object.isFrozen(revision));
  const branch = Combat.copyMovementState(player), original = JSON.stringify(player);
  Combat.predictLocalMovement(branch, { up: true, sprint: true }, arena, 3);
  assert.equal(Combat.movementPredictionRevision(player), revision); assert.notEqual(Combat.movementPredictionRevision(branch), revision); assert.equal(JSON.stringify(player), original);
  assert.equal(player.reloadTicks, 2); assert.equal(branch.reloadTicks, 2);
  assert.deepEqual(player, structuredClone(player)); assert.deepEqual(branch, structuredClone(branch));
  assert.equal(Combat.movementPredictionRevision(JSON.parse(JSON.stringify(branch))), null); assert.equal(Combat.movementPredictionRevision(structuredClone(branch)), null);
  Combat.resetSprint(branch); assert.equal(Combat.movementPredictionRevision(branch), null);
  assert.equal(Combat.movementPredictionRevision(player), revision, 'resetting a branch never clears its source clock');
});

test('releasing an actual plant clears only the private movement lock after the first authoritative tick', () => {
  const state = Combat.createState(); state.phase = 'fight'; const player = state.players[0];
  Object.assign(player, { x: -13, y: 0, z: -12 }); Combat.step(state, [{ interact: true }, Combat.emptyInput(state.players[1])]);
  assert.equal(player.interaction, 'plant'); assert.equal(state.bomb.plantTicks, 1);
  const predicted = structuredClone(player), published = JSON.stringify([predicted.interaction, predicted.interactTicks, predicted.hp, predicted.inventory]);
  for (let frame = 0; frame < 4; frame++) {
    Combat.predictLocalMovement(predicted, { up: true, sprint: true }, state.mapId); Combat.step(state, [{ up: true, sprint: true }, Combat.emptyInput(state.players[1])]);
    for (const field of movement) typeof player[field] === 'number' ? close(predicted[field], player[field]) : assert.equal(predicted[field], player[field], field);
  }
  assert.equal(predicted.sprinting, true); assert.equal(predicted.interaction, 'plant'); assert.equal(player.interaction, null);
  assert.equal(JSON.stringify([predicted.interaction, predicted.interactTicks, predicted.hp, predicted.inventory]), published);
});

test('same-pose private clock advancement invalidates display cache and new published timers override the preview', () => {
  const player = { ...Combat.createCombatPlayer(0), reloadTicks: 1 }, buttons = { up: true, sprint: true }, peers = [];
  const receivedInput = player.previousInput, before = JSON.stringify(player), present = createMovementPresenter(); let calculations = 0;
  const predict = (...args) => { calculations++; return Combat.predictLocalMovement(...args); };
  present(player, buttons, arena, 1 / 240, predict, peers); assert.equal(calculations, 1);
  Combat.predictLocalMovement(player, {}, arena); player.previousInput = receivedInput;
  assert.equal(JSON.stringify(player), before, 'only the movement-private timer clock advanced');
  present(player, buttons, arena, 1 / 240, predict, peers); assert.equal(calculations, 2);
  const continuing = projectedMovement(player, buttons, arena, 25, predict, peers); assert.ok(continuing.stamina < 100);
  player.reloadTicks = 100;
  const received = JSON.stringify(player), blocked = projectedMovement(player, buttons, arena, 25, predict, peers);
  assert.equal(blocked.stamina, 100); assert.equal(blocked.sprinting, false); assert.equal(JSON.stringify(player), received);
});

test('a received burst cooldown update invalidates cached remote sprint projection without changing the snapshot', () => {
  const player = { ...Combat.createCombatPlayer(0, 1, 'burst'), burstRemaining: 1, ammo: 1, shotCooldown: 2 }, buttons = { up: true, sprint: true }, peers = [];
  const completed = projectedMovement(player, buttons, arena, 25, Combat.predictLocalMovement, peers);
  assert.equal(completed.sprinting, true); assert.ok(completed.stamina < Combat.SPRINT.maxStamina);
  player.shotCooldown = 100;
  const received = structuredClone(player), waiting = projectedMovement(player, buttons, arena, 25, Combat.predictLocalMovement, peers);
  const fresh = projectedMovement(structuredClone(player), buttons, arena, 25, Combat.predictLocalMovement, peers);
  assert.equal(waiting.sprinting, false); assert.equal(waiting.stamina, Combat.SPRINT.maxStamina);
  for (const field of movement) typeof fresh[field] === 'number' ? close(waiting[field], fresh[field]) : assert.equal(waiting[field], fresh[field], field);
  assert.deepEqual(player, received);
});
