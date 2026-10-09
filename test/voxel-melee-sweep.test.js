import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, applyCombatDamage, predictLocalMovement, emptyInput, KNOCKBACK, startMatch, createState, WORLD } from '../public/voxel-engine.js';
import { MELEE_WEAPONS, meleeSlashOrigin, meleeSlashPhase, meleeSlashGeometry, meleeSegmentBoxContact } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const arena = { id: 'physical-slash-fixture', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [], sites: [] };
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
const vectorLength = player => Math.hypot(player.knockbackX, player.knockbackZ);
function actor(id, fields = {}) { return { ...createCombatPlayer(id), x: 15 + id, y: 0, z: 15, lifeId: 1, hp: 500, maxHp: 500, ...fields }; }
function foe(id, x, z, type = 'stalker', fields = {}) { return actor(id, { x, z, team: 1, monster: true, human: false, monsterType: type, radius: type === 'hound' ? .5 : WORLD.radius, emergenceTicks: 0, monsterState: 'chasing', ...fields }); }
function fixture({ weapon = 'katana', gameId = 'voxel-horde', targets = [foe(3, 0, -1.4)], map = arena, pitch = 0 } = {}) {
  const players = Array.from({ length: Math.max(3, ...targets.map(target => target.id)) + 1 }, (_, id) => actor(id, { alive: false }));
  players[0] = actor(0, { x: 0, z: 0, team: 0, human: true, participating: true, connected: true, pitch });
  setInventoryMeleeLoadout(players[0], weapon, { equip: true });
  for (const target of targets) players[target.id] = target;
  const state = { gameId, phase: 'fight', tick: 0, eventId: 0, events: [], players, fighters: players, map, grenades: [], bolts: [], loot: [] };
  return { state, attacker: players[0], targets };
}
function step(state, input = {}, count = 1, options = {}) {
  for (let index = 0; index < count; index++) { state.tick++; const raw = state.players.map(player => emptyInput(player)); raw[0] = { ...raw[0], ...input }; combatStep(state, raw, state.map, options); }
}
function swing(state, weapon, input = {}) { step(state, { ...input, fire: true }); step(state, input, MELEE_WEAPONS[weapon].startupTicks + MELEE_WEAPONS[weapon].activeTicks); }

test('all blade bands are finite, preserve actual reach and use a bounded active slice shared with drawing', () => {
  for (const weapon of Object.keys(MELEE_WEAPONS)) for (const yaw of [0, .7, -2.3]) for (const pitch of [-.7, 0, .6]) {
    const player = { meleeWeapon: weapon, meleeYaw: yaw, meleePitch: pitch, x: 3, y: 2, z: -4, meleeHand: 0 }, profile = MELEE_WEAPONS[weapon];
    const geometry = meleeSlashGeometry(player), origin = meleeSlashOrigin(player);
    assert.ok(geometry.samples.length <= 49); assert.equal(geometry.radius, profile.slashRadius);
    for (const sample of geometry.samples) {
      assert.ok(Object.values(sample.direction).every(Number.isFinite)); near(Math.hypot(...Object.values(sample.direction)), 1);
      near(Math.hypot(sample.outer.x - origin.x, sample.outer.y - origin.y, sample.outer.z - origin.z) + geometry.radius, profile.reach);
    }
    player.meleeTicks = profile.activeTicks + profile.recoveryTicks;
    const phase = meleeSlashPhase(player); assert.equal(phase.phase, 'active'); assert.equal(phase.from, 0); near(phase.to, 1 / profile.activeTicks);
    assert.ok(meleeSlashGeometry(player, phase).samples.length <= 8, 'a physical tick samples a short finite interval including the descending curve');
    player.meleeTicks = profile.recoveryTicks; assert.equal(meleeSlashPhase(player).phase, 'recovery');
  }
});

test('knife is a thin committed stab while two tonfa hands mirror distinct short physical paths', () => {
  const knife = meleeSlashGeometry({ meleeWeapon: 'knife', meleeYaw: .3, meleePitch: -.2 });
  assert.equal(knife.kind, 'stab'); assert.deepEqual(knife.samples[0].direction, knife.samples.at(-1).direction);
  const right = meleeSlashGeometry({ meleeWeapon: 'tonfas', meleeYaw: 0, meleePitch: 0, meleeHand: 0 });
  const left = meleeSlashGeometry({ meleeWeapon: 'tonfas', meleeYaw: 0, meleePitch: 0, meleeHand: 1 });
  assert.deepEqual(right.samples[0].outer, left.samples.at(-1).outer); assert.deepEqual(right.samples.at(-1).outer, left.samples[0].outer);
});

