# Ballistic material authoring standard

All Vanguard Ops map geometry uses **ballistic materials**, independently of its render
texture. This is shared by offline hitscan, authoritative multiplayer, bots,
explosions and destroyed-cover replication.

## Material behavior

| Material | Penetration | Integrity | Common use |
| --- | --- | --- | --- |
| `concrete` | Stops all conventional rounds | Permanent | Stone, concrete, rocks, structural walls |
| `reinforced` | Stops all conventional rounds | Permanent | Fortifications, large machine bodies, loaded shipping containers, supporting structures, massive tree trunks |
| `sheet_metal` | Energy- and thickness-dependent, damage falls after exit | Permanent | Metal rails, shutters, nonstructural industrial roofs, thin sheet barriers |
| `thin_wood` | Energy- and thickness-dependent, damage falls after exit | 115 HP | Light timber panels, furniture, barrels, market counters, loose logs |
| `glass` | Least resistance, damage falls after exit | 75 HP | Explicit glass partitions |
| `light_cover` | Energy- and thickness-dependent, damage falls after exit | 140 HP | Crates, equipment screens, fabric awnings, light partitions |

See `src/lib/cover-penetration.ts` for penetration costs, cumulative energy
and the maximum of two cover crossings per round; see
`src/lib/material-cover-damage.ts` for integrity, blast attenuation,
and server-approved removal. The shot that breaks a panel still collides with its
pre-shot state. Material-specific durability is separate from the weapon's body
damage scaling.

**Material is not inferred from color or surface texture.** A visibly wooden
dock foundation or a massive trunk is not the same as a thin wooden partition.
Do not turn tall buildings, load-bearing platforms, thick concrete or objective
structures into fragile cover simply because the renderer uses wood or metal
accents. Conversely, a soft cover object must not silently become concrete when
an author forgets its tag.

## Where materials are assigned

- **Map JSON features:** Every `kind:"cover"` feature must have one of the six
  material names. Missing values are rejected by map-document/blueprint validation.
  `platform`, `stairs` and `solid` remain structurally protective and do
  not acquire penetrability from an associated decorative texture.
- **Map Studio:** New cover defaults to `reinforced`. Quick-build kits and
  published asset recipes carry authored materials. Older imported user assets
  with missing values migrate to `reinforced`; authors can choose a different
  material in the inspector.
- **Legacy combat layouts:** Previously untyped static collider blocks now
  explicitly compile as `reinforced`. These generic shapes must not be
  automatically designated soft based on proximity or superficial visuals.
- **Generated map props:** The collider factory assigns the appropriate hard
  material or stable destructible ID. Props with multiple authored parts
  (castle interiors and Afterlight furniture) assign material per part.
- **Special environment objects:** Deployable shields, moving platforms,
  destructible gates and changing map events retain their own authoritative
  lifecycle. They are not automatically converted to ballistic soft cover.

## Map-specific decisions

- **Emberhold Castle:** Stone foundations, towers, columns and walls are hard.
  Timber-backed nonstructural roofs, selected interior furniture, stalls, carts,
  targets and barrels are `thin_wood`/`light_cover`. The infirmary's stone
  roof stays protective.
- **Afterlight City (day/night):** Building shells, floors and roof access
  remain structurally hard. Individual interior counters, partitions, beds,
  shelves and other light furniture are destructible, with their full detailed
  meshes hidden on destruction; heavy equipment stays reinforced. Standalone
  wooden benches are breakable. Glazed facade *decoration over an intact
  exterior wall* is not an open/shoot-through glass partition.
- **Forest Warfare:** Foliage has no bullet-stopping collider; loose fallen logs
  and treetop wooden parapets are destructible. Rocks and giant tree supports
  remain protective.
- **Ridgefall:** Industrial plant shell and loaded steel cargo are reinforced;
  gantry railings are `sheet_metal`; thick paint-booth shells remain
  `reinforced`, and the forge's
  breakable supply stack is `light_cover`.
- **Whiteout Depot:** Thin metal rooftops and platform canopies use
  `sheet_metal`; thick windbreak structures remain reinforced, while gallery
  crates use `light_cover`. Previously visual-only
  cargo pallets receive actual destructible colliders.
- **Floodgate:** Turbine hall roofing, selected railings and shutters use
  `sheet_metal`; the four yard pallets use `light_cover`; concrete dam
  structures remain hard.
- **Orbital Nexus:** Glass baffles, metal reactor guards/vent covers and
  breakable cargo are explicitly typed; station structure remains reinforced.
- **Blacksite, Shipyard and Compound:** Light benches/market stalls/crates use
  their soft materials; generators, loaded containers, ship hulls and rock
  ruins stay protective. Stone ruins and temples now use *open pillar* collision,
  rather than an invisible bulletproof block over the empty interior.

## Author checklist and tests

For any new combat-visible surface: (1) decide structural vs nonstructural;
(2) assign a material to its collision geometry, not the render mesh; (3) for
breakable cover provide a stable **unique** ballistic ID, shared by server and
client; (4) ensure destruction removes both the collision and every visible
detail belonging to that collider; (5) verify late join, offline, blast and
single-bullet penetration. Never tag a thick `platform` as a soft panel just
to simulate a wooden texture.

Run `bun test tests/map-material-standards.test.ts tests/material-penetration.test.ts tests/castle-ballistics.test.ts`
and `bun run typecheck`. The tests include map-wide classification, unique
identities, roof penetration, Whiteout pallet collision, Forest foliage, open
ruin sightlines and Map Studio defaults/import migrations.
