import {describe, expect, test} from "bun:test";
import * as THREE from "three";
import {renderToStaticMarkup} from "react-dom/server";
import {combatIdentity, tracerIdentity} from "../src/lib/combat-identity";
import {combatThreats, type CombatHazard} from "../src/lib/combat-threats";
import {WEAPONS} from "../src/lib/game-data";
import {resolveWeaponSoundProfile, resolveShotAcoustics} from "../src/lib/weapon-audio";
import {buildFirstPersonWeapon} from "../src/lib/weapon-models";
import {Hud} from "../src/components/game/Hud";
import type {HudState} from "../src/lib/fps-engine";
import {makeEngineStub} from "./helpers/engine-stub";

const viewer={id:"self",team:"blue",freeForAll:false,pos:[0,0,0] as [number,number,number],yaw:0,now:100};
const hazard=(overrides:Partial<CombatHazard>={}):CombatHazard=>({
  id:"well",weaponId:"wonder_singularity",pos:[0,1,3],radius:5,expiresAt:1000,
  ownerId:"enemy",ownerTeam:"red",...overrides,
});
describe("combat identity",()=>{
  test("every shipped Wonder has a named mechanic, a cue and useful counterplay",()=>{
    for(const weapon of WEAPONS.filter(w=>w.wonder)){
      const cue=combatIdentity(weapon.id);
      expect(cue.color).toMatch(/^#[a-f0-9]{6}$/);
      expect(cue.counterplay).not.toBe("Use solid cover");
      expect(cue.label.length).toBeGreaterThan(2);
    }
  });
  test("ordinary tracers stay subtle while rail, smart, cryo and storm have recognisable colours",()=>{
    expect(tracerIdentity("rifle_ar")).toEqual({color:"#ffcc66",life:45});
    for(const id of ["wonder_phasebreaker","wonder_deadlock","wonder_whiteout","wonder_stormweaver"]){
      expect(tracerIdentity(id).color).toBe(combatIdentity(id).color);
      expect(tracerIdentity(id).life).toBeLessThanOrEqual(100);
    }
  });
  test("controller and reactor accents use the combat cue in first and third person geometry",()=>{
    for(const id of ["wonder_chrono","wonder_juggernaut","wonder_deadlock","wonder_phasebreaker"]){
      const materials:string[]=[];
      const body=new THREE.MeshBasicMaterial({color:0x222222}),dark=new THREE.MeshBasicMaterial({color:0x111111});
      buildFirstPersonWeapon(id,body,dark,mesh=>{
        mesh.traverse(o=>{if(o instanceof THREE.Mesh){
          for(const m of Array.isArray(o.material)?o.material:[o.material]){
            if(m instanceof THREE.MeshBasicMaterial)materials.push("#"+m.color.getHexString());
          }
        }});
      });
      expect(materials).toContain(combatIdentity(id).color);
    }
  });
  test("Wonder sounds differ by envelope and spectrum, preserve ADS level and distance falloff",()=>{
    const ids=["wonder_singularity","wonder_deadlock","wonder_stormweaver","wonder_phasebreaker","wonder_whiteout","wonder_chrono"];
    expect(new Set(ids.map(id=>JSON.stringify(resolveWeaponSoundProfile("pistol",id)))).size).toBe(ids.length);
    for(const weaponId of ids){
      const opts={weaponId,distance:5};
      const dry=resolveShotAcoustics("pistol",opts);
      expect(resolveShotAcoustics("pistol",{...opts,aiming:true})).toEqual(dry);
      expect(resolveShotAcoustics("pistol",{...opts,distance:90}).level).toBe(0);
      expect(dry.reportLevel).toBe(0);
    }
  });
  test("network control activations never draw fake bullets; rail shots keep their source identity",()=>{
    const e=makeEngineStub();
    Object.assign(e,{selfId:"self",opts:{mode:"tdm",team:"blue"},combatants:new Map(),playEnemyFireSound:()=>{}});
    const sources:string[]=[];
    e.spawnTracer=(...args:any[])=>sources.push(args[6]);
    for(const weaponId of ["wonder_chrono","wonder_phantom","wonder_harbinger","wonder_juggernaut","wonder_whiteout"])
      e.onServerMessage({t:"shotFx",attackerId:"enemy",origin:[0,1,0],dir:[0,0,1],skinId:"default",weaponId});
    expect(sources).toEqual([]);
    e.onServerMessage({t:"shotFx",attackerId:"enemy",origin:[0,1,0],dir:[0,0,1],skinId:"default",weaponId:"wonder_phasebreaker"});
    expect(sources).toEqual(["wonder_phasebreaker"]);
  });
  test("replicated mine ownership distinguishes enemies and unknown legacy mines",()=>{
    const e=makeEngineStub();
    Object.assign(e,{selfId:"self",opts:{mode:"tdm",team:"blue"},alive:true,matchEnded:false,yaw:0,
      scene:new THREE.Scene(),wonderFields:new Map(),gravityWells:new Map(),stormMines:new Map(),mechDrops:new Map(),hasLineOfSight:()=>true});
    const common={t:"stormMinePlaced",pos:[0,0,2],expiresAt:Date.now()+10000};
    e.onServerMessage({...common,id:"legacy"});
    e.onServerMessage({...common,id:"ally",ownerId:"friend",ownerTeam:"blue"});
    e.onServerMessage({...common,id:"hostile",ownerId:"enemy",ownerTeam:"red"});
    expect(e.visibleCombatThreats().map(t=>t.id)).toEqual(["hostile"]);
    const mesh=e.stormMines.get("legacy").mesh;
    e.addStormMine("legacy",[0,0,2],Date.now()+10000,false,"enemy","red");
    expect(e.stormMines.get("legacy").mesh).toBe(mesh);
    expect(e.visibleCombatThreats().map(t=>t.id).sort()).toEqual(["hostile","legacy"]);
  });
  test("remote tracer ignores the local weapon and cosmetic emissives",()=>{
    const e=makeEngineStub();
    e.scene=new THREE.Scene();e.tracers=[];e.weaponId="wonder_phasebreaker";
    e.coverForRay=()=>[];e.eff={range:80};
    e.spawnTracer([0,1,0],[0,0,1],"prestige_toxic",0,40,12,"rifle_ar");
    const shot=e.tracers[0];
    expect(shot.line.material.color.getHexString()).toBe("ffcc66");
    expect(shot.life).toBe(45);
    const points=shot.line.geometry.attributes.position;
    expect(points.getZ(1)).toBeCloseTo(12);
  });
});
describe("visible combat warnings",()=>{
  test("never exposes expired, friendly, owned, hidden, distant or other-floor hazards",()=>{
    for(const h of [hazard({expiresAt:100}),hazard({ownerTeam:"blue"}),hazard({ownerId:"self"}),hazard({pos:[0,0,50]}),hazard({pos:[0,5,1]})]){
      let casts=0;
      expect(combatThreats([h],viewer,()=>{casts++;return true;})).toEqual([]);
      expect(casts).toBe(0);
    }
    expect(combatThreats([hazard()],viewer,()=>false)).toEqual([]);
  });
  test("dense visible hazards stop LOS work as soon as the two warnings are selected",()=>{
    let casts=0;
    expect(combatThreats(Array.from({length:200},(_,i)=>hazard({id:String(i)})),viewer,()=>{casts++;return true;})).toHaveLength(2);
    expect(casts).toBe(2);
  });
  test("FFA opponents remain hostile even with the same team string",()=>{
    expect(combatThreats([hazard({ownerTeam:"blue"})],{...viewer,freeForAll:true},()=>true)).toHaveLength(1);
  });
  test("arrows rotate with the viewer and current danger is prioritised over nearby danger",()=>{
    const threats=combatThreats([
      hazard({id:"near",pos:[7,0,0]}),hazard({id:"inside",pos:[0,0,2]}),hazard({id:"far",pos:[0,0,8]}),
    ],viewer,()=>true);
    expect(threats.map(t=>t.id)).toEqual(["inside","near"]);
    expect(threats[0].inside).toBe(true);
    expect(threats[1].angle).toBeCloseTo(Math.PI/2);
    expect(combatThreats([hazard({pos:[7,0,0]})],{...viewer,yaw:Math.PI/2},()=>true)[0].angle).toBeCloseTo(0);
  });
  test("landing danger applies to the pilot and teammates; spherical wells respect altitude",()=>{
    const drop=hazard({ownerId:"self",ownerTeam:"blue",weaponId:"wonder_juggernaut",hurtsEveryone:true});
    expect(combatThreats([drop],viewer,()=>true)[0].action).toBe("Clear the landing zone");
    expect(combatThreats([hazard({pos:[0,7,0],spherical:true})],viewer,()=>true)[0].inside).toBe(false);
    expect(combatThreats([hazard({pos:[0,4,0],spherical:true})],viewer,()=>true)[0].inside).toBe(true);
  });
  test("actual engine collects replicated hazards and suppresses warnings on death",()=>{
    const e=makeEngineStub();
    Object.assign(e,{selfId:"self",opts:{mode:"tdm",team:"blue"},alive:true,matchEnded:false,yaw:0,
      wonderFields:new Map(),gravityWells:new Map(),stormMines:new Map(),mechDrops:new Map(),hasLineOfSight:()=>true});
    e.stormMines.set("mine",{...hazard({id:"mine",weaponId:"wonder_stormweaver",expiresAt:Date.now()+10000}),pos:[0,0,2]});
    e.stormMines.set("old-server",{...hazard({expiresAt:Date.now()+10000}),ownerId:""});
    expect(e.visibleCombatThreats().map(t=>t.id)).toEqual(["mine"]);
    e.alive=false;expect(e.visibleCombatThreats()).toEqual([]);
  });
  test("HUD renders text and direction for touch and desktop and removes them on death",()=>{
    const hud={alive:true,weaponId:"wonder_chrono",weaponName:"Chrono Anchor",scoreboard:[],teamScores:{red:0,blue:0},
      killFeed:[],primaryName:"Rifle",secondaryName:"Pistol",meleeName:"Knife",combatThreats:combatThreats([hazard()],viewer,()=>true),primaryWeaponId:"rifle_ar",secondaryWeaponId:"pistol_side",meleeWeaponId:"knife_tactical"} as unknown as HudState;
    for(const isTouch of [false,true]){
      const html=renderToStaticMarkup(<Hud hud={hud} onExit={()=>{}} mode="tdm" isTouch={isTouch}/>);
      expect(html).toContain("GRAVITY");expect(html).toContain("Leave the gravity well");
      expect(html).toContain("Direction of hazard");
    }
    expect(renderToStaticMarkup(<Hud hud={{...hud,alive:false}} onExit={()=>{}} mode="tdm"/>)).not.toContain('data-testid="combat-threats"');
  });
});
