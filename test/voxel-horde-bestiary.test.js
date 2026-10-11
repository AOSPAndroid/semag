import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { applyCombatDamage, emptyInput, playerHeight, KNOCKBACK } from '../public/voxel-engine.js';
import { navigationCanOccupy } from '../public/voxel-navigation.js';
import { monsterBodyProfile, monsterAttackOrigin } from '../public/voxel-monster-bodies.js';
import { launchMonsterHex, advanceMonsterSpecials, MONSTER_HEX_RULES as HEX, MONSTER_SPECIAL_RULES as SPECIALS } from '../public/voxel-monster-specials.js';
import { setInventoryMeleeLoadout, selectInventorySlot } from '../public/voxel-inventory.js';

const TYPES = ['vampire', 'witch', 'wolf', 'pig', 'rat', 'stag'];
const arena = { id: 'bestiary-engine', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], spawns: Horde.MAPS.courtyard.spawns };
const advance = (s, n, input = []) => { for (let i = 0; i < n; i++) Horde.step(s, typeof input === 'function' ? input(s, i) : input); };
const pose = (p, x, z, yaw = 0) => { Object.assign(p, { x, y: 0, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true }); p.previousInput = emptyInput(p); };
function fixture({ wave = 9, seed = 911, capacity = 1, participants = [0] } = {}) {
  const s = Horde.createState({ capacity, seed }); Horde.startMatch(s, participants); advance(s, s.phaseTicks);
  s.map = arena; s.horde.wave = wave; s.horde.pending = 1; s.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  for (const id of participants) pose(s.players[id], id * 4, 0);
  return s;
}
function spawn(s, type, x = 0, z = -12) {
  const life = s.horde.monsterLifeId;
  s.spawnWarnings.push({ id: ++s.horde.spawnId, x, y: 0, z, ticksLeft: 1, monsterType: type }); Horde.step(s);
  const m = s.players.find(p => p.monster && p.monsterType === type && p.lifeId > life);
  assert.ok(m, `${type} must use a genuine body-validated rift`); m.emergenceTicks = 0;
  return { m, b: s.horde.brains[m.id] };
}
function single(type, distance = 1.3, options = {}) {
  const s = fixture(options), { m, b } = spawn(s, type); pose(m, 0, -distance, Math.PI);
  b.nextPlanTick = Number.MAX_SAFE_INTEGER; b.path = [];
  return { s, h: s.players[0], m, b };
}
function wait(f, phase, limit = 600) {
  for (let i = 0; i < limit; i++) { Horde.step(f.s); if (f.m.monsterState === phase) return; }
  assert.fail(`${f.m.monsterType} never entered ${phase}`);
}
const hits = (s, type) => s.events.filter(e => e.type === 'damage' && e.weapon === type);

test('six bestiary additions spawn as distinct trusted bodies with empty equipment', () => {
  const sizes = { wolf: [.98, .52], pig: [.84, .56], rat: [.36, .25], stag: [1.65, .63] };
  for (const type of TYPES) {
    const s = fixture(), { m } = spawn(s, type), p = Horde.MONSTER_TYPES[type];
    assert.equal(p.unarmed, true); assert.equal(p.gun, undefined); assert.equal(p.weapon, undefined);
    assert.equal(m.hasGun, false); assert.deepEqual(m.inventory, [null, null, null, null]);
    assert.equal(m.ammo, 0); assert.equal(m.reserve, 0); assert.equal(m.shots, 0); assert.ok(navigationCanOccupy(arena, m));
    if (sizes[type]) { assert.equal(playerHeight(m), sizes[type][0]); assert.equal(m.radius, sizes[type][1]); assert.equal(monsterBodyProfile(m).id, type); }
    const e = s.events.findLast(e => e.type === 'monsterSpawn'); assert.equal(e.monsterType, type); assert.equal(e.lifeId, m.lifeId); assert.equal(e.weapon, null);
  }
});

