import {describe,expect,test} from "bun:test";
import {getMap} from "../src/lib/game-protocol";
import {makeEnvironmentMap,breakEnvironmentWall,closestCoverHit,periodicHazardPhase,spikesActive} from "../src/lib/dynamic-environment";
import {rayBox} from "../src/lib/game-protocol";
import * as THREE from "three";
import {buildFloodgateBackdrop,setFloodgatePurgeVisual} from "../src/lib/floodgate-scenery";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {visualThemeForMap} from "../src/lib/map-visuals";
import {damBreachStatus,floodgateIntegrityStatus,floodgateObjectiveStatus,whiteoutWeatherStatus} from "../src/lib/map-event-status";
import {buildFloodgateColorDressing} from "../src/lib/floodgate-color-dressing";
import {buildFactoryMachinery} from "../src/lib/factory-machinery";
import {FLOODGATE_CORE_ID,FLOODGATE_DAM_PANELS,floodgateBreached,floodgateBreachTargets,floodgateDamageTarget,applyLinkedWallDamage,
  whiteoutIntensity,whiteoutVisibility,whiteoutExposure,whiteoutWindow,WHITEOUT_CYCLE_SECONDS}
  from "../src/lib/map-battle-events";

describe("Floodgate one-time Levolution",()=>{
  test("center core and four adjoining shutters have matching physics",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const walls=(map.environment??[]).filter(o=>o.type==="destructible_wall");
    const ids=[FLOODGATE_CORE_ID,...FLOODGATE_DAM_PANELS];
    for(const id of ids){
      expect(walls.some(o=>o.id===id)).toBe(true);
      expect(map.cover.some(c=>c.environmentId===id)).toBe(true);
    }
    expect(floodgateBreachTargets("not_the_dam")).toHaveLength(0);
    expect(floodgateBreachTargets(FLOODGATE_CORE_ID)).toHaveLength(4);
    const state=new Map(walls.filter(o=>ids.includes(o.id)).map(o=>[o.id,o.hp]));
    expect(floodgateBreached(state)).toBe(false);
    state.set(FLOODGATE_CORE_ID,0);
    expect(floodgateBreached(state)).toBe(true);
    for(const id of ids)breakEnvironmentWall(map,id);
    for(const id of ids)expect(map.cover.some(c=>c.environmentId===id)).toBe(false);
    expect(damBreachStatus(true,map.environment??[],60)?.label).toContain("DAM BREACHED");
  });
  test("shots at the front-mounted yellow dam core hit the objective before permanent cover",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const core=(map.environment??[]).find(o=>o.id===FLOODGATE_CORE_ID);
    expect(core?.type).toBe("destructible_wall");
    expect(core?.pos[1]).toBeLessThan(5);
    const hit=closestCoverHit(map.cover,[0,1.5,-55],[0,0,-1],45,rayBox);
    expect(hit?.box.environmentId).toBe(FLOODGATE_CORE_ID);
    expect(hit?.distance).toBeLessThan(20);
  });
  test("all five painted dam panels share a single reachable health pool",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const core=map.environment!.find(o=>o.id===FLOODGATE_CORE_ID);
    if(!core||core.type!=="destructible_wall")throw Error("missing core");
    expect(core.hp).toBeLessThan(500);
    for(const id of [FLOODGATE_CORE_ID,...FLOODGATE_DAM_PANELS]){
      expect(floodgateDamageTarget(id)).toBe(FLOODGATE_CORE_ID);
      const wall=map.environment!.find(o=>o.id===id);
      if(!wall||wall.type!=="destructible_wall")throw Error("missing panel "+id);
      const from:[number,number,number]=[wall.pos[0],1.6,wall.pos[2]+5];
      const hit=closestCoverHit(map.cover,from,[0,0,-1],11,rayBox);
      expect(hit?.box.environmentId).toBe(id);
    }
    expect(floodgateDamageTarget("floodgate_maintenance_shutter")).toBe("floodgate_maintenance_shutter");
    expect(floodgateIntegrityStatus(360,360)).toBeUndefined();
    expect(floodgateIntegrityStatus(180,360)?.label).toContain("50%");
    expect(floodgateIntegrityStatus(0,360)?.label).toContain("DAM BREACHED");
    expect(floodgateObjectiveStatus(360,360,240,240)).toBeUndefined();
    expect(floodgateObjectiveStatus(360,360,120,240)?.label).toContain("SHUTTER 50%");
    expect(floodgateObjectiveStatus(360,360,0,240)?.label).toContain("SHUTTER OPEN");
    expect(floodgateObjectiveStatus(180,360,120,240)?.label).toContain("DAM INTEGRITY");

    for(const id of [FLOODGATE_CORE_ID,...FLOODGATE_DAM_PANELS])
      breakEnvironmentWall(map,id);
    // The central route must actually become traversable, not merely lose its
    // environment ID while a permanent piece of cover still blocks it.
    expect(closestCoverHit(map.cover,[0,1.6,-78],[0,0,-1],22,rayBox)).toBeNull();
  });
  test("industrial colour dressing paints zones without adding gameplay hitboxes or point lights",()=>{
    const map=getMap("floodgate"),scene=new THREE.Scene(),before=map.cover.length;
    const group=buildFloodgateColorDressing(scene,map);
    expect(group.children.length).toBeGreaterThan(20);
    expect(group.children.length).toBeLessThan(100);
    expect(group.children.every(o=>o instanceof THREE.Mesh)).toBe(true);
    expect(map.cover.length).toBe(before);
    const painted=new THREE.Group();
    buildFactoryMachinery(painted,"generator",14,24,6.5,"#20bcae");
    expect(painted.children.some(c=>c instanceof THREE.Mesh &&
      c.material instanceof THREE.MeshStandardMaterial && c.material.color.getHex()===0x20bcae))
      .toBe(true);
    for(const groupRoot of [scene,painted])groupRoot.traverse(o=>{
      if(o instanceof THREE.Mesh){
        o.geometry.dispose();
        for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();
      }
    });
  });
  test("Marksman DMR destroys the actual central wall from accessible hall approach",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const core=(map.environment??[]).find(o=>o.id===FLOODGATE_CORE_ID);
    if(!core||core.type!=="destructible_wall")throw Error("core missing");
    const walls=new Map((map.environment??[]).filter(o=>o.type==="destructible_wall")
      .map(o=>[o.id,o.type==="destructible_wall"?o.hp:0]));
    // Before this fix the hall pillar, switchgear and junction cover made
    // every DMR hit from the middle of the arena strike invulnerable concrete.
    const from:[number,number,number]=[0,1.6,10];
    const direction:[number,number,number]=[0,0,-1];
    for(let i=0;i<5;i++){
      const hit=closestCoverHit(map.cover,from,direction,84.7*1.72,rayBox);
      expect(hit?.box.environmentId).toBe(FLOODGATE_CORE_ID);
      const result=applyLinkedWallDamage(walls,hit!.box.environmentId!,74);
      expect(result?.hp).toBe(Math.max(0,360-(i+1)*74));
      for(const id of [FLOODGATE_CORE_ID,...FLOODGATE_DAM_PANELS])
        expect(walls.get(id)).toBe(result?.hp);
      if(result?.hp===0)for(const id of result.ids)breakEnvironmentWall(map,id);
    }
    expect(floodgateBreached(walls)).toBe(true);
    // The distant map boundary remains solid; the destroyed dam does not.
    const after=closestCoverHit(map.cover,from,direction,84.7*1.72,rayBox);
    expect(after?.box.environmentId).toBeUndefined();
    expect(after?.distance??Infinity).toBeGreaterThan(84);
  });
  test("12-round DMR magazine can breach the shutter and dam from the yard",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const walls=new Map((map.environment??[]).filter(o=>o.type==="destructible_wall")
      .map(o=>[o.id,o.type==="destructible_wall"?o.hp:0]));
    const from:[number,number,number]=[0,1.6,60];
    let shots=0,shutterShots=0,damShots=0;
    while(shots<12&&!floodgateBreached(walls)){
      const hit=closestCoverHit(map.cover,from,[0,0,-1],84.7*1.72,rayBox);
      const id=hit?.box.environmentId;
      expect(id).toBeDefined();
      const result=applyLinkedWallDamage(walls,id!,74);
      expect(result).not.toBeNull();
      if(id==="floodgate_maintenance_shutter")shutterShots++;else if(id===FLOODGATE_CORE_ID)damShots++;
      if(result?.hp===0)for(const x of result.ids)breakEnvironmentWall(map,x);
      shots++;
    }
    expect(shutterShots).toBe(4);
    expect(damShots).toBe(5);
    expect(floodgateBreached(walls)).toBe(true);
  });
  test("dam backdrop no longer draws an invulnerable full-height central gate",()=>{
    const backdrop=buildFloodgateBackdrop(new THREE.Scene());
    const gate=backdrop.getObjectByName("floodgate-intact-gate");
    expect(gate).toBeInstanceOf(THREE.Mesh);
    expect((gate as THREE.Mesh<THREE.BoxGeometry>).geometry.parameters.height).toBeLessThan(4);
    backdrop.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();
      for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();
    }});
  });
  test("spillway waterfalls match the exact steam-damage phase",()=>{
    const map=getMap("floodgate");
    const vent=(map.environment??[]).find(o=>o.type==="spikes"&&o.visual==="steam");
    if(!vent||vent.type!=="spikes")throw Error("No steam vent");
    const group=buildFloodgateBackdrop(new THREE.Scene());
    for(const [time,expected] of [[19,false],[26,true],[34,false]] as const){
      const active=spikesActive(vent,time);
      expect(active).toBe(expected);
      expect(periodicHazardPhase(vent,time)==="active").toBe(active);
      setFloodgatePurgeVisual(group,active);
      expect(group.children.filter(c=>c.name==="floodgate-purge-spill").every(c=>c.visible===active)).toBe(true);
    }
    group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();
      for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();
    }});
  });
  test("32-player rear spawn zones are separated by team",()=>{
    const map=getMap("floodgate","tdm");
    expect(map.spawns.red).toHaveLength(16);
    expect(map.spawns.blue).toHaveLength(16);
    expect(map.spawns.red.every(p=>p[0]<-120)).toBe(true);
    expect(map.spawns.blue.every(p=>p[0]>120)).toBe(true);
    const platforms=MAP_BLUEPRINTS.maps.floodgate.features.filter(f=>
      f.kind==="platform"&&f.id.includes("overlook"));
    expect(platforms.length).toBeGreaterThanOrEqual(8);
  });
});

