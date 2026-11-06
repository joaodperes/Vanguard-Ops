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

## Attachment interaction
- **Penetrator Rounds** changes from -8% to **-4% direct damage**, retaining -20% magazine capacity and +12% recoil. This prevents unintentionally adding a body shot for the VK-12 and Leviathan at close range while remaining an ammunition trade-off. Both still need verification against lined-up targets.
- Existing Heavy Barrel (no damage boost), suppressor (-3% damage), optics and magazine class overrides remain in place.
- Full-range loss is still relevant: a small damage penalty can move falloff breakpoints at 20/40/60m, which are listed by the audit rather than silently masked.

## Reproducing and monitoring
Run:
- bun scripts/audit-weapon-ttk.ts — stock TTK at 0/20/40/60m; headshot-only potential; all legal single attachment breakpoint penalties; legal barrel+magazine pair scan.
- bun test tests/weapon-ttk-regression.test.ts — timing, damage roles, attachment breakpoints and legal loadout sanity.
- bun run content:validate, bun run test:smoke, bun run typecheck, bun run build.

## Follow-up playtests
1. Measure body and mixed head/body kill consistency with moving targets at 5/20/40m, offline and online.
2. Test Reaver, Hydra and Cyclone through 60–144 Hz rendering and real network jitter; server rejects shots that outrun cadence.
3. Compare Kestrel/Wasp/Vector and P-9/Ghost/Bastion/Magnum with typical aim errors and missed shots.
4. Check double headshot potential on Cyclone, semi-auto DMR instant kills, weapon bloom, and aim recovery after firing.
5. Validate Gun Game tier pacing after changing secondary-weapon damage.
