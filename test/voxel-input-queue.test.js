import assert from 'node:assert/strict';
import test from 'node:test';
import { createFpsInputQueue, FPS_EDGE_ACTIONS, releaseFpsTouchAction } from '../public/voxel-input-queue.js';
import * as Voxel from '../public/voxel-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { composeInput as breachInput } from '../public/voxel-client.js';
import { composeInput as royaleInput } from '../public/voxel-royale-client.js';
import { movementPresentation } from '../public/voxel-presentation.js';

function fight(weapon = 'pistol') {
  const state = Voxel.createState();
  Voxel.selectLoadout(state, 0, weapon); Voxel.startMatch(state);
  while (state.phase !== 'fight') Voxel.step(state);
  return state;
}
function shortPress(queue, action, now = 100, aim = {}, viewTick) {
  queue.observe({ ...aim, [action]: true }, now, { viewTick });
  queue.observe({ ...aim, [action]: false }, now + 1, { viewTick });
}
function tick(state, queue, input, now = 102) {
  const sampled = queue.sample(input, now);
  Voxel.step(state, [sampled.buttons]);
  return sampled;
}

test('a released semi-auto tap waits for real physics, fires once and retains its committed aim', () => {
  const state = fight(), queue = createFpsInputQueue(), player = state.players[0], initialTick = state.tick;
  shortPress(queue, 'fire', 100, { yaw: .25, pitch: -.1 }, initialTick - 2);
  queue.observe({ right: true, aim: true, yaw: 1.1, pitch: .3 }, 102, { viewTick: initialTick });
  assert.equal(player.shots, 0); assert.equal(state.tick, initialTick);
  const sampled = tick(state, queue, undefined, 103);
  assert.equal(sampled.buttons.fire, true); assert.equal(sampled.buttons.right, true); assert.equal(sampled.buttons.aim, true);
  assert.equal(sampled.buttons.yaw, .25); assert.equal(sampled.buttons.pitch, -.1); assert.equal(sampled.viewTick, initialTick - 2);
  assert.equal(player.shots, 1); assert.equal(player.ammo, Voxel.WEAPONS.pistol.magazine - 1);
  const following = tick(state, queue, undefined, 104);
  assert.notEqual(following.buttons.fire, true); assert.equal(following.buttons.yaw, 1.1); assert.equal(following.buttons.pitch, .3);
  for (let index = 0; index < Voxel.WEAPONS.pistol.cooldown + 3; index++) tick(state, queue, undefined, 105 + index);
  assert.equal(player.shots, 1, 'a released tap cannot fire again after cooldown');
});

test('two swap taps between physics ticks keep a real release and both change equipment', () => {
  const state = fight(), queue = createFpsInputQueue(), player = state.players[0];
  shortPress(queue, 'swap', 100); shortPress(queue, 'swap', 102);
  assert.equal(tick(state, queue, undefined, 104).buttons.swap, true); assert.equal(player.slot, 'sword');
  assert.equal(tick(state, queue, undefined, 105).buttons.swap, false); assert.equal(player.slot, 'sword');
  assert.equal(tick(state, queue, undefined, 106).buttons.swap, true); assert.equal(player.slot, 'primary');
  tick(state, queue, undefined, 107); assert.equal(player.slot, 'primary');
});

test('two released pickup taps consume real Royale loot on separate rising edges', () => {
  const state = Royale.createState({ capacity: 2, mapId: 'forest', seed: 7134 }), queue = createFpsInputQueue();
  Royale.startMatch(state, [0, 1]); while (state.phase !== 'fight') Royale.step(state);
  const player = state.players[0];
  state.loot = [
    { id: ++state.lootId, kind: 'weapon', weapon: 'pistol', ammo: 8, reserve: 16, x: player.x, y: player.y, z: player.z },
    { id: ++state.lootId, kind: 'heal', amount: 1, x: player.x, y: player.y, z: player.z },
  ];
  shortPress(queue, 'interact', 100); shortPress(queue, 'interact', 102);
  Royale.step(state, [queue.sample(undefined, 104).buttons]);
  assert.equal(player.hasGun, true); assert.equal(player.weapon, 'pistol'); assert.equal(player.ammo, 8); assert.equal(player.potions, 0);
  Royale.step(state, [queue.sample(undefined, 105).buttons]); assert.equal(player.potions, 0);
  Royale.step(state, [queue.sample(undefined, 106).buttons]); assert.equal(player.potions, 1);
  assert.equal(state.events.filter(event => event.type === 'lootPickup').length, 2); assert.equal(state.loot.length, 0);
});

