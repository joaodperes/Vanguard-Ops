import {describe,expect,test} from "bun:test";
import {CATALOG_SCHEMAS,PUBLISHED_CATALOG_SCHEMA_NAMES} from "../src/lib/catalog-contract";
import {catalogJsonSchema} from "../src/lib/catalog-json-schema";
import {validateGameContent} from "../src/lib/content-validation";
import {PERKS_SCHEMA,EQUIPMENT_SCHEMA} from "../src/lib/loadout-contract";
import {PERKS} from "../src/lib/perks";
import {EQUIPMENT} from "../src/lib/equipment";
import weaponsSchema from "../src/data/schemas/weapons.schema.json";
import attachmentsSchema from "../src/data/schemas/attachments.schema.json";
import skinsSchema from "../src/data/schemas/weapon-skins.schema.json";
import operatorsSchema from "../src/data/schemas/operator-skins.schema.json";
import challengesSchema from "../src/data/schemas/weapon-challenges.schema.json";
import weapons from "../src/data/catalogs/weapons.json";
import attachments from "../src/data/catalogs/attachments.json";
import skinData from "../src/data/catalogs/weapon-skins.json";
import operators from "../src/data/catalogs/operator-skins.json";
import challenges from "../src/data/catalogs/weapon-challenges.json";
import daily from "../src/data/catalogs/daily-challenges.json";
import weekly from "../src/data/catalogs/weekly-challenges.json";
import elite from "../src/data/catalogs/elite-quests.json";
import achievements from "../src/data/catalogs/achievements.json";
import ranks from "../src/data/catalogs/ranks.json";
import callouts from "../src/data/catalogs/killstreak-callouts.json";
import sights from "../src/data/catalogs/sight-definitions.json";
import compatible from "../src/data/catalogs/attachment-compatibility.json";
import categories from "../src/data/catalogs/category-attachments.json";
import rewards from "../src/data/catalogs/rewards.json";
import colors from "../src/data/catalogs/achievement-colors.json";
import modes from "../src/data/catalogs/match-modes.json";

const data={
  weapons,attachments,"weapon-skins":skinData,"operator-skins":operators,
  "weapon-challenges":challenges,"daily-challenges":daily,"weekly-challenges":weekly,
  "elite-quests":elite,achievements,ranks,"killstreak-callouts":callouts,
  "sight-definitions":sights,"attachment-compatibility":compatible,
  "category-attachments":categories,rewards,"achievement-colors":colors,"match-modes":modes,
};
describe("single-source content catalog contracts",()=>{
  test("all published catalog shapes validate through the registry",()=>{
    for(const [name,schema] of Object.entries(CATALOG_SCHEMAS))
      expect(schema.safeParse(data[name as keyof typeof data]).success,name).toBe(true);
    expect(Object.keys(data).sort()).toEqual(Object.keys(CATALOG_SCHEMAS).sort());
  });
  test("published external JSON Schemas derive from runtime content validators",()=>{
    const files={weapons:weaponsSchema,attachments:attachmentsSchema,
      "weapon-skins":skinsSchema,"operator-skins":operatorsSchema,
      "weapon-challenges":challengesSchema};
    expect(Object.keys(files).sort()).toEqual([...PUBLISHED_CATALOG_SCHEMA_NAMES].sort());
    for(const name of PUBLISHED_CATALOG_SCHEMA_NAMES)
      expect(files[name]).toEqual(catalogJsonSchema(name));
  });
  test("new unsupported catalog keys and gameplay metrics do not silently pass",()=>{
    const invalidWeapon={...weapons[0], stats:{...weapons[0].stats, accidentalStat:99}};
    expect(CATALOG_SCHEMAS.weapons.safeParse([invalidWeapon]).success).toBe(false);
    const invalidChallenge={...challenges[0],metric:"untracked_damage_metric"};
    expect(CATALOG_SCHEMAS["weapon-challenges"].safeParse([invalidChallenge]).success).toBe(false);
    const errors=validateGameContent({weaponChallenges:[invalidChallenge]});
    expect(errors.some(e=>e.includes("weapon challenges [0.metric]"))).toBe(true);
  });
  test("perk and tactical metadata follows a validated contract",()=>{
    expect(PERKS_SCHEMA.safeParse(PERKS).success).toBe(true);
    expect(EQUIPMENT_SCHEMA.safeParse(EQUIPMENT).success).toBe(true);
    expect(new Set(PERKS.map(p=>p.id)).size).toBe(PERKS.length);
    expect(new Set(EQUIPMENT.map(e=>e.id)).size).toBe(EQUIPMENT.length);
  });
});
