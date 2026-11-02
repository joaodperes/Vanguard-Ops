# Whiteout Depot

`whiteout_depot` is the sixth CTF choice, completing two rows of three in the desktop map picker. A snowbound freight depot provides a smaller alternative to Floodgate: a 256×148 bounding footprint, normal gravity, 3v3/5v5/7v7 teams and twelve distinct rear spawn positions per side. It also supports TDM and Kill Confirmed, consistent with the other purpose-built CTF maps. FFA, Gun Game and Survival remain unavailable.

## Routes

- **North platform:** boxcars sit beside two rails under a platform canopy. Windbreaks and freight stacks interrupt the tracks and platform sightlines, with room to weave around each obstacle.
- **Freight sheds:** open-ended, roofed halls have side-door connections and staggered cargo stacks. Stair-accessible signal decks offer local elevation without a view across the whole map.
- **Service gallery:** the sheltered southern route has several exits to the sheds. A 180 HP maintenance hatch at the center opens a direct passage when breached; the surrounding routes remain traversable with it intact.

West/east bases mirror each other. Ground flags are at X=±92, delivery rings at X=±108, both at Z=0. Spawns occupy X=±112/±122 under dispatch canopies, with independent side exits and forward screens. Base signs and warm lamps identify the dispatch rooms. Snow surfaces, blue-grey steelwork and amber platform signs provide the theme without particle effects or new lights per frame.

## Authoring and validation

Geometry/spawns/hatch: `src/data/map-blueprints.json`. Theme: `src/data/map-themes/whiteout_depot.json`. Objectives and CTF spawn selection: `src/data/ctf-layouts.json`, using the same generic layout contract as Verdant/Ridgefall. The map has empty legacy cover, spawn and environment arrays, so no unrelated template objects are inherited. Theme props use existing primitives; all gameplay solids come from shared geometry.

Run `bun test tests/whiteout-depot.test.ts` for unique safe spawn batches, objective clearance, full pickup/delivery routes for both sides, three independent ground routes with the hatch intact, horizontal sightline checks and per-room hatch isolation. Horizontal samples are not proof against every diagonal or elevated sniper angle. Run the full content/smoke/typecheck/build gates before publishing.

Human playtests are still required at 3v3, 5v5 and 7v7: compare return times from both sides, base camping, deck usefulness, the intact/breached gallery, visibility against snow, KC tag retrieval and frame rate. Automated routing proves reachability rather than balance.
