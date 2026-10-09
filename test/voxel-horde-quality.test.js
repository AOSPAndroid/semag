import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { eyeHeight, playerHeight, emptyInput } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';

const openArena = Object.freeze({
  id: 'horde-quality-arena',
  bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -22, maxZ: 22 }),
  colliders: Object.freeze([]),
  spawns: Horde.MAPS.courtyard.spawns,
});

function advance(state, ticks, input = []) {
  for (let tick = 0; tick < ticks; tick++) Horde.step(state, typeof input === 'function' ? input(state, tick) : input);
  return state;
}

function active(options = {}, participantIds = [0]) {
  const state = Horde.createState({ seed: 73291, ...options });
  Horde.startMatch(state, participantIds);
  for (let tick = 0; tick < Horde.TICK_RATE * 10 && state.phase !== 'fight'; tick++) Horde.step(state);
  assert.equal(state.phase, 'fight');
  return state;
}

function monsters(state) { return state.players.filter(player => player.monster && player.alive); }

function assertPhysical(arena, player) {
  assert.ok([player.x, player.y, player.z, player.vx, player.vy, player.vz].every(Number.isFinite));
  assert.ok(player.x >= arena.bounds.minX + player.radius - 1e-6 && player.x <= arena.bounds.maxX - player.radius + 1e-6);
  assert.ok(player.z >= arena.bounds.minZ + player.radius - 1e-6 && player.z <= arena.bounds.maxZ - player.radius + 1e-6);
  for (const box of arena.colliders) {
    if (player.y >= box.y + box.h - 1e-7 || player.y + playerHeight(player) <= box.y + 1e-7) continue;
    const dx = player.x - Math.max(box.x, Math.min(box.x + box.w, player.x));
    const dz = player.z - Math.max(box.z, Math.min(box.z + box.d, player.z));
    assert.ok(dx * dx + dz * dz >= player.radius ** 2 - 1e-6, `${arena.id}/${player.id} penetrates ${box.id}`);
  }
}

function aimAt(player, target, extra = {}) {
  const dx = target.x - player.x, dz = target.z - player.z;
  return { fire: true, aim: true, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(target.y + playerHeight(target) - .18 - player.y - eyeHeight(player), Math.hypot(dx, dz)) - player.recoil, reload: player.ammo === 0 && player.reserve > 0, ...extra };
}

function pose(player, position) {
  Object.assign(player, { y: 0, vx: 0, vy: 0, vz: 0, grounded: true, pitch: 0, ...position });
  player.previousInput = emptyInput(player);
  return player;
}

function combatFixture({ monsterType = 'stalker', capacity = 1, participantIds = [0], wave = 1, map = openArena } = {}) {
  const state = active({ capacity }, participantIds);
  state.map = map; state.horde.wave = wave;
  state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
  state.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType }];
  pose(state.players[participantIds[0]], { x: 0, z: 4, yaw: 0 });
  Horde.step(state);
  const monster = monsters(state)[0];
  assert.ok(monster, 'real warning did not spawn a combat body');
  monster.emergenceTicks = 0;
  const brain = state.horde.brains[monster.id];
  brain.targetId = participantIds[0]; brain.nextPlanTick = 1e9; brain.path = [];
  return { state, monster, brain, human: state.players[participantIds[0]] };
}

test('later pistol, carbine and marksman monsters actually fire after the announced windup', () => {
  for (const [monsterType, wave, weapon] of [['gunner', 4, 'pistol'], ['gunner', 6, 'carbine'], ['sniper', 7, 'marksman']]) {
    const { state, monster, human } = combatFixture({ monsterType, wave });
    human.hp = human.maxHp = 5000;
    const start = state.tick, profile = Horde.MONSTER_TYPES[monsterType];
    advance(state, profile.reaction + profile.windup);
    assert.equal(monster.shots, 0, `${monsterType}/${weapon}: fired before its reaction and windup completed`);
    advance(state, 700);
    const aims = state.events.filter(event => event.type === 'monsterAim' && event.playerId === monster.id);
    const shots = state.events.filter(event => event.type === 'shot' && event.playerId === monster.id);
    assert.equal(monster.weapon, weapon); assert.ok(shots.length >= 2, `${monsterType}/${weapon}: telegraphs never produced real shots`);
    assert.ok(aims.length >= 2);
    assert.ok(shots[0].tick - start >= profile.reaction + profile.windup);
    assert.ok(shots[0].tick - aims[0].tick >= profile.windup);
    assert.ok(human.hp < human.maxHp, `${monsterType}/${weapon}: no real human damage`);
    assert.ok(monster.ammo < WEAPONS[weapon].magazine || monster.reloadTicks > 0);
    if (weapon !== 'carbine') assert.ok(shots.slice(1).every((event, index) => event.tick - shots[index].tick >= profile.rest + profile.windup));
  }
});

