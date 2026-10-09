import assert from 'node:assert/strict';
import test from 'node:test';
import * as game from '../public/voxel-engine.js';
import { MAX_BOLTS } from '../public/voxel-projectiles.js';

const input = (player, buttons = {}) => ({ ...game.emptyInput(player), ...buttons });
const neutral = state => state.players.map(player => input(player));
function advance(state, ticks, buttons = {}, id = 0) {
  for (let tick = 0; tick < ticks; tick++) {
    const keys = neutral(state); keys[id] = input(state.players[id], buttons); game.step(state, keys);
  }
}
function fighting(weapon = 'carbine', teamSize = 1, mapId = 'courtyard') {
  const state = game.createState({ teamSize, mapId });
  assert.equal(game.selectLoadout(state, 0, weapon).ok, true);
  game.startMatch(state); advance(state, 11 * game.TICK_RATE);
  assert.equal(state.phase, 'fight');
  // A clear outer-lane sidewall gives weapon-cadence tests a harmless real target.
  Object.assign(state.players[0], { x: 20, z: 8, yaw: Math.PI / 2, pitch: 0 });
  Object.assign(state.players[teamSize], { x: 20, z: -8, yaw: Math.PI / 2, pitch: 0 });
  return state;
}
const shotEvents = (state, id = 0) => state.events.filter(event => event.type === 'shot' && event.playerId === id);
function collectUtility(state, player, kind) {
  const loot = game.addInventoryLoot(state, player, { kind, amount: 1 });
  assert.ok(loot);
  assert.equal(game.pickupCombatLoot(state, player, loot), true);
  assert.equal(kind === 'heal' ? player.potions : player.grenades, 1);
}

test('sniper hip fire misses a distant body while a settled scope deals its honest 100 damage', () => {
  const outcomes = [];
  for (const scoped of [false, true]) {
    const state = fighting('sniper'), [shooter, target] = state.players;
    Object.assign(shooter, { x: 20, z: 16, yaw: 0, pitch: Math.atan2(.85 - game.eyeHeight(shooter), 32) });
    Object.assign(target, { x: 20, z: -16 });
    if (scoped) advance(state, game.ADS.ticks, { aim: true });
    advance(state, 1, { fire: true, aim: scoped });
    const event = shotEvents(state).at(-1);
    assert.ok(event);
    assert.equal(shooter.ammo, game.WEAPONS.sniper.magazine - 1);
    const aim = { x: 0, y: Math.sin(shooter.pitch), z: -Math.cos(shooter.pitch) };
    const dot = event.dx * aim.x + event.dy * aim.y + event.dz * aim.z;
    outcomes.push({ error: Math.acos(Math.max(-1, Math.min(1, dot))), target, event, state });
  }
  assert.ok(outcomes[0].error > outcomes[1].error * 40, 'the authoritative cone settles during the ADS transition');
  assert.equal(outcomes[0].target.hp, 200);
  assert.equal(outcomes[0].event.damage, 0);
  assert.equal(outcomes[1].event.hitKind, 'body');
  assert.equal(outcomes[1].event.damage, 100);
  assert.equal(outcomes[1].target.hp, 100);
  assert.equal(outcomes[1].target.alive, true);
  assert.equal(outcomes[1].state.events.some(event => event.type === 'kill'), false);
});

test('sniper requires a fresh click after its full bolt cycle and discards clicks made during recovery', () => {
  const state = fighting('sniper'), shooter = state.players[0], weapon = game.WEAPONS.sniper;
  advance(state, 1, { fire: true });
  assert.equal(shooter.shots, 1);
  assert.equal(shooter.shotCooldown, weapon.cooldown);
  advance(state, weapon.cooldown + 20, { fire: true });
  assert.equal(shooter.shots, 1, 'held trigger cannot fire the next chambered round');
  advance(state, 1); advance(state, 1, { fire: true });
  assert.equal(shooter.shots, 2);
  advance(state, 10); advance(state, 1, { fire: true });
  assert.equal(shooter.shots, 2, 'an early click spends no ammo');
  advance(state, weapon.cooldown + 1, { fire: true });
  assert.equal(shooter.shots, 2, 'an early click is not queued to fire when cooldown expires');
  advance(state, 1); advance(state, 1, { fire: true });
  assert.equal(shooter.shots, 3);
  advance(state, weapon.cooldown - 1); advance(state, 1, { fire: true });
  assert.equal(shooter.shots, 4, 'a fresh edge at the exact recovery boundary is accepted');
  assert.equal(shooter.ammo, weapon.magazine - 4);
});

