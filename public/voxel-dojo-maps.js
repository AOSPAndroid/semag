/** Standalone training arenas. Cedar's original public map remains unchanged. */
import { DOJO_MAP } from './voxel-dojo-map.js';

const box = (id, x, y, z, w, h, d, color, material, extra = {}) =>
  Object.freeze({ id, x, y, z, w, h, d, color, material, ...extra });
const pose = (x, z, yaw = 0, y = 0) => Object.freeze({ x, y, z, yaw });
const paint = (kind, x, z, w, d, color, y = .003) => Object.freeze({ kind, x, y, z, w, d, color });
const frozen = values => Object.freeze(values);

function stations(prefix, z, color, material) {
  const values = [
    ['gun', 'Gun rack', 'GUNS', -12], ['blade', 'Blade rack', 'BLADES', -4],
    ['supplies', 'Supply bench', 'SUPPLIES', 4], ['recovery', 'Recovery bench', 'RECOVER', 12],
  ].map(([id, name, label, x]) => Object.freeze({ id, name, label, x, y: 0, z, radius: 2.2, interactionRadius: 2.2,
    display: pose(x, z + 1.3, Math.PI, .9), colliderId: `${prefix}-station-${id}-bench` }));
  const colliders = [];
  for (const station of values) {
    const x = station.x - 1.8;
    colliders.push(box(station.colliderId, x, .68, z + 1.2, 3.6, .2, 1.15, color, material));
    for (const [index, [dx, dz]] of [[.15, .12], [3.23, .12], [.15, .81], [3.23, .81]].entries())
      colliders.push(box(`${prefix}-station-${station.id}-leg-${index}`, x + dx, 0, z + 1.2 + dz, .22, .68, .22, color, material));
  }
  return { stations: frozen(values), colliders };
}
function perimeter(prefix, bounds, h, color, material) {
  const { minX, maxX, minZ, maxZ } = bounds;
  return [
    box(`${prefix}-west-wall`, minX - 1, 0, minZ - 1, 1, h, maxZ - minZ + 2, color, material),
    box(`${prefix}-east-wall`, maxX, 0, minZ - 1, 1, h, maxZ - minZ + 2, color, material),
    box(`${prefix}-north-wall`, minX, 0, minZ - 1, maxX - minX, h, 1, color, material),
    box(`${prefix}-south-wall`, minX, 0, maxZ, maxX - minX, h, 1, color, material),
  ];
}
function lane(id, name, origin, targetIndex, targets) {
  const target = targets[targetIndex];
  return Object.freeze({ id, name, origin, targetIndex, target, distance: Math.hypot(target.x - origin.x, target.z - origin.z) });
}
function motionBounds(targets, amplitudes = []) {
  return frozen(targets.map((target, index) => Object.freeze({
    minX: target.x - (amplitudes[index] ?? 1.4), maxX: target.x + (amplitudes[index] ?? 1.4),
    minZ: target.z - .18, maxZ: target.z + .18, y: target.y,
  })));
}
function trainingPaint(targets, lanes, padColor, lineColor) {
  return [
    ...targets.flatMap(target => [
      paint('target-pad', target.x - 1.85, target.z - .9, 3.7, 1.8, padColor, target.y + .003),
      paint('target-pad', target.x - 1.75, target.z - .8, 3.5, 1.6, lineColor, target.y + .004),
    ]),
    ...lanes.map(value => paint('training-mark', value.origin.x - 1.35, value.origin.z - .075, 2.7, .15, lineColor, value.origin.y + .006)),
  ];
}
function finalize({ id, name, description, bounds, colliders, decorations, playerSpawn, stations: equipment, targets, lanes, routes, floorColor, skyColor, ceilings = [] }) {
  return Object.freeze({ id, name, theme: id, mode: 'dojo', description, bounds: Object.freeze(bounds),
    colliders: frozen(colliders), decorations: frozen(decorations), playerSpawn, stations: equipment,
    targetSpawns: frozen(targets), targetMotionBounds: motionBounds(targets), rangeLanes: frozen(lanes),
    spawns: frozen([frozen([playerSpawn, pose(-1.4, playerSpawn.z), pose(1.4, playerSpawn.z)]), frozen(targets)]),
    routes: frozen(routes), sites: frozen([]), buildings: frozen([]), landmarks: frozen([]), tunnels: frozen([]),
    ceilings: frozen(ceilings), floorColor, skyColor });
}

