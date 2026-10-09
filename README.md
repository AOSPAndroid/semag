# Semag game hub

![Semag pixel-art logo](public/hub/logo.svg)

A self-hosted browser hub with **24 games**, including solo challenges, duels, a tactical team FPS, battle royale, and three-player co-op wave survival. Pick **Open game** to preview a solo game, then press **Start game** when ready, or create a room and share your PC address or room link with a colleague. Voxel Royale holds up to ten players; the host starts with any two or more connected players. Voxel Last Stand supports solo play or co-op with up to three players: everyone connected presses **Ready**, then the host explicitly starts. Voxel Breach has two, four or six seats and requires every seat to be ready; the remaining multiplayer rooms have two. The server can run several independent rooms at once.

[Run on your PC](#run-on-your-pc)

## Screenshots

Click an image to open it at full size.

**Game hub**

[![Semag game shelf with the available games and room controls](docs/screenshots/game-hub.jpg)](docs/screenshots/game-hub.jpg)

**Voxel Breach**

[![Voxel Breach solo practice on the Barclays Trading Floor with trading-screen cover](docs/screenshots/voxel-breach.jpg)](docs/screenshots/voxel-breach.jpg)

| Voxel Last Stand | Voxel Royale |
| --- | --- |
| [![Voxel Last Stand courtyard with a monster and its visible health bar](docs/screenshots/voxel-last-stand.jpg)](docs/screenshots/voxel-last-stand.jpg) | [![Voxel Royale desert practice with a knife and four inventory slots](docs/screenshots/voxel-royale.jpg)](docs/screenshots/voxel-royale.jpg) |
| **Voxel Wilds** | **Paris Pedal** |
| [![Voxel Wilds forest terrain, ores and survival inventory](docs/screenshots/voxel-wilds.jpg)](docs/screenshots/voxel-wilds.jpg) | [![Paris Pedal e-bike gameplay on a busy Paris street](docs/screenshots/paris-pedal.jpg)](docs/screenshots/paris-pedal.jpg) |
| **Shinobi Showdown** | **Deckbound** |
| [![Shinobi Showdown two-player ninja duel](docs/screenshots/shinobi-showdown.jpg)](docs/screenshots/shinobi-showdown.jpg) | [![Deckbound card battle showing the hand and enemy intent](docs/screenshots/deckbound.jpg)](docs/screenshots/deckbound.jpg) |

## Games

| Game | Mode | Goal |
| --- | --- | --- |
| Voxel Wilds | Solo first-person voxel survival | Mine editable woodland terrain, craft tools and supplies, build shelter, and survive escalating nights with an eight-slot inventory and a saved world. |
| Voxel Last Stand | First-person monster survival: solo / 1–3 player co-op | Survive endless escalating waves on ten maps, fight eight monster types, collect health, ammo and occasional weapon drops, manage four flexible inventory slots, and revive your squad. |
| Voxel Breach | Tactical voxel 3D FPS: 1v1 / 2v2 / 3v3 | Hold angles, plant or defuse the bomb, and win four rounds on one of ten authored maps. |
| Voxel Royale | First-person voxel battle royale: 2–10 players | Spawn randomly, scavenge weapons and supplies, escape the shrinking storm, and be the last survivor on one of seven authored maps. |
| Shadow Lantern | Solo ninja stealth campaign | Collect guarded seals and extract across nine authored heists in three districts, using cover, sneaking, distractions and limited smoke. |
| Shinobi Showdown | Real-time 1v1 ninja duel | Confirm katana chains, feint heavy strikes, land precise parries and manage stamina across three arenas. |
| Skyline Hook | Solo precision grappling platformer | Swing through twelve authored rooftops in three districts with campaign lives and a completed-run time record. |
| Starfall Squadron | Solo bullet-hell shooter | Focus through six stages, defeat six guardians, graze shots and shape your ship with upgrades. |
| Ironwood Tactics | Solo squad tactics roguelike | Read locked enemy intent, push and pull foes, and protect a beacon across nine missions and three biomes. |
| Afterimage | 1v1 rooftop sword fighter | Win two rounds with spacing, parries, dashes, and attack cancels. |
| Checkers | Turn-based 1v1 | Capture every opposing piece or leave your opponent without a legal move. |
| Relic Duel | 1v1 top-down arena | Win two rounds across three different arenas with sword attacks, arrows, guarding, and timed rolls. |
| Dungeon Run | Two-player co-op | Clear nine rooms in three biomes, choose personal boons, and defeat three guardians together. |
| Crazy Eights | Turn-based card duel | Match the rank or suit, choose a new suit with an eight, and empty your hand first. |
| 21 Duel | Blackjack-style card duel | Get closest to 21 without going over; win more of five hands than your rival. |
| Memory Match | Turn-based card memory game | Find more pairs on a shared board of 32 cards. |
| Night Drive | Solo highway driving | Drive endlessly or complete a five-district tour with merging traffic, construction, rain, and near-miss chains. |
| Paris Pedal | Solo Paris e-bike survival | Weave between cars, buses and cyclists as speed keeps rising. Survive as long as possible through endless Paris districts. |
| Vector Arena | Real-time 1v1 shooter | Lead aimed projectiles, control cover, and manage dashes, ammunition, and reload windows. |
| Prism Shift | Solo falling blocks | Master wall kicks, holds, T-spins, and combos in Marathon or a timed 40-line Sprint. |
| Ember Delve | Solo action roguelike | Explore twelve branching rooms, build relic synergies, and defeat three distinct bosses. |
| Deckbound | Solo deckbuilding roguelike | Survive eighteen encounters with 24 cards, eight relics, enemy intent, and three act bosses. |
| Oddstock Rumble | Bonus 1v1 platform brawler | Choose one of six comic fighters; use knockback, recovery, and stage control to take three stocks. |
| Rift Survivor | Solo survival arena | Read enemy attack patterns, choose upgrades, and build synergistic relics and defeat four guardians across twenty waves. |

The action games are original implementations. Checkers follows American checkers rules. All multiplayer card games use the same two-seat rooms, ready countdown, and rematch flow. The shelf filters show **All games**, **With a friend**, **Solo**, **Driving**, **Action**, **Roguelike**, **Ninja**, or **Voxel**. Search narrows the selected shelf by title, category, or description. Room joining and invitations sit above the game shelf.

The graphics use original local artwork: illustrated cards and enemy portraits,
expressive character sprites, textured arena materials, crafted board pieces,
and detailed driving scenery. Static art is cached, gameplay effects stay
readable, and the shelf artwork matches the games. Assets ship with the host;
playing does not require an image service. The hub uses its pixel SEMAG wordmark and S badge.

Driving and action games use swept collision checks for moving bodies and projectiles. Cover stops shots at their first impact, vehicle depth shows occupied road space, and attack poses match active damage frames. Compact impact effects make solid contacts easier to read.

Solo games open on their challenge settings: **Veteran** for the action,
deckbuilding, driving, and falling-block games. Easier modes remain available
in each game. Veteran and Nightmare demand stronger tactics, pace,
or planning, and keep their records separate from easier runs. Revised challenge
records stay separate from historical scores. The authored solo campaigns also keep
their completion records separate by difficulty.

## Starting a solo game

Open a solo game from the shelf, review its controls, and press **Start game** when you are ready. The game and its timers wait on the ready screen. After starting, press **Escape** to pause or resume, or use Pause / Resume and New game for that session.

Play pages use compact headers and keep the game in the main space. **Controls & info** opens solo instructions and records; **Room & controls** opens multiplayer setup, invitations and rules. Opening solo instructions pauses the run; close them and press Resume when ready. Multiplayer matches continue while a panel is open. Fullscreen keeps an exit button available alongside the game.

## Keyboard layout

Choose **WASD** or **ZQSD · Français** from the **Keyboard** selector on the shelf or game header. Semag remembers the choice in your browser, and each player can choose independently. Movement keys, hints, and accessible controls update together; arrow keys and touch controls stay available. In ZQSD, Prism Shift uses **W** to rotate counterclockwise so **Q** and **Z** can control movement. Switching layouts releases held controls without restarting the run. The game instructions below use the default WASD labels.

Combat actions sit near the movement keys: **C** attacks, **G** uses the heavy or secondary attack, and **F** defends in the fighting games. Shinobi uses **E** for kunai. Mouse attacks and the earlier J/K/I/L/U aliases remain available. Voxel uses **Q** (**A** in ZQSD) for grenades and **F** for potions, with G/H retained. Solo games use **Escape** for pause; P still works. Deckbound and Ironwood accept the French number row without holding Shift.

## Run on your PC

Install [Node.js 20 or newer](https://nodejs.org). Clone this repository, or extract the downloaded game folder:

```sh
git clone https://github.com/AOSPAndroid/semag.git
cd semag
```

Open a terminal in the game folder and run:

```sh
npm install
npm start
```

You can also double-click `start-windows.bat` on Windows, or run `bash start-mac-linux.sh` on macOS/Linux. The launchers install dependencies when needed.

Keep that terminal open while playing. Open **http://localhost:3000** in a current browser. Enter your player name and choose a game. Solo games open with **Open game**, wait for **Start game**, and run in your browser. For multiplayer, create a room and send your colleague the invitation, or **http://YOUR-PC-HOSTNAME:3000** plus the room code. They can join a listed room or enter its code. For **Voxel Royale**, choose a map and a capacity of 2–10, then invite your rivals. The host presses **Start battle** once at least two players are connected; unused seats do not delay the start. For **Voxel Last Stand**, choose one of ten maps and Veteran or Nightmare, then play solo or host a three-seat co-op room. Every connected teammate readies up; the host can start with one, two or three players. Other multiplayer games use all-player **Ready**. Oddstock also asks both players to choose a fighter and the host to choose a stage. Voxel Breach first opens a setup dialog: choose 1v1, 2v2 or 3v3 and a map, then create the room. The selected number of players must join before the match can begin. A player cancelling readiness during the initial countdown returns the room to the lobby.

The colleague must be able to reach your PC. On the same LAN or a suitable VPN, allow inbound **TCP port 3000** through the host PC's firewall. If the hostname does not resolve, use the LAN IP address printed by the server, for example `http://192.168.1.42:3000`. `localhost` refers to the machine opening the page, so share your PC's hostname or IP instead.

For players on separate networks, use a VPN that lets both computers reach each other, or configure your router to forward TCP port 3000 to your PC and share your actual public hostname/IP. Running the server does not automatically make your PC reachable over the internet. Stop it with **Ctrl+C** when finished.

## Controls and rules

Voxel Last Stand:

Choose **Play solo** or **Host co-op** from the shelf. Both open a setup preview with ten arenas: Sunset Courtyard, Freight Depot, Canal Exchange, Roofline District, Iron Foundry, Signal Bastion, Paris Rooftops, Frostline Research, Undercity Sewers and Barclays Trading Floor. Pick any of the sixteen Breach guns, a close-combat weapon and **Veteran** or **Nightmare** difficulty. Last Stand starts with a katana by default; knife, sword, heavy axe and dual tonfas are also available. Solo waits for **Start survival** and runs locally. Co-op supports one to three connected players; each presses **Ready**, then the host presses **Start squad survival**. Unused seats do not delay the start, and active runs are closed to new arrivals.

After the three-second countdown, survive endless increasingly dense waves. Ash Stalkers close on your position, Rift Runners rush, and Iron Brutes punish players who stay within reach. From wave four, Hollow Gunners fire pistols; they upgrade to carbines at wave six. Rift Marksmen join with rifles from wave seven. Melee windups and armed aim warnings give you a chance to dodge or reach cover. Monsters follow ground flanks and climb the authored routes onto rooftops. Their shots, blades and bodies use the same solid-cover and damage rules as the other voxel shooters; teammates cannot damage each other.

Grave Hounds enter from the first wave: low, four-legged zombie dogs run faster but have less health and weaker bites. Aim down at their actual head and body, keep an escape route and punish a bite windup. Dogs carry no weapons and never drop guns or blades. Rift Leapers join from wave three, crouching before a fast committed lunge; sidestep the tell or put solid cover in their path. Ash Screechers join from wave five and telegraph a roar that briefly rallies nearby monsters with a clear path. Interrupt the roar with melee or eliminate the support creature before the pack speeds up. Rallies expire quickly and do not stack. The new types have distinct silhouettes, movement and attack cues in solo and co-op.

In co-op, teammates' names appear just above their characters. Visible monsters have compact overhead health bars showing their current health. Solid cover hides these labels, including when a small hound is concealed behind low cover. Names and bars follow the rendered character and camera, including crouching, jumping and aiming. Breach also displays friendly squadmates' names, and Dungeon Run displays its adventurers' names.

Early waves reward close engagement: human melee damage is multiplied by 1.6 in wave one, 1.4 in wave two and 1.2 in wave three, returning to normal from wave four. A confirmed melee hit can briefly interrupt a monster's windup and movement. Stagger becomes shorter in later waves, brutes resist it, and an immunity window lets monsters finish subsequent attacks; repeated swings cannot hold an enemy indefinitely. A katana rewards narrow, longer-reaching cuts; the axe trades a slow commitment for heavy damage, while dual tonfas alternate rapid short-range strikes. Move in during a tell, strike, then dodge out. Intermissions leave an optional close-combat supply, and monsters can occasionally drop a melee weapon. Living players keep their inventory choices, including replacing their blade with another gun.

Use **WASD / ZQSD / arrows**, mouse look, **LMB / C / J** to fire or swing, **RMB** to aim, **1–4** to select an inventory slot, **X** to drop the selected item, **V** to swap between a carried blade and gun (or cycle items when no melee weapon is carried), **R** to reload, **Space** to jump, **Ctrl** to crouch and **Shift** to walk. **Q** (**A** in ZQSD) throws a frag; **F** drinks a carried potion. Kills can drop immediate health or ammunition; armed monsters sometimes leave their actual gun. Approach and press **E**, with walls blocking collection. Weapons occupy one of four flexible inventory slots, and each potion stack holds up to two. Drops expire and supplies are limited. The compact HUD shows health, ammo, utility, wave pressure and squad status; blood, hit-location damage and directional warnings confirm contacts.

Hold **E** near a fallen teammate for three seconds to revive them at 75 HP. Stay still with a clear path; movement, damage and combat actions interrupt the channel. Each teammate can be revived once per wave. Clear a wave for an eight-second intermission, reload supplies, choose another gun and bring fallen connected teammates back. Survivors recover 35 HP between waves, rather than receiving a full heal; health drops and potions remain valuable. Fallen teammates return at 150 HP. A squad wipe ends the run with the wave reached, kills and survival time. The host can reopen the lobby and start another stand; host migration and disconnects preserve a surviving team's run.

**Escape / P**, Pause and Help freeze solo runs. In co-op they release only your controls while the squad's battle continues; return with **Resume**. Touch movement/look pads and combat buttons are available. Sound and fullscreen are optional. Gameplay uses the shared 120 Hz simulation and high-refresh movement presentation; online snapshots use the same compensated hitscan and buffered remote movement as Breach.

Voxel Royale:

Choose **Cedarfall Reserve**, a pine forest with cabins and a watchtower; **Verdant Labyrinth**, a maze of ruined walls, archive houses and observatories; **Dunes of Anubis**, with caravan houses, temple columns and a climbable stepped pyramid; or **Paris Rooftops**, with stone apartment interiors, café courtyards, boulevard cover and connected roofs. Doors lead into actual interiors, and connected ledges and crates provide routes to rooftops. A map preview helps the host choose an arena.

The host starts a battle with any 2–10 connected players. After a three-second countdown, everyone appears at a different random position with 200 HP and only a small knife: no gun, ammunition, potions or grenades. The knife has a quick, committed swing that deals 28 damage within 1.3 metres. Press **E** near a supply to collect it; walls block pickups. Search houses and hidden structures for sixteen different guns, sword, katana, axe and dual-tonfa pickups, weapon-specific ammunition, potions and frag grenades. Four flexible inventory slots can hold weapons or supplies; each potion stack holds up to two. Drop any item, including the starter knife, to make room for another weapon. Each gun retains its own ammunition. Eliminated players drop their carried supplies.

Use **WASD / ZQSD / arrows** to move, the mouse to look, **LMB** to fire or swing, **RMB** to aim, **1–4** to select a carried item, **X** to drop it, **V** to swap between a carried blade and gun (or cycle items when no melee weapon is carried), **R** to reload, **Q** (**A** in ZQSD) to throw a grenade, and **F** to heal. **Space** jumps, **Ctrl** crouches and **Shift** walks. Breach's weapon-specific recoil, damage by hit location, projectiles and cover apply here too. Healing takes two seconds and restores up to 60 HP; damage or another combat action interrupts it and spends the potion. Click **Enter arena** to capture the mouse. If capture is unavailable, hold right mouse and drag to look. Touch pads and action buttons are available.

The safe zone contracts in six warned stages over four minutes, with increasing damage outside it. Its final collapse prevents indefinite camping. The compact HUD shows your health, ammunition, supplies, survivors and storm timer; the map shows terrain, your position and the safe circles. Enemy positions stay hidden. You have one life: the last living player wins, and eliminated players can spectate the survivors. A disconnect eliminates that player; if the host leaves, another connected player becomes host. Active matches are closed to new entrants. At the result screen, the host presses **Back to lobby** to allow new players and start another battle. **Escape / P** and Help release your controls while the online battle continues.

Voxel Breach:

| Action | Keys |
| --- | --- |
| Move | WASD / ZQSD / arrow keys |
| Look | Mouse; right mouse drag when pointer lock is unavailable |
| Shoot / use selected item | Left mouse button |
| Aim down sights | Hold right mouse button |
| Select inventory slot | 1–4 (physical keys work on French layouts), or click/tap a slot |
| Drop selected item | X, or the drop button beside an inventory slot |
| Quick blade / gun swap; cycle items without a blade | V |
| Throw frag grenade | Q (A in ZQSD); G still works |
| Drink healing potion | F; H still works |
| Reload | R |
| Pick up nearby loot / plant / defuse | E; hold it near a site or planted bomb |
| Jump | Space |
| Crouch | Ctrl |
| Slow walk | Shift |
| Choose a loadout between rounds | On-screen weapon buttons; 1–9 shortcuts choose the original nine guns |

Create a 1v1, 2v2 or 3v3 room and choose any of ten arenas, including Frostline Research, Undercity Sewers and Barclays Trading Floor. Every seat must be filled and every player must press Ready. The match begins with a countdown and an eight-second preparation phase; choose a carbine, SMG, marksman rifle, pistol, shotgun, burst rifle, bolt sniper, LMG, crossbow, revolver, suppressed PDW, automatic shotgun, battle rifle, dual pistols, dual SMGs or slug shotgun between rounds. First to four round wins takes the match; teams switch attacking and defending roles after three rounds. Attackers carry the bomb to either site and hold Interact for three seconds to plant it. Defenders hold Interact for five seconds to defuse. A planted bomb has a 35-second fuse and remains live when the attackers are eliminated. Unplanted rounds last 100 seconds. There are no respawns within a round; death lets you watch living teammates.

This is a true first-person WebGL game with local voxel artwork. Stop moving for accurate shots; movement, jumping and sustained fire reduce accuracy. Hold right-click to use the sights: precision improves and recoil decreases, while movement slows. The pistol, shotgun and burst rifle require a fresh click for each shot, shell or burst. The shotgun fires eight pellets with damage falling off at range, and the burst rifle fires three shots per burst. The bolt sniper needs settled ADS for precision and a fresh click after its long cycle. Hold the LMG trigger through its 0.2-second wind-up; release, reload or switch actions and it must wind up again. The crossbow fires a visible, gravity-affected bolt at 48 metres per second: lead moving targets, compensate for distance, and manually reload its single shot. Head, torso and leg contacts have separate damage values: precision is rewarded, and leg hits deal less damage. Each loadout shows its damage values, firing cadence, reload time and range falloff before you commit. The shotgun lists damage per pellet; cover checks each of its eight pellets independently. Each weapon has its own muzzle flash, tracer, impact and sound profile. Wood, masonry and metal contacts produce different debris and sparks, while crossbow bolts remain visible projectiles. Reloads and weapon choices create openings. Solid 3D map cover blocks shots before player hitboxes, crouching lowers your profile, and friendly fire is disabled. Click the playfield to capture the mouse; Escape releases your controls. On hosts where the browser does not allow pointer lock, hold right-click and drag to look while aiming. Touch controls provide movement, look, aiming and action buttons. A disconnect returns the room to the lobby; all players must agree to a rematch.

All ten maps have connected jump routes onto real cover. Follow the painted chevrons through short ledges to roofs, balconies and maintenance galleries; Roofline District, Signal Bastion and Frostline Research also have contested 4 m positions. Iron Foundry adds machinery climbs and walk-under galleries. Every elevated position has another approach, and each map keeps ground flanks and two ground-level bomb sites. Release Space between jumps; a short landing buffer makes chained hops responsive without automatic jumping. The setup preview and tactical map show these routes and height differences.

Paris Rooftops adds four enterable apartment blocks, two approaches to each four-metre roof, a café courtyard and a contested boulevard. Ground flanks connect both bomb sites; supplies and rooftop ledges also shape its larger Royale variant. Stone façades, slate roofs, striped café accents and a distant voxel Eiffel Tower give the district its Paris character.

Frostline Research has an asymmetric laboratory, radio lodge, supply shelter and survey office, with a radar dome, weather mast, generators, snowbanks and alternate climbs to roofs of different heights. Undercity Sewers is a branching underground network: nine roofed tunnels connect a pump hall, treatment basins and control chambers, with wet channels, masonry arches, pressure pipes, maintenance crossings and inspection galleries. Barclays Trading Floor is an authored fictional office with staggered workstation islands, chairs, a glass research suite, server racks and walk-under balconies. Desk tabletops and drawer cabinets provide physical cover while leaving open space underneath; monitor banks and large market screens stop shots above the desks. Each layout has its own ground routes, alternate elevated approaches and protected squad starts. All three maps are available in Breach, Last Stand, practice and larger Royale variants with supplies in rooms and elevated positions.

The older arenas also have setting-specific landmarks with real collision: freight forklifts, canal market stalls, rooftop water tanks and ventilation units, foundry equipment, bastion signal relays, forest logging piles, maze waystones, desert obelisks and Paris street kiosks. These additions preserve their original starts, objectives and climbing routes.

The revolver rewards deliberate six-shot accuracy; the suppressed PDW has a fast close-range cadence and a quiet report. The automatic shotgun trades distant accuracy for repeated close-range shell volleys, and the battle rifle has powerful slow automatic fire with demanding recoil. Each has distinct artwork, reload handling, damage, firing feedback and sound.

Dual pistols alternate one shot between hands per click, and dual SMGs alternate automatically while the trigger is held. Each pair occupies one inventory slot and uses a shared finite magazine; reloads replenish the pair, while each shot kicks and flashes only its firing hand. Right-click braces the pair for steadier aim. The slug shotgun fires one heavy round per press, rewarding accurate close-to-medium-range shots rather than pellet spread. All three guns have their own damage, falloff, recoil, reload, artwork and sound. Breach lets players choose a starting blade between rounds, and practice includes all five melee choices. Last Stand's early-wave damage bonus does not change multiplayer melee damage.

Confirmed enemy head damage briefly turns the crosshair shiny gold with a tight sparkle pulse. Body and leg damage use a bloody-orange outward pulse. Scoped sights receive the same feedback. One shell or swing produces one pulse, even if several pellets hit; misses, cover, friendly contacts and self damage do not flash a successful hit. The cue expires quickly, clears when controls are paused or a life changes, and retains distinct colors and shapes when reduced motion is enabled.

The voxel artwork gives each weapon a distinct receiver, stock and sight, with shaped gloves, separate knife and sword silhouettes, and readable supply pickups. Players have exposed human faces, varied hair and skin tones, and distinct outfits with readable team accents. Teammates and opponents walk with articulated legs, bend their knees when crouching, and change pose while jumping and landing. The shared player artwork works in Breach, Royale, Last Stand and practice. Paris interiors have plaster and parquet finishes; forest cabins show timber grain, while maze ruins and desert temples have carved details. These assets are included with the host and need no external downloads. First-person and held weapon models stop at nearby solid cover, including while aiming.

First-person walking adds subtle head bob and roll driven by actual distance travelled, with a soft landing response. Movement feedback settles when you stop or meet a wall and becomes steadier while aiming. Each gun has its own quick weapon kick and smooth recovery; automatic shots blend their impulses, while a shotgun shell produces one kick rather than one per pellet. With sound enabled, cached gunshot effects combine a dry crack, a low body and a quiet mechanical tail; the crossbow has a distinct string release. These presentation effects are shared by Breach, Royale, Last Stand and practice.

The voxel shooters start players with 200 HP, extending firefights while retaining each weapon's damage, recoil and hit-location advantages. Confirmed gun and crossbow damage emits brief red voxel blood at the actual contact. Incoming damage shows a short screen-edge blood effect and a directional cue; solid cover and friendly contacts do not create blood. The compact HUD leaves room for the firing lane: health, ammo and round supplies sit along the edges, with a small tactical map and objective banner. Your health meter shows current HP, a short trail for recent damage, critical-health feedback and healing. Squad health appears in the arena and roster; spectating shows the health of the teammate you are watching. Confirmed hits display the actual HP damage dealt, with head and leg hits identified.

Every Breach loadout starts with the chosen blade (knife by default) in slot 1, the chosen gun in slot 2, one healing potion in slot 3 and one frag grenade in slot 4. All four slots are flexible: drop or replace items to carry extra guns, and stack up to two potions in one slot. Melee swings have a visible wind-up, committed direction and recovery; walls and intervening teammates block them. Frags bounce and roll before exploding after 2.4 seconds. Cover protects against the blast, teammates are immune, and your own grenade can hurt you. Drinking takes two seconds and restores up to 60 HP on completion. Damage, shooting, jumping, switching weapons, throwing a grenade, reloading or interacting interrupts it and spends the potion. Full-health players cannot waste a potion. Healing slows movement, so find cover before drinking. Round setup restores health, ammunition and utility charges.

The tactical map shows cover, both sites, your position and living teammates. Painted site signs help you navigate the authored maps. The main clock switches to the charge countdown after planting; planting, defusing, reloading, melee recovery and drinking show progress. The HUD displays your selected item, all four inventory slots, and remaining grenade and potion charges. Round results explain the outcome before the next setup phase.

Jump onto low crates, slide along solid cover, and step off ledges into a fall. Movement checks the full three-dimensional path, including landings at crate edges. Living players block movement, and local movement prediction also checks those bodies to reduce camera corrections at contact.

Shadow Lantern:

| Action | Keys |
| --- | --- |
| Move | WASD / ZQSD / arrow keys |
| Sneak | Hold Shift |
| Collect a seal / rear takedown | Hold E nearby |
| Smoke | Space |
| Distraction kunai | Q (A in ZQSD) |
| Aim | Mouse or face with movement |

Nine heists cross Lantern Garden, Rainroof Citadel and Frost Keep. Collect every guarded seal, then return to the extraction mark. Patrol cones stop at solid cover; suspicion warns before detection. Shadows and sneaking reduce detection, while noisy movement and kunai impacts draw investigation. Approach an unaware guard from behind and hold Interact for a takedown. Health, finite tools and alarm pressure carry through the campaign. A visible deadline prevents waiting forever. Veteran starts by default; Standard and Nightmare have separate completed-campaign score records. Cleared missions wait for an explicit Continue button.

Watch the exposure indicator and patrol sight cones when choosing a route. Nearby interaction prompts show channel progress, and the objective changes from recovering seals to extraction. Patrols keep separate bodies while passing one another and navigating solid cover. Courtyard edges allow sliding while keeping bodies separate; kunai stop at the actual wall or border surface.

Shinobi Showdown:

| Action | Keys |
| --- | --- |
| Move | WASD / ZQSD / arrow keys |
| Aim | Mouse |
| Quick katana cut | C / left mouse button; J still works |
| Heavy katana cut | G / right mouse button; K still works |
| Feint a heavy windup | R during combat; R readies up in the lobby |
| Throw kunai | E; L still works |
| Timed directional parry | F; I still works |
| Dash | Space / Shift |

Aim before attacking: each cut commits to the direction chosen when you press, including a briefly buffered attack. Footwork, cuts and tools are faster. After a light cut actually damages your opponent, a fresh Cut during recovery frames 16–26 links another strike, up to three. Each link spends stamina and locks its own direction; a missed cut or the third cut completes recovery. A confirmed Dash cancel in the same window costs 36 stamina instead of the normal 28, giving you a paid retreat rather than a free escape.

Press R to feint a heavy windup during frames 6–17. It costs 12 extra stamina and leaves 14 ticks of exposed recovery, so baiting a defensive reaction carries risk. Face an incoming attack and time a parry: frames 2–9 defend, while frames 2–4 with tighter facing reward a perfect parry. A successful parry recovers sooner; a perfect sword parry stuns the attacker longer, and a perfect kunai deflection sends it back faster. Failed parries remain punishable. These timings use the deterministic 120 Hz simulation. Inputs buffer for at most 10 ticks and held buttons never repeat attacks automatically. Controls held before the bell need a fresh release and press.

Dashes evade during frames 3–9 and cannot pass through cover or bodies. Three kunai recover one at a time during free movement. Touch screens provide separate movement and aim pads plus six action buttons. Both players press Ready; the first to two round wins takes the match. Rounds rotate Moonlit Rooftops, Lantern Garden and Winter Shrine and last 75 seconds. Higher remaining health wins a timeout; equal health draws. Matches end after at most five rounds, and both players must agree to a rematch.

Brushing another fighter blocks movement into their body while preserving sideways movement and retreat. Dash flanks use the same cover contacts, and kunai collisions follow the resulting movement path.

Afterimage:

| Action | Keys |
| --- | --- |
| Move | A / D or left / right arrows |
| Jump | W, Space, or up arrow |
| Light / heavy attack | C / G; J / K still work |
| Dash | Shift; L still works |
| Block / timed parry | F; I / U still work |

A connected light strike can cancel into a heavy; a missed light cannot. Holding guard costs stamina when hit, and a depleted guard breaks. Dash evasion starts after a brief vulnerable startup. Press **Fight smarter** for tips. Afterimage also has local open sparring and a five-duel training ladder: Patient Blade teaches whiff punishment, Iron Guard teaches guard pressure, Rooftop Acrobat teaches landing control, Close Pursuit teaches parries and confirmed combos, and Last Duel combines the whole move set. Enter Practice, select a training road, and win each first-to-two match to advance. Any opponent can also be selected directly.

Relic Duel and Dungeon Run:

| Action | Keys |
| --- | --- |
| Move / face direction | WASD or arrow keys |
| Sword attack | C; J still works |
| Shoot arrow | G; K still works |
| Roll / evade | Space or Shift |
| Guard / timed parry | F; L / I still work |
| Revive a fallen teammate in Dungeon Run | Hold guard nearby |

Attacks, arrows, and rolls require fresh keypresses. Manage stamina and use the environment to approach safely. In Dungeon Run, protect each other; if both heroes fall, the run ends. Hold guard next to a fallen ally to revive them. Relic Duel rotates Moss Courtyard, Tide Archive, and Cinder Gallery between rounds, changing cover and shooting lanes. Nine Dungeon Run rooms cross Garden Ruins, Tide Crypt, and Ember Sanctum, each with different cover layouts. Tide pools slow walking; fire vents warn before they erupt. Guardians in rooms three, six, and nine use different patterns. After clearing a room, each hero walks to a shrine and holds Guard to choose a boon. Both must choose before the three-second next-room countdown. Honed Edge improves sword damage; Living Ward increases health; Starstring strengthens and pierces with arrows; Second Wind improves stamina and rolls; Red Bloom heals on sword hits; Mirror Sigil rewards timed parries. Builds last for the expedition and reset on rematch.

In Afterimage, Relic Duel, and Vector Arena, the first player to win two rounds takes the match. Rounds last 90 seconds; a timeout awards the round to the player with more health, while a tie awards no win. Both players must agree to a rematch.

**Vector Arena:** use WASD or arrow keys to move, the mouse to aim, and hold the left mouse button or C to fire (J still works). Space / Shift dashes; R reloads your six-shot magazine. Hold the right mouse button or F to focus (I still works) for more precise fire at a slower movement speed. Shots take time to travel and stop at cover, so aim ahead of moving targets and change your angle to open a shot. Dash has a vulnerable startup and costs stamina. A reload creates an opening for your opponent. Touch screens offer separate movement and aim pads, plus fire, focus, dash, and reload controls. Both players ready up; the first to win two rounds wins the duel. Rounds rotate through Reclaimed Garden, Steel Relay, and Observatory Vault, changing cover, firing lanes, and spawn angles.

For Checkers, click a piece and then a highlighted destination. Captures are mandatory; continue jumping with the same piece when another capture is available. Men move and capture forward, kings move and capture in both directions, and reaching the opposite edge crowns a man and ends that turn. Three repetitions of a position or 80 turns without a capture or a man moving produce a draw.

**Crazy Eights:** each player starts with seven cards. Play a card matching the top card's rank or the active suit. An eight is wild: choose a suit when you play it. When you have no legal card, draw one; play if you can or pass after drawing. The discard pile is recycled when the draw pile runs out. Empty your hand to win. If neither player can continue, the lower remaining hand value wins (eights count 50, face cards 10, aces 1, other cards their rank); equal values draw.

**21 Duel:** a head-to-head variation inspired by blackjack. Each player starts with two cards and chooses **Hit** or **Stand** independently. Aces count 1 or 11, face cards count 10; 21 and busts automatically stand. Opponent cards stay hidden until both hands settle. The player nearest to 21 without busting wins the hand; equal totals or two busts draw. Five hands decide the match by number of hands won. The next hand starts automatically after the reveal. There is no dealer or betting.

**Memory Match:** flip two cards on your turn. Matching rank and suit earns a pair and another turn. A mismatch stays visible briefly, then turns over and passes the turn. Sixteen pairs are hidden in the shared board. The player with more pairs wins; eight pairs each draws. All card actions support mouse, touch, and keyboard buttons.

**Night Drive:** your car cruises automatically. Veteran and Nightmare Endless increase the baseline driving pace continuously with active time, including within a district; releasing pedals or braking does not stop the ramp. The HUD shows the rising pace. Hold A / D or left / right to steer, W / up to accelerate, S / down to brake, and Space to boost. Strict Endless brakes buy a short burst and recharge when released. A shoulder warning gives you time to return to the road before repeated shoulder damage; brief evasive moves remain possible. Boost uses charge that recovers when released. Clean overtakes earn points only after the entire opposing car is clear, with an extra bonus for a close near miss. Its rear remains collidable until then. Avoid the shoulder and traffic; three impacts end your run. Damage briefly protects you from repeated hits. Choose Endless or a five-district Tour. Every 900 metres changes the district: city, coast, works, storm, and summit bring merging traffic, construction corridors, and different handling. Standard practice awards resources at clean district checkpoints. Veteran starts by default: district delivery clocks require sustained pace, and checkpoints no longer repair impacts automatically. Nightmare has tighter delivery windows. Traffic density and required checkpoint pace tighten continuously with active Endless time, while districts add stronger crosswind, merging traffic, and construction; work remains bounded and escape corridors stay open. Boost cells and near-miss chains reward deliberate risk. Complete 4.5 km to finish the tour. Tour and Standard practice retain their handling. Pausing or switching tabs freezes the ramp, and restarting restores the opening pace. Accelerating Endless records stay separate from earlier points. The driving games have hold buttons for touch screens and run their physics at 120 steps per second in the browser.

**Paris Pedal:** survive busy streets from behind your e-bike in a perspective chase view. Survival is the default: the bike rides automatically, its pace rises continuously with active riding time, and Paris cycles endlessly through Bastille, Le Marais, Rue de Rivoli, the Seine crossing, and Montmartre. The goal is your longest time alive. A / D or left / right steers, W / up pedals faster, Space uses battery-powered motor assist, and E warns nearby cyclists (B still works). Quick bell taps register after resuming; pausing or changing controls clears pending taps. S / down buys a short braking burst; the brake must recharge after release, so holding it cannot stall the run. Buses signal before pulling out, cyclists warn before veering, and parked doors flash before opening. Three impacts end the run; district changes never repair Survival damage. Pausing or leaving the tab freezes the riding clock and pace. Your final survival time is saved separately for Standard, Veteran and Nightmare, with Veteran selected by default. Five deliveries remains an alternate mode with timed checkpoints on Veteran and Nightmare, and points records awarded only for a full finish. Veteran and Nightmare Rush use the same automatic increasing pace and limited brake bursts, closing slow-brake score farming. Strict tiers begin faster and require tighter steering corridors over time. Earlier Rush points and earlier Survival records stay separate from the new challenge records.

**Prism Shift:** left / right moves a piece, down soft-drops, up / X rotates clockwise, Z rotates counterclockwise, Space hard-drops, and C / Shift holds. Held directions repeat after a short delay. Each bag contains all seven pieces; the ghost shows your landing position and the next queue shows five pieces in Standard, four in Veteran, and three in Nightmare. You can hold once per placement. Rotations use wall kicks. Standard has a half-second lock delay and up to fifteen movement or rotation resets; the faster Veteran and Nightmare profiles reduce those allowances. Clear consecutive placements for combos; consecutive four-line clears or T-spins build a back-to-back bonus. Marathon increases the pace as you clear lines and saves your best score. Sprint ends at forty cleared lines and saves your fastest completed time separately. Veteran starts by default at level 10; Nightmare starts at 13. Their Marathon gravity and locking pressure rise through both cleared lines and elapsed active time. Sprint limits are 75 and 50 seconds respectively. Excavation is a garbage-clearing puzzle road with distinct preset layouts, fixed piece queues, piece budgets, and explicit continuation between stages: Standard has eight stages, Veteran ten, and Nightmare twelve. The harder ladders pair chambers, use exact piece budgets, and add tighter stage clocks, so queue and hold planning matter. Solve all stages for a separate completed-time record.

**Rift Survivor:** move with WASD / arrows, aim with the mouse, hold click or C to fire (J still works), and dash with Space / Shift. On touch screens, use the left pad to move and the right pad to aim and fire. Sustained fire overheats your weapon; release to cool down. Watch the warnings before charging brutes or ranged attacks strike, and use cover to break firing lines. Choose upgrades after each wave. Ricochet, chain lightning, frost, kill siphon, scatter shots, dash shockwaves, and post-dash focus combine into builds, alongside damage, cooling, and mobility. Health carries between waves. Four sectors have distinct arenas, affixed elites, and warned floor hazards. Guardians guard waves five, ten, fifteen, and twenty. Veteran starts by default with mixed ranged threats from the first wave, locked leading aim, and less forgiving recovery. Veteran and Nightmare threat pace rises with cumulative active combat time: enemy movement, new charges, new shots, and fresh attack cadence gain 5% per minute, up to 25% after five minutes. The HUD displays this pace. Wave changes retain it; pause and upgrade menus freeze it; a new run resets it. Warning durations stay unchanged, and committed attacks retain their speed. Accelerating challenge records stay separate from earlier scores. Burst fire cools faster than held fire. Elite suppression marks threaten escape routes, guardians add a warned second phase, and repeated frost cannot permanently pin elite enemies. Select Expedition (Standard), Veteran, or Nightmare; optionally overcharge the next wave for tougher enemies and higher score.

**Oddstock Rumble:** both players select their own fighter; the host selects a stage. Both press Ready. Move with A/D or left/right; W/S or up/down selects move direction. Space jumps (twice in the air; Moth has an extra jump); down+Space drops through a platform. C attacks, G uses a special, F shields, and Shift dodges. J/K/I/L remain as aliases. Hold down in the air to fast-fall. Directional attacks change on the ground and in the air; up-special is your recovery move. Damage increases launch distance, and directional input influences knockback. Fresh shields can parry, but holding a depleted shield breaks it. Each player starts with three stocks. Stage hazards warn before wind, fountains, or steam activate. A four-minute timeout compares stocks, then damage. The six original comic fighters parody familiar platform-fighter archetypes: Captain Wrench, Sir Sprout, Mochi Moth, Parcel-9, Zap Rat, and Don Bulk.

**Skyline Hook:** use A/D or arrows to move, hold Space for jump height, aim at a visible anchor, and hold click/E to grapple. Release to carry swing momentum; W/S reels the rope in/out. Collect two relay chips and reach the receiver on each of twelve rooftops across Copper Quarter, Rainline Heights, and Aurora Spires. Roofs, suspended ledges, spikes, and warned security beams require different approaches. Campaign lives carry between stages. Veteran starts by default; Standard and Nightmare change the resource and timing challenge. Pauses stop active time. Only a complete twelve-stage campaign saves a fastest time, separately by difficulty. Touch controls provide movement, jump, hook, and reeling.

**Starfall Squadron:** move with WASD/arrows, hold Shift to focus for finer movement and concentrated fire, and use E for a limited bomb (Space/K still work). Auto-fire starts enabled; C/click also fires, with J retained. Thread the visible pilot core through aimed, fan, and rotating shots, and graze safely to build a score chain. Six stages cross Orbital Coast, Rust Halo, and Glass Citadel; each ends with a distinct guardian, and the final fight has three phases. Hull and bombs persist, and upgrade choices between stages change your firepower, handling, and scoring. Veteran starts by default, with Standard and Nightmare available. Only a full campaign finish saves a score; partial runs do not replace a completed record. Drag to move on touch screens, with Focus and Bomb buttons.

**Ironwood Tactics:** select a hero with 1/2/3 or click/tap, choose an action, and select a highlighted grid tile. Arrows/WASD move the cursor; Enter chooses a tile and E ends the squad turn. C selects movement and F selects attack; M remains a movement alias. The Warden pushes and shields, the Ranger controls firing lines, and the Weaver pulls and heals with limited bandages. Exact enemy attack tiles and their resolution order are shown before you commit. Bosses resist displacement and cannot have their intent canceled; royal lines can hit the beacon, and living bosses also deal one, two, or three beacon siege damage per turn by biome. Protect the beacon, exploit cover and terrain, and finish nine missions across three biomes and guardians. Health and unique upgrades persist; mission deadlines bring escalating storm pressure. Veteran starts by default. Renown requires the complete expedition and stays separate by difficulty. The turn-based board has no running clock between decisions.

**Ember Delve:** move with WASD/arrows, aim with the mouse, attack with click/C (J still works), cast with right-click/E (K still works), dodge with Space/Shift, and interact with F. Clear the room and physically reach an exit to claim a relic and choose a road. Safe routes include camps and treasuries; risky combat and elite routes yield stronger rewards. Health, stamina, mana, and relic effects carry through twelve rooms across three acts. Each act has a different boss. Veteran starts by default with predictive charges, flanking crawlers, marked ground attacks, stronger boss patterns, and reduced healing loops. React after attacks commit and manage dodge stamina. Attacks briefly slow movement and delay stamina recovery. Relic rooms are guarded, bosses bring mixed support, summons are finite, and healing shares a room allowance. Enemies recover from cover corners so they cannot be parked there indefinitely. Standard and Nightmare are selectable. The seed and difficulty can be replayed, but a new descent resets the build.

**Deckbound:** click/tap cards, or use 1–9 to play hand slots and E to end your turn. Read enemy intent before spending energy on attacks, block, and statuses. Select a target when several enemies are present. Eighteen encounters cross three acts with combat, elites, shops, rest stops, and events. Shape a deck of 24 card types with upgrades, removal, rewards, and eight relics. Rest can heal or upgrade; shops spend earned gold. Defeat the three bosses to win. Veteran starts by default with three mandatory road battles per act; Nightmare requires four. Complementary enemy pairs and disclosed allied shields make targeting matter. Card healing is limited to 18/12 HP per battle in Veteran/Nightmare, while late turns bring stronger pressure. Different offensive and defensive builds remain viable. Zero-cost Quickstep exhausts after use. Standard and Nightmare are selectable. Death ends the expedition; replay the seed or start again.

**Voxel Wilds:** a solo first-person voxel survival expedition. Mine trees, hillsides, and underground ore; build on real block faces; and manage eight inventory slots. Move with WASD/ZQSD or arrows, look with the mouse, jump with Space, and sprint with Shift. Hold left-click/C to mine or attack, right-click/E to place, F to use food or supplies, and 1–8/the mouse wheel to choose a slot. Tab opens inventory and crafting and freezes survival while you plan; select an item in the pack to discard one and make space. Craft planks, a workbench, upgraded tools, weapons, and camp supplies. Stone walls withstand raids longer than wooden walls, but later nights bring faster breaches, archers, and flying wisps. Hunger and fall damage make exploration matter; harvested berry shrubs regrow after two days when their cell remains clear and supported. The world saves in the current browser when storage is available. After pressing Start, choose Continue to return to an expedition or begin a fresh world. This game is designed for keyboard and mouse.

Solo games have pause and new-game controls beside the score display. Escape pauses or resumes, P remains a pause alias, and R restarts; leaving the page or switching tabs pauses real-time solo games, including a pending Rift upgrade choice. Open **How to play** for the rules. Touch controls appear on smaller screens or touch devices; Prism's on-screen controls are also available from its desktop disclosure. Best scores and completed timed records are saved in the current browser when browser storage is available. Records are separate by game mode and difficulty. Rebalanced challenge records stay separate from historical scores and practice modes across the solo games. Starting a new game resets the run; best records remain.

Leaving a room resets that room's match and readiness. Rooms and matches live in memory and disappear when the server stops. An empty room is eventually removed; create another room if an old invitation has expired.

The action and driving games automatically use your display's refresh rate, including 120, 144 and 240 Hz. Movement is smoothed between simulation steps, and camera effects keep the same speed across refresh rates. Choose your preferred rate in your PC's display settings before playing; browsers use the active display's rate.

**FPS practice:** choose **Practice solo vs bots** on the Voxel Breach or Voxel Royale card, or **Practice vs bots** inside a room's controls panel. Choose any map, 1–5 opponents, moving targets or bots that return fire, and Rookie, Regular or Veteran bot pace, then press Start. Practice runs locally with the same movement, cover, weapons and damage rules as multiplayer. Breach offers an elimination drill with all sixteen gun choices and five starting melee weapons; Royale keeps its knife start, scavenging, storm and last-survivor result. Escape releases controls and pauses practice. Restart or return to setup to begin another drill. Practice uses no multiplayer connection and does not write solo records.

Network games render opponent movement using server simulation ticks and a small adaptive buffer rather than packet arrival spacing. Local aiming and confirmed gameplay feedback stay immediate. Adjacent local movement poses survive snapshot acknowledgements, and fighters, enemies and projectiles retain fractional positions between steps. Presentation corrections use the real collision rules; older opponent visuals cannot push a valid current FPS camera. Verified FPS movement paths follow the actual physics steps through corners. Deaths, new rounds and large discontinuities reset interpolation. Voxel operators turn continuously, with fixed body proportions. Wilds samples creatures, arrows and its camera together between physics steps, retaining clear movement through distant terrain edits and day transitions while checking current terrain and living bodies. Voxel renderers reuse typed geometry storage and pickup models, and Paris Pedal uploads its authored building raster once per frame while retaining its painter order.

FPS continuous controls use the latest state, while a bounded queue preserves short jump, fire and utility presses across packet coalescing. Consecutive taps retain a release step, and shot/grenade commitments retain their press aim. Pending presses expire after 120 ms; pause, help, focus loss and round changes clear them. Practice also preserves short presses in its local action queue. Cancelling a touch contact withdraws only its own unconsumed press, preserving other held controls and valid taps.

Night Drive road markings move with actual travelled distance, including beneath the bumper. Paris projected details preserve fractional coordinates, and its building materials request CPU-readable canvases before painting to avoid expensive first-use readbacks. Skyline ropes, Shadow action effects and Starfall particles follow the same display clock as their actors. Circuit wheel steering follows achieved turning momentum. These display changes retain the existing simulation, collision, damage and difficulty rules.

Online hitscan guns use the displayed simulation tick to check compatible player positions within a bounded 150 ms server history. This keeps shots on moving targets aligned with the buffered view. Cover, ammunition, spread and damage stay authoritative; stale timestamps and new lives cannot reuse an obsolete target pose. Crossbow bolts and grenades retain their real flight simulation. Local practice uses current positions and needs no network history.

WebAssembly is supported by modern browsers, but this release keeps the simulation in JavaScript. Profiling found repeated geometry construction, canvas transfers, layout reads and presentation timing to be the larger costs. A WASM physics module would leave those costs in place. The current improvements require no new runtime dependency or browser isolation headers; heavy simulation or meshing kernels remain candidates for a future measured WASM implementation.

## Development

```sh
npm test
```

Run `python test/compact-play-browser-smoke.py http://127.0.0.1:3000` for native checks of the compact layouts, controls panels, readiness, pause, fullscreen and responsive play areas.

Run `python test/high-refresh-browser-smoke.py http://127.0.0.1:3000` for native gameplay, rendering, collision and pause/resume checks of the high-refresh presentation paths. Automated timing tests cover 60, 120, 144 and 240 Hz independently of the browser machine's display.

Run `python test/voxel-horde-browser-smoke.py http://127.0.0.1:3000` for Voxel Last Stand setup, native solo combat, pause/restart, three-player co-op, touch controls and responsive layouts.

Run `python test/voxel-practice-browser-smoke.py http://127.0.0.1:3000` for solo FPS setup, real combat and scavenging, keyboard/mouse and touch controls, pause/restart, fullscreen and responsive layouts.

Run `python test/voxel-inventory-browser-smoke.py http://127.0.0.1:3000` for flexible slots, native dropping and scavenging, French keys, four new weapons, the snow/sewer/trading maps and co-op inventory synchronization.

Run `python test/voxel-map-identity-browser-smoke.py http://127.0.0.1:3000` for native office furniture and screen cover, sewer tunnel movement, snow roof climbs and distinct map artwork. Node geometry tests additionally check connected floors, safe starts, supply access, head clearance, useful elevated firing angles and rendering budgets.

Run `python test/voxel-arsenal-browser-smoke.py http://127.0.0.1:3000` for native dual-wield fire, close-combat choices, inventory handling and confirmed gold/orange crosshair feedback. Shared combat tests additionally check authoritative hand alternation, real cover, finite ammunition, early-wave melee openings and resistance to repeated stagger.

Run `python test/voxel-monsters-browser-smoke.py http://127.0.0.1:3000` for native zombie-hound movement, low-body hits, bite contacts and unarmed artwork. Shared monster tests additionally check committed leaper attacks, interruptible rallies, solid cover, body-aware navigation, deterministic co-op and bounded wave rendering.

Run `python test/voxel-labels-browser-smoke.py http://127.0.0.1:3000` for native co-op teammate names, monster health bars, damage updates and solid-cover visibility. Label tests additionally check the actual camera projection, short hound silhouettes, spectators, safe player names and bounded overlay nodes.

Run `python test/voxel-feel-browser-smoke.py http://127.0.0.1:3000` for native first-person head bob, settled ADS, wall contact, one-shot weapon kick and audio, recovery and solo pause/resume in practice and Last Stand.

Run `python test/shinobi-browser-smoke.py http://127.0.0.1:3000` for native two-player readiness, rapid keyboard/mouse inputs, hit-confirm chains, heavy feints, parries, collisions, French and touch controls, responsive combat feedback, round transitions and rematches.

With Python Playwright and Chromium installed, run `python test/voxel-polish-browser-smoke.py http://127.0.0.1:3000` for native two-client checks of confirmed blood effects, 200-HP combat, 60-HP healing, the Royale starter knife and compact desktop/mobile views.

Run `python test/voxel-assets-browser-smoke.py http://127.0.0.1:3000` to review all nine gun models, aiming and wall contact, standing and crouching operators, Paris interiors and roofs, and native scavenging across the Royale environments.

Optional browser checks require Python Playwright and Chromium. Run `python test/voxel-survival-browser-smoke.py http://127.0.0.1:3000` for Voxel Wilds mining, crafting, building, controls, saved worlds, and pause behavior. Run `python test/voxel-paris-browser-smoke.py http://127.0.0.1:3000` for both Paris map selectors, native building and rooftop routes, bomb-site approaches, combat cover, scavenging and responsive HUDs. Run `python test/voxel-royale-browser-smoke.py http://127.0.0.1:3000` for host-started 2–10 player rooms, the original three arenas, native scavenging, combat, healing, rematches and compact desktop/mobile HUDs. Run `python test/voxel-health-browser-smoke.py http://127.0.0.1:3000` for Voxel health, damage by hit location, weapon comparisons and distinct combat feedback. Run `python test/ergonomic-browser-smoke.py http://127.0.0.1:3000` against a running host for native nearby controls in all six combat rooms and Voxel, Escape/P in the ten solo games, actual AZERTY events, held-alias releases, help/editing guards, and desktop/mobile control guides. Run `python test/voxel-expansion-browser-smoke.py http://127.0.0.1:3000` for the original six-map expansion: native multihop climbs, elevated cover, new weapon handling, multiplayer synchronization, rendering budgets and responsive layouts. Run `python test/voxel-browser-smoke.py` for Voxel Breach: native room setup, all-player readiness, two-, four- and six-player rooms, WebGL artwork, movement and aiming, combat, and desktop/mobile layouts. Run `python test/ninja-browser-smoke.py` for Shadow Lantern and two-client Shinobi Showdown: native keyboard and touch controls, explicit Start and Ready, collisions, difficulty records, and desktop/mobile layouts. Run `python test/polished-expansion-browser-smoke.py` for the three new games: native keyboard/touch play, campaign decision screens, explicit Start, pause, restart, ZQSD, record isolation, artwork, and desktop/mobile layouts. Run `python test/difficulty-browser-smoke.py` for the challenge defaults, native difficulty/mode selection, record isolation, pause, restart, and desktop/mobile layouts. Run `python test/paris-browser-smoke.py` for Survival acceleration, braking, crash-ending time records, the full delivery route, native controls, and responsive layouts. The longer gameplay regression suites below explicitly select the original Standard rules so their fixtures and records remain comparable. Run `python test/cards-browser-smoke.py` to start an isolated local server and exercise all three card games in two browser sessions. Run `python test/driving-browser-smoke.py` to exercise Night Drive controls, traffic, records, pause, and touch layouts on an isolated server. Run `python test/skill-browser-smoke.py` for Vector Arena's two-player combat, Prism Shift's controls and modes, and Rift Survivor's combat and upgrades. Run `python test/expansion-browser-smoke.py` for Ember Delve, Deckbound, and two-client Oddstock Rumble with mobile, native controls, pause, and real gameplay checks. Run `python test/dungeon-browser-smoke.py` for a physical co-op clear through the first guardian, shrine boons, and the Tide Crypt transition; set `DUNGEON_ROOMS=9` for the extended expedition check. To check the original four games, run `python test/hub-browser-smoke.py http://127.0.0.1:3000` against a running host.

The action games use authoritative combat at 120 ticks per second. Voxel Breach, Voxel Royale and Voxel Last Stand send live snapshots at 30 Hz; the other realtime games use 60 Hz. Quiet lobbies and turn-based boards use a 10 Hz heartbeat; readiness, moves, card actions, and selections broadcast immediately. Browsers send gameplay inputs during combat and predict local movement for responsiveness; the server decides hits and validates board and card actions. Empty rooms do no simulation work, and the simulation timer sleeps when no players are connected. Card snapshots are prepared separately for each seat: opposing hands, the draw order, and hidden memory cards are not sent to a player's browser. Network latency and jitter still affect online play.

HTML, scripts, styles, and SVG artwork support Brotli/gzip delivery and conditional browser caching. Compressed copies use a bounded cache and are invalidated when a local file changes. The host ZIP streams directly. Game HUDs update changed values, static artwork is reused, and paused solo games stop their animation loops while retaining their graphics and input behavior.

The default port is 3000. To choose a different port:

```sh
# macOS/Linux
PORT=8080 npm start
```

```bat
:: Windows Command Prompt
set PORT=8080
npm start
```

Share the same chosen port in the URL, and allow that port through your firewall.
