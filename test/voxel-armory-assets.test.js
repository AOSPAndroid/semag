import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WEAPONS } from '../public/voxel-weapons.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { weaponMeshes, meleeMeshes } from '../public/voxel-renderer.js';
import { createWeaponPreview, armoryPreviewDiagnostics } from '../public/voxel-armory-preview.js';

const art = new URL('../public/art/armory/', import.meta.url);
const entries = [...Object.keys(WEAPONS).map(id => ({ id, kind: 'gun', file: `${id}.webp` })),
  ...Object.keys(MELEE_WEAPONS).map(id => ({ id, kind: 'melee', file: `melee_${id}.webp` }))];

test('all 36 guns and five melee weapons have distinct transparent lossless cards from the actual meshes', async () => {
  const files = (await readdir(art)).filter(file => file.endsWith('.webp')).sort();
  assert.equal(entries.length, 41);
  assert.deepEqual(files, entries.map(entry => entry.file).sort());
  const manifest = JSON.parse(await readFile(new URL('manifest.json', art), 'utf8'));
  assert.equal(manifest.transparent, true);
  assert.equal(manifest.resources.contextsCreated, 1, 'one generator context renders the whole collection');
  assert.equal(manifest.resources.activeContexts, 0);
  const signatures = new Set();
  for (const item of entries) {
    const bytes = await readFile(new URL(item.file, art));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8L');
    assert.equal(bytes[20], 0x2f, 'lossless WebP signature');
    const dimensions = bytes.readUInt32LE(21);
    assert.equal((dimensions & 0x3fff) + 1, 640);
    assert.equal(((dimensions >>> 14) & 0x3fff) + 1, 360);
    assert.equal((dimensions >>> 28) & 1, 1, 'transparent alpha remains in the exported image');
    assert.ok(bytes.length < 20_000, `${item.id}: lightweight card`);
    signatures.add(bytes.toString('base64'));
    const record = manifest.items.find(record => record.file === item.file);
    const mesh = item.kind === 'gun' ? weaponMeshes(item.id) : meleeMeshes({ meleeWeapon: item.id });
    assert.equal(record.vertices, mesh.length / 10);
    assert.equal(record.meshSha256, createHash('sha256').update(new Uint8Array(mesh.buffer, mesh.byteOffset, mesh.byteLength)).digest('hex'), `${item.id}: regenerate art if its source geometry changes`);
    const [left, top, right, bottom] = record.alphaBounds;
    assert.ok(left > 1 && top > 1 && right < 639 && bottom < 359, `${item.id}: mesh is fully inside the image`);
  }
  assert.equal(signatures.size, 41, 'every card has its own rendered silhouette');
  const width = id => { const item = manifest.items.find(item => item.id === id && item.kind === 'gun'); return item.alphaBounds[2] - item.alphaBounds[0]; };
  assert.ok(width('classic') < width('operator') * .4, 'pistols preserve their short real geometry on the shared camera scale');
});

function fixture({ context = true, shaderValid = true } = {}) {
  const calls = [], handlers = new Map();
  let captured = null;
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => shaderValid;
    if (name === 'isContextLost') return () => false;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'getExtension') return () => ({ loseContext: () => calls.push(['loseContext']) });
    if (typeof name === 'string' && name.startsWith('create')) return () => { const object = {}; calls.push([name, object]); return object; };
    return (...args) => { calls.push([name, ...args]); };
  } });
  const canvas = {
    width: 360, height: 240,
    getContext: () => context ? gl : null,
    getBoundingClientRect: () => ({ width: 360, height: 240 }),
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: name => handlers.delete(name),
    setPointerCapture: id => { captured = id; },
    hasPointerCapture: id => captured === id,
    releasePointerCapture: () => { captured = null; },
    focus() {},
  };
  return { canvas, calls, handlers, emit(name, values) { let prevented = false; handlers.get(name)?.({ preventDefault() { prevented = true; }, ...values }); return prevented; } };
}

