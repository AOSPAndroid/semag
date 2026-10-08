/** Paris streets shared by the tactical and scavenging modes. Solids are the visual geometry. */
const box = (id, x, y, z, w, h, d, color, material = 'stone') => Object.freeze({ id, x, y, z, w, h, d, color, material });
const point = (x, z, y = 0) => Object.freeze({ x, y, z });
const loot = (id, x, z, kind, y = 0) => Object.freeze({ id, x, y, z, kind });
const step = (colliderId, x, z) => Object.freeze({ colliderId, x, z });
const paint = (kind, x, z, w, d, color) => Object.freeze({ kind, x, z, w, d, color });

/** Wide contiguous delivery crates make every rooftop attainable by the heaviest gun. */
function stairs(id, name, axis, offset, edge, direction, roofId, landing, side) {
  const colliders = [], steps = [];
  for (let i = 0; i < 4; i++) {
    const distance = edge - direction * (7.7 - i * 2.2);
    const x = axis === 'x' ? distance : offset, z = axis === 'z' ? distance : offset;
    const colliderId = `${id}-step-${i + 1}`;
    colliders.push(box(colliderId, x - 1.1, 0, z - 1.1, 2.2, .8 * (i + 1), 2.2, i % 2 ? '#ad8661' : '#ba9672', 'wood'));
    steps.push(step(colliderId, x, z));
  }
  steps.push(step(roofId, landing.x, landing.z));
  const distance = edge - direction * 9.4;
  const start = point(axis === 'x' ? distance : offset, axis === 'z' ? distance : offset);
  return { colliders, route: Object.freeze({ id, name, side, role: 'flank', start, steps: Object.freeze(steps), approach: Object.freeze([start]) }) };
}

function building(id, name, x, z, w, d, side, left, accent) {
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
  const inner = stairs(`${id}-inner`, `${name} / boulevard delivery rise`, 'x', z + d / 2, innerEdge, left ? -1 : 1,
    roofId, point(left ? x + w - .7 : x + .7, z + d / 2), side);
  const wallIds = Object.freeze(colliders.filter(value => value.id !== roofId && !value.id.endsWith('-chimney')).map(value => value.id));
  const metadata = Object.freeze({
    id, name, roofId, wallIds,
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
  return { colliders: [...colliders, ...outer.colliders, ...inner.colliders], routes: [outer.route, inner.route], metadata, lootPoints };
}

export function createParisMap(mode = 'breach') {
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Paris mode must be breach or royale');
  const royale = mode === 'royale', halfW = royale ? 32 : 25, halfD = royale ? 32 : 22;
  const width = royale ? 9 : 8, depth = royale ? 8 : 7, leftX = royale ? -24 : -18, rightX = royale ? 15 : 10;
  const northZ = royale ? -19 : -11, southZ = royale ? 11 : 4;
  const homes = [
    building('paris-opera', 'Maison de l’Opéra', leftX, northZ, width, depth, 'north', true, '#406f75'),
    building('paris-atelier', 'Atelier du Boulevard', rightX, northZ, width, depth, 'north', false, '#7d637d'),
    building('paris-cafe', 'Café des Toits', leftX, southZ, width, depth, 'south', true, '#944f43'),
    building('paris-librairie', 'Librairie Saint-Martin', rightX, southZ, width, depth, 'south', false, '#5e745a'),
  ];
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
    box('paris-cafe-terrace-table', leftX + 2, 0, 0, 2.2, .75, 1.4, '#94694b', 'wood'),
    box('paris-cafe-terrace-screen', leftX + .3, 0, -1.5, .7, 1.3, 3.6, '#7b9273'),
    box('paris-courtyard-bench', rightX + 1.4, 0, -.7, 3.4, .65, 1.1, '#977652', 'wood'),
    box('paris-courtyard-planter', rightX + width - 2.1, 0, -1.5, 1.4, 1.1, 2.5, '#71896a'),
    box('paris-west-arcade-cart', leftX - 3.2, 0, -1, 2, .9, 2.3, '#9c7650', 'wood'),
    box('paris-east-arcade-cart', rightX + width + 1.2, 0, -1, 2, .9, 2.3, '#9c7650', 'wood'),
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
  const common = {
    id: 'paris', name: 'Paris Rooftops',
    description: 'Open cafés, stone apartment courtyards and a bus-lined boulevard. Two delivery-crate routes reach every slate rooftop; both street doors stay open for fast flanks.',
    bounds: Object.freeze({ minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD }),
    colliders: Object.freeze([...perimeter, ...homes.flatMap(home => home.colliders), ...cover]),
    routes: Object.freeze(homes.flatMap(home => home.routes)), buildings: Object.freeze(homes.map(home => home.metadata)),
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
    loot('paris-bus-north', 0, -4.6, 'grenade'), loot('paris-bus-south', 0, 4.6, 'heal'),
    loot('paris-west-planter-shadow', -8, 0, 'ammo'), loot('paris-east-planter-shadow', 8, 0, 'grenade'),
    loot('paris-north-boulevard', 2.5, -23, 'weapon'), loot('paris-south-boulevard', -2.5, 23, 'weapon'),
    loot('paris-west-courtyard', -14, 4, 'ammo'), loot('paris-east-courtyard', 14, 4, 'heal'),
  ];
  return Object.freeze({ ...common, sites: Object.freeze([]),
    spawnPoints: Object.freeze(ring.map(([x, z]) => Object.freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))),
    lootPoints: Object.freeze([...homes.flatMap(home => home.lootPoints), ...outsideLoot]), stormCenter: point(0, 9),
  });
}
