import {
  WIDTH,
  HEIGHT,
  HEROES,
  RELICS,
  DIFFICULTIES,
  ENCOUNTERS,
  createState,
  dispatch,
  togglePause,
  movementOptions,
  previewAction,
  forecast,
  visibleIntent,
  missionInfo,
  recordScope,
} from "./ironwood-engine.js";
import {
  gameKey,
  displayKey,
  subscribeKeyboardLayout,
} from "../keyboard-layout.js";
const copy = (value) => JSON.parse(JSON.stringify(value));
function node(tag, className = "", text) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(label, action, data = {}, className = "") {
  const b = node("button", className, label);
  b.type = "button";
  b.dataset.action = action;
  for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
  return b;
}
const coord = (x, y) => `${String.fromCharCode(65 + x)}${y + 1}`;
function sprite(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("ironwood-sprite");
  svg.setAttribute("viewBox", "0 0 28 30");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("shape-rendering", "crispEdges");
  const common =
    '<path d="M7 27h15v2H7z" fill="#131d21" opacity=".45"/><path d="M9 23h5v5H9zm8 0h5v5h-5z" fill="#152b35"/>';
  const art = {
    warden:
      '<path d="M8 8h15v15H8z" fill="#518588"/><path d="M9 10h13v5H9z" fill="#bdd4bb"/><path d="M8 5h15v5H8zM6 8h19v4H6z" fill="#719d96"/><path d="M10 11h11v3H10z" fill="#203b46"/><path d="M10 17h10v3H10z" fill="#caaf73"/><path d="M3 13h7v12H3z" fill="#dca870"/><path d="M4 15h5v6H4z" fill="#6d5147"/><path d="M23 11h2v15h-2zM21 21h6v2h-6z" fill="#dce6cb"/>',
    ranger:
      '<path d="M9 5h13v10H9zM7 15h16v8H7z" fill="#62804a"/><path d="M10 8h10v5H10z" fill="#ebc493"/><path d="M9 4h14v4H9zM7 8h4v8H7z" fill="#91a65a"/><path d="M11 11h2v2h-2zm6 0h2v2h-2z" fill="#263d34"/><path d="M23 9h2v15h-2zM25 12h2v9h-2z" fill="#d4a471"/><path d="M21 10h1v13h-1z" fill="#eae0b1"/><path d="M10 18h10v3H10z" fill="#b49a60"/>',
    weaver:
      '<path d="M8 7h14v10H8zM6 16h18v9H6z" fill="#717999"/><path d="M9 9h11v6H9z" fill="#e0c09c"/><path d="M7 5h16v6H7zM5 17h5v9H5z" fill="#959dbe"/><path d="M11 12h2v2h-2zm6 0h2v2h-2z" fill="#263140"/><path d="M23 7h2v21h-2z" fill="#bb9d73"/><path d="M21 4h6v6h-6z" fill="#71dccd"/><path d="M13 18h4v6h-4z" fill="#d4d7cc"/>',
    brute:
      '<path d="M7 9h16v13H7zM5 15h4v9H5zM23 15h3v9h-3z" fill="#aa6f62"/><path d="M8 7h14v10H8z" fill="#c09879"/><path d="M7 4h4v5H7zm12 0h4v5h-4z" fill="#e3ce9d"/><path d="M9 11h4v3H9zm8 0h4v3h-4z" fill="#3d3035"/><path d="M9 18h12v3H9z" fill="#594a43"/>',
    archer:
      '<path d="M8 6h15v13H8zM7 18h17v6H7z" fill="#957479"/><path d="M10 10h11v6H10z" fill="#ead6aa"/><path d="M11 12h3v3h-3zm5 0h3v3h-3z" fill="#442f3c"/><path d="M24 10h2v14h-2zM26 13h2v8h-2z" fill="#bf9580"/><path d="M21 11h1v13h-1z" fill="#ecd9b0"/>',
    bomber:
      '<path d="M9 15h13v10H9z" fill="#ab9690"/><path d="M5 8h21v8H5zM8 4h15v5H8z" fill="#b65d68"/><path d="M9 6h4v3H9zm10 4h4v3h-4z" fill="#efc7a0"/><path d="M10 18h3v3h-3zm7 0h3v3h-3z" fill="#493b42"/><path d="M3 21h5v5H3z" fill="#b1c477"/>',
    thorn:
      '<path d="M6 8h18v17H6z" fill="#806b51"/><path d="M8 10h14v7H8z" fill="#c9b58a"/><path d="M6 3h4v7H6zm7 2h4v5h-4zm8-2h4v7h-4z" fill="#cdab65"/><path d="M9 12h4v3H9zm8 0h4v3h-4z" fill="#773e47"/><path d="M2 18h5v8H2zm22-1h4v10h-4z" fill="#769366"/>',
    kiln: '<path d="M6 7h19v19H6z" fill="#7d6462"/><path d="M9 5h13v4H9zM8 10h15v7H8z" fill="#bf8e68"/><path d="M10 12h4v3h-4zm7 0h4v3h-4z" fill="#ffbf73"/><path d="M10 19h12v5H10z" fill="#c35d49"/><path d="M3 14h5v12H3zm22 0h3v12h-3z" fill="#a39482"/>',
    crown:
      '<path d="M6 8h19v18H6z" fill="#818f9c"/><path d="M9 10h13v7H9z" fill="#cbd5d0"/><path d="M6 3h4v7H6zm7 2h4v5h-4zm8-2h4v7h-4z" fill="#b1e2dc"/><path d="M10 12h4v3h-4zm7 0h4v3h-4z" fill="#44637c"/><path d="M2 16h5v10H2zm23 0h3v10h-3zM11 19h9v6h-9z" fill="#afc2ca"/>',
  };
  svg.innerHTML = common + (art[kind] || art.brute);
  return svg;
}
export function mount(container, { onUpdate = () => {} } = {}) {
  const params = new URLSearchParams(location.search),
    raw = params.get("seed");
  const seed =
    raw !== null && /^\d{1,10}$/.test(raw) && Number(raw) <= 0xffffffff
      ? Number(raw)
      : undefined;
  let state = createState({
      seed,
      difficulty: params.get("difficulty") || "veteran",
    }),
    selected = "warden",
    mode = "move",
    cursor = { x: 2, y: 5 },
    destroyed = false,
    helpOpen = false;
  const view = node("section", "ironwood-view");
  view.tabIndex = 0;
  view.dataset.soloFocus = "";
  view.setAttribute("aria-label", "Ironwood Tactics squad expedition");
  container.append(view);
  function publish() {
    const m = missionInfo(state);
    onUpdate({
      phase: ["paused", "won", "lost"].includes(state.phase)
        ? state.phase
        : "playing",
      score: state.phase === "won" ? state.score : 0,
      scoreLabel: "RENOWN",
      recordLabel: "BEST CLEAR",
      recordKey: recordScope(state),
      record: state.phase === "won" ? state.score : null,
      detail:
        state.phase === "won"
          ? state.result
          : state.phase === "lost"
            ? state.result
            : state.phase === "paused"
              ? "The squad waits. Resume this exact decision."
              : `${DIFFICULTIES[state.difficulty].label} · Crossing ${state.mission + 1}/9 · ${m.name} · Turn ${state.turn}`,
    });
  }
  function run(action, payload = {}) {
    if (destroyed) return;
    const result = dispatch(state, action, payload);
    if (!result.ok) return;
    if (!state.heroes.some((h) => h.id === selected && h.hp > 0))
      selected = state.heroes.find((h) => h.hp > 0)?.id || "warden";
    render();
  }
  function preview(x, y) {
    const h = state.heroes.find((h) => h.id === selected);
    if (mode === "move") {
      const p = movementOptions(state, selected).find(
        (p) => p.x === x && p.y === y,
      );
      return p
        ? {
            ok: true,
            text: `Move ${coord(x, y)} · ${p.cost} movement${p.path.some((c) => state.tiles[c.y * WIDTH + c.x].kind === "fire") ? " · fire deals 2 HP on each entered fire tile" : ""}.`,
          }
        : {
            ok: false,
            text: "Choose a turquoise tile. Walls, cover, water and bodies block movement.",
          };
    }
    return previewAction(state, selected, mode, x, y);
  }
  function previewUpdate() {
    const p = preview(cursor.x, cursor.y);
    const el = view.querySelector(".ironwood-preview");
    if (el) {
      el.textContent = p.text;
      el.classList.toggle("is-valid", p.ok);
    }
    for (const cell of view.querySelectorAll('[data-action="tile"]'))
      cell.classList.toggle(
        "is-cursor",
        Number(cell.dataset.x) === cursor.x &&
          Number(cell.dataset.y) === cursor.y,
      );
  }
  function chooseTile(x, y) {
    if (state.phase !== "battle") return;
    cursor = { x, y };
    const hero = state.heroes.find((h) => h.hp > 0 && h.x === x && h.y === y);
    if (hero && mode !== "mend") {
      selected = hero.id;
      mode = "move";
      render();
      return;
    }
    if (mode === "move") run("move", { hero: selected, x, y });
    else run("act", { hero: selected, mode, x, y });
    previewUpdate();
  }
  function render() {
    if (destroyed) return;
    const active = view.contains(document.activeElement)
        ? document.activeElement
        : null,
      focus = active?.dataset?.action ? { ...active.dataset } : null;
    helpOpen = view.querySelector(".ironwood-help")?.open ?? helpOpen;
    view.replaceChildren();
    view.dataset.phase = state.phase;
    view.dataset.biome = ENCOUNTERS[state.mission].biome;
    const m = missionInfo(state);
    const head = node("header", "ironwood-head");
    head.append(
      node(
        "small",
        "",
        `IRONWOOD EXPEDITION · CROSSING ${String(state.mission + 1).padStart(2, "0")} / 09`,
      ),
      node("h2", "", m.name),
      node("span", "ironwood-seed", `SEED ${state.seed}`),
    );
    view.append(head);
    const bar = node("div", "ironwood-toolbar");
    bar.append(
      node("strong", "", `HEARTWOOD ${state.beacon.hp}/${state.beacon.maxHp}`),
      node("span", "", `BANDAGES ${state.bandages}`),
      node("span", "", `TURN ${state.turn} · ${state.totalTurns} TOTAL`),
    );
    const label = node("label", "", "Difficulty "),
      select = node("select", "ironwood-difficulty");
    select.setAttribute("aria-label", "Difficulty");
    for (const [id, d] of Object.entries(DIFFICULTIES)) {
      const o = node("option", "", d.label);
      o.value = id;
      select.append(o);
    }
    select.value = state.difficulty;
    select.title =
      "Changing difficulty starts a new expedition; completed clears have separate records.";
    label.append(select);
    bar.append(label);
    view.append(bar);
    const route = node("div", "ironwood-route");
    for (const e of ENCOUNTERS) {
      const item = node(
        "span",
        `${e.index - 1 < state.mission ? "is-done" : e.index - 1 === state.mission ? "is-current" : ""}${e.boss ? " is-boss" : ""}`,
        e.boss ? "♛" : String(e.index),
      );
      item.title = e.name;
      route.append(item);
    }
    view.append(route);
    const phase = state.phase === "paused" ? state.pausedPhase : state.phase;
    if (phase === "battle") renderBattle(m);
    else if (phase === "reward") renderReward();
    else renderEnd();
    const status = node("p", "ironwood-status", state.message);
    status.setAttribute("role", "status");
    view.append(status);
    renderHelp();
    if (state.phase === "paused") {
      for (const b of view.querySelectorAll("button,select")) b.disabled = true;
      const pause = node("div", "ironwood-pause");
      pause.append(
        node("small", "", "YOUR SQUAD WAITS"),
        node("h2", "", "Plan your next move."),
        button("Resume expedition →", "resume", {}, "ironwood-primary"),
      );
      view.append(pause);
      pause.querySelector("button")?.focus();
    }
    if (focus) {
      const match = [...view.querySelectorAll("button:not(:disabled)")].find(
        (b) =>
          b.dataset.action === focus.action &&
          b.dataset.hero === focus.hero &&
          b.dataset.mode === focus.mode &&
          b.dataset.x === focus.x &&
          b.dataset.y === focus.y &&
          b.dataset.id === focus.id,
      );
      match?.focus({ preventScroll: true });
    }
    publish();
  }
  function renderBattle(m) {
    const objective = node("div", "ironwood-objective");
    const until = m.deadline - state.turn;
    objective.append(
      node(
        "strong",
        "",
        `${m.remaining ? `Seal ${m.remaining} wards and defeat all foes.` : "Defeat all foes. Protect the Heartwood."}`,
      ),
      node(
        "span",
        "",
        until > 0
          ? `Storm arrives after turn ${m.deadline}; ${until} turns remain before pressure.`
          : `Storm now deals ${DIFFICULTIES[state.difficulty].storm + Math.floor((state.turn - m.deadline) / 2)} beacon damage each enemy turn.`,
      ),
    );
    view.append(objective);
    const layout = node("div", "ironwood-layout"),
      map = node("div", "ironwood-map");
    map.setAttribute("role", "group");
    map.setAttribute(
      "aria-label",
      "Battlefield. Eight columns, seven rows. Red tiles show enemy intent.",
    );
    const moves = new Set(
        movementOptions(state, selected).map((p) => `${p.x},${p.y}`),
      ),
      threat = new Map();
    for (const e of state.enemies) {
      if (e.hp <= 0 || e.staggered || e.intent.kind === "advance") continue;
      for (const p of visibleIntent(state, e)) {
        const key = `${p.x},${p.y}`;
        if (!threat.has(key)) threat.set(key, []);
        threat.get(key).push(state.enemies.indexOf(e) + 1);
      }
    }
    for (const tile of state.tiles) {
      const { x, y, kind } = tile,
        hero = state.heroes.find((h) => h.hp > 0 && h.x === x && h.y === y),
        enemy = state.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y),
        unit = hero || enemy,
        ward = state.wards.find((w) => w.x === x && w.y === y),
        intent = threat.get(`${x},${y}`),
        valid =
          mode === "move"
            ? moves.has(`${x},${y}`)
            : previewAction(state, selected, mode, x, y).ok;
      const b = button(
        "",
        "tile",
        { x, y },
        `ironwood-tile tile-${kind}${ward?.sealed ? " is-sealed" : ""}${hero?.id === selected ? " is-selected" : ""}${valid ? (mode === "move" ? " is-reachable" : " is-target") : ""}${intent ? " is-threatened" : ""}${cursor.x === x && cursor.y === y ? " is-cursor" : ""}`,
      );
      b.tabIndex = cursor.x === x && cursor.y === y ? 0 : -1;
      let text = `${coord(x, y)}, ${kind}${ward?.sealed ? ", sealed" : ""}${unit ? `, ${hero ? HEROES[hero.id].name : enemy.name}, ${unit.hp} HP${enemy?.staggered ? ", intent canceled" : ""}` : ""}${intent ? `, threatened by enemies ${intent.join(", ")}` : ""}${valid ? ", valid destination" : ""}`;
      b.setAttribute("aria-label", text);
      b.title = text;
      b.append(node("span", "ironwood-tile-label", coord(x, y)));
      if (kind === "beacon")
        b.append(node("span", "ironwood-beacon-glyph", "✦"));
      if (kind === "ward")
        b.append(node("span", "ironwood-ward-glyph", ward?.sealed ? "◆" : "◇"));
      if (unit) {
        b.append(sprite(hero ? hero.id : enemy.kind));
        const hp = node("span", "ironwood-unit-hp", `${unit.hp}`);
        hp.style.setProperty("--health", String(unit.hp / unit.maxHp));
        b.append(hp);
        if (enemy)
          b.append(
            node(
              "span",
              "ironwood-unit-number",
              String(state.enemies.indexOf(enemy) + 1),
            ),
          );
        if (enemy?.staggered) b.append(node("span", "ironwood-stagger", "×"));
      }
      if (intent)
        b.append(node("span", "ironwood-intent-mark", intent.join("·")));
      map.append(b);
    }
    const board = node("div", "ironwood-board");
    board.append(map);
    const legend = node("div", "ironwood-legend");
    legend.append(
      node("span", "legend-move", "MOVE"),
      node("span", "legend-danger", "ENEMY INTENT"),
      node("span", "legend-target", "ACTION TARGET"),
    );
    board.append(legend);
    layout.append(board);
    const aside = node("aside", "ironwood-sidebar");
    aside.append(node("small", "", "YOUR GUARDIANS"));
    const heroList = node("div", "ironwood-heroes");
    for (const [i, h] of state.heroes.entries()) {
      const b = button(
        "",
        "hero",
        { hero: h.id },
        `ironwood-hero${h.id === selected ? " is-selected" : ""}${h.hp <= 0 ? " is-down" : ""}`,
      );
      b.disabled = h.hp <= 0;
      b.setAttribute("aria-pressed", String(h.id === selected));
      b.append(sprite(h.id));
      const body = node("span", "ironwood-hero-copy");
      body.append(
        node("strong", "ironwood-hero-name", `${i + 1} · ${HEROES[h.id].name}`),
        node(
          "span",
          "ironwood-bars",
          h.hp > 0
            ? `${h.hp}/${h.maxHp} HP · ${h.move} MOVE · ${h.action} ACT${h.shield ? ` · ${h.shield} SHIELD` : ""}`
            : "Fallen · cannot revive this expedition",
        ),
      );
      b.append(body);
      heroList.append(b);
    }
    aside.append(heroList);
    const hero = state.heroes.find((h) => h.id === selected),
      actions = node("div", "ironwood-actions");
    for (const [modeId, title] of [
      ["move", "Move"],
      ["attack", HEROES[selected].skill],
      ...(selected === "warden" ? [["brace", "Brace"]] : []),
      ["mend", "Mend"],
      ...(state.wards.some((w) => !w.sealed) ? [["seal", "Seal ward"]] : []),
    ]) {
      const b = button(
        title,
        "mode",
        { mode: modeId },
        mode === modeId ? "is-active" : "",
      );
      b.disabled =
        hero.hp <= 0 ||
        (modeId === "move" ? hero.move <= 0 : hero.action <= 0) ||
        (modeId === "mend" && state.bandages <= 0);
      b.setAttribute("aria-pressed", String(mode === modeId));
      actions.append(b);
    }
    aside.append(
      actions,
      node("p", "ironwood-preview", preview(cursor.x, cursor.y).text),
    );
    const prediction = forecast(state),
      harm = prediction.filter(
        (e) => ["hit", "beacon"].includes(e.kind) && e.damage > 0,
      );
    const summary = node("div", "ironwood-forecast");
    summary.append(
      node("strong", "", "IF YOU END TURN NOW"),
      node(
        "p",
        "",
        harm.length
          ? harm
              .map(
                (e) =>
                  `${e.unit ? HEROES[e.unit].name.split(" · ")[0] : "Heartwood"} −${e.damage} HP${e.source === "storm" ? " (storm)" : ""}`,
              )
              .join(" · ")
          : "No guardian or beacon damage.",
      ),
    );
    aside.append(
      summary,
      button("End turn →", "end-turn", {}, "ironwood-primary"),
    );
    const intents = node("div", "ironwood-intents");
    intents.append(node("small", "", "ENEMY RESOLUTION ORDER"));
    state.enemies.forEach((e, i) => {
      if (e.hp <= 0) return;
      const item = node(
        "div",
        `ironwood-intent${e.staggered ? " is-canceled" : ""}`,
      );
      item.append(
        node(
          "b",
          "",
          `${i + 1} · ${e.name} · ${e.hp} HP${e.intent.beaconDamage ? " · ROOTED" : ""}`,
        ),
        node(
          "span",
          "",
          e.staggered
            ? "CANCELED · displaced"
            : `${e.intent.label}${e.intent.beaconDamage ? ` · ${e.intent.beaconDamage} HEARTWOOD SIEGE` : ""}${e.intent.damage ? ` · ${e.intent.damage} DAMAGE` : ` · ${e.intent.cells.length} TILES`}`,
        ),
      );
      intents.append(item);
    });
    aside.append(intents);
    layout.append(aside);
    view.append(layout);
  }
  function renderReward() {
    const p = node("section", "ironwood-decision");
    p.append(
      node("small", "", "CROSSING SECURED · CHOOSE ONE"),
      node("h2", "", "Carry something forward."),
      node(
        "p",
        "",
        "Health, bandages and the beacon persist. Fallen guardians cannot be revived.",
      ),
    );
    const row = node("div", "ironwood-reward-grid");
    for (const id of state.rewards) {
      const b = button("", "reward", { id }, "ironwood-reward");
      b.append(
        node(
          "span",
          "ironwood-reward-glyph",
          {
            edge: "⚔",
            boots: "↗",
            bark: "❧",
            veil: "✦",
            thread: "⌁",
            salve: "✚",
            beacon: "◆",
            camp: "♧",
          }[id],
        ),
        node("strong", "", RELICS[id].name),
        node("span", "", RELICS[id].text),
        node("b", "", "Take this onward →"),
      );
      row.append(b);
    }
    p.append(row);
    if (state.relics.length)
      p.append(
        node(
          "p",
          "ironwood-relic-list",
          `Carried: ${state.relics.map((id) => RELICS[id].name).join(" · ")}`,
        ),
      );
    view.append(p);
  }
  function renderEnd() {
    const p = node("section", "ironwood-end");
    p.append(
      node(
        "small",
        "",
        state.phase === "won" ? "NINE CROSSINGS SECURED" : "EXPEDITION ENDED",
      ),
      node(
        "h2",
        "",
        state.phase === "won"
          ? "The Heartwood still shines."
          : "The road remembers.",
      ),
      node("p", "", state.result),
      node(
        "strong",
        "",
        state.phase === "won"
          ? `${state.score} RENOWN · ${DIFFICULTIES[state.difficulty].label}`
          : "A record is earned by a complete nine-crossing expedition.",
      ),
      button("New expedition →", "restart", {}, "ironwood-primary"),
      button(`Replay seed ${state.seed}`, "replay", {}, "ironwood-secondary"),
    );
    view.append(p);
  }
  function renderHelp() {
    const d = node("details", "ironwood-help");
    d.open = helpOpen;
    d.append(node("summary", "", "Field guide · controls, cover and intent"));
    const p = node("div", "ironwood-help-text");
    p.append(
      node(
        "p",
        "",
        `Select a guardian with 1 / 2 / 3 or tap their portrait. Choose Move or a named action, then tap a tile. ${displayKey("W A S D")} / arrows move the grid cursor; Enter selects its tile. E ends the turn. F chooses attack, M chooses movement. Each guardian has 3 move and 1 action. Movement and action can be used in either order.`,
      ),
      node(
        "p",
        "",
        "Shove: adjacent 6 damage then push. Longshot: cardinal range 6, 5 damage, stops at the first body or cover. Threadpull: cardinal range 3, 4 damage then pull. A successful push or pull cancels that foe’s current intent. A blocked push deals +2 damage but does not cancel it. Water defeats ordinary foes. Bosses are rooted: push and pull deal their collision bonus but cannot move them or cancel their intent.",
      ),
      node(
        "p",
        "",
        "Low cover blocks bodies and arrows; an attack can break it. Red marks are locked attack tiles. Enemy arrows stop at the first current body. Cross blasts and royal lines ignore cover. Intents resolve in their numbered order; the forecast includes interception, shield and storm. Advance is a movement-only enemy turn. Each living boss also drains 1 / 2 / 3 Heartwood HP per turn in the three biomes; the forecast includes this siege pressure. A royal line can also hit Heartwood, on top of that siege damage.",
      ),
      node(
        "p",
        "",
        "Brace shields the Warden and adjacent allies for 5. Mend uses one of your 3 starting bandages to recover 5 HP on yourself or an adjacent ally. Health persists between crossings. Shield expires each turn. Fire deals 2 HP on entry and again at turn end; snow costs 2 movement. Seal a ward while on or beside it, spending one action.",
      ),
      node(
        "p",
        "",
        "Keep the beacon alive and clear all nine crossings. Storm pressure rises after the displayed deadline; enemy damage also grows after turn 6. Difficulty changes start a new run. Only a completed expedition earns a difficulty-specific record. Seeds reproduce terrain, enemy setups and reward drafts.",
      ),
    );
    d.append(p);
    view.append(d);
  }
  function clicked(e) {
    const b = e.target.closest("button[data-action]");
    if (!b || !view.contains(b) || b.disabled) return;
    const a = b.dataset.action;
    if (a === "resume") {
      controller.togglePause();
      return;
    }
    if (state.phase === "paused") return;
    if (a === "restart") {
      controller.restart();
      return;
    }
    if (a === "replay") {
      state = createState({ seed: state.seed, difficulty: state.difficulty });
      selected = "warden";
      mode = "move";
      cursor = { x: 2, y: 5 };
      render();
      return;
    }
    if (a === "hero") {
      selected = b.dataset.hero;
      mode = "move";
      const h = state.heroes.find((h) => h.id === selected);
      cursor = { x: h.x, y: h.y };
      render();
    } else if (a === "mode") {
      mode = b.dataset.mode;
      if (mode === "brace") {
        const h = state.heroes.find((h) => h.id === selected);
        run("act", { hero: selected, mode, x: h.x, y: h.y });
        mode = "move";
        render();
      } else render();
    } else if (a === "tile")
      chooseTile(Number(b.dataset.x), Number(b.dataset.y));
    else run(a, { id: b.dataset.id });
  }
  function hover(e) {
    const b = e.target.closest('[data-action="tile"]');
    if (!b || state.phase !== "battle") return;
    cursor = { x: Number(b.dataset.x), y: Number(b.dataset.y) };
    previewUpdate();
  }
  function keydown(e) {
    if (
      destroyed ||
      e.defaultPrevented ||
      e.repeat ||
      e.isComposing ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      state.phase !== "battle"
    )
      return;
    if (
      e.target instanceof Element &&
      e.target.closest('input,select,textarea,summary,[contenteditable="true"]')
    )
      return;
    const key = gameKey(e).toLowerCase();
    if (/^[123]$/.test(key)) {
      const h = state.heroes[Number(key) - 1];
      if (h.hp > 0) {
        e.preventDefault();
        selected = h.id;
        cursor = { x: h.x, y: h.y };
        mode = "move";
        render();
      }
      return;
    }
    const directions = {
      w: [0, -1],
      s: [0, 1],
      a: [-1, 0],
      d: [1, 0],
      arrowup: [0, -1],
      arrowdown: [0, 1],
      arrowleft: [-1, 0],
      arrowright: [1, 0],
    };
    if (directions[key]) {
      e.preventDefault();
      const [dx, dy] = directions[key];
      cursor = {
        x: Math.max(0, Math.min(WIDTH - 1, cursor.x + dx)),
        y: Math.max(0, Math.min(HEIGHT - 1, cursor.y + dy)),
      };
      previewUpdate();
    } else if (key === "enter") {
      if (
        e.target.closest?.("button") &&
        !e.target.matches('[data-action="tile"]')
      )
        return;
      e.preventDefault();
      chooseTile(cursor.x, cursor.y);
    } else if (key === "e") {
      if (e.target.closest?.("button") && !view.contains(e.target)) return;
      e.preventDefault();
      run("end-turn");
    } else if (key === "f" || key === "m") {
      e.preventDefault();
      mode = key === "f" ? "attack" : "move";
      render();
    }
  }
  function changed(e) {
    if (!e.target.matches(".ironwood-difficulty") || state.phase === "paused")
      return;
    state = createState({ seed: state.seed, difficulty: e.target.value });
    selected = "warden";
    mode = "move";
    cursor = { x: 2, y: 5 };
    render();
  }
  function blur() {
    if (!destroyed && !["paused", "won", "lost"].includes(state.phase))
      controller.togglePause();
  }
  function visibility() {
    if (document.hidden) blur();
  }
  view.addEventListener("click", clicked);
  view.addEventListener("pointermove", hover);
  view.addEventListener("change", changed);
  window.addEventListener("keydown", keydown);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
  const unsubscribe = subscribeKeyboardLayout(() => render());
  const controller = {
    getState: () => copy(state),
    restart() {
      if (destroyed) return;
      state = createState({ difficulty: state.difficulty });
      selected = "warden";
      mode = "move";
      cursor = { x: 2, y: 5 };
      render();
    },
    togglePause() {
      if (!destroyed && togglePause(state)) render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      view.removeEventListener("click", clicked);
      view.removeEventListener("pointermove", hover);
      view.removeEventListener("change", changed);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      view.remove();
    },
  };
  render();
  return controller;
}
