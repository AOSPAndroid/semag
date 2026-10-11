import { environmentCover } from './voxel-environment-cover.js';

/** Irregular Paris blocks and a connected slate-roof circuit share their actual solids. */
const box = (id, x, y, z, w, h, d, color, material = 'stone', extra = {}) => Object.freeze({ id, x, y, z, w, h, d, color, material, ...extra });
const point = (x, z, y = 0) => Object.freeze({ x, y, z });
const loot = (id, x, z, kind, y = 0) => Object.freeze({ id, x, y, z, kind });
const step = (colliderId, x, z) => Object.freeze({ colliderId, x, z });
const paint = (kind, x, z, w, d, color) => Object.freeze({ kind, x, z, w, d, color });

/** Each shop has furniture of its own. Solid cabinets and low cover stay out
 * of the full-width door axis, corner supply sites and external roof routes.
 * The café table's slab and pedestal are separate real solids, so grenades
 * and low shots can travel through the visible space beneath its top. */
function shopFurnishings(id, x, z, w, d) {
  const room = id.replace('paris-', ''), left = x + .4, right = x + w - .4;
  const centreX = x + w / 2, centreZ = z + d / 2;
  const piece = (kind, suffix, xx, yy, zz, ww, hh, dd, color) =>
    box(`paris-shop-${room}-${suffix}`, xx, yy, zz, ww, hh, dd, color, 'paris-shop', {
      shopRoom: id, shopProp: kind,
      shopFacing: ww >= dd ? (centreZ >= zz + dd / 2 ? 'south' : 'north') : (centreX >= xx + ww / 2 ? 'east' : 'west'),
    });
  if (room === 'cafe') {
    const tableX = centreX + 2.15, tableZ = centreZ - 1.9;
    return [
      piece('coffee-counter', 'coffee-counter', left + .08, 0, centreZ - 1.5, 1.4, 1.05, 3, '#986c4c'),
      piece('espresso-cabinet', 'espresso-cabinet', right - .95, 0, centreZ - 1, .87, 1.65, 2, '#597570'),
      piece('bistro-top', 'bistro-top', tableX, .72, tableZ, 1.2, .12, 1.25, '#cfb88e'),
      piece('bistro-base', 'bistro-base', tableX + .40, 0, tableZ + .425, .40, .72, .40, '#64736b'),
      piece('cafe-booth', 'booth', right - 1.15, 0, centreZ + 1.05, 1.07, .95, 1.45, '#935f4d'),
    ];
  }
  if (room === 'atelier') return [
    piece('workbench', 'workbench', left + .08, 0, centreZ - 1.65, 1.55, .92, 3.3, '#9c8057'),
    piece('tool-cabinet', 'tool-cabinet', right - .98, 0, centreZ - 1.45, .90, 1.85, 2.15, '#627b7b'),
    piece('paint-rack', 'paint-rack', right - 1.05, 0, centreZ + 1.25, .97, 1.48, 1.45, '#836b70'),
    piece('display-plinth', 'display-plinth', centreX - 3.4, 0, centreZ + 1.65, 1.1, .78, 1.1, '#b9a88b'),
  ];
  if (room === 'librairie') return [
    piece('bookcase', 'bookcase-west', left + .08, 0, centreZ - 1.65, .72, 2.25, 3.3, '#826748'),
    piece('bookcase', 'bookcase-east', right - .80, 0, centreZ - 1.55, .72, 2.1, 3.1, '#766747'),
    piece('book-display', 'book-display', centreX + 2.15, 0, centreZ - 2, 1.2, .76, 1.15, '#a48a5c'),
    piece('cashier-desk', 'cashier-desk', centreX - 3.3, 0, centreZ + 1.8, 1.2, .98, 1.05, '#6f8775'),
  ];
  return [
    piece('ticket-counter', 'ticket-counter', left + .08, 0, centreZ - 1.4, 1.4, 1.12, 2.8, '#5a7a7d'),
    piece('programme-display', 'programme-display', right - .90, 0, centreZ - 1.9, .82, 1.65, 1.25, '#a58b65'),
    piece('upright-piano', 'upright-piano', right - 1.15, 0, centreZ + .1, 1.07, 1.48, 2.2, '#65564b'),
    piece('travel-trunks', 'travel-trunks', centreX - 3.55, 0, centreZ + 1.85, 1.25, .74, 1, '#9b7954'),
  ];
}

