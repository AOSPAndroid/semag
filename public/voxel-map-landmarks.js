/** Map-specific, server-shared landmarks. Every substantial prop is real cover. */
const box = (id, x, y, z, w, h, d, color, material = 'stone') => Object.freeze({ id, x, y, z, w, h, d, color, material });
const paint = (kind, x, z, w, d, color) => Object.freeze({ kind, x, z, w, d, color });
const DESCRIPTIONS = Object.freeze({
  courtyard: 'Twin amber and jade sculptures frame the broken central arcade. Garden planters and two-sided stone climbs create distinct ground and rooftop peeks.',
  depot: 'Blue and rust freight containers divide a marked loading yard. Solid forklifts screen outer loading bays; broad pallet chains lead onto both container roofs.',
  canal: 'A working canal lock separates fish and flower stalls. Market awnings and stone banks protect close rotations beneath climbable market roofs.',
  rooftops: 'A roof water tank and bank of air handlers mark opposing service rooftops. Bridge chains reach the exposed watch deck while walk-under alleys offer fast counters.',
  foundry: 'A blast furnace dominates galleries, induction generators and slag vats. Real machinery cover screens ground rotations; maintenance rises lead to exposed high angles.',
  bastion: 'Twin signal relays crown the battlements above field batteries. Multiple stone rises and walk-under bridges reach a contested command deck.',
  forest: 'Ranger cabins, a trail board and stacked timber surround a climbable woodland lookout. Pine groves and fallen cedars break sightlines; every cabin has two exits.',
  maze: 'Carved waystones and an astrolabe mark broken archive passages. Northern and southern observatories overlook a connected court with several escape routes.',
  desert: 'A five-tier pyramid rises between dawn and dusk obelisks. Loot a columned sun temple and open caravan rooms, then flank through broken gates and fallen columns.',
  paris: 'A Métro marker, newspaper kiosk and café terrace line the bus boulevard. Open stone shops have two exits and two delivery rises to each slate firing roof.',
});

function landmark(id, kind, name, label, colliders, extra = {}) {
  const x = Math.min(...colliders.map(value => value.x)), y = Math.min(...colliders.map(value => value.y)), z = Math.min(...colliders.map(value => value.z));
  const maxX = Math.max(...colliders.map(value => value.x + value.w)), topY = Math.max(...colliders.map(value => value.y + value.h)), maxZ = Math.max(...colliders.map(value => value.z + value.d));
  return Object.freeze({ id, kind, name, label, x, y, z, w: maxX - x, h: topY - y, d: maxZ - z, topY,
    colliderIds: Object.freeze(colliders.map(value => value.id)), ...extra });
}

