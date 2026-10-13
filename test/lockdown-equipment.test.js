import assert from 'node:assert/strict';
import test from 'node:test';
import * as L from '../public/lockdown-engine.js';
import { ARMORS, ARMOR_IDS, HELMETS, PANTS, SHOES, GEAR, GEAR_SLOTS, GEAR_LIMITS, PERK_IDS, combineGear } from '../public/lockdown-equipment.js';

function duel({ weapon = 'blaster', armor = 'none', gap = 140, cls = 'striker' } = {}) {
  const state = L.createState({ seed: 7 });
  L.setConnected(state, 0, true); L.setConnected(state, 4, true);
  L.setPlayerSetup(state, 0, { cls, weapons: [weapon, ...L.WEAPON_IDS.filter(id => id !== weapon).slice(0, 2)] });
  L.setPlayerSetup(state, 4, { armor });
  L.startMatch(state, [0, 4]); state.phase = 'fight';
  for (const player of state.players) if (player.id !== 0 && player.id !== 4) Object.assign(player, { alive: false, bot: false, respawnTicks: 1e9 });
  const me = state.players[0], foe = state.players[4], point = state.points[1];
  Object.assign(me, { x: point.x - gap / 2, y: point.y, aim: 0, shieldTicks: 0 });
  Object.assign(foe, { x: point.x + gap / 2, y: point.y, aim: Math.PI, shieldTicks: 0, hp: 500, maxHp: 500 });
  state.events = [];
  return { state, me, foe };
}

function run(state, ticks, controls = () => ({})) {
  for (let tick = 0; tick < ticks; tick++) {
    const control = controls(tick), inputs = [];
    for (const id of [0, 4]) inputs[id] = { ...L.emptyInput(state.players[id].aim), ...control[id] };
    for (const id of Object.keys(control)) inputs[id] = { ...L.emptyInput(state.players[id].aim), ...control[id] };
    L.step(state, inputs);
  }
}
function releaseCharge(state, me) {
  me.charging = true; me.chargeTicks = L.chargeTicksFor(me, L.WEAPONS[me.weapons[0]]);
  me.previousInput = { ...L.emptyInput(0), attack: true };
  run(state, 1);
}
const hit = (state, kind) => state.events.find(event => event.type === 'damage' && event.targetId === 4 && event.kind === kind);

test('armor setup is independent, atomic, restricted to base/death, and persists through respawn and rematch', () => {
  const state = L.createState();
  assert.equal(state.players[0].armor, 'none');
  L.setConnected(state, 0, true);
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'recon', armor: 'ballistic' }), { ok: true });
  assert.equal(state.players[0].cls, 'recon');
  assert.equal(state.players[0].armor, 'ballistic');
  const before = structuredClone(state.players[0]);
  assert.equal(L.setPlayerSetup(state, 0, { team: 1, cls: 'guardian', armor: 'heavy', weapons: ['brand', 'brand', 'blast'] }).ok, false);
  assert.deepEqual(state.players[0], before, 'an invalid paired request changes no field');
  for (const armor of ['unknown', '__proto__', null, 1, {}]) {
    assert.equal(L.setPlayerSetup(state, 0, { armor }).ok, false);
    assert.equal(state.players[0].armor, 'ballistic');
  }
  L.startMatch(state, [0]); state.phase = 'fight';
  const me = state.players[0], center = state.points[1];
  Object.assign(me, { x: center.x, y: center.y });
  assert.match(L.setPlayerSetup(state, 0, { armor: 'heavy' }).error, /base/);
  assert.equal(me.armor, 'ballistic');
  Object.assign(me, L.MAPS[state.mapId].spawns[0][0], { hp: 45 });
  assert.deepEqual(L.setPlayerSetup(state, 0, { armor: 'heavy' }), { ok: true });
  assert.equal(me.hp, 45, 'armor does not grant class health or heal');
  assert.equal(me.cls, 'recon');
  assert.equal(state.events.at(-1).armor, 'heavy');
  Object.assign(me, { x: center.x, y: center.y, alive: false, respawnTicks: 1 });
  assert.deepEqual(L.setPlayerSetup(state, 0, { armor: 'scout' }), { ok: true });
  run(state, 1);
  assert.equal(me.alive, true); assert.equal(me.armor, 'scout');
  assert.equal(JSON.parse(JSON.stringify(state)).players[0].armor, 'scout');
  L.resetLobby(state);
  assert.equal(state.players[0].armor, 'scout');
  L.startMatch(state, [0]);
  assert.equal(state.players[0].armor, 'scout');
  assert.ok(state.players.filter(player => player.bot).every(player => ARMOR_IDS.includes(player.armor) && player.armor !== 'none'));
  L.setConnected(state, 1, true);
  assert.equal(state.players[1].armor, 'none', 'a new person does not inherit the bot armor');
});