test('finite segment/box contacts are exact at a face, edge, corner and an interior crossing', () => {
  const box = { x: 0, y: 0, z: 0, w: 1, h: 1, d: 1 };
  const crossing = meleeSegmentBoxContact({ x: -2, y: .5, z: .5 }, { x: 3, y: .5, z: .5 }, box); near(crossing.distance, 0);
  const face = meleeSegmentBoxContact({ x: -2, y: 1.2, z: .5 }, { x: 3, y: 1.2, z: .5 }, box); near(face.distance, .2);
  const edge = meleeSegmentBoxContact({ x: -2, y: 1.2, z: 1.3 }, { x: 3, y: 1.2, z: 1.3 }, box); near(edge.distance, Math.hypot(.2, .3));
  const corner = meleeSegmentBoxContact({ x: 1.1, y: 1.2, z: 1.3 }, { x: 3, y: 4, z: 5 }, box); near(corner.distance, Math.hypot(.1, .2, .3));
  assert.equal(meleeSegmentBoxContact({ x: NaN, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, box), null);
});

test('one real katana sweep damages every monster across and behind the front of its blade exactly once', () => {
  const targets = [foe(3, -.72, -1.9), foe(4, 0, -1.1), foe(5, 0, -1.9), foe(6, .72, -1.9)];
  const { state, attacker } = fixture({ targets }); swing(state, 'katana');
  for (const target of targets) assert.equal(target.hp, 425, `monster ${target.id} receives one cut`);
  const hits = state.events.filter(event => event.type === 'damage'); assert.equal(hits.length, 4);
  assert.equal(new Set(hits.map(event => `${event.playerId}:${event.meleeStartTick}:${event.meleeIndex}:${event.attackerLifeId}`)).size, 1);
  assert.equal(attacker.meleeHitLives.length, 4); assert.equal(attacker.shots, 0);
});

test('each active tick damages only the part of the blade path already swept, not an instant full cone', () => {
  const left = foe(3, -.85, -2), right = foe(4, .85, -2), { state } = fixture({ weapon: 'sword', targets: [left, right] });
  step(state, { fire: true }); step(state, {}, MELEE_WEAPONS.sword.startupTicks);
  assert.equal(left.hp, 400); assert.equal(right.hp, 500, 'the far right side has not been cut yet');
  step(state, {}, MELEE_WEAPONS.sword.activeTicks); assert.equal(right.hp, 400);
  assert.equal(state.events.filter(event => event.type === 'damage').length, 2);
});

test('knife cannot cleave off-axis targets which only fit the old broad cone', () => {
  const { state, targets } = fixture({ weapon: 'knife', targets: [foe(3, .75, -.95)] }); swing(state, 'knife');
  assert.equal(targets[0].hp, 500);
});

test('walls, elevated floors and allied bodies keep shielding the entire swarm', () => {
  for (const cover of ['wall', 'ally', 'floor']) {
    const targets = [foe(3, 0, -1.3), foe(4, 0, -2)], map = cover === 'wall' ? { ...arena, colliders: [{ id: 'wall', x: -3, y: 0, z: -.65, w: 6, h: 4, d: .03 }] } : cover === 'floor' ? { ...arena, colliders: [{ id: 'deck', x: -3, y: 1.6, z: -3, w: 6, h: .2, d: 4 }] } : arena;
    if (cover === 'floor') for (const target of targets) target.y = 1.8;
    if (cover === 'ally') targets.push(actor(1, { x: 0, z: -.66, team: 0, human: true, connected: true, participating: true }));
    const { state, attacker } = fixture({ targets, map, pitch: cover === 'floor' ? .8 : 0 });
    if (cover === 'floor') attacker.crouching = true;
    swing(state, 'katana', { pitch: cover === 'floor' ? .8 : 0, crouch: cover === 'floor' });
    assert.ok(targets.every(target => target.hp === 500), cover); assert.equal(state.events.filter(event => event.type === 'meleeKnockback').length, 0);
  }
});

test('Breach and Royale human bodies preserve nearest-target blocking while monster-only cleave stays specific to Horde', () => {
  for (const gameId of ['voxel-breach', 'voxel-royale']) {
    const targets = [actor(1, { x: 0, z: -1.1, team: 1 }), actor(2, { x: 0, z: -1.9, team: 1 })], { state } = fixture({ gameId, targets });
    swing(state, 'katana'); assert.equal(targets[0].hp, 425); assert.equal(targets[1].hp, 500, gameId);
  }
});

test('committed yaw and pitch cannot rotate during a sweep, and airborne targets require actual vertical contact', () => {
  const straight = fixture({ targets: [foe(3, 0, -1.6)] });
  step(straight.state, { fire: true, yaw: Math.PI / 2 }); step(straight.state, { yaw: 0 }, 25); assert.equal(straight.targets[0].hp, 500);
  const elevated = fixture({ targets: [foe(3, 0, -1.5, 'stalker', { y: 3 })] }); swing(elevated.state, 'katana'); assert.equal(elevated.targets[0].hp, 500);
});

test('the low hound requires its real rotated head or torso, with no phantom upper-body cut', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const high = fixture({ weapon: 'knife', targets: [foe(3, 0, -1.1, 'hound', { yaw })] }); swing(high.state, 'knife'); assert.equal(high.targets[0].hp, 500, `${yaw}: empty human-height air misses`);
    const low = fixture({ weapon: 'knife', targets: [foe(3, 0, -1.1, 'hound', { yaw })], pitch: -.7 }); swing(low.state, 'knife', { pitch: -.7 }); assert.equal(low.targets[0].hp, 472, `${yaw}: honest low flesh contact`);
    const hit = low.state.events.find(event => event.type === 'damage'); assert.ok(hit.hitY <= .80);
  }
});

