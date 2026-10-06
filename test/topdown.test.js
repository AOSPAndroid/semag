import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARENA, INPUT_KEYS, MOVES, TICK_RATE, cloneState, createState, emptyInput,
  resetLobby, startMatch, step, chooseBoon, BOONS, BIOMES,
} from '../public/topdown-engine.js';

const input = values => ({ ...emptyInput(), ...values });
const idle = [emptyInput(), emptyInput()];
const guard = [emptyInput(), input({ block: true })];

function advance(state, ticks, inputs = idle) {
  for (let tick = 0; tick < ticks; tick++) step(state, inputs);
  return state;
}

function fight(mode = 'duel', distance = 60) {
  const state = createState(mode);
  startMatch(state);
  advance(state, 3 * TICK_RATE);
  Object.assign(state.fighters[0], { x: 430, y: 320, facing: 0 });
  Object.assign(state.fighters[1], { x: 430 + distance, y: 320, facing: Math.PI });
  return state;
}

function quietCoop() {
  const state = fight('coop');
  state.enemies = state.enemies.slice(0, 1);
  Object.assign(state.enemies[0], { x: 850, y: 100, vx: 0, vy: 0, stun: 100000, action: 'hit' });
  return state;
}

function arrow(state, overrides = {}) {
  const projectile = {
    id: ++state.projectileId, owner: 0, team: state.mode === 'coop' ? 'heroes' : 'p0',
    kind: 'arrow', x: 400, y: 320, vx: 30, vy: 0, angle: 0, facing: 0,
    radius: 5, damage: MOVES.shoot.damage, life: 140, reflected: false, ...overrides,
  };
  state.projectiles.push(projectile);
  return projectile;
}

function downAlly(state) {
  Object.assign(state.fighters[1], { hp: 0, downed: true, action: 'dead', reviveProgress: 0 });
}

function clearToNextWave(state) {
  for (const enemy of state.enemies) enemy.hp = 0;
  step(state);
  assert.equal(state.roomBreak, true);
  assert.equal(state.waveDelay, 0);
  for (let seat=0;seat<2;seat++) chooseBoon(state,seat,state.shrineChoices[0].id);
  assert.equal(state.waveDelay, 3 * TICK_RATE);
  const wave = state.wave;
  advance(state, 3 * TICK_RATE - 1);
  assert.equal(state.wave, wave);
  assert.equal(state.waveDelay, 1);
  step(state);
  assert.equal(state.wave, wave + 1);
  assert.equal(state.waveDelay, 0);
}

test('the countdown freezes both fighters and held combat buttons require a fresh press', () => {
  for (const mode of ['duel', 'coop']) {
    const state = createState(mode);
    startMatch(state);
    const initial = state.fighters.map(({ x, y, hp, stamina }) => ({ x, y, hp, stamina }));
    const held = [input({ right: true, attack: true, roll: true, shoot: true }), emptyInput()];
    advance(state, 3 * TICK_RATE - 1, held);
    assert.equal(state.phase, 'countdown');
    assert.equal(state.phaseTicks, 1);
    assert.deepEqual(state.fighters.map(({ x, y, hp, stamina }) => ({ x, y, hp, stamina })), initial);
    assert.equal(state.enemies.length, 0);
    step(state, held);
    assert.equal(state.phase, 'fight');
    assert.equal(state.enemies.length, mode === 'coop' ? 5 : 0);
    step(state, held);
    assert.equal(state.fighters[0].action, 'run');
    assert.equal(state.events.some(event => ['swing', 'roll', 'draw'].includes(event.type)), false);
    step(state, idle);
    step(state, [input({ attack: true }), emptyInput()]);
    assert.equal(state.fighters[0].action, 'attack');
  }
});

test('sword damage starts after windup, hits once, and does not repeat while held', () => {
  const state = fight();
  const held = [input({ attack: true }), emptyInput()];
  step(state, held);
  assert.equal(state.fighters[0].stamina, 100 - MOVES.sword.stamina);
  advance(state, MOVES.sword.startup - 1, held);
  assert.equal(state.fighters[1].hp, 100);
  step(state, held);
  assert.equal(state.fighters[1].hp, 100 - MOVES.sword.damage);
  assert.equal(state.fighters[1].stun, MOVES.sword.hitstun);
  advance(state, MOVES.sword.total + 40, held);
  assert.equal(state.fighters[1].hp, 100 - MOVES.sword.damage);
  assert.equal(state.events.filter(event => event.type === 'swing').length, 1);
  assert.equal(state.events.filter(event => event.type === 'hit').length, 1);
});

