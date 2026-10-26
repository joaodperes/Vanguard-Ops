# Content authoring handbook (developers and AI agents)

**Status:** implemented on `dev` and reviewed for promotion to `main`. This is the content pipeline, NOT an API for untrusted players to upload content. Changes to JSON must be reviewed and deployed as code.

## Source of truth

Static data used by both the browser and multiplayer server is now read through imports in `src/lib/game-data.ts` from the JSON catalogs in `src/data/catalogs/`. Do **not** append new catalog entries in game-data.ts; that file owns exported TypeScript contracts, lookup functions and runtime rules. JSON is loaded at build time; restart the dev server or rebuild after editing.

| Add or modify | Authoritative path | Export/API |
| --- | --- | --- |
| Weapon or Wonder weapon | `src/data/catalogs/weapons.json` | `WEAPONS`, `weaponById` |
| Attachment | `src/data/catalogs/attachments.json` | `ATTACHMENTS` |
| Attachment allowlists | `attachment-compatibility.json` and `category-attachments.json` | `compatibleAttachments` |
| Scope / sight optics | `sight-definitions.json` | `SIGHT_DEFS` |
| Weapon cosmetic | `weapon-skins.json` | `WEAPON_SKINS` |
| Operator appearance | `operator-skins.json` | `PLAYER_SKINS` |
| Authored per-weapon challenge | `weapon-challenges.json` | `WEAPON_CHALLENGES` |
| Daily/weekly goals | `daily-challenges.json`, `weekly-challenges.json` | `DAILY_CHALLENGE_POOL`, `WEEKLY_CHALLENGE_POOL` |
| Lifetime achievements | `achievements.json` | `ACHIEVEMENTS` |
| Map regions and objects | `src/data/map-blueprints.json` | `MAP_BLUEPRINTS` |
| Other declarative content | `ranks.json`, `rewards.json`, `elite-quests.json`, `achievement-colors.json`, `match-modes.json`, `killstreak-callouts.json` | Existing exports |

**Current map limitation:** authored connected walkable regions, features and spawns are JSON-backed. Six underlying template environments (lighting, some buildings/hazards) remain in `src/lib/game-protocol.ts`, `src/lib/map-tactics.ts` and related TS helpers. Creating an entirely new theme or unique interactive map hazard may still need engine code. Map Studio (`/map-editor`) authors blueprint JSON, not arbitrary TypeScript templates. See `docs/map-studio.md`.

## Choose the correct edit shape

Not every JSON catalog is an array of objects. Check the existing top-level shape before editing; **a one-object draft is not a replacement for the entire file**.

| Shape | Source files | Safe authoring operation |
| --- | --- | --- |
| Arrays of entries | `weapons.json`, `attachments.json`, `weapon-skins.json`, `operator-skins.json`, `weapon-challenges.json`, `daily-challenges.json`, `weekly-challenges.json`, `elite-quests.json`, `achievements.json`, `ranks.json`, `killstreak-callouts.json` | Append an entry without deleting or reordering shipped entries; keep thresholds/levels in ascending order where applicable. Ranks and callouts have no `id` field. |
| Objects keyed by identity | `sight-definitions.json`, `attachment-compatibility.json`, `category-attachments.json`, `match-modes.json`, `achievement-colors.json` | Add or deliberately replace one *key* while preserving siblings; only add keys supported by the runtime. |
| Numeric settings object | `rewards.json` | Change an existing named scalar only after balance review; this changes rewards globally, not an individual object. |
| Versioned map dictionary | `src/data/map-blueprints.json` | Add an entry under `maps.<map_id>` without replacing `version`, `units` or other maps. |
| Independent theme file | `src/data/map-themes/<map_id>.json` | Author a whole theme file, then register its static import in `src/lib/map-visuals.ts`. |

Before merging a fragment, compare the existing entry and check every outgoing reference, ownership/unlock path, client/server consumer and relevant test. A schema accepting a field does **not** imply the engine interprets it.

## Universal object rules

1. Use a **unique, permanent `id`** in lower-case snake_case (e.g. `rifle_lynx`). IDs are persisted in player progress, purchases, unlocked equipment, saved loadouts and serialized sessions; **never rename or recycle an existing ID**.
2. Use plain JSON (double quotes, no comments, no trailing commas). Keep numeric values as JSON numbers. Keep arrays in a stable order: loadout, cosmetic and fallback ordering can matter.
3. Do not reference missing weapons, attachment IDs, skin IDs or sight types. Prefer adding data to an existing allowed mechanic instead of inventing a new behavior field.
4. Preserve all existing entries during migrations. A new catalog object does **not** grant ownership to existing players or change their permanent unlocks.
5. Both client and server must agree. Do not add content only to a UI dropdown, or change client data without server rule checks.
6. Content validation is structural, not balance testing or anti-cheat validation. Playtest matches for damage, fire rate, pathing, cosmetics and performance.