test('a reused monster id with a new life is a new contact, while the same life cannot be hit twice in one swing', () => {
  const { state, attacker, targets } = fixture({ weapon: 'knife' }); step(state, { fire: true }); step(state, {}, MELEE_WEAPONS.knife.startupTicks);
  assert.equal(targets[0].hp, 472); step(state); assert.equal(targets[0].hp, 472);
  const replacement = foe(3, 0, -1.4, 'stalker', { lifeId: 2 }); state.players[3] = replacement; step(state);
  assert.equal(replacement.hp, 472); assert.deepEqual(attacker.meleeHitLives, ['3:1', '3:2']);
  assert.deepEqual(state.events.filter(event => event.type === 'damage').map(event => event.targetLifeId), [1, 2]);
});

function shove({ weapon = 'katana', type = 'stalker', monster = true, fields = {}, map = arena } = {}) {
  const { state, attacker, targets } = fixture({ weapon, targets: [monster ? foe(3, 0, -1.4, type, fields) : actor(3, { x: 0, z: -1.4, team: 1, ...fields })], map });
  const target = targets[0];
  applyCombatDamage(state, [{ playerId: 0, targetId: target.id, targetLifeId: target.lifeId, damage: 1, attack: weapon, weapon, meleeIndex: 2, meleeStartTick: 17 }]);
  return { state, attacker, target };
}

test('accepted nonlethal hits give weapon-specific physical impulses after stagger hooks without teleporting', () => {
  const expected = { knife: 2.2, sword: 4.2, katana: 3, axe: 10, tonfas: 2.6 };
  for (const [weapon, speed] of Object.entries(expected)) {
    const { state, target } = shove({ weapon }); near(vectorLength(target), speed); assert.equal(target.z, -1.4); assert.equal(target.y, 0);
    const before = target.z; step(state); assert.ok(target.z < before - .015, `${weapon} visibly displaces through physical movement`);
    assert.equal(target.y, 0); assert.equal(target.knockbackTicks, 35); assert.ok(vectorLength(target) < speed);
  }
  const { state, target } = fixture(); const victim = state.players[3];
  applyCombatDamage(state, [{ playerId: 0, targetId: 3, damage: 1, attack: 'katana', weapon: 'katana' }], { onMeleeHit() { victim.vx *= .2; victim.vz *= .2; } });
  near(vectorLength(victim), 3);
});

test('heavy brute resistance and modest PvP shoves preserve movement and combat control', () => {
  const light = shove({ weapon: 'axe' }), heavy = shove({ weapon: 'axe', type: 'brute' }), player = shove({ weapon: 'axe', monster: false, fields: { meleeTicks: 30, meleePhase: 'active' } });
  near(vectorLength(light.target), 10); near(vectorLength(heavy.target), 3.5); near(vectorLength(player.target), 2.4);
  assert.equal(player.target.meleeTicks, 30, 'a shove adds no player stun or canceled attack'); assert.equal(player.target.knockbackTicks, 24);
  const before = player.target.x;
  predictLocalMovement(player.target, { ...emptyInput(player.target), right: true }, arena, 12);
  assert.ok(player.target.x > before + .12, 'the victim can still steer throughout impact');
});

