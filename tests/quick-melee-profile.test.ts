import { describe,expect,test } from "bun:test";
import { weaponById } from "../src/lib/game-data";
import { quickMeleeProfile,chooseQuickMeleeTarget } from "../src/lib/quick-melee";

describe("equipped quick melee F",()=>{
  test("takes rate, damage and reach from the actual melee loadout",()=>{
    for(const id of ["knife_tactical","machete","shiv","baton","axe","hammer"]){
      const stats=weaponById(id).stats;
      const quick=quickMeleeProfile(stats,id);
      expect(quick.damage).toBe(stats.damage);
      expect(quick.reach).toBe(stats.range);
      expect(quick.cooldownMs).toBe(Math.ceil(1000/stats.fireRate));
      expect(quick.swingMs).toBeLessThanOrEqual(quick.cooldownMs);
    }
  });
  test("a hammer swings slower and hits harder than a shiv",()=>{
    const hammer=quickMeleeProfile(weaponById("hammer").stats);
    const shiv=quickMeleeProfile(weaponById("shiv").stats);
    expect(hammer.cooldownMs).toBeGreaterThan(shiv.cooldownMs);
    expect(hammer.swingMs).toBeGreaterThan(shiv.swingMs);
    expect(hammer.damage).toBeGreaterThan(shiv.damage);
  });
  test("practical close-quarters reach differs by melee weapon",()=>{
    const targets=[{id:"target",pos:[0,0,1.08] as const,alive:true}];
    const from=[0,0,0] as const;
    expect(chooseQuickMeleeTarget(from,0,targets,()=>true,weaponById("shiv").stats.range)).toBeNull();
    expect(chooseQuickMeleeTarget(from,0,targets,()=>true,weaponById("baton").stats.range)?.id).toBe("target");
    const far=[{id:"far",pos:[0,0,1.9] as const,alive:true}];
    expect(chooseQuickMeleeTarget(from,0,[{id:"hammer-only",pos:[0,0,1.7] as const,alive:true}],()=>true,weaponById("hammer").stats.range)?.id).toBe("hammer-only");
    expect(chooseQuickMeleeTarget(from,0,[{id:"hammer-only",pos:[0,0,1.7] as const,alive:true}],()=>true,weaponById("axe").stats.range)).toBeNull();
    for(const id of ["knife_tactical","machete","shiv","baton","axe","hammer"]) {
      const reach=quickMeleeProfile(weaponById(id).stats).reach;
      expect(chooseQuickMeleeTarget(from,0,far,()=>true,reach)).toBeNull();
    }
  });
});

test("melee rejects side/rear enemies even when they are inside radial reach",()=>{
 const from=[0,0,0] as const;
 const enemies=[
   {id:"side",pos:[.8,0,.45] as const,alive:true},
   {id:"ahead",pos:[.03,0,.7] as const,alive:true},
 ];
 expect(chooseQuickMeleeTarget(from,0,[enemies[0]],()=>true,1.5)).toBeNull();
 expect(chooseQuickMeleeTarget(from,0,enemies,()=>true,1.5)?.id).toBe("ahead");
 expect(chooseQuickMeleeTarget(from,0,[{id:"near",pos:[0,0,1.17] as const,alive:true}],()=>true,
   weaponById("knife_tactical").stats.range)).toBeNull();
});

describe("live-match melee arcs versus ideal stationary alignment",()=>{
  const origin=[0,0,0] as const;
  const opponent=(angleDegrees:number,distance:number,height=0)=>{
    const radians=angleDegrees*Math.PI/180;
    return { id:"opponent", pos:[Math.sin(radians)*distance,height,Math.cos(radians)*distance] as const, alive:true };
  };
  const hit=(weaponId:string,angleDegrees:number,distance:number,clearPath=()=>true,height=0)=>{
    const profile=quickMeleeProfile(weaponById(weaponId).stats,weaponId);
    return chooseQuickMeleeTarget(origin,0,[opponent(angleDegrees,distance,height)],clearPath,
      profile.reach,profile.halfArcDegrees);
  };
  test("ordinary melee can catch slight lateral movement on either side, not just centered dummies",()=>{
    for(const weaponId of ["shiv","knife_tactical","baton","machete"]){
      const reach=quickMeleeProfile(weaponById(weaponId).stats,weaponId).reach;
      expect(hit(weaponId,-21,reach*.93)?.id).toBe("opponent");
      expect(hit(weaponId,21,reach*.93)?.id).toBe("opponent");
      expect(hit(weaponId,34,reach*.9)).toBeNull();
    }
  });
  test("axe and hammer catch wider off-center targets, with hammer the broadest",()=>{
    const axe=quickMeleeProfile(weaponById("axe").stats,"axe");
    const hammer=quickMeleeProfile(weaponById("hammer").stats,"hammer");
    const machete=quickMeleeProfile(weaponById("machete").stats,"machete");
    expect(hit("machete",35,machete.reach*.8)).toBeNull();
    expect(hit("axe",-35,axe.reach*.91)?.id).toBe("opponent");
    expect(hit("hammer",35,hammer.reach*.91)?.id).toBe("opponent");
    expect(hit("axe",40,axe.reach*.8)).toBeNull();
    expect(hit("hammer",40,hammer.reach*.8)?.id).toBe("opponent");
    expect(hit("hammer",48,hammer.reach*.8)).toBeNull();
  });
  test("moving-target forgiveness never extends melee behind, through cover, or beyond weapon reach",()=>{
    expect(hit("hammer",90,1.2)).toBeNull();
    expect(hit("hammer",180,1.0)).toBeNull();
    expect(hit("hammer",25,1.84)).toBeNull();
    expect(hit("hammer",25,1.45,()=>false)).toBeNull();
    expect(hit("hammer",25,1.45,()=>true,1.3)).toBeNull();
  });
});