test('monster melee uses the physical wall and friendly-body contacts at the committed strike', () => {
  for (const obstacle of ['wall', 'friendly-body']) {
    const { state, monster, brain, human } = combatFixture();
    pose(monster, { x: 0, z: -1.25, yaw: Math.PI }); pose(human, { x: 0, z: 0, yaw: 0 });
    // Commit a real attack in the open; the actual world/body contact can change
    // during its readable windup, before the additional-damage callback runs.
    advance(state, 1);
    assert.equal(brain.attackTicks, Horde.MONSTER_TYPES.stalker.windup);
    if (obstacle === 'wall') state.map = { ...openArena, colliders: [{ id: 'new-cover', x: -20, y: 0, z: -.65, w: 40, h: 4, d: .12 }] };
    else {
      const friendly = { ...monster, id: state.players.length, z: -.625, hp: 900, maxHp: 900, monsterType: 'brute', lifeId: 999, emergenceTicks: 1000, previousInput: emptyInput() };
      state.players.push(friendly); state.fighters = state.players;
      state.horde.brains[friendly.id] = { ...brain, id: friendly.id, lifeId: friendly.lifeId, attackTicks: 0, attackReady: false, path: [] };
    }
    advance(state, Horde.MONSTER_TYPES.stalker.windup);
    const strike = state.events.find(event => event.type === 'monsterAttack' && event.playerId === monster.id);
    assert.ok(strike, obstacle); assert.equal(strike.hit, false, obstacle);
    assert.equal(human.hp, human.maxHp, obstacle);
    assert.ok(state.events.every(event => event.type !== 'damage' || event.playerId !== monster.id), obstacle);
  }
});

test('a melee windup leaves time to dodge and does not track a target behind the committed blade', () => {
  const { state, monster, brain, human } = combatFixture({ monsterType: 'runner', wave: 2 });
  pose(monster, { x: 0, z: -1, yaw: Math.PI }); pose(human, { x: 0, z: 0 });
  Horde.step(state); assert.equal(brain.attackTicks, Horde.MONSTER_TYPES.runner.windup);
  advance(state, Horde.MONSTER_TYPES.runner.windup, [{ right: true, yaw: 0 }]);
  const attack = state.events.find(event => event.type === 'monsterAttack');
  assert.ok(attack); assert.equal(attack.hit, false); assert.equal(human.hp, human.maxHp);
  assert.ok(human.x > 1, 'the readable attack did not allow a physical sidestep');
});

