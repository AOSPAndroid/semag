/** Local-only blade impact feel: hit-stop, camera kick and an execution zoom pulse.
 * Pure presentation. Nothing here feeds authority or prediction; it only
 * reads confirmed events and returns a short-lived camera offset plus a
 * flag that holds the first-person blade pose for a few frames on contact. */
import { MELEE_WEAPONS } from './voxel-melee.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** Weight classes: a knife flicks, a sword bites, an axe lands. */
export const BLADE_WEIGHT = Object.freeze({
  knife: { stopMs: 34, kick: .010 }, tonfas: { stopMs: 42, kick: .013 },
  sword: { stopMs: 58, kick: .018 }, katana: { stopMs: 54, kick: .017 },
  axe: { stopMs: 86, kick: .028 }, spear: { stopMs: 52, kick: .016 },
  hatchet: { stopMs: 50, kick: .016 }, whip: { stopMs: 30, kick: .009 },
});
export const BLADE_FEEL = Object.freeze({
  finisherMultiplier: 1.5, flinchKick: .022, clashStopMs: 70, clashKick: .024, blockKick: .012,
  executionMs: 420, executionZoom: .07, decayPerSecond: 18,
});
const weightFor = weapon => BLADE_WEIGHT[weapon] || (Object.hasOwn(MELEE_WEAPONS, weapon) ? BLADE_WEIGHT.sword : BLADE_WEIGHT.knife);

export function createBladeFeel() {
  let stopUntil = -Infinity, slowFrom = -Infinity, kickPitch = 0, kickYaw = 0, kickRoll = 0, last = null, flip = 1, lastSwing = null;
  const kick = (pitch, yaw = 0, roll = 0) => {
    flip = -flip; kickPitch += pitch; kickYaw += yaw * flip; kickRoll += roll * flip;
  };
  const feel = {
    /** Feed one confirmed event. `time` is the renderer clock in milliseconds. */
    observe(event, localId, time) {
      if (!event || localId == null) return false;
      const mine = event.playerId === localId, hitMe = event.targetId === localId;
      if (event.type === 'meleeHit' && finite(event.damage) > 0) {
        const weight = weightFor(event.weapon), heavy = event.heavy === true || event.crit === true ? BLADE_FEEL.finisherMultiplier * 1.3 : event.comboFinisher === true || event.slideSlash === true || event.riposte === true || event.sprintHit === true ? BLADE_FEEL.finisherMultiplier : 1;
        if (mine) {
          // One swing kicks once, however many bodies a cleave passes through.
          const swing = `${event.meleeIndex}:${event.meleeStartTick}`;
          stopUntil = Math.max(stopUntil, time + weight.stopMs * heavy);
          if (swing !== lastSwing) { lastSwing = swing; kick(weight.kick * heavy, weight.kick * .45 * heavy, weight.kick * .6); }
          return true;
        }
        if (hitMe) { kick(-BLADE_FEEL.flinchKick * heavy, BLADE_FEEL.flinchKick * .7, BLADE_FEEL.flinchKick); return true; }
      } else if (event.type === 'meleeClash' && (mine || hitMe)) {
        stopUntil = Math.max(stopUntil, time + BLADE_FEEL.clashStopMs); kick(BLADE_FEEL.clashKick, BLADE_FEEL.clashKick * .6, BLADE_FEEL.clashKick); return true;
      } else if (['meleeParry', 'bulletBlock', 'bulletDeflect'].includes(event.type) && (mine || hitMe)) {
        kick(BLADE_FEEL.blockKick, BLADE_FEEL.blockKick * .5); return true;
      } else if (event.type === 'execution' && mine) {
        slowFrom = time; stopUntil = Math.max(stopUntil, time + BLADE_WEIGHT.axe.stopMs); return true;
      }
      return false;
    },
    /** True while the local blade should hold its contact pose. */
    holding(time, { reducedMotion = false } = {}) { return !reducedMotion && time < stopUntil; },
    /** Field-of-view multiplier: a brief zoom-in that eases back after an execution. */
    fovScale(time, { reducedMotion = false } = {}) {
      const age = time - slowFrom;
      if (reducedMotion || !(age >= 0 && age < BLADE_FEEL.executionMs)) return 1;
      return 1 - BLADE_FEEL.executionZoom * Math.sin(Math.PI * age / BLADE_FEEL.executionMs);
    },
    /** The decaying camera offset in radians. Reduced motion keeps the view still. */
    sample(time, { reducedMotion = false } = {}) {
      const dt = last == null ? 0 : Math.max(0, Math.min(.1, (time - last) / 1000)); last = time;
      const decay = Math.exp(-dt * BLADE_FEEL.decayPerSecond);
      kickPitch *= decay; kickYaw *= decay; kickRoll *= decay;
      if (Math.abs(kickPitch) + Math.abs(kickYaw) + Math.abs(kickRoll) < 1e-5) kickPitch = kickYaw = kickRoll = 0;
      return reducedMotion ? { pitch: 0, yaw: 0, roll: 0 } : { pitch: kickPitch, yaw: kickYaw, roll: kickRoll };
    },
    reset() { stopUntil = slowFrom = -Infinity; kickPitch = kickYaw = kickRoll = 0; last = null; flip = 1; lastSwing = null; },
  };
  return feel;
}
