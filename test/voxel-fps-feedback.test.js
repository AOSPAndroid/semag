import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { staminaPresentation, paintStamina, createReloadAudioPresenter, createGunImpactReporter } from '../public/voxel-fps-feedback.js';
import { controlForKey, composeInput, FPS_BUTTONS } from '../public/voxel-client.js';
import { controlForKey as royaleKey, INPUT_ACTIONS } from '../public/voxel-royale-client.js';
import { SPRINT, emptyInput, applyCombatDamage } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice } from '../public/voxel-practice-engine.js';
import { createVoxelReloadSamples, createVoxelImpactSamples } from '../public/voxel-shot-audio.js';
import { GameAudio } from '../public/audio.js';

function fight(weapon = 'carbine') {
  const state = createPractice({ weapon, bots: 1, mode: 'targets', seed: 637 });
  startPractice(state); while (state.phase === 'countdown') stepPractice(state); return state;
}
function recorder() {
  const calls = [];
  return { enabled: true, calls, reloadAction(weapon, phase) { calls.push({ weapon, phase }); return true; }, confirmedImpact(kind) { calls.push({ kind }); return true; }, stopReloads() {} };
}

test('nearby sprint and quiet walk are independent of shooting in both French and English layouts', async () => {
  for (const layout of ['wasd', 'zqsd']) for (const control of [controlForKey, royaleKey]) {
    assert.equal(control({ key: 'Shift', code: 'ShiftLeft' }, layout), 'sprint');
    assert.equal(control({ key: 'C', code: 'KeyC', ctrlKey: true }, layout), 'walk');
    assert.equal(control({ key: 'b', code: 'KeyB' }, layout), 'fire'); assert.equal(control({ key: 'j' }, layout), 'fire');
  }
  assert.deepEqual(FPS_BUTTONS, INPUT_ACTIONS); assert.deepEqual(FPS_BUTTONS, Object.keys(emptyInput()).filter(key => !['yaw', 'pitch'].includes(key)));
  const input = composeInput(new Set(['walk', 'up']), { actions: new Set(['sprint']), move: { x: 0, y: 0 } }, {}, { yaw: 0, pitch: 0 });
  assert.equal(input.walk, true); assert.equal(input.sprint, true); assert.equal(input.fire, false);
  const inactive = composeInput(new Set(FPS_BUTTONS), { actions: new Set(['sprint']), move: { x: 0, y: 0 } }, { fire: true }, { yaw: 0, pitch: 0 }, false);
  assert.ok(FPS_BUTTONS.every(key => !inactive[key]));
  for (const file of ['voxel-client.js', 'voxel-horde-client.js', 'voxel-practice-client.js', 'voxel-royale-client.js']) {
    const source = await readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
    assert.equal(/\[['"]c['"],\s*['"]j['"]\]/.test(source), false, `${file} cannot override C before the shared mapping`);
  }
});

test('stamina view preserves actual pool, exhaustion and spectator identity without mutating gameplay', () => {
  const state = fight(), player = state.players[0]; player.stamina = 43.75; player.sprintExhausted = true;
  const before = structuredClone(player), view = staminaPresentation(player, { name: 'Élodie’s' });
  assert.equal(view.value, 43.75); assert.equal(view.max, SPRINT.maxStamina); assert.equal(view.fraction, .4375); assert.equal(view.state, 'exhausted'); assert.match(view.label, /Élodie/); assert.match(view.detail, /Release.*25/);
  assert.deepEqual(player, before); assert.ok(Object.isFrozen(view));
  const paused = staminaPresentation(player, { active: false }); assert.equal(paused.visible, false); assert.equal(paused.value, 43.75);
  assert.equal(staminaPresentation({ ...player, sprinting: true, sprintExhausted: false }).state, 'sprinting');
  assert.equal(staminaPresentation({ ...player, alive: false }).visible, false);
  for (const stamina of [NaN, Infinity, undefined]) assert.equal(staminaPresentation({ ...player, stamina }).visible, false);
  assert.equal(staminaPresentation({ ...player, stamina: 999 }).value, 100); assert.equal(staminaPresentation({ ...player, stamina: -99 }).value, 0);
});

test('small stamina meter paints truthful accessible values with no reads or repeated writes', () => {
  const attrs = new Map(), meter = { hidden: false, writes: 0, getAttribute: key => attrs.get(key), setAttribute(key, value) { this.writes++; attrs.set(key, value); }, getBoundingClientRect() { throw Error('layout read'); } }, fill = { style: {} };
  const view = staminaPresentation({ alive: true, stamina: 36.2 }); paintStamina(meter, fill, view);
  assert.equal(attrs.get('aria-valuenow'), '36'); assert.equal(attrs.get('aria-valuemax'), '100'); assert.match(attrs.get('aria-valuetext'), /36 of 100/); assert.equal(fill.style.transform, 'scaleX(0.3620)');
  const writes = meter.writes; for (let frame = 0; frame < 240; frame++) paintStamina(meter, fill, view);
  assert.equal(meter.writes, writes); paintStamina(meter, fill, staminaPresentation(null)); assert.equal(meter.hidden, true);
});

test('real accepted magazine reload produces each shared mechanical phase once at every display rate', () => {
  for (const hz of [60, 144, 240]) {
    const state = fight(), player = state.players[0], sound = recorder(), feedback = createReloadAudioPresenter(sound);
    feedback.observe(player, { tick: state.tick }); player.ammo--;
    stepPractice(state, { reload: true }); assert.ok(player.reloadTicks > 0);
    let nextFrame = 0;
    while (player.reloadTicks) {
      stepPractice(state); nextFrame += hz / 120;
      while (nextFrame >= 1) { nextFrame--; const before = structuredClone(player); feedback.observe(player, { tick: state.tick }); assert.deepEqual(player, before); }
    }
    assert.deepEqual(sound.calls.map(call => call.phase), ['remove', 'insert', 'seat', 'bolt']);
    assert.equal(feedback.inspect().reports, 4); assert.equal(player.ammo, WEAPONS.carbine.magazine);
  }
});

test('pause and first midreload spectator snapshots do not play missed phases or change accepted clocks', () => {
  const state = fight(), player = state.players[0], sound = recorder(), feedback = createReloadAudioPresenter(sound); player.ammo--;
  stepPractice(state, { reload: true }); for (let tick = 0; tick < 50; tick++) stepPractice(state);
  feedback.observe(player, { tick: state.tick }); assert.equal(sound.calls.length, 0, 'joining a mechanism halfway through stays silent');
  pausePractice(state); feedback.suspend(); const ticks = player.reloadTicks, at = state.tick;
  for (let frame = 0; frame < 240; frame++) { stepPractice(state); feedback.observe(player, { tick: state.tick, active: false }); }
  assert.equal(state.tick, at); assert.equal(player.reloadTicks, ticks); assert.equal(sound.calls.length, 0);
  resumePractice(state); feedback.observe(player, { tick: state.tick }); assert.equal(sound.calls.length, 0);
  while (player.reloadTicks) { stepPractice(state); feedback.observe(player, { tick: state.tick }); }
  assert.deepEqual(sound.calls.map(call => call.phase), ['insert', 'seat', 'bolt']);
});

test('muted and failed mechanical phases are consumed; different sessions, actors and hands stay independent', () => {
  const sound = recorder(), feedback = createReloadAudioPresenter(sound), total = WEAPONS.dualpistols.reloadTicks;
  const player = { id: 0, lifeId: 1, deaths: 0, alive: true, slot: 'primary', weapon: 'dualpistols', reloadTicks: 0 };
  feedback.observe(player, { tick: 0 }); sound.enabled = false;
  for (let tick = 1; tick <= total; tick++) { player.reloadTicks = total - tick + 1; feedback.observe(player, { tick }); if (tick === Math.floor(total * .18)) sound.enabled = true; }
  assert.ok(sound.calls.length >= 5 && sound.calls.length <= 7); assert.ok(sound.calls.filter(call => call.phase === 'insert').length === 2, 'both real hands insert their magazines');
  const count = sound.calls.length; for (let frame = 0; frame < 240; frame++) feedback.observe(player, { tick: total }); assert.equal(sound.calls.length, count);
  assert.ok(Object.isFrozen(feedback.inspect())); feedback.reset(); assert.equal(feedback.inspect().trackedPhases, 0);
  sound.reloadAction = () => { throw Error('optional sound detached'); };
  player.weapon = 'carbine'; player.reloadTicks = 0; feedback.observe(player, { tick: 1000 }); player.reloadTicks = WEAPONS.carbine.reloadTicks - 35; feedback.observe(player, { tick: 1035 }); assert.equal(feedback.inspect().reports, count);
});

test('reload and physical hit samples have quiet finite endpoints, bounded duration and distinct head contact', () => {
  const phases = ['remove', 'insert', 'seat', 'bolt', 'open', 'close', 'eject', 'load', 'pump', 'draw', 'place', 'shell1', 'shell2', 'shell3'];
  for (const weapon of Object.keys(WEAPONS)) for (const phase of phases) {
    const samples = createVoxelReloadSamples(weapon, phase, 8000); assert.ok(samples.length <= 1600); assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) < .5)); assert.equal(samples[0], 0); assert.equal(samples.at(-1), 0);
  }
  for (const kind of ['body', 'headshot']) for (const rate of [8000, 44100, 48000, 192000]) { const samples = createVoxelImpactSamples(kind, rate); assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) < .5)); assert.equal(samples[0], 0); assert.equal(samples.at(-1), 0); }
  assert.notDeepEqual(createVoxelImpactSamples('body'), createVoxelImpactSamples('headshot'));
  for (const phase of ['__proto__', 'missing', null, {}]) assert.equal(createVoxelReloadSamples('carbine', phase), null);
  for (const rate of [0, NaN, Infinity, 7999, 192001]) { assert.equal(createVoxelReloadSamples('carbine', 'insert', rate), null); assert.equal(createVoxelImpactSamples('headshot', rate), null); }
});