test('real gun, sword and frag kills produce one kill credit and one bounded drop per life', () => {
  for (const attack of ['gun', 'sword', 'grenade']) {
    const { state, monster, human } = combatFixture();
    monster.emergenceTicks = 10000;
    state.horde.killsSinceHeal = 4;
    if (attack === 'gun') {
      for (let tick = 0; tick < 200 && monster.alive; tick++) Horde.step(state, [aimAt(human, monster)]);
    } else if (attack === 'sword') {
      human.meleeWeapon = 'sword'; human.inventory[0].weapon = 'sword';
      pose(human, { x: 0, z: 1.5, yaw: 0 }); pose(monster, { x: 0, z: 0 });
      Horde.step(state, [{ swap: true }]); assert.equal(human.slot, 'sword');
      for (let hit = 0; hit < 2; hit++) { Horde.step(state, [{ fire: true, yaw: 0 }]); advance(state, 72); }
    } else {
      // The normal shared throw lands at z=-1.589m in this empty, level arena.
      // Keep the emerging monster at that landing, then run the full fuse.
      pose(human, { x: 0, z: 12, yaw: 0 }); pose(monster, { x: 0, z: -1.5 });
      Horde.step(state, [{ grenade: true, yaw: 0, pitch: 0 }]);
      assert.equal(human.grenades, 0); assert.equal(state.grenades.length, 1);
      advance(state, 300);
      assert.ok(state.events.some(event => event.type === 'grenadeExplosion'));
    }
    assert.equal(monster.alive, false, attack); assert.equal(human.kills, 1, attack);
    assert.equal(human.damageDealt, monster.maxHp, attack);
    assert.equal(state.horde.totalKills, 1, attack); assert.equal(state.horde.waveKills, 1, attack);
    const kills = state.events.filter(event => event.type === 'kill' && event.targetId === monster.id);
    assert.equal(kills.length, 1, attack); assert.equal(kills[0].attack, attack, attack);
    assert.equal(state.loot.length, 1, attack); assert.equal(state.loot[0].type, 'health', attack);
    const before = JSON.stringify(state.loot);
    advance(state, 300, [{ fire: true }]);
    assert.equal(state.horde.totalKills, 1, attack); assert.equal(human.kills, 1, attack);
    assert.equal(JSON.stringify(state.loot), before, `${attack}: a dead life produced repeated supplies`);
  }
});

test('dropped health cannot be collected through cover or repeatedly from a held pickup key', () => {
  const { state, human, monster } = combatFixture();
  monster.emergenceTicks = 10000;
  pose(human, { x: 0, z: 0 }); human.hp = 50;
  const drop = { id: 1, type: 'health', kind: 'heal', x: 0, y: 0, z: -1, amount: 45, expiresTick: state.tick + 3000 };
  state.loot = [drop];
  state.map = { ...openArena, colliders: [{ id: 'supply-wall', x: -20, y: 0, z: -.6, w: 40, h: 4, d: .12 }] };
  assert.equal(Horde.findNearbyLoot(state, 0), null);
  Horde.step(state, [{ interact: true }]); assert.equal(human.hp, 50); assert.equal(state.loot.length, 1);
  state.map = openArena; Horde.step(state);
  assert.equal(Horde.findNearbyLoot(state, 0), drop);
  Horde.step(state, [{ interact: true }]); assert.equal(human.hp, 95); assert.equal(state.loot.length, 0);
  state.loot.push({ ...drop, id: 2 });
  advance(state, 100, [{ interact: true }]); assert.equal(human.hp, 95); assert.equal(state.loot.length, 1);
  Horde.step(state); Horde.step(state, [{ interact: true }]); assert.equal(human.hp, 140); assert.equal(state.loot.length, 0);
});

test('sparse co-op human slots stay indexed and a disconnected survivor cannot become a monster target or respawn', () => {
  const { state, monster } = combatFixture({ capacity: 3, participantIds: [0, 2] });
  assert.deepEqual(state.horde.participantIds, [0, 2]);
  assert.equal(state.players[1].alive, false); assert.equal(state.players[1].participating, false);
  assert.ok(state.players.every((player, index) => player.id === index));
  assert.ok(monster.id >= 3); assert.equal(monster.team, 1);
  const oldLife = state.players[2].lifeId;
  Horde.setConnected(state, 2, false);
  assert.deepEqual(state.horde.participantIds, [0]);
  assert.equal(state.players[2].alive, false); assert.equal(state.players[2].hp, 0);
  assert.equal(Horde.findReviveTarget(state, 0), null);
  monster.emergenceTicks = 10000;
  for (let tick = 0; tick < 200 && monster.alive; tick++) Horde.step(state, [aimAt(state.players[0], monster)]);
  state.horde.pending = 0; Horde.step(state);
  assert.equal(state.phase, 'intermission');
  assert.equal(state.players[2].alive, false); assert.equal(state.players[2].lifeId, oldLife);
  assert.equal(state.players[1].alive, false);
  advance(state, Horde.HORDE_RULES.intermissionTicks);
  assert.equal(state.phase, 'fight');
  assert.equal(state.players[2].alive, false); assert.ok(state.players.every((player, index) => player.id === index));
});

