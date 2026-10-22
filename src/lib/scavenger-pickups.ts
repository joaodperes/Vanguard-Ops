import { SCAVENGER_DROP_LIFETIME_MS, SCAVENGER_PICKUP_ARM_MS, SCAVENGER_PICKUP_RADIUS } from "./perks";

/** Only the player actively using Scavenger earns a private ammo pack from a kill. */
export function shouldCreateScavengerDrop(attackerId?: string | null, victimId?: string | null, perkId?: string | null): boolean {
  return perkId === "scavenger" && !!attackerId && !!victimId && attackerId !== victimId;
}

export function canCollectScavengerDrop(args: {
  now: number;
  expiresAt: number;
  distance: number;
  perkId?: string | null;
  collectorId: string;
  ownerId: string;
  alive: boolean;
  mode: string;
  collectorTeam?: string | null;
  defeatedTeam?: string | null;
}): boolean {
  if (!args.alive || args.perkId !== "scavenger" || args.collectorId !== args.ownerId) return false;
  if (args.now >= args.expiresAt ||
      args.now < args.expiresAt - SCAVENGER_DROP_LIFETIME_MS + SCAVENGER_PICKUP_ARM_MS) return false;
  if (args.distance > SCAVENGER_PICKUP_RADIUS) return false;
  if (args.mode !== "ffa" && args.mode !== "gungame" &&
      args.defeatedTeam != null && args.collectorTeam === args.defeatedTeam) return false;
  return true;
}
