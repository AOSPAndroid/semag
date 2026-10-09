import assert from 'node:assert/strict';
import test from 'node:test';
import { createPractice, startPractice, stepPractice, PRACTICE_DIFFICULTIES } from '../public/voxel-practice-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { WORLD, emptyInput } from '../public/voxel-engine.js';
import { navigationPoints, navigationCanOccupy, navigationVisible } from '../public/voxel-navigation.js';

function seedWithGroundGun(weapon) {
  for (let seed = 1; seed <= 64; seed++) {
    const state = Royale.createState({ mapId: 'forest', capacity: 2, seed }); Royale.startMatch(state, [0, 1]);
    if (state.loot.some(item => item.kind === 'weapon' && item.weapon === weapon && item.y === 0)) return seed;
  }
  assert.fail(`No seeded ground cache for ${weapon}`);
}
function pose(player, position) {
  Object.assign(player, { x: position.x, z: position.z, y: position.y || 0, yaw: position.yaw ?? player.yaw, vx: 0, vy: 0, vz: 0, grounded: true, pitch: 0 });
  player.previousInput = emptyInput(player);
}

for (const difficulty of ['regular', 'veteran']) for (const weapon of ['classic', 'bucky']) {
  test(`${difficulty}: a Royale bot physically loots ${weapon} and attacks using its primary fire rather than holding alternate RMB`, () => {
    const state = createPractice({ game: 'voxel-royale', mapId: 'forest', bots: 1, mode: 'combat', difficulty, seed: seedWithGroundGun(weapon) });
    startPractice(state);
    for (let tick = 0; tick < Royale.ROYALE.countdownTicks; tick++) stepPractice(state);
    assert.equal(state.phase, 'fight'); const [human, bot] = state.players;
    assert.equal(bot.hasGun, false); assert.equal(bot.inventory[0].weapon, 'knife');
    const cache = state.loot.find(item => item.kind === 'weapon' && item.weapon === weapon && item.y === 0);
    const expectedAmmo = cache.ammo, expectedReserve = cache.reserve;
    pose(bot, cache);
    const far = state.map.spawnPoints.find(p => Math.hypot(p.x - bot.x, p.z - bot.z) > 35); assert.ok(far);
    pose(human, far); assert.ok(navigationCanOccupy(state.map, bot));
    assert.equal(Royale.findNearbyLoot(state, bot.id)?.id, cache.id);
    // The live bot planner chooses the cache and supplies the fresh E input.
    for (let tick = 0; tick < 120 && !bot.hasGun; tick++) stepPractice(state);
    assert.equal(bot.weapon, weapon); assert.equal(bot.inventory[1].weapon, weapon);
    assert.equal(bot.ammo, expectedAmmo); assert.equal(bot.reserve, expectedReserve);
    assert.ok(state.events.some(e => e.type === 'lootPickup' && e.playerId === bot.id && e.weapon === weapon));
    assert.equal(state.loot.some(item => item.id === cache.id), false);

    const nearby = navigationPoints(state.map).find(p => !p.y && Math.hypot(p.x - bot.x, p.z - bot.z) >= 3
      && Math.hypot(p.x - bot.x, p.z - bot.z) <= 5 && navigationVisible(state.map,
        { x: bot.x, y: bot.y + WORLD.eyeHeight, z: bot.z }, { x: p.x, y: p.y + 1.05, z: p.z }));
    assert.ok(nearby); pose(human, nearby);
    bot.yaw = Math.atan2(human.x - bot.x, -(human.z - bot.z)); bot.previousInput = emptyInput(bot);
    const initialHp = human.hp, firstTick = state.tick;
    for (let tick = 0; tick < 600 && human.hp === initialHp && state.phase === 'fight'; tick++) stepPractice(state);
    const shots = state.events.filter(e => e.type === 'shot' && e.playerId === bot.id);
    assert.ok(bot.shots > 0 && shots.length > 0, `${weapon}: the live AI actually fires`);
    assert.ok(human.hp < initialHp, `${weapon}: real combat contacts damage the opponent`);
    assert.ok(shots.every(e => !e.alternate && e.fireMode !== 'volley' && e.fireMode !== 'airburst'));
    assert.equal(bot.aiming, false); assert.equal(bot.previousInput.aim, false);
    assert.ok(shots[0].tick - firstTick >= PRACTICE_DIFFICULTIES[difficulty].reactionTicks - 1, 'the original reaction delay remains');
    assert.ok(bot.ammo < expectedAmmo && bot.reserve === expectedReserve, 'accepted rounds consume the physically looted magazine');
    assert.ok(navigationCanOccupy(state.map, bot));
    assert.equal(WEAPONS[weapon].adsSupported, false);
  });
}
