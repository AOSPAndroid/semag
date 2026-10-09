import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, startMatch, selectLoadout, step, emptyInput, traceShot, MAPS, WEAPONS, WORLD } from '../public/voxel-engine.js';
import { WEAPON_IDS, weaponDamage, weaponStats } from '../public/voxel-weapons.js';
import { launchBolt, advanceBolts } from '../public/voxel-projectiles.js';

const direction = { x: 0, y: 0, z: -1 };
function lane({ weapon = 'carbine', crouching = false, targetY = 0, distance = 4, teamSize = 1 } = {}) {
  const state = createState({ teamSize });
  selectLoadout(state, 0, weapon); startMatch(state);
  for (let tick = 0; tick < 1320; tick++) step(state, state.players.map(player => emptyInput(player)));
  for (const player of state.players) Object.assign(player, { x: -20, z: player.id * 3 - 10 });
  const shooter = state.players[0], target = state.players[teamSize];
  Object.assign(shooter, { x: 20, y: 0, z: 2, yaw: 0, pitch: 0 });
  Object.assign(target, { x: 20, y: targetY, z: 2 - distance, yaw: Math.PI, pitch: 0, crouching });
  return { state, shooter, target };
}
function ticks(state, count, controls = {}) {
  for (let tick = 0; tick < count; tick++) step(state, state.players.map(player => ({ ...emptyInput(player), ...(controls[player.id] || {}) })));
}
function contact(state, target, relativeY) {
  return traceShot(state, 0, { x: 20, y: target.y + relativeY, z: 2 }, direction, 20);
}

test('standing and crouched leg/torso/head zones preserve the complete old silhouette', () => {
  for (const crouching of [false, true]) {
    const { state, target } = lane({ crouching });
    const legTop = crouching ? .3 : .55, height = crouching ? WORLD.crouchHeight : WORLD.standHeight;
    for (const [y, kind] of [[.01, 'leg'], [legTop - .001, 'leg'], [legTop, 'body'], [legTop + .001, 'body'], [height - .321, 'body'], [height - .319, 'head'], [height - .001, 'head']]) {
      const hit = contact(state, target, y);
      assert.equal(hit.playerId, target.id, `${crouching ? 'crouch' : 'standing'} ${y}`);
      assert.equal(hit.kind, kind, `${crouching ? 'crouch' : 'standing'} ${y}`);
    }
    assert.notEqual(contact(state, target, height + .001).playerId, target.id);
    // Original head is narrower than the torso: no wider hitboxes at the split.
    const edge = traceShot(state, 0, { x: 20.25, y: height - .1, z: 2 }, direction, 20);
    assert.notEqual(edge.playerId, target.id);
    assert.equal(traceShot(state, 0, { x: 20.28, y: .05, z: 2 }, direction, 20).kind, 'leg');
    assert.notEqual(traceShot(state, 0, { x: 20.291, y: .05, z: 2 }, direction, 20).playerId, target.id);
  }
});

test('elevated zones follow real player height without treating the space below as legs', () => {
  const { state, target } = lane({ targetY: 3.2 });
  assert.equal(contact(state, target, .25).kind, 'leg');
  assert.equal(contact(state, target, .9).kind, 'body');
  assert.equal(contact(state, target, 1.62).kind, 'head');
  assert.notEqual(contact(state, target, -.05).playerId, target.id);
  target.crouching = true;
  assert.equal(contact(state, target, .15).kind, 'leg');
  assert.equal(contact(state, target, .4).kind, 'body');
  assert.equal(contact(state, target, .98).kind, 'head');
});

test('ground-level leg aim still stops at the first real cover or allied silhouette', () => {
  const covered = lane(); Object.assign(covered.shooter, { x: -4, z: 8 }); Object.assign(covered.target, { x: -4, z: -8 });
  const wall = traceShot(covered.state, 0, { x: -4, y: .25, z: 8 }, direction, 20);
  assert.equal(wall.kind, 'wall'); assert.equal(wall.colliderId, 'central-west');
  const allied = lane({ teamSize: 2, distance: 6 }); Object.assign(allied.state.players[1], { x: 20, y: 0, z: 0 });
  const hit = contact(allied.state, allied.target, .25);
  assert.equal(hit.kind, 'leg'); assert.equal(hit.playerId, 1);
  ticks(allied.state, 1, { 0: { fire: true, pitch: Math.atan2(.25 - WORLD.eyeHeight, 2) } });
  assert.equal(allied.state.players[1].hp, 200); assert.equal(allied.target.hp, 200);
  assert.equal(allied.state.events.findLast(event => event.type === 'shot').damage, 0);
});

