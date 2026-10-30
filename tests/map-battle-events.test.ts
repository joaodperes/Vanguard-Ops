import {describe,expect,test} from "bun:test";
import {getMap} from "../src/lib/game-protocol";
import {makeEnvironmentMap,breakEnvironmentWall,closestCoverHit,periodicHazardPhase,spikesActive} from "../src/lib/dynamic-environment";
import {rayBox} from "../src/lib/game-protocol";
import * as THREE from "three";
import {buildFloodgateBackdrop,setFloodgatePurgeVisual,updateFloodgateBreachVisual} from "../src/lib/floodgate-scenery";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {visualThemeForMap} from "../src/lib/map-visuals";
import {whiteoutWeatherStatus} from "../src/lib/map-event-status";
import {buildFloodgateColorDressing} from "../src/lib/floodgate-color-dressing";
import {buildFactoryMachinery} from "../src/lib/factory-machinery";
import {botTraversableEdge} from "../src/lib/bot-routing";
import {buildFloodgateFreight,freightCover,freightStage,setFloodgateFreightStage,updateFloodgateFreight,floodgatePathHazards,FLOODGATE_FREIGHT,FLOODGATE_TOPPLE_SECONDS} from "../src/lib/floodgate-topple";
import {buildFloodgateDamCracks,damCrackTier,updateFloodgateDamCracks} from "../src/lib/floodgate-dam-cracks";
import {FLOODGATE_CORE_ID,FLOODGATE_DAM_PANELS,floodgateBreached,floodgateBreachTargets,floodgateDamageTarget,applyLinkedWallDamage,floodgateWaterEffect,floodgateSurgeFront,FLOODGATE_DAM_HP,FLOODGATE_SURGE_SECONDS,
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

  });
  test("shots at the front-mounted yellow dam core hit the objective before permanent cover",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const core=(map.environment??[]).find(o=>o.id===FLOODGATE_CORE_ID);
    expect(core?.type).toBe("destructible_wall");
    expect(core?.pos[2]).toBeLessThan(-95);
    expect(core?.pos[1]).toBeGreaterThan(4);
    const hit=closestCoverHit(map.cover,[0,1.5,-82],[0,0,-1],30,rayBox);
    expect(hit?.box.environmentId).toBe(FLOODGATE_CORE_ID);
    expect(hit?.distance).toBeLessThan(20);
  });
  test("all five painted dam panels share a single reachable health pool",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const core=map.environment!.find(o=>o.id===FLOODGATE_CORE_ID);
    if(!core||core.type!=="destructible_wall")throw Error("missing core");
    expect(core.hp).toBe(FLOODGATE_DAM_HP);
    for(const id of [FLOODGATE_CORE_ID,...FLOODGATE_DAM_PANELS]){
      expect(floodgateDamageTarget(id)).toBe(FLOODGATE_CORE_ID);
      const wall=map.environment!.find(o=>o.id===id);
      if(!wall||wall.type!=="destructible_wall")throw Error("missing panel "+id);
      const from:[number,number,number]=[wall.pos[0],1.6,wall.pos[2]+5];
      const hit=closestCoverHit(map.cover,from,[0,0,-1],11,rayBox);
      expect(hit?.box.environmentId).toBe(id);
    }
    expect(floodgateDamageTarget("floodgate_maintenance_shutter")).toBe("floodgate_maintenance_shutter");

    for(const id of [FLOODGATE_CORE_ID,...FLOODGATE_DAM_PANELS])
      breakEnvironmentWall(map,id);
    // The central route must actually become traversable, not merely lose its
    // environment ID while a permanent piece of cover still blocks it.
    expect(closestCoverHit(map.cover,[0,1.6,-90],[0,0,-1],14,rayBox)).toBeNull();
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
    for(let i=0;i<Math.ceil(FLOODGATE_DAM_HP/74);i++){
      const hit=closestCoverHit(map.cover,from,direction,84.7*1.72,rayBox);
      expect(hit?.box.environmentId).toBe(FLOODGATE_CORE_ID);
      const result=applyLinkedWallDamage(walls,hit!.box.environmentId!,74);
      expect(result?.hp).toBe(Math.max(0,FLOODGATE_DAM_HP-(i+1)*74));
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
  test("3000 HP dam takes sustained fire but opens after 41 confirmed DMR hits",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    const walls=new Map((map.environment??[]).filter(o=>o.type==="destructible_wall")
      .map(o=>[o.id,o.type==="destructible_wall"?o.hp:0]));
    const fire=(origin:[number,number,number])=>{
      const hit=closestCoverHit(map.cover,origin,[0,0,-1],84.7*1.72,rayBox);
      expect(hit?.box.environmentId).toBeDefined();
      const result=applyLinkedWallDamage(walls,hit!.box.environmentId!,74);
      if(result?.hp===0)for(const id of result.ids)breakEnvironmentWall(map,id);
      return hit!.box.environmentId;
    };
    for(let i=0;i<4;i++)expect(fire([0,1.6,60])).toBe("floodgate_maintenance_shutter");
    for(let i=0;i<Math.ceil(FLOODGATE_DAM_HP/74)-1;i++){
      expect(fire([0,1.6,10])).toBe(FLOODGATE_CORE_ID);
      expect(floodgateBreached(walls)).toBe(false);
    }
    expect(fire([0,1.6,10])).toBe(FLOODGATE_CORE_ID);
    expect(floodgateBreached(walls)).toBe(true);
    expect(walls.get("floodgate_maintenance_shutter")).toBe(0);
  });
  test("moving flood front changes movement and damage but keeps decks and flanks safe",()=>{
    expect(floodgateWaterEffect(0,0,-75,null).flooded).toBe(false);
    expect(floodgateSurgeFront(0)).toBe(-103);
    expect(floodgateSurgeFront(FLOODGATE_SURGE_SECONDS)).toBe(-36);
    const age=FLOODGATE_SURGE_SECONDS/2;
    const front=floodgateSurgeFront(age);
    expect(floodgateWaterEffect(0,0,front,age)).toMatchObject({
      flooded:true,surge:true,speedMultiplier:.36,pushZ:15,
    });
    expect(floodgateWaterEffect(0,0,-98,age)).toMatchObject({flooded:true,surge:false,pushZ:3.8});
    expect(floodgateWaterEffect(0,0,-75,40)).toMatchObject({flooded:true,surge:false,speedMultiplier:.64});
    expect(floodgateWaterEffect(0,5,-75,40).flooded).toBe(false);
    expect(floodgateWaterEffect(90,0,-75,40).flooded).toBe(true);
    expect(floodgateWaterEffect(116,0,-75,40).flooded).toBe(true);
    expect(floodgateWaterEffect(140,0,-75,40).flooded).toBe(false);
    expect(floodgateWaterEffect(0,0,20,40).flooded).toBe(false);
  });
  test("flood front grows across the playable northern lane without spawning particles",()=>{
    const scene=new THREE.Scene(),group=buildFloodgateBackdrop(scene);
    const stable=[...group.children];
    updateFloodgateBreachVisual(group,7);
    const front=group.getObjectByName("floodgate-wave");
    expect(front?.visible).toBe(true);
    expect(front?.position.z).toBeCloseTo(floodgateSurgeFront(7));
    const sheet=group.getObjectByName("floodgate-flooded-spillway");
    expect(sheet?.visible).toBe(true);
    expect(sheet?.scale.z).toBeGreaterThan(30);
    updateFloodgateBreachVisual(group,20);
    expect(front?.visible).toBe(false);
    expect(sheet?.scale.z).toBeCloseTo(67);
    expect(group.children).toEqual(stable);
    group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();
      for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();
    }});
  });
  test("freight containers topple into new accessible northern routes in both room maps",()=>{
    const first=makeEnvironmentMap(getMap("floodgate","ctf"));
    const second=makeEnvironmentMap(getMap("floodgate","ctf"));
    const count=(map:typeof first)=>map.cover.filter(b=>b.environmentId?.startsWith("floodgate-freight:"));
    expect(count(first)).toHaveLength(4);
    expect(count(first).every(b=>b.kind==="cover")).toBe(true);
    setFloodgateFreightStage(first,freightStage(1));
    expect(count(first)).toHaveLength(0); // No invisible standing cover while falling
    expect(count(second)).toHaveLength(4); // Rooms do not share mutable collision
    setFloodgateFreightStage(first,freightStage(FLOODGATE_TOPPLE_SECONDS));
    const fallen=count(first);
    expect(fallen).toHaveLength(FLOODGATE_FREIGHT.length*9);
    expect(fallen.filter(b=>b.kind==="stair")).toHaveLength(FLOODGATE_FREIGHT.length*8);
    expect(fallen.filter(b=>b.kind==="platform")).toHaveLength(FLOODGATE_FREIGHT.length);
    expect(fallen.filter(b=>b.kind==="stair").every(b=>b.pos[1]+b.size[1]<=3.36)).toBe(true);
    for(const item of FLOODGATE_FREIGHT){
      const ramp=fallen.filter(b=>b.environmentId?.startsWith("floodgate-freight:"+item.id+":step-"))
        .sort((a,b)=>a.pos[2]-b.pos[2]);
      expect(ramp).toHaveLength(8);
      for(let i=1;i<ramp.length;i++)expect(
        ramp[i].pos[1]+ramp[i].size[1]-(ramp[i-1].pos[1]+ramp[i-1].size[1])
      ).toBeCloseTo(.42,5);
      const landing=fallen.find(b=>b.environmentId==="floodgate-freight:"+item.id+":bridge")!;
      expect(landing.pos[1]+landing.size[1]).toBeCloseTo(3.36);
      const deck=first.cover.find(b=>b.kind==="platform"&&!b.environmentId &&
        Math.abs(b.pos[0]-item.x)<8&&Math.abs(b.pos[2]+50)<1);
      expect(deck).toBeDefined();
      expect(landing.pos[2]+landing.size[2]).toBeGreaterThanOrEqual(
        deck!.pos[2]-deck!.size[2]-.5);
    }
    setFloodgateFreightStage(first,"fallen");
    expect(count(first)).toHaveLength(fallen.length);
    setFloodgateFreightStage(first,"upright");
    expect(count(first)).toHaveLength(4);
    expect(count(second)).toHaveLength(4);
  });
  test("four new post-flood container ramps are actually climbable by bot physics",()=>{
    const map=makeEnvironmentMap(getMap("floodgate","tdm"));
    for(const id of [FLOODGATE_CORE_ID,...FLOODGATE_DAM_PANELS])breakEnvironmentWall(map,id);
    setFloodgateFreightStage(map,"fallen");
    const hazards=floodgatePathHazards(map,true);
    expect(hazards.some(o=>o.type==="spikes"&&o.visual==="steam")).toBe(false);
    expect(floodgatePathHazards(map,false).some(o=>o.type==="spikes"&&o.visual==="steam")).toBe(true);
    for(const item of FLOODGATE_FREIGHT){
      const height=botTraversableEdge([item.x,0,-88],item.x,-55,map.cover,hazards);
      expect(height).not.toBeNull();
      expect(height!).toBeGreaterThanOrEqual(3.3);
    }
  });
  test("fall animations reuse geometry and match the shared collapse clock",()=>{
    const scene=new THREE.Scene(),group=buildFloodgateFreight(scene),all=[...group.children];
    expect(group.getObjectByName("floodgate-freight:west-inner:stairs")?.visible).toBe(false);
    updateFloodgateFreight(group,FLOODGATE_TOPPLE_SECONDS/2);
    expect(group.getObjectByName("floodgate-freight:west-inner")?.rotation.x).toBeGreaterThan(-Math.PI/2);
    updateFloodgateFreight(group,FLOODGATE_TOPPLE_SECONDS);
    expect(group.getObjectByName("floodgate-freight:west-inner:stairs")?.visible).toBe(true);
    expect(group.children).toEqual(all);
    group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();
      for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();
    }});
  });
  test("visible cracks accumulate in four tiers without replacing the dam hitbox",()=>{
    expect(damCrackTier(FLOODGATE_DAM_HP,FLOODGATE_DAM_HP)).toBe(0);
    for(const [ratio,tier] of [[.8,1],[.6,2],[.4,3],[.2,4]] as const)
      expect(damCrackTier(FLOODGATE_DAM_HP*ratio,FLOODGATE_DAM_HP)).toBe(tier);
    const group=new THREE.Group();
    buildFloodgateDamCracks(group,8,5,4.19,9);
    const cracks=group.children.filter(c=>c.name.startsWith("floodgate-cracks"));
    expect(cracks).toHaveLength(4);
    for(const hp of [3000,2400,1800,1200,600]){
      updateFloodgateDamCracks(group,hp,FLOODGATE_DAM_HP);
      expect(cracks.filter(c=>c.visible)).toHaveLength(damCrackTier(hp,FLOODGATE_DAM_HP));
    }
    expect(cracks.every(c=>c instanceof THREE.Mesh)).toBe(true);
    for(const o of cracks){const line=o as THREE.Mesh;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
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
