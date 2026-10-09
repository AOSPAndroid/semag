import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice, getPracticeStats } from '../public/voxel-practice-engine.js';
import { createPracticeInputQueue } from '../public/voxel-practice-input.js';
import { DOJO_MAP } from '../public/voxel-dojo-map.js';
import { DOJO_ACTIONS, DOJO_RESPAWN_TICKS, findDojoStationLoot, findDojoStation } from '../public/voxel-dojo-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { WORLD, eyeHeight, emptyInput } from '../public/voxel-engine.js';
import { selectInventorySlot } from '../public/voxel-inventory.js';

function begin(options = {}) {
  const state = createPractice({ mode: 'dojo', bots: 5, seed: 1187, ...options }); startPractice(state);
  while (state.phase === 'countdown') stepPractice(state);
  assert.equal(state.phase, 'fight'); return state;
}
function advance(state, ticks, input = {}) { for (let tick = 0; tick < ticks; tick++) stepPractice(state, typeof input === 'function' ? input(state, tick) : input); }
function pose(player, x, z) { Object.assign(player, { x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, previousInput: emptyInput() }); }
function aim(player, target, fire = true, kind = 'body') {
  const dx = target.x - player.x, dz = target.z - player.z;
  return { fire, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(target.y + (kind === 'head' ? 1.67 : 1.02) - player.y - eyeHeight(player), Math.hypot(dx, dz)) - player.recoil };
}
function legalBody(map, player) {
  assert.ok(player.x >= map.bounds.minX + WORLD.radius - 1e-6 && player.x <= map.bounds.maxX - WORLD.radius + 1e-6);
  assert.ok(player.z >= map.bounds.minZ + WORLD.radius - 1e-6 && player.z <= map.bounds.maxZ - WORLD.radius + 1e-6);
  for (const box of map.colliders) {
    if (player.y >= box.y + box.h - 1e-7 || player.y + WORLD.standHeight <= box.y + 1e-7) continue;
    const dx = player.x - Math.max(box.x, Math.min(box.x + box.w, player.x)), dz = player.z - Math.max(box.z, Math.min(box.z + box.d, player.z));
    assert.ok(dx * dx + dz * dz >= WORLD.radius ** 2 - 1e-6, `Dojo body ${player.id} penetrates ${box.id}`);
  }
}

test('the isolated dojo waits for Enter and preserves all ordinary practice and competitive map catalogs', () => {
  const state = createPractice({ mode: 'dojo', bots: 5, seed: 33 });
  assert.equal(state.phase, 'ready'); assert.equal(state.map, DOJO_MAP); assert.equal(state.gameId, 'voxel-dojo'); assert.equal(state.mapId, 'dojo');
  const ready = JSON.stringify(state); advance(state, 240, { fire: true, up: true, dojoReset: true }); assert.equal(JSON.stringify(state), ready);
  startPractice(state); assert.equal(state.phase, 'countdown'); assert.equal(state.dojo.moving, false);
  for (const config of [{ game: 'voxel-royale', mode: 'dojo' }, { mode: 'dojo', mapId: 'courtyard' }, { mode: 'dojo', targetMotion: 'bad' }, { mode: 'dojo', weapon: '__proto__' }]) assert.throws(() => createPractice(config), RangeError);
  assert.equal(createPractice({ mode: 'targets' }).gameId, 'voxel-breach'); assert.equal(createPractice({ mode: 'combat' }).mapId, 'courtyard');
});

