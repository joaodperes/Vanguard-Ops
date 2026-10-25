# Proposal: split secondary weapons into Pistols, PDWs, and Launchers

> **Status:** implemented directly on `dev`: catalog categories, six new guns, launcher projectiles, progression and equipment integration.  
> **Baseline:** `dev` at `5d20b08eef75f63f7d684af4206a22291702b0dc` (2026-10-25).  
> **Decision:** Pistols / PDWs / Launchers, with six new regular weapons; Wonder Weapon work remains separate.

## Recommendation

Keep the existing **Primary / Secondary / Melee** loadout slots. Within **Secondary**, replace the catch-all `sidearm` family with:

- **Pistols** (`pistol`): semi-auto/burst handguns, precision or fast draw.
- **PDWs / Compact SMGs** (`pdw`): machine pistols and ultra-compact automatic backups. Display label can read “Compact SMGs” if preferred. Do **not** conflate these with `smg`, already a Primary category.
- **Launchers** (`launcher`): explosive projectile weapons with scarce ammunition, slow readiness, and spatial control. Prefer “Launchers” to the broad label “Explosives”; grenades/mines are better treated as equipment or perks, not conventional backup guns.

A category answers **what it is**; a slot answers **where it equips**. Keep the Well Prepared perk's special permission for a second primary. Existing weapons retain their stable IDs, unlocks, mastery, and ownership.

## Counts from `dev`

The current catalog contains **36 regular weapons** across Primary, Secondary, and Melee. Wonder Weapons are handled separately and are not part of this proposal. Regular Primary categories already satisfy the multiple-of-three rule and should not be padded with redundant guns.

| Family (regular only) | Current | Proposed | Additional |
| --- | ---: | ---: | ---: |
| Assault Rifles | 6 | 6 | 0 |
| Primary SMGs | 3 | 3 | 0 |
| Shotguns | 3 | 3 | 0 |
| DMRs | 6 | 6 | 0 |
| Snipers | 3 | 3 | 0 |
| LMGs | 3 | 3 | 0 |
| **Pistols** | 4 from old Sidearms | **6** | **2** |
| **PDWs / Compact SMGs** | 1 from old Sidearms | **3** | **2** |
| **Launchers** | 1 from old Sidearms | **3** | **2** |
| Melee | 6 | 6 | 0 |
| **Total regular** | **36** | **42** | **6** |

After adding the six new regular weapons, the regular roster contains **42 weapons**, with each regular weapon family a multiple of three.

### Reclassify shipped IDs without renaming them

| Existing ID | Existing name | New family |
| --- | --- | --- |
| `pistol_side` | Sidearm P-9 | `pistol` |
| `pistol_burst` | Burst Pistol | `pistol` |
| `pistol_magnum` | Magnum .50 | `pistol` |
| `pistol_arc` | Arc Pistol | `pistol` |
| `pistol_machine` | Machine Pistol | `pdw` |
| `launcher_rocket` | RL-7 Rocket Launcher | `launcher` |

**Do not** rename old IDs to match the new category. Player unlocks, saved loadouts, challenge metrics, match histories, and cosmetic ownership refer to IDs. Avoid changes to the separate existing Primary `smg` weapons: Kestrel, Vector and Wasp.

## Six new regular weapons

These are **initial committed values for playtests**, subject to balance revisions. Rates are rounds/second (the existing `WeaponStats.fireRate` unit); damage is base per direct hit or central blast before falloff. New weapons should support familiar attachments where appropriate; launchers should begin with no attachments until restrictions are tested.

| Family | Proposed ID / display name | Damage | Fire rate | Mag | Range | Role / trade-off |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Pistol | `pistol_ghost` — Ghost-18 | 30 | 6.0 | 18 | 26 | Fast-draw, low-recoil, high-capacity close backup; loses per-shot power to P-9 |
| Pistol | `pistol_bastion` — Bastion .45 | 64 | 2.6 | 8 | 42 | Controlled heavy semi-auto between P-9 and Magnum; significant kick |
| PDW | `pdw_mamba` — Mamba-9 | 16 | 14.0 | 24 | 20 | Extreme close-range bullet hose; worse spread/falloff and sustain than Primary SMGs |
| PDW | `pdw_sentinel` — Sentinel-45 | 27 | 7.5 | 18 | 27 | Slower, accurate compact automatic; low magazine, longer reload |
| Launcher | `launcher_breach` — Breach-2 | 105 | 0.85 | 2 | 38 | Short-range room-clear with **3.5 m** blast radius; slow reload and ADS |
| Launcher | `launcher_swarm` — Swarm-3 | 66 | 1.25 | 3 | 45 | Rapid small unguided rockets, **2.25 m** blast radius; low damage per shot |

Reference: `launcher_rocket` currently has **176** base damage, **0.7** shots/s, **1** round and **3.5 s** reload. Its blast radius is hard-coded to **8** in multiplayer. New launchers must not silently inherit that 8 m radius, and must **not** imply grenades with arcs, fuses, sticky effects or homing until those mechanics exist.

Suggested progression after balance review, with normal in-game credit unlocks: Ghost-18 (level 6, 500 CR), Bastion .45 (level 18, 1100 CR), Mamba-9 (level 9, 650 CR), Sentinel-45 (level 25, 1400 CR), Breach-2 (level 27, 2000 CR), Swarm-3 (level 34, 3000 CR). The starter P-9 remains free and equipped by default. No real-money spending.