test('short utility taps start actual reload, grenade, healing and jump commitments', () => {
  for (const action of ['reload', 'grenade', 'heal', 'jump']) {
    const state = fight(), queue = createFpsInputQueue(), player = state.players[0];
    if (action === 'reload') player.ammo--;
    if (action === 'heal') Voxel.applyCombatDamage(state, [{ playerId: 1, targetId: 0, damage: 75, weapon: 'carbine', attack: 'gun' }]);
    shortPress(queue, action); tick(state, queue);
    if (action === 'reload') assert.ok(player.reloadTicks > 0);
    if (action === 'grenade') { assert.equal(player.grenades, 0); assert.equal(state.grenades.length, 1); assert.ok(player.grenadeThrowTicks > 0); }
    if (action === 'heal') { assert.equal(player.potions, 0); assert.ok(player.healTicks > 0); }
    if (action === 'jump') { assert.ok(player.y > 0); assert.ok(player.vy > 0); assert.equal(player.grounded, false); }
  }
});

test('a queued jump uses current turn and movement, and preserves the same result as direct engine movement', () => {
  const state = fight(), queue = createFpsInputQueue(), player = state.players[0], expected = structuredClone(player);
  shortPress(queue, 'jump', 100, { yaw: -.8, pitch: -.2 }, 10);
  const latest = { up: true, yaw: Math.PI / 2, pitch: .4 };
  queue.observe(latest, 102, { viewTick: 20 });
  const sampled = queue.sample(undefined, 103);
  assert.equal(sampled.buttons.jump, true); assert.equal(sampled.buttons.yaw, latest.yaw); assert.equal(sampled.buttons.pitch, latest.pitch); assert.equal(sampled.viewTick, 20);
  Voxel.predictLocalMovement(expected, { ...latest, jump: true }, state.mapId, 1, state.players);
  Voxel.step(state, [sampled.buttons]);
  assert.equal(player.x, expected.x); assert.equal(player.y, expected.y); assert.equal(player.z, expected.z);
});

test('non-aim utility presses never redirect a held automatic shot or restore stale view metadata', () => {
  for (const action of ['jump', 'reload', 'interact', 'swap', 'heal']) {
    const queue = createFpsInputQueue();
    queue.observe({ fire: true, yaw: .1, pitch: .2 }, 100, { viewTick: 10 }); queue.sample(undefined, 100);
    queue.observe({ fire: true, [action]: true, yaw: -.8, pitch: -.3 }, 101, { viewTick: 11 });
    queue.observe({ fire: true, yaw: .7, pitch: .4 }, 102, { viewTick: 12 });
    const sampled = queue.sample(undefined, 103);
    assert.equal(sampled.buttons.fire, true); assert.equal(sampled.buttons[action], true);
    assert.equal(sampled.buttons.yaw, .7, action); assert.equal(sampled.buttons.pitch, .4, action); assert.equal(sampled.viewTick, 12, action);
  }
});

test('a queued grenade uses its actual press direction while later movement remains current', () => {
  const state = fight(), queue = createFpsInputQueue();
  shortPress(queue, 'grenade', 100, { yaw: Math.PI / 2, pitch: 0 }, 10);
  queue.observe({ left: true, yaw: -Math.PI / 2, pitch: .2 }, 102, { viewTick: 12 });
  const sampled = tick(state, queue, undefined, 103), grenade = state.grenades[0];
  assert.equal(sampled.buttons.left, true); assert.equal(sampled.buttons.yaw, Math.PI / 2); assert.equal(sampled.viewTick, 10);
  assert.ok(grenade.vx > 0); assert.ok(Math.abs(grenade.vz) < 1e-6);
});

