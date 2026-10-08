import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../public/voxel-survival-engine.js';
import { createWorld, blockIndex, setWorldBlock } from '../public/voxel-survival-world.js';

const advance = (state, ticks, input = {}) => { for (let i = 0; i < ticks; i++) game.step(state, input); return state; };
function flat(seed = 'test') {
  const state = game.createState({ seed }); state.world.blocks.fill(0);
  for (let z = 0; z < 40; z++) for (let x = 0; x < 40; x++) { setWorldBlock(state.world, x, 0, z, 1); setWorldBlock(state.world, x, 1, z, 3); }
  Object.assign(state.player, { x: 20.5, y: 2, z: 20.5, grounded: true }); return state;
}
function put(state, x, y, z, id) { setWorldBlock(state.world, x, y, z, id); }
function enemy(state, extra = {}) {
  const entity = { id: ++state.enemyId, type: 'crawler', x: 20.5, y: 2, z: 18.5, vx: 0, vy: 0, vz: 0, yaw: 0, hp: 42, maxHp: 42, radius: .32, height: 1.65, grounded: true, attackCooldown: 1, hitFlash: 0, stuckTime: 0, digTime: 0, daylightTime: 0, ...extra };
  state.enemies.push(entity); return entity;
}

test('same seed regenerates the same bounded world, with an accessible clearing and supplies', () => {
  const a = game.createState({ seed: 'same world' }), b = game.createState({ seed: 'same world' }), c = game.createState({ seed: 'another world' });
  assert.deepEqual(a.world.blocks, b.world.blocks); assert.notDeepEqual(a.world.blocks, c.world.blocks);
  assert.equal(a.world.blocks.length, 32000); assert.ok(game.canOccupy(a, a.player.x, a.player.y, a.player.z));
  advance(a, 1); assert.equal(a.target.id, 5); assert.equal(a.target.z, 16); assert.ok(a.target.distance <= 5);
  assert.ok(a.world.blocks.includes(7)); assert.ok(a.world.blocks.includes(8)); assert.ok(a.world.blocks.includes(13));
  assert.equal(a.inventory.filter(Boolean).length, 3); assert.equal(game.inventoryCount(a, 'stone'), 0);
});

test('editing a chunk corner invalidates all neighboring face and ambient-occlusion meshes', () => {
  const world = createWorld('chunks'), before = world.revision;
  assert.ok(setWorldBlock(world, 8, 12, 8, 9)); assert.equal(world.revision, before + 1);
  for (const index of [0, 1, 5, 6]) assert.equal(world.chunkRevisions[index], world.revision);
  assert.equal(world.chunkRevisions[24], 1); assert.equal(setWorldBlock(world, 8, 12, 8, 9), false);
});

