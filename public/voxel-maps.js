import { createParisMap } from './voxel-paris.js';

/** Authored, shared collision and rendering geometry for Voxel Breach. */
const box = (id, x, y, z, w, h, d, color = '#647780', material = 'stone') => Object.freeze({ id, x, y, z, w, h, d, color, material });
const perimeter = (w = 50, d = 44, color = '#b8a993') => [box('wall-west', -w / 2 - 1, 0, -d / 2 - 1, 1, 4.2, d + 2, color), box('wall-east', w / 2, 0, -d / 2 - 1, 1, 4.2, d + 2, color), box('wall-north', -w / 2, 0, -d / 2 - 1, w, 4.2, 1, color), box('wall-south', -w / 2, 0, d / 2, w, 4.2, 1, color)];
const map = (id, name, description, colliders, sites, settings = {}) => Object.freeze({ id, name, description, bounds: Object.freeze({ minX: -25, maxX: 25, minZ: -22, maxZ: 22 }), colliders: Object.freeze([...perimeter(50, 44, settings.wallColor), ...colliders]), sites: Object.freeze(sites.map(Object.freeze)), spawns: Object.freeze([Object.freeze([{ x: -3, z: 18, yaw: 0 }, { x: 0, z: 18, yaw: 0 }, { x: 3, z: 18, yaw: 0 }].map(Object.freeze)), Object.freeze([{ x: 3, z: -18, yaw: Math.PI }, { x: 0, z: -18, yaw: Math.PI }, { x: -3, z: -18, yaw: Math.PI }].map(Object.freeze))]), floorColor: settings.floorColor || '#c8b99a', skyColor: settings.skyColor || '#c1d9e0', theme: settings.theme || 'courtyard' });
const originalMaps = Object.freeze({
  courtyard: map('courtyard', 'Sunset Courtyard', 'Two broad flanks and a broken central arch. Low site cover rewards measured peeks.', [
    box('central-north', -5, 0, -4, 10, 3.8, 2, '#b9a790'), box('central-west', -5, 0, -2, 2, 3.8, 8, '#bdab92'), box('central-east', 3, 0, -2, 2, 3.8, 8, '#bdab92'),
    box('west-arcade', -15, 0, 1, 8, 3.2, 2, '#9b8d7a'), box('east-arcade', 7, 0, 1, 8, 3.2, 2, '#9b8d7a'),
    box('west-site-crate', -16.4, 0, -10.4, 2.4, 1, 2.4, '#b07a48', 'wood'), box('west-site-column', -9.2, 0, -14.2, 1.6, 3.3, 1.6, '#bca88c'),
    box('east-site-crate', 14, 0, -10.4, 2.4, 1, 2.4, '#b07a48', 'wood'), box('east-site-column', 7.6, 0, -14.2, 1.6, 3.3, 1.6, '#bca88c'),
    box('south-cover', -1.2, 0, 11, 2.4, 1.2, 2.4, '#927c5c', 'wood'), box('north-cover', -1.2, 0, -14.6, 2.4, 1.1, 2.4, '#927c5c', 'wood'),
  ], [{ id: 'A', x: -13, z: -12, radius: 2.2 }, { id: 'B', x: 13, z: -12, radius: 2.2 }], { floorColor: '#c7b597', skyColor: '#edceb0', wallColor: '#b3a38b' }),
  depot: map('depot', 'Freight Depot', 'Container lanes, elevated pallet stacks and a dangerous open loading court.', [
    box('west-container', -16, 0, -3, 4, 3.2, 12, '#54868b', 'metal'), box('east-container', 12, 0, -9, 4, 3.2, 12, '#aa795d', 'metal'),
    box('mid-container', -3, 0, -6, 6, 3.2, 5, '#637b87', 'metal'), box('mid-pallet', -2, 0, 3.6, 4, .8, 3, '#a17c4b', 'wood'),
    box('west-loading-stack', -17, 0, -15, 3, 1.2, 2.5, '#b9915a', 'wood'), box('west-loading-column', -8, 0, -14, 1.5, 3.4, 1.5, '#7b8b92', 'metal'),
    box('east-loading-stack', 14, 0, -14, 3, 1.2, 2.5, '#b9915a', 'wood'), box('east-loading-column', 7, 0, -15, 1.5, 3.4, 1.5, '#7b8b92', 'metal'),
    box('south-pallet-west', -9, 0, 12, 3, .8, 2.2, '#ac8754', 'wood'), box('south-pallet-east', 6, 0, 12, 3, .8, 2.2, '#ac8754', 'wood'),
  ], [{ id: 'A', x: -12, z: -12, radius: 2.2 }, { id: 'B', x: 12, z: -12, radius: 2.2 }], { floorColor: '#687b83', skyColor: '#b9d5dc', wallColor: '#778b96', theme: 'depot' }),
  canal: map('canal', 'Canal Exchange', 'A divided market offers alternating long sights and tight bridge approaches.', [
    box('canal-mid-screen', -5, 0, -1, 10, 3.4, 2, '#9b8e7b'),
    box('canal-west-bank', -3.2, 0, -9, 1.2, 1.15, 18, '#728b96'), box('canal-east-bank', 2, 0, -9, 1.2, 1.15, 18, '#728b96'),
    box('canal-water-block', -2, -.5, -9, 4, .55, 18, '#5c9fab', 'water'),
    box('west-market', -16, 0, -2, 7, 3.2, 3, '#bda68a'), box('east-market', 9, 0, 4, 7, 3.2, 3, '#bda68a'),
    box('west-bridge-pillar', -7, 0, 5.5, 1.4, 3, 1.4, '#a29381'), box('east-bridge-pillar', 5.6, 0, -5.5, 1.4, 3, 1.4, '#a29381'),
    box('west-site-planter', -16.5, 0, -13.2, 2.5, .9, 2.5, '#94a076'), box('east-site-planter', 14, 0, -13.2, 2.5, .9, 2.5, '#94a076'),
    box('west-site-pillar', -9, 0, -15, 1.4, 3.4, 1.4, '#a99b86'), box('east-site-pillar', 7.6, 0, -15, 1.4, 3.4, 1.4, '#a99b86'),
    box('south-bollard', -1.2, 0, 13, 2.4, 1.05, 1.6, '#a29481'), box('north-bollard', -1.2, 0, -15, 2.4, 1.05, 1.6, '#a29481'),
  ], [{ id: 'A', x: -12, z: -12, radius: 2.2 }, { id: 'B', x: 12, z: -12, radius: 2.2 }], { floorColor: '#a8aaa0', skyColor: '#c5d7e3', wallColor: '#ab9f8d', theme: 'canal' }),
});