test('Guardian class health and armor health stack through base changes, respawn and rematch', () => {
  const state = L.createState({ seed: 7 });
  L.setConnected(state, 0, true);
  assert.deepEqual(L.setPlayerSetup(state, 0, { cls: 'guardian', armor: 'juggernaut' }), { ok: true });
  assert.equal(L.CLASSES.guardian.hp, 120);
  assert.equal(ARMORS.juggernaut.maxHp, 30);
  assert.equal(state.players[0].maxHp, 150);
  L.startMatch(state, [0]); state.phase = 'fight';
  const me = state.players[0];
  assert.deepEqual([me.hp, me.maxHp], [150, 150]);
  Object.assign(me, L.MAPS[state.mapId].spawns[0][0], { hp: 75 });
  assert.deepEqual(L.setPlayerSetup(state, 0, { armor: 'heavy' }), { ok: true });
  assert.deepEqual([me.hp, me.maxHp], [60, 120], 'removing bonus health preserves half health');
  assert.deepEqual(L.setPlayerSetup(state, 0, { armor: 'juggernaut' }), { ok: true });
  assert.deepEqual([me.hp, me.maxHp], [75, 150], 'adding bonus health preserves half health');
  Object.assign(me, { alive: false, hp: 0, respawnTicks: 1 });
  run(state, 1);
  assert.deepEqual([me.alive, me.hp, me.maxHp], [true, 150, 150]);
  L.resetLobby(state);
  assert.deepEqual([state.players[0].cls, state.players[0].armor, state.players[0].hp, state.players[0].maxHp], ['guardian', 'juggernaut', 150, 150]);
  L.startMatch(state, [0]);
  assert.deepEqual([state.players[0].hp, state.players[0].maxHp], [150, 150]);
});

test('taking over an equipped bot removes all gear and bonus health while preserving health fraction and life state', () => {
  for (const cls of Object.keys(L.CLASSES)) for (const alive of [true, false]) {
    const state = L.createState();
    L.setPlayerSetup(state, 0, { cls, helmet: 'bucket', armor: 'juggernaut', pants: 'greaves', shoes: 'sneakers' });
    const player = state.players[0];
    assert.equal(player.maxHp, L.CLASSES[cls].hp + 40, 'helmet, body armor and shoes contribute health');
    state.phase = 'fight';
    Object.assign(player, { alive, hp: alive ? player.maxHp * .4 : 0 });
    L.setConnected(state, 0, true);
    assert.deepEqual(GEAR_SLOTS.map(slot => player[slot]), ['none', 'none', 'none', 'none']);
    assert.equal(player.maxHp, L.CLASSES[cls].hp);
    assert.equal(player.hp, alive ? L.CLASSES[cls].hp * .4 : 0);
    assert.equal(player.alive, alive, `${cls}: joining does not revive a dead knight`);
  }
});

test('specialized armor reduces real gun and sword health damage according to the attacking weapon family', () => {
  for (const armor of ['none', 'ballistic', 'duelist', 'heavy']) {
    const gun = duel({ armor });
    run(gun.state, 40, tick => ({ 0: { attack: tick === 0 } }));
    assert.equal(hit(gun.state, 'bullet').amount, Math.round(L.WEAPONS.blaster.damage * (1 - ARMORS[armor].gunResistance)), armor);
    const blade = duel({ weapon: 'brand', armor, gap: 50 });
    run(blade.state, 30, tick => ({ 0: { attack: tick === 0 } }));
    assert.equal(hit(blade.state, 'blade').amount, Math.round(L.WEAPONS.brand.combo[0].damage * L.CLASSES.striker.bladeDamage * (1 - ARMORS[armor].bladeResistance)), armor);
  }
});

