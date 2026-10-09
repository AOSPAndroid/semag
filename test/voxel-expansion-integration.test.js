import assert from 'node:assert/strict';
import test from 'node:test';
import * as Combat from '../public/voxel-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import * as Inventory from '../public/voxel-inventory.js';
import { createFpsInputQueue } from '../public/voxel-input-queue.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { createServer } from '../server.js';
import { Peer, flushPeer } from './ws-helper.js';

const arena = Object.freeze({ id: 'inventory-independent-lane', bounds: Object.freeze({ minX: -30, maxX: 30, minZ: -30, maxZ: 30 }), colliders: Object.freeze([]) });
function lane(weapon = 'sniper') {
  const shooter = Object.assign(Combat.createCombatPlayer(0, 1, weapon), { x: 0, z: 5 });
  const target = Object.assign(Combat.createCombatPlayer(1), { x: 20, z: -20 });
  const players = [shooter, target];
  return { gameId: 'voxel-breach', phase: 'fight', map: arena, mapId: 'courtyard', players, fighters: players, tick: 0, events: [], eventId: 0, loot: [], lootId: 0, grenades: [], grenadeId: 0, bolts: [], boltId: 0 };
}
function tick(state, buttons = {}, count = 1) {
  for (let i = 0; i < count; i++) {
    state.tick++;
    Combat.combatStep(state, [{ ...Combat.emptyInput(state.players[0]), ...buttons }, Combat.emptyInput(state.players[1])], arena);
  }
}
function fourGuns(player, ids = ['revolver', 'sniper', 'pdw', 'battlerifle']) {
  for (let index = 0; index < 4; index++) Inventory.dropInventoryItem(player, index);
  for (const weapon of ids) assert.equal(Inventory.pickupInventoryItem(player, { kind: 'weapon', weapon }).ok, true);
  return player;
}
function carriedUtilities(state, player) {
  for (const kind of ['heal', 'grenade']) {
    const loot = Combat.addInventoryLoot(state, player, { kind, amount: 1 });
    assert.ok(loot);
    assert.equal(Combat.pickupCombatLoot(state, player, loot), true);
  }
  assert.equal(player.potions, 1); assert.equal(player.grenades, 1);
}

test('FPS defaults have knife first, chosen gun second and four independent snapshot slots', () => {
  for (const weapon of ['revolver', 'pdw', 'autoshotgun', 'battlerifle']) {
    const state = lane(weapon), player = state.players[0];
    assert.deepEqual(player.inventory.map(item => item?.kind || null), ['melee', 'weapon', null, null]);
    assert.equal(player.inventory[0].weapon, 'knife'); assert.equal(player.inventory[1].weapon, weapon);
    assert.equal(player.potions, 0); assert.equal(player.grenades, 0);
    const frozen = JSON.stringify(player.inventory), clone = Combat.cloneState(state);
    clone.players[0].inventory[1].ammo = 0; clone.players[0].inventory[2] = { kind: 'heal', amount: 2 };
    assert.equal(JSON.stringify(player.inventory), frozen, 'a copied nested inventory changed authority');
    assert.equal(clone.fighters, clone.players);
    const presented = Combat.cloneState(player);
    Combat.predictLocalMovement(presented, { up: true }, arena, 24);
    assert.equal(JSON.stringify(player.inventory), frozen, 'movement presentation wrote into authority');
    assert.equal(JSON.stringify(presented.inventory), frozen, 'movement prediction changed inventory');
  }
  const royale = Royale.createState({ seed: 18, capacity: 2 }); Royale.startMatch(royale, [0, 1]);
  assert.deepEqual(royale.players[0].inventory.map(item => item?.kind || null), ['melee', null, null, null]);
  assert.equal(royale.players[0].inventoryIndex, 0);
});

test('all four slots can carry different guns, and switching never manufactures ammunition or erases cooldown', () => {
  const state = lane(), player = fourGuns(state.players[0]);
  assert.ok(player.inventory.every(item => item.kind === 'weapon'));
  tick(state, { slot2: true }); tick(state);
  assert.equal(player.weapon, 'sniper');
  const before = player.ammo;
  tick(state, { fire: true });
  assert.equal(player.shots, 1); assert.equal(player.ammo, before - 1);
  const shotTick = state.tick;
  tick(state, { slot3: true, fire: true });
  assert.equal(player.weapon, 'pdw'); assert.equal(player.shots, 1, 'held fire leaked through a gun switch');
  tick(state, { fire: true }, 8);
  assert.equal(player.shots, 1, 'switch fence did not wait for a genuine release');
  tick(state, { slot2: true }); tick(state);
  assert.equal(player.ammo, before - 1);
  tick(state, { fire: true });
  assert.equal(player.shots, 1, 'same sniper bypassed its bolt cycle by switching away and back');
  tick(state, {}, WEAPONS.sniper.cooldown - (state.tick - shotTick));
  tick(state, { fire: true });
  assert.equal(player.shots, 2); assert.equal(player.ammo, before - 2);
});

