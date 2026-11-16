import {describe,expect,test} from "bun:test";
import {MAP_DOCUMENTS} from "../src/lib/map-documents";
import {importMapDocuments,exportMapLibrary} from "../src/lib/map-document-io";
import legacy from "../src/data/map-blueprints.json";
import compoundTheme from "../src/data/map-themes/compound.json";

describe("map document import/export",()=>{
  const originals=structuredClone(MAP_DOCUMENTS);
  test("roundtrips one map without touching its neighbors",()=>{
    const changed=structuredClone(originals.compound);
    changed.blueprint.name="TEST DRAFT";
    const result=importMapDocuments(changed,originals,"bunker");
    expect(result.documents.compound.blueprint.name).toBe("TEST DRAFT");
    expect(result.documents.bunker).toEqual(originals.bunker);
    expect(originals.compound.blueprint.name).not.toBe("TEST DRAFT");
    expect(importMapDocuments(exportMapLibrary(result.documents),originals,"compound").documents)
      .toEqual(result.documents);
  });
  test("imports earlier blueprint-only and split theme drafts",()=>{
    const plan={version:1,units:legacy.units,maps:{compound:legacy.maps.compound}};
    expect(importMapDocuments(plan,originals,"compound").documents.compound.blueprint)
      .toMatchObject(plan.maps.compound);
    const theme=importMapDocuments(compoundTheme,originals,"compound");
    expect(theme.documents.compound.theme.palette.floor).toBe(compoundTheme.palette.floor);
    expect(theme.migrated).toBe(true);
  });
  test("rejects corrupt and traversal IDs",()=>{
    expect(()=>importMapDocuments({version:2,id:"../bad"},originals,"compound")).toThrow();
    expect(()=>importMapDocuments({version:2,id:"compound",blueprint:{}},originals,"compound")).toThrow();
  });
});
