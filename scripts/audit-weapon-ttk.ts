/**
 * Reproducible first-magazine TTK and damage-breakpoint audit.
 * Run: bun scripts/audit-weapon-ttk.ts
 *
 * Shotguns (pellet geometry), launchers (projectiles/splash), melee and Wonders
 * need separate simulations and are intentionally excluded.
 */
import {
  WEAPONS, attachmentById, compatibleAttachments, computeEffectiveStats,
  type AttachmentSlot, type WeaponDef,
} from "../src/lib/game-data";
import { hitsToEliminate, idealTimeToKillMs } from "../src/lib/weapon-balance";

const EMPTY: Record<AttachmentSlot,string|null> = { sight:null, barrel:null, grip:null, magazine:null };
const slots: AttachmentSlot[] = ["sight","barrel","grip","magazine"];
const distances = [0,20,40,60];
const applicable = WEAPONS.filter(w => !w.disabled && !w.wonder &&
  !["melee","shotgun","launcher"].includes(w.category));
const fmtTime = (t:number|null) => t === null ? "n/a" : String(Math.round(t));
const evaluate = (weapon:WeaponDef, atts:Record<AttachmentSlot,string|null>, meters:number) => {
  const stats = computeEffectiveStats(weapon,atts);
  return {
    hits: hitsToEliminate(stats,meters),
    ttk: idealTimeToKillMs(weapon,stats,meters),
    head: idealTimeToKillMs(weapon,stats,meters,512),
  };
};
console.log("# Weapon TTK audit: ideal 100-HP first-magazine kills");
console.log("Assumes perfect hits and nominal fire intervals; excludes aiming/recoil/heat/latency.");
console.log("Burst cadence uses the same shared helper as the client/server. n/a means reload required or out of hit range.");
console.log("");
console.log("| Weapon | Category | 0m hits | 0m TTK ms | 20m TTK | 40m TTK | 60m TTK | 0m all-head TTK |");
console.log("|---|---|---:|---:|---:|---:|---:|---:|");
for (const weapon of applicable) {
  const data = distances.map(m => evaluate(weapon,EMPTY,m));
  console.log("| "+[weapon.name,weapon.category,data[0].hits ?? "n/a",fmtTime(data[0].ttk),
    fmtTime(data[1].ttk),fmtTime(data[2].ttk),fmtTime(data[3].ttk),fmtTime(data[0].head)].join(" | ")+" |");
}
type Finding = { weapon:string; attachment:string; distance:number; before:number; after:number; deltaTtk:number|null };
const findings:Finding[] = [];
let examined = 0;
for (const weapon of applicable) {
  for (const slot of slots) {
    for (const id of compatibleAttachments(weapon.id,slot)) {
      const baseline = distances.map(m => evaluate(weapon,EMPTY,m));
      const selected = {...EMPTY,[slot]:id};
      const modified = distances.map(m => evaluate(weapon,selected,m));
      examined++;
      for (let i=0;i<distances.length;i++) {
        if (baseline[i].hits === null || modified[i].hits === null) continue;
        if (modified[i].hits! > baseline[i].hits!) {
          findings.push({
            weapon:weapon.name,attachment:attachmentById(id)?.name ?? id,
            distance:distances[i],before:baseline[i].hits!,after:modified[i].hits!,
            deltaTtk:baseline[i].ttk === null || modified[i].ttk === null ? null :
              Math.round(modified[i].ttk! - baseline[i].ttk!),
          });
        }
      }
    }
  }
}
console.log("");
console.log("## Single-attachment shot-count increases ("+examined+" combinations, "+distances.length+" distances)");
console.log("A breakpoint increase is a review signal, not automatically a balance bug.");
console.log("| Weapon | Attachment | Distance | Body hits before / after | TTK change ms |");
console.log("|---|---|---:|---:|---:|");
for (const row of findings) {
  console.log("| "+[row.weapon,row.attachment,row.distance+"m",row.before+" / "+row.after,
    fmtTime(row.deltaTtk)].join(" | ")+" |");
}
if(!findings.length)console.log("| None | - | - | - | - |");
console.log("");
console.log("## All legal four-slot loadouts");
console.log("Includes stock and every allowed combination of sight, barrel, grip and magazine.");
console.log("Counts are warnings of body-shot breakpoint changes, not evidence of real-game dominance.");
console.log("| Weapon | Legal loadouts | +body hit at 0m | +body hit at 40m | Example of 0m breakpoint-changing loadout |");
console.log("|---|---:|---:|---:|---|");
let totalLoadouts=0, totalCloseChanges=0, totalFortyChanges=0;
for(const weapon of applicable) {
  const options=slots.map(slot=>[null,...compatibleAttachments(weapon.id,slot)]);
  const zeroBase=evaluate(weapon,EMPTY,0), fortyBase=evaluate(weapon,EMPTY,40);
  let tested=0,closeChanges=0,fortyChanges=0,example="-";
  for(const sight of options[0])for(const barrel of options[1])
  for(const grip of options[2])for(const magazine of options[3]){
    const loadout:Record<AttachmentSlot,string|null>={sight,barrel,grip,magazine};
    const close=evaluate(weapon,loadout,0);
    const forty=evaluate(weapon,loadout,40);
    tested++;
    if(close.hits !== null && zeroBase.hits !== null && close.hits>zeroBase.hits){
      closeChanges++;
      if(example==="-")example=slots.filter(slot=>loadout[slot]).map(slot=>loadout[slot]).join(", ");
    }
    if(forty.hits !== null && fortyBase.hits !== null && forty.hits>fortyBase.hits)
      fortyChanges++;
  }
  totalLoadouts+=tested;
  totalCloseChanges+=closeChanges;
  totalFortyChanges+=fortyChanges;
  console.log("| "+[weapon.name,tested,closeChanges,fortyChanges,example].join(" | ")+" |");
}
console.log("");
console.log("Total legal loadouts: "+totalLoadouts+
  "; builds with additional close-range body hits: "+totalCloseChanges+
  "; builds with additional 40m body hits: "+totalFortyChanges+".");