test('raycast returns the first exact 3D face, normal, range and contact without seeing through cover', () => {
  const state = flat(); put(state, 20, 3, 17, 5); put(state, 20, 3, 15, 8);
  const ray = game.raycast(state, { x: 20.5, y: 3.62, z: 20.5 }, { x: 0, y: 0, z: -3 });
  assert.deepEqual([ray.x, ray.y, ray.z, ray.id], [20, 3, 17, 5]); assert.deepEqual(ray.normal, { x: 0, y: 0, z: 1 }); assert.equal(ray.distance, 2.5); assert.equal(ray.point.z, 18);
  assert.equal(game.raycast(state, { x: 20.5, y: 3.62, z: 20.5 }, { x: 0, y: 0, z: -1 }, 2.49), null);
  const reverse = game.raycast(state, { x: 20.5, y: 3.62, z: 14 }, { x: 0, y: 0, z: 1 }); assert.equal(reverse.distance, 1); assert.deepEqual(reverse.normal, { x: 0, y: 0, z: -1 });
  assert.equal(game.raycast(state, { x: NaN, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), null);
  assert.equal(game.raycast(state, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), null);
});

test('holding mine is progressive, tool speed matters, and iron requires an upgraded pick', () => {
  const slow = flat(), fast = flat(); put(slow, 20, 3, 17, 4); put(fast, 20, 3, 17, 4);
  fast.inventory[0] = { id: 'stone-pick', count: 1, durability: 200 };
  advance(slow, 100, { mine: true }); advance(fast, 100, { mine: true });
  assert.equal(game.getBlock(slow, 20, 3, 17), 4); assert.equal(game.getBlock(fast, 20, 3, 17), 0); assert.equal(game.inventoryCount(fast, 'stone'), 1);
  assert.ok(slow.mining.progress < slow.mining.total); advance(slow, 90, { mine: true }); assert.equal(game.inventoryCount(slow, 'stone'), 1); assert.equal(slow.inventory[0].durability, 109);
  const iron = flat(); put(iron, 20, 3, 17, 8); advance(iron, 500, { mine: true }); assert.equal(game.getBlock(iron, 20, 3, 17), 8); assert.equal(game.inventoryCount(iron, 'iron-ore'), 0);
  iron.inventory[0] = { id: 'stone-pick', count: 1, durability: 200 }; advance(iron, 170, { mine: true }); assert.equal(game.inventoryCount(iron, 'iron-ore'), 1);
});

test('mining stops on release, changing targets and selecting a different tool', () => {
  const state = flat(); put(state, 20, 3, 17, 5); put(state, 23, 3, 20, 5);
  advance(state, 50, { mine: true }); assert.ok(state.mining.progress > 0);
  advance(state, 1); assert.equal(state.mining, null); assert.equal(game.getBlock(state, 20, 3, 17), 5);
  advance(state, 20, { mine: true }); const progress = state.mining.progress;
  advance(state, 1, { mine: true, yaw: Math.PI / 2 }); assert.ok(state.mining.progress < progress);
  game.selectSlot(state, 1); assert.equal(state.mining, null); assert.equal(game.selectSlot(state, 8), false);
});

test('a full pack cannot partially consume a harvest or mutate the world', () => {
  const state = flat(); put(state, 20, 3, 17, 5); state.inventory = Array.from({ length: 8 }, () => ({ id: 'stone', count: 64 }));
  const inventory = JSON.stringify(state.inventory), revision = state.world.revision;
  advance(state, 600, { mine: true }); assert.equal(JSON.stringify(state.inventory), inventory); assert.equal(state.world.revision, revision); assert.equal(game.getBlock(state, 20, 3, 17), 5);
  assert.equal(state.stats.mined, 0); assert.match(state.message, /Inventory full/);
});

test('crafting is atomic, consumes exact ingredients, and works during a paused inventory menu', () => {
  const state = flat(); state.inventory = [{ id: 'wood', count: 1 }, null, null, null, null, null, null, null];
  game.setPaused(state, true); const time = state.time;
  assert.deepEqual(game.canCraft(state, 'planks'), { ok: true }); assert.deepEqual(game.craft(state, 'planks'), { ok: true });
  assert.equal(game.inventoryCount(state, 'wood'), 0); assert.equal(game.inventoryCount(state, 'plank'), 4); assert.equal(state.time, time);
  assert.ok(game.craft(state, 'workbench').ok); assert.equal(game.inventoryCount(state, 'plank'), 0); assert.equal(game.inventoryCount(state, 'workbench'), 1);
  const before = JSON.stringify(state.inventory); assert.equal(game.craft(state, 'stone-pick').ok, false); assert.equal(JSON.stringify(state.inventory), before);
  assert.equal(game.craft(state, '__proto__').ok, false); state.phase = 'dead'; assert.equal(game.craft(state, 'planks').ok, false);
});

test('crafting an upgraded tool requires a nearby visible station, not one behind a wall', () => {
  const state = flat(); state.inventory = [{ id: 'wood', count: 2 }, { id: 'stone', count: 3 }, null, null, null, null, null, null];
  assert.equal(game.canCraft(state, 'stone-pick').ok, false); put(state, 20, 2, 17, 10); assert.equal(game.canCraft(state, 'stone-pick').ok, true);
  for (let y = 2; y <= 4; y++) for (let x = 19; x <= 21; x++) put(state, x, y, 18, 4);
  assert.equal(game.canCraft(state, 'stone-pick').ok, false);
  for (let y = 2; y <= 4; y++) for (let x = 19; x <= 21; x++) put(state, x, y, 18, 0);
  assert.ok(game.craft(state, 'stone-pick').ok); assert.equal(game.inventoryCount(state, 'wood'), 0); assert.equal(game.inventoryCount(state, 'stone'), 0); assert.equal(state.inventory[0].id, 'stone-pick'); assert.equal(state.inventory[0].durability, 200);
});

test('failed output capacity leaves every crafting ingredient untouched; discard frees any slot', () => {
  const state = flat(); state.inventory = [{ id: 'wood', count: 64 }, ...Array.from({ length: 7 }, () => ({ id: 'stone', count: 64 }))];
  const before = JSON.stringify(state.inventory); assert.equal(game.craft(state, 'planks').ok, false); assert.equal(JSON.stringify(state.inventory), before);
  game.setPaused(state, true); game.selectSlot(state, 1); assert.equal(game.discardSelected(state, 65).ok, false); assert.equal(game.discardSelected(state, 64).ok, true);
  assert.equal(state.inventory[1], null); assert.ok(game.craft(state, 'planks').ok); assert.equal(game.inventoryCount(state, 'wood'), 63); assert.equal(game.inventoryCount(state, 'plank'), 4);
});

test('placement consumes exactly once per press and requires empty attached cells without body overlap', () => {
  const state = flat(); state.inventory[0] = { id: 'plank', count: 4 };
  advance(state, 1, { pitch: -.7 }); const proposal = game.getPlacement(state); assert.equal(proposal.valid, true);
  advance(state, 1, { pitch: -.7, place: true }); assert.equal(game.getBlock(state, proposal.x, proposal.y, proposal.z), 9); assert.equal(state.inventory[0].count, 3);
  advance(state, 100, { pitch: -.7, place: true }); assert.equal(state.stats.built, 1); assert.equal(state.inventory[0].count, 3);
  put(state, 20, 2, 19, 4); state.target = { x: 20, y: 2, z: 19, id: 4, distance: .5, normal: { x: 0, y: 0, z: 1 } };
  assert.equal(game.getPlacement(state).valid, false); assert.match(game.getPlacement(state).reason, /room/);
  state.target = { x: 0, y: 2, z: 0, id: 0, distance: 4, normal: { x: 1, y: 0, z: 0 } }; assert.equal(game.getPlacement(state).valid, false);
  state.target = { x: 20, y: 1, z: 19, id: 3, distance: 6, normal: { x: 0, y: 1, z: 0 } }; assert.equal(game.getPlacement(state).valid, false);
});

test('collision blocks sprinting through walls, supports one-block jumps and stops the head at ceilings', () => {
  const state = flat(); for (let x = 18; x <= 22; x++) for (let y = 2; y <= 5; y++) put(state, x, y, 17, 4);
  advance(state, 240, { forward: 1, sprint: true }); assert.ok(state.player.z >= 18.3 - 1e-5); assert.ok(game.canOccupy(state, state.player.x, state.player.y, state.player.z));
  const jumper = flat(); put(jumper, 20, 2, 18, 4);
  advance(jumper, 35, { forward: 1 }); advance(jumper, 1, { forward: 1, jump: true }); advance(jumper, 50, { forward: 1 }); advance(jumper, 30);
  assert.ok(jumper.player.y >= 2.999); assert.ok(game.canOccupy(jumper, jumper.player.x, jumper.player.y, jumper.player.z));
  const roof = flat(); put(roof, 20, 4, 20, 9); advance(roof, 1, { jump: true }); advance(roof, 10); assert.ok(roof.player.y + roof.player.height <= 4 + 1e-5); advance(roof, 60); assert.ok(roof.player.grounded);
});

test('falling from height hurts once on landing and held jump does not repeatedly bunny-hop', () => {
  const state = flat(); state.player.y = 12; state.player.grounded = false; advance(state, 240);
  assert.ok(state.player.hp < 100); assert.ok(state.player.hp > 0); assert.equal(state.events.filter(event => event.type === 'hurt' && event.cause === 'fall').length, 1); assert.ok(state.player.grounded);
  const jump = flat(); advance(jump, 240, { jump: true }); assert.ok(jump.player.grounded); assert.ok(Math.abs(jump.player.y - 2) < 1e-5);
});

test('food and healing only consume useful charges and holding use eats one item', () => {
  const state = flat(); game.selectSlot(state, 1); assert.equal(game.useSelected(state).ok, false); assert.equal(state.inventory[1].count, 4);
  state.player.hunger = 20; advance(state, 120, { use: true }); assert.equal(state.inventory[1].count, 3); assert.ok(state.player.hunger > 37 && state.player.hunger < 38);
  state.player.hp = 40; game.selectSlot(state, 2); assert.ok(game.useSelected(state).ok); assert.equal(state.player.hp, 70); assert.equal(state.inventory[2], null);
  state.player.hunger = 0; advance(state, 120); assert.ok(state.player.hp <= 68.01); assert.ok(state.player.hp > 67.9);
});

test('melee weapons have distinct damage, finite wear, and solid cover blocks hits', () => {
  const state = flat(), victim = enemy(state); state.inventory[0] = { id: 'sword', count: 1, durability: 180 };
  advance(state, 1, { attack: true }); assert.equal(victim.hp, 7); assert.equal(state.inventory[0].durability, 179); assert.equal(state.player.swingTime, .22);
  const defended = flat(), behind = enemy(defended); defended.inventory[0] = { id: 'sword', count: 1, durability: 180 }; put(defended, 20, 3, 19, 4);
  advance(defended, 1, { attack: true }); assert.equal(behind.hp, 42);
});

test('stationary unprepared players are killed during their first night; nights grow more dangerous', () => {
  const state = game.createState({ seed: 'test' }); advance(state, 120 * 160);
  assert.equal(state.phase, 'dead'); assert.ok(state.elapsed > 80 && state.elapsed < 150); assert.equal(state.player.hp, 0); assert.ok(state.events.some(event => event.type === 'death'));
  const late = flat(); late.time = 180 * 3 + 111; late.elapsed = late.time - 30; late.day = 4; late.night = true; late.spawnTimer = 0;
  advance(late, 120 * 20); assert.ok(late.enemies.length >= 3); assert.ok(late.enemies.some(creature => creature.type !== 'crawler')); assert.ok(late.enemies.every(creature => creature.maxHp >= 48));
});

test('creatures respect walls and can breach a sealed shelter instead of ignoring or camping below it', () => {
  const state = flat(); state.night = true; state.time = 111; state.elapsed = 81;
  for (let x = 19; x <= 21; x++) for (let y = 2; y <= 5; y++) put(state, x, y, 19, 9);
  const raider = enemy(state, { z: 18.5, attackCooldown: 0 }); advance(state, 120);
  assert.equal(state.player.hp, 100); assert.ok(raider.z <= 18.68 + 1e-4); assert.ok(game.canOccupy(state, raider.x, raider.y, raider.z, raider.radius, raider.height));
  advance(state, 120 * 5); assert.ok(state.events.some(event => event.type === 'breached')); assert.ok(state.world.blocks[blockIndex(state.world, 20, 3, 19)] === 0 || state.world.blocks[blockIndex(state.world, 20, 2, 19)] === 0);
});

test('stone shelter lasts longer than planks, later raids dig faster, and changing a block resets breach progress', () => {
  const setup = (id, day = 1) => {
    const state = flat(); state.time = (day - 1) * 180 + 111; state.elapsed = state.time - 30; state.day = day; state.night = true; state.spawnTimer = 10;
    for (let x = 19; x <= 21; x++) for (let y = 2; y <= 5; y++) put(state, x, y, 19, id);
    enemy(state, { z: 18.5 }); return state;
  };
  const firstBreach = state => { const initial = state.time; for (let i = 0; i < 1400; i++) { game.step(state); if (state.events.some(event => event.type === 'breached')) return state.time - initial; } return Infinity; };
  const wood = firstBreach(setup(9)), stone = firstBreach(setup(4)), lateStone = firstBreach(setup(4, 4));
  assert.ok(wood > 5 && wood < 5.5); assert.ok(stone > 8.8 && stone < 9.3); assert.ok(lateStone < stone && lateStone > wood);
  const changing = setup(9); advance(changing, 480); const raider = changing.enemies[0]; assert.ok(raider.digTime > 3.8);
  put(changing, raider.digTarget.x, raider.digTarget.y, raider.digTarget.z, 4); advance(changing, 1); assert.ok(raider.digTime < .02);
});

test('archer projectiles require line of sight and remain valid, bounded save data during flight', () => {
  const state = flat(); state.time = 291; state.elapsed = 261; state.day = 2; state.night = true; state.spawnTimer = 10;
  const archer = enemy(state, { type: 'archer', z: 15.5, attackCooldown: 0, hp: 46, maxHp: 46 });
  for (let x = 19; x <= 21; x++) for (let y = 2; y <= 4; y++) put(state, x, y, 18, 4);
  advance(state, 360); assert.equal(state.events.some(event => event.type === 'shot' && event.enemyId === archer.id), false); assert.equal(state.player.hp, 100);
  for (let x = 19; x <= 21; x++) for (let y = 2; y <= 4; y++) put(state, x, y, 18, 0);
  advance(state, 1); assert.ok(state.projectiles.length); assert.ok(game.restore(game.serialize(state)));
  advance(state, 180); assert.ok(state.player.hp < 100); assert.ok(game.restore(game.serialize(state)));
  state.projectiles = [{ id: ++state.projectileId, x: 39.99, y: 15, z: 20, vx: 16, vy: 0, vz: 0, life: 2, damage: 20 }]; advance(state, 1); assert.equal(state.projectiles.length, 0); assert.ok(game.restore(game.serialize(state)));
});

test('wisps ascend toward elevated players but still respect solid roof cover', () => {
  const state = flat(); state.time = 471; state.elapsed = 441; state.day = 3; state.night = true; state.spawnTimer = 10;
  for (let y = 2; y < 8; y++) put(state, 20, y, 20, 9); state.player.y = 8;
  const wisp = enemy(state, { type: 'wisp', x: 19.5, y: 4, z: 20.5, radius: .28, height: .65, hp: 30, maxHp: 30, attackCooldown: 0 });
  advance(state, 240); assert.ok(wisp.y > 7); assert.ok(state.player.hp < 100); assert.ok(game.canOccupy(state, wisp.x, wisp.y, wisp.z, wisp.radius, wisp.height));
});

test('berry harvests regrow after two days, never inside a player, and survive serialization', () => {
  const state = flat(); put(state, 20, 3, 17, 13); advance(state, 100, { mine: true }); assert.equal(game.inventoryCount(state, 'berries'), 7); assert.equal(state.regrowth.length, 1);
  const saved = game.restore(game.serialize(state)); assert.ok(saved); assert.deepEqual(saved.regrowth, state.regrowth);
  state.regrowth[0].at = state.time; state.tick = 119; put(state, 20, 2, 17, 3); Object.assign(state.player, { x: 20.5, y: 3, z: 17.5 }); advance(state, 1);
  assert.equal(game.getBlock(state, 20, 3, 17), 0); assert.equal(state.regrowth.length, 1);
  Object.assign(state.player, { x: 20.5, y: 2, z: 20.5 }); state.tick = 239; advance(state, 1); assert.equal(game.getBlock(state, 20, 3, 17), 13); assert.equal(state.regrowth.length, 0);
});

test('pause, death and invalid deltas freeze all simulation; batched ticks match one-at-a-time physics', () => {
  const state = flat(), before = game.serialize(state); game.setPaused(state, true); advance(state, 100, { forward: 1, mine: true }); assert.equal(game.serialize(state), before);
  game.setPaused(state, false); const single = flat(), batch = flat(); advance(single, 240, { forward: 1, jump: true }); for (let i = 0; i < 60; i++) game.step(batch, { forward: 1, jump: true }, 1 / 30);
  assert.equal(game.serialize(single), game.serialize(batch)); const prior = game.serialize(batch); for (const dt of [NaN, Infinity, -1, 1, 1 / 144]) game.step(batch, { forward: 1 }, dt); assert.equal(game.serialize(batch), prior);
  state.phase = 'dead'; state.player.hp = 0; const dead = game.serialize(state); advance(state, 100, { jump: true }); game.setPaused(state, false); assert.equal(game.serialize(state), dead);
});

test('save restore is isolated and preserves editable terrain, inventory, combat and deterministic continuation', () => {
  const state = flat(); put(state, 20, 3, 17, 5); advance(state, 150, { mine: true }); put(state, 10, 2, 10, 9); state.player.hunger = 50;
  const clone = game.restore(game.serialize(state)); assert.ok(clone); assert.deepEqual(game.snapshot(clone), game.snapshot(state));
  advance(state, 240, { forward: 1, yaw: .2 }); advance(clone, 240, { forward: 1, yaw: .2 }); assert.deepEqual(game.snapshot(clone), game.snapshot(state));
  clone.world.blocks[100] = 0; assert.notEqual(clone.world.blocks[100], state.world.blocks[100]); clone.inventory[1].count--; assert.notEqual(clone.inventory[1].count, state.inventory[1].count);
});

test('restore rejects corrupt versions, embedded bodies, illegal stacks, duplicate enemies and degenerate arrows', () => {
  const base = game.snapshot(flat());
  const corruptions = [
    data => { data.version = 7; }, data => { data.player.hp = NaN; }, data => { data.player.x = -1; }, data => { data.player.y = 1; },
    data => { data.inventory[1].count = 100; }, data => { data.inventory[0].durability = 10000; }, data => { data.inventory[3] = { id: '__proto__', count: 1 }; },
    data => { data.blocks[0] = 0; }, data => { data.blocks[1601] = 1; }, data => { data.blocks[8000] = 254; }, data => { data.time = Infinity; },
    data => { data.regrowth = [{ x: 0, y: -1, z: 0, at: 100 }]; },
    data => { data.projectileId = 1; data.projectiles = [{ id: 1, x: 20, y: 4, z: 20, vx: 0, vy: 0, vz: 0, life: 1, damage: 10 }]; },
  ];
  for (const corrupt of corruptions) { const data = structuredClone(base); corrupt(data); assert.equal(game.restore(data), null); }
  const state = flat(); enemy(state); const data = game.snapshot(state); data.enemies.push({ ...data.enemies[0] }); assert.equal(game.restore(data), null);
  assert.equal(game.restore('{bad json'), null); assert.equal(game.restore(null), null);
});

test('mining and placement events keep unique sequence ids separately from material block ids', () => {
  const state = flat(); put(state, 20, 3, 17, 5); advance(state, 150, { mine: true }); put(state, 20, 3, 17, 5); advance(state, 150, { mine: true });
  const events = state.events.filter(event => event.type === 'mined'); assert.equal(events.length, 2); assert.notEqual(events[0].id, events[1].id); assert.equal(events[0].blockId, 5); assert.equal(events[1].blockId, 5);
});

test('nested breach targets are isolated in snapshots and restored saves, and their block ids are validated', () => {
  const state = flat(); put(state, 20, 3, 19, 9);
  enemy(state, { z: 18.5, digTime: 1, digTarget: { x: 20, y: 3, z: 19, id: 9 } });
  const data = game.snapshot(state), restored = game.restore(data); assert.ok(restored);
  data.enemies[0].digTarget.x = 10; assert.equal(state.enemies[0].digTarget.x, 20); assert.equal(restored.enemies[0].digTarget.x, 20);
  restored.enemies[0].digTarget.z = 12; assert.equal(state.enemies[0].digTarget.z, 19);
  const invalid = game.snapshot(state); invalid.enemies[0].digTarget.id = '9'; assert.equal(game.restore(invalid), null);
});

function assertSeparated(state) {
  const bodies = [state.player, ...state.enemies].filter(body => body.hp > 0);
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (a.y + a.height <= b.y + 1e-7 || b.y + b.height <= a.y + 1e-7) continue;
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.radius + b.radius - 1e-6, `Living bodies ${i}/${j} intersect`);
  }
}

