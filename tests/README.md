# Automated validation

The `bun run test:smoke` command runs the maintained test set locally and in CI:

- `catalog-contract.test.ts` and `content-catalogs.test.ts` check catalog
  structure, stable identifiers and data-agnostic content contracts.
- The combat-damage, combat-assists, respawn and bot-combat suites cover
  reusable gameplay rule contracts.

One-off regression suites for Dustwater geometry, Frontier loadout/movement
rules and the Hunting Rifle were removed. They covered specific implementation
situations rather than reusable contracts and are not part of the maintained
smoke suite.

GitHub Actions has one validation workflow. It runs TypeScript syntax/type
checking and the content validator for authored data and file references.
The smoke suite is part of the GitHub Actions validation workflow.
