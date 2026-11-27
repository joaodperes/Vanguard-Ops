/**
 * Shared deterministic rules for the three new competitive modes.
 * No browser, rendering or transport dependencies: simulations and tests share this contract.
 */
export type ModeTeam = "red" | "blue";
export type ModeVec3 = readonly [number, number, number];
export interface ModeCombatant { id: string; team: ModeTeam; alive: boolean; isBot?: boolean; pos: ModeVec3 }

export const SEARCH_DESTROY_RULES = Object.freeze({
  roundSeconds: 120, preparationSeconds: 5, roundEndMs: 2600, plantSeconds: 5, defuseSeconds: 7,
  bombFuseSeconds: 40, roundsToWin: 6, sideSwitchAfter: 5, maxRounds: 11, interactionRadius: 2.6, pickupRadius: 3.8,
});
export const HARDPOINT_RULES = Object.freeze({
  matchSeconds: 600, scoreLimit: 200, zoneCount: 5, rotationSeconds: 60,
  transitionSeconds: 10, captureRadius: 5.5,
});
export const FRONTIER_RULES = Object.freeze({
  reserveAmmoMultiplier: 0.65, reloadTimeMultiplier: 1.12,
  allowedCategories: ["sniper", "dmr", "pistol", "shotgun"] as const,
  allowedWeaponIds: ["sniper_scout", "sniper_lr", "dmr_scout", "pistol_magnum", "shotgun_br", "shotgun_combat", "pistol_bastion", "pistol_side", "pistol_ghost", "crossbow_reclaimer"] as const,
  disabledEquipment: true, disabledExplosives: true,
});
export type FrontierLoadoutPresetId = "scout" | "breacher" | "hunter" | "gunslinger";
export type FrontierWeaponCategory = typeof FRONTIER_RULES.allowedCategories[number];
export function frontierWeaponAllowed(category: string): category is FrontierWeaponCategory {
  return (FRONTIER_RULES.allowedCategories as readonly string[]).includes(category);
}
export function frontierWeaponIdAllowed(weaponId: string): boolean {
  return (FRONTIER_RULES.allowedWeaponIds as readonly string[]).includes(weaponId);
}
/** Frontier uses the same movement speed as every other standard mode. */
export function frontierMovementSpeed(baseSpeed: number, _sprinting: boolean): number {
  return baseSpeed;
}
export function frontierReserveAmmo(baseReserve: number): number {
  return Math.max(1, Math.floor(baseReserve * FRONTIER_RULES.reserveAmmoMultiplier));
}

/** Stable, evenly-spaced objective positions prevent bots stacking on one coordinate. */
export function distributedObjectivePosition(anchor: ModeVec3, actorId: string, radius = 3.2): [number, number, number] {
  let hash = 2166136261;
  for (let i = 0; i < actorId.length; i++) hash = Math.imul(hash ^ actorId.charCodeAt(i), 16777619);
  const angle = ((hash >>> 0) % 8) * (Math.PI / 4);
  const distance = radius + (((hash >>> 3) % 3) * 0.65);
  return [anchor[0] + Math.cos(angle) * distance, anchor[1], anchor[2] + Math.sin(angle) * distance];
}

