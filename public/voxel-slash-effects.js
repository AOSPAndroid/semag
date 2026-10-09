import { MELEE_WEAPONS, meleeComboLength } from './voxel-melee.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const life = player => Number.isSafeInteger(player?.lifeId) ? player.lifeId : 0;
const color = Object.freeze({ sword: '#d7fbff', katana: '#fff0b5', axe: '#ffd094', tonfas: '#d9c8ff', knife: '#d9ece2' });

/** Only authority-confirmed flesh contacts may create a small blade impact. */
export function createSlashImpactPresenter({ capacity = 128 } = {}) {
  const limit = Math.max(8, Math.min(256, Number.isSafeInteger(capacity) ? capacity : 128)), seen = new Map();
  let contacts = 0;
  const present = (event, state, time, { reducedMotion = false } = {}) => {
    if (event?.type !== 'meleeHit' || !(event.damage > 0) || !Object.hasOwn(MELEE_WEAPONS, event.weapon)
      || ![event.x, event.y, event.z, time].every(Number.isFinite) || !Number.isSafeInteger(event.meleeIndex) || event.meleeIndex < 1
      || !Number.isSafeInteger(event.meleeStartTick) || !Number.isSafeInteger(event.playerId) || !Number.isSafeInteger(event.targetId)
      || Number.isFinite(state?.tick) && Number.isFinite(event.tick) && (state.tick - event.tick > 18 || event.tick > state.tick + 1)) return [];
    const attacker = state?.players?.find(player => player.id === event.playerId), target = state?.players?.find(player => player.id === event.targetId);
    if (!attacker || !target || attacker.id === target.id || attacker.team === target.team
      || event.attackerLifeId !== life(attacker) || event.targetLifeId !== life(target)) return [];
    const key = `${attacker.id}:${life(attacker)}:${event.attackerDeaths || 0}:${event.meleeIndex}:${event.meleeStartTick}:${target.id}:${life(target)}`;
    if (seen.has(key)) return [];
    seen.set(key, true); while (seen.size > limit) seen.delete(seen.keys().next().value);
    contacts++;
    // A preference change or repeated snapshot cannot replay a muted effect.
    if (reducedMotion) return [];
    const dx = finite(target.x) - finite(attacker.x), dz = finite(target.z) - finite(attacker.z), distance = Math.hypot(dx, dz) || 1;
    const outward = [dx / distance, dz / distance], origin = [event.x, event.y, event.z];
    const seed = (event.meleeIndex * 17 + target.id * 7) % 11;
    const finisher = !attacker.monster && !attacker.monsterType && event.comboFinisher === true
      && event.comboStep === event.comboLength && event.comboLength === meleeComboLength(event.weapon);
    return Array.from({ length: 6 }, (_, index) => {
      const angle = seed + index * 2.39996, spread = (.36 + index * .036) * (finisher ? 1.12 : 1);
      return { origin, born: time, vx: Math.sin(angle) * spread - outward[0] * .28, vy: .20 + index * .045 + (finisher ? .04 : 0),
        vz: Math.cos(angle) * spread - outward[1] * .28, color: index < 2 ? '#fff8df' : finisher ? '#ffd872' : color[event.weapon],
        life: 125 + index * 13, gravity: 3, cover: true, radius: .34, size: index < 2 ? .014 : finisher ? .012 : .010,
        material: 'blade', shrink: true, targetId: target.id, contactKey: key, comboFinisher: finisher };
    });
  };
  present.reset = () => { seen.clear(); contacts = 0; };
  present.getStats = () => ({ seenContacts: seen.size, confirmedContacts: contacts, capacity: limit });
  return present;
}
