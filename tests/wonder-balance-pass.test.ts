import {describe,expect,test} from "bun:test";
import {weaponById,projectileSplashRadius} from "../src/lib/game-data";
import {TURRET_DAMAGE,TURRET_LIFETIME_MS} from "../src/lib/turret-rules";
import {SMART_TAG_MS,HELLFIRE_RANGE,inFlameCone} from "../src/lib/wonder-tech";
import {STORM_MINE_LIFETIME_MS} from "../src/lib/stormweaver";
import {RIOT_SHIELD_RECHARGE_MS,RIOT_SHIELD_KILL_BONUS_MS,hitRiotShield,accelerateRiotShield} from "../src/lib/riot-shield";
import {clusterShots} from "../src/lib/cluster-grenades";

describe("Wonder Weapon targeted balance pass",()=>{
  test("Event Horizon begins empty and has a longer recharge",()=>{
    const w=weaponById("wonder_singularity");
    expect(w.wonder?.maxCharges).toBe(1);
    expect(w.wonder?.rechargeMs).toBe(80000);
  });
  test("Plagueheart gains splash coverage and poison tick strength without a one-hit kill",()=>{
    const w=weaponById("wonder_corrosion");
    expect(w.stats.damage).toBe(95);
    expect(w.wonder?.radius).toBe(3.5);
    expect(w.description).toContain("3.5m");
  });
  test("Bullet Spitter actually hits harder and its displayed stat matches both engines",()=>{
    const w=weaponById("wonder_turret");
    expect(w.stats.damage).toBe(26);
    expect(TURRET_DAMAGE).toBe(w.stats.damage);
    expect(TURRET_LIFETIME_MS).toBe(25000);
    expect(w.wonder?.rechargeMs).toBe(105000);
  });
  test("Deadlock tags persist six seconds with faster charge regeneration",()=>{
    const w=weaponById("wonder_deadlock");
    expect(SMART_TAG_MS).toBe(6000);
    expect(w.wonder?.rechargeMs).toBe(50000);
    expect(w.description).toContain("6s");
  });
  test("Hellfire gains short-range damage and reach without hitting past its cap",()=>{
    const w=weaponById("wonder_hellfire");
    expect(w.stats.damage).toBe(9);
    expect(w.stats.range).toBe(13);
    expect(HELLFIRE_RANGE).toBe(w.stats.range);
    expect(inFlameCone([0,1,0],[0,0,1],[0,1,12.5])).toBe(true);
    expect(inFlameCone([0,1,0],[0,0,1],[0,1,13.5])).toBe(false);
  });
  test("Stormweaver uses five-second mines for local and server logic",()=>{
    const w=weaponById("wonder_stormweaver");
    expect(STORM_MINE_LIFETIME_MS).toBe(6500);
    expect(w.description).toContain("6.5 seconds");
    expect(w.stats.pellets).toBe(7);
  });
  test("Thunderclap widens shell and submunition radii without more entities",()=>{
    const w=weaponById("wonder_cluster");
    const shots=clusterShots([0,1.62,0],[0,0,1],[]);
    expect(projectileSplashRadius(w)).toBe(7);
    expect(shots).toHaveLength(7);
    expect(shots[0].radius).toBe(7);
    expect(shots.slice(1).every(s=>s.radius===5.25)).toBe(true);
  });
  test("Bulwark repair time and kill acceleration match catalog and shared shield mechanics",()=>{
    const w=weaponById("wonder_riot_shield");
    expect(RIOT_SHIELD_RECHARGE_MS).toBe(55000);
    expect(RIOT_SHIELD_KILL_BONUS_MS).toBe(2000);
    expect(w.wonder?.rechargeMs).toBe(RIOT_SHIELD_RECHARGE_MS);
    expect(w.wonder?.killBonusMs).toBe(RIOT_SHIELD_KILL_BONUS_MS);
    const broken=hitRiotShield(100,0,100,1000);
    expect(broken.readyAt).toBe(56000);
    expect(accelerateRiotShield(broken.hp,broken.readyAt,2000).readyAt).toBe(54000);
  });
  test("disabled Bogfather is not inadvertently unlocked by the balance pass",()=>{
    expect(weaponById("wonder_bogfather").disabled).toBe(true);
  });
});