test('held automatic fire, ADS and ordinary movement remain continuous after the initial press', () => {
  const state = fight('carbine'), queue = createFpsInputQueue();
  queue.observe({ fire: true, aim: true, up: true, yaw: .4, pitch: 0 }, 100);
  for (let index = 0; index < 36; index++) {
    const sampled = tick(state, queue, undefined, 100 + index);
    assert.equal(sampled.buttons.fire, true); assert.equal(sampled.buttons.aim, true); assert.equal(sampled.buttons.up, true);
  }
  assert.ok(state.players[0].shots >= 3); assert.equal(state.players[0].aimTicks, Voxel.ADS.ticks);
});

test('the pending budget bounds genuine rapid taps without replaying excess actions', () => {
  const state = fight(), queue = createFpsInputQueue({ maxPending: 2 });
  for (let index = 0; index < 20; index++) shortPress(queue, 'swap', 100 + index * 2);
  assert.equal(queue.inspect().pending.length, 2);
  for (let index = 0; index < 20; index++) tick(state, queue, undefined, 141 + index);
  assert.equal(state.events.filter(event => event.type === 'swap').length, 2); assert.equal(state.players[0].slot, 'primary');
  assert.equal(queue.inspect().pending.length, 0);
});

test('stale released presses expire at 120ms instead of emerging after a stalled frame', () => {
  const state = fight(), queue = createFpsInputQueue();
  shortPress(queue, 'fire', 100, { yaw: .2, pitch: 0 }, state.tick - 1);
  const sampled = tick(state, queue, undefined, 220.01);
  assert.equal(sampled.buttons.fire, false); assert.equal(state.players[0].shots, 0); assert.equal(queue.inspect().pending.length, 0);
  shortPress(queue, 'fire', 221); tick(state, queue, undefined, 223);
  assert.equal(state.players[0].shots, 1, 'a genuine new press still works after stale input expires');
});

test('cancel resets discard every pending commitment and prevent held actions reentering across a phase fence', () => {
  const state = fight(), queue = createFpsInputQueue();
  for (const action of FPS_EDGE_ACTIONS) shortPress(queue, action);
  const held = Object.fromEntries(FPS_EDGE_ACTIONS.map(action => [action, true]));
  queue.reset({ held, neutral: true });
  for (let index = 0; index < 4; index++) { queue.observe(held, 110 + index); tick(state, queue, undefined, 110 + index); }
  assert.equal(state.players[0].shots, 0); assert.equal(state.players[0].grenades, 1); assert.equal(state.players[0].potions, 1); assert.equal(state.players[0].slot, 'primary'); assert.equal(state.players[0].y, 0);
  queue.observe({}, 115); shortPress(queue, 'fire', 116); tick(state, queue, undefined, 118);
  assert.equal(state.players[0].shots, 1);
});

test('a fresh post-cancel tap survives the neutral physics step without leaking into presentation', () => {
  const state = fight(), queue = createFpsInputQueue();
  shortPress(queue, 'fire'); queue.reset({ neutral: true }); shortPress(queue, 'jump', 102);
  assert.equal(queue.preview({ jump: true, up: true }).jump, false); assert.equal(queue.preview({ up: true }).up, true);
  tick(state, queue, undefined, 104); assert.equal(state.players[0].y, 0); assert.equal(state.players[0].shots, 0);
  tick(state, queue, undefined, 105); assert.ok(state.players[0].y > 0); assert.equal(state.players[0].shots, 0);
});

test('phase-held actions require release while a first fresh post-bell press needs no artificial delay', () => {
  const state = fight(), queue = createFpsInputQueue();
  queue.reset({ held: { jump: true } });
  queue.observe({ jump: true, fire: true }, 100); const sampled = tick(state, queue, undefined, 101);
  assert.equal(sampled.buttons.jump, false); assert.equal(sampled.buttons.fire, true); assert.equal(state.players[0].y, 0); assert.equal(state.players[0].shots, 1);
});

