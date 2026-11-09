/** Passive character perks; kept separate from weapon attachments. */
// New choices arrive at roughly three-level intervals, beginning at level 4.
export const PERKS = [
  { id: "battle_hardened", name: "Battle-Hardened", description: "Begin health regeneration 1 second sooner after damage.", icon: "shield", unlockLevel: 1 },
  { id: "wonder_weapon", name: "Wonder Weapon", description: "Trade a passive perk for a rechargeable Wonder in slot 4.", icon: "zap", unlockLevel: 1 },
  { id: "field_loader", name: "Field Loader", description: "Reload and vent heat while sprinting.", icon: "refresh-cw", unlockLevel: 4 },
  { id: "recon_visor", name: "Recon Visor", description: "Enemy gunfire tracks moving targets on your minimap for 3.2 seconds instead of 2.2 seconds.", icon: "radar", unlockLevel: 7 },
  { id: "quickdraw", name: "Quickdraw", description: "Swap weapons 60% faster and reload 20% faster.", icon: "zap", unlockLevel: 10 },
  { id: "lightweight", name: "Lightweight", description: "Move 12% faster and jump slightly higher.", icon: "footprints", unlockLevel: 13 },
  { id: "steady", name: "Steady", description: "25% less recoil and 35% less weapon sway.", icon: "crosshair", unlockLevel: 16 },
  { id: "athlete", name: "Athlete", description: "Sprint for twice as long before stamina runs out.", icon: "activity", unlockLevel: 19 },
  { id: "scavenger", name: "Scavenger", description: "Your eliminations drop private ammo packs that only you can see and collect. Fully reloads the magazine of your currently held conventional firearm.", icon: "package", unlockLevel: 22 },
  { id: "explonando", name: "Explonando", description: "On death, leave behind an explosive that detonates after 2 seconds, damaging nearby enemies.", icon: "bomb", unlockLevel: 25 },
  { id: "well_prepared", name: "Well Prepared", description: "Equip a second distinct primary weapon in your secondary slot instead of a sidearm.", icon: "backpack", unlockLevel: 28 },
  { id: "tactician", name: "Tactician", description: "Regenerate one used tactical equipment charge every 18 seconds, up to its normal capacity.", icon: "timer-reset", unlockLevel: 34 },
  { id: "silent_steps", name: "Silent Steps", description: "Move without making footstep sounds. Gunfire and other actions remain audible.", icon: "volume-x", unlockLevel: 31 },
] as const;
export type PerkId = (typeof PERKS)[number]["id"];
export const PERK_STORAGE_KEY = "vanguard_perk";
export const DEFAULT_PERK_ID: PerkId = "battle_hardened";
export function perkById(id?: string | null) {
  return PERKS.find(p => p.id === id) ?? PERKS[0];
}
export function perkUnlocked(id: string | null | undefined, level: number): boolean {
  return perkById(id).unlockLevel <= level;
}
/** Validates legacy localStorage selections against current player level. */
export function perkSelection(level = 1): PerkId {
  if (typeof localStorage === "undefined") return DEFAULT_PERK_ID;
  try {
    const selected = perkById(localStorage.getItem(PERK_STORAGE_KEY));
    return selected.unlockLevel <= level ? selected.id : DEFAULT_PERK_ID;
  } catch { return DEFAULT_PERK_ID; }
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
export const scavengerAmmoAmount = (magSize: number) => Math.max(0, magSize);
export const SCAVENGER_PICKUP_RADIUS = 4.2;
export const SCAVENGER_DROP_LIFETIME_MS = 20000;
export const SCAVENGER_PICKUP_ARM_MS = 1500;

/** Shared authorization gate for a second primary. */
export function canEquipSecondaryPrimary(perkId: string | null | undefined, level: number): boolean {
  return perkId === "well_prepared" && perkUnlocked(perkId, level);
}

/** Shared charge model for local play and the server. nextAt uses the caller's clock. */
export const TACTICIAN_RECHARGE_MS=18_000;
export interface TacticalStock {charges:number;nextAt:number}
export function rechargeTactical(stock:TacticalStock,now:number,perkId:string|null|undefined,max:number):TacticalStock{
  if(perkId!=="tactician"||!stock.nextAt||stock.charges>=max||now<stock.nextAt)return stock;
  const gained=Math.min(max-stock.charges,1+Math.floor((now-stock.nextAt)/TACTICIAN_RECHARGE_MS));
  const charges=stock.charges+gained;
  return {charges,nextAt:charges===max?0:stock.nextAt+gained*TACTICIAN_RECHARGE_MS};
}
export function spendTactical(stock:TacticalStock,now:number,perkId:string|null|undefined,max:number):TacticalStock{
  const ready=rechargeTactical(stock,now,perkId,max);
  if(ready.charges<=0)return ready;
  const charges=ready.charges-1;
  return {charges,nextAt:perkId==="tactician" ? ready.nextAt||now+TACTICIAN_RECHARGE_MS : 0};
}
