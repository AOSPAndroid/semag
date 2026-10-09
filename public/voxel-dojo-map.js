/** A quiet, physically authored courtyard for the standalone Voxel Dojo.
 * Kept out of competitive map registries: training never changes PvP geometry.
 */
const box = (id, x, y, z, w, h, d, color, material, extra = {}) =>
  Object.freeze({ id, x, y, z, w, h, d, color, material, ...extra });
const pose = (x, z, yaw = 0, y = 0) => Object.freeze({ x, y, z, yaw });
const paint = (kind, x, z, w, d, color, y = 0) => Object.freeze({ kind, x, y, z, w, d, color });

export const DOJO_PLAYER_SPAWN = pose(0, 12);

export const DOJO_STATIONS = Object.freeze([
  ['gun', 'Gun rack', 'GUNS', -9],
  ['blade', 'Blade rack', 'BLADES', -3],
  ['supplies', 'Supply bench', 'SUPPLIES', 3],
  ['recovery', 'Recovery bench', 'RECOVER', 9],
].map(([id, name, label, x]) => Object.freeze({
  id, name, label, x, y: 0, z: 12, radius: 2.2, interactionRadius: 2.2,
  // The display rests on the real bench, rather than floating at the E prompt.
  display: pose(x, 13.3, Math.PI, .9),
  colliderId: `dojo-station-${id}-bench`,
})));

export const DOJO_TARGET_SPAWNS = Object.freeze([
  pose(-7, 5, Math.PI),
  pose(-7, -2, Math.PI),
  pose(0, -10, Math.PI),
  pose(7, -20, Math.PI),
  pose(-7, -26, Math.PI),
]);

export const DOJO_RANGE_LANES = Object.freeze([
  Object.freeze({ id: 'blade-pad', name: 'Close combat', distance: 2.3,
    origin: pose(-7, 7.3), targetIndex: 0, target: DOJO_TARGET_SPAWNS[0] }),
  Object.freeze({ id: 'range-10', name: '10 m', distance: 10,
    origin: pose(-7, 8), targetIndex: 1, target: DOJO_TARGET_SPAWNS[1] }),
  Object.freeze({ id: 'range-20', name: '20 m', distance: 20,
    origin: pose(0, 10), targetIndex: 2, target: DOJO_TARGET_SPAWNS[2] }),
  Object.freeze({ id: 'range-30', name: '30 m', distance: 30,
    origin: pose(7, 10), targetIndex: 3, target: DOJO_TARGET_SPAWNS[3] }),
]);

const colliders = [
  box('dojo-west-wall', -21, 0, -33, 1, 3.8, 54, '#c3b6a2', 'dojo-plaster'),
  box('dojo-east-wall', 20, 0, -33, 1, 3.8, 54, '#c3b6a2', 'dojo-plaster'),
  box('dojo-north-wall', -20, 0, -33, 40, 5.2, 1, '#ac9b85', 'dojo-plaster'),
  box('dojo-south-wall', -20, 0, 20, 40, 3.8, 1, '#c3b6a2', 'dojo-plaster'),
];

// One airy cedar hall houses the four safe stations. Its five-metre eaves
// leave the spawn and firing approaches clear even at the jump apex.
for (const [side, x] of [['west', -14.3], ['east', 13.8]]) {
  for (const [edge, z] of [['front', 10.6], ['rear', 18.7]])
    colliders.push(box(`dojo-hall-${side}-${edge}-post`, x, 0, z, .5, 5, .5, '#875533', 'dojo-cedar'));
  colliders.push(box(`dojo-hall-beam-${side}`, x, 4.5, 10.6, .5, .5, 8.6, '#774529', 'dojo-cedar'));
}
colliders.push(box('dojo-hall-roof', -14.8, 5, 10.2, 29.6, .32, 9.6, '#323939', 'dojo-roof', { overhead: true }));
for (let index = 0; index < 6; index++)
  colliders.push(box(`dojo-hall-shoji-${index}`, -13.6 + index * 4.6, 0, 19.2, 4.2, 3.6, .18, '#e4dbc5', 'shoji'));

for (const station of DOJO_STATIONS) {
  const x = station.x - 1.8, z = 13.2;
  colliders.push(box(station.colliderId, x, .68, z, 3.6, .2, 1.15, '#97633b', 'dojo-cedar'));
  for (const [index, [dx, dz]] of [[.15, .12], [3.23, .12], [.15, .81], [3.23, .81]].entries())
    colliders.push(box(`dojo-station-${station.id}-leg-${index}`, x + dx, 0, z + dz, .22, .68, .22, '#68482f', 'dojo-cedar'));
}