test('sword range includes the target radius and rejects targets just beyond it or behind the attacker', () => {
  for (const [distance, expectedDamage] of [[87, MOVES.sword.damage], [88, 0]]) {
    const state = fight('duel', distance);
    step(state, [input({ attack: true }), emptyInput()]);
    advance(state, MOVES.sword.startup + MOVES.sword.active);
    assert.equal(state.fighters[1].hp, 100 - expectedDamage);
  }
  const behind = fight();
  behind.fighters[1].x = 370;
  step(behind, [input({ attack: true }), emptyInput()]);
  advance(behind, MOVES.sword.startup + MOVES.sword.active);
  assert.equal(behind.fighters[1].hp, 100);
});

test('a pillar blocks sword contact even when the target is within reach', () => {
  const state = fight();
  Object.assign(state.fighters[0], { x: 269, y: 224 });
  Object.assign(state.fighters[1], { x: 355, y: 224 });
  step(state, [input({ attack: true }), emptyInput()]);
  advance(state, MOVES.sword.startup + MOVES.sword.active);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.events.some(event => event.type === 'hit'), false);
});

test('simultaneous sword contacts trade damage fairly', () => {
  const state = fight();
  step(state, [input({ attack: true }), input({ attack: true })]);
  advance(state, MOVES.sword.startup);
  assert.deepEqual(state.fighters.map(f => f.hp), [87, 87]);
  assert.equal(state.events.filter(event => event.type === 'hit').length, 2);
});

test('held frontal guard prevents damage and pays the sword guard cost', () => {
  const state = fight();
  advance(state, 8, guard);
  step(state, [input({ attack: true }), input({ block: true })]);
  advance(state, MOVES.sword.startup, guard);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.fighters[1].stamina, 100 - MOVES.sword.guardDamage);
  assert.equal(state.events.at(-1).type, 'block');
  assert.equal(state.events.some(event => event.type === 'parry'), false);
});

test('the shield covers its front arc but a strike outside that arc deals damage', () => {
  for (const [angle, blocked] of [[1.07, true], [1.09, false]]) {
    const state = fight();
    state.fighters[1].facing = Math.PI + angle;
    advance(state, 8, guard);
    step(state, [input({ attack: true }), input({ block: true })]);
    advance(state, MOVES.sword.startup, guard);
    assert.equal(state.fighters[1].hp, blocked ? 100 : 87);
    assert.equal(state.events.at(-1).type, blocked ? 'block' : 'hit');
  }
});

test('a six-tick fresh guard parries, while a seven-tick old guard only blocks', () => {
  for (const [age, expected] of [[6, 'parry'], [7, 'block']]) {
    const state = fight();
    step(state, [input({ attack: true }), emptyInput()]);
    advance(state, MOVES.sword.startup - age - 1);
    step(state, guard);
    advance(state, age, guard);
    assert.equal(state.fighters[1].hp, 100);
    assert.equal(state.events.at(-1).type, expected);
    assert.equal(state.fighters[0].stun > 0, expected === 'parry');
  }
});

test('continuing to hold guard through blockstun does not grant a second parry', () => {
  const state = fight();
  advance(state, 8, guard);
  step(state, [input({ attack: true }), input({ block: true })]);
  advance(state, 60, guard);
  Object.assign(state.fighters[0], { x: 430, y: 320, vx: 0, vy: 0 });
  Object.assign(state.fighters[1], { x: 490, y: 320, vx: 0, vy: 0 });
  step(state, [input({ attack: true }), input({ block: true })]);
  advance(state, MOVES.sword.startup, guard);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.fighters[1].stamina, 100 - 2 * MOVES.sword.guardDamage);
  assert.equal(state.events.filter(event => event.type === 'block').length, 2);
  assert.equal(state.events.some(event => event.type === 'parry'), false);
});

test('an exhausted shield breaks into a punishable stun', () => {
  const state = fight();
  state.fighters[1].stamina = MOVES.sword.guardDamage - 1;
  advance(state, 8, guard);
  step(state, [input({ attack: true }), input({ block: true })]);
  advance(state, MOVES.sword.startup, guard);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.fighters[1].stamina, 0);
  assert.ok(state.fighters[1].guardBroken >= 100);
  assert.ok(state.fighters[1].stun >= 60);
  assert.equal(state.events.at(-1).type, 'guardbreak');
});

test('roll invulnerability includes frames four through twenty and excludes startup and recovery', () => {
  const state = fight('duel', 300);
  step(state, [input({ roll: true }), emptyInput()]);
  assert.equal(state.fighters[0].stamina, 100 - MOVES.roll.stamina);
  assert.equal(state.fighters[0].actionFrame, 0);
  assert.equal(state.fighters[0].invulnerable, false);
  for (let frame = 1; frame <= 29; frame++) {
    step(state);
    assert.equal(state.fighters[0].actionFrame, frame);
    assert.equal(state.fighters[0].invulnerable, frame >= 4 && frame <= 20, `roll frame ${frame}`);
  }
  step(state);
  assert.equal(state.fighters[0].action, 'idle');
  assert.equal(state.fighters[0].invulnerable, false);
});

