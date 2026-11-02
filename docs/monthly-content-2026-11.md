# November 2026 — Monthly nameplate collection

**PR base:** `dev` (content and Shop integration branch). `main` has a separate merge commit; this addition deliberately avoids merging or rewriting either integration branch.

## Why nameplates this month?

The live repository already has 51 weapons (42 standard and 9 Wonder), 49 attachments, 18 weapon finishes and 16 operative skins. Its cosmetic catalog has 10 reticles (2 free), 17 charms (1 free) and 9 nameplates (1 free). The Shop's nameplate category has only four Credit offers and four Career Token offers, versus nine and seven charm offers respectively. Nameplates are a compact, endgame-visible expansion that uses the existing renderer and purchase ledger without affecting combat balance.

| Inventory | Before | After |
| --- | ---: | ---: |
| Nameplate designs (including free Standard) | 9 | 13 |
| Credit Shop nameplates | 4 | 6 |
| Career Token Shop nameplates | 4 | 6 |
| Other cosmetic designs | Unchanged | Unchanged |
| Weapons / attachments | 51 / 49 | 51 / 49 |

## New designs and unlocks

| Design | Motif and readable label color | Price |
| --- | --- | --- |
| Verdant Signal | Emerald telemetry-grid `▦` | 9,000 Credits |
| Cinder Guard | Copper-orange frontline pennant `▲` | 13,500 Credits |
| Umbra Cipher | Indigo cipher diamond `◈` | 1 Career Token |
| Auric Horizon | Pale-gold sunburst `✺` | 2 Career Tokens |

All designs use the existing color-and-symbol nameplate renderer: the Profile frame and the in-world player name sprite share the same catalog definition. The selected achievement title remains independent. Color choices emphasize readability against the dark frame and distinguish these designs from the existing palette.

The server-authoritative Shop catalog provides prices and daily rotation. A purchased design is account-owned through `CareerShopPurchase`; `cosmeticShopOwnership` resolves its entitlement. The existing `/api/profile/cosmetics` endpoint validates ownership before equipping the Player's `selectedNameplate`. The active profile, match wire, multiplayer labels, backup/export/import and saved purchases reuse the existing IDs and paths. **No new database fields, currency, gameplay advantages or automatic unlocks.** Career Token-only purchases remain outside Collector completion.

## Validation and manual acceptance

Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck` and `bun run build`. `tests/monthly-nameplates.test.ts` checks unique IDs and presentation, Shop price mapping, no free entitlements, purchase-based ownership and daily rotation across both currencies.

Manual acceptance: wait for each design's daily rotation, purchase with the correct currency, equip under Profile → Customization, check name and title readability in Profile and above remote players, save/export/import and confirm ownership persists, and verify the other currency and free Standard nameplate still work. This change does not modify the renderer, so no new geometry or UI behavior is claimed.