// The torii frames the distant end of the range without filling its opening.
colliders.push(
  box('dojo-torii-post-west', -3.65, 0, -29.3, .5, 4.5, .5, '#b34c38', 'torii'),
  box('dojo-torii-post-east', 3.15, 0, -29.3, .5, 4.5, .5, '#b34c38', 'torii'),
  box('dojo-torii-lintel', -4.1, 3.8, -29.36, 8.2, .35, .62, '#b34c38', 'torii'),
  box('dojo-torii-cap', -4.55, 4.48, -29.5, 9.1, .3, .9, '#343734', 'dojo-roof', { overhead: true }),
  box('dojo-shrine-plinth', -2.9, 0, -31.8, 5.8, .34, 1.55, '#81786b', 'dojo-stone'),
  box('dojo-shrine-back', -2.4, .34, -31.8, 4.8, 3.4, .3, '#8b5b39', 'dojo-cedar'),
  box('dojo-shrine-roof', -2.75, 3.74, -31.95, 5.5, .24, 1.7, '#3b413d', 'dojo-roof', { overhead: true }),
  box('dojo-shrine-altar', -1.2, .34, -31.15, 2.4, .76, .8, '#926342', 'dojo-cedar'),
);

// Cherry trees and stone lanterns line the perimeter, leaving central lanes
// and the walkable tatami pad open. Their silhouettes also stop real shots.
for (const [side, centerX] of [['west', -16], ['east', 16]]) {
  for (const [edge, centerZ] of [['near', -10.5], ['far', -23]]) {
    const id = `dojo-cherry-${side}-${edge}`;
    colliders.push(
      box(`${id}-trunk`, centerX - .24, 0, centerZ - .24, .48, 3.25, .48, '#694d3d', 'bark'),
      box(`${id}-canopy`, centerX - 2.1, 3.25, centerZ - 1.8, 4.2, 1.2, 3.6, '#cf9999', 'cherry-foliage', { overhead: true }),
      box(`${id}-crown`, centerX - 1.45, 4.45, centerZ - 1.2, 2.9, .8, 2.4, '#e0b1aa', 'cherry-foliage', { overhead: true }),
    );
  }
  for (const [index, z] of [-3, -18].entries()) {
    const x = side === 'west' ? -13.1 : 13.1, id = `dojo-lantern-${side}-${index}`;
    colliders.push(
      box(`${id}-base`, x - .42, 0, z - .42, .84, .2, .84, '#8d8678', 'dojo-stone'),
      box(`${id}-stem`, x - .15, .2, z - .15, .3, .8, .3, '#8d8678', 'dojo-stone'),
      box(`${id}-lamp`, x - .32, 1, z - .32, .64, .55, .64, '#e2c38e', 'lantern'),
      box(`${id}-cap`, x - .48, 1.55, z - .48, .96, .18, .96, '#545951', 'dojo-stone'),
    );
  }
}

// A clearly separate, honest cover test. It never crosses the marked ranges.
colliders.push(box('dojo-cover-test-wall', 13, 0, 3, 4.2, 1.6, .5, '#8a897b', 'dojo-stone'));

const decorations = [
  paint('cedar-floor', -14.6, 10.2, 29.2, 9.6, '#956b45'),
  paint('dojo-tatami-border', -11.4, 1.2, 8.8, 7.5, '#414c43'),
  paint('dojo-tatami', -11.15, 1.45, 8.3, 7, '#a8a477', .001),
  paint('stone-path', -1.6, -28, 3.2, 38.1, '#b6aea0'),
  paint('stone-path', -12, 8.5, 24, 1.5, '#b6aea0', .001),
  paint('gravel-garden', -19.3, -28, 6, 33.5, '#a79f8d'),
  paint('gravel-garden', 13.3, -28, 6, 29, '#a79f8d'),
  paint('training-mark', -8.3, 7.8, 2.6, .15, '#d7ba7b', .003),
  paint('training-mark', -1.3, 9.8, 2.6, .15, '#d7ba7b', .003),
  paint('training-mark', 5.7, 9.8, 2.6, .15, '#d7ba7b', .003),
];
for (const target of DOJO_TARGET_SPAWNS) decorations.push(
  paint('target-pad', target.x - .9, target.z - .8, 1.8, 1.6, '#6a7463', .003),
  paint('target-pad', target.x - .84, target.z - .74, 1.68, 1.48, '#b4b098', .004),
);

export const DOJO_MAP = Object.freeze({
  id: 'dojo', name: 'Cedar Dojo', theme: 'dojo', mode: 'dojo',
  description: 'An open Japanese courtyard with a cedar equipment hall, a close-combat tatami pad, measured firing lanes, a real cover wall and a torii backstop.',
  bounds: Object.freeze({ minX: -20, maxX: 20, minZ: -32, maxZ: 20 }),
  colliders: Object.freeze(colliders), decorations: Object.freeze(decorations),
  playerSpawn: DOJO_PLAYER_SPAWN, stations: DOJO_STATIONS,
  targetSpawns: DOJO_TARGET_SPAWNS, rangeLanes: DOJO_RANGE_LANES,
  spawns: Object.freeze([
    Object.freeze([DOJO_PLAYER_SPAWN, pose(-1.4, 12), pose(1.4, 12)]),
    DOJO_TARGET_SPAWNS,
  ]),
  sites: Object.freeze([]), routes: Object.freeze([]), buildings: Object.freeze([]),
  landmarks: Object.freeze([]), tunnels: Object.freeze([]),
  ceilings: Object.freeze(['dojo-hall-roof', 'dojo-shrine-roof']),
  floorColor: '#aaa593', skyColor: '#c8d3d2',
});
