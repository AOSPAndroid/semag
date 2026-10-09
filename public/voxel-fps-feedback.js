import { SPRINT } from './voxel-engine.js';
import { WEAPONS, weaponAimFovRatio } from './voxel-weapons.js';
import { weaponReloadDuration } from './voxel-fire-modes.js';
import { weaponReloadPose } from './voxel-player-animation.js';
import { KNIFE_SECONDARY, PARRY_PROFILES, MELEE_PRESS_BUFFER_TICKS, meleeLabel, meleeProfile, meleeWeaponId, meleeSlashPhase, parryProfile, parryPhase } from './voxel-melee.js';
import { selectedInventoryItem } from './voxel-inventory.js';

/** Keep hip turn speed; ADS adds deliberate fine control to the weapon's zoom. */
export const ADS_LOOK_CONTROL = Object.freeze({ precisionMultiplier: .55 });

export function aimFraction(player, ticks = 18, { requireGun = false } = {}) {
  if (!player || player.alive === false || player.hasGun === false || requireGun && !player.hasGun || player.slot != null && player.slot !== 'primary' || player.healing || player.healTicks > 0 || player.reloadTicks > 0 || player.grenadeThrowTicks > 0) return 0;
  if (WEAPONS[player.weapon]?.adsSupported === false || WEAPONS[player.weapon]?.adsEnabled === false) return 0;
  const duration = Number.isFinite(ticks) && ticks > 0 ? ticks : 18;
  return Math.max(0, Math.min(1, Number.isFinite(player.aimTicks) ? player.aimTicks / duration : 0));
}

export function aimLookMultiplier(player, ads = {}, options = {}) {
  if (typeof player?.weapon !== 'string' || !Object.hasOwn(WEAPONS, player.weapon)) return 1;
  const progress = aimFraction(player, ads.ticks, options), smooth = progress * progress * (3 - 2 * progress);
  const aimed = weaponAimFovRatio(player.weapon, ads) * ADS_LOOK_CONTROL.precisionMultiplier;
  return 1 + (aimed - 1) * smooth;
}

const finiteTicks = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const actionProgress = (label, remaining, total) => ({ label, remaining, total, percent: Math.max(0, Math.min(100, 100 - remaining / total * 100)) });

