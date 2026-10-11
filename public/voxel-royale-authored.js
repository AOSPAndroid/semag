/** Three distinct 96 m scavenging worlds. Floors, stairs and props are real solids. */
const freeze = Object.freeze;
const point = (x, z, y = 0) => freeze({ x, y, z });
const solid = (id, x, y, z, w, h, d, color, material = 'stone') => freeze({ id, x, y, z, w, h, d, color, material });
const supply = (id, x, z, kind, y = 0) => freeze({ id, x, y, z, kind });
const BOUNDS = freeze({ minX: -48, maxX: 48, minZ: -48, maxZ: 48 });

function author(id, name, description, floorColor, skyColor, color, material, stormCenter) {
  const colliders = [], routes = [], buildings = [], lootPoints = [], upperFloors = [], regions = [], landmarks = [], decorations = [];
  const add = (name, x, y, z, w, h, d, tint = color, texture = material) => {
    const value = solid(name, x, y, z, w, h, d, tint, texture); colliders.push(value); return value;
  };
  for (const [side, x, z, w, d] of [['west', -49, -49, 1, 98], ['east', 48, -49, 1, 98], ['north', -48, -49, 96, 1], ['south', -48, 48, 96, 1]]) add(`boundary-${side}`, x, 0, z, w, 7.2, d);
  const cache = (name, x, z, kind = 'weapon', y = 0) => lootPoints.push(supply(`${id}-${name}`, x, z, kind, y));
  const mark = (name, kind, label, ids) => {
    const pieces = ids.map(id => colliders.find(box => box.id === id));
    const x = Math.min(...pieces.map(box => box.x)), y = Math.min(...pieces.map(box => box.y)), z = Math.min(...pieces.map(box => box.z));
    landmarks.push(freeze({ id: `${id}-${name}`, name, kind, label, x, y, z,
      w: Math.max(...pieces.map(box => box.x + box.w)) - x, h: Math.max(...pieces.map(box => box.y + box.h)) - y,
      d: Math.max(...pieces.map(box => box.z + box.d)) - z, colliderIds: freeze(ids) }));
  };
  /** Room footprints are authored per district, with two standing-height exits. */
  function room(name, x, z, w, d, tint = color, texture = material) {
    const t = .4, door = 2.8, edge = (w - door) / 2, wallIds = [];
    for (const [face, bx] of [['west', x], ['east', x + w - t]]) wallIds.push(add(`${name}-${face}`, bx, 0, z, t, 3, d, tint, texture).id);
    for (const [face, bz] of [['north', z], ['south', z + d - t]]) {
      wallIds.push(add(`${name}-${face}-left`, x + t, 0, bz, edge - t, 3, t, tint, texture).id);
      wallIds.push(add(`${name}-${face}-right`, x + edge + door, 0, bz, edge - t, 3, t, tint, texture).id);
      wallIds.push(add(`${name}-${face}-lintel`, x + edge, 2.35, bz, door, .65, t, tint, texture).id);
    }
    const roofId = add(`${name}-roof`, x, 3, z, w, .36, d, tint, texture).id;
    const doorways = [z, z + d - t].map((bz, index) => freeze({ x: x + w / 2, z: bz + t / 2, width: door, height: 2.35,
      outside: point(x + w / 2, index ? z + d + 1 : z - 1), inside: point(x + w / 2, index ? z + d - 1.2 : z + 1.2) }));
    buildings.push(freeze({ id: name, roofId, wallIds: freeze(wallIds), interior: freeze({ minX: x + t, maxX: x + w - t, minZ: z + t, maxZ: z + d - t }), doorways: freeze(doorways) }));
    cache(`${name}-gun`, x + 1.7, z + 2, 'weapon'); cache(`${name}-heal`, x + w - 1.7, z + 2, 'heal'); cache(`${name}-ammo`, x + w - 1.7, z + d - 1.7, 'ammo');
    return roofId;
  }
  function deck(name, x, z, w, d, top, tint = color, texture = material, posts = true) {
    add(name, x, top - .3, z, w, .3, d, tint, texture);
    if (posts) for (const [i, [px, pz]] of [[x, z], [x + w - .55, z + d - .55]].entries()) add(`${name}-support-${i}`, px, 0, pz, .55, top - .3, .55, tint, texture);
    return name;
  }
  /** Broad consecutive .84 m rises use the shipped jump physics, including LMGs. */
  function stairs(name, axis, offset, edge, direction, floorId, top) {
    const count = Math.round(top / .84) - 1, steps = [], reach = 1.1 + (count - 1) * 2.2;
    for (let i = 0; i < count; i++) {
      const distance = edge - direction * (reach - i * 2.2), x = axis === 'x' ? distance : offset, z = axis === 'z' ? distance : offset;
      const colliderId = add(`${name}-rise-${i + 1}`, x - 1.1, 0, z - 1.1, 2.2, .84 * (i + 1), 2.2).id;
      steps.push(freeze({ colliderId, x, z }));
    }
    const landing = edge + direction * .7;
    steps.push(freeze({ colliderId: floorId, x: axis === 'x' ? landing : offset, z: axis === 'z' ? landing : offset }));
    const origin = edge - direction * (reach + 1.7);
    routes.push(freeze({ id: name, name: name.replaceAll('-', ' '), role: 'flank', start: point(axis === 'x' ? origin : offset, axis === 'z' ? origin : offset), steps: freeze(steps) }));
    return name;
  }
  const level = (name, colliderIds, routeIds, underpasses, traverse) => upperFloors.push(freeze({ id: `${id}-${name}`, name,
    colliderIds: freeze(colliderIds), routeIds: freeze(routeIds), underpasses: freeze(underpasses.map(p => point(...p))), traverse: freeze(traverse.map(p => point(...p))) }));
  const district = (name, x, z) => regions.push(freeze({ id: `${id}-${name.toLowerCase().replaceAll(' ', '-')}`, name, anchor: point(x, z), bounds: freeze({ minX: x - 6, maxX: x + 6, minZ: z - 6, maxZ: z + 6 }) }));
  const ground = (name, x, z, w, d, tint) => decorations.push(freeze({ kind: name, x, z, w, d, color: tint }));
  function finish() {
    const ring = [[-44, -44], [-20, -44], [0, -44], [20, -44], [44, -44], [44, -20], [44, 0], [44, 20], [44, 44], [20, 44], [0, 44], [-20, 44], [-44, 44], [-44, 20], [-44, 0], [-44, -20]];
    return freeze({ id, name, description, theme: id, authoredLayout: true, bounds: BOUNDS, floorColor, skyColor, stormCenter: point(...stormCenter), sites: freeze([]),
      colliders: freeze(colliders), spawnPoints: freeze(ring.map(([x, z]) => freeze({ x, y: 0, z, yaw: Math.atan2(-x, z) }))), lootPoints: freeze(lootPoints), routes: freeze(routes), buildings: freeze(buildings),
      upperFloors: freeze(upperFloors), regions: freeze(regions), landmarks: freeze(landmarks), props: freeze([]), decorations: freeze(decorations), smallCoverIds: freeze(colliders.filter(box => box.y === 0 && box.h <= 1 && !box.id.includes('rise')).map(box => box.id)) });
  }
  const route = value => routes.push(freeze({ ...value, steps: freeze(value.steps) }));
  return { add, cache, room, deck, stairs, level, district, ground, mark, route, finish };
}

