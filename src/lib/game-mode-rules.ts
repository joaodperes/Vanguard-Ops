/**
 * Shared deterministic rules for the three new competitive modes.
 * No browser, rendering or transport dependencies: simulations and tests share this contract.
 */
export type ModeTeam = "red" | "blue";
export type ModeVec3 = readonly [number, number, number];
export interface ModeCombatant { id: string; team: ModeTeam; alive: boolean; pos: ModeVec3 }

export const SEARCH_DESTROY_RULES = Object.freeze({
  roundSeconds: 120, preparationSeconds: 5, plantSeconds: 5, defuseSeconds: 7,
  bombFuseSeconds: 40, roundsToWin: 6, sideSwitchAfter: 5, maxRounds: 11, interactionRadius: 2.6,
});
export const HARDPOINT_RULES = Object.freeze({
  matchSeconds: 600, scoreLimit: 200, zoneCount: 5, rotationSeconds: 60,
  transitionSeconds: 10, captureRadius: 5.5,
});
export const FRONTIER_RULES = Object.freeze({
  sprintMultiplier: 1.18, accelerationMultiplier: 1.2, jumpMultiplier: 1.22,
  adsMoveMultiplier: 0.92, dodgeCooldownMs: 3000, dodgeDurationMs: 220,
  dodgeSpeedMultiplier: 1.85, reserveAmmoMultiplier: 0.65, reloadTimeMultiplier: 1.12,
  allowedCategories: ["sniper", "dmr", "pistol", "shotgun"] as const,
  disabledEquipment: true, disabledExplosives: true,
});
export type FrontierWeaponCategory = typeof FRONTIER_RULES.allowedCategories[number];
export function frontierWeaponAllowed(category: string): category is FrontierWeaponCategory {
  return (FRONTIER_RULES.allowedCategories as readonly string[]).includes(category);
}
export function frontierMovementSpeed(baseSpeed: number, sprinting: boolean): number {
  return baseSpeed * (sprinting ? FRONTIER_RULES.sprintMultiplier : FRONTIER_RULES.accelerationMultiplier);
}
export function frontierReserveAmmo(baseReserve: number): number {
  return Math.max(1, Math.floor(baseReserve * FRONTIER_RULES.reserveAmmoMultiplier));
}

export type SearchDestroyPhase = "preparation" | "live" | "planted" | "round_end" | "match_end";
export type BombStatus = "carried" | "dropped" | "planted";
export interface SearchDestroyState {
  phase: SearchDestroyPhase; round: number; attackerTeam: ModeTeam;
  roundWins: Record<ModeTeam, number>; roundEndsAt: number; preparationEndsAt: number;
  bomb: { status: BombStatus; carrierId: string | null; pos: [number, number, number];
    siteId: "A" | "B" | null; plantedAt: number | null; detonatesAt: number | null;
    plantProgress: { playerId: string; startedAt: number } | null;
    defuseProgress: { playerId: string; startedAt: number } | null };
  lastRoundWinner: ModeTeam | null;
  lastRoundReason: "detonation" | "elimination" | "timeout" | "defuse" | null;
}
export interface SearchDestroySite { id: "A" | "B"; pos: ModeVec3; radius: number }
export interface SearchDestroyAction {
  kind: "plant" | "defuse" | "pickup"; playerId: string; team: ModeTeam;
  pos: ModeVec3; alive: boolean; siteId?: "A" | "B";
}
export type SearchDestroyEvent =
  | { type: "planted"; playerId: string; siteId: "A" | "B"; detonatesAt: number }
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