test('every loadout applies reduced leg damage through real gun or ballistic contacts', () => {
  for (const id of WEAPON_IDS) {
    const { state, shooter, target } = lane({ weapon: id });
    const pitch = Math.atan2(.25 - WORLD.eyeHeight, 4);
    // The scoped sniper and the LMG retain their real settling/wind-up rules.
    const aim = WEAPONS[id].adsSupported !== false;
    ticks(state, 18, { 0: { aim, pitch } });
    ticks(state, WEAPONS[id].spinupTicks || 1, { 0: { aim, fire: true, pitch } });
    if (WEAPONS[id].projectile) {
      assert.equal(target.hp, 200, `${id} damage must wait for flight`);
      ticks(state, 14, { 0: { aim: true, pitch } });
    }
    const hit = state.events.findLast(event => event.type === (WEAPONS[id].projectile ? 'boltHit' : 'shot') && (event.pellet ?? 0) === 0);
    // Penetrating rounds report their terminal surface and separate actor contacts.
    const actorContact = hit.contacts?.find(contact => contact.targetId === target.id);
    assert.equal(actorContact?.kind ?? hit.hitKind, 'leg', id);
    assert.equal(actorContact?.damage ?? hit.damage, weaponDamage(id, 'leg', 4), id);
    const damage = state.events.filter(event => event.type === 'damage' && event.targetId === target.id);
    assert.ok(damage.length > 0, id);
    for (const event of damage) {
      assert.ok([event.hitX, event.hitY, event.hitZ, event.dx, event.dy, event.dz].every(Number.isFinite), `${id}: confirmed feedback carries its actual contact and direction`);
      assert.ok(Math.abs(Math.hypot(event.dx, event.dy, event.dz) - 1) < 1e-8, id);
      assert.ok(Math.abs(event.hitX - target.x) <= .29 + 1e-8 && Math.abs(event.hitZ - target.z) <= .29 + 1e-8, id);
      assert.ok(event.hitY >= target.y && event.hitY <= target.y + WORLD.standHeight, id);
    }
    // The shotgun's real cone may also catch the lower torso at the near face.
    assert.ok(damage.every(event => (event.hitKind === 'leg' || (WEAPONS[id].pellets && event.hitKind === 'body')) && !event.headshot), id);
    const accepted = damage.reduce((sum, event) => sum + event.damage, 0);
    if (WEAPONS[id].valorant) assert.ok(Math.abs(target.hp - (200 - accepted)) < 1e-9, `${id}: fractional penetration damage accounts for exact HP loss`);
    else assert.equal(target.hp, 200 - accepted, id);
    assert.equal(shooter.shots, 1, `${id}: pellets or flight must not invent extra trigger reports`);
  }
});

test('a scoped sniper preserves leg, torso and head damage against the larger starting health pool', () => {
  for (const [relativeY, expectedHp, kind] of [[.25, 130, 'leg'], [.9, 100, 'body'], [1.62, 50, 'head']]) {
    const { state, target } = lane({ weapon: 'sniper' });
    const pitch = Math.atan2(relativeY - WORLD.eyeHeight, 4);
    ticks(state, 18, { 0: { aim: true, pitch } }); ticks(state, 1, { 0: { aim: true, fire: true, pitch } });
    assert.equal(target.hp, expectedHp, kind); assert.equal(target.alive, expectedHp > 0, kind);
    assert.equal(state.events.findLast(event => event.type === 'damage').hitKind, kind);
  }
});

test('crossbow leg damage is delayed, snapshotted by value, ally blocked and exactly replayable', () => {
  const replay = ({ crouching = false, ally = false } = {}) => {
    const { state, shooter, target } = lane({ crouching, teamSize: ally ? 2 : 1 });
    if (ally) Object.assign(state.players[1], { x: 20, y: 0, z: 0, crouching });
    const catalog = { ...WEAPONS.crossbow }, events = [], hits = [], origin = { x: 20, y: crouching ? .15 : .25, z: 2 };
    const bolt = launchBolt(state, shooter, catalog, origin, direction);
    assert.equal(bolt.legMultiplier, .8); catalog.legMultiplier = .01; catalog.damage = 1; shooter.weapon = 'sniper';
    assert.equal(bolt.legMultiplier, .8); assert.equal(bolt.damage, 75);
    for (let tick = 0; tick < 3; tick++) { state.tick++; advanceBolts(state, { trace: traceShot, arena: MAPS[state.mapId], emit: (type, data) => events.push({ type, ...data }), queueDamage: hit => hits.push(hit) }); }
    assert.equal(hits.length, 0, 'there is no instant leg damage');
    for (let tick = 0; tick < 15; tick++) { state.tick++; advanceBolts(state, { trace: traceShot, arena: MAPS[state.mapId], emit: (type, data) => events.push({ type, ...data }), queueDamage: hit => hits.push(hit) }); }
    assert.equal(hits.length, ally ? 0 : 1); assert.equal(state.bolts.length, 0);
    const impact = events.find(event => event.type === 'boltHit'); assert.equal(impact.hitKind, 'leg'); assert.equal(impact.damage, ally ? 0 : 60);
    if (!ally) { assert.equal(hits[0].hitKind, 'leg'); assert.equal(hits[0].damage, 60); assert.equal(hits[0].targetId, target.id); }
    return JSON.stringify({ events, hits });
  };
  assert.equal(replay(), replay()); replay({ crouching: true }); replay({ ally: true });
});

