# Bundled firearm reports — provenance and license

Eight short near-field firearm takes (WAV or MP3) are bundled as base64 text in this
folder. They are decoded once on the client by `WeaponAudio`; the original
recordings are unmodified from the upstream processed assets. Base64 is an
encoding of bytes, not a new audio format, so the CC0 attribution remains the
same. The gameplay weapon names are fictional and do not claim that the
recorded firearms are those exact models.

| Local asset | Original recorded firearm | Source recordings | License |
| --- | --- | --- | --- |
| `p226-report-{0,1}.wav.b64` | Walther PPQ 9mm | Near-field takes, The Free Firearm Sound Library | CC0 1.0 |
| `mp5-report-{0,1}.wav.b64` | Carl Gustav M45 / Swedish K 9mm SMG | Near-field takes, The Free Firearm Sound Library | CC0 1.0 |
| `sg-report-{0,1}.wav.b64` | Benelli Nova 12 gauge | Near-field takes, The Free Firearm Sound Library | CC0 1.0 |
| `rifle_556.mp3.b64` | AR-15 / M4-derived report (5.56 mm) | Edited clip, The Free Firearm Sound Library, via Fatal Funnel | CC0 1.0 |
| `rifle_762.mp3.b64` | AK-47-derived report (7.62 mm) | Edited clip, The Free Firearm Sound Library, via Fatal Funnel | CC0 1.0 |

**Primary source library and license:**
https://opengameart.org/content/the-free-firearm-sound-library

**Upstream edited/balanced copies:**
https://github.com/yegors/hard-lines/tree/main/public/audio

**Upstream audio attribution and editing notes:**
https://github.com/yegors/hard-lines/blob/main/public/audio/README.md

**Additional upstream rifle clips:** https://github.com/euuuuuuan/fatal-funnel-public/tree/main/apps/game/public/sfx (see [their credits](https://github.com/euuuuuuan/fatal-funnel-public/blob/main/CREDITS.md), including source hashes and CC0 permissions).

**Original recordists:** Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew
Nanney, as credited by the library. Upstream project reports its gunshot
clips are edited excerpts of CC0 field recordings; the `.wav.b64` versions
here preserve those exact excerpts.

The engine does **not** stream from GitHub or OpenGameArt. These eight clips ship
as static assets under `public/`. If local fetching or decoding fails, the
procedural gunshot layers continue to work, including when offline. Suppressed
and experimental weapons deliberately use the procedural soundpath, avoiding
the inappropriate unsuppressed muzzle report.

Before substituting any additional recording, record its origin, author,
license, editing, and URL here. No commercial-game rips or audio with
uncertain redistribution terms.