test('blade projectiles and bursts, gun explosions and detonations, and bomb shards retain their source family', () => {
  for (const [weapon, gap, kind, amount, family] of [
    ['greatblade', 140, 'wave', L.WEAPONS.greatblade.charge.damage, 'blade'],
    ['thorn', 140, 'thorn', L.WEAPONS.thorn.charge.damage, 'blade'],
    ['brand', 140, 'burst', L.WEAPONS.brand.charge.burst.damage, 'blade'],
    ['cleaver', 140, 'slam', L.WEAPONS.cleaver.charge.damage, 'blade'],
    ['magnus', 140, 'explosion', L.WEAPONS.magnus.charge.damage, 'gun'],
    ['catalyzer', 140, 'detonate', L.WEAPONS.catalyzer.charge.perCharge * 3, 'gun'],
    ['blast', 70, 'bomb', L.WEAPONS.blast.damage, 'bomb'],
    ['shard', 100, 'shard', L.WEAPONS.shard.shards.damage, 'bomb'],
  ]) {
    const { state, me, foe } = duel({ weapon, armor: 'ballistic', gap });
    if (weapon === 'catalyzer') { foe.catalysts = 3; foe.catalystTicks = 1000; }
    releaseCharge(state, me);
    if (state.projectiles.length) assert.ok(state.projectiles.every(shot => shot.damageFamily === family), weapon);
    run(state, 160);
    assert.ok(hit(state, kind), `${weapon} lands a ${kind}`);
    const classPower = family === 'blade' ? L.CLASSES[me.cls].bladeDamage || 1 : 1;
    assert.equal(hit(state, kind).amount, Math.round(amount * classPower * (1 - ARMORS.ballistic[`${family}Resistance`])), weapon);
  }
});

test('Recon bomb bonuses compose with armor, and the first hit out of cloak lands double', () => {
  const { state, me, foe } = duel({ weapon: 'blast', armor: 'ballistic', cls: 'recon', gap: 60 });
  assert.equal(L.chargeTicksFor(me, L.WEAPONS.blast), Math.round(L.WEAPONS.blast.chargeTicks * L.CLASSES.recon.bombCharge));
  run(state, L.chargeTicksFor(me, L.WEAPONS.blast) + 2, () => ({ 0: { attack: true } })); run(state, L.WEAPONS.blast.fuse + 3);
  assert.equal(hit(state, 'bomb').amount, Math.round(L.WEAPONS.blast.damage * L.CLASSES.recon.bombDamage * (1 - ARMORS.ballistic.bombResistance)));
  // Ambush: cloak, then the first hit lands double and marks; the next is normal.
  const ambush = duel({ weapon: 'blaster', cls: 'recon' });
  run(ambush.state, 2, t => ({ 0: { ability: t === 0 } }));
  assert.ok(ambush.me.cloakTicks > 0);
  run(ambush.state, 40, t => ({ 0: { attack: t === 0 } }));
  assert.equal(hit(ambush.state, 'bullet').amount, Math.round(L.WEAPONS.blaster.damage * L.ABILITIES.cloak.ambush));
  assert.ok(ambush.state.events.some(event => event.type === 'ambush')); assert.ok(ambush.foe.markTicks > 0);
  ambush.state.events = []; ambush.me.fireCooldown = 0;
  run(ambush.state, 40, t => ({ 0: { attack: t === 0 } }));
  assert.equal(hit(ambush.state, 'bullet').amount, Math.round(L.WEAPONS.blaster.damage * (1 + L.ABILITIES.cloak.markBonus)), 'marked, no longer an ambush');
  // The ambush window closes a few seconds after the cloak ends.
  const late = duel({ weapon: 'blaster', cls: 'recon' });
  run(late.state, 2, t => ({ 0: { ability: t === 0 } }));
  run(late.state, L.ABILITIES.cloak.ticks + L.ABILITIES.cloak.ambushTicks + 2);
  run(late.state, 40, t => ({ 0: { attack: t === 0 } }));
  assert.equal(hit(late.state, 'bullet').amount, L.WEAPONS.blaster.damage);
});

