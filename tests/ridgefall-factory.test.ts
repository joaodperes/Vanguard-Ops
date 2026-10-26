import { describe,expect,test } from "bun:test";
import { MAPS } from "../src/lib/game-protocol";
import { MAP_BLUEPRINTS,insideRegions } from "../src/lib/map-blueprints";
import { visualThemeForMap, propColliders } from "../src/lib/map-visuals";
import { FACTORY_MACHINE_KINDS, buildFactoryMachinery, isFactoryMachineKind } from "../src/lib/factory-machinery";
import * as THREE from "three";

describe("Ridgefall factory redesign",()=>{
  const blueprint=MAP_BLUEPRINTS.maps.skybridge;
  const compiled=MAPS.skybridge;
  const theme=visualThemeForMap("skybridge");
  test("replaces outdoor skybridge geometry without changing the map ID",()=>{
    expect(compiled.id).toBe("skybridge");
    expect(compiled.name).toBe("RIDGEFALL");
    expect(compiled.biome).toBe("factory_interior");
    expect(compiled.editorLegacyCoverCount).toBe(0);
    expect(blueprint.regions.length).toBeGreaterThanOrEqual(5);
    expect(compiled.wallHeight).toBe(18);
    expect(compiled.spawns.ffa).toEqual(blueprint.spawns.ffa);
    expect(compiled.spawns.red).toEqual(blueprint.spawns.red);
    expect(compiled.spawns.blue).toEqual(blueprint.spawns.blue);
  });
  test("has raised factory gantries, barriers, loading bays and breachable security gate",()=>{
    expect(blueprint.features.filter(f=>f.kind==="platform").length).toBeGreaterThanOrEqual(4);
    expect(blueprint.features.filter(f=>f.kind==="stairs").length).toBeGreaterThanOrEqual(4);
    expect(blueprint.features.some(f=>f.kind==="cover"&&(f.y??0)>0)).toBe(true);
    expect(compiled.environment?.some(e=>e.type==="destructible_wall"&&e.id==="factory-blast-door")).toBe(true);
  });
  test("replaces alpine scenery with industrial props and materials",()=>{
    expect(theme.vegetation).toBe(0);
    expect(theme.surfaces?.floor.pattern).toBe("concrete");
    expect(theme.props.some(p=>p.kind==="crane")).toBe(true);
    expect(theme.props.some(p=>p.kind==="container")).toBe(true);
    expect(theme.props.some(p=>p.kind==="tree")).toBe(false);
  });
  test("keeps authored combat spawns inside factory collision boundaries",()=>{
    for(const p of Object.values(blueprint.spawns).flat())
      expect(insideRegions(p[0],p[2],blueprint.regions,1.1)).toBe(true);
  });
  test("fills the production halls with themed factory machinery rather than bare cover",()=>{
    const machines=theme.props.filter(p=>isFactoryMachineKind(p.kind));
    expect(machines.length).toBeGreaterThanOrEqual(25);
    expect(new Set(machines.map(p=>p.kind))).toEqual(new Set(FACTORY_MACHINE_KINDS));
    expect(compiled.props?.filter(p=>isFactoryMachineKind(p.kind)).length).toBe(machines.length);
    for(const p of machines){
      expect(insideRegions(p.x,p.z,blueprint.regions,1)).toBe(true);
      if(p.kind==="industrial_pipe"){
        expect(p.y).toBeGreaterThanOrEqual(11);
        expect((p.y??0)+(p.h??0)).toBeLessThan(17.9);
      }else{
        // Dressing overlays are fitted to existing solid blueprint machinery.
        // They must not create new impassable corridors or ghost collision.
        const base=blueprint.features.find(f=>f.kind==="cover"&&
          Math.abs(f.x-p.x)<.01&&Math.abs(f.z-p.z)<.01&&
          Math.abs(f.w-(p.w??0))<.01&&Math.abs(f.d-(p.d??0))<.01&&
          Math.abs(f.h-(p.h??0))<.01);
        expect(base?.kind).toBe("cover");
      }
    }
    expect(propColliders(machines,compiled.spawns.ffa)).toEqual([]);
  });
  test("shared FPS and editor factory asset builder makes identifiable real meshes",()=>{
    for(const kind of FACTORY_MACHINE_KINDS){
      const g=new THREE.Group();
      buildFactoryMachinery(g,kind,12,8,5);
      let count=0;
      g.traverse(o=>{if(o instanceof THREE.Mesh)count++;});
      expect(count).toBeGreaterThanOrEqual(3);
      if(kind==="furnace"){
        let hot=false,hasLight=false;
        g.traverse(o=>{
          if(o instanceof THREE.Mesh &&
            o.material instanceof THREE.MeshStandardMaterial &&
            o.material.emissiveIntensity>1.8)hot=true;
          if(o instanceof THREE.PointLight)hasLight=true;
        });
        expect(hot).toBe(true);expect(hasLight).toBe(true);
      }
    }
  });
});
