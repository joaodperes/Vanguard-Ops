// Isolated child process: DATABASE_URL always points to a disposable SQLite DB.
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db } from "../../src/lib/db";
import { POST as saveLoadout } from "../../src/app/api/loadout/route";
import { POST as preset } from "../../src/app/api/loadout/presets/route";
import { POST as promote } from "../../src/app/api/profile/career/route";
import { POST as equipTitle } from "../../src/app/api/profile/title/route";
import { GET as exportProfile } from "../../src/app/api/profile/export/route";
import { POST as importProfile } from "../../src/app/api/profile/import/route";
import { getOrCreatePlayer, buildProfileView, applyMatchResult } from "../../src/lib/player-service";
import { MAX_PLAYER_LEVEL, totalXpForLevel, levelForXp } from "../../src/lib/progression";
import { careerRequirement } from "../../src/lib/career";
import { PERKS } from "../../src/lib/perks";
import { ACHIEVEMENTS, WEAPONS } from "../../src/lib/game-data";

const req = (body: unknown) => new NextRequest("http://localhost/api/test", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
async function status(response: Response, expected: number) {
  assert.equal(response.status, expected, await response.clone().text());
}
async function create(key: string, xp: number, credits = 36000) {
  const p = await getOrCreatePlayer(key);
  await db.player.update({ where: { id: p.id }, data: { xp, credits, level: 1 } });
  await db.loadout.upsert({ where: { playerId: p.id }, create: { playerId: p.id }, update: {} });
  return p;
}
async function suppressAwards(playerId: string) {
  await db.playerAchievement.createMany({ data: ACHIEVEMENTS.map(a => ({ playerId, achievementId: a.id })) });
}
try {
  const legacy = await db.player.findUniqueOrThrow({ where: { playerKey: "legacy-player" } });
  assert.equal(legacy.xp, 130050);
  assert.equal(legacy.credits, 36000);
  assert.equal(legacy.careerRank, 0);
  assert.equal(legacy.careerXp, 0);
  const legacyView = (await buildProfileView(legacy.playerKey))!;
  assert.equal(legacyView.level, 21);
  assert.equal(legacyView.loadout.perkId, "steady");

  // Reproduce the reported failure with deliberately stale Player.level = 1.
  const p = await create("perk-player", totalXpForLevel(18));
  for (const perk of PERKS.filter(p => p.unlockLevel <= 18)) {
    await db.player.update({ where: { id: p.id }, data: { level: 1 } });
    await status(await saveLoadout(req({ playerKey: p.playerKey, perkId: perk.id })), 200);
    assert.equal((await db.loadout.findUniqueOrThrow({ where: { playerId: p.id } })).perkId, perk.id);
  }
  await status(await preset(req({ playerKey: p.playerKey, action: "save", name: "Steady build" })), 200);
  const saved = (await buildProfileView(p.playerKey))!.savedLoadouts[0];
  await status(await saveLoadout(req({ playerKey: p.playerKey, perkId: "battle_hardened" })), 200);
  await db.player.update({ where: { id: p.id }, data: { level: 1 } });
  await status(await saveLoadout(req({ playerKey: p.playerKey, presetId: saved.id })), 200);
  assert.equal((await buildProfileView(p.playerKey))!.loadout.perkId, "steady");
  await status(await saveLoadout(req({ playerKey: p.playerKey, perkId: "athlete" })), 403);
  await status(await saveLoadout(req({ playerKey: p.playerKey, perkId: "forged" })), 403);
  await db.player.update({ where: { id: p.id }, data: { xp: 0, level: 99 } });
  await status(await saveLoadout(req({ playerKey: p.playerKey, perkId: "steady" })), 403);

  // Well Prepared uses the same earned level, including preset capture.
  await db.player.update({ where: { id: p.id }, data: { xp: totalXpForLevel(28), level: 1 } });
  const second = WEAPONS.find(w => w.id !== "rifle_ar" && w.category === "assault" && !w.wonder)!;
  await db.weaponUnlock.create({ data: { playerId: p.id, weaponId: second.id } });
  await status(await saveLoadout(req({ playerKey: p.playerKey, perkId: "well_prepared", secondaryWeapon: second.id })), 200);
  await db.player.update({ where: { id: p.id }, data: { level: 1 } });
  await status(await preset(req({ playerKey: p.playerKey, action: "save", name: "Two primaries" })), 200);
  await status(await saveLoadout(req({ playerKey: p.playerKey, perkId: "battle_hardened" })), 200);
  assert.equal((await buildProfileView(p.playerKey))!.loadout.secondary.id, "pistol_side");

  // Quest/achievement XP must be included in both returned and persisted level.
  const q = await create("quest-player", totalXpForLevel(12) - 200);
  const award = await applyMatchResult({ playerKey: q.playerKey, kills: 200, deaths: 1, headshots: 100, won: true, mode: "ffa", score: 200, weaponId: "rifle_ar" });
  assert(award.newAchievements.length > 0);
  const after = await db.player.findUniqueOrThrow({ where: { id: q.id } });
  assert.equal(after.level, levelForXp(after.xp));
  assert.equal(award.newLevel, after.level);
  assert.equal((await buildProfileView(q.playerKey))!.level, award.newLevel);

  const cap = totalXpForLevel(MAX_PLAYER_LEVEL);
  const crossing = await create("crossing-player", cap - 1);
  await suppressAwards(crossing.id);
  const crossingResult = await applyMatchResult({ playerKey: crossing.playerKey, kills: 0, deaths: 0, headshots: 0, won: false, mode: "ffa", score: 0 });
  const crossed = await db.player.findUniqueOrThrow({ where: { id: crossing.id } });
  assert.equal(crossed.careerXp, crossingResult.xpGained - 1);
  assert.equal(crossingResult.newLevel, MAX_PLAYER_LEVEL);

  // Historic overflow XP cannot fund even the first Career promotion.
  const c = await create("career-player", cap + 1000000);
  await suppressAwards(c.id);
  assert.equal((await buildProfileView(c.playerKey))!.career.currentXp, 0);
  await status(await promote(req({ playerKey: c.playerKey, rank: 0, careerXp: 9999999 })), 403);
  await status(await promote(req({ playerKey: c.playerKey, rank: -1 })), 400);
  await status(await promote(req({ playerKey: c.playerKey })), 400);
  await status(await promote(req({ playerKey: q.playerKey, rank: 0 })), 403);
  await status(await equipTitle(req({ playerKey: c.playerKey, achievementId: "career_veteran" })), 403);
  const earnings = await applyMatchResult({ playerKey: c.playerKey, kills: 1, deaths: 0, headshots: 0, won: false, mode: "ffa", score: 1 });
  assert.equal((await buildProfileView(c.playerKey))!.career.currentXp, earnings.xpGained);

  await db.player.update({ where: { id: c.id }, data: { careerXp: careerRequirement(0).xp, credits: 36000 } });
  const beforeExport = await exportProfile(new NextRequest(`http://localhost/api/profile/export?playerKey=${c.playerKey}`));
  const backup = await beforeExport.json();
  // Two simultaneous requests spend exactly once and cannot skip a rank.
  const attempts = await Promise.all([promote(req({ playerKey: c.playerKey, rank: 0 })), promote(req({ playerKey: c.playerKey, rank: 0 }))]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [200,409]);
  let career = await db.player.findUniqueOrThrow({ where: { id: c.id } });
  assert.equal(career.careerRank, 1);
  assert.equal(career.careerXp, 0);
  assert.equal(career.credits, 31000);
  assert.equal(career.xp, backup.player.xp);
  await status(await promote(req({ playerKey: c.playerKey, rank: 1 })), 403);
  await status(await promote(req({ playerKey: c.playerKey, rank: 0 })), 409);
  await status(await equipTitle(req({ playerKey: c.playerKey, achievementId: "career_veteran" })), 200);
  await status(await equipTitle(req({ playerKey: c.playerKey, achievementId: "career_legend" })), 403);
  assert((await buildProfileView(c.playerKey))!.unlockedTitles.some(t => t.id === "career_veteran"));

  // Re-importing an earlier backup cannot refund promotion credits or fresh XP.
  await status(await importProfile(req({ playerKey: c.playerKey, data: backup })), 200);
  await status(await importProfile(req({ playerKey: c.playerKey, data: backup })), 200);
  career = await db.player.findUniqueOrThrow({ where: { id: c.id } });
  assert.equal(career.credits, 31000);
  assert.equal(career.careerRank, 1);
  assert.equal(career.careerXp, 0);
  await db.player.update({ where: { id: c.id }, data: { careerXp: careerRequirement(1).xp, credits: 7499 } });
  await status(await promote(req({ playerKey: c.playerKey, rank: 1 })), 403);
  assert.equal((await db.player.findUniqueOrThrow({ where: { id: c.id } })).careerXp, 25000);

  // Fresh recovery preserves rank and the live perk/preset state; forged cached
  // levels in old exports do not grant perks.
  const recovered = { ...backup, playerKey: "restored-player", player: { ...backup.player, careerRank: 1, careerXp: 50, level: 1 }, loadout: { ...backup.loadout, perkId: "steady" } };
  await status(await importProfile(req({ playerKey: recovered.playerKey, data: recovered })), 200);
  const restored = (await buildProfileView(recovered.playerKey))!;
  assert.equal(restored.career.rank, 1);
  assert.equal(restored.career.currentXp, 50);
  assert.equal(restored.loadout.perkId, "steady");
  assert.equal(restored.level, MAX_PLAYER_LEVEL);
  console.log("All progression API scenarios passed");
} finally { await db.$disconnect(); }
