/** Passive character perks. No charges or cooldowns; deliberately separate from attachments. */
export const PERKS = [
  { id: "field_loader", name: "Field Loader", description: "Reload and vent heat while sprinting.", icon: "refresh-cw" },
  { id: "recon_visor", name: "Recon Visor", description: "Enemy gunfire tracks moving targets on your minimap for 3.2 seconds instead of 2.2 seconds.", icon: "radar" },
  { id: "quickdraw", name: "Quickdraw", description: "Swap weapons 60% faster and reload 20% faster.", icon: "zap" },
  { id: "lightweight", name: "Lightweight", description: "Move 12% faster and jump slightly higher.", icon: "footprints" },
  { id: "steady", name: "Steady", description: "25% less recoil and 35% less weapon sway.", icon: "crosshair" },
  { id: "battle_hardened", name: "Battle-Hardened", description: "Begin health regeneration 1 second sooner after damage.", icon: "shield" },
  { id: "athlete", name: "Athlete", description: "Sprint for twice as long before stamina runs out.", icon: "activity" },
  { id: "scavenger", name: "Scavenger", description: "Enemies drop glowing ammunition packs. Collect one to restore 35% of your firearm magazines.", icon: "package" },
] as const;
export type PerkId = (typeof PERKS)[number]["id"];
export const PERK_STORAGE_KEY = "vanguard_perk";
export function perkById(id?: string | null) {
  return PERKS.find(p => p.id === id) ?? PERKS[0];
}
export function perkSelection(): PerkId {
  if (typeof localStorage === "undefined") return "field_loader";
  try { return perkById(localStorage.getItem(PERK_STORAGE_KEY)).id; }
  catch { return "field_loader"; }
}
export function survivalEnemyCount(wave: number, humans: number, baseCount: (wave: number) => number): number {
  return Math.round(baseCount(wave) * (humans >= 2 ? 1.75 : 1));
}

/** Centralized balancing; reused by local simulation and the authoritative server. */
export const reloadDurationMultiplier = (perkId?: string | null) => perkId === "quickdraw" ? 0.8 : 1;
export const regenDelayMs = (perkId?: string | null) => perkId === "battle_hardened" ? 1750 : 2750;
export const sprintDrainMultiplier = (perkId?: string | null) => perkId === "athlete" ? 0.5 : 1;
export const recoilMultiplier = (perkId?: string | null) => perkId === "steady" ? 0.75 : 1;
export const swayMultiplier = (perkId?: string | null) => perkId === "steady" ? 0.65 : 1;
export const scavengerAmmoAmount = (magSize: number) => Math.max(1, Math.ceil(magSize * 0.35));
export const SCAVENGER_PICKUP_RADIUS = 4.2;
export const SCAVENGER_DROP_LIFETIME_MS = 20000;
export const SCAVENGER_PICKUP_ARM_MS = 1500;
