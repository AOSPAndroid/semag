import assert from 'node:assert/strict';
import test from 'node:test';
import * as L from '../public/lockdown-engine.js';
import { isBlocked } from '../public/lockdown-maps.js';

const { WEAPONS, STATUS, MAPS, RULES, TILE } = L;

function duel({ mapId = 'temple', a = {}, b = {}, gap = 60, third = null } = {}) {
  const state = L.createState({ mapId, seed: 11 });
  L.setConnected(state, 0, true, 'Ada'); L.setConnected(state, 4, true, 'Bo');
  L.startMatch(state, [0, 4]);
  state.phase = 'fight'; state.phaseTicks = 0;
  const point = MAPS[mapId].points[1];
  for (const player of state.players) if (player.id !== 0 && player.id !== 4) Object.assign(player, { bot: false, human: false, alive: false, respawnTicks: 1e9 });
  const me = state.players[0], foe = state.players[4];
  Object.assign(me, { x: point.x - gap / 2, y: point.y, aim: 0, shieldTicks: 0, slot: 0 }, a);
  Object.assign(foe, { x: point.x + gap / 2, y: point.y, aim: Math.PI, shieldTicks: 0, hp: 400, maxHp: 400 }, b);
  if (third) Object.assign(state.players[5], { alive: true, x: foe.x + 50, y: foe.y + 30, hp: 400, maxHp: 400, shieldTicks: 0, ...third });
  for (const player of state.players) player.clips = Object.fromEntries(player.weapons.filter(id => WEAPONS[id]?.family === 'gun').map(id => [id, WEAPONS[id].clip]));
  state.events = [];
  return { state, me, foe };
}
function run(state, ticks, controls = () => ({})) {
  for (let t = 0; t < ticks; t++) {
    const c = controls(t), inputs = [];
    for (const id of [0, 4]) inputs[id] = { ...L.emptyInput(state.players[id].aim), ...(c[id] || {}) };
    L.step(state, inputs);
  }
}
const events = (state, type) => state.events.filter(event => event.type === type);

test('chill stacks slow a knight and the third chilling hit freezes them solid', () => {
  const { state, me, foe } = duel({ a: { weapons: ['frostgun', 'brand', 'blast'] }, gap: 160 });
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.status.chill > 0, true); assert.equal(foe.chillStacks, 1);
  // A chilled knight walks slower than a fresh one.
  const fresh = duel({ gap: 160 });
  const walk = s => { const p = s.players[4], x = p.x; run(s, 20, () => ({ 4: { up: true } })); return Math.abs(p.y - 600) + Math.abs(p.x - x); };
  const chilled = duel({ gap: 160 }); chilled.foe.status.chill = 200; chilled.foe.chillStacks = 2;
  assert.ok(walk(chilled.state) < walk(fresh.state) * .8, 'two chill stacks slow you down');
  me.fireCooldown = 0;
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.chillStacks, 2);
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  assert.ok(foe.status.freeze > 0, 'third chill freezes'); assert.equal(foe.chillStacks, 0); assert.equal(foe.status.chill, 0);
  // The next hit shatters the freeze and leaves a short immunity, so chill cannot chain-freeze.
  me.clips.frostgun = WEAPONS.frostgun.clip;
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  assert.equal(foe.status.freeze, 0); assert.ok(foe.freezeImmune > 0);
});

test('Frostbite Edge freezes with its third cut', () => {
  const { state, foe } = duel({ a: { weapons: ['frostbite', 'blaster', 'blast'] } });
  let frozen = false;
  run(state, 160, t => { if (foe.status.freeze > 0) frozen = true; return { 0: { attack: t % 12 === 0 } }; });
  assert.ok(frozen, 'a three-cut combo freezes');
});

test('curse locks dash and class ability, including the Guardian shield', () => {
  const { state, foe } = duel({ b: { cls: 'striker' } });
  foe.status.curse = 200; foe.dashCooldown = 0; foe.abilityCooldown = 0;
  run(state, 2, t => ({ 4: { dash: t === 0, left: true } }));
  assert.equal(foe.dodgeTicks, 0); assert.ok(events(state, 'cursed').length > 0);
  run(state, 2, t => ({ 4: { ability: t === 0 } }));
  assert.equal(foe.dashTicks, 0, 'no Boost');
  const guard = duel({ b: { cls: 'guardian' } }); guard.foe.status.curse = 200;
  run(guard.state, 10, () => ({ 4: { ability: true } }));
  assert.equal(guard.foe.guarding, false);
  // Hexblade cuts can curse; its charged slam always does.
  const hex = duel({ a: { weapons: ['hexblade', 'blaster', 'blast'] } });
  hex.me.charging = true; hex.me.chargeTicks = L.chargeTicksFor(hex.me, WEAPONS.hexblade); hex.me.previousInput = { ...L.emptyInput(0), attack: true };
  run(hex.state, 80);
  assert.ok(hex.foe.status.curse > 0);
});

