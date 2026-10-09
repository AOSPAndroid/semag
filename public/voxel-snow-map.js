/** An asymmetric alpine weather station, with honest roofs, banks and equipment cover. */
const box = (id, x, y, z, w, h, d, color, material) => Object.freeze({ id, x, y, z, w, h, d, color, material });
const point = (x, z, y = 0) => Object.freeze({ x, y, z });
const step = (colliderId, x, z) => Object.freeze({ colliderId, x, z });
const loot = (id, x, z, kind, y = 0) => Object.freeze({ id, x, y, z, kind });
const paint = (kind, x, z, w, d, color) => Object.freeze({ kind, x, z, w, d, color });

function climb(id, name, axis, offset, edge, direction, roofId, landing, side, roofY) {
  const count = Math.round(roofY / .8) - 1, colliders = [], steps = [];
  for (let i = 0; i < count; i++) {
    const distance = edge - direction * (1.1 + (count - 1 - i) * 2.2);
    const x = axis === 'x' ? distance : offset, z = axis === 'z' ? distance : offset;
    const colliderId = `${id}-step-${i + 1}`;
    colliders.push(box(colliderId, x - 1.1, 0, z - 1.1, 2.2, .8 * (i + 1), 2.2,
      i % 2 ? '#829ba9' : '#a9bfca', 'snow-crate'));
    steps.push(step(colliderId, x, z));
  }
  steps.push(step(roofId, landing.x, landing.z));
  const distance = edge - direction * (1.1 + (count - 1) * 2.2 + 1.7);
  const start = point(axis === 'x' ? distance : offset, axis === 'z' ? distance : offset);
  return { colliders, route: Object.freeze({ id, name, side, role: axis === 'x' ? 'mid' : 'flank',
    start, steps: Object.freeze(steps), approach: Object.freeze([start]) }) };
}

function station({ id, name, x, z, w, d, roofY, side, left, color, accent }) {
  const t = .4, doorWidth = 2.6, doorHeight = 2.4, wallHeight = roofY - .32;
  const wing = (w - doorWidth) / 2, roofId = `${id}-roof`;
  const colliders = [
    box(`${id}-west`, x, 0, z, t, wallHeight, d, color, 'snow-wall'),
    box(`${id}-east`, x + w - t, 0, z, t, wallHeight, d, color, 'snow-wall'),
    ...['north', 'south'].flatMap((face, index) => {
      const edge = z + (index ? d - t : 0);
      return [
        box(`${id}-${face}-left`, x + t, 0, edge, wing - t, wallHeight, t, color, 'snow-wall'),
        box(`${id}-${face}-right`, x + wing + doorWidth, 0, edge, wing - t, wallHeight, t, color, 'snow-wall'),
        box(`${id}-${face}-lintel`, x + wing, doorHeight, edge, doorWidth, wallHeight - doorHeight, t, color, 'snow-wall'),
      ];
    }),
    box(roofId, x, wallHeight, z, w, .32, d, '#e7f0f5', 'snow-roof'),
    box(`${id}-roof-service`, x + w / 2 - .6, roofY, z + d / 2 - .45, 1.2, .7, .9, accent, 'weather-equipment'),
    box(`${id}-workbench`, x + .62, 0, z + d / 2 - 1.1, 1.15, .85, 2.2, '#788f98', 'laboratory-desk'),
  ];
  const north = side === 'north', outerX = left ? x + 1.5 : x + w - 1.5, outerEdge = north ? z : z + d;
  const outer = climb(`${id}-outer`, `${name} / snowbank supply ascent`, 'z', outerX, outerEdge, north ? 1 : -1,
    roofId, point(outerX, north ? z + .7 : z + d - .7), side, roofY);
  const innerEdge = left ? x + w : x;
  const inner = climb(`${id}-inner`, `${name} / yard equipment ascent`, 'x', z + d / 2, innerEdge, left ? -1 : 1,
    roofId, point(left ? x + w - .7 : x + .7, z + d / 2), side, roofY);
  const metadata = Object.freeze({ id, name, roofId, wallIds: Object.freeze(colliders.slice(0, 8).map(value => value.id)),
    interior: Object.freeze({ minX: x + t, maxX: x + w - t, minZ: z + t, maxZ: z + d - t }),
    facade: Object.freeze({ x, z, w, d, wallHeight, doorWidth, doorCenterX: x + w / 2, roofY, accent }),
    doorways: Object.freeze([0, 1].map(index => Object.freeze({ x: x + w / 2, z: z + (index ? d - t / 2 : t / 2),
      width: doorWidth, height: doorHeight, outside: point(x + w / 2, index ? z + d + 1 : z - 1),
      inside: point(x + w / 2, index ? z + d - 1.2 : z + 1.2) }))),
  });
  return { colliders: [...colliders, ...outer.colliders, ...inner.colliders], routes: [outer.route, inner.route], metadata,
    lootPoints: [loot(`${id}-weapon`, x + 2.3, z + 1.9, 'weapon'), loot(`${id}-heal`, x + w - 2.3, z + 1.9, 'heal'),
      loot(`${id}-ammo`, x + 2.3, z + d - 1.9, 'ammo'), loot(`${id}-grenade`, x + w - 2.3, z + d - 1.9, 'grenade'),
      loot(`${id}-roof-weapon`, x + 2.2, z + d - 1.3, 'weapon', roofY),
      loot(`${id}-roof-heal`, x + w - 2.2, z + 1.3, 'heal', roofY)] };
}