## Add a standard weapon

Append an object to `weapons.json`. Required top-level fields: `id`, `name`, `description`, `category`, `unlockLevel`, `unlockCost` and `stats`.

```json
{
  "id": "rifle_lynx",
  "name": "Lynx Rifle",
  "category": "assault",
  "unlockLevel": 20,
  "unlockCost": 1900,
  "description": "Mobile semi-auto precision rifle.",
  "attachments": ["sight", "barrel", "grip", "magazine"],
  "stats": {
    "damage": 38, "fireRate": 5, "magSize": 22, "reloadTime": 2.1,
    "spread": 0.009, "adsSpread": 0.002, "recoil": 0.85,
    "range": 48, "adsTime": 0.25, "moveSpeed": 0.95,
    "auto": false, "headshotMult": 1.5
  }
}
```

`category` must be one of: `assault`, `smg`, `shotgun`, `dmr`, `sniper`, `lmg`, `pistol`, `pdw`, `launcher`, `melee`. Optional stats include `burst`, `pellets`, `reloadStyle` (only `incremental`), `reloadPerRound`, `falloffEndMultiplier`, `minDamageMultiplier`. Omit `attachments` to use all four slots; specify `[]` for no slots. `baseSightType` must refer to a key in `sight-definitions.json`.

Special mechanics are **not** arbitrary JSON scripts. Only pre-coded `special.kind` (`heat`, `arc`, `bolt`) and `wonder.kind` (`singularity`, `corrosion`, `turret`, `smart`, `flame`, `storm`, `sludge`) are recognized. Introducing a new special behavior needs coordinated changes to `src/lib/weapon-mechanics.ts`, `fps-engine.ts`, `game-server.ts`, client HUD/viewmodel, tests and any progression restrictions. Wonder weapons use Prestige unlock tokens, cannot equip ordinary attachments and do not use paid skin challenges. Regular `launcher` weapons require `explosive: { "radius": 3.5 }` (any positive radius) so offline and server damage agree. New launchers intentionally ship with `"attachments": []`; the RL-7 keeps its existing attachment support and an 8m blast. The currently supported `wonder.maxCharges` range is **1–3**; set `stats.magSize` to the same value and `stats.reloadTime` to 0.

**New weapon checklist:** add weapon JSON; choose existing category and appearance behavior; verify slot compatibility; check fallback contextual skin challenges (or author explicit weapon challenges); verify Gun Game inclusion/exclusions and bot selection if relevant; playtest offline and online; validate production build.

## Add an attachment

Append to `attachments.json`:

```json
{
  "id": "grip_rebound",
  "name": "Rebound Grip",
  "slot": "grip",
  "unlockLevel": 12,
  "unlockCost": 650,
  "description": "Reduces vertical recoil.",
  "weaponCategories": ["assault", "smg"],
  "effects": { "recoil": -12 }
}
```

`slot` is one of `sight`, `barrel`, `grip` or `magazine`. Supported `effects`: `damage`, `recoil`, `spread`, `adsSpread`, `adsTime`, `magSize`, `reloadTime`, `moveSpeed` and `range`. They are **percentage modifiers** used by `computeEffectiveStats` (including `magSize`; a value of 20 means +20% rounds, not +20 rounds). A negative `recoil` reduces recoil.

Add its ID to `category-attachments.json` under the appropriate category and slot, and to `attachment-compatibility.json` for weapons with explicit overrides. A new attachment not listed in the relevant allowlist will not appear just because its definition exists. **Per-weapon overrides win per slot**: `attachment-compatibility.json` takes precedence over the category/slot list in `category-attachments.json`, and lists are not merged. When modifying a category list, retain the intended existing options; when an override exists, update that override too. `weaponCategories` is advisory; the allowlists are applied by the runtime. For new scopes, add a `sight-definitions.json` entry and use `sightType` on a compatible sight attachment.

**Progression:** each eligible weapon/attachment pair receives a contextual permanent attachment challenge through `src/lib/armory-challenges.ts`. Challenges make purchases *eligible*, not owned; the original credit purchase is still required. Check compatibility and eligibility on both client and server.

## Add a weapon skin or operator skin

