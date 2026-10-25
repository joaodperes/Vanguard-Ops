import { validateGameContent } from "../src/lib/content-validation";

const errors = validateGameContent();
if (errors.length) {
  console.error("Content validation failed (" + errors.length + " issues):");
  for (const issue of errors) console.error(" - " + issue);
  process.exitCode = 1;
} else {
  console.log("Content validated: JSON catalogs and map blueprints have valid values, IDs and references.");
}
