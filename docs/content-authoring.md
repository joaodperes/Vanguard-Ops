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
| Map regions and objects | `src/data/maps/<mapId>.json` | `MAP_BLUEPRINTS` |
| Other declarative content | `ranks.json`, `rewards.json`, `elite-quests.json`, `achievement-colors.json`, `match-modes.json`, `killstreak-callouts.json` | Existing exports |

**Current map limitation:** authored connected walkable regions, features and spawns are JSON-backed. Built-in template environments (lighting, some buildings/hazards) remain in `src/lib/game-protocol.ts`, `src/lib/map-tactics.ts` and related TS helpers. Creating an entirely new theme or unique interactive map hazard may still need engine code. Map Studio (`/map-editor`) authors blueprint JSON, not arbitrary TypeScript templates. See `docs/map-studio.md`.

## Shared theme/prop validation

The canonical map theme and prop contract is `src/lib/map-theme-contract.ts`.
Its Zod schema is used by the map importer and published-map validation, and
`src/data/schemas/map-theme.schema.json` is a **generated** compatibility
artifact (`bun run schema:map-theme`). `bun run content:validate` fails if the
generated schema drifts from the contract. Add new prop kinds and fields once
in the contract, implement their rendering and collision behaviour, and add
spawn and navigation tests. Do not duplicate whitelists in validators.

## Choose the correct edit shape

Not every JSON catalog is an array of objects. Check the existing top-level shape before editing; **a one-object draft is not a replacement for the entire file**.

| Shape | Source files | Safe authoring operation |
| --- | --- | --- |
| Arrays of entries | `weapons.json`, `attachments.json`, `weapon-skins.json`, `operator-skins.json`, `weapon-challenges.json`, `daily-challenges.json`, `weekly-challenges.json`, `elite-quests.json`, `achievements.json`, `ranks.json`, `killstreak-callouts.json` | Append an entry without deleting or reordering shipped entries; keep thresholds/levels in ascending order where applicable. Ranks and callouts have no `id` field. |
| Objects keyed by identity | `sight-definitions.json`, `attachment-compatibility.json`, `category-attachments.json`, `match-modes.json`, `achievement-colors.json` | Add or deliberately replace one *key* while preserving siblings; only add keys supported by the runtime. |
| Numeric settings object | `rewards.json` | Change an existing named scalar only after balance review; this changes rewards globally, not an individual object. |
| Versioned map dictionary | `src/data/maps/<mapId>.json` | Add an entry under `maps.<map_id>` without replacing `version`, `units` or other maps. |
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

`category` must be one of: `assault`, `smg`, `shotgun`, `dmr`, `sniper`, `lmg`, `pistol`, `pdw`, `launcher`, `melee`. Optional stats include `burst`, `pellets`, `reloadStyle` (only `incremental`), `reloadPerRound`, `reloadOnlyWhenEmpty` (en-bloc reloads, only when the magazine is empty), `falloffEndMultiplier`, `minDamageMultiplier`. Omit `attachments` to use all four slots; specify `[]` for no slots. `baseSightType` must refer to a key in `sight-definitions.json`.

Special mechanics are **not** arbitrary JSON scripts. Only pre-coded `special.kind` (`heat`, `arc`, `bolt`) and `wonder.kind` (`singularity`, `corrosion`, `turret`, `smart`, `flame`, `storm`, `sludge`, `cluster`, `shield`) are recognized. Introducing a new special behavior needs coordinated changes to `src/lib/weapon-mechanics.ts`, `fps-engine.ts`, `game-server.ts`, client HUD/viewmodel, tests and any progression restrictions. Wonder weapons use Prestige unlock tokens, cannot equip ordinary attachments and do not use paid skin challenges. Regular `launcher` weapons require `explosive: { "radius": 3.5 }` (any positive radius) so offline and server damage agree. New launchers intentionally ship with `"attachments": []`; the RL-7 keeps its existing attachment support and an 8m blast. The currently supported `wonder.maxCharges` range is **1–8**; charge-based Wonders set `stats.magSize` to the same value and `stats.reloadTime` to 0. Shield Wonders keep an ordinary P-9 magazine/reload and are excluded by `usesWonderCharges()`. See [Defensive Wonders and bot tactics](wonder-defense-and-bot-tactics.md).

