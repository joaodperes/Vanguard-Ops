# Material-based bullet penetration

Material penetration applies to **conventional hitscan bullets** and augments, rather than replaces, existing body-to-body penetration. The same trace is used by the authoritative multiplayer server, the offline player, and offline/multiplayer bots. Rockets, blasts, throwing knives, shields, and energy wonders keep their existing rules.

## Cover materials

Map Studio assigns an explicit **Ballistic material** to individual **cover** features. This property is stored in the map document and copied to the physics collider. It does not alter movement collision. The material is shown in the 3D editor and match rendering. Untagged colliders remain hard cover; a wood-looking texture does *not* by itself make a wall penetrable.

| Material | Penetration resistance per world unit | Base damage retained when exiting | Notes |
| --- | ---: | ---: | --- |
| Glass | 0.22 | 87% | Fragile partition, no dynamic destruction yet |
| Light cover | 0.58 | 70% | Screens and lightly built obstacles |
| Thin wood | 0.72 | 72% | Boards, wooden screens |
| Sheet metal | 1.42 | 60% | Highest resistance among penetrable materials |
| Concrete | — | 0% | Completely blocks shots |
| Reinforced | — | 0% | Completely blocks shots |
| Missing material | — | 0% | Safe default for every existing obstacle |

The actual retained damage is modestly lower for especially costly passes: `baseRetention × max(0.55, 1 − 0.08 × resistanceCost)`. Existing weapon range falloff and body penetration still apply; one point of armor/energy does *not* represent a real-life millimeter or caliber.

## How a shot resolves

1. Find the ordered entry and exit faces of all box colliders on the ray.
2. If a collider is structural, an environmental wall, or a concrete/reinforced/untagged object, the shot stops at its near face.
3. For a penetrable cover box, the bullet spends `thicknessAlongRay × materialResistance` from its weapon's energy budget. A grazing-angle hit has more traversed thickness and is harder to penetrate.
4. Each successful exit multiplies downstream hit damage by that material's retention. **Maximum two penetrated cover objects** per bullet, regardless of energy.
5. Process ordered combatant contacts using the existing body penetration max target and retention limits. Spawn immunity and an intact Bulwark riot shield stop the shot regardless of remaining cover energy.

The computation intentionally does not destroy or permanently weaken panels. Low penetration power simply means shots hit the near face with no damage to an enemy behind.

## Initial weapon identities

Cover penetration power is set per **weapon**, not inferred from damage. Current tuning:

| Weapon | Cover power |
| --- | ---: |
| DMR Cyclone / Whisper / Scout / standard / Heavy | 1.3 / 1.8 / 1.6 / 2.0 / 2.6 |
| Sniper Scout / standard / Heavy | 2.6 / 2.8 / 4.0 |
| LMG Light / HV / Heavy | 1.6 / 2.0 / 2.8 |
| Heavy rifle / Hydra | 1.7 / 1.3 |
| Ordinary assault rifles, SMGs, shotguns, pistols and special/wonder weapons | 0 unless otherwise specified |

Legal Penetrator Rounds add **0.6 cover energy**, besides their existing second-body effect, while retaining their magazine-size, recoil, and damage downsides. Gun Game uses intrinsic weapon stats but not loadout attachments.

## Map content and authoring

A deliberate selection of existing gameplay geometry is now tagged: Bunker (wooden workbench and light console), Shipyard (market stalls and dock crates), Ridgefall / Skybridge (thin industrial railings), Orbital Nexus (glass screens and metal reactor barricades), and Floodgate (spillway railings). Major concrete walls, castle stone, perimeter boundaries, floors, stairs, environmental blockers, and any untagged cover are unchanged.

Map Studio offers **Thin wood screen**, **Sheet metal screen**, **Glass partition**, and **Light barricade** assets; they are regular resizable, movable, savable features. You can also set Ballistic material on existing cover features. Since the actual collider thickness governs penetration, large solid boxes with a penetrable material may be impossible to shoot through; design thin panels explicitly.

## Safety and test checklist

- Untagged and structural cover never penetrates, including from a sniper.
- Same geometry + weapon stats give the same server and client outcomes, including bots.
- A target inside an object cannot be hit by a round that has not exited it.
- Thickness, oblique incidence, multiple layers, and the two-layer cap affect results deterministically.
- Bulwark and spawn protection absorb shots; body multi-hit penalties compound with cover damage loss.
- Content document validation rejects unknown material IDs and materials on non-cover features.
- Playtest both orientations of thin authored panels and HUD hit markers in local and online matches.
