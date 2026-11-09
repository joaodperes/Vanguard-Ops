import {describe,expect,test} from "bun:test";
import jsonSchema from "../src/data/schemas/map-theme.schema.json";
import {MAP_PROP_KINDS, MAP_PROP_SCHEMA, MAP_THEME_SCHEMA, validateMapTheme} from "../src/lib/map-theme-contract";
import {mapThemeJsonSchema} from "../src/lib/map-theme-json-schema";
import {MAP_DOCUMENTS,validateMapDocument} from "../src/lib/map-documents";
import {importMapDocuments} from "../src/lib/map-document-io";

describe("single-source map-theme validation",()=>{
  test("the committed JSON Schema is generated from the same Zod contract as imports",()=>{
    expect(jsonSchema).toEqual(mapThemeJsonSchema());
    expect((jsonSchema.properties.props.items.properties.kind.enum)).toEqual([...MAP_PROP_KINDS]);
  });
  test("every published theme passes the same validation as imported themes",()=>{
    for(const doc of Object.values(MAP_DOCUMENTS)){
      expect(MAP_THEME_SCHEMA.safeParse(doc.theme).success,doc.id).toBe(true);
      expect(validateMapTheme(doc.theme),doc.id).toEqual([]);
      expect(validateMapDocument(doc),doc.id).toEqual([]);
    }
  });
  test("unknown prop types, metadata, textures and dimensions are rejected before import",()=>{
    const original=MAP_DOCUMENTS.emberhold;
    for(const mutate of [
      (theme:any)=>{theme.props[0].kind="unsupported_tomb";},
      (theme:any)=>{theme.props[0].w=-5;},
      (theme:any)=>{theme.props[0].turns=5;},
      (theme:any)=>{theme.props[0].use="invalid_shop";},
      (theme:any)=>{theme.props[0].roofAccess="yes";},
      (theme:any)=>{theme.props[0].unexpected=true;},
      (theme:any)=>{theme.surfaces.floor.pattern="unknown";},
      (theme:any)=>{theme.surfaces.wall.textureId="https://example.com/unsafe.png";},
      (theme:any)=>{theme.palette.floor="not-a-color";},
    ]){
      const doc=structuredClone(original);
      mutate(doc.theme);
      expect(validateMapTheme(doc.theme).length).toBeGreaterThan(0);
      expect(validateMapDocument(doc).length).toBeGreaterThan(0);
      expect(()=>importMapDocuments(doc,{},doc.id)).toThrow(/Invalid map/);
    }
    expect(MAP_PROP_SCHEMA.safeParse({kind:"sarcophagus",x:3,z:-2,turns:1}).success).toBe(true);
  });
});
