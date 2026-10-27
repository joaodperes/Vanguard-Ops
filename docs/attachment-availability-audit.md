# Attachment availability audit — 27 October 2026

Each count is the number of **distinct compatible attachment choices** for that weapon and slot, not simultaneous attachments. Zero means the slot has no choices in the current `dev` catalogs. Data derived from weapons, attachments, per-weapon compatibility and per-category defaults.

| Weapon | Category | Sight | Barrel | Grip | Magazine | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Event Horizon | dmr | 0 | 0 | 0 | 0 | 0 |
| Plagueheart | shotgun | 0 | 0 | 0 | 0 | 0 |
| Bullet Spitter | lmg | 0 | 0 | 0 | 0 | 0 |
| Electron Rifle | assault | 3 | 4 | 3 | 4 | 14 |
| Reclaimer Crossbow | dmr | 3 | 3 | 3 | 3 | 12 |
| Arc Pistol | pistol | 3 | 3 | 3 | 3 | 12 |
| Falcon SR | assault | 4 | 4 | 4 | 4 | 16 |
| Hydra Twin | assault | 4 | 4 | 4 | 4 | 16 |
| Cyclone DMR | dmr | 4 | 3 | 3 | 3 | 13 |
| Whisper DMR | dmr | 4 | 3 | 3 | 3 | 13 |
| Shock Baton | melee | 0 | 0 | 0 | 0 | 0 |
| Breacher Axe | melee | 0 | 0 | 0 | 0 | 0 |
| VK-12 Assault | assault | 4 | 4 | 4 | 4 | 16 |
| Kestrel SMG | smg | 4 | 4 | 4 | 4 | 16 |
| Breacher | shotgun | 3 | 3 | 3 | 7 | 16 |
| Marksman DMR | dmr | 4 | 3 | 3 | 3 | 13 |
| Longshot | sniper | 4 | 3 | 3 | 3 | 13 |
| Hailstorm LMG | lmg | 4 | 4 | 3 | 3 | 14 |
| Sidearm P-9 | pistol | 3 | 3 | 3 | 3 | 12 |
| Vector PDW | smg | 4 | 4 | 4 | 4 | 16 |
| Wraith Auto | shotgun | 3 | 3 | 3 | 7 | 16 |
| Magnum .50 | pistol | 3 | 3 | 3 | 3 | 12 |
| Scout Tactical | dmr | 4 | 3 | 3 | 3 | 13 |
| Tactical Knife | melee | 0 | 0 | 0 | 0 | 0 |
| Shiv | melee | 0 | 0 | 0 | 0 | 0 |
| Machete | melee | 0 | 0 | 0 | 0 | 0 |
| Sledge Hammer | melee | 0 | 0 | 0 | 0 | 0 |
| Burst Pistol | pistol | 3 | 3 | 3 | 3 | 12 |
| Machine Pistol | pdw | 4 | 4 | 4 | 4 | 16 |
| RL-7 Rocket Launcher | launcher | 3 | 3 | 3 | 3 | 12 |
| Scout Sniper | sniper | 4 | 3 | 3 | 3 | 13 |
| Reaver BR | assault | 4 | 4 | 4 | 4 | 16 |
| Behemoth AR | assault | 4 | 4 | 4 | 4 | 16 |
| Wasp PDW | smg | 4 | 4 | 4 | 4 | 16 |
| Mauler CS | shotgun | 3 | 3 | 3 | 7 | 16 |
| Executioner DMR | dmr | 4 | 3 | 3 | 3 | 13 |
| Vanguard LSW | lmg | 4 | 4 | 3 | 3 | 14 |
| Annihilator | sniper | 4 | 3 | 3 | 0 | 10 |
| Leviathan | lmg | 4 | 4 | 3 | 3 | 14 |
| Deadlock | dmr | 0 | 0 | 0 | 0 | 0 |
| Hellfire | lmg | 0 | 0 | 0 | 0 | 0 |
| Stormweaver | shotgun | 0 | 0 | 0 | 0 | 0 |
| Bogfather | shotgun | 0 | 0 | 0 | 0 | 0 |
| Ghost-18 | pistol | 3 | 3 | 3 | 3 | 12 |
| Bastion .45 | pistol | 3 | 3 | 3 | 3 | 12 |
| Mamba-9 | pdw | 4 | 4 | 4 | 4 | 16 |
| Sentinel-45 | pdw | 4 | 4 | 4 | 4 | 16 |
| Breach-2 | launcher | 0 | 0 | 0 | 0 | 0 |
| Swarm-3 | launcher | 0 | 0 | 0 | 0 | 0 |
| **TOTAL** | **49 weapons** | **124** | **117** | **113** | **123** | **477** |

## Review notes

- All Wonder Weapons and melee weapons have no attachment slots by design.
- Breach-2 and Swarm-3 launchers have zero slots in their weapon definitions. No attachments appear because the catalog explicitly disables them.
- The Annihilator sniper lacks a magazine slot but retains the other three slots.
- Each of the three ordinary shotguns has seven magazine-slot choices, including ammo types. This is above the 2–4 choices of most weapon-slot combinations and should be monitored for clarity/balance, not silently restricted.
- Counts include only catalog IDs that resolve to attachments in the matching slot. This audit does not change gameplay balance.
