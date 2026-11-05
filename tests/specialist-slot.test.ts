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
  test("engine starts with a drained Wonder and respawns never grant a charge",()=>{
    const weapon="wonder_deadlock";
    const now=performance.now();
    const state=drainedWonderCharges({maxCharges:2,rechargeMs:50000,killBonusMs:1000},now);
    const e:any=Object.create(FPSEngine.prototype);
    Object.assign(e,{weaponId:weapon,wonderWeaponId:weapon,primaryWeaponId:"rifle_ar",
      primaryEff:{magSize:30},secondaryEff:{magSize:12},meleeEff:{magSize:1},
      wonderEff:{magSize:2},wonderStates:new Map([[weapon,state]]),
    });
    expect(e.wonderStates.get(weapon).charges).toBe(0);
    e.refillAmmoOnRespawn();
    expect(e.wonderStates.get(weapon)).toEqual(state);
    expect(e.ammoInMag).toBe(0);
    expect(e.primaryAmmoInMag).toBe(30);
    e.wonderStates.set(weapon,{charges:1,nextAt:now+50000});
    e.refillAmmoOnRespawn();
    expect(e.wonderStates.get(weapon)).toEqual({charges:1,nextAt:now+50000});
  });
  test("missing match charge state is empty; Firing Range may test Wonders immediately",()=>{
    const rules={maxCharges:2,rechargeMs:50000,killBonusMs:1000};
    const engine:any=Object.create(FPSEngine.prototype);
    engine.wonderStates=new Map();
    engine.opts={firingRange:false};
    const state=engine.ensureWonderState("wonder_deadlock",rules,1000);
    expect(state).toEqual({charges:0,nextAt:51000});
    expect(engine.ensureWonderState("wonder_deadlock",rules,9000)).toBe(state);
    engine.wonderStates.clear();
    engine.opts.firingRange=true;
    expect(engine.ensureWonderState("wonder_deadlock",rules,1000).charges).toBe(2);
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
  test("Bulwark P-9 ammo is not reloaded by weapon swapping",()=>{
    const p9:any=Object.create(FPSEngine.prototype);
    Object.assign(p9,{
      opts:{mode:"tdm",online:false,loadout:{perkId:"wonder_weapon"}},
      currentSlot:"wonder",wonderWeaponId:"wonder_riot_shield",weaponId:"wonder_riot_shield",
      alive:true,ammoInMag:5,wonderAmmoInMag:12,primaryAmmoInMag:16,
      secondaryAmmoInMag:9,meleeAmmoInMag:1,
      primaryWeaponId:"rifle_ar",secondaryWeaponId:"pistol_side",meleeWeaponId:"knife_tactical",
      primaryEff:{magSize:30},secondaryEff:{magSize:12},meleeEff:{magSize:1},
      wonderEff:{magSize:12},primarySight:{},secondarySight:{},meleeSight:{},wonderSight:{},
      sound:{play(){}},buildViewmodel(){},equipmentAction:null,survivalDowned:false,reloading:false,
    });
    p9.swapWeapon("primary");
    expect(p9.wonderAmmoInMag).toBe(5);
    p9.swapWeapon("wonder");
    expect(p9.ammoInMag).toBe(5);
    p9.refillAmmoOnRespawn();
    expect(p9.wonderAmmoInMag).toBe(12);
    expect(p9.ammoInMag).toBe(12);
  });
  test("Bulwark bash replaces F but does not modify selected slot-three melee",()=>{
    expect(riotBashProfile().damage).toBe(RIOT_BASH_DAMAGE);
    expect(riotBashProfile().reach).toBe(RIOT_BASH_REACH);
    expect(riotBashProfile().cooldownMs).toBe(900);
  });
});