test('render previews and copied diagnostics cannot consume or mutate queued presses', () => {
  const state = fight(), queue = createFpsInputQueue();
  shortPress(queue, 'fire', 100, { yaw: .5, pitch: -.3 }); const before = queue.inspect();
  for (const hz of [60, 120, 144, 240]) for (let index = 0; index < hz; index++) queue.preview({ up: true, yaw: .7 });
  assert.deepEqual(queue.inspect(), before); assert.equal(state.players[0].shots, 0);
  const copied = queue.inspect(); copied.pending[0].action = 'swap'; copied.pending[0].yaw = -2; copied.pending.length = 0;
  const sampled = tick(state, queue, undefined, 102); assert.equal(sampled.buttons.yaw, .5); assert.equal(state.players[0].shots, 1); assert.equal(state.players[0].slot, 'primary');
});

test('half-tick movement never invents a jump ahead of a queued fire or grenade commitment', () => {
  for (const action of ['fire', 'grenade']) {
    const state = fight(), queue = createFpsInputQueue(), player = state.players[0];
    queue.observe({ [action]: true, up: true, yaw: -.4, pitch: -.2 }, 100);
    queue.observe({ jump: true, up: true, yaw: 1.1, pitch: .3 }, 101);
    const beforePlayer = structuredClone(player), beforeQueue = queue.inspect();
    const preview = queue.preview(undefined, 102);
    assert.equal(preview.jump, false, `${action} must precede the pending jump`);
    assert.equal(preview[action], true); assert.equal(preview.yaw, -.4); assert.equal(preview.pitch, -.2);
    const half = movementPresentation(player, preview, state.mapId, 1 / 240, Voxel.predictLocalMovement, state.players);
    const endpoint = structuredClone(player); Voxel.predictLocalMovement(endpoint, preview, state.mapId, 1, state.players);
    assert.equal(half.y, 0, 'rendering cannot show a jump that the next physics step will reject');
    assert.equal(half.x, (player.x + endpoint.x) / 2); assert.equal(half.z, (player.z + endpoint.z) / 2);
    assert.deepEqual(player, beforePlayer); assert.deepEqual(queue.inspect(), beforeQueue);
    const sampled = tick(state, queue, undefined, 102);
    assert.deepEqual(sampled.buttons, preview); assert.equal(player.y, 0);
    const jumpPreview = queue.preview(undefined, 103);
    assert.equal(jumpPreview.jump, true);
    const jumpingHalf = movementPresentation(player, jumpPreview, state.mapId, 1 / 240, Voxel.predictLocalMovement, state.players);
    assert.ok(jumpingHalf.y > 0);
    const jumpStep = tick(state, queue, undefined, 103);
    assert.deepEqual(jumpStep.buttons, jumpPreview); assert.ok(player.y > jumpingHalf.y);
  }
});

test('render previews keep the release gap between repeated trigger presses and restore the second captured aim only when legal', () => {
  const state = fight(), queue = createFpsInputQueue();
  shortPress(queue, 'fire', 100, { yaw: -.5, pitch: -.2 });
  queue.observe({ fire: true, up: true, yaw: .4, pitch: .1 }, 102);
  queue.observe({ fire: true, up: true, yaw: 1.1, pitch: .3 }, 103);
  tick(state, queue, undefined, 104); assert.equal(state.players[0].shots, 1);
  const before = queue.inspect(), release = queue.preview(undefined, 105);
  assert.equal(release.fire, false); assert.equal(release.yaw, 1.1); assert.equal(release.pitch, .3);
  assert.deepEqual(queue.inspect(), before);
  assert.deepEqual(tick(state, queue, undefined, 105).buttons, release);
  const second = queue.preview(undefined, 106);
  assert.equal(second.fire, true); assert.equal(second.yaw, .4); assert.equal(second.pitch, .1);
  assert.deepEqual(tick(state, queue, undefined, 106).buttons, second);
});

