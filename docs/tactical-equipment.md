# Tactical Equipment — restored

Tactical is a fifth loadout choice, alongside Primary, Secondary, Melee and Perk/Wonder.
Select it in **Armory → Current Loadout → Tactical**, then **Confirm Loadout**.
The selection persists to `Loadout.equipmentId` and named saved presets; queued
loadout changes take effect on the next spawn.

- **G** uses the equipped item on desktop; **Tactical** button on touch.
  First-person hand animation releases the device during the throw.
- Frag/flash grenades bounce off world cover and explode after a 1.7s fuse, using
  map gravity. Projectile timestamps are transmitted for matching remote visuals.
- Frag, flashbang, taser and mine have 2 charges per life; throwing knives and
  poison darts have 3. Stock replenishes on death/respawn, not weapon swaps.
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

## Tactical bots
Archetype pools: rushers Flashbang/Knives, riflemen Frag/Taser, marksmen
Poison Dart/Knives, support Mine/Frag. Normal modes and Survival bots use
limited per-life charges, cooldowns, cover-aware trajectory planning,
non-protected line-of-sight targets and friendly blast safeguards. Proximity
mines are deliberately reserved for defensive situations. Gun Game bots do
not receive a tactical slot; Survival bosses retain their unique boss ability.
Online battles resolve damage, stun and explosions on the match server.
Offline matches simulate the same throw selection, including correctly owned
mines and bot-attributed kills.
