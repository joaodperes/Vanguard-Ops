# Ballistics and materials

This document is the single gameplay and authoring reference for conventional
bullet penetration, ballistic material classification and destructible cover.
Runtime behavior is defined by the shared client/server implementation and
canonical map/catalog data; this document describes the contracts those sources
implement.

## Scope and shared rules

Conventional bullets use one **PEN** energy budget for both material cover and
aligned combatants. PEN is a gameplay-scaled rating, not a real-world caliber,
thickness or armor standard. It is separate from render textures, footsteps and
blast/destructible-environment damage. Melee, grenades, bolt projectiles and
wonder-weapon explosions retain their dedicated collision rules. Rockets,
flame/projectile wonders, throwing knives, melee swings, shields, special
electrical weapons and bolts do not use this conventional-bullet budget.

The same hit traversal is used by the authoritative server, offline player and
offline bots. A ray must actually intersect a target; no automatic through-wall
bot tracking is introduced. Bulwark shields and spawn protection stop subsequent
body hits regardless of remaining energy.

## Weapon penetration energy

Each conventional firearm carries an intrinsic penetration rating in
`src/data/catalogs/weapons.json`. Ratings differ between individual weapons;
approximate class baselines are:

| Family | Typical PEN |
| --- | ---: |
| Ordinary pistols | 0.42 (Magnum .50: 1.5) |
| SMGs / PDWs | 0.48–0.70 |
| Shotgun pellets | 0.32 per pellet |
| Standard assault rifles | 1.0–1.3 |
| Heavy battle rifles | 1.7 |
| DMRs | 1.3–2.6 |
| LMGs | 1.55–2.8 |
| Snipers | 2.6–4.0 |
| Annihilator | 4.0 |

Penetrator Rounds add **+0.6 PEN** on eligible weapons and retain their
existing **−4% damage, −20% magazine size and +12% recoil**. The compatible
`mag_slug` shotgun magazine raises penetration energy by **+0.9**, while
reducing the shotgun to one solid projectile. Gun Game uses intrinsic
ammunition stats without loadout attachments. No energy is inferred from a
weapon's raw damage.

## Ballistic material classification

Material is assigned to collision geometry, not inferred from color or surface
texture. A visibly wooden dock foundation or a massive trunk is not the same as
a thin wooden partition. Do not make tall buildings, load-bearing platforms,
thick concrete or objective structures fragile because the renderer uses wood
or metal accents. Conversely, soft cover must not silently become concrete
because an author forgot its tag.

| Material | PEN behavior | Integrity / common use |
| --- | --- | --- |
| `concrete` | Stops all conventional rounds | Permanent; stone, concrete, rocks and structural walls |
| `reinforced` | Stops all conventional rounds | Permanent; fortifications, large machine bodies, loaded shipping containers, supporting structures and massive tree trunks |
| `sheet_metal` | Energy- and thickness-dependent; damage falls after exit | Permanent; metal rails, shutters, nonstructural industrial roofs and thin sheet barriers |
| `thin_wood` | Energy- and thickness-dependent; damage falls after exit | 115 HP; light timber panels, furniture, barrels, market counters and loose logs |
| `glass` | Least resistance; damage falls after exit | 75 HP; explicit glass partitions |
| `light_cover` | Energy- and thickness-dependent; damage falls after exit | 140 HP; crates, equipment screens, fabric awnings and light partitions |

Only rectangular `cover` colliders with a soft material can be pierced.
Boundary solids, platforms, stairs and dedicated environment barriers remain
hard stops. Concrete, reinforced, untagged geometry and structural objects are
not penetrable. All published `cover` features must declare one of the six
material names.

### Where materials are assigned

- **Map JSON features:** Every `kind:"cover"` feature has an explicit material.
  Missing values are rejected by map-document/blueprint validation.
  `platform`, `stairs` and `solid` remain structurally protective and do not
  become penetrable because of an associated decorative texture.
- **Map Studio:** New cover defaults to `reinforced`. Quick-build kits and
  published asset recipes carry authored materials. Older imported user assets
  with missing material tags migrate to `reinforced`; authors can choose a
  different material in the inspector.
- **Legacy combat layouts:** Previously untyped static collider blocks compile
  explicitly as `reinforced`. Generic shapes are not automatically designated
  soft based on proximity or superficial visuals.
