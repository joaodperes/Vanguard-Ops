# PvP bot role loadouts

PvP bots in FFA, TDM, Kill Confirmed and CTF receive a role-based perk, an
archetype weapon and up to three compatible attachments. Perks and attachment
choices are selected at spawn through shared helpers in `src/lib/bot-loadouts.ts`
and used by both offline gameplay and the authoritative multiplayer server.

| Archetype | Perk themes | Attachment focus |
| --- | --- | --- |
| Rusher | Lightweight, Athlete, Quickdraw, Silent Steps, Field Loader, Scavenger, Tactician, Wonder | Hipfire laser, mobile grip, fast magazine |
| Rifleman | Field Loader, Quickdraw, Steady, Scavenger, Recon Visor, Well Prepared, Tactician, Wonder | Reflex optic, controllable muzzle, balanced magazine |
| Marksman | Steady, Recon Visor, Quickdraw, Scavenger, Silent Steps, Well Prepared, Wonder | Precision optic, accurate barrel, stability |
| Support | Field Loader, Steady, Scavenger, Explonando, Well Prepared, Tactician, Wonder | Higher capacity, stable grip, heavy barrel |

Every attachment goes through `compatibleAttachments(weaponId, slot)` first.
The bot may choose among recommended options for that *specific weapon*, and
falls back to legal options when a recommended one is unavailable. Magazine
capacity is calculated from effective stats on both first spawn and weapon
swap; damage, recoil, reload, range, spread and suppression use the same
effective-stat pipeline as human players.

Well Prepared bots select a second primary within their role when possible.
The second gun has its own attachment map and independent loaded magazine.
Switching guns selects that gun's attachments, never the previous gun's mods.
Temporary Wonders and other map pickups also do not inherit ordinary weapon
attachments. Gun Game overrides weapons and has *no* attachments or
loadout-changing perks.

Survival is intentionally unchanged: it still uses its curated weapons, perks,
and tactical equipment, with no weapon attachments. Battle-Hardened is still
banned for bots in all modes.

Relevant regression coverage: `tests/bot-loadouts.test.ts`.
