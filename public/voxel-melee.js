/** Shared melee handling for the authoritative simulation and its presentation. */
// Preserve the Breach sword profile while Royale's starter knife trades reach
// and damage for quicker recovery. Distances are metres; durations are 120 Hz ticks.
export const MELEE = Object.freeze({ startupTicks: 18, activeTicks: 12, recoveryTicks: 42, damage: 55, reach: 2.15, arcRadians: .64, speed: 5.85 });
export const KNIFE = Object.freeze({ startupTicks: 10, activeTicks: 8, recoveryTicks: 26, damage: 28, reach: 1.3, arcRadians: .64, speed: 6.1 });

export const meleeWeaponId = player => player?.meleeWeapon === 'knife' ? 'knife' : 'sword';
export const meleeProfile = player => meleeWeaponId(player) === 'knife' ? KNIFE : MELEE;
export const meleeLabel = player => meleeWeaponId(player) === 'knife' ? 'KNIFE' : 'SWORD';
