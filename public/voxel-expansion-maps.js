/** Shared authored snow, drainage and trading-office arenas. Every solid is real collision geometry. */
const box = (id, x, y, z, w, h, d, color, material) => Object.freeze({ id, x, y, z, w, h, d, color, material });
const point = (x, z, y = 0) => Object.freeze({ x, y, z });
const step = (colliderId, x, z) => Object.freeze({ colliderId, x, z });
const loot = (id, x, z, kind, y = 0) => Object.freeze({ id, x, y, z, kind });
const paint = (kind, x, z, w, d, color) => Object.freeze({ kind, x, z, w, d, color });
const THEMES = Object.freeze({
  snow: Object.freeze({ name: 'Frostline Research', description: 'Snow-covered research lodges surround a supply yard. Two doors and two crate climbs per lodge create quick indoor flanks and exposed rooftop angles.', wall: '#8dabae', roof: '#e7eff0', floor: '#dde7e9', sky: '#afc7d7', accent: '#417f99', material: 'snow-wall', roofMaterial: 'snow-roof', stairMaterial: 'snow-crate', stair: '#a5b5ad', rooms: ['Weather Lab', 'Radio Lodge', 'Survey Station', 'Supply Shelter'] }),
  sewers: Object.freeze({ name: 'Undercity Sewers', description: 'Walkable three-metre drainage tunnels connect open pumping chambers. Service-room catwalks overlook the crossings; multiple maintenance passages bypass the central pump.', wall: '#637f78', roof: '#647979', floor: '#64706c', sky: '#718b89', accent: '#a1aa63', material: 'sewer-brick', roofMaterial: 'sewer-roof', stairMaterial: 'metal', stair: '#82928a', rooms: ['West Pump Control', 'East Valve Chamber', 'Filter Workshop', 'Maintenance Depot'] }),
  trading: Object.freeze({ name: 'Barclays Trading Floor', description: 'A fictional corporate trading office with blue glass meeting rooms, server cabinets, monitor-lined desk pods and accessible mezzanines. Open central aisles and two-door offices provide alternate rotations.', wall: '#86b5c9', roof: '#8ca6b4', floor: '#a7b7c0', sky: '#c1d9e7', accent: '#18a0cf', material: 'glass', roofMaterial: 'office-roof', stairMaterial: 'metal', stair: '#889fac', rooms: ['Risk Meeting Room', 'Research Suite', 'Network Operations', 'Execution Office'] }),
});

function stairs(id, name, axis, offset, edge, direction, roofId, landing, side, rise, theme) {
  const colliders = [], steps = [];
  for (let i = 0; i < 3; i++) {
    const distance = edge - direction * (5.5 - i * 2.2), x = axis === 'x' ? distance : offset, z = axis === 'z' ? distance : offset;
    const colliderId = `${id}-step-${i + 1}`;
    colliders.push(box(colliderId, x - 1.1, 0, z - 1.1, 2.2, rise * (i + 1), 2.2, theme.stair, theme.stairMaterial));
    steps.push(step(colliderId, x, z));
  }
  steps.push(step(roofId, landing.x, landing.z));
  const distance = edge - direction * 7.2, start = point(axis === 'x' ? distance : offset, axis === 'z' ? distance : offset);
  return { colliders, route: Object.freeze({ id, name, side, role: axis === 'x' ? 'mid' : 'flank', start, steps: Object.freeze(steps), approach: Object.freeze([start]) }) };
}

