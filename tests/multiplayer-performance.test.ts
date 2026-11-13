import {expect,test} from "bun:test";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";

test("large-map rooms sustain authoritative snapshots with bots and 32 real socket clients",()=>{
  const dir=mkdtempSync(join(tmpdir(),"vanguard-performance-")),dbPath=join(dir,"test.db");
  try{
    writeFileSync(dbPath,"");
    const env={...process.env,DATABASE_URL:`file:${dbPath}`};
    const setup=spawnSync("node",["node_modules/prisma/build/index.js","db","push","--skip-generate"],
      {env,encoding:"utf8",timeout:30000});
    expect(setup.status,setup.stdout+setup.stderr).toBe(0);
    const run=spawnSync(process.execPath,["tests/helpers/multiplayer-performance-runner.ts"],
      {env,encoding:"utf8",timeout:100000});
    expect(run.status,run.stdout+run.stderr).toBe(0);
    expect(run.stdout).toContain("Multiplayer performance scenarios passed");
    if(process.env.VANGUARD_PERFORMANCE_REPORT)writeFileSync(process.env.VANGUARD_PERFORMANCE_REPORT,run.stdout);
  }finally{rmSync(dir,{recursive:true,force:true});}
},135000);