test('inspection reuses one context and buffer across the catalog, draws only on input, and releases every resource', async () => {
  const f = fixture(), before = { ...armoryPreviewDiagnostics };
  const preview = await createWeaponPreview(f.canvas, { weaponId: 'carbine', reducedMotion: true });
  assert.equal(armoryPreviewDiagnostics.activeContexts, before.activeContexts + 1);
  await assert.rejects(createWeaponPreview(f.canvas, { weaponId: 'classic' }), /already open/);
  for (const item of entries) {
    preview.setWeapon(item.id, item.kind);
    const uploaded = f.calls.filter(([name]) => name === 'bufferData').at(-1)[2];
    const expected = item.kind === 'gun' ? weaponMeshes(item.id) : meleeMeshes({ meleeWeapon: item.id });
    assert.deepEqual(uploaded, expected, `${item.id}: the pure gameplay mesh is uploaded unchanged`);
  }
  assert.equal(f.calls.filter(([name]) => name === 'createBuffer').length, 1);
  const initialRotation = f.calls.filter(([name]) => name === 'uniformMatrix3fv').at(-1)[3];
  assert.equal(f.emit('keydown', { key: 'ArrowRight' }), true);
  assert.notDeepEqual(f.calls.filter(([name]) => name === 'uniformMatrix3fv').at(-1)[3], initialRotation);
  f.emit('keydown', { key: 'Home' });
  assert.deepEqual(f.calls.filter(([name]) => name === 'uniformMatrix3fv').at(-1)[3], initialRotation);
  f.emit('pointerdown', { button: 0, pointerId: 7, clientX: 20, clientY: 20 });
  f.emit('pointermove', { pointerId: 7, clientX: 80, clientY: 35 });
  assert.notDeepEqual(f.calls.filter(([name]) => name === 'uniformMatrix3fv').at(-1)[3], initialRotation);
  f.canvas.getBoundingClientRect = () => ({ width: 8123, height: 4133 });
  preview.resize();
  assert.ok(f.canvas.width * f.canvas.height <= 2_000_000, 'oversized/high-DPI inspections have a bounded drawing buffer');
  preview.destroy(); preview.destroy();
  assert.equal(f.handlers.size, 0);
  assert.equal(f.calls.filter(([name]) => name === 'deleteBuffer').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'deleteProgram').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'deleteShader').length, 2);
  assert.equal(f.calls.filter(([name]) => name === 'loseContext').length, 1);
  assert.equal(armoryPreviewDiagnostics.activeContexts, before.activeContexts);
  assert.equal(armoryPreviewDiagnostics.contextsCreated - before.contextsCreated, 1);
  assert.equal(armoryPreviewDiagnostics.contextsReleased - before.contextsReleased, 1);
  const closedDraws = armoryPreviewDiagnostics.drawCalls;
  preview.setWeapon('pistol'); preview.resize(); preview.reset();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(armoryPreviewDiagnostics.drawCalls, closedDraws, 'a closed controller cannot schedule or draw frames');
  assert.equal(Object.isFrozen(armoryPreviewDiagnostics), true);
  assert.throws(() => { armoryPreviewDiagnostics.activeContexts = 100; }, TypeError);
});

test('unavailable graphics and failed shader startup release resources so the image fallback can remain usable', async () => {
  const before = { ...armoryPreviewDiagnostics };
  await assert.rejects(createWeaponPreview(fixture({ context: false }).canvas, { weaponId: 'carbine' }), /unavailable/);
  const broken = fixture({ shaderValid: false });
  await assert.rejects(createWeaponPreview(broken.canvas, { weaponId: 'carbine' }), /could not start/);
  assert.equal(armoryPreviewDiagnostics.activeContexts, before.activeContexts);
  assert.equal(broken.calls.filter(([name]) => name === 'deleteShader').length, 1);
  assert.equal(broken.calls.filter(([name]) => name === 'deleteProgram').length, 1);
  assert.equal(broken.calls.filter(([name]) => name === 'loseContext').length, 1);
  const f = fixture(); let reason;
  const preview = await createWeaponPreview(f.canvas, { weaponId: 'knife', kind: 'melee', onError: error => { reason = error; } });
  f.emit('webglcontextlost', {});
  assert.match(reason.message, /weapon image is still available/);
  assert.equal(armoryPreviewDiagnostics.activeContexts, before.activeContexts);
  assert.equal(f.handlers.size, 0);
  preview.destroy();
});
