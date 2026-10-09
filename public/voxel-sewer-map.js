/** Brick collectors are carved as a connected network, rather than rooms in an open yard. */
const freeze = Object.freeze;
const point = (x, z, y = 0) => freeze({ x, y, z });
const box = (id, x, y, z, w, h, d, color, material, extra = {}) => freeze({ id, x, y, z, w, h, d, color, material, ...extra });
const inside = (r, x, z) => x > r.x - 1e-8 && x < r.x + r.w + 1e-8 && z > r.z - 1e-8 && z < r.z + r.d + 1e-8;

/** Merge grid strips into a small exact rectangular partition of the selected region. */
function partition(bounds, regions, selected) {
  const xs = [...new Set([bounds.minX, bounds.maxX, ...regions.flatMap(r => [r.x, r.x + r.w])])].sort((a, b) => a - b);
  const zs = [...new Set([bounds.minZ, bounds.maxZ, ...regions.flatMap(r => [r.z, r.z + r.d])])].sort((a, b) => a - b);
  const result = [], active = new Map();
  for (let j = 0; j < zs.length - 1; j++) {
    const present = new Set();
    for (let i = 0; i < xs.length - 1;) {
      const z = (zs[j] + zs[j + 1]) / 2, x = (xs[i] + xs[i + 1]) / 2;
      if (!selected(x, z)) { i++; continue; }
      const start = i++;
      while (i < xs.length - 1 && selected((xs[i] + xs[i + 1]) / 2, z)) i++;
      const key = `${xs[start]}:${xs[i]}`, previous = active.get(key); present.add(key);
      if (previous && Math.abs(previous.z + previous.d - zs[j]) < 1e-7) previous.d += zs[j + 1] - zs[j];
      else { const r = { x: xs[start], z: zs[j], w: xs[i] - xs[start], d: zs[j + 1] - zs[j] }; result.push(r); active.set(key, r); }
    }
    for (const key of active.keys()) if (!present.has(key)) active.delete(key);
  }
  return result;
}

