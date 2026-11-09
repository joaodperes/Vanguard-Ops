/** Build-time JSON Schema for editors/tooling; generated from the runtime Zod contract. */
import {z} from "zod";
import {MAP_THEME_SCHEMA} from "./map-theme-contract";

export function mapThemeJsonSchema(){
  return {...z.toJSONSchema(MAP_THEME_SCHEMA,{target:"draft-2020-12"}),title:"Vanguard Ops biome theme"};
}
