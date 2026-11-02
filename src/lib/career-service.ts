import { db } from "./db";
import { careerRequirement } from "./career";
import { MAX_PLAYER_LEVEL, totalXpForLevel, levelForXp } from "./progression";

export class CareerPromotionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** A single conditional write spends credits and resets the fresh-XP meter.
 * Expected rank makes retries/double-clicks idempotent even if XP is full. */
export async function promoteCareer(playerId: string, expectedRank: number) {
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  if (player.careerRank !== expectedRank) throw new CareerPromotionError("Career rank changed. Refresh your profile.", 409);
  if (levelForXp(player.xp) < MAX_PLAYER_LEVEL) throw new CareerPromotionError(`Reach level ${MAX_PLAYER_LEVEL} first`, 403);
  const requirement = careerRequirement(expectedRank);
  if (player.careerXp < requirement.xp) throw new CareerPromotionError("Earn more fresh Career XP before promoting", 403);
  if (player.credits < requirement.credits) throw new CareerPromotionError(`Requires ${requirement.credits} credits`, 403);
  const result = await db.player.updateMany({
    where: {
      id: playerId, careerRank: expectedRank,
      xp: { gte: totalXpForLevel(MAX_PLAYER_LEVEL) },
      careerXp: { gte: requirement.xp }, credits: { gte: requirement.credits },
    },
    data: { careerRank: { increment: 1 }, careerXp: 0, credits: { decrement: requirement.credits } },
  });
  if (result.count !== 1) throw new CareerPromotionError("Career progress changed. Refresh your profile.", 409);
}
