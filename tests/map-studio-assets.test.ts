import {describe,expect,test} from "bun:test";
import {STUDIO_ASSETS,assetBounds,instantiateStudioAsset,saveStudioAsset,importStudioAssets} from "../src/lib/map-studio-assets";
import {studioConnectionIssues} from "../src/lib/map-studio-diagnostics";
import {propColliders} from "../src/lib/map-visuals";

describe("editable asset recipes",()=>{
  test("red and blue containers share geometry and collision while keeping independent colors",()=>{
    const red=STUDIO_ASSETS.find(a=>a.id==="container_red")!,blue=STUDIO_ASSETS.find(a=>a.id==="container_blue")!;
    let n=0;const a=instantiateStudioAsset(red,50,50,()=>"a"+(++n)),b=instantiateStudioAsset(blue,50,50,()=>"b"+(++n));
    expect(a.props[0].kind).toBe("container");expect(b.props[0].kind).toBe("container");
    expect(a.props[0].color).not.toBe(b.props[0].color);
    expect(propColliders(a.props,[])).toEqual(propColliders(b.props,[]));
    a.props[0].color="#123456";a.props[0].w=16;
    expect(red.props[0].color).toBe("#a8483c");expect(b.props[0].w).toBe(12);
  });
  test("asset preview bounds include the full stair assembly",()=>{
    const asset=STUDIO_ASSETS.find(a=>a.id==="structure_rooftop")!,bounds=assetBounds(asset);
    expect(bounds.w).toBeGreaterThan(22);expect(bounds.d).toBe(24);
  });
  test("save, export, import and stamp a rooftop recipe preserves local links and fresh IDs",()=>{
    let n=0;const makeId=()=>"id_"+(++n);
    const placed=instantiateStudioAsset(STUDIO_ASSETS.find(a=>a.id==="structure_rooftop")!,80,90,makeId);
    const custom=saveStudioAsset("My roof",placed.features,[],"my_roof");
    const loaded=importStudioAssets(JSON.parse(JSON.stringify({version:1,assets:[custom]})))[0];
    const first=instantiateStudioAsset(loaded,-40,60,makeId),second=instantiateStudioAsset(loaded,40,-60,makeId);
    expect(first.features[1].attachment?.platformId).toBe(first.features[0].id);
    expect(first.features[0].id).not.toBe(second.features[0].id);
    expect(first.features[0].assemblyId).not.toBe(second.features[0].assemblyId);
    expect(studioConnectionIssues(first.features)).toEqual([]);expect(studioConnectionIssues(second.features)).toEqual([]);
  });
  test("unsupported assets, invalid geometry and broken links fail before entering the palette",()=>{
    const valid=saveStudioAsset("Container",[],STUDIO_ASSETS.find(a=>a.id==="container")!.props,"custom_container");
    expect(()=>importStudioAssets({version:1,assets:[{...valid,props:[{...valid.props[0],color:"url(https://example.org)"}]}]})).toThrow();
    expect(()=>importStudioAssets({version:1,assets:[{...valid,props:[{...valid.props[0],w:NaN}]}]})).toThrow();
    expect(()=>importStudioAssets({version:1,assets:[{...valid,props:[{...valid.props[0],kind:"remote_script"}]}]})).toThrow();
    const rooftop=structuredClone(STUDIO_ASSETS.find(a=>a.id==="structure_rooftop")!);
    rooftop.id="custom_rooftop";rooftop.features[1].attachment!.platformId="missing";
    expect(()=>importStudioAssets({version:1,assets:[rooftop]})).toThrow();
  });
});
