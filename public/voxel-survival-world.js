/** Bounded, seeded block world. Cells are addressed at their lower corner. */
export const WORLD_SIZE = 40;
export const WORLD_HEIGHT = 20;
export const CHUNK_SIZE = 8;
export const BLOCKS = Object.freeze({
  0: Object.freeze({ id: 0, key: 'air', name: 'Air', color: '#b7d2da', solid: false, hardness: 0 }),
  1: Object.freeze({ id: 1, key: 'bedrock', name: 'Bedrock', color: '#303b42', solid: true, hardness: Infinity }),
  2: Object.freeze({ id: 2, key: 'dirt', name: 'Earth', color: '#836044', solid: true, hardness: .65, item: 'dirt' }),
  3: Object.freeze({ id: 3, key: 'grass', name: 'Meadow', color: '#6a9457', solid: true, hardness: .7, item: 'dirt' }),
  4: Object.freeze({ id: 4, key: 'stone', name: 'Stone', color: '#85919b', solid: true, hardness: 1.65, item: 'stone' }),
  5: Object.freeze({ id: 5, key: 'wood', name: 'Cedar', color: '#846647', solid: true, hardness: 1.15, item: 'wood' }),
  6: Object.freeze({ id: 6, key: 'leaves', name: 'Cedar needles', color: '#4d7351', solid: true, hardness: .35, item: 'fiber' }),
  7: Object.freeze({ id: 7, key: 'coal', name: 'Coal seam', color: '#4c545d', solid: true, hardness: 2.1, item: 'coal' }),
  8: Object.freeze({ id: 8, key: 'iron', name: 'Iron seam', color: '#a99584', solid: true, hardness: 2.8, item: 'iron-ore', tier: 1 }),
  9: Object.freeze({ id: 9, key: 'plank', name: 'Cedar planks', color: '#bc9660', solid: true, hardness: .85, item: 'plank' }),
  10: Object.freeze({ id: 10, key: 'workbench', name: 'Workbench', color: '#99764e', solid: true, hardness: 1.1, item: 'workbench' }),
  11: Object.freeze({ id: 11, key: 'campfire', name: 'Campfire', color: '#dd9b57', solid: true, hardness: .9, item: 'campfire' }),
  12: Object.freeze({ id: 12, key: 'torch', name: 'Lantern', color: '#f0c06b', solid: true, hardness: .25, item: 'torch' }),
  13: Object.freeze({ id: 13, key: 'berries', name: 'Berry shrub', color: '#9b566a', solid: true, hardness: .3, item: 'berries', count: 3 }),
});

