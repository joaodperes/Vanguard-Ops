# Survival, vertical AI and Bullet Spitter — implementation reference

## Survival

- **Standard/Normal Survival** is a finite 30-wave run. Other configured
  difficulty tiers continue with escalating wave milestones. The start HUD and
  scoreboard now use the appropriate name instead of "Endless Survival".
- Enemy wave spawns have **no spawn protection**.
- There is **no reinforcement currency** in Survival.
- Offline solo: a death ends the attempt.
- Online co-op: a downed player cannot move, can aim and fire their equipped
  **secondary only**, cannot use equipment or quick-melee, and cannot be
  targeted/damaged again. If all operatives are downed, the run ends.
- If a living teammate defeats the final enemy of the wave, the downed partner
  respawns at full health/weapon capacity during the next **preparation** phase.
- Survival bots target only living, non-downed human operatives, never other
  survival bots. Their aim tracks the full vertical elevation, rather than 60%.
- The height-aware route finder now has a stair-surface fallback when the
  target is above the bot, including Terminal's raised walkways.

## Weapon effective ranges

Ordinary firearm damage stays at 100% through its effective range
(`weapon.stats.range`). Between that range and 1.6x range the damage scales
down linearly to 60%. Server ray hit detection and cover still impose
physical hit limits. Attachments can alter the effective range.
Melee attacks and explosive splash have their own range/radius rules.

## Bullet Spitter

New third Wonder Weapon, purchased in the Prestige Arsenal for **one
Prestige token**. Equips in the **Primary** slot and deploys on trigger
instead of firing a handheld projectile, leaving the player free to fight
with secondary and melee weapons.

- One deployment charge, 55-second recharge, minus 2 seconds per *ordinary*
  weapon kill (not kills earned by the turret/Wonder Weapons)
- One deployed turret per player; deploying a replacement removes the previous
- 45-second lifetime; 140-degree horizontal sector (±70 degrees around
  placement orientation) and unrestricted vertical tracking
- 54m acquisition range; 34 damage per hit every 135ms while an enemy remains
  visible, in range and in the sector
- Cover and teams respected; multiplayer turret targeting/damage is
  authoritative on the game server, with placement, firing and removal
  effects broadcast to clients
- Rockets, explosive equipment and melee attacks destroy a turret
  immediately, not gradually via its health
- Bullet Spitter uses the existing Wonder recharge economy, persisting
  through death and weapon swaps, with no reserve ammunition

## Armory and match rewards

- "Equip weapon" is available on any owned weapon card; it saves the matching
  primary, secondary or melee slot directly.
- Prestige Arsenal now contains the universal recharge explanation only once.
- The standard firearm catalogue exposes **at least two compatible attachments
  per sight, barrel, grip and magazine**, each with a generated challenge.
  Melee and Wonder weapons intentionally remain without attachments.
- The Results screen now renders separate color-coded progress cards for
  daily, weekly, elite and per-weapon challenges, with before/after counters,
  goals and completion state, alongside existing achievement rewards.

## Validation before deploy

Run `bun run test:smoke`, `bun run typecheck` and `bun run build`.
Playtest on Terminal, both solo and a two-player Survival room. Specifically
verify stair routing, target acquisition and fire at bridge elevation, co-op
downed secondary-only actions, recovery at prep, no enemy spawn shields,
and no bot friendly-fire. Test Bullet Spitter's vertical firing and
explosive/melee destruction, including multiplayer with client/server
clocks and changing weapon slots.

**Status:** Committed directly to `dev`; actual game launch/build validation
has not been executed in this GitHub-only environment.
