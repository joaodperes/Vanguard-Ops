# Attachment balance pass — November 2026

Implemented on `dev`. This is a tuning baseline for further firing-range and PvP evaluation, not a claim of established balance.

## Design rules
1. Attachments are trade-offs, not strictly increasing upgrade tiers. Price and unlock level gate progression but do not balance PvP after purchase.
2. A drawback must matter to the weapon. Single-shot snipers are not adequately balanced by extra recoil.
3. Ballistic range must not be granted by optics; sights alter magnification/reticle/ADS precision or acquisition.
4. Hipfire dispersion and ADS dispersion are separate mechanics. Hipfire-only lasers never buff ADS.
5. Category-specific effects override generic percentages, with the final computed values shown in the Armory.

## Magazines (base -> class-specific)
All stats are percentages applied to base weapon values. Magazine counts round to the nearest whole round.

| Attachment | Default | Category overrides |
|---|---|---|
| Extended | +30% rounds, +10% reload time, -2% movement | LMG +20% rounds, +14% reload, -4% move, +6% ADS; SMG/PDW +25%, +12%, -4%; DMR +25%, +10%, -3%; pistol +25%, +8%, -2%; sniper +20%, +12%, -3% |
| Quickdraw | -25% reload time, -10% rounds | Shotgun -22% reload, -15% rounds; sniper -20%/-15%; LMG -22%/-10%, -1% movement |
| Balanced | +15% rounds, -10% reload | SMG/PDW +12%/-10%; LMG +10%/-8%, -2% move; sniper +15%/-8% |
| Lightweight | +6% move, -20% rounds | Sniper +5% move, -25% rounds, -5% ADS time; pistol +5% move, -20% rounds |
| Drum | +65% rounds, -7% movement, +30% reload, +10% ADS | LMG +35%, -10%, +35%, +14%; SMG/PDW +60%, -9%, +32%, +12% |

**Shotguns:** Shell Carrier is a side-saddle holder for spare shells. It provides -16% reload time and -1% movement, *not* +25% tube capacity. It competes against Quickdraw (-22% reload but -15% capacity) and special shell types in the magazine/ammunition slot.

**Launchers:** No generic extended magazines. Instead choose Rapid Loader (-22% reload, +12% ADS), Heavy Warheads (+8% damage, +18% reload, -5% movement), or Lightweight Rocket Payload (-15% damage, -12% reload, +5% movement). Single-shot launchers stay single-shot.

**Crossbow:** Heavy Arrows now yield +65% (not +190%) damage, with two recoverable bolts and slower rate. Piercing Bolt Head grants real body-to-body penetration (not wall penetration).

## Heat weapon framework
`WeaponSpecial.kind === "heat"` selects the reusable heat barrel and heat-magazine choices, unless an exact-weapon compatibility override supplies its own list. Heat attachments are marked `heatOnly` and cannot be applied to other weapons, even via stale loadout data.

`effectiveHeatConfig(weapon, attachments)` computes per-attachment heat percentages and is used by **both** the browser simulation and authoritative server for pulse generation, passive cooldown and manual vent timing.

| Slot | Attachment | Benefits / drawbacks |
|---|---|---|
| Barrel | Thermal Heat Sink | +24% passive cooling; -3% movement, +8% ADS time |
| Barrel | Focused Emitter | +8% range, -12% aimed dispersion; +20% heat per shot |
| Barrel | Compact Emitter | +5% movement, -12% ADS time; -18% passive cooling |
| Magazine | High-Capacity Heat Reservoir | -22% heat per shot; -12% cooling, -2% move |
| Magazine | Rapid Vent Module | -30% manual vent time; +10% heat per shot |
| Magazine | Active Coolant Cell | +32% passive cooling; +8% heat per shot, -3% movement |
| Magazine | Lightweight Energy Cell | +6% movement; +18% heat per shot |

The Armory replaces irrelevant magazine/reload values with heat/pulse, cooling rate, cooldown delay and vent time. Heat modules are content-driven: future heat-based guns can share the mechanic, then override individual choices as needed.

## Other notable changes
- Heavy Barrel no longer increases direct damage. It improves stability and effective range but slows ADS and movement. This removes its accidental one-body-shot sniper breakpoints.
- Long-range optics no longer modify damage falloff range; zoom, reticle overlays and ADS precision remain.
- Suppressor wording and muzzle flashes now reflect *reduced* report, not magical silence.
- Laser Sight and Laser Grip are genuinely hipfire-only.
- Run-and-Gun Grip renamed **Sprint ADS Grip** to reflect the implemented action; sprinting still blocks firing.
- Beanbag Rounds renamed **Rubber Buckshot**: the existing five-projectile effect is more consistent with that name.
- Annihilator specialist chambers are less dependent on inconsequential recoil-only penalties.
- Attachment display chips resolve category overrides and list heat percentages and penetration effects.

## Test matrix and watchouts
Run: `bun run content:validate`, `bun test tests/attachment-balance-and-heat.test.ts`, `bun run test:smoke`, `bun run typecheck`, `bun run build`.

For manual tests:
- Compare the VK-12, a 100-round LMG, an SMG, pistol and bolt-action sniper with each magazine.
- Count body shots required for kills at 0m/medium range/falloff edges with and without Heavy Barrel.
- Check Electron consecutive pulses, recovery after release, deliberate vent and weapon swap, online and offline.
- Confirm that launcher capacity stays at its baseline and shotgun reload behaves per shell.
- Confirm Laser Sight affects only hipfire and suppressor audio/radar/flash effects are consistent.

**Compatibility note:** Changing the legal attachment lists may leave an older saved Electron/launcher setup pointing to an obsolete attachment. Such attachments are intentionally ignored by the stats resolver. Players can clear and re-equip a legal module in the Armory; stored ownership is not deleted.
