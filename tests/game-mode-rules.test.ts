import { describe, expect, test } from "bun:test";
import type { ModeCombatant } from "../src/lib/game-mode-rules";
import {
  SEARCH_DESTROY_RULES, HARDPOINT_RULES, FRONTIER_RULES,
  createSearchDestroyState, beginNextSearchDestroyRound, finishSearchDestroyRound,
  applySearchDestroyAction, dropSearchDestroyBomb, tickSearchDestroy,
  createHardpointState, tickHardpoint, frontierWeaponAllowed, frontierWeaponIdAllowed, frontierReserveAmmo, frontierMovementSpeed, distributedObjectivePosition,
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
    expect(frontierWeaponIdAllowed("pistol_machine")).toBe(false);
    expect(frontierWeaponIdAllowed("wonder_phasebreaker")).toBe(false);
    expect(frontierReserveAmmo(30)).toBe(Math.floor(30*FRONTIER_RULES.reserveAmmoMultiplier));
    expect(frontierMovementSpeed(10,true)).toBeGreaterThan(10);
    expect(FRONTIER_RULES.dodgeCooldownMs).toBe(3000);
  });
});
