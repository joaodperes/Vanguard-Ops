/** Shapes for the TS-authored loadout catalogs. Metadata validation does
 * not imply that new tactical effects or perks have implemented gameplay.
 */
import {z} from "zod";
import {MAX_PLAYER_LEVEL} from "./progression";
const name=z.string().min(1);
const level=z.number().int().min(1).max(MAX_PLAYER_LEVEL);
export const PERKS_SCHEMA=z.array(z.strictObject({
  id:z.string().regex(/^[a-z][a-z0-9_:-]*$/),
  name,description:name,icon:name,unlockLevel:level,
})).min(1);
export const EQUIPMENT_SCHEMA=z.array(z.strictObject({
  id:z.string().regex(/^[a-z][a-z0-9_:-]*$/),
  unlockLevel:level,name,
  type:z.enum(["blast","flash","taser","mine","knife","cover","poison"]),
  charges:z.number().int().min(1),
  cooldownMs:z.number().finite().nonnegative(),
  radius:z.number().finite().nonnegative(),
  damage:z.number().finite().nonnegative(),
  description:name,
})).min(1);