test('a sword can punish roll startup but a correctly timed roll evades it', () => {
  for (const [attackFramesBeforeRoll, expectedHp] of [[5, 87], [4, 100]]) {
    const state = fight();
    step(state, [input({ attack: true }), emptyInput()]);
    advance(state, attackFramesBeforeRoll);
    step(state, [emptyInput(), input({ roll: true })]);
    advance(state, MOVES.sword.startup - attackFramesBeforeRoll - 1);
    assert.equal(state.fighters[1].hp, expectedHp);
  }
});

test('a confirmed sword can cancel into roll at frame twenty-two; a missed sword cannot', () => {
  for (const [distance, expectedAction] of [[60, 'roll'], [300, 'attack']]) {
    const state = fight('duel', distance);
    step(state, [input({ attack: true }), emptyInput()]);
    advance(state, 21);
    step(state, [input({ roll: true, up: true }), emptyInput()]);
    assert.equal(state.fighters[0].action, expectedAction);
    if (expectedAction === 'roll') assert.equal(state.fighters[0].rollFacing, -Math.PI / 2);
  }
});

test('insufficient stamina prevents all costly actions and resting restores it', () => {
  for (const key of ['attack', 'shoot', 'roll']) {
    const state = fight('duel', 300);
    state.fighters[0].stamina = 0;
    step(state, [input({ [key]: true }), emptyInput()]);
    assert.equal(state.fighters[0].action, 'idle');
    assert.equal(state.events.some(event => ['swing', 'draw', 'roll'].includes(event.type)), false);
    advance(state, 260);
    assert.equal(state.fighters[0].stamina, 100);
    step(state, [input({ [key]: true }), emptyInput()]);
    assert.equal(state.fighters[0].stamina, 100 - (key === 'attack' ? MOVES.sword : MOVES[key]).stamina);
  }
});

test('diagonal movement has the same speed as cardinal movement', () => {
  const states = [fight('duel', 400), fight('duel', 400)];
  const origin = { x: 430, y: 320 };
  advance(states[0], 20, [input({ right: true }), emptyInput()]);
  advance(states[1], 20, [input({ right: true, down: true }), emptyInput()]);
  const distances = states.map(state => Math.hypot(state.fighters[0].x - origin.x, state.fighters[0].y - origin.y));
  assert.ok(Math.abs(distances[0] - distances[1]) < 1e-9);
  assert.ok(Math.abs(states[1].fighters[0].facing - Math.PI / 4) < 1e-9);
});

test('continuous movement respects all four arena walls', () => {
  for (const [x, y, buttons, axis, boundary] of [
    [ARENA.minX + 1, 320, { left: true }, 'x', ARENA.minX],
    [ARENA.maxX - 1, 320, { right: true }, 'x', ARENA.maxX],
    [430, ARENA.minY + 1, { up: true }, 'y', ARENA.minY],
    [430, ARENA.maxY - 1, { down: true }, 'y', ARENA.maxY],
  ]) {
    const state = fight();
    Object.assign(state.fighters[0], { x, y });
    advance(state, 120, [input(buttons), emptyInput()]);
    assert.equal(state.fighters[0][axis], boundary);
  }
});

test('walking and rolling cannot pass through a pillar', () => {
  for (const roll of [false, true]) {
    const state = fight('duel', 400);
    Object.assign(state.fighters[0], { x: 260, y: 224, facing: 0 });
    step(state, [input({ right: true, roll }), emptyInput()]);
    advance(state, 120, [input({ right: true, roll }), emptyInput()]);
    assert.equal(state.fighters[0].x, 285 - ARENA.fighterRadius);
    assert.equal(state.fighters[0].y, 224);
  }
});

test('arrows wait for shoot startup, hit distant targets, and do not repeat while held', () => {
  const state = fight('duel', 420);
  const held = [input({ shoot: true }), emptyInput()];
  step(state, held);
  assert.equal(state.fighters[0].stamina, 100 - MOVES.shoot.stamina);
  advance(state, MOVES.shoot.startup - 1, held);
  assert.equal(state.projectiles.length, 0);
  step(state, held);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.fighters[1].hp, 100);
  advance(state, 120, held);
  assert.equal(state.fighters[1].hp, 100 - MOVES.shoot.damage);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.events.filter(event => event.type === 'shoot').length, 1);
});

