import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {CTF_MAP_IDS,getMap,mapAllowedForMode,teamSizeAllowed,roomCapacity,rayBox,type Vec3} from "../src/lib/game-protocol";
import {MAP_BLUEPRINTS,featureBoxes,regionBoundary,insideRegions,validateBlueprint,authoredHazardEnvironment} from "../src/lib/map-blueprints";
import {makeEnvironmentMap,periodicHazardPhase,spikesActive,withinEnvironment,breakEnvironmentWall} from "../src/lib/dynamic-environment";
import {createCtfFlags,ctfHome,ctfBase,ctfTouch,ctfDrop,ctfReturnExpired,ctfBotIntent,ctfStairWaypoint,CTF_PICKUP_RADIUS,CTF_CAPTURE_RADIUS} from "../src/lib/ctf-rules";
import {botPositionEmbedded} from "../src/lib/bot-physics";
import {botTraversableEdge,botNextWaypoint} from "../src/lib/bot-routing";
import {CoverSpatialIndex} from "../src/lib/cover-spatial-index";
import {propColliders} from "../src/lib/map-visuals";
import {steamPurgeStatus} from "../src/lib/map-event-status";
import {buildSteamVent,updateSteamVent} from "../src/lib/steam-vent-visuals";
import {legacyEnvironmentToHazard} from "../src/lib/map-object-actions";
import {ctfDeliveryMarker} from "../src/lib/ctf-map-visuals";
import {buildFloodgateBackdrop,setFloodgateBreachVisual,updateFloodgateBreachVisual} from "../src/lib/floodgate-scenery";

const map=getMap("floodgate"),plan=MAP_BLUEPRINTS.maps.floodgate;
const collision=makeEnvironmentMap(map).cover,index=new CoverSpatialIndex(collision);
const vents=map.environment!.filter(o=>o.type==="spikes"&&o.visual==="steam");

/** Flood-fill actual swept player-sized ground edges, rather than region overlap alone. */
function groundRoute(start:Vec3,goal:Vec3,zMin:number,zMax:number):boolean {
  const key=(x:number,z:number)=>`${x}:${z}`;
  const queue:Vec3[]=[start],seen=new Set([key(start[0],start[2])]);
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    if(Math.hypot(p[0]-goal[0],p[2]-goal[2])<4.1)return true;
    for(const [dx,dz] of [[4,0],[-4,0],[0,4],[0,-4]]){
      const x=p[0]+dx,z=p[2]+dz,k=key(x,z);
      if(seen.has(k)||x< -116||x>116||z<zMin||z>zMax||!insideRegions(x,z,map.regions!,1))continue;
      // Include every vent as forbidden, proving these lanes remain open even during a purge.
      const y=botTraversableEdge(p,x,z,collision,map.environment,index);
      if(y===null||y>.6)continue;
      seen.add(k);queue.push([x,y,z]);
    }
  }
  return false;
}

