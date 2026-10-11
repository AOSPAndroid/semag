import { authoredLayoutBuilder, layoutPoint as point, layoutBox as box } from './voxel-core-layouts.js';

/** Two authored close-quarters arenas. Every visible solid also blocks bodies and shots. */
const paint = (kind, x, z, w, d, color, y = 0) => Object.freeze({ kind, x, z, w, d, color, y });
const cache = (id, x, z, kind, y = 0) => Object.freeze({ id, x, y, z, kind });
const CONFIG = Object.freeze({
  market: Object.freeze({ name: 'Neon Market', floor: '#414b50', sky: '#17283c', wall: '#37515c', accent: '#edb55a', ceiling: '#2b3943' }),
  lockdown: Object.freeze({ name: 'Foundry Lockdown', floor: '#575451', sky: '#403b37', wall: '#535d62', accent: '#e29b49', ceiling: '#3e464d' }),
});

export const CLOSE_COMBAT_MAP_IDS = Object.freeze(Object.keys(CONFIG));

export function createCloseCombatMap(id, mode = 'breach') {
  if (!Object.hasOwn(CONFIG, id)) throw new TypeError('Unknown close-combat map');
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Close-combat mode must be breach or royale');
  const settings = CONFIG[id], royale = mode === 'royale', half = royale ? 32 : 18;
  const prefix = royale ? 'boundary' : 'wall', b = authoredLayoutBuilder(id);
  const { colliders, landmarks, routes, buildings, decorations, cover, deck, floor, hop } = b;
  const solid = (kind, value, label) => { colliders.push(value); if (kind) landmarks.push(Object.freeze({ kind, ...value,
    ...(label ? { label } : {}), collisionIds: Object.freeze([value.id]) })); return value; };
  const grouped = (kind, values, label) => { colliders.push(...values); landmarks.push(Object.freeze({ kind, id: values[0].id,
    ...(label ? { label } : {}), collisionIds: Object.freeze(values.map(value => value.id)) })); };
  for (const value of [
    box(`${prefix}-west`, -half - 1, 0, -half - 1, 1, 7.8, half * 2 + 2, settings.wall),
    box(`${prefix}-east`, half, 0, -half - 1, 1, 7.8, half * 2 + 2, settings.wall),
    box(`${prefix}-north`, -half, 0, -half - 1, half * 2, 7.8, 1, settings.wall),
    box(`${prefix}-south`, -half, 0, half, half * 2, 7.8, 1, settings.wall),
  ]) solid(null, value);
  const ceiling = Object.freeze({ ...box(`${id}-hall-ceiling`, -half, 7.4, -half, half * 2, .3, half * 2, settings.ceiling), overhead: true });
  solid(null, ceiling);
  const climb = (routeId, name, x, edge, direction, roofId, side) => b.climb(routeId, name, 'z', x, edge, direction, roofId, side);

  if (id === 'market') {
    // Shops are staggered diagonally, not mirrored. Their opposed doors join
    // a street-level food court below a continuous delivery-roof circuit.
    for (const [side, x, z, accent, label] of [['west', -15.4, -8, '#dfac62', 'BAKERY'], ['east', 6, 1, '#65bac0', 'ARCADE']]) {
      const roomId = `market-${side}-shop`, roofId = `${roomId}-roof`, width = 7.4, depth = 8, t = .4, wing = (width - 2.6) / 2;
      const walls = [box(`${roomId}-west`, x, 0, z, t, 2.9, depth, settings.wall, 'stone'),
        box(`${roomId}-east`, x + width - t, 0, z, t, 2.9, depth, settings.wall, 'stone')];
      for (const [face, edge] of [['north', z], ['south', z + depth - t]]) walls.push(
        box(`${roomId}-${face}-left`, x + t, 0, edge, wing - t, 2.9, t, '#657376', 'metal'),
        box(`${roomId}-${face}-right`, x + wing + 2.6, 0, edge, wing - t, 2.9, t, '#657376', 'metal'),
        box(`${roomId}-${face}-lintel`, x + wing, 2.4, edge, 2.6, .5, t, accent, 'metal'));
      grouped('market-shop', walls, label);
      deck(roofId, x, z, width, depth, '#6b7370', 'metal', 3.2, false);
      solid('market-stall', box(`${roomId}-counter`, x + .7, 0, z + 3.1, 1.5, .85, 1.8, '#9b794b', 'wood'), label);
      solid('hvac', box(`${roomId}-roof-service`, x + (side === 'west' ? 5.8 : 1.2), 3.2, z + 3.3, 1, .85, 1.4, '#52666a'));
      cover(`${roomId}-roof-screen`, x + (side === 'west' ? .2 : width - 1.4), 3.2, z + 4.2, 1.2, 1, 1.6, accent);
      const riseX = x + (side === 'west' ? 1.3 : 5.9);
      climb(`${roomId}-north-rise`, `${label.toLowerCase()} / north delivery crates`, riseX, z, 1, roofId, 'north');
      climb(`${roomId}-south-rise`, `${label.toLowerCase()} / south delivery crates`, riseX, z + depth, -1, roofId, 'south');
      const doorways = [['north', z + .2, z - 1, z + 1.2], ['south', z + depth - .2, z + depth + 1, z + depth - 1.2]].map(([face, edge, outside, inside]) => Object.freeze({
        face, x: x + width / 2, z: edge, width: 2.6, height: 2.4, outside: point(x + width / 2, outside), inside: point(x + width / 2, inside) }));
      buildings.push(Object.freeze({ id: roomId, name: label, roofId, wallIds: Object.freeze(walls.map(value => value.id)),
        interior: Object.freeze({ minX: x + t, maxX: x + width - t, minZ: z + t, maxZ: z + depth - t }), doorways: Object.freeze(doorways) }));
      decorations.push(paint('shop-tiles', x + t, z + t, width - t * 2, depth - t * 2, '#666554'));
    }
    deck('market-north-delivery-bridge', -8, -6, 17, 3, '#778f89');
    deck('market-east-delivery-return', 6, -3, 3, 4, '#7a9996');
    deck('market-south-delivery-bridge', -11, 5, 17, 3, '#96836b');
    deck('market-west-delivery-return', -11, 0, 3, 5, '#8c8d7b');
    // Four food stalls form a crooked pedestrian street rather than two rows.
    for (const [index, [x, z, tint, label]] of [
      [-6.6, -1.2, '#b58c58', 'NOODLES'], [-1.9, 2.2, '#609c9d', 'TEA'],
      [1.2, -8.7, '#679c91', 'FRUIT'], [-5.8, 9, '#b17855', 'GRILL'],
    ].entries()) grouped('market-stall', [
      box(`market-food-${index}-counter`, x, 0, z + .8, 3.2, .9, 1.25, tint, 'wood'),
      box(`market-food-${index}-shutter`, x, 0, z, 3.2, 2.6, .3, '#425861'),
      box(`market-food-${index}-canopy`, x, 2.6, z, 3.2, .18, 2.1, tint),
    ], label);
    grouped('market-stall', [box('market-center-kiosk', -3.5, 0, -7.7, 3, 2.65, 2.4, '#345562')], 'NIGHT MARKET');
    for (const sign of [-1, 1]) solid('market-stall', box(`market-arrival-screen-${sign}`, -3.3, 0, sign < 0 ? -12.2 : 11.5,
      6.6, 2.85, .7, sign < 0 ? '#4e787e' : '#9c764d'), 'WELCOME');
    floor('market-delivery-circuit', 'Staggered shop roofs and delivery skywalks',
      ['market-west-shop-roof', 'market-east-shop-roof', 'market-north-delivery-bridge', 'market-east-delivery-return', 'market-south-delivery-bridge', 'market-west-delivery-return'],
      routes.map(value => value.id), [[-5.5, -4.5], [3, 6.5]],
      [[-11.7, -5, 3.2], [-5, -4.5, 3.2], [7.5, -4.5, 3.2], [7.5, 2.5, 3.2], [10, 6.5, 3.2], [-9.5, 6.5, 3.2], [-9.5, -1.5, 3.2]]);
    hop('fruit-deliveries', -7, 13.5, '#b58f59');
    hop('tea-deliveries', 12.5, -11.5, '#6d9994');
    decorations.push(paint('market-cross-lane', -7.8, -3, 13.6, 6, '#575958'));
  } else {
    // A dog-leg machine hall has unequal decks and an overhead return, with
    // short service tunnels under both galleries and real cover at each bend.
    deck('lockdown-west-maintenance-deck', -15, -7, 7, 14, '#718089');
    deck('lockdown-east-maintenance-deck', 4, -2, 9, 9, '#718089');
    deck('lockdown-north-service-bridge', -8, -7, 16, 3, '#7b8584');
    deck('lockdown-east-service-return', 4, -4, 4, 2, '#6f8589');
    deck('lockdown-south-service-bridge', -8, 4, 12, 3, '#8d8475');
    for (const [side, x, north, south] of [['west', -13.5, -7, 7], ['east', 11.5, -2, 7]]) {
      const floorId = `lockdown-${side}-maintenance-deck`;
      climb(`lockdown-${side}-north-rise`, `${side} machine hall / north maintenance rise`, x, north, 1, floorId, 'north');
      climb(`lockdown-${side}-south-rise`, `${side} machine hall / south maintenance rise`, x + (side === 'west' ? 2 : -1.5), south, -1, floorId, 'south');
    }
    solid('slag-vat', box('lockdown-central-furnace', -4, 0, -3, 6, 4.1, 5, '#755c49'));
    solid('service-control', box('lockdown-furnace-panel', -.8, 1.2, 2, 1.6, 1.2, .2, '#52777b'), 'FURNACE');
    solid('generator', box('lockdown-west-machine', -14.3, 0, -2, 1.9, 2.2, 4, '#425762'));
    solid('generator', box('lockdown-east-machine', 9.5, 0, 1, 2.2, 2.2, 3.2, '#425762'));
    cover('lockdown-west-deck-screen', -14.7, 3.2, 1.5, 1.15, 1.1, 2.6, '#8d7453');
    cover('lockdown-east-deck-screen', 11.6, 3.2, 2.5, 1.15, 1.1, 2.6, '#8d7453');
    for (const [index, [x, z, w, d, h]] of [[-6.6, -9.3, 2.2, 2.6, 2.4], [3.2, 7.6, 2.2, 2.6, 2.4],
      [-6.5, 6, 1.5, 2, 1.2], [1, -10, 3.8, .7, 2.7], [-3.8, -12.6, 7.6, .8, 3.3], [-3.8, 11.8, 7.6, .8, 3.3]].entries())
      solid(index < 2 ? 'generator' : 'service-control', box(`lockdown-baffle-${index}`, x, 0, z, w, h, d, index < 2 ? '#5c6c72' : '#80694f'), 'LOCKDOWN');
    floor('lockdown-maintenance-network', 'Machine hall maintenance circuit',
      ['lockdown-west-maintenance-deck', 'lockdown-north-service-bridge', 'lockdown-east-service-return', 'lockdown-east-maintenance-deck', 'lockdown-south-service-bridge'],
      routes.map(value => value.id), [[-10.5, 0], [0, 5.5]],
      [[-11, 4.5, 3.2], [-11, -5.5, 3.2], [6, -5.5, 3.2], [6, 1, 3.2], [7, 5.5, 3.2], [-6, 5.5, 3.2]]);
    hop('casting-tools', -7, 13.5, '#8f7c60', 'metal');
    hop('coolant-cases', 15, -12, '#71888d', 'metal');
    decorations.push(paint('hazard-lane', -7.4, -11, 1.4, 22, '#817249'), paint('furnace-pad', -4.7, -3.7, 7.4, 6.4, '#685b4b'));
  }

  // Royale extends the same authored core with two different districts: a
  // market freight loop and unequal power-plant annexes, not recolored screens.
  if (royale) {
    const screens = id === 'market' ? [
      [-26, -17.8, 7, .65], [18, -17.8, 8, .65], [-30, -8, 8, .5], [-23, 4, 5, .5],
      [19, 5, 11, .65], [-8.5, -29, .7, 8], [5.5, 21, .7, 8], [18, 16, 8, .65],
      [-27, 17, 7, .65], [-5, 19, 3, .65], [4, -23, 3.6, .65],
    ] : [
      [-29, -20, 13, .65], [17, -26, .65, 10], [20, -17.5, 10, .6], [-30, 14, 11, .6],
      [4.7, 21, .65, 8], [-9, -30, .65, 9], [0, -23, 8, .6],
    ];
    for (const [index, [x, z, w, d]] of screens.entries()) solid(id === 'market' ? 'market-stall' : 'service-control',
      box(`${id}-annex-screen-${index}`, x, 0, z, w, 3.5, d, index % 2 ? '#57747a' : '#847255'), id === 'market' ? 'DELIVERY' : 'WORKSHOP');
    const machines = id === 'market' ? [[-25, -24, 4, 3], [21, -24, 4, 3], [-24, 20, 4, 3], [21, 21, 4, 3]]
      : [[-17, -26, 4, 4], [-29, 18, 4, 3], [17, 17, 4, 3], [-3, 25, 6, 2]];
    for (const [index, [x, z, w, d]] of machines.entries()) solid(id === 'market' ? 'market-stall' : 'generator',
      box(`${id}-annex-machine-${index}`, x, 0, z, w, 2.9, d, id === 'market' ? '#907253' : '#596c74', id === 'market' ? 'wood' : 'metal'), id === 'market' ? 'SUPPLIES' : undefined);
    const annexes = id === 'market'
      ? [['north', -18, -24, 11, 4, -9], ['south', 9, 20, 11, 4, 17.5]]
      : [['north', -26, -5, 8, 6, -24], ['south', 19, 7, 8, 6, 25]];
    for (const [side, x, z, w, d, riseX] of annexes) {
      const deckId = `${id}-annex-${side}-deck`;
      deck(deckId, x, z, w, d, id === 'market' ? '#8a8c78' : '#6d7b80');
      const north = `${id}-annex-${side}-north-rise`, south = `${id}-annex-${side}-south-rise`;
      climb(north, `${side} annex / north supply rise`, riseX, z, 1, deckId, 'north');
      climb(south, `${side} annex / south supply rise`, riseX, z + d, -1, deckId, 'south');
      cover(`${deckId}-screen`, riseX > x + w / 2 ? x + .3 : x + w - 1.65, 3.2, z + .3, 1.1, 1.1, 1.4, '#8d8068');
      floor(`${deckId}-floor`, id === 'market' ? `${side} freight loading canopy` : `${side} power annex service deck`,
        [deckId], [north, south], [[x + w / 2, z + d / 2]], [[riseX, z + .8, 3.2], [riseX, z + d - .8, 3.2]]);
    }
    decorations.push(paint('annex-delivery-lane', -31, -31, id === 'market' ? 12 : 6, 62, '#4c595b'),
      paint('annex-delivery-lane', 19, -31, 12, 62, id === 'market' ? '#535a59' : '#686354'));
  }

  const common = { id, name: settings.name, combatStyle: 'close', theme: id, mode,
    description: id === 'market'
      ? 'A crooked pedestrian street winds between staggered bakeries and arcades. Opposed shop doors open below a connected delivery-roof loop; food stalls keep shotgun fights short while four roof rises reward sword flanks.'
      : 'A dog-leg machine hall wraps an off-centre furnace. Unequal galleries join a continuous maintenance circuit above ground workshop passages; machines and blast baffles reward swords and shotguns below exposed service angles.',
    bounds: Object.freeze({ minX: -half, maxX: half, minZ: -half, maxZ: half }),
    ...b.finish(), ceilings: Object.freeze([ceiling.id]), tunnels: Object.freeze([]),
    floorColor: settings.floor, skyColor: settings.sky };
  if (!royale) return Object.freeze({ ...common,
    sites: Object.freeze([-1, 1].map(sign => Object.freeze({ id: sign < 0 ? 'A' : 'B', x: sign * 12, z: -15, radius: 2.2 }))),
    spawns: Object.freeze([Object.freeze([-3, 0, 3].map(x => Object.freeze({ x, z: 15.5, yaw: 0 }))),
      Object.freeze([3, 0, -3].map(x => Object.freeze({ x, z: -15.5, yaw: Math.PI })))]) });

  const ring = [[-28, -28], [-12, -28], [0, -28], [12, -28], [28, -28], [28, -12], [28, 0], [28, 12],
    [28, 28], [12, 28], [0, 28], [-12, 28], [-28, 28], [-28, 12], [-28, 0], [-28, -12]];
  const caches = [
    [-27, -25], [-22, -15], [-16, -16], [-4, -25], [4, -18], [16, -16], [22, -15], [27, -25],
    [-27, -3], [-20, -11], [-20, 10], [-27, 12], [27, -12], [20, -10], [20, 11], [27, 3],
    [-27, 25], [-22, 15], [-16, 16], [-4, 18], [4, 25], [16, 16], [22, 15], [27, 25],
    [-11, -2.5], [-11, 0], [-11, 2.5], [11, -2.5], [11, 0], [11, 2.5],
    [-5, 2.8], [5, -2.8], [0, -9.5], [0, 9.5],
  ];
  const kinds = ['weapon', 'heal', 'ammo', 'weapon', 'grenade', 'weapon'];
  const lootPoints = caches.map(([x, z], index) => {
    if (id === 'market' && index === 25) x = -12;
    if (id === 'market' && (index === 27 || index === 28)) x = 9.5;
    if (id === 'lockdown' && index === 27) x = 8.5;
    if (id === 'lockdown' && index === 29) x = 7;
    return cache(`${id}-cache-${index}`, x, z, kinds[index % kinds.length]);
  });
  // Each opposed-door shop contains a gun plus useful ground supplies;
  // the delivery-roof caches remain a separate reward for gaining height.
  if (id === 'market') lootPoints.push(
    cache('market-bakery-ammo', -11.7, -6.2, 'ammo'), cache('market-bakery-heal', -11.7, -4.2, 'heal'),
    cache('market-arcade-ammo', 10.5, 4.5, 'ammo'), cache('market-arcade-heal', 10.5, 7, 'heal'));
  for (const [index, [x, z]] of (id === 'market' ? [[-11.7, -6], [-11.7, -2], [10.5, 3], [10.5, 7], [-13.5, -22], [13.5, 22]] : [[-11, -5], [-11, 4.5], [7, 0], [7, 5.5], [-22, -3], [23, 10]]).entries())
    lootPoints.push(cache(`${id}-upper-cache-${index}`, x, z, index % 2 ? 'heal' : 'weapon', 3.2));
  return Object.freeze({ ...common, sites: Object.freeze([]), lootPoints: Object.freeze(lootPoints),
    spawnPoints: Object.freeze(ring.map(([x, z]) => Object.freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))),
    stormCenter: point(0, 9.5) });
}