const point = (x, z) => Object.freeze({ x, z });
const routeStep = (colliderId, x, z) => Object.freeze({ colliderId, x, z });
const freezeRoute = route => Object.freeze({ ...route, start: Object.freeze(route.start), steps: Object.freeze(route.steps.map(Object.freeze)), approach: Object.freeze((route.approach || []).map(Object.freeze)) });

/** Three broad, contiguous jump platforms. Each rise is .8m, below the 1.09m jump apex. */
function climb(id, name, axis, offset, outerEdge, direction, roofId, landing, side, role = 'flank', material = 'wood', color = '#a78352', extraSteps = []) {
  const colliders = [], steps = [];
  for (let i = 0; i < 3; i++) {
    const distance = outerEdge + direction * (1.1 + 2.2 * i);
    const x = axis === 'x' ? distance : offset, z = axis === 'z' ? distance : offset;
    const colliderId = `${id}-step-${i + 1}`;
    colliders.push(box(colliderId, x - 1.1, 0, z - 1.1, 2.2, .8 * (i + 1), 2.2, color, material));
    steps.push(routeStep(colliderId, x, z));
  }
  const distance = outerEdge - direction * .8;
  const start = point(axis === 'x' ? distance : offset, axis === 'z' ? distance : offset);
  steps.push(routeStep(roofId, landing.x, landing.z), ...extraSteps);
  return { colliders, route: freezeRoute({ id, name, side, role, start, steps, approach: [start] }) };
}

