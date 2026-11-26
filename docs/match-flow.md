# Room and match flow

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

Kill Confirmed room settings include a configurable dropped-dogtag lifetime:
10, 15, 25, 30 or 45 seconds, or **Infinite**. Infinite tags remain available
until collected; the default remains 25 seconds. The room protocol represents
the Infinite choice with `-1` and broadcasts a JSON-safe non-expiring timestamp.

The room protocol includes `createRoom`, `listRooms`, `joinRoom`, `voteMap`,
`readyNextRound`, `roomStatus` and `roundLaunched`. Deploy frontend and game
server together and restart the server. No catalogs or database schema change.
Rooms remain in-memory and do not survive a server restart. Losing a results
connection requires returning to match setup to rejoin an available room.