- **Generated map props:** The collider factory assigns the appropriate hard
  material or stable destructible ID. Props with multiple authored parts
  (castle interiors and Afterlight furniture) assign material per part.
- **Special environment objects:** Deployable shields, moving platforms,
  destructible gates and changing map events retain their own authoritative
  lifecycle. They are not automatically converted to ballistic soft cover.

### Cross-map authoring decisions

- **Emberhold Castle:** Stone foundations, towers, columns and walls are hard.
  Timber-backed nonstructural roofs, selected interior furniture, stalls, carts,
  targets and barrels are `thin_wood`/`light_cover`. The infirmary's stone
  roof stays protective.
- **Afterlight City (day/night):** Building shells, floors and roof access remain
  structurally hard. Individual interior counters, partitions, beds, shelves
  and other light furniture are destructible, with their full detailed meshes
  hidden on destruction; heavy equipment stays reinforced. Standalone wooden
  benches are breakable. Glazed facade decoration over an intact exterior wall
  is not an open/shoot-through glass partition.
- **Forest Warfare:** Foliage has no bullet-stopping collider; loose fallen logs
  and treetop wooden parapets are destructible. Rocks and giant tree supports
  remain protective.
- **Ridgefall:** Industrial plant shell and loaded steel cargo are reinforced;
  gantry railings are `sheet_metal`; thick paint-booth shells remain
  `reinforced`, and the forge's breakable supply stack is `light_cover`.
- **Whiteout Depot:** Thin metal rooftops and platform canopies use
  `sheet_metal`; thick windbreak structures remain reinforced, while gallery
  crates use `light_cover`. Cargo pallets have actual destructible colliders.
- **Floodgate:** Turbine hall roofing, selected railings and shutters use
  `sheet_metal`; the four yard pallets use `light_cover`; concrete dam
  structures remain hard.
- **Orbital Nexus:** Glass baffles, metal reactor guards/vent covers and
  breakable cargo are explicitly typed; station structure remains reinforced.
- **Blacksite, Shipyard and Compound:** Light benches, market stalls and crates
  use soft materials; generators, loaded containers, ship hulls and rock ruins
  stay protective. Stone ruins and temples use open-pillar collision rather
  than an invisible bulletproof block over the empty interior.

## Ray traversal, energy cost and damage retention

A bullet spends one remaining energy budget as it encounters bodies and cover
in the actual order along its ray. Thicker material and more oblique angles cost
more energy.

For each real ray–box intersection:

1. Intersect the AABB to find both entry and exit points. Actual path length,
   not just wall thickness, determines cost, so oblique shots cost more.
2. Subtract `pathLength × materialResistance` from remaining weapon energy.
   A surface that exhausts the budget stops the shot at its entry.
3. On successful traversal, multiply damage by the material's retention factor,
   including the additional loss based on energy spent. Existing range falloff
   still applies at target distance. Successive material and body multipliers
   compound.
4. A shot stops after at most **two cover surfaces and three combatants**, even
   if energy remains. Energy and the weapon's body-target cap may end the shot
   sooner. A non-penetrable object stops it immediately.

| Material | PEN cost per world unit | Base damage retained on exit | Breakable |
| --- | ---: | ---: | --- |
| Glass | 0.22 | 87% | Yes |
| Light cover | 0.58 | 70% | Yes |
| Thin wood | 0.72 | 72% | Yes |
| Sheet metal | 1.42 | 60% | No |
| Concrete, reinforced, untagged or structural | Not penetrable | 0% | No |

The actual material exit damage is
`baseRetention × max(0.55, 1 − 0.08 × materialCost)`. Each successful body
exit consumes **0.85 PEN** and reduces damage to a subsequent target. The first
body takes normal applicable damage. Weapon-specific body-retention profiles
preserve specialist weapon identity, while ordinary ammo derives a retention
coefficient from its energy rating.

An enemy struck before an obstacle spends the round's remaining energy before
that obstacle is evaluated. This prevents a shot from travelling through a
body and then piercing a wall it could not afford. The first body's hit uses
normal applicable damage. Body-penetration `maxTargets` and retention settings
are distinct weapon properties, but share the same remaining PEN budget with
material traversal.

## Cover damage and destruction

Penetration energy and cover integrity are separate systems. Damage uses the
weapon's effective bullet damage, including magazine modifiers. Glass has
75 integrity with 1.3× damage, thin wood 115 with 1×, and light cover 140 with
0.85×. These cover-damage coefficients are independent of bullet penetration:
a pistol may eventually break glass despite being unable to shoot through it.
Sheet metal has no integrity and never disappears.

