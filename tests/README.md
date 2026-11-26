# Automated validation

The repository keeps only generic catalog/schema contract tests:

- `catalog-contract.test.ts` checks catalog structure and stable identifiers.
- `content-catalogs.test.ts` checks data-agnostic catalog contracts.

Feature-specific tests that asserted gameplay balance, AI decisions, map presentation,
model geometry, audio behavior or other changeable design choices have been removed.

GitHub Actions has one validation workflow. It runs TypeScript syntax/type checking
and the content validator for authored data and file references.