function expanded(arena, climbs, details = [], description = arena.description) {
  return Object.freeze({ ...arena, description, colliders: Object.freeze([...arena.colliders, ...climbs.flatMap(value => value.colliders), ...details]), routes: Object.freeze(climbs.map(value => value.route)) });
}

const courtyardClimbs = [
  climb('court-west-south', 'A arcade / supply crates', 'z', -11, 9.6, -1, 'west-arcade', point(-11, 2.35), 'south'),
  climb('court-west-north', 'A arcade / retake crates', 'z', -11, -5.6, 1, 'west-arcade', point(-11, 1.65), 'north'),
  climb('court-east-south', 'B arcade / supply crates', 'z', 11, 9.6, -1, 'east-arcade', point(11, 2.35), 'south'),
  climb('court-east-north', 'B arcade / retake crates', 'z', 11, -5.6, 1, 'east-arcade', point(11, 1.65), 'north'),
];
const courtyard = expanded(originalMaps.courtyard, courtyardClimbs, [
  box('court-west-roof-cover', -14.8, 3.2, 1.2, 1.4, .85, 1.6, '#987a55', 'wood'),
  box('court-east-roof-cover', 13.4, 3.2, 1.2, 1.4, .85, 1.6, '#987a55', 'wood'),
], 'Stone arcades can be climbed from both sides. Rooftop cover overlooks the flanks; ground routes remain faster and conceal your approach.');

const depotClimbs = [
  climb('depot-west-south', 'A container / loading pallets', 'z', -14, 15.6, -1, 'west-container', point(-14, 8.35), 'south', 'flank', 'wood', '#b7955b'),
  climb('depot-west-north', 'A container / inward stacks', 'x', -1.9, -5.4, -1, 'west-container', point(-12.65, -1.9), 'north', 'flank', 'wood', '#b7955b'),
  climb('depot-east-south', 'B container / loading pallets', 'z', 14, 9.6, -1, 'east-container', point(14, 2.35), 'south', 'flank', 'wood', '#b7955b'),
  climb('depot-east-north', 'B container / inward stacks', 'x', -7.9, 5.4, 1, 'east-container', point(12.65, -7.9), 'north', 'flank', 'wood', '#b7955b'),
];
const depot = expanded(originalMaps.depot, depotClimbs, [
  box('depot-west-roof-cover', -15.7, 3.2, 2.5, 1.4, .85, 1.5, '#467377', 'metal'),
  box('depot-east-roof-cover', 14.3, 3.2, -4, 1.4, .85, 1.5, '#986846', 'metal'),
], 'Two-sided pallet climbs open long container-roof sightlines. The covered floor lanes offer faster rotations and close-range counterplay.');

const canalClimbs = [
  climb('canal-west-south', 'A market / delivery crates', 'z', -12.5, 7.6, -1, 'west-market', point(-12.5, .35), 'south', 'flank', 'wood', '#aa8151'),
  climb('canal-west-north', 'A market / planter crates', 'z', -10.5, -8.6, 1, 'west-market', point(-10.5, -1.35), 'north', 'flank', 'wood', '#aa8151'),
  climb('canal-east-south', 'B market / delivery crates', 'z', 14, 13.6, -1, 'east-market', point(14, 6.35), 'south', 'flank', 'wood', '#aa8151'),
  climb('canal-east-north', 'B market / planter crates', 'z', 11, -2.6, 1, 'east-market', point(11, 4.65), 'north', 'flank', 'wood', '#aa8151'),
];
const canal = expanded(originalMaps.canal, canalClimbs, [
  box('canal-west-roof-cover', -15.5, 3.2, -1.5, 1.4, .85, 1.3, '#a29376', 'stone'),
  box('canal-east-roof-cover', 12.2, 3.2, 5.1, 1.2, .85, 1.1, '#a29376', 'stone'),
], 'Market roofs are reached through broad crate chains on either side. Raised peeks control crossings, but expose you to the opposite market and both outer lanes.');