function forest() {
  const a = author('forest', 'Cedarfall Reserve', 'A canopy village crosses the forest on suspended timber trails. Climb from four different clearings, pass below the bridges, or claim a higher firewatch tower. Six scattered ranger cabins and dense groves hide supplies away from the centre.', '#647c53', '#b9d4cd', '#9a7b53', 'wood', [0, 12]);
  for (const [name, x, z, w, d] of [['lumber-lodge', -40, -39, 10, 8], ['birch-bunkhouse', -15, -38, 12, 7], ['trapper-house', 25, 23, 11, 8], ['river-ranger', -29, 30, 8, 10], ['west-fishing-hut', -39, 8, 8, 9], ['east-ranger-hut', 29, -20, 9, 9]]) a.room(name, x, z, w, d);
  const level = 3.36, decks = [a.deck('canopy-west-treehouse', -22, -6, 10, 8, level), a.deck('canopy-ranger-hall', -5, -6, 10, 8, level), a.deck('canopy-east-treehouse', 12, -6, 10, 8, level), a.deck('canopy-south-camp', -5, 18, 10, 8, level)];
  const bridges = [a.deck('canopy-west-ropewalk', -12, -3.4, 7, 2.8, level, '#b99a63', 'wood', false), a.deck('canopy-east-ropewalk', 5, -3.4, 7, 2.8, level, '#b99a63', 'wood', false), a.deck('canopy-stream-crossing', -1.4, 2, 2.8, 16, level, '#b99a63', 'wood', false)];
  for (const [side, x] of [['west', -12], ['east', 5]]) for (const [edge, z] of [['north', -3.4], ['south', -.72]]) a.add(`canopy-${side}-bridge-${edge}-rail`, x, level, z, 7, .72, .12, '#76563c');
  for (const [edge, x] of [['west', -1.4], ['east', 1.28]]) a.add(`canopy-stream-${edge}-rail`, x, level, 2, .12, .72, 16, '#76563c');
  const approaches = [a.stairs('canopy-west-log-trail', 'x', -2, -22, 1, decks[0], level), a.stairs('canopy-east-log-trail', 'x', -2, 22, -1, decks[2], level), a.stairs('canopy-north-log-trail', 'z', 0, -6, 1, decks[1], level), a.stairs('canopy-south-log-trail', 'z', 0, 26, -1, decks[3], level)];
  a.level('Canopy village', [...decks, ...bridges], approaches, [[0, 9], [-8, -2], [8, -2]], [[-20, -2, level], [0, -2, level], [20, -2, level], [0, -2, level], [0, 22, level]]);
  for (const [i, [x, z]] of [[-20.5, -5.6], [14, -5.6], [-4.2, -5.6], [-4.2, 24.8]].entries()) a.add(`canopy-camp-timber-screen-${i}`, x, level, z, 3, 1.05, .65, '#b19460');
  const tower = a.deck('firewatch-tower', 25, -37, 7, 7, 5.04, '#7e6947');
  a.stairs('firewatch-south-timber', 'z', 28.5, -30, -1, tower, 5.04);
  a.mark('Canopy camp', 'canopy-village', 'CANOPY', decks); a.mark('Firewatch tower', 'watch-deck', 'FIREWATCH', [tower]);
  for (const [i, [x, z]] of [[-37, -24], [-32, -17], [-24, -22], [-23, 20], [-16, 22], [-12, 12], [-12, -18], [-5, -24], [7, -24], [16, -22], [22, -17], [25, 12], [15, 15], [15, 30], [9, 35], [36, 14], [38, 35], [-36, 25]].entries()) {
    a.add(`pine-${i}-trunk`, x - .36, 0, z - .36, .72, 4.3, .72, '#76543a', 'bark');
    a.add(`pine-${i}-lower`, x - 2, 3.65, z - 2, 4, 1.65, 4, i % 2 ? '#37694a' : '#315d43', 'foliage');
    a.add(`pine-${i}-crown`, x - 1.25, 5.3, z - 1.25, 2.5, 1.7, 2.5, '#497b52', 'foliage');
  }
  for (const [i, [x, z, w, d]] of [[-39, -7, 5, 1.2], [35, 5, 4, 1.2], [-7, -39, 1.2, 4], [6, 35, 1.2, 4], [-37, 35, 4, 1.2], [33, -39, 4, 1.2], [-16, 5, 4, 1.2], [11, 9, 4, 1.2]].entries()) a.add(`forest-trail-timber-${i}`, x, 0, z, w, .78, d, '#94714a');
  // Working clearings interrupt the long bare perimeter runs. Logs and ranger
  // supplies offer low hops; taller deliveries and river rocks protect a peek.
  // Their staggered footprints leave the cabin doors and canopy climbs open.
  for (const [name, x, z, w, h, d, color, material, kind] of [
    ['north-fallen-logs', 10, -36, 4, .72, 1.8, '#97734b', 'wood', 'logging-pile'],
    ['north-ranger-crates', 15, -32, 2.2, 1.55, 1.8, '#7e6946', 'wood', 'ranger-supplies'],
    ['south-fallen-timber', -7, 34, 4, .84, 1.8, '#a48051', 'wood', 'logging-pile'],
    ['south-ranger-cases', 22, 34, 2.2, 1.55, 1.8, '#70846b', 'crate', 'ranger-supplies'],
    ['east-river-boulder', 37, -1, 3, 1.55, 1.8, '#879180', 'stone', 'river-rock'],
    ['east-stream-rock', 33, -5, 2.2, .84, 2.2, '#9aa48c', 'stone', 'river-rock'],
    ['west-fallen-logs', -26, 14, 4, .72, 1.8, '#8b6948', 'wood', 'logging-pile'],
    ['west-ranger-delivery', -27, 9, 2.2, 1.55, 1.8, '#a3875a', 'wood', 'ranger-supplies'],
  ]) {
    const id = `forest-sparse-${name}`;
    a.add(id, x, 0, z, w, h, d, color, material); a.mark(name, kind, '', [id]);
  }
  for (const [name, x, z, y] of [['west-high', -17, -2, level], ['east-high', 17, -2, level], ['ranger-high', 0, -2, level], ['south-high', 0, 22, level], ['firewatch-high', 28.5, -34, 5.04]]) a.cache(name, x, z, 'weapon', y);
  for (const [i, [x, z]] of [[-39, -19], [-35, -4], [-36, 22], [-35, 42], [39, -24], [40, -8], [40, 8], [41, 21], [-23, -40], [-9, -41], [10, -40], [22, -42], [-37, 41], [-10, 39], [13, 40], [23, 37], [-8, 7], [8, 14], [-23, 10], [23, -9]].entries()) a.cache(`trail-cache-${i}`, x, z, ['weapon', 'heal', 'ammo', 'weapon', 'grenade'][i % 5]);
  for (const [name, x, z] of [['Lumber clearing', -35, -27], ['Birch grove', -10, -26], ['Canopy village', 0, 12], ['River camp', -25, 26]]) a.district(name, x, z);
  a.ground('forest-stream', 6, -44, 3, 88, '#5c877f'); a.ground('logging-clearing', -43, -31, 20, 4, '#8f835d'); a.ground('camp-trail', -2, 10, 4, 30, '#8a865e');
  return a.finish();
}