test('both player and pursuing creature stop at physical contact in either movement direction', () => {
  for (const direction of [-1, 1]) {
    const state = flat(); state.time = 111; state.elapsed = 81; state.night = true; state.spawnTimer = 10;
    const creature = enemy(state, { z: state.player.z - direction * 2 });
    for (let i = 0; i < 240; i++) { game.step(state, { forward: direction, sprint: true }); assertSeparated(state); }
    const gap = Math.hypot(state.player.x - creature.x, state.player.z - creature.z);
    assert.ok(gap >= .62 - 1e-6 && gap < .64); assert.ok(game.canOccupy(state, state.player.x, state.player.y, state.player.z));
  }
});

test('diagonal and grazing body contacts cannot pass through a creature or cut into a nearby wall', () => {
  const diagonal = flat(); diagonal.time = 111; diagonal.elapsed = 81; diagonal.night = true; diagonal.spawnTimer = 10;
  enemy(diagonal, { x: 19, z: 19 }); for (let i = 0; i < 180; i++) { game.step(diagonal, { forward: 1, strafe: -1 }); assertSeparated(diagonal); }
  const grazing = flat(); grazing.player.x = 19; grazing.player.z = 20.5; grazing.player.vx = 150;
  const creature = enemy(grazing, { x: 20, z: 21.1199 });
  game.step(grazing, { strafe: 1 }); assert.ok(grazing.player.x < 20); assertSeparated(grazing);
  put(grazing, 18, 2, 20, 4); put(grazing, 18, 3, 20, 4); creature.vx = -9;
  for (let i = 0; i < 120; i++) { game.step(grazing, { strafe: -1 }); assertSeparated(grazing); assert.ok(game.canOccupy(grazing, grazing.player.x, grazing.player.y, grazing.player.z)); }
});

