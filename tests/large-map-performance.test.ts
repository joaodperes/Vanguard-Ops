import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {MovementSendBudget} from "../src/lib/movement-send-budget";
import {ActorSpatialIndex} from "../src/lib/actor-spatial-index";
import {mapCoverIndex,invalidateMapCoverIndex} from "../src/lib/map-cover-index";
import {batchStaticMapMeshes} from "../src/lib/static-prop-batching";
import {WorldLightBudget} from "../src/lib/world-light-budget";
import {BotRouteBudget} from "../src/lib/bot-performance-budget";
import {PerformanceSamples} from "../src/lib/performance-samples";
import {MAP_LIST,MAPS,rayBox,type C2S,type CoverBox,type Vec3} from "../src/lib/game-protocol";
import {makeEnvironmentMap,moveEnvironmentCover,breakEnvironmentWall,closestCoverHit} from "../src/lib/dynamic-environment";
import {setFloodgateFreightStage} from "../src/lib/floodgate-topple";
import {traceCoverPenetration} from "../src/lib/cover-penetration";
import {mapBoxUV} from "../src/lib/map-materials";
import {makeEngineStub} from "./helpers/engine-stub";

const state=():Extract<C2S,{t:"state"}>=>({t:"state",pos:[0,0,0],yaw:0,pitch:0,
  aiming:false,firing:false,reloading:false,alive:true,sprinting:false});
let seed=373;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;}

describe("movement transmission independent of rendering",()=>{
  test("moving clients stay within 30 packets/sec at 30–240 FPS",()=>{
    for(const fps of [30,60,144,240]){
      const budget=new MovementSendBudget(),s=state();let sent=0;
      for(let frame=0;frame<fps*3;frame++){
        s.pos[0]=frame/fps;
        if(budget.shouldSend(frame/fps*1000,s))sent++;
      }
      expect(sent).toBeLessThanOrEqual(90);expect(sent).toBeGreaterThanOrEqual(75);
    }
  });
  test("idle heartbeat, live mutable positions and immediate combat transitions",()=>{
    const budget=new MovementSendBudget(),s=state();
    expect(budget.shouldSend(0,s)).toBe(true);
    expect(budget.shouldSend(100,s)).toBe(false);
    expect(budget.shouldSend(250,s)).toBe(true);
    s.aiming=true;expect(budget.shouldSend(251,s)).toBe(true);
    s.sprinting=true;expect(budget.shouldSend(252,s)).toBe(true);
    s.reloading=true;expect(budget.shouldSend(253,s)).toBe(true);
    s.firing=true;expect(budget.shouldSend(254,s)).toBe(true);
    s.pos[0]=5;expect(budget.shouldSend(288,s)).toBe(true);
    expect(budget.shouldSend(322,s)).toBe(false);
    budget.reset();expect(budget.shouldSend(323,s)).toBe(true);
  });
});

describe("actor locality preserves live positions and solver order",()=>{
  test("queries match a full roster after crossings, teleports and removals",()=>{
    const actors=Array.from({length:100},(_,i)=>({id:String(i),pos:[random()*300-150,i%3,random()*300-150] as Vec3}));
    const index=new ActorSpatialIndex<typeof actors[number]>();index.rebuild(actors);
    for(let i=0;i<80;i++){
      const actor=actors[i%actors.length];actor.pos=[random()*300-150,0,random()*300-150];index.update(actor);
      const x=random()*300-150,z=random()*300-150,r=3+random()*40;
      expect(index.near(x,z,r)).toEqual(actors.filter(a=>Math.abs(a.pos[0]-x)<=r&&Math.abs(a.pos[2]-z)<=r));
    }
    index.rebuild(actors.slice(2));expect(index.size).toBe(98);
    expect(index.near(0,0,1000).map(a=>a.id)).toEqual(actors.slice(2).map(a=>a.id));
    expect(index.near(0,0,1e300).length).toBe(98);
    expect(index.near(0,0,Infinity).length).toBe(98);
    expect(index.near(NaN,0,10)).toEqual([]);
    expect(index.near(1e300,1e300,3)).toEqual([]);
  });
  test("indexed separation matches the full ordered solver, including dense crowds and floors",()=>{
    for(const mode of ["ffa","ctf"]){
      for(const crowded of [false,true]){
        const roster=Array.from({length:32},(_,i)=>({id:String(i),alive:i%7!==0,
          pos:[(random()-.5)*(crowded?6:300),i%6===0?5:0,(random()-.5)*(crowded?6:300)] as Vec3}));
        const run=(indexed:boolean)=>{
          const e=makeEngineStub();e.opts={mode};e.alive=true;e.pos.set(0,0,0);
          e.combatants=new Map(roster.map(a=>[a.id,{...a,pos:[...a.pos]}]));
          if(indexed)e.actorIndex.rebuild(e.combatants.values());
          for(const bot of e.combatants.values())if(bot.alive){
            e.separateBots(bot,bot.pos[1]);if(indexed)e.actorIndex.update(bot);
          }
          return [...e.combatants.values()].map((a:any)=>a.pos);
        };
        expect(run(true)).toEqual(run(false));
      }
    }
  });
});

