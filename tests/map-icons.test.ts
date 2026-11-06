import { describe, expect, test } from "bun:test";
import { Map as MapIcon } from "lucide-react";
import { MAP_LIST } from "../src/lib/game-protocol";
import { MAP_ICONS, getMapIcon } from "../src/components/screens/map-icons";

describe("map selection iconography", () => {
  test("every shipped map has an intentional icon", () => {
    expect(Object.keys(MAP_ICONS).sort()).toEqual(MAP_LIST.map((m) => m.id).sort());
    for (const map of MAP_LIST) {
      expect(getMapIcon(map.id)).toBe(MAP_ICONS[map.id]);
    }
  });

  test("every shipped map has a different icon", () => {
    expect(new Set(Object.values(MAP_ICONS)).size).toBe(MAP_LIST.length);
  });

  test("unknown editor maps use a generic map icon instead of the Layers stack", () => {
    expect(getMapIcon("unregistered_custom_map")).toBe(MapIcon);
  });
});
