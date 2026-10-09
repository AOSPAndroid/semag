import { createParisMap } from './voxel-paris.js';
import { createExpansionMap } from './voxel-expansion-maps.js';
import { enhanceMapIdentity } from './voxel-map-landmarks.js';

/** Original, server-shared arenas for Voxel Royale. Every visible solid is a collider. */
const box = (id, x, y, z, w, h, d, color, material = 'stone') => Object.freeze({ id, x, y, z, w, h, d, color, material });
const point = (x, z, y = 0) => Object.freeze({ x, y, z });
const loot = (id, x, z, kind, y = 0) => Object.freeze({ id, x, y, z, ...(kind ? { kind } : {}) });
const bounds = Object.freeze({ minX: -32, maxX: 32, minZ: -32, maxZ: 32 });
const perimeter = (color, material) => [
  box('boundary-west', -33, 0, -33, 1, 5.6, 66, color, material),
  box('boundary-east', 32, 0, -33, 1, 5.6, 66, color, material),
  box('boundary-north', -32, 0, -33, 64, 5.6, 1, color, material),
  box('boundary-south', -32, 0, 32, 64, 5.6, 1, color, material),
];
const spawnRing = () => [
  [-28, -28], [-12, -28], [0, -28], [12, -28], [28, -28],
  [28, -12], [28, 0], [28, 12], [28, 28], [12, 28],
  [0, 28], [-12, 28], [-28, 28], [-28, 12], [-28, 0], [-28, -12],
].map(([x, z]) => Object.freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }));

/** A genuine two-door room, rather than a solid box painted to look like a house. */
function shelter(id, x, z, color, material = 'wood') {
  const w = 8, d = 7, t = .4, doorWidth = 2.4, side = (w - doorWidth) / 2;
  const colliders = [
    box(`${id}-west`, x, 0, z, t, 3, d, color, material),
    box(`${id}-east`, x + w - t, 0, z, t, 3, d, color, material),
    ...['north', 'south'].flatMap((face, index) => {
      const edge = z + (index ? d - t : 0);
      return [
        box(`${id}-${face}-left`, x + t, 0, edge, side - t, 3, t, color, material),
        box(`${id}-${face}-right`, x + side + doorWidth, 0, edge, side - t, 3, t, color, material),
        box(`${id}-${face}-lintel`, x + side, 2.35, edge, doorWidth, .65, t, color, material),
      ];
    }),
    box(`${id}-roof`, x, 3, z, w, .36, d, material === 'wood' ? '#496c61' : color, material),
  ];
  const roofId = `${id}-roof`, stairX = x + 1.5, routeId = `${id}-climb`;
  const steps = [];
  // Crate/stone ledges are broad, contiguous, and rise only .84 m each.
  for (let i = 0; i < 3; i++) {
    const centerZ = z + d + 5.5 - i * 2.2, colliderId = `${routeId}-${i + 1}`;
    colliders.push(box(colliderId, stairX - 1.1, 0, centerZ - 1.1, 2.2, .84 * (i + 1), 2.2, material === 'wood' ? '#aa8252' : color, material));
    steps.push(Object.freeze({ colliderId, x: stairX, z: centerZ }));
  }
  steps.push(Object.freeze({ colliderId: roofId, x: stairX, z: z + d - .7 }));
  const route = Object.freeze({ id: routeId, name: `${id.replaceAll('-', ' ')} / supply ledges`, start: point(stairX, z + d + 7.2), steps: Object.freeze(steps) });
  const buildings = Object.freeze({ id, roofId, interior: Object.freeze({ minX: x + t, maxX: x + w - t, minZ: z + t, maxZ: z + d - t }), doorways: Object.freeze([
    Object.freeze({ x: x + w / 2, z: z + t / 2, width: doorWidth, height: 2.35, outside: point(x + w / 2, z - 1), inside: point(x + w / 2, z + 1.2) }),
    Object.freeze({ x: x + w / 2, z: z + d - t / 2, width: doorWidth, height: 2.35, outside: point(x + w / 2, z + d + 1), inside: point(x + w / 2, z + d - 1.2) }),
  ]) });
  const lootPoints = [
    loot(`${id}-supply`, x + 1.6, z + 2, 'weapon'),
    loot(`${id}-medicine`, x + w - 1.6, z + 2, 'heal'),
    loot(`${id}-cache`, x + w - 1.6, z + d - 1.8, 'ammo'),
    loot(`${id}-rooftop`, x + w - 1.7, z + d - 1.5, 'weapon', 3.36),
  ];
  return { colliders, route, buildings, lootPoints };
}

