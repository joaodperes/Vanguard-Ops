# Automated validation guidelines

CI is deliberately restricted to checks that remain valid as game design and content evolve.

- Keep TypeScript compilation as the source syntax/type gate.
- Keep generic catalog/schema validation for supported shapes, stable IDs and cross-catalog references.
- Keep content validation for invalid values, missing IDs and broken authored references.
- Keep the production build as the deployability gate.
- Do not add fixed gameplay values, balance targets, AI decisions, model geometry thresholds,
  map presentation assumptions, audio expectations or feature-flow assertions to CI.
- Do not make CI depend on a particular weapon roster, attachment count, map composition,
  visual arrangement or tuning choice.
- When content references change, update the data and its canonical compatibility/reference
  definitions together; let generic validation catch genuinely dangling references.

`bun run test:smoke` runs only the generic catalog/schema contract tests.
