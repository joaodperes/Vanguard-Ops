# Weapon rarity and perk progression

Implementation: this branch is based on `dev`.

## Unlock cadence

Battle-Hardened is the only level-1 perk. Standard perk choices then arrive
every three levels through Tactician at level 34. Wonder Weapon is the level-40
capstone for players following standard progression, but Operations Act 1 grants
it early as a permanent account entitlement. The perk menu is sorted in unlock
order and identifies the Act 1 reward.

| Level | Perk | Effect |
|---:|---|---|
| 1 | Battle-Hardened | Default; health regeneration begins sooner |
| 4 | Field Loader | Reload/vent heat while sprinting |
| 7 | Recon Visor | Increased radar gunfire tracking |
| 10 | Quickdraw | Faster swap/reloads |
| 13 | Lightweight | Increased movement and jump |
| 16 | Steady | Recoil/sway reduction |
| 19 | Athlete | Increased stamina |
| 22 | Scavenger | Elimination drops fully reload only the currently equipped conventional firearm |
| 25 | Explonando | Drop a timed explosive upon death |
| 28 | Well Prepared | Swap sidearm for a distinct, purchased, non-Wonder primary |
| 31 | Silent Steps | Suppress your footstep sounds; gunfire and other actions remain audible |
| 34 | Tactician | Regenerate one tactical charge every 18 seconds |
| 40 | Wonder Weapon | Trade the passive perk for an owned Wonder Weapon in slot 4; also awarded by Act 1 |

The selected perk and Act 1 entitlement are stored on the player account. Level
and campaign entitlements are validated by the web loadout API and multiplayer
game server.

## Weapon rarity bands

Weapon unlock requirements are rebalanced using the Armory's established
**credit-cost rarity tiers**, without increasing purchase prices or revoking
historical ownership:

- Common (under 800 CR, including three starters): levels **1–10**
- Rare (800–1999 CR): levels **11–32**; Bastion .45 is deliberately moved to level 32.
- Epic (2000–3499 CR): levels **30–38**; Arc Pistol is a level-38 purchase for non-campaign players.
- Legendary (3500+ CR): level **39** (RL-7 Rocket Launcher).

Operations also grants Arc Pistol permanently at Act 2 completion and the
Juggernaut Mk I Wonder Weapon permanently at Act 3 completion. These act rewards
do not require stars. The Bastion move uses the second level-18 unlock slot:
Cyclone DMR remains at 18, while Bastion moves to 32.

These levels are *minimum purchase availability*, not automatic grants for
paid weapons. Previously owned weapons remain owned even if their new level
is higher than the player's current level. Result screens show when a level-up
reveals purchasable weapons or perks.

## Explonando

At every legitimate death with Explonando active, one orange charge appears
at the death location, then explodes **2 seconds** later.

- Radius: **6.5 m**; up to **110 damage** at the center with distance falloff
- Cover blocks the blast; spawn protection still applies
- Does not damage its owner or teammates in team-based matches
- The multiplayer server creates the charge, broadcasts its fuse/FX,
  and applies damage authoritatively; offline applies identical damage rules
- Bomb kills credit the owner for eliminations but cannot advance Gun Game
  weapon tiers or accelerate Wonder Weapon recharge
- Pending bombs are removed on match cleanup

## Well Prepared

At level 28, selecting Well Prepared allows any other **owned standard primary
weapon** to be equipped in the Secondary slot instead of a sidearm. Wonder
Weapons are excluded to avoid two-recharge-weapon stacking. The second gun has
its own ammo, reload state, attachments, camo and swap controls. Primary and
secondary IDs cannot be equal. The Armory loadout card can open the second
gun's customization in the Secondary slot.

Unequipping Well Prepared causes the secondary selection to revert to the
starter pistol on save, and game launch applies an additional perk gate.
The web API verifies level/ownership and the multiplayer server checks the
player's actual level and saved equipment.

## Validation

Run:

```sh
bun run test:smoke
bun run typecheck
bun run build
```

Check Explonando in bot matches and a multiplayer room (fuse, kill feed,
team immunity, kill credit and marker removal). Save a second primary, swap,
reload each gun independently, customize its *secondary* attachments, then
remove Well Prepared and confirm the backup becomes a pistol. Check old
purchased high-tier weapons on an account under their new required level.

The later save fix derives all perk entitlements from XP rather than the stale
`Player.level` cache and includes named presets and the socket server. See
[Economy and Career progression](economy-and-career-progression.md) for the
updated curve, payout values, Career track and validation scope.