test('accepted multi-pellet body/head HP loss is one bright physical contact, with no incoming or speculative report', () => {
  const state = fight('shotgun'), source = state.players[0], target = state.players[1];
  const contacts = Array.from({ length: 9 }, (_, pellet) => ({ playerId: source.id, targetId: target.id, weapon: 'shotgun', attack: 'gun', damage: 1, headshot: pellet === 8 }));
  applyCombatDamage(state, contacts); const accepted = state.events.filter(event => event.type === 'damage'), sound = recorder(), feedback = createGunImpactReporter(sound), before = structuredClone(state.players);
  feedback.consume(accepted, 0, { context: 'one-life' }); assert.deepEqual(sound.calls, [{ kind: 'headshot' }]); assert.deepEqual(state.players, before);
  feedback.consume(accepted, 0, { context: 'one-life' }); assert.equal(sound.calls.length, 1);
  feedback.consume([{ ...accepted[0], tick: state.tick + 1, headshot: false }], 0, { context: 'one-life' }); assert.deepEqual(sound.calls.at(-1), { kind: 'body' });
  for (const invalid of [{ type: 'bulletHit' }, { damage: 0 }, { hp: undefined }, { playerId: 1, targetId: 0 }, { playerId: 0, targetId: 0 }, { attack: 'katana', weapon: 'katana' }]) feedback.consume([{ ...accepted[0], tick: state.tick + 2, ...invalid }], 0);
  assert.equal(sound.calls.length, 2);
});