**Blast versus material cover:** Rockets, frag grenades, proximity mines and Explonando death charges now damage editor-authored panels tagged `glass`, `thin_wood` or `light_cover` and carrying a stable `ballisticId`. Blast range is measured to the nearest panel surface, not the centre. Cover integrity damage has an ordnance-specific multiplier and radius independent of damage to players: the RL-7 and nearby frag grenades break even light cover in a single detonation, while Swarm-3 micro-rockets take three point-blank impacts (more toward the edge of their cover-blast radius). Breach-2 and mines require multiple impacts against undamaged light cover; explosive effects still vary by distance and material. Frag grenades only demolish cover in a 6m inner radius, not their full 12m combatant-fragmentation radius. Thin panels transmit blast pressure; concrete, structural objects, reinforced walls and sheet metal remain intact and shield cover behind them. Offline and authoritative server paths share one integrity model, with the existing `materialCoverImpact` events and snapshots synchronizing multiplayer. Flashbangs, darts and tasers do not damage cover. Decorative or untagged map geometry is not destructible.

**Gun Game:** each 30-tier cycle uses 28 distinct regular firearms, followed by a randomly chosen non-Wonder launcher and then a randomly chosen non-Wonder melee weapon. The final melee kill is the only win condition. Multiplayer and local matches use the same catalog-driven picker.

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

**Optic magnification:** `sight-definitions.json` provides the actual optical `zoom` multiplier. The FPS camera derives its scoped field of view geometrically so 2×, 4× and 6× remain accurate at different player FOV settings. Keep corresponding attachment names, descriptions and handling trade-offs in sync. The Armory exposes compatible attachments and their challenges/prices even when a weapon is not equipped (or not owned); equipping remains limited to the active slot and purchasing still requires weapon ownership.

**Progression and weapon mastery:** The Tactical Knife has the same seven standard skin trials as other melee weapons; open **Skins & Challenges** from its weapon card or the melee loadout slot. Melee mastery remains kill-only. Firearm Weapon Mastery ranks 2–5 now require 25/70/150/330 headshots respectively (kill requirements unchanged at 60/150/300/600). Completed attachment challenge details disappear from the Armory once eligible, leaving the price and purchase action. The Marksman DMR has a 12-round standard magazine (18 with Extended Mag).

**Bastion .45:** Keep the shipped ID `pistol_bastion` and all associated progression. The six-shot revolver uses a dedicated `cylinder_speedloader` viewmodel reload (Magnum .50 retains `cylinder`); actual reload timing still comes from `computeEffectiveStats`. The cylinder's axis runs along the gun's Z/barrel axis, not across the frame: swing-out movement is lateral in weapon-local X while preserving axis orientation under the main weapon quaternion. The six open-ended chamber sleeves replace an opaque solid drum, and all six individual cartridge meshes advance visibly into their bores during the speedloader insertion phase; the loader itself is only a temporary collar. The Bastion's U-notch is mounted directly to the topstrap (near Z=-0.035 rather than floating at Z=+0.09), and the front blade rests on the rounded barrel shroud. The open curved frame around the cylinder, visible larger drum and rounded grip replace the squared conventional pistol receiver; importantly the REAR of the gun is enclosed by a solid rounded recoil shield, cast bilateral side cheeks, lower bridge and continuous backstrap connected to the grip, all stationary during reload. Do not substitute floating frame rails or an empty cavity behind the cylinder. The full-power .45 ammunition now deals 70 damage per body hit at only 1.55 rounds/sec, with higher recoil, 35m effective range, and 1.8 light-cover penetration energy; it still needs two close body hits and cannot one-shot with an unmodified headshot. Magnum .50 remains the faster, less damaging revolver. A deep pressure tail and sharper hammer crack convey the heavier rounds. Bastion overrides all attachment slots: use revolver-specific ammunition/speedloader options rather than generic magazine extensions. `grip_fan_hammer` changes its firing action: +85% cadence, continuous shots on held fire, +140% hipfire spread and +30% recoil, with ADS disabled (even under auto-ADS). Offline and authoritative server use the same effective stats, including automatic-fire bloom; Gun Game ignores equipped attachments. Test six-shot capacity, hipfire, mouse/touch hold, online cadence, sights and reload cues.

