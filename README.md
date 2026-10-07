# semag — Fireside game hub

![Fireside pixel-art logo](public/hub/logo.svg)

A self-hosted browser hub with **19 games: ten solo and nine two-player games**. Pick **Play solo** for an instant driving, arcade or puzzle game, or create a room and share your PC address or room link with a colleague. Both players press **Ready** before multiplayer play begins. Each room has two seats; the server can run several independent rooms at once.

| Game | Mode | Goal |
| --- | --- | --- |
| Afterimage | 1v1 rooftop sword fighter | Win two rounds with spacing, parries, dashes, and attack cancels. |
| Checkers | Turn-based 1v1 | Capture every opposing piece or leave your opponent without a legal move. |
| Relic Duel | 1v1 top-down arena | Win two rounds across three different arenas with sword attacks, arrows, guarding, and timed rolls. |
| Dungeon Run | Two-player co-op | Clear nine rooms in three biomes, choose personal boons, and defeat three guardians together. |
| Crazy Eights | Turn-based card duel | Match the rank or suit, choose a new suit with an eight, and empty your hand first. |
| 21 Duel | Blackjack-style card duel | Get closest to 21 without going over; win more of five hands than your rival. |
| Memory Match | Turn-based card memory game | Find more pairs on a shared board of 32 cards. |
| Snake | Solo arcade | Eat fruit, grow longer, and survive as the snake gets faster. |
| Minesweeper | Solo puzzle | Use numbered clues to reveal every safe tile without opening a mine. |
| 2048 | Solo puzzle | Slide equal tiles together to reach 2048, then keep going if you like. |
| Apex Circuit | Solo driving time trial | Master three different circuits or a nine-lap championship, with dry, coastal, and wet handling. |
| Night Drive | Solo highway driving | Drive endlessly or complete a five-district tour with merging traffic, construction, rain, and near-miss chains. |
| Paris Pedal | Solo Paris e-bike survival | Weave between cars, buses and cyclists as speed keeps rising. Survive as long as possible through endless Paris districts. |
| Vector Arena | Real-time 1v1 shooter | Lead aimed projectiles, control cover, and manage dashes, ammunition, and reload windows. |
| Prism Shift | Solo falling blocks | Master wall kicks, holds, T-spins, and combos in Marathon or a timed 40-line Sprint. |
| Ember Delve | Solo action roguelike | Explore twelve branching rooms, build relic synergies, and defeat three distinct bosses. |
| Deckbound | Solo deckbuilding roguelike | Survive eighteen encounters with 24 cards, eight relics, enemy intent, and three act bosses. |
| Oddstock Rumble | Bonus 1v1 platform brawler | Choose one of six comic fighters; use knockback, recovery, and stage control to take three stocks. |
| Rift Survivor | Solo survival arena | Read enemy attack patterns, choose upgrades, and build synergistic relics and defeat four guardians across twenty waves. |

The action games are original implementations. Checkers follows American checkers rules. All multiplayer card games use the same two-seat rooms, ready countdown, and rematch flow. The shelf filters show **All games**, **With a friend**, **Solo**, **Driving**, **Action**, or **Roguelike**. Search narrows the selected shelf by title, category, or description. Room joining and invitations sit above the game shelf.

The graphics use original local artwork: illustrated cards and enemy portraits,
expressive character sprites, textured arena materials, crafted board pieces,
and detailed driving scenery. Static art is cached, gameplay effects stay
readable, and the shelf artwork matches the games. Assets ship with the host;
playing does not require an image service. The hub keeps its pixel logo.

Solo games open on their challenge settings: **Veteran** for the action,
deckbuilding, driving, and falling-block games; **Gauntlet** for Snake;
**Master** for Minesweeper; and **Master puzzles** for 2048. Easier modes remain
available in each game. Veteran and Nightmare demand stronger tactics, pace,
or planning, and keep their records separate from easier runs. Revised challenge
records stay separate from historical scores across all ten solo games.

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