test('arrows stop at pillars and expire when their remaining lifetime ends', () => {
  const covered = fight();
  Object.assign(covered.fighters[0], { x: 250, y: 224 });
  Object.assign(covered.fighters[1], { x: 374, y: 224 });
  step(covered, [input({ shoot: true }), emptyInput()]);
  advance(covered, 60);
  assert.equal(covered.fighters[1].hp, 100);
  assert.equal(covered.projectiles.length, 0);
  assert.ok(covered.events.some(event => event.type === 'arrowStop'));
  const expired = fight();
  arrow(expired, { x: 450, y: 100, vx: 1, life: 1 });
  step(expired);
  assert.equal(expired.projectiles.length, 0);
  assert.equal(expired.events.at(-1).type, 'arrowStop');
  assert.deepEqual(expired.fighters.map(f => f.hp), [100, 100]);
});

test('swept arrow collision hits a target crossed between ticks and ignores its own team', () => {
  const hit = fight();
  arrow(hit, { x: 450, vx: 100 });
  step(hit);
  assert.deepEqual(hit.fighters.map(f => f.hp), [100, 89]);
  assert.equal(hit.projectiles.length, 0);
  const friendly = fight('duel', 300);
  arrow(friendly, { x: 400, vx: 60 });
  step(friendly);
  assert.deepEqual(friendly.fighters.map(f => f.hp), [100, 100]);
  assert.equal(friendly.projectiles.length, 1);
});

test('a fresh frontal guard reflects an arrow and changes its ownership before the return hit', () => {
  const state = fight();
  arrow(state, { x: 445, vx: 35 });
  step(state, guard);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].owner, 1);
  assert.equal(state.projectiles[0].team, 'p1');
  assert.equal(state.projectiles[0].reflected, true);
  assert.ok(state.projectiles[0].vx < 0);
  assert.equal(state.events.at(-1).type, 'parry');
  step(state, guard);
  assert.deepEqual(state.fighters.map(f => f.hp), [85, 100]);
  assert.equal(state.projectiles.length, 0);
});

test('first to two duel wins preserves scores between rounds and resets for a rematch', () => {
  const state = fight();
  for (const [index, winner] of [0, 1, 0].entries()) {
    state.fighters[1 - winner].hp = 0;
    step(state);
    assert.equal(state.phase, 'roundEnd');
    assert.equal(state.winner, winner);
    advance(state, 2 * TICK_RATE);
    if (index < 2) {
      assert.equal(state.phase, 'countdown');
      assert.equal(state.round, index + 2);
      assert.deepEqual(state.fighters.map(f => f.hp), [100, 100]);
      assert.deepEqual(state.fighters.map(f => f.stamina), [100, 100]);
      advance(state, 2 * TICK_RATE);
      assert.equal(state.phase, 'fight');
    }
  }
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.winner, 0);
  assert.deepEqual(state.fighters.map(f => f.wins), [2, 1]);
  const final = state.fighters.map(({ x, y, hp, wins }) => ({ x, y, hp, wins }));
  advance(state, 100, [input({ right: true, attack: true }), input({ roll: true })]);
  assert.deepEqual(state.fighters.map(({ x, y, hp, wins }) => ({ x, y, hp, wins })), final);
  const { tick, eventId } = state;
  resetLobby(state);
  assert.equal(state.phase, 'lobby');
  assert.equal(state.tick, tick);
  assert.equal(state.eventId, eventId);
  assert.deepEqual(state.fighters.map(f => f.wins), [0, 0]);
  assert.equal(state.winner, null);
  startMatch(state);
  advance(state, 3 * TICK_RATE);
  assert.equal(state.phase, 'fight');
});

test('duel timeout awards greater health, while tied health and double knockout award no win', () => {
  for (const [health, timeout, expectedWinner, reason] of [
    [[80, 60], true, 0, 'time'], [[60, 80], true, 1, 'time'],
    [[70, 70], true, null, 'time'], [[0, 0], false, null, 'doubleKO'],
  ]) {
    const state = fight('duel', 300);
    state.fighters.forEach((f, index) => { f.hp = health[index]; });
    if (timeout) state.roundTicks = 1;
    step(state);
    assert.equal(state.phase, 'roundEnd');
    assert.equal(state.winner, expectedWinner);
    assert.deepEqual(state.fighters.map(f => f.wins), expectedWinner === null ? [0, 0] : expectedWinner === 0 ? [1, 0] : [0, 1]);
    assert.equal(state.events.at(-1).reason, reason);
  }
});

test('co-op explores nine distinct rooms, three biomes, and three guardians with chosen builds', () => {
  const state=fight('coop'), layouts=new Set(), bosses=[];
  assert.equal(state.maxWaves,9);
  state.fighters[0].hp=60;downAlly(state);
  for(let room=1;room<=9;room++) {
    assert.equal(state.wave,room); assert.equal(state.biome.name,BIOMES[Math.floor((room-1)/3)].name);
    layouts.add(JSON.stringify(state.obstacles.map(({x,y,w,h})=>[x,y,w,h])));
    const boss=state.enemies.find(e=>e.type==='boss');if(boss)bosses.push(boss.name);
    if(room<9)clearToNextWave(state);
    if(room===1) { assert.deepEqual(state.fighters.map(f=>f.hp),[82,57]);assert.equal(state.fighters[1].downed,false); }
  }
  assert.equal(layouts.size,9);assert.deepEqual(bosses,BIOMES.map(b=>b.boss));
  assert.equal(state.events.filter(event=>event.type==='waveClear').length,8);
  assert.equal(Object.values(state.fighters[0].boons).reduce((a,b)=>a+b),8);
});