Append to `weapon-skins.json`:

```json
{
  "id": "nightfall",
  "name": "Nightfall",
  "unlockLevel": 15,
  "unlockCost": 900,
  "rarity": "rare",
  "tier": "standard",
  "color": "#25334a",
  "metalness": 0.65,
  "roughness": 0.3,
  "emissive": "#142b55",
  "emissiveIntensity": 0.08
}
```

`rarity` is `common` / `rare` / `epic` / `legendary`; `tier` is `standard` / `rare` / `legendary`; colors use six-digit CSS hex. `metalness` and `roughness` are from 0 to 1. Existing prestige-only skins use special `prestige` values (`cosmic` or `toxic`) with coded rendering rules; **do not assign novel prestige values without implementing them**.

A cosmetic entry does not automatically create an authored unlock challenge: existing skin IDs have explicit/fallback support in `src/lib/armory-challenges.ts`, and new skin IDs require corresponding eligibility logic **for every weapon intended to use them**. An authored challenge for one gun does not establish an unlock path for all other guns. Edit that logic and add appropriate tests before publishing a new paid skin. Verify appearance in the weapon viewmodel/world model, in loadouts and under purchased ownership checks.

Operator example for `operator-skins.json`:

```json
{
  "id": "ember",
  "name": "Ember Operative",
  "unlockLevel": 18,
  "unlockCost": 1100,
  "rarity": "epic",
  "color": "#563c36",
  "accent": "#fa9957"
}
```

Existing operator contracts are authored/evaluated in `src/lib/armory-challenges.ts` via `OPERATOR_CONTRACTS` and `operatorContract()`, and persisted purchases use their own ownership model. Every new non-default operator requires a matching contract with a supported metric; the JSON entry alone cannot be purchased. Confirm every non-default operator receives a contract and can be bought/equipped permanently. New rendering beyond palette fields requires client rendering code.

## Add a map

Use `/map-editor` and export the JSON; replace `src/data/map-blueprints.json` in the repo. Each unique ID maps to a blueprint:

```json
{
  "templateMapId": "compound",
  "name": "FROST YARD",
  "shortName": "FYT",
  "description": "Asymmetric snowbound logistics district.",
  "pace": "balanced",
  "regions": [
    {"x": 0, "z": 0, "w": 140, "d": 110},
    {"x": 82, "z": 20, "w": 60, "d": 80}
  ],
  "features": [
    {"id": "north-deck", "x": 28, "z": -25, "w": 12, "d": 8, "h": 4, "kind": "platform"}
  ],
  "spawns": {
    "ffa": [[-45, 0, 0], [93, 0, 20]],
    "red": [[-45, 0, 0]],
    "blue": [[93, 0, 20]]
  }
}
```

Put this object under `maps.frost_yard` (not a top-level array) in the existing version-1 blueprint file. `regions` are unioned walkable rectangles; `x,z` are centers and `w,d` are **full** extents. `features` may be `cover`, `accent` or `platform`; platforms generate stairs. Spawns are `[x,y,z]`. Give overlapping regions ample passage width; verify stairs do not leave walkable ground. Reuse an existing `templateMapId` for theme and legacy center structures. Map definitions are bundled, not dynamically uploaded to a live server.

## Map color palettes, biomes and prop authoring

Every shipped map has a dedicated JSON file in `src/data/map-themes/`. Edit its palette and landmarks to set a recognisable theme; it is independent of physical blueprint geometry. For a new map-specific file, add a static import to `src/lib/map-visuals.ts`, otherwise the map inherits its template theme. See `docs/map-studio.md` for the complete authoring example, supported scenery kinds, collision rules and route-design checklist.

## Fixed runtime registries and other catalog types

Some valid JSON entries are **not** deployable without TypeScript and gameplay work:

| Requested content | What to check beyond JSON |
| --- | --- |
| New optic type in `sight-definitions.json` | `SightType` and reticle/overlay unions in `src/lib/game-data.ts`, existing rendering support, a compatible sight attachment with `sightType`, attachment allowlists and offline/online ADS behavior. Reusing a known `reticle` is safer than inventing one. |
| New mode key in `match-modes.json` | `GameMode` in `src/lib/game-protocol.ts`, lobby and game rules, client/server protocol and match rewards. Adjusting descriptions or existing mode settings is a separate balance/UI review. |
| New map ID | The blueprint is dynamically included in `MAPS`/`MAP_LIST`, but `MapId` in `src/lib/game-protocol.ts` remains a fixed TypeScript union. Review typed consumers and protocol use for the new ID; add a static theme import if giving it a custom appearance. |
| New achievement or rotating-goal metric | Check the exact metric's tracking and evaluator for **that** pool. A string passing `content:validate` may never advance if the progress pipeline does not support it. |
| New weapon skin ID | `skinChallengesForWeaponAndSkin()`, fallback rules and per-weapon ownership in `src/lib/armory-challenges.ts`. |
| New operator skin ID | `OPERATOR_CONTRACTS` and `operatorContract()` in `src/lib/armory-challenges.ts`. |

