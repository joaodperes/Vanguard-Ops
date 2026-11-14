import {expect,test} from "bun:test";
import {squadIntent,validSquadOrder,squadOrderPoint} from "../src/lib/squad-coordination";
const self={id:"b",team:"red",pos:[0,0,0] as [number,number,number],health:100,alive:true};
const ally={...self,id:"a",pos:[3,0,0] as [number,number,number]};
test("orders validate their kind, coordinates, range and team",()=>{
 expect(validSquadOrder("attack",[20,0,0],self.pos,"red","a",0)).not.toBeNull();
 for(const p of [[NaN,0,0],[1000,0,0],[1,2]])expect(validSquadOrder("attack",p,self.pos,"red","a",0)).toBeNull();
 expect(validSquadOrder("teleport",[0,0,0],self.pos,"red","a",0)).toBeNull();
});
test("orders expire, stay team-private and do not override critical duties",()=>{
 const order=validSquadOrder("defend",[20,0,0],self.pos,"red","a",0)!;
 const base={self,allies:[ally],mode:"tdm" as const,now:100,order};
 expect(squadIntent(base)?.role).toBe("defend");
 expect(squadIntent({...base,now:16000})).toBeNull();
 expect(squadIntent({...base,critical:true})).toBeNull();
 expect(squadIntent({...base,order:{...order,team:"blue"}})).toBeNull();
 for(const mode of ["ffa","gungame","survival"] as const)expect(squadIntent({...base,mode})).toBeNull();
});
test("wounded allies fall back and support provides covering movement",()=>{
 expect(squadIntent({self:{...self,health:20},allies:[ally],mode:"tdm",now:3000})?.role).toBe("falling back");
 expect(squadIntent({self:{...self,ai:{archetype:"support"}},allies:[{...ally,health:20}],mode:"tdm",now:3000,target:[20,0,0]})?.role).toBe("covering retreat");
});
test("server and client placement use the same navigable destination",()=>{
 expect(squadOrderPoint(self.pos,0,"defend",[])).toEqual(self.pos);
 expect(squadOrderPoint(self.pos,0,"attack",[[0,0,19]])).toEqual([0,0,19]);
});