test('killing the final guardian produces immediate victory with or without surviving adds', () => {
  for (const liveBats of [false, true]) {
    const state = fight('coop');
    for (let wave = 1; wave < state.maxWaves; wave++) clearToNextWave(state);
    const boss = state.enemies.find(enemy => enemy.type === 'boss');
    state.fighters.forEach(f=>{f.boons={};});
    if (!liveBats) for (const enemy of state.enemies) if (enemy !== boss) enemy.hp = 0;
    Object.assign(boss, { x: 490, y: 320, hp: MOVES.sword.damage, stun: 1000, vx: 0, vy: 0, action: 'hit' });
    Object.assign(state.fighters[0], { x: 430, y: 320, facing: 0, vx: 0, vy: 0 });
    Object.assign(state.fighters[1], { x: 800, y: 520, vx: 0, vy: 0 });
    state.fighters.forEach(f => { f.reviveShield = 0; });
    step(state, [input({ attack: true }), emptyInput()]);
    advance(state, MOVES.sword.startup - 1);
    assert.equal(state.phase, 'fight');
    if (liveBats) assert.ok(state.enemies.some(enemy => enemy.type !== 'boss' && enemy.hp > 0));
    step(state);
    assert.equal(boss.hp, 0);
    assert.equal(state.phase, 'matchEnd');
    assert.equal(state.result, 'victory');
    assert.equal(state.waveDelay, 0);
    assert.ok(state.enemies.every(enemy => enemy.hp === 0));
    assert.equal(state.events.at(-1).type, 'matchEnd');
    assert.equal(state.events.at(-1).tick, state.tick);
  }
});

test('swords and arrows damage the Warden without interrupting its attack warning', () => {
  const state = fight('coop');
  for (let wave = 1; wave < 3; wave++) clearToNextWave(state);
  const boss = state.enemies.find(enemy => enemy.type === 'boss');
    state.fighters.forEach(f=>{f.boons={};});
  state.enemies = [boss];
  Object.assign(boss, {
    x: 490, y: 320, vx: 0, vy: 0, stun: 0, action: 'windup', actionFrame: 20,
    attackKind: 'melee', attackFacing: Math.PI, facing: Math.PI, windupTicks: 72,
  });
  Object.assign(state.fighters[0], { x: 430, y: 320, facing: 0, vx: 0, vy: 0 });
  Object.assign(state.fighters[1], { x: 800, y: 520, vx: 0, vy: 0 });
  state.fighters.forEach(f => { f.reviveShield = 0; });
  step(state, [input({ attack: true }), emptyInput()]);
  advance(state, MOVES.sword.startup);
  assert.equal(boss.hp, boss.maxHp - MOVES.sword.damage);
  assert.equal(boss.action, 'windup');
  assert.equal(boss.actionFrame, 30);
  assert.equal(boss.stun, 0);
  arrow(state, { x: 440, vx: 50 });
  step(state);
  assert.equal(boss.hp, boss.maxHp - MOVES.sword.damage - MOVES.shoot.damage);
  assert.equal(boss.action, 'windup');
  assert.equal(boss.actionFrame, 31);
  assert.equal(boss.stun, 0);
});

test('a fresh shield parries the Warden melee attack, while its slam only permits a block', () => {
  for (const kind of ['melee', 'slam']) {
    const state = fight('coop');
    for (let wave = 1; wave < 3; wave++) clearToNextWave(state);
    const boss = state.enemies.find(enemy => enemy.type === 'boss');
    state.fighters.forEach(f=>{f.boons={};});
    state.enemies = [boss];
    Object.assign(boss, {
      x: 490, y: 320, vx: 0, vy: 0, stun: 0, action: 'attack', actionFrame: 0,
      attackKind: kind, attackFacing: Math.PI, facing: Math.PI, reach: kind === 'slam' ? 128 : 112,
    });
    Object.assign(state.fighters[0], { x: 430, y: 320, facing: 0, vx: 0, vy: 0 });
    Object.assign(state.fighters[1], { x: 800, y: 520, vx: 0, vy: 0 });
    state.fighters.forEach(f => { f.reviveShield = 0; });
    step(state, [input({ block: true }), emptyInput()]);
    assert.equal(state.fighters[0].hp, 100);
    assert.equal(state.events.at(-1).type, kind === 'melee' ? 'parry' : 'block');
    assert.equal(boss.stun > 0, kind === 'melee');
    assert.equal(boss.action, kind === 'melee' ? 'hit' : 'attack');
    assert.equal(state.fighters[0].stamina, kind === 'melee' ? 100 : 66);
  }
});