test('armor protects health after defenses, preserves poison/mark multipliers, and does not reduce status ticks', () => {
  const guarded = duel({ armor: 'heavy' });
  Object.assign(guarded.foe, { domeHp: 0, domeBroken: true }); // dome already broken: the personal shield takes it
  run(guarded.state, L.GUARD.raiseTicks + 1, () => ({ 4: { ability: true } }));
  run(guarded.state, 40, tick => ({ 0: { attack: tick === 0 }, 4: { ability: true } }));
  assert.equal(guarded.foe.hp, 500);
  assert.equal(guarded.foe.guardHp, L.GUARD.max - L.WEAPONS.blaster.damage, 'armor does not protect shield stamina');
  const swordGuard = duel({ weapon: 'brand', armor: 'heavy', gap: 50 });
  Object.assign(swordGuard.foe, { domeHp: 0, domeBroken: true });
  run(swordGuard.state, L.GUARD.raiseTicks + 1, () => ({ 4: { ability: true } }));
  run(swordGuard.state, 40, tick => ({ 0: { attack: tick === 0 }, 4: { ability: true } }));
  assert.equal(swordGuard.foe.hp, 500);
  assert.equal(swordGuard.foe.guardHp, L.GUARD.max - L.WEAPONS.brand.combo[0].damage * L.CLASSES.striker.bladeDamage * L.GUARD.bladeScale, 'armor leaves sword class power and shield wear intact');
  const bubble = duel({ armor: 'heavy', gap: 240 });
  const guardian = bubble.state.players[5];
  Object.assign(guardian, { alive: true, bot: false, cls: 'guardian', armor: 'heavy', x: bubble.foe.x, y: bubble.foe.y + 40, hp: L.CLASSES.guardian.hp, maxHp: L.CLASSES.guardian.hp, shieldTicks: 0 });
  run(bubble.state, L.GUARD.expandTicks + 1, () => ({ 5: { ability: true } }));
  assert.ok(guardian.guarding && guardian.guardRaise >= L.GUARD.expandTicks);
  run(bubble.state, 50, tick => ({ 0: { attack: tick === 0 }, 5: { ability: true } }));
  assert.equal(bubble.foe.hp, 500);
  assert.equal(guardian.domeHp, L.GUARD.domeMax - L.WEAPONS.blaster.damage, 'armor does not protect a dome');
  const marked = duel({ armor: 'ballistic' });
  marked.me.status.poison = L.STATUS.poison.ticks; marked.foe.markTicks = L.ABILITIES.cloak.markTicks;
  run(marked.state, 40, tick => ({ 0: { attack: tick === 0 } }));
  assert.equal(hit(marked.state, 'bullet').amount, Math.round(L.WEAPONS.blaster.damage * L.STATUS.poison.damageScale * (1 + L.ABILITIES.cloak.markBonus) * (1 - ARMORS.ballistic.gunResistance)));
  const burned = duel({ armor: 'heavy' });
  burned.foe.status.burn = L.STATUS.burn.ticks - L.STATUS.burn.every;
  burned.foe.statusOwner.burn = 0;
  run(burned.state, 1);
  assert.equal(hit(burned.state, 'burn').amount, L.STATUS.burn.damage);
});

test('light and heavy armor multiply actual class movement with Boost, charging and guard slowdowns', () => {
  for (const mode of ['walk', 'dash', 'boost', 'charge', 'guard']) {
    const speeds = {};
    for (const armor of ['none', 'scout', 'heavy']) {
      const { state, me, foe } = duel({ cls: mode === 'guard' ? 'guardian' : 'striker' });
      me.armor = armor; foe.alive = false; foe.respawnTicks = 1e9;
      if (mode === 'charge') { me.charging = true; me.previousInput = { ...L.emptyInput(0), attack: true }; }
      // Boost is held; 'dash' holds it the whole way, 'boost' checks the press fires it.
      run(state, 30, () => ({ 0: { right: true, ability: mode === 'guard' || mode === 'boost' || mode === 'dash', attack: mode === 'charge' } }));
      if (mode === 'boost') assert.ok(state.events.some(event => event.type === 'dash'));
      speeds[armor] = me.vx;
    }
    assert.ok(speeds.none > 0, mode);
    assert.ok(Math.abs(speeds.scout / speeds.none - ARMORS.scout.speedMultiplier) < 1e-10, `${mode}: light armor is faster`);
    assert.ok(Math.abs(speeds.heavy / speeds.none - ARMORS.heavy.speedMultiplier) < 1e-10, `${mode}: heavy armor is slower`);
  }
});