export type SearchDestroyPhase = "preparation" | "live" | "planted" | "round_end" | "match_end";
export type BombStatus = "carried" | "dropped" | "planted";
export interface SearchDestroyState {
  phase: SearchDestroyPhase; round: number; attackerTeam: ModeTeam;
  roundWins: Record<ModeTeam, number>; roundEndsAt: number; preparationEndsAt: number; roundEndUntil: number;
  bomb: { status: BombStatus; carrierId: string | null; pos: [number, number, number];
    siteId: "A" | "B" | null; plantedAt: number | null; detonatesAt: number | null;
    plantProgress: { playerId: string; startedAt: number } | null;
    defuseProgress: { playerId: string; startedAt: number } | null };
  roundSeconds: number; roundsToWin: number; maxRounds: number; sideSwitchAfter: number;
  lastRoundWinner: ModeTeam | null;
  lastRoundReason: "detonation" | "elimination" | "timeout" | "defuse" | null;
}
export interface SearchDestroySite { id: "A" | "B"; pos: ModeVec3; radius: number }
/** Search & Destroy objective sites. Dustwater retains its authored sites; Verdant Ruins (compound) and Ridgefall (skybridge) use map-relative site locations. */
export function searchDestroySitesForMap(mapId: string, mapSize: number): SearchDestroySite[] {
  // Site locations are deliberately tucked beside authored cover/buildings,
  // rather than on exposed open-ground points that can be watched together.
  if (mapId === "dustwater") return [{id:"A",pos:[-12,0,-15],radius:5},{id:"B",pos:[15,0,25],radius:5}];
  if (mapId === "compound") return [{id:"A",pos:[-78,0,50],radius:5},{id:"B",pos:[108,0,50],radius:5}];
  if (mapId === "skybridge") return [{id:"A",pos:[-110,0,15],radius:5},{id:"B",pos:[100,0,30],radius:5}];
  const extent=Math.max(24,Math.min(62,mapSize*0.43));
  const depth=Math.max(12,Math.min(42,mapSize*0.30));
  return [{id:"A",pos:[-extent,0,-depth],radius:5},{id:"B",pos:[extent,0,-depth],radius:5}];
}

export interface SearchDestroyAction {
  kind: "plant" | "defuse" | "pickup" | "drop" | "cancel"; playerId: string; team: ModeTeam;
  pos: ModeVec3; alive: boolean; siteId?: "A" | "B";
}
export type SearchDestroyEvent =
  | { type: "planted"; playerId: string; siteId?: "A" | "B"; detonatesAt: number }
  | { type: "defused"; playerId: string }
  | { type: "picked_up"; playerId: string }
  | { type: "dropped"; playerId: string; pos: [number, number, number] }
  | { type: "round_won"; winner: ModeTeam; reason: NonNullable<SearchDestroyState["lastRoundReason"]>; round: number }
  | { type: "side_switch"; attackerTeam: ModeTeam }
  | { type: "match_won"; winner: ModeTeam };
