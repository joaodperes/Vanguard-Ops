/**
 * Map footprint profiles.
 *
 * The base layouts share approximately 120-128-unit dimensions. Scaling X/Z
 * uniformly preserves authored stair/cover connections while giving players
 * real close-quarters, balanced and tactical map sizes to choose from.
 * Vertical measurements, jump height and player size remain world-constant.
 */
import type { MapDef, MapId, Vec3, EnvironmentObject } from "./game-protocol";

export type MapPace = "compact" | "balanced" | "tactical";

export const MAP_FOOTPRINT: Record<MapId, { scale: number; pace: MapPace; description: string }> = {
  bunker: { scale: 0.82, pace: "compact", description: "Short flanks · frequent close-range fights" },
  shipyard: { scale: 0.90, pace: "compact", description: "Container-lane skirmishes · fast engagements" },
  compound: { scale: 0.98, pace: "balanced", description: "Mixed lanes · varied engagement distances" },
  terminal: { scale: 1.04, pace: "balanced", description: "Medium-range security and concourse routes" },
  skybridge: { scale: 1.13, pace: "tactical", description: "Long approaches · elevated sightlines" },
  arena_neon: { scale: 1.19, pace: "tactical", description: "Wide flanks · multi-level engagements" },
};

function scaled(p: Vec3, scale: number): Vec3 {
  return [Math.round(p[0] * scale * 1000) / 1000, p[1], Math.round(p[2] * scale * 1000) / 1000];
}

function scaleEnvironment(obj: EnvironmentObject, scale: number): EnvironmentObject {
  const pos = scaled(obj.pos, scale), size = scaled(obj.size, scale);
  if (obj.type === "moving_platform") {
    return { ...obj, pos, size, to: scaled(obj.to, scale) };
  }
  if (obj.type === "jump_pad") {
    return { ...obj, pos, size, launch: scaled(obj.launch, scale) };
  }
  return { ...obj, pos, size };
}

/**
 * Scale each complete map together, including walls, cover, stair segments,
 * spawns, interactables, projectiles' environmental launch vectors and lights.
 * Never mutate the base map: the server creates independent room instances.
 */
export function applyMapFootprint(base: MapDef): MapDef {
  const scale = MAP_FOOTPRINT[base.id].scale;
  return {
    ...base,
    size: Math.round(base.size * scale * 1000) / 1000,
    cover: base.cover.map(box => ({
      ...box, pos: scaled(box.pos, scale), size: scaled(box.size, scale),
    })),
    spawns: {
      ffa: base.spawns.ffa.map(p => scaled(p, scale)),
      red: base.spawns.red.map(p => scaled(p, scale)),
      blue: base.spawns.blue.map(p => scaled(p, scale)),
    },
    environment: base.environment?.map(obj => scaleEnvironment(obj, scale)),
    lights: base.lights?.map(light => ({
      ...light, pos: scaled(light.pos, scale), distance: light.distance * scale,
    })),
    theme: {
      ...base.theme,
      fogNear: base.theme.fogNear * scale,
      fogFar: base.theme.fogFar * scale,
    },
  };
}
