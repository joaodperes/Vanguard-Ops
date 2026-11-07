# Ballistic cover — gameplay and authoring

Vanguard Ops conventional bullets use **explicit cover materials** in the shared offline/online hitscan resolver. This is separate from body penetration, map textures, footsteps and blast/destructible-wall damage. Melee, grenades, bolt projectiles and wonder-weapon explosions still follow their existing collision rules.

## Authoring

Select a **Cover** feature in Map Studio → **Ballistic material**. Supported identifiers:

| Material | Behavior | Typical authored object |
| --- | --- | --- |
| `concrete` | Fully blocks conventional rounds | Thick masonry, foundation, rock |
| `reinforced` | Fully blocks conventional rounds | Armored barricade, blast wall |
| `thin_wood` | Moderate penetration loss | Thin planks, wood screen |
| `sheet_metal` | Higher resistance/damage loss | Thin partitions and safety rails |
| `glass` | Low resistance/damage loss | Glass room divider |
| `light_cover` | Moderate penetration loss | Lightweight crates and barricades |

**No material** is equivalent to solid/concrete for ballistics. The engine never marks arbitrary generic `cover` as penetrable, even if its visual texture looks like wood or metal. Only rectangular `cover` colliders with a soft material can be pierced. Collision boundaries, platforms, stairs, solids and destructible environmental barriers remain hard stops regardless of tags. Existing map safety and hard cover are unchanged.

The prefab asset palette includes wood, sheet-metal, glass and light-cover pieces. The shared compiler `featureBoxes` copies the authored `material` tag to its collider, so Map Studio preview, offline bots, and the online server read the same geometry and material. Both `validateMapDocument` and `validateBlueprint` reject invalid material tags.

## Weapon budget and damage

Each conventional high-caliber weapon's `stats.coverPenetration` defines its energy budget. Snipers, DMRs and LMGs have different budgets; heavy rifle variants also receive small budgets. A compatible Penetrator Rounds magazine provides +0.6 budget (and retains its existing body penetration and handling trade-offs). All other conventional weapons cannot pass hard surfaces; no attachments grant penetration to explosives.

For each real ray–box intersection:

1. Intersect the AABB to find both entry and exit points. **Actual path length** (not just wall thickness) matters, so oblique shots cost more.
2. Subtract `pathLength × materialResistance` from the remaining weapon budget. A surface that exhausts the budget stops the shot at its entry.
3. On a successful traversal, multiply damage by the material's retention factor, including a small extra loss based on energy spent. Existing range falloff still applies at target distance. Each extra surface compounds the losses.
4. Stop after **two** penetrated surfaces at most, even if weapon energy remains. A shot that encounters a non-penetrable object stops immediately.

Current resistance / damage retention coefficients (before thickness penalty):

| Material | Resistance per world unit | Damage retained after crossing |
| --- | ---: | ---: |
| Glass | 0.22 | 87% |
| Thin wood | 0.72 | 72% |
| Light cover | 0.58 | 70% |
| Sheet metal | 1.42 | 60% |

The body-penetration `maxTargets` and `damageRetention` settings remain independent. Even with a strong round, Bulwark shields and spawn-protected bodies stop subsequent body hits. No new target acquisition or automatic through-wall bot tracking is introduced: the ray must actually intersect a target, and the usual AI visibility rules remain.

## Validation / regression

Run `bun test tests/material-cover-penetration.test.ts tests/body-penetration.test.ts`; for full cross-system checks run `bun run content:validate`, `bun run typecheck`, `bun run test:smoke` and `bun run build`.

The new regression suite covers materials, multiple layers, grazing angle, budget and damage reduction, solid obstacles, shields/spawn immunity, magazine behavior and propagation of tags into published maps. Check the [dev workflow](../.github/workflows/dev-validation.yml) before promoting changes to main.
