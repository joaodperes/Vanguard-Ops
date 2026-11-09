"use client";
import { useEffect, useRef, useState } from "react";
import { FPSEngine, type HudState, type MatchEndResult, type LobbyState } from "@/lib/fps-engine";
import { teamSizeAllowed, type LoadoutWire, type GameMode, type MapId, type MapDef, type BotDifficulty } from "@/lib/game-protocol";
import type { RoomConnect } from "@/lib/game-store";
import type { SurvivalTier } from "@/lib/survival";
import { SURVIVAL_UPGRADES, survivalUpgradeValueText, type SurvivalUpgradeId } from "@/lib/survival-upgrades";
import type { PracticeSample } from "@/lib/tutorial";
import { Hud } from "./Hud";
import { displayMapLabel } from "@/lib/display-labels";
import { TouchControls } from "./TouchControls";
import { useSettings } from "@/lib/settings-store";
import { useGame } from "@/lib/game-store";
import { RoomLobby } from "./RoomLobby";
import { Button } from "@/components/ui/button";
import { InGameMenu, type InGameMenuPage } from "./InGameMenu";
import { escapeMenuAction, ignorePointerLockRelease, initialPointerLockMenuState, pointerLockMenuTransition } from "@/lib/in-game-menu-controls";
import { isPrimaryWeaponCategory } from "@/lib/game-data";

interface Props {
  loadout: LoadoutWire;
  mode: GameMode;
  botCount: number;
  botDifficulty: BotDifficulty;  // resolved per-room difficulty (from roomConnect.config or playConfig)
  survivalTier?: SurvivalTier;
  online: boolean;
  firingRange?: boolean;
  tutorial?: boolean;
  previewMap?: MapDef;
  playerName: string;
  playerKey: string;
  scoreLimit: number;
  timeLimitMin: number;
  mapId: MapId;
  roomConnect?: RoomConnect | null;
  onMatchEnd: (r: MatchEndResult) => void;
  onExit: () => void;
  onExitWithStats?: (r: MatchEndResult) => void;  // called when user leaves mid-match (saves progression)
  onPracticeSample?: (sample: PracticeSample) => void;
}

