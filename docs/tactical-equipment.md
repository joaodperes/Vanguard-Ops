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