test('impact grouping stays bounded, journals muted shells, and cannot suppress another attacker or lifetime', () => {
  const sound = recorder(), feedback = createGunImpactReporter(sound), event = { type: 'damage', playerId: 0, targetId: 3, tick: 1, weapon: 'carbine', attack: 'gun', damage: 5, hp: 100 };
  sound.enabled = false; feedback.consume([event], 0); sound.enabled = true; feedback.consume([event], 0); assert.equal(sound.calls.length, 0);
  feedback.consume([{ ...event, playerId: 1 }], 0, { viewedId: 1 }); feedback.consume([{ ...event, attackerLifeId: 2 }], 0); assert.equal(sound.calls.length, 2);
  for (let tick = 2; tick < 1000; tick++) feedback.consume([{ ...event, tick }], 0);
  assert.equal(feedback.inspect().trackedShells, 512); assert.ok(Object.isFrozen(feedback.inspect())); feedback.reset(); assert.equal(feedback.inspect().trackedShells, 0);
});

function audioContext() {
  const sources = [], buffers = [], node = () => ({ connect() {}, disconnect() {} });
  return { sources, buffers, state: 'running', sampleRate: 8000, currentTime: 10,
    createBuffer(channels, length, rate) { const data = new Float32Array(length), buffer = { duration: length / rate, getChannelData: () => data }; buffers.push(buffer); return buffer; },
    createBufferSource() { const source = { ...node(), playbackRate: {}, start() {}, stop() {} }; sources.push(source); return source; },
    createGain() { return { ...node(), gain: {} }; }, close() { this.state = 'closed'; return Promise.resolve(); } };
}

test('reload and confirmed impact cache voices share the firearm cap and never create audio without opt-in', () => {
  const audio = new GameAudio(); assert.equal(audio.reloadAction('carbine', 'insert'), false); assert.equal(audio.confirmedImpact('headshot'), false); assert.equal(audio.context, null);
  const ctx = audioContext(); audio.context = ctx; audio.master = ctx.createGain(); audio.enabled = true;
  for (let index = 0; index < 500; index++) { audio.gunshot('smg'); audio.reloadAction('carbine', 'insert'); audio.confirmedImpact(index % 2 ? 'body' : 'headshot'); }
  assert.equal(audio.gunshotVoices.size, 24); assert.equal(ctx.buffers.length, 4); assert.equal(audio.inspectGunshots().played, 500); assert.equal(audio.inspectReloads().played, 500); assert.equal(audio.inspectImpacts().played, 500);
  audio.stopReloads(); assert.equal(audio.inspectReloads().activeVoices, 0); assert.ok(audio.gunshotVoices.size > 0);
  audio.resetEvents(); assert.equal(audio.gunshotVoices.size, 0); audio.destroy(); assert.equal(audio.reloadBuffers.size, 0); assert.equal(audio.impactBuffers.size, 0);
});