export function GameCanvas({ loadout, mode, botCount, botDifficulty, survivalTier = "default", online, firingRange = false, tutorial = false, previewMap, playerName, playerKey, scoreLimit, timeLimitMin, mapId, roomConnect, onMatchEnd, onExit, onExitWithStats, onPracticeSample }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FPSEngine | null>(null);
  const [engineInstance, setEngineInstance] = useState<FPSEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [touchStarted, setTouchStarted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<InGameMenuPage>("main");
  const menuOpenRef = useRef(false);
  const upgradePendingRef = useRef(false);
  const menuPageRef = useRef<InGameMenuPage>("main");
  const pointerLockMenuStateRef = useRef(initialPointerLockMenuState);
  const [socketConnected, setSocketConnected] = useState(false);  // Round 20a: track socket state for lobby UI
  const endedRef = useRef(false);
  const settings = useSettings((s) => s.settings);
  const practiceObserver = useRef(onPracticeSample);
  useEffect(() => { practiceObserver.current = onPracticeSample; }, [onPracticeSample]);
  useEffect(() => { useSettings.getState().load(); }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    // The settings load effect runs first, but this effect's React closure can
    // still hold DEFAULTS from the render before localStorage was hydrated.
    // Capture the current store snapshot when creating the WebGL camera.
    const initialSettings = useSettings.getState().settings;
    let disposed = false;
    let engine: FPSEngine;
    try {
      engine = new FPSEngine(containerRef.current, {
      mode, botCount, online, firingRange, previewMap, loadout, playerName, playerKey, team: "ffa", socketPort: 3003,
      mapId,
      gungamePreset: roomConnect?.config?.gungamePreset,
      gungameMultiplier: roomConnect?.config?.gungameMultiplier,
      sensitivity: initialSettings.sensitivity,
      fov: initialSettings.fov,
      autoAdsOnFire: initialSettings.autoAdsOnFire,
      invertY: initialSettings.invertY,
      botDifficulty,
      survivalTier,
      masterVolume: initialSettings.masterVolume,
      footstepVolume: initialSettings.footstepVolume,
      fxVolume: initialSettings.fxVolume,
      scoreLimit,
      timeLimitSec: timeLimitMin * 60,
      roomConnect: roomConnect ?? undefined,
      startedAt: performance.now(),
      onHud: (h) => {
        setHud(h);
        if (firingRange && h.radar) practiceObserver.current?.({
          x: h.radar.playerX, z: h.radar.playerZ, aiming: h.aiming,
          kills: h.kills, ammo: h.ammo, reloading: h.reloading, weaponId: h.weaponId,
          equipmentCharges: h.equipmentCharges,
        });
      },
      onKillFeed: () => {},
      onMatchEnd: (r) => {
        if (firingRange) return; // No match-complete API / credits / progression for trials.
        if (endedRef.current) return;
        endedRef.current = true;
        // All game modes share the engine's single cinematic finish timer.
        onMatchEnd(r);
      },
      onRoomError: (message) => {
        // A rejection for an otherwise valid room-size indicates that socket.io
        // may still be running an older set of map limits than the refreshed UI.
        const config = roomConnect?.kind === "create" ? roomConnect.config : undefined;
        const outdatedServer = message === "Choose a player count supported by this map and mode."
          && !!config && teamSizeAllowed(config.mapId, config.teamSize, config.mode);
        const reason = outdatedServer
          ? "The multiplayer server is using outdated room-size rules. Restart or redeploy the game server and retry."
          : message;
        import("sonner").then(({ toast }) => toast.error(`Could not join room: ${reason}`));
        onExit();
      },
      onSocketError: () => {
        // Round 20a: Socket can't connect (deploy without game server).
        // Show a helpful message and exit to the menu.
        import("sonner").then(({ toast }) => toast.error(
          "Multiplayer unavailable — the game server isn't reachable from this deployment.",
          { description: "Offline play (vs bots) still works. For online play, ensure the game server (port 3003) is accessible." }
        ));
        onExit();
      },
      onLobbyState: (s) => setLobby(s),
      onReady: () => setReady(true),
      });
    } catch (error) {
      queueMicrotask(() => {
        if (!disposed) setStartupError(error instanceof Error ? error.message : String(error));
      });
      return () => { disposed = true; };
    }
    engineRef.current = engine;
    // Publish the external engine after setup; ignore the notification if this
    // screen has already unmounted (including a failed/aborted startup).
    queueMicrotask(() => {
      if (disposed) return;
      setStartupError(null);
      setEngineInstance(engine);
      setIsTouch(engine.isTouchMode());
    });
    // A user has already selected a match, so try unlocking lobby audio now.
    // If autoplay policy defers it, the next lobby pointer gesture retries it.
    engine.unlockAudio();
    // Round 20a: Poll socket connection state for the lobby UI.
    const socketPoll = setInterval(() => {
      setSocketConnected(!!engine.getSocketConnected());
    }, 500);
    return () => {
      disposed = true;
      clearInterval(socketPoll);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // All controls, overhead health bars and audio changes apply immediately in-game.
  // Subscribing avoids rebuilding the engine (and resetting match state).
  useEffect(() => {
    const apply = (s: typeof settings) => {
      engineRef.current?.setAudioMix(s);
      engineRef.current?.applyDisplayAndControlSettings(s);
    };
    apply(useSettings.getState().settings);
    return useSettings.subscribe((state) => apply(state.settings));
  }, []);

  const showStartOverlay = ready && isTouch && !touchStarted;
  const lobbyActive = !!lobby?.active;
  const upgradePending=mode==="survival" && !!hud?.survivalUpgradeOffer &&
    !lobbyActive && !menuOpen && !hud?.matchEnding;
  const upgradeWaiting=mode==="survival" && !hud?.survivalUpgradeOffer &&
    !!hud?.survivalPaused && (hud?.survivalUpgradePendingCount??0)>0 &&
    !lobbyActive && !menuOpen && !hud?.matchEnding;
  upgradePendingRef.current=upgradePending||upgradeWaiting;
  const wasUpgradeOverlayRef=useRef(false);
  useEffect(()=>{
    const showUpgradeOverlay=upgradePending||upgradeWaiting;
    if(showUpgradeOverlay){
      pointerLockMenuStateRef.current=ignorePointerLockRelease(pointerLockMenuStateRef.current);
      engineRef.current?.setInputSuspended(true);
    }else if(!menuOpenRef.current){
      engineRef.current?.setInputSuspended(false);
      if(wasUpgradeOverlayRef.current)engineRef.current?.resumePointerLock();
    }
    wasUpgradeOverlayRef.current=showUpgradeOverlay;
  },[upgradePending,upgradeWaiting]);
  const takeSurvivalUpgrade=(id:SurvivalUpgradeId)=>{
    engineRef.current?.chooseSurvivalUpgrade(id);
    // Co-op stays frozen until the other player chooses or times out.
    if(!online){
      engineRef.current?.setInputSuspended(false);
      engineRef.current?.resumePointerLock();
    }
  };
  const openMenu = () => {
    if (firingRange || tutorial || lobbyActive || hud?.matchEnding || !ready || upgradePendingRef.current) return;
    // The pointer-lock release caused by opening this menu is intentional.
    // Its async event must not be allowed to reopen the menu after a quick Escape.
    pointerLockMenuStateRef.current = ignorePointerLockRelease(pointerLockMenuStateRef.current);
    menuOpenRef.current = true;
    menuPageRef.current = "main";
    setMenuPage("main");
    setMenuOpen(true);
    engineRef.current?.setInputSuspended(true);
    if(mode==="survival")engineRef.current?.setSurvivalMenuPaused(true);
  };
  const resumeGame = (restorePointerLock = true) => {
    menuOpenRef.current = false;
    menuPageRef.current = "main";
    setMenuPage("main");
    setMenuOpen(false);
    engineRef.current?.setInputSuspended(false);
    if(mode==="survival")engineRef.current?.setSurvivalMenuPaused(false);
    // Pointer lock can be requested directly by the Resume button's click.
    // Escape is the browser's own unlock key: requesting a new lock during its
    // keydown can immediately release it again (and reopen the menu).
    // On Escape, close cleanly; the next canvas click re-enters pointer lock.
    if (restorePointerLock) engineRef.current?.resumePointerLock();
  };
  const queueSavedLoadout = () => {
    const profile = useGame.getState().profile;
    const saved = profile?.loadout;
    if (!saved || !profile) return;
    const wire: LoadoutWire = {
      ...loadout,
      perkId: saved.perkId,
      wonderWeaponId: saved.perkId === "wonder_weapon" ? saved.wonderWeaponId : undefined,
      wonderModuleId: saved.wonderModuleId,
      wonderSkinId: saved.wonderSkinId,
      wonderKillEffectId: saved.wonderKillEffectId,
      weaponId: saved.weapon.id,
      secondaryWeaponId: saved.perkId === "well_prepared" || !isPrimaryWeaponCategory(saved.secondary.category)
        ? saved.secondary.id : "pistol_side",
      meleeWeaponId: saved.melee.id,
      equipmentId: saved.equipmentId,
      weaponSkinId: saved.weaponSkin.id,
      secondaryWeaponSkinId: saved.secondaryWeaponSkin?.id ?? "default",
      meleeWeaponSkinId: saved.meleeWeaponSkin?.id ?? "default",
      playerSkinId: saved.playerSkin.id,
      nameplateId: profile.selectedNameplate,
      primaryReticleId: saved.primaryReticle,
      secondaryReticleId: saved.secondaryReticle,
      primaryCharmId: saved.primaryCharm,
      secondaryCharmId: saved.secondaryCharm,
      attachments: { ...saved.attachments },
      secondaryAttachments: { ...saved.secondaryAttachments },
      meleeAttachments: { ...saved.meleeAttachments },
    };
    engineRef.current?.queueLoadout(wire);
  };
  const changeMenuPage = (page: InGameMenuPage) => {
    menuPageRef.current = page;
    setMenuPage(page);
  };

  useEffect(() => {
    if (firingRange || tutorial || lobbyActive || hud?.matchEnding || !ready) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.code !== "Escape" || event.repeat) return;
      if (upgradePendingRef.current) { event.preventDefault(); return; }
      event.preventDefault();
      event.stopImmediatePropagation();
      const action = escapeMenuAction(menuOpenRef.current, menuPageRef.current);
      if (action === "back") changeMenuPage("main");
      else if (action === "resume") resumeGame(false);
      else openMenu();
    };
    const onLockChange = () => {
      const locked = !!document.pointerLockElement && !!containerRef.current?.contains(document.pointerLockElement);
      // Some browsers consume Escape before keydown fires, so a genuine loss
      // of pointer lock still opens the menu. Ignore stale/intentional unlocks.
      const transition = pointerLockMenuTransition(pointerLockMenuStateRef.current, locked, menuOpenRef.current);
      pointerLockMenuStateRef.current = transition.state;
      if (transition.openMenu && !upgradePendingRef.current) openMenu();
    };
    window.addEventListener("keydown", onEscape, true);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, [ready, lobbyActive, hud?.matchEnding, firingRange, tutorial]);

  // Centralized exit handler: if the user leaves mid-match (not from the lobby),
  // capture the live match stats and forward them via onExitWithStats so the
  // caller can POST to /api/match/complete — otherwise the player's kills/XP/
  // credits from this match would be lost. If we're still in the lobby (match
  // hasn't started) or the match already ended, just exit cleanly.
  const handleExit = () => {
    if (firingRange) {
      engineInstance?.sendLeaveRoom();
      onExit();
      return;
    }
    if (lobbyActive) {
      engineInstance?.sendLeaveRoom();
      onExit();
      return;
    }
    if (onExitWithStats && engineInstance) {
      const stats = engineInstance.getLiveMatchStats();
      if (stats && (stats.durationSec ?? 0) > 3) {
        // Mark the match as ended locally so the engine doesn't also fire onMatchEnd.
        engineInstance.sendLeaveRoom();
        onExitWithStats(stats);
        return;
      }
    }
    engineInstance?.sendLeaveRoom();
    onExit();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black"
      onPointerDownCapture={() => engineRef.current?.unlockAudio()}
      onTouchStartCapture={() => engineRef.current?.unlockAudio()}>
      <div ref={containerRef} className="absolute inset-0" />
      {startupError && (
        <div role="alert" className="absolute inset-0 z-[80] flex items-center justify-center bg-black p-6 text-white">
          <div className="max-w-lg rounded-xl border border-amber-500/30 bg-zinc-900 p-6 text-center">
            <h2 className="mb-3 text-xl font-bold text-amber-300">Unable to start 3D graphics</h2>
            <p className="mb-3 text-sm text-white/70">
              Your browser could not create a WebGL context. Check graphics acceleration,
              update your GPU driver, and restart the browser.
            </p>
            <p className="mb-5 break-words font-mono text-xs text-white/40">{startupError}</p>
            <Button onClick={onExit}>Return to lobby</Button>
          </div>
        </div>
      )}
      {hud && !lobbyActive && <Hud hud={hud} onExit={openMenu} mode={mode} crosshairColor={settings.crosshairColor} crosshairSize={settings.crosshairSize} reticleStyle={hud.weaponSlot==="secondary" ? loadout.secondaryReticleId??"classic" : loadout.primaryReticleId??"classic"} showPing={settings.showPing} isTouch={isTouch && touchStarted} scopeOverlay={settings.scopeOverlay} />}
      {/* Mobile touch controls (hidden while in lobby) */}
      {isTouch && touchStarted && !lobbyActive && !menuOpen && !upgradePending && !upgradeWaiting && !hud?.matchEnding && <TouchControls engine={engineInstance} />}
      {/* Desktop "click to play" (pointer lock) — hidden while lobby overlay is up */}
      {ready && !isTouch && !hud?.pointerLocked && !lobbyActive && !menuOpen && !upgradePending && !upgradeWaiting && !hud?.matchEnding && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl px-8 py-6 text-center pointer-events-none">
            <div className="text-2xl font-bold tracking-widest text-white mb-1">{tutorial ? "FIELD TRAINING · CLICK TO START" : firingRange ? "FIRING RANGE · CLICK TO TEST" : "CLICK TO PLAY"}</div>
            <div className="text-sm text-white/60">WASD move · Mouse aim · L-Click fire · R-Click ADS · R reload · Shift sprint · Space jump</div>
            <div className="text-xs text-white/50 mt-2">1/2/3 swap weapon · F quick melee · G tactical · Q quick-swap · Tab scoreboard · Esc menu</div>
            <div className="text-xs text-amber-300/70 mt-2">{tutorial ? "Press Escape to use the tutorial controls" : firingRange ? "Press Escape to reopen the trial loadout menu" : "A 5-second countdown will start once you enter the match."}</div>
          </div>
        </div>
      )}
      {/* Mobile "tap to play" — hidden while lobby overlay is up */}
      {showStartOverlay && !lobbyActive && !menuOpen && !upgradePending && (
        <button
          className="absolute inset-0 flex items-center justify-center z-50 bg-black/60"
          onClick={() => setTouchStarted(true)}
        >
          <div className="bg-black/70 backdrop-blur-sm border border-amber-500/30 rounded-xl px-8 py-6 text-center">
            <div className="text-2xl font-bold tracking-widest text-amber-300 mb-1">{tutorial ? "TAP TO TRAIN" : firingRange ? "TAP TO TEST" : "TAP TO PLAY"}</div>
            <div className="text-sm text-white/60">Left stick to move (push far = sprint) · Drag right to look</div>
            <div className="text-xs text-white/40 mt-1">Left: Jump + weapon swap · Right: Fire + ADS + Reload + Quick Melee</div>
            <div className="text-xs text-white/40 mt-2">{mode === "survival" ? "Survival" : mode === "ctf" ? "Capture the Flag" : mode === "tdm" ? "Team Deathmatch" : mode === "killconfirmed" ? "Kill Confirmed" : mode === "gungame" ? "Gun Game" : "Free-For-All"} · {hud?.mapName ? displayMapLabel(hud.mapName) : ""}</div>
          </div>
        </button>
      )}
      {upgradePending && hud?.survivalUpgradeOffer && (
        <div className="absolute inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-md">
          <section role="dialog" aria-modal="true" aria-label="Survival upgrade selection"
            className="pointer-events-auto w-full max-w-4xl rounded-2xl border border-amber-400/30 bg-zinc-950/95 p-5 shadow-2xl sm:p-8">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-[.3em] text-amber-400">Survival · Wave {hud.survivalUpgradeOffer.wave} cleared</div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">Choose your upgrade</h2>
                <p className="mt-2 text-sm text-zinc-400">One pick per operative. Upgrades last for this run; Self-Revive can only be picked once.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
                <strong className="text-amber-300">{hud.survivalUpgradeSecondsLeft!==undefined
                  ? `${hud.survivalUpgradeSecondsLeft}s left`
                  : "Game paused"}</strong>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {hud.survivalUpgradeOffer.choices.map(id=>{
                const upgrade=SURVIVAL_UPGRADES.find(u=>u.id===id)!;
                const rank=(hud.survivalUpgradeRanks?.[id]??0)+1;
                return (
                  <button key={id} type="button" onClick={()=>takeSurvivalUpgrade(id)}
                    className="group flex min-h-48 flex-col rounded-xl border border-white/15 bg-zinc-900/90 p-5 text-left transition-all hover:border-amber-400 hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-400/80">{upgrade.rarity} · {upgrade.category}</span>
                    <span className="mt-4 text-xl font-bold text-white group-hover:text-amber-200">{upgrade.name}</span>
                    <span className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{upgrade.description}</span>
                    <span className="mt-3 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold leading-relaxed text-cyan-200">
                      {survivalUpgradeValueText(id,hud.survivalUpgradeRanks??{})}
                    </span>
                    {id==="self_revive" && <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-purple-300">Boss exclusive · one-time pick</span>}
                    <span className="mt-4 text-xs font-semibold text-amber-300">Select rank {rank}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 text-sm text-zinc-400">
              <span>{online ? "After one player chooses, the other has 10 seconds; otherwise their first option is assigned." : "The next wave waits until you choose."}</span>
              <button type="button" disabled={hud.survivalUpgradeOffer.rerollsRemaining<=0}
                onClick={()=>engineRef.current?.rerollSurvivalUpgrade()}
                className="shrink-0 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white transition-colors hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
                Reroll ({hud.survivalUpgradeOffer.rerollsRemaining})
              </button>
            </div>
          </section>
        </div>
      )}
      {upgradeWaiting && (
        <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/75 backdrop-blur-md">
          <div className="rounded-2xl border border-amber-500/30 bg-zinc-950 p-8 text-center">
            <h2 className="text-2xl font-bold text-white">Upgrade selected</h2>
            <p className="mt-2 text-zinc-300">Waiting for your teammate to choose…</p>
            {hud?.survivalUpgradeSecondsLeft!==undefined && (
              <p className="mt-4 text-3xl font-black tabular-nums text-amber-300">{hud.survivalUpgradeSecondsLeft}s</p>
            )}
          </div>
        </div>
      )}
      {/* Room lobby overlay (pre-match). Shown when the engine reports the room
          is in the "lobby" state. The host sees a "Start Match" button; everyone
          sees the player list + a "Leave" button. */}
      {lobbyActive && lobby && (
        <RoomLobby
          state={lobby}
          mode={mode}
          onStart={() => engineInstance?.sendStartMatch()}
          onLeave={handleExit}
          socketConnected={socketConnected}
        />
      )}
      {menuOpen && !lobbyActive && !hud?.matchEnding && (
        <InGameMenu page={menuPage} onPageChange={changeMenuPage} onResume={resumeGame}
          onQuit={handleExit} onLoadoutSaved={queueSavedLoadout} online={online} mode={mode} />
      )}
      {/* Failsafe exit button while lobby overlay is somehow missing but the
          engine is still in lobby (e.g. before the first lobbySnapshot arrives). */}
      {lobbyActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="absolute top-3 right-3 z-[60] text-white/60 hover:text-white hover:bg-white/5"
        >
          Leave
        </Button>
      )}
    </div>
  );
}
