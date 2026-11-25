import { describe, expect, test } from "bun:test";
import type { ModeCombatant } from "../src/lib/game-mode-rules";
import { calculateMatchRewards } from "../src/lib/match-rewards";
import { frontierLoadoutForPreset } from "../src/lib/frontier-loadouts";
import {
  SEARCH_DESTROY_RULES, HARDPOINT_RULES, FRONTIER_RULES,
  createSearchDestroyState, beginNextSearchDestroyRound, finishSearchDestroyRound,
  applySearchDestroyAction, dropSearchDestroyBomb, releaseSearchDestroyPlayer, tickSearchDestroy,
  createHardpointState, tickHardpoint, hardpointObjectiveContributors, frontierWeaponAllowed, frontierWeaponIdAllowed, frontierReserveAmmo, frontierMovementSpeed, distributedObjectivePosition,
} from "../src/lib/game-mode-rules";

describe("Search & Destroy", () => {
  const sites = [{ id: "A" as const, pos: [0,0,0] as const, radius: 4 }, { id: "B" as const, pos: [30,0,0] as const, radius: 4 }];
  test("uses the proposed 2-minute round, 5-second plant and 7-second defuse timings", () => {
    expect(SEARCH_DESTROY_RULES).toMatchObject({roundSeconds:120,plantSeconds:5,defuseSeconds:7,roundsToWin:6,maxRounds:11});
    const state=createSearchDestroyState(1000,"carrier",[0,0,0]);
    expect(state.preparationEndsAt).toBe(6000);
  });
  test("switches sides after round five and starts a fresh round", () => {
    const state=createSearchDestroyState(0,"carrier",[0,0,0]);
    state.phase="live";
    const events=finishSearchDestroyRound(state,"red","elimination",1000);
    expect(events[0]).toMatchObject({type:"round_won"});
    state.round=5; state.phase="live";
    expect(finishSearchDestroyRound(state,"blue","timeout",2000)).toContainEqual({type:"side_switch",attackerTeam:"blue"});
    beginNextSearchDestroyRound(state,3000,"new-carrier",[1,0,1]);
    expect(state).toMatchObject({round:6,phase:"preparation",attackerTeam:"blue",bomb:{carrierId:"new-carrier"}});
  });
  test("requires plant and defuse progress and supports dropped-bomb pickup", () => {
    const state=createSearchDestroyState(0,"attacker",[0,0,0]); state.phase="live";
    expect(applySearchDestroyAction(state,{kind:"plant",playerId:"attacker",team:"red",alive:true,pos:[0,0,0],siteId:"A"},sites,0)).toBeNull();
    expect(applySearchDestroyAction(state,{kind:"plant",playerId:"attacker",team:"red",alive:true,pos:[0,0,0],siteId:"A"},sites,5000)?.type).toBe("planted");
    expect(applySearchDestroyAction(state,{kind:"defuse",playerId:"defender",team:"blue",alive:true,pos:[0,0,0]},sites,6000)).toBeNull();
    expect(applySearchDestroyAction(state,{kind:"defuse",playerId:"defender",team:"blue",alive:true,pos:[0,0,0]},sites,13000)?.type).toBe("defused");
    const dropped=createSearchDestroyState(0,"attacker",[1,0,1]); dropped.phase="live";
    expect(dropSearchDestroyBomb(dropped,"attacker",[2,0,2])?.type).toBe("dropped");
    expect(applySearchDestroyAction(dropped,{kind:"pickup",playerId:"mate",team:"red",alive:true,pos:[2,0,2]},sites,100)?.type).toBe("picked_up");
  });
  test("disconnecting a carrier drops the bomb and disconnecting an actor cancels progress",()=>{
    const state=createSearchDestroyState(0,"carrier",[1,0,1]);state.phase="live";
    state.bomb.plantProgress={playerId:"carrier",startedAt:10};
    expect(releaseSearchDestroyPlayer(state,"carrier",[4,0,5])?.type).toBe("dropped");
    expect(state.bomb).toMatchObject({status:"dropped",carrierId:null,pos:[4,0,5],plantProgress:null});
    state.phase="planted";state.bomb.status="planted";state.bomb.defuseProgress={playerId:"defender",startedAt:20};
    releaseSearchDestroyPlayer(state,"defender",[0,0,0]);
    expect(state.bomb.defuseProgress).toBeNull();
  });
  test("releasing interaction cancels plant and defuse progress",()=>{
    const state=createSearchDestroyState(0,"attacker",[0,0,0]);state.phase="live";
    applySearchDestroyAction(state,{kind:"plant",playerId:"attacker",team:"red",alive:true,pos:[0,0,0],siteId:"A"},sites,0);
    expect(state.bomb.plantProgress?.playerId).toBe("attacker");
    applySearchDestroyAction(state,{kind:"cancel",playerId:"attacker",team:"red",alive:true,pos:[0,0,0]},sites,1000);
    expect(state.bomb.plantProgress).toBeNull();
    const planted=createSearchDestroyState(0,"attacker",[0,0,0]);planted.phase="planted";planted.bomb.status="planted";planted.bomb.pos=[0,0,0];
    applySearchDestroyAction(planted,{kind:"defuse",playerId:"defender",team:"blue",alive:true,pos:[0,0,0]},sites,0);
    applySearchDestroyAction(planted,{kind:"cancel",playerId:"defender",team:"blue",alive:true,pos:[0,0,0]},sites,1000);
    expect(planted.bomb.defuseProgress).toBeNull();
  });
  test("plants at the selected site and resets an interrupted defuse",()=>{
    const state=createSearchDestroyState(0,"attacker",[0,0,0]);state.phase="live";
    applySearchDestroyAction(state,{kind:"plant",playerId:"attacker",team:"red",alive:true,pos:[30,0,0],siteId:"B"},sites,0);
    expect(applySearchDestroyAction(state,{kind:"plant",playerId:"attacker",team:"red",alive:true,pos:[30,0,0],siteId:"B"},sites,5000)?.type).toBe("planted");
    expect(state.bomb.pos).toEqual([30,0,0]);
    expect(applySearchDestroyAction(state,{kind:"defuse",playerId:"defender",team:"blue",alive:true,pos:[30,0,0]},sites,6000)).toBeNull();
    expect(applySearchDestroyAction(state,{kind:"defuse",playerId:"defender",team:"blue",alive:true,pos:[45,0,0]},sites,9000)).toBeNull();
    expect(applySearchDestroyAction(state,{kind:"defuse",playerId:"defender",team:"blue",alive:true,pos:[30,0,0]},sites,10000)).toBeNull();
    expect(applySearchDestroyAction(state,{kind:"defuse",playerId:"defender",team:"blue",alive:true,pos:[30,0,0]},sites,16999)).toBeNull();
    expect(applySearchDestroyAction(state,{kind:"defuse",playerId:"defender",team:"blue",alive:true,pos:[30,0,0]},sites,17000)?.type).toBe("defused");
  });
  test("defender wins on timeout before plant; planted attackers win after defenders are eliminated", () => {
    const state=createSearchDestroyState(0,"attacker",[0,0,0]); state.phase="live"; state.roundEndsAt=1000;
    const alive:ModeCombatant[]=[{id:"a",team:"red",alive:true,pos:[0,0,0]},{id:"d",team:"blue",alive:true,pos:[0,0,0]}];
    expect(tickSearchDestroy(state,alive,1000)[0]).toMatchObject({type:"round_won",winner:"blue",reason:"timeout"});
    const planted=createSearchDestroyState(0,"attacker",[0,0,0]); planted.phase="planted"; planted.bomb.status="planted"; planted.bomb.detonatesAt=40000;
    expect(tickSearchDestroy(planted,[{...alive[0],alive:false},{...alive[1],alive:false}],2000)[0]).toMatchObject({type:"round_won",winner:"red"});
  });
});
describe("Objective bot positioning",()=>{
  test("assigns stable but distinct positions around the same objective",()=>{
    const anchor:[number,number,number]=[10,0,20];
    const a=distributedObjectivePosition(anchor,"bot-alpha"),b=distributedObjectivePosition(anchor,"bot-bravo");
    expect(a).not.toEqual(b);
    expect(distributedObjectivePosition(anchor,"bot-alpha")).toEqual(a);
    expect(Math.hypot(a[0]-anchor[0],a[2]-anchor[2])).toBeGreaterThanOrEqual(3.2);
  });
});
describe("Hardpoint personal objective credit",()=>{
  test("credits only living players on the uncontested owning team",()=>{
    const zone={id:"hill",pos:[0,0,0] as const,radius:6};
    const players=[
      {id:"red-on-point",team:"red" as const,alive:true,pos:[1,0,1] as const},
      {id:"red-away",team:"red" as const,alive:true,pos:[10,0,0] as const},
      {id:"red-dead",team:"red" as const,alive:false,pos:[0,0,0] as const},
      {id:"blue-on-point",team:"blue" as const,alive:true,pos:[0,0,0] as const},
    ];
    expect(hardpointObjectiveContributors(zone,"red",players)).toEqual(["red-on-point"]);
    expect(hardpointObjectiveContributors(zone,"contested",players)).toEqual([]);
    expect(hardpointObjectiveContributors(zone,"neutral",players)).toEqual([]);
  });
});