test('real rift queues guarantee exact debuts including stag wave nine and retain established openings and gun locks', () => {
  const old = {
    1: ['stalker', 'hound'], 2: ['runner', 'hound'], 3: ['brute', 'hound', 'leaper', 'bomber'], 4: ['gunner', 'hound', 'leaper', 'brute', 'bomber'],
    5: ['gunner', 'hound', 'leaper', 'screecher', 'brute', 'bomber', 'spitter'], 6: ['gunner', 'hound', 'leaper', 'screecher', 'brute', 'bomber', 'spitter'],
    7: ['sniper', 'hound', 'leaper', 'screecher', 'gunner', 'brute', 'bomber', 'spitter'], 8: ['weaver', 'sniper', 'hound', 'leaper', 'screecher', 'gunner', 'brute', 'bomber', 'spitter'],
    9: ['weaver', 'sniper', 'hound', 'leaper', 'screecher', 'gunner', 'brute', 'bomber', 'spitter'],
  };
  for (let wave = 1; wave <= 9; wave++) {
    const s = fixture({ wave }), seen = []; s.players[0].hp = s.players[0].maxHp = 1e6;
    Object.assign(s.horde, { pending: 24, waveQueued: 0, waveTypeCounts: {}, nextSpawnTick: s.tick }); let cursor = s.eventId;
    for (let i = 0; i < 1600 && s.phase === 'fight'; i++) {
      Horde.step(s); for (const e of s.events.filter(e => e.id > cursor && e.type === 'monsterRift')) seen.push(e.monsterType); cursor = s.eventId;
      for (const m of s.players.filter(p => p.monster && p.alive)) applyCombatDamage(s, [{ playerId: 0, targetId: m.id, damage: m.hp, attack: 'gun', weapon: 'carbine' }]);
      assert.ok(s.players.length <= s.capacity + Horde.HORDE_RULES.maxMonsters); assert.ok(s.spawnWarnings.length <= Horde.HORDE_RULES.maxWarnings); assert.ok(s.loot.length <= Horde.HORDE_RULES.maxLoot);
    }
    assert.deepEqual(seen.slice(0, old[wave].length), old[wave]);
    for (const type of TYPES) {
      const debut = Horde.MONSTER_TYPES[type].debutWave;
      if (wave < debut) assert.equal(seen.includes(type), false, `${type} must remain locked`);
      if (wave === debut) assert.equal(seen[old[wave].length], type, `${type} cannot randomly miss its debut`);
    }
    if (wave < 4) assert.equal(seen.includes('gunner'), false); if (wave < 7) assert.equal(seen.includes('sniper'), false);
  }
});

test('spawn navigation caches each actual animal hull and allows rats through low headroom unavailable to a hound', () => {
  const tunnel = { ...arena, id: 'rat-headroom', bounds: { minX: -2, maxX: 2, minZ: -14, maxZ: 10 }, colliders: [{ id: 'low-roof', x: -2, y: .7, z: -14, w: 4, h: .2, d: 16 }] };
  for (const [waveQueued, type] of [[1, 'hound'], [2, 'rat']]) {
    const s = fixture({ wave: 2 }); s.map = tunnel; pose(s.players[0], 0, 8); s.horde.waveQueued = waveQueued; s.horde.nextSpawnTick = s.tick; Horde.step(s);
    if (type === 'hound') { assert.equal(s.spawnWarnings.length, 0); continue; }
    assert.equal(s.spawnWarnings.length, 1); assert.equal(s.spawnWarnings[0].monsterType, 'rat'); assert.ok(s.spawnWarnings[0].z < 2);
    advance(s, Horde.HORDE_RULES.spawnWarningTicks); const rat = s.players.find(p => p.monster && p.alive);
    assert.ok(rat); assert.equal(rat.monsterType, 'rat'); assert.ok(navigationCanOccupy(tunnel, rat));
  }
});

test('later-wave species pressure counts living bodies and rifts within the existing projectile and hazard caps', () => {
  const caps = { vampire: 2, witch: 2, pig: 3, wolf: 3, rat: 4, stag: 2 };
  for (const seed of [3, 99]) {
    const s = fixture({ wave: 18, seed }); s.players[0].hp = s.players[0].maxHp = 1e6;
    Object.assign(s.horde, { pending: 120, nextSpawnTick: s.tick, waveQueued: 0 });
    for (let i = 0; i < 1800; i++) {
      Horde.step(s);
      for (const [type, cap] of Object.entries(caps)) assert.ok(s.players.filter(p => p.monster && p.alive && p.monsterType === type).length + s.spawnWarnings.filter(r => r.monsterType === type).length <= cap, `${type} pressure exceeds ${cap}`);
      assert.ok(s.horde.projectiles.length <= SPECIALS.maxProjectiles); assert.ok(s.horde.hazards.length <= SPECIALS.maxHazards);
    }
  }
});