test('Sanguine Sickle heals the wielder for part of the damage dealt', () => {
  const { state, me, foe } = duel({ a: { weapons: ['sickle', 'blaster', 'blast'], hp: 40 } });
  const before = me.hp;
  run(state, 30, t => ({ 0: { attack: t === 0 } }));
  const dealt = 400 - foe.hp;
  assert.ok(dealt > 0);
  assert.ok(Math.abs(me.hp - before - dealt * WEAPONS.sickle.lifesteal) < 1e-6, `healed ${me.hp - before} of ${dealt}`);
  assert.ok(events(state, 'drain').length > 0);
});

test('Voltedge arcs lightning to another enemy near the one it hits', () => {
  const { state, foe } = duel({ a: { weapons: ['voltedge', 'blaster', 'blast'] }, third: {} });
  const bystander = state.players[5];
  let chained = false;
  for (let i = 0; i < 40 && !chained; i++) { run(state, 20, t => ({ 0: { attack: t === 0 } })); chained = state.events.some(event => event.type === 'chain' && event.targetId === 5); }
  assert.ok(chained, 'lightning jumped');
  assert.ok(bystander.hp < 400, 'the bystander was never swung at but still took damage');
  assert.ok(foe.hp < 400);
});

test('elemental guns carry their status on rounds and charges', () => {
  // Ember Caster charge burns everything it passes through.
  const fire = duel({ a: { weapons: ['embercaster', 'brand', 'blast'] }, gap: 140 });
  fire.me.charging = true; fire.me.chargeTicks = L.chargeTicksFor(fire.me, WEAPONS.embercaster); fire.me.previousInput = { ...L.emptyInput(0), attack: true };
  run(fire.state, 80);
  assert.ok(fire.foe.status.burn > 0 || events(fire.state, 'damage').some(event => event.kind === 'burn'));
  // Grim Hand-cannon's explosive charge curses.
  const grim = duel({ a: { weapons: ['grimcannon', 'brand', 'blast'] }, gap: 160 });
  grim.me.charging = true; grim.me.chargeTicks = L.chargeTicksFor(grim.me, WEAPONS.grimcannon); grim.me.previousInput = { ...L.emptyInput(0), attack: true };
  run(grim.state, 60);
  assert.ok(grim.foe.status.curse > 0);
  // Every elemental weapon names a status the engine knows.
  for (const weapon of Object.values(WEAPONS)) {
    for (const status of [weapon.status, weapon.onHit?.status, weapon.charge?.status, weapon.cloud?.status, weapon.chain?.status]) if (status) assert.ok(STATUS[status], `${weapon.id}: ${status}`);
  }
});

test('bots carry a blade, a gun and a bomb from the whole armoury, and never pit-walking shoes', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const state = L.createState({ seed }); L.startMatch(state, []);
    for (const bot of state.players) {
      assert.deepEqual(bot.weapons.map(id => WEAPONS[id]?.family ?? null), ['blade', 'gun', 'bomb', null]);
      bot.weapons.filter(Boolean).forEach(id => seen.add(id));
      assert.equal(L.combineGear(bot).walk.length, 0);
    }
  }
  assert.ok(['frostbite', 'blazebrand', 'voltedge', 'sickle', 'hexblade', 'frostgun', 'embercaster', 'voltneedle', 'viper', 'grimcannon'].some(id => seen.has(id)));
});

test('shoes cross the pits they are made for: water, lava, or everything', () => {
  const crosses = (mapId, shoes) => {
    const state = L.createState({ mapId, seed: 1 }); L.setConnected(state, 0, true); L.setPlayerSetup(state, 0, { shoes }); L.startMatch(state, [0]); state.phase = 'fight';
    for (const player of state.players) if (player.id) Object.assign(player, { alive: false, bot: false, respawnTicks: 1e9 });
    const map = MAPS[mapId]; let pit = null;
    for (let row = 0; row < map.rows && !pit; row++) for (let col = 2; col < map.cols; col++) if (map.grid[row][col] === '~' && map.grid[row][col - 1] === '.' && map.grid[row][col - 2] === '.' && map.levels[row][col - 1] === '0' && map.levels[row][col - 2] === '0') { pit = [col, row]; break; }
    const player = state.players[0]; Object.assign(player, { x: (pit[0] - 1.5) * TILE, y: (pit[1] + .5) * TILE });
    for (let t = 0; t < 60; t++) L.step(state, { 0: { ...L.emptyInput(0), right: true } });
    return player.x > pit[0] * TILE;
  };
  assert.equal(MAPS.keep.pit, 'water'); assert.equal(MAPS.foundry.pit, 'lava'); assert.equal(MAPS.skyway.pit, 'chasm');
  assert.equal(crosses('keep', 'none'), false); assert.equal(crosses('keep', 'striders'), true); assert.equal(crosses('foundry', 'striders'), false);
  assert.equal(crosses('foundry', 'magma'), true); assert.equal(crosses('skyway', 'magma'), false);
  for (const mapId of ['keep', 'foundry', 'skyway', 'temple']) assert.equal(crosses(mapId, 'hover'), true, mapId);
  assert.ok(L.combineGear({ shoes: 'quicksilver' }).speedMultiplier > L.combineGear({ shoes: 'sneakers' }).speedMultiplier);
});