Other declarative catalog recipes:

- `ranks.json`: an ordered array of `{ level, name, shortName, color, insignia }`. Do not repeat an existing minimum level; check the profile UI and level progression.
- `killstreak-callouts.json`: an ordered array of `{ threshold, label, color, icon }`; add a new threshold between its neighbors and verify the HUD presentation.
- `achievement-colors.json`: keyed CSS-hex colors for existing tiers (bronze/silver/gold/platinum). A new tier would require engine/UI type support.
- `rewards.json`: named XP/credit economy constants; changing them affects everyone and needs an explicit balance decision.
- `elite-quests.json`: a legacy pool. Confirm that the intended quest is actually surfaced, tracked and awarded before publishing new entries.
- `sight-definitions.json`, `match-modes.json` and the attachment allowlists are keyed objects, **not** arrays. Keep existing definitions intact when replacing individual keys.

## Add or alter challenges

`weapon-challenges.json` entries require unique `id`, existing `weaponId` and `skinId`, positive `goal`, supported `metric`, `title` and `description`. For example:

```json
{
  "id": "wc_lynx_kills_50",
  "weaponId": "rifle_lynx",
  "skinId": "crimson",
  "goal": 50,
  "metric": "kills",
  "title": "Lynx Specialist",
  "description": "Get 50 eliminations with the Lynx Rifle"
}
```

Only recognized metrics can make progress. New metrics require updates to combat event reporting, persistent counters, server evaluation, UI and tests. Daily/weekly pools and achievements are JSON-backed but likewise require supported metrics. Per-weapon challenge metrics are defined by `WeaponChallengeMetric` and evaluated in `src/lib/armory-challenges.ts`; other challenge pools and achievements can have different supported metrics. Verify eligibility and server-side awarding in an actual match, not only the JSON schema.

## Validate a content change

From the repository root, after installing dependencies:

```sh
bun install --frozen-lockfile
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```

The `.github/workflows/dev-validation.yml` workflow runs these checks on pushes to `dev` / `main`, pull requests targeting either branch, and configured feature branches. `tests/content-catalogs.test.ts` also includes **exact array-length assertions**: when adding an entry, review and intentionally update its expected count alongside the other contract tests. A failure in such an assertion may reflect test drift rather than malformed JSON; confirm the actual catalog before changing either. The dedicated map smoke tests run too. Invalid IDs, missing references, malformed numeric fields and blueprints fail `content:validate`. The structural validator does not prove that a new metric has a counter, a new cosmetic can be unlocked, a map has fair traversable paths, or an optic renders and behaves correctly. Standalone draft validators or JSON Schema checks are useful preflight only; they do not substitute for the commands above. Refer to `tests/content-catalogs.test.ts` and `src/lib/content-validation.ts` when extending the format.

**Compatibility:** preserve all existing IDs/prices unless an explicit balance/migration plan says otherwise. A JSON file is deployment-bundled configuration, not a live database migration. If adding saved profile fields, back up player data and plan a Prisma change independently. Review console/server logs, UI, real matches and FPS before merging.

## Combat catalog update — October 2026

Shotgun shell variants in `attachments.json` use the `shotgunAmmo` field: `slug`, `pellets`, `dragons_breath`, and `beanbag`. These override `EffectiveStats` for offline and server hit calculations. Incendiary hits apply a server-authored 5-second damage-over-time effect and delay ordinary health regeneration.

Team assists are awarded from server-tracked damage: at least 15 damage within 10 seconds before another teammate kills the victim. Each assist grants one personal scoreboard point, 12 XP and 5 CR, as set in `rewards.json`, but does not count toward the team win condition. Offline team bot-assisted eliminations have their own contribution accounting; verify scoreboard and XP/credit rewards in both offline and online matches.

Historic melee challenge IDs remain stable while authored headshot requirements become achievable close-range melee eliminations. Equipping melee grants a 19% movement speed multiplier.

## Game art, map textures and external asset safety

