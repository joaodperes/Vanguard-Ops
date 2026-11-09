import { describe, expect, test } from "bun:test";
import { createFiringRangeMap, RANGE_TARGETS, RANGE_SPAWN, RANGE_MOVING_TARGETS, RANGE_MATERIAL_STATIONS, RANGE_MATERIAL_ENTRANCE_Z, RANGE_MATERIAL_SHOOT_Z, movingRangeTargetPosition } from "../src/lib/firing-range";
import { getMap, rayBox, PLAYER_HEIGHT, type Vec3 } from "../src/lib/game-protocol";
import { traceCoverPenetration, selectMaterialPenetrationHits } from "../src/lib/cover-penetration";
import { authoredBallisticCover, damageBallisticCoverOnShot } from "../src/lib/material-cover-damage";

describe("Armory firing range", () => {
  test("is a separate, non-mutating practice map", () => {
    const normal = getMap("compound");
    const initialCoverLength = normal.cover.length;
    const range = createFiringRangeMap();
    expect(range.name).toBe("Firing Range");
    expect(range.environment).toEqual([]);
    expect(range.regions).toBeUndefined();
    expect(range.spawns.ffa).toEqual([RANGE_SPAWN]);
    expect(normal.cover.length).toBe(initialCoverLength);
    expect(normal.name).not.toBe(range.name);
  });

  test("places four practice targets downrange in open firing lanes", () => {
    const range = createFiringRangeMap();
    expect(RANGE_TARGETS).toHaveLength(4);
    for (const target of RANGE_TARGETS) {
      expect(target[2]).toBeGreaterThan(RANGE_SPAWN[2]);
      expect(Math.abs(target[0])).toBeLessThan(10);
      const dx = target[0] - RANGE_SPAWN[0];
      const dz = target[2] - RANGE_SPAWN[2];
      const length = Math.hypot(dx, dz);
      const direction: [number, number, number] = [dx / length, 0, dz / length];
      for (const cover of range.cover) {
        const hit = rayBox([RANGE_SPAWN[0], PLAYER_HEIGHT / 2, RANGE_SPAWN[2]], direction,
          cover.pos, cover.size);
        expect(hit === null || hit > length).toBe(true);
      }
    }
  });

  test("adds moving targets at increasing range and speed without replacing the stationary set", () => {
    expect(RANGE_TARGETS).toHaveLength(4);
    expect(RANGE_MOVING_TARGETS).toHaveLength(3);
    const distances = RANGE_MOVING_TARGETS.map(target => target.center[2] - RANGE_SPAWN[2]);
    const speeds = RANGE_MOVING_TARGETS.map(target => target.speed);
    expect(distances).toEqual([28, 40, 52]);
    expect(speeds).toEqual([1.4, 2.8, 4.5]);
  });

  test("moves each dummy sideways at its configured speed and reverses at endpoints", () => {
    for (const target of RANGE_MOVING_TARGETS) {
      const period = 4 * target.halfTravel / target.speed;
      const leftStart = { ...target, phase: 0 };
      const start = movingRangeTargetPosition(leftStart, 0);
      const mid = movingRangeTargetPosition(leftStart, 2 * target.halfTravel / target.speed);
      const back = movingRangeTargetPosition(leftStart, period);
      expect(start[0]).toBeCloseTo(target.center[0] - target.halfTravel);
      expect(mid[0]).toBeCloseTo(target.center[0] + target.halfTravel);
      expect(back[0]).toBeCloseTo(start[0]);
      const quarterSecond = movingRangeTargetPosition(leftStart, 0.25);
      expect(quarterSecond[0] - start[0]).toBeCloseTo(target.speed * 0.25);
      // A complete cycle remains deterministic and retains target height/depth.
      const at = movingRangeTargetPosition(target, 1.37);
      const looped = movingRangeTargetPosition(target, 1.37 + period);
      expect(at[0]).toBeCloseTo(looped[0]);
      expect(at[1]).toBe(target.center[1]);
      expect(at[2]).toBe(target.center[2]);
    }
  });

  test("keeps the full moving path in the open lane without intersecting cover", () => {
    const map = createFiringRangeMap();
    for (const target of RANGE_MOVING_TARGETS) {
      const period = 4 * target.halfTravel / target.speed;
      for (let sample = 0; sample <= 40; sample++) {
        const pos = movingRangeTargetPosition(target, period * sample / 40);
        expect(Math.abs(pos[0])).toBeLessThan(11);
        const feet: [number, number, number] = [pos[0], pos[1] + PLAYER_HEIGHT / 2, pos[2]];
        for (const cover of map.cover) {
          const [hx, hy, hz] = cover.size;
          const intersects = Math.abs(feet[0] - cover.pos[0]) < hx + 0.45 &&
            Math.abs(feet[1] - cover.pos[1]) < hy + PLAYER_HEIGHT / 2 &&
            Math.abs(feet[2] - cover.pos[2]) < hz + 0.45;
          expect(intersects).toBe(false);
        }
      }
    }
  });

  test("places every ballistic material in side corridors without changing the central range",()=>{
    const map=createFiringRangeMap();
    expect(RANGE_MATERIAL_STATIONS.map(s=>s.material))
      .toEqual(["glass","thin_wood","light_cover","sheet_metal","concrete"]);
    expect(authoredBallisticCover(map.cover)).toHaveLength(4);
    const ids=authoredBallisticCover(map.cover).map(c=>c.ballisticId);
    expect(new Set(ids).size).toBe(4);
    expect(RANGE_MATERIAL_STATIONS.filter(s=>s.x<0)).toHaveLength(2);
    expect(RANGE_MATERIAL_STATIONS.filter(s=>s.x>0)).toHaveLength(3);
    for(const station of RANGE_MATERIAL_STATIONS){
      expect(Math.abs(station.x)).toBeGreaterThan(14);
      expect(Math.abs(station.x)+2.35).toBeLessThan(map.size);
      const collider=map.cover.find(c=>c.material===station.material&&Math.abs(c.pos[0]-station.x)<.01);
      expect(collider).toBeDefined();
      expect(collider!.size[2]*2).toBeCloseTo(station.thickness);
      expect(station.target[2]).toBeGreaterThan(collider!.pos[2]+collider!.size[2]);
      expect(station.target[0]).toBe(station.x);
    }
  });

  test("entrances are walkable from the original spawn and into both side lanes",()=>{
    const map=createFiringRangeMap();
    const entry:Vec3=[0,PLAYER_HEIGHT/2,RANGE_MATERIAL_ENTRANCE_Z];
    for(const x of [-16,16]){
      const target:Vec3=[x,PLAYER_HEIGHT/2,RANGE_MATERIAL_ENTRANCE_Z];
      const dx=target[0]-entry[0],dist=Math.abs(dx);
      const dir:Vec3=[Math.sign(dx),0,0];
      for(const box of map.cover){
        const t=rayBox(entry,dir,box.pos,box.size);
        expect(t===null || t>dist).toBe(true);
      }
      const pathToStation=RANGE_MATERIAL_STATIONS.find(station=>Math.sign(station.x)===Math.sign(x))!;
      expect(Math.abs(pathToStation.x)).toBeGreaterThan(16);
      expect(RANGE_MATERIAL_SHOOT_Z).toBeGreaterThan(RANGE_MATERIAL_ENTRANCE_Z);
    }
  });

  test("each corridor dummy lies behind its own sample; heavy rounds penetrate except concrete",()=>{
    const map=createFiringRangeMap();
    for(const station of RANGE_MATERIAL_STATIONS){
      const origin:Vec3=[station.x,1.25,RANGE_MATERIAL_SHOOT_Z];
      const direction:Vec3=[0,0,1];
      const distance=station.target[2]-origin[2];
      const contacts=[{target:station.id,t:distance,head:false}];
      expect(traceCoverPenetration(map.cover,origin,direction,distance+1,0).blockedAt).toBeLessThan(distance);
      expect(selectMaterialPenetrationHits(contacts,map.cover,origin,direction,distance+1)).toEqual([]);
      const penetrated=selectMaterialPenetrationHits(contacts,map.cover,origin,direction,distance+1,undefined,6);
      if(station.material==="concrete")expect(penetrated).toEqual([]);
      else {
        expect(penetrated.map(h=>h.target)).toEqual([station.id]);
        expect(penetrated[0].damageScale).toBeLessThan(1);
      }
    }
  });

  test("Penetrator Rounds help on thin panels but not the sheet-metal or concrete controls",()=>{
    const map=createFiringRangeMap();
    for(const station of RANGE_MATERIAL_STATIONS){
      const origin:Vec3=[station.x,1.25,RANGE_MATERIAL_SHOOT_Z];
      const trace=traceCoverPenetration(map.cover,origin,[0,0,1],35,.6);
      if(["glass","thin_wood","light_cover"].includes(station.material))
        expect(trace.blockedAt).toBe(Infinity);
      else expect(trace.blockedAt).toBeLessThan(35);
    }
  });

  test("shattered range glass opens the dummy lane while the concrete control stays intact",()=>{
    const map=createFiringRangeMap();
    const station=RANGE_MATERIAL_STATIONS.find(s=>s.material==="glass")!;
    const concrete=RANGE_MATERIAL_STATIONS.find(s=>s.material==="concrete")!;
    const hp=new Map<string,number>(),destroyed=new Set<string>();
    const origin:Vec3=[station.x,1.25,RANGE_MATERIAL_SHOOT_Z];
    const target=[{target:"dummy",t:station.target[2]-origin[2],head:false}];
    const first=damageBallisticCoverOnShot(map,hp,destroyed,origin,[0,0,1],40,0,35);
    expect(first[0].destroyed).toBe(false);
    expect(selectMaterialPenetrationHits(target,map.cover,origin,[0,0,1],40)).toEqual([]);
    const second=damageBallisticCoverOnShot(map,hp,destroyed,origin,[0,0,1],40,0,35);
    expect(second[0].destroyed).toBe(true);
    expect(selectMaterialPenetrationHits(target,map.cover,origin,[0,0,1],40).map(h=>h.target)).toEqual(["dummy"]);
    const hard:Vec3=[concrete.x,1.25,RANGE_MATERIAL_SHOOT_Z];
    for(let i=0;i<10;i++)expect(damageBallisticCoverOnShot(map,hp,destroyed,hard,[0,0,1],40,100,200)).toEqual([]);
    expect(traceCoverPenetration(map.cover,hard,[0,0,1],40,100).blockedAt).toBeLessThan(40);
  });

  test("keeps the normal spawn catalog isolated", () => {
    const normal = getMap("compound");
    const count = normal.spawns.ffa.length;
    createFiringRangeMap().spawns.ffa.push([9, 0, 9]);
    expect(getMap("compound").spawns.ffa).toHaveLength(count);
  });
});
