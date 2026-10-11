/** Crownfall Keep: honest castle rooms, connected battlements and a looted village. */
const freeze = Object.freeze;
const point = (x, z, y = 0) => freeze({ x, y, z });
const box = (id, x, y, z, w, h, d, color = '#96978a', material = 'castle-stone') => freeze({ id, x, y, z, w, h, d, color, material });
const cache = (id, x, z, kind, y = 0) => freeze({ id, x, y, z, kind });
const paint = (kind, x, z, w, d, color) => freeze({ kind, x, y: .012, z, w, d, color });

export function createMedievalMap(mode = 'breach') {
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Medieval mode must be breach or royale');
  const royale = mode === 'royale', half = royale ? 48 : 28, top = royale ? 3.36 : 3.2;
  const colliders = [], landmarks = [], decorations = [], routes = [], buildings = [], upperFloors = [], coverIds = [], lootPoints = [];
  const jumpCover = [], hopRoutes = [], regions = [];
  const solid = value => { colliders.push(value); return value; };
  const mark = (id, kind, name, values, showLabel = true) => {
    const x = Math.min(...values.map(value => value.x)), z = Math.min(...values.map(value => value.z));
    const y = Math.min(...values.map(value => value.y));
    landmarks.push(freeze({ id, kind, name, label: showLabel ? name.toUpperCase() : '', x, y, z,
      w: Math.max(...values.map(value => value.x + value.w)) - x,
      h: Math.max(...values.map(value => value.y + value.h)) - y,
      d: Math.max(...values.map(value => value.z + value.d)) - z,
      collisionIds: freeze(values.map(value => value.id)) }));
  };
  const cover = (id, x, y, z, w, h, d, color = '#94734f', material = 'castle-timber', kind = 'combat-cover', name) => {
    const names = { battlement: 'Battlement', 'armoury-chest': 'Armoury chest', blacksmith: 'Anvil',
      'ruined-masonry': 'Stone supplies', 'supply-cart': 'Supply cart', 'combat-cover': material === 'castle-stone' ? 'Stone supplies' : 'Supplies' };
    const value = solid(box(id, x, y, z, w, h, d, color, material)); coverIds.push(id);
    // The grouped stall paints its one sign; individual counter pieces do not
    // paint another overlapping copy on that same physical wall face.
    mark(id, kind, name || names[kind] || 'Supplies', [value], kind !== 'market-stall'); return value;
  };
  const prefix = royale ? 'boundary' : 'wall';
  for (const value of [
    box(`${prefix}-west`, -half - 1, 0, -half - 1, 1, 6.2, half * 2 + 2, '#69776a'),
    box(`${prefix}-east`, half, 0, -half - 1, 1, 6.2, half * 2 + 2, '#69776a'),
    box(`${prefix}-north`, -half, 0, -half - 1, half * 2, 6.2, 1, '#69776a'),
    box(`${prefix}-south`, -half, 0, half, half * 2, 6.2, 1, '#69776a'),
  ]) solid(value);

  // Four deliberate jumps, with a full standing/hound footprint at each landing.
  function climb(id, name, x, edge, direction, roofId, side) {
    const steps = [];
    for (let index = 0; index < 3; index++) {
      const z = edge - direction * (5.5 - index * 2.2), colliderId = `${id}-step-${index + 1}`;
      solid(box(colliderId, x - 1.1, 0, z - 1.1, 2.2, top / 4 * (index + 1), 2.2, '#a7a28b'));
      steps.push(freeze({ colliderId, x, z }));
    }
    steps.push(freeze({ colliderId: roofId, x, z: edge + direction * .7 }));
    const start = point(x, edge - direction * 7.2);
    const route = freeze({ id, name, side, role: id.startsWith('keep-gate') ? 'mid' : 'flank', start,
      approach: freeze([start]), steps: freeze(steps) });
    routes.push(route); return id;
  }

  function room(id, name, x, z, w, d, stairX, kind = 'keep-tower') {
    const t = .5, doorWidth = 2.8, side = (w - doorWidth) / 2, roofId = `${id}-roof`, walls = [];
    const wall = value => { solid(value); walls.push(value); };
    wall(box(`${id}-west`, x, 0, z, t, top - .32, d));
    wall(box(`${id}-east`, x + w - t, 0, z, t, top - .32, d));
    for (const [face, edge] of [['north', z], ['south', z + d - t]]) {
      wall(box(`${id}-${face}-left`, x + t, 0, edge, side - t, top - .32, t));
      wall(box(`${id}-${face}-right`, x + side + doorWidth, 0, edge, side - t, top - .32, t));
      wall(box(`${id}-${face}-lintel`, x + side, 2.32, edge, doorWidth, top - .32 - 2.32, t, '#b3a584'));
      decorations.push(freeze({ kind: 'castle-banner', buildingId: id, face, x: x + .95, y: 1.15,
        z: edge + (face === 'north' ? -.018 : t + .018), w: 1.15, h: 1.6, d: .02, color: '#8e343b', trimColor: '#d0af63' }));
    }
    const roof = solid(box(roofId, x, top - .32, z, w, .32, d, '#69747a', 'castle-slate'));
    mark(id, kind, name, [...walls, roof]);
    const routeIds = [];
    for (const [face, edge, direction] of [['north', z, 1], ['south', z + d, -1]]) {
      const routeX = typeof stairX === 'number' ? stairX : stairX[face];
      routeIds.push(climb(`${id}-${face}-rise`, `${name} / ${face} stone terraces`, routeX, edge, direction, roofId, face));
    }
    // Merlons stop shots and bodies. Open centre lanes connect the roof routes.
    const crenels = id === 'keep-gatehouse'
      ? [[x + w / 2 - .65, z + .12, 1.3, .42], [x + w / 2 - .65, z + d - .54, 1.3, .42]]
      : [[x + .12, z + .12, 1.15, 1.15], [x + w - 1.27, z + .12, 1.15, 1.15],
        [x + .12, z + d - 1.27, 1.15, 1.15], [x + w - 1.27, z + d - 1.27, 1.15, 1.15]];
    for (const [index, [cx, cz, cw, cd]] of crenels.entries())
      cover(`${id}-merlon-${index}`, cx, top, cz, cw, .9, cd, '#9c9a86', 'castle-stone', 'battlement');
    const doors = freeze(['north', 'south'].map(face => {
      const north = face === 'north', edge = north ? z : z + d;
      return freeze({ face, x: x + w / 2, z: edge + (north ? t / 2 : -t / 2), width: doorWidth, height: 2.32,
        outside: point(x + w / 2, edge + (north ? -1.2 : 1.2)), inside: point(x + w / 2, edge + (north ? 1.3 : -1.3)) });
    }));
    buildings.push(freeze({ id, name, roofId, wallIds: freeze(walls.map(value => value.id)),
      interior: freeze({ minX: x + t, maxX: x + w - t, minZ: z + t, maxZ: z + d - t }), doorways: doors }));
    decorations.push(paint('castle-room-paving', x + t, z + t, w - t * 2, d - t * 2, '#887f6b'));
    lootPoints.push(cache(`${id}-armoury`, x + 1.55, z + 1.8, 'weapon'),
      cache(`${id}-medicine`, x + w - 1.55, z + 1.8, 'heal'), cache(`${id}-ammunition`, x + w / 2, z + d - 1.7, 'ammo'),
      cache(`${id}-battlement-cache`, x + w / 2, z + d / 2, 'weapon', top));
    return { roofId, routeIds, centre: point(x + w / 2, z + d / 2), traverse: point(x + w / 2, z + d / 2, top) };
  }

  const west = room('keep-west-tower', 'West Watch', -21, -5, 9, 10, -19.1);
  const east = room('keep-east-tower', 'East Watch', 12, -5, 9, 10, 19.1);
  const gate = room('keep-gatehouse', 'Crown Gate', -4, -3, 8, 6, { north: 2.7, south: -2.7 }, 'gatehouse');
  const bridgeIds = [];
  for (const [name, x] of [['west', -12], ['east', 4]]) {
    const id = `keep-${name}-wallwalk`;
    const deck = solid(box(id, x, top - .32, -1.3, 8, .32, 2.6)); bridgeIds.push(id);
    mark(id, 'battlement', `${name} wall walk`, [deck]);
    cover(`${id}-north-parapet`, x + 2.8, top, -1.22, 2.4, .72, .28, '#929680', 'castle-stone', 'battlement');
    cover(`${id}-south-parapet`, x + 2.8, top, .94, 2.4, .72, .28, '#929680', 'castle-stone', 'battlement');
  }
  // Furniture is off the door-to-door axis; it creates real shotgun/sword cover.
  cover('keep-west-armoury-chest', -20.1, 0, -.8, 1.5, .84, 1.6, '#81613e', 'castle-timber', 'armoury-chest');
  cover('keep-east-forge-anvil', 18.6, 0, -.8, 1.5, .84, 1.6, '#5b6564', 'castle-iron', 'blacksmith');
  cover('keep-gate-chest', -3.1, 0, -.6, 1.2, .74, 1.2, '#866740', 'castle-timber', 'armoury-chest');
  for (const [index, [x, z, tint]] of [[-9.5, -13, '#8e343b'], [6.3, 10.8, '#b2995d']].entries()) {
    const stallName = index ? 'Goldsmith' : 'Market';
    const screen = cover(`keep-market-${index}-screen`, x, 0, z, 3.2, 2.4, .42, tint, 'castle-timber', 'market-stall', stallName);
    cover(`keep-market-${index}-counter`, x, 0, z + .5, 3.2, .9, 1.15, '#9d774c', 'castle-timber', 'market-stall', stallName);
    const canopy = solid(box(`keep-market-${index}-canopy`, x, 2.4, z, 3.2, .18, 1.7, tint, 'heraldic-red'));
    mark(`keep-market-${index}`, 'market-stall', stallName, [screen, canopy]);
  }

  // Paired low props offer short hop plays without blocking an entrance or stair.
  for (const [name, x, z, color, material] of (royale ? [['supplies', -9, 14, '#97754d', 'castle-timber'],
    ['masonry', 9, -14, '#aaa58f', 'castle-stone'], ['stables', -23, 13, '#8e714b', 'castle-timber']] : [])) {
    const supports = [];
    for (const [index, [offset, height]] of [[-.95, .48], [.95, .84]].entries()) {
      const centreX = x + offset, id = `medieval-hop-${name}-${index + 1}`;
      cover(id, centreX - .7, 0, z - .7, 1.4, height, 1.4, color, material);
      const landing = point(centreX, z, height), approaches = freeze([-1, 1].map(side => point(centreX, z + side * 1.4)));
      jumpCover.push(freeze({ colliderId: id, name: `${name} / ${index + 1}`, kind: 'castle-supplies', landing, approaches }));
      supports.push(freeze({ colliderId: id, ...landing }));
    }
    hopRoutes.push(freeze({ id: `medieval-hop-${name}`, name, start: point(x - 2.4, z), steps: freeze(supports), end: point(x + 2.4, z) }));
  }

  const castleSupports = [west.roofId, ...bridgeIds, gate.roofId, east.roofId];
  upperFloors.push(freeze({ id: 'keep-battlement-circuit', name: 'Crownfall battlement circuit', colliderIds: freeze(castleSupports),
    routeIds: freeze([...west.routeIds, ...east.routeIds, ...gate.routeIds]),
    underpasses: freeze([west.centre, point(-8, 0), gate.centre, point(8, 0), east.centre]),
    traverse: freeze([west.traverse, point(-8, 0, top), gate.traverse, point(8, 0, top), east.traverse]) }));
  decorations.push(paint('castle-processional-road', -2, -25, 4, 50, '#8f8d79'),
    paint('castle-inner-court', -11.7, -9, 23.4, 18, '#a2a087'));
  const addRegion = (id, name, x, z, extent = 8) => regions.push(freeze({ id, name, anchor: point(x, z),
    bounds: freeze({ minX: x - extent, maxX: x + extent, minZ: z - extent, maxZ: z + extent }) }));
  addRegion('castle-court', 'Crown Court', 0, 13, 12);

  if (royale) {
    const villageWest = room('village-blacksmith', 'Old Blacksmith', -40, -36, 8, 8, -38.2, 'blacksmith');
    const villageEast = room('village-inn', 'Kingsroad Inn', 32, 28, 8, 8, 38.2, 'village-house');
    for (const value of [villageWest, villageEast]) upperFloors.push(freeze({ id: `${value.roofId}-floor`, name: `${value.roofId} lookout`,
      colliderIds: freeze([value.roofId]), routeIds: freeze(value.routeIds), underpasses: freeze([value.centre]),
      traverse: freeze([point(value.centre.x, value.centre.z - 1, top), point(value.centre.x, value.centre.z + 1, top)]) }));
    addRegion('village-forge', 'Blacksmith Quarter', -36, -25);
    addRegion('village-orchard', 'Orchard Ruins', 34, -27);
    addRegion('village-stables', 'Southern Stables', -34, 27);
    addRegion('village-inn', 'Kingsroad Inn', 36, 24);
    for (const [index, [x, z, w, d]] of [[-38, -16, 4, 1.4], [-36, 3, 3.4, 1.8], [-38, 20, 4, 1.4],
      [33, -27, 4, 1.5], [35, -6, 3.2, 1.8], [34, 12, 4, 1.4], [-17, -36, 3.2, 1.8], [14, -35, 4, 1.5],
      [-19, 34, 4, 1.4], [12, 35, 3.2, 1.8]].entries())
      cover(`village-delivery-${index}`, x, 0, z, w, index % 2 ? .84 : .68, d,
        index % 2 ? '#9c967e' : '#93754d', index % 2 ? 'castle-stone' : 'castle-timber', index % 2 ? 'ruined-masonry' : 'supply-cart');
    for (const [index, [x, z]] of [[-30, -22], [28, -30], [-32, 29], [28, 13]].entries()) {
      const pieces = [solid(box(`village-ruin-${index}-wall`, x, 0, z, 4.6, 2.45, .65, '#8d9582')),
        solid(box(`village-ruin-${index}-return`, x, 0, z + .65, .65, 2.45, 3, '#8d9582'))];
      mark(`village-ruin-${index}`, 'ruined-masonry', 'Village ruins', pieces);
    }
    for (const x of [-29, 27]) decorations.push(paint('village-cobbled-lane', x, -43, 2, 86, '#94927b'));
    for (const z of [-25, 23]) decorations.push(paint('village-cobbled-lane', -43, z, 86, 2, '#94927b'));
    const caches = [[-35, -22], [-34, -11], [-39, 10], [-37, 28], [38, -36], [34, -18], [39, 5], [42, 19],
      [-23, -38], [-9, -35], [8, -38], [23, -35], [-23, 38], [-8, 36], [9, 39], [23, 35],
      [-26, -8], [25, -8], [-26, 8], [25, 8], [-12, -23], [12, -23], [-12, 23], [12, 23],
      [-8, -17], [8, -17], [-8, 18], [8, 18], [-16, -17], [16, -17], [-16, 17], [16, 17],
      [-36, 39], [39, -29], [-31, -40], [29, 39]];
    const kinds = ['weapon', 'heal', 'ammo', 'weapon', 'grenade', 'weapon'];
    for (const [index, [x, z]] of caches.entries()) lootPoints.push(cache(`medieval-cache-${index}`, x, z, kinds[index % kinds.length]));
  }

  // Dense, bounded approach anchors keep narrow roof seams reachable for every
  // body profile without changing the navigation or movement rules.
  const anchors = [];
  for (const floor of upperFloors) for (const id of floor.colliderIds) {
    const support = colliders.find(value => value.id === id);
    for (let x = support.x + .56; x <= support.x + support.w - .55; x += .8)
      for (let z = support.z + .56; z <= support.z + support.d - .55; z += .8) anchors.push(point(x, z, top));
  }
  const authoredRoutes = routes.map(route => freeze({ ...route, approach: freeze([route.start, ...anchors]) }));
  const common = { id: 'medieval', name: 'Crownfall Keep', theme: 'medieval', mode, combatStyle: 'close',
    description: royale
      ? 'A 96-metre castle and village. Loot two-door towers, the blacksmith and inn; cross connected battlements, cobbled tracks and broken outer courtyards. Short stone corners favour swords and shotguns.'
      : 'A 56-metre castle court. Two-door watchtowers flank an open gatehouse; six stone climbs reach connected battlements. Market stalls, armoury chests and walk-under routes reward swords, shotguns and quick escapes.',
    bounds: freeze({ minX: -half, maxX: half, minZ: -half, maxZ: half }), colliders: freeze(colliders),
    landmarks: freeze(landmarks), decorations: freeze(decorations), routes: freeze(authoredRoutes), buildings: freeze(buildings),
    upperFloors: freeze(upperFloors), coverIds: freeze(coverIds), ...(royale ? { jumpCover: freeze(jumpCover), hopRoutes: freeze(hopRoutes) } : {}), regions: freeze(regions),
    ceilings: freeze(buildings.map(building => building.roofId)), tunnels: freeze([]), floorColor: '#858d70', skyColor: '#b8c4d3' };
  if (!royale) return freeze({ ...common, sites: freeze([freeze({ id: 'A', x: -16.5, z: -18.5, radius: 2.2 }), freeze({ id: 'B', x: 16.5, z: -18.5, radius: 2.2 })]),
    spawns: freeze([freeze([-3, 0, 3].map(x => freeze({ x, z: 23.5, yaw: 0 }))), freeze([3, 0, -3].map(x => freeze({ x, z: -23.5, yaw: Math.PI })))]) });
  const ring = [[-44, -44], [-20, -44], [0, -44], [20, -44], [44, -44], [44, -20], [44, 0], [44, 20],
    [44, 44], [20, 44], [0, 44], [-20, 44], [-44, 44], [-44, 20], [-44, 0], [-44, -20]];
  return freeze({ ...common, sites: freeze([]), lootPoints: freeze(lootPoints), stormCenter: point(0, 14),
    spawnPoints: freeze(ring.map(([x, z]) => freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))) });
}
