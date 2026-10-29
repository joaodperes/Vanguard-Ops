# Vanguard Ops

**Vanguard Ops** is a browser-based, first-person 3D shooter with offline bot matches, multiplayer rooms, customizable weapon loadouts, and persistent progression. Built with Next.js, React, Three.js, Socket.IO and Prisma.

Players can jump straight into combat against AI, create a room for friends, or browse existing rooms. Every match earns progress toward equipment, cosmetics, quests, achievements and long-term career rewards. All weapons can be tested in the Firing Range before buying them.

## How to play

1. **Enter the game.** Continue as a guest or register/sign in to keep your account's progression across devices. New players can run through the interactive tutorial.
2. **Pick a match.** Open **Play** to create a room or join another player's room. Choose a mode, supported map, team size, bot fill and bot difficulty as appropriate. Room hosts start the match when ready. Offline play is available against bots.
3. **Fight and complete objectives.** Earn XP, credits and weapon-specific progress from matches. Different modes use kills, collected tags, captured flags or survived waves to determine success.
4. **Upgrade your loadout.** Open **Armory** to unlock weapons and attachments, select primary/secondary/melee weapons, equip a perk, unlock skins through challenges and save named loadouts. Visit **Shop** for available cosmetics and **Profile** for progress, challenges and achievements.
5. **Practice freely.** Enter **Firing Range** from the Armory. Select standard weapons, Wonder Weapons and compatible attachments without buying them. Range activity does not award progression or overwrite your saved loadout.

## Game modes

| Mode | Objective |
| --- | --- |
| **Free-for-All (FFA)** | Every operator for themselves; reach the kill limit. |
| **Team Deathmatch (TDM)** | Two teams compete on eliminations. |
| **Kill Confirmed** | Collect enemy tags to score; recover friendly tags to deny points. |
| **Capture the Flag (CTF)** | Steal and deliver the enemy flag while defending your own. Three dedicated maps: Forest Warfare, Orbital Nexus with its reactor objective, and Floodgate with 16v16 teams and spillway pressure purges. |
| **Gun Game** | Advance through a rotating weapon sequence by earning eliminations. |
| **Survival** | Fight escalating enemy waves, including co-op and progressively harder tiers. |

Maps include Blacksite, Breakwater, Verdant Ruins, Ridgefall, Afterlight City (day and night), Forest Warfare, Orbital Nexus and Floodgate. Modes have different supported-map rules.

## Controls

| Action | Desktop |
| --- | --- |
| Move / look | **WASD** / mouse |
| Fire / aim down sights | **Left mouse** / **right mouse** |
| Sprint / jump | **Shift** / **Space** |
| Reload | **R** |
| Primary / secondary / melee | **1 / 2 / 3** |
| Quick swap / quick melee | **Q / F** |
| Release cursor / pause | **Esc** |

Touch devices provide a movement stick and on-screen firing, aiming, swapping, reloading, jumping and melee controls. Some weapons have special mechanics; consult their Armory descriptions.

## Progression and equipment

- **Weapons and attachments:** Earn credits through gameplay. Purchase equipment once its level and challenge requirements are met. Attachments are owned separately for each weapon; a challenge being complete makes the attachment eligible to purchase, not automatically owned.
- **Skins and mastery:** Complete per-weapon challenges to earn finishes. Weapon Mastery advances through kill/headshot milestones (melee uses kill-only targets). Reaching high mastery and completing cosmetics challenges unlocks additional Prestige rewards and Wonder Weapon opportunities.
- **Loadouts and perks:** Equip a primary, secondary, melee weapon and one passive perk. Save several named loadouts for different modes and playstyles.
- **Achievements and Career:** Track challenges, titles and long-term progression in Profile.

Credits are an in-game reward currency; the current game does not sell credits for real money.

## Running locally

**Prerequisites:** Bun, a compatible Node.js runtime, and a writable SQLite database.

```bash
bun install --frozen-lockfile
```

Create an untracked `.env` file with your database location:

```dotenv
DATABASE_URL="file:./db/custom.db"
```

Prisma resolves a relative SQLite file URL against the `prisma/` directory, so this example points to `prisma/db/custom.db`.

```bash
bun run dev
```

Open `http://localhost:3000`. The multiplayer Socket.IO server starts on **port 3003** from the Next.js Node runtime; make that port reachable for remote clients when hosting matches.

### Production build

```bash
bun install --frozen-lockfile
bun run db:generate
bun run content:validate
bun run typecheck
bun run build
bun run start
```

The production server uses Next.js standalone output. **Back up your database before deployment and review any Prisma schema changes**; building the application does not apply production database migrations. Configure `DATABASE_URL` and network/proxy routing for your environment. Never commit credentials or player databases.

## Validation and contributing

Use the checked-in Bun lockfile (`bun.lock`) as the dependency source of truth. From the repository root:

```bash
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```

The `dev` and `main` GitHub Actions workflows run these checks on pushes and pull requests. Tests verify content, maps, player progression, multiplayer and weapon mechanics, but passing tests is not a substitute for manual playtesting or a safe production database migration. See [the QA and merge checklist](docs/dev-test-checklist.md) before releasing.

## Technology and project structure

- **Client and UI:** Next.js, React, Tailwind CSS and Three.js
- **Multiplayer:** Socket.IO with server-authoritative game simulation
- **Data and progression:** Prisma with SQLite
- **Game content:** JSON catalogs in `src/data/catalogs/`; map layouts and themes in `src/data/`
- **Deployment:** `Caddyfile` and a separate `mini-services/game-server/` entry point for supported hosting setups

Development continues on the `dev` branch and validated changes are promoted to `main` through a normal pull request. Automated tests and technical documentation are retained on both branches, because they support ongoing maintenance and do not become part of the browser game bundle.

## License

The project's original source code is distributed under the **MIT License**. See [LICENSE](LICENSE). Third-party packages remain subject to their own licenses.
