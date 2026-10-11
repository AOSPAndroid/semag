/** Authored arena plans. The primitives share collision contracts, never a floor plan. */
const freeze = Object.freeze;
export const layoutPoint = (x, z, y = 0) => freeze({ x, y, z });
export const layoutBox = (id, x, y, z, w, h, d, color = '#78878a', material = 'stone') => freeze({ id, x, y, z, w, h, d, color, material });

export function authoredLayoutBuilder(id) {
  const colliders = [], routes = [], upperFloors = [], landmarks = [], decorations = [], coverIds = [], jumpCover = [], hopRoutes = [], buildings = [];
  const solid = (...args) => { const value = layoutBox(...args); colliders.push(value); return value; };
  const cover = (...args) => { const value = solid(...args); coverIds.push(value.id); return value; };
  const deck = (name, x, z, w, d, color, material = 'metal', top = 3.2, supports = true) => {
    solid(name, x, top - .3, z, w, .3, d, color, material);
    if (supports) for (const [index, [dx, dz]] of [[.12, .12], [w - .62, d - .62]].entries())
      solid(`${name}-support-${index}`, x + dx, 0, z + dz, .5, top - .3, .5, color, material);
    return name;
  };
  // Three .8m rises and a full-width final platform, with real jump clearance.
  // axis/direction/edge are authored independently for each map approach.
  const climb = (routeId, name, axis, offset, edge, direction, floorId, side, extra = []) => {
    const steps = [];
    for (let index = 0; index < 3; index++) {
      const distance = edge - direction * (5.5 - index * 2.2), x = axis === 'x' ? distance : offset, z = axis === 'z' ? distance : offset;
      const colliderId = `${routeId}-step-${index + 1}`;
      solid(colliderId, x - 1.1, 0, z - 1.1, 2.2, .8 * (index + 1), 2.2,
        id === 'courtyard' || id === 'bastion' ? '#aba58b' : id === 'depot' || id === 'market' ? '#aa8955' : '#889499',
        id === 'courtyard' || id === 'bastion' ? 'stone' : id === 'depot' || id === 'market' ? 'wood' : 'metal');
      // The final tread is approached near its inner face, leaving enough
      // horizontal travel during the last jump for slow melee pursuers.
      const landing = index === 2 ? edge - direction * .75 : distance;
      steps.push(freeze({ colliderId, x: axis === 'x' ? landing : offset, z: axis === 'z' ? landing : offset }));
    }
    const distance = edge + direction * .7;
    steps.push(freeze({ colliderId: floorId, x: axis === 'x' ? distance : offset, z: axis === 'z' ? distance : offset }), ...extra.map(freeze));
    const startDistance = edge - direction * 7.2, start = layoutPoint(axis === 'x' ? startDistance : offset, axis === 'z' ? startDistance : offset);
    routes.push(freeze({ id: routeId, name, side, role: extra.length ? 'mid' : 'flank', start, approach: freeze([start]), steps: freeze(steps) }));
    return routeId;
  };
  const floor = (floorId, name, ids, routeIds, underpasses, traverse) => upperFloors.push(freeze({ id: floorId, name,
    colliderIds: freeze(ids), routeIds: freeze(routeIds), underpasses: freeze(underpasses.map(value => layoutPoint(...value))),
    traverse: freeze(traverse.map(value => layoutPoint(...value))) }));
  const hop = (name, x, z, color, material = 'wood') => {
    const steps = [];
    for (const [index, [offset, height]] of [[-.95, .48], [.95, .84]].entries()) {
      const value = cover(`${id}-hop-${name}-${index + 1}`, x + offset - .7, 0, z - .7, 1.4, height, 1.4, color, material);
      const landing = layoutPoint(x + offset, z, height);
      steps.push(freeze({ colliderId: value.id, ...landing }));
      jumpCover.push(freeze({ colliderId: value.id, name: `${name} / ${index + 1}`, kind: 'authored-jump-cover', landing,
        approaches: freeze([-1, 1].map(sign => layoutPoint(x + offset, z + sign * 1.4))) }));
    }
    hopRoutes.push(freeze({ id: `${id}-hop-${name}`, name, start: layoutPoint(x - 2.4, z), steps: freeze(steps), end: layoutPoint(x + 2.4, z) }));
  };
  const finish = (settings = {}) => {
    // Dense standing anchors make connected roofs usable by human and monster
    // navigation, including a heavy weapon and the wider hound footprint.
    const anchors = [], seen = new Set();
    for (const name of new Set(upperFloors.flatMap(value => value.colliderIds))) {
      const support = colliders.find(value => value.id === name);
      if (!support || support.w < 1.12 || support.d < 1.12) continue;
      const axis = (edge, length) => { const result = [edge + .56]; for (let value = edge + 1.36; value < edge + length - .56; value += .8) result.push(value); result.push(edge + length - .56); return result; };
      for (const x of axis(support.x, support.w)) for (const z of axis(support.z, support.d)) {
        const point = layoutPoint(x, z, support.y + support.h), key = `${x}:${z}:${point.y}`;
        if (!seen.has(key)) { seen.add(key); anchors.push(point); }
      }
    }
    const authoredRoutes = freeze(routes.map(route => freeze({ ...route, approach: freeze([...route.approach, ...anchors]) })));
    for (const name of coverIds) {
      const value = colliders.find(box => box.id === name);
      landmarks.push(freeze({ kind: 'combat-cover', ...value, collisionIds: freeze([name]) }));
    }
    return freeze({ id, theme: id, authoredLayout: true, ...settings, colliders: freeze(colliders), routes: authoredRoutes,
      upperFloors: freeze(upperFloors), coverIds: freeze(coverIds), jumpCover: freeze(jumpCover), hopRoutes: freeze(hopRoutes),
      landmarks: freeze(landmarks), decorations: freeze(decorations), buildings: freeze(buildings) });
  };
  return { colliders, routes, upperFloors, landmarks, decorations, buildings, solid, cover, deck, climb, floor, hop, finish };
}