test('both heroes falling ends co-op in defeat and reset retains co-op mode', () => {
  const state = quietCoop();
  downAlly(state);
  state.fighters[0].hp = 5;
  arrow(state, { owner: 100, team: 'enemies' });
  step(state);
  assert.ok(state.fighters.every(f => f.downed && f.hp === 0));
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.result, 'defeat');
  assert.equal(state.projectiles.length, 0);
  const { tick, eventId } = state;
  resetLobby(state);
  assert.equal(state.mode, 'coop');
  assert.equal(state.tick, tick);
  assert.equal(state.eventId, eventId);
  assert.equal(state.result, null);
  assert.ok(state.fighters.every(f => f.hp === 100 && !f.downed));
  startMatch(state);
  advance(state, 3 * TICK_RATE);
  assert.equal(state.wave, 1);
});

test('co-op swords and hero arrows never damage allies, while enemy arrows hit the nearest hero', () => {
  const swords = quietCoop();
  step(swords, [input({ attack: true }), emptyInput()]);
  advance(swords, MOVES.sword.startup + MOVES.sword.active);
  assert.deepEqual(swords.fighters.map(f => f.hp), [100, 100]);
  const heroes = quietCoop();
  arrow(heroes, { x: 450, vx: 100 });
  step(heroes);
  assert.deepEqual(heroes.fighters.map(f => f.hp), [100, 100]);
  assert.equal(heroes.projectiles.length, 1);
  const enemies = quietCoop();
  arrow(enemies, { owner: 100, team: 'enemies', x: 400, vx: 120 });
  step(enemies);
  assert.deepEqual(enemies.fighters.map(f => f.hp), [89, 100]);
  assert.equal(enemies.projectiles.length, 0);
  const ownEnemy = quietCoop();
  const enemyHp = ownEnemy.enemies[0].hp;
  arrow(ownEnemy, { owner: 100, team: 'enemies', x: 810, y: 100, vx: 80 });
  step(ownEnemy);
  assert.equal(ownEnemy.enemies[0].hp, enemyHp);
  assert.equal(ownEnemy.projectiles.length, 1);
});

test('holding guard within 64 pixels revives an ally after exactly 180 continuous ticks', () => {
  const state = quietCoop();
  state.fighters[1].x = 494;
  downAlly(state);
  const helping = [input({ block: true }), emptyInput()];
  advance(state, 179, helping);
  assert.equal(state.fighters[1].hp, 0);
  assert.equal(state.fighters[1].downed, true);
  assert.equal(state.fighters[1].reviveProgress, 179);
  step(state, helping);
  assert.equal(state.fighters[1].hp, 45);
  assert.equal(state.fighters[1].stamina, 70);
  assert.equal(state.fighters[1].downed, false);
  assert.equal(state.fighters[1].reviveProgress, 0);
  assert.equal(state.fighters[1].reviveShield, 100);
  assert.equal(state.fighters[1].invulnerable, true);
  assert.equal(state.events.at(-1).type, 'revive');
});

test('reviving requires proximity and a clear line, and releasing guard resets progress', () => {
  const far = quietCoop();
  far.fighters[1].x = 495;
  downAlly(far);
  advance(far, 30, [input({ block: true }), emptyInput()]);
  assert.equal(far.fighters[1].reviveProgress, 0);
  const cover = quietCoop();
  cover.obstacles.push({ id: 'thin-cover', x: 455, y: 305, w: 8, h: 30 });
  downAlly(cover);
  advance(cover, 30, [input({ block: true }), emptyInput()]);
  assert.equal(cover.fighters[1].reviveProgress, 0);
  const interrupted = quietCoop();
  downAlly(interrupted);
  advance(interrupted, 60, [input({ block: true }), emptyInput()]);
  assert.equal(interrupted.fighters[1].reviveProgress, 60);
  step(interrupted);
  assert.equal(interrupted.fighters[1].reviveProgress, 0);
  advance(interrupted, 179, [input({ block: true }), emptyInput()]);
  assert.equal(interrupted.fighters[1].downed, true);
  assert.equal(interrupted.fighters[1].reviveProgress, 179);
});

test('taking an unguarded hit interrupts and resets an ongoing revive', () => {
  const state = quietCoop();
  downAlly(state);
  const helping = [input({ block: true }), emptyInput()];
  advance(state, 60, helping);
  assert.equal(state.fighters[1].reviveProgress, 60);
  arrow(state, { owner: 100, team: 'enemies', x: 400, vx: 30 });
  step(state, helping);
  assert.equal(state.fighters[0].hp, 89);
  assert.ok(state.fighters[0].stun > 0);
  assert.equal(state.fighters[1].reviveProgress, 0);
});

