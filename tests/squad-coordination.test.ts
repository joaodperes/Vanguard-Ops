import {expect,test} from "bun:test";
import {squadIntent} from "../src/lib/squad-coordination";

const self={id:"b",team:"red",pos:[0,0,0] as [number,number,number],health:100,alive:true};
const ally={...self,id:"a",pos:[3,0,0] as [number,number,number]};

test("allied bots retain autonomous staging and flanking movement",()=>{
  const intent=squadIntent({self,allies:[ally],mode:"tdm",now:100,target:[20,0,0]});
  expect(intent?.role).toBe("staging");
  expect(intent?.goal).toHaveLength(3);
  expect(squadIntent({self,allies:[ally],mode:"tdm",now:3000,target:[20,0,0]})?.role).toBe("flanking");
});

test("team coordination yields to critical duties and unsupported modes",()=>{
  const base={self,allies:[ally],mode:"tdm" as const,now:3000,target:[20,0,0] as [number,number,number]};
  expect(squadIntent({...base,critical:true})).toBeNull();
  for(const mode of ["ffa","gungame","survival"] as const)expect(squadIntent({...base,mode})).toBeNull();
  expect(squadIntent({...base,target:undefined})).toBeNull();
});

test("wounded allies fall back and support provides covering movement",()=>{
  expect(squadIntent({self:{...self,health:20},allies:[ally],mode:"tdm",now:3000})?.role).toBe("falling back");
  expect(squadIntent({self:{...self,ai:{archetype:"support"}},allies:[{...ally,health:20}],mode:"tdm",now:3000,target:[20,0,0]})?.role).toBe("covering retreat");
});
