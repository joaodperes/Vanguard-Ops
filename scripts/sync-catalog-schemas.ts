import {readFileSync,writeFileSync} from "node:fs";
import {PUBLISHED_CATALOG_SCHEMA_NAMES} from "../src/lib/catalog-contract";
import {catalogJsonSchema} from "../src/lib/catalog-json-schema";

const check=process.argv.includes("--check");
let invalid=false;
for(const name of PUBLISHED_CATALOG_SCHEMA_NAMES){
  const path=new URL("../src/data/schemas/"+name+".schema.json",import.meta.url);
  const generated=JSON.stringify(catalogJsonSchema(name),null,2)+"\n";
  if(check){
    if(readFileSync(path,"utf8")!==generated){
      invalid=true;
      console.error("Stale "+name+" schema; run bun run schema:catalogs");
    }
  }else{
    writeFileSync(path,generated);
    console.log("Generated "+name+".schema.json");
  }
}
if(invalid)process.exitCode=1;
else if(check)console.log("All published content catalog schemas match their canonical Zod contracts.");