describe("Floodgate 16v16 CTF",()=>{
  test("the reservoir, waterfalls and mountains cannot become invisible playable obstacles",()=>{
    const scene=new THREE.Scene(),backdrop=buildFloodgateBackdrop(scene);
    // The distant concrete remains outside the arena; the water is allowed to
    // enter the playable strip only AFTER the authoritative breach.
    const before=backdrop.getObjectByName("floodgate-flooded-spillway");
    expect(before?.visible).toBe(false);
    const solid=backdrop.children.filter(o=>o instanceof THREE.Mesh &&
      o.material instanceof THREE.MeshStandardMaterial);
    expect(solid.length).toBeGreaterThan(0);
    expect(solid.every(o=>o.position.z< -106)).toBe(true);
    setFloodgateBreachVisual(backdrop,true);
    updateFloodgateBreachVisual(backdrop,14);
    expect(backdrop.getObjectByName("floodgate-intact-gate")?.visible).toBe(false);
    expect(backdrop.getObjectByName("floodgate-flooded-spillway")?.visible).toBe(true);
    expect(backdrop.getObjectByName("floodgate-wave")?.visible).toBe(false);
    expect(backdrop.children.some(o=>o instanceof THREE.Light)).toBe(false);
    backdrop.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});
  });
  test("fills the third CTF slot and authorizes 32 slots on client/server rules",()=>{
    expect(CTF_MAP_IDS).toEqual(["forest_warfare","orbital_nexus","floodgate","compound","skybridge","whiteout_depot"]);
    expect(mapAllowedForMode("ctf",map.id)).toBe(true);
    for(const mode of ["ffa","survival","gungame"] as const)
      expect(mapAllowedForMode(mode,map.id)).toBe(false);
    expect(teamSizeAllowed(map.id,16)).toBe(true);
    expect(teamSizeAllowed("orbital_nexus",16)).toBe(false);
    expect(roomCapacity("ctf",16)).toBe(32);
    expect(map.name).toBe("Floodgate");
    expect(map.biome).toBe("hydroelectric");
  });

  test("the complete JSON layout survives compilation without hidden spawn suppression",()=>{
    expect(validateBlueprint(plan)).toEqual([]);
    expect(map.editorLegacyCoverCount).toBe(0);
    expect(map.environment).toHaveLength(plan.hazards!.length);
    const allSpawns=Object.values(plan.spawns).flat();
    const expected=plan.features.flatMap(featureBoxes).length+propColliders(map.props!,allSpawns).length+
      regionBoundary(plan.regions).length;
    expect(map.cover).toHaveLength(expected);
    expect(map.cover.length).toBeLessThan(300);
    expect(map.regions!.some(r=>r.x+r.w/2===176)).toBe(true);
    expect(map.regions!.some(r=>r.z-r.d/2===-106)).toBe(true);
  });

  test("each team gets 16 distinct mirrored spawn positions clear of hazards and solids",()=>{
    for(const team of ["red","blue"] as const){
      expect(map.spawns[team]).toHaveLength(16);
      expect(new Set(map.spawns[team].map(p=>p.join(","))).size).toBe(16);
      for(const p of map.spawns[team]){
        expect(Math.abs(p[0])).toBeGreaterThan(150);
        expect(botPositionEmbedded(collision,p)).toBe(false);
        expect(insideRegions(p[0],p[2],map.regions!,1.1)).toBe(true);
        expect(map.environment!.some(o=>withinEnvironment(o,p,1.1))).toBe(false);
      }
    }
    expect(map.spawns.red.map(p=>[-p[0],p[1],p[2]])).toEqual(map.spawns.blue);
    expect(new Set(map.spawns.ffa.map(p=>p.join(","))).size).toBe(32);
  });

  test("both teams can pick up, deliver, drop and reset the ground-level flags",()=>{
    for(const team of ["red","blue"] as const){
      const enemy=team==="red"?"blue":"red",flags=createCtfFlags(map.id);
      for(const p of [ctfHome(team,map.id),ctfBase(team,map.id)]){
        expect(botPositionEmbedded(collision,p)).toBe(false);
        expect(insideRegions(p[0],p[2],map.regions!,2)).toBe(true);
      }
      expect(ctfTouch(flags,{id:"carrier",team,pos:ctfHome(enemy,map.id)},map.id)?.kind).toBe("pickup");
      expect(ctfTouch(flags,{id:"carrier",team,pos:ctfBase(team,map.id)},map.id)?.kind).toBe("capture");
      ctfTouch(flags,{id:"carrier",team,pos:ctfHome(enemy,map.id)},map.id);
      ctfDrop(flags,"carrier",[0,0,40],1000);
      expect(ctfReturnExpired(flags,31000,30000,map.id)).toEqual([enemy]);
      expect(flags[enemy].pos).toEqual(ctfHome(enemy,map.id));
    }
  });

  test("visible delivery rings agree with the actual capture destinations",()=>{
    for(const team of ["red","blue"] as const){
      const base=ctfBase(team,map.id),marker=ctfDeliveryMarker(team,base);
      expect(marker.position.toArray()).toEqual([base[0],.07,base[2]]);
      expect(marker.rotation.x).toBeCloseTo(-Math.PI/2);
      expect((marker.geometry as THREE.RingGeometry).parameters.outerRadius).toBe(4.25);
      expect((marker.material as THREE.Material).depthTest).toBe(true);
      marker.geometry.dispose();(marker.material as THREE.Material).dispose();
    }
  });

  test("three independent ground routes stay traversable with every pressure grate forbidden",()=>{
    expect(groundRoute([-116,0,-64],[116,0,-64],-102,-36)).toBe(true);
    expect(groundRoute([-116,0,0],[116,0,0],-26,26)).toBe(true);
    expect(groundRoute([-116,0,64],[116,0,64],36,102)).toBe(true);
  });

  test("combat lanes interrupt long horizontal sniper sightlines at ground and deck height",()=>{
    for(const y of [1.6,5.1])for(let z=-100;z<=100;z+=2){
      let run=0,longest=0;
      for(let x=-116;x<=116;x+=2){
        const blocked=collision.some(c=>c.kind!=="accent"&&Math.abs(x-c.pos[0])<=c.size[0]&&
          Math.abs(z-c.pos[2])<=c.size[2]&&y>=c.pos[1]-c.size[1]&&y<=c.pos[1]+c.size[1]);
        run=blocked?0:run+2;longest=Math.max(longest,run);
      }
      if(longest>112)throw Error(`Open ${longest}m sightline at z=${z}, y=${y}`);
    }
    const from:Vec3=[-132,1.6,0];
    expect(collision.some(c=>rayBox(from,[1,0,0],c.pos,c.size)!==null)).toBe(true);
  });

  test("full bot squads distribute attackers and defenders without forest stair goals",()=>{
    for(const team of ["red","blue"] as const){
      const ids=Array.from({length:16},(_,i)=>`bot-${i.toString().padStart(2,"0")}`);
      // Different wall-clock patrol phases must all produce collision-free goals,
      // without prescribing which particular bots are assigned to defense.
      for(const now of [0,10_000,20_000,55_000]) {
      const intents=ids.map((id,i)=>ctfBotIntent(createCtfFlags(map.id),team,id,map.spawns[team][i],"rifle_ar",ids,{},map.id,now));
      const defenders=intents.filter(i=>i.role==="defend_flag");
      const attackers=intents.filter(i=>i.role==="attack");
      expect(defenders.length).toBeGreaterThan(0);
      expect(attackers.length).toBeGreaterThan(0);
      expect(defenders.length+attackers.length).toBe(ids.length);
      expect(new Set(attackers.map(i=>i.goal[2])).size).toBeGreaterThan(1);
      for(const intent of intents){
        expect(intent.goal[1]).toBe(0);
        if(botPositionEmbedded(collision,intent.goal)) {
          const hit=collision.find(c=>botPositionEmbedded([c],intent.goal));
          throw new Error(`Embedded ${team} ${intent.role} goal ${JSON.stringify(intent.goal)} at t=${now} in ${JSON.stringify(hit)}`);
        }
        expect(ctfStairWaypoint(intent.goal,[0,0,0],map.id)).toEqual(intent.goal);
      }
      }
      const flags=createCtfFlags(map.id),enemy=team==="red"?"blue":"red";
      flags[enemy].carrierId=ids[1];
      expect(ctfBotIntent(flags,team,ids[1],ctfHome(enemy,map.id),"rifle_ar",ids,{},map.id).goal).toEqual(ctfBase(team,map.id));
    }
  });

  test("the shared pathfinder reaches enemy flags and completes carrier return routes",()=>{
    for(const team of ["red","blue"] as const){
      let position:Vec3=[...map.spawns[team][3]];
      const enemy=team==="red"?"blue":"red";
      const flags=createCtfFlags(map.id);
      const destinations:{goal:Vec3;radius:number;kind:"pickup"|"capture"}[]=[
        {goal:ctfHome(enemy,map.id),radius:CTF_PICKUP_RADIUS,kind:"pickup"},
        {goal:ctfBase(team,map.id),radius:CTF_CAPTURE_RADIUS,kind:"capture"},
      ];
      for(const {goal,radius,kind} of destinations){
        const visited=new Set<string>();
        for(let step=0;step<400&&Math.hypot(position[0]-goal[0],position[2]-goal[2])>=radius;step++){
          const waypoint=botNextWaypoint(position,goal,collision,map.size,3,map.environment,map.regions,index);
          if(!waypoint)throw Error(`${team} cannot reach ${goal} from ${position}`);
          if(visited.has(waypoint.join(",")))throw Error(`${team} cycles at ${waypoint}`);
          expect(botTraversableEdge(position,waypoint[0],waypoint[2],collision,map.environment,index)).not.toBeNull();
          visited.add(waypoint.join(","));position=waypoint;
        }
        expect(ctfTouch(flags,{id:"carrier",team,pos:position},map.id)?.kind).toBe(kind);
      }
    }
  },30000);

  test("the optional maintenance breach changes only its own match collision",()=>{
    const first=makeEnvironmentMap(map),second=makeEnvironmentMap(map);
    const door=map.environment!.find(o=>o.type==="destructible_wall")!;
    expect(first.cover.some(c=>c.environmentId===door.id)).toBe(true);
    breakEnvironmentWall(first,door.id);
    expect(first.cover.some(c=>c.environmentId===door.id)).toBe(false);
    expect(second.cover.some(c=>c.environmentId===door.id)).toBe(true);
    expect(map.cover.some(c=>c.environmentId===door.id)).toBe(false);
  });
});