test('peer collision stops jumping heads and falling bodies while allowing passage under high wisps', () => {
  const head = flat(); const overhead = enemy(head, { x: 20.5, y: 4.2, z: 20.5 });
  for (let i = 0; i < 100; i++) { game.step(head, { jump: i === 0 }); assertSeparated(head); }
  assert.ok(head.player.y + head.player.height <= overhead.y + 1e-6); assert.ok(head.player.grounded);
  const fall = flat(); fall.player.y = 8; fall.player.grounded = false; const below = enemy(fall, { x: 20.5, z: 20.5 });
  for (let i = 0; i < 180; i++) { game.step(fall); assertSeparated(fall); }
  assert.ok(Math.abs(fall.player.y - below.y - below.height) < 1e-5);
  const under = flat(); enemy(under, { type: 'wisp', x: 20.5, y: 10, z: 19, radius: .28, height: .65 });
  for (let i = 0; i < 120; i++) { game.step(under, { forward: 1 }); assertSeparated(under); }
  assert.ok(under.player.z < 18); assert.ok(under.player.hp === 100);
});

test('a swarm maintains player and creature separation without jumping onto each other', () => {
  const state = flat(); state.time = 111; state.elapsed = 81; state.night = true; state.spawnTimer = 10;
  for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; enemy(state, { x: 20.5 + Math.cos(angle) * 3, z: 20.5 + Math.sin(angle) * 3 }); }
  for (let i = 0; i < 600; i++) { game.step(state); assertSeparated(state); }
  assert.ok(state.enemies.every(creature => Math.abs(creature.y - 2) < 1e-5)); assert.ok(state.player.hp < 100);
  assert.ok(game.restore(game.serialize(state)));
});

