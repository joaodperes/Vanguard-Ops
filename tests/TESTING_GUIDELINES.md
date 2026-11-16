# Regression test maintenance

Catalogs in `src/lib` and authored JSON map documents are the source of truth for
tunable values and content counts. Content expansions must not break CI merely
because a map prop, weapon, audio fader or ballistic panel was added.

- **Use catalogs as test inputs.** Derive expected counts from authored maps
  and the documented compilation/validation rules, not from memorized lengths.
  Check all published maps/weapon types instead of fixed subsets where possible.
- **Test independently meaningful behavior.** Data-driven tests must still
  catch regressions: unique stable IDs, safe spawns, movement/shot colliders,
  relative hipfire/ADS accuracy, isolated audio faders, restored flashbang
  hearing, and separately maintained ammunition.
- **Keep intentional design contracts explicit.** Hardcoded bounds are right
  when they represent an actual product requirement (e.g. a max player count,
  sightline limit, or deliberate weapon role). Such changes require review.
- **Maintain constructor-free fixtures in `tests/helpers`.** Creating
  `Object.create(FPSEngine.prototype)` skips class-field initialization.
  Initialize newly used subsystem state in shared helpers.
- **Test the same public runtime path as gameplay.** Do not import obsolete
  functions or assert a production helper directly equals itself.
- **Investigate first.** A red test may be a real bug, a stale fixture, or a
  changed contract. Never suppress the entire suite to force CI green.

Run `bun run test:smoke`, the configured TypeScript check and the
production build before merging.