export function createSearchDestroyState(now: number, carrierId: string, carrierPos: ModeVec3): SearchDestroyState {
  return { phase: "preparation", round: 1, attackerTeam: "red", roundWins: { red: 0, blue: 0 },
    preparationEndsAt: now + SEARCH_DESTROY_RULES.preparationSeconds * 1000,
    roundEndsAt: now + (SEARCH_DESTROY_RULES.preparationSeconds + SEARCH_DESTROY_RULES.roundSeconds) * 1000,
    bomb: { status: "carried", carrierId, pos: [...carrierPos], siteId: null, plantedAt: null,
      detonatesAt: null, plantProgress: null, defuseProgress: null },
    lastRoundWinner: null, lastRoundReason: null };
}
export function beginNextSearchDestroyRound(
  state: SearchDestroyState, now: number, carrierId: string, carrierPos: ModeVec3,
): void {
  if (state.phase !== "round_end" || state.round >= SEARCH_DESTROY_RULES.maxRounds ||
      Math.max(state.roundWins.red, state.roundWins.blue) >= SEARCH_DESTROY_RULES.roundsToWin) return;
  state.round += 1; state.phase = "preparation";
  state.preparationEndsAt = now + SEARCH_DESTROY_RULES.preparationSeconds * 1000;
  state.roundEndsAt = now + (SEARCH_DESTROY_RULES.preparationSeconds + SEARCH_DESTROY_RULES.roundSeconds) * 1000;
  state.bomb = { status: "carried", carrierId, pos: [...carrierPos], siteId: null,
    plantedAt: null, detonatesAt: null, plantProgress: null, defuseProgress: null };
}
export function finishSearchDestroyRound(
  state: SearchDestroyState, winner: ModeTeam, reason: NonNullable<SearchDestroyState["lastRoundReason"]>, _now: number,
): SearchDestroyEvent[] {
  if (state.phase === "round_end" || state.phase === "match_end") return [];
  state.roundWins[winner] += 1; state.lastRoundWinner = winner; state.lastRoundReason = reason;
  state.phase = "round_end";
  const events: SearchDestroyEvent[] = [{ type: "round_won", winner, reason, round: state.round }];
  if (state.roundWins[winner] >= SEARCH_DESTROY_RULES.roundsToWin || state.round >= SEARCH_DESTROY_RULES.maxRounds) {
    state.phase = "match_end"; events.push({ type: "match_won", winner }); return events;
  }
  if (state.round === SEARCH_DESTROY_RULES.sideSwitchAfter) {
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
export function applySearchDestroyAction(
  state: SearchDestroyState, action: SearchDestroyAction, sites: readonly SearchDestroySite[], now: number,
): SearchDestroyActionResult {
  if (state.phase !== "live" && state.phase !== "planted") return null;
  if (!action.alive) return null;
  if (action.kind === "pickup") {
    if (state.phase !== "live" || action.team !== state.attackerTeam || state.bomb.status !== "dropped" ||
        !inside(action.pos, state.bomb.pos, SEARCH_DESTROY_RULES.interactionRadius)) return null;
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
    state.phase = "planted"; state.bomb.status = "planted"; state.bomb.siteId = site.id;
    state.bomb.carrierId = null; state.bomb.plantedAt = now;
    state.bomb.detonatesAt = now + SEARCH_DESTROY_RULES.bombFuseSeconds * 1000;
    state.bomb.plantProgress = null;
    return { type: "planted", playerId: action.playerId, siteId: site.id, detonatesAt: state.bomb.detonatesAt };
  }
  if (state.phase !== "planted" || action.team === state.attackerTeam ||
      !inside(action.pos, state.bomb.pos, SEARCH_DESTROY_RULES.interactionRadius)) return null;
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
export interface HardpointState {
  activeIndex: number; nextIndex: number; phase: "active" | "transition"; phaseEndsAt: number;
  scores: Record<ModeTeam, number>; objectiveMs: Record<ModeTeam, number>;
  captures: Record<ModeTeam, number>; contestedMs: Record<ModeTeam, number>;
  owner: ModeTeam | "contested" | "neutral";
}
export interface HardpointTickResult { state: HardpointState; scored: ModeTeam | null; rotated: boolean }
export function createHardpointState(now: number): HardpointState {
  return { activeIndex: 0, nextIndex: 1, phase: "active",
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
      state.phase = "transition"; state.phaseEndsAt = now + HARDPOINT_RULES.transitionSeconds * 1000;
      state.nextIndex = (state.activeIndex + 1) % zones.length; state.owner = "neutral";
    } else {
      state.phase = "active"; state.activeIndex = state.nextIndex;
      state.nextIndex = (state.activeIndex + 1) % zones.length;
      state.phaseEndsAt = now + HARDPOINT_RULES.rotationSeconds * 1000;
      state.owner = "neutral"; rotated = true;
    }
  }
  if (state.phase === "transition") return { state, scored: null, rotated };
  const zone = zones[state.activeIndex], radius = zone.radius ?? HARDPOINT_RULES.captureRadius;
  const red = players.some(p => p.alive && p.team === "red" && inside(p.pos, zone.pos, radius));
  const blue = players.some(p => p.alive && p.team === "blue" && inside(p.pos, zone.pos, radius));
  state.owner = red && blue ? "contested" : red ? "red" : blue ? "blue" : "neutral";
  if (state.owner === "contested" || state.owner === "neutral") {
    if (state.owner === "contested") { state.contestedMs.red += deltaMs; state.contestedMs.blue += deltaMs; }
    return { state, scored: null, rotated };
  }
  const team = state.owner; state.scores[team] += deltaMs / 1000; state.objectiveMs[team] += deltaMs;
  return { state, scored: team, rotated };
}