describe("Whiteout tactical storm",()=>{
  test("storm and HUD loop are repeatable",()=>{
    expect(whiteoutIntensity(0)).toBe(0);
    expect(whiteoutWindow(15).phase).toBe("idle");
    expect(whiteoutWeatherStatus(15).label).toBe("Clear skies");
    expect(whiteoutWindow(25).phase).toBe("warning");
    expect(whiteoutIntensity(29.99)).toBe(0);
    expect(whiteoutIntensity(30.01)).toBeGreaterThan(0);
    expect(whiteoutWindow(40).phase).toBe("active");
    expect(whiteoutIntensity(40)).toBe(1);
    expect(whiteoutIntensity(80)).toBe(0);
    expect(whiteoutIntensity(40+WHITEOUT_CYCLE_SECONDS)).toBe(1);
    expect(whiteoutWeatherStatus(25).label).toContain("arriving");
    expect(whiteoutWindow(29).secondsLeft).toBe(1);
    expect(whiteoutWindow(10).phase).toBe("idle");
    expect(whiteoutWindow(20).phase).toBe("warning");
    expect(whiteoutWeatherStatus(40).label).toContain("BLIZZARD");
  });
  test("weather restricts outdoor sightlines but rewards sheltered flanks",()=>{
    expect(whiteoutVisibility(40)).toBeLessThan(45);
    expect(whiteoutExposure(0,-46)).toBe(1);
    expect(whiteoutExposure(40,0)).toBeLessThan(1);
    expect(whiteoutExposure(40,45)).toBeLessThan(1);
    expect(whiteoutVisibility(40,[40,0,45])).toBeGreaterThan(whiteoutVisibility(40,[0,0,-46]));
  });
  test("both maps remove in-world instructional sign props",()=>{
    for(const id of ["whiteout_depot","floodgate"])
      expect(visualThemeForMap(id).props.filter(p=>p.kind==="sign")).toHaveLength(0);
  });
});
