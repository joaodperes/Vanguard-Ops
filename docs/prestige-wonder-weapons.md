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

Armory → Wonders shows Wonder Weapon choices and token redemption. The per-weapon challenge list remains
under Armory → Weapons → Customize → Challenges, including the independent
Mastery rank and Prestige status for that weapon.

New Wonder awards require both server-confirmed Prestige and Mastery rank 5.
Once earned, a token award is permanent even if balance requirements change.
Historical Wonder purchases are grandfathered; an early match exit saves
weapon progress when it successfully submits its match result.

## Wonder Weapons — perk-selected fourth slot

**Battle-Hardened** remains the level-one default. **Wonder Weapon** is a second
level-one perk option. Choosing it removes passive perk benefits and equips one
permanently owned Wonder in weapon **slot 4** (keyboard 4, conditional touch
button). Ordinary primary, secondary and melee slots (1–3) remain available.
Without a redeemed Wonder unlock, the Wonder perk cannot be confirmed.
Gun Game still uses its separate fixed weapon progression.

Each Wonder still costs one earned Prestige/Mastery Wonder entitlement. Ownership
is permanent and separate from equipping. Only enabled, owned Wonders can be
used in slot 4; no Wonder may occupy the ordinary primary or secondary slot.
Bogfather is archived and cannot be selected.

| Weapon | Behavior | Capacity | Recharge | Ordinary kill bonus |
| --- | --- | ---: | ---: | ---: |
| Event Horizon | 9.5m gravity pull and delayed explosion | 1 | 80s | -1.6s |
| Plagueheart | 3.5m corrosive splash; stronger impact and 5s poison | 3 | 70s per charge | -4.5s |
| Bullet Spitter | Autonomous 26-damage turret; 25s lifetime, 42m reach | 1 | 105s | -1.5s |
| Deadlock | Up to 3 exposed marked targets per charged shot | 2 | 50s per charge | -1.0s |
| Hellfire | 13m flame cone, 8 fuel-seconds, 9 damage per tick | 8 | 12s per fuel-second | -1.0s |
| Stormweaver | Lightning pellets, chains, 6.5s proximity mines | 2 | 60s per charge | -1.0s |
| Thunderclap | Bouncing 7m shell and six 5.25m bomblets; 175 damage cap per target/volley | 2 | 60s per charge | -1.1s |
| Bulwark + P-9 | 250 HP frontal/left shield, P-9 magazine; F performs 50-damage shield bash | Standard P-9 magazine | Shield rebuild 55s | -2s shield rebuild |
| Bogfather | Archived | — | — | — |

**Recharge persistence:** all enabled Wonders start each match **empty**, with
a full recharge countdown. No charge is granted on death or respawn; recharging
continues while holstered and dead without resetting the existing timer.
Ordinary-weapon kills shorten the pending recharge by the listed bonus, but
Wonder damage and its persistent effects cannot accelerate their own charges.
Wonder charges cannot be manually reloaded. Bulwark starts with a **broken shield**
and a 55-second rebuild timer; its standard P-9 magazine still works and reloads
normally. Shield HP and rebuild countdown persist across death.

**Anti-abuse:** applying a queued loadout on spawn clears the player's existing
Wonder state and starts the new selected Wonder at **zero charges** with a full
recharge timer. This also applies if a player reselects the same kit. A queued
Bulwark begins broken and rebuilds on its own cooldown. A new match also starts
with zero charges and a broken Bulwark shield. The online server authorizes
the equipped slot 4 and charge consumption; client controls and visuals use the
same charge rules.

**Legacy migration:** the Prisma Loadout record has an optional
`wonderWeaponId` string (default empty). Existing players whose primary weapon
was a Wonder are converted to the starter conventional rifle with the Wonder
Weapon perk selected and their previous Wonder in slot 4. Previously earned
WonderUnlock records are preserved. Named saved presets whose primary was
a Wonder are deleted; other presets can persist their own optional Wonder ID.
Run `bun run db:push` and `bun run db:generate` on the actual persistent
database before deploying. The schema addition is additive.

See [Wonder Weapon mechanics](wonder-weapon-expansion.md) and
[Defensive Wonders and bot tactics](wonder-defense-and-bot-tactics.md) for
implementation and collision details.

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
   rejection on replay, zero charges on match start, no respawn refill, preserved pending cooldowns, and zero initial charges after applying a queued loadout.
4. Verify all eight active Wonders in offline and online matches, including delayed gravity
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
