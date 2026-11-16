# Defensive Wonders and combat feel — October 2026

> **November 2026 specialist-slot update:** The notes below document the
> earlier primary-slot implementation and some superseded values. The current
> authoritative rules are in [Prestige and Wonder Weapons](prestige-wonder-weapons.md).
> Thunderclap and Bulwark are now equipped through the level-one Wonder Weapon
> perk in **slot 4**, not as ordinary primaries. Thunderclap starts at
> zero charges and recharges in 60s per charge, accelerated by 1.1s per
> ordinary kill; total volley damage remains capped at 175 per target.
> Bulwark starts with a broken shield and rebuilds in 55s, accelerated by 2s
> per kill; its F quick-melee performs a 50-damage bash when the shield is up.
> Recharge persists through death and never refills on respawn; queued loadout
> swaps also start empty. Existing Wonder ownership is preserved and legacy
> Wonder-primary presets are removed.


Implemented on `dev`. No database schema change; both new weapons use the existing permanent Wonder unlock entitlement and Primary slot. The catalog now has 51 weapons, including nine Wonders (Bogfather remains disabled).

## Thunderclap (`wonder_cluster`)

An arcing grenade launcher with two charges, 32 seconds to regenerate each charge, and a 1.6-second reduction from ordinary kills. One 120-damage shell bursts into six 75-damage bomblets. The main blast has a 6 m radius and each child a 4.5 m radius, with distance falloff down to 35% at the inside edge. The shell has a 1.4-second fuse; children launch when it bursts and have staggered 0.9–1.15-second fuses. Both stages ricochet from walls, floors, ceilings, stairs, platforms and other solid collision boxes, losing normal and tangential speed at each bounce. A victim can receive at most 240 damage from one complete volley.

`bouncing-projectile.ts` calculates deterministic, swept-radius ballistic paths against solid cover and the floor. It uses face normals, restitution, friction and multiple contacts per step to avoid tunneling through thin walls or clipping corners. `cluster-grenades.ts` uses the normal movement gravity (22.5 m/s²) multiplied by the map gravity: Orbital Nexus uses 60%, independently of operator/Reaper modifiers. Its damage/radius come from the weapon catalog; child damage/radius are derived from that profile. Geometry is sampled at launch, consistent with the existing deterministic throw-path system; moving-object contacts are not continuously re-simulated in flight. Damage occurs at each detonation point and time, never along the projectile's flight segment. Cover blocks damage. The shooter is excluded and team rules follow existing launcher rules. The authoritative server owns paths, timers, charge spending and damage; snapshots carry active volleys for late joiners. Client graphics interpolate collision timestamps, including each turn at a ricochet, without predicting multiplayer damage. Flight and detonation timers continue while the owner is dead. Offline simulation uses the same paths and damage helpers.

## Bulwark + P-9 (`wonder_riot_shield`)

The shield and P-9 occupy one Primary slot and consume one permanent Wonder unlock. A separately selected secondary remains independent. Wonder Weapons have no attachment, skin or challenge tabs; unlocked Wonders allow loadout-slot reticles and account-owned charms (no changes to weapon stats).

- Shield starts at **250 HP**. At hip level it covers the left front; its inner edge points forward (`/` from above), and the first-person angle is aligned with the collision/world-model plane; the normal P-9 can fire from the right hand. The P-9 uses its normal damage, cadence, magazine and reload, with reduced movement speed for the combination.
- Hold the ordinary ADS control (right mouse or touch ADS) to brace the shield across the front. This blocks frontal bullet rays, including the transparent viewport, and prevents P-9 fire. Releasing ADS lowers it. Auto-ADS-on-fire never raises this shield automatically, and bracing does not zoom the camera.
- Back, sides and rays outside the physical rectangle remain vulnerable. Melee, explosions, poison, flame and chained/area energy effects bypass the bullet panel.
- The breaking bullet is absorbed; following bullets hit health. A broken shield disappears, is labeled BROKEN in the HUD, and no longer prevents the P-9 firing. It fully rebuilds after **32 seconds**, accelerated by **2 seconds for every kill** (including Bulwark P-9 kills) even while holstered; a HUD countdown displays the remaining time.
- Holstering removes protection. Swapping, reloading or collecting ammo never instantly repairs the shield; only the rebuild timer or a normal respawn/new match restores durability. Magazine reloads and secondary ammo remain independent of shield health. The shield shows accumulating scratches and visor cracks as durability falls, visible to the carrier and other players; absorbed bullets cause a short subtle blue-grey edge flash without affecting health or the health-damage effect.

`riot-shield.ts` owns the rectangle, orientation, ray test, damage and firing lockout. Both server and offline bullet traces compare the panel against body and cover distances, so it can also stop a bullet traveling toward a combatant behind the carrier. The server derives bracing from its observed ADS/reload/sprint state, owns HP, and includes it in snapshots. No client packet can declare its own durability or cooldown. The server timestamps shield rebuild and replicates HP/deadline in snapshots; offline uses the same shared state rules. `usesWonderCharges()` separates Wonder ownership from ammunition behavior; shield magazines must never enter the Wonder-charge loop.

The shared timer/state helpers in `riot-shield.ts` and visual stages in
`riot-shield-model.ts` have regression tests in `tests/riot-shield-recharge.test.ts`.
Manual checks still need to cover multi-client hit flashes, all-angle panel
scratches, restoring after a kill-accelerated countdown, and swapping while
rebuilding. The retired "restores only on respawn" behavior is no longer valid.