Keep that terminal open while playing. Open **http://localhost:3000** in a current browser. Enter your player name and choose a game. Solo games start immediately from **Play solo** and run in your browser. For multiplayer, create a room and send your colleague the invitation, or **http://YOUR-PC-HOSTNAME:3000** plus the room code. Oddstock also asks both players to choose a fighter and the host to choose a stage before Ready becomes available. They can join a listed room or enter its code. Both players then press **Ready**. A player cancelling readiness during the initial countdown returns the room to the lobby.

The colleague must be able to reach your PC. On the same LAN or a suitable VPN, allow inbound **TCP port 3000** through the host PC's firewall. If the hostname does not resolve, use the LAN IP address printed by the server, for example `http://192.168.1.42:3000`. `localhost` refers to the machine opening the page, so share your PC's hostname or IP instead.

For players on separate networks, use a VPN that lets both computers reach each other, or configure your router to forward TCP port 3000 to your PC and share your actual public hostname/IP. Running the server does not automatically make your PC reachable over the internet. Stop it with **Ctrl+C** when finished.

## Controls and rules

Afterimage:

| Action | Keys |
| --- | --- |
| Move | A / D or left / right arrows |
| Jump | W, Space, or up arrow |
| Light / heavy attack | J / K |
| Dash | L or Shift |
| Block / timed parry | I or U |

A connected light strike can cancel into a heavy; a missed light cannot. Holding guard costs stamina when hit, and a depleted guard breaks. Dash evasion starts after a brief vulnerable startup. Press **Fight smarter** for tips. Afterimage also has local open sparring and a five-duel training ladder: Patient Blade teaches whiff punishment, Iron Guard teaches guard pressure, Rooftop Acrobat teaches landing control, Close Pursuit teaches parries and confirmed combos, and Last Duel combines the whole move set. Enter Practice, select a training road, and win each first-to-two match to advance. Any opponent can also be selected directly.

Relic Duel and Dungeon Run:

| Action | Keys |
| --- | --- |
| Move / face direction | WASD or arrow keys |
| Sword attack | J |
| Shoot arrow | K |
| Roll / evade | Space or Shift |
| Guard / timed parry | L or I |
| Revive a fallen teammate in Dungeon Run | Hold guard nearby |

Attacks, arrows, and rolls require fresh keypresses. Manage stamina and use the environment to approach safely. In Dungeon Run, protect each other; if both heroes fall, the run ends. Hold guard next to a fallen ally to revive them. Relic Duel rotates Moss Courtyard, Tide Archive, and Cinder Gallery between rounds, changing cover and shooting lanes. Nine Dungeon Run rooms cross Garden Ruins, Tide Crypt, and Ember Sanctum, each with different cover layouts. Tide pools slow walking; fire vents warn before they erupt. Guardians in rooms three, six, and nine use different patterns. After clearing a room, each hero walks to a shrine and holds Guard to choose a boon. Both must choose before the three-second next-room countdown. Honed Edge improves sword damage; Living Ward increases health; Starstring strengthens and pierces with arrows; Second Wind improves stamina and rolls; Red Bloom heals on sword hits; Mirror Sigil rewards timed parries. Builds last for the expedition and reset on rematch.

In Afterimage, Relic Duel, and Vector Arena, the first player to win two rounds takes the match. Rounds last 90 seconds; a timeout awards the round to the player with more health, while a tie awards no win. Both players must agree to a rematch.

**Vector Arena:** use WASD or arrow keys to move, the mouse to aim, and hold the left mouse button or J to fire. Space / Shift dashes; R reloads your six-shot magazine. Hold the right mouse button or I to focus for more precise fire at a slower movement speed. Shots take time to travel and stop at cover, so aim ahead of moving targets and change your angle to open a shot. Dash has a vulnerable startup and costs stamina. A reload creates an opening for your opponent. Touch screens offer separate movement and aim pads, plus fire, focus, dash, and reload controls. Both players ready up; the first to win two rounds wins the duel. Rounds rotate through Reclaimed Garden, Steel Relay, and Observatory Vault, changing cover, firing lanes, and spawn angles.

