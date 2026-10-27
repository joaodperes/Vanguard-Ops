/**
 * Authored combat layouts layered over each map's existing geometry.
 * Cover is deliberate: staggered lanes, reinforced junctions, elevated
 * firing positions and thematic structures rather than random crates.
 * All dimensions are half-extents in the generated CoverBox.
 */
import type { CoverBox, MapId, Vec3 } from "./game-protocol";
import { FOREST_WARFARE_COVER, FOREST_SPAWNS } from "./forest-warfare";

function wall(x: number, z: number, width: number, depth: number, height = 2.4): CoverBox {
  return { pos: [x, height / 2, z], size: [width / 2, height / 2, depth / 2], kind: "cover" };
}
function low(x: number, z: number, width = 2.5, depth = 2.5, height = 1.2): CoverBox {
  return wall(x,z,width,depth,height);
}
function elevated(x: number, z: number, surface: number, width = 1.2, depth = 1.0): CoverBox {
  const height = 1.5;
  return { pos: [x,surface+height/2,z], size: [width/2,height/2,depth/2], kind:"cover" };
}

export const TACTICAL_COVER: Record<MapId, CoverBox[]> = {
  forest_warfare: FOREST_WARFARE_COVER,
  compound: [
    // North security checkpoint: breakable centre gate at (0,-34).
    wall(-8,-34,9,1,2.8), wall(8,-34,9,1,2.8),
    low(-16,-30,3.2,2.4), low(16,-30,3.2,2.4),
    // South service checkpoint and flanking maintenance shelters.
    wall(-11,34,8,1,2.8), wall(11,34,8,1,2.8),
    low(-17,38,3,2.5), low(17,38,3,2.5),
    // East and west patrol lanes: offset reinforced barricades.
    wall(-39,-16,1.3,9), wall(-45,6,1.3,10), wall(-38,24,6,1.4),
    wall(39,16,1.3,9), wall(45,-6,1.3,10), wall(38,-24,6,1.4),
    // Connection from perimeter to central bunkers.
    low(-36,-5,3.4,2.5), low(-34,27,3,3),
    low(36,5,3.4,2.5), low(34,-27,3,3),
    wall(-20,43,6,1.4), wall(20,-43,6,1.4),
  ],
  skybridge: [
    // Ground maintenance rooms below north and south bridge approaches.
    wall(-24,-34,8,1.2,2.8), wall(24,-34,8,1.2,2.8),
    wall(-24,34,8,1.2,2.8), wall(24,34,8,1.2,2.8),
    low(-30,-44,3.2,2.5), low(30,-44,3.2,2.5),
    low(-30,44,3.2,2.5), low(30,44,3.2,2.5),
    // Side routes break tower-to-tower ground sightlines.
    wall(-43,-24,1.2,7.5), wall(-43,24,1.2,7.5),
    wall(43,-24,1.2,7.5), wall(43,24,1.2,7.5),
    low(-35,13,3,2.6), low(-35,-13,3,2.6),
    low(35,13,3,2.6), low(35,-13,3,2.6),
    // Bridge parapets provide tactical cover without blocking its entire width.
    elevated(-24,-41,6.4), elevated(24,-41,6.4),
    elevated(-24,41,6.4), elevated(24,41,6.4),
    // Ground access junction near the north bridge gate.
    wall(-8,-28,9,1.0), wall(8,-28,9,1.0),
  ],
  bunker: [
    // Mechanical rooms and staggered passages in the formerly vacant outer ring.
    wall(-39,-17,1.2,9,3.2), wall(-44,13,1.2,11,3.2),
    wall(39,17,1.2,9,3.2), wall(44,-13,1.2,11,3.2),
    wall(-29,-39,10,1.2,3.2), wall(17,-41,10,1.2,3.2),
    wall(29,39,10,1.2,3.2), wall(-17,41,10,1.2,3.2),
    // Breakable north service bulkhead: alternate route around the doors.
    wall(-8,-35,9,1.2,3), wall(8,-35,9,1.2,3),
    low(-30,-15,3,3,1.3), low(-30,15,3,3,1.3),
    low(30,-15,3,3,1.3), low(30,15,3,3,1.3),
    wall(-35,30,1.1,7), wall(35,-30,1.1,7),
    // Cover at the two external walkway tops.
    elevated(-24,-50,5.4), elevated(24,50,5.4),
  ],
  shipyard: [
    // Northern cargo inspection gate, matching the destructible barricade.
    wall(-8,-38,9,1.2,3), wall(8,-38,9,1.2,3),
    // Container walls build two connected flanking alleys.
    wall(-39,0,5,12,2.4), wall(39,0,5,12,2.4),
    wall(-22,-39,5,10,2.4), wall(22,39,5,10,2.4),
    wall(-7,-44,8,4,2.4), wall(7,44,8,4,2.4),
    // Forklift staging and dockside cargo at lane intersections.
    low(-29,-11,3.2,2.5,1.7), low(-29,11,3.2,2.5,1.7),
    low(29,-11,3.2,2.5,1.7), low(29,11,3.2,2.5,1.7),
    low(-18,36,3,3), low(18,-36,3,3),
    // Crane-platform cover at accessible stair/bridge ends.
    elevated(-13,0,5.3), elevated(13,0,5.3),
    elevated(25,-45,5.3), elevated(-25,45,5.3),
  ],
  terminal: [
    // Security checkpoint: breakable lane divider near north baggage handling.
    wall(-8,-40,9,1,2.8), wall(8,-40,9,1,2.8),
    // Concrete planters and ticket counters cluster in realistic banks.
    wall(-39,-16,3.5,7,2.2), wall(-39,16,3.5,7,2.2),
    wall(39,-16,3.5,7,2.2), wall(39,16,3.5,7,2.2),
    low(-18,32,5,2.8,1.4), low(18,32,5,2.8,1.4),
    low(-18,-32,5,2.8,1.4), low(18,-32,5,2.8,1.4),
    wall(-27,-41,7,1.3), wall(27,-41,7,1.3),
    wall(-27,41,7,1.3), wall(27,41,7,1.3),
    low(-42,0,2.8,5,1.2), low(42,0,2.8,5,1.2),
    // Mezzanine protective kiosk corners (walkway surface y=5.3).
    elevated(-8,-1.8,5.3), elevated(8,1.8,5.3),
  ],
  arena_neon: [
    // Neon storefront frontages enclosing recognizable diagonal approach alleys.
    wall(-39,-14,1.5,11,3), wall(39,14,1.5,11,3),
    wall(-39,14,1.5,11,3), wall(39,-14,1.5,11,3),
    wall(-13,-41,10,1.5,3), wall(13,41,10,1.5,3),
    wall(-13,41,10,1.5,3), wall(13,-41,10,1.5,3),
    // Destructible north shop shutter at (0,-46).
    wall(-9,-46,11,1.3,3), wall(9,-46,11,1.3,3),
    // Sculptural planter/advertising islands between tower and corner decks.
    low(-24,10,3,4,1.6), low(24,-10,3,4,1.6),
    low(-24,-10,3,4,1.6), low(24,10,3,4,1.6),
    low(-43,-31,3.5,3,1.5), low(43,31,3.5,3,1.5),
    low(-43,31,3.5,3,1.5), low(43,-31,3.5,3,1.5),
    // Cover on bridge platforms without fully obstructing travel.
    elevated(-21,-31,6.3), elevated(21,-31,6.3),
    elevated(-21,31,6.3), elevated(21,31,6.3),
  ],
};

