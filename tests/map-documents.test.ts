import {describe,expect,test} from "bun:test";
import { MAP_DOCUMENTS, validateMapDocument } from "../src/lib/map-documents";
import { MAP_BLUEPRINTS } from "../src/lib/map-blueprints";
import { MAP_VISUAL_THEMES, visualThemeForMap } from "../src/lib/map-visuals";
import { getMap, compileMapStudioDraft } from "../src/lib/game-protocol";

describe("versioned single-file maps",()=>{
  test("the source is shared across gameplay layouts and materials",()=>{
    expect(Object.keys(MAP_DOCUMENTS).sort()).toEqual(Object.keys(MAP_BLUEPRINTS.maps).sort());
    for(const [id,doc] of Object.entries(MAP_DOCUMENTS)){
      expect(doc.id).toBe(id);
      expect(validateMapDocument(doc)).toEqual([]);
      expect(MAP_BLUEPRINTS.maps[id]).toBe(doc.blueprint);
      expect(MAP_VISUAL_THEMES[id]).toBe(doc.theme);
      const preview=compileMapStudioDraft(id,doc.blueprint,visualThemeForMap(id));
      const published=getMap(id);
      expect(preview.cover).toEqual(published.cover);
      expect(preview.spawns).toEqual(published.spawns);
    }
  });
  test("rejects invalid import structure",()=>{
    const doc=structuredClone(MAP_DOCUMENTS.compound);
    doc.id="../wrong";doc.theme.palette.floor="red";
    doc.blueprint.spawns.red=undefined as never;
    expect(validateMapDocument(doc).length).toBeGreaterThanOrEqual(3);
    expect(validateMapDocument(null).length).toBeGreaterThan(0);
  });
});