function platform(id, x, z, color, material = 'stone') {
  const colliders = [box(`${id}-deck`, x, 3, z, 7, .36, 6, color, material),
    ...[[.2, .2], [5.9, .2], [.2, 4.9], [5.9, 4.9]].map(([dx, dz], i) => box(`${id}-post-${i}`, x + dx, 0, z + dz, .9, 3, .9, color, material)),
    box(`${id}-cover-west`, x + .3, 3.36, z + 1.9, 1.1, .8, 2, color, material),
    box(`${id}-cover-east`, x + 5.6, 3.36, z + 1.9, 1.1, .8, 2, color, material),
  ];
  const steps = [], stairX = x + 3.5;
  for (let i = 0; i < 3; i++) {
    const centerZ = z - 5.5 + i * 2.2, colliderId = `${id}-rise-${i + 1}`;
    colliders.push(box(colliderId, stairX - 1.1, 0, centerZ - 1.1, 2.2, .84 * (i + 1), 2.2, color, material));
    steps.push(Object.freeze({ colliderId, x: stairX, z: centerZ }));
  }
  steps.push(Object.freeze({ colliderId: `${id}-deck`, x: stairX, z: z + .7 }));
  return { colliders, route: Object.freeze({ id: `${id}-climb`, name: `${id.replaceAll('-', ' ')} / lookout`, start: point(stairX, z - 7.2), steps: Object.freeze(steps) }) };
}

function arena(id, name, description, solids, shelters, platforms, lootPoints, settings) {
  return Object.freeze({
    id, name, description, bounds,
    colliders: Object.freeze([...perimeter(settings.wallColor, settings.material), ...solids, ...shelters.flatMap(value => value.colliders), ...platforms.flatMap(value => value.colliders)]),
    sites: Object.freeze([]), spawnPoints: Object.freeze(spawnRing().map((spawn, index) => settings.spawnOverrides?.[index] || spawn)),
    lootPoints: Object.freeze([...shelters.flatMap(value => value.lootPoints), ...lootPoints]),
    routes: Object.freeze([...shelters.map(value => value.route), ...platforms.map(value => value.route), ...(settings.routes || [])]),
    buildings: Object.freeze(shelters.map(value => value.buildings)),
    floorColor: settings.floorColor, skyColor: settings.skyColor, theme: id,
    stormCenter: point(settings.stormCenter.x, settings.stormCenter.z),
    decorations: Object.freeze([]),
  });
}