function room(id, name, x, z, w, d, side, left, rise, theme) {
  const t = .4, doorWidth = 2.4, wallHeight = rise * 4 - .36, doorHeight = 2.4, wing = (w - doorWidth) / 2, roofId = `${id}-roof`;
  const colliders = [
    box(`${id}-west`, x, 0, z, t, wallHeight, d, theme.wall, theme.material),
    box(`${id}-east`, x + w - t, 0, z, t, wallHeight, d, theme.wall, theme.material),
    ...['north', 'south'].flatMap((face, index) => {
      const edge = z + (index ? d - t : 0);
      return [
        box(`${id}-${face}-left`, x + t, 0, edge, wing - t, wallHeight, t, theme.wall, theme.material),
        box(`${id}-${face}-right`, x + wing + doorWidth, 0, edge, wing - t, wallHeight, t, theme.wall, theme.material),
        box(`${id}-${face}-lintel`, x + wing, doorHeight, edge, doorWidth, wallHeight - doorHeight, t, theme.wall, theme.material),
      ];
    }),
    box(roofId, x, wallHeight, z, w, .36, d, theme.roof, theme.roofMaterial),
    // Low roof cover sits away from the landings and both supported caches.
    box(`${id}-roof-cover`, x + w / 2 - .5, rise * 4, z + d / 2 - .6, 1, .8, 1.2, theme.accent, 'metal'),
  ];
  const northern = side === 'north', outerEdge = northern ? z : z + d;
  const outerX = left ? x + 1.5 : x + w - 1.5;
  const outer = stairs(`${id}-outer`, `${name} / ${northern ? 'north' : 'south'} supply steps`, 'z', outerX, outerEdge, northern ? 1 : -1,
    roofId, point(outerX, northern ? z + .7 : z + d - .7), side, rise, theme);
  const innerEdge = left ? x + w : x;
  const inner = stairs(`${id}-inner`, `${name} / inner maintenance steps`, 'x', z + d / 2, innerEdge, left ? -1 : 1,
    roofId, point(left ? x + w - .7 : x + .7, z + d / 2), side, rise, theme);
  const metadata = Object.freeze({ id, name, roofId, wallIds: Object.freeze(colliders.slice(0, 8).map(value => value.id)),
    interior: Object.freeze({ minX: x + t, maxX: x + w - t, minZ: z + t, maxZ: z + d - t }),
    facade: Object.freeze({ x, z, w, d, wallHeight, doorWidth, doorCenterX: x + w / 2, roofY: rise * 4, accent: theme.accent }),
    doorways: Object.freeze([0, 1].map(index => Object.freeze({ x: x + w / 2, z: z + (index ? d - t / 2 : t / 2), width: doorWidth, height: doorHeight,
      outside: point(x + w / 2, index ? z + d + 1 : z - 1), inside: point(x + w / 2, index ? z + d - 1.2 : z + 1.2) }))),
  });
  return { colliders: [...colliders, ...outer.colliders, ...inner.colliders], routes: [outer.route, inner.route], metadata,
    lootPoints: [loot(`${id}-weapon`, x + 2.1, z + 2, 'weapon'), loot(`${id}-heal`, x + w - 2.1, z + 2, 'heal'),
      loot(`${id}-ammo`, x + 2.1, z + d - 2, 'ammo'), loot(`${id}-grenade`, x + w - 2.1, z + d - 2, 'grenade'),
      loot(`${id}-roof-weapon`, x + 2.2, z + d - 1.3, 'weapon', rise * 4), loot(`${id}-roof-heal`, x + w - 2.2, z + 1.3, 'heal', rise * 4)] };
}

