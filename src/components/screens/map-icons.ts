import type { MapId } from "@/lib/game-protocol";
import {
  Building2, Factory, Landmark, LockKeyhole, Map as MapIcon, MoonStar,
  Orbit, Ship, Snowflake, Trees, Waves, type LucideIcon,
} from "lucide-react";

/**
 * One recognisable landmark per shipped map. Keep the same symbol in the map
 * picker and room browser; the map's existing accent color supplies its tint.
 *
 * Record<MapId, ...> makes adding a protocol map an explicit icon decision,
 * rather than silently assigning every new map the same generic Layers icon.
 */
export const MAP_ICONS: Record<MapId, LucideIcon> = {
  compound: Landmark,         // Verdant Ruins: ancient temple and masonry
  skybridge: Factory,          // Ridgefall: industrial steelworks
  bunker: LockKeyhole,         // Blacksite: underground secure vault
  shipyard: Ship,              // Breakwater: harbor and container court
  terminal: Building2,         // Afterlight City (Day): urban district
  arena_neon: MoonStar,        // Afterlight City (Night): neon streets
  forest_warfare: Trees,      // woodland
  orbital_nexus: Orbit,       // orbital station
  floodgate: Waves,           // hydroelectric dam
  whiteout_depot: Snowflake,  // frozen rail depot
};

export function getMapIcon(mapId: MapId | string): LucideIcon {
  // Unknown editor-imported maps still have a sensible generic icon.
  return Object.prototype.hasOwnProperty.call(MAP_ICONS, mapId)
    ? MAP_ICONS[mapId as MapId]
    : MapIcon;
}
