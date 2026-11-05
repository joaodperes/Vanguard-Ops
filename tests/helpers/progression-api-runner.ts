// Isolated child process: DATABASE_URL always points to a disposable SQLite DB.
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { db } from "../../src/lib/db";
import { POST as saveLoadout } from "../../src/app/api/loadout/route";
import { POST as redeemWonder } from "../../src/app/api/unlock/route";
import { POST as preset } from "../../src/app/api/loadout/presets/route";
import { POST as claimCareer } from "../../src/app/api/profile/career/route";
import { POST as shopCosmetic } from "../../src/app/api/shop/route";
import { POST as equipCosmetic } from "../../src/app/api/profile/cosmetics/route";
import { POST as shopPurchase } from "../../src/app/api/shop/route";
import { POST as equipTitle } from "../../src/app/api/profile/title/route";
import { GET as exportProfile } from "../../src/app/api/profile/export/route";
import { POST as importProfile } from "../../src/app/api/profile/import/route";
import { getOrCreatePlayer, buildProfileView, applyMatchResult } from "../../src/lib/player-service";
import { MAX_PLAYER_LEVEL, totalXpForLevel, levelForXp } from "../../src/lib/progression";

import { PERKS } from "../../src/lib/perks";
import { shopItemsForCategory } from "../../src/lib/shop-catalog";
import { dailyShopRotation } from "../../src/lib/shop-rotation";
import { ACHIEVEMENTS, WEAPONS, WEAPON_SKINS } from "../../src/lib/game-data";
import { WEAPON_CONDITION_METRICS } from "../../src/lib/armory-challenges";

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
  const newPlayer = await getOrCreatePlayer("concurrent-onboarding-player");
  const firstProfiles = await Promise.all(Array.from({ length: 4 }, () => buildProfileView(newPlayer.playerKey)));
  assert(firstProfiles.every(p => p?.loadout.weapon.id === "rifle_ar"));
  assert.equal(await db.loadout.count({ where: { playerId: newPlayer.id } }), 1);
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
  for (const perk of PERKS.filter(p => p.unlockLevel <= 18 && p.id !== "wonder_weapon")) {
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

  // Prestige and Mastery finishes must equip without the OTHER achievement.
  const masterySkinPlayer=await create("mastery-skins-player",totalXpForLevel(25));
  await db.weaponProgress.upsert({where:{playerId_weaponId:{playerId:masterySkinPlayer.id,weaponId:"rifle_ar"}},
    create:{playerId:masterySkinPlayer.id,weaponId:"rifle_ar",kills:600,headshots:110},
    update:{kills:600,headshots:110}});
  // Old headshot threshold no longer qualifies for Rank 5/Eventide.
  await status(await saveLoadout(req({playerKey:masterySkinPlayer.playerKey,weaponSkin:"prestige_cosmic"})),200);
  assert.notEqual((await buildProfileView(masterySkinPlayer.playerKey))!.loadout.weaponSkin.id,"prestige_cosmic");
  await db.weaponProgress.update({where:{playerId_weaponId:{playerId:masterySkinPlayer.id,weaponId:"rifle_ar"}},data:{headshots:330}});
  await status(await saveLoadout(req({playerKey:masterySkinPlayer.playerKey,weaponSkin:"prestige_cosmic"})),200);
  assert.equal((await buildProfileView(masterySkinPlayer.playerKey))!.loadout.weaponSkin.id,"prestige_cosmic");
  const prestigeSkinPlayer=await create("prestige-skins-player",totalXpForLevel(25));
  await db.weaponPrestige.create({data:{playerId:prestigeSkinPlayer.id,weaponId:"rifle_ar",legacyReward:false}});
  await status(await saveLoadout(req({playerKey:prestigeSkinPlayer.playerKey,weaponSkin:"prestige_toxic"})),200);
  assert.equal((await buildProfileView(prestigeSkinPlayer.playerKey))!.loadout.weaponSkin.id,"prestige_toxic");
  await status(await saveLoadout(req({playerKey:prestigeSkinPlayer.playerKey,weaponSkin:"prestige_cosmic"})),200);
  assert.notEqual((await buildProfileView(prestigeSkinPlayer.playerKey))!.loadout.weaponSkin.id,"prestige_cosmic");

  // Seven purchased legacy skins alone cannot prematurely award a new Prestige.
  const attachmentGate = await create("attachment-prestige-gate-player", totalXpForLevel(25));
  await db.skinUnlock.createMany({ data: WEAPON_SKINS.filter(s =>
    s.id !== "default" && !s.prestige && !s.shopCurrency
  ).map(s => ({ playerId: attachmentGate.id, weaponId: "rifle_ar", skinId: s.id })) });
  const skinOnly = (await buildProfileView(attachmentGate.playerKey))!;
  assert(!skinOnly.prestige.masteredWeapons.includes("rifle_ar"),
    "All seven owned skins must not bypass incomplete attachment challenges");
  const completeContext = Object.fromEntries(WEAPON_CONDITION_METRICS.map(metric => [metric, 999]));
  await db.weaponProgress.create({ data: {
    playerId: attachmentGate.id, weaponId: "rifle_ar", kills: 999, headshots: 999,
    conditionStats: JSON.stringify(completeContext),
  } });
  const fullyComplete = (await buildProfileView(attachmentGate.playerKey))!;
  assert(fullyComplete.prestige.masteredWeapons.includes("rifle_ar"),
    "Completing attachment objectives must award Prestige even without attachment purchases");
  assert.equal(await db.weaponPrestige.count({ where: { playerId: attachmentGate.id, weaponId: "rifle_ar" } }), 1,
    "Prestige must be a one-time permanent award");

  // A Marksman DMR reaches Mastery 5 on a live early-exit match report.
  // Existing Prestige + the saved last kill/headshot must mint exactly one
  // Wonder entitlement, even though won=false and the match ended early.
  const dmr = await create("early-exit-dmr-player", totalXpForLevel(25));
  const completedContext = Object.fromEntries(WEAPON_CONDITION_METRICS.map(metric => [metric, 999]));
  await db.weaponProgress.create({ data: {
    playerId: dmr.id, weaponId: "rifle_dm", kills: 599, headshots: 329,
    conditionStats: JSON.stringify(completedContext),
  } });
  const dmrBefore = (await buildProfileView(dmr.playerKey))!;
  assert(dmrBefore.prestige.masteredWeapons.includes("rifle_dm"), "All cosmetic and attachment objectives should already be Prestiged");
  assert.equal(dmrBefore.prestige.tokens, 0, "Mastery 4 must not award a Wonder unlock");
  const dmrExitResult = await applyMatchResult({
    playerKey: dmr.playerKey, kills: 1, deaths: 0, headshots: 1, won: false,
    mode: "ffa", score: 1, online: true, durationSec: 150, placement: 2,
    weaponId: "rifle_dm",
    perWeaponKills: { rifle_dm: { kills: 1, headshots: 1 } },
  });
  assert(dmrExitResult.newAchievements.some(a => a.id === "mastery_5"));
  const dmrAfter = (await buildProfileView(dmr.playerKey))!;
  assert.equal(dmrAfter.weaponProgress.rifle_dm.kills, 600);
  assert.equal(dmrAfter.weaponProgress.rifle_dm.headshots, 330);
  assert(dmrAfter.prestige.tokenReadyWeapons.includes("rifle_dm"));
  assert.equal(dmrAfter.prestige.tokens, 1, "Early exit must not withhold a Wonder token");
  assert.equal((await buildProfileView(dmr.playerKey))!.prestige.tokens, 1, "Refresh must be idempotent");

  // Regression: three prior Wonder purchases before the 110->330 headshot
  // threshold change cannot create negative entitlement debt. A NEW DMR
  // completion must give its first token, not pay off that hidden debt.
  const legacyWonders = await create("legacy-wonder-owner",totalXpForLevel(25));
  const oldSources=["rifle_ar","smg_kp","pistol_side"];
  for(const [index,weaponId] of oldSources.entries()){
    await db.weaponPrestige.create({data:{playerId:legacyWonders.id,weaponId,
      legacyReward:true,awardedAt:new Date(Date.UTC(2026,9,19,index))}});
    await db.weaponProgress.create({data:{playerId:legacyWonders.id,weaponId,
      kills:600,headshots:110}});
  }
  const ownedWonders=WEAPONS.filter(w=>!!w.wonder&&!w.disabled).slice(0,3);
  assert.equal(ownedWonders.length,3);
  for(const [index,w] of ownedWonders.entries())
    await db.wonderUnlock.create({data:{playerId:legacyWonders.id,weaponId:w.id,
      unlockedAt:new Date(Date.UTC(2026,9,22,index))}});
  const beforeLedger=(await buildProfileView(legacyWonders.playerKey))!.prestige;
  assert.equal(beforeLedger.tokens,0);
  assert.equal(beforeLedger.tokenReadyWeapons.length,3);
  assert.equal(beforeLedger.wonderWeapons.length,3);
  assert.equal(beforeLedger.legacyCredits,0);
  // Re-earning rank 5 on a previously spent source cannot duplicate the token.
  await db.weaponProgress.updateMany({where:{playerId:legacyWonders.id,
    weaponId:{in:oldSources.slice(0,2)}},data:{headshots:330}});
  assert.equal((await buildProfileView(legacyWonders.playerKey))!.prestige.tokens,0);
  await db.weaponProgress.create({data:{playerId:legacyWonders.id,weaponId:"rifle_dm",
    kills:600,headshots:330,conditionStats:JSON.stringify(completedContext)}});
  const newAward=(await buildProfileView(legacyWonders.playerKey))!.prestige;
  assert.equal(newAward.tokens,1,"New DMR award must not cover old purchases");
  assert(newAward.tokenReadyWeapons.includes("rifle_dm"));
  const fourthWonder=WEAPONS.find(w=>!!w.wonder&&!w.disabled&&!ownedWonders.some(p=>p.id===w.id))!;
  await status(await redeemWonder(req({playerKey:legacyWonders.playerKey,
    kind:"wonderWeapon",itemId:fourthWonder.id})),200);
  assert.equal((await buildProfileView(legacyWonders.playerKey))!.prestige.tokens,0);
  const fifthWonder=WEAPONS.find(w=>!!w.wonder&&!w.disabled&&
    ![...ownedWonders,fourthWonder].some(p=>p.id===w.id))!;
  await status(await redeemWonder(req({playerKey:legacyWonders.playerKey,
    kind:"wonderWeapon",itemId:fifthWonder.id})),403);
  assert.equal(await db.wonderTokenAward.count({where:{playerId:legacyWonders.id}}),4);
  const missingSources=await create("legacy-wonder-without-source",totalXpForLevel(25));
  await db.wonderUnlock.createMany({data:ownedWonders.map(w=>({
    playerId:missingSources.id,weaponId:w.id,
  }))});
  const unmatched=(await buildProfileView(missingSources.playerKey))!.prestige;
  assert.equal(unmatched.legacyCredits,3);
  assert.equal(unmatched.tokens,0);
  assert.equal((await buildProfileView(missingSources.playerKey))!.prestige.legacyCredits,3);

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
  const crossingResult = await applyMatchResult({ playerKey: crossing.playerKey, kills: 0, deaths: 0, headshots: 0, won: false, completed: true, mode: "ffa", score: 0 });
  const crossed = await db.player.findUniqueOrThrow({ where: { id: crossing.id } });
  assert.equal(crossed.careerXp, crossingResult.xpGained - 1);
  assert.equal(crossingResult.newLevel, MAX_PLAYER_LEVEL);

  // Historic overflow XP does not complete a Career Contract.
  const c=await create("career-player",cap+1000000);
  await suppressAwards(c.id);
  const initialCareer=(await buildProfileView(c.playerKey))!.career;
  assert.equal(initialCareer.completed,0);
  assert.equal(initialCareer.tokens,0);
  assert.equal(initialCareer.contracts.length,5);
  await status(await claimCareer(req({playerKey:c.playerKey})),403);
  await status(await equipTitle(req({playerKey:c.playerKey,achievementId:"career_veteran"})),403);
  const earned=await applyMatchResult({playerKey:c.playerKey,kills:10,deaths:0,headshots:5,won:false,mode:"ffa",score:10,weaponId:"rifle_ar"});
  const progressAfterCareerMatch=(await buildProfileView(c.playerKey))!.career;
  assert(progressAfterCareerMatch.contracts.some(contract=>contract.progress>0));
  assert(progressAfterCareerMatch.contracts.some(contract=>contract.id==="fresh_xp"&&contract.progress===earned.xpGained));
  // Force completion for this isolated API fixture; only a valid server claim
  // converts 3 finished contract rows into one token.
  for(const contract of progressAfterCareerMatch.contracts.slice(0,3)){
    await db.careerContract.updateMany({
      where:{playerId:c.id,cycle:0,contractId:contract.id},
      data:{completed:true,progress:contract.goal},
    });
  }
  const backup=await (await exportProfile(new NextRequest(`http://localhost/api/profile/export?playerKey=${c.playerKey}`))).json();
  await status(await claimCareer(req({playerKey:c.playerKey})),200);
  assert.equal((await buildProfileView(c.playerKey))!.career.tokens,1);
  await status(await claimCareer(req({playerKey:c.playerKey})),403);
  const featured = new Set(dailyShopRotation().itemIds);
  const careerFinish = shopItemsForCategory("career","weaponSkin").find(i=>featured.has(i.id))!;
  const careerWeapon = dailyShopRotation().offers.find(o=>o.itemId===careerFinish.id)?.weaponId!;
  await db.weaponUnlock.upsert({where:{playerId_weaponId:{playerId:c.id,weaponId:careerWeapon}},create:{playerId:c.id,weaponId:careerWeapon},update:{}});
  await status(await shopPurchase(req({playerKey:c.playerKey,itemId:careerFinish.id,weaponId:careerWeapon})),200);
  assert.equal((await buildProfileView(c.playerKey))!.career.tokens,0);
  await status(await shopPurchase(req({playerKey:c.playerKey,itemId:careerFinish.id,weaponId:careerWeapon})),409);
  await status(await importProfile(req({playerKey:c.playerKey,data:backup})),200);
  assert.equal((await buildProfileView(c.playerKey))!.career.tokens,0);
  assert.equal((await db.player.findUniqueOrThrow({where:{id:c.id}})).careerTokensSpent,1);

  // Old exports still preserve legacy Career titles without minting tokens.
  const recovered={...backup,playerKey:"restored-player",
    player:{...backup.player,careerRank:1,careerXp:50,level:1},
    loadout:{...backup.loadout,perkId:"steady"}};
  await status(await importProfile(req({playerKey:recovered.playerKey,data:recovered})),200);
  const restored=(await buildProfileView(recovered.playerKey))!;
  assert.equal((await db.player.findUniqueOrThrow({where:{playerKey:recovered.playerKey}})).careerRank,1);
  assert.equal(restored.loadout.perkId,"steady");
  assert.equal(restored.level,MAX_PLAYER_LEVEL);
  assert(restored.unlockedTitles.some(t=>t.id==="career_veteran"));

  // Shop rotation is global and account ownership stays permanent.
  const offers=(kind:"charm"|"reticle"|"nameplate")=>
    shopItemsForCategory("credits",kind).filter(i=>featured.has(i.id));
  const todayReticle=offers("reticle")[0];
  const todayCharm=offers("charm")[0];
  const secondCharm=offers("charm")[1];
  const todayPlate=offers("nameplate")[0];
  assert(todayReticle&&todayCharm&&secondCharm&&todayPlate);

  const cosmeticsPlayer=await create("cosmetic-player",totalXpForLevel(MAX_PLAYER_LEVEL),75000);
  let cosmeticsView=(await buildProfileView(cosmeticsPlayer.playerKey))!;
  assert.equal(cosmeticsView.loadout.primaryReticle,"classic");
  assert.equal(cosmeticsView.loadout.primaryCharm,"none");
  assert.equal(cosmeticsView.selectedNameplate,"standard");
  const cosmeticEquip=(kind:"reticle"|"charm",id:string,slot:"primary"|"secondary",weaponId?:string)=>
    equipCosmetic(req({playerKey:cosmeticsPlayer.playerKey,kind,cosmeticId:id,slot,weaponId}));
  await status(await cosmeticEquip("reticle","dot","primary"),200);
  await status(await cosmeticEquip("reticle","reticle_nova","primary"),403);
  await status(await equipCosmetic(req({playerKey:cosmeticsPlayer.playerKey,kind:"reticle",cosmeticId:"dot"})),400);
  const offRotation=shopItemsForCategory("credits","reticle").find(i=>!featured.has(i.id))!;
  await status(await shopCosmetic(req({playerKey:cosmeticsPlayer.playerKey,itemId:offRotation.id})),403);
  for(const item of [todayReticle,todayCharm,todayPlate,secondCharm]){
    await status(await shopCosmetic(req({playerKey:cosmeticsPlayer.playerKey,itemId:item.id})),200);
    await status(await shopCosmetic(req({playerKey:cosmeticsPlayer.playerKey,itemId:item.id})),409);
  }
  await status(await cosmeticEquip("reticle",todayReticle.cosmeticId!,"primary","rifle_ar"),200);
  await status(await cosmeticEquip("reticle","dot","secondary","pistol_side"),200);
  await status(await cosmeticEquip("charm",todayCharm.cosmeticId!,"primary","rifle_ar"),200);
  await status(await cosmeticEquip("charm",todayCharm.cosmeticId!,"secondary","pistol_side"),200);
  await status(await equipCosmetic(req({playerKey:cosmeticsPlayer.playerKey,kind:"nameplate",cosmeticId:todayPlate.cosmeticId})),200);
  cosmeticsView=(await buildProfileView(cosmeticsPlayer.playerKey))!;
  assert.equal(cosmeticsView.loadout.primaryReticle,todayReticle.cosmeticId);
  assert.equal(cosmeticsView.loadout.secondaryReticle,"dot");
  assert.equal(cosmeticsView.loadout.primaryCharm,todayCharm.cosmeticId);
  assert.equal(cosmeticsView.loadout.secondaryCharm,todayCharm.cosmeticId);
  assert.equal(cosmeticsView.selectedNameplate,todayPlate.cosmeticId);
  assert.equal(cosmeticsView.credits,75000-todayReticle.cost-todayCharm.cost-todayPlate.cost-secondCharm.cost);
  await status(await cosmeticEquip("charm",secondCharm.cosmeticId!,"primary","rifle_ar"),200);
  assert.equal((await buildProfileView(cosmeticsPlayer.playerKey))!.loadout.secondaryCharm,todayCharm.cosmeticId);
  await status(await cosmeticEquip("charm",todayCharm.cosmeticId!,"primary","rifle_ar"),200);
  await status(await cosmeticEquip("charm",todayCharm.cosmeticId!,"primary","not_a_weapon"),409);
  await status(await saveLoadout(req({playerKey:cosmeticsPlayer.playerKey,primaryReticle:"reticle_nova"})),403);
  await status(await saveLoadout(req({playerKey:cosmeticsPlayer.playerKey,primaryCharm:"charm_moon"})),403);
  await status(await preset(req({playerKey:cosmeticsPlayer.playerKey,action:"save",name:"Cosmetic Kit"})),200);
  const cosmeticSaved=(await buildProfileView(cosmeticsPlayer.playerKey))!.savedLoadouts[0];
  assert.equal(cosmeticSaved.primaryReticle,todayReticle.cosmeticId);
  assert.equal(cosmeticSaved.primaryCharm,todayCharm.cosmeticId);
  await status(await cosmeticEquip("charm","none","primary"),200);
  assert.equal((await buildProfileView(cosmeticsPlayer.playerKey))!.loadout.secondaryCharm,todayCharm.cosmeticId);
  await status(await saveLoadout(req({playerKey:cosmeticsPlayer.playerKey,presetId:cosmeticSaved.id})),200);
  assert.equal((await buildProfileView(cosmeticsPlayer.playerKey))!.loadout.primaryCharm,todayCharm.cosmeticId);
  const cosmeticBackup=await (await exportProfile(new NextRequest(`http://localhost/api/profile/export?playerKey=${cosmeticsPlayer.playerKey}`))).json();
  await status(await cosmeticEquip("reticle","classic","primary"),200);
  await status(await importProfile(req({playerKey:cosmeticsPlayer.playerKey,data:cosmeticBackup})),200);
  assert.equal((await buildProfileView(cosmeticsPlayer.playerKey))!.loadout.primaryReticle,todayReticle.cosmeticId);

  // Selecting an unlocked Wonder occupies slot 4 and preserves the
  // conventional primary's purchased cosmetic selection.
  await db.wonderUnlock.create({data:{playerId:cosmeticsPlayer.id,weaponId:"wonder_riot_shield"}});
  await status(await saveLoadout(req({playerKey:cosmeticsPlayer.playerKey,
    perkId:"wonder_weapon",wonderWeaponId:"wonder_riot_shield"})),200);
  const wonderView=(await buildProfileView(cosmeticsPlayer.playerKey))!;
  assert.equal(wonderView.loadout.weapon.id,"rifle_ar");
  assert.equal(wonderView.loadout.wonderWeaponId,"wonder_riot_shield");
  assert.equal(wonderView.loadout.primaryReticle,todayReticle.cosmeticId);
  assert.equal(wonderView.loadout.primaryCharm,todayCharm.cosmeticId);
  // Legacy placement must be rejected rather than accidentally duplicating a Wonder.
  await status(await saveLoadout(req({playerKey:cosmeticsPlayer.playerKey,
    primaryWeapon:"wonder_riot_shield"})),403);
  await status(await saveLoadout(req({playerKey:cosmeticsPlayer.playerKey,
    perkId:"battle_hardened"})),200);

  // Store finishes remain specific to a weapon even when the global rotation
  // continues to advertise the same finish to every player.
  const creditFinish=shopItemsForCategory("credits","weaponSkin").find(i=>featured.has(i.id))!;
  const todayWeapon=dailyShopRotation().offers.find(o=>o.itemId===creditFinish.id)?.weaponId!;
  const wrongWeapon=todayWeapon==="rifle_ar"?"pistol_side":"rifle_ar";
  const skinPlayer=await create("rotating-skin-player",totalXpForLevel(MAX_PLAYER_LEVEL),10000);
  await db.weaponUnlock.upsert({where:{playerId_weaponId:{playerId:skinPlayer.id,weaponId:todayWeapon}},create:{playerId:skinPlayer.id,weaponId:todayWeapon},update:{}});
  await status(await shopPurchase(req({playerKey:skinPlayer.playerKey,itemId:creditFinish.id,weaponId:wrongWeapon})),403);
  await status(await shopPurchase(req({playerKey:skinPlayer.playerKey,itemId:creditFinish.id,weaponId:todayWeapon})),200);
  const skinView=(await buildProfileView(skinPlayer.playerKey))!;
  assert(skinView.unlocks.skinsByWeapon[todayWeapon]?.includes(creditFinish.skinId!));
  assert(!skinView.unlocks.skinsByWeapon[wrongWeapon]?.includes(creditFinish.skinId!));
  await status(await shopPurchase(req({playerKey:skinPlayer.playerKey,itemId:creditFinish.id,weaponId:todayWeapon})),409);
  await status(await shopPurchase(req({playerKey:skinPlayer.playerKey,itemId:creditFinish.id,weaponId:wrongWeapon})),403);
  assert.equal((await buildProfileView(skinPlayer.playerKey))!.credits,10000-creditFinish.cost);
  // An already-unlocked finish cannot be purchased/charged again by a rotation.
  const already=await create("already-unlocked-skin-player",totalXpForLevel(MAX_PLAYER_LEVEL),10000);
  await db.weaponUnlock.upsert({where:{playerId_weaponId:{playerId:already.id,weaponId:todayWeapon}},create:{playerId:already.id,weaponId:todayWeapon},update:{}});
  await db.skinUnlock.create({data:{playerId:already.id,weaponId:todayWeapon,skinId:creditFinish.skinId!}});
  await status(await shopPurchase(req({playerKey:already.playerKey,itemId:creditFinish.id,weaponId:todayWeapon})),409);
  assert.equal((await buildProfileView(already.playerKey))!.credits,10000);

  // Operative skin choices are saved with the named loadout, not account-wide.
  const operator=await create("operative-loadout-player",totalXpForLevel(12),10000);
  await db.playerSkinUnlock.createMany({data:["red","blue"].map(skinId=>({playerId:operator.id,skinId}))});
  await status(await saveLoadout(req({playerKey:operator.playerKey,playerSkin:"red"})),200);
  await status(await preset(req({playerKey:operator.playerKey,action:"save",name:"Crimson kit"})),200);
  const crimson=(await buildProfileView(operator.playerKey))!.savedLoadouts.find(p=>p.name==="Crimson kit")!;
  await status(await saveLoadout(req({playerKey:operator.playerKey,playerSkin:"blue"})),200);
  await status(await preset(req({playerKey:operator.playerKey,action:"save",name:"Azure kit"})),200);
  const azure=(await buildProfileView(operator.playerKey))!.savedLoadouts.find(p=>p.name==="Azure kit")!;
  await status(await saveLoadout(req({playerKey:operator.playerKey,presetId:crimson.id})),200);
  assert.equal((await buildProfileView(operator.playerKey))!.loadout.playerSkin.id,"red");
  await status(await saveLoadout(req({playerKey:operator.playerKey,presetId:azure.id})),200);
  assert.equal((await buildProfileView(operator.playerKey))!.loadout.playerSkin.id,"blue");


  // Retired intermediate titles disappear without removing achievements or
  // replaying payouts. Existing final awards immediately grant their new title.
  const titles = await create("title-player", totalXpForLevel(30), 1234);
  await db.playerAchievement.createMany({ data: ["mastery_1", "kills_2000", "level_30"].map(achievementId => ({ playerId: titles.id, achievementId })) });
  await db.player.update({ where: { id: titles.id }, data: { selectedTitle: "mastery_1" } });
  const titleView = (await buildProfileView(titles.playerKey))!;
  assert.equal(titleView.selectedTitle, "");
  assert.equal(titleView.credits, 1234);
  assert(titleView.unlockedTitles.some(t => t.id === "kills_2000" && t.title === "Reaper"));
  assert(titleView.unlockedTitles.some(t => t.id === "level_30" && t.title === "Vanguard Elite"));
  assert(!titleView.unlockedTitles.some(t => t.id === "mastery_1"));
  assert(await db.playerAchievement.findUnique({ where: { playerId_achievementId: { playerId: titles.id, achievementId: "mastery_1" } } }));
  await status(await equipTitle(req({ playerKey: titles.playerKey, achievementId: "mastery_1" })), 400);
  await status(await equipTitle(req({ playerKey: titles.playerKey, achievementId: "surv_nightmare_20" })), 403);
  await status(await equipTitle(req({ playerKey: titles.playerKey, achievementId: "kills_2000" })), 200);
  assert.equal((await buildProfileView(titles.playerKey))!.selectedTitle, "kills_2000");
  await status(await equipTitle(req({ playerKey: titles.playerKey, achievementId: "" })), 200);
  assert.equal((await buildProfileView(titles.playerKey))!.selectedTitle, "");
  assert.equal((await buildProfileView(titles.playerKey))!.credits, 1234);

  // Exercise actual awarding counters: Survival kills do not earn PvP titles,
  // while the same kills in a non-Survival match do. Quest/level/Survival title
  // rewards flow through the existing server-owned achievement pipeline.
  const broad = await create("broad-title-player", totalXpForLevel(30), 0);
  await db.player.update({ where: { id: broad.id }, data: {
    dailyChallengesCompleted: 10, weeklyChallengesCompleted: 5,
    eliteChallengesCompleted: 3, totalChallengesCompleted: 50,
  } });
  await applyMatchResult({ playerKey: broad.playerKey, mode: "survival", survivalTier: "nightmare", survivalWaves: 20,
    kills: 2000, deaths: 1, headshots: 0, won: false, score: 2000, weaponId: "rifle_ar" });
  const survivalTitles = (await buildProfileView(broad.playerKey))!.unlockedTitles.map(t => t.id);
  for (const id of ["surv_20", "surv_nightmare_20", "quest_daily_10", "quest_weekly_5", "quest_elite_3", "quest_total_50", "level_30"])
    assert(survivalTitles.includes(id), `Missing title ${id}`);
  assert(!survivalTitles.includes("kills_2000"));
  const combatAward = await applyMatchResult({ playerKey: broad.playerKey, mode: "tdm", kills: 2000, deaths: 0, headshots: 0,
    won: true, score: 2000, weaponId: "rifle_ar" });
  assert(combatAward.newAchievements.some(a => a.id === "kills_2000"));
  assert((await buildProfileView(broad.playerKey))!.unlockedTitles.some(t => t.id === "kills_2000"));
  console.log("All progression API scenarios passed");
} finally { await db.$disconnect(); }