test('simultaneous cooperative impacts retain all damage but cannot stack launch speeds or refresh the guard', () => {
  const { state, target } = shove({ weapon: 'katana' });
  applyCombatDamage(state, Array.from({ length: 3 }, () => ({ playerId: 0, targetId: 3, damage: 1, attack: 'axe', weapon: 'axe' })));
  near(vectorLength(target), 3); assert.equal(target.hp, 496); assert.equal(target.knockbackReadyTicks, 12);
  assert.equal(state.events.filter(event => event.type === 'meleeKnockback').length, 1);
  step(state, {}, 12); applyCombatDamage(state, [{ playerId: 0, targetId: 3, damage: 1, attack: 'axe', weapon: 'axe' }]);
  near(vectorLength(target), 10); assert.equal(target.knockbackTicks, 36);
});

test('impulses monotonically decay on simulation ticks and expire without airborne launches or leftover velocity', () => {
  const { state, target } = shove({ weapon: 'axe' }); let speed = vectorLength(target), previousZ = target.z;
  for (let tick = 0; tick < 36; tick++) {
    step(state); assert.ok(vectorLength(target) <= speed); assert.ok(target.z <= previousZ); assert.equal(target.y, 0); speed = vectorLength(target); previousZ = target.z;
  }
  assert.equal(target.knockbackTicks, 0); assert.equal(target.knockbackReadyTicks, 0); assert.equal(speed, 0);
  assert.ok(-1.4 - target.z > .8 && -1.4 - target.z < 1.1, 'a full heavy blow produces a finite visible shove');
  const final = target.z; step(state, {}, 24); assert.equal(target.z, final);
});

test('thin walls and world bounds stop the full swept impulse and permanently clip its inward component', () => {
  for (const obstacle of ['wall', 'bound']) {
    const map = obstacle === 'wall' ? { ...arena, colliders: [{ id: 'thin-wall', x: -3, y: 0, z: -1.78, w: 6, h: 3, d: .01 }] } : { ...arena, bounds: { ...arena.bounds, minZ: -1.78 } };
    const { state, target } = shove({ weapon: 'axe', map }); step(state, {}, 20);
    assert.ok(target.z >= -1.78 + target.radius - 1e-8); assert.equal(target.knockbackZ, 0);
    state.map = arena; const stopped = target.z; step(state, {}, 20); assert.equal(target.z, stopped, 'removing cover does not revive an old launch');
  }
});

test('stationary peers block a shove without being teleported or pushed through the crowd', () => {
  const { state, target } = shove({ weapon: 'axe' }), peer = foe(4, 0, -2.1); state.players.push(peer); state.fighters = state.players;
  const initial = { x: peer.x, z: peer.z }; step(state, {}, 30);
  assert.ok(Math.hypot(target.x - peer.x, target.z - peer.z) >= target.radius + peer.radius - 1e-8);
  assert.deepEqual({ x: peer.x, z: peer.z }, initial); assert.equal(target.knockbackZ, 0);
});

test('co-moving swarm shoves are independent of monster IDs and prediction vacates the same real space', () => {
  const runs = [];
  for (const reversed of [false, true]) {
    const targets = reversed ? [foe(3, 0, -1.45), foe(4, 0, -.8)] : [foe(3, 0, -.8), foe(4, 0, -1.45)];
    const { state } = fixture({ weapon: 'sword', targets });
    applyCombatDamage(state, targets.map(target => ({ playerId: 0, targetId: target.id, damage: 1, attack: 'sword', weapon: 'sword' })));
    const predicted = structuredClone(targets.find(target => target.z === -.8)), peers = structuredClone(state.players), before = JSON.stringify(peers);
    predictLocalMovement(predicted, emptyInput(predicted), arena, 30, peers);
    step(state); const first = targets.slice().sort((a, b) => a.z - b.z).map(target => ({ z: target.z, knockbackZ: target.knockbackZ, ticks: target.knockbackTicks }));
    step(state, {}, 29); near(predicted.z, targets.find(target => target.id === predicted.id).z); near(predicted.knockbackZ, targets.find(target => target.id === predicted.id).knockbackZ);
    assert.equal(JSON.stringify(peers), before);
    step(state, {}, 6); const last = targets.slice().sort((a, b) => a.z - b.z).map(target => ({ z: target.z, knockbackZ: target.knockbackZ, ticks: target.knockbackTicks }));
    assert.ok(-.8 - last[1].z > .35 && -.8 - last[1].z < .5, 'the revised sword keeps a visible shove inside follow-up range'); near(last[1].z - last[0].z, .65);
    runs.push({ first, last });
  }
  assert.deepEqual(runs[0], runs[1], 'the same two positions and impact fields produce identical physical results');
});

