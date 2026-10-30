import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { weaponById } from "../src/lib/game-data";
import {
  RIOT_SHIELD_HP, RIOT_SHIELD_ID, RIOT_SHIELD_RECHARGE_MS,
  RIOT_SHIELD_KILL_BONUS_MS, hitRiotShield, tickRiotShield,
  accelerateRiotShield, riotShieldCooldownMs, rayRiotShield,
} from "../src/lib/riot-shield";
import { createRiotShieldModel, applyRiotShieldDamageVisual } from "../src/lib/riot-shield-model";

describe("Bulwark shield cooldown and hit effects", () => {
  test("catalog and shared server/offline repair rules agree", () => {
    const w=weaponById(RIOT_SHIELD_ID);
    expect(w.wonder?.kind).toBe("shield");
    expect(w.wonder?.rechargeMs).toBe(RIOT_SHIELD_RECHARGE_MS);
    expect(w.wonder?.killBonusMs).toBe(RIOT_SHIELD_KILL_BONUS_MS);
    expect(w.stats.magSize).toBe(12); // regular P-9 mag remains independent
  });
  test("partial damage persists; only the breaking shot starts a full-rebuild timer", () => {
    const start=1000;
    const scratched=hitRiotShield(RIOT_SHIELD_HP,0,70,start);
    expect(scratched).toEqual({hp:180,readyAt:0});
    expect(tickRiotShield(scratched.hp,scratched.readyAt,start+60_000).hp).toBe(180);
    const broken=hitRiotShield(180,0,250,start+4000);
    expect(broken).toEqual({hp:0,readyAt:start+4000+RIOT_SHIELD_RECHARGE_MS});
    expect(hitRiotShield(0,broken.readyAt,999,start+6000)).toEqual(broken);
    const carrier={pos:[0,0,0] as [number,number,number],yaw:0,
      weaponId:RIOT_SHIELD_ID,riotShieldRaised:true,riotShieldHp:broken.hp};
    expect(rayRiotShield([0,1,8],[0,0,-1],carrier)).toBeNull();
    expect(tickRiotShield(broken.hp,broken.readyAt,broken.readyAt-1).hp).toBe(0);
    expect(tickRiotShield(broken.hp,broken.readyAt,broken.readyAt)).toEqual({
      hp:RIOT_SHIELD_HP,readyAt:0,
    });
  });
  test("every kill accelerates a broken shield with no overdraft or duplicate repair", () => {
    const broken=hitRiotShield(70,0,70,1000);
    let state=accelerateRiotShield(broken.hp,broken.readyAt,3000);
    expect(riotShieldCooldownMs(state.hp,state.readyAt,3000))
      .toBe(RIOT_SHIELD_RECHARGE_MS-4000);
    for(let i=0;i<15;i++)state=accelerateRiotShield(state.hp,state.readyAt,3000);
    expect(state).toEqual({hp:RIOT_SHIELD_HP,readyAt:0});
    expect(accelerateRiotShield(state.hp,state.readyAt,3000)).toEqual(state);
    // A new life with full durability never carries a prior rebuild deadline.
    expect(riotShieldCooldownMs(RIOT_SHIELD_HP,0,3000)).toBe(0);
  });
  test("first and third-person shield models show the same progressive damage",()=>{
    for(const unlit of [false,true]){
      const model=createRiotShieldModel(unlit);
      expect(model).toBeInstanceOf(THREE.Group);
      expect(applyRiotShieldDamageVisual(model,250)).toBe(0);
      expect(applyRiotShieldDamageVisual(model,249)).toBe(1); // first absorbed bullet leaves a mark
      expect(applyRiotShieldDamageVisual(model,175)).toBe(1);
      expect(applyRiotShieldDamageVisual(model,110)).toBe(2);
      expect(applyRiotShieldDamageVisual(model,40)).toBe(3);
      const groups=model.userData.damageGroups as THREE.Group[];
      expect(groups.map(g=>g.visible)).toEqual([true,true,true]);
      expect(groups.every(g=>g.children[0] instanceof THREE.LineSegments)).toBe(true);
      applyRiotShieldDamageVisual(model,250);
      expect(groups.every(g=>!g.visible)).toBe(true);
      model.traverse(obj=>{
        if(obj instanceof THREE.Line || obj instanceof THREE.Mesh){
          obj.geometry.dispose();
          for(const m of Array.isArray(obj.material)?obj.material:[obj.material])m.dispose();
        }
      });
    }
  });
});
