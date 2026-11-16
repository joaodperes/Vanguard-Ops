/** External JSON schemas are GENERATED, never maintained independently.
 * Only content catalogs with published JSON Schema files are emitted.
 */
import {z} from "zod";
import {CATALOG_SCHEMAS,type PublishedCatalogSchemaName} from "./catalog-contract";
export function catalogJsonSchema(name:PublishedCatalogSchemaName){
  return {...z.toJSONSchema(CATALOG_SCHEMAS[name],{target:"draft-2020-12"}),
    title:"Vanguard Ops "+name+" catalog"};
}
