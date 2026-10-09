import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../public/audio.js';

const cues = ['hordeFight', 'hordeClear', 'hordeRevive', 'hordeEnd', 'monsterWindup', 'monsterAim'];
function recorder() {
  const audio = new GameAudio(), voices = [];
  audio.tone = (frequency, duration, options = {}) => voices.push({ kind: 'tone', frequency, duration, ...options });
  audio.noise = (duration, options = {}) => voices.push({ kind: 'noise', duration, ...options });
  return { audio, voices };
}

test('horde attack and lifecycle cues are distinct, bounded, and never create an audio context implicitly', () => {
  const { audio, voices } = recorder(); audio.enabled = true;
  const signatures = new Set();
  for (let id = 0; id < cues.length; id++) {
    const start = voices.length;
    audio.playEvents([{ id, type: cues[id], monsterType: 'brute' }]);
    const cue = voices.slice(start);
    assert.ok(cue.length >= 1 && cue.length <= 3);
    assert.ok(cue.every(voice => voice.duration > 0 && voice.duration + (voice.delay || 0) <= 0.7 && voice.gain > 0 && voice.gain <= 0.3));
    signatures.add(JSON.stringify(cue));
  }
  assert.equal(signatures.size, cues.length);
  assert.equal(audio.context, null);
  const count = voices.length;
  audio.playEvents(cues.map((type, id) => ({ id, type })));
  assert.equal(voices.length, count, 'repeated snapshots cannot replay warning sounds');
});

test('muted horde attacks remain consumed and the event journal stays bounded through endless waves', () => {
  const { audio, voices } = recorder();
  audio.playEvents([{ id: 1, type: 'monsterAim' }]);
  audio.enabled = true; audio.playEvents([{ id: 1, type: 'monsterAim' }]);
  assert.equal(voices.length, 0, 'turning sound on cannot play a stale aimed shot warning');
  for (let id = 2; id <= 2000; id++) audio.playEvents([{ id, type: cues[id % cues.length] }]);
  assert.equal(audio.seen.size, 512); assert.equal(audio.seenOrder.length, 512);
  audio.resetEvents(); assert.equal(audio.seen.size, 0); assert.equal(audio.seenOrder.length, 0);
});

test('an unavailable sound voice cannot interrupt the following gameplay event', () => {
  const { audio, voices } = recorder(); audio.enabled = true;
  audio.noise = () => { throw new Error('audio unavailable'); };
  assert.doesNotThrow(() => audio.playEvents([{ id: 1, type: 'monsterWindup' }, { id: 2, type: 'hordeRevive' }]));
  assert.ok(voices.length > 0); assert.ok(audio.seen.has(1) && audio.seen.has(2));
});