export function createSewerMap(mode = 'breach') {
  if (mode !== 'breach' && mode !== 'royale') throw new TypeError('Sewer mode must be breach or royale');
  const royale = mode === 'royale', sx = royale ? 1.28 : 1, sz = royale ? 1.45 : 1, halfW = royale ? 32 : 25, halfD = royale ? 32 : 22;
  const bounds = freeze({ minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD });
  const P = (x, z, y = 0) => point(x * sx, z * sz, y);
  const R = (id, x, z, w, d, height = 3.4) => ({ id, x: x * sx, z: z * sz, w: w * sx, d: d * sz, height });
  const chambers = [R('pump-hall', -9, -8.5, 18, 17, 7.2), R('north-entry', -6, -21, 12, 6, 5.6), R('south-entry', -6, 15, 12, 6, 5.6),
    R('filter-basin', -19, -18, 11, 8, 7.2), R('settling-basin', 8, 10, 11, 8, 7.2),
    R('valve-control', 8, -20, 10, 6, 6.6), R('maintenance-control', -18, 14, 10, 6, 6.6)];
  const collectors = [R('north-collector', -3, -15, 6, 6.5), R('south-collector', -3, 8.5, 6, 6.5),
    R('west-loop', -22, -15, 5, 30), R('east-loop', 17, -15, 5, 30),
    R('north-crossing', -22, -13.5, 44, 4), R('south-crossing', -22, 9.5, 44, 4),
    R('west-pump-access', -17, -2.5, 8, 5), R('east-pump-access', 9, -2.5, 8, 5),
    R('valve-passage', 11, -14, 4, 4.5), R('valve-bypass', 17, -17, 5, 3.5), R('maintenance-passage', -15, 9.5, 4, 4.5)];
  const walkspaces = [...chambers, ...collectors], colliders = [], landmarks = [], decorations = [], ceilings = [], routes = [], tunnels = [];
  const add = collider => { colliders.push(collider); if (collider.overhead) ceilings.push(collider.id); return collider; };
  const solid = (id, x, y, z, w, h, d, color = '#61655b', material = 'sewer-brick', extra = {}) => add(box(id, x * sx, y, z * sz, w * sx, h, d * sz, color, material, extra));
  const mark = (kind, solids, label, extra = {}) => {
    const first = solids[0]; landmarks.push(freeze({ kind, ...first, label, collisionIds: freeze(solids.map(c => c.id)), colliderIds: freeze(solids.map(c => c.id)), ...extra }));
  };
  const paint = (kind, x, z, w, d, color, extra = {}) => decorations.push(freeze({ kind, x: x * sx, z: z * sz, w: w * sx, d: d * sz, color, ...extra }));

  // The uncarved rock is genuinely solid. Walls follow every bend and alcove;
  // there is no empty exterior courtyard hiding behind decorative tunnel pieces.
  for (const [index, r] of partition(bounds, walkspaces, (x, z) => !walkspaces.some(value => inside(value, x, z))).entries())
    add(box(`sewers-rock-${index}`, r.x, 0, r.z, r.w, 7.6, r.d, '#62675c', 'sewer-brick'));
  const prefix = royale ? 'boundary' : 'wall';
  solid(`${prefix}-west`, -halfW / sx - .8 / sx, 0, -halfD / sz, .8 / sx, 8, 2 * halfD / sz);
  solid(`${prefix}-east`, halfW / sx, 0, -halfD / sz, .8 / sx, 8, 2 * halfD / sz);
  solid(`${prefix}-north`, -halfW / sx, 0, -halfD / sz - .8 / sz, 2 * halfW / sx, 8, .8 / sz);
  solid(`${prefix}-south`, -halfW / sx, 0, halfD / sz, 2 * halfW / sx, 8, .8 / sz);

  for (const room of chambers) {
    const roof = add(box(`sewers-${room.id}-ceiling`, room.x, room.height, room.z, room.w, .32, room.d, '#454d43', 'sewer-ceiling', { overhead: true }));
    paint('chamber-floor', room.x / sx, room.z / sz, room.w / sx, room.d / sz, '#696b5e');
    mark('chamber', [roof], room.id.replaceAll('-', ' '));
  }
  const lowRoofs = partition(bounds, walkspaces, (x, z) => collectors.some(r => inside(r, x, z)) && !chambers.some(r => inside(r, x, z)));
  for (const [index, r] of lowRoofs.entries()) add(box(`sewers-collector-roof-${index}`, r.x, 3.4, r.z, r.w, .32, r.d, '#575f4f', 'sewer-roof', { overhead: true }));
  // Vault-to-collector bulkheads close the space above the low entrances. A
  // gallery jump cannot escape onto the outside of a tunnel's ceiling slab.
  for (const [index, [x, z, w, d]] of [[-9, -2.5, .3, 5], [8.7, -2.5, .3, 5], [-3, -8.5, 6, .3], [-3, 8.2, 6, .3]].entries())
    solid(`sewers-pump-portal-bulkhead-${index}`, x, 3.4, z, w, 3.8, d, '#5a6152', 'sewer-brick', { overhead: true });

  // Side banks and wet channel surfaces share the engine's ground at exactly
  // y=0. Bridge decks also end at y=0: visual drainage never creates a hidden step.
  for (const corridor of collectors) {
    const x = corridor.x / sx, z = corridor.z / sz, w = corridor.w / sx, d = corridor.d / sz, alongZ = d > w;
    paint('maintenance-bank', x, z, w, d, '#858272');
    const channel = solid(`sewers-${corridor.id}-water`, alongZ ? x + w / 2 - .75 : x, -.16, alongZ ? z : z + d / 2 - .75,
      alongZ ? 1.5 : w, .16, alongZ ? d : 1.5, '#394c35', 'water');
    mark('water-channel', [channel], corridor.id, { axis: alongZ ? 'z' : 'x' });
    paint('water-channel', channel.x / sx, channel.z / sz, channel.w / sx, channel.d / sz, '#394c35', { y: .008 });
  }
  for (const [index, [x, z, w, d]] of [[-2, -12, 4, 1.7], [-2, 10.8, 4, 1.7], [-21.3, -.8, 3.6, 1.6], [17.7, -.8, 3.6, 1.6]].entries()) {
    const bridge = solid(`sewers-crossing-bridge-${index}`, x, -.2, z, w, .2, d, '#656b62', 'metal'); mark('bridge', [bridge], 'Grated crossing');
    paint('bridge-deck', x, z, w, d, '#656b62', { y: .013 });
  }

  const pump = solid('sewers-central-pump', -2.8, 0, -1.7, 5.6, 2.9, 3.4, '#667367', 'metal'); mark('pump', [pump], 'Main lift pump');
  for (const [index, [x, z, width]] of [[-18.25, -16.8, 4], [11.8, 12.2, 5.2]].entries()) {
    const basin = solid(`sewers-treatment-basin-${index}`, x, -.18, z, width, .18, 3.6, '#3e4b32', 'water');
    const rims = [solid(`sewers-basin-${index}-west`, x, 0, z, .35, .65, 3.6, '#7f7a64', 'sewer-brick'),
      solid(`sewers-basin-${index}-east`, x + width - .35, 0, z, .35, .65, 3.6, '#7f7a64', 'sewer-brick')];
    mark('treatment-basin', [basin, ...rims], index ? 'Settling tank' : 'Filter basin');
    paint('water-channel', x + .35, z, width - .7, 3.6, '#3e4b32', { y: .008 });
  }

  // The actual nested AABBs form a voxel octagonal pipe profile, including its
  // lower corners. Artwork must follow these solids rather than a fake cylinder.
  for (const [index, [x, z, length]] of [[-21.8, -5.5, 11], [20.8, -7, 14]].entries()) {
    const pieces = [solid(`sewers-pipe-${index}-lower`, x + .2, .25, z, .6, .25, length, '#8a7a56', 'pipe'),
      solid(`sewers-pipe-${index}-middle`, x, .5, z, 1, .7, length, '#7e7458', 'pipe'),
      solid(`sewers-pipe-${index}-upper`, x + .2, 1.2, z, .6, .25, length, '#93805a', 'pipe')];
    mark('pipe', pieces, index ? 'Pressure return' : 'Storm feed', { axis: 'z' });
  }
  const overheadFeed = [solid('sewers-overhead-feed-lower', -15.55, 2.65, -2.5, .6, .15, 5, '#8a7a56', 'pipe', { overhead: true }),
    solid('sewers-overhead-feed-middle', -15.7, 2.8, -2.5, .9, .4, 5, '#7e7458', 'pipe', { overhead: true }),
    solid('sewers-overhead-feed-upper', -15.55, 3.2, -2.5, .6, .15, 5, '#93805a', 'pipe', { overhead: true })];
  mark('pipe', overheadFeed, 'Overhead storm feed', { axis: 'z', underpass: freeze({ entry: P(-16.4, 0), midpoint: P(-15.25, 0), exit: P(-14.2, 0), height: 2.65 }) });
  for (const [index, [x, z, rx, rz]] of [[16.2, -18.6, 16.2, -16.7], [-14, 16, -11.5, 15.5]].entries()) {
    const panel = solid(`sewers-control-${index}`, x, 0, z, 1.1, 1.55, .55, '#405b53', 'metal'); mark('service-control', [panel], index ? 'Maintenance switchgear' : 'Valve control');
    const pipe = solid(`sewers-control-riser-${index}`, rx, 0, rz, .65, 2.5, 1.25, '#968157', 'pipe'); mark('valve', [pipe], 'Isolation riser');
  }

  // Inspection stairs climb above the pump's two banks. Four independent
  // approaches overlook the junction, rather than climbing generic house roofs.
  for (const [galleryIndex, x] of [-7.2, 7.2].entries()) {
    const galleryId = `sewers-gallery-${galleryIndex}`;
    const deck = solid(galleryId, x - 1.1, 2.96, -1, 2.2, .24, 2, '#758079', 'metal'); mark('maintenance-catwalk', [deck], galleryIndex ? 'East inspection gallery' : 'West inspection gallery');
    for (const [side, sign] of [['north', -1], ['south', 1]]) {
      const steps = [];
      for (let i = 0; i < 3; i++) {
        const z = sign * (6.5 - i * 2.2), id = `${galleryId}-${side}-step-${i + 1}`;
        solid(id, x - 1.1, 0, z - 1.1, 2.2, .8 * (i + 1), 2.2, '#69756b', 'metal');
        steps.push(freeze({ colliderId: id, x: x * sx, z: z * sz }));
      }
      steps.push(freeze({ colliderId: galleryId, x: x * sx, z: sign * .55 * sz }));
      const start = P(x, sign * 8.05);
      routes.push(freeze({ id: `${galleryId}-${side}`, name: `${galleryIndex ? 'East' : 'West'} inspection / ${side} stairs`, side, role: 'mid', start,
        steps: freeze(steps), approach: freeze([start]) }));
    }
  }

  const tunnelSpecs = [ ['north-feed', 0, -14.2, 0, -11.75, 0, -9.3, 6], ['south-feed', 0, 9.3, 0, 11.75, 0, 14.2, 6],
    ['west-drain', -19.5, -7.5, -19.5, 0, -19.5, 7.5, 5], ['east-drain', 19.5, -7.5, 19.5, 0, 19.5, 7.5, 5],
    ['north-junction', -6.5, -11.5, 0, -11.5, 6.5, -11.5, 4], ['south-junction', -6.5, 11.5, 0, 11.5, 6.5, 11.5, 4],
    ['west-pump', -16.3, 0, -13, 0, -9.7, 0, 5], ['east-pump', 9.7, 0, 13, 0, 16.3, 0, 5],
    ['valve-bypass', 21, -15.7, 19.8, -15.7, 18.5, -15.7, 3.5] ];
  for (const [id, ex, ez, mx, mz, xx, xz, width] of tunnelSpecs) {
    const midpoint = P(mx, mz), roof = colliders.find(c => c.material === 'sewer-roof' && inside(c, midpoint.x, midpoint.z));
    if (!roof) throw new Error(`Missing sewer roof at ${id}`);
    tunnels.push(freeze({ id: `sewers-${id}`, roofId: roof.id, height: 3.4, width: width * (ex === xx ? sx : sz), entry: P(ex, ez), midpoint, exit: P(xx, xz), axis: ex === xx ? 'z' : 'x' }));
  }
  // Brick arch springers step inward above a standing player's head. The crown
  // is the real collector roof; both shots and grenades hit the same geometry.
  for (const tunnel of tunnels.filter((_, index) => index < 4 || index >= 6)) {
    const alongZ = tunnel.axis === 'z', center = tunnel.midpoint, width = tunnel.width;
    for (let side = 0; side < 2; side++) for (let band = 0; band < 2; band++) {
      const edge = -width / 2 + band * .42, offset = side ? width / 2 - (band + 1) * .42 : edge;
      const id = `${tunnel.id}-arch-${side}-${band}`, y = band ? 3.02 : 2.65;
      add(box(id, alongZ ? center.x + offset : center.x - .22, y, alongZ ? center.z - .22 : center.z + offset,
        alongZ ? .42 : .44, 3.4 - y, alongZ ? .44 : .42, '#8c8a71', 'sewer-brick', { overhead: true, arch: true }));
    }
  }

  const buildings = chambers.filter(r => r.id.endsWith('control')).map(room => {
    const east = room.id === 'valve-control', doorX = east ? 13 : -13, doorZ = east ? -14 : 14;
    const wallIds = colliders.filter(c => c.id.startsWith('sewers-rock-') && c.x <= room.x + room.w + 1e-7 && c.x + c.w >= room.x - 1e-7
      && c.z <= room.z + room.d + 1e-7 && c.z + c.d >= room.z - 1e-7).map(c => c.id);
    return freeze({ id: `sewers-${room.id}`, name: east ? 'Valve control alcove' : 'Maintenance switch room', roofId: `sewers-${room.id}-ceiling`, wallIds: freeze(wallIds),
      interior: freeze({ minX: room.x, maxX: room.x + room.w, minZ: room.z, maxZ: room.z + room.d }),
      facade: freeze({ x: room.x, z: room.z, w: room.w, d: room.d, wallHeight: room.height, doorWidth: 4 * sx, doorCenterX: doorX * sx, roofY: room.height, accent: '#b99b62' }),
      doorways: freeze([freeze({ x: doorX * sx, z: doorZ * sz, width: 4 * sx, height: 3.4,
        outside: P(doorX, doorZ + (east ? 1 : -1)), inside: P(doorX, doorZ + (east ? -1 : 1)) }),
        ...(east ? [freeze({ x: 18 * sx, z: -14.6 * sz, width: 3 * sz, height: 3.4, axis: 'x', outside: P(19, -14.6), inside: P(17, -14.6) })] : [])]) });
  });
  const common = { id: 'sewers', name: 'Undercity Sewers', theme: 'sewers', mode,
    description: 'A brick drainage network with wet collectors, branching maintenance loops, treatment basins, solid pressure pipes and four upper inspection stairways overlooking a vaulted pump junction.',
    bounds, colliders: freeze(colliders), routes: freeze(routes), buildings: freeze(buildings), landmarks: freeze(landmarks), decorations: freeze(decorations), tunnels: freeze(tunnels),
    ceilings: freeze(ceilings), groundRegions: freeze(walkspaces.map(r => freeze({ x: r.x, z: r.z, w: r.w, d: r.d }))),
    channelRoutes: freeze([freeze({ id: 'sewers-west-bank', points: freeze([P(-18.5, -8), P(-18.5, 0), P(-18.5, 8)]) }),
      freeze({ id: 'sewers-east-bank', points: freeze([P(18.5, -8), P(18.5, 0), P(18.5, 8)]) })]), floorColor: '#55574b', skyColor: '#253129' };
  if (!royale) return freeze({ ...common,
    sites: freeze([freeze({ id: 'A', x: -11.2, z: -15, radius: 2.2 }), freeze({ id: 'B', x: 11, z: -17, radius: 2.2 })]),
    spawns: freeze([freeze([-2, 0, 2].map(x => freeze({ x, z: 19, yaw: 0 }))), freeze([2, 0, -2].map(x => freeze({ x, z: -19, yaw: Math.PI })))]),
    groundRoutes: freeze([
      freeze({ id: 'sewers-a-west', siteId: 'A', name: 'A / west collector flank', start: P(0, 19), waypoints: freeze([P(0, 11.5), P(-19.5, 11.5), P(-19.5, 0), P(-19.5, -11.5), P(-11.2, -11.5), P(-11.2, -15)]) }),
      freeze({ id: 'sewers-a-east', siteId: 'A', name: 'A / pump rotation', start: P(0, 19), waypoints: freeze([P(0, 7), P(4.5, 7), P(4.5, -7), P(0, -7), P(0, -11.5), P(-11.2, -11.5), P(-11.2, -15)]) }),
      freeze({ id: 'sewers-b-east', siteId: 'B', name: 'B / east collector flank', start: P(0, 19), waypoints: freeze([P(0, 11.5), P(19.5, 11.5), P(19.5, 0), P(19.5, -11.5), P(19.5, -14.6), P(13, -14.6), P(11, -14.6), P(11, -17)]) }),
      freeze({ id: 'sewers-b-west', siteId: 'B', name: 'B / pump rotation', start: P(0, 19), waypoints: freeze([P(0, 7), P(-4.5, 7), P(-4.5, -7), P(0, -7), P(0, -11.5), P(13, -11.5), P(13, -15), P(11, -15), P(11, -17)]) }),
    ]) });
  const spawnCoordinates = [[-3.3, -19], [3.3, -19], [-3.3, 19], [3.3, 19],
    [-19.5, -12], [-19.5, 0], [-19.5, 12], [19.5, -12], [19.5, 0], [19.5, 12],
    [-11, -16], [9.5, 16], [10, -18], [-10, 18], [-4.5, -6], [4.5, 6]];
  const lootCoordinates = [[-4.5,-19],[0,-19],[4.5,-19],[-4.5,19],[0,19],[4.5,19],[-19.5,-12],[-19.5,-7],[-19.5,0],[-19.5,7],[-19.5,12],
    [19.5,-12],[19.5,-7],[19.5,0],[19.5,7],[19.5,12],[-12,-11.5],[-6,-11.5],[0,-11.5],[6,-11.5],[12,-11.5],
    [-12,11.5],[-6,11.5],[0,11.5],[6,11.5],[12,11.5],[-4.5,-6],[4.5,-6],[-4.5,6],[4.5,6],[-13,0],[13,0],
    [-9.5,-16],[-17,-11],[-17,-17],[9.5,16],[17,11],[17,17],[9.5,-18],[14.5,-18],[16,-15.2],[-9.5,18],[-16,18],[-16,15.2]];
  const kinds = ['weapon', 'heal', 'ammo', 'grenade'];
  const lootPoints = lootCoordinates.map(([x, z], index) => freeze({ id: `sewers-cache-${index}`, ...P(x, z), kind: kinds[index % kinds.length] }));
  for (const [index, route] of routes.filter(r => r.side === 'north').entries()) {
    const last = route.steps.at(-1); lootPoints.push(freeze({ id: `sewers-gallery-cache-${index}`, x: last.x, y: 3.2, z: 0, kind: index ? 'heal' : 'weapon' }));
  }
  return freeze({ ...common, sites: freeze([]), spawnPoints: freeze(spawnCoordinates.map(([x, z]) => freeze({ ...P(x, z), yaw: Math.atan2(-x, z) }))),
    lootPoints: freeze(lootPoints), stormCenter: P(4.5, 0) });
}
