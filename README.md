# semaG game hub

![semaG pixel-art logo](public/hub/logo.svg)

A self-hosted browser hub with **27 games**, including solo challenges, duels, a tactical team FPS, battle royale, a top-down 4v4 point-control brawl, and three-player co-op wave survival. Pick **Open game** to preview a solo game, then press **Start game** when ready, or create a room and share your PC address or room link with a colleague. Voxel Royale holds up to ten players; the host starts with any two or more connected players. Lockdown holds up to eight; the host starts whenever they like and bots fill every empty seat. Voxel Last Stand supports solo play or co-op with up to three players: everyone connected presses **Ready**, then the host explicitly starts. Voxel Breach has two, four or six seats and requires every seat to be ready; the remaining multiplayer rooms have two. The server can run several independent rooms at once. Every PvP game also has a **Vs bots** link for solo play, including Shinobi Showdown against one to four opponents.

[Run on your PC](#run-on-your-pc)

## Screenshots

Click an image to open it at full size.

**Last Stand · themed survival cover**

Every zombie arena now has four authored cover groups: espresso carts and café barricades in Paris, fallen market screens and an upper-floor panic ticker in the trading office, valve elbows and filter drums in the sewers, a stranded rescue sled in the snow, and other props fitted to each setting. Low exposed surfaces form real hop routes; taller pieces block shots. Original doors, spawn spaces and roof climbs remain open to players and the wider hounds. Armed monsters use their physical escape path when stuck at a cover corner. These Last Stand layouts leave Breach maps unchanged.

**Last Stand · vampires, witches and zombified wildlife**

Six additions bring the horde to seventeen creature types. Rats scurry low, boars commit to a rushing charge, wolves approach your flanks, vampires heal from landed bites, witches cast dodgeable hexes and antlered stags shove with a melee hit. Each has distinct voxel anatomy, movement, attack warnings and collapse animation. Open **Meet the horde** before starting for first appearances and counters.

The ordinary **Ash Stalker** has a detailed damaged face, separate eyes and teeth, a torn layered work shirt, uneven bony fingers and an exposed shin. Its clothing and limbs follow the accepted walking and attack joints, and the same model collapses on death. The extra detail stays inside its existing shooting and movement body.

[![A redesigned Ash Stalker approaching during an actual Last Stand wave, showing its damaged face, torn work shirt and bony hands](docs/screenshots/voxel-ash-stalker.png)](docs/screenshots/voxel-ash-stalker.png)

[![Actual Last Stand field guide showing six pixel silhouettes, first-wave badges and practical counters](docs/screenshots/voxel-horde-field-guide.png)](docs/screenshots/voxel-horde-field-guide.png)

[![A naturally introduced Plague Rat with its low body and visible health bar during real wave-two Last Stand play](docs/screenshots/voxel-plague-rat.png)](docs/screenshots/voxel-plague-rat.png)

**Shinobi Showdown 3D · a separate third-person duel**

The original 2D Showdown remains available. The 3D game uses the voxel movement and collision system with a visible animated ninja, a wall-aware shoulder camera and a centered crosshair. Choose a distinct courtyard, connected roofwalk or indoor dojo, then start against one to four bots at Normal, Hard or Expert, or create a two-player PC-hosted room and ready together.

Use WASD or ZQSD to move, Shift to sprint, Ctrl to crouch, C to walk and Space to jump. Left-click cuts; right-click commits a timed parry. E dashes, F feints during a cut startup, and Q throws a kunai (A on ZQSD). Consecutive confirmed cuts build a three-hit finisher. Cover blocks throws, parries can reflect them, and dashes obey walls and player bodies. P opens the menu. Online opponents keep playing while your controls are released.

[![Actual Shinobi Showdown 3D gameplay with a katana slash, animated ninja and centered crosshair in Sakura Courtyard](docs/screenshots/shinobi-3d-courtyard.png)](docs/screenshots/shinobi-3d-courtyard.png)

| Moonlit Roofwalk | Lantern Dojo |
| --- | --- |
| [![Real third-person play on the connected roofwalk under a blue night sky](docs/screenshots/shinobi-3d-rooftops.png)](docs/screenshots/shinobi-3d-rooftops.png) | [![Real third-person play with shoji cover, warm lanterns and an elevated dojo gallery](docs/screenshots/shinobi-3d-dojo.png)](docs/screenshots/shinobi-3d-dojo.png) |

[![Completed two-player Shinobi duel with a 2–0 score, 440 damage, two eliminations and guarded rematch controls](docs/screenshots/shinobi-3d-victory.png)](docs/screenshots/shinobi-3d-victory.png)

**Walking, combat and reload motion**

Shared voxel operators and Shinobi now have much clearer walking and sprinting: higher foot lifts, stronger knee bends, larger directional strides and opposing hip/shoulder weight shifts. Slow walking keeps an expressive step, and crouching stays compact. Zombies have stronger shambles; dogs, wolves, boars, rats and stags have more visible alternating paws. Cuts and parries move the shoulders and elbows; reloads follow ammunition, magazine and charging-handle stages. These images come from actual keyboard/mouse gameplay.

[![Controlled preview of the shared walking rigs: a human operator, Ash Stalker and running Grave Hound](docs/screenshots/voxel-stronger-walking.gif)](docs/screenshots/voxel-stronger-walking.gif)

The strip above previews the actual exported game rigs in a controlled scene. Live Breach bots and Last Stand monsters are also checked in the browser. Movement, weapon grip, collision bodies and footstep contact timing stay shared with gameplay.

First-person sprinting has a more noticeable shoulder roll than walking, alongside the gentle distance-driven head dip and low weapon carry. The motion eases in and out, settles against walls and pauses, and stays still while fully scoped or using reduced motion. It follows the shared voxel FPS renderer in Breach, Royale, Last Stand and the Dojo. **Camera wobble** is shared across every first-person voxel game: Breach, Royale, Last Stand, their solo practice modes, the Dojo and Voxel Wilds. Use the **P** menu to choose **Normal**, **Strong**, **System preference** or **Off**; practice and Last Stand also expose it in setup. New players start with Strong sway. Existing saved choices carry across modes. System follows the browser’s reduced-motion preference; Normal and Strong explicitly enable walking and running sway. Strong increases shoulder roll without increasing the gentle head dip. Changing the choice does not restart the game; aiming remains steady. Refresh an already-open tab after updating the hub.

| Moving ninja | Carbine reload |
| --- | --- |
| [![Actual native Shinobi movement with an articulated walking stride in Lantern Dojo](docs/screenshots/shinobi-3d-walking.png)](docs/screenshots/shinobi-3d-walking.png) | [![Actual native voxel carbine reload with the support hand following ammunition and weapon grips](docs/screenshots/voxel-articulated-reload.png)](docs/screenshots/voxel-articulated-reload.png) |

[View the articulated katana cut](docs/screenshots/shinobi-3d-articulated-cut.png).

**Distinct arenas · connected upper floors**

The combat maps now use different floor plans and height routes. Barclays has an open upper trading floor with long workstation benches, paired market-monitor banks, PC towers and chairs. The rounded Barclays eagle, based on the supplied reference, and Barclays wordmarks identify its actual interior walls. Desks and screens provide physical cover on both levels. Paris connects mansard roofs above real apartment courtyards; Frostline links laboratories through an enclosed skybridge; the Sewers combine branching tunnels with a raised pump-and-service circuit.

Royale's original three arenas have also been rebuilt: Cedarfall has a suspended canopy village and firewatch tower; Verdant has an asymmetric ground maze below an observatory circuit; Anubis has a columned temple second floor around a climbable pyramid. Each upper route has several physical approaches, cover and space to pass underneath.

| Barclays upstairs trading desks | Paris connected roofs |
| --- | --- |
| [![Actual upstairs Barclays trading bench with a detailed blue eagle, financial displays and PC towers](docs/screenshots/voxel-barclays-risk-office.png)](docs/screenshots/voxel-barclays-risk-office.png) | [![Live Paris rooftop route overlooking an apartment courtyard](docs/screenshots/voxel-paris-connected-roofs.png)](docs/screenshots/voxel-paris-connected-roofs.png) |

[See the corrected Barclays eagle in-game](docs/screenshots/voxel-barclays-eagle.png). The eagle silhouette uses the Simple Icons CC0 vector, sampled as static voxel wall geometry.

[Explore the full Barclays upper-floor view](docs/screenshots/voxel-barclays-connected-floor.png). Compare [Courtyard](docs/screenshots/voxel-courtyard-authored-layout.png) and [Canal](docs/screenshots/voxel-canal-authored-layout.png).

**New training maps · Crownfall Keep**

Lantern Hall brings indoor blade and peek practice; Iron Range adds long shots and an elevated gantry. Crownfall Keep now has a four-storey royal keep, a tall central hall, three-storey watchtowers, arched entrances, interior stone jump flights and connected wall walks at three heights. Its Royale version includes the surrounding medieval village.

[![Lantern Hall gameplay showing shoji panels, warm lanterns and the raised firing gallery](docs/screenshots/lantern-hall.png)](docs/screenshots/lantern-hall.png)

[![Iron Range gameplay showing industrial cover, measured lanes and an elevated firing gantry](docs/screenshots/iron-range.png)](docs/screenshots/iron-range.png)

[![Crownfall Keep gameplay showing the medieval gatehouse, towers and linked battlements](docs/screenshots/crownfall-keep.png)](docs/screenshots/crownfall-keep.png)

**Ember Delve · third-person voxel dungeon**

A visible adventurer, animated guards, torch-lit rooms and camera-relative WASD/ZQSD controls. Hold **Shift** to sprint with stamina, **Ctrl** to crouch, or **C** to walk quietly. The twelve-room descent, relics, three bosses and Veteran challenge remain.

[![Real third-person Ember Delve gameplay with a hooded voxel adventurer, animated guards, dungeon cover and compact health, stamina and ember bars](docs/screenshots/ember-delve-3d.png)](docs/screenshots/ember-delve-3d.png)

[![Ember Delve crouched adventurer with compact stamina and ember HUD](docs/screenshots/ember-delve-crouch.png)](docs/screenshots/ember-delve-crouch.png)

**Voxel victories and session reports**

Breach and Royale wins now finish with a short voxel crest reveal and a dark results panel. Online results include the real team score or survivor placement and personal combat totals. Ember Delve celebrates the completed descent with chambers, keepers, time, score and your relic build. Replay and rematch actions sit below the statistics and wait for held controls to be released. Reduced motion uses a shorter, still reveal; victory sound follows the game sound toggle.

Last Stand celebrates each cleared wave without blocking looting or movement. Voxel Wilds marks actual nights survived and records expedition statistics when the run ends. In the Dojo, open the range tools with **Tab** and choose **Finish training** for a contact, damage and blade report; resume the same session or change your setup. Endless modes keep their ongoing goals.

[![Real Voxel Breach victory results with a gold pixel crest, recorded combat statistics and guarded lower replay actions](docs/screenshots/voxel-breach-results.png)](docs/screenshots/voxel-breach-results.png)

**Royale victory**

Finish the final fight, watch the gold crown reveal, and review your placement and combat stats. Every bot starts with a knife and scavenges real supplies.

[![A real Voxel Royale win with a gold voxel crown, first-place banner and arena visible behind the celebration](docs/screenshots/voxel-royale-victory.png)](docs/screenshots/voxel-royale-victory.png)

**Game hub**

[![semaG dark game library with the available games and room controls](docs/screenshots/game-hub-dark.png)](docs/screenshots/game-hub-dark.png)

**Voxel armory**

[![Visual voxel armory with weapon cards, categories, a rotatable 3D model and explicit Equip](docs/screenshots/voxel-armory.png)](docs/screenshots/voxel-armory.png)

**Quick weapon picker**

[![Searchable dark gun picker with small voxel weapon icons, grouped categories and ammunition hints](docs/screenshots/voxel-weapon-picker.png)](docs/screenshots/voxel-weapon-picker.png)

**Roomier Dojo setup**

[![Wide Dojo setup with aligned gun and blade cards and readable weapon names](docs/screenshots/voxel-dojo-setup.png)](docs/screenshots/voxel-dojo-setup.png)

[View the compact window layout](docs/screenshots/voxel-dojo-setup-compact.png).

**Weapon reticles · Voxel Dojo**

[![Live Voxel Dojo gameplay with the shotgun spread ring centered on a training target](docs/screenshots/voxel-weapon-reticles.png)](docs/screenshots/voxel-weapon-reticles.png)

**Last Stand results**

[![Last Stand death screen showing damage dealt, wave, hostiles defeated, survival time and Replay](docs/screenshots/voxel-last-stand-results.png)](docs/screenshots/voxel-last-stand-results.png)

**Voxel Breach**

[![Voxel Breach solo practice on the Barclays Trading Floor with trading-screen cover](docs/screenshots/voxel-breach.jpg)](docs/screenshots/voxel-breach.jpg)

**Two-floor arenas**

| Barclays Trading Floor | Undercity Sewers |
| --- | --- |
| [![Trading floor mezzanine with a connected upper crossing, monitor cover and desks below](docs/screenshots/voxel-trading-upper-floor.png)](docs/screenshots/voxel-trading-upper-floor.png) | [![Connected sewer maintenance walkway with a manifold, pressure pipes and ground passages below](docs/screenshots/voxel-sewers-upper-floor.png)](docs/screenshots/voxel-sewers-upper-floor.png) |

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
| Lockdown | Top-down team brawl: up to 4v4 online / solo with 7 bots | Capture and hold three control points with swords, guns and bombs. Pick Striker, Guardian or Recon, three of seventeen Spiral Knights-style weapons and one of six arenas; first team to 500 points wins. |
| Voxel Dojo | Solo first-person training | Try every gun and blade against resettable targets on three training maps, inspect equipment and review your training report. |
| Voxel Wilds | Solo first-person voxel survival | Mine editable woodland terrain, craft tools and supplies, build shelter, and survive escalating nights with an eight-slot inventory and a saved world. |
| Voxel Last Stand | First-person monster survival: solo / 1–3 player co-op | Survive endless escalating waves on thirteen maps, fight seventeen monster types, collect health, ammo and occasional weapon drops, manage four flexible inventory slots, and revive your squad. |
| Voxel Breach | Tactical voxel 3D FPS: 1v1 / 2v2 / 3v3 | Hold angles, plant or defuse the bomb, and win four rounds on one of thirteen authored maps. |
| Voxel Royale | First-person voxel battle royale: 2–10 players / solo vs 1–10 bots | Spawn randomly, scavenge weapons and supplies, escape the shrinking storm, and be the last survivor on one of ten authored maps. |
| Shadow Lantern | Solo ninja stealth campaign | Collect guarded seals and extract across nine authored heists in three districts, using cover, sneaking, distractions and limited smoke. |
| Shinobi Showdown 3D | Third-person voxel duel: online 1v1 / solo vs 1–4 bots | Win two rounds across Sakura Courtyard, Moonlit Roofwalk or Lantern Dojo. Confirm katana combos, reflect kunai with timed parries, feint a startup and spend stamina on physical dashes. |
| Shinobi Showdown | Real-time 1v1 duel / solo vs 1–4 bots | Confirm katana chains, feint heavy strikes, land precise parries and manage stamina across three arenas. Choose Normal, Hard or Expert opponents in solo play. |
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
| Ember Delve | Solo third-person 3D voxel roguelike | Explore twelve branching dungeon rooms, build relic synergies, and defeat three distinct bosses. |
| Deckbound | Solo deckbuilding roguelike | Survive eighteen encounters with 24 cards, eight relics, enemy intent, and three act bosses. |
| Oddstock Rumble | Bonus 1v1 platform brawler | Choose one of six comic fighters; use knockback, recovery, and stage control to take three stocks. |
| Rift Survivor | Solo survival arena | Read enemy attack patterns, choose upgrades, and build synergistic relics and defeat four guardians across twenty waves. |

The action games are original implementations. Checkers follows American checkers rules. All multiplayer card games use the same two-seat rooms, ready countdown, and rematch flow. The shelf filters show **All games**, **With a friend**, **Solo**, **Driving**, **Action**, **Roguelike**, **Ninja**, or **Voxel**. Search narrows the selected shelf by title, category, or description. Room joining and invitations sit beside the game library on desktop and follow the games on smaller screens.

The graphics use original local artwork: illustrated cards and enemy portraits,
expressive character sprites, textured arena materials, crafted board pieces,
and detailed driving scenery. Static art is cached, gameplay effects stay
readable, and the shelf artwork matches the games. Assets ship with the host;
playing does not require an image service. The hub uses its pixel semaG wordmark and S badge.

Driving and action games use swept collision checks for moving bodies and projectiles. Cover stops shots at their first impact, vehicle depth shows occupied road space, and attack poses match active damage frames. Compact impact effects make solid contacts easier to read.

Solo games open on their challenge settings: **Veteran** for the action,
deckbuilding, driving, and falling-block games. Easier modes remain available
in each game. Veteran and Nightmare demand stronger tactics, pace,
or planning, and keep their records separate from easier runs. Revised challenge
records stay separate from historical scores. The authored solo campaigns also keep
their completion records separate by difficulty.

## Starting a solo game

Open a solo game from the shelf, review its controls, and press **Start game** when you are ready. The game and its timers wait on the ready screen. After starting, press **P** to pause or resume, or use Pause / Resume and New game for that session.

The interface uses a modern dark theme and the pixelated **semaG** wordmark. Voxel loadouts have a compact, searchable shadcn weapon picker with small voxel thumbnails, category headings and a selected marker. Click a weapon or press Enter to choose it; opening, searching and highlighting leave your current loadout in place. **Armory** opens the full weapon collection: browse cards, rotate the actual voxel models, inspect damage and handling, then explicitly Equip. Choosing equipment never starts the game. Both pickers also cover training blades and the Dojo racks. Game canvases retain their own artwork and HUD signals.

Practice and Last Stand use wider setup panels with equipment in its own row. The Dojo keeps gun and blade cards aligned side by side on wider windows; narrow phones stack them. Chosen weapon names wrap in full, and taller screens show more weapons in the dropdown before scrolling.

Heavy rifles, machine guns, revolvers, shotguns and heavy snipers have stronger recoil and matching weapon kick. Vandal climbs more than Phantom; Odin kicks harder than Ares, and Stinger requires more control than Spectre. ADS reduces recoil, short bursts preserve control, and releasing fire lets the aim settle. This tuning applies to Dojo, practice and online voxel modes.

The isolated UI source and rebuild instructions are in [ui/armory](ui/armory/README.md). Hosting the game still needs only the normal root install; the compiled armory is included.

When a solo Last Stand ends, the death screen shows your total **Damage dealt**, wave reached, hostiles defeated and time survived. **Replay** starts the same map, difficulty and chosen loadout with full health and fresh run statistics; **Change setup** returns to the ready screen. Damage counts actual enemy health removed, including melee and grenade hits.

Defeated monsters visibly collapse and fade out after a short death animation. Dogs roll onto their side; humanoid monsters fall onto the ground. Defeated enemies stop attacking immediately, and loot remains available during the animation in solo and co-op.

Enemy movement has planted steps, bent knees, arm swing and weight shifts, with distinct gaits for hounds, runners and heavy monsters. With sound enabled, nearby enemies make footsteps synchronized to their actual movement. Steps become quieter with distance and come from the enemy's direction; idle, airborne and defeated enemies stay silent.

Operators and Shinobi now keep their feet down during the supporting part of each step, then ease the moving foot back into place. Shoulders and hips counterbalance, stance changes settle smoothly, and bent elbows keep hands attached to the weapon during cuts, parries and reloads. Reloads include reaching for fresh ammunition, inserting it, seating it and working the charging handle. First-person weapons have controlled sprint carry and landing response; added sway settles away when aiming, and reduced motion calms head bob. Stationary monster windups stay visible and ease through release and recovery. Footstep sounds follow the rendered touchdown. Some foot sliding remains at high speed; the visible supporting stance is improved without changing the collision body.

Voxel players and practice bots also recoil, collapse and dissolve after a confirmed kill. The final elimination remains visible for about a second before results appear in Breach, Royale, Last Stand and FPS practice. Controls release immediately and the combat result stays final during that brief presentation. Reduced-motion settings use a shorter, quieter transition without a falling camera.

Every PvP game has a **Vs bots** link beside **Create room**. The Solo shelf includes these practice modes as well as the solo games. Shinobi Showdown, Relic Duel, Vector Arena, Oddstock Rumble, Checkers, Crazy Eights, 21 Duel and Memory Match open with **Normal**, **Hard** or **Expert** opponents; **Hard** is selected initially. Review the setup and press **Start game**. Pause / Resume and **P** stop the solo simulation; **P** also opens Room & controls. Escape remains available for browser fullscreen and mouse release. Play again resets the match, and the setup returns so you can change the challenge.

In Shinobi Showdown, choose **one to four bots** and **Moonlit Rooftops**, **Lantern Garden** or **Winter Shrine**. Bots form the opposing team and cannot hurt each other. Win a round by defeating the whole team; the first side to win two rounds wins the match. Each ninja has its own health and stamina bars, while the top HUD shows the remaining opponents and their combined health. The selected arena stays fixed for the solo match. Opponents use delayed observations, real stamina costs and the same cuts, kunai, feints and parries as a player.

Checkers bots search legal moves, including mandatory captures and continuing jumps. Card opponents only receive their own player view: hidden hands, the deck and unrevealed Memory cards stay private. Memory bots learn from cards actually turned over during either player's turn. Afterimage retains its five training opponents and ladder; its **Vs bots** link opens the ready screen. Breach and Royale retain their existing bot-practice setup and maps.


Play pages use compact headers and keep the game in the main space. **Controls & info** opens solo instructions and records; **Room & controls** opens multiplayer setup, invitations and rules. Opening solo instructions pauses the run; close them and press Resume when ready. Multiplayer matches continue while a panel is open. Fullscreen keeps an exit button available alongside the game.

## Keyboard layout

Choose **WASD** or **ZQSD · Français** from the **Keyboard** selector on the shelf or game header. Semag remembers the choice in your browser, and each player can choose independently. Movement keys, hints, and accessible controls update together; arrow keys and touch controls stay available. In ZQSD, Prism Shift uses **W** to rotate counterclockwise so **Q** and **Z** can control movement. Switching layouts releases held controls without restarting the run. The game instructions below use the default WASD labels.

Combat actions sit near the movement keys: **C** attacks, **G** uses the heavy or secondary attack, and **F** defends in the fighting games. Shinobi uses **E** for kunai. Mouse attacks and the earlier J/K/I/L/U aliases remain available. Voxel uses **Q** (**A** in ZQSD) for grenades and **F** for potions, with G/H retained. Solo games use **P** for pause; Escape stays available to the browser. Deckbound and Ironwood accept the French number row without holding Shift.

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

The Windows launcher opens a retro host console with an animated **semaG** pixel logo (Games spelled backwards), an online indicator, uptime and your share links. Keep it open while playing; **Ctrl+C** stops the host. Narrow terminals and redirected logs use a plain, static display. Set `SEMAG_NO_ANIMATION=1` before starting to disable the animation.

Keep that terminal open while playing. Open **http://localhost:3000** in a current browser. Enter your player name and choose a game. Solo games open with **Open game**, wait for **Start game**, and run in your browser. For multiplayer, create a room and send your colleague the invitation, or **http://YOUR-PC-HOSTNAME:3000** plus the room code. They can join a listed room or enter its code. For **Voxel Royale**, choose a map and a capacity of 2–10, then invite your rivals. The host presses **Start battle** once at least two players are connected; unused seats do not delay the start. For **Voxel Last Stand**, choose one of thirteen maps and Veteran or Nightmare, then play solo or host a three-seat co-op room. Every connected teammate readies up; the host can start with one, two or three players. Other multiplayer games use all-player **Ready**. Oddstock also asks both players to choose a fighter and the host to choose a stage. Voxel Breach first opens a setup dialog: choose 1v1, 2v2 or 3v3 and a map, then create the room. The selected number of players must join before the match can begin. A player cancelling readiness during the initial countdown returns the room to the lobby.

The colleague must be able to reach your PC. On the same LAN or a suitable VPN, allow inbound **TCP port 3000** through the host PC's firewall. If the hostname does not resolve, use the LAN IP address printed by the server, for example `http://192.168.1.42:3000`. `localhost` refers to the machine opening the page, so share your PC's hostname or IP instead.

For players on separate networks, use a VPN that lets both computers reach each other, or configure your router to forward TCP port 3000 to your PC and share your actual public hostname/IP. Running the server does not automatically make your PC reachable over the internet. Stop it with **Ctrl+C** when finished.

**Internet play from KOOBZ3:** the PC can host the match while Sites hosts the library. On Windows, install Cloudflare's `cloudflared` tunnel client, then run **start-online-windows.bat** from the game folder. It starts or reuses the local semaG host and displays a temporary public **HTTPS** address. Open the [semaG website](https://semag.daaalil.chatgpt.site/), choose **Play with friends**, and paste that address. The browser opens the PC's public hub; create a room there and share its invitation. Keep KOOBZ3 and the launcher running while playing. See [the online-host guide](docs/online-hosting.md) for installation, shutdown and troubleshooting.

## Install semaG as an app

Open **https://semag.lol/** and choose **Install semaG** in the library. Chrome and Edge show their installation prompt when available. On iPhone/iPad, open the site in Safari and choose **Share → Add to Home Screen**; on supported versions, keep **Open as Web App** enabled. Safari on Mac offers **File → Add to Dock**. The installed app opens the same hub in its own window and uses the pixel semaG icon.

Games need a connection to load; multiplayer still needs a reachable PC host. If the connection drops while opening a page, the app shows a clear offline screen with a retry link. Game files and multiplayer responses always load from the network, so installation does not pin old game releases. PWA installation requires HTTPS (or localhost for testing); a plain HTTP LAN address uses the normal browser.

## Controls and rules

Voxel Dojo:

Open **Voxel Dojo** from the library, choose a training map, then press **Enter dojo**. **Cedar Dojo** is a Japanese courtyard with an equipment hall, a tatami melee pad and a real cover wall. **Lantern Hall** adds indoor corner peeks, blade practice and a raised gallery. **Iron Range** offers longer firing lanes and an elevated industrial range. Each map has its own five repeatable targets, measured lanes, equipment stations and physical cover. Try all 39 guns and five blades at the equipment racks, then use real reloads, recoil, head/body/leg damage and hit feedback against repeatable targets. The dojo never ends after a kill: defeated targets return after a short delay. Press **Tab** for the compact range panel, switch stationary/moving targets or reset the drill, and use **F** at the nearby weapon, blade, supply and recovery stations. Recovery and a deliberate training wound let you test real potion healing; grenade supplies let you practice real blasts. Normal magazines and reload times remain, with reserve ammunition replenished in this sandbox. [Dojo guide](docs/voxel-dojo.md).

**Crownfall Keep** is available in Breach, Last Stand and Royale, including bot practice. Its royal keep rises 14.4 metres over a three-storey gatehouse and watchtowers. Actual floor plates surround a tall central hall; alternating stone jump flights, two roof approaches and connected wall walks link all levels. Arched entrances, crenellations and heraldic banners give the fortress its medieval silhouette. Courtyard stalls, chests and masonry provide close-range cover. Royale uses a larger 96 m layout with additional village buildings and finite loot in interiors and on rooftops.

Lockdown:

A top-down team brawl in the spirit of Spiral Knights' Lockdown. Choose **Play solo** for a practice match against seven bots, or **Create room** and share the invite; up to eight people play, split into Amber and Cyan, and bots take every empty seat (including the seat of anyone who leaves mid-match). The host picks one of six arenas and presses **Start match**: **Old Keep** (a castle courtyard with corner towers and a moat around the inner keep), **Hedge Labyrinth** (a maze of hedge corridors), **Clockwork Foundry** (lava channels crossed by a few bridges), **Sunken Temple** (flooded pools that block your feet but not your shots), **Gloom Graveyard** (tombstone rows and a crypt holding B) and **Sky Bridges** (platforms over the void joined by narrow bridges). Each team's base is a spawn room against the far left or far right wall. Each team scores every five seconds for the points it holds (5 for one, 8 for two, 9 for all three); the first team to 500 points, or the leader after ten minutes, wins. Stand inside a point's ring to capture it; enemies on the same point stop your progress. Knocked-out knights respawn at base after five seconds plus one per minute played.

- **Base:** your team's spawn area heals you (25 HP a second) and is the only place to change class and weapons mid-match: step in and press **B**. While you wait to respawn you can also press **B**; the new loadout applies when you return. Teams stay fixed until the next lobby. Bots fall back to base when badly hurt.
- **Hearts:** every knockout drops a heart that heals 30 HP to whoever grabs it first (either team, only if hurt). Hearts fade after 15 seconds.
- **Scoreboard:** hold **Tab** during play. At the end of the match each team gets a table with every knight's **score**, kills, deaths, damage dealt and captures, with team totals and the top knight. Personal score comes from the zones: +30 for each capture you are part of, +15 for knocking an enemy point back to neutral.

- **Classes**, as in Spiral Knights Lockdown: the class ability takes the place of a shield and is on **right click** (or **Space**). Switch class in the menu or with the class buttons that appear in your base.
  - **Striker** (100 HP): swords hit 25% harder and swing 20% faster; bombs charge slowly. **Boost** dodges a short distance untouchable, then sprints for three seconds. 6 s cooldown.
  - **Guardian** (120 HP): bombs charge 30% faster. The only knight with a **shield**: hold right click to raise it. It blocks hits and status effects at once, and after a second grows into a dome that also shields teammates from outside fire and heals everyone inside. Swords wear it down faster and bombs hardest; it breaks into a stun and recharges in about eight seconds.
  - **Recon** (95 HP): guns deal 10% more damage and charge 20% faster. **Cloak** turns you invisible; the first hit out of it marks the target to take 30% more damage.
- **Weapons:** carry three of seventeen, built on Spiral Knights' weapon types. Every weapon has a charge attack: hold the button and release when the ring is full.
  - **Swords** swing combos that land as the blade sweeps across, step you forward, and pause both knights for a moment on contact. Pressing again during a swing queues the next cut, and once part of the recovery has passed it cancels straight into it. **Animation cancel:** using your class ability (Guardian shield, Striker Boost or Recon Cloak) during a cut's recovery cuts it short and keeps your place in the combo. Swords wear shields down faster than guns. Knight Brand (normal; charge: lunge into a burning burst), Troll Cleaver (heavy, stuns; charge: leaping ground slam), Needle Rapier (fast thrusts; charge: long lunge), Briar Blade (charge: a spray of poison thorns), Umbral Greatblade (charge: a shadow wave that carries knights along), Gyre Spur (fast; charge: three spinning turns).
  - **Guns** reload by themselves after a short pause or when empty, even holstered. Pulse Blaster (charge: piercing bolt), Ripple Caster (pulsar waves that widen and pass through knights), Ricochet Coil (bolts bounce off walls; charge: four shocking bolts), Rattle Autogun (charge: focused stream), Tether Catalyst (shots stick up to three charges; the charged detonator sets them all off), Thunder Hand-cannon (heavy knockback; charge: explosive round).
  - **Bombs** plant from a full charge while you move slowly. Blast Bomb (fast charge), Ember Haze and Frost Haze (clouds that burn or freeze), Splinter Bomb (eight shards), Vortex Bomb (pulls enemies in, holds them, then blasts them apart).
- **Status effects:** burning takes a few points every half second, poison weakens your hits and stops all healing, shock briefly stuns you every few seconds, and freeze holds you in place until the ice breaks or someone hits you. A Guardian's shield and dome block them.
- **Controls:** **WASD** or arrows move (ZQSD on AZERTY), the mouse aims and your knight turns to face it, **left click** attacks and charges, **right click** or **Space** uses the class ability (hold it as a Guardian), **1–3**, **Q** or the wheel switch weapons, **B** opens the loadout in base, **Tab** shows the scoreboard, **Esc** opens the menu (it pauses practice).

The game runs fully on placeholder shapes. Sprites are listed in `public/lockdown-assets.js`; drop PNGs into `public/art/lockdown/` following `public/art/lockdown/ASSETS.md`, then run `node tools/lockdown-art-index.mjs`.

Voxel Last Stand:

Choose **Play solo** or **Host co-op** from the shelf. Both open a setup preview with thirteen arenas: Sunset Courtyard, Freight Depot, Canal Exchange, Roofline District, Iron Foundry, Signal Bastion, Paris Rooftops, Frostline Research, Undercity Sewers, Barclays Trading Floor, Neon Market, Foundry Lockdown and Crownfall Keep. Pick any of the 36 Breach guns and **Veteran** or **Nightmare** difficulty. Last Stand starts with a knife in slot 1 and your chosen gun in slot 2; slots 3 and 4 are empty. Find better blades and supplies during the run. Solo waits for **Start survival** and runs locally. Co-op supports one to three connected players; each presses **Ready**, then the host presses **Start squad survival**. Unused seats do not delay the start, and active runs are closed to new arrivals.

After the three-second countdown, survive endless increasingly dense waves. Ash Stalkers close on your position, Rift Runners rush, and Iron Brutes punish players who stay within reach. From wave four, Hollow Gunners fire sidearms; later waves introduce SMGs, shotguns and rifles from the expanded arsenal. Rift Marksmen join with precision guns from wave seven. Their carried guns can become real weapon drops. Melee windups and armed aim warnings give you a chance to dodge or reach cover. Monsters follow ground flanks and climb the authored routes onto rooftops. Their shots, blades and bodies use the same solid-cover and damage rules as the other voxel shooters; teammates cannot damage each other.

Grave Hounds enter from the first wave: low, four-legged zombie dogs run faster but have less health and weaker bites. Aim down at their actual head and body with a knife or gun; the descending cuts of swords, katanas and axes can reach their low bodies. Keep an escape route and punish a bite windup. Dogs carry no weapons and never drop guns or blades. Rift Leapers join from wave three, crouching before a fast committed lunge; sidestep the tell or put solid cover in their path. Ash Screechers join from wave five and telegraph a roar that briefly rallies nearby monsters with a clear path. Interrupt the roar with melee or eliminate the support creature before the pack speeds up. Rallies expire quickly and do not stack. The new types have distinct silhouettes, movement and attack cues in solo and co-op.

Three special monsters add different responses: **Cinder Bombers** enter from wave 3, rush close and commit a glowing fuse before a cover-tested blast; **Shard Spitters** enter from wave 5 and commit a windup before launching a visible, dodgeable projectile; **Rift Weavers** enter from wave 8 and mark a fixed patch of ground before an eruption. Move or jump out of the rune, or interrupt the caster during its warning. These creatures retain their roles and introduction waves. Special attacks have bounded visual pools, stop correctly on pause and reset, and use real cover and actor lives. Clean sniper headshots remain lethal against all recognized monster types.

The seventeen-creature roster also includes **Plague Rats** from wave 2, tiny, fragile pests; **Carrion Boars** from wave 3, zombified pigs with a long warning before a straight charge; and **Moon Wolves** from wave 4, fast pack hunters that approach your flanks. **Dusk Vampires** join in wave 6 with a committed lunge and recover a little health only when their bite actually hurts a survivor. **Hex Witches** join in wave 8 with a visible casting tell and slower, dodgeable violet projectiles. **Hollow Stags** enter in wave 9 with antlers and a short, collision-tested shove. Sidestep committed attacks, interrupt windups with a blade, and use solid cover. These six creatures carry no guns or blades; their supplies come from ordinary health and ammunition drops. Each animal has its own low hitboxes, four-legged gait and collapse pose. Open **Meet the horde** during setup, or the help menu, for their silhouettes, debut waves and counters.

In co-op, teammates' names appear just above their characters. Visible monsters have compact overhead health bars showing their current health. Solid cover hides these labels, including when a small hound is concealed behind low cover. Names and bars follow the rendered character and camera, including crouching, jumping and aiming. Breach also displays friendly squadmates' names, and Dungeon Run displays its adventurers' names.

Blade swings leave a bright slash trail that follows the real cut. Swords, katanas and axes can damage every monster touched by their sweep once per swing; monsters do not shield one another, while solid cover and teammates still block the cut. Successful hits push surviving enemies back, with heavier brutes resisting more. Sword and katana pushes leave nearby survivors within reach for a follow-up cut; the axe retains its heavier shove. The knife uses a narrow stab, and twin tonfas alternate short strokes.

Early waves reward close engagement: human melee damage is multiplied by 1.6 in wave one, 1.4 in wave two and 1.2 in wave three, returning to normal from wave four. A confirmed melee hit can briefly interrupt a monster's windup and movement. Stagger becomes shorter in later waves, brutes resist it, and an immunity window lets monsters finish subsequent attacks; repeated swings cannot hold an enemy indefinitely. A katana rewards narrow, longer-reaching cuts; the axe trades a slow commitment for heavy damage, while dual tonfas alternate rapid short-range strikes. Move in during a tell, strike, then dodge out. Intermissions leave an optional close-combat supply, and monsters can occasionally drop a melee weapon. Living players keep their inventory choices, including replacing their blade with another gun.

Use **WASD / ZQSD / arrows**, mouse look, **LMB / B / J** to fire or swing, **RMB** for gun sights or alternate fire, thrust with a knife or parry with another blade, **1–4** to select an inventory slot, **X** to drop the selected item, **T** to swap between a carried blade and gun (or cycle items when no melee weapon is carried), **R** to reload, **Space** to jump, **Ctrl** to crouch, **Shift** to sprint and **C** to walk quietly. **G** throws a carried frag; **H** drinks a carried potion; hold **Q** / **E** to lean. Defeated enemies can leave potions or ammunition, and armed monsters sometimes leave their actual gun. Approach and press **F** to collect supplies, with walls blocking collection. Potions enter your inventory and must be drunk; collecting one does not instantly heal you. Weapons occupy one of four flexible inventory slots, and each potion stack holds up to two. Drops expire and supplies are limited. The compact HUD shows health, stamina, ammo, utility, wave pressure and squad status; blood, hit-location damage and directional warnings confirm contacts.

Hold **F** near a fallen teammate for three seconds to revive them at 75 HP. Stay still with a clear path; movement, damage and combat actions interrupt the channel. Each teammate can be revived once per wave. Clear a wave for an eight-second intermission, replenish ammunition, choose another gun and bring fallen connected teammates back. During the break, **H** drinks a looted potion and **R** reloads the selected gun. **T** swaps blade and gun; **V** punches; **1–4** and the mouse wheel equip any carried item. Healing and reloading retain their normal timing and resource costs; an action begun near the end of the break can finish in the next wave. Survivors recover 35 HP between waves; carried potions still come from loot, with no free potion or grenade refill. Fallen teammates return at 150 HP. A squad wipe ends the run with the wave reached, kills and survival time. The host can reopen the lobby and start another stand; host migration and disconnects preserve a surviving team's run.

**P**, Pause and Help freeze solo runs. **P** opens the pause menu without leaving fullscreen; Change loadout & setup starts a new solo run. In co-op they release only your controls while the squad's battle continues; return with **Resume**. Touch movement/look pads and combat buttons are available. Sound and fullscreen are optional. Gameplay uses the shared 120 Hz simulation and high-refresh movement presentation; online snapshots use the same compensated hitscan and buffered remote movement as Breach.

Voxel Royale:

Choose **Cedarfall Reserve**, with a suspended canopy village, connected timber bridges, scattered ranger cabins and a higher firewatch tower; **Verdant Labyrinth**, an asymmetric ground maze beneath connected second-storey observatories; **Dunes of Anubis**, with shaded temple colonnades, a continuous ceremonial upper floor, outer tombs and a climbable stepped pyramid; **Paris Rooftops**, with stone apartment interiors, café courtyards, boulevard cover and connected mansard roofs; or **Crownfall Keep**, with a medieval village, enterable watchtowers and connected battlements. Doors lead into actual interiors, and several physical jump approaches keep elevated routes contestable. A map preview helps the host choose an arena.

Choose **Vs bots** for a solo battle against **1–10 opponents**. Ten bots means eleven survivors including you. Every survivor starts with the same knife. Gun caches stay at least four metres from active spawn positions, so bots must visibly move to a real cache and pick up their equipment before firing. Bots fight one another and move toward the storm's safe ground. Review the setup before starting; **P** pauses everyone, and Replay retains your map, difficulty and bot count. Online rooms still hold up to ten human players. A solo victory lets the final death animation finish, then reveals a gold pixel crown and a short chime before placement, outlasted rivals and combat stats. Replay remains protected from held fire; reduced motion and the sound toggle are respected.

The forest, maze and desert arenas now cover **96 × 96 metres**, with outer settlements, ruined galleries, shelters and low cover around their original landmarks. Additional ground-level supplies support the wider routes, while roofs and lookouts reward climbing.

The host starts a battle with any 2–10 connected players. After a three-second countdown, everyone appears at a different random position with 200 HP and only a small knife: no gun, ammunition, potions or grenades. The knife has a quick, committed swing that deals 28 damage within 1.7 metres. Press **F** near a supply to collect it; walls block pickups. Search houses and hidden structures for a changing selection of 36 different guns, sword, katana, axe and dual-tonfa pickups, weapon-specific ammunition, potions and frag grenades. Four flexible inventory slots can hold weapons or supplies; each potion stack holds up to two. Drop any item, including the starter knife, to make room for another weapon. Each gun retains its own ammunition. Eliminated players drop their carried supplies.

Use **WASD / ZQSD / arrows** to move, the mouse to look, **LMB** to fire or swing, **RMB** for gun sights or alternate fire, thrust with a knife or parry with another blade, **1–4** to select a carried item, **X** to drop it, **T** to swap between a carried blade and gun (or cycle items when no melee weapon is carried), **R** to reload, **G** to throw a grenade, **H** to heal and **Q** / **E** to lean. **Space** jumps, **Ctrl** crouches, **Shift** sprints and **C** walks quietly. Breach's weapon-specific recoil, damage by hit location, projectiles and cover apply here too. Healing takes 0.2 seconds and restores up to 60 HP. The potion is consumed only when healing completes; damage or another combat action interrupts it and keeps the potion. Click **Enter arena** to capture the mouse. If capture is unavailable, hold right mouse and drag to look. Touch pads and action buttons are available.

The safe zone contracts in six warned stages over four minutes, with increasing damage outside it. Its final collapse prevents indefinite camping. The compact HUD shows your health, ammunition, supplies, survivors and storm timer; the map shows terrain, your position and the safe circles. Enemy positions stay hidden. You have one life: the last living player wins, and eliminated players can spectate the survivors. A disconnect eliminates that player; if the host leaves, another connected player becomes host. Active matches are closed to new entrants. At the result screen, the host presses **Back to lobby** to allow new players and start another battle. **P** and Help release your controls while the online battle continues. The menu opens without leaving fullscreen; Escape releases the mouse or exits fullscreen.

Voxel Breach:

| Action | Keys |
| --- | --- |
| Move | WASD / ZQSD / arrow keys |
| Look | Mouse; right mouse drag when pointer lock is unavailable |
| Shoot / use selected item | Left mouse button |
| Aim down sights with a gun | Hold right mouse button; aiming reduces mouse speed |
| Committed knife thrust / timed melee parry | Press right mouse button with a blade; release before another action |
| Select inventory slot | 1–4 (physical keys work on French layouts), or click/tap a slot |
| Cycle carried items | Mouse wheel up: previous; down: next. Wraps through guns, blades, potions and grenades, skipping empty slots |
| Drop selected item | X, or the drop button beside an inventory slot |
| Quick blade / gun swap; cycle items without a blade | T |
| Left-hand punch (shove, short stagger, knocks a guard down) | V |
| Lean left / right | Hold Q / E (A / E in ZQSD) |
| Throw frag grenade | G |
| Drink healing potion | H |
| Reload | R |
| Pick up nearby loot / plant / defuse | F; hold it near a site or planted bomb |
| Jump | Space |
| Crouch / slide while sprinting | Ctrl |
| Climb chest-high cover | Space while moving into it |
| Sprint | Hold Shift while moving forward |
| Quiet walk | C |
| Choose a loadout between rounds | On-screen weapon buttons; 1–9 shortcuts choose the original nine guns |

Create a 1v1, 2v2 or 3v3 room and choose any of thirteen arenas, including Crownfall Keep, Frostline Research, Undercity Sewers and Barclays Trading Floor. Every seat must be filled and every player must press Ready. The match begins with a countdown and an eight-second preparation phase; choose a carbine, SMG, marksman rifle, pistol, shotgun, burst rifle, bolt sniper, LMG, crossbow, revolver, suppressed PDW, automatic shotgun, battle rifle, dual pistols, dual SMGs or slug shotgun between rounds. First to four round wins takes the match; teams switch attacking and defending roles after three rounds. Attackers carry the bomb to either site and hold Interact for three seconds to plant it. Defenders hold Interact for five seconds to defuse. A planted bomb has a 35-second fuse and remains live when the attackers are eliminated. Unplanted rounds last 100 seconds. There are no respawns within a round; death lets you watch living teammates.

This is a true first-person WebGL game with local voxel artwork. Stop moving for accurate shots; movement, jumping and sustained fire reduce accuracy. Hold right-click to use the sights: precision improves and recoil decreases, while movement slows. The pistol, shotgun and burst rifle require a fresh click for each shot, shell or burst. The shotgun fires eight pellets with damage falling off at range, and the burst rifle fires three shots per burst. The bolt sniper needs settled ADS for precision and a fresh click after its long cycle. Clean headshots from Rook, Marshal, Outlaw and Operator kill a full-health player in one round, and directly hit monster heads are lethal even in later waves. Rook deals 200 head / 100 body / 70 leg damage within its 150 m range; penetration still reduces damage and does not trigger the monster weak-point kill. Hold the LMG trigger through its 0.2-second wind-up; release, reload or switch actions and it must wind up again. The crossbow fires a visible, gravity-affected bolt at 48 metres per second: lead moving targets, compensate for distance, and manually reload its single shot. Head, torso and leg contacts have separate damage values: precision is rewarded, and leg hits deal less damage. Each loadout shows its damage values, firing cadence, reload time and range falloff before you commit. The shotgun lists damage per pellet; cover checks each of its eight pellets independently. Each weapon has its own muzzle flash, tracer, impact and sound profile. Wood, masonry and metal contacts produce different debris and sparks, while crossbow bolts remain visible projectiles. Reloads and weapon choices create openings. Solid 3D map cover blocks shots before player hitboxes, crouching lowers your profile, and friendly fire is disabled. Click the playfield to capture the mouse; **P** opens Pause & loadout, and Escape releases the mouse or exits fullscreen. Online rounds continue while the menu is open; loadout changes are available between rounds. On hosts where the browser does not allow pointer lock, hold right-click and drag to look while aiming. Touch controls provide movement, look, aiming and action buttons. A disconnect returns the room to the lobby; all players must agree to a rematch.

All thirteen maps have connected jump routes onto real cover. Courtyard uses an L-shaped cloister and loggia; Depot uses staggered freight towers and a cargo gantry; Canal uses unequal crossings and quays; Rooftops joins offset roof blocks; Foundry wraps an asymmetric furnace with service galleries; Bastion connects switchback ramparts and a command tower. Market adds a delivery loop above staggered shops; Lockdown puts a maintenance floor over its L-shaped machine hall. Follow the painted chevrons through short ledges to roofs, balconies and maintenance galleries. Every elevated circuit has several approaches, and each map keeps ground flanks and two ground-level bomb sites. Release Space between jumps; a short landing buffer makes chained hops responsive without automatic jumping. The setup preview and tactical map show these routes and height differences.

Paris Rooftops adds four enterable apartment blocks, two approaches to each four-metre roof, a café courtyard and a contested boulevard. Ground flanks connect both bomb sites; supplies and rooftop ledges also shape its larger Royale variant. Stone façades, slate roofs, striped café accents and a distant voxel Eiffel Tower give the district its Paris character.

Frostline Research joins an enclosed laboratory skybridge to an exposed upper campus route, with a radar dome, weather mast, generators and snowbanks. Undercity Sewers branches through roofed wet tunnels, treatment basins and control chambers, while a raised dogleg service circuit crosses the pump hall. Barclays Trading Floor has clustered workstation islands, chairs, market screens and server racks below an open upper trading floor. Three long trading benches carry six paired monitor banks and six physical PC towers, with clear linked balconies around the atrium. Detailed voxel Barclays eagles and wordmarks sit on its actual interior walls. Desk tabletops and drawer cabinets provide physical cover while leaving open space underneath; monitor banks and large market screens stop shots above the desks. Each layout has its own ground routes, alternate elevated approaches and protected squad starts. All three maps are available in Breach, Last Stand, practice and larger Royale variants with supplies in rooms and elevated positions.

The older arenas also have setting-specific landmarks with real collision: freight forklifts, canal market stalls, rooftop water tanks and ventilation units, foundry equipment, bastion signal relays, forest logging piles, maze waystones, desert obelisks and Paris street kiosks. These additions preserve their original starts, objectives and climbing routes.

The expanded arsenal adds original voxel versions of all **20 current VALORANT guns** alongside the 16 existing semaG weapons:

- Sidearms: Classic, Shorty, Frenzy, Ghost, Sheriff and Bandit.
- SMGs: Stinger and Spectre. Shotguns: Bucky and Judge.
- Rifles: Bulldog, Guardian, Phantom, Vandal and Warden.
- Snipers: Marshal, Outlaw and Operator. Machine guns: Ares and Odin.

Choose a weapon from the grouped loadout menu. The comparison shows actual head/body/leg damage by range, magazine size, cadence and reload time. Classic's RMB fires a simultaneous three-round volley; Bucky's RMB airburst opens into five pellets after 7.5 m, with solid cover blocking it before or after opening. Stinger and Bulldog use committed bursts while aiming. Ares fires immediately; Odin accelerates its automatic cadence. Outlaw has a longer empty reload than a partly loaded reload. Scoped guns lower mouse sensitivity with their zoom; unsighted sidearms and shotguns retain hip-fire look speed. Distinct voxel receivers, magazines, barrels and sights appear in first-person, on other players and as pickups. [Research, full properties and engine adaptations](docs/valorant-arsenal.md) are documented separately.

**Neon Market** favors corner play among shuttered shops, stalls, alley crossings and climbable awnings. **Foundry Lockdown** connects roofed workshops, boiler cover and flanking catwalks. Both have multiple approaches to elevated positions and are available in Breach, Last Stand and Royale. Their close angles favor blades and shotguns through actual geometry. Royale keeps a randomized gun selection, all four collectible blades and healing/ammunition/grenade caches; the close maps guarantee at least two shotgun choices. All 39 guns can appear across matches, and two grapple hooks sit with the first gun caches, while everyone still starts with only a knife.

| Neon Market | Foundry Lockdown |
| --- | --- |
| ![Neon Market: tight voxel shops, stalls and awning flanks](docs/screenshots/voxel-neon-market.png) | ![Foundry Lockdown: workshops, boiler cover and raised routes](docs/screenshots/voxel-foundry-lockdown.png) |

The revolver rewards deliberate six-shot accuracy; the suppressed PDW has a fast close-range cadence and a quiet report. The automatic shotgun trades distant accuracy for repeated close-range shell volleys, and the battle rifle has powerful slow automatic fire with demanding recoil. Each has distinct artwork, reload handling, damage, firing feedback and sound.

**Spray patterns.** Every gun now has a fixed, learnable recoil pattern. Rifles climb straight for about six rounds, then sweep to one side and back. SMGs climb briefly, then zigzag in three-round steps. Machine guns climb for nine rounds, then drift slowly one way and reverse every twelve. One-shot guns kick up with a small, consistent sideways bias. Similar guns open their sweep in opposite directions: Vandal goes right first, Phantom left. The camera shows both the climb and the sideways kick, so pulling the mouse against them keeps a spray on target. Holding the trigger keeps your place in the pattern. A short pause rewinds it, so controlled bursts stay on the straight opening climb. In the **Voxel Dojo**, a **Last spray** card compares your rounds with the gun's untouched pattern and scores your control.

**Counter-strafing.** Tapping the opposite movement key brakes much harder than letting go of the keys. A counter-strafe settles you in 50–60 ms instead of 90–100 ms, and a held counter key stops exactly before carrying you the other way. The first shot on the settled tick is as accurate as one fired standing still. Holding the opposite key afterwards accelerates normally. Scoped guns still reach their precise aimed cone once the sights fully settle (0.15 s), so a clean quick-scope fires on that moment.

**Tactical and empty reloads.** Reloading before the magazine is empty is a tactical reload. It keeps the round in the chamber, so a 25-round rifle holds 25+1. Reloading an empty gun also chambers a fresh round, which takes 25% longer. Revolvers, pump and box shotguns, bolt actions, crossbows and paired guns have no chambered round and keep one reload time. Outlaw keeps its researched empty timing. The loadout comparison lists both times.

**Lean and peek.** Hold **Q** to lean left or **E** to lean right (**A** / **E** on ZQSD). Your head travels up to 0.38 m sideways and dips slightly over about 0.12 s, the view tilts toward the peek, and rounds leave from the leaned eye. Your torso follows part of the way; your legs stay planted. A wall stops the lean short, so the head never enters cover. The exposed head and shoulder can be hit, and other players see your body tilt. Leaning slows movement to 80%. Sprinting, jumping and holding a blade straighten you up. Pick up, plant, defuse and revive moved to **F**; the potion is on **H** and the grenade on **G**. Practice bots aim at whatever part of you they can see, including a peeking head.

**Slide and climb.** Press **Ctrl** while sprinting at full speed to slide. You keep your heading, start about 12% faster than a sprint and fade to crouch speed over 0.55 s, staying low the whole way. Releasing **Ctrl**, leaving the ground or hitting a wall ends the slide. **Space** jumps out of it and stands up, though you don't keep the extra slide speed in the air. A slide costs 15 stamina, and after one there is a 0.75 s pause before the next. Shots fired while sliding have moving-fire spread. Press **Space** while moving forward into chest-high cover (1.0–1.7 m) to climb onto it in 0.28 s. Holding **Space** in mid-air catches a ledge just above your feet. You can only climb when there is room to stand on top and nothing overhead. Your gun is down while you climb: no shots, sights, throws or potions until you are up. Low crates are still jumped as before.

**Smoke and flashbangs.** Royale grenade drops rotate frag, smoke, frag and flash, and the Dojo supply bench restocks all three. When creating a Breach room, tick **Round utility** to give everyone a **smoke** in slot 3 and a **flashbang** in slot 4 each round. It is off by default, which keeps Breach's scavenge-everything economy. **G** throws the selected throwable, or the first one you carry; select a slot first to choose. All three share the frag's throw, bounce and roll, so bank them off walls. A smoke pops after 1.25 s into a 4.2 m opaque voxel cloud that lasts 18 s. It blocks sight but not bullets, so firing blind through it still hits. Standing inside greys out your view, and practice bots cannot see through it. A flash pops after 1.4 s and blinds anyone within 20 m who has a clear line to it, through cover or smoke neither. How long depends on where you were looking: up to 2.5 s staring at it, about a third of that side-on, and a brief flicker turned away. Throwers and teammates are not immune. Your screen whites out, then fades, and blinded bots lose track of you. Casings are coloured olive (frag), grey (smoke) and pale (flash); the HUD's **THROW** count includes all three.

**Blade impact.** Every sword, katana and axe cut now staggers a player for 0.12 s (axe 0.15 s), 0.18 s on a finisher (axe 0.22 s), and shoves them back about twice as hard as before. Knife and tonfa strikes stay quick and light. The existing 0.6 s guard still prevents chain stuns.

**Blade mobility.** Holding a blade makes you 12% faster than holding a gun. While sprinting with a blade, right-click to **lunge** 4 m forward (0.25 s); the cut is timed to land as you arrive. A lunge costs 20 stamina and has a 2.5 s cooldown. A cut started mid-slide sweeps low for 25% more damage.

**Sword and katana guard.** Hold right-click with a sword or katana to raise your guard. It blocks bullets and crossbow bolts from the front (a 100° cone) and takes 70% off blade hits. Each block costs 5 stamina plus 12% of the damage, and you move at 60% speed with the guard up. When you run out of stamina the guard breaks: the hit lands and you stagger for 0.25 s. Time a right-click so the parry window meets an incoming round and it **deflects**: you take nothing, and 60% of the damage goes back to the shooter if the line is clear. Axes, knives and tonfas cannot block bullets.

**Backstabs and executions.** A knife hit from behind (the target's rear 120°) kills outright when you sneak in crouched, and a guard can't stop it because the guard only faces forward. Killing with a combo finisher or a backstab is an **execution**: you recover 30 HP (up to full), with an **EXECUTION** or **BACKSTAB** callout and sound. Blade kills make no gunshot report, so a quiet flank stays quiet.

**Blades that feel heavy.** Every confirmed cut briefly freezes your blade at the point of impact (hit-stop) and kicks the camera by the weapon's weight: a knife flicks, a sword bites, an axe lands. Finishers and slide-slashes hit harder, an execution pulses the view in, and being cut makes your view flinch. Reduced-motion settings turn all of this off. When two fighters' cuts meet while both swings are live and facing each other, the blades **clash**: neither lands, both swings drop into recovery, and both fighters are thrown apart. Carrying a blade also makes your footsteps 40% quieter.

**Duel controls for the sword, katana and axe.** A tap is a light cut and continues your combo. Keep holding past a whole light cut and the HUD shows **HEAVY READY**; let go to throw a heavy cut: slower to wind up, 1.6× damage, a long stagger, and it breaks a held guard outright. After a clean parry you have a short **riposte** window: your next cut hits for 1.5× and staggers like a finisher. Strafing while you cut picks the side the sweep comes from (left key sweeps right-to-left, right key the other way), and a cut thrown in the air is an **overhead chop** that comes over a held guard. The knife and tonfas keep their own controls.

**Punch (V).** Your free left hand throws a quick jab whatever the right hand holds: a gun, a blade or nothing. It does light damage, shoves, briefly staggers, cancels a heavy charge and knocks a raised sword guard down. It has its own short cooldown.

**Minecraft-style melee.** Blades and punches follow a few rules borrowed from Minecraft combat:
- **Sprint hits:** a cut or punch thrown straight out of a sprint shoves about 1.8× as far. Your sprint then stays off until you release W (or Shift) once and press it again, the classic W-tap.
- **Critical hits:** a hit landed while you are falling does 1.5× damage and bursts gold stars.
- **Knock-up and hit window:** every melee hit pops the target slightly off the ground, more after a sprint hit. A player who has just been hit ignores further melee hits for 0.2 s, so spamming or ganging up cannot stack damage in a single instant. Monsters keep their own stagger rules.
- **Sweep:** a sword, katana or axe cut thrown while standing (not sprinting) also catches enemies right beside its target for about a third of the damage, with a pale sweep arc.

**Spear, tomahawk and chain whip.** The **Pike Spear** is the longest blade: a straight thrust that lands where a sword can't reach; it parries and takes heavy cuts like the sword. The **Tomahawk** is a quick short chop; right click throws it in an arc for heavy damage, and it flies back to your hand four seconds later (you can't cut while it's away). The **Chain Whip** lashes a wide, long arc for light damage and drags whoever it catches toward you. All three show up in the Armory, as Royale loot and in Last Stand loadouts.

**Breach modes.** When you create a Voxel Breach room you pick a mode. **Classic** is the plant-and-defuse game. **Blade Arena** drops guns and the charge: everyone fights with the blade they pick in the lobby, and rounds are won by elimination. **Samurai Standoff** gives everyone a katana and makes any clean cut lethal; only a parry, a guard or a clash keeps you alive. **Gun Game** puts everyone on an eight-rung ladder (Vandal, Phantom, Spectre, Marshal, Shotgun, Sheriff, Classic, then the knife); each kill swaps you to the next weapon on the spot, rungs carry over between rounds, and the first knife kill from the last rung wins the match.

**Mechanic weapons.** Four originals each test a different skill. They appear under **Special** in the armory.

- **Kite Rail Lance** (charge sniper). Hold the trigger to charge for up to 0.7 s, then release to fire. Damage scales from 35% to 160 body / 320 head, and the cone tightens to a perfect line at full charge. A release under 25% fizzles and keeps the round. Full or partial, the round pierces cover with a high penetration budget and passes through two bodies. Four rounds per magazine.
- **Marten Lever Rifle** (rhythm). 72 body / 166 head per shot, with a 0.37 s lever cycle. Click in the last 10 ticks of the cycle, or within 0.1 s after it closes, to build up to three rhythm stacks. Each stack shortens the next cycle by 0.05 s and steadies the rifle. Clicking too early short-strokes the lever: the cycle grows by 0.15 s and the rhythm resets.
- **Wren Throwing Knives** (recoverable). Three silent, arcing throws (70 body / 154 head) with three spares. Every knife that lands, in a wall, the floor or a target, becomes a pickup: walk over it and press **F** to return it to your reserve, then **R** to draw.
- **Swallow Grapple Hook** (Royale gadget). A traversal tool that deals no damage and can never be a starting loadout; two spawn beside the first gun caches in Royale. Fire at a wall or ledge within 26 m to be pulled to it at 13 m/s. **Space** lets go and keeps your momentum. Three hooks per load, six spare, and a miss keeps the charge.

Shotguns have filled pellet patterns instead of a hollow ring, so accurate close-range aim gives more consistent hits. The original **Warden Shotgun** fires eight 28-damage pellets, the **Harrier Auto Shotgun** fires seven 18-damage pellets, and the **Goshawk Slug Shotgun** fires one 120-damage slug with 216 head damage at close range. Their original firing cadence, reload windows and distance falloff remain. Shorty, Bucky and Judge keep their researched damage bands and handling. All six have distinct voxel barrels, receivers and mechanisms, heavier firing sounds, and sharper weapon kick with a stable camera. Pump guns include a timed rack and closing sound; each shell produces one sound and kick regardless of pellet count.

Dual pistols alternate one shot between hands per click, and dual SMGs alternate automatically while the trigger is held. Each pair occupies one inventory slot and uses a shared finite magazine; reloads replenish the pair, while each shot kicks and flashes only its firing hand. Right-click braces the pair for steadier aim. The slug shotgun fires one heavy round per press, rewarding accurate close-to-medium-range shots rather than pellet spread. All three guns have their own damage, falloff, recoil, reload, artwork and sound. Fresh Breach, Last Stand and Breach-practice loadouts contain a knife and the chosen gun; other blades are collected during play. Last Stand's early-wave damage bonus does not change multiplayer melee damage.

Blades have distinct close-combat roles: the sword deals **100** base damage with a broad 3.05 m cut; the katana deals **75** with a faster, narrower 3.35 m cut; the axe deals **140** with a slower 2.85 m commitment; twin tonfas alternate **42**-damage strokes at 2 m. The starter knife uses a 28-damage primary stab with 1.7 m reach. Swords, katanas and axes trace a finite chest-to-waist path, including low monster bodies; solid cover and actual reach still decide contact. Sword and katana windups can be guided by up to 12 degrees before the active cut locks. Tap during the final ten recovery ticks to queue one follow-up strike; holding attack never repeats swings. Swapping, pausing or losing controls clears the queued strike. Articulated wrists, two-handed long-blade grips, bright tapered slash ribbons, spark edges and short confirmed-contact bursts follow the same finite cut. Walls crop the trail, and reduced-motion settings dim extra effects. Blade reach now bridges small visible gaps while damage, windup, recovery and parry timing retain their roles.

Blades now have confirmed-hit combos: **three strikes** for sword, katana and knife, **two** for axe, and **four** for twin tonfas. Release and click again near the end of recovery or within **0.35 seconds** after it ends. Actual damage confirms each link; a miss, parry, expired window, equipment swap or pause restarts the chain. The final strike deals extra damage, shows a brighter gold slash and adds a modest shove and brief hit stun. Enemy immunity prevents repeated stun locks; later monsters and brutes resist stagger. The existing weapon status shows your chain count and follow-up window. [Blade combo guide](docs/voxel-blade-combos.md).

Right-click with a knife commits a stronger, narrower thrust: 60 base damage, 2.15 metres of reach and a longer recovery than the quick left-click stab. Right-click with a sword, katana, axe or dual tonfas raises a timed directional parry. Face an incoming melee attack and commit just before contact; a successful guard blocks one contact, with a visible clash and optional sound. Parries cost sprint stamina, have weapon-specific timing and cooldowns, and cannot block bullets, grenades or the storm. Knife thrusts and parries lock their direction when committed. Sword and katana cuts allow a small aim correction during windup, then lock their direction when the active cut starts. Holding right-click never repeats melee actions, and switching or dropping a weapon preserves its cooldown. These actions share the same rules across Breach, Last Stand, Royale and practice. Touch players see **STAB** or **PARRY** on the existing aim button.

Weapon reticles now distinguish sidearms, SMGs, rifles, precision guns, machine guns, shotgun pellets, solid slugs, bolts and blades. Pellet shells show a ring, slugs an open diamond, and bolts a separate diamond aiming cue. Movement, airborne accuracy, firing bloom and ADS drive the gap using the same spread rules as real shots. The center stays fixed while the gap smoothly expands and settles at display refresh rate, including in online Breach and Royale. Gold headshot and orange body-hit feedback remain. [Reticle guide](docs/voxel-reticles.md).

Gun aiming smoothly lowers mouse sensitivity as the sights settle. At full aim, a carbine turns at about 42% of hip-fire mouse speed; magnified marksman and sniper sights turn more slowly. The same scaling applies to captured mouse look, right-button dragging and touch look. Selecting a blade restores normal look speed.

Use the **mouse wheel** during play to cycle every carried item: scroll up for the previous slot and down for the next. Cycling wraps through the four inventory slots, including potions and grenades, and skips empty slots. Select a potion and click to drink it, or press H to quick-heal. Number keys and the hotbar still select any carried item. This works in Breach, Last Stand, Royale and practice; menus and paused games keep normal page scrolling. Item changes briefly holster the old model and draw the next one, with a wrist pull for knives, heavier gun and sword movements, and a quick lift for supplies. The motion also works with number keys, the hotbar and pickups. Attacking, healing or reloading takes priority over the cosmetic draw; weapon timings and aiming remain unchanged. Reduced motion uses a short vertical transition.

Confirmed enemy head damage briefly turns the crosshair shiny gold with a tight sparkle pulse. Body and leg damage use a bloody-orange outward pulse. Scoped sights receive the same feedback. One shell or swing produces one pulse, even if several pellets hit; misses, cover, friendly contacts and self damage do not flash a successful hit. The cue expires quickly, clears when controls are paused or a life changes, and retains distinct colors and shapes when reduced motion is enabled.

The voxel artwork gives each weapon a distinct receiver, stock and sight, with shaped gloves, separate knife and sword silhouettes, and readable supply pickups. Players have exposed human faces, varied hair and skin tones, and distinct outfits with readable team accents. Teammates and opponents walk with articulated legs, bend their knees when crouching, and change pose while jumping and landing. The shared player artwork works in Breach, Royale, Last Stand and practice. Paris interiors have plaster and parquet finishes, plus four distinct furnished shops: a café with coffee service and bistro seating, an atelier with tools and paints, a stocked bookshop, and an Opéra ticket room with an upright piano and luggage. Counters and cabinets provide real cover; the center aisles, doors and Royale loot remain reachable. Forest cabins show timber grain, while maze ruins and desert temples have carved details. These assets are included with the host and need no external downloads. First-person and held weapon models stop at nearby solid cover, including while aiming.

All seventeen monster types move with articulated limbs: hounds, wolves, pigs and rats trot on four paws, stags bound on front/rear pairs, runners use longer strides, and armed monsters steady their weapon hands. Their stride follows actual distance travelled, settles at walls and when idle, and changes for jumps and landings. Their hitboxes and headshot rules remain shared with the combat simulation.

Walking and sprinting use different articulated strides, foot lifts and arm motion. First-person movement adds a small head bob and roll driven by actual distance travelled, with a soft landing response. Movement feedback settles when you stop or meet a wall and becomes steadier while aiming. Each gun has a sharp weapon kick and smooth recovery; automatic shots blend their impulses, while a shotgun shell produces one kick rather than one per pellet. Reloads show distinct magazine removal, insertion and action cycling, with shell, cylinder and crossbow handling for the appropriate weapons. With sound enabled, gunshots combine a dry crack, a low body and a quiet mechanical tail; reload sounds follow the visible mechanism. These effects are shared by Breach, Royale, Last Stand and practice.

Hold **Shift** while moving forward to sprint at 1.4 times your normal movement speed. The small blue rail beneath health shows stamina out of 100. Sprinting uses stamina as you travel; crouching, quiet walking, aiming, shooting and other committed combat actions stop the sprint. After 1.2 seconds without sprinting, stamina recovers. Exhaustion requires releasing Shift and recovering at least 25 stamina before sprinting again. Touch players have a sprint button beside the movement controls.

The voxel shooters start players with 200 HP, extending firefights while retaining each weapon's damage, recoil and hit-location advantages. Confirmed gun and crossbow damage emits brief red voxel blood at the actual contact. Incoming damage shows a short screen-edge blood effect and a directional cue; solid cover and friendly contacts do not create blood. The compact HUD leaves room for the firing lane: health, ammo and round supplies sit along the edges, with a small tactical map and objective banner. Your health meter shows current HP, a short trail for recent damage, critical-health feedback and healing. Squad health appears in the arena and roster; spectating shows the health of the teammate you are watching. Confirmed hits display the actual HP damage dealt, with head and leg hits identified.

Every fresh Breach loadout starts with a knife in slot 1 and the chosen gun in slot 2, with slots 3 and 4 empty (rooms with **Round utility** fill them with a smoke and a flashbang). Potions and grenades must be collected during play. All four slots are flexible: drop or replace items to carry extra guns, and stack up to two potions in one slot. Melee swings have a visible wind-up, committed direction and recovery; walls and intervening teammates block them. Frags bounce and roll before exploding after 2.4 seconds. Cover protects against the blast, teammates are immune, and your own grenade can hurt you. Drinking takes 0.2 seconds and restores up to 60 HP on completion. Damage, shooting, jumping, switching weapons, dropping an item, throwing a grenade, reloading or interacting interrupts it and keeps the potion. Only a completed heal consumes one potion from its original stack. Full-health players cannot waste a potion. Healing slows movement, so find cover before drinking. Round setup restores health and ammunition, with empty supply slots.

The tactical map shows cover, both sites, your position and living teammates. Painted site signs help you navigate the authored maps. The main clock switches to the charge countdown after planting; planting, defusing, reloading, melee recovery and drinking show progress. The HUD displays your selected item, all four inventory slots, and remaining grenade and potion charges. Round results explain the outcome before the next setup phase.

Combat arenas have connected upper floors, cover on both levels, and passages underneath. Office mezzanines overlook desk and screen cover; sewer maintenance galleries overlook pipe-lined chambers; snowy research platforms, Paris balconies, woodland lookouts and temple galleries provide different elevated fights. Each upper area has alternative approaches, and monsters can climb and descend its routes.

Every tactical arena also has three short hop groups with six small obstacles: low crates, service boxes, plinths and other themed cover at 0.48 and 0.84 metres. Jump onto the broad tops, hop to the next piece or drop back into the lane. Breach, Last Stand and practice share these visible, solid obstacles.

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

**Ember Delve:** explore a third-person voxel dungeon with a visible adventurer, animated enemies and three themed acts. Move with WASD/ZQSD/arrows relative to the camera, use the mouse to look, attack with click/J, cast with right-click/E (K still works), dodge with Space, and interact with F. Hold Shift to sprint forward, Ctrl to crouch, or C to walk quietly. Sprinting uses the same stamina pool as blades and dodges; crouch and quiet walk override it, and combat commitments stop the run. After exhaustion, release Shift and recover at least 25 stamina to run again. A lowered adventurer stance and smoothly lowered shoulder camera show crouching. Click to capture the mouse, or drag to look if capture is unavailable; comma and period also turn the camera. **P** pauses and releases the mouse. Solid walls and pillars stop the camera from passing through them. Clear the room and physically reach an exit to claim a relic and choose a road. Safe routes include camps and treasuries; risky combat and elite routes yield stronger rewards. Health, stamina, mana, and relic effects carry through twelve rooms across three acts. Each act has a different boss. Veteran starts by default with predictive charges, flanking crawlers, marked ground attacks, stronger boss patterns, and reduced healing loops. React after attacks commit and manage dodge stamina. Attacks briefly slow movement and delay stamina recovery. Relic rooms are guarded, bosses bring mixed support, summons are finite, and healing shares a room allowance. Enemies recover from cover corners so they cannot be parked there indefinitely. Standard and Nightmare are selectable. The seed and difficulty can be replayed, but a new descent resets the build.

**Deckbound:** click/tap cards, or use 1–9 to play hand slots and E to end your turn. Read enemy intent before spending energy on attacks, block, and statuses. Select a target when several enemies are present. Eighteen encounters cross three acts with combat, elites, shops, rest stops, and events. Shape a deck of 24 card types with upgrades, removal, rewards, and eight relics. Rest can heal or upgrade; shops spend earned gold. Defeat the three bosses to win. Veteran starts by default with three mandatory road battles per act; Nightmare requires four. Complementary enemy pairs and disclosed allied shields make targeting matter. Card healing is limited to 18/12 HP per battle in Veteran/Nightmare, while late turns bring stronger pressure. Different offensive and defensive builds remain viable. Zero-cost Quickstep exhausts after use. Standard and Nightmare are selectable. Death ends the expedition; replay the seed or start again.

**Voxel Wilds:** a solo first-person voxel survival expedition. Mine trees, hillsides, and underground ore; build on real block faces; and manage eight inventory slots. Move with WASD/ZQSD or arrows, look with the mouse, jump with Space, and sprint with Shift. Hold left-click/C to mine or attack, right-click/E to place, F to use food or supplies, and 1–8/the mouse wheel to choose a slot. Tab opens inventory and crafting and freezes survival while you plan; select an item in the pack to discard one and make space. Craft planks, a workbench, upgraded tools, weapons, and camp supplies. Stone walls withstand raids longer than wooden walls, but later nights bring faster breaches, archers, and flying wisps. Hunger and fall damage make exploration matter; harvested berry shrubs regrow after two days when their cell remains clear and supported. The world saves in the current browser when storage is available. After pressing Start, choose Continue to return to an expedition or begin a fresh world. This game is designed for keyboard and mouse.

Solo games have pause and new-game controls beside the score display. P pauses or resumes, Escape exits fullscreen or releases the mouse, and R restarts; leaving the page or switching tabs pauses real-time solo games, including a pending Rift upgrade choice. Open **How to play** for the rules. Touch controls appear on smaller screens or touch devices; Prism's on-screen controls are also available from its desktop disclosure. Best scores and completed timed records are saved in the current browser when browser storage is available. Records are separate by game mode and difficulty. Rebalanced challenge records stay separate from historical scores and practice modes across the solo games. Starting a new game resets the run; best records remain.

Leaving a room resets that room's match and readiness. Rooms and matches live in memory and disappear when the server stops. An empty room is eventually removed; create another room if an old invitation has expired.

The action and driving games automatically use your display's refresh rate, including 120, 144 and 240 Hz. Movement is smoothed between simulation steps, and camera effects keep the same speed across refresh rates. Choose your preferred rate in your PC's display settings before playing; browsers use the active display's rate.

**FPS practice:** choose **Practice solo vs bots** on the Voxel Breach or Voxel Royale card, or **Practice vs bots** inside a room's controls panel. Choose any map, 1–5 opponents, moving targets or bots that return fire, and Rookie, Regular or Veteran bot pace, then press Start. Practice runs locally with the same movement, cover, weapons and damage rules as multiplayer. Breach offers all 39 gun choices. Its **Blade training** drill lets you choose any of the five blades in slot 1, keep your chosen gun in slot 2 and practice against 1–5 moving targets that approach and strafe without attacking. Cuts use real health, reach, cover and recovery; blade accuracy is shown separately from gun accuracy. Other drills retain their knife start. Royale keeps its knife start, scavenging, storm and last-survivor result. P opens the pause menu without leaving fullscreen. Press P or Resume to continue; Change setup / loadout starts a fresh drill. Escape remains available to the browser to exit fullscreen or release the mouse. Practice uses no multiplayer connection and does not write solo records.

The practice debrief shows eliminations, accuracy, time, damage dealt and taken, headshot eliminations, shots or blade strikes, hits, and remaining health. Replay sits below the stats. Result actions wait briefly for finishing controls to be released and rapid clicks to settle, so the last attack cannot immediately restart a drill.

Network games render opponent movement using server simulation ticks and a small adaptive buffer rather than packet arrival spacing. Local aiming and confirmed gameplay feedback stay immediate. Adjacent local movement poses survive snapshot acknowledgements, and fighters, enemies and projectiles retain fractional positions between steps. Presentation corrections use the real collision rules; older opponent visuals cannot push a valid current FPS camera. Verified FPS movement paths follow the actual physics steps through corners. Deaths, new rounds and large discontinuities reset interpolation. Voxel operators turn continuously, with fixed body proportions. Wilds samples creatures, arrows and its camera together between physics steps, retaining clear movement through distant terrain edits and day transitions while checking current terrain and living bodies. Voxel renderers reuse typed geometry storage and pickup models, and Paris Pedal uploads its authored building raster once per frame while retaining its painter order.

FPS continuous controls use the latest state, while a bounded queue preserves short jump, fire and utility presses across packet coalescing. Consecutive taps retain a release step, and shot/grenade commitments retain their press aim. Pending presses expire after 120 ms; pause, help, focus loss and round changes clear them. Practice also preserves short presses in its local action queue. Cancelling a touch contact withdraws only its own unconsumed press, preserving other held controls and valid taps.

Night Drive road markings move with actual travelled distance, including beneath the bumper. Paris projected details preserve fractional coordinates, and its building materials request CPU-readable canvases before painting to avoid expensive first-use readbacks. Skyline ropes, Shadow action effects and Starfall particles follow the same display clock as their actors. Circuit wheel steering follows achieved turning momentum. These display changes retain the existing simulation, collision, damage and difficulty rules.

Online hitscan guns use the displayed simulation tick to check compatible player positions within a bounded 150 ms server history. This keeps shots on moving targets aligned with the buffered view. Cover, ammunition, spread and damage stay authoritative; stale timestamps and new lives cannot reuse an obsolete target pose. Crossbow bolts and grenades retain their real flight simulation. Local practice uses current positions and needs no network history.

WebAssembly is supported by modern browsers, but this release keeps the simulation in JavaScript. Profiling found repeated geometry construction, canvas transfers, layout reads and presentation timing to be the larger costs. A WASM physics module would leave those costs in place. The current improvements require no new runtime dependency or browser isolation headers; heavy simulation or meshing kernels remain candidates for a future measured WASM implementation.

## Development

```sh
npm test
```

Lockdown art: `node tools/lockdown-art-index.mjs` checks every PNG in `public/art/lockdown/` against the manifest, writes the `index.json` the game loads from and refreshes the checklist in `ASSETS.md`.

Run `python test/compact-play-browser-smoke.py http://127.0.0.1:3000` for native checks of the compact layouts, controls panels, readiness, pause, fullscreen and responsive play areas.

Run `python test/high-refresh-browser-smoke.py http://127.0.0.1:3000` for native gameplay, rendering, collision and pause/resume checks of the high-refresh presentation paths. Automated timing tests cover 60, 120, 144 and 240 Hz independently of the browser machine's display.

Run `python test/voxel-horde-browser-smoke.py http://127.0.0.1:3000` for Voxel Last Stand setup, native solo combat, pause/restart, three-player co-op, touch controls and responsive layouts.

Run `python test/voxel-practice-browser-smoke.py http://127.0.0.1:3000` for solo FPS setup, real combat and scavenging, keyboard/mouse and touch controls, pause/restart, fullscreen and responsive layouts.

Run `python test/voxel-inventory-browser-smoke.py http://127.0.0.1:3000` for flexible slots, native dropping and scavenging, French keys, four new weapons, the snow/sewer/trading maps and co-op inventory synchronization.

Run `python test/voxel-map-identity-browser-smoke.py http://127.0.0.1:3000` for native office furniture and screen cover, sewer tunnel movement, snow roof climbs and distinct map artwork. Node geometry tests additionally check connected floors, safe starts, supply access, head clearance, useful elevated firing angles and rendering budgets.

Run `python test/voxel-arsenal-browser-smoke.py http://127.0.0.1:3000` for native dual-wield fire, close-combat choices, inventory handling and confirmed gold/orange crosshair feedback. Shared combat tests additionally check authoritative hand alternation, real cover, finite ammunition, early-wave melee openings and resistance to repeated stagger.

Run `python test/voxel-monsters-browser-smoke.py http://127.0.0.1:3000` for native zombie-hound movement, low-body hits, bite contacts and unarmed artwork. Shared monster tests additionally check committed leaper attacks, interruptible rallies, solid cover, body-aware navigation, deterministic co-op and bounded wave rendering.

The six-species bestiary checks cover guaranteed wave debuts, actual charges, bites, parries, siphon healing, flanking, antler gaps, knockback, cover-tested witch projectiles, loot, animation and rendering budgets. Native bestiary checks cover the desktop/mobile field guide, a naturally visible rat and two-player co-op. The five later creatures and their special attacks were verified in simulation and rendering tests; they were not reached in the native survival runs.

The sprint-roll and base-zombie polish passed 138 unique targeted checks, including twelve accepted first shots after a sprint, exact scoped steadiness, animated anatomy and full-wave rendering limits. Native Dojo checks confirm walking, stronger running roll, moving sights and held-forward collision settling; native Last Stand checks show the detailed Ash Stalker approaching, a real headshot kill, progressing corpse collapse and enemy footstep reports with sound enabled. These are browser checks, not a hardware FPS benchmark.

Run `python test/voxel-labels-browser-smoke.py http://127.0.0.1:3000` for native co-op teammate names, monster health bars, damage updates and solid-cover visibility. Label tests additionally check the actual camera projection, short hound silhouettes, spectators, safe player names and bounded overlay nodes.

Run `python test/voxel-feel-browser-smoke.py http://127.0.0.1:3000` for native first-person head bob, settled ADS, wall contact, one-shot weapon kick and audio, recovery and solo pause/resume in practice and Last Stand.

Run `python test/shinobi-browser-smoke.py http://127.0.0.1:3000` for native two-player readiness, rapid keyboard/mouse inputs, hit-confirm chains, heavy feints, parries, collisions, French and touch controls, responsive combat feedback, round transitions and rematches.

With Python Playwright and Chromium installed, run `python test/voxel-polish-browser-smoke.py http://127.0.0.1:3000` for native two-client checks of confirmed blood effects, 200-HP combat, 60-HP healing, the Royale starter knife and compact desktop/mobile views.

Run `python test/voxel-assets-browser-smoke.py http://127.0.0.1:3000` to review all nine gun models, aiming and wall contact, standing and crouching operators, Paris interiors and roofs, and native scavenging across the Royale environments.

Optional browser checks require Python Playwright and Chromium. Run `python test/voxel-survival-browser-smoke.py http://127.0.0.1:3000` for Voxel Wilds mining, crafting, building, controls, saved worlds, and pause behavior. Run `python test/voxel-paris-browser-smoke.py http://127.0.0.1:3000` for both Paris map selectors, native building and rooftop routes, bomb-site approaches, combat cover, scavenging and responsive HUDs. Run `python test/voxel-royale-browser-smoke.py http://127.0.0.1:3000` for host-started 2–10 player rooms, the original three arenas, native scavenging, combat, healing, rematches and compact desktop/mobile HUDs. Run `python test/voxel-health-browser-smoke.py http://127.0.0.1:3000` for Voxel health, damage by hit location, weapon comparisons and distinct combat feedback. Run `python test/ergonomic-browser-smoke.py http://127.0.0.1:3000` against a running host for native nearby controls in all six combat rooms and Voxel, P pause/resume in the ten solo games, actual AZERTY events, held-alias releases, help/editing guards, and desktop/mobile control guides. Run `python test/voxel-expansion-browser-smoke.py http://127.0.0.1:3000` for the original six-map expansion: native multihop climbs, elevated cover, new weapon handling, multiplayer synchronization, rendering budgets and responsive layouts. Run `python test/voxel-browser-smoke.py` for Voxel Breach: native room setup, all-player readiness, two-, four- and six-player rooms, WebGL artwork, movement and aiming, combat, and desktop/mobile layouts. Run `python test/ninja-browser-smoke.py` for Shadow Lantern and two-client Shinobi Showdown: native keyboard and touch controls, explicit Start and Ready, collisions, difficulty records, and desktop/mobile layouts. Run `python test/polished-expansion-browser-smoke.py` for the three new games: native keyboard/touch play, campaign decision screens, explicit Start, pause, restart, ZQSD, record isolation, artwork, and desktop/mobile layouts. Run `python test/difficulty-browser-smoke.py` for the challenge defaults, native difficulty/mode selection, record isolation, pause, restart, and desktop/mobile layouts. Run `python test/paris-browser-smoke.py` for Survival acceleration, braking, crash-ending time records, the full delivery route, native controls, and responsive layouts. The longer gameplay regression suites below explicitly select the original Standard rules so their fixtures and records remain comparable. Run `python test/cards-browser-smoke.py` to start an isolated local server and exercise all three card games in two browser sessions. Run `python test/driving-browser-smoke.py` to exercise Night Drive controls, traffic, records, pause, and touch layouts on an isolated server. Run `python test/skill-browser-smoke.py` for Vector Arena's two-player combat, Prism Shift's controls and modes, and Rift Survivor's combat and upgrades. Run `python test/expansion-browser-smoke.py` for Ember Delve, Deckbound, and two-client Oddstock Rumble with mobile, native controls, pause, and real gameplay checks. Run `python test/dungeon-browser-smoke.py` for a physical co-op clear through the first guardian, shrine boons, and the Tide Crypt transition; set `DUNGEON_ROOMS=9` for the extended expedition check. To check the original four games, run `python test/hub-browser-smoke.py http://127.0.0.1:3000` against a running host.

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

### Sites edition

The Sites export runs the dojo, solo games, Last Stand solo and bot practice directly in the browser. Real-time rooms use the PC host: choose **Play with friends**, enter a public HTTPS tunnel address, `Hostname:port`, or a full invitation link, and continue on that host. The hosted edition includes the current PC-host ZIP and its optional Windows online launcher. Sites publishes new sites privately by default. Internet guests can use the PC's public tunnel invitation directly; the PC hub also keeps its room creation, joining and LAN/VPN behavior.

`node tools/build-sites.mjs /absolute/path/to/the/registered/sites/project` exports the current browser assets into the registered project's `dist` directory, preserves its `.openai/hosting.json` identity, and includes the verified PC download. Build the updated host ZIP before exporting.