test('co-op fire uses the acting sparse slot and allied bodies block shots without taking damage', () => {
  const { state, monster } = combatFixture({ capacity: 3, participantIds: [0, 2] });
  const blocker = pose(state.players[0], { x: 0, z: 2 }), shooter = pose(state.players[2], { x: 0, z: 4 });
  pose(monster, { x: 0, z: -4 }); monster.emergenceTicks = 10000;
  Horde.step(state, [emptyInput(blocker), emptyInput(), aimAt(shooter, monster)]);
  const blocked = state.events.findLast(event => event.type === 'shot');
  assert.equal(blocked.playerId, 2); assert.equal(blocked.targetId, 0); assert.equal(blocked.damage, 0);
  assert.equal(blocker.hp, blocker.maxHp); assert.equal(monster.hp, monster.maxHp);
  pose(blocker, { x: 8, z: 2 });
  advance(state, 13, [emptyInput(blocker), emptyInput(), aimAt(shooter, monster)]);
  assert.ok(monster.hp < monster.maxHp); assert.ok(shooter.damageDealt > 0); assert.equal(blocker.damageDealt, 0);
  assert.equal(blocker.hp, blocker.maxHp);
});

function fallenTeammate({ extraSurvivor = false } = {}) {
  const fixture = combatFixture({ capacity: 3, participantIds: extraSurvivor ? [0, 1, 2] : [0, 2] });
  const { state, monster, brain, human } = fixture, teammate = state.players[2];
  pose(human, { x: 0, z: 8 }); pose(teammate, { x: 0, z: -2.7 }); teammate.hp = 1;
  pose(monster, { x: 0, z: -4, yaw: Math.PI });
  brain.targetId = 2; brain.nextSightTick = 0;
  advance(state, Horde.MONSTER_TYPES.stalker.windup + 1);
  assert.equal(teammate.alive, false); assert.equal(teammate.deaths, 1);
  assert.ok(state.events.some(event => event.type === 'kill' && event.targetId === 2));
  pose(monster, { x: 15, z: 15 }); monster.emergenceTicks = 10000;
  pose(human, { x: 0, z: -1.5 });
  assert.equal(Horde.findReviveTarget(state, 0), teammate);
  return { ...fixture, teammate };
}

test('a real fallen teammate needs one uninterrupted channel and can be revived only once that wave', () => {
  const { state, human, teammate } = fallenTeammate();
  const oldLife = teammate.lifeId;
  advance(state, 180, [{ interact: true }]);
  assert.equal(teammate.alive, false); assert.equal(human.interactTicks, 180);
  Horde.step(state); assert.equal(human.interactTicks, 0);
  advance(state, Horde.HORDE_RULES.reviveTicks - 1, [{ interact: true }]);
  assert.equal(teammate.alive, false);
  Horde.step(state, [{ interact: true }]);
  const revived = state.players[2];
  assert.equal(revived.alive, true); assert.equal(revived.hp, Horde.HORDE_RULES.reviveHealth);
  assert.equal(revived.lifeId, oldLife + 1); assert.equal(revived.revivesThisWave, 1);
  assert.equal(state.horde.revives, 1); assert.equal(revived.potions + revived.grenades, 0);
  assertPhysical(state.map, revived);
  assert.ok(Math.hypot(revived.x - human.x, revived.z - human.z) >= revived.radius + human.radius - 1e-6);
  // A second death cannot turn the same wave into an endless revive/heal loop.
  revived.alive = false; revived.hp = 0;
  assert.equal(Horde.findReviveTarget(state, 0), null);
  advance(state, Horde.HORDE_RULES.reviveTicks + 20, [{ interact: true }]);
  assert.equal(revived.alive, false); assert.equal(state.horde.revives, 1);
});

test('reviving a teammate chooses a legal clear position when a living human occupies the corpse', () => {
  const { state, human, teammate } = fallenTeammate();
  // A living reviver can stand exactly on a non-physical corpse. Restoration
  // must place the new physical body beside them, with current cover checked.
  pose(human, { x: teammate.x, z: teammate.z });
  advance(state, Horde.HORDE_RULES.reviveTicks, [{ interact: true }]);
  const revived = state.players[2];
  assert.equal(revived.alive, true); assertPhysical(state.map, revived);
  assert.ok(Math.hypot(revived.x - human.x, revived.z - human.z) >= revived.radius + human.radius - 1e-6);
});