test('preview applies the same 120ms expiry as physics without deleting stale commitments', () => {
  const state = fight(), queue = createFpsInputQueue();
  shortPress(queue, 'fire', 100, { yaw: -.5, pitch: -.2 });
  shortPress(queue, 'jump', 120, { yaw: -.4, pitch: -.1 });
  queue.observe({ up: true, yaw: .8, pitch: .3 }, 122);
  const before = queue.inspect(), boundary = queue.preview(undefined, 220);
  assert.equal(boundary.fire, true); assert.equal(boundary.jump, false); assert.equal(boundary.yaw, -.5);
  const expired = queue.preview(undefined, 220.01);
  assert.equal(expired.fire, false); assert.equal(expired.jump, true); assert.equal(expired.yaw, .8); assert.equal(expired.pitch, .3);
  assert.deepEqual(queue.inspect(), before, 'rendering cannot age or consume the authoritative input queue');
  const half = movementPresentation(state.players[0], expired, state.mapId, 1 / 240, Voxel.predictLocalMovement, state.players);
  assert.ok(half.y > 0);
  assert.deepEqual(tick(state, queue, undefined, 220.01).buttons, expired);
  assert.equal(state.players[0].shots, 0); assert.ok(state.players[0].y > 0); assert.equal(queue.inspect().pending.length, 0);
});

test('repeated copied previews leave neutral, blocked, sampled and queued action lifecycle observationally unchanged', () => {
  const queue = createFpsInputQueue(), untouched = createFpsInputQueue();
  for (const target of [queue, untouched]) {
    target.reset({ held: { jump: true }, neutral: true });
    shortPress(target, 'fire', 100, { yaw: -.4 });
  }
  const before = queue.inspect();
  for (const hz of [60, 120, 144, 240]) for (let index = 0; index < hz; index++) {
    const output = queue.preview({ jump: true, up: true, yaw: .8 }, 102);
    output.jump = output.fire = true; output.yaw = -2;
    queue.preview({ jump: false, up: true }, 102);
  }
  assert.deepEqual(queue.inspect(), before);
  for (let index = 0; index < 4; index++) {
    const input = { jump: true, up: true, yaw: .8 };
    const actual = queue.sample(input, 102 + index), expected = untouched.sample(input, 102 + index);
    assert.deepEqual(actual, expected); assert.deepEqual(queue.inspect(), untouched.inspect());
  }
});

for (const [name, compose] of [['Breach', breachInput], ['Royale', royaleInput]]) {
  test(`${name} alias holds produce one queued utility until every real source releases`, () => {
    const state = fight(), queue = createFpsInputQueue(), keys = new Set(['swap']);
    const touch = { actions: new Set(), move: { x: 0, y: 0 } }, mouse = { fire: false, aim: false }, aim = { yaw: 0, pitch: 0 };
    queue.observe(compose(keys, touch, mouse, aim), 100);
    touch.actions.add('swap'); queue.observe(compose(keys, touch, mouse, aim), 101);
    keys.delete('swap'); queue.observe(compose(keys, touch, mouse, aim), 102);
    tick(state, queue, undefined, 103); assert.equal(state.players[0].slot, 'sword');
    tick(state, queue, undefined, 104); assert.equal(state.players[0].slot, 'sword'); assert.equal(queue.inspect().pending.length, 0);
    touch.actions.clear(); queue.observe(compose(keys, touch, mouse, aim), 105); tick(state, queue, undefined, 106);
    keys.add('swap'); queue.observe(compose(keys, touch, mouse, aim), 107); tick(state, queue, undefined, 108);
    assert.equal(state.players[0].slot, 'primary'); assert.equal(state.events.filter(event => event.type === 'swap').length, 2);
  });
}


function touchSource(action, pressSeq = null) {
  return { action, pressSeq, element: { classList: { remove() {} } } };
}

function finishTouch(queue, pointer, pointers, touch, compose, keys, mouse, cancelled, now, sequence) {
  for (const [id, value] of pointers) if (value === pointer) pointers.delete(id);
  const input = () => compose(keys, touch, mouse, { yaw: 0, pitch: 0 });
  const cancelledPress = releaseFpsTouchAction(pointer, pointers, touch.actions, action => input()[action], cancelled);
  if (cancelledPress) queue.cancel(cancelledPress);
  queue.observe(input(), now, { sequence });
  return cancelledPress;
}