For Checkers, click a piece and then a highlighted destination. Captures are mandatory; continue jumping with the same piece when another capture is available. Men move and capture forward, kings move and capture in both directions, and reaching the opposite edge crowns a man and ends that turn. Three repetitions of a position or 80 turns without a capture or a man moving produce a draw.

**Crazy Eights:** each player starts with seven cards. Play a card matching the top card's rank or the active suit. An eight is wild: choose a suit when you play it. When you have no legal card, draw one; play if you can or pass after drawing. The discard pile is recycled when the draw pile runs out. Empty your hand to win. If neither player can continue, the lower remaining hand value wins (eights count 50, face cards 10, aces 1, other cards their rank); equal values draw.

**21 Duel:** a head-to-head variation inspired by blackjack. Each player starts with two cards and chooses **Hit** or **Stand** independently. Aces count 1 or 11, face cards count 10; 21 and busts automatically stand. Opponent cards stay hidden until both hands settle. The player nearest to 21 without busting wins the hand; equal totals or two busts draw. Five hands decide the match by number of hands won. The next hand starts automatically after the reveal. There is no dealer or betting.

**Memory Match:** flip two cards on your turn. Matching rank and suit earns a pair and another turn. A mismatch stays visible briefly, then turns over and passes the turn. Sixteen pairs are hidden in the shared board. The player with more pairs wins; eight pairs each draws. All card actions support mouse, touch, and keyboard buttons.

**Snake:** steer with arrow keys, WASD, or the direction buttons. Eat fruit for 10 points and a longer tail. Avoid walls and your own body. Only one turn is queued per movement step, and the pace increases as you score. Space or the **Pause** button pauses; leaving the page or switching tabs also pauses automatically. Press **New game** to start again. **Gauntlet** starts by default: six denser connected obstacle courses, 168 fruit, and longer starting trails. Each apple has a visible movement allowance based on its route and the moving tail; circling spends that allowance. A blocked route is not a completed garden. Choose **Six gardens** for the original gentler tour; Classic keeps the endless garden.

**Minesweeper:** Master starts by default: a 24×16 field with 90 mines and six active minutes. Its first opening is protected and its boards are certified solvable through visible clues, including overlapping-clue deductions. Beginner (9×9, 10 mines), Intermediate (16×16, 40 mines), and Expert (30×16, 99 mines) remain practice alternatives. Click or tap to reveal; the first reveal is safe. Right-click or press F to flag, or use **Flag mode** on touch screens. Arrow keys move between tiles; Enter or Space reveals. A revealed number opens its remaining neighboring tiles when the matching number of flags is present. Incorrect flags can still cause a mine to open. Reveal all safe tiles to win; the timer starts on the first reveal and stops while paused.

**2048:** use arrow keys, WASD, swipes, or the direction buttons to slide the board. Equal tiles merge once per move, adding their combined value to your score. In Classic, a new tile appears after a move changes the board. **Undo** restores one previous move. Reach 2048 to win, then choose **Keep going** to continue. **Six puzzles** offers six deterministic preset boards with move budgets and tile goals. Puzzles add no random tiles. Solve each to advance; records stay separate from Classic. **Master** starts by default with six new solver-verified dense boards, targets from 256 to 16,384, and exact shortest-solution budgets of 17, 19, 20, 21, 22, and 24 moves. Only two rewinds and two retries cover the entire tour; they do not refill at a new trial. Finish all six in one tour to qualify for a new Master record. Unused allowances earn a completion bonus; Classic and Six puzzles retain their practice rules.

