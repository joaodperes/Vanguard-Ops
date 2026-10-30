# Career Contracts, Shop and cosmetics (dev)

## Progression

Regular account XP now advances to **level 40**. Starting with newly completed matches at level 40, a rotating five-contract set accumulates progress. Any **three** completed objectives qualify one Career Token. A player must claim the token to start the next cycle; the token and completion record are permanently stored server-side and cannot be replayed. The objective pool includes fresh earned XP, match headshots, non-Survival wins, Survival wave-30 completions, multi-headshot performance in a single match and weapon-category kills. Goals scale on later cycles and the five offered contracts rotate.

Old repeatable Career Rank promotions are retired, but previously earned Career Rank titles and profile rank history remain, including on imported backups. Historic XP overflow does **not** count toward contracts. The existing equipment-level threshold changes from 36 to 40; historic lifetime XP is still used for equipment levels.

## Currencies and Shop

Only two reusable currencies are shown:

- **Credits**: existing earnings; spend in Armory or the new **Credit Shop** tab.
- **Career Tokens**: claimed after three Career Contracts; spend in the **Career Token Shop** tab on exclusive cosmetics.

Wonder Weapons are earned through a different mechanism: the same weapon must finish all seven standard skin challenges (Viridian Blight reward) **and** Mastery 5/5 (Eventide reward). The combined milestone grants a **one-use Wonder Weapon entitlement**, displayed as 'Wonder unlocks available', **not** a tradeable currency. Existing earned prestige cosmetics and Wonder Weapon purchases remain grandfathered.

The initial Credit Shop offers **Cobalt Alloy** (3,000 CR, applied to the featured weapon) and **Urban Ghost** (25,000 CR, operative skin). The Career Shop offers **Void Circuit** (1 token, per regular weapon) and **Starlight Vanguard** (2 tokens, operative skin). The shop uses server-owned prices and atomic purchase records; there are no purchased advantages to combat stats. **Reticles, charms, and nameplates are implemented in the same two Shop tabs.** Existing Classic Cross / Precision Dot reticles and all color/size settings remain free. Newly purchased reticles alter only the hipfire HUD drawing; optical ADS sights retain their standard functional overlays. The Shop offers Orbit Ring and Vanguard Chevron for 3,500 CR each, and Nova Star / Quantum Pulse for 1 Career Token each. Choose a hipfire reticle separately for each active weapon slot in **Armory → Customize → Reticles**. Settings only changes global color and size.

**Weapon charms** are small, actual Three.js hanging objects attached to a ranged weapon's body and animated with its sway; the weapon model carries the pendant in both first and third person. Buy each design once account-wide, then choose it per loadout slot in **Armory → Customize → Charms**. Named loadout presets also save primary/secondary reticle and charm selections. Vanguard Dog Tag costs 6,000 CR, Skull Token 9,500 CR; Nebula Orb and Reactor Core cost 1 Career Token each. `No Charm` is a free option. The expanded catalog also offers Brass Casing (4,200 CR), Lucky Dice (5,800 CR), Field Compass (7,200 CR), Scout Drone (8,900 CR), Phoenix Feather (11,500 CR), Void Prism (1 Career Token), Solar Emblem (1 Career Token) and Orbital Satellite (2 Career Tokens). Charms render at a reduced scale in first- and third-person views, without altering stats or hitboxes; melee and Wonder Weapons cannot equip them.

**Nameplate designs** are decorated borders and motifs around the player's display name, with the current earned title shown independently. They're shown in Profile and on the floating in-world player label. Steel Division costs 7,500 CR, Crimson Command 10,000 CR; Eventide Crest costs 1 Career Token and Vanguard Legend costs 2. **Profile → Nameplate design** equips owned designs. Standard Nameplate is free.

