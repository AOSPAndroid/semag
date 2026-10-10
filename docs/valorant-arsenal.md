# Researched voxel arsenal

Research checked **9 October 2026**. The collection contains **20 guns**, alongside all 16 existing Semag guns. Riot's arsenal page lists 19 firearms; the **Warden** was introduced in Riot's 13.06 notes. The supplied 18-gun reference predates the Bandit and Warden. Existing gun IDs remain available. Version 3.40.0 rebalances the three original Semag shotguns; the researched damage bands, magazines and fire rates below remain unchanged.

## Sources and freshness

- [Riot's official arsenal](https://playvalorant.com/en-us/arsenal/) establishes the firearm names and classes. Its uppercase cards include Bandit and Outlaw; its Warden card had not appeared at the time of research.
- [Riot 13.06, 22 September 2026](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-06) announces Warden and specifies its 18-round magazine, 36 reserve, 50 body / 200 head / 42 leg damage at every range, 6.5 shots/s, 2.5 s reload, 2× scope and medium penetration.
- [Riot 12.00](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-00) introduces Bandit, with an 8-round magazine, 24 reserve, 1.5 s reload and medium penetration. [Riot 13.00](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-00) reduces its aim recovery to 0.4 s and maximum pitch recoil to 3 degrees.
- [Riot 9.10](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10) confirms Frenzy's 15 rounds, Ghost's 13 rounds and Phantom's updated two damage bands: 39 body below 20 m, 35 from 20 m onward.
- [Riot 6.11](https://playvalorant.com/en-gb/news/game-updates/valorant-patch-notes-6-11/) reduces Shorty reserve to 6, Phantom reserve to 60 and Vandal reserve to 50.
- [Riot 12.09](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-09) confirms Bucky's new close-range pellet damage, 34 head / 17 body / 14 legs, its 3-degree minimum spread, Judge's 2.5-degree minimum spread and Shorty's 3 shots/s. The source also establishes stronger moving and airborne shotgun penalties.
- [Riot 13.01](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-01) changes Outlaw's first-shot accuracy recovery to 0.15 s, spread to 2.25 degrees and recoil to 4 degrees.
- [Riot 11.08](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08) differentiates controllable Spectre fire and Stinger's faster accumulating spread, and lengthens rifle horizontal recoil cycles.
- [Community VALORANT API weapon data](https://valorant-api.com/v1/weapons) supplies detailed damage ranges, first-shot accuracy, magazines, reloads, movement multipliers, fire rates, pellet counts, ADS multipliers and penetration tiers. It is **community maintained**, rather than Riot's official API. [Its version endpoint](https://valorant-api.com/v1/version) reported `release-13.06`, `13.06.00.5590001`, build date `2026-09-25T18:14:25Z` when retrieved. Those numbers agree with the relevant official changes above.

The official news listing and API exposed 13.06 as the latest available release during verification. The requested 13.07 URL and slash/1307 alternatives returned 404, and 13.07 was absent from the official news index. No 13.07 research is claimed. Older Blitz weapon data still showed Bucky's superseded 40/20/17 close pellet damage and was not used to override Riot's newer notes.

## Gun facts implemented

Damage is **head / body / leg**, per bullet or per individual pellet. Damage bands are flat: their lower limit is inclusive, and the next band begins exactly at its threshold. The last band extends beyond the API's display limit of 50 m. Decimal source damage is retained in actual HP loss; a rounded HUD total does not change damage calculation.

| Gun | Class | Magazine | Hip fire, shots/s | Reload, seconds | Damage bands, metres: head / body / leg |
| --- | --- | ---: | ---: | ---: | --- |
| Classic | Sidearm | 12 | 6.75 | 1.75 | 0–30: 78 / 26 / 22.1; 30+: 66 / 22 / 18.7 |
| Shorty | Sidearm, 15 pellets | 2 | 3 | 1.75 | 0–7: 22 / 11 / 9.35; 7–15: 12 / 6 / 5.1; 15+: 6 / 3 / 2.55 |
| Frenzy | Automatic sidearm | 15 | 10 | 1.5 | 0–20: 78 / 26 / 22.1; 20+: 63 / 21 / 17.85 |
| Ghost | Suppressed sidearm | 13 | 6.75 | 1.5 | 0–30: 105 / 30 / 25.5; 30+: 87.5 / 25 / 21.25 |
| Sheriff | Revolver | 6 | 4 | 2.25 | 0–30: 159.5 / 55 / 46.75; 30+: 145 / 50 / 42.5 |
| Bandit | Precision sidearm | 8 | 5.1 | 1.5 | 0–10: 152 / 39 / 33; 10–30: 128 / 39 / 33; 30+: 112 / 34 / 28 |
| Stinger | SMG | 20 | 16 | 2.25 | 0–15: 67.5 / 27 / 22.95; 15+: 57 / 23 / 19 |
| Spectre | Suppressed SMG | 30 | 13.333 | 2.25 | 0–15: 78 / 26 / 22.1; 15–30: 66 / 22 / 18.7; 30+: 60 / 20 / 17 |
| Bucky | Pump shotgun, 15 pellets | 5 | 1.1 | 2.5 | 0–8: 34 / 17 / 14; 8–12: 26 / 13 / 11.05; 12+: 18 / 9 / 7.65 |
| Judge | Automatic shotgun, 12 pellets | 5 | 3.5 | 2.2 | 0–10: 34 / 17 / 14.45; 10–15: 20 / 10 / 8.5; 15+: 14 / 7 / 5.95 |
| Bulldog | Rifle | 24 | 10 | 2.5 | All: 115.5 / 35 / 29.75 |
| Guardian | Semi-automatic rifle | 12 | 5.25 | 2.5 | All: 195 / 65 / 48.75 |
| Phantom | Suppressed rifle | 30 | 11 | 2.5 | 0–20: 156 / 39 / 33.15; 20+: 140 / 35 / 29.75 |
| Vandal | Rifle | 25 | 9.75 | 2.5 | All: 160 / 40 / 34 |
| Warden | Scoped automatic rifle | 18 | 6.5 | 2.5 | All: 200 / 50 / 42 |
| Marshal | Light bolt sniper | 5 | 1.5 | 2.5 | All: 202 / 101 / 85.85 |
| Outlaw | Two-shot sniper | 2 | 2.75 | 2.3 partly loaded, 3.8 empty | All: 238 / 140 / 119 |
| Operator | Heavy bolt sniper | 5 | 0.6 | 3.7 | All: 255 / 150 / 120 |
| Ares | Machine gun | 50 | 13 | 3.25 | 0–30: 75 / 30 / 25.5; 30+: 70 / 28 / 23.8 |
| Odin | Machine gun | 100 | 12, rising to 15.6 | 5 | 0–30: 95 / 38 / 32.3; 30+: 77.5 / 31 / 26.35 |

Classic right-click is a **simultaneous three-projectile volley**, consuming up to three remaining rounds, with 2.22 volleys/s recovery. It is not a three-pellet shell and is not the Bulldog's sequential burst. Bucky right-click spends **one shell**: the first surface before 7.5 m receives a weak slug; a clear shell opens into five separately traced pellets at 7.5 m. Cover can block the shell before it opens and independently blocks each pellet afterward. Damage distances are measured from the original muzzle/eye origin.

Stinger ADS commits four sequential bullets; Bulldog ADS commits three. Their effective average ADS rates are 8.470589 and 6.315715 bullets/s, respectively. Releasing aim during a committed burst does not turn the remaining bullets into automatic hip fire. Spectre, Phantom and Vandal ADS rates are 11.9997, 9.9 and 8.775 shots/s. Marshal ADS rate is 1.2 shots/s. Other ADS-equipped guns retain their documented cadence. Ares fires immediately; Odin fires immediately at 12 shots/s and accelerates to 15.6, while ADS starts at the fast cadence.

ADS zoom multipliers are 1.15× for SMGs/machine guns, 1.25× for Bulldog/Phantom/Vandal, 1.5× Guardian, 2× Warden, 3.5× Marshal/Outlaw and 2.5× Operator. Camera field of view and lower aiming sensitivity use the same optic geometry. The Operator uses its first zoom level in Semag. Ghost, Spectre and Phantom have suppression-specific flash and sound profiles.

## Deliberate Semag adaptations

These factual profiles are applied to Semag's existing **200 HP** combat. There is no armor/economy conversion or global health rebalance. Body and head values are not scaled to force VALORANT's 150-health kill thresholds. The original Rook sniper now deals 200 head / 100 body / 70 leg damage.

- **Sniper headshots:** Rook, Marshal, Outlaw and Operator kill full-health players with one clean headshot. A verified, unattenuated head contact also kills a recognized monster regardless of wave health. Body/leg damage, range, physical head hitboxes and cover remain unchanged. Penetrated cover or an earlier actor cancels the monster weak-point bonus; actual damage credit is capped to remaining HP. This weak-point rule is a Semag adaptation, separate from the reference damage table.
- **Cadence:** one tick is 1/120 s. Integer `cooldown` remains available to old UI contracts. New `fireIntervalTicks` and `adsFireIntervalTicks` retain fractional researched rates; the simulation carries tick remainder rather than rounding every shot upward.
- **Burst spacing:** the API gives effective ADS rates and burst counts, but not authoritative within-burst spacing. Semag uses 6 ticks between Stinger rounds and 12 between Bulldog rounds, then derives recovery so the launch-to-launch period reproduces the API's average rate exactly. These intra-burst timings are calibrated, not claimed as Riot measurements.
- **Odin acceleration:** the initial/final/ADS fire rates come from source data. Its one-second acceleration ramp is a Semag tuning choice; the public data does not expose the authoritative ramp duration.
- **Bucky pre-burst slug:** the 7.5 m opening distance and five-pellet count come from source data. The unopened slug uses 40 head / 20 body / 17 leg damage as a Semag calibration; its current separate slug values were not independently exposed by accessible official sources. Its 3-degree alternate cone is also calibrated.
- **Reloads:** source nominal full reload times are converted to ticks. Semag completes magazine reloads as one inventory operation, including guns whose original reload can be performed shell by shell. Outlaw uses the sourced 3.8 s empty reload and a calibrated 2.3 s partial reload; the partial duration was not independently available in the API.
- **Reserve ammunition:** verified official counts are Shorty 6, Bandit 24, Phantom 60, Vandal 50 and Warden 36. The other stock reserves are Semag allocations, not claimed as independently verified latest Riot counts: Classic 36, Frenzy 45, Ghost 26, Sheriff 24, Stinger 60, Spectre 90, Bucky 10, Judge 15, Bulldog 72, Guardian 36, Marshal 15, Outlaw 10, Operator 10, Ares 100 and Odin 200. Riot 9.10 specifies Ghost/Frenzy magazine changes without separately stating their reserves.
- **Movement:** source movement multipliers are converted using a 6.75 m/s base. Source ADS multipliers remain distinct, including Marshal's faster scoped movement. Sprint, stamina, jumping and collision behavior follow Semag's existing rules.
- **Accuracy/recoil:** source opening accuracy is converted from degrees to radians. Moving/jumping spread, shot heat, deterministic recoil, recovery, melee interactions and the indexed scatter pattern are calibrated for Semag rather than copied from a proprietary spray simulation. Shotgun pellets fill a deterministic disk around the aim point, including a center pellet and the original outer spread limit. They retain a minimum per-pellet cone while moving/jumping add error; ADS does not tighten that cone.
- **Recoil tuning, 3.48:** Vandal, Stinger, Ares, Odin, Guardian, Warden, Sheriff, Bucky, Judge and Operator have larger per-shot aim impulses and matching held-weapon kick. The original Bastion, Condor, Shrike, Rook and three shotguns receive the same treatment. Phantom, Spectre and smaller sidearms retain their more controllable feel. The shared 0.13-radian cap, 0.04-radian/second recovery and 0.62 ADS multiplier remain consistent across simulation and presentation. Outlaw retains its separate researched impulse and first-shot recovery. Damage, opening accuracy and fire rates retain the facts above; this recoil adjustment is Semag calibration.
- **Distance and cover:** range bands preserve their researched thresholds. Finite ray lengths are 150 m for most guns and 200 m for snipers. Gun penetration tiers match source values; material/thickness attenuation and traversal limits are Semag geometry rules. Unknown/solid structural cover remains protective.
- **Presentation:** gun meshes, loot silhouettes, icons, animation, flashes and synthesized audio are authored for this project. Riot's reference images are research aids and are not bundled as game assets.

The new profiles are deeply frozen, including range bands, alternate modes, effects, sound and model features. The legacy IDs remain the first 16 entries in `WEAPON_IDS`, preserving existing shortcut order; `WEAPON_GROUPS` presents the new collection by class before a separate Semag originals group.
