import {describe,expect,test} from "bun:test";
import {makeEngineStub} from "./helpers/engine-stub";

function activeMech() {
  return {id:"drop-01",moduleId:"",armor:120,minigunAmmo:0,
    secondaryAmmo:0,enteredAt:100,expiresAt:999999};
}

describe("Juggernaut voluntary exit",()=>{
  test("offline exit consumes the suit, clears firing state and returns to the normal view",()=>{
    const engine=makeEngineStub();
    const removed:string[]=[];
    let cockpitCleared=false;
    engine.alive=true;
    engine.opts={online:false};
    engine.mechActive=activeMech();
    engine.mechRightDown=true;
    engine.mechRightPressed=true;
    engine.mouseDown=true;
    engine.clearMechCockpit=()=>{cockpitCleared=true;};
    engine.removeMechDrop=(id:string)=>{removed.push(id);};
    engine.sound={play:()=>{}};
    engine.exitMech();
    expect(engine.mechActive).toBeNull();
    expect(engine.mechRightDown).toBe(false);
    expect(engine.mouseDown).toBe(false);
    expect(cockpitCleared).toBe(true);
    expect(removed).toEqual(["drop-01"]);
  });
  test("online exit requests authoritative removal and waits for the server broadcast",()=>{
    const engine=makeEngineStub();
    const sent:unknown[]=[];
    engine.alive=true;
    engine.opts={online:true};
    engine.mechActive=activeMech();
    engine.socket={emit:(_event:string,message:unknown)=>sent.push(message)};
    engine.exitMech();
    expect(sent).toEqual([{t:"exitMech"}]);
    expect(engine.mechActive).not.toBeNull();
  });
  test("normal operators cannot send exit commands",()=>{
    const engine=makeEngineStub();
    const sent:unknown[]=[];
    engine.alive=true;
    engine.opts={online:true};
    engine.mechActive=null;
    engine.socket={emit:(_event:string,message:unknown)=>sent.push(message)};
    engine.exitMech();
    expect(sent).toHaveLength(0);
  });
});
