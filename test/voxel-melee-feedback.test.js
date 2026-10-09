import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../public/audio.js';
import { combatReadout, weaponComparison } from '../public/voxel-client.js';
import { combatReadout as royaleReadout } from '../public/voxel-royale-client.js';
import { MELEE_IDS, MELEE_WEAPONS } from '../public/voxel-melee.js';
import { WEAPONS } from '../public/voxel-weapons.js';

function enabledAudio() {
  const sources = [], buffers = [];
  const node = () => ({ disconnects: 0, connect() {}, disconnect() { this.disconnects++; } });
  const context = {
    state: 'running', currentTime: 0, sampleRate: 48000,
    createBuffer(channels, length, rate) { const samples = new Float32Array(length), buffer = { duration: length / rate, getChannelData: () => samples }; buffers.push(buffer); return buffer; },
    createBufferSource() { const source = { ...node(), playbackRate: { value: 1 }, start() {}, stop() {}, onended: null }; sources.push(source); return source; },
    createGain() { return { ...node(), gain: { value: 0, setTargetAtTime() {} } }; },
    async close() { this.state = 'closed'; },
  };
  const audio = new GameAudio(); audio.enabled = true; audio.context = context; audio.master = context.createGain();
  return { audio, context, sources, buffers };
}

test('melee sound stays silent before explicit opt-in and rejects unknown weapons or invalid gain', () => {
  const muted = new GameAudio();
  for (const id of MELEE_IDS) assert.equal(muted.meleeSwing(id), false);
  assert.equal(muted.context, null);
  const { audio, context, sources, buffers } = enabledAudio();
  for (const id of ['carbine', '__proto__', 'constructor', null]) assert.equal(audio.meleeSwing(id), false);
  for (const gain of [0, -1, NaN, Infinity]) assert.equal(audio.meleeSwing('katana', { gain }), false);
  context.state = 'suspended'; assert.equal(audio.meleeSwing('katana'), false);
  assert.equal(sources.length, 0); assert.equal(buffers.length, 0);
});

test('each physical blade has one reusable cached sound and does not increment gun reports', () => {
  const { audio, sources, buffers } = enabledAudio();
  for (const id of MELEE_IDS) for (let index = 0; index < 3; index++) assert.equal(audio.meleeSwing(id, { gain: index ? .28 : 1 }), true);
  assert.equal(buffers.length, MELEE_IDS.length); assert.equal(sources.length, MELEE_IDS.length * 3);
  assert.equal(audio.inspectMelee().played, MELEE_IDS.length * 3); assert.equal(audio.inspectGunshots().played, 0);
  assert.equal(audio.inspectGunshots().cachedBuffers, 0); assert.equal(audio.inspectMelee().cachedBuffers, MELEE_IDS.length);
  for (let index = 0; index < MELEE_IDS.length; index++) assert.equal(sources[index * 3].buffer, sources[index * 3 + 2].buffer);
});

test('dense mixed sword and gun exchanges share one bounded voice pool and clean all sources', async () => {
  const { audio, sources } = enabledAudio();
  for (let index = 0; index < 240; index++) assert.equal(index % 2 ? audio.meleeSwing('tonfas') : audio.gunshot('dualsmg'), true);
  assert.equal(audio.inspectMelee().activeVoices, 24); assert.equal(audio.inspectGunshots().activeVoices, 24);
  assert.ok(sources.slice(0, -24).every(source => source.disconnects === 1));
  await audio.setEnabled(false); assert.equal(audio.inspectMelee().activeVoices, 0);
  assert.ok(sources.every(source => source.disconnects === 1));
  audio.destroy(); assert.equal(audio.inspectMelee().cachedBuffers, 0); assert.equal(audio.inspectGunshots().cachedBuffers, 0);
});

test('restart stops melee reports without discarding reusable samples or replaying them', () => {
  const { audio } = enabledAudio(); audio.meleeSwing('axe'); audio.resetEvents();
  assert.equal(audio.inspectMelee().activeVoices, 0); assert.equal(audio.inspectMelee().cachedBuffers, 1);
  assert.equal(audio.inspectMelee().played, 1); audio.destroy();
  assert.equal(audio.meleeSwing('axe'), false); assert.equal(audio.inspectMelee().cachedBuffers, 0);
});

test('katana, axe and dual-tonfa recovery readouts use the exact equipped profile', () => {
  for (const id of ['katana', 'axe', 'tonfas']) {
    const blade = MELEE_WEAPONS[id], total = blade.startupTicks + blade.activeTicks + blade.recoveryTicks;
    const player = { alive: true, hp: 200, weapon: 'carbine', hasGun: true, slot: 'sword', meleeWeapon: id, meleeTicks: total / 2, meleePhase: 'recovery', meleeCooldown: 0 };
    const breach = combatReadout(player, WEAPONS, { MELEE: MELEE_WEAPONS.sword, KNIFE: MELEE_WEAPONS.knife }), royale = royaleReadout(player);
    for (const readout of [breach, royale]) {
      assert.equal(readout.label, blade.label); assert.equal(readout.progress.total, total); assert.equal(readout.progress.percent, 50);
      assert.match(readout.progress.label.toLowerCase(), new RegExp(blade.label.toLowerCase()));
    }
  }
});

test('paired gun comparison explains alternating barrels and their real firing rhythm', () => {
  assert.match(weaponComparison('dualpistols').handling, /Alternating barrels.*one shot per click/);
  assert.match(weaponComparison('dualsmg').handling, /Alternating barrels.*close-range spread/);
});
