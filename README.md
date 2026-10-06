# semag — Fireside game hub

![Fireside pixel-art logo](public/hub/logo.svg)

A self-hosted browser game hub for two players. Pick a game, create a room, and share your PC address or the room link with a colleague. Both players press **Ready** before play begins. Each room has two seats; the server can run several independent rooms at once.

| Game | Mode | Goal |
| --- | --- | --- |
| Afterimage | 1v1 rooftop sword fighter | Win two rounds with spacing, parries, dashes, and attack cancels. |
| Checkers | Turn-based 1v1 | Capture every opposing piece or leave your opponent without a legal move. |
| Relic Duel | 1v1 top-down arena | Win two rounds with sword attacks, arrows, guarding, and timed rolls. |
| Dungeon Run | Two-player co-op | Survive the dungeon waves together and defeat the final boss. |

The action games are original compact implementations. Checkers follows American checkers rules.

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

Keep that terminal open while playing. Open **http://localhost:3000** in a current desktop browser. Enter your player name, choose a game, and create a room. Send your colleague the room invitation, or **http://YOUR-PC-HOSTNAME:3000** plus the room code. They can join a listed room or enter its code. Both players then press **Ready**. A player cancelling readiness during the initial countdown returns the room to the lobby.

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

Leaving a room resets that room's match and readiness. Rooms and matches live in memory and disappear when the server stops. An empty room is eventually removed; create another room if an old invitation has expired.

## Development

```sh
npm test
```

The action games use authoritative combat at 120 ticks per second with snapshots at 60 Hz. Browsers predict local movement for responsiveness; the server decides hits and validates Checkers moves. Network latency and jitter still affect online play.

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
