# Room and match flow

Quick Play uses the selected one of the existing six modes. It joins a public,
non-full room, preferring active matches and then the largest human roster.
If none exists, it creates a public room with recommended capacity, normal bots,
and default rules and starts immediately. Quick Play Survival uses the default
tier; custom limits, passwords, difficulty and tiers remain in Create Room.

Rooms retain their ID, password, roster, teams and host through the results
screen. The room connection belongs to the client session rather than the 3D
engine. Each round gets fresh server state and a fresh client engine so scores,
Survival upgrades, destruction, projectiles and other effects cannot carry over.
Reattaching a view on the same connection is idempotent. Leaving for match setup,
the menu or Armory leaves the group. Closing the tab or losing the connection
removes the member; the next connected human inherits host duties. Empty rooms
are reclaimed after a short grace period. Occupied results rooms persist while
players review rewards.

The lobby and results screen offer three map choices (fewer where necessary):
the current arena for a rematch and compatible alternatives. Alternatives support
the room's mode and player count. Each connected human has one changeable vote;
departed votes are removed. The host starts the next round. Most votes win, ties
follow candidate order (current arena first), and no votes keep the current arena.
Votes close on launch. Every connected player's results must finish saving before
the next round can launch.

Copy room link creates a `?room=<id>` invitation while preserving the deployment
path and gateway parameters. Passwords are omitted. After account/guest choice,
the recipient sees the invited room in the browser and uses the ordinary team
and password dialog. Full, expired and between-round rooms display an unavailable
message with refresh available. Clipboard failure exposes a selectable link.

Protocol additions: `quickPlay`, `voteMap`, `readyNextRound`, `roomStatus`, and
`roundLaunched`. Deploy frontend and game server together and restart the server.
No catalogs or database schema change. Rooms remain in-memory and do not survive
a server restart. Losing a results connection requires returning to match setup
to rejoin an available room.

## Verification

- `tests/room-flow.test.ts`: matchmaking filters, compatible map choices,
  vote replacement/ties and invitation URLs.
- `tests/room-session.test.ts`: isolated client process checks connection
  retention, round transitions, passwords and leaving.
- `tests/room-flow-online.test.ts`: real Socket.IO clients and a temporary SQLite
  database exercise private joining, host-only launch, idempotent reattachment,
  retention beyond 15 seconds, voting, readiness, round reset, host departure,
  Quick Play and all six modes. Only the isolated server's simulation interval
  is accelerated; its cleanup grace period uses real time.

Manual browser QA: create a private lobby in two tabs, follow its invitation,
change votes, finish a match, verify the results roster and rewards, start another
arena, and leave as host. Repeat on a narrow touch screen and with clipboard
access denied. Check late joining, the Gun Game first weapon and CTF reset rules.
The six-mode selection remains a 3×2 grid.
