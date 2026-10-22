# Vanguard Ops — challenge-based Armory rollout

Target branch: `dev`. This contextual progression pass lives on `feature/condition-based-weapon-mastery`. **Do not merge until schema and UI/build tests pass.**
Scope intentionally excludes Survival combat, Survival achievements, and the
existing daily/weekly quest engine to minimize conflicts with concurrent work.

## Rules

| Item | How it becomes eligible | What spends credits | Ownership |
| --- | --- | --- | --- |
| Weapons | Player level | Existing weapon `unlockCost` | `WeaponUnlock` |
| Attachments | Permanent weapon-specific combat-condition trials (hipfire, ADS, bare weapon, airborne, range, multikill, etc.) | Existing attachment `unlockCost` | `AttachmentUnlock(player,weapon,attachment)` |
| Weapon skins | Permanent contextual trials, with three-part Gold mastery and fallback coverage for newer weapons | Existing skin `unlockCost` | `SkinUnlock(player,weapon,skin)` |
| Operator skins | Lifetime kills, wins, matches or headshots contract | Existing operator `unlockCost` | **New** `PlayerSkinUnlock(player,skin)` |

Default skins remain free. The Armory displays challenge eligibility and
purchase ownership separately. Completed challenges do **not** create paid
unlock rows. Weapons remain the *only* player-level-gated purchases.

Weapon mastery ranks (Recruit / Skilled / Specialist / Veteran / Elite) are
permanent and computed from the same lifetime kill/headshot counters, without
resets or seasonal expiry. The first mastery iteration provides status/title
and a next-rank target, not exclusive statistical buffs.

## Contextual challenge pass (feature branch from `dev`)

The original `kills` and `headshots` counters remain, alongside eight
persisted per-weapon elimination conditions: `bare_kills`,
`fully_equipped_kills`, `ads_kills`, `hipfire_kills`,
`airborne_kills`, `close_range_kills` (10m or less),
`long_range_kills` (35m or more), and `multikill_kills`
(second-or-later elimination within a five-second streak).

Weapon skins use a category-specific mix of conditions. Gold is now a
three-part *AND* challenge; the server checks every step independently, while
the Armory displays each progress counter. Early attachment unlocks never
require `fully_equipped_kills` (avoids prerequisite deadlocks). Weapons
without attachment slots never require a fully equipped kill. Gun Game ignores
bare/full attachment context because its progression chooses unmodified guns.

Persistence: `WeaponProgress.conditionStats` (JSON string) is additive and
defaults to `{}` for existing players. Profile export/import includes the new
counters, merging per-key maxima on import. Existing paid gear stays owned;
unbought cosmetics/attachments may need fresh contextual progression because
historical kills do not contain aiming/configuration/distance information.
Purchases still require both completed challenges and the original credit cost.

Online contextual state currently comes from the client's perspective at the
server-confirmed kill message (victim position from the latest snapshot), so
ADS/airborne and distance attribution may differ slightly from the shot event.
The API constrains each condition to that weapon's reported eliminations, but
the game still uses client-reported match results. Strong anti-cheat would move
condition attribution to the authoritative game server.

## Database migration (required before starting the new server build)

This change **adds** an operator-skin ownership table to the Prisma SQLite
schema. It does not delete existing tables. Back up the existing persistent
SQLite file / export profiles first. Run against the intended development
database (check `DATABASE_URL` before executing):

```bash
bun install --frozen-lockfile
bun run db:push
bun run db:generate
bun run test:smoke
bun run typecheck
bun run build
```

The project historically uses `prisma db push` (there is no existing
Prisma migrations directory). Do **not** use `db:reset` on real profiles.
Any deployment environment needs its own one-time schema update before
serving requests referencing the new model. `postinstall` generates Prisma
client but does not modify the database by itself.

## Compatibility & existing purchases

- All previously purchased attachments retain their `AttachmentUnlock` rows.
- Prior `SkinUnlock` grants, including the old automatically earned skins,
  remain owned and are not charged again.
- Old wildcard skin grants remain usable only where the player also met the
  specific weapon's challenge.
- The previous operator system tracked only the **currently selected** skin.
  That legacy selected operator remains owned and is persisted when changed.
  Previously purchased operators that were deselected *before this migration*
  cannot be reconstructed reliably from the old database (the ownership
  history was not recorded). Avoid claiming otherwise.
- New operator purchases are kept permanently and included in player
  profile JSON export/import. Older exports remain supported; their current
  selected operator is grandfathered.
- **No challenge purchase cost has changed.** All prices come from the
  original `game-data.ts` catalog.

## Manual checks

1. New profile: level 1, no attachment challenge complete. Red Dot should
   show progress rather than a level requirement.
2. Complete a weapon trial: price becomes available at the existing value;
   it remains unequippable until credits have been spent.
3. Buy an attachment for weapon A: weapon B still has its own challenge and
   purchase. Reload and confirm ownership persists.
4. Complete a skin challenge: ensure it is **not** auto-added for free at
   match end; purchase it and equip only on its owned weapon.
5. Verify every paid skin on the newest weapons has a generated challenge
   with meaningful progress.
6. Finish an operator contract, buy the operator, switch away and return;
   confirm no second payment.
7. Load an old profile with purchased gear/skin and verify the purchases
   still work without fresh trials or extra credit deductions.
8. Export and re-import an operator-skin collection; confirm ownership and
   credits are not duplicated by repeat imports.
9. Check weapon rank progress in the Armory, including Gun Game per-weapon
   attribution. Progress remains after closing/reopening the game.
10. Run both offline and online Survival matches as regression tests with the
    other agent's changes after integration. This progression pass intentionally
    has not edited Survival or achievement logic.

## Concurrency and billing

The GitHub Actions workflow remains **manual-only**. No automatic hosted
CI runs were enabled by this feature. Re-check `dev` before merging because
Survival/achievement changes may arrive independently in adjacent modules.