for (const [name, compose] of [['Breach', breachInput], ['Royale', royaleInput]]) {
  test(`${name} a cancelled jump contact leaves another source's automatic fire continuous`, () => {
    const state = fight('carbine'), queue = createFpsInputQueue(), keys = new Set(['fire']);
    const touch = { actions: new Set(), move: { x: 0, y: 0 } }, mouse = { fire: false, aim: false };
    queue.observe(compose(keys, touch, mouse, { yaw: 0, pitch: 0 }), 100, { sequence: 1 });
    tick(state, queue, undefined, 101); assert.equal(state.players[0].shots, 1);
    const pointer = touchSource('jump', 2), pointers = new Map([[12, pointer]]);
    touch.actions.add('jump'); queue.observe(compose(keys, touch, mouse, { yaw: 0, pitch: 0 }), 102, { sequence: 2 });
    assert.deepEqual(finishTouch(queue, pointer, pointers, touch, compose, keys, mouse, true, 103, 3), { action: 'jump', seq: 2 });
    for (let index = 0; index < 36; index++) tick(state, queue, undefined, 104 + index);
    assert.ok(state.players[0].shots >= 3); assert.equal(state.players[0].y, 0);
    assert.equal(queue.preview(undefined, 140).fire, true); assert.deepEqual(queue.inspect().blocked, []);
  });

  test(`${name} cancelling either fire finger preserves the surviving finger and a normal released tap`, () => {
    for (const cancelOwner of [true, false]) {
      const state = fight('carbine'), queue = createFpsInputQueue(), keys = new Set();
      const touch = { actions: new Set(['fire']), move: { x: 0, y: 0 } }, mouse = { fire: false, aim: false };
      const owner = touchSource('fire', 1), second = touchSource('fire'), pointers = new Map([[1, owner], [2, second]]);
      queue.observe(compose(keys, touch, mouse, { yaw: 0, pitch: 0 }), 100, { sequence: 1 });
      const cancelled = cancelOwner ? owner : second, survivor = cancelOwner ? second : owner;
      assert.equal(finishTouch(queue, cancelled, pointers, touch, compose, keys, mouse, true, 101, 2), null);
      for (let index = 0; index < 36; index++) tick(state, queue, undefined, 102 + index);
      assert.ok(state.players[0].shots >= 3); assert.equal(queue.preview(undefined, 140).fire, true);
      finishTouch(queue, survivor, pointers, touch, compose, keys, mouse, false, 141, 3);
      const shots = state.players[0].shots;
      for (let index = 0; index < 30; index++) tick(state, queue, undefined, 142 + index);
      assert.equal(state.players[0].shots, shots);
    }
  });

  test(`${name} all cancelled fire fingers withdraw only their unconsumed aggregate press`, () => {
    const state = fight(), queue = createFpsInputQueue(), keys = new Set();
    const touch = { actions: new Set(['fire']), move: { x: 0, y: 0 } }, mouse = { fire: false, aim: false };
    const owner = touchSource('fire', 1), second = touchSource('fire'), pointers = new Map([[1, owner], [2, second]]);
    queue.observe(compose(keys, touch, mouse, { yaw: 0, pitch: 0 }), 100, { sequence: 1 });
    finishTouch(queue, owner, pointers, touch, compose, keys, mouse, true, 101, 2);
    assert.equal(second.pressSeq, 1); assert.equal(queue.preview(undefined, 102).fire, true);
    finishTouch(queue, second, pointers, touch, compose, keys, mouse, true, 102, 3);
    for (let index = 0; index < 3; index++) tick(state, queue, undefined, 103 + index);
    assert.equal(state.players[0].shots, 0);
  });

  test(`${name} a normal release by either fire finger protects the tap from another finger's lost capture`, () => {
    for (const releaseOwner of [true, false]) {
      const state = fight(), queue = createFpsInputQueue(), keys = new Set();
      const touch = { actions: new Set(['fire']), move: { x: 0, y: 0 } }, mouse = { fire: false, aim: false };
      const owner = touchSource('fire', 1), second = touchSource('fire'), pointers = new Map([[1, owner], [2, second]]);
      queue.observe(compose(keys, touch, mouse, { yaw: 0, pitch: 0 }), 100, { sequence: 1 });
      finishTouch(queue, releaseOwner ? owner : second, pointers, touch, compose, keys, mouse, false, 101, 2);
      finishTouch(queue, releaseOwner ? second : owner, pointers, touch, compose, keys, mouse, true, 102, 3);
      tick(state, queue, undefined, 103); assert.equal(state.players[0].shots, 1);
      for (let index = 0; index < 3; index++) tick(state, queue, undefined, 104 + index);
      assert.equal(state.players[0].shots, 1);
    }
  });

  test(`${name} a cancelled touch fire preserves a keyboard or mouse alias that began during the contact`, () => {
    for (const alias of ['keyboard', 'mouse']) {
      const state = fight('carbine'), queue = createFpsInputQueue(), keys = new Set();
      const touch = { actions: new Set(['fire']), move: { x: 0, y: 0 } }, mouse = { fire: false, aim: false };
      const pointer = touchSource('fire', 1), pointers = new Map([[1, pointer]]);
      queue.observe(compose(keys, touch, mouse, { yaw: 0, pitch: 0 }), 100, { sequence: 1 });
      if (alias === 'keyboard') keys.add('fire'); else mouse.fire = true;
      assert.equal(finishTouch(queue, pointer, pointers, touch, compose, keys, mouse, true, 101, 2), null);
      for (let index = 0; index < 36; index++) tick(state, queue, undefined, 102 + index);
      assert.ok(state.players[0].shots >= 3, alias); assert.equal(queue.preview(undefined, 140).fire, true);
    }
  });
}

