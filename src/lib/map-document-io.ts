import type { MapDocument } from "./map-documents";
import { validateMapDocument } from "./map-documents";
import { validateBlueprint } from "./map-blueprints";
import type { MapBlueprint, MapBlueprintFile } from "./map-blueprints";
import type { MapVisualTheme } from "./map-visuals";

export type MapDocumentLibrary = Record<string, MapDocument>;
export interface MapImportResult { documents: MapDocumentLibrary; selectedId: string; migrated: boolean }
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const validId=(id:string)=>/^[a-z][a-z0-9_:-]*$/.test(id);

/** Import a single v2 JSON, a v2 library, or the previous split-file/bundle format.
 * Invalid imports never silently replace an entire library. */
export function importMapDocuments(
  input: unknown,
  existing: MapDocumentLibrary,
  activeId: string,
): MapImportResult {
  if (!object(input)) throw Error("Expected a JSON map document or legacy bundle");
  const next=clone(existing);
  let selectedId=activeId,migrated=false;
  const install=(doc:MapDocument)=>{
    const structural=validateMapDocument(doc);
    if(structural.length)throw Error("Invalid map: "+structural.slice(0,4).join("; "));
    const failures=validateBlueprint(doc.blueprint);
    if(failures.length)throw Error(doc.id+": "+failures.slice(0,4).join("; "));
    next[doc.id]=clone(doc);selectedId=doc.id;
  };
  if(input.version===2 && typeof input.id==="string") {
    install(input as unknown as MapDocument);
  } else if(input.format==="vanguard-map-studio-v2" && object(input.maps)){
    for(const doc of Object.values(input.maps)) install(doc as MapDocument);
  } else {
    migrated=true;
    const bundle=input.format==="vanguard-map-studio-bundle";
    const blueprints=(bundle?input.doc:input) as MapBlueprintFile;
    const themes=(bundle?input.themes:{}) as Record<string,MapVisualTheme>;
    if(blueprints.version===1 && object(blueprints.maps)){
      const ids=Object.keys(blueprints.maps);
      if(!ids.length)throw Error("Legacy file contains no maps");
      for(const id of ids){
        if(!validId(id))throw Error("Invalid legacy map ID "+id);
        const template=blueprints.maps[id]?.templateMapId ?? id;
        const theme=themes?.[id]??existing[id]?.theme??existing[template]?.theme;
        if(!theme)throw Error("Theme missing for "+id+"; import a full bundle instead");
        install({version:2,id,blueprint:blueprints.maps[id] as MapBlueprint,theme});
      }
    } else if(object(input.palette) && Array.isArray(input.props)) {
      const original=existing[activeId];
      if(!original)throw Error("No selected map to receive the theme");
      install({...original,theme:input as unknown as MapVisualTheme});
    } else throw Error("Unrecognized map format");
  }
  return {documents:next,selectedId,migrated};
}

/** A complete library snapshot is only a backup; publish individual map JSON files. */
export function exportMapLibrary(maps:MapDocumentLibrary){
  return {format:"vanguard-map-studio-v2",version:2,maps:clone(maps)};
}