describe("Hardpoint", () => {
  test("scores one point per second for uncontested control and rotates across five zones", () => {
    expect(HARDPOINT_RULES.zoneCount).toBe(5);
    const state=createHardpointState(0), zones=Array.from({length:5},(_,i)=>({id:String(i),pos:[i*20,0,0] as const}));
    const players:ModeCombatant[]=[{id:"r",team:"red",alive:true,pos:[0,0,0]}];
    expect(tickHardpoint(state,zones,players,0,1000).state.scores.red).toBe(1);
    players.push({id:"b",team:"blue",alive:true,pos:[0,0,0]});
    expect(tickHardpoint(state,zones,players,1000,1000).scored).toBeNull();
    expect(state.scores.red).toBe(1);
    tickHardpoint(state,zones,players,60000,1000);
    expect(state.phase).toBe("transition");
  });
});
describe("Frontier", () => {
  test("allows only historical-style weapon families and makes movement the advantage", () => {
    expect(frontierWeaponAllowed("sniper")).toBe(true);
    expect(frontierWeaponAllowed("pistol")).toBe(true);
    expect(frontierWeaponAllowed("assault")).toBe(false);
    expect(frontierWeaponIdAllowed("pistol_magnum")).toBe(true);
    expect(frontierWeaponIdAllowed("sniper_scout")).toBe(true);
    expect(frontierWeaponIdAllowed("pistol_bastion")).toBe(true);
    expect(frontierWeaponIdAllowed("pistol_side")).toBe(true);
    expect(frontierWeaponIdAllowed("pistol_ghost")).toBe(true);
    expect(frontierWeaponIdAllowed("crossbow_reclaimer")).toBe(true);
    expect(frontierWeaponIdAllowed("pistol_machine")).toBe(false);
    expect(frontierWeaponIdAllowed("wonder_phasebreaker")).toBe(false);
    expect(frontierReserveAmmo(30)).toBe(Math.floor(30*FRONTIER_RULES.reserveAmmoMultiplier));
    expect(frontierMovementSpeed(10,true)).toBeGreaterThan(10);
    expect(FRONTIER_RULES.dodgeCooldownMs).toBe(3000);
  });
});