test('ground enemy navigation recovers when an enemy starts touching a pillar', () => {
  const state = quietCoop();
  const enemy = state.enemies[0];
  Object.assign(enemy, { x: 267, y: 224, navX: 267, navY: 224, stun: 0, action: 'run', cooldown: 1000 });
  Object.assign(state.fighters[0], { x: 460, y: 225, reviveShield: 1000 });
  Object.assign(state.fighters[1], { x: 850, y: 550, reviveShield: 1000 });
  advance(state, 500);
  assert.ok(enemy.x > 400, `enemy should route past cover; reached ${enemy.x}, ${enemy.y}`);
  assert.ok(Math.hypot(enemy.x - state.fighters[0].x, enemy.y - state.fighters[0].y) < 60);
});

test('cloneState isolates mutable fighters, projectiles, enemies and obstacles', () => {
  const state = quietCoop();
  arrow(state);
  const copy = cloneState(state);
  assert.deepEqual(copy, state);
  copy.fighters[0].buffers.attack = 7;
  copy.fighters[0].previousInput.left = true;
  copy.projectiles[0].damage = 99;
  copy.enemies[0].hp = 1;
  copy.obstacles[0].x = 0;
  assert.equal(state.fighters[0].buffers.attack, 0);
  assert.equal(state.fighters[0].previousInput.left, false);
  assert.equal(state.projectiles[0].damage, MOVES.shoot.damage);
  assert.equal(state.enemies[0].hp, 40);
  assert.equal(state.obstacles[0].x, 285);
});

test('inputs accept only explicit booleans and sanitize unsupported values', () => {
  assert.deepEqual(Object.keys(emptyInput()), INPUT_KEYS);
  const first = fight('duel', 300);
  const second = cloneState(first);
  step(first, [{ right: 1, up: 'true', attack: 'yes', roll: {}, shoot: [], block: 1 }, null]);
  step(second);
  assert.deepEqual(first, second);
});

test('deterministic combat stress keeps health, stamina, geometry and event history bounded', () => {
  for (const mode of ['duel', 'coop']) {
    const first = fight(mode, 300);
    const second = cloneState(first);
    for (let tick = 0; tick < 2400; tick++) {
      const inputs = [0, 1].map(player => {
        const phase = (Math.floor(tick / 75) + player * 2) % 8;
        return input({
          right: [0, 1, 7].includes(phase), left: [3, 4, 5].includes(phase),
          down: [1, 2, 3].includes(phase), up: [5, 6, 7].includes(phase),
          attack: (tick + player * 17) % 47 === 0,
          shoot: (tick + player * 23) % 83 === 0,
          roll: (tick + player * 29) % 137 === 0,
          block: (tick + player * 11) % 113 < 15,
        });
      });
      step(first, inputs);
      step(second, inputs);
      if (tick % 120 === 0) assert.deepEqual(first, second);
      for (const entity of [...first.fighters, ...first.enemies]) {
        for (const key of ['x', 'y', 'vx', 'vy', 'facing', 'hp', 'stamina']) {
          assert.ok(Number.isFinite(entity[key]), `${mode} ${entity.id}.${key} stays finite`);
        }
        assert.ok(entity.hp >= 0 && entity.hp <= entity.maxHp);
        assert.ok(entity.stamina >= 0 && entity.stamina <= 100);
        const margin = entity.radius - ARENA.fighterRadius;
        assert.ok(entity.x >= ARENA.minX + margin - 1e-8 && entity.x <= ARENA.maxX - margin + 1e-8);
        assert.ok(entity.y >= ARENA.minY + margin - 1e-8 && entity.y <= ARENA.maxY - margin + 1e-8);
        for (const obstacle of first.obstacles) {
          const closestX = Math.max(obstacle.x, Math.min(entity.x, obstacle.x + obstacle.w));
          const closestY = Math.max(obstacle.y, Math.min(entity.y, obstacle.y + obstacle.h));
          assert.ok(Math.hypot(entity.x - closestX, entity.y - closestY) >= entity.radius - 1e-7,
            `${mode} ${entity.id} stays outside ${obstacle.id}`);
        }
      }
      assert.ok(first.events.length <= 64);
      for (let index = 1; index < first.events.length; index++) assert.ok(first.events[index].id > first.events[index - 1].id);
      for (const projectile of first.projectiles) {
        assert.ok(Number.isFinite(projectile.x) && Number.isFinite(projectile.y));
        assert.ok(projectile.life > 0);
      }
    }
    assert.deepEqual(first, second);
  }
});