All three categories are permanently recorded in the existing Shop purchase ledger. Nameplates equip on Player; reticles and charms equip on Loadout, are copied into named presets, and migrate once from earlier account-wide/per-weapon settings. The profile export/import process preserves both ownership and equipped selections. Repeated Shop checkout is rejected and neither the API nor the UI can equip an unpurchased cosmetic. The Collector percentage still excludes Career Token-only cosmetic merchandise.

The existing **reticle selection stays free**. A nameplate design is a decorative profile/title frame; a weapon charm would be a small attachment dangling from a gun and moves with the weapon, without any combat effect.

## Operator appearance preview

Armory → Operatives contains a rotating 3D operative preview without weapon geometry. The selector distinguishes equipped, owned, locked and unpurchased skins; equipping and named preset switching use the active loadout.

## Collector

Five tiers award progress at **10%, 25%, 50%, 75% and 100%** of all regular weapons, each compatible per-weapon attachment, each collectible per-weapon skin, and eligible operative skins. The final achievement grants the **Collector** title. Wonder Weapons and Career Token-only shop finishes are excluded from both the numerator and denominator. Existing progress is recomputed from authoritative ownership when the profile/achievements are viewed; earned tiers are permanently recorded and rewarded once.

## Compatibility and deployment

Named loadout presets persist weapon choices, primary/secondary/melee skin IDs, each weapon's attachments, operative skin and perk; save/restore paths remain server-validated. Exports now include Career Contracts, claimed Career Tokens, Career Shop purchases and spent count.

**Database schema update is required** for existing SQLite installations because new Prisma models and columns were added. Back up the database and run `bun run db:setup` on the target before using the updated app. CI verifies TypeScript, content validation, database API regression tests, and production build.

The Shop has six persistent category filters—All, Weapon finishes, Operatives, Reticles, Charms, and Nameplates—inside the two existing currency tabs. “All” groups the daily featured products by type. Filtering never changes purchase entitlements.

## Shared daily Shop rotation

The **Credit Shop** and **Career Token Shop** each feature **three offers per category**
(weapon finishes, operative skins, reticles, charms, nameplates): 15 offers per
currency, 30 total. Rotation uses the current UTC date, rotates exactly at 00:00
UTC, and does not depend on player identity, account status, local time or server
process state. The same offers appear for everyone; **already-owned products
remain in the pool** and display Owned. The backend rejects purchases of items
not in the current rotation, even from outdated clients. Purchased items remain
permanently available in the Armory/Profile after disappearing from the store.

The expanded pool adds six weapon finishes (Frostbite, Dune Striker, Voltage Grid,
Emberline, Aurora Veil, Royal Obsidian), six operatives (Ash Wraith, Sandstorm
Scout, Tidebreaker, Solar Sentinel, Ion Phantom, Verdant Guard), four reticles
(Spire Sight, Trident, Eclipse Halo, Helix), four nameplates (Boreal Unit, Dusk
Raider, Nebula Commander, Orbital Vanguard), and four charms (Thunderbolt,
Deepwater Anchor, Micro Rocket, Lunar Crescent). Every currency/category has
at least four options, ensuring the selection changes daily.

**Weapon finishes remain weapon-specific**, not global cosmetics. The Shop
assigns each finish to a specific weapon in its daily offer, identically for every player. No player-selected weapon picker exists. The server validates the exact item/weapon pair. Purchased or earned skins are keyed per (player, weapon, skin), cannot be bought again, and may reappear for another weapon on later days.
Cobalt Alloy was reduced from 12,000 to 3,000 Credits, with additional Credit
Shop finishes priced 2,600–3,400 Credits. Career finishes cost one token per
weapon. Operatives, charms, reticles and nameplates remain account-wide designs
(their equipped selections still use their existing rules). Old purchases and
loadout selections are unaffected; no schema migration is required.

The Shop uses a left-hand vertical category menu and does not show redundant “3/3 today” counters. Purchase buttons distinguish weapon locked, Career locked, insufficient Credits, insufficient Career Tokens, and already unlocked. A shared top navigation bar serves non-match pages. Profile separates Stats, Customization (title/nameplate), and Career Contracts tabs.