Conventional shots on tagged cover generate material-specific effects,
including non-penetrating shots. Glass displays persistent spider-web cracking
and ultimately shatters into light fragments. Thin wood sheds splinters, and
light cover sheds dust/debris; both can be destroyed by sustained gunfire.
Sheet metal shows permanent bullet marks and short spark bursts but cannot be
destroyed. Concrete, reinforced, untagged geometry and dedicated destructible
environment barriers retain their existing collision/damage behavior.

When a panel breaks, its authored cover collider is removed from the current
match's map. It ceases to block movement, conventional shots, bot line of sight
and physics-based navigation. The projectile that depleted the last integrity
point still collides with the pre-destruction geometry; only subsequent shots
can pass through the gap. Existing concrete and reinforced geometry is never
deleted. Both server and offline clients modify only their per-match map copies.

Online damage and destruction are server-authoritative. The server broadcasts
`materialCoverImpact` with world-space contact, material, integrity and
destruction; periodic snapshots include `materialCoverHp` and
`materialCoverDestroyed` so a late joiner or missed effect packet does not
restore broken cover. Local offline play and offline bots call the same rules.
Impacts use capped decals (up to six per panel) and short-lived particles
(maximum 96), rather than expensive area-explosion effects.

## Author checklist

For any new combat-visible surface:

1. Decide whether it is structural or nonstructural.
2. Assign a material to its collision geometry, not its render mesh.
3. For breakable cover, provide a stable unique ballistic ID shared by server
   and client.
4. Ensure destruction removes both collision and every visible detail belonging
   to that collider.
5. Verify late join, offline play, blast behavior and single-bullet penetration.

Never tag a thick `platform` as a soft panel just to simulate a wooden texture.

## Firing Range checks

The **Armory → Firing Range** is a private offline map. The main four stationary
targets and three moving targets remain in the central lane. From the central
spawn, move forward to the two side-wall doorways at the -27 Z line. Turn left
for Glass and Thin Wood; turn right for Light Cover, Sheet Metal and a Concrete
control. Each station has a label, floor shooting-line marker and respawning
dummy behind the chest-height panel. Aim at the dummy's torso through the panel,
not the head visible above it.

Suggested comparisons:

1. Fire a conventional pistol or unmodified assault rifle into glass. Initial
   bullets should crack the pane without hitting the dummy; continue until the
   pane shatters and subsequent shots hit the dummy.
2. Leave and re-enter the range to restore fresh panels. Equip an LMG, heavy
   DMR or sniper and shoot the same glass/wood cover. Qualifying shots should
   register reduced damage against the dummy before the panel breaks.
3. Compare a compatible assault rifle with and without Penetrator Rounds. The
   magazine adds +0.6 cover energy. Straight-on hits may penetrate glass,
   thin wood and light-cover samples, whereas the thicker sheet-metal panel
   requires a stronger weapon.
4. Test sheet metal for sparks and marks without total destruction. Test
   concrete with the strongest sniper; it stays bulletproof.
5. After glass/wood/light cover breaks, walk or shoot through the opening to
   verify collision removal. Restarting the range restores cover.

Also compare a standard pistol, the VK-12 with and without Penetrator Rounds,
a slug shotgun and the Annihilator. Shoot the torso through the sample, not the
head visible above it. Check material thickness, mixed body/cover paths, damage
retention, movement collision after destruction, lag-free effects and
online server/client agreement. The range demos run locally; the main-map
multiplayer server remains authoritative for ballistic cover destruction.

## Implementation references

- Penetration energy and traversal: `src/lib/cover-penetration.ts`
- Material integrity, blast attenuation and server-approved removal:
  `src/lib/material-cover-damage.ts`
- Body penetration: `src/lib/body-penetration.ts`
- Effective weapon stats: `src/lib/game-data.ts`
- Material assignment and collider compilation: Map Studio and shared map
  compilation in `src/lib/map-blueprints.ts`

## Validation

Run `bun run content:validate` and `bun run typecheck`. Use the Firing Range
to compare material thickness, weapon penetration budgets, mixed body/cover
paths and damage retention. Repeat affected scenarios online to verify
server/client agreement and confirm destroyed cover updates collision for
subsequent shots.