## Combat and audio

Knife and shiv now reach 1.25/1.15 m; baton 1.5 m, machete 1.6 m, axe 1.8 m and hammer 1.9 m. Half-arcs are 40/38/43/46/50/52 degrees respectively. F quick melee and equipped attacks share each weapon's rate, damage, reach, arc, elevation and obstruction rules. Side/rear targets and targets behind walls remain invalid.

Annihilator uses `side_bolt` reload motion and a cartridge beside its receiver. Reclaimer retains its distinct arrow motion along the upper rail.

Each pre-match countdown second plays a short tick and the existing GO cue ends the countdown. Weapon reports have a stronger low-frequency pressure pulse and an added mid-bass harmonic for smaller speakers. Muzzle crack, caliber profiles and suppressor shaping remain separate. ADS never changes sound level, cutoff or bass: camera/viewmodel visibility does not own shot playback. No ADS attenuation existed in the inspected code; firing now also retries audio-context recovery, and regression tests compare scoped/hipfire acoustics directly.

## Bot difficulty

Existing reaction, turning, decision timing, movement speed and aim drift remain difficulty-dependent. Shared tactics now also change movement and weapon use:

| Tier | General / precision detection | Sniper holding distance | Patrol sprint | Combat jumps | Corners / high ground |
| --- | --- | --- | --- | --- | --- |
| Easy | 32 / 38 m | 8 m | No | No | Direct pursuit, hipfire, no tactical strafe, few climbs |
| Normal | 55 / 70 m | 25 m | Beyond 8 m | Occasional, 6.5 s minimum interval | Existing routing, moderate climbing |
| Hard | 80 / 110 m | 40 m | Beyond 6 m | More often, 4.3 s minimum interval | Brief corner sweeps, more climbs |
| Veteran | 100 / 145 m | 55 m | Beyond 5 m | Most often, 3 s minimum interval | Corner sweeps and frequent high-ground routes |

Precision means sniper or DMR; a DMR's holding distance scales similarly. Detection still requires line of sight and firing still respects weapon range, mechanical spread, reaction and reload state. A jump requires ground contact and overhead clearance, and a distant sniper holds its firing position. Corner sweeps briefly slow movement near occluding cover and are rate-limited. Navigation, mode objectives and map collision remain shared across all tiers. Mixed resolves a tier per bot and then uses the corresponding profile. No tier intentionally gains knowledge through walls. Corner scans are currently a visible patrol behavior with a brief slowdown, rather than a full room-clearing planner.

## Verification

Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck`, and `bun run build`. `tests/defense-cluster-tactics.test.ts` exercises panel angles/elevation, actual offline bullet breakage, independent magazines, ballistic collision, delayed blast caps/cover, tactical decisions, ADS acoustic equality and reload placement. Existing melee boundary and catalog tests reflect the new content and intended reach.

Manual acceptance: compare hip/brace/fire/broken/swap/reload/respawn with a second client; fire cluster shells into a wall, floor, group and covered target; inspect late-join effects; compare all bot tiers on the same map/loadout. Audition unsuppressed/suppressed hipfire and ADS on the same audio device, and tune extended-match balance after playtesting.

### Checks performed during this change

- Final checks passed: content validation, all 492 Bun smoke tests, TypeScript and the production build.
- A headless Chromium firing-range session rendered hip/raised Bulwark, fired its P-9, spent and completed a cluster volley, and inspected Annihilator reload placement. The audio context was running and no JavaScript exceptions occurred. A timed browser check produced three countdown ticks and exactly one GO cue.
- A live Socket.IO match with two clients verified a frontal rifle shot changed shield HP 250 → 215 while health stayed 100, raised P-9 fire was rejected, lowered fire was accepted, and swapping did not repair the panel.
- A separate two-client volley test observed seven paths, delayed damage after the main-shell fuse, and rejection of a third shot after spending both charges.
- Actual loadout API calls against an isolated test database returned 403 for unowned Wonders, 200 for each owned Primary selection, and 403 for either Wonder in the Secondary slot.

These checks cover mechanics and rendering. Extended balance, touch feel, listening on real speakers/headphones, and high-bot-count performance still need human playtesting.

### Thunderclap physics and shield-angle regression checks

`tests/cluster-bounce-and-shield-angle.test.ts` covers high-speed thin-wall impacts, floor energy loss, raised platforms, ceilings, two-face corners, decorative versus solid objects, map-dependent gravity, exact offline/server path equality, timestamp-aware visual interpolation, and the non-mirrored first-person shield angle at multiple headings. Ricochets do not reset the fuse. A banked shot still damages only around each final detonation point, with cover checks and the existing charge/ownership rules.

The follow-up tuning was checked in a real two-client match (1.4-second shell fuse, seven paths, stronger lethal close blast, third-shot charge rejection), an Orbital Nexus server session with exact offline/server path equality at 13.5 m/s², and browser rendering with no JavaScript errors. A collision sweep of 32 volleys across all eight maps found no samples embedded in solid geometry. A launch-time spatial index keeps collision selection local and is rebuilt for each volley so mutable map cover is never cached across shots. The broadphase has its own parity regression against the full collision set.

## Explosion rendering budget

Thunderclap and other explosions now use pooled, bounded visual effects and a fixed light count, preventing combat-time lighting shader recompilation. Damage and grenade physics remain unchanged. See [Explosion effect performance](explosion-effects-performance.md) for measurements, budgets and verification.