test('vampire and boar windups commit fixed-direction physical lunges that threaten the full initiation range once', () => {
  for (const type of ['vampire', 'pig']) {
    const p = Horde.MONSTER_TYPES[type], f = single(type, p.lungeRange); f.m.hp -= 20; wait(f, 'lungeWindup');
    const origin = { x: f.m.x, z: f.m.z }, yaw = f.b.attackYaw;
    advance(f.s, p.windup - 1); assert.equal(f.h.hp, f.h.maxHp); assert.deepEqual({ x: f.m.x, z: f.m.z }, origin);
    advance(f.s, 1); assert.equal(f.m.monsterState, 'leap'); assert.equal(f.m.lungeTicks, p.lungeTicks);
    for (let i = 0; i < p.lungeTicks + 4; i++) { Horde.step(f.s); assert.ok(navigationCanOccupy(arena, f.m)); assert.equal(f.b.attackYaw, yaw); }
    assert.equal(hits(f.s, type).length, 1); assert.equal(f.h.maxHp - f.h.hp, p.damage); assert.equal(f.m.monsterState, 'recover');
    assert.equal(f.s.events.filter(e => e.type === 'monsterSiphon').length, type === 'vampire' ? 1 : 0);
  }
});

test('sidesteps, thin cover and changed target lives defeat both new charges and grant no vampire healing', () => {
  for (const type of ['vampire', 'pig']) for (const response of ['dodge', 'cover', 'life']) {
    const p = Horde.MONSTER_TYPES[type], f = single(type, p.lungeRange); f.m.hp -= 20; wait(f, 'lungeWindup'); const hp = f.m.hp, yaw = f.b.attackYaw;
    if (response === 'cover') f.s.map = { ...arena, colliders: [{ id: 'thin-cover', x: -5, y: 0, z: -1.8, w: 10, h: 3, d: .1 }] };
    if (response === 'life') f.h.lifeId++;
    advance(f.s, p.windup + p.lungeTicks + 1, response === 'dodge' ? [{ right: true }] : []);
    assert.equal(hits(f.s, type).length, 0, `${type}:${response}`); assert.equal(f.m.hp, hp); assert.equal(f.b.attackYaw, yaw);
    assert.equal(f.s.events.some(e => e.type === 'monsterSiphon'), false); assert.ok(navigationCanOccupy(f.s.map, f.m));
  }
});

test('an actual timed blade parry blocks vampire damage and siphon health', () => {
  const f = single('vampire', 1.35); f.m.hp -= 20; setInventoryMeleeLoadout(f.h, 'katana'); selectInventorySlot(f.h, 0); f.h.triggerBlocked = false;
  wait(f, 'lungeWindup'); const hp = f.m.hp; advance(f.s, Horde.MONSTER_TYPES.vampire.windup - 5); Horde.step(f.s, [{ aim: true }]); advance(f.s, 8);
  assert.ok(f.s.events.some(e => e.type === 'meleeParry' && e.targetId === f.m.id)); assert.equal(f.h.hp, f.h.maxHp); assert.equal(f.m.hp, hp); assert.equal(f.s.events.some(e => e.type === 'monsterSiphon'), false);
});

test('vampire heals only its missing health once after a real confirmed bite', () => {
  const f = single('vampire', 1.35); f.m.hp -= 3; wait(f, 'lungeWindup'); advance(f.s, Horde.MONSTER_TYPES.vampire.windup + 3);
  const cue = f.s.events.find(e => e.type === 'monsterSiphon'); assert.ok(cue); assert.equal(cue.amount, 3); assert.equal(f.m.hp, f.m.maxHp);
  advance(f.s, 12); assert.equal(f.m.hp, f.m.maxHp); assert.equal(f.s.events.filter(e => e.type === 'monsterSiphon').length, 1); assert.equal(f.s.horde.teamstats.damageTaken, Horde.MONSTER_TYPES.vampire.damage);
});