test('shrines require both heroes to choose once and accept guard only within reach', () => {
 const state=fight('coop');state.enemies.forEach(e=>e.hp=0);step(state);
 const shrine=state.shrineChoices.find(s=>s.id==='ward');
 advance(state,600);assert.equal(state.wave,1);assert.equal(state.waveDelay,0);
 state.fighters.forEach((f,i)=>Object.assign(f,{x:110+i*720,y:520}));
 step(state,[input({block:true}),input({block:true})]);assert.deepEqual(state.boonSelections,[null,null]);
 Object.assign(state.fighters[0],{x:shrine.x,y:shrine.y+20});
 step(state,[input({block:true}),emptyInput()]);assert.equal(state.boonSelections[0],'ward');assert.equal(state.fighters[0].maxHp,112);
 assert.equal(chooseBoon(state,0,'ward'),false);assert.equal(chooseBoon(state,1,'invalid'),false);
 Object.assign(state.fighters[1],{x:shrine.x+24,y:shrine.y+12});step(state,[emptyInput(),input({block:true})]);
 assert.equal(state.boonSelections[1],'ward');assert.equal(state.waveDelay,359);
 advance(state,359);assert.equal(state.wave,2);assert.equal(state.roomBreak,false);
 resetLobby(state);assert.deepEqual(state.fighters.map(f=>f.boons),[{},{}]);assert.deepEqual(state.fighters.map(f=>f.maxHp),[100,100]);
});

test('sword, lifesteal, arrow piercing and parry boons alter their actual combat mechanics', () => {
 const state=quietCoop();state.fighters[0].boons={edge:2,leech:2};state.fighters[0].hp=50;
 Object.assign(state.enemies[0],{x:490,y:320,hp:40,stun:1000,action:'hit'});
 step(state,[input({attack:true}),emptyInput()]);advance(state,MOVES.sword.startup);
 assert.equal(state.enemies[0].hp,21);assert.equal(state.fighters[0].hp,53);
 const shots=quietCoop(), enemy=shots.enemies[0];
 Object.assign(enemy,{x:490,y:320,hp:40});const second=structuredClone(enemy);second.id++;second.x=540;shots.enemies.push(second);
 arrow(shots,{x:440,y:320,vx:110,pierce:1,damage:14});step(shots);
 assert.deepEqual(shots.enemies.map(e=>e.hp),[26,26]);assert.equal(shots.projectiles.length,0);
 const parry=quietCoop();parry.fighters[0].boons={riposte:1};parry.fighters[0].hp=60;
 Object.assign(parry.enemies[0],{x:490,y:320,stun:0,hp:40,action:'attack',attackFacing:Math.PI,reach:80,hitTargets:[]});
 step(parry,[input({block:true}),emptyInput()]);assert.equal(parry.fighters[0].hp,64);assert.equal(parry.enemies[0].hp,34);
});

test('crypt casters retreat and fire aimed fans; sanctuary fire is warned before damage', () => {
 const state=fight('coop');for(let w=1;w<4;w++)clearToNextWave(state);
 const caster=state.enemies.find(e=>e.type==='caster');state.enemies=[caster];
 Object.assign(caster,{x:480,y:320,cooldown:0,action:'idle'});Object.assign(state.fighters[0],{x:480,y:470});Object.assign(state.fighters[1],{x:850,y:540});
 step(state);assert.equal(caster.attackKind,'fan');advance(state,68);assert.equal(state.projectiles.length,5);
 const fire=fight('coop');for(let w=1;w<7;w++)clearToNextWave(fire);
 fire.enemies.forEach(e=>{e.stun=10000;});const h=fire.hazards[0];Object.assign(fire.fighters[0],{x:h.x,y:h.y,reviveShield:0,hp:100});
 fire.elapsedTicks=209;step(fire);assert.equal(h.warning,true);assert.equal(fire.fighters[0].hp,100);
 fire.elapsedTicks=299;step(fire);assert.equal(h.active,true);assert.equal(fire.fighters[0].hp,87);
});


test('Relic Duel rotates three fair arenas with distinct cover and valid spawns between rounds',()=>{
 const state=fight('duel'), layouts=new Set(), names=[];
 for(let round=1;round<=3;round++){
  assert.equal(state.round,round);names.push(state.roomName);layouts.add(JSON.stringify(state.obstacles));
  for(const f of state.fighters)for(const r of state.obstacles){
   const x=Math.max(r.x,Math.min(f.x,r.x+r.w)),y=Math.max(r.y,Math.min(f.y,r.y+r.h));
   assert.ok(Math.hypot(f.x-x,f.y-y)>=f.radius);
  }
  if(round<3){state.fighters[round-1].hp=0;step(state);advance(state,240);advance(state,240);}
 }
 assert.equal(layouts.size,3);assert.deepEqual(names,['Moss Courtyard','Tide Archive','Cinder Gallery']);
 resetLobby(state);startMatch(state);advance(state,360);assert.equal(state.roomName,'Moss Courtyard');
});
