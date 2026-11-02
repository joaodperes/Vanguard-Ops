import {describe,expect,test} from "bun:test";
import {FPSEngine} from "../src/lib/fps-engine";
import {PERKS,DEFAULT_PERK_ID,scavengerAmmoAmount} from "../src/lib/perks";
import {parseSavedLoadouts} from "../src/lib/saved-loadouts";
import {drainedWonderCharges,fullWonderCharges,tickWonderCharges,accelerateWonderCharge,spendWonderCharge} from "../src/lib/wonder-charge";
import {riotBashProfile,RIOT_BASH_DAMAGE,RIOT_BASH_REACH} from "../src/lib/riot-shield";


describe("Specialist perk and slot-four loadout",()=>{
  test("Battle-Hardened remains default; Wonder Weapon is available at level one",()=>{
    expect(DEFAULT_PERK_ID).toBe("battle_hardened");
    expect(PERKS.find(x=>x.id==="wonder_weapon")?.unlockLevel).toBe(1);
  });
  test("legacy saved presets with a Wonder in primary are removed, ordinary presets survive",()=>{
    const presets=[
      {id:"old",name:"Old",primaryWeapon:"wonder_deadlock",secondaryWeapon:"pistol_side",meleeWeapon:"knife_tactical"},
      {id:"new",name:"New",primaryWeapon:"rifle_ar",secondaryWeapon:"pistol_side",meleeWeapon:"knife_tactical",
       perkId:"wonder_weapon",wonderWeaponId:"wonder_deadlock"},
    ];
    const parsed=parseSavedLoadouts(JSON.stringify(presets));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("new");
    expect(parsed[0].wonderWeaponId).toBe("wonder_deadlock");
  });
  test("loadout swap drains charge; death leaves its recharge timer untouched",()=>{
    const rules={maxCharges:2,rechargeMs:40000,killBonusMs:1000};
    const fresh=fullWonderCharges(rules);
    expect(fresh.charges).toBe(2);
    const drained=drainedWonderCharges(rules,1000);
    expect(drained).toEqual({charges:0,nextAt:41000});
    const afterDeath={...drained};
    expect(tickWonderCharges(afterDeath,rules,10000).charges).toBe(0);
    const afterKill=accelerateWonderCharge(afterDeath,rules,12000);
    expect(afterKill.nextAt).toBe(40000);
    expect(tickWonderCharges(afterKill,rules,40000).charges).toBe(1);
    expect(spendWonderCharge(afterDeath,rules,20000)).toBeNull();
  });
  test("Scavenger fills the active conventional magazine but not holstered slots",()=>{
    const e:any=Object.create(FPSEngine.prototype);
    Object.assign(e,{currentSlot:"secondary",weaponId:"pistol_side",ammoInMag:3,
      primaryAmmoInMag:4,secondaryAmmoInMag:3,meleeAmmoInMag:1,
      eff:{magSize:12},sound:{play(){}},scavengerAmmoGained:0});
    e.collectScavengerAmmo();
    expect(e.ammoInMag).toBe(12);
    expect(e.secondaryAmmoInMag).toBe(12);
    expect(e.primaryAmmoInMag).toBe(4);
    expect(e.scavengerAmmoGained).toBe(9);
    expect(scavengerAmmoAmount(30)).toBe(30);
    e.currentSlot="wonder";e.weaponId="wonder_deadlock";e.ammoInMag=0;e.eff={magSize:2};
    e.collectScavengerAmmo();
    expect(e.ammoInMag).toBe(0);
    expect(e.scavengerAmmoGained).toBe(0);
  });
  test("Bulwark bash replaces F but does not modify selected slot-three melee",()=>{
    expect(riotBashProfile().damage).toBe(RIOT_BASH_DAMAGE);
    expect(riotBashProfile().reach).toBe(RIOT_BASH_REACH);
    expect(riotBashProfile().cooldownMs).toBe(900);
  });
});
