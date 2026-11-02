# Vanguard Ops documentation

The root [README](../README.md) explains the game and local startup. These guides are maintained alongside the application source, but **only compiled application assets ship to browsers**; keeping a guide or a regression test in Git does not add it to the downloadable game bundle.

## Current instructions

- [Host a LAN/Tailscale party](lan-and-tailscale.md) — use the stable `main` branch; `dev` is for testing.
- [QA and release promotion](dev-test-checklist.md) — automated checks, manual testing and safe `dev` → `main` promotion.
- [Content and map authoring](content-authoring.md) — catalog source-of-truth, validation and JSON conventions.
- [Map Studio](map-studio.md) — editor documentation for developers (work may be ahead on `dev`).
- [Map modes and spawn safety](map-modes-and-spawns.md), [Floodgate](floodgate.md) and [Whiteout Depot](whiteout-depot.md) — active gameplay/map references.
- [Player economy](economy-and-career-progression.md), [Career contracts and Shop](career-contracts-and-shop.md) and [Prestige/Wonder Weapons](prestige-wonder-weapons.md) — progression and persistent-data compatibility.

## Historical design and implementation records

See [docs/archive](archive/README.md) for older feature-specific reviews, proposals and completed change logs, including Bullet Spitter. Use those for traceability, **not** as current balance or release specifications. Older documents remain available through Git history even if retired from the active index.

## Validation

The single full GitHub Actions workflow in `.github/workflows/dev-validation.yml` runs on both `main` and `dev`. It executes the complete `bun run test:smoke` suite, including the shipped Afterlight/Ridgefall and CTF regression tests. There is no need for a second map-only build workflow. Tests should remain in the repository as long as they guard shipped features.
