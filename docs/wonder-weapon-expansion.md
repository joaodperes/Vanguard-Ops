# Wonder Weapon mechanics

The following Wonder abilities use their existing permanent Prestige-token unlocks and stable catalog IDs. Wonders now occupy slot 4 when the level-one Wonder Weapon perk is selected, replacing passive perks rather than conventional primary weapons. Every match starts with zero charges, recharge proceeds automatically even while dead, and neither death nor respawn provides ammunition. Ordinary kills accelerate recharge; changing a loadout also starts the selected Wonder at zero. Every shot/resource is validated on the match server; offline bot games mirror damage, collisions and special effects.

| Weapon | Behavior | Resource |
| --- | --- | --- |
| **Deadlock** (`wonder_deadlock`) | Aim down sights 250ms to tag up to three visible targets. Pink markers remain for 6s; hipfire smart bullets still seek tagged enemies if exposed. | Two charges; 50s per charge |
| **Hellfire** (`wonder_hellfire`) | Hold fire to spray a moving 13m cone of flame. No lingering ground patches. Eight fuel-seconds are available, spent only while firing. | Eight fuel-seconds per tank; recharge 12s per fuel-second |
| **Stormweaver** (`wonder_stormweaver`) | Fires **seven individual electrical pellets** in a lightning shotgun fan. Each enemy hit causes 22 direct damage and can jump to **two additional** exposed enemies within 9m. Pellets that hit no enemy, whether they hit a wall or reach max distance, fall to the floor as visible **energy mines**. Mines arm after 450ms, last 6.5s, and on enemy proximity within 2.65m deliver a 24-damage lightning burst followed by up to two 9m chain jumps. Mines cannot detect through solid cover. A limit of 12 active mines per owner and per-target repeat/cumulative shot-damage caps prevent unbounded stacking. **No paired-anchor/line mechanic remains.** | Two shots; 60s per recharge |
| **Bogfather** (`wonder_bogfather`) | Disabled prototype. ID and historical progression preserved, but purchasing, equipping and shooting are unavailable. | Retired |

## Stormweaver implementation notes

Shared deterministic spread, per-pellet first-contact hit detection (including enemy limbs and map geometry), enemy eligibility, mine placement, arm/trigger radius and chain selection live in `src/lib/stormweaver.ts`. Server `game-server.ts` owns mine creation, trigger events, damage, expiring/evicting mines and synchronized snapshots. Offline `fps-engine.ts` uses the same helper, displays each pellet's path and creates electrical mine meshes which pulse and detonate when bots approach. Mines are visually synchronized using `stormMinePlaced`, `stormMineRemoved`, and snapshots; network clients cannot submit mine positions or victim IDs. The previous conditional link connecting two shots was removed.

## Verification

Run catalog checks, regression tests, TypeScript and the production build. Manually inspect pellet visibility, arcs, mine expiration, wall shielding, different elevations, team damage, bot reactions, and late-join synchronization in offline and multiplayer. Automated tests do not substitute for interactive playtesting.

See also [Prestige and Wonder Weapons](prestige-wonder-weapons.md).