test('all 36 guns are genuinely selectable from the visible rack and produce actual authoritative body contacts', () => {
  assert.equal(Object.keys(WEAPONS).length, 36);
  for (const weapon of Object.keys(WEAPONS)) {
    const state = begin(), player = state.players[0]; pose(player, -9, 12);
    stepPractice(state, { dojoWeapon: weapon, interact: true }); assert.equal(player.weapon, weapon, weapon);
    assert.ok(state.events.some(event => event.type === 'lootPickup' && event.weapon === weapon && event.playerId === 0), `${weapon}: no real pickup`);
    assert.ok(state.loot.some(item => item.dojoStation === 'gun' && item.weapon === weapon), `${weapon}: rack did not restock`);
    pose(player, -7, 8);
    const target = state.players[1], before = target.hp;
    for (let tick = 0; tick < 160 && target.hp === before; tick++) stepPractice(state, aim(player, target, tick === 0 || WEAPONS[weapon].mode === 'auto'));
    assert.ok(target.hp < before, `${weapon}: fired without actual body contact`);
    assert.ok(state.dojo.lastHit?.damage > 0, `${weapon}: missing measured damage`);
    const contacts = state.events.filter(event => event.type === 'damage' && event.playerId === 0 && event.targetId > 0), last = contacts.at(-1);
    assert.ok(contacts.some(event => event.targetId === 1 && event.hitKind === 'body'), `${weapon}: no real body hit`);
    assert.equal(state.dojo.lastHit.kind, last.hitKind || 'body'); assert.equal(state.dojo.lastHit.damage, last.damage);
    assert.ok(state.dojo.lastHit.distance >= 2.9, `${weapon}: wrong contact distance`);
    assert.ok(state.players[0].damageDealt > 0); assert.equal(state.phase, 'fight');
  }
});

test('all five blade rack pickups equip real inventory items and resolve their real swept attacks', () => {
  for (const melee of Object.keys(MELEE_WEAPONS)) {
    const state = begin(), player = state.players[0]; pose(player, -3, 12);
    stepPractice(state, { dojoBlade: melee, interact: true }); assert.equal(player.meleeWeapon, melee); assert.equal(player.slot, 'sword');
    assert.ok(state.events.some(event => event.type === 'lootPickup' && event.weapon === melee));
    pose(player, -7, 6.05); stepPractice(state, { fire: true, yaw: 0, pitch: 0 }); advance(state, MELEE_WEAPONS[melee].startupTicks + MELEE_WEAPONS[melee].activeTicks + 3);
    assert.equal(state.players[1].hp, 200 - MELEE_WEAPONS[melee].damage, melee);
    assert.ok(state.events.some(event => event.type === 'meleeHit' && event.weapon === melee)); assert.equal(state.dojo.lastHit.weapon, melee);
  }
});

test('a killed dojo target respawns after two real seconds and the second life can be killed without ending the lab', () => {
  const state = begin({ weapon: 'vandal' }), player = state.players[0]; pose(player, 0, 10);
  const life = state.players[3].lifeId;
  for (let tick = 0; tick < 180 && state.players[3].alive; tick++) stepPractice(state, aim(player, state.players[3], true, 'head'));
  assert.equal(state.players[3].alive, false); assert.equal(state.phase, 'fight'); assert.equal(player.kills, 1);
  advance(state, DOJO_RESPAWN_TICKS - 1); assert.equal(state.players[3].alive, false);
  stepPractice(state); assert.equal(state.players[3].alive, true); assert.equal(state.players[3].hp, 200); assert.equal(state.players[3].lifeId, life + 1); legalBody(state.map, state.players[3]);
  for (let tick = 0; tick < 180 && state.players[3].alive; tick++) stepPractice(state, aim(player, state.players[3], true, 'head'));
  assert.equal(player.kills, 2); assert.equal(state.phase, 'fight'); assert.equal(getPracticeStats(state).result, null); assert.ok(state.dojo.headContacts >= 2);
});

test('a target pad waits or uses a legal alternate instead of respawning inside the local body', () => {
  const state = begin({ weapon: 'vandal' }), player = state.players[0]; pose(player, 0, 10);
  for (let tick = 0; tick < 180 && state.players[3].alive; tick++) stepPractice(state, aim(player, state.players[3], true, 'head')); assert.equal(state.players[3].alive, false);
  pose(player, 0, -10); advance(state, DOJO_RESPAWN_TICKS + 1);
  const target = state.players[3]; assert.equal(target.alive, true); assert.ok(Math.hypot(target.x - player.x, target.z - player.z) >= WORLD.radius * 2 + .1 - 1e-6); legalBody(state.map, target);
});

