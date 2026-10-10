/** A fictional trading office: workstation islands, market walls and two distinct upper flanks. */
const box = (id, x, y, z, w, h, d, color, material) => Object.freeze({ id, x, y, z, w, h, d, color, material });
const point = (x, z, y = 0) => Object.freeze({ x, y, z });
const loot = (id, x, z, kind, y = 0) => Object.freeze({ id, x, y, z, kind });
const paint = (kind, x, z, w, d, color) => Object.freeze({ kind, x, z, w, d, color });

export function createTradingMap(mode = 'breach') {
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Trading mode must be breach or royale');
  const royale = mode === 'royale', halfW = royale ? 32 : 25, halfD = royale ? 32 : 22;
  const prefix = royale ? 'boundary' : 'wall', colliders = [], landmarks = [], routes = [], buildings = [];
  const solid = (kind, collider) => {
    colliders.push(collider);
    if (kind) landmarks.push(Object.freeze({ kind, ...collider, collisionIds: Object.freeze([collider.id]) }));
    return collider;
  };
  for (const value of [
    box(`${prefix}-west`, -halfW - 1, 0, -halfD - 1, 1, 8.3, halfD * 2 + 2, '#9bb8c7', 'glass'),
    box(`${prefix}-east`, halfW, 0, -halfD - 1, 1, 8.3, halfD * 2 + 2, '#9bb8c7', 'glass'),
    box(`${prefix}-north`, -halfW, 0, -halfD - 1, halfW * 2, 8.3, 1, '#718994', 'office-panel'),
    box(`${prefix}-south`, -halfW, 0, halfD, halfW * 2, 8.3, 1, '#718994', 'office-panel'),
  ]) solid(null, value);
  const ceiling = Object.freeze({ ...box('trading-interior-ceiling', -halfW, 8, -halfD, halfW * 2, .3, halfD * 2, '#dce5e8', 'office-ceiling'), overhead: true });
  solid(null, ceiling);
  solid('brand-sign', box('trading-brand-wall', -5, 2.9, -halfD + .05, 10, 1.35, .28, '#126b97', 'metal'));

  // These oversized displays have floor-standing housings. Their entire visible
  // silhouette stops bullets, rather than merely decorating a low crate.
  solid('market-display', box('trading-market-north', -5.2, 0, -13.4, 10.4, 2.65, .7, '#11394e', 'screen'));
  solid('market-display', box('trading-market-south', -5.2, 0, 12.7, 10.4, 2.65, .7, '#11394e', 'screen'));

  // Staggered desk islands break long diagonals while leaving a broad central
  // aisle and several cross aisles. The double-sided monitor banks provide
  // standing and crouching head protection. Open undersides remain honest
  // shot lanes; only the drawer pedestals and tabletop are actual solids.
  function desk(id, x, z, width = 4.8, depth = 2.2) {
    const top = box(id, x, .68, z, width, .12, depth, '#a5a5a0', 'desk');
    const supports = [box(`${id}-drawer-west`, x + .14, 0, z + .12, .72, .68, depth - .24, '#a4a19a', 'desk-cabinet'),
      box(`${id}-drawer-east`, x + width - .86, 0, z + .12, .72, .68, depth - .24, '#a4a19a', 'desk-cabinet')];
    colliders.push(top, ...supports);
    landmarks.push(Object.freeze({ kind: 'desk-pod', ...top, tabletopId: top.id, supportIds: Object.freeze(supports.map(value => value.id)),
      collisionIds: Object.freeze([top.id, ...supports.map(value => value.id)]) }));
    // A chair is three real pieces, not an invisible full-height crate. Narrow
    // pedestals leave the underside open; seats/backs have their shown outline.
    const chairX = x + width / 2 - .33, chairZ = z - .82, chairId = `${id}-chair`;
    const chairParts = [box(`${chairId}-seat`, chairX, .43, chairZ, .66, .14, .64, '#2f434f', 'office-chair'),
      box(`${chairId}-back`, chairX, .57, chairZ, .66, .63, .12, '#2f434f', 'office-chair'),
      box(`${chairId}-pedestal`, chairX + .21, 0, chairZ + .20, .24, .43, .24, '#738590', 'metal')];
    colliders.push(...chairParts);
    landmarks.push(Object.freeze({ kind: 'office-chair', id: chairId, x: chairX, y: 0, z: chairZ, w: .66, h: 1.2, d: .64,
      color: '#2f434f', material: 'office-chair', seatId: chairParts[0].id, backId: chairParts[1].id,
      collisionIds: Object.freeze(chairParts.map(value => value.id)) }));
  }
  const podPositions = [[-10.4, -10.3], [4.2, -8.7], [-9.2, -4.4], [5.4, -2.8],
    [-10.4, 1.5], [4.2, 3.1], [-9.2, 7.4], [5.4, 9.0]];
  for (const [index, [x, z]] of podPositions.entries()) {
    desk(`trading-desk-${index}`, x, z);
    solid('monitor', box(`trading-monitor-${index}`, x + .3, .8, z + .92, 4.2, 1.2, .36, '#16394b', 'screen'));
  }

  // One glass meeting suite, with two doors opening onto the west circulation
  // lane. Its roof is a narrow observation mezzanine, not another house.
  const meetingX = -23, meetingZ = -6.6, meetingW = 8, meetingD = 11.2, wallH = 2.9;
  const meetingWalls = [
    box('trading-meeting-west', meetingX, 0, meetingZ, .3, wallH, meetingD, '#80acbc', 'glass'),
    box('trading-meeting-north', meetingX, 0, meetingZ, meetingW, wallH, .3, '#80acbc', 'glass'),
    box('trading-meeting-south', meetingX, 0, meetingZ + meetingD - .3, meetingW, wallH, .3, '#80acbc', 'glass'),
    box('trading-meeting-east-north', -15.3, 0, -6.6, .3, wallH, 1.6, '#80acbc', 'glass'),
    box('trading-meeting-east-mid', -15.3, 0, -2.4, .3, wallH, 2.6, '#80acbc', 'glass'),
    box('trading-meeting-east-south', -15.3, 0, 2.8, .3, wallH, 1.8, '#80acbc', 'glass'),
  ];
  meetingWalls.forEach(value => solid(null, value));
  solid(null, box('trading-meeting-mezzanine', meetingX, 2.9, meetingZ, meetingW, .3, meetingD, '#718c9b', 'office-roof'));
  solid('conference-table', box('trading-meeting-table', -21.3, .66, -3.6, 3.8, .12, 4.3, '#b7b2a5', 'desk'));
  solid(null, box('trading-meeting-table-leg-north', -19.7, 0, -3.0, .6, .66, .6, '#8b9193', 'metal'));
  solid(null, box('trading-meeting-table-leg-south', -19.7, 0, -.5, .6, .66, .6, '#8b9193', 'metal'));
  solid('market-display', box('trading-meeting-screen', -22.65, 1.15, -4, .22, 1.35, 5.0, '#173e55', 'screen'));
  solid('balcony-screen', box('trading-meeting-cover', -22.5, 3.2, -1.8, 1, 1.05, 3.6, '#1478a0', 'metal'));
  buildings.push(Object.freeze({ id: 'trading-meeting', name: 'Risk and Research Suite', roofId: 'trading-meeting-mezzanine',
    wallIds: Object.freeze(meetingWalls.map(value => value.id)),
    interior: Object.freeze({ minX: -22.7, maxX: -15.3, minZ: -6.3, maxZ: 4.3 }),
    facade: Object.freeze({ x: meetingX, z: meetingZ, w: meetingW, d: meetingD, wallHeight: wallH, doorWidth: 2.6, doorCenterX: -19, roofY: 3.2, accent: '#149bd0' }),
    doorways: Object.freeze([-3.7, 1.5].map(z => Object.freeze({ x: -15.15, z, width: 2.6, height: 2.9,
      outside: point(-14, z), inside: point(-16.5, z) }))),
  }));

  // The other flank is an open server gallery. You can rotate underneath the
  // suspended deck, play among actual racks, or climb to its exposed rail.
  solid('server-gallery', box('trading-server-gallery', 15, 2.9, -2.4, 8, .3, 11.2, '#6e8997', 'office-roof'));
  for (const [index, [x, z]] of [[15.4, -2], [21.6, -2], [15.4, 7.4], [21.6, 7.4]].entries()) {
    solid(null, box(`trading-server-post-${index}`, x, 0, z, .65, 2.9, .65, '#748b97', 'metal'));
  }
  for (const [index, [x, z]] of [[16.7, .3], [20.3, .3], [16.7, 4.7], [20.3, 4.7]].entries()) {
    solid('server-rack', box(`trading-server-rack-${index}`, x, 0, z, 1.3, 2.45, 1.75, '#243b48', 'metal'));
  }
  solid('balcony-screen', box('trading-server-cover', 21.6, 3.2, 2.1, 1, 1.05, 3.6, '#1478a0', 'metal'));

  // The research and operations decks meet across an actual suspended floor.
  // Drawer cabinets, a tabletop and a monitor bank provide their shown cover,
  // while the south side remains a clear route and the ground aisles pass below.
  solid('office-mezzanine', box('trading-cross-floor-mezzanine', -15.4, 2.9, -.7, 30.8, .3, 2.2, '#6e8997', 'office-roof'));
  solid('mezzanine-desk', box('trading-upper-desk', -1.2, 3.88, -.6, 2.4, .12, .8, '#a5a5a0', 'desk'));
  for (const [index, x] of [-1.1, .7].entries())
    solid('mezzanine-cabinet', box(`trading-upper-drawer-${index}`, x, 3.2, -.5, .4, .68, .56, '#a4a19a', 'desk-cabinet'));
  solid('mezzanine-screen', box('trading-upper-monitor', -.95, 4, -.4, 1.9, 1.2, .3, '#16394b', 'screen'));
  for (const [index, [x, z]] of [[-5.2, -5.6], [3.8, 5.4]].entries())
    solid('archive-cabinet', box(`trading-archive-cabinet-${index}`, x, 0, z, 1.4, 1.35, 1.2, '#748b97', 'desk-cabinet'));

  function climb(id, name, x, edge, direction, deckId, landing, side, role) {
    const steps = [];
    for (let index = 0; index < 3; index++) {
      const z = edge - direction * (5.5 - index * 2.2), colliderId = `${id}-step-${index + 1}`;
      // Only the entry tread has a wider landing apron. Lateral hound jumps
      // clear the next riser's corner while the upper staircase stays narrow.
      const width = index === 0 ? 3.4 : 2.2;
      solid('office-step', box(colliderId, x - width / 2, 0, z - 1.1, width, .8 * (index + 1), 2.2, '#8c9da7', 'metal'));
      steps.push(Object.freeze({ colliderId, x, z }));
    }
    steps.push(Object.freeze({ colliderId: deckId, x: landing.x, z: landing.z }));
    const start = point(x, edge - direction * 7.2);
    routes.push(Object.freeze({ id, name, side, role, start, steps: Object.freeze(steps), approach: Object.freeze([start]) }));
  }
  climb('trading-meeting-north-climb', 'Research / archive cabinets', -19, -6.6, 1, 'trading-meeting-mezzanine', point(-19, -5.9), 'north', 'flank');
  climb('trading-meeting-south-climb', 'Research / workstation risers', -19, 4.6, -1, 'trading-meeting-mezzanine', point(-19, 3.9), 'south', 'flank');
  climb('trading-server-north-climb', 'Operations / backup racks', 19, -2.4, 1, 'trading-server-gallery', point(19, -1.7), 'north', 'mid');
  climb('trading-server-south-climb', 'Operations / equipment risers', 19, 8.8, -1, 'trading-server-gallery', point(19, 8.1), 'south', 'mid');
  const upperFloors = Object.freeze([Object.freeze({ id: 'trading-mezzanine-level', name: 'Research and operations mezzanine',
    colliderIds: Object.freeze(['trading-meeting-mezzanine', 'trading-cross-floor-mezzanine', 'trading-server-gallery']),
    routeIds: Object.freeze(routes.map(route => route.id)), underpasses: Object.freeze([point(0, .95), point(-12, .8)]),
    traverse: Object.freeze([point(-19, -.3, 3.2), point(-13, .95, 3.2), point(0, .95, 3.2), point(13, .95, 3.2), point(19, .95, 3.2)]) })]);

  const decorations = [paint('office-aisle', -2.6, -halfD, 5.2, halfD * 2, '#969e92'),
    paint('office-cross-aisle', -15, -1.1, 12.4, 1.2, '#4897b3'),
    paint('office-cross-aisle', 2.6, -1.1, 12.4, 1.2, '#4897b3'),
    paint('office-workstations', -11.2, -11.2, 8, 10.1, '#727d75'),
    paint('office-workstations', 3.2, -11.2, 8.6, 10.1, '#727d75'),
    paint('office-workstations', -11.2, .1, 8, 12.3, '#727d75'),
    paint('office-workstations', 3.2, .1, 8.6, 12.3, '#727d75'),
    paint('office-meeting-carpet', -22.7, -6.3, 7.4, 10.6, '#8d9080'),
    paint('office-operations-carpet', 15, -2.4, 8, 11.2, '#6f7874')];

  // The larger Royale floor adds reception and break-room workstation islands,
  // rather than stretching every desk and doorway to an implausible scale.
  if (royale) {
    for (const [index, [x, z]] of [[-23.5, -23], [17.5, -23], [-23.5, 21], [17.5, 21]].entries()) {
      desk(`trading-annex-desk-${index}`, x, z, 6, 2.4);
      solid('monitor', box(`trading-annex-monitor-${index}`, x + .4, .8, z + 1.0, 5.2, 1.2, .4, '#16394b', 'screen'));
    }
    solid('market-display', box('trading-reception-west', -11, 0, 23.8, 5.6, 2.45, .7, '#153e54', 'screen'));
    solid('market-display', box('trading-reception-east', 5.4, 0, -24.5, 5.6, 2.45, .7, '#153e54', 'screen'));
    for (const x of [-26, 2.6]) decorations.push(paint('office-annex', x, -26, 23.4, 4.6, '#69766f'), paint('office-annex', x, 20, 23.4, 5.6, '#69766f'));
  }

  const common = { id: 'trading', name: 'Barclays Trading Floor',
    description: 'A fictional corporate trading floor: staggered workstation islands, archive cabinets and head-height monitor banks divide broad cross aisles. A real suspended mezzanine connects the glass research suite and open server gallery, with desk and screen protection above open ground aisles. Four separate climbs keep both levels contested.',
    theme: 'trading', mode, bounds: Object.freeze({ minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD }),
    colliders: Object.freeze(colliders), routes: Object.freeze(routes), buildings: Object.freeze(buildings), landmarks: Object.freeze(landmarks),
    upperFloors,
    decorations: Object.freeze(decorations), tunnels: Object.freeze([]), ceilings: Object.freeze([ceiling.id]), floorColor: '#777c77', skyColor: '#d4d4c4' };
  if (!royale) return Object.freeze({ ...common,
    sites: Object.freeze([Object.freeze({ id: 'A', x: -13, z: -15, radius: 2.2 }), Object.freeze({ id: 'B', x: 13, z: -15, radius: 2.2 })]),
    spawns: Object.freeze([Object.freeze([-3, 0, 3].map(x => Object.freeze({ x, z: 18, yaw: 0 }))),
      Object.freeze([3, 0, -3].map(x => Object.freeze({ x, z: -18, yaw: Math.PI })))]),
    groundRoutes: Object.freeze([-1, 1].map(sign => Object.freeze({ id: `trading-site-${sign < 0 ? 'a' : 'b'}-flank`, siteId: sign < 0 ? 'A' : 'B',
      name: sign < 0 ? 'A / research corridor' : 'B / operations corridor', start: point(-3, 18),
      waypoints: Object.freeze([point(sign * 12.5, 18), point(sign * 12.5, -12), point(sign * 13, -15)]) }))),
  });

  const ring = [[-28, -28], [-12, -28], [0, -28], [12, -28], [28, -28], [28, -12], [28, 0], [28, 12],
    [28, 28], [12, 28], [0, 28], [-12, 28], [-28, 28], [-28, 12], [-28, 0], [-28, -12]];
  const caches = [
    [-27, -22], [-14, -23], [0, -23], [13, -23], [27, -22], [-27, -12], [-13, -16], [13, -16], [27, -12],
    [-27, 0], [-13, -7], [-3, -9], [2.5, -7], [12.5, -5], [27, 0], [-27, 12], [-13, 5], [-3, 4], [2.5, 7], [12.5, 8], [27, 12],
    [-27, 22], [-14, 22], [0, 23], [13, 23], [27, 22], [-25, -28], [25, -28], [-25, 28], [25, 28],
    [-21, -5], [-16.8, 3.5], [19.1, 2.9], [18.9, 7], [-11.9, -1.8], [12.5, 1.3], [-16.6, -4.7],
  ];
  const kinds = ['weapon', 'ammo', 'heal', 'weapon', 'grenade', 'weapon'];
  const lootPoints = caches.map(([x, z], index) => loot(`trading-cache-${index}`, x, z, kinds[index % kinds.length]));
  lootPoints.push(loot('trading-research-upper-gun', -20, -4.7, 'weapon', 3.2), loot('trading-research-upper-heal', -16.5, 2.8, 'heal', 3.2),
    loot('trading-operations-upper-gun', 17, -.7, 'weapon', 3.2), loot('trading-operations-upper-ammo', 19.4, 6.5, 'ammo', 3.2));
  return Object.freeze({ ...common, sites: Object.freeze([]),
    spawnPoints: Object.freeze(ring.map(([x, z]) => Object.freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))),
    lootPoints: Object.freeze(lootPoints), stormCenter: point(0, 2) });
}
