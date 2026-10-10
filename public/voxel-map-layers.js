/** Authored second-floor links and solid cover, shared by rendering, combat and navigation. */
const freeze = Object.freeze;
const point = (x, z, y = 0) => freeze({ x, y, z });
const box = (id, x, y, z, w, h, d, color, material = 'metal') => freeze({ id, x, y, z, w, h, d, color, material });

export function addCombatLayers(arena) {
  if (arena.upperFloors) return arena;
  // These three builders author their own indoor galleries and equipment cover.
  if (['snow', 'sewers', 'trading'].includes(arena.id)) return arena;
  const added = [], floors = [], routes = [], coverIds = [], landmarks = [];
  const solid = value => { added.push(value); return value; };
  const cover = (id, x, y, z, w, h, d, color, material = 'metal') => {
    const value = solid(box(id, x, y, z, w, h, d, color, material)); coverIds.push(value.id); return value;
  };
  const floor = (id, name, colliderIds, routeIds, underpasses, traverse) => floors.push(freeze({ id, name,
    colliderIds: freeze(colliderIds), routeIds: freeze(routeIds), underpasses: freeze(underpasses.map(p => point(p[0], p[1]))),
    traverse: freeze(traverse.map(p => point(p[0], p[1], p[2]))) }));
  function gallery(id, x, z, w, d, top, color, material, posts = 'west') {
    solid(box(id, x, top - .3, z, w, .3, d, color, material));
    const edgeX = posts === 'east' ? x + w - .55 : x;
    for (const [index, edgeZ] of [z, z + d - .55].entries())
      solid(box(`${id}-column-${index}`, edgeX, 0, edgeZ, .55, top - .3, .55, color, material));
    return id;
  }
  function stair(id, name, axis, offset, edge, direction, floorId, top, side = 'south') {
    const count = 3, steps = [];
    for (let index = 0; index < count; index++) {
      const distance = edge - direction * (5.5 - index * 2.2);
      const x = axis === 'x' ? distance : offset, z = axis === 'z' ? distance : offset;
      const colliderId = `${id}-step-${index + 1}`;
      solid(box(colliderId, x - 1.1, 0, z - 1.1, 2.2, top / 4 * (index + 1), 2.2,
        arena.id === 'forest' ? '#a38a5c' : arena.id === 'desert' ? '#c5a578' : '#85988a', arena.id === 'forest' ? 'wood' : 'stone'));
      steps.push(freeze({ colliderId, x, z }));
    }
    const landing = edge + direction * .7, start = edge - direction * 7.2;
    steps.push(freeze({ colliderId: floorId, x: axis === 'x' ? landing : offset, z: axis === 'z' ? landing : offset }));
    const origin = point(axis === 'x' ? start : offset, axis === 'z' ? start : offset);
    routes.push(freeze({ id, name, side, role: 'flank', start: origin, approach: freeze([origin]), steps: freeze(steps) }));
  }

  if (arena.id === 'courtyard') {
    for (const [side, x, pathX, tint] of [['west', -16, -13, '#a79a80'], ['east', 11.56, 13, '#a9b19b']]) {
      const id = `court-${side}-garden-gallery`;
      // The inward lip fills the arcade's concave corner, while stopping .56 m
      // short of the adjacent stair centre so the larger hounds can still jump.
      gallery(id, x, -4, 4.44, 5, 3.2, tint, 'stone', side);
      cover(`${id}-balustrade`, side === 'west' ? x + .15 : x + 2.85, 3.2, -2.7, 1, 1.1, 1.7, tint, 'stone');
      cover(`${id}-garden-wall`, side === 'west' ? x + .2 : x + 2.2, 0, -2.8, 1.6, 1.15, .7, '#879575', 'stone');
      floor(id, `${side} garden loggia`, [id, `${side}-arcade`], [`court-${side}-south`, `court-${side}-north`],
        [[pathX, -1.6]], [[pathX, .2, 3.2], [pathX, -1.6, 3.2]]);
    }
    cover('court-south-fountain-screen', 5.6, 0, 10.5, 3.2, 1.45, .8, '#ad9c81', 'stone');
    cover('court-north-garden-screen', -8.2, 0, -9, 2.8, 1.45, .8, '#929f7e', 'stone');
  } else if (arena.id === 'depot') {
    for (const [side, x, pathX, z, tint] of [['west', -20, -17.4, -1, '#4b737e'], ['east', 16, 17.4, -6, '#916a54']]) {
      const id = `depot-${side}-loading-gallery`;
      gallery(id, x, z, 4, 7, 3.2, tint, 'metal', side);
      cover(`${id}-cargo-screen`, side === 'west' ? x + .1 : x + 2.9, 3.2, z + 2, 1, 1.15, 2, tint);
      cover(`${id}-ground-cargo`, side === 'west' ? x + .2 : x + 2.2, 0, z + 3.9, 1.6, 1.35, 1.2, '#a68a58', 'wood');
      floor(id, `${side} loading gantry`, [id, `${side}-container`], [`depot-${side}-south`, `depot-${side}-north`],
        [[pathX, z + 2]], [[pathX, z + .8, 3.2], [pathX, z + 2.8, 3.2]]);
    }
    cover('depot-south-freight-screen', 11.5, 0, 13.5, 3, 1.55, 1.4, '#638089');
    cover('depot-north-freight-screen', -15.8, 0, -9.5, 3, 1.55, 1.4, '#936f53');
  } else if (arena.id === 'canal') {
    for (const [side, x, pathX, z, tint] of [['west', -20, -17.4, -2, '#bba27c'], ['east', 16, 17.4, 4, '#b29b7b']]) {
      const id = `canal-${side}-waterside-gallery`;
      gallery(id, x, z, 4, 3, 3.2, tint, 'stone', side);
      cover(`${id}-balustrade`, side === 'west' ? x + .1 : x + 2.9, 3.2, z + .65, 1, 1.1, 1.6, '#8e9b83', 'stone');
      cover(`${id}-flower-planter`, side === 'west' ? x + .2 : x + 2, 0, z + .2, 1.8, 1.2, .65, '#889b78', 'stone');
      floor(id, `${side} canal market balcony`, [id, `${side}-market`], [`canal-${side}-south`, `canal-${side}-north`],
        [[pathX, z + 1.9]], [[pathX, z + .75, 3.2], [pathX, z + 2.1, 3.2]]);
    }
    cover('canal-north-lock-screen', -5.8, 0, -12, 1.8, 1.5, 2.2, '#6c8388');
    cover('canal-south-lock-screen', 4, 0, 11.3, 1.8, 1.5, 2.2, '#6c8388');
  } else if (arena.id === 'rooftops') {
    solid(box('roofline-west-bridge-shoulder', -9, 2.9, -3, 1.5, .3, 1.9, '#657d83'));
    solid(box('roofline-east-bridge-shoulder', 7.5, 2.9, -3, 1.5, .3, 1.9, '#657d83'));
    cover('roofline-west-parapet', -14.5, 3.2, -3.85, 2.4, 1.05, .6, '#728e8c', 'concrete');
    cover('roofline-east-parapet', 11.8, 3.2, -3.85, 1.2, 1.05, .6, '#9b927d', 'concrete');
    cover('roofline-west-ground-service', -15.8, 0, -2.5, 1.6, 1.35, 1.2, '#6b8686');
    cover('roofline-east-ground-service', 14.2, 0, -2.5, 1.6, 1.35, 1.2, '#9b967f');
    cover('roofline-south-service-screen', 5.5, 0, 12.2, 3, 1.5, .8, '#788d89');
    cover('roofline-north-service-screen', -8.5, 0, -14.4, 3, 1.5, .8, '#788d89');
    floor('roofline-service-circuit', 'Service roofs and bridges', ['roofline-west-roof', 'roofline-east-roof', 'roofline-west-bridge', 'roofline-east-bridge', 'roofline-west-bridge-shoulder', 'roofline-east-bridge-shoulder'],
      ['roofline-west-south', 'roofline-west-north'], [[-13, -1]], [[-13, -2.2, 3.2], [-11.2, -.7, 3.2]]);
  } else if (arena.id === 'foundry' || arena.id === 'bastion') {
    const industrial = arena.id === 'foundry', prefix = industrial ? 'foundry' : 'bastion';
    for (const [side, x, pathX, z, d, tint] of industrial
      ? [['west', -20, -18.2, -3, 6, '#617984'], ['east', 17, 18.2, 2, 6, '#8e745c']]
      : [['west', -20, -18.2, -3, 4, '#87988b'], ['east', 17, 18.2, -3, 4, '#a49e81']]) {
      const id = `${prefix}-${side}-outer-gallery`, material = industrial ? 'metal' : 'stone';
      gallery(id, x, z, 3, d, 3.2, tint, material, side);
      cover(`${id}-upper-screen`, side === 'west' ? x + .1 : x + 1.95, 3.2, z + .85, .95, 1.15, 1.65, tint, material);
      cover(`${id}-ground-screen`, side === 'west' ? x + .1 : x + 1.45, 0, z + .25, 1.35, 1.35, .8, tint, material);
      floor(id, `${side} ${industrial ? 'inspection gantry' : 'outer battlement'}`,
        [id, industrial ? `foundry-${side}-gallery` : `bastion-${side}-wall`], [`${prefix}-${side}-south`, `${prefix}-${side}-north`],
        [[pathX, z + d - 1]], [[pathX, z + .65, 3.2], [pathX, z + d - .65, 3.2]]);
    }
    cover(`${prefix}-south-rotation-screen`, 5.7, 0, 13, 2.7, 1.45, 1, industrial ? '#8a795d' : '#8c9a81', industrial ? 'metal' : 'stone');
    cover(`${prefix}-north-rotation-screen`, -8.4, 0, -10.4, 2.7, 1.45, 1, industrial ? '#8a795d' : '#8c9a81', industrial ? 'metal' : 'stone');
  } else if (arena.id === 'paris') {
    const royale = arena.bounds.maxX > 25, left = royale ? -24 : -18, right = royale ? 15 : 10, width = royale ? 9 : 8;
    const northEnd = royale ? -11 : -4, southEdge = royale ? 11 : 4;
    for (const [side, x, pathX, homes] of [['west', left, left + 2.2, ['opera', 'cafe']], ['east', right + width - 3, right + width - 2.2, ['atelier', 'librairie']]]) {
      const id = `paris-${side}-arcade-balcony`, depth = southEdge - northEnd;
      gallery(id, x, northEnd, 3, depth, 4, '#b6a68c', 'stone', side);
      if (royale) for (const [index, z] of [-5, 5].entries())
        solid(box(`${id}-pier-${index}`, side === 'west' ? x : x + 2.45, 0, z, .55, 3.7, .55, '#b7a992', 'stone'));
      cover(`${id}-balcony-planter`, side === 'west' ? x + .1 : x + 1.9, 4, -.9, 1, 1.1, 1.8, '#768b6b', 'stone');
      floor(id, `${side} boulevard balcony circuit`, [id, ...homes.map(home => `paris-${home}-roof`)],
        homes.flatMap(home => [`paris-${home}-outer`, `paris-${home}-inner`]), [[pathX, 2.8]],
        [[pathX, northEnd + .8, 4], [pathX, 2.5, 4], [pathX, southEdge - .8, 4]]);
    }
    cover('paris-west-street-planter', left + width - 2.1, 0, 2.1, 1.25, 1.35, .9, '#7a8e70', 'stone');
    cover('paris-east-street-planter', right + .8, 0, -3.3, 1.25, 1.35, .9, '#7a8e70', 'stone');
    cover('paris-boulevard-delivery-cart', -7.2, 0, royale ? 5.7 : 12.8, 1.7, 1.4, 1.4, '#a5865c', 'wood');
    cover('paris-boulevard-ticket-screen', 5.5, 0, royale ? -4.5 : -12.8, 1.7, 1.65, 1.2, '#527b79', 'metal');
  } else if (arena.id === 'forest') {
    gallery('forest-ranger-balcony', -7.5, -3, 4, 6, 3.36, '#8b7954', 'wood');
    cover('forest-ranger-balcony-timber', -7.3, 3.36, -.3, 1, 1.1, 1.7, '#9c8256', 'wood');
    cover('forest-under-balcony-logs', -7.15, 0, 1.9, 1.3, 1.3, .8, '#826742', 'wood');
    stair('forest-ranger-south-risers', 'Ranger lookout / southern timber risers', 'z', 0, 3, -1, 'ranger-watchtower-deck', 3.36);
    floor('forest-ranger-circuit', 'Ranger canopy lookout', ['ranger-watchtower-deck', 'forest-ranger-balcony'],
      ['ranger-watchtower-climb', 'forest-ranger-south-risers'], [[-4.6, .3]], [[-4.6, -.3, 3.36], [-4.6, 1.7, 3.36]]);
    cover('forest-west-root-bank', -11, 0, 2.8, 2.5, 1.45, 1.2, '#697e61', 'stone');
    cover('forest-east-root-bank', 8.5, 0, -4.3, 2.5, 1.45, 1.2, '#697e61', 'stone');
  } else if (arena.id === 'maze') {
    gallery('maze-north-east-gallery', 3.5, -14, 4.2, 3, 3.36, '#839a8d', 'stone', 'east');
    stair('maze-north-east-risers', 'Northern archive / eastern gallery risers', 'z', 6.6, -11, -1, 'maze-north-east-gallery', 3.36);
    cover('maze-gallery-carved-screen', 6.65, 3.36, -13.8, .8, 1.1, 1, '#a5af98', 'stone');
    cover('maze-under-gallery-screen', 6.1, 0, -13.8, 1.2, 1.45, .6, '#91a08d', 'stone');
    floor('maze-north-archive-circuit', 'Northern archive gallery', ['north-observatory-deck', 'maze-north-east-gallery'],
      ['north-observatory-climb', 'maze-north-east-risers'], [[5, -12.3]], [[4.3, -12.3, 3.36], [6.4, -12.3, 3.36]]);
    cover('maze-west-broken-screen', -6.1, 0, 9.5, 2.2, 1.4, .8, '#909e84', 'stone');
    cover('maze-east-broken-screen', 3.9, 0, -10, 2.2, 1.4, .8, '#909e84', 'stone');
  } else if (arena.id === 'desert') {
    stair('desert-temple-south-risers', 'Sun temple / southern colonnade risers', 'z', -7, -18, -1, 'temple-west-wing', 3.36);
    cover('desert-temple-upper-altar', -9.5, 3.36, -22.8, 1.15, 1.15, 2.1, '#b79261', 'sandstone');
    cover('desert-temple-ground-sarcophagus', -9.25, 0, -22.5, 1.4, 1.4, 2, '#bd9b6f', 'sandstone');
    floor('desert-temple-colonnade', 'Sun temple colonnade', ['sun-temple-deck', 'temple-west-wing', 'temple-east-wing'],
      ['sun-temple-climb', 'desert-temple-south-risers'], [[-6.7, -20.5]], [[-7, -22, 3.36], [-7, -19.2, 3.36]]);
    cover('desert-west-ruined-wall', -10.8, 0, 3.5, 2.2, 1.4, 1.1, '#bc9666', 'sandstone');
    cover('desert-east-ruined-wall', 8.6, 0, -10.5, 2.2, 1.4, 1.1, '#bc9666', 'sandstone');
  } else if (arena.id === 'market' || arena.id === 'lockdown') {
    const market = arena.id === 'market', id = market ? 'market-shop-roof-link' : 'lockdown-north-inspection-link';
    if (market) {
      gallery(id, -8, -4, 16, 2.5, 3.2, '#526b73', 'metal');
      // Posts sit at shop edges, leaving the middle passage and shop doors open.
      added.splice(added.findIndex(value => value.id === `${id}-column-0`), 2);
      solid(box(`${id}-column-west`, -7.8, 0, -3.85, .4, 2.9, .4, '#526b73'));
      solid(box(`${id}-column-east`, 7.4, 0, -3.85, .4, 2.9, .4, '#526b73'));
      cover(`${id}-neon-screen-west`, -4.5, 3.2, -3.8, 1.4, 1.1, .65, '#699d99');
      cover(`${id}-neon-screen-east`, 3.1, 3.2, -3.8, 1.4, 1.1, .65, '#bc9262');
      cover('market-ground-service-counter', -7, 0, 2.8, 1.3, 1.3, .7, '#9e805c', 'wood');
      floor(id, 'Night market roof crossing', [id, 'market-west-shop-roof', 'market-east-shop-roof'],
        ['market-west-shop-north-rise', 'market-east-shop-south-rise'], [[0, -2.5]], [[-6.8, -2.3, 3.2], [6.8, -2.3, 3.2]]);
    } else {
      // Rectangular pieces meet the workshop decks edge to edge. No top faces
      // overlap, so the cross-floor route stays free of coplanar shimmer.
      solid(box(id, -8, 2.9, -6.8, 16, .3, 2.5, '#788b90'));
      solid(box(`${id}-west-wing`, -9.8, 2.9, -6.8, 1.8, .3, 1.8, '#788b90'));
      solid(box(`${id}-east-wing`, 8, 2.9, -6.8, 1.8, .3, 1.8, '#788b90'));
      solid(box(`${id}-column-west`, -7.7, 0, -6.3, .45, 2.9, .45, '#637a80'));
      solid(box(`${id}-column-east`, 7.25, 0, -6.3, .45, 2.9, .45, '#637a80'));
      cover(`${id}-blast-screen-west`, -6, 3.2, -6.7, 1.3, 1.1, .5, '#9d7e54');
      cover(`${id}-blast-screen-east`, 4.7, 3.2, -6.7, 1.3, 1.1, .5, '#9d7e54');
      cover('lockdown-ground-tool-screen', -16.5, 0, 8.5, 1.4, 1.45, 1.8, '#7b8b8b');
      floor(id, 'Furnace inspection crossing', [id, `${id}-west-wing`, `${id}-east-wing`, 'lockdown-west-maintenance-deck', 'lockdown-east-maintenance-deck'],
        ['lockdown-west-south-rise', 'lockdown-east-south-rise'], [[0, -5.3]], [[-8.9, -5.6, 3.2], [8.9, -5.6, 3.2]]);
    }
  } else return arena;

  const colliders = freeze([...arena.colliders, ...added]);
  // A bounded set of authored upper-floor anchors covers narrow seams that a
  // coarse 1.25 m navigation grid can miss. The existing navigation contract
  // seeds these standable approach points, then validates every body and edge.
  const anchorsByRoute = new Map();
  for (const layer of floors) {
    const anchors = [], seen = new Set();
    for (const id of layer.colliderIds) {
      const support = colliders.find(value => value.id === id);
      if (!support || support.w < 1.12 || support.d < 1.12) continue;
      const axis = (start, length) => {
        const coordinates = [start + .56];
        for (let value = start + 1.36; value < start + length - .56; value += .8) coordinates.push(value);
        if (length > 1.12) coordinates.push(start + length - .56);
        return coordinates;
      };
      for (const x of axis(support.x, support.w)) for (const z of axis(support.z, support.d)) {
        const key = `${x.toFixed(5)}:${z.toFixed(5)}:${(support.y + support.h).toFixed(5)}`;
        if (!seen.has(key) && anchors.length < 256) { seen.add(key); anchors.push(point(x, z, support.y + support.h)); }
      }
    }
    for (const id of layer.routeIds) anchorsByRoute.set(id, [...(anchorsByRoute.get(id) || []), ...anchors]);
  }
  const authoredRoutes = freeze([...arena.routes, ...routes].map(route => anchorsByRoute.has(route.id)
    ? freeze({ ...route, approach: freeze([...(route.approach || [route.start]), ...anchorsByRoute.get(route.id)]) }) : route));
  for (const value of added) if (coverIds.includes(value.id)) landmarks.push(freeze({ kind: 'combat-cover', ...value, collisionIds: freeze([value.id]) }));
  return freeze({ ...arena,
    description: `${arena.description} Connected upper galleries and solid ground cover create two-floor flanks with multiple ways up and space to counter from below.`,
    colliders, routes: authoredRoutes,
    landmarks: freeze([...(arena.landmarks || []), ...landmarks]), upperFloors: freeze(floors), coverIds: freeze(coverIds) });
}