const forestHomes = [shelter('cedar-cabin', -25, -23, '#9b7550'), shelter('birch-cabin', 17, -23, '#ac8b62'), shelter('ranger-cabin', -25, 14, '#806547'), shelter('trapper-cabin', 17, 14, '#9a7650')];
const forestTower = platform('ranger-watchtower', -3.5, -3, '#7d6646', 'wood');
const forestTrees = [
  [-29, -21], [-29, 21], [29, -21], [29, 21], [-13, -22], [13, 21],
  [-10, -10], [10, -10], [-11, 10], [11, 10], [-20, -6], [20, -6],
  [-20, 7], [20, 7], [-8, 21], [8, -21], [-15, 26], [23, -26],
].flatMap(([x, z], i) => [
  box(`pine-${i}-trunk`, x - .36, 0, z - .36, .72, 4.3, .72, '#76543a', 'bark'),
  box(`pine-${i}-lower`, x - 2, 3.65, z - 2, 4, 1.65, 4, i % 2 ? '#37694a' : '#315d43', 'foliage'),
  box(`pine-${i}-crown`, x - 1.25, 5.3, z - 1.25, 2.5, 1.7, 2.5, '#497b52', 'foliage'),
]);
const forestSolids = [...forestTrees,
  ...[[-14, 0], [11, 1], [-7, 15], [7, -17], [-27, 4], [24, 4]].map(([x, z], i) => box(`forest-boulder-${i}`, x, 0, z, 2.5, .9, 2, '#798a78')),
  box('fallen-cedar-west', -16, 0, -14, 4, .65, 1.1, '#8c6741', 'wood'),
  box('fallen-cedar-east', 12, 0, 15, 4, .65, 1.1, '#8c6741', 'wood'),
  box('ranger-supply-stack', -6, 0, 5.5, 1.8, .84, 1.8, '#b48d56', 'wood'),
  box('trail-supply-stack', 4.5, 0, 11.5, 1.8, .84, 1.8, '#b48d56', 'wood'),
];
const forest = arena('forest', 'Cedarfall Reserve', 'Search four open ranger cabins, sheltered woodland caches and a climbable watchtower. Pine groves break the long sights; every cabin has two exits and a roof route.', forestSolids, forestHomes, [forestTower], [
  loot('forest-tower-cache', 0, 0, 'weapon', 3.36), loot('forest-under-tower', 0, 1.5, 'heal'),
  loot('forest-rock-west', -10.5, 1, 'weapon'), loot('forest-rock-east', 9, 2, 'weapon'),
  loot('forest-north-trail', -3, -17, 'ammo'), loot('forest-south-trail', 2, 18, 'ammo'),
  loot('forest-cedar-niche', -14, -12, 'grenade'), loot('forest-birch-niche', 13, 17, 'heal'),
  loot('forest-west-grove', -22, 1, 'weapon'), loot('forest-east-grove', 23, 1, 'weapon'),
  loot('forest-north-grove', -13, -24.5, 'heal'), loot('forest-south-grove', 13, 24, 'grenade'),
  loot('forest-watch-west', -7, -4, 'ammo'), loot('forest-watch-east', 7, -4, 'ammo'),
  loot('forest-clearing', -2, 10, 'weapon'), loot('forest-stream-cache', 9, 17, 'heal'),
], { floorColor: '#647c53', skyColor: '#b9d4cd', wallColor: '#465d43', material: 'stone', stormCenter: { x: 0, z: 10 } });

