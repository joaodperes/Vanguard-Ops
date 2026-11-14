# Survival specialists and objective waves

Offline solo and authoritative online solo/co-op use shared encounter rules in
`src/lib/survival-encounters.ts`. Existing progression, rewards, bosses, elites,
mutators and the six-mode selector remain compatible. There is no database or
catalog migration. Deploy the client and server together for the new snapshots.

| Specialist | First wave | Behavior | Counterplay |
| --- | --- | --- | --- |
| Shield | 3 | 1.5× ordinary health; frontal body damage reduced to 35% | Gold chest plate; flank or aim for the head |
| Medic | 5 | Heals visible allies within 9m by up to 18 HP every five seconds | Green cross; eliminate before its squad |
| Engineer | 7 | Deploys a destructible sentry after six seconds; replaces it every 18 seconds | Blue backpack; destroy the turret or kill its owner |
| Disruptor | 9 | Damaging 7m pulse every nine seconds, first after four | Purple badge and 2.2 second warning ring; retreat or break line of sight |

Specialists replace a minority of ordinary wave slots and never replace bosses
or elites. Medics cannot heal themselves, revive dead allies, heal through
cover or exceed the target's original wave health. Healing, deployment and
pulses pause with the simulation and stop on death. Sentries reuse the existing
placement, shooting, destruction, lifetime and replication paths. Pulse damage
respects difficulty and defensive upgrades. Shield protection is a directional
damage rule, with headshots and flanking bypassing it; it does not block movement.
Names, distinct shapes, wave-start hints and ability effects supplement colors.

Every fourth wave introduces a required objective, rotating between:

1. **Defend relay A:** accumulate 15 seconds within 3m, without enemies within 5m.
2. **Supply delivery:** collect at A and deliver to B. Only the carrier can
   deliver; death, downing or disconnect returns supplies to A for a survivor.
3. **Separated terminals:** activate A for three seconds, then B for three seconds.

Sites use authored FFA spawns, with the second site at least 8m away. Small maps
without distinct sites fall back to a relay; maps without any sites skip the
objective. Proximity uses all three axes and line of sight, preventing work
from another floor or through a wall. Co-op does not double channel speed.
Leaving a relay or terminal preserves progress. Boss waves skip objectives;
Standard still ends after wave 30.

A wave clears only after both the objective and enemies are finished. Objectives
have no failure timer and can be finished after eliminating the wave. Cyan ground
rings, labelled beacons visible through cover and HUD instructions/distance
identify the active site. No new input binding is needed, including on touch.
World markers clear on completion and during preparation.

`tests/survival-encounters.test.ts` covers role introduction, armor and actual
offline damage, healing limits, cooldowns, objective rotation, floor/cover
separation, contesting, carrier loss, two-site activation, co-op channel speed
and the offline wave-clear gate. Human playtests should focus on specialist
combinations, sentry pressure on narrow maps and objective travel on vertical maps.