**Apex Circuit:** hold W / up to accelerate, S / down to brake or reverse, and A / D or left / right to steer. Space applies the handbrake for tighter rotation and drifts. Brake before a corner; grass reduces speed. Follow the arrows through every checkpoint in order and cross the finish in the forward direction to complete three laps. Q or **Reset car** returns you to your last checkpoint and adds a three-second penalty. Select Meadow Loop, Harbor Ring, or Rain Pass before a race. Their geometry, grip, slick zones, and medal targets differ. Championship chains all three races with an explicit Continue button between races. Veteran starts by default and requires progressively faster lap splits as well as a qualifying finish inside the track deadline and off-track/reset limits. Strict tiers have finite corner grip, making braking and a clean line necessary; continuous full throttle can no longer qualify every dry circuit. Standard practice keeps the untimed qualification rules; Nightmare tightens the challenge. Best qualifying times are separate for each circuit, championship, and difficulty; unfinished or failed attempts do not set a record.

**Night Drive:** your car cruises automatically. Veteran and Nightmare Endless increase the baseline driving pace continuously with active time, including within a district; releasing pedals or braking does not stop the ramp. The HUD shows the rising pace. Hold A / D or left / right to steer, W / up to accelerate, S / down to brake, and Space to boost. Strict Endless brakes buy a short burst and recharge when released. A shoulder warning gives you time to return to the road before repeated shoulder damage; brief evasive moves remain possible. Boost uses charge that recovers when released. Clean overtakes earn points only after the entire opposing car is clear, with an extra bonus for a close near miss. Its rear remains collidable until then. Avoid the shoulder and traffic; three impacts end your run. Damage briefly protects you from repeated hits. Choose Endless or a five-district Tour. Every 900 metres changes the district: city, coast, works, storm, and summit bring merging traffic, construction corridors, and different handling. Standard practice awards resources at clean district checkpoints. Veteran starts by default: district delivery clocks require sustained pace, and checkpoints no longer repair impacts automatically. Nightmare has tighter delivery windows. Traffic density and required checkpoint pace tighten continuously with active Endless time, while districts add stronger crosswind, merging traffic, and construction; work remains bounded and escape corridors stay open. Boost cells and near-miss chains reward deliberate risk. Complete 4.5 km to finish the tour. Tour and Standard practice retain their handling. Pausing or switching tabs freezes the ramp, and restarting restores the opening pace. Accelerating Endless records stay separate from earlier points. The driving games have hold buttons for touch screens and run their physics at 120 steps per second in the browser.

**Paris Pedal:** survive busy streets from behind your e-bike in a perspective chase view. Survival is the default: the bike rides automatically, its pace rises continuously with active riding time, and Paris cycles endlessly through Bastille, Le Marais, Rue de Rivoli, the Seine crossing, and Montmartre. The goal is your longest time alive. A / D or left / right steers, W / up pedals faster, Space uses battery-powered motor assist, and B warns nearby cyclists. S / down buys a short braking burst; the brake must recharge after release, so holding it cannot stall the run. Buses signal before pulling out, cyclists warn before veering, and parked doors flash before opening. Three impacts end the run; district changes never repair Survival damage. Pausing or leaving the tab freezes the riding clock and pace. Your final survival time is saved separately for Standard, Veteran and Nightmare, with Veteran selected by default. Five deliveries remains an alternate mode with timed checkpoints on Veteran and Nightmare, and points records awarded only for a full finish. Veteran and Nightmare Rush use the same automatic increasing pace and limited brake bursts, closing slow-brake score farming. Strict tiers begin faster and require tighter steering corridors over time. Earlier Rush points and earlier Survival records stay separate from the new challenge records.

