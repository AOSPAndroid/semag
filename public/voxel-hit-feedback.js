import { setAttribute, setHidden, setText } from './hub/dom.js';

export const HIT_FEEDBACK_MS = Object.freeze({ headshot: 240, body: 180 });
export const HIT_FEEDBACK_COLORS = Object.freeze({ headshot: '#ffd45a', body: '#f47738' });
const NO_HIT = Object.freeze({ visible: false });
const HISTORY_LIMIT = 512;
const sourceId = event => event.shooterId ?? event.attackerId ?? event.playerId ?? event.ownerId ?? event.attacker;
const targetId = event => event.targetId ?? event.victimId ?? event.target;

/** A contact or kill alone cannot paint a hit: require confirmed enemy HP loss. */
export function confirmedEnemyHit(event, player, players = []) {
  if (event?.type !== 'damage' || !Number.isFinite(event.damage) || event.damage <= 0 || !Number.isFinite(event.hp) || event.hp < 0 || !player?.alive || sourceId(event) !== player.id || targetId(event) == null || targetId(event) === player.id || event.attack === 'disconnect') return null;
  const target = players.find(other => other.id === targetId(event));
  if (!target || player.team != null && target.team === player.team) return null;
  const headshot = event.headshot === true || event.hitKind === 'head' || event.hitZone === 'head';
  return { kind: headshot ? 'headshot' : 'body', targetId: target.id, damage: event.damage };
}

/** Pure presentation never changes aim, reticle spread or the simulation clock. */
export function hitFeedbackPresentation(feedback, player, { now = 0, lifeKey = 0, active = true, reducedMotion = false } = {}) {
  if (!feedback || !active || !player?.alive || feedback.subjectId !== player.id || feedback.lifeKey !== lifeKey || now < feedback.at || now >= feedback.until) return NO_HIT;
  return { visible: true, kind: feedback.kind, color: HIT_FEEDBACK_COLORS[feedback.kind], pulse: String(feedback.pulse % 2), reducedMotion,
    symbol: feedback.kind === 'headshot' ? '✦' : '×', at: feedback.at, until: feedback.until };
}

/** One pulse per authoritative attack; all shotgun pellets share that pulse. */
export function createHitFeedback() {
  let current = null, context, pulse = 0;
  const seen = new Set(), attacks = new Map();
  const trim = history => { while (history.size > HISTORY_LIMIT) history.delete(history.keys().next().value); };
  function sync(lifeKey) {
    if (context === lifeKey) return;
    context = lifeKey; current = null; seen.clear(); attacks.clear();
  }
  return {
    consume(events, player, players = [], { now = 0, lifeKey = 0, active = true } = {}) {
      sync(lifeKey);
      const candidates = new Map();
      for (const event of events || []) {
        const identity = event.id ?? `${event.tick}:${event.type}:${sourceId(event)}:${targetId(event)}:${event.weapon}:${event.pellet}:${event.hp}:${event.damage}:${event.hitKind}`;
        if (seen.has(identity)) continue;
        seen.add(identity); trim(seen);
        if (!active) continue;
        const hit = confirmedEnemyHit(event, player, players); if (!hit) continue;
        // The trigger tick identifies one shell/swing even if it hits several targets.
        const attackKey = Number.isFinite(event.tick) ? `${event.tick}:${sourceId(event)}:${event.weapon || event.attack || ''}` : `event:${identity}`;
        const previous = candidates.get(attackKey);
        candidates.set(attackKey, { ...hit, damage: hit.damage + (previous?.damage || 0), kind: hit.kind === 'headshot' || previous?.kind === 'headshot' ? 'headshot' : 'body', attackKey });
      }
      let best = null;
      for (const hit of candidates.values()) {
        const previousKind = attacks.get(hit.attackKey);
        if (previousKind === 'headshot' || previousKind === hit.kind) continue;
        attacks.set(hit.attackKey, hit.kind); trim(attacks);
        // A late head pellet upgrades an existing shell without a second impact pulse.
        if (previousKind === 'body' && (!current || current.attackKey !== hit.attackKey || now >= current.until)) continue;
        if (!best || hit.kind === 'headshot' && best.kind !== 'headshot' || hit.kind === best.kind && hit.damage > best.damage) best = hit;
      }
      if (!active || !player?.alive) { current = null; return NO_HIT; }
      if (best && !(best.kind === 'body' && current?.kind === 'headshot' && now < current.until)) {
        const upgrade = current?.attackKey === best.attackKey;
        current = { kind: best.kind, subjectId: player.id, lifeKey, attackKey: best.attackKey, at: upgrade ? current.at : now,
          until: upgrade ? current.at + HIT_FEEDBACK_MS[best.kind] : now + HIT_FEEDBACK_MS[best.kind], pulse: upgrade ? current.pulse : ++pulse };
      }
      return hitFeedbackPresentation(current, player, { now, lifeKey, active });
    },
    present(player, options = {}) {
      sync(options.lifeKey ?? 0);
      const presentation = hitFeedbackPresentation(current, player, options);
      if (!presentation.visible) current = null;
      return presentation;
    },
    // Keep consumed IDs across a pause so an old snapshot cannot replay a hit.
    reset({ clearHistory = false } = {}) { current = null; if (clearHistory) { context = undefined; seen.clear(); attacks.clear(); } },
  };
}

/** Three reusable DOM nodes; unchanged attributes stay out of the render loop. */
export function paintHitFeedback({ crosshair, scope, marker }, presentation) {
  for (const [element, role] of [[crosshair, 'crosshair'], [scope, 'scope'], [marker, 'marker']]) {
    if (!element) continue;
    setAttribute(element, 'data-hit-role', role);
    setAttribute(element, 'data-hit-kind', presentation.visible ? presentation.kind : '');
    setAttribute(element, 'data-hit-pulse', presentation.visible ? presentation.pulse : '');
    setAttribute(element, 'data-hit-motion', presentation.visible && presentation.reducedMotion ? 'reduced' : 'full');
    if (role === 'marker') {
      setHidden(element, !presentation.visible);
      if (presentation.visible) { setAttribute(element, 'data-kind', presentation.kind); setText(element, presentation.symbol); }
    }
  }
}
