# Operations campaign

Operations is a campaign destination with twelve linked missions in three
acts. Deploy solo or host a two-player co-op room; a partner can join from the room browser or invitation link. The standard six-mode selection grid and room browser remain separate from
the campaign. Missions reuse shipped jungle, factory, city (day/night), snow depot,
castle, dam and orbital geometry.

## Objectives

Gold diamonds mark the main objectives in the world and on the radar; white hollow
diamonds mark optional intel. The HUD adds direction, distance and above/below cues.
Standing at a site interacts automatically, with vertical checks preventing
interactions through floors. Each mission has its own named optional intel objective
and beacon, placed separately from its main objective sites. Nearby enemies contest
recovery, delivery and terminal progress.

- Clear: defeat the encounter. The beacon is a rally point, not an arena boundary.
- Secure: occupy the terminal site for its accumulated hold duration.
- Defend: hold a fixed two-minute upload while seven reinforcement groups arrive
  every 15 seconds. The hold timer continues under enemy pressure, but the stage
  cannot complete until all active defenders are eliminated.
- Recover: occupy the recovery site to pick up its mission package.
- Deliver: bring the actual carrier to the destination. If the carrier is downed,
  the package drops at their last known position and can be recovered after revival.
- Extract: eliminate the encounter and reach the extraction site for an uninterrupted
  countdown.

Every stage requires its encounter to be defeated. Timers never despawn living
opponents. Terminal/defence progress is retained when enemies contest the site;
extraction resets. Enemy budgets grow with mission intensity and objective number.
The existing Survival specialists, arsenal, elite, healing, damage and self-revive
systems supply combat. Operations can be deployed solo or in a two-player co-op
room. Co-op encounters scale to the squad size; both operatives can activate
objectives, recover intel and carry mission packages. Extraction requires every
living operative to reach the zone, while either operative can contribute to
secure/defend progress. Bot awareness is raised outside the opening stealth
approach. Bot difficulty is selected per deployment; Veteran is required for the
third campaign star. Later missions introduce engineers and disruptors sooner;
campaign objectives replace standard Survival's rotating objectives. Freight Intercept also has a timed optional alarm challenge: eliminate four guards within 45 seconds or later encounters receive more enemies. Operations does not use the Survival run-upgrade selection system.

## Campaign and rewards

Complete a mission to unlock the next; previous missions remain replayable. Earn
one star for completion, one for optional intel, and one for completing on
Veteran bot difficulty with no personal deaths. Every mission has the same 30-minute active-time deadline;
briefings and upgrade/menu pauses do not consume it.

First clears award a one-time payout per mission:
- Act 1: 150 XP and 75 credits.
- Act 2: 200 XP and 100 credits.
- Act 3: 250 XP and 125 credits.

Act finales also grant one permanent account reward on the first clear, independent
of stars: Act 1 unlocks the Wonder Weapon perk, Act 2 unlocks the Arc Pistol, and
Act 3 unlocks the Juggernaut Mk I Wonder Weapon. These entitlements are stored on
the player account and are not granted by importing browser progress. The Wonder
Weapon perk remains available through normal level progression at level 40 for
players who do not complete Operations. Arc Pistol remains a level-38 purchase
unlock for non-campaign progression; its Operations reward grants ownership
immediately. Bastion .45 moves to level 32, filling the existing double-unlock
level 18's second reward slot without moving another weapon's progression.

Replay clears can improve best time, rating and intel records but never repeat the
first-clear payout or act reward. XP follows the normal post-level-cap Career XP conversion;
credits are added to the player wallet, while Survival wave records are untouched.
Campaign progress and payout records are stored on the player
account; logged-in accounts follow the player across browsers and devices. Existing
browser records are imported idempotently, and pending completions retry after a
failed connection. Account sessions determine ownership. Guest player IDs retain
the existing guest API behaviour. Database changes are additive: run
`bun run db:push` when deploying.

## Implementation and QA

`src/lib/operations.ts` owns the typed mission roster, fixed deadline, first-clear
reward schedule, permanent act-finale rewards, `operationEncounter` and pure `tickOperation` reducer. Operations
run solo or in two-player networked co-op rooms. The room host controls mission
selection and campaign continuation; both players retain account-bound campaign
progress and earn their own star ratings based on personal deaths. Stable mission
IDs persist in player campaign records. Sites reference collision-checked authored
FFA spawn pads; these are mission beacons rather than new scenery assets. The
campaign whitelist permits its CTF-only maps without adding them to standard Survival.

Run the Operations tests, full smoke suite, typecheck, content validation and build.
Real-socket checks cover two-player co-op room creation, joining and difficulty
preservation. Unit tests cover mission objectives, deadline, star-criteria
breakdown, first-clear idempotency and account persistence. Human playtests remain necessary for combat pacing and route feel under
fire. There is no new map geometry or cinematic/NPC scripting system.