const sites = () => [{ id: 'A', x: -13, z: -12, radius: 2.2 }, { id: 'B', x: 13, z: -12, radius: 2.2 }];
const siteCover = (prefix, color, material) => [
  box(`${prefix}-west-site-cover`, -16.5, 0, -13.4, 2.2, .8, 2.2, color, material),
  box(`${prefix}-east-site-cover`, 14.3, 0, -13.4, 2.2, .8, 2.2, color, material),
  box(`${prefix}-west-site-column`, -9.2, 0, -14.2, 1.6, 3.2, 1.6, color, material),
  box(`${prefix}-east-site-column`, 7.6, 0, -14.2, 1.6, 3.2, 1.6, color, material),
];

const rooftopBase = map('rooftops', 'Roofline District', 'Climb supply crates onto roof bridges, then contest the watch deck. Walk-under alleys and open outer lanes let opponents get beneath your angle.', [
  // Upper surfaces and their real supports. The 2.8m underside clears a standing player.
  box('roofline-west-roof', -17, 2.8, -4, 8, .4, 5, '#8dada9', 'concrete'),
  box('roofline-east-roof', 9, 2.8, -4, 8, .4, 5, '#b9a991', 'concrete'),
  ...[-16.8, -10.2, 9.2, 15.8].flatMap((x, i) => [-3.8, -.2].map((z, j) => box(`roofline-support-${i}-${j}`, x, 0, z, 1, 2.8, 1, '#697f80', 'concrete'))),
  box('roofline-west-bridge', -9, 2.9, -1.1, 5.5, .3, 2.2, '#657d83', 'metal'),
  box('roofline-east-bridge', 3.5, 2.9, -1.1, 5.5, .3, 2.2, '#657d83', 'metal'),
  box('roofline-watch-deck', -3.5, 0, -3.5, 7, 4, 7, '#899b9b', 'concrete'),
  box('roofline-west-cover', -16.7, 3.2, -2.4, 1.4, .85, 1.6, '#657e7b', 'metal'),
  box('roofline-east-cover', 15.3, 3.2, -2.4, 1.4, .85, 1.6, '#a18c70', 'metal'),
  box('roofline-deck-cover', -.75, 4, -1, 1.5, .85, 2, '#5e7376', 'metal'),
  ...siteCover('roofline', '#a69576', 'stone'),
], sites(), { floorColor: '#a8b4ad', skyColor: '#cce3e6', wallColor: '#91a7a6', theme: 'rooftops' });
const rooftopClimbs = [
  climb('roofline-west-south', 'A roof / supply rise', 'z', -13, 7.6, -1, 'roofline-west-roof', point(-13, .35), 'south', 'flank', 'wood', '#b69559'),
  climb('roofline-west-north', 'A roof to watch deck / bridge route', 'z', -10.5, -10.6, 1, 'roofline-west-roof', point(-10.5, -3.35), 'north', 'mid', 'wood', '#b69559', [
    routeStep('roofline-west-roof', -10.5, -1.6), routeStep('roofline-west-roof', -10.5, 0),
    routeStep('roofline-west-bridge', -8.35, 0), routeStep('roofline-west-bridge', -6.45, 0), routeStep('roofline-west-bridge', -4.55, 0),
    routeStep('roofline-watch-deck', -2.85, 0),
  ]),
  climb('roofline-east-south', 'B roof / supply rise', 'z', 13, 7.6, -1, 'roofline-east-roof', point(13, .35), 'south', 'flank', 'wood', '#b69559'),
  climb('roofline-east-north', 'B roof to watch deck / bridge route', 'z', 10.5, -10.6, 1, 'roofline-east-roof', point(10.5, -3.35), 'north', 'mid', 'wood', '#b69559', [
    routeStep('roofline-east-roof', 10.5, -1.6), routeStep('roofline-east-roof', 10.5, 0),
    routeStep('roofline-east-bridge', 8.35, 0), routeStep('roofline-east-bridge', 6.45, 0), routeStep('roofline-east-bridge', 4.55, 0),
    routeStep('roofline-watch-deck', 2.85, 0),
  ]),
];
const rooftops = expanded(rooftopBase, rooftopClimbs);

