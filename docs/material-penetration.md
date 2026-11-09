# Unified ammunition penetration

Conventional bullets in Vanguard Ops have one **PEN** energy budget that applies
to both *material cover* and *aligned combatants*. This is a deliberately
gameplay-scaled rating, not a real-world caliber, thickness or armor standard.
The Armory displays only the rating; detailed mechanics live in **Field
Training → Penetration**, directly selectable from the tutorial chapter index
or from the weapon customization modal.

## Source of penetration power

Each conventional firearm carries an intrinsic penetration rating in
`src/data/catalogs/weapons.json`. Ratings differ between individual weapons;
the approximate class baseline is:

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
`mag_slug` shotgun magazine raises penetration energy **+0.9**, while reducing
the shotgun to one solid projectile. Gun Game uses intrinsic ammunition stats
without loadout attachments.

Rockets, flame/projectile wonders, throwing knives, melee swings, shields,
special electrical weapons and bolts keep their dedicated projectile rules.
No energy is inferred from a weapon's raw damage.

## Material cost and retained damage

A bullet uses one remaining energy budget, spending it as it encounters
bodies and cover **in the actual order along its ray**. Thicker material and
more oblique angles cost more energy.

| Material | PEN cost per world unit | Base damage retained on exit | Breakable |
| --- | ---: | ---: | --- |
| Glass | 0.22 | 87% | Yes |
| Light cover | 0.58 | 70% | Yes |
| Thin wood | 0.72 | 72% | Yes |
| Sheet metal | 1.42 | 60% | No |
| Concrete, reinforced, untagged or structural | Not penetrable | 0% | No |

The actual exit damage is `baseRetention × max(0.55, 1 − 0.08 × materialCost)`;
successive material and body damage-retention multipliers compound. The first
body takes the normal applicable damage. Each **successful body exit consumes
0.85 PEN** and reduces damage to a subsequent target. Weapon-specific
body-retention profiles still provide meaningful projectile identity for
specialist weapons, while ordinary ammo derives a retention coefficient from
its energy rating.

At most **two cover surfaces and three combatants** can be penetrated by one
shot even if extra energy remains. Energy and the weapon's body-target cap
may end the shot sooner. Intact Bulwark shields and spawn protection absorb
rounds regardless of remaining energy. The same hit traversal is used by the
authoritative server, offline player and offline bots.

An enemy struck before an obstacle spends the round's remaining energy
**before** that obstacle is evaluated. This prevents shots from travelling
through a body and then piercing a wall they could not afford. A bullet that
breaks a destructible panel still resolves against the **pre-break geometry**;
the passage opens for subsequent shots. Panels retain their own integrity
rather than sharing ammunition penetration energy.

## Map authoring and hands-on testing

Only an explicitly assigned ballistic material on a **cover feature** enables
penetration. A visual texture, a generic solid, a platform, a stair, a
destructible environment barrier and a hard-coded concrete wall do *not*
become penetrable by looking like a soft material.

Current tagged samples:
- **Blacksite / Bunker**: security console (light cover), maintenance bench (thin wood).
- **Shipyard**: market stalls (thin wood), dry-dock crates (light cover).
- **Ridgefall / Skybridge**: upper gantry and deck railings (sheet metal).
- **Orbital Nexus**: glass screens near both vaults, sheet metal at reactor.
- **Floodgate**: raised spillway railings (sheet metal).

In the private Armory Firing Range, turn into the side corridors for five
labeled material samples with respawning targets behind them. Compare a
standard pistol, the VK-12 with and without Penetrator Rounds, a slug shotgun
and the Annihilator. Shoot the torso through the sample, not the head visible
above it; restart the range to restore broken panels.

Map Studio supports material-tagged cover, re-scaling and imported maps.
Always validate thickness, angles, mixed body/cover paths, lag-free effects,
movement collision after destruction and online server/client agreement.

## Regression tests

- `tests/unified-ballistics.test.ts`: energy expenditure, body/cover order,
  ammo effects, capped hits and concrete protection.
- `tests/material-cover-penetration.test.ts` and
  `tests/material-penetration.test.ts`: thickness, material selection and
  layered cover rules.
- `tests/material-cover-destruction.test.ts`: integrity, shattering and replication.
- `tests/tutorial.test.ts`: tutorial chapter index and checkpoint compatibility.
