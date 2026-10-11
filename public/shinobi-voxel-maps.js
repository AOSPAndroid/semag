/** Three authored close-combat arenas. All visible cover is physical geometry. */
const freeze = Object.freeze;
const box = (id, x, y, z, w, h, d, color, material, extra = {}) => freeze({ id, x, y, z, w, h, d, color, material, ...extra });
const pose = (x, z, yaw = 0, y = 0) => freeze({ x, y, z, yaw });
const paint = (kind, x, z, w, d, color, y = .003) => freeze({ kind, x, y, z, w, d, color });
function walls(id, bounds, height = 4) {
  const { minX, maxX, minZ, maxZ } = bounds;
  return [box(`${id}-west`, minX - .6, 0, minZ - .6, .6, height, maxZ - minZ + 1.2, '#b6a791', 'dojo-plaster'), box(`${id}-east`, maxX, 0, minZ - .6, .6, height, maxZ - minZ + 1.2, '#b6a791', 'dojo-plaster'), box(`${id}-north`, minX, 0, minZ - .6, maxX - minX, height, .6, '#a3937d', 'dojo-plaster'), box(`${id}-south`, minX, 0, maxZ, maxX - minX, height, .6, '#a3937d', 'dojo-plaster')];
}
function stair(id, colliders, x, z, count, { dx = 0, dz = -1, width = 2.4, depth = 1.5 } = {}) {
  const steps = [];
  for (let i = 0; i < count; i++) {
    const bx = x + dx * i * depth, bz = z + dz * i * depth, colliderId = `${id}-${i}`, y = (i + 1) * .6;
    colliders.push(box(colliderId, bx, 0, bz, dx ? depth : width, y, dx ? width : depth, '#956440', 'dojo-cedar'));
    steps.push(freeze({ x: bx + (dx ? depth : width) / 2, y, z: bz + (dx ? width : depth) / 2, colliderId }));
  }
  return freeze(steps);
}
function lantern(colliders, id, x, z) {
  colliders.push(box(`${id}-base`, x - .38, 0, z - .38, .76, .24, .76, '#827c6c', 'dojo-stone'), box(`${id}-stem`, x - .14, .24, z - .14, .28, .78, .28, '#827c6c', 'dojo-stone'), box(`${id}-lamp`, x - .28, 1.02, z - .28, .56, .48, .56, '#efca82', 'lantern'), box(`${id}-cap`, x - .43, 1.5, z - .43, .86, .18, .86, '#55594f', 'dojo-stone'));
}
function finalize(id, name, description, bounds, colliders, decorations, spawns, routes, colors, ceilings = []) {
  return freeze({ id, name, description, theme: 'dojo', mode: 'shinobi', bounds: freeze(bounds), colliders: freeze(colliders), decorations: freeze(decorations), spawns: freeze(spawns.map(freeze)), routes: freeze(routes), sites: freeze([]), buildings: freeze([]), landmarks: freeze([]), tunnels: freeze([]), ceilings: freeze(ceilings), floorColor: colors[0], skyColor: colors[1] });
}
function courtyard() {
  const id = 'shinobi-courtyard', bounds = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 }, colliders = walls(id, bounds, 3.8);
  colliders.push(box(`${id}-garden-plinth`, -2.4, 0, -1.8, 4.8, .65, 3.6, '#8c8874', 'dojo-stone'), box(`${id}-west-screen`, -8.4, 0, -1, .35, 2.2, 4.8, '#ddd0aa', 'shoji'), box(`${id}-east-stone`, 6.3, 0, 3, 2.2, 1.15, 1.8, '#817e72', 'dojo-stone'), box(`${id}-north-deck`, -5, 1.48, -12.5, 10, .32, 4.5, '#825b3a', 'dojo-cedar'), box(`${id}-deck-west-post`, -4.8, 0, -12, .45, 1.48, .45, '#724a2d', 'dojo-cedar'), box(`${id}-deck-east-post`, 4.35, 0, -12, .45, 1.48, .45, '#724a2d', 'dojo-cedar'));
  const steps = stair(`${id}-stairs`, colliders, -1.2, -5, 3);
  colliders.push(box(`${id}-torii-west`, -3.8, 1.8, -11.8, .45, 3.7, .45, '#ac4535', 'torii'), box(`${id}-torii-east`, 3.35, 1.8, -11.8, .45, 3.7, .45, '#ac4535', 'torii'), box(`${id}-torii-lintel`, -4.3, 5, -11.9, 8.6, .35, .65, '#ac4535', 'torii'), box(`${id}-torii-cap`, -4.7, 5.6, -12.1, 9.4, .22, 1.05, '#353c39', 'dojo-roof', { overhead: true }));
  for (const [i, x, z] of [[0, -11, -9], [1, 10.5, -8.5], [2, -11, 8.5]]) {
    colliders.push(box(`${id}-cherry-${i}-trunk`, x - .22, 0, z - .22, .44, 3.1, .44, '#684c3c', 'bark'), box(`${id}-cherry-${i}-canopy`, x - 1.8, 3.1, z - 1.6, 3.6, 1.2, 3.2, '#cd929c', 'cherry-foliage', { overhead: true }), box(`${id}-cherry-${i}-crown`, x - 1.2, 4.3, z - 1.1, 2.4, .7, 2.2, '#e4b2ad', 'cherry-foliage', { overhead: true }));
  }
  lantern(colliders, `${id}-lantern-west`, -5.5, 5.5); lantern(colliders, `${id}-lantern-east`, 9, 8);
  const decorations = [paint('stone-path', -1.5, -4, 3, 17.5, '#b1a794'), paint('gravel-garden', -13.5, -13.5, 6, 19, '#9d9986'), paint('dojo-tatami-border', 4.3, -7, 6, 5, '#3e5145'), paint('dojo-tatami', 4.55, -6.75, 5.5, 4.5, '#a5a27c'), paint('cedar-floor', -5, -12.5, 10, 4.5, '#a8794a', 1.804)];
  return finalize(id, 'Sakura Courtyard', 'Cherry trees frame asymmetric shoji cover and a vaultable stone ring. Climb three cedar steps to the raised torii deck.', bounds, colliders, decorations, [[pose(0, 10)], [pose(0, -10, Math.PI, 1.8), pose(-9, -5, Math.PI), pose(9, -5, Math.PI), pose(4, -10, Math.PI, 1.8)]], [freeze({ id: `${id}-torii-route`, name: 'Torii deck', start: pose(0, -3), steps, approach: freeze([]), destination: pose(0, -10, 0, 1.8) })], ['#a49e8b', '#bfcacc']);
}
function rooftops() {
  const id = 'shinobi-rooftops', bounds = { minX: -20, maxX: 20, minZ: -12, maxZ: 12 }, colliders = walls(id, bounds, 6.5);
  // Roof banks leave a real central alley beneath the north connecting bridge.
  colliders.push(box(`${id}-west-roof`, -19, 2.08, -10, 12, .32, 17, '#475556', 'dojo-roof'), box(`${id}-east-roof`, 7, 2.08, -10, 12, .32, 17, '#475556', 'dojo-roof'), box(`${id}-north-bridge`, -7, 2.08, -9.5, 14, .32, 3.8, '#885c3b', 'dojo-cedar'));
  for (const [side, x] of [['west', -18.8], ['east', 18.3]]) for (const [i, z] of [-9.5, -2, 5.8].entries()) colliders.push(box(`${id}-${side}-post-${i}`, x, 0, z, .5, 2.08, .5, '#6c4935', 'dojo-cedar'));
  colliders.push(box(`${id}-west-chimney`, -12.8, 2.4, -3.2, 1.8, 2, 1.8, '#8c7969', 'dojo-stone'), box(`${id}-east-chimney`, 12.5, 2.4, 1, 1.8, 2, 1.8, '#8c7969', 'dojo-stone'), box(`${id}-alley-baffle`, -1.7, 0, -1, 3.4, 1.3, 1.3, '#886244', 'crate'), box(`${id}-alley-west-low`, -5.2, 0, 4.8, 2.3, .55, 2.1, '#97633f', 'crate'), box(`${id}-alley-east-low`, 3.2, 0, -4.7, 2.1, .55, 2.1, '#97633f', 'crate'));
  const westSteps = stair(`${id}-west-stairs`, colliders, -15.5, 9.8, 4), eastSteps = stair(`${id}-east-stairs`, colliders, 11.5, 9.8, 4);
  // Keep the inside roof edges open for aggressive drops into the alley.
  colliders.push(box(`${id}-bridge-north-rail`, -7, 2.4, -9.5, 14, .65, .18, '#633f2b', 'dojo-cedar'));
  for (const [i, x] of [-4.2, 4.2].entries()) colliders.push(box(`${id}-hanging-lantern-${i}`, x - .28, 3.3, -8, .56, .7, .56, '#e7b878', 'lantern', { overhead: true }));
  const decorations = [paint('stone-path', -6.8, -11.5, 13.6, 23, '#746f67'), paint('cedar-floor', -7, -9.5, 14, 3.8, '#ad7a4c', 2.405), paint('dojo-tatami-border', -17, -8, 6, 3.5, '#384c4d', 2.403), paint('dojo-tatami-border', 10, 2.5, 6, 3.5, '#384c4d', 2.403)];
  const routes = [freeze({ id: `${id}-west-route`, name: 'West roof climb', start: pose(-14.3, 11.65), steps: westSteps, approach: freeze([]), destination: pose(-14.3, 3, 0, 2.4) }), freeze({ id: `${id}-east-route`, name: 'East roof climb', start: pose(12.7, 11.65), steps: eastSteps, approach: freeze([]), destination: pose(12.7, 4, 0, 2.4) })];
  return finalize(id, 'Moonlit Roofwalk', 'Two raised roof banks join over an open alley. Jump the cedar stair chains, duel around chimneys, and drop through the inside edges.', bounds, colliders, decorations, [[pose(-3.8, 8.5)], [pose(3.8, -8.5, Math.PI), pose(12.2, -7, Math.PI, 2.4), pose(-14, -7, Math.PI, 2.4), pose(3.8, 2.5, Math.PI)]], routes, ['#6e756f', '#1b293a']);
}
function dojo() {
  const id = 'shinobi-dojo', bounds = { minX: -16, maxX: 16, minZ: -18, maxZ: 18 }, colliders = walls(id, bounds, 6.5);
  colliders.push(box(`${id}-roof`, -16, 6.5, -18, 32, .32, 36, '#343d3b', 'dojo-roof', { overhead: true }), box(`${id}-east-gallery`, 10.5, 2.08, -15, 4.8, .32, 25, '#815331', 'dojo-cedar'));
  for (const [i, x, z] of [[0, -7, -8], [1, 3, -8], [2, -7, 6], [3, 3, 6], [4, 11, -13], [5, 11, 8]]) {
    colliders.push(box(`${id}-pillar-${i}`, x, 0, z, .6, 6.5, .6, '#785031', 'dojo-cedar'), box(`${id}-hanging-lantern-${i}`, x + .9, 4.6, z, .65, .8, .65, '#e5ba75', 'lantern', { overhead: true }));
  }
  colliders.push(box(`${id}-west-shoji-one`, -13, 0, -5, 6.2, 2.8, .28, '#e0d4b5', 'shoji'), box(`${id}-west-shoji-two`, -9.5, 0, 1.8, .28, 2.8, 5.2, '#e0d4b5', 'shoji'), box(`${id}-centre-divider`, -.3, 0, -2.8, .3, 1.4, 5.6, '#bd9f6d', 'shoji'), box(`${id}-altar-low`, -3.2, 0, -15.5, 6.4, .65, 2.6, '#8b603b', 'dojo-cedar'), box(`${id}-gallery-outer-rail`, 15.1, 2.4, -15, .18, .7, 25, '#61412b', 'dojo-cedar'));
  const steps = stair(`${id}-gallery-stairs`, colliders, 11, 14.5, 4);
  const decorations = [paint('cedar-floor', -16, -18, 32, 36, '#855e3e', 0), paint('dojo-tatami-border', -6.4, -6, 12.8, 12, '#3b4d40'), paint('dojo-tatami', -6.1, -5.7, 12.2, 11.4, '#aba57c'), paint('cedar-floor', 10.5, -15, 4.8, 25, '#a67b4c', 2.404)];
  const routes = [freeze({ id: `${id}-gallery-route`, name: 'Lantern gallery', start: pose(12.2, 16.6), approach: freeze([]), steps, destination: pose(12.2, 0, 0, 2.4) })];
  return finalize(id, 'Lantern Dojo', 'A close cedar hall with staggered shoji screens, real pillars and a full-height east gallery. Corner feints and short throws reward precise timing.', bounds, colliders, decorations, [[pose(-3.5, 12)], [pose(3.5, -12, Math.PI), pose(-12, -12, Math.PI), pose(12.5, -10, Math.PI, 2.4), pose(6.5, -11, Math.PI)]], routes, ['#6f5941', '#202c32'], [`${id}-roof`]);
}
export const MAPS = freeze(Object.fromEntries([courtyard(), rooftops(), dojo()].map(map => [map.id, map])));
export const MAP_IDS = freeze(Object.keys(MAPS));
