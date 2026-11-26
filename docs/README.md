# Vanguard Ops documentation

This folder contains maintained operator and developer references. Runtime behavior
and live content are ultimately defined by the application source and canonical
data under `src/`; these documents explain workflows and important contracts.

## Development and operations

- [QA and release promotion](dev-test-checklist.md) — the single CI workflow,
  manual acceptance and safe `dev` → `main` promotion.
- [Content authoring](content-authoring.md) — catalog source-of-truth, schemas,
  validation and JSON conventions.
- [Map Studio](map-studio.md) — map editing, connected construction and assets.
- [LAN and Tailscale hosting](lan-and-tailscale.md) — host and join a private party.
- [Room and match flow](match-flow.md) — lobby persistence, map voting and room
  transitions.
- [Operations campaign](operations.md) — mission objectives, co-op and rewards.

## Gameplay and authoring references

- [Map modes and spawns](map-modes-and-spawns.md)
- [Floodgate](floodgate.md) and [Whiteout Depot](whiteout-depot.md)
- [Ballistic materials](ballistic-materials.md), [ballistic cover](ballistic-cover.md)
  and [unified material penetration](material-penetration.md)
- [Art direction and materials](art-direction-and-materials.md)
- [Asset library and imports](asset-library-and-imports.md)
- [Controls and accessibility](controls-and-accessibility.md)

## Validation

The repository has one GitHub Actions workflow:
`.github/workflows/dev-validation.yml`. It runs TypeScript syntax/type validation
and content/file-reference validation on pushes and pull requests targeting
`dev` or `main`. The small generic catalog contract tests remain available
through `bun run test:smoke`, but gameplay-specific test suites are not CI gates.