const foundryBase = map('foundry', 'Iron Foundry', 'Staggered galleries flank a central furnace. Pallet climbs gain long angles; machinery and real walk-under passages protect close-range rotations.', [
  box('foundry-west-gallery', -17, 2.8, -6, 5, .4, 11, '#657b83', 'metal'),
  box('foundry-east-gallery', 12, 2.8, -1, 5, .4, 11, '#97725b', 'metal'),
  ...[[-16.8, -5.8], [-13.2, -5.8], [-16.8, 3.8], [-13.2, 3.8], [12.2, -.8], [15.8, -.8], [12.2, 8.8], [15.8, 8.8]].map(([x, z], i) => box(`foundry-gallery-support-${i}`, x, 0, z, 1, 2.8, 1, '#576770', 'metal')),
  box('foundry-furnace', -3.8, 0, -3, 7.6, 3.2, 6, '#7d675b', 'metal'),
  box('foundry-west-bench', -8.5, 0, 3, 3, .8, 3, '#887153', 'metal'),
  box('foundry-east-bench', 5.5, 0, -8, 3, .8, 3, '#887153', 'metal'),
  box('foundry-west-top-cover', -16.7, 3.2, -2, 1.5, .85, 1.7, '#435d64', 'metal'),
  box('foundry-east-top-cover', 15.2, 3.2, 4.5, 1.5, .85, 1.7, '#755642', 'metal'),
  box('foundry-furnace-top-cover', -1, 3.2, -.5, 2, .85, 1.7, '#5d554d', 'metal'),
  ...siteCover('foundry', '#9c825b', 'wood'),
], sites(), { floorColor: '#616d73', skyColor: '#d4d0c3', wallColor: '#708189', theme: 'foundry' });
const foundryClimbs = [
  climb('foundry-west-south', 'A gallery / loading rise', 'z', -14.5, 11.6, -1, 'foundry-west-gallery', point(-14.5, 4.35), 'south', 'flank', 'wood', '#b3955b'),
  climb('foundry-west-north', 'A gallery / furnace-side rise', 'x', -4.8, -5.4, -1, 'foundry-west-gallery', point(-12.65, -4.8), 'north', 'flank', 'wood', '#b3955b'),
  climb('foundry-east-south', 'B gallery / loading rise', 'z', 14.5, 16.6, -1, 'foundry-east-gallery', point(14.5, 9.35), 'south', 'flank', 'wood', '#b3955b'),
  climb('foundry-east-north', 'B gallery / furnace-side rise', 'x', .2, 5.4, 1, 'foundry-east-gallery', point(12.65, .2), 'north', 'flank', 'wood', '#b3955b'),
  climb('foundry-furnace-south', 'Furnace roof / south maintenance rise', 'z', 0, 9.6, -1, 'foundry-furnace', point(0, 2.35), 'south', 'mid', 'metal', '#8e795a'),
  climb('foundry-furnace-north', 'Furnace roof / north maintenance rise', 'z', 0, -9.6, 1, 'foundry-furnace', point(0, -2.35), 'north', 'mid', 'metal', '#8e795a'),
];
const foundry = expanded(foundryBase, foundryClimbs);

