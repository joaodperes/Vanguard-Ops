"use client";

import { achievementTitle, achievementRequirement, titledDisplayName } from "@/lib/achievement-titles";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/game-store";
import { Auth } from "@/components/screens/Auth";
import { MainMenu } from "@/components/screens/MainMenu";
import { SiteNav } from "@/components/game/SiteNav";
import { Play } from "@/components/screens/Play";
import { Armory } from "@/components/screens/Armory";
import { FiringRange } from "@/components/screens/FiringRange";
import { Profile } from "@/components/screens/Profile";
import { Shop } from "@/components/screens/Shop";
import { Settings } from "@/components/screens/Settings";
import { Results } from "@/components/screens/Results";
import { Tutorial } from "@/components/screens/Tutorial";
import { loadTutorialProgress, shouldOfferTutorial } from "@/lib/tutorial";
import { GameCanvas } from "@/components/game/GameCanvas";
import type { LoadoutWire } from "@/lib/game-protocol";
import { perkById } from "@/lib/perks";
import { isPrimaryWeaponCategory, weaponById } from "@/lib/game-data";
import type { MatchEndResult } from "@/lib/fps-engine";
import { toast } from "sonner";

export default function Page() {
  const { screen, profile, refreshProfile, playerKey, playConfig, setScreen, setMatchResult, matchResult, authState, setSession, setAuthState, setPlayerKey, roomConnect, setRoomConnect } = useGame();
  const [booted, setBooted] = useState(false);
  const tutorialOffered = useRef(new Set<string>());

  useEffect(() => {
    // Check for an existing account session first.
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            // Switch to the account's persisted playerKey.
            try { localStorage.setItem("vanguard_player_key", data.playerKey); } catch {}
            setPlayerKey(data.playerKey);
            setSession({ email: data.email, name: data.name, playerKey: data.playerKey });
            setAuthState("authenticated");
            setScreen("menu");
          } else {
            setAuthState("guest");
          }
        } else {
          setAuthState("guest");
        }
      } catch {
        setAuthState("guest");
      }
      setBooted(true);
    })();
  }, []);

  // Ensure a player profile exists once auth is resolved (account or guest).
  useEffect(() => {
    if (!booted || authState === "checking") return;
    if (screen === "auth") return; // wait for the user to choose
    const name = authState === "authenticated" ? (useGame.getState().session?.name ?? "Recruit") : "Recruit";
    fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerKey, name }),
    }).then(() => refreshProfile()).catch(() => {});
  }, [booted, authState, screen, playerKey]);

  useEffect(() => {
    if (screen === "tutorial") { tutorialOffered.current.add(playerKey); return; }
    if (!booted || screen !== "menu" || !profile || profile.playerKey !== playerKey || tutorialOffered.current.has(playerKey)) return;
    tutorialOffered.current.add(playerKey);
    if (shouldOfferTutorial(profile, loadTutorialProgress(playerKey))) setScreen("tutorial");
  }, [booted, screen, profile, playerKey, setScreen]);

  const handleMatchEnd = async (r: MatchEndResult) => {
    try {
      const res = await fetch("/api/match/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerKey, kills: r.kills, deaths: r.deaths, headshots: r.headshots, assists:r.assists??0,
          won: r.won, mode: r.mode, score: r.score,
          online: playConfig.online,
          durationSec: r.durationSec ?? 0,
          placement: r.placement ?? 1,
          weaponId: r.weaponId ?? "rifle_ar",
          multikills: r.multikills ?? 0,
          // 19a+19b: forward the match-high kill streak so applyMatchResult
          // can update the player's lifetime bestKillstreak (Triple Threat /
          // Killstreak King / Untouchable Force achievements).
          bestStreak: r.bestStreak ?? 0,
           confirmations: r.confirmations ?? 0,
           denials: r.denials ?? 0,
          survivalWaves: r.survivalWaves ?? 0,
          survivalTier: r.survivalTier ?? "default",
          killDifficulties: r.killDifficulties ?? [],
          perWeaponKills: r.perWeaponKills,
          perWeaponActions: r.perWeaponActions,
        }),
      });
      const rewards = await res.json();
      setMatchResult({ ...r, rewards });
      await refreshProfile();
      setScreen("results");
      if (rewards.leveledUp) toast.success(`Level Up! → Level ${rewards.newLevel}`);
      for (const perkId of rewards.newUnlocks?.perks ?? []) toast.success(`Perk available: ${perkById(perkId).name}`, { description: `Level ${perkById(perkId).unlockLevel} · Equip in Armory` });
      if (rewards.newAchievements?.length) {
        for (const a of rewards.newAchievements) {
          const title = achievementTitle(a.id);
          const requirement = achievementRequirement(a.id, a.description);
          toast.success(`Achievement: ${a.title}`, { description: `${requirement ? `${requirement} · ` : ""}+${a.rewardXp} XP · +${a.rewardCredits} CR${title ? ` · Title unlocked: ${title}` : ""}` });
        }
      }
      if (rewards.newPrestiges?.length) {
        for (const id of rewards.newPrestiges) {
          toast.success("WEAPON PRESTIGE EARNED", {
            description: `${weaponById(id).name} · Viridian Blight camo earned`,
            duration: 6500,
          });
        }
      }
      if (rewards.challengeAwards?.length) {
        for (const c of rewards.challengeAwards) toast.success(`Challenge Complete: ${c.title}`, { description: `+${c.rewardXp} XP · +${c.rewardCredits} CR` });
      }
    } catch {
      setMatchResult({ ...r });
      setScreen("results");
    }
  };

  if (!booted || authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 animate-pulse" />
          <div className="text-white/60 text-sm tracking-widest uppercase">Initializing Vanguard…</div>
        </div>
      </div>
    );
  }

  // Show the auth screen until the user signs in or chooses guest.
  if (authState !== "authenticated" && authState !== "guest") {
    return <Auth />;
  }
  if (screen === "auth") {
    return <Auth />;
  }

  // Build loadout wire from profile
  const loadoutWire: LoadoutWire | null = profile?.loadout
    ? {
        weaponId: profile.loadout.weapon.id,
        perkId: profile.loadout.perkId,
        secondaryWeaponId: profile.loadout.perkId === "well_prepared" || !isPrimaryWeaponCategory(profile.loadout.secondary?.category ?? "sidearm")
          ? (profile.loadout.secondary?.id ?? "pistol_side") : "pistol_side",
        meleeWeaponId: profile.loadout.melee?.id ?? "knife_tactical",
        weaponSkinId: profile.loadout.weaponSkin.id,
        secondaryWeaponSkinId: profile.loadout.secondaryWeaponSkin?.id ?? "default",
        meleeWeaponSkinId: profile.loadout.meleeWeaponSkin?.id ?? "default",
        playerSkinId: profile.loadout.playerSkin.id,
        nameplateId: profile.selectedNameplate,
        primaryReticleId: profile.loadout.primaryReticle,
        secondaryReticleId: profile.loadout.secondaryReticle,
        primaryCharmId: profile.loadout.primaryCharm,
        secondaryCharmId: profile.loadout.secondaryCharm,
        meleeCharmId: "none",
        attachments: {
          sight: profile.loadout.attachments.sight,
          barrel: profile.loadout.attachments.barrel,
          grip: profile.loadout.attachments.grip,
          magazine: profile.loadout.attachments.magazine,
        },
        // Sidearms support attachments — pass the secondary's attachment map
        // so the engine + server validate secondary-slot shots with the right
        // effective stats (suppressor, extended mag, etc.). Melee attachments
        // are always empty (melee weapons don't take attachments) but we pass
        // them for forward-compat.
        secondaryAttachments: {
          sight: profile.loadout.secondaryAttachments.sight,
          barrel: profile.loadout.secondaryAttachments.barrel,
          grip: profile.loadout.secondaryAttachments.grip,
          magazine: profile.loadout.secondaryAttachments.magazine,
        },
        meleeAttachments: {
          sight: profile.loadout.meleeAttachments.sight,
          barrel: profile.loadout.meleeAttachments.barrel,
          grip: profile.loadout.meleeAttachments.grip,
          magazine: profile.loadout.meleeAttachments.magazine,
        },
      }
    : null;

  return (
    <>
      <div className="dark min-h-screen bg-[#0a0a0a] text-white">
      {screen !== "playing" && <SiteNav />}
      {screen === "menu" && <MainMenu />}
      {screen === "play" && <Play />}
      {screen === "armory" && <Armory />}
      {screen === "range" && <FiringRange />}
      {screen === "profile" && <Profile />}
      {screen === "shop" && <Shop />}
      {screen === "settings" && <Settings />}
      {screen === "tutorial" && <Tutorial key={playerKey} />}
      {screen === "results" && <Results />}
      {screen === "playing" && loadoutWire && profile && (
        <GameCanvas
          loadout={loadoutWire}
          mode={playConfig.mode}
          botCount={playConfig.botCount}
          botDifficulty={playConfig.botDifficulty}
          survivalTier={playConfig.survivalTier ?? "default"}
          online={playConfig.online}
          playerName={titledDisplayName(profile.name,profile.selectedTitle)}
          playerKey={playerKey}
          scoreLimit={playConfig.scoreLimit}
          timeLimitMin={playConfig.timeLimit}
          mapId={playConfig.mapId}
          roomConnect={roomConnect}
          onMatchEnd={handleMatchEnd}
          onExitWithStats={handleMatchEnd}
          onExit={() => { setRoomConnect(null); setScreen("play"); }}
        />
      )}
      {screen === "playing" && !loadoutWire && (
        <div className="min-h-screen flex items-center justify-center bg-black text-white/60">
          Loading loadout… <button className="ml-3 underline" onClick={() => setScreen("menu")}>back</button>
        </div>
      )}
      <span className="hidden">{matchResult ? "" : ""}</span>
      </div>
    </>
  );
}
