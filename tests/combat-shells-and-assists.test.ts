import {describe,expect,test} from "bun:test";
import {WEAPONS,ATTACHMENTS,compatibleAttachments,computeEffectiveStats,REWARDS} from "../src/lib/game-data";
import {allSkinChallengesForWeapon} from "../src/lib/armory-challenges";
import {countEligibleAssists,type Contribution} from "../src/lib/combat-assists";
import {TURRET_INTERVAL_MS,turretCanAttack} from "../src/lib/turret-rules";

const empty={sight:null,barrel:null,grip:null,magazine:null} as const;
const shells=["mag_slug","mag_pellets","mag_dragons_breath","mag_beanbag"] as const;

describe("shotgun ammunition",()=>{
  test("shell profiles exist in the same magazine slot and work on every standard shotgun",()=>{
    for(const ammo of shells){
      const def=ATTACHMENTS.find(a=>a.id===ammo);
      expect(def).toBeDefined();
      expect(def?.slot).toBe("magazine");
      expect(def?.shotgunAmmo).toBeTruthy();
    }
    for(const shotgun of WEAPONS.filter(w=>w.category==="shotgun"&&!w.wonder)){
      const choices=compatibleAttachments(shotgun.id,"magazine");
      for(const ammo of shells)expect(choices).toContain(ammo);
    }
  });
  test("slug changes a pellet cloud into an accurate heavier single hit",()=>{
    const mauler=WEAPONS.find(w=>w.id==="shotgun_combat")!;
    const base=computeEffectiveStats(mauler,{...empty});
    const slug=computeEffectiveStats(mauler,{...empty,magazine:"mag_slug"});
    expect(slug.pellets).toBe(1);
    expect(slug.damage).toBeGreaterThan(base.damage);
    expect(slug.spread).toBeLessThan(base.spread);
    expect(slug.range).toBeGreaterThan(base.range*2);
  });
  test("pellets spread wider, beanbags fire faster, Dragon's Breath triggers incendiary profile",()=>{
    const w=WEAPONS.find(x=>x.id==="shotgun_combat")!;
    const base=computeEffectiveStats(w,{...empty});
    const cloud=computeEffectiveStats(w,{...empty,magazine:"mag_pellets"});
    const bean=computeEffectiveStats(w,{...empty,magazine:"mag_beanbag"});
    const fire=computeEffectiveStats(w,{...empty,magazine:"mag_dragons_breath"});
    expect(cloud.pellets).toBeGreaterThan(base.pellets??0);
    expect(cloud.spread).toBeGreaterThan(base.spread);
    expect(bean.pellets).toBeLessThan(base.pellets??999);
    expect(bean.fireRate).toBeGreaterThan(base.fireRate);
    expect(bean.damage).toBeLessThan(base.damage);
    // Dragon's Breath is now a close-range incendiary pellet fan, not a slug.
    expect(fire.pellets).toBeGreaterThan(1);
    expect(fire.pellets).toBeLessThan(base.pellets??999);
    expect(fire.shotgunAmmo).toBe("dragons_breath");
  });
  test("Mauler combat shotgun is specialized for close quarters with steep falloff",()=>{
    const w=WEAPONS.find(x=>x.id==="shotgun_combat")!;
    expect(w.stats.range).toBeGreaterThanOrEqual(10);
    expect(w.stats.range).toBeLessThanOrEqual(15);
    expect(w.stats.minDamageMultiplier??1).toBeLessThanOrEqual(.25);
    expect(w.stats.falloffEndMultiplier??9).toBeLessThanOrEqual(1.8);
  });
  test("melee is faster than its own base move speed and never has a headshot objective",()=>{
    const w=WEAPONS.find(x=>x.id==="knife_tactical")!;
    expect(computeEffectiveStats(w,{...empty}).moveSpeed).toBeGreaterThan(w.stats.moveSpeed);
    const carbon=allSkinChallengesForWeapon("knife_tactical")
      .find(x=>x.id==="wc_knife_tactical_hs_50");
    expect(carbon?.goal).toBe(50);
    expect(carbon?.metric).toBe("close_range_kills");
    expect(carbon?.description).toContain("close-range");
        for(const weapon of WEAPONS.filter(w=>w.category==="melee"))
      for(const challenge of allSkinChallengesForWeapon(weapon.id))
        expect(challenge.metric).not.toBe("headshots");
  });
});

describe("assists and deployable guns",()=>{
  test("awards meaningful recent allied damage once, never killer or unrelated opponents",()=>{
    const now=42_000;
    const players=new Map<string,Contribution>([
      ["teammate",{damage:26,at:now-2500,team:"red"}],
      ["killer",{damage:45,at:now-200,team:"red"}],
      ["enemy",{damage:80,at:now-400,team:"blue"}],
      ["tiny",{damage:5,at:now-400,team:"red"}],
      ["old",{damage:21,at:now-12000,team:"red"}],
    ]);
    expect(countEligibleAssists(players,"killer","red",now)).toEqual(["teammate"]);
    expect(countEligibleAssists(players,"killer","ffa",now)).toEqual([]);
    expect(REWARDS.assistXp).toBeGreaterThan(0);
    expect(REWARDS.assistCredits).toBeGreaterThan(0);
  });
  test("Bullet Spitter is a real targetable enemy weapon and fires more rapidly",()=>{
    expect(TURRET_INTERVAL_MS).toBeLessThan(300);
    expect(turretCanAttack("tdm","red","blue",false)).toBe(true);
    expect(turretCanAttack("tdm","red","red",false)).toBe(false);
    expect(turretCanAttack("ffa","ffa","ffa",true)).toBe(false);
  });
});