**Attachment economy and balance:** standard early attachments typically cost 200–350 CR, mid-tier utility costs 375–550 CR and specialist/late-game variants cost about 500–850 CR. Higher level gates and contextual challenges provide progression without a tenfold price jump for comparable stats. Attachment purchases are per weapon (not account-wide). Where two compatible attachments share a slot, avoid a strictly dominated option: each should offer a meaningful handling, precision, damage, range or mobility trade-off in its `effects` and description. Compare using `computeEffectiveStats`, not copy alone.

**Progression:** each eligible weapon/attachment pair receives a contextual permanent attachment challenge through `src/lib/armory-challenges.ts`. Challenges make purchases *eligible*, not owned; the original credit purchase is still required for attachment ownership. **Weapon Prestige requires every regular cosmetic challenge and every compatible per-weapon attachment trial**, evaluated by `prestigeChallengeStatus` on both client and server. Players do not have to purchase attachments to earn Prestige; previously owned compatible attachments and skins count as completed trials. Melee has zero attachment trials. Already-granted Prestige/Wonder entitlements are never revoked. Check compatibility and eligibility on both client and server.

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

`rarity` is `common` / `rare` / `epic` / `legendary` / `prestige` (the last is reserved for Prestige-only finishes); `tier` remains `standard` / `rare` / `legendary` and controls unlock classification independently. The required `artBrief` is a concise, player-facing description shown in the Armory. Colors use six-digit CSS hex. `metalness` and `roughness` are from 0 to 1. Prestige finishes use coded `prestige` variants (`cosmic` or `toxic`); **do not assign novel prestige values without implementing them**. See [Weapon skin art briefs](weapon-skin-art-briefs.md) for current finishes and the Gold plating contract.

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

Use `/map-editor` and export the JSON; replace `src/data/maps/<mapId>.json` in the repo. Each unique ID maps to a blueprint:

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

Use this object as the `blueprint` in the version-2 map document, alongside `id` and `theme`. Register the document in `src/lib/map-documents.ts`. Each rectangular region uses centre coordinates `x,z` and full extents `w,d`. Spawns are `[x,y,z]`. Give overlapping regions ample passage width and verify stairs connect to walkable landings. A `templateMapId` can reuse legacy centre structures. The build bundles these maps for offline and multiplayer play.

## Map color palettes, biomes and prop authoring

Floodgate (`floodgate`) is a fully authored 16v16 CTF layout with no inherited template geometry. It is registered in `MapId`, the shared `CTF_MAP_IDS` allowlist and room-capacity rules; it also supports TDM and Kill Confirmed. Ground-level flag/delivery positions and bot lanes are implemented in `ctf-rules.ts`. A new CTF map must review all three contracts, not only append a blueprint or theme. See [Floodgate](floodgate.md).

Periodic hazards support optional `visual: "spikes" | "steam"` and `warningFor` fields in both blueprint and protocol types. Their animation and damage phase use `periodicHazardPhase()` and the synchronized environment clock. Steam is an appearance of the existing periodic damage mechanic, not a new server object type. Update schema, validation, editor copy/export, visuals and tests together when extending these fields.

