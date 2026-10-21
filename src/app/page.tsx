"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/game-store";
import { Auth } from "@/components/screens/Auth";
import { MainMenu } from "@/components/screens/MainMenu";
import { Play } from "@/components/screens/Play";
import { Armory } from "@/components/screens/Armory";
import { Profile } from "@/components/screens/Profile";
import { Settings } from "@/components/screens/Settings";
import { Results } from "@/components/screens/Results";
import { FAQ } from "@/components/screens/FAQ";
import { GameCanvas } from "@/components/game/GameCanvas";
import type { LoadoutWire } from "@/lib/game-protocol";
import { perkSelection } from "@/lib/perks";
import type { MatchEndResult } from "@/lib/fps-engine";
import { toast } from "sonner";

export default function Page() {
  const { screen, profile, refreshProfile, playerKey, playConfig, setScreen, setMatchResult, matchResult, authState, setSession, setAuthState, setPlayerKey, roomConnect, setRoomConnect } = useGame();
  const [booted, setBooted] = useState(false);

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

  const handleMatchEnd = async (r: MatchEndResult) => {
    try {
      const res = await fetch("/api/match/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerKey, kills: r.kills, deaths: r.deaths, headshots: r.headshots,
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
          survivalWaves: r.survivalWaves ?? 0,
          survivalTier: r.survivalTier ?? "default",
          killDifficulties: r.killDifficulties ?? [],
          perWeaponKills: r.perWeaponKills,
        }),
      });
      const rewards = await res.json();
      setMatchResult({ ...r, rewards });
      await refreshProfile();
      setScreen("results");
      if (rewards.leveledUp) toast.success(`Level Up! → Level ${rewards.newLevel}`);
      if (rewards.newAchievements?.length) {
        for (const a of rewards.newAchievements) toast.success(`Achievement: ${a.title}`, { description: `+${a.rewardXp} XP · +${a.rewardCredits} CR` });
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
        perkId: perkSelection(),
        secondaryWeaponId: profile.loadout.secondary?.id ?? "pistol_side",
        meleeWeaponId: profile.loadout.melee?.id ?? "knife_tactical",
        weaponSkinId: profile.loadout.weaponSkin.id,
        secondaryWeaponSkinId: profile.loadout.secondaryWeaponSkin?.id ?? "default",
        meleeWeaponSkinId: profile.loadout.meleeWeaponSkin?.id ?? "default",
        playerSkinId: profile.loadout.playerSkin.id,
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
    <div className="dark min-h-screen bg-[#0a0a0a] text-white">
      {screen === "menu" && <MainMenu />}
      {screen === "play" && <Play />}
      {screen === "armory" && <Armory />}
      {screen === "profile" && <Profile />}
      {screen === "settings" && <Settings />}
      {screen === "faq" && <FAQ />}
      {screen === "results" && <Results />}
      {screen === "playing" && loadoutWire && profile && (
        <GameCanvas
          loadout={loadoutWire}
          mode={playConfig.mode}
          botCount={playConfig.botCount}
          botDifficulty={playConfig.botDifficulty}
          survivalTier={playConfig.survivalTier ?? "default"}
          online={playConfig.online}
          playerName={profile.name}
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
  );
}