test('sniper reload transfers finite reserve only at completion and a held trigger cannot fire through it', () => {
  const state = fighting('sniper'), shooter = state.players[0], weapon = game.WEAPONS.sniper;
  advance(state, 1, { fire: true }); advance(state, weapon.cooldown); advance(state, 1, { fire: true });
  advance(state, 1); advance(state, 1, { reload: true, fire: true });
  assert.equal(shooter.reloadTicks, weapon.reloadTicks);
  assert.equal(shooter.ammo, weapon.magazine - 2);
  advance(state, weapon.reloadTicks - 1, { fire: true });
  assert.equal(shooter.ammo, weapon.magazine - 2);
  assert.equal(shooter.reserve, weapon.reserve);
  advance(state, 1, { fire: true });
  assert.equal(shooter.ammo, weapon.magazine);
  assert.equal(shooter.reserve, weapon.reserve - 2);
  assert.equal(shooter.shots, 2);
  advance(state, 1); advance(state, 1, { fire: true });
  assert.equal(shooter.shots, 3);

  const limited = fighting('sniper'), player = limited.players[0];
  Object.assign(player, { ammo: 0, reserve: 2 });
  advance(limited, 1, { reload: true }); advance(limited, weapon.reloadTicks);
  assert.equal(player.ammo, 2); assert.equal(player.reserve, 0);
  advance(limited, 1, { reload: true });
  assert.equal(player.reloadTicks, 0, 'empty reserves cannot create replacement rounds');
});

test('LMG spends its first round after 24 held ticks and maintains a 12-tick cadence until release', () => {
  const state = fighting('lmg'), shooter = state.players[0], weapon = game.WEAPONS.lmg;
  advance(state, weapon.spinupTicks - 1, { fire: true });
  assert.equal(shooter.shots, 0); assert.equal(shooter.ammo, weapon.magazine);
  assert.equal(shooter.spinTicks, weapon.spinupTicks - 1);
  advance(state, 1, { fire: true });
  assert.equal(shooter.shots, 1); assert.equal(shooter.ammo, weapon.magazine - 1);
  advance(state, weapon.cooldown - 1, { fire: true }); assert.equal(shooter.shots, 1);
  advance(state, 1, { fire: true }); assert.equal(shooter.shots, 2);
  advance(state, 8 * weapon.cooldown, { fire: true });
  const events = shotEvents(state);
  assert.equal(events.length, 10);
  for (let index = 1; index < events.length; index++) assert.equal(events[index].tick - events[index - 1].tick, weapon.cooldown);
  assert.equal(shooter.spinTicks, weapon.spinupTicks);
  advance(state, 1); assert.equal(shooter.spinTicks, 0);
  const shots = shooter.shots;
  advance(state, weapon.spinupTicks - 1, { fire: true }); assert.equal(shooter.shots, shots);
  advance(state, 1, { fire: true }); assert.equal(shooter.shots, shots + 1);
});

test('LMG reload, grenade, potion, sword and interaction interrupt firing commitment', () => {
  for (const action of ['reload', 'grenade', 'heal', 'swap', 'interact']) {
    const state = fighting('lmg'), shooter = state.players[0], weapon = game.WEAPONS.lmg;
    if (action === 'grenade' || action === 'heal') collectUtility(state, shooter, action === 'heal' ? 'heal' : 'grenade');
    advance(state, weapon.spinupTicks, { fire: true });
    advance(state, 1); advance(state, 12, { fire: true });
    assert.equal(shooter.spinTicks, 12); assert.equal(shooter.shots, 1);
    shooter.hp = 60;
    advance(state, 1, { [action]: true, fire: action !== 'heal' });
    assert.equal(shooter.spinTicks, 0, action);
    assert.equal(shooter.shots, 1, action);
    if (action === 'reload') assert.equal(shooter.reloadTicks, weapon.reloadTicks);
    if (action === 'grenade') { assert.equal(shooter.grenadeThrowTicks, 24); assert.equal(shooter.grenades, 0); }
    if (action === 'heal') { assert.equal(shooter.healTicks, game.HEAL.ticks); assert.equal(shooter.potions, 0); }
    if (action === 'swap') { assert.equal(shooter.slot, 'sword'); assert.equal(shooter.meleeTicks, 0); }
    if (action === 'interact') {
      advance(state, 40, { fire: true, interact: true });
      assert.equal(shooter.shots, 1); assert.equal(shooter.spinTicks, 0);
      advance(state, weapon.spinupTicks - 1, { fire: true }); assert.equal(shooter.shots, 1);
      advance(state, 1, { fire: true }); assert.equal(shooter.shots, 2);
    }
  }
});

test('a held LMG trigger during countdown and buy cannot bank wind-up or fire when combat unlocks', () => {
  const state = game.createState(); game.selectLoadout(state, 0, 'lmg'); game.startMatch(state);
  advance(state, 11 * game.TICK_RATE, { fire: true });
  const shooter = state.players[0], weapon = game.WEAPONS.lmg;
  assert.equal(state.phase, 'fight'); assert.equal(shooter.triggerBlocked, true);
  advance(state, 60, { fire: true });
  assert.equal(shooter.spinTicks, 0); assert.equal(shooter.shots, 0); assert.equal(shooter.ammo, weapon.magazine);
  advance(state, 1); assert.equal(shooter.triggerBlocked, false);
  advance(state, weapon.spinupTicks - 1, { fire: true }); assert.equal(shooter.shots, 0);
  advance(state, 1, { fire: true }); assert.equal(shooter.shots, 1);
});

