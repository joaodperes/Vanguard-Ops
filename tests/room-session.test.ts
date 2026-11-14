import {test,expect} from "bun:test";
test("the client keeps one room connection through results and rebuilds the next round",async()=>{
  const child=Bun.spawn([process.execPath,"tests/helpers/room-session-probe.ts"],{stdout:"pipe",stderr:"pipe"});
  const [out,err,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  expect(code,err).toBe(0);expect(out).toContain("Room session lifecycle passed");
},30000);
