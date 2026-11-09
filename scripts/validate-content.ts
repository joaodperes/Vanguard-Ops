import { validateGameContent } from "../src/lib/content-validation";
import generatedSchema from "../src/data/schemas/map-theme.schema.json";
import {mapThemeJsonSchema} from "../src/lib/map-theme-json-schema";

const errors = validateGameContent();
if(JSON.stringify(generatedSchema)!==JSON.stringify(mapThemeJsonSchema()))
  errors.push("Map theme JSON Schema is out of sync with its canonical Zod contract. Run bun run schema:map-theme.");
if (errors.length) {
  console.error("Content validation failed (" + errors.length + " issues):");
  for (const issue of errors) console.error(" - " + issue);
  process.exitCode = 1;
} else {
  console.log("Content validated: JSON catalogs and map blueprints have valid values, IDs and references.");
}
