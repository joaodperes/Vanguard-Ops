import type { MapId } from "@/lib/game-protocol";
import {
  Building2, Castle, Map as MapIcon, MoonStar, Orbit, Route,
  Shield, Ship, Snowflake, Trees, Waves, type LucideIcon,
} from "lucide-react";

/**
 * One recognisable landmark per shipped map. Keep the same symbol in the map
 * picker and room browser; the map's existing accent color supplies its tint.
 *
 * Record<MapId, ...> makes adding a protocol map an explicit icon decision,
 * rather than silently assigning every new map the same generic Layers icon.
 */
export const MAP_ICONS: Record<MapId, LucideIcon> = {
  compound: Castle,           // fortified compound
  skybridge: Route,           // connected elevated walkways
  bunker: Shield,             // fortified close-quarters bunker
  shipyard: Ship,             // dock and containers
  terminal: Building2,        // Afterlight cityscape
  arena_neon: MoonStar,       // neon-lit night variant
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
