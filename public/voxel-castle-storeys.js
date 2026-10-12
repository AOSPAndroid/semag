/** Real floor plates, stair wells and arched upper entrances for Crownfall. */
const freeze = Object.freeze;
const point = (x, z, y = 0) => freeze({ x, y, z });
const box = (id, x, y, z, w, h, d, color = '#96998a', material = 'castle-stone') => freeze({ id, x, y, z, w, h, d, color, material });
const inside = (r, p, margin = 0) => p.x >= r.x + margin && p.x <= r.x + r.w - margin && p.z >= r.z + margin && p.z <= r.z + r.d - margin;

function subtract(regions, cut) {
  return regions.flatMap(r => {
    const x = Math.max(r.x, cut.x), z = Math.max(r.z, cut.z), xx = Math.min(r.x + r.w, cut.x + cut.w), zz = Math.min(r.z + r.d, cut.z + cut.d);
    if (xx <= x || zz <= z) return [r];
    return [{ x: r.x, z: r.z, w: r.w, d: z - r.z }, { x: r.x, z: zz, w: r.w, d: r.z + r.d - zz },
      { x: r.x, z, w: x - r.x, d: zz - z }, { x: xx, z, w: r.x + r.w - xx, d: zz - z }].filter(p => p.w > .01 && p.d > .01);
  });
}