### Combat identity and fairness

- **Pistols** should prioritize instant readiness, accuracy, and limited magazines.
- **PDWs** should prioritize close-range hipfire and movement, but lose range, sustained damage, and/or handling to the three Primary SMGs. Do not let a no-perk secondary PDW invalidate Well Prepared.
- **Launchers** need strong reload/swap penalties, low ammunition, a small number of distinct blast radii, meaningful cover, and explicit friendly-fire/self-damage design decisions. Test splash against groups, spawn protection, cover, and the server's full-trajectory damage rule.
- Do not introduce homing or physics-bouncing grenades as catalog-only fields. Start with the existing impact-detonation projectile mechanic, made data-driven and reconciled offline vs server.

## Alternative taxonomies (if the preferred split is rejected)

1. **Literal Pistols / SMGs / Explosives:** permit the existing 3 Primary SMGs to equip as secondary (with explicit `allowedSlots` metadata rather than inferring from category), add 1 new pistol (5 → 6) and 2 launchers (1 → 3). Only **3** new regular guns, but it undercuts Well Prepared and creates a Primary/Secondary balance problem. Not recommended unless that perk is redesigned.
2. **Handguns / Launchers:** keep `pistol_machine` with the other four handguns, add 1 new handgun (5 → 6), and add 2 launchers (1 → 3). Only **3** new guns and minimal engine work, but misses the distinct compact-auto fantasy. A viable smaller first release.
3. **Pistols / Machine Pistols / Launchers:** same 6-new-weapon counts as the preferred option, with `machine_pistol` instead of `pdw` as the category key. More literal, less flexible for future compact carbines.

## Implementation checklist

1. **Canonical data and schema.** Edit `src/data/catalogs/weapons.json` (retain every ID), `src/lib/game-data.ts` (`WeaponCategory`, `weaponSlot`, `isPrimaryWeaponCategory`), `src/lib/content-validation.ts`, and documented category enums. Make `isPrimaryWeaponCategory` an **explicit allowlist**, not “anything except sidearm and melee”, or both new secondary families become incorrectly primary. Consider a separate `defaultSlot`/allowed-slot model if more dual-slot families are likely later.
2. **Attachments and mastery.** Split `src/data/catalogs/category-attachments.json` into `pistol`, `pdw`, and `launcher` entries; update specific overrides in `attachment-compatibility.json`, weapon-category restrictions in `attachments.json`, and `armory-challenges.ts` fallbacks. For launchers, start with `attachments: []`. Keep per-weapon unlocks and mastery IDs stable.
3. **Loadout validation.** Update `src/components/screens/Armory.tsx`, `Loadout.tsx`, `src/app/api/loadout/route.ts`, `src/lib/game-server.ts`, and other runtime secondary-slot checks to accept all three secondary categories. The Well Prepared perk must still be needed for true Primary weapons; P-9 fallback remains valid.
4. **Projectile mechanics.** `fps-engine.ts` and `game-server.ts` use explicit `launcher_rocket` checks and hard-coded projectile/splash behavior. Introduce one validated data field or typed explosive profile (e.g. `explosive: { radius: number }`) for all launchers; keep other special-weapon projectile behavior unchanged. Use the same damage/radius/travel rules offline and online, including cover, spawn protection, and server-authoritative impact. Extend projectile silhouettes, audio, HUD and category accent map.
5. **Gun Game.** Update `GUN_GAME_TYPE_PROGRESSION`, the CQC/long-range filters, and `buildGunGameWeapons` to recognize the new categories. Keep the existing **30-tier / final RL-7 then knife** rule initially; making the final launcher random requires updating completion validation and client/server parity deliberately. Ensure stages never duplicate a weapon ID within a cycle.
6. **Bots, rendering, UI, docs.** Audit bot weapon pools, third-person and viewmodel geometry (a tiny PDW must not render as a full-length primary SMG), category dots/HUD, FAQ, screen reader labels and collection totals. `WeaponCategory` is exhaustive in several Record maps, so changing the union needs a compile check.
7. **Regression tests.** Preserve all shipped weapon IDs, and update exact `WEAPONS.length` assertions (currently 43 in `tests/content-catalogs.test.ts`) only when the new JSON exists. Add invariant tests that every regular family count is divisible by 3, that exactly 3 launcher IDs exist, that new secondary classes do not require Well Prepared, and that normal primary guns still do. Exercise launcher splash offline/online, first/third-person models, ammo, unlocks, respawns and Gun Game.

## Phasing / approval gates

**Phase A — taxonomy + pistols + PDWs:** implement the category split, preserve old IDs and add Ghost-18, Bastion .45, Mamba-9, Sentinel-45. The launchers group temporarily has 1 weapon during development; **do not release this phase alone** if the multiple-of-three invariant is required for every shipped category.

**Phase B — launchers + full release:** add Breach-2 and Swarm-3, generalize rocket splash/profile logic and validate all 6/3/3 secondary counts. Hold for manual offline/online combat playtests.

Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck`, and `bun run build` after implementing catalog/code changes, plus weapon-specific combat/play tests. Automated tests are required before release. Manual offline/online balance and feel playtesting still needs to be performed.