describe("Frontier curated loadouts",()=>{
  const base={weaponId:"rifle_ar",weaponSkinId:"default",playerSkinId:"default",attachments:{sight:null,barrel:null,grip:null,magazine:null}} as const;
  test("builds the four fixed kits with their intended attachments",()=>{
    const scout=frontierLoadoutForPreset(base as any,"scout");
    expect(scout).toMatchObject({weaponId:"sniper_scout",secondaryWeaponId:"pistol_bastion",attachments:{sight:"sight_hunter"},secondaryAttachments:{grip:"grip_fan_hammer"}});
    const breacher=frontierLoadoutForPreset(base as any,"breacher");
    expect(breacher).toMatchObject({weaponId:"shotgun_br",secondaryWeaponId:"pistol_side"});
    const hunter=frontierLoadoutForPreset(base as any,"hunter");
    expect(hunter).toMatchObject({weaponId:"crossbow_reclaimer",secondaryWeaponId:"pistol_ghost",attachments:{magazine:"mag_bolt_heavy"}});
    const gunslinger=frontierLoadoutForPreset(base as any,"gunslinger");
    expect(gunslinger).toMatchObject({weaponId:"pistol_side",secondaryWeaponId:"pistol_bastion",emptyPrimary:true,secondaryAttachments:{barrel:"barrel_ported",grip:"grip_akimbo",magazine:"mag_rev_speedloader"}});
  });
});

describe("objective-based mode rewards",()=>{
  test("Hardpoint pays personal objective time rather than the team's total",()=>{
    const rewards=calculateMatchRewards({
      playerKey:"test",kills:0,deaths:0,headshots:0,won:false,mode:"hardpoint",score:0,completed:true,
      modeStats:{hardpoint:{redObjectiveSeconds:90,blueObjectiveSeconds:90,contestedSeconds:0,redScore:90,blueScore:90,playerObjectiveSeconds:30}},
    });
    expect(rewards.breakdown.objectives).toEqual({xp:60,credits:30});
  });
  test("Search & Destroy rewards confirmed plants and defuses for the player who completes them",()=>{
    const rewards=calculateMatchRewards({
      playerKey:"test",kills:0,deaths:0,headshots:0,won:false,mode:"searchdestroy",score:0,completed:true,
      modeStats:{searchDestroy:{redRounds:3,blueRounds:2,roundsPlayed:5,playerRoundsWon:3,plants:2,defuses:1}},
    });
    expect(rewards.breakdown.objectives).toEqual({xp:250,credits:80});
  });
  test("Search & Destroy pays per won round in addition to the match-win bonus",()=>{
    const rewards=calculateMatchRewards({
      playerKey:"test",kills:0,deaths:0,headshots:0,won:true,mode:"searchdestroy",score:0,completed:true,
      placement:1,participants:6,
      modeStats:{searchDestroy:{redRounds:6,blueRounds:4,roundsPlayed:10,playerRoundsWon:6}},
    });
    expect(rewards.breakdown.objectives).toEqual({xp:150,credits:90});
    expect(rewards.breakdown.matchPerformance.xp).toBeGreaterThanOrEqual(150);
    expect(rewards.breakdown.matchPerformance.credits).toBeGreaterThanOrEqual(25);
  });
});
