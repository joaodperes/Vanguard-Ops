# Operations campaign

Operations is a campaign destination with twelve linked missions in three
acts. Deploy solo or host a two-player co-op room; a partner can join from the room browser or invitation link. The standard six-mode selection grid and room browser remain separate from
the campaign. Missions reuse shipped jungle, factory, city (day/night), snow depot,
castle, dam and orbital geometry.

## Objectives

Gold diamonds mark the main objectives in the world and on the radar; white hollow
diamonds mark optional intel. The HUD adds direction, distance and above/below cues.
Standing at a site interacts automatically, with vertical checks preventing
interactions through floors. Nearby enemies contest recovery, delivery and terminal
progress.

- Clear: defeat the encounter. The beacon is a rally point, not an arena boundary.
- Secure: occupy the terminal site for its accumulated hold duration.
- Defend: hold a longer upload while four reinforcement groups arrive at
  25-second intervals during a fixed two-minute hold. Newly due reinforcements cannot be skipped by a timer.
- Recover: occupy the recovery site to pick up its mission package.
- Deliver: bring the actual carrier to the destination. If the carrier is downed,
  the package drops at their last known position and can be recovered after revival.
- Extract: eliminate the encounter and reach the extraction site for an uninterrupted
  countdown.

Every stage requires its encounter to be defeated. Timers never despawn living
opponents. Terminal/defence progress is retained when enemies contest the site;
extraction resets. Enemy budgets grow with mission intensity and objective number.
The existing Survival specialists, arsenal, elite, healing, damage and self-revive
systems supply combat. Co-op deployments scale encounter size with the active squad. Bot awareness is raised outside the opening stealth approach.
Bot difficulty can be selected per deployment; the Veteran
setting is required for the third campaign star. Later missions introduce engineers and disruptors sooner;
campaign objectives replace standard Survival's rotating objectives. Operations does not use the Survival run-upgrade selection system.

## Campaign and rewards

Complete a mission to unlock the next; previous missions remain replayable. Earn
one star for completion, one for optional intel, and one for completing on
Veteran bot difficulty with no personal deaths. Every mission has the same 30-minute active-time deadline;
briefings and upgrade/menu pauses do not consume it.

First clears award a one-time payout per mission:
- Act 1: 150 XP and 75 credits.
- Act 2: 200 XP and 100 credits.
- Act 3: 250 XP and 125 credits.

Replay clears can improve best time, rating and intel records but never repeat the
first-clear payout. XP follows the normal post-level-cap Career XP conversion;
credits are added to the player wallet, while Survival wave records are untouched.
Campaign progress and payout records are stored on the player
account; logged-in accounts follow the player across browsers and devices. Existing
browser records are imported idempotently, and pending completions retry after a
failed connection. Account sessions determine ownership. Guest player IDs retain
the existing guest API behaviour. Database changes are additive: run
`bun run db:push` when deploying.

## Implementation and QA

`src/lib/operations.ts` owns the typed mission roster, fixed deadline, first-clear
reward schedule, `operationEncounter` and pure `tickOperation` reducer. Operations
run locally with one player; multiplayer room creation and joining reject campaign
mission IDs. Stable mission IDs persist in player campaign records. Sites reference
collision-checked authored FFA spawn pads; these are mission beacons rather than
new scenery assets. The campaign whitelist permits its CTF-only maps without adding
them to standard Survival.

Run the Operations tests, full smoke suite, typecheck, content validation and build.
Real-socket checks cover the solo-only restriction and standard room creation;
unit tests cover mission objectives, deadline, first-clear idempotency and account
persistence. Human playtests remain necessary for combat pacing and route feel under
fire. There is no new map geometry or cinematic/NPC scripting system.