test('per-press cancellation preserves earlier valid taps, later taps and unrelated commitments through real release steps', () => {
  const state = fight(), queue = createFpsInputQueue();
  queue.observe({ fire: true }, 100, { sequence: 1 }); queue.observe({}, 101, { sequence: 2 });
  queue.observe({ fire: true }, 102, { sequence: 3 }); queue.observe({}, 103, { sequence: 4 });
  queue.observe({ jump: true }, 104, { sequence: 5 }); queue.observe({}, 105, { sequence: 6 });
  queue.observe({ fire: true }, 106, { sequence: 7 }); queue.observe({}, 107, { sequence: 8 });
  assert.equal(queue.cancel({ action: 'fire', seq: 3 }), true);
  tick(state, queue, undefined, 108); assert.equal(state.players[0].shots, 1);
  const jump = tick(state, queue, undefined, 109); assert.equal(jump.buttons.jump, true); assert.ok(state.players[0].y > 0);
  assert.equal(queue.inspect().pending.length, 1); assert.equal(queue.inspect().pending[0].seq, 7);
  assert.equal(queue.cancel({ action: 'fire', seq: 1 }), false, 'consumed sequence cannot erase the newer press');
  assert.equal(queue.cancel({ action: 'fire', seq: 999 }), false);
  const second = queue.sample(undefined, 110); assert.equal(second.buttons.fire, true);
});

test('cancellation is bounded by pending sequence identity and reset does not permit old tokens to erase fresh inputs', () => {
  const queue = createFpsInputQueue({ maxPending: 2 });
  queue.observe({ fire: true, jump: true }, 100, { sequence: 1 });
  queue.observe({}, 101, { sequence: 2 }); queue.observe({ grenade: true }, 102, { sequence: 3 });
  assert.equal(queue.inspect().pending.length, 2);
  for (const value of [null, {}, { action: 'fire', seq: -1 }, { action: 'fire', seq: 1.5 }, { action: 'aim', seq: 1 }, { action: 'jump', seq: 3 }]) assert.equal(queue.cancel(value), false);
  queue.reset(); queue.observe({ fire: true }, 103, { sequence: 4 });
  assert.equal(queue.cancel({ action: 'fire', seq: 1 }), false); assert.equal(queue.preview(undefined, 104).fire, true);
  assert.equal(queue.cancel({ action: 'fire', seq: 4 }), true); queue.observe({}, 105, { sequence: 5 });
  assert.notEqual(queue.preview(undefined, 106).fire, true);
});