function structures(id, royale) {
  const colliders = [], landmarks = [], decorations = [], tunnels = [];
  const add = (kind, collider) => { colliders.push(collider); landmarks.push(Object.freeze({ kind, ...collider, collisionIds: Object.freeze([collider.id]) })); };
  if (id === 'snow') {
    add('snow-supply', box('snow-central-supply', -4, 0, -2, 8, 2.4, 4, '#527f8b', 'metal'));
    for (const [index, x] of [-7, 5].entries()) {
      add('snow-generator', box(`snow-generator-${index}`, x, 0, -.9, 2, 1.05, 1.8, '#79999e', 'metal'));
    }
    for (const [index, x] of [-21.5, 19.5].entries()) add('snow-supply', box(`snow-outer-supply-${index}`, x, 0, -1.1, 2, .8, 2.2, '#a5b2a6', 'snow-crate'));
    decorations.push(paint('snow-yard', -8, -3, 16, 6, '#c5d4d8'), paint('snow-path', -2.2, royale ? -32 : -22, 4.4, royale ? 64 : 44, '#b7cbd1'));
  } else if (id === 'trading') {
    add('brand-sign', box('trading-brand-wall', -5, 2.8, royale ? -31.9 : -21.9, 10, 1.3, .35, '#246d8e', 'metal'));
    add('market-display', box('trading-market-column', -3.5, 0, -1, 7, 2.8, 2, '#247b9f', 'screen'));
    const outerNorth = royale ? -23 : -14, outerSouth = royale ? 22 : 13;
    for (const [index, [x, z]] of [[-8, -2], [5, -2], [-8, 1], [5, 1], [-8, outerNorth], [5, outerNorth], [-8, outerSouth], [5, outerSouth]].entries()) {
      add('desk-pod', box(`trading-desk-${index}`, x, 0, z, 3, .78, 1.3, '#82939f', 'desk'));
      add('monitor', box(`trading-monitor-${index}`, x + .22, .78, z + .56, 2.56, .66, .16, '#1e607e', 'screen'));
    }
    for (const [index, x] of [-21.5, 20].entries()) add('server-rack', box(`trading-server-rack-${index}`, x, 0, -.75, 1.5, 2.5, 1.5, '#344d5a', 'metal'));
    const operationsX = royale ? -24 : -18, operationsZ = royale ? 11 : 4, operationsDepth = royale ? 8 : 7;
    for (const [index, z] of [operationsZ + 1.2, operationsZ + operationsDepth - 2.6].entries()) {
      add('server-rack', box(`trading-operations-rack-${index}`, operationsX + .75, 0, z, .65, 2.45, 1.4, '#344d5a', 'metal'));
    }
    decorations.push(paint('office-aisle', -2.6, royale ? -32 : -22, 5.2, royale ? 64 : 44, '#c5d2d7'), paint('office-cross-aisle', -24, -.35, 48, .7, '#19a0c8'));
  } else {
    add('pump', box('sewers-central-pump', -3.4, 0, -1.2, 6.8, 2.6, 2.4, '#72887c', 'metal'));
    // Segmented, genuinely walkable tunnels: 3m ceilings and wide gaps into
    // the open chambers. They never cover the climbing chains or the whole map.
    for (const [index, x] of [-21, -10, 5, 15].entries()) {
      const w = index === 0 || index === 3 ? 6 : 5;
      const northId = `sewers-tunnel-${index}-north`, southId = `sewers-tunnel-${index}-south`, roofId = `sewers-tunnel-${index}-roof`;
      colliders.push(box(northId, x, 0, -2.8, w, 3, .35, '#617a72', 'sewer-brick'), box(southId, x, 0, 2.45, w, 3, .35, '#617a72', 'sewer-brick'),
        box(roofId, x, 3, -2.8, w, .32, 5.6, '#657c77', 'sewer-roof'));
      tunnels.push(Object.freeze({ id: `sewers-tunnel-${index}`, roofId, height: 3, width: 4.9, entry: point(x - .7, 0), exit: point(x + w + .7, 0), midpoint: point(x + w / 2, 0) }));
    }
    for (const [index, x] of [-23.5, 22.5].entries()) add('pipe', box(`sewers-valve-pipe-${index}`, x, 0, -1, 1, 1.25, 2, '#8b9571', 'pipe'));
    // The channel is shallow below the floor: its visible surface introduces
    // no invisible wall or physics step in the maintenance walkway.
    colliders.push(box('sewers-water-channel', -22, -.16, -.65, 44, .12, 1.3, '#467f7b', 'water'));
    decorations.push(paint('maintenance-path', -23, -1.8, 46, 3.6, '#89978a'));
  }
  return { colliders, landmarks: Object.freeze(landmarks), decorations: Object.freeze(decorations), tunnels: Object.freeze(tunnels) };
}