**Prism Shift:** left / right moves a piece, down soft-drops, up / X rotates clockwise, Z rotates counterclockwise, Space hard-drops, and C / Shift holds. Held directions repeat after a short delay. Each bag contains all seven pieces; the ghost shows your landing position and the next queue shows five pieces in Standard, four in Veteran, and three in Nightmare. You can hold once per placement. Rotations use wall kicks. Standard has a half-second lock delay and up to fifteen movement or rotation resets; the faster Veteran and Nightmare profiles reduce those allowances. Clear consecutive placements for combos; consecutive four-line clears or T-spins build a back-to-back bonus. Marathon increases the pace as you clear lines and saves your best score. Sprint ends at forty cleared lines and saves your fastest completed time separately. Veteran starts by default at level 10; Nightmare starts at 13. Their Marathon gravity and locking pressure rise through both cleared lines and elapsed active time. Sprint limits are 75 and 50 seconds respectively. Excavation is a garbage-clearing puzzle road with distinct preset layouts, fixed piece queues, piece budgets, and explicit continuation between stages: Standard has eight stages, Veteran ten, and Nightmare twelve. The harder ladders pair chambers, use exact piece budgets, and add tighter stage clocks, so queue and hold planning matter. Solve all stages for a separate completed-time record.

**Rift Survivor:** move with WASD / arrows, aim with the mouse, hold click or J to fire, and dash with Space / Shift. On touch screens, use the left pad to move and the right pad to aim and fire. Sustained fire overheats your weapon; release to cool down. Watch the warnings before charging brutes or ranged attacks strike, and use cover to break firing lines. Choose upgrades after each wave. Ricochet, chain lightning, frost, kill siphon, scatter shots, dash shockwaves, and post-dash focus combine into builds, alongside damage, cooling, and mobility. Health carries between waves. Four sectors have distinct arenas, affixed elites, and warned floor hazards. Guardians guard waves five, ten, fifteen, and twenty. Veteran starts by default with mixed ranged threats from the first wave, locked leading aim, and less forgiving recovery. Veteran and Nightmare threat pace rises with cumulative active combat time: enemy movement, new charges, new shots, and fresh attack cadence gain 5% per minute, up to 25% after five minutes. The HUD displays this pace. Wave changes retain it; pause and upgrade menus freeze it; a new run resets it. Warning durations stay unchanged, and committed attacks retain their speed. Accelerating challenge records stay separate from earlier scores. Burst fire cools faster than held fire. Elite suppression marks threaten escape routes, guardians add a warned second phase, and repeated frost cannot permanently pin elite enemies. Select Expedition (Standard), Veteran, or Nightmare; optionally overcharge the next wave for tougher enemies and higher score.

**Oddstock Rumble:** both players select their own fighter; the host selects a stage. Both press Ready. Move with A/D or left/right; W/S or up/down selects move direction. Space jumps (twice in the air; Moth has an extra jump); down+Space drops through a platform. J attacks, K uses a special, I shields, and L/Shift dodges. Hold down in the air to fast-fall. Directional attacks change on the ground and in the air; up-special is your recovery move. Damage increases launch distance, and directional input influences knockback. Fresh shields can parry, but holding a depleted shield breaks it. Each player starts with three stocks. Stage hazards warn before wind, fountains, or steam activate. A four-minute timeout compares stocks, then damage. The six original comic fighters parody familiar platform-fighter archetypes: Captain Wrench, Sir Sprout, Mochi Moth, Parcel-9, Zap Rat, and Don Bulk.

**Ember Delve:** move with WASD/arrows, aim with the mouse, attack with click/J, cast with right-click/K/E, dodge with Space/Shift, and interact with F. Clear the room and physically reach an exit to claim a relic and choose a road. Safe routes include camps and treasuries; risky combat and elite routes yield stronger rewards. Health, stamina, mana, and relic effects carry through twelve rooms across three acts. Each act has a different boss. Veteran starts by default with predictive charges, flanking crawlers, marked ground attacks, stronger boss patterns, and reduced healing loops. React after attacks commit and manage dodge stamina. Attacks briefly slow movement and delay stamina recovery. Relic rooms are guarded, bosses bring mixed support, summons are finite, and healing shares a room allowance. Enemies recover from cover corners so they cannot be parked there indefinitely. Standard and Nightmare are selectable. The seed and difficulty can be replayed, but a new descent resets the build.

