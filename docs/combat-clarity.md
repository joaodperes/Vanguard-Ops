# Combat clarity and weapon identity

Combat presentation is shared across offline players, bots and replicated effects.
`src/lib/combat-identity.ts` defines the mechanical cue colour, short text label
and counterplay hint for each shipped Wonder and experimental firearm. Regular
weapons retain their existing category accents and subtle amber ballistic traces.

The HUD's desktop and touch badges, default Wonder reactor/controller accents,
muzzle flashes, smart/cryo beams, storm arcs and field colours use these cues.
Existing physical silhouettes remain intact. Legendary finishes still coat models
where intended, but cosmetic emissives no longer recolour incoming traces.
Tracers use the source weapon's identity, penetration behaviour and range rather
than inheriting those properties from the viewer's currently held weapon. Turret,
drone and mech firing paths supply their own source identity too. Server-authored
beam/world effects no longer receive an additional generic bullet tracer.

Wonder audio has distinct spectral shapes and envelopes (gravity down-sweep,
rail discharge, storm crackle, cryo hiss and controller chirps). Playback retains
the existing spatial pan, distance attenuation, volume controls, peak guard and
voice limits. ADS does not reduce the report. Flame and deployed turret sounds
retain their established combustion and servo profiles.

## Nearby hazard warnings

At HUD cadence, `combat-threats.ts` selects up to two nearby, visible threats:
active gravity wells, flame/sludge fields, Stormweaver mines and pending mech
landing zones. Warnings have a directional arrow, mechanic name, distance or
DANGER label, and an action hint; colour alone never carries the warning.
Current danger takes priority over nearby hazards. Fields/mines on other floors,
expired effects, friendly effects and hazards hidden by solid cover are excluded.
Gravity uses spherical reach; ground hazards use horizontal reach with an elevation
check. Landing crush warns everyone, including the pilot and teammates.

Mine events and snapshots now carry optional owner identity and team metadata.
Old clients can ignore these additive fields. New clients omit mine warnings when
an old server does not provide ownership, rather than treating friendly mines as
enemies. Existing mine geometry is reused when later metadata supplies ownership.
No damage, timing, unlock, catalogue or persistence rules change.

## Validation and remaining playtests

`tests/combat-clarity.test.tsx` covers cue coverage, default model accents, sound
identity/ADS/distance, tracer source identity, network activation effects,
replicated mine ownership, hostile/friendly filtering, occlusion, floor separation,
spherical reach, arrow rotation, prioritisation, death cleanup, dense hazards, and
desktop/touch HUD rendering. The full smoke suite also exercises server multiplayer scenarios.

Before promoting to main, playtest a crowded online match and the firing range:
listen for each Wonder with and without ADS, check trails against bright and dark
maps, confirm warnings do not mask aiming, and compare touch layouts. Check a
late join with friendly and enemy mines. Browser visual/audio playtesting could
not run in the original implementation environment: local Chromium was denied its
required process socket, and the shared browser could not reach the local test server.