/** Wide contiguous delivery crates make every rooftop attainable by the heaviest gun. */
function stairs(id, name, axis, offset, edge, direction, roofId, landing, side) {
  const colliders = [], steps = [];
  for (let i = 0; i < 4; i++) {
    const distance = edge - direction * (7.7 - i * 2.2);
    const x = axis === 'x' ? distance : offset, z = axis === 'z' ? distance : offset;
    const colliderId = `${id}-step-${i + 1}`;
    colliders.push(box(colliderId, x - 1.1, 0, z - 1.1, 2.2, .8 * (i + 1), 2.2, i % 2 ? '#9d9486' : '#b9ad9b', 'stone'));
    steps.push(step(colliderId, x, z));
  }
  steps.push(step(roofId, landing.x, landing.z));
  const distance = edge - direction * 9.4;
  const start = point(axis === 'x' ? distance : offset, axis === 'z' ? distance : offset);
  return { colliders, route: Object.freeze({ id, name, side, role: 'flank', start, steps: Object.freeze(steps), approach: Object.freeze([start]) }) };
}

function building(id, name, x, z, w, d, side, left, accent, innerZ = z + d / 2) {
  const t = .4, doorWidth = 2.4, wallHeight = 3.6, doorHeight = 2.45, wing = (w - doorWidth) / 2;
  const color = left ? '#d1c2a8' : '#c7b79e', roofId = `${id}-roof`;
  const colliders = [
    box(`${id}-west`, x, 0, z, t, wallHeight, d, color),
    box(`${id}-east`, x + w - t, 0, z, t, wallHeight, d, color),
    ...['north', 'south'].flatMap((face, index) => {
      const edge = z + (index ? d - t : 0);
      return [
        box(`${id}-${face}-left`, x + t, 0, edge, wing - t, wallHeight, t, color),
        box(`${id}-${face}-right`, x + wing + doorWidth, 0, edge, wing - t, wallHeight, t, color),
        box(`${id}-${face}-lintel`, x + wing, doorHeight, edge, doorWidth, wallHeight - doorHeight, t, color),
      ];
    }),
    box(roofId, x, wallHeight, z, w, .4, d, '#596978', 'slate'),
    // These solid chimneys provide real cover, kept away from both roof landings.
    box(`${id}-chimney`, x + w / 2 - .55, 4, z + d / 2 - .55, 1.1, .85, 1.1, '#ad9780'),
  ];
  const outerNorth = side === 'north', outerEdge = outerNorth ? z : z + d;
  const outer = stairs(`${id}-outer`, `${name} / ${outerNorth ? 'northern' : 'southern'} delivery rise`, 'z', left ? x + 1.6 : x + w - 1.6, outerEdge, outerNorth ? 1 : -1,
    roofId, point(left ? x + 1.6 : x + w - 1.6, outerNorth ? z + .7 : z + d - .7), side);
  const innerEdge = left ? x + w : x;
  const inner = stairs(`${id}-inner`, `${name} / courtyard masonry stair`, 'x', innerZ, innerEdge, left ? -1 : 1,
    roofId, point(left ? x + w - .7 : x + .7, innerZ), side);
  const wallIds = Object.freeze(colliders.filter(value => value.id !== roofId && !value.id.endsWith('-chimney')).map(value => value.id));
  const furnishings = shopFurnishings(id, x, z, w, d);
  const metadata = Object.freeze({
    id, name, roofId, wallIds,
    interiorPropIds: Object.freeze(furnishings.map(value => value.id)),
    interior: Object.freeze({ minX: x + t, maxX: x + w - t, minZ: z + t, maxZ: z + d - t }),
    facade: Object.freeze({ x, z, w, d, wallHeight, doorWidth, doorCenterX: x + w / 2, roofY: 4, accent }),
    doorways: Object.freeze([0, 1].map(index => Object.freeze({ x: x + w / 2, z: z + (index ? d - t / 2 : t / 2), width: doorWidth, height: doorHeight,
      outside: point(x + w / 2, index ? z + d + 1 : z - 1), inside: point(x + w / 2, index ? z + d - 1.2 : z + 1.2) }))),
  });
  const lootPoints = [
    loot(`${id}-supply`, x + 2.1, z + 2.2, 'weapon'),
    loot(`${id}-medicine`, x + w - 2.1, z + 2.2, 'heal'),
    loot(`${id}-ammunition`, x + 2.1, z + d - 2.2, 'ammo'),
    loot(`${id}-hidden`, x + w - 2.1, z + d - 2.2, 'grenade'),
    loot(`${id}-roof-cache`, x + 2.3, z + d - 1.5, 'weapon', 4),
    loot(`${id}-roof-medicine`, x + w - 2.3, z + 1.5, 'heal', 4),
  ];
  return { colliders: [...colliders, ...outer.colliders, ...inner.colliders, ...furnishings], routes: [outer.route, inner.route], metadata, lootPoints };
}