function lanternHall() {
  const id = 'dojo-lantern', bounds = { minX: -20, maxX: 20, minZ: -28, maxZ: 20 };
  const equipment = stations(id, 14, '#8d5737', 'dojo-cedar');
  const targets = [pose(-8, 4, Math.PI), pose(0, -10, Math.PI), pose(8, -18, Math.PI), pose(-14, -12, Math.PI), pose(15.5, -12, Math.PI, 2.4)];
  const lanes = [lane('blade-pad', 'Close combat', pose(-8, 6.3), 0, targets),
    lane('range-20', '20 m', pose(0, 10), 1, targets), lane('range-20-east', '20 m', pose(8, 2), 2, targets),
    lane('peek-10', '10 m peek', pose(-14, -2), 3, targets), lane('gallery-10', 'Gallery 10 m', pose(15.5, -2, 0, 2.4), 4, targets)];
  const colliders = [...perimeter(id, bounds, 6.2, '#b9a88e', 'dojo-plaster'), ...equipment.colliders];
  colliders.push(box(`${id}-roof`, -20, 6.2, -28, 40, .35, 48, '#343b3b', 'dojo-roof', { overhead: true }));
  // Shoji screens occupy real walls; the painted lattice never invents cover.
  for (const x of [-19.65, 19.45]) for (const [index, z] of [-23, -14, -5, 4].entries())
    colliders.push(box(`${id}-shoji-${x < 0 ? 'west' : 'east'}-${index}`, x, 0, z, .2, 4.7, 5.2, '#ddd4b7', 'shoji'));
  for (const [index, x, z] of [[0, -5, -20], [1, 4, -20], [2, -5, -5], [3, 4, -5]]) {
    colliders.push(box(`${id}-pillar-${index}`, x, 0, z, .65, 6.2, .65, '#79482e', 'dojo-cedar'));
    colliders.push(box(`${id}-hanging-lantern-${index}`, x + .85, 4.5, z - .3, .7, .8, .7, '#edb663', 'lantern', { overhead: true }));
  }
  // The west screens make a separate corner-peek course, clear of measured lanes.
  colliders.push(
    box(`${id}-cover-west`, -11.5, 0, -3.5, 3, 2.2, .55, '#8e6650', 'dojo-cedar'),
    box(`${id}-cover-middle`, -4.2, 0, 1, 3, 1.3, .8, '#817666', 'dojo-stone'),
    box(`${id}-cover-east`, 3.8, 0, -9, 2.2, 1.35, 1.2, '#817666', 'dojo-stone'),
    box(`${id}-tatami-step`, -11.5, 0, -21.5, 2.8, .48, 2.8, '#8b7451', 'tatami'),
  );
  // A solid 2.4 m gallery with four reachable 0.6 m jumps, not a floating platform.
  colliders.push(box(`${id}-gallery-deck`, 12, 2.08, -18, 6, .32, 22, '#805235', 'dojo-cedar'));
  for (const [index, z] of [-17, -7, 2].entries()) for (const x of [12.2, 17.3])
    colliders.push(box(`${id}-gallery-support-${index}-${x}`, x, 0, z, .5, 2.08, .5, '#68452f', 'dojo-cedar'));
  const steps = [];
  for (let index = 0; index < 4; index++) {
    const z = 8 - index * 1.6, height = (index + 1) * .6, colliderId = `${id}-gallery-step-${index}`;
    colliders.push(box(colliderId, 12.5, 0, z, 3, height, 1.6, '#936b48', 'dojo-cedar'));
    steps.push(Object.freeze({ x: 14, z: z + .8, y: height, colliderId }));
  }
  colliders.push(box(`${id}-gallery-outer-rail`, 17.8, 2.4, -18, .2, .9, 22, '#623f2d', 'dojo-cedar'));
  const routes = [Object.freeze({ id: `${id}-gallery`, name: 'Lantern gallery', start: pose(14, 10.3), approach: frozen([]), steps: frozen(steps), destination: pose(15.5, -2, 0, 2.4) })];
  const decorations = [paint('cedar-floor', -20, -28, 40, 48, '#805e41', 0),
    paint('dojo-tatami-border', -11, 1.1, 6, 6.3, '#354d43'), paint('dojo-tatami', -10.8, 1.3, 5.6, 5.9, '#a7a57a', .004),
    paint('stone-path', -1.8, -27, 3.6, 40, '#938776'), paint('cedar-floor', 12, -18, 6, 22, '#946d49', 2.403),
    ...trainingPaint(targets, lanes, '#3c554a', '#d1bf87')];
  return finalize({ id, name: 'Lantern Hall', description: 'An indoor cedar hall for blades, shotguns and corner peeks. Climb the four-step gallery to test elevated targets and downward shots.', bounds, colliders, decorations,
    playerSpawn: pose(0, 14), stations: equipment.stations, targets, lanes, routes, floorColor: '#63533f', skyColor: '#202a31', ceilings: [`${id}-roof`] });
}