test('reload cancellation and an actual drop/pickup preserve spent ammo and the same gun cadence', () => {
  const state = lane(), player = state.players[0];
  tick(state, { fire: true }); const spentAmmo = player.ammo;
  tick(state, { reload: true }); assert.ok(player.reloadTicks > 0);
  tick(state, { slot1: true }); assert.equal(player.reloadTicks, 0);
  tick(state); tick(state, { slot2: true });
  assert.equal(player.ammo, spentAmmo); assert.equal(player.inventory[1].reloadTicks, 0);
  const cooldown = player.shotCooldown;
  tick(state, { drop: true, fire: true });
  assert.equal(player.slot, 'empty'); assert.equal(player.shots, 1);
  assert.equal(state.loot.length, 1); assert.equal(state.loot[0].weapon, 'sniper');
  assert.equal(state.loot[0].ammo, spentAmmo);
  assert.ok(state.loot[0].item.shotCooldown <= cooldown && state.loot[0].item.shotCooldown >= cooldown - 1);
  assert.equal(Combat.pickupCombatLoot(state, player, state.loot[0], { fire: true }), true);
  assert.equal(player.ammo, spentAmmo); assert.ok(player.shotCooldown > 0);
  tick(state, { fire: true }, 10);
  assert.equal(player.shots, 1, 'held fire restarted while picking up the same gun');
});

test('stack limits apply per flexible slot and partial pickups leave the real remainder on the floor', () => {
  const state = lane('revolver'), player = state.players[0];
  carriedUtilities(state, player);
  // All four slots are occupied. Only one potion can join the existing stack.
  const supply = { id: 1, kind: 'heal', amount: 4, x: player.x, y: player.y, z: player.z };
  state.loot = [supply];
  assert.equal(Combat.pickupCombatLoot(state, player, supply), true);
  assert.equal(player.inventory[2].amount, 2); assert.equal(player.potions, 2);
  assert.equal(supply.amount, 3); assert.equal(state.loot.length, 1);
  assert.equal(Combat.pickupCombatLoot(state, player, supply), false);
  assert.equal(supply.amount, 3, 'a full stack destroyed the dropped remainder');
  Inventory.dropInventoryItem(player, 0);
  assert.equal(Combat.pickupCombatLoot(state, player, supply), true);
  assert.deepEqual(player.inventory.filter(item => item?.kind === 'heal').map(item => item.amount), [2, 2]);
  assert.equal(player.potions, 4); assert.equal(supply.amount, 1);
  player.hp = 40;
  tick(state, { slot3: true }); tick(state);
  tick(state, { fire: true });
  assert.equal(player.potions, 3); assert.equal(player.shots, 0, 'selected potion fired a hidden gun');
  assert.equal(player.healTicks, Combat.HEAL.ticks);
  tick(state, {}, Combat.HEAL.ticks);
  assert.equal(player.hp, 100); assert.equal(player.potions, 3);
  assert.ok(player.inventory.every(item => !item || !['heal', 'grenade'].includes(item.kind) || item.amount <= 2));
});

test('four carried guns die into four drops once, with each gun actual ammunition intact', () => {
  const state = lane(), player = fourGuns(state.players[0]);
  for (let index = 0; index < 4; index++) {
    tick(state, { [`slot${index + 1}`]: true }); tick(state);
    tick(state, { fire: true }); tick(state);
  }
  const before = Combat.cloneState(player.inventory);
  Combat.applyCombatDamage(state, [{ playerId: 1, targetId: 0, damage: 999, attack: 'gun' }]);
  assert.equal(player.alive, false); assert.equal(state.loot.length, 4);
  assert.ok(player.inventory.every(item => item === null));
  for (const item of before) {
    const drop = state.loot.find(loot => loot.weapon === item.weapon);
    assert.ok(drop); assert.equal(drop.ammo, item.ammo); assert.equal(drop.reserve, item.reserve);
  }
  tick(state, {}, 50); assert.equal(state.loot.length, 4);
  assert.equal(state.events.filter(event => event.type === 'kill' && event.targetId === 0).length, 1);
});

