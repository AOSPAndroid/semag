export const WIDTH = 8,
  HEIGHT = 7;
export const DIFFICULTIES = Object.freeze({
  standard: { label: "Standard", damage: 0, hp: 4, deadline: 12, storm: 1 },
  veteran: { label: "Veteran", damage: 1, hp: 0, deadline: 10, storm: 2 },
  nightmare: { label: "Nightmare", damage: 2, hp: -2, deadline: 8, storm: 3 },
});
export const HEROES = Object.freeze({
  warden: {
    name: "Bram · Warden",
    hp: 30,
    damage: 6,
    range: 1,
    skill: "Shove",
    description:
      "Adjacent strike: 6 damage and push one tile. Brace shields nearby allies.",
  },
  ranger: {
    name: "Iris · Ranger",
    hp: 24,
    damage: 5,
    range: 6,
    skill: "Longshot",
    description:
      "Cardinal shot: 5 damage. Cover and the first body stop the arrow.",
  },
  weaver: {
    name: "Nox · Weaver",
    hp: 26,
    damage: 4,
    range: 3,
    skill: "Threadpull",
    description:
      "Cardinal spell: 4 damage and pull one tile. Displacing a foe cancels its intent.",
  },
});
export const RELICS = Object.freeze({
  edge: {
    name: "Tempered edges",
    text: "All attacks deal +1 damage.",
    kind: "damage",
  },
  boots: {
    name: "Wayfinder boots",
    text: "All heroes gain +1 movement each turn.",
    kind: "move",
  },
  bark: {
    name: "Living bark",
    text: "Each hero gains +4 maximum HP and recovers 4 HP.",
    kind: "health",
  },
  veil: {
    name: "Dawn veil",
    text: "Every hero starts each turn with 2 shield; Brace also gains +2 shield.",
    kind: "shield",
  },
  thread: {
    name: "Long thread",
    text: "Weaver range +1; Warden and Weaver collision hits deal +2 damage.",
    kind: "control",
  },
  salve: {
    name: "Field satchel",
    text: "Gain 2 bandages. Mend restores 7 HP instead of 5.",
    kind: "heal",
  },
  beacon: {
    name: "Heartwood core",
    text: "Beacon recovers 5 HP and gains +5 maximum HP.",
    kind: "beacon",
  },
  camp: {
    name: "Make camp",
    text: "Recover 6 HP on every surviving hero and 4 beacon HP. No permanent upgrade.",
    kind: "camp",
  },
});
// Handmade terrain remains identical on a replay; the seed controls reward drafts.
const MISSIONS = [
  {
    name: "The broken causeway",
    biome: "forest",
    rows: [
      "........",
      "..#.....",
      ".....#..",
      "..~..~..",
      "........",
      ".c....c.",
      "...B....",
    ],
    enemies: [
      ["brute", 2, 2],
      ["archer", 6, 1],
      ["brute", 5, 3],
    ],
    note: "Use the river edge. Shoving a foe into water defeats it.",
  },
  {
    name: "Lantern crossing",
    biome: "forest",
    rows: [
      "...#....",
      ".~....~.",
      "..c..c..",
      "........",
      ".W....W.",
      "........",
      "...B....",
    ],
    enemies: [
      ["archer", 1, 1],
      ["bomber", 6, 1],
      ["brute", 3, 3],
      ["brute", 5, 2],
    ],
    wards: true,
    note: "Seal both lantern wards with an adjacent hero action, then clear the crossing.",
  },
  {
    name: "The Thorn Regent",
    biome: "forest",
    rows: [
      "...#....",
      ".~....~.",
      "..c..c..",
      "........",
      "..~..~..",
      "........",
      "...B....",
    ],
    enemies: [
      ["thorn", 3, 1],
      ["archer", 0, 2],
      ["brute", 7, 2],
    ],
    boss: true,
    note: "The Regent marks full rows and columns. Cover stops archers, not royal thorns.",
  },
  {
    name: "Ashworks entry",
    biome: "forge",
    rows: [
      "..#..#..",
      "........",
      ".c.ff.c.",
      "........",
      "..f..f..",
      "........",
      "...B....",
    ],
    enemies: [
      ["brute", 1, 2],
      ["archer", 6, 1],
      ["bomber", 4, 2],
      ["brute", 6, 3],
    ],
    note: "Fire deals 2 damage on entry or when a unit ends its turn there. Push foes into it.",
  },
  {
    name: "The two furnaces",
    biome: "forge",
    rows: [
      "...#....",
      "..f..f..",
      ".c....c.",
      "........",
      ".W....W.",
      ".f....f.",
      "...B....",
    ],
    enemies: [
      ["bomber", 1, 1],
      ["bomber", 6, 1],
      ["archer", 4, 2],
      ["brute", 2, 3],
    ],
    wards: true,
    note: "Seal both furnace vents. Explosions strike a five-tile cross and ignore low cover.",
  },
  {
    name: "The Kiln Marshal",
    biome: "forge",
    rows: [
      "..#..#..",
      "........",
      ".f....f.",
      "..c..c..",
      "..f..f..",
      "........",
      "...B....",
    ],
    enemies: [
      ["kiln", 4, 1],
      ["bomber", 0, 2],
      ["brute", 7, 2],
    ],
    boss: true,
    note: "The Marshal alternates a wide cross and two furnace columns. Displace its escorts.",
  },
  {
    name: "Whiteout pass",
    biome: "frost",
    rows: [
      "..#..#..",
      "........",
      ".c.ss.c.",
      "........",
      "..s..s..",
      "........",
      "...B....",
    ],
    enemies: [
      ["archer", 1, 1],
      ["archer", 6, 1],
      ["brute", 3, 2],
      ["bomber", 5, 3],
    ],
    note: "Snow costs 2 movement. You cannot enter water, cover, occupied tiles or walls.",
  },
  {
    name: "The watch fires",
    biome: "frost",
    rows: [
      "...#....",
      ".s....s.",
      "..c..c..",
      "........",
      ".W....W.",
      "..s..s..",
      "...B....",
    ],
    enemies: [
      ["bomber", 1, 1],
      ["archer", 6, 1],
      ["brute", 2, 3],
      ["brute", 5, 3],
    ],
    wards: true,
    note: "Seal the watch fires before the storm. Shield is spent by the first incoming attack.",
  },
  {
    name: "The Crown of Winter",
    biome: "frost",
    rows: [
      "...#....",
      ".~....~.",
      "..c..c..",
      "........",
      ".W....W.",
      "..s..s..",
      "...B....",
    ],
    enemies: [
      ["crown", 3, 1],
      ["archer", 0, 2],
      ["archer", 7, 2],
      ["brute", 4, 3],
    ],
    boss: true,
    wards: true,
    note: "Seal both watch fires to break the Crown’s 3 armor. Kill the Crown and its court.",
  },
];
export const ENCOUNTERS = Object.freeze(
  MISSIONS.map((m, i) => ({
    name: m.name,
    biome: m.biome,
    boss: !!m.boss,
    wards: !!m.wards,
    index: i + 1,
    note: m.note,
  })),
);
const ENEMIES = {
  brute: { name: "Briar bruiser", hp: 12, damage: 4 },
  archer: { name: "Hollow archer", hp: 10, damage: 4 },
  bomber: { name: "Spore bomber", hp: 12, damage: 3 },
  thorn: { name: "Thorn Regent", hp: 36, damage: 4 },
  kiln: { name: "Kiln Marshal", hp: 44, damage: 4 },
  crown: { name: "Crown of Winter", hp: 52, damage: 5 },
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const pos = (x, y) => `${x},${y}`;
const inside = (x, y) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  x < WIDTH &&
  y >= 0 &&
  y < HEIGHT;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const dirs = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];
