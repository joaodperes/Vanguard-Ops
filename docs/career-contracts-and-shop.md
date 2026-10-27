# Career Contracts, Shop and cosmetics (dev)

## Progression

Regular account XP now advances to **level 40**. Starting with newly completed matches at level 40, a rotating five-contract set accumulates progress. Any **three** completed objectives qualify one Career Token. A player must claim the token to start the next cycle; the token and completion record are permanently stored server-side and cannot be replayed. The objective pool includes fresh earned XP, match headshots, non-Survival wins, Survival wave-30 completions, multi-headshot performance in a single match and weapon-category kills. Goals scale on later cycles and the five offered contracts rotate.

Old repeatable Career Rank promotions are retired, but previously earned Career Rank titles and profile rank history remain, including on imported backups. Historic XP overflow does **not** count toward contracts. The existing equipment-level threshold changes from 36 to 40; historic lifetime XP is still used for equipment levels.

## Currencies and Shop

Only two reusable currencies are shown:

- **Credits**: existing earnings; spend in Armory or the new **Credit Shop** tab.
- **Career Tokens**: claimed after three Career Contracts; spend in the **Career Token Shop** tab on exclusive cosmetics.

Wonder Weapons are earned through a different mechanism: the same weapon must finish all seven standard skin challenges (Viridian Blight reward) **and** Mastery 5/5 (Eventide reward). The combined milestone grants a **one-use Wonder Weapon entitlement**, displayed as 'Wonder unlocks available', **not** a tradeable currency. Existing earned prestige cosmetics and Wonder Weapon purchases remain grandfathered.

The initial Credit Shop offers **Cobalt Alloy** (12,000 CR, applied per regular weapon) and **Urban Ghost** (25,000 CR, operative skin). The Career Shop offers **Void Circuit** (1 token, per regular weapon) and **Starlight Vanguard** (2 tokens, operative skin). The shop uses server-owned prices and atomic purchase records; there are no purchased advantages to combat stats. Weapon charms and alternate cosmetic nameplates are conceptual future Shop categories, not implemented in this pass.

The existing **reticle selection stays free**. A nameplate design is a decorative profile/title frame; a weapon charm would be a small attachment dangling from a gun and moves with the weapon, without any combat effect.

## Operator appearance preview

Profile contains a solo, rotating 3D operative preview with a dropdown for all appearances, including unowned ones. It mirrors the game's blocky articulated humanoid proportions, body color and accent/visor palettes; the weapon and animations are simplified. This is a preview only: it does not equip or unlock cosmetics. In actual matches, other players and bots share the same operative mesh code and individual selected/spawned skins.

## Collector

Five tiers award progress at **10%, 25%, 50%, 75% and 100%** of all regular weapons, each compatible per-weapon attachment, each collectible per-weapon skin, and eligible operative skins. The final achievement grants the **Collector** title. Wonder Weapons and Career Token-only shop finishes are excluded from both the numerator and denominator. Existing progress is recomputed from authoritative ownership when the profile/achievements are viewed; earned tiers are permanently recorded and rewarded once.

## Compatibility and deployment

Named loadout presets persist weapon choices, primary/secondary/melee skin IDs, each weapon's attachments, operative skin and perk; save/restore paths remain server-validated. Exports now include Career Contracts, claimed Career Tokens, Career Shop purchases and spent count.

**Database schema update is required** for existing SQLite installations because new Prisma models and columns were added. Back up the database and run `bun run db:setup` on the target before using the updated app. CI verifies TypeScript, content validation, database API regression tests, and production build.
