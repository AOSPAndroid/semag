/** Two authored close-quarters arenas. Every visible solid also blocks bodies and shots. */
const box = (id, x, y, z, w, h, d, color, material = 'metal') => Object.freeze({ id, x, y, z, w, h, d, color, material });
const point = (x, z, y = 0) => Object.freeze({ x, y, z });
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
  const prefix = royale ? 'boundary' : 'wall', colliders = [], landmarks = [], routes = [], buildings = [], decorations = [];
  const solid = (kind, value, label) => {
    colliders.push(value);
    if (kind) landmarks.push(Object.freeze({ kind, ...value, ...(label ? { label } : {}), collisionIds: Object.freeze([value.id]) }));
    return value;
  };
  const grouped = (kind, values, label) => {
    colliders.push(...values);
    landmarks.push(Object.freeze({ kind, id: values[0].id, ...(label ? { label } : {}), collisionIds: Object.freeze(values.map(value => value.id)) }));
  };
  for (const value of [
    box(`${prefix}-west`, -half - 1, 0, -half - 1, 1, 7.8, half * 2 + 2, settings.wall),
    box(`${prefix}-east`, half, 0, -half - 1, 1, 7.8, half * 2 + 2, settings.wall),
    box(`${prefix}-north`, -half, 0, -half - 1, half * 2, 7.8, 1, settings.wall),
    box(`${prefix}-south`, -half, 0, half, half * 2, 7.8, 1, settings.wall),
  ]) solid(null, value);
  const ceiling = Object.freeze({ ...box(`${id}-hall-ceiling`, -half, 7.4, -half, half * 2, .3, half * 2, settings.ceiling), overhead: true });
  solid(null, ceiling);

  // Both ends of every deck can be approached from the connected ground loop.
  // Four .8 m rises use the shipped jump, with clear 2.2 m square landings.
  function climb(routeId, name, x, edge, direction, roofId, side) {
    const steps = [];
    for (let index = 0; index < 3; index++) {
      const z = edge - direction * (5.5 - index * 2.2), colliderId = `${routeId}-step-${index + 1}`;
      solid(null, box(colliderId, x - 1.1, 0, z - 1.1, 2.2, .8 * (index + 1), 2.2,
        index % 2 ? '#849398' : id === 'market' ? '#a78253' : '#77766c', id === 'market' ? 'wood' : 'metal'));
      steps.push(Object.freeze({ colliderId, x, z }));
    }
    steps.push(Object.freeze({ colliderId: roofId, x, z: edge + direction * .7 }));
    const start = point(x, edge - direction * 7.2);
    routes.push(Object.freeze({ id: routeId, name, side, role: 'flank', start,
      approach: Object.freeze([start]), steps: Object.freeze(steps) }));
  }

  if (id === 'market') {
    // The shutters are genuine rooms with two opposed doors. Their rooftops
    // add counterplay without a single platform controlling the entire court.
    for (const [side, x, accent, label] of [['west', -15.4, '#dfac62', 'BAKERY'], ['east', 8, '#65bac0', 'ARCADE']]) {
      const roomId = `market-${side}-shop`, roofId = `${roomId}-roof`, width = 7.4, depth = 8, z = -4, t = .4, wing = (width - 2.6) / 2;
      const walls = [box(`${roomId}-west`, x, 0, z, t, 3, depth, settings.wall, 'stone'),
        box(`${roomId}-east`, x + width - t, 0, z, t, 3, depth, settings.wall, 'stone')];
      for (const [face, edge] of [['north', z], ['south', z + depth - t]]) walls.push(
        box(`${roomId}-${face}-left`, x + t, 0, edge, wing - t, 3, t, '#657376', 'metal'),
        box(`${roomId}-${face}-right`, x + wing + 2.6, 0, edge, wing - t, 3, t, '#657376', 'metal'),
        box(`${roomId}-${face}-lintel`, x + wing, 2.4, edge, 2.6, .6, t, accent, 'metal'));
      grouped('market-shop', walls, label);
      solid(null, box(roofId, x, 3, z, width, .2, depth, '#6b7370', 'metal'));
      solid('market-stall', box(`${roomId}-counter`, x + .7, 0, -.9, 1.5, .85, 1.8, '#9b794b', 'wood'), label);
      solid('hvac', box(`${roomId}-roof-service`, x + (side === 'west' ? 5.8 : 1.2), 3.2, -.7, 1, .85, 1.4, '#52666a'));
      solid(null, box(`${roomId}-roof-screen`, x + (side === 'west' ? .2 : width - 1.4), 3.2, -.8, 1.2, 1, 1.6, accent));
      for (const [face, edge, direction] of [['north', -4, 1], ['south', 4, -1]])
        climb(`${roomId}-${face}-rise`, `${label.toLowerCase()} / ${face} delivery crates`, x + (side === 'west' ? 1.2 : width - 1.2), edge, direction, roofId, face);
      buildings.push(Object.freeze({ id: roomId, name: label, roofId, wallIds: Object.freeze(walls.map(value => value.id)),
        interior: Object.freeze({ minX: x + t, maxX: x + width - t, minZ: z + t, maxZ: z + depth - t }),
        doorways: Object.freeze([-1, 1].map(sign => Object.freeze({ x: x + width / 2, z: sign * 3.8, width: 2.6, height: 2.4,
          outside: point(x + width / 2, sign * 5), inside: point(x + width / 2, sign * 2.8) }))) }));
      decorations.push(paint('shop-tiles', x + t, z + t, width - t * 2, depth - t * 2, '#666554'));
    }
    for (const [index, [x, z, tint, label]] of [
      [-6.4, -8.7, '#b58c58', 'NOODLES'], [3.2, -8.7, '#609c9d', 'TEA'],
      [-6.4, 6.5, '#679c91', 'FRUIT'], [3.2, 6.5, '#b17855', 'GRILL'],
    ].entries()) {
      const stallId = `market-food-${index}`;
      grouped('market-stall', [
        box(`${stallId}-counter`, x, 0, z + .95, 3.2, .9, 1.25, tint, 'wood'),
        box(`${stallId}-shutter`, x, 0, z, 3.2, 2.8, .3, '#425861'),
        box(`${stallId}-post-west`, x, 0, z + 1.95, .18, 2.8, .25, '#64787a'),
        box(`${stallId}-post-east`, x + 3.02, 0, z + 1.95, .18, 2.8, .25, '#64787a'),
        box(`${stallId}-canopy`, x, 2.8, z, 3.2, .18, 2.2, tint),
      ], label);
    }
    grouped('market-stall', [box('market-center-kiosk', -2, 0, -1.5, 4, 2.65, 3, '#345562'),
      box('market-center-sign', -1.7, 2.65, -1.2, 3.4, .55, 2.4, '#71bbc0')], 'NIGHT MARKET');
    for (const [index, [x, z]] of [[-7.3, -10.8], [6.9, -10.8], [-7.3, 10.3], [6.9, 10.3]].entries())
      solid(null, box(`market-hall-column-${index}`, x, 0, z, .4, 7.4, .5, '#5c7076'));
    for (const sign of [-1, 1]) solid('market-stall', box(`market-arrival-screen-${sign}`, -3.3, 0, sign < 0 ? -12.2 : 11.5,
      6.6, 2.85, .7, sign < 0 ? '#4e787e' : '#9c764d'), 'WELCOME');
    decorations.push(paint('market-cross-lane', -7.8, -3, 15.6, 6, '#575958'),
      paint('market-delivery-lane', -17.3, -17, 1, 34, '#58615b'), paint('market-delivery-lane', 16.3, -17, 1, 34, '#58615b'));
  } else {
    // Workshops are open below maintenance decks, rather than reusing the
    // market rooms. Real boiler housings force a series of short corner peeks.
    for (const [side, x] of [['west', -15], ['east', 8]]) {
      const deckId = `lockdown-${side}-maintenance-deck`;
      solid('service-control', box(deckId, x, 2.9, -5, 7, .3, 10, '#718089'), 'MAINTENANCE');
      for (const [index, [dx, dz]] of [[.15, .15], [6.3, .15], [.15, 9.3], [6.3, 9.3]].entries())
        solid(null, box(`lockdown-${side}-support-${index}`, x + dx, 0, -5 + dz, .55, 2.9, .55, '#4b5a62'));
      solid(null, box(`lockdown-${side}-deck-screen`, x + (side === 'west' ? .15 : 5.7), 3.2, -1.3, 1.15, 1.1, 2.6, '#8d7453'));
      for (const [face, edge, direction] of [['north', -5, 1], ['south', 5, -1]])
        climb(`lockdown-${side}-${face}-rise`, `${side} workshop / ${face} maintenance risers`, x + 3.5, edge, direction, deckId, face);
      solid('generator', box(`lockdown-${side}-machine`, x + (side === 'west' ? .95 : 4.15), 0, -2, 1.9, 2.2, 4, '#425762'));
      decorations.push(paint('workshop-floor', x, -5, 7, 10, '#646358'));
    }
    solid('slag-vat', box('lockdown-central-furnace', -3, 0, -4, 6, 4.1, 8, '#755c49'));
    solid('service-control', box('lockdown-furnace-panel', -.8, 1.2, 4, 1.6, 1.2, .2, '#52777b'), 'FURNACE');
    for (const [index, [x, z, w, d]] of [[-6.5, -7.6, 2.6, 2.6], [3.9, 5, 2.6, 2.6],
      [-5.8, 7.3, 2.8, .7], [3, -8, 2.8, .7], [-3.8, -12.6, 7.6, .8], [-3.8, 11.8, 7.6, .8]].entries())
      solid(index < 2 ? 'generator' : 'service-control', box(`lockdown-baffle-${index}`, x, 0, z, w, index < 2 ? 2.7 : 3.3, d,
        index < 2 ? '#5c6c72' : '#80694f'), index < 2 ? undefined : 'LOCKDOWN');
    for (const [index, [x, z]] of [[-16.8, -13.8], [16.3, -13.8], [-16.8, 13.3], [16.3, 13.3]].entries())
      solid(null, box(`lockdown-hall-column-${index}`, x, 0, z, .5, 7.4, .5, '#63737a'));
    decorations.push(paint('hazard-lane', -7.6, -11, 1.5, 22, '#817249'), paint('hazard-lane', 6.1, -11, 1.5, 22, '#817249'),
      paint('furnace-pad', -3.7, -4.7, 7.4, 9.4, '#685b4b'));
  }

  // Royale keeps a real 64 m scavenging area. Offset outer screens and annex
  // machinery break its perimeter angles; they do not stretch the core doors.
  if (royale) {
    for (const [index, [x, z, w, d]] of [
      [-24.5, -18, 6.5, .8], [18, -18, 6.5, .8], [-24.5, 17.2, 6.5, .8], [18, 17.2, 6.5, .8],
      [-30, -7, 10, .8], [20, 6.2, 10, .8], [-24, 5, 6, .8], [18, -5.8, 6, .8],
      [-8.5, -30, .8, 10], [7.7, 20, .8, 10], [-5, 22.5, .8, 6], [4.2, -28.5, .8, 6],
    ].entries()) solid(id === 'market' ? 'market-stall' : 'service-control',
      box(`${id}-annex-screen-${index}`, x, 0, z, w, 3.5, d, index % 2 ? '#57747a' : '#847255'), id === 'market' ? 'DELIVERY' : 'WORKSHOP');
    for (const [index, [x, z]] of [[-25, -24], [21, -24], [-25, 21], [21, 21]].entries())
      solid(id === 'market' ? 'market-stall' : 'generator', box(`${id}-annex-machine-${index}`, x, 0, z, 4, 2.9, 3,
        id === 'market' ? '#907253' : '#596c74', id === 'market' ? 'wood' : 'metal'), id === 'market' ? 'SUPPLIES' : undefined);
    for (const [side, x, z, direction] of [['north', -17, -23, 1], ['south', 10, 19, -1]]) {
      const deckId = `${id}-annex-${side}-deck`, edge = direction > 0 ? z : z + 4;
      solid(null, box(deckId, x, 2.9, z, 7, .3, 4, '#6d7b80'));
      for (const [index, [dx, dz]] of [[.15, .15], [6.3, .15], [.15, 3.3], [6.3, 3.3]].entries())
        solid(null, box(`${deckId}-post-${index}`, x + dx, 0, z + dz, .55, 2.9, .55, '#50636b'));
      climb(`${id}-annex-${side}-rise`, `${side} annex / supply lookout`, x + 3.5, edge, direction, deckId, side);
    }
    decorations.push(paint('annex-delivery-lane', -31, -31, 12, 62, '#4c595b'),
      paint('annex-delivery-lane', 19, -31, 12, 62, id === 'market' ? '#535a59' : '#686354'));
  }

  const common = { id, name: settings.name, combatStyle: 'close', theme: id, mode,
    description: id === 'market'
      ? 'Close-combat night market. Solid food stalls and shutter shops split short shotgun lanes; two-door shops, delivery flanks and roof climbs reward sword ambushes and quick escapes.'
      : 'Close-combat industrial lockdown. Boiler housings and blast screens interrupt rifle angles; looped workshops, walk-under maintenance decks and four stair chains reward swords and shotguns.',
    bounds: Object.freeze({ minX: -half, maxX: half, minZ: -half, maxZ: half }),
    colliders: Object.freeze(colliders), landmarks: Object.freeze(landmarks), decorations: Object.freeze(decorations),
    routes: Object.freeze(routes), buildings: Object.freeze(buildings), ceilings: Object.freeze([ceiling.id]), tunnels: Object.freeze([]),
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
  const lootPoints = caches.map(([x, z], index) => cache(`${id}-cache-${index}`, x, z, kinds[index % kinds.length]));
  for (const [index, [x, z]] of [[-12, -2.4], [-12, 2.4], [12, -2.4], [12, 2.4], [-13.5, -21], [13.5, 21]].entries())
    lootPoints.push(cache(`${id}-upper-cache-${index}`, x, z, index % 2 ? 'heal' : 'weapon', 3.2));
  return Object.freeze({ ...common, sites: Object.freeze([]), lootPoints: Object.freeze(lootPoints),
    spawnPoints: Object.freeze(ring.map(([x, z]) => Object.freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))),
    stormCenter: point(0, 6.5) });
}