export function seedValue(value = 'wilds') {
  if (Number.isInteger(value)) return value >>> 0 || 1;
  const text = String(value).slice(0, 128); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0 || 1;
}
export function randomValue(state) {
  let value = state.rng >>> 0; value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.rng = value >>> 0 || 1; return state.rng / 4294967296;
}
export const blockIndex = (world, x, y, z) => x + world.width * (z + world.depth * y);
export const inBounds = (world, x, y, z) => Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) && x >= 0 && x < world.width && z >= 0 && z < world.depth && y >= 0 && y < world.height;
export function getWorldBlock(world, x, y, z) {
  return inBounds(world, x, y, z) ? world.blocks[blockIndex(world, x, y, z)] : 0;
}
export function setWorldBlock(world, x, y, z, id) {
  if (!inBounds(world, x, y, z) || !Object.hasOwn(BLOCKS, id)) return false;
  const index = blockIndex(world, x, y, z); if (world.blocks[index] === id) return false;
  world.blocks[index] = id; world.revision++;
  const columns = Math.ceil(world.width / world.chunkSize), cz = Math.floor(z / world.chunkSize), cx = Math.floor(x / world.chunkSize);
  const touch = (a, b) => { if (a >= 0 && b >= 0 && a < columns && b < Math.ceil(world.depth / world.chunkSize)) world.chunkRevisions[a + columns * b] = world.revision; };
  touch(cx, cz);
  // Exposed faces in adjacent chunks also change at chunk boundaries.
  if (x % world.chunkSize === 0) touch(cx - 1, cz);
  if (x % world.chunkSize === world.chunkSize - 1) touch(cx + 1, cz);
  if (z % world.chunkSize === 0) touch(cx, cz - 1);
  if (z % world.chunkSize === world.chunkSize - 1) touch(cx, cz + 1);
  // Corner ambient occlusion reads diagonally across both boundaries.
  const neighborX = x % world.chunkSize === 0 ? cx - 1 : x % world.chunkSize === world.chunkSize - 1 ? cx + 1 : cx;
  const neighborZ = z % world.chunkSize === 0 ? cz - 1 : z % world.chunkSize === world.chunkSize - 1 ? cz + 1 : cz;
  touch(neighborX, neighborZ);
  return true;
}
export function surfaceHeight(world, x, z) {
  if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= world.width || z >= world.depth) return 0;
  for (let y = world.height - 1; y >= 0; y--) if (getWorldBlock(world, x, y, z)) return y + 1;
  return 0;
}
export function createWorld(seed) {
  const width = WORLD_SIZE, height = WORLD_HEIGHT, depth = WORLD_SIZE;
  const world = { width, height, depth, sizeX: width, sizeY: height, sizeZ: depth, blocks: new Uint8Array(width * height * depth), revision: 1, chunkSize: CHUNK_SIZE, chunkRevisions: new Uint32Array(25).fill(1) };
  const random = { rng: seedValue(seed) }, heights = new Uint8Array(width * depth);
  const put = (x, y, z, id) => { if (inBounds(world, x, y, z)) world.blocks[blockIndex(world, x, y, z)] = id; };
  const offset = (random.rng % 997) / 71;
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
    const distance = Math.hypot(x - 20, z - 20);
    const top = distance < 6 ? 3 : Math.max(2, Math.min(7, Math.round(3.8 + Math.sin(x / 5.3 + offset) * 1.2 + Math.cos(z / 6.7 - offset) * 1.4 + Math.sin((x + z) / 4.6) * .65)));
    heights[x + width * z] = top;
    for (let y = 0; y <= top; y++) {
      let id = y === 0 ? 1 : y === top ? 3 : y === top - 1 ? 2 : 4;
      if (id === 4) { const r = randomValue(random); if (r < .09) id = 7; else if (r < .14) id = 8; }
      put(x, y, z, id);
    }
  }
  const tree = (x, z) => {
    const base = heights[x + width * z] + 1;
    for (let y = base; y < base + 4; y++) put(x, y, z, 5);
    for (let y = base + 3; y <= base + 5; y++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > (y === base + 5 ? 1 : 3) || (dx === 0 && dz === 0 && y === base + 3)) continue;
      if (!getWorldBlock(world, x + dx, y, z + dz)) put(x + dx, y, z + dz, 6);
    }
  };
  for (let z = 3; z < depth - 3; z += 5) for (let x = 3; x < width - 3; x += 5) {
    const tx = x + Math.floor(randomValue(random) * 2), tz = z + Math.floor(randomValue(random) * 2);
    if (Math.hypot(tx - 20, tz - 20) > 7 && randomValue(random) < .7) tree(tx, tz);
  }
  // A nearby cedar and visible ore bank make the first tools learnable without
  // gifting blocks. The standing player faces the tree, four metres away.
  tree(20, 16); tree(24, 20);
  for (const [x, z] of [[17, 18], [24, 24], [14, 22], [21, 25]]) put(x, heights[x + width * z] + 1, z, 13);
  for (let z = 5; z < 37; z += 8) for (let x = 5; x < 37; x += 8) {
    const y = heights[x + width * z] + 1;
    if (!getWorldBlock(world, x, y, z) && Math.hypot(x - 20, z - 20) > 7) put(x, y, z, 13);
  }
  for (let x = 9; x <= 13; x++) for (let z = 15; z <= 18; z++) {
    const y = heights[x + width * z] + 1; put(x, y, z, (x + z) % 7 === 0 ? 8 : (x + z) % 4 === 0 ? 7 : 4);
    if (x === 10 || x === 11) put(x, y + 1, z, 4);
  }
  // Half-collapsed stone refuge: useful cover, never a free sealed fortress.
  for (let x = 28; x <= 32; x++) for (let z = 9; z <= 13; z++) {
    if (x !== 28 && x !== 32 && z !== 9 && z !== 13) continue;
    if (z === 13 && x === 30) continue;
    const base = heights[x + width * z] + 1;
    for (let y = base; y < base + 2 + ((x + z) % 2); y++) put(x, y, z, 4);
  }
  return world;
}