export function createExpansionMap(id, mode = 'breach') {
  if (!Object.hasOwn(THEMES, id)) throw new TypeError('Unknown expansion map');
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Expansion mode must be breach or royale');
  const theme = THEMES[id], royale = mode === 'royale', halfW = royale ? 32 : 25, halfD = royale ? 32 : 22, rise = royale ? .84 : .8;
  const w = royale ? 9 : 8, d = royale ? 8 : 7, left = royale ? -24 : -18, right = royale ? 15 : 10, north = royale ? -19 : -11, south = royale ? 11 : 4;
  const rooms = [[left, north, 'north', true], [right, north, 'north', false], [left, south, 'south', true], [right, south, 'south', false]]
    .map(([x, z, side, isLeft], index) => room(`${id}-room-${index}`, theme.rooms[index], x, z, w, d, side, isLeft, rise, theme));
  const prefix = royale ? 'boundary' : 'wall', extra = structures(id, royale);
  const ceilingHeight = id === 'trading' ? 8 : id === 'sewers' ? 7 : null, boundaryHeight = ceilingHeight ? ceilingHeight + .3 : 5.6;
  const perimeter = [box(`${prefix}-west`, -halfW - 1, 0, -halfD - 1, 1, boundaryHeight, halfD * 2 + 2, theme.wall, theme.material),
    box(`${prefix}-east`, halfW, 0, -halfD - 1, 1, boundaryHeight, halfD * 2 + 2, theme.wall, theme.material),
    box(`${prefix}-north`, -halfW, 0, -halfD - 1, halfW * 2, boundaryHeight, 1, theme.wall, theme.material),
    box(`${prefix}-south`, -halfW, 0, halfD, halfW * 2, boundaryHeight, 1, theme.wall, theme.material)];
  const ceilings = ceilingHeight ? [Object.freeze({ ...box(`${id}-interior-ceiling`, -halfW, ceilingHeight, -halfD, halfW * 2, .3, halfD * 2,
    id === 'trading' ? '#d0dce0' : '#556c64', id === 'trading' ? 'office-ceiling' : 'sewer-ceiling'), overhead: true })] : [];
  const common = { id, name: theme.name, description: theme.description, theme: id, mode,
    bounds: Object.freeze({ minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD }), colliders: Object.freeze([...perimeter, ...rooms.flatMap(value => value.colliders), ...extra.colliders, ...ceilings]),
    routes: Object.freeze(rooms.flatMap(value => value.routes)), buildings: Object.freeze(rooms.map(value => value.metadata)),
    landmarks: extra.landmarks, decorations: extra.decorations, tunnels: extra.tunnels, ceilings: Object.freeze(ceilings.map(value => value.id)), floorColor: theme.floor, skyColor: theme.sky,
  };
  if (!royale) return Object.freeze({ ...common,
    sites: Object.freeze([Object.freeze({ id: 'A', x: -13, z: -15, radius: 2.2 }), Object.freeze({ id: 'B', x: 13, z: -15, radius: 2.2 })]),
    spawns: Object.freeze([Object.freeze([-3, 0, 3].map(x => Object.freeze({ x, z: 18, yaw: 0 }))), Object.freeze([3, 0, -3].map(x => Object.freeze({ x, z: -18, yaw: Math.PI })))]),
    groundRoutes: Object.freeze([-1, 1].map(sign => Object.freeze({ id: `${id}-site-${sign < 0 ? 'a' : 'b'}-outer`, siteId: sign < 0 ? 'A' : 'B',
      name: `${sign < 0 ? 'A / west' : 'B / east'} maintenance flank`, start: point(-3, 18),
      waypoints: Object.freeze([point(sign * 24, 18), point(sign * 24, -20), point(sign * 13, -20), point(sign * 13, -15)]) }))),
  });
  const ring = [[-28, -28], [-12, -28], [0, -28], [12, -28], [28, -28], [28, -12], [28, 0], [28, 12], [28, 28], [12, 28], [0, 28], [-12, 28], [-28, 28], [-28, 12], [-28, 0], [-28, -12]];
  const outsideLoot = [loot(`${id}-northwest`, -20, -25, 'weapon'), loot(`${id}-northeast`, 20, -25, 'heal'),
    loot(`${id}-southwest`, -20, 25, 'ammo'), loot(`${id}-southeast`, 20, 25, 'weapon'),
    loot(`${id}-west-cache`, -28, 5, 'weapon'), loot(`${id}-east-cache`, 28, 5, 'heal'),
    loot(`${id}-north-court`, 2.5, -23, 'grenade'), loot(`${id}-south-court`, -2.5, 23, 'ammo'),
    loot(`${id}-west-crossing`, -12, 0, 'ammo'), loot(`${id}-east-crossing`, 12, 0, 'grenade'),
    loot(`${id}-mid-north`, 0, -4, 'weapon'), loot(`${id}-mid-south`, 0, 4, 'heal')];
  return Object.freeze({ ...common, sites: Object.freeze([]), spawnPoints: Object.freeze(ring.map(([x, z]) => Object.freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))),
    lootPoints: Object.freeze([...rooms.flatMap(value => value.lootPoints), ...outsideLoot]), stormCenter: point(0, 9) });
}