test('lethal damage and a completed round clear LMG wind-up without a latent shot', () => {
  const dead = fighting('lmg', 2), victim = dead.players[0], attacker = dead.players[2];
  Object.assign(victim, { hp: 20, z: 5, yaw: Math.PI / 2 });
  Object.assign(attacker, { x: 20, z: -5, yaw: Math.PI, pitch: Math.atan2(.85 - game.eyeHeight(attacker), 10) });
  advance(dead, 12, { fire: true }); assert.equal(victim.spinTicks, 12);
  const keys = neutral(dead); keys[0] = input(victim, { fire: true }); keys[2] = input(attacker, { fire: true });
  game.step(dead, keys);
  assert.equal(victim.alive, false); assert.equal(victim.spinTicks, 0); assert.equal(dead.phase, 'fight');
  advance(dead, 60, { fire: true }); assert.equal(victim.shots, 0); assert.equal(victim.spinTicks, 0);

  const ended = fighting('lmg'), player = ended.players[0];
  advance(ended, 12, { fire: true }); ended.roundTicks = 1;
  advance(ended, 1, { fire: true });
  assert.equal(ended.phase, 'roundEnd'); assert.equal(player.spinTicks, 0); assert.equal(player.shots, 0);
  advance(ended, 4 * game.TICK_RATE, { fire: true });
  assert.equal(ended.phase, 'countdown'); assert.equal(ended.players[0].weapon, 'lmg');
  assert.equal(ended.players[0].spinTicks, 0); assert.equal(ended.players[0].ammo, game.WEAPONS.lmg.magazine);
  game.resetLobby(ended); assert.equal(ended.players[0].spinTicks, 0); assert.equal(ended.phase, 'lobby');
});

test('all catalog weapons replay identically with finite bounded six-player state on every authored map', () => {
  let reachedEventCap = false, sawFlyingBolt = false;
  for (const mapId of Object.keys(game.MAPS)) for (const weaponId of Object.keys(game.WEAPONS)) {
    const state = game.createState({ teamSize: 3, mapId });
    for (const player of state.players) game.selectLoadout(state, player.id, weaponId);
    game.startMatch(state); advance(state, 11 * game.TICK_RATE);
    for (const player of state.players) {
      Object.assign(player, { x: 18 + player.id % 3 * 2, z: player.team ? -8 : 8, yaw: Math.PI / 2, pitch: 0, hp: 60 });
      collectUtility(state, player, 'heal'); collectUtility(state, player, 'grenade');
    }
    const replay = game.cloneState(state);
    for (let tick = 0; tick < 720; tick++) {
      const keys = state.players.map(player => input(player, {
        fire: tick % 72 < 48 && tick !== 60,
        aim: tick % 120 >= 60,
        up: tick % 180 < 12,
        right: tick % 180 >= 100 && tick % 180 < 112,
        left: tick % 180 >= 140 && tick % 180 < 152,
        jump: tick === 24 || tick === 180,
        reload: tick % 90 === 80,
        swap: tick === 160 || tick === 180,
        grenade: tick === 260,
        heal: tick === 60,
        interact: tick === 210,
        yaw: tick % 137 === 0 ? Infinity : Math.PI / 2,
        pitch: tick % 137 === 0 ? NaN : 0,
      }));
      game.step(state, keys); game.step(replay, keys);
      assert.ok(state.events.length <= (game.WEAPONS[weaponId].valorant ? 256 : game.EVENT_LIMIT), `${mapId}/${weaponId} event cap`);
      assert.ok(state.bolts.length <= MAX_BOLTS, `${mapId}/${weaponId} bolt cap`);
      assert.ok(state.grenades.length <= state.capacity, `${mapId}/${weaponId} per-round grenade cap`);
      reachedEventCap ||= state.events.length === (game.WEAPONS[weaponId].valorant ? 256 : game.EVENT_LIMIT);
      sawFlyingBolt ||= state.bolts.length > 0;
    }
    assert.deepEqual(replay, state, `${mapId}/${weaponId} deterministic replay`);
    const inspect = (value, path) => {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${mapId}/${weaponId} finite ${path}`);
      else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) inspect(child, `${path}.${key}`);
    };
    inspect(state, 'state');
    for (const player of state.players) {
      const weapon = game.WEAPONS[player.weapon], bounds = game.MAPS[mapId].bounds;
      assert.ok(player.x >= bounds.minX + player.radius - 1e-6 && player.x <= bounds.maxX - player.radius + 1e-6);
      assert.ok(player.z >= bounds.minZ + player.radius - 1e-6 && player.z <= bounds.maxZ - player.radius + 1e-6);
      assert.ok(player.y >= 0 && player.hp >= 0 && player.hp <= player.maxHp);
      assert.ok(Number.isInteger(player.ammo) && player.ammo >= 0 && player.ammo <= weapon.magazine);
      assert.ok(Number.isInteger(player.reserve) && player.reserve >= 0 && player.reserve <= weapon.reserve);
      assert.ok(player.spinTicks >= 0 && player.spinTicks <= (weapon.spinupTicks || 0));
    }
  }
  assert.ok(reachedEventCap, 'the replay exercises trimmed event history');
  assert.ok(sawFlyingBolt, 'the replay exercises live authoritative projectiles');
});