export function createParisMap(mode = 'breach') {
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Paris mode must be breach or royale');
  const royale = mode === 'royale', halfW = royale ? 32 : 25, halfD = royale ? 32 : 22;
  // A wide opera frontage, shallow atelier, recessed café court and deep book
  // warehouse form offset streets. Neither the ground nor roofs is mirrored.
  const definitions = royale ? [
    ['paris-opera', 'Maison de l’Opéra', -26, -18, 13, 12, 'north', true, '#406f75', -11],
    ['paris-atelier', 'Atelier du Boulevard', 10, -20, 17, 10, 'north', false, '#7d637d', -12],
    ['paris-cafe', 'Café des Toits', -23, 7, 11, 13, 'south', true, '#944f43', 10],
    ['paris-librairie', 'Librairie Saint-Martin', 9, 3, 15, 15, 'south', false, '#5e745a', 5],
  ] : [
    ['paris-opera', 'Maison de l’Opéra', -22, -10, 12, 7.5, 'north', true, '#406f75', -3.6],
    ['paris-atelier', 'Atelier du Boulevard', 8, -12, 13, 8, 'north', false, '#7d637d', -6.5],
    ['paris-cafe', 'Café des Toits', -19, 3, 10, 7.5, 'south', true, '#944f43', 4.4],
    ['paris-librairie', 'Librairie Saint-Martin', 7, 1, 14, 9, 'south', false, '#5e745a', 6.8],
  ];
  const homes = definitions.map(value => building(...value));
  const leftX = definitions[2][2], rightX = definitions[3][2], width = definitions[3][4];
  const prefix = royale ? 'boundary' : 'wall';
  const perimeter = [
    box(`${prefix}-west`, -halfW - 1, 0, -halfD - 1, 1, 5.6, halfD * 2 + 2, '#a9a08f'),
    box(`${prefix}-east`, halfW, 0, -halfD - 1, 1, 5.6, halfD * 2 + 2, '#a9a08f'),
    box(`${prefix}-north`, -halfW, 0, -halfD - 1, halfW * 2, 5.6, 1, '#a9a08f'),
    box(`${prefix}-south`, -halfW, 0, halfD, halfW * 2, 5.6, 1, '#a9a08f'),
  ];
  const cover = [
    box('paris-bus-body', -1.3, 0, -2.7, 2.6, 1.65, 5.4, '#4b817e', 'metal'),
    box('paris-bus-top', -1.3, 1.65, -2.7, 2.6, .35, 5.4, '#c7c9bb', 'metal'),
    // Narrow solid stop kiosks screen the outer spawn lanes while leaving
    // walkable gaps on both sides of the central bus.
    box('paris-bus-stop-west', -3.4, 0, -.9, .7, 2.2, 1.8, '#647a70'),
    box('paris-bus-stop-east', 2.7, 0, -.9, .7, 2.2, 1.8, '#647a70'),
    ...[[-6.4, -1.2], [4.4, -1.2]].map(([x, z], i) => box(`paris-planter-${i}`, x, 0, z, 2, .85, 2.4, '#738866')),
    box('paris-cafe-terrace-table', leftX + 2, 0, royale ? 1 : -.8, 2.2, .75, 1.4, '#94694b', 'wood'),
    box('paris-cafe-terrace-screen', leftX + .3, 0, -1.5, .7, 1.3, 3.6, '#7b9273'),
    box('paris-courtyard-bench', rightX + 1.4, 0, royale ? -.7 : -2.6, 3.4, .65, 1.1, '#977652', 'wood'),
    box('paris-courtyard-planter', rightX + width - 2.1, 0, -1.5, 1.4, 1.1, 2.5, '#71896a'),
    box('paris-west-arcade-cart', royale ? -30 : -24.3, 0, royale ? 2 : -1, 1.8, .9, 2.3, '#9c7650', 'wood'),
    box('paris-east-arcade-cart', royale ? 28.5 : 22.7, 0, -1, 1.8, .9, 2.3, '#9c7650', 'wood'),
    box('paris-west-site-crate', -15.9, 0, royale ? -24 : -15.6, 1.7, .8, 1.7, '#a28c6f', 'wood'),
    box('paris-east-site-crate', 14.2, 0, royale ? -24 : -15.6, 1.7, .8, 1.7, '#a28c6f', 'wood'),
  ];
  const decorations = [
    paint('road', -4, -halfD, 8, halfD * 2, '#81898a'),
    paint('sidewalk', -5.2, -halfD, 1.2, halfD * 2, '#b8b1a3'),
    paint('sidewalk', 4, -halfD, 1.2, halfD * 2, '#b8b1a3'),
    paint('crosswalk', -4, royale ? 7 : 12.5, 8, 2.2, '#dfd9c9'),
    paint('crosswalk', -4, royale ? -8 : -12.7, 8, 2.2, '#dfd9c9'),
    paint('park', rightX + .4, -3, width - .8, 5.9, '#899a76'),
    paint('cafe', leftX + .4, -3, width - .8, 5.9, '#c3ad8c'),
  ];
  const roofLinks = [], roofLandmarks = [];
  const roof = (id, x, z, w, d) => {
    const value = box(id, x, 3.68, z, w, .32, d, '#5b6873', 'slate');
    roofLinks.push(value); roofLandmarks.push(Object.freeze({ kind: 'roof-passage', ...value, collisionIds: Object.freeze([id]) }));
  };
  const westX = royale ? -21 : -17, eastX = royale ? 18 : 17;
  const northZ = royale ? -16 : -10.5, southZ = royale ? 15 : 8.6;
  const westEnd = definitions[0][3] + definitions[0][5], eastEnd = definitions[1][3] + definitions[1][5];
  roof('paris-west-roof-passage', westX, westEnd, 3, definitions[2][3] - westEnd);
  roof('paris-east-roof-passage', eastX, eastEnd, 3, definitions[3][3] - eastEnd);
  roof('paris-north-roof-bridge', definitions[0][2] + definitions[0][4] - 1.5, northZ,
    definitions[1][2] - definitions[0][2] - definitions[0][4] + 3, 3.2);
  roof('paris-south-roof-bridge', definitions[2][2] + definitions[2][4] - 1.5, southZ,
    definitions[3][2] - definitions[2][2] - definitions[2][4] + 3, 3.2);
  // Roof gardens and dormer housings break the cross-street sniper angles.
  for (const [index, [x, z]] of [[westX, 0], [eastX, royale ? -4 : -2], [royale ? -6 : -5, northZ], [royale ? 2 : 2, southZ]].entries()) {
    const value = box(`paris-roof-dormer-${index}`, x, 4, z, .8, 1.25, .7, '#ac9e88', 'stone');
    roofLinks.push(value); roofLandmarks.push(Object.freeze({ kind: 'roof-dormer', ...value, collisionIds: Object.freeze([value.id]) }));
  }
  const lowerCover = environmentCover([
    { id: 'paris-florist-hops', name: 'Florist stone planters', kind: 'stone-planter', start: [royale ? -28 : -23, 7], end: [royale ? -28 : -23, 12],
      boxes: [0, 1].map(i => ({ id: `paris-florist-${i}`, x: (royale ? -28 : -23) - .7, z: 8 + i * 1.8, w: 1.4, h: i ? .84 : .48, d: 1.4,
        color: '#879777', material: 'stone', approaches: [[royale ? -26.6 : -21.6, 8.7 + i * 1.8]] })) },
    { id: 'paris-courier-hops', name: 'Boulevard courier supplies', kind: 'delivery-case', start: [-6, 13.6], end: [-1, 13.6],
      boxes: [0, 1].map(i => ({ id: `paris-courier-${i}`, x: -5 + i * 1.8, z: 12.9, w: 1.4, h: i ? .84 : .48, d: 1.4,
        color: '#b78d5c', material: 'wood', approaches: [[-4.3 + i * 1.8, 15.0]] })) },
    { id: 'paris-metro-hops', name: 'Métro repair supplies', kind: 'service-case', start: [royale ? 2.7 : 22.7, royale ? -26 : -13.5], end: [royale ? 2.7 : 22.7, royale ? -21 : -8.5],
      boxes: [0, 1].map(i => ({ id: `paris-metro-${i}`, x: royale ? 2 : 22, z: (royale ? -25 : -12.5) + i * 1.8, w: 1.4, h: i ? .84 : .48, d: 1.4,
        color: '#608e89', material: 'metal', approaches: [[royale ? 4.2 : 24.2, (royale ? -24.3 : -11.8) + i * 1.8]] })) },
  ]);
  const roofY = 4;
  const upperFloors = Object.freeze([Object.freeze({ id: 'paris-mansard-circuit', name: 'Connected mansard roof circuit',
    colliderIds: Object.freeze([...homes.map(home => home.metadata.roofId), ...roofLinks.filter(value => value.material === 'slate').map(value => value.id)]),
    routeIds: Object.freeze(homes.flatMap(home => home.routes.map(route => route.id))),
    underpasses: Object.freeze([point(westX + 1.5, royale ? 3.8 : 1.4), point(0, northZ + 1.1)]),
    traverse: Object.freeze([point(westX + 1.5, northZ + 1.1, roofY), point(westX + 1.5, southZ + .7, roofY),
      point(eastX + (royale ? 2.2 : 1.5), southZ + .7, roofY), point(eastX + (royale ? 2.2 : 1.5), northZ + 1.1, roofY)]) })]);
  const common = {
    id: 'paris', name: 'Paris Rooftops',
    description: 'Irregular stone blocks form narrow courtyards around a bus boulevard. Eight masonry rises reach a complete mansard-roof circuit: cross the street high above traffic, turn around chimney cover, or counter through open café and atelier interiors underneath.',
    bounds: Object.freeze({ minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD }),
    authoredLayout: true, ...lowerCover, upperFloors,
    colliders: Object.freeze([...perimeter, ...homes.flatMap(home => home.colliders), ...cover, ...roofLinks, ...lowerCover.colliders]),
    routes: Object.freeze(homes.flatMap(home => home.routes)), buildings: Object.freeze(homes.map(home => home.metadata)),
    landmarks: Object.freeze([...roofLandmarks, ...lowerCover.landmarks]),
    decorations: Object.freeze(decorations), floorColor: '#b6afa2', skyColor: '#d1e0e5', theme: 'paris',
  };
  if (!royale) return Object.freeze({ ...common,
    sites: Object.freeze([Object.freeze({ id: 'A', x: -13, z: -15, radius: 2.2 }), Object.freeze({ id: 'B', x: 13, z: -15, radius: 2.2 })]),
    spawns: Object.freeze([Object.freeze([-3, 0, 3].map(x => Object.freeze({ x, z: 18, yaw: 0 }))), Object.freeze([3, 0, -3].map(x => Object.freeze({ x, z: -18, yaw: Math.PI })))]),
  });
  const ring = [[-28, -28], [-12, -28], [0, -28], [12, -28], [28, -28], [28, -12], [28, 0], [28, 12], [28, 28], [12, 28], [0, 28], [-12, 28], [-28, 28], [-28, 12], [-28, 0], [-28, -12]];
  const outsideLoot = [
    loot('paris-cafe-terrace', leftX + 5, 1.7, 'heal'), loot('paris-bookshop-garden', rightX + 5, 1.7, 'weapon'),
    loot('paris-west-passage', -28, 5, 'weapon'), loot('paris-east-passage', 28, 5, 'ammo'),
    loot('paris-northwest-arch', -19, -25, 'weapon'), loot('paris-northeast-arch', 19, -25, 'ammo'),
    loot('paris-southwest-arch', -19, 25, 'heal'), loot('paris-southeast-arch', 19, 25, 'weapon'),
    loot('paris-bus-north', 0, -4.6, 'grenade'), loot('paris-bus-south', 0, 7.2, 'heal'),
    loot('paris-west-planter-shadow', -8, 0, 'ammo'), loot('paris-east-planter-shadow', 8, 0, 'grenade'),
    loot('paris-north-boulevard', 5.2, -23, 'weapon'), loot('paris-south-boulevard', -2.5, 23, 'weapon'),
    loot('paris-west-courtyard', -14, 4, 'ammo'), loot('paris-east-courtyard', 14, 4, 'heal'),
  ];
  return Object.freeze({ ...common, sites: Object.freeze([]),
    spawnPoints: Object.freeze(ring.map(([x, z]) => Object.freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))),
    lootPoints: Object.freeze([...homes.flatMap(home => home.lootPoints), ...outsideLoot]), stormCenter: point(0, 9),
  });
}