The `lava` hazard uses only box geometry. The visible surface is at `y + h / 2`. Feet within the X/Z extents at or below that height are eliminated immediately, even during spawn protection. Place bridges above the surface and keep every spawn clear of it. The offline engine and multiplayer server share the contact rule, and bots look for support above the lava when choosing a route.

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
- Hellfire: all five fuel-seconds must recharge before ignition. For a five-second active window, holding the trigger sends a continuous 11m damage cone (8 ticks per second) using flame plumes emitted at the muzzle and a soft synthetic combustion hiss, not bullet muzzle flashes/reports. Releasing early forfeits remaining burst time; shots cannot start at partial charge. No persistent ground fire.
- Stormweaver: one energy charge fires seven spread pellets, each colliding with cover and limb-inclusive hitboxes independently. An enemy hit causes immediate pellet damage plus up to two 9m chain jumps. A pellet that hits no enemy becomes a glowing proximity mine on the ground (450ms arm delay, 2.65m trigger, 4s lifetime), delivering a burst and two more jumps when an eligible enemy approaches. Mines do not require a second shot or linked anchors, cannot trigger through walls, are capped at 12 per owner, and include late-join multiplayer snapshots. Damage is server-authoritative; offline and multiplayer share `src/lib/stormweaver.ts` geometry and targeting. Up to three direct pellets and two chain hits per victim per shot count toward damage to avoid unbounded stacks.
- Bogfather is temporarily disabled in loadouts, Armory and server combat, retaining its catalog ID for existing saves.
- Default Wonder bodies use animated cosmic/toxic patterns with extra energy emitters; physical iron sight notches appear at crosshair height in ADS for unsighted conventional guns.
- Triggering an empty conventional magazine, including semi-auto/burst guns, initiates reload.

## Combat / camera calibration pass
- Knife and Shiv reach 1.25m/1.15m centre-to-centre with broader weapon-specific forward arcs and clear line of sight; side/rear targets remain excluded. See [current combat tuning](wonder-defense-and-bot-tactics.md). Axe uses a single-bit flared wedge and restrained across-body chop referenced to USDA Forest Service axe swing guidance.
- RL-7 radius 1.9m with 176 damage and a high direct impact factor. Breach-2 radius 2.9m with 74 base damage and its own sub-lethal direct-impact multiplier. Swarm-3 retains 9.5m fragmentation, with slightly slower projectile travel.
- ADS uses `src/lib/viewmodel-clearance.ts` to lower receiver height while independently aligning the physically mounted iron sight with the camera crosshair. Renderer ballistics remain centred on camera yaw/pitch at eye height, not displaced by any weapon geometry. Regression tests exercise every unsighted non-melee weapon, including Hydra Twin, Reclaimer and rocket launchers.
- The firing-range dropdowns group by type, order conventional weapons by level and alphabetize Wonders. Disabled Bogfather is excluded even from trial links. Practice overlays expose Resume and Leave and no longer show the purchases/profile notice.
- Reclaimer base bolt damage/range reduced. Quiver is 10 lighter automatic bolts with no retrieval, Extended Mag remains the normal extension, Heavy Arrows allows 2 damaging bolts whose ammo can only be restored by picking up fired bolts. Arrow prop and hand insert move along the upper flight rail.
- Stormweaver uses one visibly thicker electric arc per chain and its mines expire after 4 seconds. Deadlock smart volleys hit up to 3 acquired/visible targets per consumed charge. Default bodies of Plagueheart, Deadlock, Bullet Spitter and Event Horizon no longer force animated cosmetic finishes.

## Economy and Career progression

See [Economy and Career progression](economy-and-career-progression.md) for the
current reward table, 40% faster XP curve, level-36 equipment cap and repeatable
Career ranks. `rewards.json` owns difficulty-specific kill and objective payouts
as well as base rewards; the runtime and archived Guide read those same numeric keys.
Do not add a numeric reward setting without a consuming rule.

