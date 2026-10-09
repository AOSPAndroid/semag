import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { emptyInput, playerHeight } from '../public/voxel-engine.js';
import { MELEE_WEAPONS, PARRY_PROFILES, meleeSlashOrigin } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const arena = Object.freeze({ id: 'blade-horde-physical-qa', bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -25, maxZ: 25 }), colliders: Object.freeze([]), spawns: Horde.MAPS.courtyard.spawns });
function advance(state, ticks, inputs = []) { for (let tick = 0; tick < ticks; tick++) Horde.step(state, typeof inputs === 'function' ? inputs(state, tick) : inputs); }
function pose(player, { x = 0, y = 0, z = 0, yaw = 0 } = {}) {
  Object.assign(player, { x, y, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true }); player.previousInput = emptyInput(player); return player;
}
function fixture({ weapon = 'sword', wave = 1, creatures = [{ type: 'stalker', x: 0, z: -1.4 }], capacity = 1, participants = [0], difficulty = 'veteran', colliders = [] } = {}) {
  const state = Horde.createState({ capacity, difficulty, seed: 73291 }); Horde.startMatch(state, participants); advance(state, state.phaseTicks);
  state.map = arena; state.horde.wave = wave; state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  for (const id of participants) pose(state.players[id], { x: id * 3, z: 4 });
  const monsters = [];
  for (let index = 0; index < creatures.length; index++) {
    state.spawnWarnings = [{ id: index + 1, x: -8 + index * 3, y: 0, z: -10, ticksLeft: 1, monsterType: creatures[index].type }]; Horde.step(state);
    const monster = state.players.find(player => player.monster && !monsters.includes(player)); assert.ok(monster, 'a real rift creates each trusted enemy'); monsters.push(monster);
  }
  for (let index = 0; index < monsters.length; index++) {
    const monster = monsters[index]; monster.emergenceTicks = 0; pose(monster, { ...creatures[index], yaw: creatures[index].yaw ?? Math.PI });
    const brain = state.horde.brains[monster.id]; brain.targetId = null; brain.nextPlanTick = brain.nextSightTick = 0;
  }
  for (const id of participants) {
    const human = pose(state.players[id], { x: id * 3 }); setInventoryMeleeLoadout(human, weapon); selectInventorySlot(human, 0); human.triggerBlocked = false;
  }
  state.map = { ...arena, colliders };
  return { state, human: state.players[participants[0]], monsters, monster: monsters[0], brain: state.horde.brains[monsters[0].id] };
}
function strike({ state, human }, { yaw = human.yaw, pitch = human.pitch } = {}) {
  const inputs = []; inputs[human.id] = { fire: true, yaw, pitch }; Horde.step(state, inputs);
  const profile = MELEE_WEAPONS[human.meleeWeapon]; advance(state, profile.startupTicks + profile.activeTicks + profile.recoveryTicks);
}
function pursue(state, human, monster) {
  const dx = monster.x - human.x, dz = monster.z - human.z, distance = Math.hypot(dx, dz);
  return { fire: human.meleeTicks === 0 && human.meleeCooldown === 0 && !human.previousInput.fire, up: distance > MELEE_WEAPONS[human.meleeWeapon].reach * .7, yaw: Math.atan2(dx, -dz), pitch: 0 };
}
function hits(state, human) { return state.events.filter(event => event.type === 'meleeHit' && event.playerId === human.id); }