const step = (colliderId, x, z) => freeze({ colliderId, x, z });
const CONFIG = freeze({
  courtyard: { name: 'Sunset Courtyard', floor: '#c7b597', sky: '#edceb0', wall: '#b3a38b', boundaryHeight: 4.6 },
  depot: { name: 'Freight Depot', floor: '#687b83', sky: '#b9d5dc', wall: '#778b96', boundaryHeight: 4.2 },
  canal: { name: 'Canal Exchange', floor: '#a8aaa0', sky: '#c5d7e3', wall: '#ab9f8d', boundaryHeight: 3.8 },
  rooftops: { name: 'Roofline District', floor: '#a8b4ad', sky: '#cce3e6', wall: '#91a7a6', boundaryHeight: 1.5 },
  foundry: { name: 'Iron Foundry', floor: '#616d73', sky: '#d4d0c3', wall: '#708189', boundaryHeight: 6.4 },
  bastion: { name: 'Signal Bastion', floor: '#9eaa94', sky: '#c6d7da', wall: '#85968b', boundaryHeight: 5.2 },
});

export function createCoreMap(id) {
  if (!Object.hasOwn(CONFIG, id)) throw new TypeError('Unknown core voxel map');
  const b = authoredLayoutBuilder(id), { solid, cover, deck, climb, floor, hop } = b, settings = CONFIG[id];
  solid('wall-west', -26, 0, -23, 1, settings.boundaryHeight, 46, settings.wall);
  solid('wall-east', 25, 0, -23, 1, settings.boundaryHeight, 46, settings.wall);
  solid('wall-north', -25, 0, -23, 50, settings.boundaryHeight, 1, settings.wall);
  solid('wall-south', -25, 0, 22, 50, settings.boundaryHeight, 1, settings.wall);
  let description;

  if (id === 'courtyard') {
    description = 'An L-shaped stone cloister wraps a sunken-feeling garden court. A continuous north loggia links unequal pavilions; four supply rises open roof flanks above genuine ground arcades.';
    deck('west-arcade', -18, -6, 7, 13, '#a69880', 'stone');
    deck('court-north-loggia', -18, -9, 30, 3, '#b0a38a', 'stone');
    deck('east-arcade', 4, -6, 8, 3, '#afa389', 'stone');
    solid('central-north', -4, 0, 2.5, 8, 2.7, .7, '#b9a790');
    solid('central-west', -4, 0, 3.2, .7, 2.7, 3.8, '#bdab92');
    solid('central-east', 3.3, 0, 3.2, .7, 2.7, 1.6, '#bdab92');
    cover('court-garden-low-wall', 6.5, 0, 5.5, 6, 1.15, .65, '#929b79');
    cover('court-loggia-parapet', -8, 3.2, -8.8, 4.2, 1.05, .45, '#9c967e');
    cover('court-west-roof-cover', -17.6, 3.2, .8, 1.25, .85, 1.6, '#987a55', 'wood');
    cover('court-east-roof-cover', 10.5, 3.2, -5.8, 1.2, .85, 1.4, '#987a55', 'wood');
    climb('court-west-south', 'Garden arcade / southern supply rise', 'z', -14.5, 7, -1, 'west-arcade', 'south');
    climb('court-west-north', 'North cloister / garden masonry rise', 'z', -16, -9, 1, 'court-north-loggia', 'north');
    climb('court-east-south', 'East pavilion / courtyard deliveries', 'z', 8, -3, -1, 'east-arcade', 'south');
    climb('court-east-north', 'North loggia / east retake rise', 'z', 5.5, -9, 1, 'court-north-loggia', 'north');
    floor('court-cloister-floor', 'Connected cloister and north loggia', ['west-arcade', 'court-north-loggia', 'east-arcade'], b.routes.map(value => value.id),
      [[-14.5, 0]], [[-14.5, 5, 3.2], [-14.5, -7.5, 3.2], [8, -7.5, 3.2], [8, -4.5, 3.2]]);
    hop('garden-deliveries', -8, 13.5, '#a78e61');
    hop('east-potting', 16.5, 4, '#9fa48a', 'stone');
  } else if (id === 'depot') {
    description = 'Staggered freight towers form a dog-leg loading yard. A suspended cargo gantry joins container roofs above a real truck underpass; a rear dispatch spur changes the fight from open loading court to tight pallet peeks.';
    solid('west-container', -19, 0, -7, 7, 3.2, 10, '#54868b', 'metal');
    solid('east-container', 7, 0, 0, 10, 3.2, 6, '#aa795d', 'metal');
    solid('mid-container', -5, 0, -9, 8, 3.2, 5, '#637b87', 'metal');
    deck('depot-west-loading-gallery', -19, 3, 7, 5, '#617c83');
    deck('depot-cross-yard-gantry', -12, 0, 19, 3, '#667d83');
    deck('depot-dispatch-spur', -5, -4, 3, 4, '#829493');
    cover('depot-west-roof-cover', -18.7, 3.2, -.8, 1.4, .85, 1.5, '#467377', 'metal');
    cover('depot-east-roof-cover', 15.2, 3.2, 2.4, 1.4, .85, 1.5, '#986846', 'metal');
    cover('depot-dispatch-cabinet', .8, 3.2, -8.7, 1.7, 1.05, 1.2, '#59747a', 'metal');
    cover('depot-ground-docking-screen', 8, 0, -8.5, 6, 2.2, .65, '#816b57', 'metal');
    cover('depot-truck-bay-screen', -3, 0, 9, 6, 1.45, 1.5, '#849290', 'metal');
    climb('depot-west-south', 'Blue freight / loading-court pallets', 'z', -15.5, 8, -1, 'depot-west-loading-gallery', 'south');
    climb('depot-west-north', 'Blue freight / dispatch rise', 'z', -14, -7, 1, 'west-container', 'north');
    climb('depot-east-south', 'Rust freight / container pallets', 'z', 12, 6, -1, 'east-container', 'south');
    climb('depot-east-north', 'Rust freight / inward loading rise', 'z', 12, 0, 1, 'east-container', 'north');
    floor('depot-cargo-network', 'Freight roof and suspended loading gantry', ['west-container', 'depot-west-loading-gallery', 'depot-cross-yard-gantry', 'east-container', 'depot-dispatch-spur', 'mid-container'], b.routes.map(value => value.id),
      [[0, 1.5]], [[-15.5, 5, 3.2], [-14, 1.5, 3.2], [-3.5, 1.5, 3.2], [-3.5, -6, 3.2], [-3.5, 1.5, 3.2], [12, 1.5, 3.2]]);
    hop('dispatch-pallets', -7, 12, '#a68b5b');
    hop('customs-cases', 20, 12, '#657e87', 'metal');
  } else if (id === 'canal') {
    description = 'A long canal cuts the map into unequal quays. Two low lock crossings give short routes below a broad overhead customs bridge, joining a waterside warehouse balcony to the raised east market.';
    solid('canal-water-block', -2, -.5, -17, 4, .52, 34, '#5c9fab', 'water');
    for (const [side, x] of [['west', -3.2], ['east', 2]]) for (const [index, [z, length]] of [[-17, 8], [-5, 10], [9, 8]].entries())
      cover(`canal-${side}-bank-${index}`, x, 0, z, 1.2, .8, length, '#728b96');
    solid('canal-lock-north-crossing', -3.2, 0, -9, 6.4, .35, 4, '#8d9b9a', 'stone');
    solid('canal-lock-south-crossing', -3.2, 0, 5, 6.4, .35, 4, '#8d9b9a', 'stone');
    cover('canal-sluice-gate', -3.2, 0, 1.5, 6.4, 2.4, .6, '#687f85', 'metal');
    deck('west-market', -17, -4, 7, 12, '#a99c85', 'stone');
    deck('east-market', 10, 4, 6, 7, '#b6a487', 'stone');
    deck('canal-customs-bridge', -10, 4, 20, 3, '#8b9b98', 'metal');
    cover('canal-west-roof-cover', -16.7, 3.2, -.8, 1.4, .85, 1.5, '#a29376');
    cover('canal-east-roof-cover', 14.5, 3.2, 7.5, 1.2, .85, 1.1, '#a29376');
    cover('canal-quay-customs-screen', -9, 0, -11.5, 4, 2.5, .55, '#9b8e7b');
    cover('canal-fish-market-screen', 6.5, 0, -1, .6, 2.4, 5.5, '#809a91');
    climb('canal-west-south', 'Warehouse / southern delivery chain', 'z', -14, 8, -1, 'west-market', 'south');
    climb('canal-west-north', 'Warehouse / north customs chain', 'z', -14, -4, 1, 'west-market', 'north');
    climb('canal-east-south', 'East quay / market delivery chain', 'z', 13, 11, -1, 'east-market', 'south');
    climb('canal-east-north', 'East quay / lock-side delivery chain', 'z', 13, 4, 1, 'east-market', 'north');
    floor('canal-customs-floor', 'Warehouse balcony and cross-canal customs bridge', ['west-market', 'canal-customs-bridge', 'east-market'], b.routes.map(value => value.id),
      [[-7, 5.5]], [[-14, 6, 3.2], [-11, 5.5, 3.2], [0, 5.5, 3.2], [13, 5.5, 3.2], [13, 9, 3.2]]);
    hop('west-mooring', -20, -10, '#a19373', 'stone');
    hop('quay-deliveries', 19, 11, '#a98655');
  } else if (id === 'rooftops') {
    description = 'A connected roof district rises above a maze of walk-under service alleys. An offset southern roof links an east apartment terrace to the watch tower; narrow skybridges demand movement and crossfire rather than one fixed angle.';
    deck('roofline-west-roof', -17, -4, 8, 5, '#8dada9', 'concrete');
    deck('roofline-east-roof', 9, -10, 8, 11, '#b9a991', 'concrete');
    deck('roofline-west-bridge', -9, -1.1, 5.5, 2.2, '#657d83');
    deck('roofline-east-bridge', 3.5, -1.1, 5.5, 2.2, '#657d83');
    solid('roofline-watch-deck', -3.5, 0, -3.5, 7, 4, 7, '#899b9b', 'concrete');
    deck('roofline-south-terrace', 3.5, 6, 10.5, 5, '#9d998b', 'concrete');
    deck('roofline-south-skybridge', 11, 1, 3, 5, '#75858b');
    cover('roofline-west-roof-cover', -16.7, 3.2, -.9, 1.2, .85, 1.4, '#657e7b', 'metal');
    cover('roofline-east-roof-cover', 15.3, 3.2, -7, 1.2, .85, 1.4, '#a18c70', 'metal');
    cover('roofline-deck-cover', -.75, 4, -2.8, 1.5, .85, 1.2, '#5e7376', 'metal');
    cover('roofline-service-alley-screen', -6.5, 0, 8, .65, 2.5, 5, '#748f8b');
    cover('roofline-south-terrace-cover', 4, 3.2, 7, 1.3, 1.05, 2.1, '#788f8d', 'metal');
    climb('roofline-west-south', 'West apartment / supply rise', 'z', -13, 1, -1, 'roofline-west-roof', 'south');
    climb('roofline-west-north', 'West roof to watch tower', 'z', -10.5, -4, 1, 'roofline-west-roof', 'north', [step('roofline-west-roof', -10.5, 0), step('roofline-west-bridge', -8.3, 0), step('roofline-west-bridge', -6.1, 0), step('roofline-west-bridge', -4.3, 0), step('roofline-watch-deck', -2.8, 0)]);
    climb('roofline-east-south', 'Southern terrace / maintenance rise', 'z', 10.5, 11, -1, 'roofline-south-terrace', 'south');
    climb('roofline-east-north', 'East roof to watch tower', 'z', 10.5, -10, 1, 'roofline-east-roof', 'north', [step('roofline-east-roof', 10.5, -6), step('roofline-east-roof', 10.5, -2.2), step('roofline-east-roof', 10.5, 0), step('roofline-east-bridge', 8.3, 0), step('roofline-east-bridge', 6.1, 0), step('roofline-east-bridge', 4.3, 0), step('roofline-watch-deck', 2.8, 0)]);
    floor('roofline-roof-district', 'Interconnected apartments, skybridges and watch tower', ['roofline-west-roof', 'roofline-west-bridge', 'roofline-watch-deck', 'roofline-east-bridge', 'roofline-east-roof', 'roofline-south-skybridge', 'roofline-south-terrace'], b.routes.map(value => value.id),
      [[-13, -1], [12.5, 3.5]], [[-13, -1, 3.2], [-6, 0, 3.2], [0, 0, 4], [6, 0, 3.2], [12.5, 0, 3.2], [12.5, 8.5, 3.2]]);
    hop('alley-service', -11, 14, '#758a88', 'metal');
    hop('roofing-supplies', 20, 3.5, '#af9469');
  } else if (id === 'foundry') {
    description = 'An asymmetric furnace hall has a north casting gallery and a long east service return. A suspended maintenance bridge meets the furnace roof above machinery aisles; loading rises on four different corners create a genuine upper circuit.';
    deck('foundry-west-gallery', -17, -6, 5, 11, '#657b83');
    deck('foundry-north-casting-gallery', -17, -9, 31, 3, '#73868b');
    deck('foundry-east-north-platform', 7, -6, 7, 4, '#967b67');
    deck('foundry-east-service-return', 12, -2, 3, 5, '#778a8d');
    deck('foundry-east-gallery', 10, 3, 7, 9, '#97725b');
    deck('foundry-furnace-service-bridge', 2, 0, 10, 3, '#8d8274');
    solid('foundry-furnace', -5, 0, -3, 7, 3.2, 7, '#7d675b', 'metal');
    cover('foundry-west-top-cover', -16.7, 3.2, -2.5, 1.2, .85, 1.4, '#435d64', 'metal');
    cover('foundry-east-top-cover', 15.2, 3.2, 7.5, 1.2, .85, 1.4, '#755642', 'metal');
    cover('foundry-furnace-top-cover', -4.6, 3.2, -.5, 1.2, .85, 1.7, '#5d554d', 'metal');
    cover('foundry-ground-control-bank', -9, 0, -1.5, 1.5, 2.15, 5, '#596d75', 'metal');
    cover('foundry-casting-mould', 4.5, 0, 7.5, 3, 1.2, 2, '#887153', 'metal');
    cover('foundry-loading-mould-screen', 2.5, 0, 10, 4, 1.95, 1.2, '#697d7b', 'metal');
    climb('foundry-west-south', 'West gallery / mould loading rise', 'z', -14.5, 5, -1, 'foundry-west-gallery', 'south');
    climb('foundry-west-north', 'North casting gallery / service rise', 'z', -13, -9, 1, 'foundry-north-casting-gallery', 'north');
    climb('foundry-east-south', 'East service gallery / shipping rise', 'z', 14, 12, -1, 'foundry-east-gallery', 'south');
    climb('foundry-east-north', 'North gallery to furnace maintenance bridge', 'z', 10, -9, 1, 'foundry-north-casting-gallery', 'north', [step('foundry-east-north-platform', 10, -4), step('foundry-east-service-return', 13.5, 0), step('foundry-furnace-service-bridge', 8, 1.5), step('foundry-furnace', 0, 1.5)]);
    floor('foundry-service-circuit', 'Casting galleries and furnace maintenance circuit', ['foundry-west-gallery', 'foundry-north-casting-gallery', 'foundry-east-north-platform', 'foundry-east-service-return', 'foundry-east-gallery', 'foundry-furnace-service-bridge', 'foundry-furnace'], b.routes.map(value => value.id),
      [[-14.5, 0], [8, 1.5]], [[-14.5, 3.5, 3.2], [-14.5, -7.5, 3.2], [10, -7.5, 3.2], [13.5, 0, 3.2], [13.5, 8, 3.2], [13.5, 1.5, 3.2], [0, 1.5, 3.2]]);
    hop('casting-tools', -7, 12, '#8a7961', 'metal');
    hop('inspection-cases', 20, -6, '#637e86', 'metal');
  } else {
    description = 'A U-shaped fortress rampart circles the north signal yard and joins an elevated command tower by two stone bridges. Long upper rotations overlook shorter sheltered courtyards; four switchback supply approaches keep high ground contestable.';
    solid('bastion-west-wall', -17, 0, -4, 6, 3.2, 6, '#919b91');
    solid('bastion-east-wall', 11, 0, -9, 6, 3.2, 12, '#aaa38e');
    deck('bastion-west-north-rampart', -17, -8, 6, 4, '#8b978c', 'stone');
    deck('bastion-north-rampart', -17, -11, 34, 3, '#939d8c', 'stone');
    solid('bastion-watch-deck', -4, 0, -2, 8, 4, 6, '#7e8d88');
    deck('bastion-west-bridge', -11, -.1, 7, 2.2, '#889b96', 'stone');
    deck('bastion-east-bridge', 4, -.1, 7, 2.2, '#889b96', 'stone');
    cover('bastion-west-top-cover', -16.5, 3.2, -.5, 1.1, .85, 1.2, '#727e6f');
    cover('bastion-east-top-cover', 15.3, 3.2, -5.5, 1.1, .85, 1.2, '#8c836b');
    cover('bastion-deck-cover', -.8, 4, -.8, 1.6, .85, 1.2, '#626f6a');
    cover('bastion-north-crenel', -3, 3.2, -10.8, 4, 1.1, .4, '#747f71');
    cover('bastion-courtyard-screen', 5.5, 0, 8.5, 4.5, 1.4, .8, '#92967e');
    climb('bastion-west-south', 'West battlement / courtyard stone rise', 'z', -14, 2, -1, 'bastion-west-wall', 'south');
    climb('bastion-west-north', 'North rampart to command tower', 'z', -12, -11, 1, 'bastion-north-rampart', 'north', [step('bastion-west-north-rampart', -12, -6), step('bastion-west-wall', -12, -2), step('bastion-west-wall', -12, 1), step('bastion-west-bridge', -10, 1), step('bastion-west-bridge', -8, 1), step('bastion-west-bridge', -6, 1), step('bastion-west-bridge', -4.7, 1), step('bastion-watch-deck', -3.1, 1)]);
    climb('bastion-east-south', 'East battlement / signal yard rise', 'z', 14, 3, -1, 'bastion-east-wall', 'south');
    climb('bastion-east-north', 'North signal wall to command tower', 'z', 12, -11, 1, 'bastion-north-rampart', 'north', [step('bastion-east-wall', 12, -7), step('bastion-east-wall', 12, -3), step('bastion-east-wall', 12, 1), step('bastion-east-bridge', 10, 1), step('bastion-east-bridge', 8, 1), step('bastion-east-bridge', 6, 1), step('bastion-east-bridge', 4.7, 1), step('bastion-watch-deck', 3.1, 1)]);
    floor('bastion-rampart-ring', 'Northern ramparts and command bridges', ['bastion-west-wall', 'bastion-west-north-rampart', 'bastion-north-rampart', 'bastion-east-wall', 'bastion-west-bridge', 'bastion-east-bridge', 'bastion-watch-deck'], b.routes.map(value => value.id),
      [[-7.5, 1], [0, -9.5]], [[-14, 0, 3.2], [-14, -9.5, 3.2], [14, -9.5, 3.2], [14, 1, 3.2], [6, 1, 3.2], [2.5, 2.8, 4]]);
    hop('stone-supplies', -8, 12, '#a7ab92', 'stone');
    hop('signal-cases', 20, -2, '#929a80', 'stone');
  }
  // Plant centres and six starts stay on the connected, exposed ground layer.
  return b.finish({ name: settings.name, description,
    bounds: freeze({ minX: -25, maxX: 25, minZ: -22, maxZ: 22 }),
    sites: freeze(({
      courtyard: [[-13, -12], [13, -12]], depot: [[-20, -14], [20, -13]], canal: [[-11, -14], [16, -13]],
      rooftops: [[-18, -13], [18, -14]], foundry: [[-20, -11], [19, -13]], bastion: [[-20, -13], [20, -14.5]],
    }[id]).map(([x, z], index) => freeze({ id: index ? 'B' : 'A', x, z, radius: 2.2 }))),
    spawns: freeze([freeze([-3, 0, 3].map(x => freeze({ x, z: 18, yaw: 0 }))), freeze([3, 0, -3].map(x => freeze({ x, z: -18, yaw: Math.PI })))]),
    floorColor: settings.floor, skyColor: settings.sky });
}
