# Weapon rarity and perk progression

Implementation: directly on `dev`.

## Unlock cadence

There is a perk choice at level 1 and a new perk every three levels
thereafter. The perk menu is sorted in unlock order and shows locked levels.

| Level | Perk | Effect |
|---:|---|---|
| 1 | Battle-Hardened | Starter; health regeneration begins sooner |
| 4 | Field Loader | Reload/vent heat while sprinting |
| 7 | Recon Visor | Increased radar gunfire tracking |
| 10 | Quickdraw | Faster swap/reloads |
| 13 | Lightweight | Increased movement and jump |
| 16 | Steady | Recoil/sway reduction |
| 19 | Athlete | Increased stamina |
| 22 | Scavenger | Collect dropped ammunition |
| 25 | Explonando | Drop a timed explosive upon death |
| 28 | Well Prepared | Swap sidearm for a distinct, purchased, non-Wonder primary |
| 31 | Silent Steps | Suppress your footstep sounds; gunfire and other actions remain audible |

The current perk selection is stored on the browser; level entitlement is
validated on both the web loadout API and the multiplayer game server.

## Weapon rarity bands

Weapon unlock requirements are rebalanced using the Armory's established
**credit-cost rarity tiers**, without increasing purchase prices or revoking
historical ownership:

- Common (under 800 CR, including three starters): levels **1–10**
- Rare (800–1999 CR): levels **11–29**
- Epic (2000–3499 CR): levels **30–35**
- Legendary (3500+ CR): level **36** (RL-7 Rocket Launcher)

These levels are *minimum purchase availability*, not automatic grants for
paid weapons. Previously owned weapons remain owned even if their new level
is higher than the player's current level. Result screens show when a level-up
reveals purchasable weapons or perks.

## Explonando

At every legitimate death with Explonando active, one orange charge appears
at the death location, then explodes **2 seconds** later.

- Radius: **5 m**; up to **90 damage** at the center with distance falloff
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

**Status:** Code and regression tests have been committed to `dev`; the
build and smoke tests have not been executed in this environment.
