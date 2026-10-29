# Vanguard Ops

**Game overview and instructions:** See [the release README](release/README.md) for how to play, controls, game modes, progression, and local/production setup.

A browser-based 3D first-person shooter built with Next.js, React, Three.js, Socket.IO and Prisma. Play offline against bots or create/join multiplayer rooms. Modes include Free-for-All, Team Deathmatch, Gun Game, Kill Confirmed, Capture the Flag and Survival, with progression, unlocks, loadouts and an in-browser Map Studio.

## The game

Choose an offline bot match or create/join a multiplayer room, with modes including Free-for-All, Team Deathmatch, Kill Confirmed, Capture the Flag, Gun Game and Survival. Gain credits and XP, unlock weapons, attach upgrades, complete per-weapon skin challenges and save loadouts. Try any weapon or compatible attachments in the Firing Range without purchasing them. New players can follow an interactive tutorial; touch controls are supported.

## Local development

Requirements: Node.js compatible with the checked-in Next.js release, [Bun](https://bun.sh/), and a writable SQLite database. Use the checked-in `bun.lock`.

```bash
bun install --frozen-lockfile
```

Set `DATABASE_URL` in an untracked local `.env` before using Prisma:

```dotenv
DATABASE_URL="file:./db/custom.db"
```

**SQLite path:** Prisma resolves relative `file:` paths against the `prisma/` schema directory; the example refers to `prisma/db/custom.db`, not the repository-root `db/custom.db`. Choose and back up the intended database. Never commit `.env` or player data.

```bash
bun run dev
```

The dev script generates Prisma Client, runs `prisma db push` for local development and starts Next.js on **port 3000**. Do **not** treat the development push as an approved production migration. Review schema changes and back up persistent data before deployment.

The Socket.IO game server starts from `src/instrumentation.ts` on **port 3003** in the Node runtime. Multiplayer requires that endpoint to be reachable through your local or reverse-proxy configuration; offline bot play can operate without it. See [LAN and Tailscale](docs/lan-and-tailscale.md).

## Validation

```bash
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```

`test:smoke` runs the Bun regression suite in `tests/`; `test:maps`, `test:bots` and `test:movement` select smaller suites. The validation workflow checks `dev` and `main` pushes and pull requests after the updated workflow is present on those branches. Automated checks do not replace manual browser, multiplayer, bot-pathing, performance or production-data checks.

Use the [canonical QA and promotion checklist](docs/dev-test-checklist.md) before proposing a `dev` → `main` merge. The game has six general-purpose maps and two Capture the Flag-only maps (Forest Warfare and Orbital Nexus); the day/night Afterlight editions have separate IDs.

## Project layout

- `src/app/`: Next.js pages and API routes; developer Map Studio at `/map-editor`
- `src/components/`: HUD, controls, screens and menus
- `src/lib/`: game engine, game server, gameplay rules and persistence
- `src/data/catalogs/`: authoritative JSON game catalogs
- `src/data/map-blueprints.json` and `src/data/map-themes/`: maps and visuals
- `prisma/schema.prisma`: SQLite schema
- `tests/`: Bun regression tests
- `docs/`: authoring and QA; `docs/archive/`: superseded designs and plans

## Guides

- [How to play and production overview](release/README.md)
- [Clean main release preparation](docs/release-promotion.md)
- [MIT License](LICENSE)

- [Content authoring](docs/content-authoring.md)
- [Map Studio](docs/map-studio.md)
- [Art direction and materials](docs/art-direction-and-materials.md)
- [QA and merge checks](docs/dev-test-checklist.md)
- [Prestige and Wonder Weapons](docs/prestige-wonder-weapons.md)
- [Agent and developer instructions](AGENTS.md)

## Branch and release policy

`dev` is the integration branch. Use a feature branch unless a maintainer explicitly requests direct `dev` changes. Review the exact merge result, CI, data migrations and real gameplay before promoting to `main`. Archival proposals are not active specifications.
