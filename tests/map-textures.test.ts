import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {MAP_TEXTURES,mapTexture} from "../src/lib/map-textures";
import {MAP_DOCUMENTS,validateMapDocument} from "../src/lib/map-documents";
import {importMapDocuments} from "../src/lib/map-document-io";
test("every bundled texture is a local PNG with a retained license",()=>{
  expect(new Set(MAP_TEXTURES.map(t=>t.id)).size).toBe(MAP_TEXTURES.length);
  for(const t of MAP_TEXTURES){
    expect(t.path.startsWith('/textures/kenney/')).toBe(true);
    const b=readFileSync('public'+t.path);expect(b.subarray(1,4).toString()).toBe('PNG');
    expect(t.license).toBe('CC0-1.0');
  }
  expect(readFileSync('public/textures/kenney/LICENSE.txt','utf8')).toContain('Creative Commons Zero');
});
test("surface texture IDs roundtrip and arbitrary URLs fail validation",()=>{
  const doc=structuredClone(MAP_DOCUMENTS.compound);
  doc.theme.surfaces!.wall.textureId=MAP_TEXTURES[0].id;
  expect(importMapDocuments(JSON.parse(JSON.stringify(doc)),MAP_DOCUMENTS,'compound').documents.compound.theme.surfaces!.wall.textureId).toBe(MAP_TEXTURES[0].id);
  doc.theme.surfaces!.wall.textureId='https://example.org/untrusted.png';
  expect(validateMapDocument(doc)).toContain('Unknown bundled texture ID');
  expect(mapTexture('../secret')).toBeUndefined();
});
