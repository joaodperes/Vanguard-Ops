# Automated validation policy

Automated checks are intentionally limited to data-agnostic contracts:

- TypeScript compilation checks source syntax and type consistency.
- Catalog contract tests validate schemas, stable IDs, supported keys and references.
- Content validation checks catalog values, IDs, cross-catalog references and authored map references.
- The production build verifies that the application can be compiled for deployment.

Gameplay tuning, weapon balance, AI decisions, map geometry presentation, model continuity,
audio feel and other subjective or frequently changing feature behavior are not CI test gates.
Do not add hardcoded snapshots or numerical design assertions for those areas.

`bun run test:smoke` runs only the generic catalog/schema contract tests.