test('stationary/moving controls change real target inputs once per press, keep bodies legal and reset pads', () => {
  const state = begin(), initial = state.players.slice(1).map(player => ({ x: player.x, z: player.z })); advance(state, 180);
  assert.deepEqual(state.players.slice(1).map(player => ({ x: player.x, z: player.z })), initial);
  advance(state, 24, { dojoMotion: true }); assert.equal(state.dojo.moving, true);
  assert.equal(state.events.filter(event => event.type === 'dojoMotion').length, 1);
  const maximumTravel = state.players.slice(1).map(() => 0);
  for (let tick = 0; tick < 600; tick++) { stepPractice(state); for (const target of state.players.slice(1)) { legalBody(state.map, target); maximumTravel[target.id - 1] = Math.max(maximumTravel[target.id - 1], Math.hypot(target.x - initial[target.id - 1].x, target.z - initial[target.id - 1].z)); } }
  assert.ok(maximumTravel.every(distance => distance > .3));
  stepPractice(state, { dojoMotion: true }); assert.equal(state.dojo.moving, false);
  stepPractice(state); stepPractice(state, { dojoReset: true }); assert.equal(state.dojo.resetCount, 1);
  assert.deepEqual(state.players.slice(1).map(player => ({ x: player.x, z: player.z })), initial);
  assert.ok(state.players.slice(1).every(player => player.shots === 0 && player.damageDealt === 0 && player.hp === 200));
});

test('normal magazine, firing cadence and committed reload remain real while sandbox reserve replenishes', () => {
  const state = begin({ weapon: 'pistol' }), player = state.players[0], gun = WEAPONS.pistol;
  for (let shot = 0; shot < gun.magazine; shot++) { stepPractice(state, { fire: true, yaw: Math.PI }); advance(state, gun.cooldown + 1, { yaw: Math.PI }); }
  assert.equal(player.ammo, 0); const shots = player.shots;
  stepPractice(state, { fire: true, yaw: Math.PI }); assert.equal(player.shots, shots);
  stepPractice(state); stepPractice(state, { reload: true }); assert.ok(player.reloadTicks > 0); const remaining = player.reloadTicks;
  advance(state, remaining - 1); assert.equal(player.ammo, 0); stepPractice(state); assert.equal(player.ammo, gun.magazine);
  assert.ok(player.reserve >= gun.reserve); assert.equal(state.phase, 'fight');
});

test('recovery, deliberate training injury and actual collected potions heal only through real commitments', () => {
  const state = begin(), player = state.players[0];
  stepPractice(state, { dojoWound: true }); assert.equal(player.hp, 200, 'remote wound was accepted');
  pose(player, 9, 12); stepPractice(state); stepPractice(state, { dojoWound: true }); assert.equal(player.hp, 140);
  assert.equal(getPracticeStats(state).damageTaken, 60);
  pose(player, 3, 12); stepPractice(state, { interact: true }); assert.equal(player.potions, 2);
  stepPractice(state); stepPractice(state, { heal: true }); assert.ok(player.healTicks > 0); assert.equal(player.hp, 140); assert.equal(player.potions, 1);
  advance(state, 239); assert.equal(player.hp, 140); stepPractice(state); assert.equal(player.hp, 200);
  pose(player, 9, 12); stepPractice(state, { dojoWound: true }); assert.equal(player.hp, 140); stepPractice(state); stepPractice(state, { interact: true }); assert.equal(player.hp, 200);
  assert.ok(state.events.some(event => event.type === 'healComplete' && event.amount === 60));
});