function maze() {
  const a = author('maze', 'Verdant Labyrinth', 'A broken archive labyrinth fills the ground beneath a second-storey observatory circuit. The elevated route bends around an open court, crosses the maze on stone causeways, and connects three distant libraries. Five independent stair chains keep the high route contestable.', '#a2ae86', '#cad8ce', '#8a9b8b', 'stone', [0, 0]);
  for (const [name, x, z, w, d] of [['western-library', -41, -39, 13, 6], ['north-scriptorium', -15, -40, 7, 11], ['eastern-library', 29, -37, 10, 6], ['rooted-archive', -41, 27, 9, 13], ['south-record-house', 2, 29, 14, 8], ['echo-library', 30, 24, 11, 12]]) a.room(name, x, z, w, d);
  const height = 4.2, floors = [a.deck('maze-west-observatory', -17, -22, 14, 9, height), a.deck('maze-east-observatory', 13, -22, 12, 9, height), a.deck('maze-east-record-gallery', 13, 6, 12, 10, height), a.deck('maze-west-root-gallery', -32, 2, 12, 10, height), a.deck('maze-north-causeway', -3, -17, 16, 3.2, height, '#97a68d', 'stone', false), a.deck('maze-east-causeway', 17, -13, 3.2, 19, height, '#97a68d', 'stone', false), a.deck('maze-court-causeway', -20, 6, 33, 3.2, height, '#97a68d', 'stone', false), a.deck('maze-root-causeway', -24, -17, 3.2, 19, height, '#97a68d', 'stone', false), a.deck('maze-west-elbow', -24, -17, 7, 3.2, height, '#97a68d', 'stone', false)];
  const routes = [a.stairs('maze-north-observatory-rise', 'z', -6, -22, 1, floors[0], height), a.stairs('maze-west-root-rise', 'x', 6, -32, 1, floors[3], height), a.stairs('maze-east-record-rise', 'x', 11, 25, -1, floors[2], height), a.stairs('maze-south-causeway-rise', 'z', 5, 9.2, -1, floors[6], height), a.stairs('maze-east-observatory-rise', 'z', 21, -22, 1, floors[1], height)];
  a.level('Observatory circuit', floors, routes, [[0, 7.5], [18.6, 0], [-22.5, -8]], [[-10, -17, height], [18.6, -17, height], [18.6, 8, height], [-25, 8, height], [-22.5, -15.5, height], [-10, -17, height]]);
  for (const [i, [x, z, w, d]] of [[-15.5, -21.6, 4, .7], [14, -21.6, 4, .7], [23.6, 7.4, .7, 2.5], [-31.5, 3, .7, 2.2]].entries()) a.add(`maze-upper-carved-screen-${i}`, x, height, z, w, 1.15, d, '#a3ae94');
  // The ground route is a winding, asymmetric maze, not four mirrored rooms.
  for (const [i, [x, z, w, d]] of [[-18, -9, 10, .8], [-8.8, -9, .8, 5], [-18, -3, 5, .8], [-13.8, -3, .8, 6], [-18, 3, 7, .8], [-4, -12, .8, 8], [-3.2, -5, 10, .8], [6, -12, .8, 7], [6, -12, 7, .8], [11.5, -3, .8, 7], [3, 2, 9.3, .8], [-15, 13, 12, .8], [-15, 13, .8, 8], [-9, 18, 9, .8], [0, 13, .8, 10], [7, 17, 12, .8], [7, 17, .8, 6]].entries()) a.add(`maze-labyrinth-wall-${i}`, x, 0, z, w, 2.52, d, i % 2 ? '#82978d' : '#a1aa92');
  for (const [i, [x, z]] of [[-38, -18], [-35, 15], [36, -12], [33, 15], [-23, -37], [19, -39], [-20, 36], [23, 35]].entries()) a.add(`maze-archive-plinth-${i}`, x, 0, z, 2.8, .84, 1.8, '#abb49c');
  // Low archive blocks and broken, narrow screens create readable dog-legs in
  // the outer paths, rather than repeating the central labyrinth wall pattern.
  for (const [name, x, z, w, h, d, color] of [
    ['north-record-plinth', 4, -34, 3.6, .84, 1.8, '#abb59c'],
    ['north-carved-screen', 8, -30, 3, 1.9, .65, '#879b90'],
    ['east-fallen-records', 34, -1, 2.2, .68, 2.2, '#a3ad93'],
    ['east-archive-screen', 37, 3, 3, 1.9, .65, '#849a8c'],
    ['south-library-plinth', 22, 30, 3.6, .84, 1.8, '#b1b99f'],
    ['south-carved-screen', 20, 26, 3, 1.9, .65, '#8b9f90'],
    ['west-rooted-records', -24, -28, 3.6, .68, 1.8, '#9da98f'],
    ['west-archive-screen', -23, -24, 3, 1.9, .65, '#85998c'],
  ]) {
    const id = `maze-sparse-${name}`;
    a.add(id, x, 0, z, w, h, d, color); a.mark(name, 'carved-marker', '', [id]);
  }
  for (const [name, x, z, y] of [['west-high', -10, -17, height], ['east-high', 21, -17, height], ['record-high', 19, 11, height], ['root-high', -28, 6, height], ['south-link-high', 5, 8, height]]) a.cache(name, x, z, 'weapon', y);
  for (const [i, [x, z]] of [[-39, -22], [-37, -6], [-36, 19], [-35, 42], [40, -24], [39, -8], [41, 8], [43, 20], [-24, -41], [-4, -42], [9, -40], [24, -38], [-23, 40], [-9, 37], [20, 41], [28, 38], [-10, -6], [0, -9], [9, -8], [-5, 15], [3, 13], [14, 21]].entries()) a.cache(`archive-cache-${i}`, x, z, ['weapon', 'ammo', 'heal', 'weapon', 'grenade'][i % 5]);
  for (const [name, x, z] of [['Western archive', -35, -29], ['Echo library', 35, 21], ['Observatory court', 0, 0], ['Rooted gallery', -28, 17]]) a.district(name, x, z);
  a.mark('Observatory bridges', 'broken-archive', 'OBSERVATORY', floors); a.ground('maze-court-mosaic', -7, -2, 14, 4, '#839c8b'); a.ground('archive-approach', -43, 19, 14, 7, '#8c9b80');
  return a.finish();
}

