# Use KOOBZ3 as an Internet game server

The published [semaG website](https://semag.daaalil.chatgpt.site/) hosts the library and solo games. Multiplayer rooms run on a PC game server. KOOBZ3 can be that server: a Cloudflare Quick Tunnel gives it a public HTTPS address and carries its WebSocket multiplayer connections without router port forwarding.

## Start on your Windows PC

1. Download and fully extract the latest semaG PC host. Install [Node.js 20 or newer](https://nodejs.org/) if needed.
2. Install the official Cloudflare tunnel client once in a terminal:

   ```powershell
   winget install --id Cloudflare.cloudflared --exact
   ```

   Cloudflare also provides [official manual installation instructions](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/). A manually installed `cloudflared.exe` can be placed beside `start-online-windows.bat`. The launcher does not download or install the tunnel client automatically.

3. Open a new terminal or double-click **start-online-windows.bat**. It starts semaG on port 3000, or reuses a healthy semaG host already running there. If another application occupies that port, it reports the conflict and leaves that application alone.
4. Wait for the green public link, such as `https://your-session.trycloudflare.com`. Open that **public link on KOOBZ3 too**, create a game room, and share the link or its room invitation with your colleagues. Using the public link on the host ensures that invitations contain an address your friends can reach.

You can also open the published semaG website, choose **Play with friends**, and paste the public HTTPS link. The dialog opens the PC-hosted hub, where multiplayer rooms are available. `KOOBZ3:3000` still works only for people who can reach that hostname directly on your LAN or VPN.

## While you play

- Keep KOOBZ3 awake and the launcher window open. **Ctrl+C** or **Enter** stops the tunnel and the game server started by this launcher. If semaG was already running, that existing server is left running. Avoid closing the terminal window directly; use the stop keys so cleanup can run.
- The public address is temporary and changes after restarting the tunnel. Quick Tunnels require no Cloudflare account and are intended for small testing sessions. A named tunnel can provide a stable address later.
- Anyone with the public link can reach this game hub and its open rooms. The public link is separate from the published website's access settings.
- The PC's network must allow HTTPS for tunnel setup and outbound TCP port **7844** to Cloudflare Tunnel. The launcher uses HTTP/2 so blocked UDP does not prevent connection. If a corporate network blocks the tunnel, its administrator must allow it or provide another reachable host address.
- All players connect through KOOBZ3. Internet latency and the tunnel route affect responsiveness; a fast corporate LAN alone does not determine Internet latency. Stopping the host ends its active matches.

The launcher verifies that its public `/health` endpoint reaches semaG before displaying **ONLINE**. Windows PowerShell 5.1 or newer is supported; no administrator privileges or firewall-rule changes are requested by the launcher.
