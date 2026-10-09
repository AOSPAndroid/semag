/** Shared melee handling for the authoritative simulation and its presentation. */
// Preserve the Breach sword profile while Royale's starter knife trades reach
// and damage for quicker recovery. Distances are metres; durations are 120 Hz ticks.
export const MELEE = Object.freeze({ id: 'sword', name: 'Breach Sword', label: 'SWORD', startupTicks: 18, activeTicks: 12, recoveryTicks: 42, damage: 55, reach: 2.15, arcRadians: .64, speed: 5.85, description: 'A balanced committed slash. Moderate reach and recovery leave room to reposition.' });
export const KNIFE = Object.freeze({ id: 'knife', name: 'Survivor Knife', label: 'KNIFE', startupTicks: 10, activeTicks: 8, recoveryTicks: 26, damage: 28, reach: 1.3, arcRadians: .64, speed: 6.1, description: 'A small, quick starter blade. Close the gap and commit each strike carefully.' });

/** Every blade contacts once per committed swing; paired tonfas alternate hands. */
export const MELEE_WEAPONS = Object.freeze({
  knife: KNIFE,
  sword: MELEE,
  katana: Object.freeze({ id: 'katana', name: 'Raven Katana', label: 'KATANA', startupTicks: 12, activeTicks: 10, recoveryTicks: 32, damage: 48, reach: 2.45, arcRadians: .42, speed: 6, description: 'A quick, precise long cut. Commit your direction and punish a close approach.' }),
  axe: Object.freeze({ id: 'axe', name: 'Bulwark Axe', label: 'AXE', startupTicks: 28, activeTicks: 12, recoveryTicks: 58, damage: 88, reach: 2.05, arcRadians: .72, speed: 5.1, description: 'A heavy committed chop. High impact trades wind-up, recovery and movement speed.' }),
  tonfas: Object.freeze({ id: 'tonfas', name: 'Twin Tonfas', label: 'DUAL TONFAS', startupTicks: 7, activeTicks: 7, recoveryTicks: 18, damage: 24, reach: 1.45, arcRadians: .58, speed: 6.15, dualWield: true, description: 'Alternate short, fast strikes with both hands. Close distance carefully; each press is one blow.' }),
});
export const MELEE_IDS = Object.freeze(Object.keys(MELEE_WEAPONS));
export const MELEE_WEAPON_IDS = MELEE_IDS;
export const meleeWeaponId = playerOrId => {
  const id = typeof playerOrId === 'string' ? playerOrId : playerOrId?.meleeWeapon;
  return typeof id === 'string' && Object.hasOwn(MELEE_WEAPONS, id) ? id : 'sword';
};
export const meleeProfile = playerOrId => MELEE_WEAPONS[meleeWeaponId(playerOrId)];
export const meleeLabel = playerOrId => meleeProfile(playerOrId).label;
export const meleeHand = (playerOrId, swingIndex = 1) => meleeProfile(playerOrId).dualWield && Math.max(1, Math.floor(Number.isFinite(swingIndex) ? swingIndex : 1)) % 2 === 0 ? 1 : 0;
