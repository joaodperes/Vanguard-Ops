import { expect, test } from "bun:test";
import { useSettings } from "../src/lib/settings-store";

test("overhead health bar preference defaults on, persists, loads and resets", () => {
  const previousWindow = (globalThis as any).window;
  const previousStorage = (globalThis as any).localStorage;
  const values = new Map<string, string>();
  (globalThis as any).window = {};
  (globalThis as any).localStorage = {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
  };
  try {
    useSettings.getState().reset();
    expect(useSettings.getState().settings.showHealthBars).toBe(true);
    useSettings.getState().update({ showHealthBars: false });
    expect(useSettings.getState().settings.showHealthBars).toBe(false);
    expect(JSON.parse(values.get("vanguard_settings")!).showHealthBars).toBe(false);
    useSettings.getState().load();
    expect(useSettings.getState().settings.showHealthBars).toBe(false);
    // Older browser settings without this option keep the default.
    values.set("vanguard_settings", JSON.stringify({ fov: 100 }));
    useSettings.getState().load();
    expect(useSettings.getState().settings.showHealthBars).toBe(true);
    expect(useSettings.getState().settings.fov).toBe(100);
    useSettings.getState().update({ showHealthBars: false });
    useSettings.getState().reset();
    expect(useSettings.getState().settings.showHealthBars).toBe(true);
  } finally {
    if (previousWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = previousWindow;
    if (previousStorage === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = previousStorage;
  }
});
