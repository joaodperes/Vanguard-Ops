import {describe,expect,test} from "bun:test";
import {weaponById} from "../src/lib/game-data";
import {chooseQuickMeleeTarget,quickMeleeProfile} from "../src/lib/quick-melee";
import {botCombatDecision} from "../src/lib/bot-combat-posture";

describe("Gun Game bot melee resolution",()=>{
  const knife=weaponById("knife_tactical");
  const profile=quickMeleeProfile(knife.stats,knife.id);
  const target=(x:number,z:number)=>({id:"enemy",pos:[x,0,z] as [number,number,number],alive:true,friendly:false});
  test("bot must close to a real melee weapon reach",()=>{
    expect(profile.reach).toBeLessThan(2);
    expect(botCombatDecision("melee",8,true,true,true,true,false,"normal","rusher").aiming).toBe(false);
    expect(chooseQuickMeleeTarget([0,0,0],0,[target(0,profile.reach+.5)],()=>true,
      profile.reach,profile.halfArcDegrees)).toBeNull();
  });
  test("face direction and cover are respected",()=>{
    expect(chooseQuickMeleeTarget([0,0,0],0,[target(0,1)],()=>true,
      profile.reach,profile.halfArcDegrees)?.id).toBe("enemy");
    expect(chooseQuickMeleeTarget([0,0,0],0,[target(0,-1)],()=>true,
      profile.reach,profile.halfArcDegrees)).toBeNull();
    expect(chooseQuickMeleeTarget([0,0,0],0,[target(0,1)],()=>false,
      profile.reach,profile.halfArcDegrees)).toBeNull();
  });
  test("friendly targets and invulnerable opponents cannot be hit",()=>{
    expect(chooseQuickMeleeTarget([0,0,0],0,[{...target(0,1),friendly:true}],()=>true,
      profile.reach,profile.halfArcDegrees)).toBeNull();
    expect(chooseQuickMeleeTarget([0,0,0],0,[{...target(0,1),protected:true}],()=>true,
      profile.reach,profile.halfArcDegrees)).toBeNull();
  });
});
