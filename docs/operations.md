# Operations campaign

Operations is a separate menu destination with twelve linked missions in three
acts. The six-mode selection grid and standard mode/map lists remain unchanged.
Missions reuse shipped jungle, factory, city (day/night), snow depot, castle, dam
and orbital geometry. Deploy solo locally or host a two-slot co-op room. Partners
join through Play → Browse or a room invitation. Co-op guests may accompany a host
on a later mission without first unlocking it locally.

## Objectives

Gold diamonds mark objectives in the world and on the radar; white hollow diamonds
mark optional intel. The HUD adds direction, distance and above/below cues. Standing
at a site interacts automatically, with vertical checks preventing interactions
through floors. Nearby enemies contest recovery, delivery and terminal progress.

- Clear: defeat the encounter. The beacon is a rally point, not an arena boundary.
- Secure: occupy the terminal site for its accumulated hold duration.
- Defend: hold a longer upload while up to three reinforcement groups arrive at
  25-second intervals. Newly due reinforcements cannot be skipped by a timer.
- Recover: occupy the recovery site to pick up its mission package.
- Deliver: bring the actual carrier to the destination. Death or disconnect drops
  the package at the last known carrier position for a partner to retrieve.
- Extract: eliminate the encounter and gather every surviving player at the site
  for an uninterrupted countdown. Fallen players do not block evacuation.

Every stage requires its encounter to be defeated. Timers never despawn living
opponents. Terminal/defence progress is retained when a player leaves or enemies
contest the site; extraction resets. Enemy budgets grow with mission intensity,
objective number and squad size. The existing Survival specialists, arsenal, elite,
healing, damage and self-revive systems supply combat. Later missions introduce
engineers and disruptors sooner; campaign objectives replace standard Survival's
rotating objectives. Players choose a run upgrade after each objective; upgrades
reset on a new deployment. Co-op players recover between objectives. Wipes fail.

## Campaign and rooms

Complete a mission to unlock the next; previous missions remain replayable. Earn
one star for completion, one for optional intel, and one for beating par time with
no personal deaths. Active timers exclude briefings, prep and upgrade/menu pauses;
each mission aborts after twice its par time. Records retain best time, best rating,
intel and completion count per player key in this browser. They do not sync between
devices. Storage failures are reported.

The party and room ID persist through results. Once results have saved for everyone,
the host can replay the mission or, after victory, launch the next campaign mission
without splitting the group. Campaign rooms have fixed mission maps and are excluded
from ordinary Quick Play. Campaign results bypass `/api/match/complete` and cannot
award career XP/currency, rotating challenges or Survival records. Leaving the room
for a menu ends that party connection, as with normal matches.

## Implementation and QA

`src/lib/operations.ts` owns the typed roster, `operationEncounter` and pure
`tickOperation` reducer, used by both offline engine and server. Stable mission IDs
persist in local campaign records. Sites reference collision-checked authored FFA
spawn pads; these are mission beacons rather than new scenery assets. The campaign
whitelist permits its CTF-only maps without adding them to standard Survival.
Server validation rejects unknown/mismatched mission, mode, map and tier values;
clients cannot submit objective progress. Final shared state precedes the verdict.

Run the Operations tests, full smoke suite, typecheck, content validation and build.
Real-socket checks cover campaign configurations, fixed maps, Quick Play isolation,
shared objectives, readiness, squad retention, replay and next-mission transitions.
Human playtests remain necessary for combat pacing, route feel under fire and real
co-op latency. There is no new map geometry or cinematic/NPC scripting system.
