# Host a Vanguard Ops LAN party (LAN or Tailscale)

One computer **hosts both services**: the Next.js website on **TCP 3000** and the authoritative Socket.IO game server on **TCP 3003**. The host also owns the SQLite player/progression database. Other players only need a modern browser; they do **not** install Bun, clone the project, or start a game server.

This guide is for a **trusted private LAN** or a **private Tailscale tailnet**, not for public internet hosting. The game server currently permits browser origins broadly; do not forward either port from your router to the public internet.

## 1. Prepare the host (Windows PowerShell)

Install [Bun](https://bun.sh/docs/installation) and Git, then open PowerShell in your checked-out repository. The **host** must have access to the private GitHub repo; your friends do not.

```powershell
git fetch origin
git switch dev
git pull --ff-only origin dev
bun install --frozen-lockfile
```

Create an untracked `.env` **once** if you do not already have one:

```powershell
Set-Content -Path .env -Value 'DATABASE_URL="file:./dev.db"'
```

The example database is `prisma/dev.db` (Prisma resolves relative SQLite URLs from `prisma/`). **Keep an existing `.env` and database if you have player data**; do not overwrite them. Back up your `*.db` file before updating game versions or running schema updates.

Initialize/update the local database and start the LAN listener:

```powershell
bun run db:setup
bun run lan
```

`bun run db:setup` applies the current Prisma schema to the configured database; review the proposed changes and back up existing data first. The `lan` script deliberately binds the Next.js development server to `0.0.0.0:3000` so other PCs can reach it. The Next.js instrumentation starts the game server on port **3003** in the same process; **do not** separately launch `mini-services/game-server` or you will compete for port 3003.

Look for `[VANGUARD] Game server listening on port 3003` in the host console. Leave the command running for the entire party. Test `http://localhost:3000` on the host first.

On Linux/macOS, run the same `git`, `bun install --frozen-lockfile`, `bun run db:setup`, and `bun run lan` commands in a terminal; create `.env` with `DATABASE_URL="file:./dev.db"` if needed.

## 2. Join on the same router / LAN

1. Connect every device to the same trusted Ethernet/Wi-Fi network. Guest Wi-Fi **client isolation** may prevent local devices seeing each other.
2. On the Windows host, run `ipconfig` and find its private IPv4 address on the active Ethernet/Wi-Fi adapter (for example `192.168.1.30`).
3. On **each other computer**, open **`http://192.168.1.30:3000`**, substituting your host's address. Do **not** use `localhost` on another PC: it points to that PC, not the host.
4. On the host, go to **Play → Create Room**. On the other devices, go to **Play → Browse Rooms**, join, and let the host start the match. All devices must use the **same** host/site.

Only the host runs the application. The browser chooses its Socket.IO endpoint automatically as `http://HOST:3003` when opened from an HTTP LAN address.

## 3. Join from different networks with Tailscale

Use this option when friends are not on your Wi-Fi/Ethernet. [Install Tailscale](https://tailscale.com/docs/install/windows) on the **host and every player device**, then invite friends to your tailnet (or arrange approved sharing). Sign in, connect, and ensure tailnet access rules/grants allow clients to reach the host on **TCP 3000 and 3003**.

1. On the host, run `tailscale ip -4` (or inspect the Tailscale app) to find its **100.x.y.z** Tailscale IPv4 address.
2. Keep `bun run lan` running on the host. On each remote device open **`http://100.x.y.z:3000`** using the host's *Tailscale* IP. A Tailscale MagicDNS hostname can also work: `http://HOSTNAME.tailnet.ts.net:3000` (replace with your assigned name).
3. Create/join rooms the same way as on LAN.

**No public port forwarding is necessary** with Tailscale, and you do not need `tailscale serve` for this HTTP setup. The website and game socket must both use the host's tailnet IP/hostname on **separate ports**. Do **not** use Tailscale Funnel or expose the development server to the public internet.

Tailscale Serve by itself publishes the website over HTTPS but does **not** automatically proxy Vanguard's separate Socket.IO server. The current HTTPS resolver expects the sandbox's `XTransformPort` gateway, so **do not switch to a Serve HTTPS URL without adding and testing a matching socket proxy and client configuration**. Plain HTTP transported over the private Tailscale tunnel is the supported party setup.

## 4. Windows firewall (on the host)

Windows Defender Firewall may block incoming connections even if `localhost` works. Allow inbound **TCP 3000 and 3003** on the host **for trusted peers only**. If you prefer explicit rules, run the following in an **administrator PowerShell**:

```powershell
# Devices in the same trusted local subnet (Windows Private network profile):
New-NetFirewallRule -DisplayName "Vanguard Ops LAN party" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,3003 -Profile Private -RemoteAddress LocalSubnet

# Tailscale IPv4 peers only (covers Tailscale adapters classified as Public):
New-NetFirewallRule -DisplayName "Vanguard Ops Tailscale party" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,3003 -RemoteAddress 100.64.0.0/10
```

Use only the rule(s) needed for your session. The Tailscale address range is not a substitute for tailnet grants or a trusted invite list. Remove the temporary rules when done (`Remove-NetFirewallRule -DisplayName "Vanguard Ops LAN party"` and/or `Remove-NetFirewallRule -DisplayName "Vanguard Ops Tailscale party"`). If your local network uses the **Public** profile, either configure a trusted network as Private or use a tightly restricted rule for known client IPs; do not casually open these ports to *all* public interfaces.

## 5. Confirm connectivity and troubleshoot

With the host application running:

| Where | Check | Expected |
| --- | --- | --- |
| Host | `http://localhost:3000` | Vanguard Ops loads |
| Host | `http://127.0.0.1:3003/?EIO=4&transport=polling` | Engine.IO response beginning with `0{` (not an HTML page) |
| Other player | `http://HOST_IP:3000` | Vanguard Ops loads |
| Other player | `http://HOST_IP:3003/?EIO=4&transport=polling` | Same Engine.IO handshake, proving the game port is reachable |

Use `HOST_IP` = host LAN address or Tailscale IPv4, as appropriate. From another Windows PC, `Test-NetConnection HOST_IP -Port 3003` and `Test-NetConnection HOST_IP -Port 3000` can help distinguish routing/firewall failures.

- **Page does not load:** Check that `bun run lan` is still running, verify host address, subnet/tailnet connectivity, and TCP **3000** firewall access. Recheck Wi-Fi client isolation.
- **Page loads but rooms are unavailable / reconnect:** TCP **3003** is blocked, game-server startup failed, or a proxy intercepted the request. Check the host's port-3003 console message and the remote Engine.IO URL above.
- **`EADDRINUSE` on 3003:** Another game server may already be running; stop duplicate instances rather than launching the standalone mini-service as well.
- **Tailscale traffic cannot connect:** Verify both devices are online in Tailscale, signed into the intended tailnet, and permitted by Tailscale grants plus Windows firewall. `tailscale ping HOSTNAME` is a useful network diagnostic.
- **One player sees different progress/accounts:** Progression is stored on the host's database and player identity in the browser. Each browser profile has its own guest identity, unless signed into the same account. Never share browser storage or the `.env` file.
- **After updating the project:** Stop the server, back up the database, `git pull --ff-only`, `bun install --frozen-lockfile`, `bun run db:setup`, then `bun run lan`. Check for Prisma migration notes before syncing a valued database.

This is a multiplayer development/party setup, **not a hardened production deployment**. For public hosting, use authenticated access, strict allowed origins, TLS termination, rate limiting and a correctly configured HTTPS game-socket reverse proxy.
