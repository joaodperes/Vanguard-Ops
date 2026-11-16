import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const menu = readFileSync("src/components/game/InGameMenu.tsx", "utf8");
const picker = readFileSync("src/components/game/SavedLoadoutPicker.tsx", "utf8");
const canvas = readFileSync("src/components/game/GameCanvas.tsx", "utf8");
const route = readFileSync("src/app/api/loadout/route.ts", "utf8");

describe("in-match saved loadout selection", () => {
  test("Escape menu allows only existing presets, not editing weapons or perks", () => {
    expect(menu).toContain("<SavedLoadoutPicker");
    expect(menu).not.toContain("<LoadoutSelector");
    expect(picker).toContain("profile?.savedLoadouts ?? []");
    expect(picker).toContain("presets.map(preset =>");
    expect(picker).not.toContain("/api/loadout/presets");
    expect(picker).toContain("No saved loadouts");
  });

  test("equips a saved preset ID via the validated API before queuing a kit", () => {
    expect(picker).toContain('body: JSON.stringify({ playerKey, presetId })');
    expect(route).toContain("parseSavedLoadouts(owner.loadout?.savedLoadouts).find(p => p.id === rawBody.presetId)");
    expect(picker.indexOf("if (!response.ok)")).toBeLessThan(picker.indexOf("onPresetEquipped(updatedProfile, presetId)"));
    expect(canvas).toContain("const queueSavedLoadout = (profile: PlayerProfileView, presetId: string)");
    expect(canvas).toContain("engineRef.current?.queueLoadout(wire)");
    expect(canvas).toContain("setQueuedPresetId(presetId)");
  });

  test("keeps Gun Game selection for future matches and never offers in-match editing", () => {
    expect(picker).toContain('mode === "gungame"');
    expect(picker).toContain("Gun Game controls your weapons");
    expect(menu).toContain("Choose a saved preset for your next match");
  });
});
