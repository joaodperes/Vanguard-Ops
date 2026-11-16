# Tactical Equipment — restored

Tactical is a fifth loadout choice, alongside Primary, Secondary, Melee and Perk/Wonder.
Select it in **Armory → Current Loadout → Tactical**, then **Confirm Loadout**.
The selection persists to `Loadout.equipmentId` and named saved presets; queued
loadout changes take effect on the next spawn.

- **G** uses the equipped item on desktop; **Tactical** button on touch.
  First-person hand animation releases the device during the throw.
- Frag/flash grenades bounce off world cover and explode after a 1.7s fuse, using
  map gravity. Projectile timestamps are transmitted for matching remote visuals.
- Frag, flashbang, proximity mines and throwing knives have 2 charges per life;
  tasers and poison darts have 3. Stock replenishes on death/respawn, not weapon swaps.
- Gun Game disables loadout tactical equipment.
- Socket messages contain **intent only**, never item ID or damage. The server
  reads the persisted choice, validates charges, cooldown, aim and victim teams,
  and acknowledges remaining stock. Offline uses corresponding local effects.
- Legacy accounts/presets default to Frag Grenade. The additive Prisma field
  is applied with `bun run db:setup` or the normal `bun run dev` database push.

Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck`
and `bun run build`. Manually playtest desktop and touch controls, wall/floor
bounces, self-flash, mine triggers, room charge sync, refill after death,
and preset/queued loadout application.

 
## Progression and free trials
Tactical gear is unlocked automatically at account levels: Frag (1), Flashbang (5),
Proximity Mine (10), Throwing Knives (15), Taser (20), Poison Dart (25).
There is no credit purchase. The Armory disables locked options, the loadout
API rejects locked submissions, and match joins validate against the player's
actual XP. Legacy selections above the player's level safely equip Frag.
Saved presets retain tactical choices.

Firing Range is a private, free practice space with every tactical available
even when not yet unlocked. Trial Loadout starts with the active or named
preset's gear; Apply & Restart Test replenishes its stock. Trial choices do not
alter the account.

## New-player tutorial

The starting training loadout explicitly includes Frag Grenades. The tutorial
now has six drills, finishing with a real grenade throw verified by decreasing
HUD charge stock. It uses the same **G** key / touch **Tactical** button as
normal matches. The five-slot loadout briefing explains per-life charges,
respawn refills, the Armory selection and Gun Game's tactical restriction.
The firing-range tutorial never changes progression or consumes permanent gear.

## Tactical bots
Archetype pools: rushers Flashbang/Knives, riflemen Frag/Taser, marksmen
Poison Dart/Knives, support Mine/Frag. Normal modes and Survival bots use
limited per-life charges, cooldowns, cover-aware trajectory planning,
non-protected line-of-sight targets and friendly blast safeguards. Proximity
mines are deliberately reserved for defensive situations. Gun Game bots do
not receive a tactical slot; Survival bosses retain their unique boss ability.
Online battles resolve blast damage, flash visibility effects and ADS disruption on the match server.
Offline matches simulate the same throw selection, including correctly owned
mines and bot-attributed kills.

## Combat tuning (November 2026)
Frag has a 12-unit damaging blast (140 maximum, diminishing with distance),
Flashbang covers 14 units and causes a whiteout and reduced hearing for
1.4–3.6 seconds depending on distance and line of sight. It never stuns: players
retain movement, sprint, ADS, firing, reloading and tactical controls. Both
audio engines are reduced and return to the chosen volume as the flash fades.
Bots temporarily lose sight/hearing but continue navigating. Throwing Knives are direct-hit lethal against ordinary operators,
including normal Survival enemies; Survival bosses resist instant takedowns.
Proximity Mines activate only when an opponent enters 1.55 units in line of
sight: exactly that triggering opponent receives a lethal direct hit, while
anyone else can take at most 38 splash damage within 2.4 units.
Tasers deal 25 HP damage and disable ADS for 2.4 seconds (movement, sprint,
hip-fire, reload and other controls continue to function). The electric arcs
stay visible on shocked opponents, while the victim sees a distinct ADS JAMMED
status. Server checks ignore malicious ADS flags throughout the effect.
Frag and other tactical kills retain the real thrower in kill feed and death
screen, with correct tactical weapon names rather than environmental labels.

## Projectile visibility
Airborne Frag, Flashbang, Throwing Knives, Taser and Poison Dart use brighter
readable 3D models with compact color-coded halos and direction-aware tapered
streaks. The highlights are depth-tested (not visible through walls), use no
dynamic lights or per-frame geometry allocation, and are disposed after flight
or when a match ends. The same renderer handles offline and network throws;
trajectory, fuse, collision and damage remain unchanged. Mines retain their
ground-level armed beacon rather than an airborne tracer.