for (const weapon of ['sword', 'katana']) {
  test(`${weapon}: one real close cut dispatches a first-wave stalker and retains death animation identity`, () => {
    const setup = fixture({ weapon }); const { state, human, monster } = setup, lifeId = monster.lifeId; const reserve = human.reserve;
    strike(setup);
    assert.equal(monster.alive, false); assert.equal(human.hp, human.maxHp); assert.equal(human.shots, 0); assert.equal(human.reserve, reserve); assert.equal(human.kills, 1); assert.equal(state.horde.totalKills, 1);
    assert.equal(hits(state, human).length, 1); const death = state.events.find(event => event.type === 'kill' && event.targetId === monster.id);
    assert.ok(death); assert.equal(death.targetLifeId, lifeId); assert.equal(death.monsterType, 'stalker'); assert.equal(death.attack, weapon); assert.equal(death.weapon, weapon);
    assert.ok([death.x, death.y, death.z, death.yaw, death.dx, death.dy, death.dz].every(Number.isFinite));
  });

  for (const distance of [.85, 1, 1.7, 2]) {
    test(`${weapon}: a level committed cut makes a real flesh contact on a low hound at ${distance} m`, () => {
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const setup = fixture({ weapon, creatures: [{ type: 'hound', x: 0, z: -distance, yaw }] }); const { state, human, monster } = setup;
        strike(setup, { yaw: 0, pitch: 0 });
        assert.equal(monster.alive, false, `hound yaw ${yaw}`); assert.equal(human.hp, human.maxHp); assert.equal(hits(state, human).length, 1);
        const contact = hits(state, human)[0]; assert.ok(contact.y >= 0 && contact.y <= .8, 'damage happens on the actual hound boxes'); assert.equal(contact.targetLifeId, monster.lifeId);
        assert.equal(state.events.filter(event => event.type === 'kill' && event.targetId === monster.id).length, 1);
      }
    });
  }

  test(`${weapon}: a downward committed cut still works against a later tougher hound without granting free safety`, () => {
    const setup = fixture({ weapon, wave: 12, creatures: [{ type: 'hound', x: 0, z: -1.2 }] }); const { state, human, monster } = setup;
    const pivot = meleeSlashOrigin(human), pitch = Math.atan2(.55 - pivot.y, Math.hypot(monster.x - human.x, monster.z - human.z)); strike(setup, { pitch });
    assert.ok(hits(state, human).length === 1); assert.ok(hits(state, human)[0].y <= .8); assert.ok(monster.alive, 'late hounds have their genuine wave-scaled health');
    advance(state, 150); assert.ok(human.hp < human.maxHp, 'a surviving animal resumes its authored bite after the bounded interruption');
  });

  test(`${weapon}: genuine hounds behind full cover and above the finite blade path take no hit`, () => {
    for (const variant of ['wall', 'height']) {
      const setup = fixture({ weapon, wave: 8, creatures: [{ type: 'hound', x: 0, y: variant === 'height' ? 3 : 0, z: -1.7 }] }); const { state, human, monster } = setup;
      if (variant === 'wall') state.map = { ...arena, colliders: [{ id: 'low-animal-cover', x: -10, y: 0, z: -.9, w: 20, h: 4, d: .12 }] };
      else state.map = { ...arena, colliders: [{ id: 'animal-balcony', x: -4, y: 2.5, z: -7, w: 8, h: .5, d: 6 }] };
      strike(setup);
      assert.equal(monster.hp, monster.maxHp, variant); assert.equal(hits(state, human).length, 0, variant); assert.equal(state.events.some(event => event.type === 'monsterStagger'), false, variant);
    }
  });

  test(`${weapon}: one live slash can clear a spaced early crowd once per life while a covered enemy remains safe`, () => {
    const setup = fixture({ weapon, creatures: [{ type: 'stalker', x: -.7, z: -1.55 }, { type: 'stalker', x: .7, z: -1.55 }, { type: 'stalker', x: 0, z: -2.25 }] });
    const { state, human, monsters } = setup;
    state.map = { ...arena, colliders: [{ id: 'rear-pillar', x: -.45, y: 0, z: -1.9, w: .9, h: 3, d: .2 }] };
    strike(setup);
    assert.equal(monsters[0].alive, false); assert.equal(monsters[1].alive, false); assert.equal(monsters[2].hp, monsters[2].maxHp);
    const contacts = hits(state, human); assert.equal(contacts.length, 2); assert.equal(new Set(contacts.map(contact => `${contact.targetId}:${contact.targetLifeId}`)).size, 2);
    assert.equal(state.horde.totalKills, 2); assert.equal(human.kills, 2);
    for (const monster of monsters.slice(0, 2)) {
      const death = state.events.find(event => event.type === 'kill' && event.targetId === monster.id); assert.equal(death.targetLifeId, monster.lifeId); assert.equal(death.monsterType, 'stalker');
    }
  });

  test(`${weapon}: blade knockback stops at real rear cover and the surviving AI resumes pursuit and attacks`, () => {
    const rearWall = { id: 'blade-rear-cover', x: -8, y: 0, z: -1.84, w: 16, h: 4, d: .12 };
    const setup = fixture({ weapon, wave: 8, colliders: [rearWall], creatures: [{ type: 'stalker', x: 0, z: -1.3 }] }); const { state, human, monster } = setup;
    Horde.step(state, [{ fire: true }]); let minZ = monster.z;
    for (let tick = 0; tick < 50; tick++) { Horde.step(state); minZ = Math.min(minZ, monster.z); assert.ok(monster.z - monster.radius >= rearWall.z + rearWall.d - 1e-6, 'swept impulse never crosses the wall'); }
    const pushes = state.events.filter(event => event.type === 'meleeKnockback'); assert.equal(pushes.length, 1); assert.equal(pushes[0].targetLifeId, monster.lifeId); assert.ok(pushes[0].dz < 0);
    assert.ok(minZ < -1.3 - .02, 'the real hit has visible outward motion'); assert.equal(monster.knockbackTicks, 0);
    advance(state, 120); assert.ok(monster.alive); assert.ok(monster.z > minZ + .08); assert.ok(human.hp < human.maxHp, 'a blade opening is temporary, then claws remain dangerous');
    assert.ok(state.events.some(event => event.type === 'monsterAttack' && event.playerId === monster.id && event.hit));
  });

  test(`${weapon}: a correctly timed real guard parries a stalker commitment, then an expired guard leaves a claw opening`, () => {
    const setup = fixture({ weapon, wave: 8 }); const { state, human, monster, brain } = setup;
    Horde.step(state); assert.equal(brain.attackTicks, Horde.MONSTER_TYPES.stalker.windup);
    const guard = PARRY_PROFILES[weapon]; advance(state, brain.attackTicks - guard.startupTicks - 1);
    assert.ok(brain.attackTicks > 0); Horde.step(state, [{ aim: true, yaw: 0, pitch: 0 }]); advance(state, guard.startupTicks + 1);
    const parries = state.events.filter(event => event.type === 'meleeParry'); assert.equal(parries.length, 1); assert.equal(parries[0].targetId, monster.id); assert.equal(parries[0].attackWeapon, 'stalker');
    assert.equal(human.hp, human.maxHp); assert.ok(human.stamina < 100); assert.equal(hits(state, human).length, 0);
    advance(state, Horde.MONSTER_TYPES.stalker.recovery + Horde.MONSTER_TYPES.stalker.windup + 10);
    assert.ok(human.hp < human.maxHp); assert.equal(state.events.filter(event => event.type === 'meleeParry').length, 1, 'one input guard never refreshes itself');
  });

  test(`${weapon}: an unguarded late brute can counter repeated real pursuit cuts`, () => {
    const setup = fixture({ weapon, wave: 8, creatures: [{ type: 'brute', x: 0, z: -1.4 }] }); const { state, human, monster } = setup;
    const health = monster.maxHp; advance(state, 400, () => [pursue(state, human, monster)]);
    assert.ok(hits(state, human).length >= 3); assert.ok(monster.hp < health); assert.ok(human.hp < human.maxHp, 'armor, stagger immunity and a readable swing retain a real counter window');
    const staggers = state.events.filter(event => event.type === 'monsterStagger'); assert.ok(staggers.length >= 1); assert.ok(staggers.length < hits(state, human).length);
    assert.ok(staggers.every(event => event.ticks <= 6)); assert.ok(state.events.some(event => event.type === 'monsterAttack' && event.playerId === monster.id && event.hit));
  });
}

