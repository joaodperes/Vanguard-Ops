# Weapon skin art briefs — 27 October 2026

Source of truth: `src/data/catalogs/weapon-skins.json`. Every art brief is displayed in the Armory.

| Finish | Intended appearance |
| --- | --- |
| Standard | Factory-issue graphite gunmetal; a practical satin receiver with dark grips and exposed mechanical details. |
| Arctic | Pale glacier-white ceramic plating over graphite grips, rails and mechanisms; clean cold-weather precision. |
| Crimson Edge | Deep oxblood-red coated receiver with subdued steel accents; aggressive and military rather than candy red. |
| Emerald | Dark emerald anodized metal over charcoal furniture; jewel-toned but grounded tactical finishing. |
| Carbon Fiber | High-contrast graphite and slate procedural carbon weave across the complete weapon body, stock and magazine, not merely accents. |
| Neon Pulse | Deep navy-black chassis, cobalt-blue surfaces and bright cyan illuminated rails and vents; dark rather than gold hardware. |
| Inferno | Smoked dark metal with hot ember-orange illumination; the impression of a weapon forged in a furnace. |
| Gold Standard | Warm satin gold-plated receiver with shadowed bronze and black rails, controls and grips; premium but mechanically legible. |
| Eventide | Animated midnight-indigo and violet starfield with drifting points of light and cool spectral glow. |
| Viridian Blight | Dark oxidized green with slowly moving acid-green mottling and subdued mint luminescence. |
| Cobalt Alloy | Deep blue alloy metalwork with dark steel furniture; available in the Credit Shop. |
| Void Circuit | Rich violet circuitry with soft lavender luminescence; exclusive to the Career Token Shop. |

## Rendering contract

- Gold Standard is plated gold with visible dark bronze/black hardware, model-specific inserts and readable mechanical detailing in first- and third-person.
- Animated Prestige camos coat the full model and have `Prestige` display rarity; original IDs and ownership are unchanged.
- Carbon Fiber now uses a high-contrast procedural canvas weave texture on both first-person and world weapon models. Dedicated artist-made normal/roughness maps are still future work.
- Custom non-default finishes override the signature-color inserts in stocks and magazine bases, preventing stray yellow/gold hardware.
- Viridian Blight requires all seven regular skin challenges; Eventide independently requires Weapon Mastery 5/5. Both together grant one Wonder Weapon unlock entitlement. Legacy Prestige earners keep both finishes.
