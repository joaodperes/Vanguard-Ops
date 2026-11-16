import { describe, expect, test } from "bun:test";
import { Factory, Landmark, LockKeyhole, Map as MapIcon } from "lucide-react";
import { MAP_LIST } from "../src/lib/game-protocol";
import { MAP_DOCUMENTS } from "../src/lib/map-documents";
import { MAP_ICONS, getMapIcon } from "../src/components/screens/map-icons";

describe("map selection iconography", () => {
  test("every shipped map has an intentional icon", () => {
    expect(Object.keys(MAP_ICONS).sort()).toEqual(MAP_LIST.map((m) => m.id).sort());
    for (const map of MAP_LIST) {
      expect(getMapIcon(map.id)).toBe(MAP_ICONS[map.id]);
    }
  });

  test("renamed locations use the landmark they actually depict", () => {
    expect(getMapIcon("compound")).toBe(Landmark); // Verdant Ruins
    expect(getMapIcon("skybridge")).toBe(Factory); // Ridgefall
    expect(getMapIcon("bunker")).toBe(LockKeyhole); // Blacksite
  });

  test("authored display names and descriptions are canonical", () => {
    for (const [id, document] of Object.entries(MAP_DOCUMENTS)) {
      const map = MAP_LIST.find((m) => m.id === id);
      expect(map, `Missing compiled map ${id}`).toBeDefined();
      expect(map?.name).toBe(document.blueprint.name);
      expect(map?.shortName).toBe(document.blueprint.shortName);
      expect(map?.description).toBe(document.blueprint.description);
    }
  });

  test("Afterlight City variants are explicitly distinguished", () => {
    const day = MAP_DOCUMENTS.terminal.blueprint;
    const night = MAP_DOCUMENTS.arena_neon.blueprint;
    expect(MAP_DOCUMENTS.compound.blueprint.name).toBe("Verdant Ruins");
    expect(MAP_DOCUMENTS.compound.blueprint.shortName).toBe("VRN");
    expect(day.name).toBe("Afterlight City (Day)");
    expect(night.name).toBe("Afterlight City (Night)");
    expect(day.regions).toEqual(night.regions);
    expect(day.spawns).toEqual(night.spawns);
  });

  test("every shipped map has a different icon", () => {
    expect(new Set(Object.values(MAP_ICONS)).size).toBe(MAP_LIST.length);
  });

  test("unknown editor maps use a generic map icon instead of the Layers stack", () => {
    expect(getMapIcon("unregistered_custom_map")).toBe(MapIcon);
  });
});