/** One existing weapon line and action rail show accepted melee timing. */
export function meleeActionReadout(player, profile = meleeProfile(player)) {
  if (player?.slot !== 'sword' || player.alive === false || player.healing || player.healTicks > 0) return null;
  const bladeName = meleeLabel(player).toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
  const guard = parryProfile(player), guardTicks = finiteTicks(player.parryTicks), attackTicks = Math.max(finiteTicks(player.meleeTicks), finiteTicks(player.meleeCooldown));
  const secondary = profile.id === 'knife' && player.meleeAction === 'secondary';
  if (guard && guardTicks) {
    const phase = parryPhase(player).phase;
    return { state: phase, ammo: player.parryConsumed ? 'PARRIED' : ({ startup: 'SET', active: 'PARRY', recovery: 'RECOVER' })[phase] || 'RECOVER',
      status: `${(guardTicks / 120).toFixed(1)}S · ${player.parryConsumed ? 'PARRIED / RECOVERING' : phase === 'startup' ? 'SETTING GUARD' : phase === 'active' ? 'PARRY WINDOW' : 'GUARD RECOVERY'}`,
      progress: actionProgress(`${bladeName} parry and recovery`, guardTicks, guard.startupTicks + guard.activeTicks + guard.recoveryTicks) };
  }
  if (attackTicks) {
    const phase = player.meleeTicks > 0 ? player.meleePhase : 'recovery';
    const held = selectedInventoryItem(player);
    const queued = Number.isSafeInteger(player.pendingMeleeTicks) && player.pendingMeleeTicks > 0 && player.pendingMeleeTicks <= MELEE_PRESS_BUFFER_TICKS
      && player.meleeAction === 'primary' && phase === 'recovery' && meleeSlashPhase(player).phase === 'recovery'
      && finiteTicks(player.meleeTicks) <= MELEE_PRESS_BUFFER_TICKS && finiteTicks(player.meleeCooldown) <= MELEE_PRESS_BUFFER_TICKS
      && held?.kind === 'melee' && held.weapon === meleeWeaponId(player) && profile.id === held.weapon
      && !player.reloadTicks && !player.grenadeThrowTicks && !player.parryTicks && !player.triggerBlocked;
    return { state: phase || 'recovery', ammo: ({ startup: 'WINDUP', active: secondary ? 'STAB' : 'STRIKE', recovery: 'RECOVER' })[phase] || 'RECOVER',
      status: `${(attackTicks / 120).toFixed(1)}S · ${phase === 'startup' ? secondary ? 'COMMITTING STAB' : 'COMMITTING' : phase === 'active' ? secondary ? 'STAB ACTIVE' : 'BLADE ACTIVE' : 'RECOVERING'}${queued ? ' · NEXT STRIKE QUEUED' : ''}`,
      progress: actionProgress(`${bladeName} ${secondary ? 'stab' : 'attack'} and recovery`, attackTicks, profile.startupTicks + profile.activeTicks + profile.recoveryTicks) };
  }
  const cooldown = Math.max(finiteTicks(player.parryCooldown), finiteTicks(player.meleeSecondaryCooldown));
  const action = guard ? 'PARRY' : 'STAB';
  if (cooldown) return { state: 'cooldown', ammo: 'READY', status: `${action} ${(cooldown / 120).toFixed(1)}S · LMB STRIKE`, progress: actionProgress(`${bladeName} ${action.toLowerCase()} cooldown`, cooldown, Math.max(cooldown, guard?.cooldownTicks || KNIFE_SECONDARY.startupTicks + KNIFE_SECONDARY.activeTicks + KNIFE_SECONDARY.recoveryTicks)) };
  if (guard && Number.isFinite(player.stamina) && player.stamina < guard.staminaCost) return { state: 'stamina', ammo: 'READY', status: `PARRY NEEDS ${guard.staminaCost} STAMINA`, progress: null };
  if (player.meleeAimBlocked) return { state: 'release', ammo: 'READY', status: `RELEASE RMB · LMB STRIKE`, progress: null };
  return { state: 'ready', ammo: 'READY', status: guard ? 'LMB STRIKE · RMB PARRY' : 'LMB QUICK · RMB STAB', progress: null };
}

/** RMB keeps one wire action; the selected physical item gives it its meaning. */
export function secondaryActionPresentation(player, { active = true, requireGun = false } = {}) {
  const valid = active && !!player && player.alive !== false && !player.healing && !(player.healTicks > 0) && !(player.reloadTicks > 0) && !(player.grenadeThrowTicks > 0);
  if (valid && player.slot === 'sword') {
    const kind = meleeProfile(player).id === 'knife' ? 'stab' : 'parry', readout = meleeActionReadout(player);
    const pressed = kind === 'stab' ? player.meleeAction === 'secondary' && finiteTicks(player.meleeTicks) > 0 : finiteTicks(player.parryTicks) > 0;
    const instruction = kind === 'stab' ? 'Press for a stronger knife stab; release before the next stab' : `Press to parry an incoming melee attack; face it and time the press; costs ${parryProfile(player).staminaCost} stamina; release before the next parry`;
    return Object.freeze({ kind, label: kind.toUpperCase(), pressed, state: readout.state, detail: readout.status, ariaLabel: `${instruction}. ${readout.status}` });
  }
  if (valid && (!requireGun || player.hasGun) && player.hasGun !== false && (player.slot == null || player.slot === 'primary') && typeof player.weapon === 'string' && Object.hasOwn(WEAPONS, player.weapon)) {
    const weapon = WEAPONS[player.weapon], alternate = weapon.alternateFire;
    if (alternate) {
      const kind = alternate.mode === 'airburst' ? 'airburst' : 'burst';
      const held = player.previousInput?.aim === true || player.meleeAimBlocked;
      const state = held ? 'release' : finiteTicks(player.shotCooldown) ? 'recovery' : 'ready';
      const instruction = kind === 'airburst' ? 'Press for a shell that opens into five pellets after 7.5 metres; release before firing again' : 'Press for up to three simultaneous rounds; release before firing again';
      const detail = state === 'release' ? 'Release RMB before firing' : state === 'recovery' ? 'Recovering from the accepted shot' : instruction;
      return Object.freeze({ kind, label: kind.toUpperCase(), pressed: held, state, detail, ariaLabel: `${instruction}. ${detail}` });
    }
    if (weapon.adsSupported === false || weapon.adsEnabled === false) return Object.freeze({ kind: 'none', label: 'HIP', pressed: false, state: 'inactive', detail: 'This weapon fires from the hip', ariaLabel: 'This weapon has no aiming sights; fire from the hip' });
    return Object.freeze({ kind: 'aim', label: 'AIM', pressed: !!player.aiming, state: player.aiming ? 'aiming' : 'ready', detail: 'Hold for gun sights and slower, precise look control', ariaLabel: 'Hold to aim down sights; slower, precise look control' });
  }
  return Object.freeze({ kind: 'none', label: 'AIM', pressed: false, state: 'inactive', detail: 'Equip a gun or blade in combat', ariaLabel: 'Aim, knife stab or blade parry; equip a gun or blade in combat' });
}