test('revival checks standing body height against a crouched teammate jumping above the corpse', () => {
  const { state, teammate } = fallenTeammate({ extraSurvivor: true });
  advance(state, Horde.HORDE_RULES.reviveTicks - 1, [{ interact: true }]);
  const jumping = pose(state.players[1], { x: teammate.x, y: 1.5, z: teammate.z, crouching: true, grounded: false });
  Horde.step(state, [{ interact: true }, { crouch: true }]);
  const revived = state.players[2];
  assert.equal(revived.alive, true); assert.equal(jumping.crouching, true);
  assert.ok(jumping.y > revived.y && jumping.y < revived.y + playerHeight(revived));
  assert.ok(Math.hypot(revived.x - jumping.x, revived.z - jumping.z) >= revived.radius + jumping.radius - 1e-6);
});

test('a wave clear restores a dead connected teammate while retaining loadout, death credit and life identity', () => {
  const { state, teammate, monster, human } = fallenTeammate();
  teammate.weapon = 'shotgun'; const oldLife = teammate.lifeId;
  for (let tick = 0; tick < 200 && monster.alive; tick++) Horde.step(state, [aimAt(human, monster)]);
  assert.equal(monster.alive, false); state.horde.pending = 0; Horde.step(state);
  assert.equal(state.phase, 'intermission');
  const restored = state.players[2];
  assert.equal(restored.alive, true); assert.equal(restored.connected, true); assert.equal(restored.participating, true);
  assert.equal(restored.lifeId, oldLife + 1); assert.equal(restored.deaths, 1); assert.equal(restored.weapon, 'shotgun');
  assert.equal(restored.ammo, WEAPONS.shotgun.magazine); assert.ok(restored.reserve > 0);
  assert.ok(restored.hp > 0 && restored.hp <= restored.maxHp); assertPhysical(state.map, restored);
  advance(state, Horde.HORDE_RULES.intermissionTicks);
  assert.equal(state.horde.wave, 2); assert.equal(restored.revivesThisWave, 0);
});

test('intermission never restores a dead survivor inside a living body at the authored spawn', () => {
  const state = active({ capacity: 3 }, [0, 2]);
  pose(state.players[0], Horde.MAPS.courtyard.spawns[0][2]);
  Object.assign(state.players[2], { alive: false, hp: 0 });
  state.horde.pending = 0; state.horde.nextSpawnTick = 1e9; state.spawnWarnings = [];
  Horde.step(state);
  assert.equal(state.phase, 'intermission');
  const survivor = state.players[0], restored = state.players[2];
  assert.equal(restored.alive, true); assertPhysical(state.map || Horde.MAPS[state.mapId], restored);
  assert.ok(Math.hypot(survivor.x - restored.x, survivor.z - restored.z) >= survivor.radius + restored.radius - 1e-6);
  const poses = state.players.map(player => [player.x, player.y, player.z]);
  advance(state, 120);
  assert.deepEqual(state.players.map(player => [player.x, player.y, player.z]), poses);
});

test('real stalking monsters climb authored roofs and damage campers on every arena', () => {
  for (const mapId of Object.keys(Horde.MAPS)) {
    const state = active({ capacity: 1, mapId }), map = Horde.MAPS[mapId], route = map.routes[0];
    const goal = route.steps.at(-1), roof = map.colliders.find(box => box.id === goal.colliderId);
    const human = pose(state.players[0], { x: goal.x, y: roof.y + roof.h, z: goal.z });
    human.hp = human.maxHp = 5000;
    state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
    state.spawnWarnings = [{ id: 1, ...route.start, y: 0, ticksLeft: 1, monsterType: 'stalker' }];
    Horde.step(state); const monster = monsters(state)[0]; assert.ok(monster, mapId); monster.emergenceTicks = 0;
    let maximumY = 0;
    // A valid strike can reach the camper from the last lower step. Continue
    // until the body has also completed its physical climb onto the roof.
    for (let tick = 0; tick < 3600 && (monster.damageDealt === 0 || maximumY < roof.y + roof.h - .2); tick++) {
      Horde.step(state); maximumY = Math.max(maximumY, monster.y);
      if (tick % 15 === 0) assertPhysical(map, monster);
    }
    assert.ok(maximumY >= roof.y + roof.h - .2, `${mapId}: AI never climbed to the player's height`);
    assert.ok(monster.damageDealt > 0, `${mapId}: elevated player can camp forever`);
    assert.ok(human.hp < human.maxHp, mapId);
  }
});

