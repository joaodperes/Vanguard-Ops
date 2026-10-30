# Weapon Prestige & Wonder Weapons — dev implementation

**Implementation branch:** `dev`. Progression/UI/server changes are committed
directly; the earlier draft PR is superseded. This work changes Prisma schema.
Run the safe schema update **before starting the new app/server build**.

## Earning Prestige

- Every non-Wonder weapon has seven regular cosmetic challenges; the two
  Prestige cosmetics are not part of that checklist.
- Completing all seven awards that particular weapon's Prestige exactly once.
  Bought legacy skins count as completed (preserves historical entitlement).
- **Prestige** awards **Viridian Blight** (animated toxic green) independently. Only the seven ordinary skin challenges count toward Prestige.
- **Mastery rank 5/5** awards **Eventide** (scrolling starfield) independently;
  players can equip it even without completing Prestige.
- Completing both tracks on the same weapon grants a one-use **Wonder Weapon
  unlock entitlement**, stored as a one-time permanent `WonderTokenAward`
  for that weapon. Later threshold increases never revoke an earned token.
  Available tokens are immutable award rows plus any legacy purchase
  compensation, minus previously redeemed Wonder Weapons. Old Prestige
  awards retain both skins. No repeated awards on refresh, re-mastery or import.
- Weapon Prestige does not reset rank, kills, or attachments.

## Diagnosing a missing Wonder unlock

Armory → Wonders shows permanent Wonder awards, lifetime unlocks earned,
redemptions and available unlocks. The per-weapon challenge list remains
under Armory → Weapons → Customize → Challenges, including the independent
Mastery rank and Prestige status for that weapon.

New Wonder awards require both server-confirmed Prestige and Mastery rank 5.
Once earned, a token award is permanent even if balance requirements change.
Historical Wonder purchases are grandfathered; an early match exit saves
weapon progress when it successfully submits its match result.

## Wonder Weapons

| Weapon | Behavior | Max ammo | Recharge per charge | Other-kill bonus |
| --- | --- | ---: | ---: | ---: |
| Event Horizon | Large 14m gravity pull with delayed detonation | 1 | 48s | -2.4s |
| Plagueheart | Corrosive 9m blast and lingering toxin | 2 | 38s | -1.8s |
| Bullet Spitter | Deployed automatic turret (see `survival-bullet-spitter.md`) | 1 | 55s | -2.0s |
| Deadlock | One charged shot damages up to three exposed tagged enemies, including from hipfire | 2 | 29s | -1.6s |
| Hellfire | True flamethrower; five-second full-tank burst, no gunshots or persistent floor patches | 5 fuel-seconds | 6.5s per fuel-second | -1.7s |
| Stormweaver | Seven lightning pellets; enemy hits chain twice, misses become short-lived proximity lightning mines | 2 | 31s | -1.8s |
| Thunderclap | Bouncing 120-damage / 6m shell with six delayed 75-damage / 4.5m bomblets | 2 | 32s | -1.6s |
| Bulwark + P-9 | 250 HP bullet shield; ADS braces it and lowers P-9 | Normal P-9 magazine | Normal reload; shield restores on respawn | — |
| Bogfather | Disabled pending redesign; cannot be selected | — | — | — |

A Wonder Weapon redeems **one Wonder unlock entitlement** and is permanently owned. It equips into
the Primary slot and has no attachments. Charge-based Wonders have no reserve ammo and cannot manually
reload. Bulwark is the explicit exception: its P-9 uses a normal magazine/reload while shield HP is independent. See [Defensive Wonders and bot tactics](wonder-defense-and-bot-tactics.md). The recharge clock continues through death and while the gun is
holstered, and it refills charges one at a time. Kills dealt directly by the Wonder Weapon **and its persistent effects** do not accelerate its own recharge.
The server separately tracks and refuses premature online shots; the client
tracks the clock for accurate firing, HUD and offline gameplay. Gun Game
excludes all Wonders from its ordinary weapon ladder.

Wonder charges reset *between matches*, not between deaths. The web server
still uses client-reported match results and the separate socket game server
does not validate a signed token-purchase entitlement; full anti-cheat and
server-side user identity binding are future hardening work. The web loadout
endpoint enforces token purchases before equipping.

See [Wonder Weapon breakthrough pass](wonder-weapon-expansion.md) for the new ability details and implementation limitations.

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
   mastered weapon, confirm independent Mastery/Prestige camos and one Wonder entitlement after both, spend it once, check purchase
   rejection on replay and no free refill through swap, death or ammo cache.
4. Verify all seven Wonders in offline and online matches, including delayed gravity
   damage attribution, poison attribution and regular-kill time reduction.
5. Verify Gun Game still uses 30 normal tiers and all legacy purchases remain.
6. Export and reimport an account with a Prestige and Wonder purchase; ensure
   camos/ownership remain and available tokens do not increase.

The progression schema now contains `WeaponPrestige`, `WonderUnlock`,
and permanent `WonderTokenAward` records, all unique per player/weapon.
New Player fields `wonderTokenLedgerReady` and `wonderLegacyCredits`
enable one-time grandfathering. On first profile access, pre-existing
Wonder purchases are treated as paid from the oldest Prestige awards
earned before the most recent historical Wonder purchase; if those source
records are incomplete, an offset credit covers the unmatched historic
purchases without giving free spending power. Old purchase rows did not
record the source weapon, so this reconciliation is necessarily
best-effort and permanent. Run an additive `bun run db:push` before
starting this server build. The changes are not destructive. Existing
`WeaponProgress.conditionStats` is the earlier contextual challenge schema
change and also needs migration if not already applied.

**Status:** The implementation is on `dev`. Confirm green validation for the exact candidate commit, complete manual gameplay checks and apply reviewed database updates before deployment.

For the four later additions (Deadlock, Hellfire, Stormweaver and Bogfather), see [Wonder Weapon expansion](wonder-weapon-expansion.md) for their mechanics, limitations and playtest requirements.

## Independent Wonder Weapon Unlock challenge

The Armory Challenges tab also tracks **Wonder Weapon Unlock** as an independent
0/2 to 2/2 milestone. Its two objectives are **Weapon Prestige (1/1)** and
**Weapon Mastery (5/5)**. It never counts as one of the seven cosmetic Prestige
challenges or delays Viridian Blight. Completing both awards a single Wonder
Weapon unlock entitlement (not a Prestige token or another Shop currency).