test('a sword contacting an elevated leg keeps its fixed 100 damage and body feedback', () => {
  const { state, shooter, target } = lane({ targetY: 1.6, distance: 1.4 });
  shooter.inventory[0].weapon = 'sword'; shooter.slot = 'sword'; shooter.meleeWeapon = 'sword'; shooter.pitch = .35;
  ticks(state, 1, { 0: { fire: true } }); ticks(state, 31);
  const contact = state.events.findLast(event => event.type === 'meleeHit'), damage = state.events.findLast(event => event.type === 'damage');
  assert.ok(contact, 'the deliberate upward sword swing must contact the falling opponent');
  const footY = damage.y - WORLD.eyeHeight;
  assert.ok(contact.y >= footY && contact.y < footY + .55, 'the physical contact is inside the elevated leg volume');
  assert.equal(damage.damage, 100); assert.equal(damage.hitKind, 'body'); assert.equal(damage.attack, 'sword');
  assert.equal(target.hp, 100); assert.equal(state.events.filter(event => event.type === 'damage').length, 1);
});

test('stats report exact zones, realistic burst cadence, pellet units, falloff and reload', () => {
  for (const id of WEAPON_IDS) {
    const weapon = WEAPONS[id], stats = weaponStats(id);
    assert.ok(Object.isFrozen(stats));
    assert.deepEqual([stats.body, stats.head, stats.leg], ['body', 'head', 'leg'].map(kind => weaponDamage(id, kind)));
    assert.ok(stats.leg < stats.body && stats.body < stats.head, id);
    assert.equal(stats.reloadSeconds, weapon.reloadTicks / 120);
    assert.equal(stats.effectiveRange, weapon.range);
    assert.ok(stats.shotsPerSecond > 0 && Number.isFinite(stats.shotsPerSecond));
  }
  const burst = weaponStats('burst');
  assert.equal(burst.shotsPerSecond, 3 * 120 / (2 * WEAPONS.burst.burstInterval + WEAPONS.burst.cooldown));
  assert.match(burst.fireRateLabel, /^3-round burst/);
  assert.equal(weaponStats('shotgun').damagePerPellet, true); assert.equal(weaponStats('shotgun').pellets, 8);
  assert.match(weaponStats('shotgun').fireRateLabel, /shells\/s/);
  assert.equal(weaponStats('crossbow').shotsPerSecond, 120 / WEAPONS.crossbow.reloadTicks);
  assert.equal(weaponStats('lmg').windupSeconds, .2);
  assert.equal(weaponStats('smg').falloffStart, 20); assert.equal(weaponStats('smg').falloffEnd, 44.5);
  assert.equal(weaponStats('shotgun').falloffStart, 8); assert.equal(weaponStats('shotgun').falloffEnd, 26);
  assert.equal(weaponStats('__proto__'), null);
});

test('distinct frozen audiovisual profiles leave physical damage and projectile behavior authoritative', () => {
  const effectProfiles = new Set(), soundProfiles = new Set();
  for (const id of WEAPON_IDS) {
    const { effects, sound, legMultiplier } = WEAPONS[id];
    assert.ok(Object.isFrozen(effects) && Object.isFrozen(sound), id);
    assert.ok(legMultiplier >= .7 && legMultiplier <= .85 + 1e-12, id);
    for (const field of ['tracerColor', 'muzzleColor', 'impactColor']) assert.match(effects[field], /^#[0-9a-f]{6}$/i);
    for (const field of ['tracerWidth', 'tracerTicks', 'muzzleTicks', 'muzzleSize', 'muzzleStrength', 'impactStrength', 'kickStrength', 'kickTicks']) assert.ok(Number.isFinite(effects[field]) && effects[field] >= 0, `${id}.${field}`);
    for (const field of ['noiseDuration', 'noiseVolume', 'frequency', 'toneDuration', 'toneVolume', 'lowpass']) assert.ok(Number.isFinite(sound[field]) && sound[field] > 0, `${id}.${field}`);
    effectProfiles.add(JSON.stringify(effects)); soundProfiles.add(JSON.stringify(sound));
  }
  assert.equal(effectProfiles.size, WEAPON_IDS.length); assert.equal(soundProfiles.size, WEAPON_IDS.length);
  assert.equal(WEAPONS.crossbow.effects.muzzleStrength, 0); assert.equal(WEAPONS.crossbow.effects.tracerTicks, 0);
  assert.ok(WEAPONS.sniper.effects.kickStrength > WEAPONS.smg.effects.kickStrength);
  for (const id of ['smg', 'shotgun']) for (const distance of [0, 8, 20, 36, 70]) {
    assert.equal(weaponDamage(id, 'leg', distance), Math.round(WEAPONS[id].damage * WEAPONS[id].legMultiplier * Math.max(WEAPONS[id].falloff.minimum, 1 - Math.max(0, distance - WEAPONS[id].falloff.start) / WEAPONS[id].falloff.span)));
  }
});
