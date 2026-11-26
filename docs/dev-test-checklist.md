# QA and `dev` → `main` promotion

Use this checklist when reviewing a release candidate. CI catches TypeScript and
content/reference errors; it does not establish that gameplay feels correct,
multiplayer is reliable, or production data can be safely migrated.

## Automated validation

The repository has one workflow: `.github/workflows/dev-validation.yml`.
It runs on pushes and pull requests targeting `dev` and `main`:

1. Install dependencies from the checked-in Bun lockfile.
2. Generate the Prisma client.
3. Run `bun run typecheck` for TypeScript syntax and type errors.
4. Run `bun run content:validate` for catalog structure, IDs, references and
   authored content/file references.

For local validation:

```sh
bun install --frozen-lockfile
bun run db:generate
bun run typecheck
bun run content:validate
```

The catalog/content contract and reusable combat-rule tests run with
`bun run test:smoke` locally and in CI. They are not a substitute for manual
acceptance.

## Manual acceptance

For the changes in the release candidate, test the affected player-facing paths
in a real browser. Include desktop and narrow/mobile layouts where relevant.

- Exercise the changed feature from the player's normal entry point through
  completion, cancellation, retry and relevant failure states.
- Verify keyboard, mouse, touch and gamepad inputs where the feature supports
  them. Check focus loss, reconnects and held-input release.
- Test both offline and authoritative multiplayer behavior when the change
  affects combat, rooms, progression, rewards or shared state.
- Check map traversal, collision, spawn safety, objective access and bot routes
  for maps or modes touched by the change.
- Confirm account-backed progress, purchases, loadouts and rewards survive
  refresh/relogin and are not accidentally granted twice.
- Review console and server logs; check that client and game server are deployed
  together when protocol or shared runtime behavior changes.

## Release and persistence safety

- Record the exact `dev` head SHA and release scope.
- Review `git diff main...dev`, `git log main..dev` and
  `git log dev..main`. Resolve branch divergence deliberately; test the
  resulting merge candidate rather than assuming `dev` is a fast-forward.
- Review Prisma changes and their deployment order. Back up player data before
  schema changes; never run `db:reset` against real accounts.
- Confirm the production database URL and SQLite path. A successful build does
  not apply production schema changes.
- Open a normal pull request from `dev` to `main`; do not force-reset
  `main` or bypass divergence review.
- Inspect the workflow result for the exact candidate commit before promotion.

Automated checks are intentionally data-agnostic. Do not add fixed gameplay
balance, AI decision, map geometry or presentation assertions to CI merely to
make a particular content snapshot permanent. Keep manual acceptance focused
on the feature and design contracts being changed.
