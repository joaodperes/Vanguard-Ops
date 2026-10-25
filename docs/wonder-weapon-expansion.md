# Wonder Weapon expansion — design proposals and first playable batch

**Branch:** `feature/wonder-weapon-expansion` (branched from `dev`).  
**Intent:** Add meaningful Prestige Arsenal choices without breaking its one-token-per-Wonder economy. Preserve existing IDs, token ownership, map collision and client/server damage parity.

## Implemented: three new choices

These are **new weapon IDs using existing, already implemented Wonder mechanics**, not claims of brand-new projectile status effects. Every weapon costs one permanent Prestige token, uses the primary slot, has no attachments/reserve ammunition or manual reload, and is excluded from Gun Game's ordinary weapon ladder.

| Weapon (catalog ID) | Fantasy and combat role | Effect kind | Base damage | Radius | Charges | Recharge | Bonus per ordinary kill |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| **Rift Needle** (`wonder_rift_needle`) | Needle-sized gravity pin: gather a small pack and annihilate targets close to the center | `singularity` | 305 | 6m | 1 | 37s | -1.5s |
| **Miasma Bloom** (`wonder_miasma_bloom`) | Wide, low-damage spore cloud: tag dispersed groups and let the existing corrosion damage-over-time do the work | `corrosion` | 45 | 13m | 2 | 46s / charge | -2.0s |
| **Caustic Javelin** (`wonder_caustic_javelin`) | Precision corrosive spear: hard initial impact, small splash, quick reset | `corrosion` | 118 | 4m | 1 | 30s | -1.2s |

These are deliberate **trade-offs**, not straight upgrades: Rift Needle is tighter than Event Horizon; Miasma Bloom covers a larger area than Plagueheart but has much lower initial damage; Caustic Javelin deals a sharper close hit but demands precision. Singularity uses the existing pull/delayed-detonation behavior; corrosion uses the existing 6.5-second poison application to surviving splash targets. The same splash falloff, cover rules and ordinary-kill recharge acceleration are already used for these mechanic families.

**Integration changes:** Gravity wells retain the weapon ID that created them so offline and online eliminations and per-weapon stats are credited correctly; client projectile spin follows the gravity kind rather than a single hard-coded ID. Each variant has its own procedural first-person/world model silhouette. Armory purchases and loadout selection are data-driven and already recognize `wonder` entries.

## Backlog: truly new mechanic ideas (not implemented)

| Concept | Player fantasy | Proposed primary mechanic | Balance / engineering questions |
| --- | --- | --- | --- |
| **Chrono Anchor** | A time-folding grenade | Short-lived field slowing hostile movement and incoming projectiles, but not friendly fire | Server-authoritative movement/projectile effects, latency compensation and immunity on spawn |
| **Prism Choir** | Crystal weapon that sings in ricochets | Beam forks into three reflected paths after striking cover, with diminishing damage | Deterministic bounce geometry, no shots through walls, visual projectile parity and cap on bounces |
| **Thunder Vane** | Portable lightning conductor | Marks one target and arcs through two additional enemies in line of sight | Reuse `nextArcTarget` pattern while implementing a new Wonder-kind charge and damage protocol |
| **Phase Loom** | Temporary hard-light geometry | Deploy cover shield that blocks bullets from both teams and expires after a short duration | Dynamic collision/line-of-sight updates, griefing, visibility and server ownership |
| **Echo Reaper** | Sound-warped marksman rifle | Echo of the previous shot strikes the same area after a telegraphed delay | Pending attack lifetime on death/disconnect, duplicate-hit prevention and attribution |
| **Gravimetric Relay** | Team crowd-control trap | Two linked nodes pull hostiles toward their shared midpoint until one is destroyed | Independent node placement, target prediction, shared cooldown and map exploit prevention |

Do not add these concepts to `weapons.json` until the indicated effects are implemented **in both** `fps-engine.ts` and `game-server.ts`, registered in the Wonder type/schema, validated for cooldowns and ownership, and tested in an actual match. Merely adding a new `wonder.kind` string would produce a nonfunctional item.

## Verification and playtest gate

1. Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck` and `bun run build` in a real checkout with dependencies. Confirm exact assertions for 42 total weapons and six Wonders.
2. Earn one token by completing weapon mastery; verify a fresh player cannot equip a locked new Wonder, a purchase spends exactly one token, and the purchased weapon remains owned through restart/export/import.
3. Test the three new weapons **offline and in an online room**, paying attention to matching splash radii/damage, friendly-fire rules, cover, poison, recharge after death/holster, and ordinary-kill bonus only.
4. For Rift Needle, confirm a delayed gravity detonation attributes kills to `wonder_rift_needle` (not Event Horizon) in both server and offline stats; verify spectators and joining clients see the vortex.
5. For Miasma Bloom, verify enemies at the far edge receive the lower splash and poison effect and that the wider radius does not cause unusual accidental kills through cover.
6. For Caustic Javelin, verify its 4m radius feels sufficiently precise, quick recharge isn't dominant in PvP, and it still loses charges when missing.
7. Check equipped silhouettes, skin colors, HUD charge timers, Armory token purchase cards, Survival wave balance, Gun Game exclusion and low-end mobile performance.

**Validation status:** Changes were authored with GitHub repository tools. The native Bun/Next test suite, typecheck, build and real gameplay checks have **not** been executed in this environment; review and test before merging into `dev`.