const mazeHomes = [shelter('west-archive', -25, -23, '#8d998a', 'stone'), shelter('east-archive', 17, -23, '#a0a391', 'stone'), shelter('west-sanctum', -25, 14, '#9ba28e', 'stone'), shelter('east-sanctum', 17, 14, '#8d9989', 'stone')];
const mazePlatforms = [platform('north-observatory', -3.5, -17, '#82978d'), platform('south-observatory', -3.5, 14, '#929c83')];
const mazeSolids = [
  // Broken L-shaped rooms and staggered screens leave multiple 3+ metre escape lanes.
  box('maze-nw-north', -17, 0, -15, 8, 2.52, .8, '#9ba593'),
  box('maze-nw-return', -9.8, 0, -15, .8, 2.52, 5, '#85968b'),
  box('maze-nw-south', -20, 0, -7, 12, 2.52, .8, '#94a18a'),
  box('maze-ne-north', 9, 0, -15, 8, 2.52, .8, '#a4aa94'),
  box('maze-ne-return', 9, 0, -15, .8, 2.52, 5, '#9ba18d'),
  box('maze-ne-south', 8, 0, -7, 12, 2.52, .8, '#95a28d'),
  box('maze-sw-north', -20, 0, 6.2, 12, 2.52, .8, '#9ba38e'),
  box('maze-sw-return', -9.8, 0, 10, .8, 2.52, 5, '#879889'),
  box('maze-sw-south', -17, 0, 14.2, 8, 2.52, .8, '#a2a88f'),
  box('maze-se-north', 8, 0, 6.2, 12, 2.52, .8, '#9ba68f'),
  box('maze-se-return', 9, 0, 10, .8, 2.52, 5, '#84978a'),
  box('maze-se-south', 9, 0, 14.2, 8, 2.52, .8, '#a1a994'),
  box('maze-west-middle', -17, 0, -2, .8, 2.52, 4, '#93a38e'),
  box('maze-east-middle', 16.2, 0, -2, .8, 2.52, 4, '#98a590'),
  ...[[-13, -4], [11, -4], [-13, 3], [11, 3]].map(([x, z], i) => box(`maze-broken-plinth-${i}`, x, 0, z, 2, .84, 1.6, '#b1b59c')),
  ...[[-6, -6], [5.1, -6], [-6, 5.1], [5.1, 5.1]].map(([x, z], i) => box(`maze-court-pillar-${i}`, x, 0, z, .9, 3.36, .9, '#7c9488')),
  box('maze-west-arch-cap', -6, 2.8, -6, 11.1, .56, .9, '#8b9e8e'),
  box('maze-east-arch-cap', -6, 2.8, 5.1, 11.1, .56, .9, '#8b9e8e'),
];
const maze = arena('maze', 'Verdant Labyrinth', 'Broken archive rooms, staggered stone screens and two high observatories surround an open central court. Every maze pocket has a second escape; broad outer lanes keep rotations readable.', mazeSolids, mazeHomes, mazePlatforms, [
  loot('maze-north-high', 0, -14.3, 'weapon', 3.36), loot('maze-south-high', 0, 17.5, 'weapon', 3.36),
  loot('maze-nw-pocket', -15, -12, 'weapon'), loot('maze-ne-pocket', 15, -12, 'weapon'),
  loot('maze-sw-pocket', -15, 12, 'weapon'), loot('maze-se-pocket', 15, 12, 'weapon'),
  loot('maze-nw-turn', -11.5, -9, 'heal'), loot('maze-ne-turn', 11.5, -9, 'grenade'),
  loot('maze-sw-turn', -11.5, 9, 'grenade'), loot('maze-se-turn', 11.5, 9, 'heal'),
  loot('maze-west-gallery', -22, 0, 'ammo'), loot('maze-east-gallery', 22, 0, 'ammo'),
  loot('maze-north-shadow', 0, -12.5, 'heal'), loot('maze-south-shadow', 2.5, 16.5, 'heal'),
  loot('maze-west-gate', -6, 0, 'weapon'), loot('maze-east-gate', 6, 0, 'weapon'),
], { floorColor: '#a2ae86', skyColor: '#cad8ce', wallColor: '#748c76', material: 'stone', stormCenter: { x: 0, z: 0 } });