test('coalesced inventory selection and drop target the requested slot and fence an already-held trigger', () => {
  const state = lane('revolver'), player = state.players[0], queue = createFpsInputQueue();
  carriedUtilities(state, player);
  const neutral = Combat.emptyInput(player);
  queue.observe({ ...neutral, fire: true }, 0); tick(state, queue.sample(undefined, 1).buttons);
  assert.equal(player.shots, 1);
  queue.observe({ ...neutral, fire: true, slot4: true, drop: true }, 3);
  queue.observe({ ...neutral, fire: true }, 4);
  for (let i = 0; i < 5; i++) tick(state, queue.sample(undefined, 5 + i).buttons);
  assert.equal(player.inventory[3], null);
  assert.equal(player.inventory[1].weapon, 'revolver'); assert.equal(player.inventory[2].kind, 'heal');
  assert.equal(state.loot[0].kind, 'grenade'); assert.equal(player.shots, 1);
});

test('new arena IDs are validated across all actual FPS room adapters without accepting inventory authority', async t => {
  const app = createServer({ autoTick: false, creationLimit: 100 });
  await app.listen(0, '127.0.0.1');
  const url = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await app.close(); });
  for (const gameId of ['voxel-breach', 'voxel-royale', 'voxel-horde']) for (const mapId of ['snow', 'sewers', 'trading']) {
    const response = await fetch(url + '/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gameId, mapId }) });
    assert.equal(response.status, 201, `${gameId}/${mapId}`);
    const { room } = await response.json(); assert.equal(room.mapId, mapId);
    const peer = new Peer(url.replace('http:', 'ws:') + '/ws?room=' + room.id); peers.push(peer);
    const welcome = await peer.connect(); assert.equal(welcome.playerId, 0);
    const actual = app.rooms.get(room.id);
    for (const buttons of [{ slot1: 1 }, { drop: 'yes' }, { inventoryIndex: 3 }, { inventory: [] }, { weapon: 'sniper' }, { slot: 4 }]) {
      const after = peer.messages.length; peer.send({ type: 'input', seq: 0, buttons });
      await peer.waitFor(message => message.type === 'error', { after });
      assert.equal(actual.slots[0].lastAccepted, -1);
    }
    peer.send({ type: 'input', seq: 0, playerId: 1, buttons: { slot4: true, drop: true } });
    await flushPeer(peer);
    assert.equal(actual.slots[0].lastAccepted, 0); assert.equal(actual.acks[1], -1);
    assert.deepEqual(actual.slots[0].actionInputs.inspect().pending.map(edge => edge.action), ['slot4', 'drop']);
  }
});

function armedKill(seed) {
  const state = Horde.createState({ seed }); Horde.startMatch(state, [0]);
  while (state.phase !== 'fight') Horde.step(state);
  state.map = arena; state.horde.wave = 6; state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
  state.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: 'gunner' }];
  Object.assign(state.players[0], { x: 0, z: 4, yaw: 0, grounded: true });
  Horde.step(state);
  const monster = state.players.find(body => body.monster && body.alive);
  assert.ok(monster); assert.equal(monster.potions, 0); assert.equal(monster.grenades, 0);
  assert.deepEqual(monster.inventory.map(item => item?.kind || null), ['weapon', null, null, null]);
  monster.emergenceTicks = 0;
  for (let i = 0; i < 600 && !monster.shots; i++) Horde.step(state);
  assert.ok(monster.shots > 0, 'armed corpse fixture never spent a real round');
  assert.ok(monster.ammo < WEAPONS[monster.weapon].magazine);
  monster.emergenceTicks = 10000;
  for (let tickIndex = 0; tickIndex < 200 && monster.alive; tickIndex++) {
    const human = state.players[0], dx = monster.x - human.x, dz = monster.z - human.z;
    Horde.step(state, [{ fire: true, aim: true, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(monster.y + 1.62 - human.y - Combat.eyeHeight(human), Math.hypot(dx, dz)) - human.recoil }]);
  }
  assert.equal(monster.alive, false);
  Horde.step(state); // Permit the real floor drop to settle before comparing persistence.
  const before = JSON.stringify(state.loot);
  for (let i = 0; i < 20; i++) Horde.step(state);
  assert.equal(JSON.stringify(state.loot), before, 'dead gunner emitted another drop');
  return { state, monster, weaponDrop: state.loot.find(loot => loot.kind === 'weapon') };
}

test('actual armed monster deaths deterministically drop a real carried gun sometimes, never every time', () => {
  let dropped = 0, withheld = 0;
  for (let index = 1; index <= 24; index++) {
    const seed = Math.imul(index, 0x9e3779b9) >>> 0;
    const first = armedKill(seed), replay = armedKill(seed);
    assert.deepEqual(first.state.loot, replay.state.loot, `seed ${seed} drop replay`);
    if (first.weaponDrop) {
      dropped++;
      assert.equal(first.weaponDrop.weapon, first.monster.weapon);
      assert.equal(first.weaponDrop.ammo, first.monster.ammo);
      assert.ok(first.weaponDrop.reserve >= 0);
    } else withheld++;
  }
  assert.ok(dropped > 0 && withheld > 0, { dropped, withheld });
});
