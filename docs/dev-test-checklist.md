# Vanguard Ops — QA and `dev` → `main` promotion checklist

**Status:** Canonical validation and manual playtest checklist. Use for integration work on `dev` and for reviewing the exact merge candidate before promoting to `main`. Automated checks are a gate, **not proof of gameplay balance, networking, or production database safety**. The archived feature plans are historical and do not replace this checklist.

## 1. Prepare the candidate

- Record the branch, head SHA, release scope and any schema/content changes. Check that the branch contains all intended feature merges.
- Review `git diff main...dev` and investigate divergent commits and merge conflicts before release; test the **resulting merged tree**, not just the source branch independently.
- Back up player data if `prisma/schema.prisma`, saved loadouts, progression counters or any persistence contracts changed. Check `DATABASE_URL` and resolve SQLite paths relative to `prisma/schema.prisma`. Never run `db:reset` on real accounts.
- Include any required schema update/migration and deployment order in the release plan.

## 2. Run automated validation

From the repository root on the intended candidate (using the approved local/test database):

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
bun install --frozen-lockfile
bun run db:generate
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```

`bun run test:smoke` runs the tests in `tests/`, including movement, bot navigation, collision/maps, gameplay mechanics, persistence, weapons and audio. Smaller entrypoints are `bun run test:movement`, `bun run test:maps` and `bun run test:bots`. Schema and reference validation is not a substitute for runtime integration.

GitHub Actions:
- `.github/workflows/dev-validation.yml` runs catalog validation, map tests, the complete Bun smoke suite, typecheck and build on pushes to `dev` or `main`, and PRs targeting those branches. It also supports manual dispatch and configured feature-branch pushes.
- `.github/workflows/afterlight-dev-validation.yml` separately runs map-focused validation for selected map changes pushed to `dev` or `main`, and supports manual dispatch.
- Inspect the status and logs of runs for the **candidate commit**, including failures and skipped jobs. Workflow availability on `main` begins once the workflow edits have been merged there.
- GitHub-hosted runs consume Actions allowance; check repository/org billing settings if required.

## 3. Manual controls and combat

Test desktop keyboard/mouse **and** touch/mobile:
- WASD starts, stops and reverses responsively; sprint thresholds, stamina, ADS and inversion behave as configured.
- Buffered and coyote-time jumps work without holding Space causing automatic bunny-hops. Stairs, raised platforms, lower cover, fall recovery and moving platforms do not clip or trap players.
- Pointer lock, scoreboard, kill feed, scope/crosshair, HUD, reload interruption, swapping, quick melee, perks and audio behave correctly.
- Shotguns and relevant snipers insert rounds incrementally; verify interruption, remaining ammo and online/server parity.
- Confirm damage falloff, accuracy, weapon attachments, per-weapon skins, ownership, saved loadouts, challenges, achievement rewards, Wonder recharge and deaths/respawns across match boundaries.
- Test weapon-specific behaviors: grenade/launcher splash, Bullet Spitter acquisition and destruction, Event Horizon, Plagueheart poison, Deadlock, Hellfire, Stormweaver and Bogfather. Cover and team rules must agree offline/online.
- At the Firing Range, inspect iron, red-dot and holographic ADS on the burst pistol, Hydra, Reclaimer, Plagueheart and LMGs: optics must stay attached to the receiver, the physical housing must agree with the HUD reticle, and the aim point must remain unobstructed. Confirm all gun bodies rise just below the crosshair without hiding targets.
- Fire Plagueheart at the furthest practice bot. Only targets within 2.75m of the *impact* should be poisoned; targets merely close to the flight path must remain unaffected. Repeat on an online room with latency.
- Confirm Stormweaver identifies as Shotgun in HUD/loadouts; seven pellets group tightly at short range, lightning arcs begin at a struck victim and jump between actual targets (never from the muzzle), and missed pellets become floor mines. Verify server/local hit parity.
- Inspect Event Horizon default Eventide-inspired finish and explicit skin overrides, Deadlock's targeting modules, Hellfire red/orange/yellow chassis and forward-directed muzzle flames. Check axe blade silhouette and melee reach visually, then compare LMG vertical recoil while hipfiring and ADS.
- Save, rename, equip and delete named loadouts in the Armory; Profile must not contain a duplicate edit surface.
- On a new guest and a new account, complete the tutorial's movement, ADS, target, reload and swap drills using desktop and touch controls. Escape must expose tutorial buttons; cancel a reload by swapping and verify it does not complete the reload task. Confirm the range awards no stats/XP/credits and does not change the equipped loadout.
- Skip, finish, save/leave and reload the tutorial; verify per-player checkpoints, resume from Profile, replay after completion and no repeated menu prompts. Confirm existing players are not forced into training, the Guide is absent, the Deploy area is gone, Play still works and account logout is inside Profile.

## 4. Map and bot acceptance

Check all six current map IDs and both Afterlight lighting editions:

| Map ID | Current map / primary risk |
| --- | --- |
| `bunker` | Blacksite — tight paths, collision and tactical cover |
| `shipyard` | Breakwater — container stacks, crane/dock routes and moving machinery |
| `compound` | Verdant Ruins — destructible breach and safe hazard telegraphs |
| `terminal` | Afterlight City (Day) — dense streets, interior rooms, roof access and park |
| `arena_neon` | Afterlight City (Night) — same current regions/spawns as Day; different lighting |
| `skybridge` | Ridgefall — **enclosed industrial steelworks factory**, gantries, freight gate and multi-height paths |

For each, exercise relevant modes with and without bots, including 3v3/5v5/7v7 where supported:
- Verify useful flanks, spawn clearance, time to first encounter, collision-backed cover, open passage through destroyed doors, hazard telegraphing and jump-pad landings where present.
- Traverse stair/roof connections as a player and follow bots climbing up, crossing and descending. Look for unreachable targets, path loops, headbanging, clipping, false shortcuts and soft-stuck recovery.
- Compare **the same map, difficulty and loadout** offline and in an online room. Test elevated targets, latency, reconnects, room creation/joining, player/team caps and authoritative damage.
- In both Afterlight editions, check identical footprint/spawn layout, street interiors, actual door openings, roof hatch/exterior stairs and park pavilion geometry. Confirm day/night materials do not change gameplay collision.
- On Ridgefall, inspect actual factory routes and freight/security gate. Old snowfield, rocky-outpost and outdoor-cliff checklists are historical, not release criteria.
- For authored changes, export Map Studio content and validate `src/data/map-blueprints.json`, matching theme JSON and client/server geometry. See [Map Studio](map-studio.md).

## 5. Survival, rewards and persistence

- Verify Solo Survival ends on death and Co-op downed operatives can use their secondary only, with correct rescue/round transitions.
- Confirm Survival wave length and rewards for each configured difficulty. Verify no unintended reinforcements, enemy spawn shields or bot-on-bot damage.
- Check Gun Game progression and Kill Confirmed enemy/friendly tag scoring.
- Validate guest and account login, profile persistence, credits, challenge counters, unlocks, purchase rejection, weapon-specific attachment/skin memory and import/export. Repeat after refresh, relogin and, where feasible, a second device.
- On a test copy of real data, review additive Prisma updates and legacy IDs; never use `db:reset` as a migration shortcut.
- Confirm XP-earned perks save when the legacy cached level is stale, including named presets and multiplayer. Unequipping Well Prepared must remove the second primary.
- In Profile, verify the PvP label reads "Non-Survival game modes" and title rewards appear on final achievement tiers in every section. Check existing final awards grant titles without new payouts, retired intermediate selections clear, locked titles cannot be equipped, and chosen titles persist into matches. Achievement IDs and earned records must remain intact.
- Compare rewards against `docs/economy-and-career-progression.md`. At level 36, verify that only fresh post-cap XP advances Career, a promotion charges once and resets its meter, titles require their Career rank, and old backups cannot refund promotions.

## 6. Performance and sign-off

- Record client FPS/frame time and memory across low-end hardware and high-bot-count matches; check game-server tick latency and logs.
- Record regressions with map/mode, bot count, build SHA, reproduction steps, expected vs observed behavior, console/server logs and a capture if useful.
- Do not promote until the merge-result automated pipeline is green, meaningful manual playtests are signed off and any production data migration has an approved backup/rollback plan.

### Release sign-off

- [ ] `dev`/merge-candidate SHAs and conflicts reviewed
- [ ] Content validation, Bun suite, TypeScript and production build pass on merge result
- [ ] Desktop, mobile, offline and multiplayer checks pass
- [ ] All current map layouts, bots, collisions and modes reviewed
- [ ] Progression, purchases, loadouts and important Wonder behaviors verified
- [ ] Performance and networking acceptable for intended release
- [ ] Database backup/migration and rollback are approved, if applicable
- [ ] `main` deployment/branch validation completed after merge

## Map Studio connected construction

- Place each wall/room/rooftop recipe in 2D and 3D; verify ghosts and grid intervals agree with the committed geometry.
- Attach stairs at every edge of 5u and 10u platforms; walk both ways, then move, resize, rotate, copy and undo the assembly. Test an elevated lower floor and missing headroom.
- Reproduce a tiny wall gap and a buried stair landing; verify measured markers, object selection and Close gap. Keep intentional openings available.
- Edit exact bottom/top faces of inherited boxes and stair groups without changing thickness.
- Place red/blue containers, recolor/resize one copy, save it to My assets, export/import its recipe library and confirm fresh instance IDs.
- Roundtrip all seven unified map documents, including Orbital Nexus. Confirm Afterlight day/night retain different footprints and serialize their visible shared props.
- Verify new editor/browser changes on touch and small screens. Walk actual player routes and check multiplayer reactor/client-server parity before promotion.
