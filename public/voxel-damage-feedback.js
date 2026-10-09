import { WEAPONS } from './voxel-weapons.js';
import { MELEE_WEAPONS } from './voxel-melee.js';
import { setHidden } from './hub/dom.js';

export const DAMAGE_CUE_MS = 420;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Only authoritative HP-loss events create incoming feedback, never bullet contacts. */
export function incomingDamageFeedback(event, player, players = [], { now = 0, lifeKey = 0, friendlyFire = false } = {}) {
  const target = event?.targetId ?? event?.victimId ?? event?.target;
  if (event?.type !== 'damage' || !Number.isFinite(event.damage) || event.damage <= 0 || !Number.isFinite(event.hp) || event.hp < 0 || target == null || target !== player?.id || event.attack === 'disconnect') return null;
  const sourceId = event.shooterId ?? event.attackerId ?? event.playerId ?? event.ownerId ?? event.attacker;
  const source = players.find(other => other.id === sourceId);
  if (!friendlyFire && source && source.id !== player.id && source.team != null && source.team === player.team) return null;
  const blade = Object.hasOwn(MELEE_WEAPONS, event.weapon) || Object.hasOwn(MELEE_WEAPONS, event.attack);
  const blood = blade || ['gun', 'bolt'].includes(event.attack) || !!WEAPONS[event.weapon];
  const maxHp = Number.isFinite(player.maxHp) && player.maxHp > 0 ? player.maxHp : 200;
  // A delayed bolt keeps its incoming trajectory even if its owner moves away.
  const trajectory = ['gun', 'bolt'].includes(event.attack) && [event.dx, event.dz].every(Number.isFinite) && Math.hypot(event.dx, event.dz) > 1e-6;
  const directional = source && source.id !== player.id && [source.x, source.z, player.x, player.z].every(Number.isFinite) && Math.hypot(source.x - player.x, source.z - player.z) > .05;
  return { subjectId: player.id, lifeKey, at: now, until: now + DAMAGE_CUE_MS,
    kind: blood ? 'blood' : event.attack === 'storm' ? 'hazard' : 'impact',
    strength: clamp(.21 + event.damage / maxHp * .48, .21, .42),
    bearing: trajectory ? Math.atan2(-event.dx, event.dz) : directional ? Math.atan2(source.x - player.x, player.z - source.z) : null };
}

/** A camera change or restored life cannot inherit somebody else's damage. */
export function damageFeedbackPresentation(feedback, player, { now = 0, lifeKey = 0, yaw = player?.yaw || 0, active = true } = {}) {
  if (!feedback || !active || !player?.alive || feedback.subjectId !== player.id || feedback.lifeKey !== lifeKey || now >= feedback.until || now < feedback.at) return { visible: false };
  const remaining = clamp((feedback.until - now) / DAMAGE_CUE_MS, 0, 1);
  const angle = feedback.bearing == null ? null : Math.atan2(Math.sin(feedback.bearing - yaw), Math.cos(feedback.bearing - yaw));
  const direction = angle == null ? '' : Math.abs(angle) <= Math.PI / 4 ? 'front' : Math.abs(angle) >= Math.PI * 3 / 4 ? 'back' : angle > 0 ? 'right' : 'left';
  return { visible: true, subjectId: feedback.subjectId, kind: feedback.kind, opacity: feedback.strength * remaining ** .7, angle, direction };
}

/** Reuse one small overlay; no particles or DOM nodes are allocated while firing. */
export function paintDamageFeedback(element, presentation) {
  setHidden(element, !presentation.visible);
  if (!presentation.visible) return;
  const values = { kind: presentation.kind, subject: String(presentation.subjectId), direction: presentation.direction };
  for (const [key, value] of Object.entries(values)) if (element.dataset[key] !== value) element.dataset[key] = value;
  for (const [key, value] of [['--damage-opacity', String(presentation.opacity)], ['--damage-angle', `${presentation.angle || 0}rad`]]) {
    if (element.style.getPropertyValue?.(key) !== value) element.style.setProperty(key, value);
  }
}
