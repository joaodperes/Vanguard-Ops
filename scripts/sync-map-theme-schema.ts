/** Regenerate the distributable map-theme JSON Schema from the canonical Zod contract.
 * CI's content:validate checks that this generated file is committed and current.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {mapThemeJsonSchema} from "../src/lib/map-theme-json-schema";

const path = new URL("../src/data/schemas/map-theme.schema.json",import.meta.url);
const generated = JSON.stringify(mapThemeJsonSchema(),null,2)+"\n";
if(process.argv.includes("--check")){
  if(readFileSync(path,"utf8")!==generated){
    console.error("map-theme.schema.json is stale. Regenerate with: bun run schema:map-theme");
    console.log("BEGIN_GENERATED_MAP_THEME_SCHEMA");
    console.log(generated);
    console.log("END_GENERATED_MAP_THEME_SCHEMA");
    process.exitCode=1;
  }else console.log("Map theme JSON Schema matches the canonical runtime contract.");
}else{
  writeFileSync(path,generated);
  console.log("Generated src/data/schemas/map-theme.schema.json");
}