/** No layout reads, input changes or new HUD elements. */
export function paintSecondaryAction(button, presentation) {
  if (!button) return;
  if (button.textContent !== presentation.label) button.textContent = presentation.label;
  for (const [name, value] of Object.entries({ 'aria-label': presentation.ariaLabel, 'aria-pressed': String(presentation.pressed), 'data-secondary': presentation.kind, 'data-secondary-state': presentation.state, title: presentation.detail })) if (button.getAttribute(name) !== value) button.setAttribute(name, value);
}

/** A physical clash requires its accepted event; a held guard never makes sound. */
export function createParryAudioReporter(audio) {
  const seen = new Set(), limit = 512;
  let reports = 0;
  return {
    consume(events, localId, { context = '', viewedId = localId, active = true } = {}) {
      for (const event of events || []) {
        if (event?.type !== 'meleeParry' || event.playerId == null || event.targetId == null || event.playerId === event.targetId || ![localId, viewedId].some(id => id != null && (id === event.playerId || id === event.targetId)) || typeof event.weapon !== 'string' || !Object.hasOwn(PARRY_PROFILES, event.weapon) || ![event.x, event.y, event.z].every(Number.isFinite) || !Number.isSafeInteger(event.parryIndex) || event.parryIndex < 0 || !Number.isSafeInteger(event.parryStartTick) || event.parryStartTick < 0) continue;
        const key = JSON.stringify([context, event.playerId, event.defenderLifeId ?? 0, event.defenderDeaths ?? 0, event.parryIndex, event.parryStartTick, event.weapon]);
        if (seen.has(key)) continue;
        seen.add(key); if (seen.size > limit) seen.delete(seen.values().next().value);
        if (active && audio?.enabled) try { if (audio.meleeParry?.(event.weapon) === true) reports++; } catch { /* Optional sound. */ }
      }
    },
    reset() { seen.clear(); },
    inspect() { return Object.freeze({ reports, trackedParries: seen.size, limit }); },
  };
}

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
      const duration = weaponReloadDuration(weapon, player?.ammo);
      const subject = JSON.stringify([context, player?.id, player?.lifeId ?? 0, player?.deaths ?? 0, player?.weapon]);
      const valid = !!weapon && player?.alive !== false && !['sword', 'potion', 'grenade', 'empty'].includes(player?.slot) && Number.isInteger(remaining) && remaining > 0 && remaining <= duration && Number.isSafeInteger(tick);
      const continuous = previous?.subject === subject && previous.active && active && tick >= previous.tick;
      if (valid) {
        const startTick = tick + remaining - duration, progress = 1 - remaining / duration;
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