test('capture zones are open circles big enough for six knights', () => {
  assert.ok(RULES.pointRadius >= 128);
  for (const map of Object.values(MAPS)) for (const point of map.points) {
    for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
      if (!isBlocked(map, col, row)) continue;
      const nx = Math.max(col * TILE, Math.min(point.x, (col + 1) * TILE)), ny = Math.max(row * TILE, Math.min(point.y, (row + 1) * TILE));
      assert.ok(Math.hypot(nx - point.x, ny - point.y) >= RULES.pointRadius, `${map.id} ${point.id}: tile ${col},${row} inside the zone`);
    }
  }
  // Six knights standing shoulder to shoulder all count for the point.
  const state = L.createState({ mapId: 'keep', seed: 2 }); L.startMatch(state, []); state.phase = 'fight';
  const point = MAPS.keep.points[1], team = state.players.filter(player => player.team === 0);
  const ring = [...team, ...state.players.filter(player => player.team === 1).slice(0, 2)];
  ring.forEach((player, i) => Object.assign(player, { x: point.x + Math.cos(i / ring.length * Math.PI * 2) * 80, y: point.y + Math.sin(i / ring.length * Math.PI * 2) * 80 }));
  for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) assert.ok(Math.hypot(ring[i].x - ring[j].x, ring[i].y - ring[j].y) >= RULES.radius * 2);
  assert.equal(ring.filter(player => Math.hypot(player.x - point.x, player.y - point.y) <= RULES.pointRadius).length, 6);
});

test('weapon traits: heavy swings are unflinching, the rapier tip hits harder, long shots and the maul shockwave', () => {
  // Heavy: hit mid-swing, the Maul keeps swinging (no stun) where a Knight Brand is stunned.
  for (const [weapon, unflinching] of [['maul', true], ['brand', false]]) {
    const { state, me, foe } = duel({ a: { weapons: [weapon, 'blaster', 'blast', null], hp: 400, maxHp: 400 }, b: { weapons: ['blaster', 'brand', 'blast', null] }, gap: 160 });
    run(state, 3, t => ({ 0: { attack: t === 0 } }));
    assert.equal(me.action, 'swing');
    run(state, 24, t => ({ 4: { attack: t === 0, aim: Math.PI } }));
    assert.ok(me.hp < 400, `${weapon} took the round`);
    assert.equal(me.stunTicks === 0, unflinching, weapon);
  }
  // Rapier sweet spot: the same thrust at the tip of its reach deals 40% more.
  const thrust = gap => { const { state, foe } = duel({ a: { cls: 'recon', weapons: ['rapier', 'blaster', 'blast', null] }, gap }); run(state, 20, t => ({ 0: { attack: t === 0 } })); return { dealt: 400 - foe.hp, tip: state.events.some(e => e.type === 'sweetSpot') }; };
  const close = thrust(40), far = thrust(WEAPONS.rapier.combo[0].reach * .9);
  assert.equal(close.tip, false); assert.equal(far.tip, true);
  assert.equal(far.dealt, Math.round(WEAPONS.rapier.combo[0].damage * WEAPONS.rapier.sweetSpot.bonus));
  // Longshot Rifle: more damage the farther it flies.
  const shoot = gap => { const { state, foe } = duel({ mapId: 'keep', a: { cls: 'guardian', weapons: ['rifle', 'brand', 'blast', null] }, gap }); run(state, 50, t => ({ 0: { attack: t === 0 } })); return 400 - foe.hp; };
  const near = shoot(120), longer = shoot(600);
  assert.equal(near, WEAPONS.rifle.damage); assert.ok(longer > near * 1.3, `${longer} vs ${near}`);
  // Maul: the second blow shakes the ground and hits a second knight beside the target.
  const { state, me, foe } = duel({ a: { cls: 'guardian', weapons: ['maul', 'blaster', 'blast', null] }, gap: 60, third: {} });
  state.players[5].x = foe.x; state.players[5].y = foe.y + 60;
  me.comboStep = 1; run(state, 60, t => ({ 0: { attack: t === 0 } }));
  assert.ok(state.events.some(e => e.type === 'slam' && e.weapon === 'maul'));
  assert.ok(state.players[5].hp < 400, 'the shockwave reached the second knight');
});

test('guns bloom when fired back to back and settle when you pause', () => {
  const { state, me } = duel({ a: { weapons: ['blaster', 'brand', 'blast', null] }, gap: 300 });
  run(state, 40, t => ({ 0: { attack: t % 17 === 0 } }));
  const sprayed = me.bloom;
  assert.ok(sprayed > 0.05, `bloom built up (${sprayed})`);
  run(state, 120);
  assert.ok(me.bloom < sprayed / 2, 'settled after a pause');
  const rifle = duel({ a: { weapons: ['rifle', 'brand', 'blast', null] } });
  run(rifle.state, 2, t => ({ 0: { attack: t === 0 } }));
  assert.ok(rifle.me.bloom >= WEAPONS.rifle.bloom - .01, 'precise guns bloom hardest');
});
