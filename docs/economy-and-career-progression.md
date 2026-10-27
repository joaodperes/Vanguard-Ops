# Economy, perk saves and Career ranks

Implementation is on `dev`. This change fixes the split between XP-derived
profile levels and stale cached `Player.level` values. Loadout confirmation,
preset capture/equipping and socket match loadouts now derive entitlement from
XP. Match completion persists the final level after quest and achievement XP.
Profile refresh repairs old cached levels. A perk-only update that removes
Well Prepared also returns an ineligible second primary to the starter pistol.

## Faster equipment levels

The curve changes from `25 * (level - 1)^2 * level` to
`15 * (level - 1)^2 * level`: **40% lower requirements**. Match and quest XP
payouts stay the same. Lifetime XP, credits and purchases are retained; old
accounts immediately use the faster curve. For example, the old level-18
threshold of 130,050 XP now reaches level 21.

Equipment levels cap at **36**, the highest current ordinary weapon gate.
The threshold is 661,500 XP. Above that threshold, lifetime XP continues to
increase, while further advancement uses Career ranks. The level helper is
bounded, including for oversized imported values. Content validation rejects
equipment unlock gates above the cap so new content cannot become unreachable. At cap, the menu and Profile
show the Career destination instead of a fictitious next equipment level.

## Credit payouts

All combat/objective constants live in `src/data/catalogs/rewards.json` and
are calculated by `src/lib/match-rewards.ts`; the Guide reads the same values.
Difficulty lists, legacy reports, assists, Survival and objectives share this
path. Partial difficulty lists pay the normal tier for each missing kill.

| Source | Previous CR | New CR |
| --- | ---: | ---: |
| Easy bot | 4 | 1 |
| Normal bot | 6 | 2 |
| Hard bot | 10 | 4 |
| Veteran bot / human | 14 | 5 |
| Legacy report kill | 8 | 3 |
| Headshot bonus | 8 | 2 |
| Assist | 5 | 2 |
| Match win | 50 | 25 |
| Participation | 10 | 5 |
| Multikill | 25 | 8 |
| Flag capture | 30 | 12 |
| Enemy tag / friendly denial | 5 / 2 | 2 / 1 |
| Survival wave | 20 | 8 |
| Standard Survival clear | 6,000 | 1,500 |

Survival kill payouts still use the 0.4 multiplier, and harder-wave reward
multipliers are preserved. Daily, weekly, legacy elite and achievement credit
rewards are **60% lower**; rotating elite variants still multiply their new
base reward by three. Already awarded rewards are not reclaimed.

Example: a 30-normal-bot-kill win with 10 headshots, six assists and three
multikills pays **146 CR instead of 425**, before quests/achievements. XP stays
at 1,097. This provides a concrete balance reference for subsequent playtests.

Changed catalogs:

- `src/data/catalogs/rewards.json`
- `src/data/catalogs/daily-challenges.json`
- `src/data/catalogs/weekly-challenges.json`
- `src/data/catalogs/elite-quests.json`
- `src/data/catalogs/achievements.json`

## Repeatable Career ranks

At equipment level 36, Profile shows an optional Career promotion track:

| Next Career rank | Fresh XP | Credit cost | New title |
| --- | ---: | ---: | --- |
| 1 | 20,000 | 5,000 | Veteran Operative |
| 2 | 25,000 | 7,500 | — |
| 5 | 40,000 | 15,000 | Decorated Vanguard |
| 10 | 65,000 | 27,500 | Vanguard Legend |

For current Career rank `r`, the next goal is `20000 + 5000*r` XP and
`5000 + 2500*r` CR. Promotions preserve equipment, weapon mastery, Wonder
tokens, level and lifetime XP. They confer titles, not combat-stat bonuses.
Titles use the existing Profile selector and match nameplate display.

- Only XP awarded by newly completed matches, including their quest and
  achievement bonuses, fills the meter. A match crossing level 36 contributes
  only its post-cap portion.
- Existing overflow XP starts with **zero Career progress**. The additive
  schema defaults establish this without rewriting player history.
- The current meter caps at its goal. Each promotion resets it to zero;
  overflow never prepays later ranks. Earnings while a meter is full still
  increase lifetime XP and credits.
- `POST /api/profile/career` accepts `{ playerKey, rank }`. The server checks
  saved XP, meter and wallet and performs one conditional atomic update. An
  expected-rank check rejects repeated/stale requests; clients cannot submit
  a credit cost, XP balance or target rank to bypass these checks.
- Exports include Career rank/meter and the active perk, per-slot skins,
  remembered weapon setups and named presets. Old exports remain readable.
  Restoring an older Career rank cannot refill the following rank's meter.
  Once an existing profile has promoted, imports preserve its current wallet
  so old backups cannot refund promotion spending. Restoring into a missing
  profile restores the backup wallet normally.

Career is a recurring credit sink and a fresh-play XP gate. It does not
retroactively add objectives to owned weapons. Future late-game equipment
should receive its own relevant mastery/content objective; do not rely on a
higher level gate or a high credit price alone to make new content meaningful.
Raising the level cap is a separate progression migration, since historic
lifetime XP must not automatically prepay newly introduced content tiers.

## Safe schema update and validation

Two additive `Player` columns are introduced: `careerRank Int @default(0)`
and `careerXp Int @default(0)`. Back up the intended player database, then run
`bun run db:push` and restart the app and socket server. `bun run dev` already
generates the client and applies the safe schema push before serving requests.
Do not use `db:reset` or `--accept-data-loss`.

Automated regression coverage includes curve boundaries, all reward paths,
multiplayer perk gates, the additive update on a legacy SQLite player,
stale-level perk confirmation, named presets, Well Prepared removal, final
reward levels, cap crossing, old overflow, insufficient funds, concurrent
promotion/retry, title entitlement and backup replay/recovery.

Validation against integrated `dev` head
`ce8df292aef92c04a630099f57380c13591d1516`: content validation, all 366 smoke
tests, TypeScript and production build pass. The real SQLite scenarios include
an additive update over legacy player data. Browser checks cover perk
confirmation, named preset saving, Career promotion/reset and title selection.
The existing Profile tabs also scroll within the page on narrow screens.
Run the canonical checks in `docs/dev-test-checklist.md` again for later changes.

Manual balance follow-up: compare several ordinary matches and full Survival
runs, check time to the next desired weapon, and review Career earning/spending
after multiple sessions. Automated payout arithmetic does not establish the
long-term feel of the economy.