Use XP-derived levels for every entitlement check; `Player.level` is a repaired
cache, not an authority. Career rank and fresh-XP progress are distinct persisted
fields and confer cosmetic titles. Do not spend lifetime XP or use historic
overflow to satisfy fresh Career goals. New late equipment needs its own
appropriate mastery/content objective; increasing a level gate or credit price
alone does not solve veteran stockpiling. Preserve all historical ownership.

## Achievement chains and nameplate titles

`achievements.json` keeps every shipped achievement ID, metric, goal and XP/credit
reward. Each entry now has a stable `series` ID and positive integer `seriesTier`.
Tiers are unique within a series; catalog order and bronze/silver/gold/platinum
colors do not decide which tier is last. All five mastery achievements form one
`weapon_mastery` chain, ending at `mastery_5x8` (Arsenal Legend).

Only the highest `seriesTier` may declare `rewardTitle`. The validator rejects
duplicate tiers and intermediate title rewards; the title resolver also enforces
the final-tier rule. New chains should declare one title at their endpoint. The
current endpoints award titles for kills, headshots, wins, matches, leveling,
streaks, quest counters, Survival difficulties, CTF and weapon mastery. Quest
completion counters remain valid across all modes and are displayed separately
from PvP combat achievements. Career promotion titles remain their separate,
rank-based system.

Titles use the existing server-owned achievement awards: no new purchase, counter
or payout is introduced. Existing final-tier awards immediately expose the new
title. Previously selected intermediate titles are cleared on profile refresh,
while their achievement records and past rewards remain intact. Equipping checks
actual ownership; a title name or unlocked lower tier is insufficient.

## New-player tutorial and archived Guide

The Guide component remains at `src/components/screens/FAQ.tsx` for reference,
but has no navigation button, screen union entry or import in the game router.
`Tutorial.tsx` replaces it with onboarding: welcome, live range drills, an
interactive view of current equipment, mode briefings, and a final checklist.
The main-menu Deploy area is removed; Play remains in the header. Account login
and logout, plus tutorial replay/resume, are in Profile.

New profiles with zero XP and zero matches enter training once. Existing players
can opt in from Profile. Versioned checkpoints are stored per player key in this
browser/device. Completing or skipping suppresses automatic prompts; leaving a
drill saves its checkpoint, which resumes on the next visit or from Profile.
Replaying completed/skipped training starts at the welcome step. An already
offered tutorial does not reopen on every menu visit in the same session.

The five range tasks observe actual simulation snapshots for distance walked,
ADS, a fresh elimination, a completed reload, and a weapon change. Reloads
cancelled by swapping do not complete the task. Keyboard/mouse and touch use
the same observations with device-specific instructions. The ordinary starter
kit runs through the existing `firingRange` path: no networking, purchases,
loadout edits, match submissions, XP, credits, or achievement progression. A player
can skip drills or the full tutorial; WebGL startup failures retain an exit.

## Connected construction and asset recipes

Map Studio publishes version-2 `src/data/maps/<mapId>.json` documents containing `id`, `blueprint`, and `theme`. `src/lib/map-documents.ts` registers all eight authored maps, including Orbital Nexus. The old split blueprints/themes are migration snapshots. Keep native TypeScript base environments and shared objective handlers when editing authored data. See `docs/map-studio.md` for stair attachments, assemblies, exact faces, geometry warnings, and editable asset recipes. Existing numeric coordinates are preserved during migration.

## Objective authoring contracts