describe("cover broadphase keeps gameplay exact on every map",()=>{
  test("local candidates preserve authored order across cells and dynamic cover",()=>{
    const right:CoverBox={pos:[20,1,0],size:[2,1,2]};
    const moving:CoverBox={pos:[0,1,0],size:[2,1,2],environmentId:"platform"};
    const left:CoverBox={pos:[-20,1,0],size:[2,1,2]};
    const map={cover:[right,moving,left]};
    expect(mapCoverIndex(map).along(-30,0,30,0)).toEqual(map.cover);
    moving.pos=[20,1,0];
    expect(mapCoverIndex(map).near(20,0)).toEqual([right,moving]);
  });
  test("full-list and indexed shot impacts/penetration agree across all shipped maps",()=>{
    for(const base of MAP_LIST){
      const map=makeEnvironmentMap(base);
      for(let i=0;i<18;i++){
        const spawn=map.spawns.ffa[i%map.spawns.ffa.length];
        const origin:Vec3=[spawn[0],spawn[1]+1.3,spawn[2]],yaw=random()*Math.PI*2;
        const dir:Vec3=[Math.sin(yaw),.06*(random()-.5),Math.cos(yaw)],range=240;
        const end:Vec3=[origin[0]+dir[0]*range,origin[1]+dir[1]*range,origin[2]+dir[2]*range];
        const cover=mapCoverIndex(map).along(origin[0],origin[2],end[0],end[2],.001);
        const full=closestCoverHit(map.cover,origin,dir,range,rayBox),local=closestCoverHit(cover,origin,dir,range,rayBox);
        expect(local?.distance).toBe(full?.distance);
        // Coincident proxies can tie; the impact position and penetration result
        // (including stable panel IDs) are the gameplay contract.
        expect(traceCoverPenetration(cover,origin,dir,range,4)).toEqual(traceCoverPenetration(map.cover,origin,dir,range,4));
      }
    }
  });
  test("moving platforms, replaced arrays and in-place wall destruction invalidate safely",()=>{
    const box:CoverBox={pos:[1,1,1],size:[1,1,1]},moving:CoverBox={pos:[2,1,2],size:[1,1,1],environmentId:"moving"};
    const map={cover:[box,moving]};
    const index=mapCoverIndex(map);expect(index.near(2,2)).toContain(moving);
    expect(new Set(index.queryBox(-1e300,1e300,-1e300,1e300))).toEqual(new Set(map.cover));
    expect(index.queryBox(-Infinity,Infinity,0,1)).toEqual([]);
    expect(index.near(1e300,1e300,3)).toEqual([]);
    moving.pos=[120,1,-120];expect(index.near(120,-120)).toContain(moving);expect(index.near(2,2)).not.toContain(moving);
    map.cover=[box];expect(mapCoverIndex(map).near(120,-120)).not.toContain(moving);
    map.cover[0]={pos:[70,1,70],size:[1,1,1]};invalidateMapCoverIndex(map);
    expect(mapCoverIndex(map).near(70,70)).toEqual(map.cover);
    for(const base of MAP_LIST){
      const live=makeEnvironmentMap(base);
      for(const object of live.environment??[]){
        if(object.type!=="moving_platform"&&object.type!=="destructible_wall")continue;
        mapCoverIndex(live);
        if(object.type==="moving_platform"){
          moveEnvironmentCover(live,object,object.period/2);
          const moved=live.cover.find(c=>c.environmentId===object.id)!;
          expect(mapCoverIndex(live).near(moved.pos[0],moved.pos[2])).toContain(moved);
        }else{
          breakEnvironmentWall(live,object.id);
          expect(mapCoverIndex(live).near(object.pos[0],object.pos[2]).some(c=>c.environmentId===object.id)).toBe(false);
        }
      }
    }
  });
  test("Floodgate freight stages retain precisely the current local colliders",()=>{
    const map=makeEnvironmentMap(MAPS.floodgate);
    for(const age of [null,0,8,15,25,60]){
      mapCoverIndex(map);setFloodgateFreightStage(map,age);
      for(const box of map.cover.filter(c=>c.environmentId?.startsWith("floodgate-freight:")))
        expect(mapCoverIndex(map).near(box.pos[0],box.pos[2])).toContain(box);
      const indexed=new Set(mapCoverIndex(map).queryBox(-1000,1000,-1000,1000));
      expect(indexed).toEqual(new Set(map.cover));
    }
  });
});