test('supplies restock usable frag stacks and the real grenade damages a target', () => {
  const state = begin(), player = state.players[0]; pose(player, 3, 12);
  stepPractice(state, { interact: true }); assert.equal(player.potions, 2); stepPractice(state); stepPractice(state, { interact: true }); assert.equal(player.grenades, 2);
  assert.equal(state.loot.filter(item => item.dojoStation === 'supplies').length, 2);
  pose(player, -7, 7.4); stepPractice(state, { grenade: true, yaw: 0, pitch: -.5 }); assert.equal(player.grenades, 1); assert.equal(state.grenades.length, 1);
  advance(state, 300); assert.ok(state.events.some(event => event.type === 'grenadeExplosion'));
  assert.ok(state.events.some(event => event.type === 'damage' && event.attack === 'grenade' && event.targetId > 0)); assert.equal(state.phase, 'fight');
});

test('rack selection cannot grant weapons remotely, through cover, or intercept the genuine rack with dropped gear', () => {
  const state = begin(), player = state.players[0];
  stepPractice(state, { dojoWeapon: 'odin', interact: true }); assert.equal(player.weapon, 'carbine');
  pose(player, -9, 12); stepPractice(state); stepPractice(state, { dojoWeapon: 'odin', interact: true }); assert.equal(player.weapon, 'odin');
  for (const weapon of ['vandal', 'ghost', 'judge', 'sheriff']) { stepPractice(state); stepPractice(state, { dojoWeapon: weapon, interact: true }); assert.equal(player.weapon, weapon); }
  assert.ok(state.loot.some(item => !item.dojoStation)); assert.equal(findDojoStationLoot(state).weapon, 'sheriff');
  state.map = { ...state.map, colliders: [...state.map.colliders, { id: 'sealed-rack', x: -12, y: 0, z: 12.6, w: 6, h: 4, d: .1 }] };
  assert.equal(findDojoStationLoot(state), null);
  stepPractice(state); stepPractice(state, { dojoWeapon: 'phantom', interact: true }); assert.notEqual(player.weapon, 'phantom');
  assert.ok(!state.events.some(event => event.type === 'lootPickup' && event.weapon === 'phantom'));
});

test('pause freezes sandbox events, respawn clocks and reserve, and resume fences queued laboratory buttons', () => {
  const state = begin(), queue = createPracticeInputQueue({ extraActions: DOJO_ACTIONS });
  queue.press('dojoMotion'); pausePractice(state); queue.reset();
  const frozen = JSON.stringify(state); advance(state, 300, { dojoMotion: true, dojoReset: true }); assert.equal(JSON.stringify(state), frozen);
  resumePractice(state); stepPractice(state, { dojoMotion: true, dojoReset: true }); assert.equal(state.dojo.moving, false); assert.equal(state.dojo.resetCount, 0);
  stepPractice(state); queue.press('dojoMotion'); const control = queue.sample({}); stepPractice(state, control); assert.equal(state.dojo.moving, true);
  assert.equal(queue.inspect().dojoMotion, 0); assert.equal(createPracticeInputQueue().press('dojoMotion'), null, 'ordinary practice gained lab actions');
});

test('public Dojo controls and genuine startup stay read-only in browser diagnostics', async () => {
  const [html, client] = await Promise.all(['voxel-practice.html', 'voxel-practice-client.js'].map(path => readFile(new URL(`../public/${path}`, import.meta.url), 'utf8')));
  for (const selector of ['dojo-weapon', 'dojo-blade', 'dojo-motion', 'dojo-reset', 'dojo-wound', 'dojo-recover', 'dojo-use-station', 'dojo-return', 'dojo-contact']) assert.ok(html.includes(`id="${selector}"`), selector);
  assert.match(client, /params\.get\('mode'\) === 'dojo'/); assert.match(client, /Enter dojo/); assert.match(client, /Object\.freeze\(\{ getState: inspect, getDisplayTiming:/);
  assert.match(client, /inputQueue\.press\(action, currentInput\(\)\)/); assert.match(client, /setDojoTools\(false\); return/);
});
