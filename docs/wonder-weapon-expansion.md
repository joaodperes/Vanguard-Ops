# Wonder Weapon breakthrough pass

**Status:** Four unique Wonder abilities have been implemented on `dev`; this is their mechanics reference. The three earlier derivative gravity/corrosion proposals were superseded. Validate the merge candidate before release.

## New playable prototypes

| Weapon | Wonder kind | Actual new behavior | Charge economy |
| --- | --- | --- | --- |
| **Deadlock** (`wonder_deadlock`) | `smart` | Aim down sights for at least 250ms to acquire an exposed enemy within a narrow 15° forward cone. A guided shot is redirected to that target; cover denies the lock. Hipfire falls back to normal ballistic firing. | 2 charges, 29s each |
| **Hellfire** (`wonder_hellfire`) | `flame` | Close-range widening flame cone that damages enemies directly and lays three short-lived burning patches along the firing lane. | 2 fuel bursts, 28s each |
| **Stormweaver** (`wonder_stormweaver`) | `storm` | Electrical discharge hits, then chains across up to four nearby visible enemies. Every shot plants a 10-second conductive anchor. A follow-up shot within 24m of the anchor energizes the route between them and shocks anyone intersecting it. | 2 shots, 31s each |
| **Bogfather** (`wonder_bogfather`) | `sludge` | Launches a sticky shell that creates an 8.5-second, 5m-radius sludge pool. Hostiles inside take damage every half-second and move at 46% normal speed. | 2 shots, 35s each |

These are not skins or clones of `singularity`/`corrosion`. Each type has new server-owned hit/status rules, offline combat equivalents, network FX, and a procedural weapon silhouette. All use one Prestige token, equip in the Primary slot, are attachment-free and cannot manually reload; the existing Wonder charge rules still apply. Gun Game excludes them.

### Caveats and follow-up engineering

Hellfire currently fires discrete recharge-limited **fuel bursts**, not an unrestricted hold-trigger stream; implementing continuously fueled flame would require a new server channeling protocol and separate heat/fuel economy. Deadlock uses a server-validated aim cone and continuous ADS timing rather than a persistent target-mark UI, so it can lock one valid target per trigger pull. Bogfather's online movement clamp limits clients crossing an active field; additional latency testing is required on high-ping networks. The network visual fields use simple translucent discs that can be improved with particles later.

## Bigger ideas — still not implemented

1. **Riftmaker** — linked projectile-only portals; needs safe position/orientation transforms and trusted multi-hop hits.
2. **Secondhand** — target rewind; needs authoritative per-player position history and collision-safe playback.
3. **Payback** — kinetic collector; needs directional damage absorption and capped stored-energy accounting.
4. **Polarity** — coupled magnetic darts; needs validated target pairs and anti-clipping physics.
5. **Afterimage** — holographic shot-replay ghost; needs server-validated recording/playback of historical shots.
6. **Resonance** — reflecting sonic waves; needs deterministic wall reflection and bounce budgeting.

## Verification

Mandatory CI: `bun run content:validate`, `bun run test:smoke`, `bun run typecheck`, `bun run build`. Test offline and online separately, including teams, cover, death/respawn, overlapping fields, late-join snapshots, movement validation and charge persistence. Automated unit tests cover targeting, flame geometry, conductive segments, sludge movement/team rules and primary-slot catalog requirements. **Human gameplay testing is not replaced by green CI**.

See also [Prestige and Wonder Weapons](prestige-wonder-weapons.md).