describe("spatial rendering batches retain authored surfaces",()=>{
  test("UVs, world bounds, triangles and mutable panels survive batching",()=>{
    const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial(),meshes:THREE.Mesh[]=[];
    for(const x of [1,5,9,80,84]){
      const geometry=new THREE.BoxGeometry(3,2,4);mapBoxUV(geometry,x,0,7);
      const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,2,0);mesh.castShadow=true;mesh.receiveShadow=true;
      scene.add(mesh);meshes.push(mesh);
    }
    const panel=new THREE.Mesh(new THREE.BoxGeometry(1,3,4),material);panel.userData.ballisticId="glass";scene.add(panel);
    const before=new THREE.Box3().setFromObject(scene);
    const uv=meshes.flatMap(m=>Array.from(m.geometry.attributes.uv.array)).sort((a,b)=>a-b);
    const triangles=meshes.reduce((n,m)=>n+m.geometry.index!.count/3,0);
    expect(batchStaticMapMeshes(scene,[...meshes,panel])).toBe(3);
    expect(panel.parent).toBe(scene);expect(panel.userData.ballisticId).toBe("glass");
    const batched:THREE.Mesh[]=[];scene.traverse(o=>{if(o instanceof THREE.Mesh&&o!==panel)batched.push(o);});
    expect(batched).toHaveLength(2);
    expect(batched.flatMap(m=>Array.from(m.geometry.attributes.uv.array)).sort((a,b)=>a-b)).toEqual(uv);
    expect(batched.reduce((n,m)=>n+m.geometry.index!.count/3,0)).toBe(triangles);
    const after=new THREE.Box3().setFromObject(scene);expect(after.min.toArray()).toEqual(before.min.toArray());expect(after.max.toArray()).toEqual(before.max.toArray());
    for(const mesh of batched){expect(mesh.castShadow).toBe(true);expect(mesh.receiveShadow).toBe(true);}
  });
  test("weapon swaps retain body joints, labels and body GPU resources",()=>{
    const e=makeEngineStub();e.scene=new THREE.Scene();e.showHealthBars=true;
    e.makeTextSprite=()=>new THREE.Sprite(new THREE.SpriteMaterial());
    const c:any={id:"bot",name:"Bot",team:"red",isBot:true,alive:true,pos:[0,0,0],weaponId:"rifle_ar",weaponSkinId:"default",playerSkinId:"red"};
    e.addCombatantMesh(c);
    const root=c.group,body=c.parts.bodyMat,torso=c.parts.torso,label=c.nameSprite;let disposed=0;
    body.addEventListener("dispose",()=>disposed++);
    for(const weaponId of ["pistol_side","knife_tactical","lmg_hv","shotgun_auto","rifle_ar"]){
      const previous=c.parts.weaponStub;c.weaponId=weaponId;e.rebuildCombatantMesh(c);
      expect(c.group).toBe(root);expect(c.parts.torso).toBe(torso);expect(c.parts.bodyMat).toBe(body);expect(c.nameSprite).toBe(label);
      expect(previous.parent).toBeNull();expect(c.parts.weaponStub.parent).toBe(root);expect(disposed).toBe(0);
    }
    c.playerSkinId="blue";e.rebuildCombatantMesh(c);expect(c.group).not.toBe(root);expect(disposed).toBe(1);
  });
});

describe("bounded light and diagnostic workloads",()=>{
  test("fixture flicker and overlapping gravity fields keep a constant rendered light count",()=>{
    const scene=new THREE.Scene(),fixtures:THREE.PointLight[]=[];
    for(let i=0;i<22;i++){
      const light=new THREE.PointLight(0xff9900,2,12);light.position.set(i*10,2,0);scene.add(light);fixtures.push(light);
    }
    const budget=new WorldLightBudget(scene,6),nodes=[...scene.children];
    const lights=()=>{const result:THREE.PointLight[]=[];scene.traverseVisible(o=>{if(o instanceof THREE.PointLight)result.push(o);});return result;};
    const pool=lights();expect(pool).toHaveLength(6);
    const listener=new THREE.Vector3();budget.update(0,listener);expect(pool.some(l=>l.intensity>0)).toBe(true);
    const dynamic:THREE.PointLight[]=[];
    for(let i=0;i<30;i++){
      const light=new THREE.PointLight(0x8844ff,7,20);dynamic.push(light);budget.register(light,()=>true);
      fixtures[0].intensity=1+i/100;budget.update(i*101,listener);
      expect(lights()).toEqual(pool);expect(scene.children).toEqual(nodes);
    }
    for(const light of dynamic)budget.remove(light);
    for(const fixture of fixtures)fixture.intensity=0;
    budget.update(4000,listener);expect(pool.every(l=>l.intensity===0&&l.visible)).toBe(true);
    budget.dispose();budget.dispose();expect(lights()).toHaveLength(0);
  });
  test("offline route searches have a time ceiling rather than a refresh-rate multiplier",()=>{
    for(const fps of [60,144,240]){
      const budget=new BotRouteBudget();let searches=0;
      for(let frame=0;frame<fps;frame++){
        budget.beginWindow(frame/fps*1000,2);
        while(budget.take())searches++;
      }
      expect(searches).toBeLessThanOrEqual(40);expect(searches).toBeGreaterThanOrEqual(34);
    }
  });
  test("diagnostic percentiles use a bounded recent window and reject invalid samples",()=>{
    const samples=new PerformanceSamples(4);for(const value of [2,4,6,8,10,NaN,-1])samples.add(value);
    expect(samples.summary()).toEqual({samples:4,p50:6,p95:10,p99:10,max:10});
  });
});