for (const [capacity, participants] of [[1, [0]], [3, [0, 2]]]) {
  test(`real ${capacity === 1 ? 'solo' : 'sparse co-op'} blade crowds replay deterministically through collision and kill records`, () => {
    const options = { weapon: 'sword', wave: 8, capacity, participants, creatures: [{ type: 'stalker', x: -.7, z: -1.4 }, { type: 'hound', x: .8, z: -1.4 }, { type: 'brute', x: 0, z: -3.2 }] };
    const a = fixture(options), b = fixture(options);
    if (capacity > 1) { pose(a.state.players[2], { x: 3, z: 0 }); pose(b.state.players[2], { x: 3, z: 0 }); }
    for (let tick = 0; tick < 260; tick++) {
      const target = a.monsters.find(monster => monster.alive) || a.monster, input = [pursue(a.state, a.human, target)];
      if (capacity > 1) { input[1] = {}; input[2] = { left: tick < 20, yaw: 0 }; }
      Horde.step(a.state, input); Horde.step(b.state, input);
    }
    assert.equal(JSON.stringify(a.state), JSON.stringify(b.state)); assert.deepEqual(a.state.horde.participantIds, participants); assert.ok(a.state.players.every((player, id) => player.id === id));
    assert.ok(a.state.events.some(event => event.type === 'meleeHit')); assert.ok(a.state.events.some(event => event.type === 'kill' && event.targetLifeId > 0));
    assert.ok(playerHeight(a.monsters[1]) < 1);
  });
}