**Deckbound:** click/tap cards, or use 1–9 to play hand slots and E to end your turn. Read enemy intent before spending energy on attacks, block, and statuses. Select a target when several enemies are present. Eighteen encounters cross three acts with combat, elites, shops, rest stops, and events. Shape a deck of 24 card types with upgrades, removal, rewards, and eight relics. Rest can heal or upgrade; shops spend earned gold. Defeat the three bosses to win. Veteran starts by default with three mandatory road battles per act; Nightmare requires four. Complementary enemy pairs and disclosed allied shields make targeting matter. Card healing is limited to 18/12 HP per battle in Veteran/Nightmare, while late turns bring stronger pressure. Different offensive and defensive builds remain viable. Zero-cost Quickstep exhausts after use. Standard and Nightmare are selectable. Death ends the expedition; replay the seed or start again.

Solo games have pause and new-game controls beside the score display. P pauses and R restarts; leaving the page or switching tabs pauses real-time solo games, including a pending Rift upgrade choice. Open **How to play** for the rules. Touch controls appear on smaller screens or touch devices; Prism's on-screen controls are also available from its desktop disclosure. Best scores and completed timed records are saved in the current browser when browser storage is available. Records are separate by game mode and difficulty, including each Apex track or championship. Rebalanced challenge records stay separate from historical scores and practice modes across all ten solo games. Master 2048 requires a complete six-trial tour; Minesweeper requires a clean field before its active-time limit. Starting a new game resets the run; best records remain.

Leaving a room resets that room's match and readiness. Rooms and matches live in memory and disappear when the server stops. An empty room is eventually removed; create another room if an old invitation has expired.

## Development

```sh
npm test
```

Optional browser checks require Python Playwright and Chromium. Run `python test/difficulty-browser-smoke.py` for the challenge defaults, native difficulty/mode selection, record isolation, pause, restart, and desktop/mobile layouts. Run `python test/paris-browser-smoke.py` for Survival acceleration, braking, crash-ending time records, the full delivery route, native controls, and responsive layouts. The longer gameplay regression suites below explicitly select the original Standard/Classic rules so their fixtures and records remain comparable. Run `python test/cards-browser-smoke.py` to start an isolated local server and exercise all three card games in two browser sessions. Run `python test/solo-browser-smoke.py` to check the three arcade and puzzle games, records, and mobile layouts on an isolated server. Run `python test/driving-browser-smoke.py` to exercise driving controls, full laps, traffic, records, pause, and touch layouts on an isolated server. Run `python test/skill-browser-smoke.py` for Vector Arena's two-player combat, Prism Shift's controls and modes, and Rift Survivor's combat and upgrades. Run `python test/expansion-browser-smoke.py` for Ember Delve, Deckbound, and two-client Oddstock Rumble with mobile, native controls, pause, and real gameplay checks. Run `python test/dungeon-browser-smoke.py` for a physical co-op clear through the first guardian, shrine boons, and the Tide Crypt transition; set `DUNGEON_ROOMS=9` for the extended expedition check. To check the original four games, run `python test/hub-browser-smoke.py http://127.0.0.1:3000` against a running host.

The action games use authoritative combat at 120 ticks per second with live snapshots at 60 Hz. Quiet lobbies and turn-based boards use a 10 Hz heartbeat; readiness, moves, card actions, and selections broadcast immediately. Browsers send gameplay inputs during combat and predict local movement for responsiveness; the server decides hits and validates board and card actions. Empty rooms do no simulation work, and the simulation timer sleeps when no players are connected. Card snapshots are prepared separately for each seat: opposing hands, the draw order, and hidden memory cards are not sent to a player's browser. Network latency and jitter still affect online play.

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
