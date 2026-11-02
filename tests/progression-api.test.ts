import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Database } from "bun:sqlite";

test("real SQLite API regressions: perk saves, quest levels, Career spending and recovery", () => {
  const dir = mkdtempSync(join(tmpdir(), "vanguard-progression-"));
  try {
    writeFileSync(join(dir, "test.db"), "");
    const env = { ...process.env, DATABASE_URL: `file:${join(dir, "test.db")}` };
    // Start from the shipped schema and a real legacy player, then apply the
    // additive change without --accept-data-loss before exercising endpoints.
    const legacySchema = readFileSync("prisma/schema.prisma", "utf8").replace(/^  career(?:Rank|Xp) .*\n/gm, "");
    writeFileSync(join(dir, "legacy.prisma"), legacySchema);
    const legacy = spawnSync("node", ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", join(dir, "legacy.prisma")], { env, encoding: "utf8", timeout: 30000 });
    expect(legacy.status, legacy.stdout + legacy.stderr).toBe(0);
    const sqlite = new Database(join(dir, "test.db"));
    sqlite.run(`INSERT INTO Player (id, playerKey, name, level, xp, credits, updatedAt) VALUES ('legacy', 'legacy-player', 'Legacy', 1, 130050, 36000, CURRENT_TIMESTAMP)`);
    sqlite.run(`INSERT INTO Loadout (id, playerId, perkId, updatedAt) VALUES ('legacy-loadout', 'legacy', 'steady', CURRENT_TIMESTAMP)`);
    sqlite.close();
    const setup = spawnSync("node", ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env, encoding: "utf8", timeout: 30000 });
    expect(setup.status, setup.stdout + setup.stderr).toBe(0);
    const result = spawnSync(process.execPath, ["tests/helpers/progression-api-runner.ts"], { env, encoding: "utf8", timeout: 30000 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("All progression API scenarios passed");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 65000);

test("existing SQLite Loadout upgrades its Wonder column automatically without losing rows", () => {
  const dir=mkdtempSync(join(tmpdir(),"vanguard-wonder-upgrade-"));
  try {
    const dbPath=join(dir,"legacy.db");
    const env={...process.env,DATABASE_URL:`file:${dbPath}`};
    const original=readFileSync("prisma/schema.prisma","utf8");
    const old=original.replace(/^  wonderWeaponId\s+String[^\n]*\n/m,"");
    expect(old).not.toBe(original);
    const schemaPath=join(dir,"legacy.prisma");
    writeFileSync(schemaPath,old);
    const setup=spawnSync("node",["node_modules/prisma/build/index.js","db","push","--skip-generate","--schema",schemaPath],
      {env,encoding:"utf8",timeout:30000});
    expect(setup.status,setup.stdout+setup.stderr).toBe(0);
    const sqlite=new Database(dbPath);
    sqlite.run("INSERT INTO Player (id,playerKey,name,level,xp,credits,updatedAt) VALUES ('old','old-wonder-slot-player','Legacy Wonder User',7,12345,830,CURRENT_TIMESTAMP)");
    sqlite.run("INSERT INTO Loadout (id,playerId,primaryWeapon,perkId,updatedAt) VALUES ('old-kit','old','rifle_ar','battle_hardened',CURRENT_TIMESTAMP)");
    expect(sqlite.query("PRAGMA table_info('Loadout')").all().some((row:any)=>row.name==="wonderWeaponId")).toBe(false);
    sqlite.close();
    const upgraded=spawnSync(process.execPath,["tests/helpers/wonder-schema-upgrade-runner.ts"],
      {env,encoding:"utf8",timeout:30000});
    expect(upgraded.status,upgraded.stdout+upgraded.stderr).toBe(0);
    expect(upgraded.stdout).toContain("Legacy Wonder slot upgraded");
    const reopened=new Database(dbPath);
    const columns=reopened.query("PRAGMA table_info('Loadout')").all() as Array<{name:string}>;
    expect(columns.some(row=>row.name==="wonderWeaponId")).toBe(true);
    const kit=reopened.query("SELECT primaryWeapon,perkId,wonderWeaponId FROM Loadout WHERE playerId='old'").get()
      as {primaryWeapon:string;perkId:string;wonderWeaponId:string};
    expect(kit).toEqual({primaryWeapon:"rifle_ar",perkId:"battle_hardened",wonderWeaponId:""});
    expect((reopened.query("SELECT credits FROM Player WHERE id='old'").get() as {credits:number}).credits).toBe(830);
    reopened.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
},65000);
