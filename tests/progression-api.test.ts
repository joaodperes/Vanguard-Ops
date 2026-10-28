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
