import {describe,expect,test} from "bun:test";
import {calculateMatchRewards} from "../src/lib/match-rewards";
import type {MatchResultInput} from "../src/lib/player-service";

const base:Omit<MatchResultInput,"mode">={playerKey:"test",kills:0,deaths:0,headshots:0,won:false,score:0,completed:true,participants:2,durationSec:120};

describe("competitive mode progression rewards",()=>{
  test("Search & Destroy awards objective rewards for the player's round wins",()=>{
    const result=calculateMatchRewards({...base,mode:"searchdestroy",modeStats:{searchDestroy:{redRounds:4,blueRounds:2,roundsPlayed:6,playerRoundsWon:4}}});
    expect(result.breakdown.objectives).toEqual({xp:100,credits:60});
  });
  test("Hardpoint awards objective rewards for uncontested team hold time",()=>{
    const result=calculateMatchRewards({...base,mode:"hardpoint",modeStats:{hardpoint:{redObjectiveSeconds:70,blueObjectiveSeconds:30,contestedSeconds:12,redScore:70,blueScore:30,playerObjectiveSeconds:70}}});
    expect(result.breakdown.objectives).toEqual({xp:140,credits:70});
  });
  test("Frontier keeps normal match rewards and does not invent objective payouts",()=>{
    const result=calculateMatchRewards({...base,mode:"frontier",modeStats:{frontier:{ammoRemaining:24}}});
    expect(result.breakdown.objectives).toEqual({xp:0,credits:0});
  });
});