test('helmet, armor, pants and shoes stack: resistances and health add, speed and perks multiply', () => {
  assert.ok(Object.keys(HELMETS).length * ARMOR_IDS.length * Object.keys(PANTS).length * Object.keys(SHOES).length >= 5000, 'thousands of builds');
  for (const slot of GEAR_SLOTS) for (const [id, piece] of Object.entries(GEAR[slot])) {
    assert.equal(piece.id, id); assert.ok(piece.name && piece.description, `${slot} ${id} is described`);
    const alone = combineGear({ [slot]: id });
    for (const field of [...PERK_IDS, 'gunResistance', 'bladeResistance', 'bombResistance', 'speedMultiplier']) assert.ok(Math.abs(alone[field] - piece[field]) < 1e-6, `${slot} ${id} ${field} is not clipped on its own`);
  }
  const build = combineGear({ helmet: 'sallet', armor: 'heavy', pants: 'greaves', shoes: 'sabatons' });
  assert.ok(Math.abs(build.gunResistance - (HELMETS.sallet.gunResistance + ARMORS.heavy.gunResistance + PANTS.greaves.gunResistance + SHOES.sabatons.gunResistance)) < 1e-9);
  assert.ok(Math.abs(build.speedMultiplier - Math.max(GEAR_LIMITS.speed[0], HELMETS.sallet.speedMultiplier * ARMORS.heavy.speedMultiplier * PANTS.greaves.speedMultiplier * SHOES.sabatons.speedMultiplier)) < 1e-3);
  assert.equal(build.name, `${HELMETS.sallet.name} + ${ARMORS.heavy.name} + ${PANTS.greaves.name} + ${SHOES.sabatons.name}`);
  assert.equal(combineGear({}).name, 'Unarmored');
  assert.equal(combineGear({ helmet: 'bucket', armor: 'juggernaut' }).maxHp, HELMETS.bucket.maxHp + ARMORS.juggernaut.maxHp);
  // Every one of the thousands of builds stays inside the limits.
  for (const helmet of Object.keys(HELMETS)) for (const armor of ARMOR_IDS) for (const pants of Object.keys(PANTS)) for (const shoes of Object.keys(SHOES)) {
    const gear = combineGear({ helmet, armor, pants, shoes });
    for (const field of ['gunResistance', 'bladeResistance', 'bombResistance']) assert.ok(gear[field] >= GEAR_LIMITS.resistance[0] && gear[field] <= GEAR_LIMITS.resistance[1]);
    assert.ok(gear.speedMultiplier >= GEAR_LIMITS.speed[0] && gear.speedMultiplier <= GEAR_LIMITS.speed[1]);
    for (const field of ['gunDamage', 'bladeDamage', 'bombDamage']) assert.ok(gear[field] >= GEAR_LIMITS.power[0] && gear[field] <= GEAR_LIMITS.power[1]);
  }
});

test('gear slots are validated atomically, change health, and work in a real fight', () => {
  const state = L.createState({ seed: 3 }); L.setConnected(state, 0, true);
  assert.deepEqual(GEAR_SLOTS.map(slot => state.players[0][slot]), ['none', 'none', 'none', 'none']);
  assert.equal(L.setPlayerSetup(state, 0, { armor: 'heavy', shoes: 'rollerskates' }).ok, false);
  assert.equal(state.players[0].armor, 'none', 'a bad piece applies nothing');
  assert.ok(L.setPlayerSetup(state, 0, { helmet: 'bucket', pants: 'kilt', shoes: 'sneakers' }).ok);
  assert.equal(state.players[0].maxHp, L.CLASSES.striker.hp + HELMETS.bucket.maxHp + SHOES.sneakers.maxHp);
  // A gun helmet on a bare body still makes the blaster hit harder.
  const plain = duel(), visor = duel();
  assert.equal(L.setPlayerSetup(visor.state, 0, { helmet: 'visor' }).ok, false, 'no swapping helmets on a control point');
  visor.me.helmet = 'visor';
  for (const { state: s } of [plain, visor]) run(s, 40, t => ({ 0: { attack: t === 0 } }));
  const dealt = ({ foe }) => foe.maxHp - foe.hp;
  assert.equal(dealt(visor), Math.round(L.WEAPONS.blaster.damage * HELMETS.visor.gunDamage));
  assert.ok(dealt(visor) > dealt(plain));
  // Pants and shoes change movement too.
  const fast = L.createState({ seed: 3 }); L.setConnected(fast, 0, true); L.setPlayerSetup(fast, 0, { pants: 'leggings', shoes: 'sneakers' });
  const slow = L.createState({ seed: 3 }); L.setConnected(slow, 0, true); L.setPlayerSetup(slow, 0, { pants: 'greaves', shoes: 'sabatons' });
  const travel = s => { L.startMatch(s, [0]); s.phase = 'fight'; const p = s.players[0], x = p.x; for (let i = 0; i < 30; i++) L.step(s, { 0: { ...L.emptyInput(0), right: true } }); return Math.abs(p.x - x) + Math.abs(p.y - 0); };
  assert.ok(travel(fast) > travel(slow));
});
