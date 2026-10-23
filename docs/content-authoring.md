# Content authoring handbook (developers and AI agents)

**Status:** feature/json-content-catalogs. This is the content pipeline, NOT an API for untrusted players to upload content. Changes to JSON must be reviewed and deployed as code.

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

`category` must be one of: `assault`, `smg`, `shotgun`, `dmr`, `sniper`, `lmg`, `sidearm`, `melee`. Optional stats include `burst`, `pellets`, `reloadStyle` (only `incremental`), `reloadPerRound`, `falloffEndMultiplier`, `minDamageMultiplier`. Omit `attachments` to use all four slots; specify `[]` for no slots. `baseSightType` must refer to a key in `sight-definitions.json`.

Special mechanics are **not** arbitrary JSON scripts. Only pre-coded `special.kind` (`heat`, `arc`, `bolt`) and `wonder.kind` (`singularity`, `corrosion`, `turret`) are recognized. Introducing a new special behavior needs coordinated changes to `src/lib/weapon-mechanics.ts`, `fps-engine.ts`, `game-server.ts`, client HUD/viewmodel, tests and any progression restrictions. Wonder weapons use Prestige unlock tokens, cannot equip ordinary attachments and do not use paid skin challenges.

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

Add its ID to `category-attachments.json` under the appropriate category and slot, and to `attachment-compatibility.json` for weapons with explicit overrides. A new attachment not listed in the relevant allowlist will not appear just because its definition exists. `weaponCategories` is advisory; the allowlists are applied by the runtime. For new scopes, add a `sight-definitions.json` entry and use `sightType` on a compatible sight attachment.

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

A cosmetic entry does not automatically create an authored unlock challenge: existing skin IDs have explicit/fallback support in `src/lib/armory-challenges.ts`, and new skin IDs require corresponding eligibility logic. Edit that logic and add appropriate tests before publishing a new paid skin. Verify appearance in the weapon viewmodel/world model, in loadouts and under purchased ownership checks.

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

Existing operator contracts are authored/evaluated in `src/lib/armory-challenges.ts`, and persisted purchases use their own ownership model. Confirm every non-default operator receives a contract and can be bought/equipped permanently. New rendering beyond palette fields requires client rendering code.

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

Only recognized metrics can make progress. New metrics require updates to combat event reporting, persistent counters, server evaluation, UI and tests. Daily/weekly pools and achievements are JSON-backed but likewise require supported metrics.

## Validate a content change

From the repository root, after installing dependencies:

```sh
bun install --frozen-lockfile
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```

CI on `feature/json-content-catalogs` checks all four commands. The dedicated map smoke tests run too. Invalid IDs, missing references, malformed numeric fields and blueprints fail `content:validate`. Refer to `tests/content-catalogs.test.ts` and `src/lib/content-validation.ts` when extending the format.

**Compatibility:** preserve all existing IDs/prices unless an explicit balance/migration plan says otherwise. A JSON file is deployment-bundled configuration, not a live database migration. If adding saved profile fields, back up player data and plan a Prisma change independently. Review console/server logs, UI, real matches and FPS before merging.

## Combat catalog update — October 2026

Shotgun shell variants in `attachments.json` use the `shotgunAmmo` field: `slug`, `pellets`, `dragons_breath`, and `beanbag`. These override `EffectiveStats` for offline and server hit calculations. Incendiary hits apply a server-authored 5-second damage-over-time effect and delay ordinary health regeneration.

Team assists are awarded from server-tracked damage: at least 15 damage within 10 seconds before another teammate kills the victim. Each assist grants one personal scoreboard point, 12 XP and 5 CR, as set in `rewards.json`, but does not count toward the team win condition. Single-player bots do not yet award teammate assists.

Historic melee challenge IDs remain stable while authored headshot requirements become achievable close-range melee eliminations. Equipping melee grants a 19% movement speed multiplier.