/** Outer-ring spawns activate existing underused space while avoiding central
 * fighting positions. Added alongside the original spawns; tested for cover
 * and hazard clearance so no spawn is placed inside solid geometry. */
export const OUTER_SPAWNS: Record<MapId, { ffa: Vec3[]; red: Vec3[]; blue: Vec3[] }> = {
  forest_warfare: FOREST_SPAWNS,
  compound: {
    ffa: [[-51,0,-18],[51,0,18],[-51,0,18],[51,0,-18],[0,0,-51],[0,0,51]],
    red: [[-51,0,-18],[-51,0,18],[-51,0,0]],
    blue: [[51,0,-18],[51,0,18],[51,0,0]],
  },
  skybridge: {
    ffa: [[-50,0,-26],[50,0,26],[-50,0,26],[50,0,-26],[0,0,-52],[0,0,52]],
    red: [[-50,0,-26],[-50,0,26],[-50,0,0]],
    blue: [[50,0,-26],[50,0,26],[50,0,0]],
  },
  bunker: {
    ffa: [[-51,0,-26],[51,0,26],[-51,0,26],[51,0,-26],[0,0,-53],[0,0,53]],
    red: [[-51,0,-26],[-51,0,26],[-51,0,0]],
    blue: [[51,0,-26],[51,0,26],[51,0,0]],
  },
  shipyard: {
    ffa: [[-53,0,-14],[53,0,14],[-53,0,14],[53,0,-14],[0,0,-53],[0,0,53]],
    red: [[-53,0,-14],[-53,0,14],[-53,0,0]],
    blue: [[53,0,-14],[53,0,14],[53,0,0]],
  },
  terminal: {
    ffa: [[-54,0,-42],[54,0,42],[-54,0,42],[54,0,-42],[0,0,-54],[0,0,54]],
    red: [[-54,0,-42],[-54,0,42],[-54,0,0]],
    blue: [[54,0,-42],[54,0,42],[54,0,0]],
  },
  arena_neon: {
    ffa: [[-53,0,-36],[53,0,36],[-53,0,36],[53,0,-36],[0,0,-51],[0,0,51]],
    red: [[-53,0,-36],[-53,0,36],[-53,0,0]],
    blue: [[53,0,-36],[53,0,36],[53,0,0]],
  },
};
