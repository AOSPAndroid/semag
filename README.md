# semag — Fireside game hub

![Fireside pixel-art logo](public/hub/logo.svg)

A self-hosted browser game hub with solo games and two-player multiplayer. Pick **Play solo** for an instant arcade or puzzle game, or create a room and share your PC address or room link with a colleague. Both players press **Ready** before multiplayer play begins. Each room has two seats; the server can run several independent rooms at once.

| Game | Mode | Goal |
| --- | --- | --- |
| Afterimage | 1v1 rooftop sword fighter | Win two rounds with spacing, parries, dashes, and attack cancels. |
| Checkers | Turn-based 1v1 | Capture every opposing piece or leave your opponent without a legal move. |
| Relic Duel | 1v1 top-down arena | Win two rounds with sword attacks, arrows, guarding, and timed rolls. |
| Dungeon Run | Two-player co-op | Survive the dungeon waves together and defeat the final boss. |
| Crazy Eights | Turn-based card duel | Match the rank or suit, choose a new suit with an eight, and empty your hand first. |
| 21 Duel | Blackjack-style card duel | Get closest to 21 without going over; win more of five hands than your rival. |
| Memory Match | Turn-based card memory game | Find more pairs on a shared board of 32 cards. |
| Snake | Solo arcade | Eat fruit, grow longer, and survive as the snake gets faster. |
| Minesweeper | Solo puzzle | Use numbered clues to reveal every safe tile without opening a mine. |
| 2048 | Solo puzzle | Slide equal tiles together to reach 2048, then keep going if you like. |

The action games are original compact implementations. Checkers follows American checkers rules. All multiplayer card games use the same two-seat rooms, ready countdown, and rematch flow. The shelf filters show **All games**, **With a friend**, or **Solo**.

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

Keep that terminal open while playing. Open **http://localhost:3000** in a current browser. Enter your player name and choose a game. Solo games start immediately from **Play solo** and run in your browser. For multiplayer, create a room and send your colleague the invitation, or **http://YOUR-PC-HOSTNAME:3000** plus the room code. They can join a listed room or enter its code. Both players then press **Ready**. A player cancelling readiness during the initial countdown returns the room to the lobby.

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

A connected light strike can cancel into a heavy; a missed light cannot. Holding guard costs stamina when hit, and a depleted guard breaks. Dash evasion starts after a brief vulnerable startup. Press **Fight smarter** for tips. Afterimage also has a local practice opponent.

Relic Duel and Dungeon Run:

| Action | Keys |
| --- | --- |
| Move / face direction | WASD or arrow keys |
| Sword attack | J |
| Shoot arrow | K |
| Roll / evade | Space or Shift |
| Guard / timed parry | L or I |
| Revive a fallen teammate in Dungeon Run | Hold guard nearby |

Attacks, arrows, and rolls require fresh keypresses. Manage stamina and use the environment to approach safely. In Dungeon Run, protect each other; if both heroes fall, the run ends. Hold guard next to a fallen ally to revive them.

In both competitive action games, the first player to win two rounds takes the match. Rounds last 90 seconds; a timeout awards the round to the player with more health, while a tie awards no win. Both players must agree to a rematch.

For Checkers, click a piece and then a highlighted destination. Captures are mandatory; continue jumping with the same piece when another capture is available. Men move and capture forward, kings move and capture in both directions, and reaching the opposite edge crowns a man and ends that turn. Three repetitions of a position or 80 turns without a capture or a man moving produce a draw.

**Crazy Eights:** each player starts with seven cards. Play a card matching the top card's rank or the active suit. An eight is wild: choose a suit when you play it. When you have no legal card, draw one; play if you can or pass after drawing. The discard pile is recycled when the draw pile runs out. Empty your hand to win. If neither player can continue, the lower remaining hand value wins (eights count 50, face cards 10, aces 1, other cards their rank); equal values draw.

**21 Duel:** a head-to-head variation inspired by blackjack. Each player starts with two cards and chooses **Hit** or **Stand** independently. Aces count 1 or 11, face cards count 10; 21 and busts automatically stand. Opponent cards stay hidden until both hands settle. The player nearest to 21 without busting wins the hand; equal totals or two busts draw. Five hands decide the match by number of hands won. The next hand starts automatically after the reveal. There is no dealer or betting.

**Memory Match:** flip two cards on your turn. Matching rank and suit earns a pair and another turn. A mismatch stays visible briefly, then turns over and passes the turn. Sixteen pairs are hidden in the shared board. The player with more pairs wins; eight pairs each draws. All card actions support mouse, touch, and keyboard buttons.

**Snake:** steer with arrow keys, WASD, or the direction buttons. Eat fruit for 10 points and a longer tail. Avoid walls and your own body. Only one turn is queued per movement step, and the pace increases as you score. Space or the **Pause** button pauses; leaving the page or switching tabs also pauses automatically. Press **New game** to start again.

**Minesweeper:** choose Beginner (9×9, 10 mines) or Intermediate (16×16, 40 mines). Click or tap to reveal; the first reveal is safe. Right-click or press F to flag, or use **Flag mode** on touch screens. Arrow keys move between tiles; Enter or Space reveals. A revealed number opens its remaining neighboring tiles when the matching number of flags is present. Incorrect flags can still cause a mine to open. Reveal all safe tiles to win; the timer starts on the first reveal and stops while paused.

**2048:** use arrow keys, WASD, swipes, or the direction buttons to slide the board. Equal tiles merge once per move, adding their combined value to your score. A new tile appears after a move changes the board. **Undo** restores one previous move. Reach 2048 to win, then choose **Keep going** to continue.

Solo games have pause and new-game controls. Snake and 2048 best scores, plus Minesweeper best times for each difficulty, are saved in the current browser when browser storage is available. Starting a new game resets the board; best records remain.

Leaving a room resets that room's match and readiness. Rooms and matches live in memory and disappear when the server stops. An empty room is eventually removed; create another room if an old invitation has expired.

## Development

```sh
npm test
```

Optional browser checks require Python Playwright and Chromium. Run `python test/cards-browser-smoke.py` to start an isolated local server and exercise all three card games in two browser sessions. Run `python test/solo-browser-smoke.py` to check solo launch, controls, records, and mobile layouts on an isolated server. To check the original four games, run `python test/hub-browser-smoke.py http://127.0.0.1:3000` against a running host.

The action games use authoritative combat at 120 ticks per second with snapshots at 60 Hz. Browsers predict local movement for responsiveness; the server decides hits and validates board and card actions. Card snapshots are prepared separately for each seat: opposing hands, the draw order, and hidden memory cards are not sent to a player's browser. Network latency and jitter still affect online play.

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