Map blueprints may declare `objectives`, `modes` and `gravityScale`. See [Map Studio objective authoring](map-studio.md#map-objectives-and-supported-modes) for the full workflow and semantics. `map-objectives.ts` provides shared typed records and mode requirements; CTF/reward handlers consume compiled maps in both offline and authoritative server simulation. Publish positions/radii/team flags/capture zones/reactor charge rules in the canonical map JSON. The native Forest Warfare template reads `src/data/maps/forest-objectives.json`. Update `src/data/schemas/map-blueprints.schema.json` alongside validator/type changes. Unknown behavior fields and duplicate objective roles are rejected; there is currently one reactor state per match. Adding a new executable objective or mode still requires coordinated runtime and protocol implementation, not only a JSON entry. Restart/redeploy client and server together for reactor rules version 5.

## Defensive Wonders and tactical difficulty

Thunderclap (`cluster`) uses server-timed bouncing ballistic volleys, replicated contact timestamps and detonation-only blast damage. Its helper derives shell/child damage and radii from the catalog and uses movement gravity times the map multiplier. Bulwark + P-9 (`shield`) is a Primary Wonder with a normal P-9 magazine and independent 250 HP bullet panel; bracing disables pistol fire. Neither may enter the Secondary slot even though their ballistic categories are launcher/pistol. New Wonder kinds need coordinated ownership/slot, ammo, rendering, protocol and damage integration; see [Defensive Wonders and bot tactics](wonder-defense-and-bot-tactics.md).

## Explosion effects and rendering cost

Use the engine's `spawnExplosion` route and `src/lib/explosion-effects.ts` for transient blasts. Do not add/remove a realtime point light for every fragment: light-count changes generate shader variants across lit scene materials. The cosmetic pool is bounded independently of damage; even a culled/rejected visual must still resolve its full authoritative/offline combat effects. See [Explosion effect performance](explosion-effects-performance.md).

Mode-specific CTF objectives and spawn overrides for Verdant Ruins and Ridgefall live in their unified `src/data/maps/<mapId>.json` documents (`objectives` and `modeSpawns.ctf`); `src/data/ctf-layouts.json` remains a migration/reference snapshot. Use `getMap(mapId, mode)` in simulations and mode-aware capacity helpers when exposing room options. See [map modes and spawns](map-modes-and-spawns.md).

Whiteout Depot is a third consumer of the generic `ctf-layouts.json` ground-objective contract. Its blueprint owns all geometry and its snow/metal theme has a static registration. See [Whiteout Depot](whiteout-depot.md).

## Body penetration and penetrator ammunition

Body-to-body penetration is deliberately separate from destructible cover damage and material penetration.
A weapon can optionally declare `stats.bodyPenetration: { maxTargets, damageRetention }`.
The shared ray helper (`src/lib/body-penetration.ts`) sorts actual body hitbox contacts;
up to three targets may be hit, each subsequent target multiplying remaining damage by
`damageRetention`. Map cover, Bulwark shields and spawn immunity still absorb the shot.
Offline player shots and bots, plus server-authoritative player and bot shots, consume
the same resolved effective-stat property.

Innate profiles are limited to selected higher-powered weapons. The Hydra Twin's
two-round burst and Hailstorm LMG have innate two-body penetration rather than
Behemoth / Leviathan, whose raw damage and magazines already offer their own strengths.
The Annihilator is the sole innate three-body weapon.

`mag_penetrator` is an optional magazine ammo tradeoff: -8% first-hit damage,
-20% capacity and +12% recoil. It adds two-target penetration with 35% retention,
or improves natural penetration retention by 15 percentage points without
increasing target count. Its `exclusiveWeaponIds` whitelist limits compatibility
to conventional assault rifles, DMRs, LMGs and two snipers; do not expose it to
wonder weapons, explosive launchers, crossbows, shotguns or unrelated categories.
Add catalog eligibility to both `category-attachments.json` and any affected
per-weapon overrides in `attachment-compatibility.json`. The compatibility
helper enforces `exclusiveWeaponIds`, and `computeEffectiveStats` also checks
whitelisted ammo server-side instead of trusting raw loadout IDs.

The Armory uses a compact base-stat PEN×N tag without altering card height.
The weapon customization's `WeaponStatsPreview` displays effective penetration,
including changes resulting from previewed magazine attachments. Regression cases
live in `tests/body-penetration.test.ts`.