test('wolf pack genuinely flanks opposite shoulders and then closes for unarmed bites', () => {
  const s = fixture(), a = spawn(s, 'wolf', -1.5, -12), b = spawn(s, 'wolf', 1.5, -12); s.players[0].hp = s.players[0].maxHp = 2000;
  for (const f of [a, b]) { f.b.nextPlanTick = f.b.nextSightTick = 0; f.b.targetId = null; } Horde.step(s);
  assert.ok(a.b.path.at(-1).x * b.b.path.at(-1).x < 0);
  for (let i = 0; i < 600 && hits(s, 'wolf').length < 2; i++) { Horde.step(s); for (const f of [a, b]) assert.ok(navigationCanOccupy(arena, f.m)); }
  assert.ok(hits(s, 'wolf').some(e => e.playerId === a.m.id)); assert.ok(hits(s, 'wolf').some(e => e.playerId === b.m.id)); assert.ok([a.m, b.m].every(m => !m.hasGun && m.shots === 0));
});

test('rats bite from their low real snout while stag antlers give a bounded collision-swept shove', () => {
  const r = single('rat', .7); wait(r, 'windup'); advance(r.s, Horde.MONSTER_TYPES.rat.windup);
  assert.equal(hits(r.s, 'rat').length, 1); assert.equal(r.h.maxHp - r.h.hp, 6); const bite = hits(r.s, 'rat')[0];
  assert.ok(Math.abs(bite.attackY - .18) < 1e-9); assert.ok(Math.abs(bite.attackZ - monsterAttackOrigin(r.m).z) < 1e-9);
  const f = single('stag', 1.8); wait(f, 'windup'); advance(f.s, Horde.MONSTER_TYPES.stag.windup);
  const cue = f.s.events.find(e => e.type === 'monsterKnockback'); assert.ok(cue); assert.equal(cue.speed, 1.9); assert.equal(f.h.knockbackTicks, 18); assert.equal(f.h.knockbackReadyTicks, KNOCKBACK.playerReadyTicks);
  const wall = f.h.z + .42; f.s.map = { ...arena, colliders: [{ id: 'shove-cover', x: -2, y: 0, z: wall, w: 4, h: 3, d: .1 }] };
  for (let i = 0; i < 24; i++) { Horde.step(f.s); assert.ok(navigationCanOccupy(f.s.map, f.h)); }
  assert.ok(f.h.z > 0 && f.h.z <= wall - f.h.radius + 1e-6); assert.equal(f.h.knockbackTicks, 0); assert.equal(f.s.events.filter(e => e.type === 'monsterKnockback').length, 1);
});

for (const response of ['stay', 'dodge', 'cover', 'kill']) test(`witch physical hex respects ${response} after its full accepted windup`, () => {
  const f = single('witch', 10); f.b.nextPlanTick = 0; wait(f, 'hexing'); assert.equal(f.b.attackTicks, 96); const yaw = f.b.attackYaw, pitch = f.b.attackPitch;
  advance(f.s, 95); assert.equal(f.s.horde.projectiles.length, 0); assert.equal(f.h.hp, f.h.maxHp);
  if (response === 'kill') applyCombatDamage(f.s, [{ playerId: 0, targetId: f.m.id, damage: f.m.hp, attack: 'gun', weapon: 'carbine' }]); Horde.step(f.s);
  if (response === 'kill') { assert.equal(f.s.horde.projectiles.length, 0); assert.equal(hits(f.s, 'witch').length, 0); return; }
  const p = f.s.horde.projectiles[0]; assert.equal(p.kind, 'hex'); assert.equal(p.sourceType, 'witch'); assert.equal(p.sourceLifeId, f.m.lifeId); assert.equal(f.b.attackYaw, yaw); assert.equal(f.b.attackPitch, pitch);
  const origin = { x: p.x, y: p.y, z: p.z }; Horde.step(f.s); assert.ok(Math.abs(Math.hypot(p.x - origin.x, p.y - origin.y, p.z - origin.z) - HEX.speed / 120) < 1e-9);
  if (response === 'cover') f.s.map = { ...arena, colliders: [{ id: 'hex-cover', x: -10, y: 0, z: -5, w: 20, h: 4, d: .1 }] };
  advance(f.s, 210, response === 'dodge' ? [{ right: true }] : []); assert.equal(hits(f.s, 'witch').length, response === 'stay' ? 1 : 0);
  if (response === 'stay') assert.equal(f.h.maxHp - f.h.hp, HEX.damage);
  if (response === 'cover') assert.ok(f.s.events.some(e => e.type === 'monsterHex' && e.stage === 'impact' && e.z <= -4.9)); assert.equal(f.m.shots, 0); assert.equal(f.m.hasGun, false);
});

