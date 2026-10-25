# Weapon Prestige & Wonder Weapons — dev implementation

**Implementation branch:** `dev`. Progression/UI/server changes are committed
directly; the earlier draft PR is superseded. This work changes Prisma schema.
Run the safe schema update **before starting the new app/server build**.

## Earning Prestige

- Every non-Wonder weapon has seven regular cosmetic challenges; the two
  Prestige cosmetics are not part of that checklist.
- Completing all seven awards that particular weapon's Prestige exactly once.
  Bought legacy skins count as completed (preserves historical entitlement).
- The award automatically makes **Eventide** (scrolling starfield) and
  **Viridian Blight** (animated fluorescent sludge) equipable on that weapon,
  with no credit price.
- Each weapon Prestige contributes one token. Token balance is **unique weapon
  Prestige awards minus unique Wonder Weapon purchases**, not a separately
  incremented balance. Thus reloading a profile, completing a challenge again,
  or re-importing a backup never generates repeat tokens.
- Weapon Prestige does not reset rank, kills, or attachments.

## Wonder Weapons

| Weapon | Behavior | Max ammo | Recharge per charge | Other-kill bonus |
| --- | --- | ---: | ---: | ---: |
| Event Horizon | Large 14m gravity pull with delayed detonation | 1 | 48s | -2.4s |
| Plagueheart | Corrosive 9m blast and lingering toxin | 2 | 38s | -1.8s |
| Bullet Spitter | Deployed automatic turret (see `survival-bullet-spitter.md`) | 1 | 55s | -2.0s |
| Rift Needle | Tight 6m gravity pull, heavier core damage | 1 | 37s | -1.5s |
| Miasma Bloom | Wide 13m lower-impact corrosion and lingering toxin | 2 | 46s | -2.0s |
| Caustic Javelin | Precise 4m high-impact corrosion and lingering toxin | 1 | 30s | -1.2s |

A Wonder Weapon costs **one token** and is permanently owned. It equips into
the Primary slot, has no attachments or reserve ammo, and cannot manually
reload. The recharge clock continues through death and while the gun is
holstered, and it refills charges one at a time. Hits/kills from the Wonder
Weapon **and its lingering poison** do not accelerate that same recharge.
The server separately tracks and refuses premature online shots; the client
tracks the clock for accurate firing, HUD and offline gameplay. Gun Game
excludes all Wonders from its ordinary weapon ladder.

Wonder charges reset *between matches*, not between deaths. The web server
still uses client-reported match results and the separate socket game server
does not validate a signed token-purchase entitlement; full anti-cheat and
server-side user identity binding are future hardening work. The web loadout
endpoint enforces token purchases before equipping.

## Other gameplay-variety changes

Normal skin challenges include no attachments, all supported slots, airborne,
ADS/hipfire, ranges, multikills, **suppressed kills, critical-health kills,
and post-respawn comeback kills**. Gold is three separate concurrent
requirements (all required). New rotating objectives also reward enemy tag
confirmations and friendly denials in Kill Confirmed.

## Windows development startup (Prisma 6)

The `dev` script now runs `prisma generate` and a non-destructive
`prisma db push` **before** Next.js accepts requests. The previous
`DATABASE_URL="..." prisma ...` inline shell syntax only worked on
Unix shells; `db.ts` now passes DATABASE_URL via the subprocess environment,
which is compatible with Windows Command Prompt and PowerShell.

From the repository root, stop an existing Next.js process and run:

```powershell
git pull origin dev
bun run dev
```

Or use `npm run dev`. For a one-time manual schema/client refresh without
launching Next.js, use `bun run db:setup`. If you started Next.js before
generating the updated Prisma Client, you **must restart** it, not merely
refresh the browser.

**Path clarification:** Prisma 6 resolves a relative SQLite URL against
the directory containing `prisma/schema.prisma`. For example,
`DATABASE_URL="file:./db/custom.db"` refers to
`prisma/db/custom.db`, not `db/custom.db` in the repository root.
Check and back up the intended database before running schema changes; set
`DATABASE_URL="file:../db/custom.db"` only if the database you
actually want is stored in the repository-root `db/` directory.
The startup sync intentionally omits `--accept-data-loss`.

## Persistence and safe setup

1. Back up the persistent SQLite database and player exports.
2. On the intended development database run:
   ```sh
   bun install --frozen-lockfile
   bun run db:push
   bun run db:generate
   bun run test:smoke
   bun run typecheck
   bun run build
   ```
3. Verify a fresh account cannot select an unowned Wonder. Earn a Prestige on a
   mastered weapon, confirm token +2 camos, spend it once, check purchase
   rejection on replay and no free refill through swap, death or ammo cache.
4. Verify all six Wonders in offline and online matches, including delayed gravity
   damage attribution, poison attribution and regular-kill time reduction.
5. Verify Gun Game still uses 30 normal tiers and all legacy purchases remain.
6. Export and reimport an account with a Prestige and Wonder purchase; ensure
   camos/ownership remain and available tokens do not increase.

The added tables are `WeaponPrestige` and `WonderUnlock` with unique keys
(playerId, weaponId). They add no destructive migration. Existing
`WeaponProgress.conditionStats` is the earlier contextual challenge schema
change and also needs migration if not already applied.

**Status:** The implementation and tests were authored on `dev`, but the
test suite and build were **not executed** in the linked GitHub environment.
Do not deploy before running them and applying the schema changes.

For the three later additions (Rift Needle, Miasma Bloom and Caustic Javelin), see [Wonder Weapon expansion](wonder-weapon-expansion.md) for design trade-offs and the playtest gate.