export function addCastleStoreys({ colliders, routes, buildings, upperFloors, landmarks, decorations, coverIds, lootPoints, top }) {
  const structures = buildings.filter(b => b.id.startsWith('keep-'));
  const originals = new Map(structures.map(b => [b.id, colliders.find(v => v.id === b.roofId)]));
  const solids = value => { colliders.push(value); return value; };
  const supportAt = (tiles, p) => tiles.find(tile => inside(tile, p, .54));
  const decks = new Map();
  function floor(building, level, holes, anchor) {
    const old = originals.get(building.id), y = level * top;
    const regions = holes.reduce(subtract, [{ x: old.x, z: old.z, w: old.w, d: old.d }]);
    const first = regions.findIndex(r => inside(r, anchor, .54));
    if (first < 0) throw new Error(`Missing full floor landing: ${building.id}/${level}`);
    const tiles = regions.map((r, index) => solids(box(level === 1 && index === first ? old.id : `${building.id}-level-${level}-deck-${index}`,
      r.x, y - .32, r.z, r.w, .32, r.d, '#888e7c', 'castle-floor')));
    decks.set(`${building.id}:${level}`, tiles); return tiles;
  }
  function faceWall(id, face, edge, start, length, y, doorway) {
    const height = top - .32, axisX = face === 'north' || face === 'south';
    const piece = (part, left, bottom, w, h) => {
      if (w <= .01 || h <= .01) return;
      solids(box(`${id}-${face}-${part}`, axisX ? left : edge, y + bottom, axisX ? edge : left,
        axisX ? w : .5, h, axisX ? .5 : w));
    };
    if (doorway === undefined) { piece('wall', start, 0, length, height); return; }
    const left = Math.max(start + .5, doorway - 1.4), right = Math.min(start + length - .5, doorway + 1.4);
    piece('left', start, 0, left - start, height); piece('right', right, 0, start + length - right, height);
    // The centre rises above the shoulders, forming a real stepped stone arch.
    const span = (right - left) / 5;
    for (let i = 0; i < 5; i++) { const bottom = [2.32, 2.56, 2.72, 2.56, 2.32][i]; piece(`arch-${i}`, left + i * span, bottom, span, height - bottom); }
  }
  function walls(building, level) {
    const original = originals.get(building.id), x = original.x, z = original.z, w = original.w, d = original.d, y = level * top;
    const tower = /tower/.test(building.id), gate = building.id === 'keep-gatehouse', royal = building.id === 'keep-royal-hall';
    const firstEntry = building.id === 'keep-west-tower' ? -19.1 : building.id === 'keep-east-tower' ? 19.1 : royal ? -6.9 : 0;
    faceWall(`${building.id}-story-${level}`, 'north', z, x, w, y, gate ? 0 : level === 1 ? firstEntry : undefined);
    faceWall(`${building.id}-story-${level}`, 'south', z + d - .5, x, w, y, royal || gate ? level === 1 && gate ? -3.4 : 0 : level === 1 ? firstEntry : undefined);
    if (royal && level === 3) {
      // The exposed roof flight enters through a real lowered crenel. A tall
      // solid wall here would block a slow player's landing during the jump.
      solids(box(`${building.id}-story-${level}-west-north`, x, y, z, .5, top - .32, 3.6));
      solids(box(`${building.id}-story-${level}-west-notch`, x, y, -15.4, .5, 2, 2.8));
      solids(box(`${building.id}-story-${level}-west-south`, x, y, -12.6, .5, top - .32, 3.6));
    } else faceWall(`${building.id}-story-${level}`, 'west', x, z, d, y, gate || building.id === 'keep-east-tower' ? 0 : undefined);
    faceWall(`${building.id}-story-${level}`, 'east', x + w - .5, z, d, y, gate || building.id === 'keep-west-tower' ? 0 : undefined);
    if (royal || tower) for (const face of ['north', 'south']) decorations.push(freeze({ kind: 'castle-banner', buildingId: building.id, face,
      x: building.id === 'keep-east-tower' && level === 1 ? x + 1.2 : x + w - 2, y: y + .65, z: face === 'north' ? z - .018 : z + d + .018,
      w: 1.1, h: 1.8, d: .02, color: royal ? '#963943' : '#385d65', trimColor: '#d3b86e' }));
  }
  function flight(building, baseLevel, layout, suffix = '') {
    const y = baseLevel * top, level = baseLevel + 1, id = `${building.id}-interior-rise-${level}${suffix}`;
    const steps = [];
    for (let i = 0; i < 3; i++) {
      const x = layout.firstX + layout.direction * i * 2.2, colliderId = `${id}-step-${i + 1}`;
      solids(box(colliderId, x - 1.1, y, layout.z - 1.1, 2.2, top / 4 * (i + 1), 2.2, '#a6a28b', 'castle-stair'));
      steps.push(freeze({ colliderId, x, z: layout.z }));
    }
    const end = point(layout.endX, layout.endZ ?? layout.z, level * top), landing = supportAt(decks.get(`${building.id}:${level}`), end);
    if (!landing) throw new Error(`Unsafe castle stair landing: ${id}`);
    steps.push(freeze({ colliderId: landing.id, ...end }));
    const start = point(layout.firstX, building.id === 'keep-royal-hall'
      ? layout.z + (layout.z > layout.centreZ ? -2.5 : 2.5) : 0, y);
    routes.push(freeze({ id, name: `${building.name} / floor ${level + 1}`, side: 'interior', role: 'castle-stair', start,
      approach: freeze([start]), steps: freeze(steps) }));
    return id;
  }
  function battlements(building, level) {
    const roof = originals.get(building.id), y = top * level;
    const values = [];
    // Raised corner merlons and interrupted parapets leave protected firing gaps.
    for (const [index, [x, z]] of [[roof.x + .10, roof.z + .10], [roof.x + roof.w - 1.20, roof.z + .10],
      [roof.x + .10, roof.z + roof.d - 1.20], [roof.x + roof.w - 1.20, roof.z + roof.d - 1.20]].entries()) {
      const b = solids(box(`${building.id}-crown-merlon-${index}`, x, y, z, 1.1, 1.1, 1.1, '#b2ac92'));
      values.push(b); coverIds.push(b.id);
    }
    for (const face of ['north', 'south']) for (let x = roof.x + 2.1; x < roof.x + roof.w - 1.5; x += 3.2) {
      const b = solids(box(`${building.id}-${face}-crown-${x}`, x, y, face === 'north' ? roof.z + .1 : roof.z + roof.d - .5, 1.2, .7, .4));
      values.push(b); coverIds.push(b.id);
    }
    landmarks.push(freeze({ id: `${building.id}-crown`, kind: 'battlement', name: `${building.name} battlements`, collisionIds: freeze(values.map(v => v.id)) }));
  }

  for (const building of structures) {
    const royal = building.id === 'keep-royal-hall', gate = building.id === 'keep-gatehouse', levels = royal ? 4 : 3;
    const original = originals.get(building.id), { x, z, w, d } = original;
    const north = royal ? { x: 1.7, z: -19, w: 6.8, d: 2.2 } : { x: x + 1.9, z: -3, w: w - 2.4, d: 2.2 };
    const south = royal ? { x: -8.5, z: -11.2, w: 6.8, d: 2.2 } : { x: x + .5, z: .8, w: w - 2.2, d: 2.2 };
    const layouts = royal ? [
      { firstX: -7.35, direction: 1, z: -10.1, endX: -1.0, centreZ: -14 },
      { firstX: 7.35, direction: -1, z: -17.9, endX: 1.0, centreZ: -14 },
    ] : [
      { firstX: x + 1.65, direction: 1, z: 1.9, endX: x + w - 1.05, centreZ: 0 },
      { firstX: x + w - 1.65, direction: -1, z: -1.9, endX: x + 1.05, centreZ: 0 },
    ];
    if (gate) {
      // Ground access comes from the southern court or the inside north flight.
      layouts.reverse();
    }
    const ids = new Set(colliders.filter(b => b.id.startsWith(`${building.id}-merlon-`) || (royal || gate) && b.id === original.id).map(b => b.id));
    for (let i = colliders.length - 1; i >= 0; i--) if (ids.has(colliders[i].id)) colliders.splice(i, 1);
    for (let i = coverIds.length - 1; i >= 0; i--) if (ids.has(coverIds[i])) coverIds.splice(i, 1);
    for (let i = landmarks.length - 1; i >= 0; i--) if (ids.has(landmarks[i].id)) landmarks.splice(i, 1);
    for (let level = 1; level <= levels; level++) {
      const hasFlight = royal || gate || level > 1;
      const layout = layouts[(level - (royal || gate ? 1 : 2)) % 2];
      const stairCut = layout?.z < (royal ? -14 : 0) ? north : south;
      const holes = hasFlight ? [stairCut] : [];
      if (royal && level < 4) holes.unshift({ x: -4, z: -15.5, w: 8, d: 3 });
      const anchor = level === 1 ? royal ? point(-6.9, -18.3) : gate ? point(-3.4, 4.3) : point(x + w / 2, 0)
        : point(layout.endX, layout.endZ ?? layout.z);
      let tiles;
      if (level === 1 && !royal && !gate) { tiles = [original]; decks.set(`${building.id}:1`, tiles); }
      else {
        tiles = floor(building, level, holes, anchor);
      }
      if (level < levels) walls(building, level);
      if (hasFlight) {
        const routeId = flight(building, level - 1, layout);
        const centre = royal ? point(level === 2 || level === 4 ? -6 : 6, -14, level * top) : point(x + w / 2, 0, level * top);
        upperFloors.push(freeze({ id: `${building.id}-floor-${level}`, name: `${building.name} / ${level === levels ? 'battlements' : `floor ${level + 1}`}`,
          colliderIds: freeze(tiles.map(t => t.id)), routeIds: freeze([routeId]),
          underpasses: freeze([point(centre.x - .6, centre.z), point(centre.x + .6, centre.z)]),
          traverse: freeze([point(centre.x - .6, centre.z, centre.y), point(centre.x + .6, centre.z, centre.y)]) }));
      }
      if (level === levels) battlements(building, level);
      if (level > 1) {
        const candidate = royal ? point(-6, -14, level * top) : point(x + w / 2, 0, level * top);
        if (supportAt(tiles, candidate)) lootPoints.push(freeze({ id: `${building.id}-upper-cache-${level}`, ...candidate, kind: level === levels ? 'weapon' : 'ammo' }));
      }
    }
    const index = buildings.indexOf(building);
    buildings[index] = freeze({ ...building, wallIds: freeze([...building.wallIds,
      ...colliders.filter(b => b.id.startsWith(`${building.id}-story-`)).map(b => b.id)]),
      storeys: levels, height: levels * top, floorHeights: freeze(Array.from({ length: levels + 1 }, (_, i) => i * top)) });
    // The royal hall's centre is a real tall atrium, rather than a painted room.
    if (royal) {
      const cache = lootPoints.findIndex(p => p.id === `${building.id}-battlement-cache`);
      if (cache >= 0) lootPoints[cache] = freeze({ ...lootPoints[cache], x: 6, z: -14 });
    }
    if (gate) {
      const cache = lootPoints.findIndex(p => p.id === `${building.id}-armoury`);
      if (cache >= 0) lootPoints[cache] = freeze({ ...lootPoints[cache], z: -3.8 });
      const medicine = lootPoints.findIndex(p => p.id === `${building.id}-medicine`);
      if (medicine >= 0) lootPoints[medicine] = freeze({ ...lootPoints[medicine], x: 3.45, z: .1 });
    }
  }
  // Three connected castle heights, with real entrances into each tower floor.
  for (let level = 2; level <= 3; level++) {
    const y = top * level, supports = [];
    for (const [side, x] of [['west', -12], ['east', 5]]) supports.push(solids(box(`keep-${side}-upper-wallwalk-${level}`, x, y - .32, -1.3, 7, .32, 2.6, '#888e7c', 'castle-floor')));
    supports.push(solids(box(`keep-royal-link-${level}`, -1.3, y - .32, -9, 2.6, .32, 4, '#888e7c', 'castle-floor')));
    const access = routes.filter(r => r.id.startsWith('keep-west-tower-interior-rise-') || r.id.startsWith('keep-east-tower-interior-rise-')).filter(r => r.steps.at(-1).y === y);
    upperFloors.push(freeze({ id: `keep-upper-circuit-${level}`, name: `Castle wall walks / ${level + 1}`, colliderIds: freeze(supports.map(b => b.id)),
      routeIds: freeze(access.map(r => r.id)), underpasses: freeze([point(-8, 0), point(8, 0)]), traverse: freeze([point(-8, 0, y), point(8, 0, y), point(0, -7, y)]) }));
  }
  solids(box('keep-royal-link-1', -1.3, top - .32, -9, 2.6, .32, 4, '#888e7c', 'castle-floor'));
  // A second, exposed roof approach climbs from the west tower skywalk.
  // It avoids stacking two solid flights over the same interior stair well.
  const skywalk = solids(box('keep-west-royal-skywalk', -16.4, top * 3 - .32, -15.1, 2.4, .32, 12.1, '#888e7c', 'castle-floor'));
  const royal = buildings.find(b => b.id === 'keep-royal-hall');
  const balcony = solids(box('keep-royal-roof-landing', -10.1, top * 4 - .32, -15.1, 1.6, .32, 2.2, '#888e7c', 'castle-floor'));
  decks.get('keep-royal-hall:4').push(balcony);
  const royalRoofIndex = upperFloors.findIndex(f => f.id === 'keep-royal-hall-floor-4');
  upperFloors[royalRoofIndex] = freeze({ ...upperFloors[royalRoofIndex], colliderIds: freeze([...upperFloors[royalRoofIndex].colliderIds, balcony.id]) });
  flight(royal, 3, { firstX: -15.2, direction: 1, z: -14, endX: -9.1, centreZ: -14 }, '-alternate');
  upperFloors.push(freeze({ id: 'keep-west-skywalk-floor-3', name: 'Royal approach / west skywalk', colliderIds: freeze([skywalk.id]),
    routeIds: freeze([]), underpasses: freeze([point(-15.2, -8), point(-15.2, -10)]),
    traverse: freeze([point(-15.2, -8, top * 3), point(-15.2, -11.5, top * 3)]) }));
  for (let i = 0; i < upperFloors.length; i++) {
    const floor = upperFloors[i];
    if (!/-floor-|keep-upper-circuit/.test(floor.id)) continue;
    const height = floor.traverse[0].y;
    const approaches = routes.filter(r => {
      const last = r.steps.at(-1), b = colliders.find(b => b.id === last.colliderId);
      return b && Math.abs(b.y + b.h - height) < .001;
    });
    // Shared wall walks make the other towers valid alternate approaches.
    upperFloors[i] = freeze({ ...floor, routeIds: freeze(approaches.map(r => r.id)) });
  }
}