function ironRange() {
  const id = 'dojo-iron', bounds = { minX: -24, maxX: 24, minZ: -54, maxZ: 24 };
  const equipment = stations(id, 18, '#647681', 'steel');
  const targets = [pose(-10, 8, Math.PI), pose(-6, -12, Math.PI), pose(0, -28, Math.PI), pose(10, -48, Math.PI), pose(17.5, -25, Math.PI, 2.4)];
  const lanes = [lane('blade-pad', 'Close combat', pose(-10, 10.3), 0, targets), lane('range-20', '20 m', pose(-6, 8), 1, targets),
    lane('range-40', '40 m', pose(0, 12), 2, targets), lane('range-50', '50 m', pose(10, 2), 3, targets), lane('gantry-25', 'Gantry 25 m', pose(17.5, 0, 0, 2.4), 4, targets)];
  const colliders = [...perimeter(id, bounds, 5.2, '#6d7a80', 'concrete'), ...equipment.colliders];
  // The covered equipment bay sits well above a full jump at the spawn row.
  colliders.push(box(`${id}-equipment-roof`, -16, 5, 15, 32, .28, 8, '#4b5b66', 'steel', { overhead: true }));
  for (const x of [-15.7, 15.2]) for (const z of [15.2, 22.2])
    colliders.push(box(`${id}-equipment-post-${x}-${z}`, x, 0, z, .5, 5, .5, '#485762', 'steel'));
  // Large industrial baffles create real peek lines without cutting the marked range lanes.
  colliders.push(
    box(`${id}-baffle-west`, -20, 0, -21, 5.5, 2.6, 1.2, '#6a777c', 'iron-panel'),
    box(`${id}-baffle-center`, -4.8, 0, -7, 3.2, 2.6, .75, '#566570', 'iron-panel'),
    box(`${id}-baffle-east`, 4.1, 0, -18, 2.8, 1.4, 1.2, '#6a777c', 'iron-panel'),
    box(`${id}-vault-crate`, -20, 0, 0, 3.2, .48, 2.8, '#977044', 'crate'),
    box(`${id}-high-crate`, -20, 0, -3.2, 3.2, .96, 2.8, '#977044', 'crate'),
    box(`${id}-cargo-container`, -22, 0, -44, 7, 3.2, 10, '#476778', 'iron-panel'),
  );
  colliders.push(box(`${id}-gantry-deck`, 14, 2.08, -31, 7, .32, 39.8, '#5d707b', 'iron-grate'));
  for (const [index, z] of [-30, -18, -6, 6].entries()) for (const x of [14.2, 20.3])
    colliders.push(box(`${id}-gantry-support-${index}-${x}`, x, 0, z, .5, 2.08, .5, '#495c66', 'steel'));
  const steps = [];
  for (let index = 0; index < 4; index++) {
    const z = 12 - index * 1.6, height = (index + 1) * .6, colliderId = `${id}-gantry-step-${index}`;
    colliders.push(box(colliderId, 15, 0, z, 3, height, 1.6, '#74848a', 'concrete'));
    steps.push(Object.freeze({ x: 16.5, z: z + .8, y: height, colliderId }));
  }
  colliders.push(box(`${id}-gantry-outer-rail`, 20.8, 2.4, -31, .2, 1, 39.8, '#efbc51', 'hazard'));
  const routes = [Object.freeze({ id: `${id}-gantry`, name: 'Iron gantry', start: pose(16.5, 14.3), approach: frozen([]), steps: frozen(steps), destination: pose(17.5, 0, 0, 2.4) })];
  const decorations = [paint('concrete-floor', -24, -54, 48, 78, '#596870', 0), paint('range-asphalt', -12.5, -51, 25, 63, '#36444e'),
    paint('concrete-floor', -16, 15, 32, 8, '#7b8586'), paint('hazard-stripe', 14, -31, .25, 39.8, '#e9b749', 2.405),
    ...trainingPaint(targets, lanes, '#435962', '#d6bf75')];
  return finalize({ id, name: 'Iron Range', description: 'An open industrial range with 20, 40 and 50 metre lanes, solid baffles, a crate-vault course and a climbable 2.4 metre firing gantry.', bounds, colliders, decorations,
    playerSpawn: pose(0, 18), stations: equipment.stations, targets, lanes, routes, floorColor: '#66747b', skyColor: '#becbd6', ceilings: [`${id}-equipment-roof`] });
}

export const LANTERN_DOJO_MAP = lanternHall();
export const IRON_DOJO_MAP = ironRange();
export const DOJO_MAPS = Object.freeze({ dojo: DOJO_MAP, [LANTERN_DOJO_MAP.id]: LANTERN_DOJO_MAP, [IRON_DOJO_MAP.id]: IRON_DOJO_MAP });
export const DOJO_MAP_IDS = Object.freeze(Object.keys(DOJO_MAPS));
export function getDojoMap(id = 'dojo') {
  if (typeof id !== 'string' || !Object.hasOwn(DOJO_MAPS, id)) throw new RangeError('Unknown dojo map.');
  return DOJO_MAPS[id];
}
