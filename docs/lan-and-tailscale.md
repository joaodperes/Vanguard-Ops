# LAN / Tailscale match hosting

Host the game on one computer. It serves the Next.js web app on TCP **3000**
and the authoritative Socket.IO game server on TCP **3003**.

## Start the host

Install Bun and clone the repository. Then:

```sh
git switch dev
bun install
# Set DATABASE_URL in .env to a writable local SQLite file.
bun run db:push
bunx next dev -H 0.0.0.0 -p 3000
```

The instrumentation hook starts port 3003 automatically. Verify the console
prints `[VANGUARD] Game server listening on port 3003`.

## Join from other computers

- **LAN:** open `http://HOST_LAN_IP:3000`.
- **Tailscale:** join the same tailnet, run `tailscale ip -4` on the host,
  and open `http://HOST_TAILSCALE_IP:3000` on each player device.
- Permit **TCP 3000 and 3003** in the host's firewall and tailnet ACL/grants.
  No public router port forwarding is required for Tailscale.
- Host: **Play → Create Room**. Others: **Play → Browse Rooms**. Join the room
  and let the host start the match.

The web client discovers the game server on the **same IP/hostname** on port
3003. LAN and Tailscale sessions do not require a public matchmaking server.

The original sandbox gateway is still used when the site is served on port
81 or through `XTransformPort`. HTTPS reverse proxies (including Tailscale
Serve) need separate game-socket proxying; this guide intentionally uses
plain HTTP on a trusted private LAN/tailnet to avoid mixed-content errors.

Troubleshooting: if the room list or Create Room reports unavailable, check
that the server is listening on 3003, the host firewall/tailnet ACL allows
access, and the browser receives an Engine.IO handshake (not HTML) from
`http://HOST:3003/?EIO=4&transport=polling`.
Keep development services restricted to trusted networks.