test('close contact remains within melee reach and knockback cannot shove foes through each other', () => {
  const state = flat(); state.time = 111; state.elapsed = 81; state.night = true; state.spawnTimer = 10;
  const near = enemy(state, { z: 19.88 }), rear = enemy(state, { z: 19.15 }); state.inventory[0] = { id: 'sword', count: 1, durability: 180 };
  advance(state, 1, { attack: true }); assert.equal(near.hp, 7); assert.equal(state.inventory[0].durability, 179);
  for (let i = 0; i < 80; i++) { game.step(state, { attack: true }); assertSeparated(state); }
  assert.ok(state.stats.kills >= 1); assert.ok(near.hp === 0); assert.ok(rear.hp >= 0);
  assert.ok(state.events.some(event => event.type === 'hit')); assert.ok(game.canOccupy(state, state.player.x, state.player.y, state.player.z));
});

test('presentation rejects a sampled camera inside a living foe, but permits safe poses and vertical separation', () => {
  const state = flat(); const creature = enemy(state, { z: 19.88 });
  assert.ok(game.canPlayerOccupy(state, state.player.x, state.player.y, state.player.z));
  assert.equal(game.canPlayerOccupy(state, 20.5, 2, 19.9), false); assert.ok(game.canOccupy(state, 20.5, 2, 19.9));
  assert.ok(game.canPlayerOccupy(state, creature.x, creature.y + creature.height, creature.z));
  creature.hp = 0; assert.ok(game.canPlayerOccupy(state, 20.5, 2, 19.9)); advance(state, 120, { forward: 1 }); assert.ok(state.player.z < 19);
});