test('eight naturally completed waves grow tougher while entities, drops, events and network snapshots stay bounded', () => {
  const state = Horde.createState({ capacity: 1, seed: 73291 });
  assert.equal(Horde.selectLoadout(state, 0, 'lmg').ok, true);
  Horde.startMatch(state, [0]); advance(state, Horde.HORDE_RULES.countdownTicks);
  state.map = openArena; const human = pose(state.players[0], { x: 0, z: 0 });
  // A long-run integrity fixture keeps the observer alive. Every monster kill
  // still requires the normal magazine, spin-up, recoil, aim and reload rules.
  human.hp = human.maxHp = 1e6;
  const generations = new Set(), lifeIds = new Set(), previousLifeBySlot = new Map(), types = new Set(), waves = [], stalkerHealth = [];
  let peakSnapshotBytes = 0;
  for (let tick = 0; tick < 40000 && state.horde.wavesCleared < 8; tick++) {
    const targets = monsters(state).sort((a, b) => Math.hypot(a.x - human.x, a.z - human.z) - Math.hypot(b.x - human.x, b.z - human.z));
    for (const monster of targets) {
      const generation = `${monster.id}:${monster.lifeId}`;
      if (generations.has(generation)) continue;
      generations.add(generation); types.add(monster.monsterType);
      assert.ok(monster.lifeId > (previousLifeBySlot.get(monster.id) || 0)); previousLifeBySlot.set(monster.id, monster.lifeId);
      assert.equal(lifeIds.has(monster.lifeId), false); lifeIds.add(monster.lifeId);
      assert.equal(state.players[monster.id], monster);
      if (Horde.MONSTER_TYPES[monster.monsterType].gun) assert.ok(state.horde.wave >= (monster.monsterType === 'sniper' ? 7 : 4));
      if (monster.monsterType === 'stalker' && stalkerHealth.length < state.horde.wave) stalkerHealth[state.horde.wave - 1] = monster.maxHp;
    }
    Horde.step(state, targets.length ? [aimAt(human, targets[0])] : []);
    assert.equal(state.players, state.fighters);
    assert.ok(state.players.length <= state.capacity + Horde.HORDE_RULES.maxMonsters);
    assert.ok(state.players.every((player, index) => player.id === index));
    assert.ok(state.loot.length <= Horde.HORDE_RULES.maxLoot);
    assert.ok(state.spawnWarnings.length <= Horde.HORDE_RULES.maxWarnings);
    assert.ok(state.events.length <= 256);
    if (tick % 120 === 0) {
      const snapshot = { ...state, map: undefined, fighters: undefined, horde: { ...state.horde, brains: undefined } };
      peakSnapshotBytes = Math.max(peakSnapshotBytes, Buffer.byteLength(JSON.stringify(snapshot)));
    }
    if (state.phase === 'intermission' && !waves.some(wave => wave.number === state.horde.wave)) waves.push({ number: state.horde.wave, kills: state.horde.waveKills });
  }
  assert.equal(state.horde.wavesCleared, 8);
  assert.equal(waves.length, 8); assert.ok(waves.slice(1).every((wave, index) => wave.kills > waves[index].kills));
  assert.deepEqual([...types].sort(), Object.keys(Horde.MONSTER_TYPES).sort());
  const healthSamples = stalkerHealth.filter(Number.isFinite);
  assert.ok(healthSamples.length >= 4); assert.ok(healthSamples.slice(1).every((health, index) => health > healthSamples[index]));
  assert.equal(state.horde.totalKills, waves.reduce((sum, wave) => sum + wave.kills, 0));
  assert.equal(human.kills, state.horde.totalKills);
  assert.ok(generations.size > state.players.length, 'monster slots never exercised reuse');
  assert.ok(peakSnapshotBytes < 128 * 1024, `oversized snapshot: ${peakSnapshotBytes} bytes`);
});