Each map's JSON visual theme now contains a `surfaces` recipe for ground, wall, cover, stairs and platforms. Patterns/roughness/tile size are validated and rendered with shared world-space procedural textures; a map is no longer restricted to flat colors. See [Map art direction and vetted references](art-direction-and-materials.md). External stock/game textures are **not** silently imported: confirm license and asset provenance first and bundle only approved files. Preserve the retro art style and always test collision and FPS separately from visuals.

## Secondary weapon families

The normal Secondary slot accepts Pistols (`pistol`), PDWs / Compact SMGs (`pdw`), and Launchers (`launcher`). The existing `smg` category is Primary-only unless Well Prepared grants a second Primary. Each regular category contains a multiple of three guns. Preserve stable weapon IDs and do not mark Wonders as Secondary. Every regular launcher needs a positive `explosive.radius` in world meters; this drives both local and authoritative splash damage. Confirm the new weapon has a procedural 3D receiver and audio profile.

## Plagueheart damage profile

`wonder_corrosion` intentionally has a low immediate splash and a much stronger **6.5-second poison-over-time** effect. Server and offline simulation share `src/lib/corrosion-damage.ts` for both the impact damage and 500ms poison ticks, and new shots refresh the existing poison rather than stacking instant bursts. Other launchers keep their original direct splash. WebGL shadows use nearest-sampled basic shadow maps to avoid unsupported linear depth comparison warnings.

## October 2026 weapon behavior and combat parity

- Pistols: Magnum .50 and Bastion .45 now trade reduced damage, headshot lethality and range for weight; Ghost-18 reloads faster, reaches farther and has no raised top rail. Sentinel-45 rewards precision more than Machine Pistol.
- Launchers: Breach-2 has a brighter, longer-lived illuminated projectile. Swarm-3 is the area-coverage option (9.5m fragment shockwave with a flatter shared blast falloff), distinct from RL-7's high-damage 8m direct-impact rocket. Use `launcherSplashFactor` in both offline and server damage; do not independently hardcode splash or visuals.
- Hit detection: `src/lib/combat-hitboxes.ts` defines shared head, torso, arm and leg volumes for bots and human player avatars, matching humanoid geometry rather than only a head and chest block.
- Automatic fire: prolonged trigger holds accumulate aim bloom offline and server-side; releasing the trigger resets the firing cone. The server owns its own independent variation and does not trust client spread values.
- Melee: Use `src/lib/melee-model.ts` and `src/lib/melee-styles.ts` for all first-person, third-person and F quick-melee views. Knife and shiv have nearly touching range; machete and baton have medium reach, axe and hammer reach farther but have very different power and cadence. Both equipped swings and F use the same grounded, obstacle-aware, server-authoritative hit logic and the equipped weapon's cooldown. Batons briefly interrupt opponents caught reloading. New melee archetypes must be integrated in these shared helpers and their regression tests.

## Wonder Weapon refresh

- Deadlock: ADS acquires up to three exposed enemies after 250ms, with visible magenta overhead target diamonds; tags persist for 4.5 seconds after releasing ADS. Hipfire bullets continue seeking exposed tagged enemies. Normal direct shots remain possible with no live tags. Multiplayer tags are acquired authoritatively from server-observed direction.
- Hellfire: all three fuel-seconds must recharge before ignition. For a three-second active window, holding the trigger sends a continuous 11m damage cone (8 ticks per second). Releasing early forfeits remaining burst time; shots cannot be started at partial charge. No persistent ground fire.
- Stormweaver: one energy charge fires seven spread pellets, each colliding with cover and limb-inclusive hitboxes independently. An enemy hit causes immediate pellet damage plus up to two 9m chain jumps. A pellet that hits no enemy becomes a glowing proximity mine on the ground (450ms arm delay, 2.65m trigger, 8s lifetime), delivering a burst and two more jumps when an eligible enemy approaches. Mines do not require a second shot or linked anchors, cannot trigger through walls, are capped at 12 per owner, and include late-join multiplayer snapshots. Damage is server-authoritative; offline and multiplayer share `src/lib/stormweaver.ts` geometry and targeting. Up to three direct pellets and two chain hits per victim per shot count toward damage to avoid unbounded stacks.
- Bogfather is temporarily disabled in loadouts, Armory and server combat, retaining its catalog ID for existing saves.
- Default Wonder bodies use animated cosmic/toxic patterns with extra energy emitters; physical iron sight notches appear at crosshair height in ADS for unsighted conventional guns.
- Triggering an empty conventional magazine, including semi-auto/burst guns, initiates reload.