test('restore rejects living body interpenetration while accepting body contacts and a nonblocking dead player', () => {
  const state = flat(); const creature = enemy(state, { z: 19.88 }); assert.ok(game.restore(game.serialize(state)));
  const embedded = game.snapshot(state); embedded.enemies[0].z = 20.45; assert.equal(game.restore(embedded), null);
  const overlappingFoes = game.snapshot(state); overlappingFoes.enemyId = 2; overlappingFoes.enemies.push({ ...overlappingFoes.enemies[0], id: 2 }); assert.equal(game.restore(overlappingFoes), null);
  state.phase = 'dead'; state.player.hp = 0; creature.z = 20.45; assert.ok(game.restore(game.serialize(state)));
});

test('twelve crowded pursuers steer around peers instead of forming a harmless locked ring', () => {
  const state = flat(); state.time = 111; state.elapsed = 81; state.night = true; state.spawnTimer = 10;
  for (let i = 0; i < 12; i++) { const angle = i * Math.PI / 6; enemy(state, { x: 20.5 + Math.cos(angle) * 3, z: 20.5 + Math.sin(angle) * 3 }); }
  for (let i = 0; i < 1200; i++) { game.step(state); assertSeparated(state); }
  assert.equal(state.phase, 'dead'); assert.ok(state.events.some(event => event.type === 'hurt'));
  assert.ok(state.enemies.every(creature => Math.abs(creature.y - 2) < 1e-5));
});

test('a wisp contacting the top of a player remains threatening without body interpenetration', () => {
  const state = flat(); state.time = 471; state.elapsed = 441; state.day = 3; state.night = true; state.spawnTimer = 10;
  const wisp = enemy(state, { type: 'wisp', x: 20.5, y: 4, z: 20.5, radius: .28, height: .65, hp: 30, maxHp: 30, attackCooldown: 0 });
  for (let i = 0; i < 180; i++) { game.step(state); assertSeparated(state); }
  assert.ok(state.player.hp < 100); assert.ok(wisp.y >= state.player.y + state.player.height - 1e-6);
});

test('a creature killed by the player cannot attack or obstruct later movement in that tick', () => {
  const state = flat(); state.time = 111; state.elapsed = 81; state.night = true; state.spawnTimer = 10;
  enemy(state, { z: 19.88, hp: 7, attackCooldown: 0 }); state.inventory[0] = { id: 'sword', count: 1, durability: 180 };
  game.step(state, { attack: true }); assert.equal(state.stats.kills, 1); assert.equal(state.player.hp, 100); assert.equal(state.enemies.length, 0);
  advance(state, 120, { forward: 1 }); assert.ok(state.player.z < 19);
});
