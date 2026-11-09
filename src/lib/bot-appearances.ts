import { PLAYER_SKINS } from "./game-data";

// All catalogue operatives are valid for AI, including Shop cosmetics.
// Human unlock/ownership checks do not apply to bots.
export const BOT_OPERATIVE_SKINS = PLAYER_SKINS.map(skin => skin.id);
export const SURVIVAL_BOSS_SKIN_ID = "crimson_lord";

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

// A relatively-prime step yields a complete tour of the catalogue before
// repeating, preventing a 16-bot lobby from rolling mostly red/blue skins.
export function botOperativeSkinId(slot: number, rotation = 0): string {
  const count = BOT_OPERATIVE_SKINS.length;
  if (count === 0) return "default";
  let stride = Math.floor(count / 2) + 1;
  while (gcd(stride, count) !== 1) stride++;
  const index = ((Math.trunc(slot) * stride + Math.trunc(rotation)) % count + count) % count;
  return BOT_OPERATIVE_SKINS[index];
}

export function isSurvivalBoss(id: string, name: string, isBot: boolean): boolean {
  return isBot && (id.startsWith("svboss_") || /^BOSS · W\d+$/.test(name));
}

/** Elite units are visually reinforced every fifth wave, below the boss tier. */
export function isSurvivalElite(id:string,name:string,isBot:boolean):boolean {
  return isBot && (/^ELITE · W\d+$/.test(name) || id.startsWith("svelite_"));
}
export const BOSS_SHOCKWAVE_WARNING_MS = 2200;

export function bossShockwaveCharge(nextSkillAt: number, now: number): number {
  return Math.max(0, Math.min(1, (now - nextSkillAt + BOSS_SHOCKWAVE_WARNING_MS) / BOSS_SHOCKWAVE_WARNING_MS));
}