export function difficultyInfo(s) {
  return DIFFICULTIES[s.difficulty];
}
export function recordScope(s) {
  return `ironwood-v1-${s.difficulty}`;
}
function random(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function seedNumber(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  let n = 2166136261;
  for (const c of String(seed ?? Date.now()))
    n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  return n;
}
export function createState({ seed, difficulty = "veteran" } = {}) {
  const n = seedNumber(seed);
  const d = DIFFICULTIES[difficulty] ? difficulty : "veteran";
  const s = {
    version: 1,
    seed: n,
    rng: n,
    difficulty: d,
    phase: "battle",
    pausedPhase: null,
    mission: 0,
    turn: 1,
    totalTurns: 0,
    completed: 0,
    score: 0,
    bandages: 3,
    relics: [],
    upgrades: { damage: 0, move: 0, shield: 0, control: 0, heal: 0 },
    beacon: { x: 3, y: 6, hp: 24, maxHp: 24 },
    heroes: Object.entries(HEROES).map(([id, h], i) => ({
      id,
      x: 2 + i,
      y: 5,
      hp: h.hp + DIFFICULTIES[d].hp,
      maxHp: h.hp + DIFFICULTIES[d].hp,
      move: 3,
      action: 1,
      shield: 0,
    })),
    enemies: [],
    tiles: [],
    wards: [],
    rewards: [],
    events: [],
    message:
      "Read the red intent tiles. Move your squad, act once each, then end the turn.",
    result: "",
  };
  loadMission(s);
  return s;
}
function unitAt(s, x, y, omit) {
  return [...s.heroes, ...s.enemies].find(
    (u) => u.id !== omit && u.hp > 0 && u.x === x && u.y === y,
  );
}
function tileAt(s, x, y) {
  return inside(x, y) ? s.tiles[y * WIDTH + x] : null;
}
function solid(s, x, y) {
  const t = tileAt(s, x, y);
  return !t || t.kind === "wall" || t.kind === "cover";
}
function passable(s, x, y, omit) {
  const t = tileAt(s, x, y);
  return (
    t &&
    !["wall", "cover", "water"].includes(t.kind) &&
    !unitAt(s, x, y, omit) &&
    !(s.beacon.x === x && s.beacon.y === y)
  );
}
function loadMission(s) {
  const m = MISSIONS[s.mission];
  s.tiles = [];
  s.wards = [];
  m.rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const kind = {
        ".": "floor",
        "#": "wall",
        "~": "water",
        f: "fire",
        s: "snow",
        c: "cover",
        B: "beacon",
        W: "ward",
      }[c];
      s.tiles.push({ x, y, kind, hp: kind === "cover" ? 3 : 0 });
      if (kind === "ward") s.wards.push({ x, y, sealed: false });
    }),
  );
  s.enemies = m.enemies.map(([kind, x, y], i) => {
    const def = ENEMIES[kind],
      maxHp =
        def.hp +
        Math.floor(s.mission / 3) * 2 +
        (s.difficulty === "nightmare" ? 2 : 0);
    return {
      id: `enemy-${i}`,
      kind,
      name: def.name,
      x,
      y,
      hp: maxHp,
      maxHp,
      shield: 0,
      intent: null,
      staggered: false,
    };
  });
  s.turn = 1;
  s.events = [];
  s.phase = "battle";
  for (const [i, h] of s.heroes.entries()) {
    h.x = 2 + i;
    h.y = 5;
    h.move = 3 + s.upgrades.move;
    h.action = h.hp > 0 ? 1 : 0;
    h.shield = s.upgrades.shield;
  }
  planIntents(s);
  s.message = m.note;
}
export function missionInfo(s) {
  return {
    ...ENCOUNTERS[s.mission],
    deadline: Math.max(
      5,
      DIFFICULTIES[s.difficulty].deadline - (MISSIONS[s.mission].boss ? 3 : 0),
    ),
    wards: s.wards.length,
    remaining: s.wards.filter((w) => !w.sealed).length,
  };
}
export function movementOptions(s, heroId) {
  const h = s.heroes.find((h) => h.id === heroId);
  if (!h || h.hp <= 0 || s.phase !== "battle") return [];
  const queue = [{ x: h.x, y: h.y, cost: 0, path: [] }],
    best = new Map([[pos(h.x, h.y), 0]]),
    out = [];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const p = queue.shift();
    for (const [dx, dy] of dirs) {
      const x = p.x + dx,
        y = p.y + dy;
      if (!passable(s, x, y, h.id)) continue;
      const cost = p.cost + (tileAt(s, x, y).kind === "snow" ? 2 : 1);
      if (cost > h.move || cost >= (best.get(pos(x, y)) ?? Infinity)) continue;
      best.set(pos(x, y), cost);
      const q = { x, y, cost, path: [...p.path, { x, y }] };
      queue.push(q);
      out.push(q);
    }
  }
  return out.filter((p) => p.cost === best.get(pos(p.x, p.y)));
}
function cardinalPath(a, b, range) {
  if (
    (a.x !== b.x && a.y !== b.y) ||
    distance(a, b) > range ||
    distance(a, b) === 0
  )
    return null;
  const dx = Math.sign(b.x - a.x),
    dy = Math.sign(b.y - a.y),
    cells = [];
  let x = a.x,
    y = a.y;
  while (x !== b.x || y !== b.y) {
    x += dx;
    y += dy;
    cells.push({ x, y });
  }
  return cells;
}
function lineClear(s, cells, { units = false, omit } = {}) {
  return cells.every(
    (p, i) =>
      !solid(s, p.x, p.y) &&
      (i === cells.length - 1 || !units || !unitAt(s, p.x, p.y, omit)),
  );
}
function pushForecast(s, target, dx, dy) {
  if (["thorn", "kiln", "crown"].includes(target.kind))
    return {
      kind: "rooted",
      x: target.x,
      y: target.y,
      damage: 2 + s.upgrades.control * 2,
    };
  const x = target.x + dx,
    y = target.y + dy,
    t = tileAt(s, x, y);
  if (
    !t ||
    t.kind === "wall" ||
    t.kind === "cover" ||
    unitAt(s, x, y, target.id) ||
    (s.beacon.x === x && s.beacon.y === y)
  )
    return {
      kind: "collision",
      x: target.x,
      y: target.y,
      damage: 2 + s.upgrades.control * 2,
    };
  if (t.kind === "water")
    return {
      kind: "water",
      x,
      y,
      damage: ["thorn", "kiln", "crown"].includes(target.kind) ? 8 : target.hp,
    };
  return { kind: "push", x, y, damage: t.kind === "fire" ? 2 : 0 };
}
export function previewAction(s, heroId, mode, x, y) {
  const h = s.heroes.find((h) => h.id === heroId);
  const fail = (text) => ({ ok: false, text });
  if (s.phase !== "battle" || !h || h.hp <= 0 || h.action < 1 || !inside(x, y))
    return fail("This hero has no action available.");
  const target = unitAt(s, x, y);
  if (mode === "brace") {
    if (h.id !== "warden") return fail("Only the Warden can brace.");
    const allies = s.heroes.filter((a) => a.hp > 0 && distance(h, a) <= 1);
    return {
      ok: true,
      text: `Shield ${allies.map((a) => HEROES[a.id].name.split(" · ")[0]).join(", ")} for ${5 + s.upgrades.shield}.`,
      kind: "brace",
      allies: allies.map((a) => a.id),
    };
  }
  if (mode === "mend") {
    if (s.bandages < 1) return fail("No bandages remain.");
    if (
      !target ||
      !s.heroes.includes(target) ||
      target.hp <= 0 ||
      target.hp >= target.maxHp ||
      distance(h, target) > 1
    )
      return fail("Choose an injured adjacent ally (or yourself).");
    return {
      ok: true,
      kind: "mend",
      target: target.id,
      heal: Math.min(target.maxHp - target.hp, 5 + s.upgrades.heal * 2),
      text: `Mend ${HEROES[target.id].name} for ${Math.min(target.maxHp - target.hp, 5 + s.upgrades.heal * 2)} HP. Uses 1 bandage.`,
    };
  }
  if (mode === "seal") {
    const ward = s.wards.find((w) => w.x === x && w.y === y && !w.sealed);
    if (!ward || distance(h, ward) > 1)
      return fail("Stand on or beside an unsealed ward.");
    return {
      ok: true,
      kind: "seal",
      x,
      y,
      text: "Seal this ward permanently. Costs this hero’s action.",
    };
  }
  if (mode !== "attack") return fail("Choose an action.");
  const def = HEROES[h.id],
    range = def.range + (h.id === "weaver" ? s.upgrades.control : 0);
  if (h.id === "warden") {
    if (distance(h, { x, y }) !== 1)
      return fail("Shove needs an adjacent target.");
    if (tileAt(s, x, y).kind === "cover")
      return {
        ok: true,
        kind: "cover",
        x,
        y,
        damage: 6 + s.upgrades.damage,
        text: "Break this cover. No target behind it is damaged.",
      };
    if (!target || !s.enemies.includes(target))
      return fail("Choose an adjacent foe.");
  } else {
    const cells = cardinalPath(h, { x, y }, range);
    if (!cells)
      return fail(
        `Choose a target in the same row or column, within ${range} tiles.`,
      );
    if (tileAt(s, x, y).kind === "cover") {
      if (!lineClear(s, cells.slice(0, -1), { units: true, omit: h.id }))
        return fail("Another wall, cover or body blocks this shot.");
      return {
        ok: true,
        kind: "cover",
        x,
        y,
        damage: def.damage + s.upgrades.damage,
        text: "Break this cover. The shot stops at its near face.",
      };
    }
    if (
      !target ||
      !s.enemies.includes(target) ||
      !lineClear(s, cells, { units: true, omit: h.id })
    )
      return fail("A wall, cover or body blocks the line.");
  }
  const armor =
    target.kind === "crown" && s.wards.some((w) => !w.sealed) ? 3 : 0;
  const damage = Math.max(1, def.damage + s.upgrades.damage - armor);
  let push = null;
  if (h.id !== "ranger" && target.hp > damage) {
    const direction = h.id === "warden" ? 1 : -1;
    push = pushForecast(
      s,
      target,
      Math.sign(target.x - h.x) * direction,
      Math.sign(target.y - h.y) * direction,
    );
  }
  return {
    ok: true,
    kind: "attack",
    target: target.id,
    damage,
    push,
    text: `${damage} damage${armor ? " (3 royal armor)" : ""}${push ? (push.kind === "push" ? ` · ${h.id === "warden" ? "push" : "pull"} to ${String.fromCharCode(65 + push.x)}${push.y + 1}${push.damage ? ` +${push.damage} fire damage` : ""} · cancel intent` : push.kind === "water" ? ` · water ${push.damage} damage${push.damage >= target.hp - damage ? " · defeat" : ""}` : ` · ${push.kind === "rooted" ? "rooted boss: impact" : "blocked push"} +${push.damage} damage${push.kind === "rooted" ? " · intent stays" : ""}`) : damage >= target.hp ? " · defeat" : ""}.`,
  };
}
function chooseTarget(s, e) {
  const targets = [
    ...s.heroes.filter((h) => h.hp > 0),
    { id: "beacon", ...s.beacon },
  ];
  return targets.sort(
    (a, b) => distance(e, a) - distance(e, b) || (a.id === "beacon" ? 1 : -1),
  )[0];
}
function enemyPath(s, e, target) {
  const queue = [{ x: e.x, y: e.y, path: [] }],
    seen = new Set([pos(e.x, e.y)]);
  while (queue.length) {
    const p = queue.shift();
    if (distance(p, target) <= 1) return p.path.slice(0, 2);
    for (const [dx, dy] of dirs) {
      const x = p.x + dx,
        y = p.y + dy,
        key = pos(x, y);
      if (seen.has(key) || !passable(s, x, y, e.id)) continue;
      seen.add(key);
      queue.push({ x, y, path: [...p.path, { x, y }] });
    }
  }
  return [];
}
function planIntents(s) {
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    e.staggered = false;
    const target = chooseTarget(s, e),
      damage =
        ENEMIES[e.kind].damage +
        DIFFICULTIES[s.difficulty].damage +
        Math.floor(s.mission / 3) +
        Math.max(0, Math.floor((s.turn - 6) / 3));
    if (["thorn", "kiln", "crown"].includes(e.kind)) {
      let cells;
      if (e.kind === "thorn")
        cells =
          s.turn % 2
            ? [...Array(HEIGHT)].map((_, y) => ({ x: target.x, y }))
            : [...Array(WIDTH)].map((_, x) => ({ x, y: target.y }));
      else if (e.kind === "kiln")
        cells =
          s.turn % 2
            ? [...Array(WIDTH)]
                .map((_, x) => ({ x, y: target.y }))
                .concat([...Array(HEIGHT)].map((_, y) => ({ x: target.x, y })))
            : [...Array(HEIGHT)].flatMap((_, y) => [
                { x: 2, y },
                { x: 5, y },
              ]);
      else
        cells = [...Array(WIDTH)]
          .map((_, x) => ({ x, y: target.y }))
          .concat([...Array(HEIGHT)].map((_, y) => ({ x: target.x, y })));
      e.intent = {
        kind: "royal",
        label:
          e.kind === "thorn"
            ? "Royal thornline"
            : e.kind === "kiln"
              ? "Furnace sweep"
              : "Winter cross",
        damage,
        beaconDamage: Math.floor(s.mission / 3) + 1,
        cells: [...new Map(cells.map((p) => [pos(p.x, p.y), p])).values()],
      };
    } else if (e.kind === "brute" && distance(e, target) === 1)
      e.intent = {
        kind: "strike",
        label: "Heavy strike",
        damage,
        cells: [{ x: target.x, y: target.y }],
      };
    else if (
      e.kind === "archer" &&
      cardinalPath(e, target, 6) &&
      lineClear(s, cardinalPath(e, target, 6).slice(0, -1))
    ) {
      const dx = Math.sign(target.x - e.x),
        dy = Math.sign(target.y - e.y),
        cells = [];
      for (let k = 1; k <= 6; k++) {
        const x = e.x + dx * k,
          y = e.y + dy * k;
        if (!inside(x, y) || solid(s, x, y)) break;
        cells.push({ x, y });
      }
      e.intent = { kind: "shot", label: "Hollow longshot", damage, cells };
    } else if (e.kind === "bomber" && distance(e, target) <= 4)
      e.intent = {
        kind: "blast",
        label: "Spore cross",
        damage,
        cells: [
          { x: target.x, y: target.y },
          ...dirs
            .map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy }))
            .filter((p) => inside(p.x, p.y)),
        ],
      };
    else
      e.intent = {
        kind: "advance",
        label: "Advance",
        damage: 0,
        cells: enemyPath(s, e, target),
      };
  }
}
function log(s, event) {
  s.events.push(event);
}
function damageHero(s, h, amount, source) {
  const blocked = Math.min(h.shield, amount),
    damage = amount - blocked;
  h.shield -= blocked;
  h.hp = Math.max(0, h.hp - damage);
  log(s, { kind: "hit", unit: h.id, x: h.x, y: h.y, damage, blocked, source });
}
function damageBeacon(s, amount, source) {
  s.beacon.hp = Math.max(0, s.beacon.hp - amount);
  log(s, {
    kind: "beacon",
    damage: amount,
    x: s.beacon.x,
    y: s.beacon.y,
    source,
  });
}
function applyEnemy(s, e) {
  if (e.hp <= 0 || e.staggered) return;
  const intent = e.intent;
  if (intent.kind === "advance") {
    for (const p of intent.cells) {
      if (!passable(s, p.x, p.y, e.id) || distance(e, p) !== 1) break;
      e.x = p.x;
      e.y = p.y;
      if (tileAt(s, p.x, p.y).kind === "fire") {
        e.hp = Math.max(0, e.hp - 2);
        log(s, { kind: "fire", unit: e.id, x: e.x, y: e.y, damage: 2 });
        if (e.hp <= 0) break;
      }
    }
    return;
  }
  for (const p of intent.cells) {
    if (intent.kind === "shot" && solid(s, p.x, p.y)) break;
    const h = s.heroes.find((h) => h.hp > 0 && h.x === p.x && h.y === p.y),
      other = s.enemies.find(
        (a) => a.hp > 0 && a.id !== e.id && a.x === p.x && a.y === p.y,
      ),
      isBeacon = s.beacon.x === p.x && s.beacon.y === p.y;
    if (h) damageHero(s, h, intent.damage, e.id);
    if (isBeacon) damageBeacon(s, intent.damage, e.id);
    if (intent.kind === "shot" && (h || other || isBeacon)) break;
  }
  if (intent.beaconDamage)
    damageBeacon(s, intent.beaconDamage, `${e.id}:siege`);
}
function resolve(s, { preview = false } = {}) {
  s.events = [];
  for (const e of s.enemies) applyEnemy(s, e);
  for (const h of s.heroes)
    if (h.hp > 0 && tileAt(s, h.x, h.y).kind === "fire")
      damageHero(s, h, 2, "fire");
  for (const e of s.enemies)
    if (e.hp > 0 && tileAt(s, e.x, e.y).kind === "fire") {
      e.hp = Math.max(0, e.hp - 2);
      log(s, { kind: "fire", unit: e.id, x: e.x, y: e.y, damage: 2 });
    }
  if (s.turn >= missionInfo(s).deadline)
    damageBeacon(
      s,
      difficultyInfo(s).storm +
        Math.floor((s.turn - missionInfo(s).deadline) / 2),
      "storm",
    );
  if (preview) return;
  s.totalTurns++;
  if (checkOutcome(s)) return;
  s.turn++;
  for (const h of s.heroes) {
    h.move = h.hp > 0 ? 3 + s.upgrades.move : 0;
    h.action = h.hp > 0 ? 1 : 0;
    h.shield = s.upgrades.shield;
  }
  planIntents(s);
  s.message = `Turn ${s.turn}. Enemy intents are locked. Shield expires after each enemy turn.`;
}
export function forecast(s) {
  if (s.phase !== "battle") return [];
  const c = clone(s);
  resolve(c, { preview: true });
  return c.events;
}
export function visibleIntent(s, e) {
  if (!e || e.hp <= 0 || e.staggered) return [];
  if (e.intent.kind !== "shot")
    return e.intent.beaconDamage &&
      !e.intent.cells.some((p) => p.x === s.beacon.x && p.y === s.beacon.y)
      ? [...e.intent.cells, { x: s.beacon.x, y: s.beacon.y }]
      : e.intent.cells;
  const out = [];
  for (const p of e.intent.cells) {
    if (solid(s, p.x, p.y)) break;
    out.push(p);
    if (unitAt(s, p.x, p.y, e.id) || (s.beacon.x === p.x && s.beacon.y === p.y))
      break;
  }
  return out;
}
function checkOutcome(s) {
  if (s.beacon.hp <= 0 || s.heroes.every((h) => h.hp <= 0)) {
    s.phase = "lost";
    s.score = 0;
    s.result =
      s.beacon.hp <= 0
        ? "The Heartwood beacon went dark. Read the intent order and protect the road."
        : "The last guardian fell. Your next expedition begins with a fresh squad.";
    s.message = s.result;
    return true;
  }
  if (s.enemies.some((e) => e.hp > 0) || s.wards.some((w) => !w.sealed))
    return false;
  s.completed++;
  if (s.mission === 8) {
    s.phase = "won";
    const d = { standard: 1, veteran: 1.5, nightmare: 2 }[s.difficulty];
    s.score = Math.round(
      (900 +
        Math.max(0, 90 - s.totalTurns) * 12 +
        s.beacon.hp * 8 +
        s.heroes.reduce((a, h) => a + h.hp * 3, 0) +
        s.bandages * 15) *
        d,
    );
    s.result = `Nine crossings secured in ${s.totalTurns} turns. ${s.heroes.filter((h) => h.hp > 0).length} guardians return, with ${s.beacon.hp} beacon HP.`;
    s.message = s.result;
  } else {
    s.phase = "reward";
    const ids = Object.keys(RELICS).filter(
      (id) => id !== "camp" && !s.relics.includes(id),
    );
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(random(s) * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    s.rewards = [...ids.slice(0, 2), "camp"];
    s.message =
      "One choice. Injuries and bandages carry into the next crossing.";
  }
  return true;
}
function applyReward(s, id) {
  switch (RELICS[id].kind) {
    case "damage":
      s.upgrades.damage++;
      break;
    case "move":
      s.upgrades.move++;
      break;
    case "health":
      for (const h of s.heroes) {
        h.maxHp += 4;
        if (h.hp > 0) h.hp = Math.min(h.maxHp, h.hp + 4);
      }
      break;
    case "shield":
      s.upgrades.shield += 2;
      break;
    case "control":
      s.upgrades.control++;
      break;
    case "heal":
      s.bandages += 2;
      s.upgrades.heal = 1;
      break;
    case "beacon":
      s.beacon.maxHp += 5;
      s.beacon.hp = Math.min(s.beacon.maxHp, s.beacon.hp + 5);
      break;
    case "camp":
      for (const h of s.heroes)
        if (h.hp > 0) h.hp = Math.min(h.maxHp, h.hp + 6);
      s.beacon.hp = Math.min(s.beacon.maxHp, s.beacon.hp + 4);
      break;
  }
  if (id !== "camp") s.relics.push(id);
  s.mission++;
  loadMission(s);
}
export function dispatch(s, action, payload = {}) {
  const fail = () => ({ ok: false });
  if (
    !s ||
    !payload ||
    typeof payload !== "object" ||
    s.phase === "paused" ||
    ["won", "lost"].includes(s.phase)
  )
    return fail();
  if (action === "reward") {
    if (s.phase !== "reward" || !s.rewards.includes(payload.id)) return fail();
    applyReward(s, payload.id);
    return { ok: true };
  }
  if (s.phase !== "battle") return fail();
  if (action === "end-turn") {
    resolve(s);
    return { ok: true };
  }
  const h = s.heroes.find((h) => h.id === payload.hero);
  if (!h || h.hp <= 0) return fail();
  if (action === "move") {
    const option = movementOptions(s, h.id).find(
      (p) => p.x === payload.x && p.y === payload.y,
    );
    if (!option) return fail();
    s.events = [];
    h.move -= option.cost;
    for (const p of option.path) {
      h.x = p.x;
      h.y = p.y;
      if (tileAt(s, p.x, p.y).kind === "fire") damageHero(s, h, 2, "fire");
      if (h.hp <= 0) break;
    }
    s.message = `${HEROES[h.id].name}: ${h.move} movement and ${h.action} action left.`;
    checkOutcome(s);
    return { ok: true };
  }
  if (action !== "act") return fail();
  const p = previewAction(s, h.id, payload.mode, payload.x, payload.y);
  if (!p.ok) return fail();
  s.events = [];
  h.action--;
  if (p.kind === "brace") {
    for (const id of p.allies) {
      const ally = s.heroes.find((a) => a.id === id);
      ally.shield += 5 + s.upgrades.shield;
    }
  } else if (p.kind === "mend") {
    s.bandages--;
    s.heroes.find((a) => a.id === p.target).hp += p.heal;
  } else if (p.kind === "seal") {
    s.wards.find((w) => w.x === p.x && w.y === p.y).sealed = true;
  } else if (p.kind === "cover") {
    const t = tileAt(s, p.x, p.y);
    t.hp -= p.damage;
    if (t.hp <= 0) t.kind = "floor";
  } else {
    const e = s.enemies.find((e) => e.id === p.target);
    e.hp = Math.max(0, e.hp - p.damage);
    log(s, { kind: "attack", unit: e.id, x: e.x, y: e.y, damage: p.damage });
    if (e.hp > 0 && p.push) {
      e.hp = Math.max(0, e.hp - p.push.damage);
      if (p.push.kind === "push") {
        e.x = p.push.x;
        e.y = p.push.y;
        e.staggered = true;
      } else if (p.push.kind === "water") {
        if (!["thorn", "kiln", "crown"].includes(e.kind)) {
          e.x = p.push.x;
          e.y = p.push.y;
        } else e.staggered = true;
      }
      log(s, {
        kind: p.push.kind,
        unit: e.id,
        x: e.x,
        y: e.y,
        damage: p.push.damage,
      });
    }
  }
  s.message = p.text;
  checkOutcome(s);
  return { ok: true };
}
export function togglePause(s) {
  if (["won", "lost"].includes(s.phase)) return false;
  if (s.phase === "paused") {
    s.phase = s.pausedPhase;
    s.pausedPhase = null;
  } else {
    s.pausedPhase = s.phase;
    s.phase = "paused";
  }
  return true;
}