export type SearchDestroyActionResult = SearchDestroyEvent | null;
const otherTeam = (team: ModeTeam): ModeTeam => team === "red" ? "blue" : "red";
const distance2D = (a: ModeVec3, b: ModeVec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const inside = (p: ModeVec3, q: ModeVec3, radius: number) => distance2D(p, q) <= radius;

/** Prefer a living human attacker, but allow an attacker-side bot to carry the bomb when no human is on that side. */
export function selectSearchDestroyCarrier<T extends ModeCombatant & { isBot?: boolean }>(
  players: readonly T[], attackerTeam: ModeTeam,
): T | undefined {
  const attackers = players.filter(player => player.alive && player.team === attackerTeam);
  return attackers.find(player => !player.isBot) ?? attackers[0];
}

export function createSearchDestroyState(now: number, carrierId: string, carrierPos: ModeVec3, roundSeconds: number = SEARCH_DESTROY_RULES.roundSeconds, roundsToWin: number = SEARCH_DESTROY_RULES.roundsToWin): SearchDestroyState {
  const wins=Math.max(1,Math.min(9,Math.floor(roundsToWin)));
  const seconds=Math.max(30,Math.min(600,Math.floor(roundSeconds)));
  const maxRounds=wins*2-1;
  return { phase: "preparation", round: 1, attackerTeam: "red", roundWins: { red: 0, blue: 0 }, roundSeconds:seconds, roundsToWin:wins, maxRounds, sideSwitchAfter:wins-1,
    preparationEndsAt: now + SEARCH_DESTROY_RULES.preparationSeconds * 1000,
    roundEndUntil: 0,
    roundEndsAt: now + (SEARCH_DESTROY_RULES.preparationSeconds + seconds) * 1000,
    bomb: { status: "carried", carrierId, pos: [...carrierPos], siteId: null, plantedAt: null,
      detonatesAt: null, plantProgress: null, defuseProgress: null },
    lastRoundWinner: null, lastRoundReason: null };
}
export function beginNextSearchDestroyRound(
  state: SearchDestroyState, now: number, carrierId: string, carrierPos: ModeVec3,
): void {
  if (state.phase !== "round_end" || now < state.roundEndUntil || state.round >= state.maxRounds ||
      Math.max(state.roundWins.red, state.roundWins.blue) >= state.roundsToWin) return;
  state.round += 1; state.phase = "preparation"; state.roundEndUntil = 0;
  state.preparationEndsAt = now + SEARCH_DESTROY_RULES.preparationSeconds * 1000;
  state.roundEndsAt = now + (SEARCH_DESTROY_RULES.preparationSeconds + state.roundSeconds) * 1000;
  state.bomb = { status: "carried", carrierId, pos: [...carrierPos], siteId: null,
    plantedAt: null, detonatesAt: null, plantProgress: null, defuseProgress: null };
}
export function finishSearchDestroyRound(
  state: SearchDestroyState, winner: ModeTeam, reason: NonNullable<SearchDestroyState["lastRoundReason"]>, now: number,
): SearchDestroyEvent[] {
  if (state.phase === "round_end" || state.phase === "match_end") return [];
  state.roundWins[winner] += 1; state.lastRoundWinner = winner; state.lastRoundReason = reason;
  state.phase = "round_end";
  state.roundEndUntil = now + SEARCH_DESTROY_RULES.roundEndMs;
  const events: SearchDestroyEvent[] = [{ type: "round_won", winner, reason, round: state.round }];
  if (state.roundWins[winner] >= state.roundsToWin || state.round >= state.maxRounds) {
    state.phase = "match_end"; state.roundEndUntil = now; events.push({ type: "match_won", winner }); return events;
  }
  if (state.round === state.sideSwitchAfter) {
    state.attackerTeam = otherTeam(state.attackerTeam);
    events.push({ type: "side_switch", attackerTeam: state.attackerTeam });
  }
  return events;
}
export function dropSearchDestroyBomb(state: SearchDestroyState, playerId: string, pos: ModeVec3): SearchDestroyEvent | null {
  if (state.phase !== "live" || state.bomb.status !== "carried" || state.bomb.carrierId !== playerId) return null;
  state.bomb.status = "dropped"; state.bomb.carrierId = null; state.bomb.pos = [...pos];
  state.bomb.plantProgress = null;
  return { type: "dropped", playerId, pos: [...pos] };
}

/** Release a departing player's S&D interactions and drop the bomb if they carried it. */
export function releaseSearchDestroyPlayer(state: SearchDestroyState, playerId: string, pos: ModeVec3): SearchDestroyEvent | null {
  const dropped = dropSearchDestroyBomb(state, playerId, pos);
  if (state.bomb.plantProgress?.playerId === playerId) state.bomb.plantProgress = null;
  if (state.bomb.defuseProgress?.playerId === playerId) state.bomb.defuseProgress = null;
  return dropped;
}
export function applySearchDestroyAction(
  state: SearchDestroyState, action: SearchDestroyAction, sites: readonly SearchDestroySite[], now: number,
): SearchDestroyActionResult {
  if (state.phase !== "live" && state.phase !== "planted") return null;
  if (action.kind === "cancel") {
    if (state.bomb.plantProgress?.playerId === action.playerId) state.bomb.plantProgress = null;
    if (state.bomb.defuseProgress?.playerId === action.playerId) state.bomb.defuseProgress = null;
    return null;
  }
  if (!action.alive) return null;
  if (action.kind === "drop") {
    if (action.team !== state.attackerTeam) return null;
    return dropSearchDestroyBomb(state, action.playerId, action.pos);
  }
  if (action.kind === "pickup") {
    if (state.phase !== "live" || action.team !== state.attackerTeam || state.bomb.status !== "dropped" ||
        !inside(action.pos, state.bomb.pos, SEARCH_DESTROY_RULES.pickupRadius)) return null;
    state.bomb.status = "carried"; state.bomb.carrierId = action.playerId;
    return { type: "picked_up", playerId: action.playerId };
  }
  if (action.kind === "plant") {
    if (state.phase !== "live" || action.team !== state.attackerTeam ||
        state.bomb.status !== "carried" || state.bomb.carrierId !== action.playerId) return null;
    const site = sites.find(s => s.id === action.siteId && inside(action.pos, s.pos, s.radius));
    if (!site) { state.bomb.plantProgress = null; return null; }
    const progress = state.bomb.plantProgress;
    if (!progress || progress.playerId !== action.playerId) {
      state.bomb.plantProgress = { playerId: action.playerId, startedAt: now }; return null;
    }
    if (now - progress.startedAt < SEARCH_DESTROY_RULES.plantSeconds * 1000) return null;
    state.phase = "planted"; state.bomb.status = "planted"; state.bomb.siteId = site.id; state.bomb.pos = [...site.pos];
    state.bomb.carrierId = null; state.bomb.plantedAt = now;
    state.bomb.detonatesAt = now + SEARCH_DESTROY_RULES.bombFuseSeconds * 1000;
    state.bomb.plantProgress = null;
    return { type: "planted", playerId: action.playerId, siteId: site.id, detonatesAt: state.bomb.detonatesAt };
  }
  if (state.phase !== "planted" || action.team === state.attackerTeam) return null;
  if (!inside(action.pos, state.bomb.pos, SEARCH_DESTROY_RULES.interactionRadius)) { state.bomb.defuseProgress = null; return null; }
  const progress = state.bomb.defuseProgress;
  if (!progress || progress.playerId !== action.playerId) {
    state.bomb.defuseProgress = { playerId: action.playerId, startedAt: now }; return null;
  }
  if (now - progress.startedAt < SEARCH_DESTROY_RULES.defuseSeconds * 1000) return null;
  state.bomb.defuseProgress = null;
  finishSearchDestroyRound(state, otherTeam(state.attackerTeam), "defuse", now);
  return { type: "defused", playerId: action.playerId };
}
export function tickSearchDestroy(
  state: SearchDestroyState, players: readonly ModeCombatant[], now: number,
): SearchDestroyEvent[] {
  if (state.phase === "match_end" || state.phase === "round_end") return [];
  if (state.phase === "preparation" && now >= state.preparationEndsAt) state.phase = "live";
  if (state.phase === "planted" && state.bomb.detonatesAt !== null && now >= state.bomb.detonatesAt)
    return finishSearchDestroyRound(state, state.attackerTeam, "detonation", now);
  const attackers = players.filter(p => p.team === state.attackerTeam && p.alive);
  const defenders = players.filter(p => p.team !== state.attackerTeam && p.alive);
  if (state.phase === "planted") {
    if (defenders.length === 0) return finishSearchDestroyRound(state, state.attackerTeam, "elimination", now);
  } else if (state.phase === "live") {
    if (attackers.length === 0) return finishSearchDestroyRound(state, otherTeam(state.attackerTeam), "elimination", now);
    if (defenders.length === 0) return finishSearchDestroyRound(state, state.attackerTeam, "elimination", now);
    if (now >= state.roundEndsAt) return finishSearchDestroyRound(state, otherTeam(state.attackerTeam), "timeout", now);
  }
  return [];
}

export interface HardpointZone { id: string; pos: ModeVec3; radius?: number }
/**
 * Five authored Hardpoint centres per supported arena. Each capture zone and its
 * 6.25-unit visual boundary fit inside the playable footprint. The Blacksite
 * fallback keeps existing rooms inside its central playable area after the map is retired from this mode.
 */
export function hardpointZonesForMap(mapId: string): HardpointZone[] {
  const layouts: Record<string, readonly ModeVec3[]> = {
    dustwater: [[-36,0,-28],[36,0,-28],[0,0,0],[-36,0,28],[36,0,28]],
    floodgate: [[-100,0,-20],[-50,0,20],[0,0,-20],[50,0,20],[100,0,-20]],
    whiteout_depot: [[-85,0,-25],[-85,0,25],[0,0,-45],[85,0,-25],[85,0,25]],
    bunker: [[-25,0,-25],[25,0,-25],[0,0,0],[-25,0,25],[25,0,25]],
  };
  const positions = layouts[mapId] ?? layouts.dustwater;
  return positions.map((pos,index)=>({id:String(index),pos,radius:6.25}));
}
export interface HardpointState {
  activeIndex: number; nextIndex: number; zoneOrder: number[]; rotationIndex: number;
  phase: "active" | "transition"; phaseEndsAt: number;
  scores: Record<ModeTeam, number>; objectiveMs: Record<ModeTeam, number>;
  captures: Record<ModeTeam, number>; contestedMs: Record<ModeTeam, number>;
  owner: ModeTeam | "contested" | "neutral";
}
export interface HardpointTickResult { state: HardpointState; scored: ModeTeam | null; rotated: boolean }
export function createHardpointState(now: number, zoneCount = HARDPOINT_RULES.zoneCount, randomize = false): HardpointState {
  const zoneOrder = Array.from({length: zoneCount}, (_,i)=>i);
  if(randomize)for(let i=zoneOrder.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[zoneOrder[i],zoneOrder[j]]=[zoneOrder[j],zoneOrder[i]];}
  return { activeIndex: zoneOrder[0]??0, nextIndex: zoneOrder[1]??zoneOrder[0]??0, zoneOrder, rotationIndex: 0, phase: "active",
    phaseEndsAt: now + HARDPOINT_RULES.rotationSeconds * 1000,
    scores: { red: 0, blue: 0 }, objectiveMs: { red: 0, blue: 0 },
    captures: { red: 0, blue: 0 }, contestedMs: { red: 0, blue: 0 }, owner: "neutral" };
}
export function tickHardpoint(
  state: HardpointState, zones: readonly HardpointZone[], players: readonly ModeCombatant[], now: number, deltaMs: number,
): HardpointTickResult {
  if (!zones.length) return { state, scored: null, rotated: false };
  let rotated = false;
  if (now >= state.phaseEndsAt) {
    if (state.phase === "active") {
      // The outgoing point remains live and can still score throughout the
      // transition countdown. Ownership is recalculated below as usual.
      state.phase = "transition"; state.phaseEndsAt = now + HARDPOINT_RULES.transitionSeconds * 1000;
      state.nextIndex = state.zoneOrder[(state.rotationIndex + 1) % zones.length] ?? (state.activeIndex + 1) % zones.length;
    } else {
      state.phase = "active"; state.activeIndex = state.nextIndex;
      state.rotationIndex = (state.rotationIndex + 1) % zones.length;
      state.nextIndex = state.zoneOrder[(state.rotationIndex + 1) % zones.length] ?? (state.activeIndex + 1) % zones.length;
      state.phaseEndsAt = now + HARDPOINT_RULES.rotationSeconds * 1000;
      state.owner = "neutral"; rotated = true;
    }
  }
  // During transition, activeIndex deliberately remains the outgoing point:
  // keep capturing/scoring it until the new point activates.
  const zone = zones[state.activeIndex], radius = zone.radius ?? HARDPOINT_RULES.captureRadius;
  // A legacy/standalone Hardpoint participant can arrive with the generic FFA
  // team token. Hardpoint is always a team objective, so when no combatant has
  // a resolved side yet, let those participants capture for Red rather than
  // leaving an occupied point permanently neutral.
  const hasAssignedTeam = players.some(p => p.team === "red" || p.team === "blue");
  const red = players.some(p => p.alive &&
    (p.team === "red" || (!hasAssignedTeam && (p.team as string) === "ffa")) &&
    inside(p.pos, zone.pos, radius));
  const blue = players.some(p => p.alive && p.team === "blue" && inside(p.pos, zone.pos, radius));
  state.owner = red && blue ? "contested" : red ? "red" : blue ? "blue" : "neutral";
  if (state.owner === "contested" || state.owner === "neutral") {
    if (state.owner === "contested") { state.contestedMs.red += deltaMs; state.contestedMs.blue += deltaMs; }
    return { state, scored: null, rotated };
  }
  const team = state.owner; state.scores[team] += deltaMs / 1000; state.objectiveMs[team] += deltaMs;
  return { state, scored: team, rotated };
}

/** Human contributors currently earning uncontested Hardpoint time. */
export function hardpointObjectiveContributors(
  zone: HardpointZone,
  owner: HardpointState["owner"],
  players: readonly ModeCombatant[],
): string[] {
  if (owner !== "red" && owner !== "blue") return [];
  const radius = zone.radius ?? HARDPOINT_RULES.captureRadius;
  return players
    .filter(player => player.alive && player.team === owner && inside(player.pos, zone.pos, radius))
    .map(player => player.id);
}