/** Enrich existing arenas without changing their authored doors, spawns or climbs. */
export function enhanceMapIdentity(arena) {
  const colliders = [], landmarks = [], props = [], decorations = [];
  const solid = (id, kind, name, label, pieces, extra = {}) => {
    const value = landmark(id, kind, name, label, pieces, extra);
    colliders.push(...pieces); landmarks.push(value); props.push(value);
  };
  const existing = (id, kind, name, label, ids, extra = {}) => {
    const pieces = ids.map(id => arena.colliders.find(value => value.id === id)).filter(Boolean);
    if (pieces.length) landmarks.push(landmark(id, kind, name, label, pieces, extra));
  };

  if (arena.id === 'courtyard') {
    for (const [side, x, tint] of [['west', -2.5, '#ab8068'], ['east', 1.3, '#698f89']]) {
      solid(`court-${side}-sculpture`, 'fountain-sculpture', `${side === 'west' ? 'Amber' : 'Jade'} sculpture`, side === 'west' ? 'AMBER' : 'JADE', [
        box(`landmark-court-${side}-plinth`, x, 0, .3, 1.2, .65, 1.4, '#c8b597', 'carved-stone'),
        box(`landmark-court-${side}-statue`, x + .325, .65, .72, .55, 1.18, .55, tint, 'carved-stone'),
        box(`landmark-court-${side}-head`, x + .365, 1.83, .76, .47, .38, .47, tint, 'carved-stone'),
      ]);
    }
    for (const [side, x] of [['west', -23], ['east', 21]]) solid(`court-${side}-garden`, 'stone-planter', `${side} arcade garden`, 'GARDEN', [
      box(`landmark-court-${side}-planter`, x, 0, 8.8, 2, .9, 2.8, '#929d75', 'stone-planter'),
    ]);
    existing('court-broken-arcade', 'broken-arcade', 'Broken central arcade', 'COURT', ['central-north', 'central-west', 'central-east']);
    decorations.push(paint('mosaic', -2.9, -.1, 5.8, 2.8, '#b8a48a'), paint('arcade-path', -24, 10, 48, 1.2, '#b3a184'));
  } else if (arena.id === 'depot') {
    for (const [side, x, z, tint] of [['west', -23.6, 5.5, '#cfa64b'], ['east', 21.1, -7.8, '#b96e48']]) solid(`depot-${side}-forklift`, 'forklift', `${side} loading forklift`, side === 'west' ? 'LOAD A' : 'LOAD B', [
      box(`landmark-depot-${side}-forklift-body`, x, 0, z, 2.5, .75, 3.4, tint, 'vehicle'),
      box(`landmark-depot-${side}-forklift-cab`, x + .3, .75, z + 1.5, 1.9, 1.55, 1.5, '#4c626b', 'vehicle-cab'),
    ]);
    existing('depot-container-yard', 'freight-container', 'Central freight container', 'FREIGHT 03', ['mid-container']);
    existing('depot-west-loading', 'freight-container', 'Blue container lane', 'BLUE LANE', ['west-container']);
    existing('depot-east-loading', 'freight-container', 'Rust container lane', 'RUST LANE', ['east-container']);
    decorations.push(paint('loading-bay', -24, 4.8, 3.7, 4.8, '#75857d'), paint('loading-bay', 20.3, -8.5, 3.7, 4.8, '#877b6c'));
  } else if (arena.id === 'canal') {
    for (const [side, x, z, tint] of [['west', -24, 3.8, '#527f81'], ['east', 20.6, -5.8, '#ba7753']]) solid(`canal-${side}-stall`, 'market-stall', `${side} produce stall`, side === 'west' ? 'POISSON' : 'FLEURS', [
      box(`landmark-canal-${side}-counter`, x, 0, z, 3.4, 1, 1.8, '#aa855d', 'market-counter'),
      box(`landmark-canal-${side}-post-west`, x + .06, 1, z + .10, .16, 1.55, .16, tint, 'wood'),
      box(`landmark-canal-${side}-post-east`, x + 3.18, 1, z + .10, .16, 1.55, .16, tint, 'wood'),
      box(`landmark-canal-${side}-awning`, x, 2.55, z, 3.4, .20, 1.8, tint, 'market-awning'),
    ]);
    existing('canal-lock', 'canal-lock', 'Central lock crossing', 'ECLUSE', ['canal-mid-screen', 'canal-west-bank', 'canal-east-bank']);
    decorations.push(paint('market-paving', -24, 3.4, 3.7, 2.6, '#baa88b'), paint('market-paving', 20.3, -6.2, 3.7, 2.6, '#baa88b'));
  } else if (arena.id === 'rooftops') {
    solid('roofline-water-tank', 'water-tank', 'West roof water tank', 'WATER', [
      box('landmark-roofline-tank-base', -16.5, 3.2, -3.7, 2, .35, 1, '#677e80', 'metal'),
      box('landmark-roofline-tank-body', -16.4, 3.55, -3.65, 1.8, 1.45, .9, '#698d8d', 'water-tank'),
    ]);
    solid('roofline-air-handler', 'hvac', 'East roof air handler', 'AIR', [
      box('landmark-roofline-hvac', 13.5, 3.2, -3.7, 3, .8, 1.05, '#a2a995', 'radiator'),
    ]);
    existing('roofline-watch-deck', 'watch-deck', 'Central watch deck', 'WATCH', ['roofline-watch-deck']);
    decorations.push(paint('service-yard', -24, 8, 4, 7.5, '#94a09a'), paint('service-yard', 20, -15.5, 4, 7.5, '#94a09a'));
  } else if (arena.id === 'foundry') {
    for (const [side, x, z, tint] of [['west', -23.5, -2.5, '#62818b'], ['east', 20.7, 4.5, '#96745a']]) solid(`foundry-${side}-generator`, 'industrial-generator', `${side} induction generator`, side === 'west' ? 'POWER A' : 'POWER B', [
      box(`landmark-foundry-${side}-generator`, x, 0, z, 2.8, 1.7, 3.6, tint, 'radiator'),
    ]);
    for (const [side, x] of [['west', -23.3], ['east', 20.7]]) solid(`foundry-${side}-slag-vat`, 'slag-vat', `${side} slag vat`, 'SLAG', [
      box(`landmark-foundry-${side}-slag-vat`, x, 0, -13.7, 2.6, 1, 2.6, '#796653', 'metal'),
    ]);
    existing('foundry-central-furnace', 'furnace', 'Central blast furnace', 'FURNACE', ['foundry-furnace']);
    decorations.push(paint('hazard-pad', -23.8, -2.8, 3.4, 4.2, '#988c66'), paint('hazard-pad', 20.4, 4.2, 3.4, 4.2, '#988c66'));
  } else if (arena.id === 'bastion') {
    for (const [side, x, tint] of [['west', -16.35, '#6d8b8b'], ['east', 15.15, '#989070']]) solid(`bastion-${side}-signal`, 'signal-array', `${side} signal relay`, side === 'west' ? 'RELAY A' : 'RELAY B', [
      box(`landmark-bastion-${side}-mast`, x + .31, 4.05, -.95, .48, 2.35, .48, '#627777', 'signal-mast'),
      box(`landmark-bastion-${side}-array`, x, 6.4, -1.1, 1.1, .65, .8, tint, 'signal-array'),
    ]);
    for (const [side, x] of [['west', -23.2], ['east', 21]]) solid(`bastion-${side}-battery`, 'signal-battery', `${side} field battery`, 'POWER', [
      box(`landmark-bastion-${side}-battery`, x, 0, 6.4, 2.2, 1.1, 2, '#667a6e', 'metal'),
    ]);
    existing('bastion-command', 'watch-deck', 'Command battlement', 'COMMAND', ['bastion-watch-deck']);
    decorations.push(paint('signal-yard', -23.5, 6.1, 2.8, 2.6, '#839480'), paint('signal-yard', 20.7, 6.1, 2.8, 2.6, '#839480'));
  } else if (arena.id === 'forest') {
    for (const [side, x, z] of [['west', -17.5, 2.3], ['east', 14.3, -3.7]]) solid(`forest-${side}-logging`, 'logging-pile', `${side} logging trail`, 'TIMBER', [
      box(`landmark-forest-${side}-logs`, x, 0, z, 3.2, .95, 2, '#94714a', 'stacked-logs'),
    ]);
    solid('forest-ranger-sign', 'trail-board', 'Ranger trail board', 'RANGER', [
      box('landmark-forest-board-base', -23.2, 0, -.7, 1.5, .3, .6, '#6f674e', 'wood'),
      box('landmark-forest-board-sign', -23.1, .3, -.6, 1.3, 1.8, .4, '#8b9670', 'trail-board'),
    ]);
    existing('forest-ranger-tower', 'watchtower', 'Ranger lookout', 'LOOKOUT', ['ranger-watchtower-deck']);
    existing('forest-west-cedar', 'fallen-log', 'Western fallen cedar', 'CEDAR', ['fallen-cedar-west']);
    existing('forest-east-cedar', 'fallen-log', 'Eastern fallen cedar', 'CEDAR', ['fallen-cedar-east']);
    decorations.push(paint('forest-track', -18, 1.8, 4.2, 3, '#837c59'), paint('forest-track', 13.8, -4.2, 4.2, 3, '#837c59'));
  } else if (arena.id === 'maze') {
    for (const [side, x, z] of [['west', -21.5, -10.4], ['east', 20.3, 8.1]]) solid(`maze-${side}-marker`, 'carved-marker', `${side} archive waystone`, side === 'west' ? 'ARCHIVE' : 'SANCTUM', [
      box(`landmark-maze-${side}-waystone`, x, 0, z, .8, 1.9, .8, '#879d89', 'carved-stone'),
    ]);
    solid('maze-court-astrolabe', 'astrolabe', 'Central astrolabe court', 'COURT', [
      box('landmark-maze-astrolabe-base', -3.6, 0, -1.1, 2.2, .64, 2.2, '#a9b197', 'carved-stone'),
      box('landmark-maze-astrolabe-dial', -3, .64, -.5, 1, .35, 1, '#7f998b', 'carved-stone'),
    ]);
    existing('maze-north-observatory', 'observatory', 'Northern stone observatory', 'NORTH', ['north-observatory-deck']);
    existing('maze-south-observatory', 'observatory', 'Southern stone observatory', 'SOUTH', ['south-observatory-deck']);
    decorations.push(paint('labyrinth-inlay', -2.1, -2.1, 4.2, 4.2, '#8d9b7d'));
  } else if (arena.id === 'desert') {
    for (const [side, x] of [['west', -15.6], ['east', 14.4]]) solid(`desert-${side}-obelisk`, 'carved-obelisk', `${side} sun obelisk`, side === 'west' ? 'DAWN' : 'DUSK', [
      box(`landmark-desert-${side}-obelisk`, x, 0, -19.2, 1.2, 3.5, 1.2, '#bc9561', 'carved-stone'),
    ]);
    for (const [side, x] of [['west', -17.3], ['east', 14.5]]) solid(`desert-${side}-fallen-column`, 'fallen-column', `${side} ruined column`, 'RUINS', [
      box(`landmark-desert-${side}-fallen-column`, x, 0, 8.2, 2.8, .75, 1.2, '#c2a072', 'carved-stone'),
    ]);
    existing('desert-sun-temple', 'sun-temple', 'Columned sun temple', 'TEMPLE', ['sun-temple-deck', 'temple-west-wing', 'temple-east-wing']);
    existing('desert-pyramid', 'pyramid', 'Five-tier Anubis pyramid', 'ANUBIS', ['pyramid-tier-1', 'pyramid-tier-2', 'pyramid-tier-3', 'pyramid-tier-4', 'pyramid-tier-5']);
    decorations.push(paint('temple-causeway', -1.4, -17, 2.8, 9.8, '#c5a471'));
  } else if (arena.id === 'paris') {
    const royale = arena.bounds.maxX > 25, leftX = royale ? -24 : -18;
    solid('paris-metro-marker', 'metro-kiosk', 'Boulevard Métro entrance', 'METRO', [
      box('landmark-paris-metro-base', -8, 0, royale ? -6.4 : -14.2, 1.3, .85, 1.2, '#667c70', 'metal'),
      box('landmark-paris-metro-sign', -7.85, .85, royale ? -6.15 : -13.95, 1, 1.45, .7, '#376e69', 'metro-kiosk'),
    ]);
    solid('paris-newsstand', 'newspaper-stand', 'Arcade newspaper stand', 'PRESSE', [
      box('landmark-paris-newsstand', leftX - 3.3, 0, -7.5, 1.8, 1.75, 1.2, '#47695f', 'newspaper-stand'),
    ]);
    existing('paris-boulevard-bus', 'city-bus', 'Boulevard bus crossing', 'BUS', ['paris-bus-body', 'paris-bus-top']);
    existing('paris-cafe-terrace', 'cafe-terrace', 'Café des Toits terrace', 'CAFE', ['paris-cafe-terrace-table', 'paris-cafe-terrace-screen']);
    existing('paris-bookshop-garden', 'stone-planter', 'Saint-Martin garden', 'LIVRES', ['paris-courtyard-planter', 'paris-courtyard-bench']);
  } else return arena;

  return Object.freeze({ ...arena,
    description: DESCRIPTIONS[arena.id] || arena.description,
    colliders: Object.freeze([...arena.colliders, ...colliders]),
    landmarks: Object.freeze([...(arena.landmarks || []), ...landmarks]),
    props: Object.freeze([...(arena.props || []), ...props]),
    decorations: Object.freeze([...(arena.decorations || []), ...decorations]),
  });
}