const desertHomes = [shelter('west-caravan', -25, -23, '#caa575', 'sandstone'), shelter('east-caravan', 17, -23, '#d2ad7e', 'sandstone'), shelter('west-scribe', -25, 14, '#c09b68', 'sandstone'), shelter('east-scribe', 17, 14, '#d6b482', 'sandstone')];
const pyramid = Array.from({ length: 5 }, (_, i) => box(`pyramid-tier-${i + 1}`, -6 + i * 1.2, 0, -6 + i * 1.2, 12 - i * 2.4, .84 * (i + 1), 12 - i * 2.4, i % 2 ? '#d5b176' : '#cda46a', 'sandstone'));
const pyramidRoutes = [
  Object.freeze({ id: 'pyramid-south', name: 'Pyramid / southern terraces', start: point(0, 7.7), steps: Object.freeze(pyramid.map((tier, i) => Object.freeze({ colliderId: tier.id, x: 0, z: i === 4 ? 0 : 5.4 - i * 1.2 }))) }),
  Object.freeze({ id: 'pyramid-west', name: 'Pyramid / western terraces', start: point(-7.7, 0), steps: Object.freeze(pyramid.map((tier, i) => Object.freeze({ colliderId: tier.id, x: i === 4 ? 0 : -5.4 + i * 1.2, z: 0 }))) }),
];
const temple = platform('sun-temple', -3.5, -24, '#c0a06d', 'sandstone');
// Its broad columned deck reads as a temple and gives genuine walk-under shelter.
const desertSolids = [...pyramid,
  box('temple-west-wing', -10, 3, -24, 6.5, .36, 6, '#d1af7c', 'sandstone'),
  box('temple-east-wing', 3.5, 3, -24, 6.5, .36, 6, '#d1af7c', 'sandstone'),
  ...[[-9.6, -23.6], [-9.6, -19.3], [8.6, -23.6], [8.6, -19.3]].map(([x, z], i) => box(`temple-column-${i}`, x, 0, z, 1, 3, 1, '#b39362', 'sandstone')),
  // Raised rims around the ground-level court make its floor feel sunken without hidden pits.
  box('court-west-north-rim', -13, 0, -12, .9, .84, 9, '#c3a173', 'sandstone'),
  box('court-west-south-rim', -13, 0, 3, .9, .84, 9, '#c3a173', 'sandstone'),
  box('court-east-north-rim', 12.1, 0, -12, .9, .84, 9, '#c3a173', 'sandstone'),
  box('court-east-south-rim', 12.1, 0, 3, .9, .84, 9, '#c3a173', 'sandstone'),
  box('court-south-west-rim', -13, 0, 12, 10, .84, .9, '#c3a173', 'sandstone'),
  box('court-south-east-rim', 3, 0, 12, 10, .84, .9, '#c3a173', 'sandstone'),
  ...[-24, 18].flatMap((x, side) => [
    box(`desert-gate-${side}-west`, x, 0, -4, .9, 3.36, 3, '#b7905b', 'sandstone'),
    box(`desert-gate-${side}-east`, x + 5.1, 0, -4, .9, 3.36, 3, '#b7905b', 'sandstone'),
    box(`desert-gate-${side}-lintel`, x, 2.8, -4, 6, .56, 3, '#c9a76c', 'sandstone'),
  ]),
  ...[[-17, -9], [14, -9], [-20, 8], [18, 8], [-8, 19], [6, 19]].map(([x, z], i) => box(`desert-supply-${i}`, x, 0, z, 2.1, .84, 1.7, '#a7804e', 'wood')),
  box('desert-obelisk-west', -9, 0, 6.5, 1.4, 4.5, 1.4, '#ad8958', 'sandstone'),
  box('desert-obelisk-east', 7.6, 0, 6.5, 1.4, 4.5, 1.4, '#ad8958', 'sandstone'),
];
const desert = arena('desert', 'Dunes of Anubis', 'Loot open caravan houses and the columned sun temple, then climb five pyramid terraces. Broken gates, obelisks and a lowered-looking forecourt offer close flanks beneath the exposed summit.', desertSolids, desertHomes, [temple], [
  loot('desert-pyramid-summit', 0, 0, 'weapon', 4.2), loot('desert-temple-high', 0, -20, 'weapon', 3.36),
  loot('desert-temple-west', -7, -21, 'heal'), loot('desert-temple-east', 7, -21, 'ammo'),
  loot('desert-west-gate', -21, -2.5, 'weapon'), loot('desert-east-gate', 21, -2.5, 'weapon'),
  loot('desert-west-obelisk', -10.5, 7.2, 'grenade'), loot('desert-east-obelisk', 10.5, 7.2, 'heal'),
  loot('desert-west-cache', -15, -6.5, 'ammo'), loot('desert-east-cache', 15, -6.5, 'ammo'),
  loot('desert-south-west', -9, 21.5, 'weapon'), loot('desert-south-east', 9, 21.5, 'weapon'),
  loot('desert-north-west', -12, -24, 'heal'), loot('desert-north-east', 12, -24, 'grenade'),
  loot('desert-forecourt', 0, 9, 'heal'), loot('desert-pyramid-shadow', -8, -5, 'weapon'),
], { floorColor: '#d9bd86', skyColor: '#e9d4b5', wallColor: '#bfa076', material: 'sandstone', stormCenter: { x: 0, z: 9 }, routes: pyramidRoutes, spawnOverrides: { 2: Object.freeze({ x: -4, y: 0, z: -28, yaw: Math.atan2(4, -28) }) } });

export const MAPS = Object.freeze({
  forest: enhanceMapIdentity(forest), maze: enhanceMapIdentity(maze), desert: enhanceMapIdentity(desert),
  paris: enhanceMapIdentity(createParisMap('royale')), snow: createExpansionMap('snow', 'royale'), sewers: createExpansionMap('sewers', 'royale'), trading: createExpansionMap('trading', 'royale'),
});
export const MAP_IDS = Object.freeze(Object.keys(MAPS));