for (const resumeInput of ['held', 'released']) {
  test(`solo pause discards a real queued blade press and respects ${resumeInput} input fences while preserving the ongoing cut`, () => {
    const setup = fixture({ weapon: 'sword', wave: 8, creatures: [{ type: 'brute', x: 0, z: -1.4 }] }); const { state, human } = setup;
    const blade = MELEE_WEAPONS.sword, total = blade.startupTicks + blade.activeTicks + blade.recoveryTicks;
    Horde.step(state, [{ fire: true }]); advance(state, total - 8); assert.equal(human.meleeTicks, 8);
    Horde.step(state, [{ fire: true }]); assert.ok(human.pendingMeleeTicks > 0, 'a fresh press is genuinely accepted in the final recovery window');
    const ongoing = { ticks: human.meleeTicks, cooldown: human.meleeCooldown, index: human.meleeIndex, start: human.meleeStartTick, phase: human.meleePhase, stamina: human.stamina };
    Horde.pauseMatch(state); assert.equal(human.pendingMeleeTicks, 0); assert.equal(human.meleeTicks, ongoing.ticks); assert.equal(human.meleeCooldown, ongoing.cooldown); assert.equal(human.stamina, ongoing.stamina);
    const frozen = JSON.stringify(state); advance(state, 600, [{ fire: true, aim: true, up: true }]); assert.equal(JSON.stringify(state), frozen);
    Horde.resumeMatch(state); assert.equal(human.pendingMeleeTicks, 0); assert.equal(human.meleeIndex, ongoing.index); assert.equal(human.meleeStartTick, ongoing.start); assert.equal(human.meleePhase, ongoing.phase); assert.equal(human.stamina, ongoing.stamina);
    advance(state, 20, [{ fire: resumeInput === 'held' }]); assert.equal(human.meleeTicks, 0); assert.equal(human.meleeIndex, ongoing.index, 'the old commitment finishes without reviving its discarded click');
    assert.equal(human.pendingMeleeTicks, 0);
    Horde.step(state); Horde.step(state, [{ fire: true }]); assert.equal(human.meleeIndex, ongoing.index + 1, 'release, then a fresh press, deliberately starts the next cut');
  });
}

test('pausing in blade startup preserves its commitment and resumes the genuine pending contact', () => {
  const setup = fixture({ weapon: 'sword' }); const { state, human, monster } = setup;
  Horde.step(state, [{ fire: true, yaw: 0, pitch: 0 }]); advance(state, 3); assert.equal(monster.hp, monster.maxHp);
  const clock = human.meleeTicks, yaw = human.meleeYaw, pitch = human.meleePitch, index = human.meleeIndex;
  Horde.pauseMatch(state); assert.equal(human.meleeTicks, clock); advance(state, 1200); assert.equal(human.meleeTicks, clock); assert.equal(monster.hp, monster.maxHp);
  Horde.resumeMatch(state); advance(state, MELEE_WEAPONS.sword.startupTicks + MELEE_WEAPONS.sword.activeTicks, [{ fire: true }]);
  assert.equal(monster.alive, false); assert.equal(human.meleeIndex, index); assert.equal(human.meleeYaw, yaw); assert.equal(human.meleePitch, pitch); assert.equal(hits(state, human).length, 1);
});

test('a paused accepted parry retains its timer and spent stamina, then expires through resumed combat', () => {
  const setup = fixture({ weapon: 'katana', wave: 8 }); const { state, human } = setup;
  Horde.step(state, [{ aim: true }]); advance(state, 2); assert.ok(human.parryTicks > 0); assert.ok(human.stamina < 100);
  const clock = human.parryTicks, stamina = human.stamina, cooldown = human.parryCooldown;
  Horde.pauseMatch(state); advance(state, 600, [{ aim: true }]); assert.equal(human.parryTicks, clock); assert.equal(human.stamina, stamina); assert.equal(human.parryCooldown, cooldown);
  Horde.resumeMatch(state); assert.equal(human.parryTicks, clock); assert.equal(human.stamina, stamina); advance(state, 90, [{ aim: true }]);
  assert.equal(human.parryTicks, 0); assert.equal(human.parryIndex, 1, 'a held guard is fenced and never silently restarts'); assert.ok(human.hp < human.maxHp);
});

test('a sparse co-op disconnect clears accepted primary intent without touching a teammate commitment', () => {
  const setup = fixture({ weapon: 'sword', wave: 8, capacity: 3, participants: [0, 2], creatures: [{ type: 'brute', x: 0, z: -1.4 }] }); const { state, human } = setup;
  const total = MELEE_WEAPONS.sword.startupTicks + MELEE_WEAPONS.sword.activeTicks + MELEE_WEAPONS.sword.recoveryTicks;
  Horde.step(state, [{ fire: true }]); advance(state, total - 8); Horde.step(state, [{ fire: true }]); assert.ok(human.pendingMeleeTicks > 0);
  const peer = state.players[2]; const input = []; input[2] = { fire: true }; Horde.step(state, input); assert.ok(peer.meleeTicks > 0); const peerClock = peer.meleeTicks;
  Horde.setConnected(state, 0, false); assert.equal(human.pendingMeleeTicks, 0); assert.equal(human.connected, false); assert.equal(human.alive, false); assert.equal(peer.meleeTicks, peerClock); assert.deepEqual(state.horde.participantIds, [2]);
  const index = human.meleeIndex; advance(state, 30, [{ fire: true }]); assert.equal(human.meleeIndex, index); assert.equal(human.pendingMeleeTicks, 0); assert.equal(state.phase, 'fight');
});