test('hex rejects forged casters and lives, shares the physical projectile cap, freezes pause and cancels source reuse', () => {
  const f = single('witch', 10), before = structuredClone(f.s.horde);
  for (const source of [{ ...f.m, human: true }, { ...f.m, monsterType: 'spitter' }, { ...f.m, lifeId: 0 }, { ...f.m, x: NaN }, { ...f.m }]) assert.equal(launchMonsterHex(f.s, source, 0, 0), false);
  assert.deepEqual(f.s.horde, before); for (let i = 0; i < 40; i++) launchMonsterHex(f.s, f.m, Math.PI, 0); assert.equal(f.s.horde.projectiles.length, SPECIALS.maxProjectiles);
  Horde.pauseMatch(f.s); const frozen = JSON.stringify(f.s); advance(f.s, 600); assert.equal(JSON.stringify(f.s), frozen); Horde.resumeMatch(f.s);
  f.m.lifeId++; Horde.step(f.s); assert.equal(f.s.horde.projectiles.length, 0);
  launchMonsterHex(f.s, f.m, 0, 0); f.s.horde.projectiles[0].sourceType = 'spitter'; f.s.tick++; assert.equal(advanceMonsterSpecials(f.s, arena).length, 0); assert.equal(f.s.horde.projectiles.length, 0);
});

test('witches aim real hexes upward at a supported target and a launched same-life hex survives its caster death', () => {
  const f = single('witch', 10);
  f.s.map = { ...arena, colliders: [{ id: 'target-platform', x: -2, y: 0, z: -2, w: 4, h: 2.2, d: 4 }] };
  Object.assign(f.h, { y: 2.2, vy: 0, grounded: true }); f.b.nextPlanTick = 0; wait(f, 'hexing');
  assert.ok(f.b.attackPitch > .1); advance(f.s, Horde.MONSTER_TYPES.witch.windup);
  const hex = f.s.horde.projectiles[0]; assert.ok(hex); assert.ok(hex.dy > .1);
  applyCombatDamage(f.s, [{ playerId: 0, targetId: f.m.id, damage: f.m.hp, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(f.m.alive, false);
  advance(f.s, 210); assert.equal(hits(f.s, 'witch').length, 1); assert.equal(f.h.maxHp - f.h.hp, HEX.damage);
  assert.equal(f.s.horde.projectiles.length, 0); assert.equal(f.h.y, 2.2);
});

test('all six unarmed deaths preserve actual species and life identity without dropping guns or blades', () => {
  for (const type of TYPES) for (const seed of [1, 9, 68, 921]) {
    const s = fixture({ seed }), { m } = spawn(s, type); applyCombatDamage(s, [{ playerId: 0, targetId: m.id, targetLifeId: m.lifeId, damage: m.hp, attack: 'gun', weapon: 'carbine' }]); Horde.step(s);
    const death = s.events.findLast(e => e.type === 'kill'); assert.equal(death.monsterType, type); assert.equal(death.targetLifeId, m.lifeId); assert.ok(s.loot.every(item => !['weapon', 'melee'].includes(item.kind))); assert.equal(s.horde.totalKills, 1);
    let cursor = 0; for (const e of s.events) { assert.ok(e.id > cursor); cursor = e.id; } assert.equal(cursor, s.eventId);
  }
});

test('mixed new creatures reproduce real sparse co-op bites, charges and hexes deterministically', () => {
  const build = () => { const s = fixture({ capacity: 3, participants: [0, 2] }); for (const id of [0, 2]) s.players[id].hp = s.players[id].maxHp = 5000; TYPES.forEach((type, i) => spawn(s, type, (i - 2.5) * 3, -12)); return s; };
  const a = build(), b = build(); for (let i = 0; i < 600; i++) { const input = [{ right: i % 150 < 35 }, {}, { left: i % 180 < 40 }]; Horde.step(a, input); Horde.step(b, input); assert.ok(a.players.length <= a.capacity + Horde.HORDE_RULES.maxMonsters); assert.ok(a.horde.projectiles.length <= SPECIALS.maxProjectiles); }
  assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.ok(a.events.some(e => e.type === 'monsterHex')); assert.ok(a.events.some(e => e.type === 'monsterLunge'));
});
