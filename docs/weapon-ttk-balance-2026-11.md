# Weapon TTK and breakpoint balance — November 2026

Implemented on the **dev** branch, after the November attachment-balance pass.

## Scope and methodology
- Unmodified 100-HP damage breakpoints and *ideal first-magazine* time to kill are the calibration baseline; this is **not a claim of live PvP win rate**.
- Shared burstShotIntervalMs governs client fire scheduling, server validation and audit calculations. Precision DMRs use 1.25x intra-burst rate; other burst firearms use 1.65x rather than the previous 3x.
- The nominal rate still determines between-burst recovery. The server accepts 15% timing tolerance for network jitter, while respecting weapon-specific burst intervals.
- Automatic and semi-auto TTK tables assume the nominal 1000 / fireRate shot interval; the frame loop's slightly faster gating and input/frame latency mean real results can differ.
- Headshot-only TTK assumes every hit is a headshot. It is a high-skill ceiling, not an average.
- The audit **excludes shotgun pellet patterns, launchers/splash/travel, melee, Wonders, heat interruptions, reloads and penetration into multiple opponents**. These require separate playtesting/probes.

## Tuning changes

| Weapon | Before | After | Reason |
| --- | --- | --- | --- |
| Reaver BR | 3x intra-burst firing | 1.65x | Reduce near-instant first-burst headshot kills while preserving burst identity |
| Hydra Twin | 3x intra-burst firing | 1.65x | Reduce very fast four-body-shot kills; retains intrinsic body penetration |
| Cyclone DMR | 39 damage / 9 rps / 1.75 headshot / 3x burst | 36 damage / 8 rps / 1.5 headshot / 1.25x burst | Remove easy single-head + body double-tap, preserve precision reward for two heads |
| Vector PDW | 16 damage | 21 damage | Close-range, fast-handling magazine weapon no longer needs seven body hits |
| Wasp PDW | 20 damage | 26 damage | Agile early SMG remains viable but Kestrel shoots faster and reaches further |
| Electron Rifle | 24 damage | 27 damage | Four instead of five body hits, with heat as its sustained-fire constraint |
| Ghost-18 | 30 damage | 35 damage | Quick-response pistol with three-shot body kill |
| Burst Pistol | 24 damage | 35 damage | Full three-shot burst now rewards accuracy; missing extends engagement |
| Bastion .45 | 43 damage, 2.5 rps | 52 damage, 2.9 rps | High-impact low-capacity sidearm, two-shot body kill but no single headshot kill |
| Magnum .50 | 48 damage, 1.5 rps | 56 damage, 2.3 rps | Two-body-shot precision sidearm with penetration, still no single headshot kill |
| Mamba-9 | 16 damage | 19 damage | Fast early PDW, less accurate with a short magazine |
| Sentinel-45 | 27 damage | 35 damage | Three-shot controlled PDW, rewarded for head accuracy |
| Machine Pistol | 19 damage, 11 rps | 22 damage, 13 rps | Late high-rate sidearm with meaningful close-range output |
| Scout Tactical | 51 damage | 53 damage | Suppressor penalty no longer breaks a two-body-shot kill at full damage |
| Executioner DMR | 2.3 rps | 2.8 rps | Less punishing follow-up while retaining empty-magazine-only reload and penetration |
| Leviathan | 34 damage | 35 damage | Preserve three-shot body breakpoint with low-damage Penetrator Rounds |

## 12 November follow-up: magazine, precision and penetration identities

These changes are **additional** to the earlier November TTK pass listed above. All baseline figures below assume an unmodified weapon, 100 HP and a target within full-damage range. A headshot-only kill is a theoretical accuracy ceiling, not expected match performance.

| Weapon | Previous | New | Gameplay intent |
| --- | --- | --- | --- |
| VK-12 Assault | 30-round magazine | 24-round magazine | Reduce body-shot kill potential from 10 to 8 full-health targets |
| Behemoth AR | 20-round magazine | 24-round magazine | Increase body-shot kill potential from 6.7 to 8 |
| Burst Pistol | 21-round magazine | 18-round magazine | Six complete three-round bursts and six theoretical body kills |
| Reaver BR | 1.50x headshot | 1.70x headshot | One headshot plus two body hits in a three-round burst now kills (47.6 + 28 + 28 = 103.6 damage); two headshots alone remain under 100 |
| Whisper DMR | 14-round magazine | 12-round magazine | Six theoretical two-body-shot kills rather than seven; keep accuracy and handling |
| Arc Pistol | 3.2 shots/s | 4 shots/s | Improves three-body-shot ideal TTK from 625ms to 500ms, without changing two-jump chain damage |
| Magnum .50 | 1.75x headshot | 1.80x headshot | One-shot 100.8 HP headshot inside the 31m full-damage range; no increase to body damage |
| Bastion .45 | Cover energy 1.8; second-body retention 24% | Cover energy 2.2; retention 40% | Heavy material/body penetration identity, with a two-shot full-health kill and slower cadence preserved |

The **Reaver** breakpoint requires all three rounds to connect; attachments that lower damage or falloff can remove it. The **Magnum** one-hit headshot is not guaranteed beyond its 31m full-damage range. Bastion's cover energy traverses penetrable materials according to real thickness, but untagged concrete, reinforced structures and protected targets still block it. The shared client/server damage and penetration routines already use these stats, so no separate per-mode rule should be introduced.

The **Scout Tactical** and **Executioner DMR** remain unchanged: Scout rewards fast follow-up and handling, Executioner already offers one-headshot kills and the strongest conventional DMR material penetration. Magnum and Bastion maintain six-round cylinders.

Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck`, `bun run build` and the TTK audit. Manual playtesting should compare mixed-hit Reaver bursts, Magnum falloff near 31m, Bastion shots through aligned enemies and sheet metal, and Arc's chain impact on grouped enemies.

## Attachment interaction
- **Penetrator Rounds** changes from -8% to **-4% direct damage**, retaining -20% magazine capacity and +12% recoil. This prevents unintentionally adding a body shot for the VK-12 and Leviathan at close range while remaining an ammunition trade-off. Both still need verification against lined-up targets.
- Existing Heavy Barrel (no damage boost), suppressor (-3% damage), optics and magazine class overrides remain in place.
- Full-range loss is still relevant: a small damage penalty can move falloff breakpoints at 20/40/60m, which are listed by the audit rather than silently masked.

## Reproducing and monitoring
Run:
- bun scripts/audit-weapon-ttk.ts — stock TTK at 0/20/40/60m; headshot-only potential; all legal single-attachment breakpoint penalties; full enumeration of legal four-slot loadouts and their 0m/40m breakpoint changes. Unreachable targets show n/a.
- bun test tests/weapon-ttk-regression.test.ts — timing, damage roles, attachment breakpoints and legal loadout sanity.
- bun run content:validate, bun run test:smoke, bun run typecheck, bun run build.

## Follow-up playtests
1. Measure body and mixed head/body kill consistency with moving targets at 5/20/40m, offline and online.
2. Test Reaver, Hydra and Cyclone through 60–144 Hz rendering and real network jitter; server rejects shots that outrun cadence.
3. Compare Kestrel/Wasp/Vector and P-9/Ghost/Bastion/Magnum with typical aim errors and missed shots.
4. Check double headshot potential on Cyclone, semi-auto DMR instant kills, weapon bloom, and aim recovery after firing.
5. Validate Gun Game tier pacing after changing secondary-weapon damage.
