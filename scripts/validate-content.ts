import { validateGameContent } from "../src/lib/content-validation";
import generatedSchema from "../src/data/schemas/map-theme.schema.json";
import {mapThemeJsonSchema} from "../src/lib/map-theme-json-schema";
import {PUBLISHED_CATALOG_SCHEMA_NAMES} from "../src/lib/catalog-contract";
import {catalogJsonSchema} from "../src/lib/catalog-json-schema";
import weaponsSchema from "../src/data/schemas/weapons.schema.json";
import attachmentsSchema from "../src/data/schemas/attachments.schema.json";
import weaponSkinsSchema from "../src/data/schemas/weapon-skins.schema.json";
import operatorSkinsSchema from "../src/data/schemas/operator-skins.schema.json";
import weaponChallengesSchema from "../src/data/schemas/weapon-challenges.schema.json";

const errors = validateGameContent();
const catalogs={weapons:weaponsSchema,attachments:attachmentsSchema,
  "weapon-skins":weaponSkinsSchema,"operator-skins":operatorSkinsSchema,
  "weapon-challenges":weaponChallengesSchema};
for(const name of PUBLISHED_CATALOG_SCHEMA_NAMES){
  if(JSON.stringify(catalogs[name])!==JSON.stringify(catalogJsonSchema(name))){
    errors.push(name+" external JSON Schema has drifted; regenerate with bun run schema:catalogs");
    console.error("BEGIN_GENERATED_CATALOG_SCHEMA:"+name);
    console.error(JSON.stringify(catalogJsonSchema(name),null,2));
    console.error("END_GENERATED_CATALOG_SCHEMA:"+name);
  }
}
if(JSON.stringify(generatedSchema)!==JSON.stringify(mapThemeJsonSchema())){
  errors.push("Map theme JSON Schema is out of sync with its canonical Zod contract. Run bun run schema:map-theme.");
  // When drift is detected CI prints the generated artifact so it can be
  // copied to a commit even when only the remote runner has Bun installed.
  console.error("BEGIN_GENERATED_MAP_THEME_SCHEMA");
  console.error(JSON.stringify(mapThemeJsonSchema(),null,2));
  console.error("END_GENERATED_MAP_THEME_SCHEMA");
}
if (errors.length) {
  console.error("Content validation failed (" + errors.length + " issues):");
  for (const issue of errors) console.error(" - " + issue);
  process.exitCode = 1;
} else {
  console.log("Content validated: JSON catalogs and map blueprints have valid values, IDs and references.");
}