describe("Spillway pressure purge",()=>{
  test("seven-second warning precedes an eight-second purge on a 36-second shared cycle",()=>{
    expect(vents).toHaveLength(4);
    for(const vent of vents){
      for(const [seconds,phase] of [[0,"idle"],[18.999,"idle"],[19,"warning"],[25.999,"warning"],
        [26,"active"],[33.999,"active"],[34,"idle"],[55,"warning"],[62,"active"]] as const){
        expect(periodicHazardPhase(vent,seconds)).toBe(phase);
        expect(spikesActive(vent,seconds)).toBe(phase==="active");
      }
    }
    expect(steamPurgeStatus(map.environment!,19)).toMatchObject({phase:"warning",secondsLeft:7});
    expect(steamPurgeStatus(map.environment!,26)).toMatchObject({phase:"active",secondsLeft:8});
    expect(steamPurgeStatus(getMap("orbital_nexus").environment!,36)).toBeUndefined();
  });

  test("the editor export and legacy copy preserve timing and appearance",()=>{
    const authored=plan.hazards!.find(h=>h.visual==="steam")!;
    const vent=authoredHazardEnvironment(authored);
    const copy=legacyEnvironmentToHazard(vent,"copy");
    expect(copy).toMatchObject({visual:"steam",warningFor:7,period:36,activeFor:8,offset:10});
    expect(validateBlueprint({...plan,hazards:[{...authored,warningFor:43}]})).not.toEqual([]);
    expect(validateBlueprint({...plan,hazards:[{...authored,warningFor:-1}]})).not.toEqual([]);
  });

  test("vent animation reuses a fixed set of meshes, materials and geometries",()=>{
    const vent=vents[0];if(vent.type!=="spikes")throw Error("Expected steam vent");
    const group=new THREE.Group();buildSteamVent(group,vent);
    const children=[...group.children],meshes=children as THREE.Mesh[];
    const geometries=meshes.map(m=>m.geometry),materials=meshes.map(m=>m.material);
    updateSteamVent(group,vent,19);
    expect(children.filter(c=>c.userData.steamJet&&c.visible)).toHaveLength(0);
    updateSteamVent(group,vent,26);
    expect(children.filter(c=>c.userData.steamJet&&c.visible)).toHaveLength(6);
    for(let frame=0;frame<600;frame++)updateSteamVent(group,vent,26+frame/60);
    expect(group.children).toEqual(children);
    expect(meshes.map(m=>m.geometry)).toEqual(geometries);
    expect(meshes.map(m=>m.material)).toEqual(materials);
    expect(group.children).toHaveLength(9);
    expect(group.children.some(c=>c instanceof THREE.Light)).toBe(false);
  });
});
