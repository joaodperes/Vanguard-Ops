# Vanguard Ops — weapon audio reference and acceptance guide

Updated: 2026-11-09. Target: `dev` (not production).

## Diagnosis

The browser currently synthesizes gunshots using short white-noise bursts and pitched oscillators. Those are inexpensive and reactive but lack the broadband midrange, metallic action and spatial decay of real shots. Raising master volume or bass alone will not restore that missing character. `WeaponAudio` now separates the **transient**, **midrange report**, **low pressure/body**, **receiver/bolt/pump action**, and **space-dependent reflection**. The map-wide acoustic space is a first approximation, not line-of-sight room classification.

**Implemented:** eight short **CC0 field-recorded firearm reports** have been bundled under `public/audio/weapons/`: two 9mm pistol takes, two SMG takes, two 12-gauge shotgun takes, and one each of 5.56mm and 7.62mm rifle reports. The renderer lazily decodes these local assets after audio unlock, varies the take/pitch, and blends them with synthetic low-end body, action and spatial reflections. The first shot and any failed asset load fall back to synthesis. **All conventional gun classes now have recorded reports** (ARs share 5.56mm, heavier DMR/sniper/LMGs share 7.62mm), but the latter do not yet have category-specific recordings. Suppressed and experimental weapons deliberately stay procedural. Exact upstream license/recordist notes are in [the asset manifest](../public/audio/weapons/SOURCES.md).

## Technique benchmarks

- Mark Kilborn (Pro Sound Effects), *How to Sound Design First-Person Shooter Gunshot Sound Effects*: separate body, transient, sub/LFE, mechanical, and tail layers. https://blog.prosoundeffects.com/how-to-sound-design-first-person-shooter-gunshot-sound-effects-with-mark-kilborn
- Modern Warfare sound team interview: shot layers, environmental reflections and variation based on surroundings and firing state. https://www.asoundeffect.com/call-of-duty-modern-warfare-sound/
- Watson Wu and Nick Dixon interview: distinct dry sound and external tail, with control over echo per environment. https://www.asoundeffect.com/battle-rifles-pistols-sound-effects-library/

## Libraries for a future recorded-sample pass

| Library | Best use | License / constraint |
| --- | --- | --- |
| [Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | Real pistol, rifle, shotgun and SMG recordings, multiple takes | **CC0** as stated by its authors; prepared archive is large (~194 MB), so trim and compress before inclusion. |
| [Tabasco Gunshot Sounds](https://opengameart.org/content/gunshot-sounds) | Reference for vintage rifle, pistol, shotgun | **CC0**; author notes the recorder clipped and some comments note heavy ambient noise. Audition/clean before use. |
| [OpenGameArt gun reload sounds](https://opengameart.org/content/gun-reload-sounds) | Action/bolt, shells, shotgun pump | **CC0**, credit appreciated but not required. |
| [Sonniss GDC archive](https://sonniss.com/gameaudiogdc/) | Professional-style layered impacts and reflections | Custom commercial-use license; **not CC0**. Allowed in finished games, but restricted standalone redistribution and AI training. Check the [license](https://sonniss.com/gdc-bundle-license/) before bundling. |

Do not rip audio from commercial games, video captures or YouTube. Do not commit an unprocessed third-party library, especially one with separate redistribution restrictions.

## Mix principles

1. **Immediate/local priority:** Muzzle transient should be sharp and broadband; sustained automatic-fire overlap should not flatten subsequent shots. No ADS volume penalty.
2. **Weapon identity:** SMG and PDW = tight snap; assault = punch and quick action; DMR = stronger dry report; sniper = dominant pressure pulse and long distant decay; shotgun = widest close blast and distinct pump; LMG = heavier repeated report. Electronic Wonder Weapons and bows retain bespoke signatures.
3. **Suppression:** Reduce **muzzle** crack/report/tail, not mechanically silence the bolt, slide, or receiver.
4. **Distance:** Roll off volume and top-end of remote fire, preserve positional pan; distant weapons must not overpower the local shot or footsteps.
5. **Maps:** Bunker maps use shorter stronger reflections; urban/industrial maps use medium slap; open maps have longer, lower-level tails. Later, replace map-wide proxy with geometric room and occlusion zones.
6. **Performance:** Bound voices, throttle tails and re-use noise buffers; avoid per-shot loading/decoding/network. Priority should go to local first-person weapon shots.

## Manual listening acceptance

- In the Armory **Firing Range**, audition VK-12, Kestrel/Vector, Breacher, Mauler CS, Marksman DMR, Longshot, Hailstorm, P-9, one suppressed gun and a sci-fi weapon.
- Compare **hipfire vs ADS**: no change in shot loudness.
- Fire sustained SMG/LMG bursts at normal master/FX volume and 100%: no clipped flat wall of noise, missing local shots or loudness runaway.
- Test with bots nearby, 15–30 units away and in the distance; confirm stereo direction, low-pass and reasonable volume decay.
- Test a bunker and a wide-open map to check reflections, plus dense 16v16 Floodgate to check CPU/voice limits.
- Compare against the pre-change sounds at **matched loudness**: the improvement should come from more audible texture and transient, not just being louder.

## Suggested reference asset workflow

For a further CC0 recorded pass, expand the real samples to ARs, DMRs, snipers and LMGs using 2–4 individual takes per family, remove dead air, clean peaks, and export trimmed mono/stereo Opus or Ogg assets rather than shipping multi-megabyte WAV archives. Normalize for the **mix**, not maximum loudness; align attacks to trigger timing, then blend under the existing procedural layers. Retain a `source-license.json` manifest with source URL, author, exact license and file hashes. Validate visual/audio sync in automatic fire, suppressors and networked shots before release.
