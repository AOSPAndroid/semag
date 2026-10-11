import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, togglePause } from '../public/solo/ember-engine.js';
import { EmberVoxelRenderer, EmberEffectMesh, appendEmberTelegraphs } from '../public/solo/ember-voxel-renderer.js';

function graphicsFixture() {
  const buffers = new Set(), uploads = [], calls = [], listeners = new Map(); let serial = 0, bound = null;
  const gl = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, DYNAMIC_DRAW: 6, STATIC_DRAW: 7, DEPTH_TEST: 8, LEQUAL: 9, CULL_FACE: 10, FLOAT: 11, TRIANGLES: 12, COLOR_BUFFER_BIT: 1, DEPTH_BUFFER_BIT: 2, BLEND: 13, SRC_ALPHA: 14, ONE: 15,
    createShader: () => ({}), shaderSource() {}, compileShader() {}, getShaderParameter: () => true, getShaderInfoLog: () => '', deleteShader() {}, createProgram: () => ({}), attachShader() {}, linkProgram() {}, getProgramParameter: () => true, getProgramInfoLog: () => '', deleteProgram() {}, getAttribLocation: (_, name) => ({ aPosition: 0, aNormal: 1, aColor: 2 })[name], getUniformLocation: (_, name) => name,
    createBuffer() { const b = { id: ++serial }; buffers.add(b); return b; }, deleteBuffer: b => buffers.delete(b), bindBuffer(_, b) { bound = b; }, bufferData(_, data) { if (typeof data !== 'number') uploads.push([...data]); }, bufferSubData(_, offset, data) { assert.ok(buffers.has(bound)); uploads.push([...data]); }, enable: flag => calls.push(['enable', flag]), disable() {}, depthFunc() {}, viewport() {}, enableVertexAttribArray() {}, vertexAttribPointer() {}, uniform1f() {}, uniform3fv(_, v) { assert.ok([...v].every(Number.isFinite)); }, uniformMatrix4fv(_, __, v) { assert.ok([...v].every(Number.isFinite)); }, drawArrays: (_, offset, count) => calls.push(['draw', count]), clearColor() {}, clear() {}, useProgram() {}, depthMask: value => calls.push(['depthMask', value]), blendFunc() {},
  };
  const canvas = { width: 960, height: 540, getContext: () => gl, getBoundingClientRect: () => ({ left: 40, top: 20, width: 960, height: 540 }), addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: type => listeners.delete(type) };
  return { canvas, gl, buffers, uploads, calls, listeners };
}

test('real dungeon snapshots produce finite depth-tested meshes without changing simulation', () => {
  const fixture = graphicsFixture(), renderer = new EmberVoxelRenderer(fixture.canvas), state = createState({ seed: 38, difficulty: 'veteran' });
  assert.equal(renderer.available, true);
  for (let i = 0; i < 80; i++) {
    step(state, { moveX: 1, aimX: 1, aimY: 0, melee: i % 41 === 0, spell: i % 15 === 0 });
    const before = JSON.stringify(state); renderer.render(state, { yaw: Math.PI / 2 }); assert.equal(JSON.stringify(state), before);
  }
  const diagnostic = renderer.diagnostics;
  assert.equal(diagnostic.backend, 'webgl'); assert.equal(diagnostic.staticBuilds, 1); assert.equal(diagnostic.gpuBuffers, 4); assert.equal(diagnostic.drawCalls, 4);
  assert.ok(diagnostic.heroVisible); assert.ok(diagnostic.roomVertices > 12000 && diagnostic.roomVertices < 60000);
  assert.ok(diagnostic.actorVertices > 2000 && diagnostic.actorVertices < 50000); assert.ok(diagnostic.effectVertices > 0 && diagnostic.effectVertices < 60000);
  assert.ok(fixture.uploads.every(vertices => vertices.length % 9 === 0 && vertices.every(Number.isFinite)));
  assert.ok(fixture.calls.some(([kind, value]) => kind === 'enable' && value === fixture.gl.DEPTH_TEST));
  const aim = renderer.screenGroundDirection(520, 290, state, { yaw: Math.PI / 2 }); assert.ok(Math.abs(Math.hypot(aim.x, aim.y) - 1) < 1e-9);
  togglePause(state); renderer.render(state); const frozen = fixture.uploads.slice(-3).map(v => JSON.stringify(v));
  renderer.render(state, { time: 200 }); assert.deepEqual(fixture.uploads.slice(-3).map(v => JSON.stringify(v)), frozen);
  renderer.destroy(); assert.equal(fixture.buffers.size, 0); assert.equal(fixture.listeners.size, 0); assert.equal(renderer.render(state), false);
});