test('a shove respects height, low dog clearance and gravity when leaving a ledge', () => {
  const low = shove({ weapon: 'axe', type: 'hound', map: { ...arena, colliders: [{ id: 'roof', x: -2, y: .95, z: -4, w: 4, h: .2, d: 4 }] } }); step(low.state, {}, 20); assert.ok(low.target.z < -1.9); assert.equal(low.target.y, 0);
  const ledgeMap = { ...arena, colliders: [{ id: 'ledge', x: -2, y: 0, z: -1.8, w: 4, h: 2, d: 1 }] }, ledge = shove({ weapon: 'axe', fields: { y: 2 }, map: ledgeMap });
  step(ledge.state, {}, 30); assert.ok(ledge.target.y < 2); assert.ok(ledge.target.vy <= 0); assert.ok(ledge.target.y >= 0);
});

test('prediction replays the serialized physical shove and decay exactly without mutating peers, health or inventory', () => {
  const { state, target } = shove({ weapon: 'sword' }), predicted = structuredClone(target), peers = structuredClone(state.players), before = JSON.stringify(peers), inventory = JSON.stringify(predicted.inventory), hp = predicted.hp;
  for (let tick = 0; tick < 36; tick++) {
    const input = { ...emptyInput(target), right: true }; const raw = state.players.map(player => emptyInput(player)); raw[3] = input;
    predictLocalMovement(predicted, input, arena, 1, peers); state.tick++; combatStep(state, raw, arena);
    for (const field of ['x', 'y', 'z', 'vx', 'vz', 'knockbackX', 'knockbackZ', 'knockbackTicks', 'knockbackReadyTicks']) near(predicted[field], target[field]);
  }
  assert.equal(JSON.stringify(peers), before); assert.equal(predicted.hp, hp); assert.equal(JSON.stringify(predicted.inventory), inventory);
});

test('gun, friendly, lethal and stale-life damage cannot retain or invent a blade impulse', () => {
  const { state, target } = fixture(); const victim = state.players[3];
  applyCombatDamage(state, [{ playerId: 0, targetId: 3, damage: 1, attack: 'gun', weapon: 'carbine' }]); assert.equal(victim.knockbackTicks, 0);
  applyCombatDamage(state, [{ playerId: 0, targetId: 3, targetLifeId: 9, damage: 1, attack: 'sword', weapon: 'sword' }]); assert.equal(victim.hp, 499); assert.equal(victim.knockbackTicks, 0);
  applyCombatDamage(state, [{ playerId: 0, targetId: 3, damage: 1, attack: 'sword', weapon: 'sword' }]); assert.ok(victim.knockbackTicks > 0);
  applyCombatDamage(state, [{ playerId: 0, targetId: 3, damage: victim.hp, attack: 'sword', weapon: 'sword' }]); assert.equal(victim.alive, false); assert.equal(victim.knockbackTicks, 0); assert.equal(victim.knockbackReadyTicks, 0); assert.equal(vectorLength(victim), 0);
  const friendly = fixture({ targets: [actor(3, { x: 0, z: -1.4, team: 0 })] }); applyCombatDamage(friendly.state, [{ playerId: 0, targetId: 3, damage: 1, attack: 'sword', weapon: 'sword' }]); assert.equal(friendly.targets[0].knockbackTicks, 0);
});

test('fresh lives and matches discard all impact state, while malformed legacy fields remain finite and bounded', () => {
  const state = createState(); Object.assign(state.players[0], { knockbackX: 10, knockbackZ: 4, knockbackTicks: 36, knockbackReadyTicks: 12 }); startMatch(state);
  assert.ok(state.players.every(player => vectorLength(player) === 0 && player.knockbackTicks === 0 && player.knockbackReadyTicks === 0));
  for (const fields of [{ knockbackTicks: Infinity, knockbackX: Infinity, knockbackZ: NaN }, { knockbackTicks: 36, knockbackX: 10000, knockbackZ: 10000 }, { knockbackTicks: -1, knockbackX: 5, knockbackZ: 5 }]) {
    const player = actor(0, { x: 0, z: 0, ...fields }); predictLocalMovement(player, emptyInput(player), arena);
    assert.ok([player.x, player.y, player.z, player.knockbackX, player.knockbackZ, player.knockbackTicks, player.knockbackReadyTicks].every(Number.isFinite)); assert.ok(vectorLength(player) <= KNOCKBACK.maxPlayerSpeed);
  }
});