function desert() {
  const a = author('desert', 'Dunes of Anubis', 'An enormous columned temple encloses a terraced pyramid. Fight through the shaded lower colonnades, cross the continuous second-storey ceremonial halls, or climb the exposed pyramid summit. Outer tombs, scribe chambers and broken gates give close-range flanks to the long upper sightlines.', '#d9bd86', '#e9d4b5', '#c9a572', 'sandstone', [0, 12]);
  for (const [name, x, z, w, d] of [['buried-tomb', -41, -39, 12, 10], ['eastern-tomb', 28, -40, 13, 8], ['west-scribe-room', -40, -12, 9, 12], ['southern-tomb', -40, 29, 13, 10], ['caravan-archive', 29, 25, 11, 14], ['north-offering-room', -5, -41, 12, 7]]) a.room(name, x, z, w, d);
  const top = 3.36, halls = [a.deck('temple-northern-hall', -22, -25, 44, 9, top, '#cfad79', 'sandstone', false), a.deck('temple-west-colonnade', -22, -16, 6, 32, top, '#cfad79', 'sandstone', false), a.deck('temple-east-colonnade', 16, -16, 6, 32, top, '#cfad79', 'sandstone', false), a.deck('temple-southern-hall', -22, 16, 44, 6, top, '#cfad79', 'sandstone', false)];
  for (const [i, [x, z]] of [[-21.5, -24.5], [-13, -24.5], [-4.5, -24.5], [4, -24.5], [12.5, -24.5], [20.5, -24.5], [-21.5, -15], [-21.5, -8], [-21.5, -1], [-21.5, 7], [-21.5, 15], [20.5, -15], [20.5, -8], [20.5, -1], [20.5, 7], [20.5, 15], [-21.5, 20.5], [-6, 20.5], [5, 20.5], [20.5, 20.5]].entries()) a.add(`temple-column-${i}`, x, 0, z, 1, top - .3, 1, '#b58e5c');
  const approaches = [a.stairs('temple-north-processional-rise', 'z', 0, -25, 1, halls[0], top), a.stairs('temple-west-processional-rise', 'x', 4, -22, 1, halls[1], top), a.stairs('temple-east-processional-rise', 'x', -5, 22, -1, halls[2], top), a.stairs('temple-south-processional-rise', 'z', -10, 22, -1, halls[3], top)];
  a.level('Ceremonial second storey', halls, approaches, [[-18.5, 4], [18.5, -5], [0, -20]], [[0, -20, top], [-19, -20, top], [-19, 18.5, top], [19, 18.5, top], [19, -20, top], [0, -20, top]]);
  for (const [i, [x, z]] of [[-21.5, -24.5], [20.5, -24.5], [-21.5, 15], [20.5, 15]].entries()) a.add(`temple-upper-column-${i}`, x, top, z, 1, 2.35, 1, '#b58e5c');
  for (const [i, [x, z, w, d]] of [[-21.5, -21, .85, 3], [20.65, -21, .85, 3], [-15, 20.7, 3, .8], [9, 20.7, 3, .8]].entries()) a.add(`temple-carved-balustrade-${i}`, x, top, z, w, 1.1, d, '#b99360');
  const tiers = [];
  for (let i = 0; i < 5; i++) tiers.push(a.add(`pyramid-tier-${i + 1}`, -6 + i * 1.2, 0, -2 + i * 1.2, 12 - i * 2.4, .84 * (i + 1), 12 - i * 2.4, i % 2 ? '#d5b176' : '#cda46a'));
  for (const [side, start, steps] of [['south', point(0, 11.7), tiers.map((tier, i) => freeze({ colliderId: tier.id, x: 0, z: i === 4 ? 4 : 9.4 - i * 1.2 }))], ['west', point(-7.7, 4), tiers.map((tier, i) => freeze({ colliderId: tier.id, x: i === 4 ? 0 : -5.4 + i * 1.2, z: 4 }))]]) a.route({ id: `pyramid-${side}`, name: `Pyramid / ${side} terraces`, role: 'mid', start, steps });
  for (const [i, [x, z]] of [[-38, 11], [33, 11], [-24, -39], [21, -39], [-18, 35], [18, 35], [-37, 21], [36, -21]].entries()) a.add(`desert-caravan-supply-${i}`, x, 0, z, 2.2, .84, 1.8, '#a88350', 'wood');
  for (const [i, [x, z]] of [[-11, -8], [9.6, -8], [-10, 12], [8.6, 12]].entries()) a.add(`desert-obelisk-${i}`, x, 0, z, 1.4, 4.5, 1.4, '#ad8958');
  // The southern caravan halt and the outer shrine approaches are distinct
  // scavenging stops, with supplies to vault and carved stone to fight around.
  // None of them occupies the temple stairs or the exposed pyramid terraces.
  for (const [name, x, z, w, h, d, color, material, kind] of [
    ['south-caravan-pallet', 0, 35, 4, .84, 1.8, '#a98855', 'wood', 'caravan-supplies'],
    ['south-shrine-screen', 5, 31, 3.2, 1.8, .7, '#c3a16d', 'sandstone', 'carved-marker'],
    ['east-fallen-column', 35, -2, 4, .72, 1.8, '#d0af7c', 'sandstone', 'carved-marker'],
    ['east-shrine-plinth', 39, 2, 2.2, 1.8, 2.2, '#b58e59', 'sandstone', 'carved-marker'],
    ['west-caravan-pallet', -27, 13, 4, .84, 1.8, '#977543', 'wood', 'caravan-supplies'],
    ['west-shrine-screen', -25, 17, 3.2, 1.8, .7, '#c8a777', 'sandstone', 'carved-marker'],
    ['north-fallen-column', -14, -31, 3.6, .72, 1.8, '#cdb080', 'sandstone', 'carved-marker'],
    ['north-shrine-plinth', -17, -35, 2.2, 1.8, 2.2, '#b89262', 'sandstone', 'carved-marker'],
  ]) {
    const id = `desert-sparse-${name}`;
    a.add(id, x, 0, z, w, h, d, color, material); a.mark(name, kind, '', [id]);
  }
  for (const [name, x, z, y] of [['north-high', 0, -20, top], ['west-high', -19, 4, top], ['east-high', 19, -5, top], ['south-high', -10, 18.5, top], ['pyramid-summit', 0, 4, 4.2]]) a.cache(name, x, z, 'weapon', y);
  for (const [i, [x, z]] of [[-39, -22], [-37, 4], [-35, 18], [-35, 42], [40, -24], [39, -8], [41, 8], [43, 20], [-23, -41], [-11, -38], [13, -40], [24, -35], [-23, 40], [-9, 37], [15, 41], [24, 38], [-9, -3], [9, 2], [-8, 9], [8, 9], [0, 13], [0, -15]].entries()) a.cache(`ruin-cache-${i}`, x, z, ['weapon', 'heal', 'ammo', 'weapon', 'grenade'][i % 5]);
  for (const [name, x, z] of [['Buried tomb', -35, -25], ['Sun temple', 0, -20], ['Pyramid court', 0, 12], ['Caravan archive', 34, 21]]) a.district(name, x, z);
  a.mark('Sun temple', 'broken-arcade', 'SUN TEMPLE', halls); a.mark('Terraced pyramid', 'pyramid', 'PYRAMID', tiers.map(box => box.id));
  a.ground('temple-court', -16, -16, 32, 32, '#c9ab78'); a.ground('processional-way', -2, -44, 4, 18, '#c5a473');
  return a.finish();
}

export const AUTHORED_ROYALE_MAPS = freeze({ forest: forest(), maze: maze(), desert: desert() });