test('room cache and simultaneous kill fragments remain bounded across a long descent', () => {
  const fixture = graphicsFixture(), renderer = new EmberVoxelRenderer(fixture.canvas), state = createState({ seed: 17 });
  for (let room = 0; room < 8; room++) { state.room.id = `1-${room}-combat`; renderer.render(state, { yaw: Math.PI / 2 }); }
  assert.equal(renderer.diagnostics.roomCache, 3); assert.equal(fixture.buffers.size, 6);
  const dead = [...state.enemies]; state.enemies = []; state.elapsed += .01;
  for (const enemy of dead) state.events.push({ id: ++state.eventId, type: 'kill', x: enemy.x, y: enemy.y, time: state.elapsed, boss: enemy.boss });
  renderer.render(state, { yaw: Math.PI / 2 }); assert.ok(renderer.diagnostics.corpses > 0);
  const bornMesh = fixture.uploads.at(-3);
  state.elapsed += .20; renderer.render(state, { yaw: Math.PI / 2 }); assert.notDeepEqual(fixture.uploads.at(-3), bornMesh, 'kills produce a visible collapsing body before disintegration');
  assert.ok(renderer.diagnostics.particles <= 144); assert.ok(renderer.diagnostics.corpses <= 8);
  state.elapsed += .70; renderer.render(state, { yaw: Math.PI / 2 }); assert.equal(renderer.diagnostics.corpses, 0); assert.equal(renderer.diagnostics.particles, 0);
  renderer.destroy(); assert.equal(fixture.buffers.size, 0);
});

test('charge, fault and fan telegraphs use committed engine ground dimensions', () => {
  const state = createState({ seed: 10 }), mesh = new EmberEffectMesh();
  state.enemies = [{ x: 480, y: 320, radius: 18, aimX: 1, aimY: 0, phase: 'tell', tell: 'charge', timer: .5, tellDuration: 1, chargeSpeed: 550, chargeDuration: .42 }];
  appendEmberTelegraphs(mesh, state); const vertices = [...mesh.data];
  const x = vertices.filter((_, i) => i % 9 === 0), z = vertices.filter((_, i) => i % 9 === 2);
  assert.ok(Math.abs(Math.max(...x) - (480 + 550 * .42) / 32) < .06); assert.ok(Math.abs(Math.max(...z) - (320 + 28) / 32) < .06);
  state.enemies[0] = { ...state.enemies[0], tell: 'fault', targets: [{ x: 240, y: 120, radius: 78 }] };
  appendEmberTelegraphs(mesh.clear(), state); const distances = [];
  for (let i = 0; i < mesh.data.length; i += 9) distances.push(Math.hypot(mesh.data[i] - 240 / 32, mesh.data[i + 2] - 120 / 32));
  assert.ok(Math.max(...distances) > 78 / 32 && Math.max(...distances) < 78 / 32 + .17);
  state.enemies[0] = { ...state.enemies[0], tell: 'fan', fanCount: 7, fanSpread: .14 };
  appendEmberTelegraphs(mesh.clear(), state); assert.equal(mesh.length / 9, 7 * 6); assert.ok([...mesh.data].every(Number.isFinite));
});
