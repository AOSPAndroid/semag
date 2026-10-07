import test from "node:test";
import assert from "node:assert/strict";
import {
  WIDTH,
  HEIGHT,
  HEROES,
  ENCOUNTERS,
  RELICS,
  createState,
  dispatch,
  movementOptions,
  previewAction,
  forecast,
  visibleIntent,
  togglePause,
  missionInfo,
  recordScope,
} from "../public/solo/ironwood-engine.js";
import * as G from "../public/solo/ironwood-engine.js";
const copy = (s) => structuredClone(s);
function fixture() {
  const s = createState({ seed: 1 });
  s.tiles = Array.from({ length: 56 }, (_, i) => ({
    x: i % 8,
    y: Math.floor(i / 8),
    kind: "floor",
    hp: 0,
  }));
  s.wards = [];
  s.heroes.forEach((h, i) => {
    h.x = i + 1;
    h.y = 5;
  });
  s.enemies = [
    {
      id: "enemy-0",
      kind: "brute",
      name: "Briar bruiser",
      x: 4,
      y: 2,
      hp: 20,
      maxHp: 20,
      staggered: false,
      intent: {
        kind: "strike",
        label: "Heavy strike",
        damage: 5,
        cells: [{ x: 3, y: 2 }],
      },
    },
  ];
  return s;
}
function tile(s, x, y, kind) {
  Object.assign(s.tiles[y * WIDTH + x], { kind, hp: kind === "cover" ? 3 : 0 });
}
function act(s, hero, mode, x, y) {
  assert.equal(dispatch(s, "act", { hero, mode, x, y }).ok, true);
}
function relocate(s, id, x, y) {
  const h = s.heroes.find((h) => h.id === id);
  Object.assign(h, { x, y });
  return h;
}
test("Ironwood has three differentiated heroes, nine handmade crossings and three distinct bosses", () => {
  const s = createState({ seed: 1 });
  assert.equal(s.tiles.length, WIDTH * HEIGHT);
  assert.equal(s.heroes.length, 3);
  assert.deepEqual(
    ENCOUNTERS.filter((e) => e.boss).map((e) => e.index),
    [3, 6, 9],
  );
  assert.equal(new Set(ENCOUNTERS.map((e) => e.name)).size, 9);
  assert.deepEqual(
    new Set(ENCOUNTERS.map((e) => e.biome)),
    new Set(["forest", "forge", "frost"]),
  );
  assert.deepEqual(
    Object.values(HEROES).map((h) => h.range),
    [1, 6, 3],
  );
  assert.equal(s.difficulty, "veteran");
  assert.equal(s.bandages, 3);
  assert.equal(s.score, 0);
  for (const h of s.heroes) assert.equal(s.tiles[h.y * 8 + h.x].kind, "floor");
});
test("Seeds reproduce complete starts, while records remain scoped by rules and difficulty", () => {
  assert.deepEqual(
    createState({ seed: "squad" }),
    createState({ seed: "squad" }),
  );
  assert.equal(
    recordScope(createState({ difficulty: "nightmare" })),
    "ironwood-v1-nightmare",
  );
  assert.equal(recordScope(createState()), "ironwood-v1-veteran");
  assert.notEqual(createState({ seed: 1 }).rng, createState({ seed: 2 }).rng);
});
test("Invalid coordinates, modes, spent actions and phases leave every byte unchanged", () => {
  const s = fixture(),
    before = copy(s);
  for (const [action, p] of [
    ["move", { hero: "warden", x: -1, y: 5 }],
    ["move", { hero: "warden", x: "2", y: 5 }],
    ["act", { hero: "warden", mode: "attack", x: 4, y: 2 }],
    ["act", { hero: "missing", mode: "brace", x: 1, y: 5 }],
    ["act", { hero: "warden", mode: "cheat", x: 1, y: 5 }],
    ["reward", { id: "edge" }],
    ["act", null],
  ])
    assert.equal(dispatch(s, action, p).ok, false);
  assert.deepEqual(s, before);
  s.heroes[0].action = 0;
  assert.equal(
    dispatch(s, "act", { hero: "warden", mode: "brace", x: 1, y: 5 }).ok,
    false,
  );
});
test("Movement follows exact body obstacles and weighted snow costs without corner cutting", () => {
  const s = fixture();
  relocate(s, "warden", 0, 0);
  tile(s, 1, 0, "wall");
  tile(s, 0, 1, "snow");
  tile(s, 1, 1, "cover");
  const options = movementOptions(s, "warden");
  assert.ok(!options.some((p) => p.x === 1 && p.y === 0));
  assert.equal(options.find((p) => p.x === 0 && p.y === 1).cost, 2);
  assert.equal(options.find((p) => p.x === 0 && p.y === 2).cost, 3);
  assert.ok(!options.some((p) => p.x === 1 && p.y === 1));
  assert.equal(dispatch(s, "move", { hero: "warden", x: 0, y: 2 }).ok, true);
  assert.equal(s.heroes[0].move, 0);
  assert.equal(s.heroes[0].action, 1);
});
test("Move and action budgets are independent, permit either order, and reset once per enemy turn", () => {
  const s = fixture();
  act(s, "warden", "brace", 1, 5);
  assert.equal(s.heroes[0].action, 0);
  assert.equal(dispatch(s, "move", { hero: "warden", x: 1, y: 4 }).ok, true);
  assert.equal(s.heroes[0].move, 2);
  dispatch(s, "end-turn");
  assert.equal(s.heroes[0].move, 3);
  assert.equal(s.heroes[0].action, 1);
  assert.equal(s.heroes[0].shield, 0);
  assert.equal(s.totalTurns, 1);
});
test("Ranger shots cannot pass cover, walls, friendly bodies or earlier enemies", () => {
  const s = fixture();
  relocate(s, "ranger", 4, 5);
  assert.equal(previewAction(s, "ranger", "attack", 4, 2).ok, true);
  tile(s, 4, 3, "cover");
  assert.equal(previewAction(s, "ranger", "attack", 4, 2).ok, false);
  act(s, "ranger", "attack", 4, 3);
  assert.equal(s.tiles[28].kind, "floor");
  assert.equal(s.enemies[0].hp, 20);
  s.heroes[1].action = 1;
  relocate(s, "warden", 4, 4);
  assert.equal(previewAction(s, "ranger", "attack", 4, 2).ok, false);
  relocate(s, "warden", 1, 5);
  s.enemies.push({ ...copy(s.enemies[0]), id: "enemy-1", x: 4, y: 4 });
  assert.equal(previewAction(s, "ranger", "attack", 4, 2).ok, false);
});
test("Nonlethal shot previews never promise a defeat", () => {
  const s = fixture();
  relocate(s, "ranger", 4, 5);
  const p = previewAction(s, "ranger", "attack", 4, 2);
  assert.equal(p.damage, 5);
  assert.ok(!p.text.includes("defeat"));
  s.enemies[0].hp = 5;
  assert.ok(previewAction(s, "ranger", "attack", 4, 2).text.includes("defeat"));
});
test("A legal shove displaces exactly one tile and cancels the displayed intent", () => {
  const s = fixture();
  relocate(s, "warden", 3, 2);
  const p = previewAction(s, "warden", "attack", 4, 2);
  assert.deepEqual(p.push, { kind: "push", x: 5, y: 2, damage: 0 });
  act(s, "warden", "attack", 4, 2);
  assert.equal(s.enemies[0].x, 5);
  assert.equal(s.enemies[0].hp, 14);
  assert.equal(s.enemies[0].staggered, true);
  assert.deepEqual(visibleIntent(s, s.enemies[0]), []);
  assert.equal(
    forecast(s).some((e) => e.source === "enemy-0"),
    false,
  );
});
test("Blocked shoves do exact collision damage and preserve the enemy intent", () => {
  for (const kind of ["wall", "cover"]) {
    const s = fixture();
    relocate(s, "warden", 3, 2);
    tile(s, 5, 2, kind);
    assert.equal(
      previewAction(s, "warden", "attack", 4, 2).push.kind,
      "collision",
    );
    act(s, "warden", "attack", 4, 2);
    assert.equal(s.enemies[0].x, 4);
    assert.equal(s.enemies[0].hp, 12);
    assert.equal(s.enemies[0].staggered, false);
    assert.equal(forecast(s).find((e) => e.unit === "warden").damage, 5);
  }
});
test("Bodies and the beacon block a shove at their exact tile", () => {
  const s = fixture();
  relocate(s, "warden", 3, 2);
  relocate(s, "ranger", 5, 2);
  assert.equal(
    previewAction(s, "warden", "attack", 4, 2).push.kind,
    "collision",
  );
  relocate(s, "ranger", 2, 5);
  s.beacon.x = 5;
  s.beacon.y = 2;
  assert.equal(
    previewAction(s, "warden", "attack", 4, 2).push.kind,
    "collision",
  );
});
test("Shoving into water defeats ordinary foes while rooted bosses cannot be moved", () => {
  const s = fixture();
  relocate(s, "warden", 3, 2);
  tile(s, 5, 2, "water");
  act(s, "warden", "attack", 4, 2);
  assert.equal(s.enemies[0].hp, 0);
  assert.equal(s.phase, "reward");
  const t = fixture();
  relocate(t, "warden", 3, 2);
  t.enemies[0].kind = "thorn";
  tile(t, 5, 2, "water");
  const p = previewAction(t, "warden", "attack", 4, 2);
  assert.equal(p.push.kind, "rooted");
  assert.ok(p.text.includes("intent stays"));
  act(t, "warden", "attack", 4, 2);
  assert.equal(t.enemies[0].x, 4);
  assert.equal(t.enemies[0].hp, 12);
  assert.equal(t.enemies[0].staggered, false);
});
test("Weaver pull moves toward the caster, collision bonuses do not fabricate displacement", () => {
  const s = fixture();
  relocate(s, "weaver", 4, 5);
  const p = previewAction(s, "weaver", "attack", 4, 2);
  assert.deepEqual(p.push, { kind: "push", x: 4, y: 3, damage: 0 });
  act(s, "weaver", "attack", 4, 2);
  assert.equal(s.enemies[0].y, 3);
  assert.equal(s.enemies[0].hp, 16);
  assert.equal(s.enemies[0].staggered, true);
});
test("Fire applies on each entered tile and again at the exact end-of-turn tile", () => {
  const s = fixture();
  relocate(s, "warden", 0, 4);
  tile(s, 1, 4, "fire");
  tile(s, 2, 4, "fire");
  dispatch(s, "move", { hero: "warden", x: 2, y: 4 });
  assert.equal(s.heroes[0].hp, 26);
  assert.equal(forecast(s).find((e) => e.source === "fire").damage, 2);
  dispatch(s, "end-turn");
  assert.equal(s.heroes[0].hp, 24);
});
test("Fire shove impact and end-turn burning match the preview and forecast", () => {
  const s = fixture();
  relocate(s, "warden", 3, 2);
  tile(s, 5, 2, "fire");
  assert.equal(previewAction(s, "warden", "attack", 4, 2).push.damage, 2);
  act(s, "warden", "attack", 4, 2);
  assert.equal(s.enemies[0].hp, 12);
  assert.equal(forecast(s).find((e) => e.unit === "enemy-0").damage, 2);
  dispatch(s, "end-turn");
  assert.equal(s.enemies[0].hp, 10);
});
test("Locked tile attacks do not home onto a moved guardian", () => {
  const s = fixture();
  relocate(s, "warden", 3, 2);
  dispatch(s, "move", { hero: "warden", x: 3, y: 3 });
  assert.equal(
    forecast(s).some((e) => e.unit === "warden"),
    false,
  );
  dispatch(s, "end-turn");
  assert.equal(s.heroes[0].hp, 30);
});
test("Enemy arrows stop at the current near body and cover; no damage passes through", () => {
  const s = fixture();
  relocate(s, "warden", 4, 4);
  relocate(s, "ranger", 4, 5);
  s.enemies[0].intent = {
    kind: "shot",
    damage: 5,
    cells: [
      { x: 4, y: 3 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
    ],
  };
  assert.deepEqual(visibleIntent(s, s.enemies[0]), [
    { x: 4, y: 3 },
    { x: 4, y: 4 },
  ]);
  assert.deepEqual(
    forecast(s)
      .filter((e) => e.kind === "hit")
      .map((e) => e.unit),
    ["warden"],
  );
  tile(s, 4, 3, "cover");
  assert.deepEqual(forecast(s), []);
});
test("Resolution order and shield spending match the forecast exactly", () => {
  const s = fixture();
  relocate(s, "warden", 3, 2);
  s.enemies.push({ ...copy(s.enemies[0]), id: "enemy-1", x: 3, y: 1 });
  s.heroes[0].shield = 6;
  const before = copy(s);
  const predicted = forecast(s);
  assert.deepEqual(
    predicted.map((e) => [e.damage, e.blocked]),
    [
      [0, 5],
      [4, 1],
    ],
  );
  assert.deepEqual(s, before);
  dispatch(s, "end-turn");
  assert.deepEqual(s.events, predicted);
  assert.equal(s.heroes[0].hp, 26);
});
test("Enemy advance follows its locked adjacent path and stops at a new blocker", () => {
  const s = fixture();
  s.enemies[0].intent = {
    kind: "advance",
    damage: 0,
    cells: [
      { x: 4, y: 3 },
      { x: 4, y: 4 },
    ],
  };
  relocate(s, "ranger", 4, 4);
  dispatch(s, "end-turn");
  assert.deepEqual([s.enemies[0].x, s.enemies[0].y], [4, 3]);
});
test("A ward requires an adjacent action, stays sealed, and prevents premature victory", () => {
  const s = fixture();
  s.enemies[0].hp = 0;
  s.wards = [{ x: 0, y: 0, sealed: false }];
  assert.equal(previewAction(s, "warden", "seal", 0, 0).ok, false);
  dispatch(s, "end-turn");
  assert.equal(s.phase, "battle");
  relocate(s, "warden", 0, 1);
  act(s, "warden", "seal", 0, 0);
  assert.equal(s.wards[0].sealed, true);
  assert.equal(s.phase, "reward");
  assert.equal(s.completed, 1);
  assert.equal(s.score, 0);
});
test("Crown armor disappears only when both actual wards are sealed", () => {
  const s = fixture();
  relocate(s, "ranger", 4, 5);
  s.enemies[0].kind = "crown";
  s.wards = [
    { x: 1, y: 1, sealed: false },
    { x: 6, y: 1, sealed: true },
  ];
  assert.equal(previewAction(s, "ranger", "attack", 4, 2).damage, 2);
  s.wards[0].sealed = true;
  assert.equal(previewAction(s, "ranger", "attack", 4, 2).damage, 5);
});
test("Bandages are finite, cannot overheal or revive, and cost the acting hero’s action", () => {
  const s = fixture();
  s.heroes[0].hp = 22;
  act(s, "warden", "mend", 1, 5);
  assert.equal(s.heroes[0].hp, 27);
  assert.equal(s.bandages, 2);
  assert.equal(s.heroes[0].action, 0);
  s.heroes[0].action = 1;
  act(s, "warden", "mend", 1, 5);
  assert.equal(s.heroes[0].hp, 30);
  s.heroes[0].action = 1;
  assert.equal(previewAction(s, "warden", "mend", 1, 5).ok, false);
  s.heroes[1].hp = 0;
  assert.equal(previewAction(s, "warden", "mend", 2, 5).ok, false);
});
test("Stalling encounters brings increasing beacon storm damage rather than resource farming", () => {
  const s = fixture();
  s.enemies[0].intent = { kind: "advance", damage: 0, cells: [] };
  s.turn = missionInfo(s).deadline;
  assert.equal(forecast(s).find((e) => e.source === "storm").damage, 2);
  s.turn += 4;
  assert.equal(forecast(s).find((e) => e.source === "storm").damage, 4);
  assert.equal(s.bandages, 3);
});
test("Rooted boss siege and direct royal beacon damage are both explicit in the forecast", () => {
  const s = fixture();
  s.enemies[0].kind = "thorn";
  s.enemies[0].intent = {
    kind: "royal",
    damage: 5,
    beaconDamage: 1,
    cells: [{ x: 3, y: 6 }],
  };
  assert.equal(
    forecast(s)
      .filter((e) => e.kind === "beacon")
      .reduce((a, e) => a + e.damage, 0),
    6,
  );
  dispatch(s, "end-turn");
  assert.equal(s.beacon.hp, 18);
});
test("Reward drafts are deterministic, always offer recovery and never repeat owned upgrades", () => {
  const a = fixture(),
    b = copy(a);
  a.enemies[0].hp = b.enemies[0].hp = 1;
  relocate(a, "warden", 3, 2);
  relocate(b, "warden", 3, 2);
  act(a, "warden", "attack", 4, 2);
  act(b, "warden", "attack", 4, 2);
  assert.deepEqual(a.rewards, b.rewards);
  assert.ok(a.rewards.includes("camp"));
  assert.equal(new Set(a.rewards).size, a.rewards.length);
  const id = a.rewards.find((id) => id !== "camp");
  assert.ok(RELICS[id]);
  dispatch(a, "reward", { id });
  assert.ok(a.relics.includes(id));
  a.enemies.forEach((e) => (e.hp = 0));
  dispatch(a, "end-turn");
  if (a.phase === "reward") assert.ok(!a.rewards.includes(id));
});
test("Camp preserves injuries, finite bandages, dead heroes and the difficulty between missions", () => {
  const s = fixture();
  relocate(s, "warden", 3, 2);
  s.enemies[0].hp = 1;
  act(s, "warden", "attack", 4, 2);
  s.heroes[0].hp = 10;
  s.heroes[1].hp = 0;
  s.beacon.hp = 12;
  s.bandages = 1;
  dispatch(s, "reward", { id: "camp" });
  assert.equal(s.mission, 1);
  assert.equal(s.heroes[0].hp, 16);
  assert.equal(s.heroes[1].hp, 0);
  assert.equal(s.beacon.hp, 16);
  assert.equal(s.bandages, 1);
  assert.equal(s.difficulty, "veteran");
  assert.equal(s.heroes[1].action, 0);
});
test("Pause preserves battle and reward decisions exactly and disallows every game action", () => {
  for (const phase of ["battle", "reward"]) {
    const s = fixture();
    s.phase = phase;
    s.rewards = ["edge", "camp"];
    const before = copy(s);
    assert.equal(togglePause(s), true);
    for (const [a, p] of [
      ["end-turn", {}],
      ["move", { hero: "warden", x: 1, y: 4 }],
      ["reward", { id: "edge" }],
    ])
      assert.equal(dispatch(s, a, p).ok, false);
    assert.equal(togglePause(s), true);
    assert.deepEqual(s, before);
  }
});
test("Defeat locks the run and emits zero completed-expedition score", () => {
  const s = fixture();
  s.beacon.hp = 1;
  s.enemies[0].intent = { kind: "royal", damage: 2, cells: [{ x: 3, y: 6 }] };
  dispatch(s, "end-turn");
  assert.equal(s.phase, "lost");
  assert.equal(s.score, 0);
  const before = copy(s);
  assert.equal(dispatch(s, "end-turn").ok, false);
  assert.equal(togglePause(s), false);
  assert.deepEqual(s, before);
});

// This independent planner reads public previews and submits ordinary actions.
// The live campaign is never assigned positions, HP, resources, rewards or mission indices.
const clone = (s) => JSON.parse(JSON.stringify(s));
const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const beamWidth = 12;
function campaignGrade(s) {
  if (s.phase === "lost") return -1e9;
  if (s.phase === "won" || s.phase === "reward")
    return (
      100000 +
      s.heroes.reduce((n, h) => n + h.hp * 10, 0) +
      s.beacon.hp * 15 +
      s.bandages * 4
    );
  let score =
    s.heroes.reduce((n, h) => n + (h.hp > 0 ? 50 : 0) + h.hp * 3, 0) +
    s.beacon.hp * 4 +
    s.bandages * 2;
  for (const e of s.enemies) score += (e.hp <= 0 ? 22 : 0) - e.hp * 2.2;
  score += s.wards.filter((w) => w.sealed).length * 17;
  const future = clone(s);
  G.dispatch(future, "end-turn");
  if (future.phase === "battle") {
    for (const hit of G.forecast(future))
      if (hit.kind === "beacon") score -= hit.damage * 8;
  }
  for (const hit of G.forecast(s)) {
    if (hit.kind === "hit") {
      score -= hit.damage * 4.5;
      const h = s.heroes.find((h) => h.id === hit.unit);
      if (h && h.hp <= hit.damage) score -= 70;
    }
    if (hit.kind === "beacon") score -= hit.damage * 7;
  }
  const foes = s.enemies.filter((e) => e.hp > 0);
  for (const h of s.heroes.filter((h) => h.hp > 0)) {
    const targets = [...foes, ...s.wards.filter((w) => !w.sealed)];
    if (!targets.length) continue;
    let closest = 100;
    for (const e of targets) {
      let d = man(h, e);
      if (h.id === "ranger" && (h.x === e.x || h.y === e.y)) d *= 0.45;
      if (h.id === "weaver" && (h.x === e.x || h.y === e.y)) d *= 0.7;
      closest = Math.min(closest, d);
    }
    score -= closest * 0.5;
  }
  return score;
}
function campaignCandidates(s, id) {
  const h = s.heroes.find((h) => h.id === id);
  if (!h || h.hp <= 0) return [{ s, actions: [] }];
  const positions = [{ x: h.x, y: h.y, cost: 0 }, ...G.movementOptions(s, id)],
    out = [];
  for (const p of positions) {
    const c = clone(s),
      actions = [];
    if (p.cost) {
      const move = { hero: id, x: p.x, y: p.y };
      const r = G.dispatch(c, "move", move);
      if (!r.ok) throw Error("invalid generated move");
      actions.push(["move", move]);
    }
    if (c.phase !== "battle") {
      out.push({ s: c, actions });
      continue;
    }
    const hero = c.heroes.find((h) => h.id === id);
    if (hero.hp <= 0) {
      out.push({ s: c, actions });
      continue;
    }
    const targets = [
      ...c.enemies
        .filter((e) => e.hp > 0)
        .map((e) => ({ mode: "attack", x: e.x, y: e.y })),
      ...c.tiles
        .filter((t) => t.kind === "cover")
        .map((t) => ({ mode: "attack", x: t.x, y: t.y })),
      ...c.wards
        .filter((w) => !w.sealed)
        .map((w) => ({ mode: "seal", x: w.x, y: w.y })),
      ...c.heroes
        .filter((a) => a.hp > 0 && a.hp < a.maxHp)
        .map((a) => ({ mode: "mend", x: a.x, y: a.y })),
      { mode: "brace", x: hero.x, y: hero.y },
    ];
    for (const a of targets) {
      if (!G.previewAction(c, id, a.mode, a.x, a.y).ok) continue;
      const d = clone(c),
        payload = { hero: id, ...a };
      if (!G.dispatch(d, "act", payload).ok)
        throw Error("valid preview rejected");
      out.push({ s: d, actions: [...actions, ["act", payload]] });
    }
    out.push({ s: c, actions });
  }
  return out
    .map((c) => ({ ...c, score: campaignGrade(c.s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);
}
function campaignPlan(s) {
  let beam = [{ s: clone(s), done: [], actions: [], score: campaignGrade(s) }];
  for (let depth = 0; depth < 3; depth++) {
    const next = [];
    for (const entry of beam) {
      for (const h of entry.s.heroes) {
        if (entry.done.includes(h.id)) continue;
        for (const option of campaignCandidates(entry.s, h.id))
          next.push({
            s: option.s,
            done: [...entry.done, h.id],
            actions: [...entry.actions, ...option.actions],
            score: option.score,
          });
      }
    }
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, beamWidth);
  }
  return beam[0];
}

test("A normal-input Veteran expedition clears every crossing, spends finite resources and exactly matches all enemy forecasts", () => {
  const state = createState({ seed: 41, difficulty: "veteran" });
  let rounds = 0,
    actions = 0;
  const crossed = [],
    used = new Set();
  while (!["won", "lost"].includes(state.phase) && rounds++ < 100) {
    if (state.phase === "reward") {
      crossed.push(state.mission + 1);
      assert.equal(state.score, 0);
      assert.ok(state.rewards.includes("camp"));
      for (const id of state.rewards)
        if (id !== "camp") assert.ok(!state.relics.includes(id));
      const preferences = [
        "boots",
        "edge",
        "thread",
        "beacon",
        "camp",
        "veil",
        "bark",
        "salve",
      ];
      const id = preferences.find((id) => state.rewards.includes(id));
      assert.equal(dispatch(state, "reward", { id }).ok, true);
      continue;
    }
    const planned = campaignPlan(state);
    for (const [action, payload] of planned.actions) {
      if (state.phase !== "battle") break;
      assert.equal(dispatch(state, action, payload).ok, true);
      actions++;
      used.add(payload.hero);
    }
    if (state.phase === "battle") {
      const expected = forecast(state);
      assert.equal(dispatch(state, "end-turn").ok, true);
      assert.deepEqual(state.events, expected);
    }
  }
  assert.equal(state.phase, "won");
  assert.equal(state.completed, 9);
  assert.deepEqual(crossed, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(used, new Set(["warden", "ranger", "weaver"]));
  assert.ok(actions > 120);
  assert.ok(state.totalTurns > 20);
  assert.ok(state.beacon.hp > 0 && state.beacon.hp < 12);
  assert.ok(state.bandages < 3);
  assert.ok(state.score > 0);
  assert.equal(recordScope(state), "ironwood-v1-veteran");
  const terminal = copy(state);
  assert.equal(dispatch(state, "end-turn").ok, false);
  assert.equal(togglePause(state), false);
  assert.deepEqual(state, terminal);
});
test("Idle strategies lose across all three difficulties, with earlier failure on harder settings", () => {
  const elapsed = [];
  for (const difficulty of ["standard", "veteran", "nightmare"]) {
    const s = createState({ seed: 1, difficulty });
    let turns = 0;
    while (s.phase === "battle" && turns < 40) {
      assert.equal(dispatch(s, "end-turn").ok, true);
      turns++;
    }
    assert.equal(s.phase, "lost");
    assert.equal(s.score, 0);
    assert.equal(s.completed, 0);
    elapsed.push(turns);
  }
  assert.ok(elapsed[0] > elapsed[1] && elapsed[1] > elapsed[2]);
});

test("Bomber cross locks the entire five-tile shape through breakable cover", () => {
  const s = fixture();
  s.enemies[0].kind = "bomber";
  s.enemies[0].intent = { kind: "advance", damage: 0, cells: [] };
  relocate(s, "weaver", 3, 4);
  relocate(s, "ranger", 4, 6);
  tile(s, 4, 4, "cover");
  assert.equal(dispatch(s, "end-turn").ok, true);
  assert.equal(s.enemies[0].intent.kind, "blast");
  assert.ok(s.enemies[0].intent.cells.some((p) => p.x === 4 && p.y === 4));
  act(s, "ranger", "attack", 4, 4);
  assert.equal(s.tiles[36].kind, "floor");
  assert.equal(dispatch(s, "move", { hero: "weaver", x: 4, y: 4 }).ok, true);
  assert.equal(forecast(s).find((e) => e.unit === "weaver").damage, 4);
  const hp = s.heroes[2].hp;
  assert.equal(dispatch(s, "end-turn").ok, true);
  assert.equal(s.heroes[2].hp, hp - 4);
});
