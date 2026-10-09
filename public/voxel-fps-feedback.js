import { SPRINT } from './voxel-engine.js';
import { WEAPONS } from './voxel-weapons.js';
import { weaponReloadPose } from './voxel-player-animation.js';

/** The small blue rail reflects the same actor as the first-person camera. */
export function staminaPresentation(player, { name = 'Your', active = true } = {}) {
  const max = SPRINT.maxStamina, raw = player?.stamina;
  const available = active && player?.alive !== false && Number.isFinite(raw);
  const value = Number.isFinite(raw) ? Math.max(0, Math.min(max, raw)) : 0;
  const state = !available ? 'inactive' : player.sprinting ? 'sprinting' : player.sprintExhausted ? 'exhausted' : value < max ? 'recovering' : 'ready';
  const detail = state === 'exhausted' ? 'Release sprint; recover to 25 before sprinting again' : state === 'sprinting' ? 'Sprinting' : state === 'recovering' ? 'Recovering sprint stamina' : 'Hold Shift to sprint forward; C walks quietly';
  return Object.freeze({ visible: available, value, max, fraction: value / max, state, label: `${name} sprint stamina`, detail });
}

/** No geometry reads or timers; updates only changed DOM values. */
export function paintStamina(meter, fill, presentation) {
  if (!meter || !fill) return;
  if (meter.hidden === presentation.visible) meter.hidden = !presentation.visible;
  const attrs = { 'aria-valuenow': String(Math.round(presentation.value)), 'aria-valuemax': String(presentation.max), 'aria-label': presentation.label, 'aria-valuetext': `${Math.round(presentation.value)} of ${presentation.max}. ${presentation.detail}`, 'data-state': presentation.state };
  for (const [key, value] of Object.entries(attrs)) if (meter.getAttribute(key) !== value) meter.setAttribute(key, value);
  const transform = `scaleX(${presentation.fraction.toFixed(4)})`;
  if (fill.style.transform !== transform) fill.style.transform = transform;
}

/** Observe accepted reload ticks only; display frames never advance the mechanism. */
export function createReloadAudioPresenter(audio) {
  const seen = new Set(), order = [], limit = 512;
  let previous = null, reports = 0;
  const remember = key => { seen.add(key); order.push(key); if (order.length > limit) seen.delete(order.shift()); };
  return {
    observe(player, { tick = 0, context = '', active = true, gain = .58 } = {}) {
      const weapon = WEAPONS[player?.weapon], remaining = player?.reloadTicks;
      const subject = JSON.stringify([context, player?.id, player?.lifeId ?? 0, player?.deaths ?? 0, player?.weapon]);
      const valid = !!weapon && player?.alive !== false && !['sword', 'potion', 'grenade', 'empty'].includes(player?.slot) && Number.isInteger(remaining) && remaining > 0 && remaining <= weapon.reloadTicks && Number.isSafeInteger(tick);
      const continuous = previous?.subject === subject && previous.active && active && tick >= previous.tick;
      if (valid) {
        const startTick = tick + remaining - weapon.reloadTicks, progress = 1 - remaining / weapon.reloadTicks;
        const hands = player.weapon === 'dualpistols' || player.weapon === 'dualsmg' ? [0, 1] : [0];
        for (const hand of hands) {
          const pose = weaponReloadPose(player.weapon, progress, { hand });
          if (!pose.active || ['ready', 'lower', 'fetch', 'return'].includes(pose.audioPhase)) continue;
          const key = JSON.stringify([subject, startTick, pose.hand, pose.audioPhase]);
          if (seen.has(key)) continue;
          remember(key); // Muted, resumed or newly spectated phases never replay later.
          if (continuous && audio?.enabled) try { if (audio.reloadAction?.(player.weapon, pose.audioPhase, { gain }) === true) reports++; } catch { /* Optional audio. */ }
        }
      }
      previous = { subject, tick, active };
    },
    suspend() { if (previous) previous.active = false; audio?.stopReloads?.(); },
    reset() { previous = null; seen.clear(); order.length = 0; audio?.stopReloads?.(); },
    inspect() { return Object.freeze({ reports, trackedPhases: seen.size, limit }); },
  };
}

/** Group a real accepted shell's contacts; no target/pellet creates an extra beep. */
export function createGunImpactReporter(audio) {
  const seen = new Set(), order = [], limit = 512;
  let reports = 0;
  return {
    consume(events, localId, { context = '', viewedId = localId } = {}) {
      const groups = new Map();
      for (const event of events || []) {
        const source = event?.attackerId ?? event?.shooterId ?? event?.playerId;
        const target = event?.targetId ?? event?.victimId;
        if (event?.type !== 'damage' || source == null || source === target || target === localId || ![localId, viewedId].includes(source) || !Number.isFinite(event.damage) || event.damage <= 0 || !Number.isFinite(event.hp) || event.hp < 0 || typeof event.weapon !== 'string' || !Object.hasOwn(WEAPONS, event.weapon) || ![null, undefined, 'gun', 'bolt'].includes(event.attack)) continue;
        const key = JSON.stringify([context, source, event.attackerLifeId ?? 0, event.tick, event.weapon, event.shotIndex ?? null]);
        groups.set(key, groups.get(key) || event.headshot || event.hitKind === 'head');
      }
      for (const [key, head] of groups) {
        if (seen.has(key)) continue;
        seen.add(key); order.push(key); if (order.length > limit) seen.delete(order.shift());
        if (audio?.enabled) try { if (audio.confirmedImpact?.(head ? 'headshot' : 'body') === true) reports++; } catch { /* Optional sound. */ }
      }
    },
    reset() { seen.clear(); order.length = 0; },
    inspect() { return Object.freeze({ reports, trackedShells: seen.size, limit }); },
  };
}