export function createSnowMap(mode = 'breach') {
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Snow mode must be breach or royale');
  const royale = mode === 'royale', halfW = royale ? 32 : 25, halfD = royale ? 32 : 22;
  const definitions = royale ? [
    { id: 'snow-weather-lab', name: 'Weather Laboratory', x: -23, z: -12, w: 12, d: 10, roofY: 4, side: 'north', left: true, color: '#8eaab9', accent: '#e6a463' },
    { id: 'snow-radio-lodge', name: 'Radio Lodge', x: 9, z: -21, w: 10, d: 11, roofY: 3.2, side: 'north', left: false, color: '#829ca8', accent: '#6cb6bd' },
    { id: 'snow-supply-shelter', name: 'Supply Shelter', x: -19, z: 11, w: 10, d: 9, roofY: 3.2, side: 'south', left: true, color: '#718996', accent: '#eac67a' },
    { id: 'snow-survey-office', name: 'Survey Station', x: 10, z: 7, w: 12, d: 10, roofY: 4, side: 'south', left: false, color: '#91afb2', accent: '#d78b69' },
  ] : [
    { id: 'snow-weather-lab', name: 'Weather Laboratory', x: -20, z: -9, w: 10, d: 8, roofY: 4, side: 'north', left: true, color: '#8eaab9', accent: '#e6a463' },
    { id: 'snow-radio-lodge', name: 'Radio Lodge', x: 8, z: -14, w: 8, d: 10, roofY: 3.2, side: 'north', left: false, color: '#829ca8', accent: '#6cb6bd' },
    { id: 'snow-supply-shelter', name: 'Supply Shelter', x: -16, z: 7, w: 8, d: 7, roofY: 3.2, side: 'south', left: true, color: '#718996', accent: '#eac67a' },
    { id: 'snow-survey-office', name: 'Survey Station', x: 8, z: 3, w: 11, d: 8, roofY: 4, side: 'south', left: false, color: '#91afb2', accent: '#d78b69' },
  ];
  const buildings = definitions.map(station), extras = [], landmarks = [];
  const add = (kind, collider) => {
    extras.push(collider); landmarks.push(Object.freeze({ kind, ...collider, collisionIds: Object.freeze([collider.id]) }));
  };
  add('snow-supply', box('snow-central-supply', -3.5, 0, -1, 7, 2.4, 2, '#47758c', 'metal'));
  add('snow-generator', box('snow-generator-west', royale ? -25 : -20.5, 0, 1.5, 4, 1.7, 2.5, '#64838d', 'metal'));
  add('snow-generator', box('snow-generator-east', royale ? 24 : 20, 0, 5.5, 2.2, 1.2, 3, '#769ca3', 'metal'));
  add('weather-equipment', box('snow-survey-weather-housing', -6.5, 0, 2.2, 2.2, 1.05, 1.6, '#da985e', 'weather-equipment'));
  // Three genuine, inset terraces make the radar radome match its rendered silhouette.
  const lab = definitions[0], cx = lab.x + lab.w * .36, cz = lab.z + lab.d * .53;
  const radar = [box('snow-radar-base', cx - 1.2, lab.roofY, cz - 1.2, 2.4, .6, 2.4, '#cadbe1', 'radar'),
    box('snow-radar-dome', cx - 1, lab.roofY + .6, cz - 1, 2, .9, 2, '#d9e8ed', 'radar'),
    box('snow-radar-cap', cx - .7, lab.roofY + 1.5, cz - .7, 1.4, .7, 1.4, '#eaf1f3', 'radar')];
  extras.push(...radar); landmarks.push(Object.freeze({ kind: 'radar-dish', ...radar[0], collisionIds: Object.freeze(radar.map(value => value.id)) }));
  const radio = definitions[1];
  add('weather-mast', box('snow-radio-weather-mast', radio.x + radio.w * .64, radio.roofY, radio.z + radio.d * .61, .65, 3.2, .65, '#637f8c', 'antenna'));
  // Banked spawn approaches and irregular side banks create distinct snowy rotations.
  const bankDefinitions = royale ? [
    ['north', -5.5, -24, 11, 1.8, 1.3], ['south', -5, 23, 10, 1.8, 1.3],
    ['east', 25, -6, 1.5, .85, 8], ['west', -30, -5.5, 1.4, 1.15, 8],
    ['northwest', -18, -26, 5, .65, 1.8], ['southeast', 19, 22, 5, .85, 1.8],
  ] : [
    ['north', -5.5, -16.5, 11, 1.8, 1.3], ['south', -5, 15, 10, 1.8, 1.3],
    ['east', 20.5, -4, 1.5, .85, 8], ['west', -23.5, -5.5, 1.4, 1.15, 8],
    ['northwest', -11, -12.2, 4, .65, 1.8], ['southeast', 17.5, 13, 4.2, .85, 1.8],
  ];
  for (const [name, x, z, w, h, d] of bankDefinitions) {
    add('snowbank', box(`snow-bank-${name}`, x, 0, z, w, h, d, '#d2e2ed', 'snow-bank'));
    // The lower toe is physical too; the narrow ground ledge never claims an invisible slope.
    add('snowbank', box(`snow-bank-${name}-toe`, x, 0, z + d, w, h * .42, .5, '#e4edf3', 'snow-bank'));
  }
  const prefix = royale ? 'boundary' : 'wall';
  const perimeter = [box(`${prefix}-west`, -halfW - 1, 0, -halfD - 1, 1, 5.8, halfD * 2 + 2, '#b9d0db', 'snow-wall'),
    box(`${prefix}-east`, halfW, 0, -halfD - 1, 1, 5.8, halfD * 2 + 2, '#b9d0db', 'snow-wall'),
    box(`${prefix}-north`, -halfW, 0, -halfD - 1, halfW * 2, 5.8, 1, '#b9d0db', 'snow-wall'),
    box(`${prefix}-south`, -halfW, 0, halfD, halfW * 2, 5.8, 1, '#b9d0db', 'snow-wall')];
  const common = { id: 'snow', name: 'Frostline Research', theme: 'snow', mode,
    description: 'An asymmetric alpine research station: a radar laboratory, radio lodge, survey office and supply shelter overlook a banked snow yard. Eight equipment climbs connect different roof heights; generators, rescue cargo and icy side routes give each approach its own cover.',
    bounds: Object.freeze({ minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD }),
    colliders: Object.freeze([...perimeter, ...buildings.flatMap(value => value.colliders), ...extras]),
    routes: Object.freeze(buildings.flatMap(value => value.routes)), buildings: Object.freeze(buildings.map(value => value.metadata)),
    landmarks: Object.freeze(landmarks), tunnels: Object.freeze([]), ceilings: Object.freeze([]),
    decorations: Object.freeze([paint('snow-yard', -8, -3.5, 16, 8.5, '#bdd0dc'),
      paint('snow-path', -2.3, -halfD, 4.6, halfD * 2, '#b2c9d8'),
      paint('snow-path-west', -halfW + 1, -halfD + 1, 2.5, halfD * 2 - 2, '#c6d7e0'),
      paint('snow-path-east', halfW - 3.5, -halfD + 1, 2.5, halfD * 2 - 2, '#c6d7e0'),
      paint('snow-survey-yard', royale ? -27 : -21.5, 1, 6, 5, '#b7cbd4')]),
    floorColor: '#dbe7ef', skyColor: '#afcadd',
  };
  if (!royale) return Object.freeze({ ...common,
    sites: Object.freeze([Object.freeze({ id: 'A', x: -13, z: -15, radius: 2.2 }), Object.freeze({ id: 'B', x: 20, z: -13, radius: 2.2 })]),
    spawns: Object.freeze([Object.freeze([-3, 0, 3].map(x => Object.freeze({ x, z: 19, yaw: 0 }))),
      Object.freeze([3, 0, -3].map(x => Object.freeze({ x, z: -19, yaw: Math.PI })))]),
    groundRoutes: Object.freeze([-1, 1].map(sign => Object.freeze({ id: `snow-site-${sign < 0 ? 'a' : 'b'}-outer`,
      siteId: sign < 0 ? 'A' : 'B', name: sign < 0 ? 'West generator snow trail' : 'East survey snow trail', start: point(-3, 19),
      waypoints: Object.freeze([point(-3, 21.3), point(sign < 0 ? -14 : 12, 21.3), point(sign < 0 ? -24.2 : 22.7, 21.3),
        point(sign < 0 ? -24.2 : 22.7, 10), point(sign < 0 ? -24.2 : 22.7, -10), point(sign < 0 ? -24.2 : 22.7, -20.8),
        point(sign < 0 ? -13 : 20, -20.8), point(sign < 0 ? -13 : 20, sign < 0 ? -15 : -13)]) }))),
  });
  const ring = [[-28, -28], [-12, -28], [0, -28], [12, -28], [28, -28], [28, -12], [28, 0], [28, 12],
    [28, 28], [12, 28], [0, 28], [-12, 28], [-28, 28], [-28, 12], [-28, 0], [-28, -12]];
  const outsideLoot = [loot('snow-northwest', -25, -25, 'weapon'), loot('snow-northeast', 24, -25, 'heal'),
    loot('snow-southwest', -24, 25, 'ammo'), loot('snow-southeast', 25, 25, 'weapon'),
    loot('snow-west-cache', -27, 5, 'weapon'), loot('snow-east-cache', 27, 5, 'heal'),
    loot('snow-north-court', -1.5, -26, 'grenade'), loot('snow-south-court', -1.5, 26, 'ammo'),
    loot('snow-west-crossing', -7, 1, 'ammo'), loot('snow-east-crossing', 7, 1, 'grenade'),
    loot('snow-mid-north', 0, -6, 'weapon'), loot('snow-mid-south', 0, 6, 'heal')];
  return Object.freeze({ ...common, sites: Object.freeze([]),
    spawnPoints: Object.freeze(ring.map(([x, z]) => Object.freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))),
    lootPoints: Object.freeze([...buildings.flatMap(value => value.lootPoints), ...outsideLoot]), stormCenter: point(0, 6) });
}