const bastionBase = map('bastion', 'Signal Bastion', 'Opposing battlements lead to a contested watch deck. Stone cover protects the high routes, while open flanks and walk-under bridges punish a fixed angle.', [
  box('bastion-west-wall', -17, 0, -4, 6, 3.2, 6, '#919b91', 'stone'),
  box('bastion-east-wall', 11, 0, -4, 6, 3.2, 6, '#aaa38e', 'stone'),
  box('bastion-watch-deck', -4, 0, -2, 8, 4, 6, '#7e8d88', 'stone'),
  box('bastion-west-bridge', -11, 2.8, -.1, 7, .4, 2.2, '#889b96', 'stone'),
  box('bastion-east-bridge', 4, 2.8, -.1, 7, .4, 2.2, '#889b96', 'stone'),
  box('bastion-west-top-cover', -16.5, 3.2, -1.5, 1.5, .85, 1.6, '#727e6f', 'stone'),
  box('bastion-east-top-cover', 15, 3.2, -1.5, 1.5, .85, 1.6, '#8c836b', 'stone'),
  box('bastion-deck-cover', -1, 4, -.5, 2, .85, 2, '#626f6a', 'stone'),
  box('bastion-west-lane-cover', -19.4, 0, 5, 2.2, .9, 2.2, '#92967e', 'stone'),
  box('bastion-east-lane-cover', 17.2, 0, 5, 2.2, .9, 2.2, '#92967e', 'stone'),
  box('bastion-north-screen', -2, 0, -12, 4, .9, 2, '#7b897c', 'stone'),
  ...siteCover('bastion', '#a7a080', 'stone'),
], sites(), { floorColor: '#9eaa94', skyColor: '#c6d7da', wallColor: '#85968b', theme: 'bastion' });
const bastionClimbs = [
  climb('bastion-west-south', 'A battlement / south stone rise', 'z', -14, 8.6, -1, 'bastion-west-wall', point(-14, 1.35), 'south', 'flank', 'stone', '#b0ad8b'),
  climb('bastion-west-north', 'A battlement to watch deck / bridge route', 'x', -2.8, -4.4, -1, 'bastion-west-wall', point(-11.65, -2.8), 'north', 'mid', 'stone', '#b0ad8b', [
    routeStep('bastion-west-wall', -11.65, -.9), routeStep('bastion-west-wall', -11.65, 1),
    routeStep('bastion-west-bridge', -10.2, 1), routeStep('bastion-west-bridge', -8.4, 1), routeStep('bastion-west-bridge', -6.6, 1), routeStep('bastion-west-bridge', -4.7, 1),
    routeStep('bastion-watch-deck', -3.35, 1),
  ]),
  climb('bastion-east-south', 'B battlement / south stone rise', 'z', 14, 8.6, -1, 'bastion-east-wall', point(14, 1.35), 'south', 'flank', 'stone', '#b0ad8b'),
  climb('bastion-east-north', 'B battlement to watch deck / bridge route', 'x', -2.8, 4.4, 1, 'bastion-east-wall', point(11.65, -2.8), 'north', 'mid', 'stone', '#b0ad8b', [
    routeStep('bastion-east-wall', 11.65, -.9), routeStep('bastion-east-wall', 11.65, 1),
    routeStep('bastion-east-bridge', 10.2, 1), routeStep('bastion-east-bridge', 8.4, 1), routeStep('bastion-east-bridge', 6.6, 1), routeStep('bastion-east-bridge', 4.7, 1),
    routeStep('bastion-watch-deck', 3.35, 1),
  ]),
];
const bastion = expanded(bastionBase, bastionClimbs);

/** Single catalog consumed by server validation, prediction, setup and rendering. */
export const MAPS = Object.freeze({ courtyard, depot, canal, rooftops, foundry, bastion, paris: createParisMap('breach') });
export const MAP_IDS = Object.freeze(Object.keys(MAPS));
