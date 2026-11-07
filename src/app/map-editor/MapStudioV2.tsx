"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import MapStudio3D,{type StudioSelection,type StudioMode,type StudioTransform} from "./MapStudio3D";
import {MAP_DOCUMENTS,validateMapDocument,type MapDocument} from "@/lib/map-documents";
import {BALLISTIC_MATERIALS} from "@/lib/cover-penetration";
import {importMapDocuments,exportMapLibrary,type MapDocumentLibrary} from "@/lib/map-document-io";
import {validateBlueprint,overrideBox,nearestPlatformSnap,snapCoverToPlatform,
  featureFootprint,reconcileFeatureAttachments,resolveStairAttachments,attachStairsToPlatform,MAP_HAZARD_TYPES,
  type PlatformEdge,type MapRegion,type MapFeature,type MapHazard} from "@/lib/map-blueprints";
import {constructionDimension,wallBetween,transformFeatureAssembly,copyFeatureAssembly,joinFeatureFaces} from "@/lib/map-studio-construction";
import {STUDIO_ASSETS,assetBounds,instantiateStudioAsset,saveStudioAsset,importStudioAssets,type StudioAsset} from "@/lib/map-studio-assets";
import {elevationSpan,yAtElevationFace} from "@/lib/map-studio-elevation";
import {MAP_TEXTURES,mapTexture} from "@/lib/map-textures";
import {mapProps,visualThemeForMap,type MapProp,type MapVisualTheme,type PropKind,type SurfacePattern} from "@/lib/map-visuals";
import {getMap} from "@/lib/game-protocol";
import {studioMapIssues,studioRegionLinks,studioBuildingPlacementIssues} from "@/lib/map-studio-diagnostics";
import {STUDIO_BUILDING_PRESETS,STUDIO_STRUCTURE_PRESETS,studioBuildingPrefab,studioStructurePrefab,
  type StudioBuildingPresetId,type StudioStructurePresetId} from "@/lib/map-studio-prefabs";
import {legacyCoverToFeature,legacyFlightToFeature,legacyEnvironmentToHazard,toggleOriginalIndex} from "@/lib/map-object-actions";
import {stairFlightBounds,transformStairFlight,maxLegacyFlightRise} from "@/lib/legacy-stair-flights";
import {preserveSavedGeometryOnMove} from "@/lib/map-studio-transform";
import {Undo2,Redo2,Download,Upload,Play,Copy,Trash2,RotateCcw,Plus} from "lucide-react";
import {snapStudioFootprint,snapStudioElevation,STUDIO_STOREY_HEIGHT,
  type StudioSnapMode,type StudioSnapTarget,type StudioSnapResult} from "@/lib/map-studio-snapping";

import {OBJECTIVE_KINDS,MODE_OBJECTIVES,DEFAULT_COMBAT_MODES,type MapObjective} from "@/lib/map-objectives";
import type {GameMode} from "@/lib/game-protocol";

type Team="ffa"|"red"|"blue";
type Tool="select"|"region"|"circle"|"triangle"|"wall"|"asset"|"cover"|"platform"|"stairs"|"hazard"|"prop"|"kit"|"ffa"|"red"|"blue"|"objective";
type Point={x:number;z:number};
type PaletteStamp={tool:"prop"|"kit"|"asset";buildingKit?:StudioBuildingPresetId;structureKit?:StudioStructurePresetId;assetId?:string};
const PALETTE_MIME="application/x-vanguard-map-prefab";
const teams:Team[]=["ffa","red","blue"];
const tools:{heading:string;items:[Tool,string][]}[]=[
  {heading:"Floor and districts",items:[["region","Rectangle"],["circle","Ellipse"],["triangle","Triangle"]]},
  {heading:"Combat geometry",items:[["wall","Draw wall"],["cover","Cover"],["platform","Platform"],["stairs","Stairs"],["kit","Structure kit"]]},
  {heading:"Objectives",items:[["objective","Objective marker"]]},
  {heading:"Objects",items:[["prop","Prop / building"],["hazard","Hazard"]]},
  {heading:"Player starts",items:[["ffa","FFA"],["red","Red team"],["blue","Blue team"]]},
];
const kinds:PropKind[]=["tree","bush","rock","ruin","temple","shop","lamp","container","crane","terminal","sign","antenna","building","boat","dock","garden","bench","bandstand",
"furnace","conveyor","hydraulic_press","generator","storage_rack","vent_stack",
"industrial_pipe","steel_coil","cargo_pallet"];
const paletteKeys=["floor","wall","cover","accent","platform","stair","sky","fog","grid"] as const;
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const control="w-full rounded border border-white/15 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:border-amber-400 outline-none";
const btn="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-30";
let counter=0;
const unique=(kind:string)=>kind+"_"+Date.now().toString(36)+"_"+(++counter).toString(36);
function saveFile(name:string,value:unknown){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function NumberInput({label,value,save}:{label:string;value:number;save:(n:number)=>void}){
  return <label className="block min-w-0"><span className="text-[10px] uppercase text-zinc-400">{label}</span>
    <input key={label+":"+value} className={control} type="number" step=".1" defaultValue={value}
      onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}
      onBlur={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n!==value)save(n);}}/></label>;
}
function TextInput({label,value,save}:{label:string;value:string;save:(n:string)=>void}){
  return <label className="block"><span className="text-[10px] uppercase text-zinc-400">{label}</span>
    <input key={label+":"+value} className={control} defaultValue={value}
      onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}
      onBlur={e=>{if(e.target.value!==value)save(e.target.value);}}/></label>;
}
function Picker({label,value,options,save}:{label:string;value:string;options:readonly string[];save:(n:string)=>void}){
  return <label className="block"><span className="text-[10px] uppercase text-zinc-400">{label}</span>
    <select className={control} value={value} onChange={e=>save(e.target.value)}>
      {options.map(n=><option key={n} value={n}>{n.replaceAll("_"," ")}</option>)}
    </select></label>;
}
function caption(s:StudioSelection){return s.type+(s.team?" "+s.team:"")+" #"+(s.index+1);}
function AssetThumb({asset}:{asset:StudioAsset}){
  const color=asset.props[0]?.color??(asset.category==="Buildings"?"#b99577":"#69a99a");
  return <svg viewBox="0 0 80 45" className="mb-1 h-10 w-full rounded bg-black/25" aria-hidden="true">
    <path d="M15 30 43 40 68 26 40 17Z" fill="#17292c"/>
    <path d="M20 27V12L44 20V36Z" fill={color}/><path d="M44 20 63 10V26L44 36Z" fill={color} opacity=".65"/>
    <path d="M20 12 39 3 63 10 44 20Z" fill={color} opacity=".9"/>
    {asset.features.some(f=>f.kind==="stairs")&&<path d="M10 34H17V29H24V24H31V19H38" fill="none" stroke="#e7e1be" strokeWidth="3"/>}
  </svg>;
}

export default function MapEditorClient(){
  const [library,setLibrary]=useState<MapDocumentLibrary>(()=>clone(MAP_DOCUMENTS));
  const [id,setId]=useState("compound"),[newId,setNewId]=useState("");
  const [selection,setSelection]=useState<StudioSelection|null>(null);
  const [objectiveKind,setObjectiveKind]=useState<MapObjective["kind"]>("flag");
  const [objectiveTeam,setObjectiveTeam]=useState<"red"|"blue">("red");
  const [playtestMode,setPlaytestMode]=useState<GameMode>("ffa");
  const [tool,setTool]=useState<Tool>("select");
  const [view,setView]=useState<"3d"|"2d">("3d"),[mode,setMode]=useState<StudioMode>("select");
  const [grid,setGrid]=useState(1),[zoom,setZoom]=useState(1);
  const [snapMode,setSnapMode]=useState<StudioSnapMode>("join"),[editAssembly,setEditAssembly]=useState(true);
  const [guide,setGuide]=useState(true),[assetSearch,setAssetSearch]=useState("");
  const [customAssets,setCustomAssets]=useState<StudioAsset[]>([]),[assetId,setAssetId]=useState("container");
  const [assetName,setAssetName]=useState(""),assetFileRef=useRef<HTMLInputElement>(null);
  const assets=useMemo(()=>[...STUDIO_ASSETS,...customAssets],[customAssets]);
  const [smartSnap,setSmartSnap]=useState(true),[surfaceSnap,setSurfaceSnap]=useState(true);
  const [paletteDragging,setPaletteDragging]=useState<PaletteStamp|null>(null);
  const [moveAxis,setMoveAxis]=useState<"x"|"y"|"z">("x");
  const [stamp,setStamp]=useState(false),[showCollision,setShowCollision]=useState(false);
  const [wallStart,setWallStart]=useState<Point|null>(null);
  const [showIssues,setShowIssues]=useState(true),[showRoutes,setShowRoutes]=useState(false);
  const [propKind,setPropKind]=useState<PropKind>("building");
  const [buildingKit,setBuildingKit]=useState<StudioBuildingPresetId>("house");
  const [structureKit,setStructureKit]=useState<StudioStructurePresetId>("room");
  const [hazardKind,setHazardKind]=useState<MapHazard["type"]>("fire");
  const [bots,setBots]=useState(3);
  const [message,setMessage]=useState("Browser drafts autosave. Publish by exporting a single map JSON.");
  const undoRef=useRef<MapDocumentLibrary[]>([]),redoRef=useRef<MapDocumentLibrary[]>([]);
  const [,setRev]=useState(0);
  const fileRef=useRef<HTMLInputElement>(null),svgRef=useRef<SVGSVGElement>(null);
  const gesture=useRef<{from:Point;kind:"place"|"move";sel?:StudioSelection}|null>(null);
  const [ghost,setGhost]=useState<{from:Point;to:Point}|null>(null);
  const current=library[id]??library.compound,plan=current.blueprint;
  const afterlight=(id==="terminal"||id==="arena_neon")&&!!library.arena_neon;
  const theme=useMemo<MapVisualTheme>(()=>afterlight?
    {...current.theme,props:library.arena_neon.theme.props}:current.theme,
    [current.theme,library.arena_neon?.theme.props,afterlight]);
  const published=getMap(id),base=published.id===id?published:getMap(plan.templateMapId);
  const legacySpawns=useMemo(()=>afterlight?[
    ...base.spawns.ffa.slice(-6),...base.spawns.red.slice(-3),...base.spawns.blue.slice(-3)
  ]:[],[base,afterlight]);
  const allProps=useMemo(()=>mapProps(id,plan,theme,legacySpawns),[id,plan,theme,legacySpawns]);
  const generated=useMemo(()=>allProps.filter(p=>p.kind==="building"&&!!p.lotId&&!theme.props.includes(p)),[allProps,theme.props]);
  // Include inherited engine blocks: snapped placements must match the real map,
  // not just newly authored geometry. Override positions preserve stable indices.
  const snapTargets=useMemo<StudioSnapTarget[]>(()=>{
    const features:StudioSnapTarget[]=resolveStairAttachments(plan.features).map((f,i)=>({
      key:"feature:"+i,kind:f.kind==="platform"?"platform":f.kind==="stairs"?"stairs":"cover",
      ...featureFootprint(f),
    }));
    const authored:StudioSnapTarget[]=theme.props.filter(p=>p.kind==="building").map(p=>{
      const i=theme.props.indexOf(p);
      return {key:"prop:"+i,kind:"building" as const,x:p.x,z:p.z,w:p.w??20,d:p.d??20,y:p.y??0,h:p.h??5};
    });
    const inherited:StudioSnapTarget[]=generated.map(p=>({
      key:"city:"+p.lotId,kind:"building",x:p.x,z:p.z,w:p.w??20,d:p.d??20,y:p.y??0,h:p.h??5,
    }));
    const originals=base.editorLegacyCoverSource??base.cover;
    const hidden=new Set(plan.legacyCoverDisabled??[]);
    const legacy:StudioSnapTarget[]=originals.flatMap((b,i)=>{
      if(hidden.has(i))return [];
      const box=overrideBox(b,plan.legacyCoverOverrides?.[String(i)]);
      if(box.size[0]<=0||box.size[2]<=0)return [];
      return [{key:"legacy:"+i,kind:box.kind==="platform"?"platform" as const:"cover" as const,
        x:box.pos[0],z:box.pos[2],w:box.size[0]*2,d:box.size[2]*2,
        y:box.pos[1]-box.size[1],h:box.size[1]*2}];
    });
    return [...features,...authored,...inherited,...legacy];
  },[plan,theme.props,generated,base]);
  const legacyBoxes=useMemo(()=>(base.editorLegacyCoverSource??base.cover).flatMap((b,i)=>
    plan.legacyCoverDisabled?.includes(i)?[]:[overrideBox(b,plan.legacyCoverOverrides?.[String(i)])]),[base,plan]);
  const issues=useMemo(()=>studioMapIssues(plan,theme.props,legacySpawns,legacyBoxes),[plan,theme.props,legacySpawns,legacyBoxes]);
  const routes=useMemo(()=>studioRegionLinks(plan),[plan]);
  const faults=useMemo(()=>[...validateMapDocument(current),...validateBlueprint(plan)],[current,plan]);
  const dirty=JSON.stringify(current)!==JSON.stringify(MAP_DOCUMENTS[id]??null);

  useEffect(()=>{
    try{
      setGuide(localStorage.getItem("vanguard-studio-guide")!=="hidden");
      const savedAssets=localStorage.getItem("vanguard-studio-assets-v1");
      if(savedAssets)setCustomAssets(importStudioAssets(JSON.parse(savedAssets)));
      const newer=localStorage.getItem("vanguard-map-studio-v2");
      if(newer){
        const saved=JSON.parse(newer) as Record<string,MapDocument>;
        const accepted=Object.entries(saved).filter(([key,value])=>
          key===value?.id&&validateMapDocument(value).length===0);
        if(accepted.length){setLibrary(old=>({...old,...Object.fromEntries(accepted)}));setMessage("Restored previous map drafts.");}
      }else{
        const older=localStorage.getItem("vanguard-map-studio-v1");
        if(older){
          const legacyThemes=JSON.parse(localStorage.getItem("vanguard-map-studio-themes-v1")??"{}");
          const themes={...Object.fromEntries(Object.entries(MAP_DOCUMENTS).map(([key,doc])=>[key,doc.theme])),...legacyThemes};
          const migrated=importMapDocuments({format:"vanguard-map-studio-bundle",doc:JSON.parse(older),themes},clone(MAP_DOCUMENTS),"compound");
          setLibrary(migrated.documents);setMessage("Migrated previous editor drafts into unified JSON.");
        }
      }
    }catch(e){setMessage("Could not recover a saved draft: "+String(e));}
  },[]);
  useEffect(()=>{try{localStorage.setItem("vanguard-studio-assets-v1",JSON.stringify({version:1,assets:customAssets}));}catch{}},[customAssets]);
  useEffect(()=>{try{localStorage.setItem("vanguard-map-studio-v2",JSON.stringify(library));}catch{}},[library]);
  const commit=(next:MapDocumentLibrary,note?:string)=>{
    undoRef.current=[...undoRef.current.slice(-49),library];redoRef.current=[];
    setLibrary(next);setRev(n=>n+1);if(note)setMessage(note);
  };
  const edit=(action:(d:MapDocumentLibrary)=>void,note?:string)=>{
    const next=clone(library);action(next);
    for(const key of Object.keys(next))next[key].blueprint.features=reconcileFeatureAttachments(next[key].blueprint.features,library[key]?.blueprint.features);
    if(afterlight&&next.arena_neon&&next.terminal){
      const other=id==="terminal"?"arena_neon":"terminal";
      const b=next[id].blueprint;
      // Preserve the editions' deliberately different footprints and spawn sets.
      for(const key of ["features","hazards","legacyCoverOverrides","legacyCoverDisabled","legacyEnvironmentOverrides","legacyEnvironmentDisabled","cityBuildingDisabled"] as const)
        if(JSON.stringify(b[key])!==JSON.stringify(library[id].blueprint[key]))Object.assign(next[other].blueprint,{[key]:b[key]===undefined?undefined:clone(b[key])});
      next.terminal.theme.props=clone(next.arena_neon.theme.props);
    }
    commit(next,note);
  };
  const editPlan=(action:(p:MapDocument["blueprint"])=>void,note?:string)=>edit(d=>action(d[id].blueprint),note);
  const editTheme=(action:(t:MapVisualTheme)=>void)=>edit(d=>action(d[id].theme));
  const editProps=(action:(p:MapProp[])=>void)=>edit(d=>action(d[afterlight?"arena_neon":id].theme.props));
  const undo=()=>{const old=undoRef.current.pop();if(old){redoRef.current.push(library);setLibrary(old);setSelection(null);setRev(n=>n+1);}};
  const redo=()=>{const next=redoRef.current.pop();if(next){undoRef.current.push(library);setLibrary(next);setSelection(null);setRev(n=>n+1);}};
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=="z")return;
      const target=e.target as HTMLElement|null;
      if(target&&(target.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(target.tagName)))return;
      e.preventDefault();if(e.shiftKey)redo();else undo();
    };
    window.addEventListener("keydown",fn);return ()=>window.removeEventListener("keydown",fn);
  });
  const getStampSize=(kind:Tool,rect?:{w:number;d:number},choice?:PaletteStamp)=>{
    if(rect)return rect;
    if(kind==="asset"){const asset=assets.find(a=>a.id===(choice?.assetId??assetId));if(asset)return assetBounds(asset);}
    if(kind==="prop"){
      const k=choice?.buildingKit??buildingKit;
      if(propKind==="building"||choice?.buildingKit){
        const p=STUDIO_BUILDING_PRESETS.find(p=>p.id===k);
        return {w:p?.w??20,d:p?.d??20};
      }
      return {w:5,d:5};
    }
    if(kind==="kit"){
      const p=STUDIO_STRUCTURE_PRESETS.find(p=>p.id===(choice?.structureKit??structureKit));
      return {w:p?.width??24,d:p?.depth??22};
    }
    return {w:kind==="stairs"?4:kind==="hazard"?6:12,d:kind==="stairs"?10:kind==="hazard"?6:12};
  };
  const resolveAt=(kind:Tool,p:Point,rect?:{w:number;d:number},choice?:PaletteStamp,
    bypass=false,ignoreKey?:string,source?:MapFeature):StudioSnapResult & {feature?:MapFeature}=>{
    const size=getStampSize(kind,rect,choice);
    const magnetic=["prop","asset","wall","cover","platform","stairs","kit","hazard"].includes(kind);
    const geometry=kind==="stairs"?{...(source??{id:"preview",kind:"stairs" as const,h:5,axis:"z" as const,sign:1 as const}),...p,w:size.w,d:size.d}:null;
    const footprint=geometry?featureFootprint(geometry):{...p,...size};
    const offsetX=geometry?footprint.x-p.x:kind==="asset"&&"x" in size?Number(size.x):0;
    const offsetZ=geometry?footprint.z-p.z:kind==="asset"&&"z" in size?Number(size.z):0;
    const ignoreKeys=source?.assemblyId&&editAssembly?plan.features.flatMap((f,i)=>f.assemblyId===source.assemblyId?["feature:"+i]:[]):[];
    const result=snapStudioFootprint({...footprint,x:p.x+offsetX,z:p.z+offsetZ},snapTargets,{
      grid,smart:magnetic&&smartSnap&&!bypass,ignoreKey,
      ignoreKeys,mode:kind==="prop"&&propKind==="building"?"clearance":snapMode,
      surface:surfaceSnap&&magnetic&&!bypass&&kind!=="stairs",
    });
    const final={...result,x:result.x-offsetX,z:result.z-offsetZ,w:size.w,d:size.d};
    if(geometry&&!source&&smartSnap&&!bypass){
      const attached=nearestPlatformSnap({...geometry,x:final.x,z:final.z,y:0},plan.features);
      if(attached&&Math.hypot(attached.x-final.x,attached.z-final.z)<=8)
        return {...final,x:attached.x,z:attached.z,y:attached.y,w:attached.w,d:attached.d,feature:attached,hints:[...final.hints,"Landing attached to "+attached.attachment!.platformId]};
    }
    return geometry?{...final,feature:{...geometry,x:final.x,z:final.z,y:final.y??geometry.y??0}}:final;
  };
  const buildingIssue=(x:number,z:number,y=0,kit=buildingKit,excludeIndex=-1,source?:MapProp)=>{
    const house={...(source??studioBuildingPrefab(kit,x,z)),x,z,y};
    const spawns=[...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue,...legacySpawns];
    return studioBuildingPlacementIssues(house,plan,
      [...theme.props.filter((_,i)=>i!==excludeIndex),...generated],
      spawns)[0]?.message??null;
  };
  const assetIssue=(x:number,z:number,y=0,chosenAssetId=assetId)=>{
    const asset=assets.find(a=>a.id===chosenAssetId);if(!asset)return null;
    let previewIndex=0;const pieces=instantiateStudioAsset(asset,x,z,()=>"preview_"+(++previewIndex),y);
    for(const prop of pieces.props){
      const issue=studioBuildingPlacementIssues(prop,plan,[...theme.props,...generated,...pieces.props.filter(p=>p!==prop)],
        [...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue,...legacySpawns])[0];
      if(issue)return issue.message;
    }return null;
  };
  const place=(kind:Tool,p:Point,rect?:{w:number;d:number},choice?:PaletteStamp,bypass=false)=>{
    if(kind==="objective"&&(plan.objectives??[]).some(o=>o.kind===objectiveKind&&(o.kind==="reactor"||"team" in o&&o.team===objectiveTeam))){
      setMessage("That objective role already exists. Select its marker to move or edit it.");return;
    }
    if(kind==="wall"){
      const point={x:grid?Math.round(p.x/grid)*grid:p.x,z:grid?Math.round(p.z/grid)*grid:p.z};
      if(!wallStart){setWallStart(point);setMessage("Wall start set. Click its end point.");return;}
      const feature=wallBetween(wallStart,point,unique("wall"));
      editPlan(bp=>{bp.features.push(feature);},"Drew a wall between its end faces");
      setWallStart(null);if(!stamp)setTool("select");return;
    }
    const placed=resolveAt(kind,p,rect,choice,bypass);
    const {x,z}=placed,y=placed.y??0,w=rect?.w,d=rect?.d;
    const selectedKind=choice?.buildingKit?"building":propKind;
    const chosenKit=choice?.buildingKit??buildingKit;
    if(kind==="prop"&&selectedKind==="building"){
      const problem=buildingIssue(x,z,y,chosenKit);
      if(problem){setMessage("Cannot place building: "+problem);return;}
    }
    const asset=kind==="asset"?assets.find(a=>a.id===(choice?.assetId??assetId)):undefined;
    const assetPieces=asset?instantiateStudioAsset(asset,x,z,()=>unique("asset"),y):undefined;
    for(const prop of assetPieces?.props??[]){
      const problems=studioBuildingPlacementIssues(prop,plan,[...theme.props,...generated,...assetPieces!.props.filter(p=>p!==prop)],
        [...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue,...legacySpawns]);
      if(problems.length){setMessage("Cannot place asset: "+problems[0].message);return;}
    }
    let chosen:StudioSelection|null=null;
    edit(all=>{
      const bp=all[id].blueprint;
      if(["region","circle","triangle"].includes(kind)){
        chosen={type:"region",index:bp.regions.length};
        bp.regions.push({x,z,w:Math.max(8,w??32),d:Math.max(8,d??32),
          shape:kind==="region"?"rect":kind as MapRegion["shape"]});
      }else if(["cover","platform","stairs"].includes(kind)){
        chosen={type:"feature",index:bp.features.length};
        const type=kind as MapFeature["kind"];
        let feature:MapFeature={id:unique("feature"),kind:type,x,z,y,w:constructionDimension(w??(type==="stairs"?4:12),grid),
          d:constructionDimension(d??(type==="stairs"?10:12),grid),h:type==="cover"?3:STUDIO_STOREY_HEIGHT,
          label:"New "+type,...(type==="stairs"?{axis:"z" as const,sign:1 as const}:{})};
        if(type==="stairs"&&placed.feature)feature={...placed.feature,id:feature.id,label:feature.label};
        if(type==="stairs"&&smartSnap&&!bypass){
          const attached=nearestPlatformSnap(feature,bp.features);
          if(attached&&Math.hypot(attached.x-feature.x,attached.z-feature.z)<=8)feature=attached;
        }
        bp.features.push(feature);
        if(feature.attachment){const parent=bp.features.find(p=>p.id===feature.attachment!.platformId);if(parent)parent.autoStairs=false;}
      }else if(kind==="kit"){
        chosen={type:"feature",index:bp.features.length};
        const recipe:StudioAsset={id:"kit",name:"Kit",category:"Construction",features:studioStructurePrefab(choice?.structureKit??structureKit,0,0),props:[]};
        bp.features.push(...instantiateStudioAsset(recipe,x,z,()=>unique("kit"),y).features);
      }else if(kind==="asset"&&assetPieces){
        chosen=assetPieces.features.length?{type:"feature",index:bp.features.length}:
          {type:"prop",index:all[afterlight?"arena_neon":id].theme.props.length};
        bp.features.push(...assetPieces.features);
        all[afterlight?"arena_neon":id].theme.props.push(...assetPieces.props);
      }else if(kind==="objective"){
        bp.objectives??=[];
        chosen={type:"objective",index:bp.objectives.length};
        const common={id:unique(objectiveKind),pos:[x,y,z] as [number,number,number],verticalTolerance:objectiveKind==="capture_zone"?3:2.6};
        bp.objectives.push(objectiveKind==="reactor"?{...common,kind:"reactor",radius:3.5,chargeRadius:38,killsRequired:10}:
          {...common,kind:objectiveKind,team:objectiveTeam,radius:objectiveKind==="flag"?2.4:4.7});
      }else if(kind==="hazard"){
        bp.hazards??=[];chosen={type:"hazard",index:bp.hazards.length};
        const common={id:unique("hazard"),type:hazardKind,x,z,w:w??6,d:d??6};
        bp.hazards.push(hazardKind==="lava" ? {...common,y,h:.1} : {...common,y:y+1,h:2,
          dps:7,damage:25,period:5,activeFor:2,hp:120,launchY:18,toX:x+12,toY:y+1,toZ:z});
      }else if(kind==="prop"){
        const list=all[afterlight?"arena_neon":id].theme.props;
        chosen={type:"prop",index:list.length};
        list.push(selectedKind==="building"?{...studioBuildingPrefab(chosenKit,x,z),y}:
          {kind:selectedKind,x,z,y,w:w??5,d:d??5,h:5});
      }else if(kind==="ffa"||kind==="red"||kind==="blue"){
        chosen={type:"spawn",team:kind,index:bp.spawns[kind].length};
        bp.spawns[kind].push([x,y,z]);
      }
    },"Placed "+kind+(placed.hints.length?" · "+placed.hints.join(" · "):""));
    setSelection(chosen);if(!stamp)setTool("select");setMode("move");
  };
  const move=(s:StudioSelection,dx:number,dz:number,bypass=false)=>{
    if(!dx&&!dz)return;
    const item=s.type==="feature"?plan.features[s.index]:
      s.type==="hazard"?plan.hazards?.[s.index]:
      s.type==="prop"?theme.props[s.index]:null;
    const key=s.type+":"+s.index;
    const snapped=item?resolveAt(s.type==="feature"?(item as MapFeature).kind as Tool:
      s.type==="prop"?"prop":"hazard",
      {x:item.x+dx,z:item.z+dz},{w:item.w??5,d:item.d??5},undefined,bypass,key,s.type==="feature"?item as MapFeature:undefined):null;
    if(s.type==="prop"&&(item as MapProp|undefined)?.kind==="building"&&snapped){
      const problem=buildingIssue(snapped.x,snapped.z,snapped.y??item?.y??0,
        buildingKit,s.index,item as MapProp);
      if(problem){setMessage("Cannot move building: "+problem);return;}
    }
    edit(d=>{
      const bp=d[id].blueprint;
      if(s.type==="feature"&&snapped){
        const original=bp.features[s.index],fp=featureFootprint({...original,x:snapped.x,z:snapped.z});
        bp.features=transformFeatureAssembly(bp.features,original.id,{...fp,turns:original.turns??0},!!(editAssembly&&original.assemblyId));return;
      }
      const target=s.type==="region"?bp.regions[s.index]:s.type==="feature"?bp.features[s.index]:
        s.type==="hazard"?bp.hazards?.[s.index]:
        s.type==="prop"?d[afterlight?"arena_neon":id].theme.props[s.index]:null;
      if(target){
        target.x=snapped?.x??target.x+dx;target.z=snapped?.z??target.z+dz;
        if(snapped?.surface&&"y" in target)target.y=snapped.y;
      }
      if(s.type==="objective"){
        const o=bp.objectives?.[s.index];if(o){o.pos[0]+=dx;o.pos[2]+=dz;o.approaches=o.approaches?.map(p=>[p[0]+dx,p[1],p[2]+dz]);o.approachLandings=o.approachLandings?.map(p=>[p[0]+dx,p[1],p[2]+dz]);}
      }
      if(s.type==="spawn"&&s.team){const spawn=bp.spawns[s.team][s.index];
        if(spawn){spawn[0]+=dx;spawn[2]+=dz;}}
    },"Moved "+caption(s)+(snapped?.hints.length?" · "+snapped.hints.join(" · "):""));
  };
  const snapTransform=(s:StudioSelection,t:StudioTransform):StudioTransform=>{
    if(s.type!=="prop"&&s.type!=="feature"&&s.type!=="hazard")return t;
    const feature=s.type==="feature"?plan.features[s.index]:undefined;
    const ignoreKeys=feature?.assemblyId&&editAssembly?plan.features.flatMap((f,i)=>f.assemblyId===feature.assemblyId?["feature:"+i]:[]):[];
    const snapped=snapStudioFootprint(t,snapTargets,{grid,smart:smartSnap,mode:s.type==="prop"?"clearance":snapMode,
      ignoreKey:s.type+":"+s.index,ignoreKeys});
    if(moveAxis==="y")return {...t,y:smartSnap?
      snapStudioElevation(t.y,t,snapTargets.filter(a=>a.key!==s.type+":"+s.index)):t.y};
    return {...t,x:moveAxis==="x"?snapped.x:t.x,z:moveAxis==="z"?snapped.z:t.z};
  };
  const startPaletteDrag=(e:React.DragEvent,choice:PaletteStamp)=>{
    setPaletteDragging(choice);
    e.dataTransfer.effectAllowed="copy";
    e.dataTransfer.setData(PALETTE_MIME,JSON.stringify(choice));
    setTool(choice.tool);
    if(choice.buildingKit){setPropKind("building");setBuildingKit(choice.buildingKit);}
    if(choice.structureKit)setStructureKit(choice.structureKit);
    if(choice.assetId)setAssetId(choice.assetId);
  };
  const dropPalette=(data:string,p:Point,bypass=false)=>{
    setPaletteDragging(null);
    try{
      const parsed=JSON.parse(data) as PaletteStamp;
      if(parsed.tool==="asset"&&assets.some(a=>a.id===parsed.assetId)){
        setAssetId(parsed.assetId!);place("asset",p,undefined,parsed,bypass);
      }else if(parsed.tool==="prop"&&parsed.buildingKit&&STUDIO_BUILDING_PRESETS.some(k=>k.id===parsed.buildingKit)){
        setPropKind("building");setBuildingKit(parsed.buildingKit);
        place("prop",p,undefined,parsed,bypass);
      }else if(parsed.tool==="kit"&&parsed.structureKit&&STUDIO_STRUCTURE_PRESETS.some(k=>k.id===parsed.structureKit)){
        setStructureKit(parsed.structureKit);
        place("kit",p,undefined,parsed,bypass);
      }else setMessage("This prefab cannot be dropped.");
    }catch{setMessage("Invalid prefab drag data.");}
  };
  const editSelected=(key:string,value:string|number|boolean)=>{
    if(!selection)return;
    const s=selection;
    if(typeof value==="number"&&["w","d","h"].includes(key))value=constructionDimension(value,grid);
    edit(d=>{
      const bp=d[id].blueprint;
      if(s.type==="objective"){
        const o=bp.objectives?.[s.index];if(o){
          if(["0","1","2"].includes(key)){const axis=Number(key),delta=Number(value)-o.pos[axis];o.pos[axis]=Number(value);o.approaches=o.approaches?.map(p=>p.map((v,i)=>i===axis?v+delta:v) as [number,number,number]);o.approachLandings=o.approachLandings?.map(p=>p.map((v,i)=>i===axis?v+delta:v) as [number,number,number]);}
          else Object.assign(o,{[key]:value});
        }return;
      }
      if(s.type==="spawn"&&s.team){
        const p=bp.spawns[s.team][s.index];if(p)p[Number(key)]=Number(value);
        return;
      }
      const item=s.type==="region"?bp.regions[s.index]:s.type==="feature"?bp.features[s.index]:
        s.type==="hazard"?bp.hazards?.[s.index]:
        s.type==="prop"?d[afterlight?"arena_neon":id].theme.props[s.index]:null;
      if(s.type==="feature"&&item&&["x","z","y","h","w","d"].includes(key)){
        const f=item as MapFeature,next={...f,[key]:value};
        const fp=featureFootprint(next);
        bp.features=transformFeatureAssembly(bp.features,f.id,{...fp,turns:f.turns??0},!!(editAssembly&&f.assemblyId));
      }else if(item)Object.assign(item,{[key]:value});
    });
  };
  // Reading the current authored dimensions here is essential. A 3D gizmo
  // created before a resize can still emit its old W/H/D on the next drag.
  // Translations must never replace the geometry stored by the previous edit.
  const savedGeometry=(s:StudioSelection):{w:number;h:number;d:number;turns?:number}|undefined=>{
    if(s.type==="feature"){
      const f=plan.features[s.index];
      return f?{...featureFootprint(f),turns:f.turns??0}:undefined;
    }
    if(s.type==="region"){
      const r=plan.regions[s.index];
      return r?{w:r.w,d:r.d,h:.2,turns:0}:undefined;
    }
    if(s.type==="hazard"){
      const h=plan.hazards?.[s.index];
      return h?{w:h.w,h:h.h,d:h.d,turns:h.turns??0}:undefined;
    }
    if(s.type==="prop"){
      const p=theme.props[s.index];
      return p?{w:p.w??4,h:p.h??5,d:p.d??4,turns:p.turns??0}:undefined;
    }
    if(s.type==="legacyStairs"){
      const flight=base.editorLegacyStairFlights?.find(f=>f.start===s.index);
      if(!flight)return;
      const source=base.editorLegacyCoverSource??base.cover;
      const saved=stairFlightBounds(flight.indices.map(i=>
        overrideBox(source[i],plan.legacyCoverOverrides?.[String(i)])));
      return {...saved,turns:plan.legacyCoverOverrides?.[String(flight.start)]?.turns??0};
    }
    if(s.type==="legacyCover"||s.type==="legacyEnvironment"){
      const cover=s.type==="legacyCover";
      const original=cover?(base.editorLegacyCoverSource??base.cover)[s.index]:
        (base.editorLegacyEnvironmentSource??base.environment??[])[s.index];
      if(!original)return;
      const overrides=cover?plan.legacyCoverOverrides:plan.legacyEnvironmentOverrides;
      const saved=overrideBox(original,overrides?.[String(s.index)]);
      return {w:saved.size[0]*2,h:saved.size[1]*2,d:saved.size[2]*2,
        turns:overrides?.[String(s.index)]?.turns??0};
    }
    return undefined;
  };
  const transform=(s:StudioSelection,t:StudioTransform,precision=false)=>{
    if(s.type==="generatedBuilding")return;
    if(mode==="move"){
      const saved=savedGeometry(s);
      if(saved)t=preserveSavedGeometryOnMove(t,saved);
    }
    if(mode==="resize"&&grid>0&&!precision)t={...t,w:constructionDimension(t.w,grid),d:constructionDimension(t.d,grid),h:constructionDimension(t.h,grid)};
    if(s.type==="feature"){
      const f=plan.features[s.index];
      if(f)editPlan(bp=>{bp.features=transformFeatureAssembly(bp.features,f.id,t,!!(editAssembly&&f.assemblyId));},"Edited "+(editAssembly&&f.assemblyId?"assembly":"piece"));
      return;
    }
    if(s.type==="legacyStairs"){
      const flight=base.editorLegacyStairFlights?.find(f=>f.start===s.index);
      const source=base.editorLegacyCoverSource??base.cover;
      if(!flight)return;
      const boxes=source.map((b,i)=>overrideBox(b,plan.legacyCoverOverrides?.[String(i)]));
      const old=stairFlightBounds(flight.indices.map(i=>boxes[i]));
      if(t.h>Math.max(old.h,maxLegacyFlightRise(flight.indices.length)+.02)){
        setMessage("Built-in stairs have fixed step count; use independent stairs for a higher rise.");return;
      }
      const overrides=transformStairFlight(boxes,flight.indices,t);
      editPlan(bp=>{bp.legacyCoverOverrides={...(bp.legacyCoverOverrides??{}),...overrides};});return;
    }
    if(s.type==="prop"&&theme.props[s.index]?.kind==="building"){
      const candidate={...theme.props[s.index],x:t.x,y:t.y,z:t.z,w:t.w,d:t.d,h:t.h,
        turns:((t.turns%4+4)%4) as 0|1|2|3};
      const spawns=[...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue,...legacySpawns];
      const problems=studioBuildingPlacementIssues(candidate,plan,
        [...theme.props.filter((_,i)=>i!==s.index),...generated],spawns);
      if(problems.length){setMessage("Cannot transform building: "+problems[0].message);return;}
    }
    if(s.type==="legacyCover"||s.type==="legacyEnvironment"){
      const original=s.type==="legacyCover"?
        (base.editorLegacyCoverSource??base.cover)[s.index]:
        (base.editorLegacyEnvironmentSource??base.environment??[])[s.index];
      if(!original)return;
      editPlan(bp=>{
        const existing=s.type==="legacyCover"?bp.legacyCoverOverrides:bp.legacyEnvironmentOverrides;
        const next={...(existing??{}),[s.index]:{x:t.x,y:t.y,z:t.z,w:t.w,h:t.h,d:t.d,
          turns:((t.turns%4+4)%4) as 0|1|2|3}};
        if(s.type==="legacyCover")bp.legacyCoverOverrides=next;
        else bp.legacyEnvironmentOverrides=next;
      });return;
    }
    edit(d=>{
      const bp=d[id].blueprint,turns=((t.turns%4+4)%4) as 0|1|2|3;
      if(s.type==="objective"){
        const o=bp.objectives?.[s.index];if(o){const [x,y,z]=o.pos;o.pos=[t.x,t.y,t.z];
          o.approaches=o.approaches?.map(p=>[p[0]+t.x-x,p[1]+t.y-y,p[2]+t.z-z]);o.approachLandings=o.approachLandings?.map(p=>[p[0]+t.x-x,p[1]+t.y-y,p[2]+t.z-z]);}return;
      }
      if(s.type==="spawn"&&s.team){bp.spawns[s.team][s.index]=[t.x,t.y,t.z];return;}
      const item=s.type==="region"?bp.regions[s.index]:s.type==="feature"?bp.features[s.index]:
        s.type==="hazard"?bp.hazards?.[s.index]:
        s.type==="prop"?d[afterlight?"arena_neon":id].theme.props[s.index]:null;
      if(item)Object.assign(item,{x:t.x,z:t.z,w:t.w,d:t.d,
        ...(s.type!=="region"?{y:t.y,h:t.h,turns}:{})});
    },"Transformed "+caption(s));
  };
  const promote=()=>{
    if(selection?.type!=="generatedBuilding")return;
    const building=generated[selection.index];if(!building?.lotId)return;
    const index=theme.props.length;
    edit(d=>{
      d[id].blueprint.cityBuildingDisabled=[...new Set([...(d[id].blueprint.cityBuildingDisabled??[]),building.lotId!])];
      d[afterlight?"arena_neon":id].theme.props.push(clone(building));
    },"Converted city building into an editable authored prop");
    setSelection({type:"prop",index});
  };
  const duplicate=()=>{
    if(!selection)return;
    const s=selection;if(s.type==="objective"){setMessage("Each objective role is unique. Place a different type or team from Objectives and modes.");return;}if(s.type==="generatedBuilding"){promote();return;}
    let chosen:StudioSelection|null=null;
    edit(d=>{
      const bp=d[id].blueprint;
      if(s.type==="region"){const item=bp.regions[s.index];if(item){chosen={type:"region",index:bp.regions.length};bp.regions.push({...item,x:item.x+12});}}
      if(s.type==="feature"){const item=bp.features[s.index];if(item){chosen={type:"feature",index:bp.features.length};bp.features.push(...copyFeatureAssembly(bp.features,item.id,()=>unique("copy"),!!(editAssembly&&item.assemblyId)));}}
      if(s.type==="hazard"){const item=bp.hazards?.[s.index];if(item){chosen={type:"hazard",index:bp.hazards!.length};bp.hazards!.push({...item,id:unique("hazard"),x:item.x+10});}}
      if(s.type==="prop"){const list=d[afterlight?"arena_neon":id].theme.props,item=list[s.index];if(item){chosen={type:"prop",index:list.length};list.push({...item,x:item.x+10,lotId:undefined});}}
      if(s.type==="spawn"&&s.team){const p=bp.spawns[s.team][s.index];if(p){chosen={type:"spawn",team:s.team,index:bp.spawns[s.team].length};bp.spawns[s.team].push([p[0]+10,p[1],p[2]]);}}
      if(s.type==="legacyCover"){const source=(base.editorLegacyCoverSource??base.cover)[s.index];if(source){chosen={type:"feature",index:bp.features.length};bp.features.push(legacyCoverToFeature(overrideBox(source,bp.legacyCoverOverrides?.[String(s.index)]),unique("copy")));}}
      if(s.type==="legacyEnvironment"){const source=(base.editorLegacyEnvironmentSource??base.environment??[])[s.index];if(source){bp.hazards??=[];chosen={type:"hazard",index:bp.hazards.length};bp.hazards.push(legacyEnvironmentToHazard(overrideBox(source,bp.legacyEnvironmentOverrides?.[String(s.index)]),unique("copy")));}}
      if(s.type==="legacyStairs"){const flight=base.editorLegacyStairFlights?.find(f=>f.start===s.index);
        const source=base.editorLegacyCoverSource??base.cover;
        if(flight){chosen={type:"feature",index:bp.features.length};bp.features.push(legacyFlightToFeature(flight.indices.map(i=>overrideBox(source[i],bp.legacyCoverOverrides?.[String(i)])),unique("stairs")));}}
    },"Duplicated "+caption(s));
    setSelection(chosen);setMode("move");
  };
  const remove=()=>{
    if(!selection)return;
    const s=selection;
    if(s.type==="region"&&plan.regions.length===1){setMessage("A playable region is required.");return;}
    if(s.type==="spawn"&&s.team&&plan.spawns[s.team].length===1){setMessage("Keep at least one spawn per team.");return;}
    edit(d=>{
      const bp=d[id].blueprint;
      if(s.type==="region")bp.regions.splice(s.index,1);
      if(s.type==="feature"){
        const f=bp.features[s.index];
        bp.features=bp.features.filter((q,i)=>i!==s.index&&!(editAssembly&&f.assemblyId&&q.assemblyId===f.assemblyId));
      }
      if(s.type==="objective")bp.objectives?.splice(s.index,1);
      if(s.type==="hazard")bp.hazards?.splice(s.index,1);
      if(s.type==="prop")d[afterlight?"arena_neon":id].theme.props.splice(s.index,1);
      if(s.type==="spawn"&&s.team)bp.spawns[s.team].splice(s.index,1);
      if(s.type==="legacyCover")bp.legacyCoverDisabled=toggleOriginalIndex(bp.legacyCoverDisabled,s.index,true);
      if(s.type==="legacyEnvironment")bp.legacyEnvironmentDisabled=toggleOriginalIndex(bp.legacyEnvironmentDisabled,s.index,true);
      if(s.type==="legacyStairs")for(const i of base.editorLegacyStairFlights?.find(f=>f.start===s.index)?.indices??[])
        bp.legacyCoverDisabled=toggleOriginalIndex(bp.legacyCoverDisabled,i,true);
    },"Deleted "+caption(s)+" (undo to restore)");
    setSelection(null);
  };
  const restore=()=>{
    if(!selection||!selection.type.startsWith("legacy"))return;
    const s=selection;
    editPlan(bp=>{
      const cover=s.type!=="legacyEnvironment";
      const ids=s.type==="legacyStairs"?(base.editorLegacyStairFlights?.find(f=>f.start===s.index)?.indices??[]):[s.index];
      const changes=cover?bp.legacyCoverOverrides:bp.legacyEnvironmentOverrides;
      for(const i of ids){
        if(changes)delete changes[String(i)];
        if(cover)bp.legacyCoverDisabled=toggleOriginalIndex(bp.legacyCoverDisabled,i,false);
        else bp.legacyEnvironmentDisabled=toggleOriginalIndex(bp.legacyEnvironmentDisabled,i,false);
      }
    },"Restored built-in geometry");
  };
  const createMap=()=>{
    const name=newId.trim().toLowerCase();
    if(!/^[a-z][a-z0-9_:-]*$/.test(name)||library[name]){setMessage("Choose a unique lowercase map ID, starting with a letter.");return;}
    const draft=clone(current);
    draft.id=name;draft.blueprint.name=name.replaceAll("_"," ").toUpperCase();
    draft.blueprint.shortName=name.slice(0,3).toUpperCase();
    draft.blueprint.templateMapId=(MAP_DOCUMENTS[id]?id:plan.templateMapId)??"compound";
    draft.theme=clone(theme);delete draft.theme.inheritPropsFrom;
    commit({...library,[name]:draft},"Created "+name+". Register the exported file in map-documents.ts to publish.");
    setId(name);setNewId("");setSelection(null);
  };
  const exportMap=()=>{if(faults.length){setMessage("Fix validation errors first: "+faults.slice(0,2).join("; "));return;}saveFile(id+".json",current);setMessage("Exported "+id+".json — publish to src/data/maps/"+id+".json");};
  const importFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const imported=importMapDocuments(JSON.parse(await file.text()),library,id);
      commit(imported.documents,imported.migrated?"Migrated legacy map JSON.":"Imported map JSON.");
      setId(imported.selectedId);setSelection(null);
    }catch(error){setMessage("Import failed: "+String(error));}
    e.currentTarget.value="";
  };
  const testDraft=()=>{
    if(faults.length){setMessage("Fix validation errors first: "+faults.slice(0,2).join("; "));return;}
    try{
      localStorage.setItem("vanguard-map-studio-v2",JSON.stringify(library));
      sessionStorage.setItem("vanguard-map-studio-playtest-v1",JSON.stringify({mapId:id,blueprint:plan,theme,botCount:bots,mode:(plan.modes??DEFAULT_COMBAT_MODES).includes(playtestMode)?playtestMode:(plan.modes??DEFAULT_COMBAT_MODES)[0]}));
      window.location.assign("/map-editor/playtest");
    }catch(error){setMessage("Playtest failed: "+String(error));}
  };
  const fromPointer=(e:{clientX:number;clientY:number}):Point=>{
    const svg=svgRef.current;
    if(!svg)return {x:0,z:0};
    const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
    const m=svg.getScreenCTM();if(!m)return {x:0,z:0};
    const p=point.matrixTransform(m.inverse());
    const round=(n:number)=>grid?Math.round(n/grid)*grid:n;
    return {x:round(p.x),z:round(p.y)};
  };
  const canvasDown=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(e.button!==0)return;
    if(tool==="select"){setSelection(null);return;}
    const p=fromPointer(e);gesture.current={from:p,kind:"place"};
    setGhost({from:p,to:p});svgRef.current?.setPointerCapture(e.pointerId);
  };
  const objectDown=(e:React.PointerEvent<SVGElement>,s:StudioSelection)=>{
    if(tool!=="select")return;
    e.stopPropagation();setSelection(s);
    const p=fromPointer(e);gesture.current={from:p,kind:"move",sel:s};
    setGhost({from:p,to:p});svgRef.current?.setPointerCapture(e.pointerId);
  };
  const canvasUp=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(!gesture.current)return;
    const {from,kind,sel}=gesture.current,to=fromPointer(e);
    if(kind==="move"&&sel)move(sel,to.x-from.x,to.z-from.z,e.altKey);
    if(kind==="place"){
      if(tool==="wall"){
        const wall=wallBetween(from,to,unique("wall"));editPlan(bp=>{bp.features.push(wall);},"Drew wall");
        setSelection({type:"feature",index:plan.features.length});if(!stamp)setTool("select");
      }else if(teams.includes(tool as Team))place(tool,to,undefined,undefined,e.altKey);
      else if(tool==="prop"||tool==="kit"||tool==="asset")place(tool,to,undefined,undefined,e.altKey);
      else place(tool,{x:(from.x+to.x)/2,z:(from.z+to.z)/2},
        {w:Math.max(1,Math.abs(to.x-from.x)||(tool==="stairs"?4:12)),d:Math.max(1,Math.abs(to.z-from.z)||(tool==="stairs"?10:12))},undefined,e.altKey);
    }
    gesture.current=null;setGhost(null);
    try{svgRef.current?.releasePointerCapture(e.pointerId);}catch{}
  };
  const bounds=useMemo(()=>{
    const xs=plan.regions.flatMap(r=>[r.x-r.w/2,r.x+r.w/2]),zs=plan.regions.flatMap(r=>[r.z-r.d/2,r.z+r.d/2]);
    const minX=Math.min(...xs)-25,maxX=Math.max(...xs)+25,minZ=Math.min(...zs)-25,maxZ=Math.max(...zs)+25;
    const w=Math.max(90,maxX-minX)/zoom,d=Math.max(90,maxZ-minZ)/zoom;
    return {x:(minX+maxX-w)/2,z:(minZ+maxZ-d)/2,w,d};
  },[plan.regions,zoom]);
  const objective=selection?.type==="objective"?plan.objectives?.[selection.index]:undefined;
  const feature=selection?.type==="feature"?plan.features[selection.index]:undefined;
  const hazard=selection?.type==="hazard"?plan.hazards?.[selection.index]:undefined;
  const prop=selection?.type==="prop"?theme.props[selection.index]:undefined;
  const region=selection?.type==="region"?plan.regions[selection.index]:undefined;
  const item=feature??hazard??prop??region;
  const spawn=selection?.type==="spawn"&&selection.team?plan.spawns[selection.team][selection.index]:undefined;
  const legacyItem:StudioTransform|undefined=(()=>{
    if(!selection)return;
    if(selection.type==="legacyStairs"){
      const flight=base.editorLegacyStairFlights?.find(f=>f.start===selection.index);
      if(flight)return {...stairFlightBounds(flight.indices.map(i=>overrideBox((base.editorLegacyCoverSource??base.cover)[i],plan.legacyCoverOverrides?.[String(i)]))),turns:plan.legacyCoverOverrides?.[String(flight.start)]?.turns??0};
    }
    if(selection.type!=="legacyCover"&&selection.type!=="legacyEnvironment")return;
    const source=selection.type==="legacyCover"?(base.editorLegacyCoverSource??base.cover)[selection.index]:(base.editorLegacyEnvironmentSource??base.environment??[])[selection.index];
    if(!source)return;
    const changes=selection.type==="legacyCover"?plan.legacyCoverOverrides:plan.legacyEnvironmentOverrides;
    const b=overrideBox(source,changes?.[String(selection.index)]);
    return {x:b.pos[0],y:b.pos[1],z:b.pos[2],w:b.size[0]*2,h:b.size[1]*2,d:b.size[2]*2,turns:changes?.[String(selection.index)]?.turns??0};
  })();
  const itemSpan=item&&!region?elevationSpan("y" in item?item.y??0:0,"h" in item?item.h??5:5,hazard?"center":"bottom"):null;
  const libraryDirty=dirty?"Unsaved export":"Shipped source";
  const saveAsset=()=>{
    const features=feature?plan.features.filter(f=>f.id===feature.id||(editAssembly&&feature.assemblyId&&f.assemblyId===feature.assemblyId)):[];
    if(!features.length&&!prop){setMessage("Select an object or assembly to save");return;}
    const asset=saveStudioAsset(assetName||feature?.label||prop?.text||"Custom asset",features,prop?[prop]:[],unique("custom"));
    setCustomAssets(old=>[...old,asset]);setAssetName("");setMessage("Saved editable recipe to My assets. Export assets to move it to another browser.");
  };
  const importAssets=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const input=e.currentTarget,file=input.files?.[0];if(!file)return;
    try{const incoming=importStudioAssets(JSON.parse(await file.text()));
      setCustomAssets(old=>[...old.filter(a=>!incoming.some(b=>a.id===b.id)),...incoming]);setMessage("Imported "+incoming.length+" editable asset recipes");
    }catch(error){setMessage("Asset import failed: "+String(error));}input.value="";
  };
  const joinNearest=()=>{
    if(!feature)return;
    const candidates=plan.features.filter(f=>f.id!==feature.id&&f.kind==="cover").flatMap(f=>{
      const joined=joinFeatureFaces(feature,f);return joined?[{joined,distance:Math.hypot(joined.x-feature.x,joined.z-feature.z)}]:[];
    }).sort((a,b)=>a.distance-b.distance);
    if(!candidates.length){setMessage("No nearby separated wall face to join");return;}
    editPlan(bp=>{bp.features[selection!.index]=candidates[0].joined;},"Extended one wall face to meet its neighbor");
  };
  // The selected object's real footprint follows the cursor while dragging.
  // Commit only on pointer-up, so undo always represents a whole gesture.
  const movingSel=ghost&&gesture.current?.kind==="move"?gesture.current.sel:null;
  const movingItem=movingSel?.type==="region"?plan.regions[movingSel.index]:
    movingSel?.type==="feature"?plan.features[movingSel.index]:
    movingSel?.type==="hazard"?plan.hazards?.[movingSel.index]:
    movingSel?.type==="prop"?theme.props[movingSel.index]:null;
  const moveGhost=ghost&&movingSel&&movingItem?resolveAt(
    movingSel.type==="feature"?(movingItem as MapFeature).kind as Tool:
      movingSel.type==="prop"?"prop":movingSel.type==="hazard"?"hazard":"region",
    {x:movingItem.x+ghost.to.x-ghost.from.x,z:movingItem.z+ghost.to.z-ghost.from.z},
    {w:movingItem.w??5,d:movingItem.d??5},undefined,false,movingSel.type+":"+movingSel.index,movingSel.type==="feature"?movingItem as MapFeature:undefined):null;
  const ghostSnap=ghost&&tool!=="select"?resolveAt(tool,
    tool==="prop"||tool==="kit"||tool==="asset"?ghost.to:
      {x:(ghost.from.x+ghost.to.x)/2,z:(ghost.from.z+ghost.to.z)/2},
    tool==="prop"||tool==="kit"||tool==="asset"?undefined:
      {w:Math.max(1,Math.abs(ghost.to.x-ghost.from.x)||(tool==="stairs"?4:12)),
        d:Math.max(1,Math.abs(ghost.to.z-ghost.from.z)||(tool==="stairs"?10:12))},
    paletteDragging??undefined):null;
  const liveGhost=moveGhost??ghostSnap;
  const ghostFeature=ghostSnap?.feature??(movingSel?.type==="feature"?plan.features[movingSel.index]:undefined);
  const ghostDisplay=liveGhost&&((ghostFeature?.kind==="stairs")||tool==="stairs")?
    {...liveGhost,...featureFootprint({...ghostFeature,id:"ghost",kind:"stairs",h:ghostFeature?.h??5,
      x:liveGhost.x,z:liveGhost.z,w:liveGhost.w,d:liveGhost.d})}:liveGhost;
  const visualGrid=grid>0?grid*Math.max(1,Math.ceil(Math.max(bounds.w,bounds.d)/(grid*120))):20;
  const previewIssue=ghostSnap&&tool==="asset"?assetIssue(ghostSnap.x,ghostSnap.z,ghostSnap.y??0,paletteDragging?.assetId??assetId):
    ghostSnap&&tool==="prop"&&(paletteDragging?.buildingKit||propKind==="building")?
    buildingIssue(ghostSnap.x,ghostSnap.z,ghostSnap.y??0,paletteDragging?.buildingKit??buildingKit):
    moveGhost&&movingSel?.type==="prop"&&(movingItem as MapProp|undefined)?.kind==="building"?
      buildingIssue(moveGhost.x,moveGhost.z,moveGhost.y??(movingItem as MapProp|undefined)?.y??0,
        buildingKit,movingSel.index,movingItem as MapProp):null;
  const previewColor=previewIssue?"#fb7185":"#34d399";

  return <main className="flex h-dvh min-h-[540px] flex-col overflow-y-auto bg-[#080b10] text-zinc-100 lg:overflow-hidden">
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#10151c] px-3 py-2">
      <Link href="/" className={btn}>Vanguard</Link>
      <strong className="mr-2 text-sm uppercase tracking-[.15em] text-amber-300">Map Studio 2</strong>
      <select className={control+" max-w-[170px]"} value={id} onChange={e=>{setId(e.target.value);setSelection(null);setTool("select");}}>
        {Object.keys(library).sort().map(key=><option key={key} value={key}>{library[key].blueprint.name} · {key}</option>)}
      </select>
      <input className={control+" w-28"} value={newId} onChange={e=>setNewId(e.target.value)} placeholder="new_map_id" aria-label="New map ID"/>
      <button className={btn} onClick={createMap}><Plus className="h-3 w-3"/> New</button>
      <button className={btn} onClick={()=>{setGuide(v=>!v);localStorage.setItem("vanguard-studio-guide",guide?"hidden":"shown");}}>{guide?"Hide guide":"Show guide"}</button>
      <div className="ml-auto flex flex-wrap gap-1">
        <button className={btn} disabled={!undoRef.current.length} onClick={undo}><Undo2 className="h-3.5 w-3.5"/> Undo</button>
        <button className={btn} disabled={!redoRef.current.length} onClick={redo}><Redo2 className="h-3.5 w-3.5"/> Redo</button>
        <input className="hidden" ref={fileRef} type="file" accept=".json,application/json" onChange={importFile}/>
        <button className={btn} onClick={()=>fileRef.current?.click()}><Upload className="h-3.5 w-3.5"/> Import</button>
        <button className={btn} onClick={()=>saveFile("map-studio-backup.json",exportMapLibrary(library))}>Backup all</button>
        <button className={btn+" border-amber-500/50"} onClick={exportMap}><Download className="h-3.5 w-3.5"/> Export map</button>
        <button className={btn+" bg-amber-500 text-black hover:bg-amber-400"} disabled={faults.length>0} onClick={testDraft}><Play className="h-3.5 w-3.5"/> Playtest</button>
      </div>
    </header>
    {guide&&<section className="shrink-0 border-b border-emerald-400/20 bg-emerald-950/30 px-4 py-2 text-xs text-zinc-200" aria-label="First map guide">
      <strong className="text-emerald-300">Build your first space</strong> · 1. Choose a wall, room or rooftop in the Asset library. · 2. Click to place; keep Join faces enabled for construction. · 3. Attach stairs to a platform, then move or resize the assembly. · 4. Check measured warnings and Playtest.
      <p className="mt-1 text-zinc-400">Construction uses 1u dimensions, 1u walls and 5u storeys. Grid off enables free precision. Each placed recipe is independently editable.</p>
    </section>}
    <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
      <aside className="max-h-[30vh] w-full shrink-0 overflow-y-auto border-b border-white/10 bg-[#10151c] p-3 lg:max-h-none lg:w-56 lg:border-b-0 lg:border-r">
        <h2 className="text-xs font-bold uppercase tracking-widest text-amber-300">Create</h2>
        <button className={btn+" my-2 w-full "+(tool==="select"?"border-amber-400":"")} onClick={()=>{setTool("select");setMode("select");}}>Select and inspect</button>
        {tools.map(group=><section key={group.heading} className="mb-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">{group.heading}</p>
          <div className="grid grid-cols-2 gap-1">
            {group.items.map(([key,label])=><button key={key} onClick={()=>setTool(key)}
              className={"rounded border px-1.5 py-2 text-left text-[11px] "+(tool===key?
                "border-amber-400 bg-amber-400/10 text-amber-200":"border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800")}>{label}</button>)}
          </div>
        </section>)}
        {tool==="prop"&&<><Picker label="Prop kind" value={propKind} options={kinds} save={v=>setPropKind(v as PropKind)}/>
          {propKind==="building"&&<Picker label="Building kit" value={buildingKit}
            options={STUDIO_BUILDING_PRESETS.map(p=>p.id)} save={v=>setBuildingKit(v as StudioBuildingPresetId)}/>}</>}
        {tool==="hazard"&&<Picker label="Hazard" value={hazardKind} options={MAP_HAZARD_TYPES} save={v=>setHazardKind(v as MapHazard["type"])}/>}
        {tool==="kit"&&<Picker label="Kit" value={structureKit} options={STUDIO_STRUCTURE_PRESETS.map(p=>p.id)}
          save={v=>setStructureKit(v as StudioStructurePresetId)}/>}
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={stamp} onChange={e=>setStamp(e.target.checked)}/> Repeat placement</label>
        <section className="mt-3 rounded-md border border-emerald-400/25 bg-emerald-950/20 p-2" aria-label="Asset library">
          <h3 className="text-sm font-semibold text-emerald-300">Asset library</h3>
          <p className="my-2 text-xs text-zinc-300">Drag or select a recipe, then click to place. Customize each copy in the Inspector.</p>
          <input aria-label="Search assets" placeholder="Search walls, rooms, containers…" className={control} value={assetSearch} onChange={e=>setAssetSearch(e.target.value)}/>
          {(["Construction","Buildings","Props","My assets"] as const).map(category=><details key={category} open={category==="Construction"||!!assetSearch}>
            <summary className="my-2 cursor-pointer text-xs font-semibold">{category}</summary>
            <div className="grid grid-cols-2 gap-1">
              {assets.filter(a=>a.category===category&&(a.name+" "+a.description).toLowerCase().includes(assetSearch.toLowerCase())).map(a=><button key={a.id} draggable
                onDragStart={e=>startPaletteDrag(e,{tool:"asset",assetId:a.id})} onDragEnd={()=>{setPaletteDragging(null);setGhost(null);}}
                onClick={()=>{setTool("asset");setAssetId(a.id);setWallStart(null);}}
                className={"rounded border p-1.5 text-left text-xs hover:bg-white/10 "+(tool==="asset"&&assetId===a.id?"border-emerald-300":"border-white/15")}>
                <AssetThumb asset={a}/>{a.name}
              </button>)}
            </div>
          </details>)}
          <input type="file" className="hidden" accept=".json,application/json" ref={assetFileRef} onChange={importAssets}/>
          <div className="mt-2 flex flex-wrap gap-1">
            <button className={btn} onClick={()=>assetFileRef.current?.click()}>Import assets</button>
            <button className={btn} onClick={()=>saveFile("asset-library.json",{version:1,assets:customAssets})}>Export assets</button>
          </div>
        </section>
        <section className="mt-4 space-y-2 border-t border-white/10 pt-3">
          <h3 className="text-xs font-semibold uppercase text-zinc-400">Objectives and modes</h3>
          <Picker label="Objective type" value={objectiveKind} options={OBJECTIVE_KINDS} save={v=>{setObjectiveKind(v as MapObjective["kind"]);setTool("objective");}}/>
          {objectiveKind!=="reactor"&&<Picker label="Objective team" value={objectiveTeam} options={["red","blue"]} save={v=>{setObjectiveTeam(v as "red"|"blue");setTool("objective");}}/>}
          <button className={btn+" w-full"} onClick={()=>{setTool("objective");setMode("select");}}>Place {objectiveKind.replaceAll("_"," ")}</button>
          <p className="text-[10px] text-zinc-400">One flag and capture zone per team; one optional reactor. Place markers on reachable surfaces. Select markers to edit rules and approaches.</p>
          <div className="grid grid-cols-2 gap-1">{(Object.keys(MODE_OBJECTIVES) as GameMode[]).map(m=><label key={m} className="text-xs text-zinc-300"><input type="checkbox" checked={(plan.modes??DEFAULT_COMBAT_MODES).includes(m)} onChange={e=>editPlan(bp=>{const modes=bp.modes??[...DEFAULT_COMBAT_MODES];bp.modes=e.target.checked?[...modes,m]:modes.filter(v=>v!==m);})}/> {m}</label>)}</div>
          <Picker label="Playtest mode" value={(plan.modes??DEFAULT_COMBAT_MODES).includes(playtestMode)?playtestMode:(plan.modes??DEFAULT_COMBAT_MODES)[0]??"ffa"} options={plan.modes??DEFAULT_COMBAT_MODES} save={v=>setPlaytestMode(v as GameMode)}/>
          {Object.entries(plan.modeSpawns??{}).map(([mode,pools])=>pools&&<details key={mode}><summary className="text-xs text-zinc-300">{mode} spawn overrides</summary>
            {(["red","blue"] as const).map(team=><div key={team}><p className="text-xs text-zinc-400">{team}</p>{pools[team].map((point,i)=><div key={i} className="grid grid-cols-3 gap-1">{point.map((v,a)=><NumberInput key={a} label={`${i+1} ${["X","Y","Z"][a]}`} value={v} save={n=>editPlan(bp=>{bp.modeSpawns![mode as GameMode]![team][i][a]=n;})}/>)}</div>)}</div>)}
          </details>)}
          <NumberInput label="Gravity scale" value={plan.gravityScale??1} save={v=>editPlan(bp=>{bp.gravityScale=v;})}/>
        </section>
        <h3 className="mt-5 border-t border-white/10 pt-3 text-xs font-semibold uppercase text-zinc-400">Object layers</h3>
        {([
          ["Regions",plan.regions.map((_,index)=>({type:"region",index}))],
          ["Geometry",plan.features.map((_,index)=>({type:"feature",index}))],
          ["Objectives",(plan.objectives??[]).map((_,index)=>({type:"objective",index}))],
          ["Hazards",(plan.hazards??[]).map((_,index)=>({type:"hazard",index}))],
          ["Props",theme.props.map((_,index)=>({type:"prop",index}))],
          ["Spawns",teams.flatMap(team=>plan.spawns[team].map((_,index)=>({type:"spawn",index,team})))],
        ] as [string,StudioSelection[]][]).map(([label,objects])=><details key={label}>
          <summary className="cursor-pointer border-b border-white/5 py-2 text-xs text-zinc-400">{label} ({objects.length})</summary>
          <div className="max-h-36 overflow-auto">
            {objects.map(o=><button key={caption(o)} onClick={()=>{setSelection(o);setTool("select");}}
              className={"block w-full truncate px-2 py-1 text-left text-xs hover:bg-white/5 "+
                (selection?.type===o.type&&selection?.index===o.index&&selection?.team===o.team?"text-amber-300":"text-zinc-400")}>
              {o.type==="feature"?plan.features[o.index]?.label??caption(o):
               o.type==="prop"?theme.props[o.index]?.text??caption(o):caption(o)}
            </button>)}
          </div>
        </details>)}
      </aside>
      <section className="relative min-h-[290px] min-w-0 flex-1 bg-[#09121d]">
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1 rounded-lg bg-black/80 p-1.5">
          {(["3d","2d"] as const).map(v=><button key={v} className={btn+(view===v?" border-amber-400 text-amber-300":"")} onClick={()=>setView(v)}>{v.toUpperCase()}</button>)}
          {view==="3d"&&(["select","move","rotate","resize"] as StudioMode[]).map(v=>
            <button key={v} className={btn+(mode===v?" border-amber-400 text-amber-300":"")} onClick={()=>{setMode(v);setTool("select");}}>{v}</button>)}
          {view==="3d"&&mode==="move"&&(["x","y","z"] as const).map(axis=><button key={axis} className={btn+(moveAxis===axis?" border-cyan-400 text-cyan-300":"")} onClick={()=>setMoveAxis(axis)}>{axis.toUpperCase()}</button>)}
        </div>
        <div className="absolute right-2 top-14 z-10 flex max-w-[95%] flex-wrap items-center gap-2 rounded-lg bg-black/80 p-2 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={smartSnap}
            onChange={e=>setSmartSnap(e.target.checked)}/> Magnetic</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={surfaceSnap}
            onChange={e=>setSurfaceSnap(e.target.checked)}/> Surfaces</label>
          <span>Grid</span>
          <select aria-label="Construction grid" value={grid} onChange={e=>setGrid(Number(e.target.value))} className="bg-zinc-900">
            {[0,1,2,5,10].map(n=><option key={n} value={n}>{n===0?"off":n+"u"}</option>)}
          </select>
          <select aria-label="Alignment mode" className="bg-zinc-900" value={snapMode} onChange={e=>setSnapMode(e.target.value as StudioSnapMode)}>
            <option value="join">Join faces</option><option value="align">Align edges</option><option value="clearance">3u clearance</option>
          </select>
          {view==="2d"&&<span className="text-zinc-400">Major lines: {visualGrid}u</span>}
          {view==="2d"&&<input aria-label="2D zoom" type="range" min=".5" max="2" step=".1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>}
        </div>
        {view==="3d"?
          <MapStudio3D mapId={id} map={plan} theme={theme} selected={selection} mode={mode} moveAxis={moveAxis} snap={grid}
            placementAsset={tool==="asset"?assets.find(a=>a.id===assetId):undefined}
            surfacePlacement={surfaceSnap}
            tool={tool} legacySpawns={legacySpawns} showCollision={showCollision}
            placementProp={tool==="prop"?(propKind==="building"?studioBuildingPrefab(buildingKit,0,0):{kind:propKind,x:0,z:0,w:5,d:5,h:5}):undefined}
            placementKit={tool==="kit"?(()=>{const p=STUDIO_STRUCTURE_PRESETS.find(p=>p.id===structureKit);return p?{w:p.width,d:p.depth}:undefined;})():undefined}
            warnings={showIssues?issues:[]} regionLinks={showRoutes?routes:[]}
            placementProblem={tool==="asset"?(x,z,y)=>assetIssue(x,z,y):tool==="prop"&&propKind==="building"?
              (x,z,y)=>buildingIssue(x,z,y):undefined}
            onResolvePlacement={(name,p,options)=>resolveAt(name as Tool,p,undefined,undefined,options?.bypass)}
            onSnapTransform={snapTransform} onDropAt={dropPalette}
            onInvalidPlacement={setMessage} onSelect={setSelection} onTransform={transform}
            onAddAt={(name,p,bypass)=>place(name as Tool,p,undefined,undefined,bypass)}/>
        :<svg ref={svgRef} viewBox={[bounds.x,bounds.z,bounds.w,bounds.d].join(" ")}
          preserveAspectRatio="xMidYMid meet" className="h-full w-full touch-none"
          onPointerDown={canvasDown} onPointerMove={e=>{if(gesture.current)setGhost({from:gesture.current.from,to:fromPointer(e)});}}
          onPointerUp={canvasUp} onPointerCancel={()=>{gesture.current=null;setGhost(null);}}
          onDragOver={e=>{if(Array.from(e.dataTransfer.types).includes(PALETTE_MIME)){
            e.preventDefault();e.dataTransfer.dropEffect="copy";const p=fromPointer(e);
            setGhost({from:p,to:p});
          }}}
          onDragLeave={()=>{if(!gesture.current)setGhost(null);}}
          onDrop={e=>{e.preventDefault();const data=e.dataTransfer.getData(PALETTE_MIME);
            if(data)dropPalette(data,fromPointer(e),e.altKey);setGhost(null);setPaletteDragging(null);}}>
          <rect x={bounds.x} y={bounds.z} width={bounds.w} height={bounds.d} fill="#131b25"/>
          {Array.from({length:Math.min(150,Math.ceil(bounds.w/visualGrid)+2)},(_,i)=>{
            const x=Math.floor(bounds.x/visualGrid)*visualGrid+i*visualGrid;return <line key={"x"+i} x1={x} x2={x} y1={bounds.z} y2={bounds.z+bounds.d} stroke="#475569" strokeWidth=".25"/>;
          })}
          {Array.from({length:Math.min(150,Math.ceil(bounds.d/visualGrid)+2)},(_,i)=>{
            const z=Math.floor(bounds.z/visualGrid)*visualGrid+i*visualGrid;return <line key={"z"+i} x1={bounds.x} x2={bounds.x+bounds.w} y1={z} y2={z} stroke="#475569" strokeWidth=".25"/>;
          })}
          {plan.regions.map((r,i)=>{
            const select=(e:React.PointerEvent<SVGElement>)=>objectDown(e,{type:"region",index:i});
            const stroke=selection?.type==="region"&&selection.index===i?"#fbbf24":"#829da6";
            const props={fill:theme.palette.floor,fillOpacity:.48,stroke,strokeWidth:1.25,onPointerDown:select};
            return r.shape==="circle"?<ellipse key={i} cx={r.x} cy={r.z} rx={r.w/2} ry={r.d/2} {...props}/>:
              r.shape==="triangle"?<polygon key={i} points={[r.x+","+(r.z-r.d/2),(r.x-r.w/2)+","+(r.z+r.d/2),(r.x+r.w/2)+","+(r.z+r.d/2)].join(" ")} {...props}/>:
              <rect key={i} x={r.x-r.w/2} y={r.z-r.d/2} width={r.w} height={r.d} {...props}/>;
          })}
          {showRoutes&&routes.map((l,i)=><line key={i} x1={l.ax} y1={l.az} x2={l.bx} y2={l.bz} stroke="#5eead4" strokeDasharray="3 2" strokeWidth=".9" pointerEvents="none"/>)}
          {plan.features.map((f,i)=>{const fp=featureFootprint(f);return <rect key={f.id} x={fp.x-fp.w/2} y={fp.z-fp.d/2} width={fp.w} height={fp.d}
            fill={f.kind==="stairs"?theme.palette.stair:f.kind==="platform"?theme.palette.platform:theme.palette.cover}
            stroke={selection?.type==="feature"&&selection.index===i?"#fbbf24":"#1f2937"} strokeWidth="1"
            onPointerDown={e=>objectDown(e,{type:"feature",index:i})}/>;})}
          {(plan.hazards??[]).map((h,i)=><rect key={h.id} x={h.x-h.w/2} y={h.z-h.d/2} width={h.w} height={h.d}
            fill={h.type==="lava"?"#f97316":"#fb7185"} fillOpacity=".65" stroke={selection?.type==="hazard"&&selection.index===i?"white":"#9333ea"}
            onPointerDown={e=>objectDown(e,{type:"hazard",index:i})}/>)}
          {theme.props.map((p,i)=><rect key={i} x={p.x-(p.w??5)/2} y={p.z-(p.d??5)/2} width={p.w??5} height={p.d??5}
            fill={p.color??(p.kind==="building"?"#a3ad9d":"#34d399")} fillOpacity=".64"
            stroke={selection?.type==="prop"&&selection.index===i?"#fbbf24":"#065f46"}
            strokeWidth="1" onPointerDown={e=>objectDown(e,{type:"prop",index:i})}/>)}
          {(plan.objectives??[]).map((o,i)=><g key={o.id} onPointerDown={e=>objectDown(e,{type:"objective",index:i})}>
            <circle cx={o.pos[0]} cy={o.pos[2]} r={o.radius} fill={o.kind==="reactor"?"#a78bfa":"team" in o&&o.team==="red"?"#f87171":"#38bdf8"} fillOpacity=".25" stroke={selection?.type==="objective"&&selection.index===i?"#fbbf24":"white"}/>
            <text x={o.pos[0]} y={o.pos[2]} fontSize="2.8" textAnchor="middle" fill="white">{o.kind}</text>
          </g>)}
          {teams.flatMap(team=>plan.spawns[team].map((p,i)=><circle key={team+i} cx={p[0]} cy={p[2]} r={2}
            fill={team==="ffa"?"#fbbf24":team==="red"?"#f87171":"#38bdf8"} stroke="#111"
            onPointerDown={e=>objectDown(e,{type:"spawn",index:i,team})}/>))}
          {showIssues&&issues.map((p,i)=><circle key={i} cx={p.x} cy={p.z} r={2.5}
            fill="none" stroke={p.severity==="error"?"#ef4444":"#fbbf24"} strokeWidth=".8" pointerEvents="none"/>)}
          {ghost&&<rect x={liveGhost?ghostDisplay!.x-ghostDisplay!.w/2:Math.min(ghost.from.x,ghost.to.x)}
            y={liveGhost?ghostDisplay!.z-ghostDisplay!.d/2:Math.min(ghost.from.z,ghost.to.z)}
            width={liveGhost?ghostDisplay!.w:Math.max(2,Math.abs(ghost.to.x-ghost.from.x))}
            height={liveGhost?ghostDisplay!.d:Math.max(2,Math.abs(ghost.to.z-ghost.from.z))}
            fill={previewColor} fillOpacity=".2" stroke={previewColor} strokeDasharray="2 2" pointerEvents="none"/>}
          {liveGhost?.snappedX!==undefined&&<line x1={liveGhost.snappedX} x2={liveGhost.snappedX}
            y1={bounds.z} y2={bounds.z+bounds.d} stroke={previewColor} strokeDasharray="3 3"
            strokeWidth=".6" pointerEvents="none"/>}
          {liveGhost?.snappedZ!==undefined&&<line y1={liveGhost.snappedZ} y2={liveGhost.snappedZ}
            x1={bounds.x} x2={bounds.x+bounds.w} stroke={previewColor} strokeDasharray="3 3"
            strokeWidth=".6" pointerEvents="none"/>}
        </svg>}
        {view==="2d"&&liveGhost&&(previewIssue||liveGhost.hints.length>0)&&
          <p className={"pointer-events-none absolute bottom-11 left-2 z-10 max-w-[75%] rounded border bg-black/90 px-3 py-2 text-xs "+
            (previewIssue?"border-rose-400/40 text-rose-300":"border-emerald-400/30 text-emerald-200")}>
            {previewIssue?"Blocked: "+previewIssue:liveGhost.hints.join(" · ")}
          </p>}
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/75 px-3 py-1.5 text-[11px] text-zinc-300">
          {view==="3d"?"Left drag orbit · Right drag pan · Wheel zoom · WASD/QE fly · Click to place or select":
            tool==="select"?"Click an object, then drag to move.":"Drag to draw or drop a prefab."} · Magnetic alignment · Alt to bypass
        </p>
      </section>
      <aside className="max-h-[60vh] w-full shrink-0 overflow-auto border-t border-white/10 bg-[#10151c] p-4 lg:max-h-none lg:w-72 lg:border-l lg:border-t-0">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-300">Inspector</h2>
        {selection?.type==="generatedBuilding"?<div className="space-y-2 text-xs">
          <p className="text-zinc-300">Generated city building. Convert it into authored geometry to move or edit it.</p>
          <button className={btn+" w-full"} onClick={promote}>Convert to editable</button>
        </div>:item?<div className="space-y-2">
          <p className="text-sm text-amber-300">{selection&&caption(selection)}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["x","z","w","d"] as const).map(key=><NumberInput key={key} label={key==="w"?"Width":key==="d"?"Depth / run":key.toUpperCase()} value={item[key]??(key==="w"||key==="d"?5:0)}
              save={n=>editSelected(key,n)}/>)}
            {!region&&<NumberInput label="Height" value={"h" in item?item.h??5:5} save={n=>editSelected("h",n)}/>}
            {!region&&<NumberInput label="Base / center Y" value={"y" in item?item.y??0:0} save={n=>editSelected("y",n)}/>}
          </div>
          {itemSpan&&<div className="grid grid-cols-2 gap-2 rounded border border-white/10 p-2">
            <NumberInput label="Exact bottom Y" value={itemSpan.bottom} save={n=>editSelected("y",yAtElevationFace(n,itemSpan.height,hazard?"center":"bottom","bottom"))}/>
            <NumberInput label="Exact top Y" value={itemSpan.top} save={n=>editSelected("y",yAtElevationFace(n,itemSpan.height,hazard?"center":"bottom","top"))}/>
          </div>}
          {feature?.assemblyId&&<div className="space-y-2 rounded border border-emerald-400/20 p-2 text-xs">
            <label className="flex gap-2"><input type="checkbox" checked={editAssembly} onChange={e=>setEditAssembly(e.target.checked)}/> Edit entire assembly</label>
            <p className="text-zinc-400">Move, resize, rotate, copy and delete all linked pieces together.</p>
            <button className={btn} onClick={()=>editPlan(bp=>{for(const f of bp.features)if(f.assemblyId===feature.assemblyId)delete f.assemblyId;},"Ungrouped assembly; stair attachments remain")}>Ungroup assembly</button>
          </div>}
          {region&&<Picker label="Region shape" value={region.shape??"rect"} options={["rect","circle","triangle"]} save={n=>editSelected("shape",n)}/>}
          {feature&&<>
            <TextInput label="Label" value={feature.label??""} save={n=>editSelected("label",n)}/>
            <Picker label="Kind" value={feature.kind} options={["cover","accent","platform","stairs"]} save={n=>editSelected("kind",n)}/>
            {feature.kind==="cover"&&<>
              <Picker label="Ballistic material" value={feature.material??"concrete"} options={[...BALLISTIC_MATERIALS]} save={n=>editSelected("material",n)}/>
              <p className="text-xs text-zinc-400">Wood, sheet metal, glass and light cover can be pierced by heavy rounds. Concrete and reinforced surfaces stop all conventional bullets. Thickness and shot angle matter.</p>
            </>}
            {feature.kind==="stairs"&&<>
              {feature.attachment?<>
                <p className="rounded bg-emerald-950/50 p-2 text-xs text-emerald-200">Landing attached. Editing the platform preserves this connection; moving this stair alone detaches it.</p>
                <Picker label="Landing edge" value={feature.attachment.edge} options={["north","south","east","west"]} save={edge=>editPlan(bp=>{bp.features[selection!.index].attachment!.edge=edge as PlatformEdge;})}/>
                <NumberInput label="Offset along edge" value={feature.attachment.offset??0} save={n=>editPlan(bp=>{bp.features[selection!.index].attachment!.offset=n;})}/>
                <NumberInput label="Starting floor Y" value={feature.attachment.baseY??0} save={n=>editPlan(bp=>{bp.features[selection!.index].attachment!.baseY=n;})}/>
                <button className={btn+" w-full"} onClick={()=>editPlan(bp=>{delete bp.features[selection!.index].attachment;},"Detached stair landing")}>Detach landing</button>
              </>:<>
                <Picker label="Flight axis" value={feature.axis??"z"} options={["x","z"]} save={n=>editSelected("axis",n)}/>
                <Picker label="Downhill direction" value={String(feature.sign??1)} options={["1","-1"]} save={n=>editSelected("sign",Number(n))}/>
              </>}
              <label className="block text-xs text-zinc-300">Attach to platform
                <select aria-label="Attach to platform" className={control} value={feature.attachment?.platformId??""} onChange={e=>{
                  const platform=plan.features.find(p=>p.id===e.target.value);if(!platform)return;
                  const attached=nearestPlatformSnap(feature,[platform]);if(attached)editPlan(bp=>{bp.features[selection!.index]=attached;bp.features.find(p=>p.id===platform.id)!.autoStairs=false;});
                }}><option value="">Choose platform…</option>{plan.features.filter(f=>f.kind==="platform").map(p=><option key={p.id} value={p.id}>{p.label??p.id}</option>)}</select>
              </label>
              <button className={btn+" w-full"} onClick={()=>{const result=nearestPlatformSnap(feature,plan.features);if(result)editPlan(p=>{p.features[selection!.index]=result;const parent=p.features.find(f=>f.id===result.attachment?.platformId);if(parent)parent.autoStairs=false;});}}>Attach to nearest platform</button>
            </>}
            {feature.kind==="cover"&&<button className={btn+" w-full"} onClick={joinNearest}>Join nearest wall face</button>}
            {feature.kind==="cover"&&<button className={btn+" w-full"} onClick={()=>{const result=snapCoverToPlatform(feature,plan.features);if(result)editPlan(p=>{p.features[selection!.index]=result;});}}>Snap cover to platform top</button>}
            {feature.kind==="platform"&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={feature.autoStairs!==false} onChange={e=>editSelected("autoStairs",e.target.checked)}/> Auto stairs</label>}
          </>}
          {hazard&&<>
            <Picker label="Hazard type" value={hazard.type} options={MAP_HAZARD_TYPES} save={n=>editSelected("type",n)}/>
            {hazard.type==="lava"&&<p className="text-xs text-amber-300">Lethal when feet reach the top surface.</p>}
            {(hazard.type==="fire"?["dps"]:hazard.type==="spikes"?["damage","period","activeFor","offset"]:
              hazard.type==="jump_pad"?["launchX","launchY","launchZ"]:
              hazard.type==="moving_platform"?["toX","toY","toZ","period"]:hazard.type==="destructible_wall"?["hp"]:[]).map(k=>
              <NumberInput key={k} label={k} value={Number((hazard as unknown as Record<string,unknown>)[k]??0)} save={n=>editSelected(k,n)}/>)}
          </>}
          {prop&&<>
            <Picker label="Prop kind" value={prop.kind} options={kinds} save={n=>editSelected("kind",n)}/>
            <TextInput label="Signage / label" value={prop.text??""} save={n=>editSelected("text",n)}/>
            <label className="block text-xs text-zinc-300">Object color<input aria-label="Object color" type="color" className="mt-1 h-9 w-full" key={prop.color??"default"} defaultValue={prop.color??theme.palette.cover} onBlur={e=>{if(e.target.value!==prop.color)editSelected("color",e.target.value);}}/></label>
            {prop.kind==="building"&&<>
              <Picker label="Use" value={prop.use??"house"} options={["house","cafe","supermarket","bakery","apartments","office","hotel","library","diner","clinic","workshop","gallery","florist","gym"]}
                save={n=>editSelected("use",n)}/>
              <Picker label="Facade" value={prop.facade??"brick"} options={["brick","stucco","concrete","glass","timber","industrial"]} save={n=>editSelected("facade",n)}/>
              <Picker label="Shape" value={prop.shape??"rect"} options={["rect","narrow","round"]} save={n=>editSelected("shape",n)}/>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={prop.roofAccess!==false} onChange={e=>editSelected("roofAccess",e.target.checked)}/> Accessible roof</label>
            </>}
          </>}
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
            <button className={btn} onClick={duplicate}><Copy className="h-3.5 w-3.5"/> Duplicate</button>
            <button className={btn+" text-rose-300"} onClick={remove}><Trash2 className="h-3.5 w-3.5"/> Delete</button>
          </div>
          {(feature||prop)&&<div className="space-y-2 border-t border-white/10 pt-2">
            <input aria-label="Asset recipe name" placeholder="Name this asset recipe" value={assetName} onChange={e=>setAssetName(e.target.value)} className={control}/>
            <button className={btn+" w-full"} onClick={saveAsset}>Save to My assets</button>
          </div>}
          {hazard?.type==="spikes"&&<>
            <Picker label="Trap appearance" value={hazard.visual??"spikes"} options={["spikes","steam"]} save={v=>editSelected("visual",v)}/>
            <NumberInput label="Warning duration" value={hazard.warningFor??0} save={v=>editSelected("warningFor",v)}/>
          </>}
        </div>:objective?<div className="space-y-3">
          <p className="text-sm text-amber-300">{objective.kind.replaceAll("_"," ")} · {objective.id}</p>
          {"team" in objective&&<Picker label="Team" value={objective.team} options={["red","blue"]} save={v=>editSelected("team",v)}/>}
          <div className="grid grid-cols-3 gap-1">{objective.pos.map((v,i)=><NumberInput key={i} label={["X","Y","Z"][i]} value={v} save={n=>editSelected(String(i),n)}/>)}</div>
          <NumberInput label="Trigger radius" value={objective.radius} save={n=>editSelected("radius",n)}/>
          <NumberInput label="Vertical tolerance" value={objective.verticalTolerance} save={n=>editSelected("verticalTolerance",n)}/>
          {objective.kind==="reactor"&&<>
            <NumberInput label="Charge radius" value={objective.chargeRadius} save={n=>editSelected("chargeRadius",n)}/>
            <NumberInput label="Kills required" value={objective.killsRequired} save={n=>editSelected("killsRequired",n)}/>
          </>}
          <p className="text-xs text-zinc-400">Approach points guide bots to stair entrances. Moving the objective moves its approaches too; geometry is edited separately.</p>
          {(objective.approaches??[]).map((p,i)=><div key={i} className="grid grid-cols-3 gap-1">{p.map((v,a)=><NumberInput key={a} label={`Entry ${i+1} ${["X","Y","Z"][a]}`} value={v} save={n=>editPlan(bp=>{bp.objectives![selection!.index].approaches![i][a]=n;})}/>)}{objective.approachLandings?.[i]?.map((v,a)=><NumberInput key={"landing"+a} label={`Landing ${i+1} ${["X","Y","Z"][a]}`} value={v} save={n=>editPlan(bp=>{bp.objectives![selection!.index].approachLandings![i][a]=n;})}/>)}<button className={btn} onClick={()=>editPlan(bp=>{bp.objectives![selection!.index].approaches!.splice(i,1);bp.objectives![selection!.index].approachLandings?.splice(i,1);})}>Remove</button></div>)}
          <button className={btn} onClick={()=>editPlan(bp=>{const o=bp.objectives![selection!.index];o.approaches??=[];o.approaches.push([o.pos[0],0,o.pos[2]+10]);if(o.approachLandings)o.approachLandings.push([...o.pos]);})}>Add approach point</button>
          <button className={btn+" text-rose-300"} onClick={remove}>Delete objective</button>
        </div>:spawn?<div className="space-y-3">
          <p className="text-sm text-amber-300">{selection&&caption(selection)}</p>
          <div className="grid grid-cols-3 gap-1">
            {spawn.map((n,index)=><NumberInput key={index} label={["X","Y","Z"][index]} value={n} save={v=>editSelected(String(index),v)}/>)}
          </div>
          <button className={btn} onClick={duplicate}>Duplicate</button>
          <button className={btn+" ml-2 text-rose-300"} onClick={remove}>Delete</button>
        </div>:selection?.type.startsWith("legacy")?<div className="space-y-2 text-xs text-zinc-300">
          <p>{caption(selection)} · Existing engine geometry</p>
          <p>Exact face positions preserve thickness. Overrides retain stable engine indices.</p>
          {legacyItem&&<>
            <div className="grid grid-cols-2 gap-2">{(["x","z","w","h","d"] as const).map(key=><NumberInput key={key} label={key.toUpperCase()} value={legacyItem[key]}
              save={n=>transform(selection,{...legacyItem,[key]:n},true)}/>)}</div>
            <NumberInput label="Exact bottom Y" value={legacyItem.y-legacyItem.h/2} save={n=>transform(selection,{...legacyItem,y:yAtElevationFace(n,legacyItem.h,"center","bottom")},true)}/>
            <NumberInput label="Exact top Y" value={legacyItem.y+legacyItem.h/2} save={n=>transform(selection,{...legacyItem,y:yAtElevationFace(n,legacyItem.h,"center","top")},true)}/>
          </>}
          <button className={btn+" w-full"} onClick={duplicate}>Duplicate as editable geometry</button>
          <button className={btn+" w-full"} onClick={restore}><RotateCcw className="h-3.5 w-3.5"/> Reset original</button>
          <button className={btn+" w-full text-rose-300"} onClick={remove}>Hide original</button>
        </div>:<div className="space-y-3">
          <p className="text-xs text-zinc-400">Select an object to edit. This map's layout and visuals are saved together.</p>
          <TextInput label="Name" value={plan.name} save={n=>editPlan(p=>{p.name=n;})}/>
          <TextInput label="Short name" value={plan.shortName} save={n=>editPlan(p=>{p.shortName=n;})}/>
          <TextInput label="Description" value={plan.description} save={n=>editPlan(p=>{p.description=n;})}/>
          <Picker label="Pace" value={plan.pace} options={["compact","balanced","tactical"]}
            save={n=>editPlan(p=>{p.pace=n as typeof p.pace;})}/>
          <p className="border-t border-white/10 pt-2 text-xs uppercase text-zinc-400">Visual theme</p>
          <TextInput label="Biome" value={current.theme.biome} save={n=>editTheme(t=>{t.biome=n;})}/>
          <NumberInput label="Ambient" value={current.theme.ambient} save={n=>editTheme(t=>{t.ambient=n;})}/>
          <NumberInput label="Vegetation (0–1)" value={current.theme.vegetation} save={n=>editTheme(t=>{t.vegetation=Math.max(0,Math.min(1,n));})}/>
          <div className="grid grid-cols-3 gap-2">
            {paletteKeys.map(key=><label key={key} className="text-[10px] text-zinc-400">{key}
              <input key={key+current.theme.palette[key]} type="color" defaultValue={current.theme.palette[key]}
                className="block h-8 w-full cursor-pointer" onBlur={e=>{
                  if(e.target.value!==current.theme.palette[key])editTheme(t=>{t.palette[key]=e.target.value;});
                }}/></label>)}
          </div>
          {current.theme.surfaces&&<details>
            <summary className="cursor-pointer text-xs text-zinc-400">Surface materials</summary>
            {(["floor","wall","cover","stair","platform"] as const).map(slot=><div key={slot} className="mt-2">
              <label className="block text-xs">{slot} texture<select aria-label={slot+" texture"} className={control} value={current.theme.surfaces![slot].textureId??""} onChange={e=>editTheme(t=>{
                if(!t.surfaces)return;const recipe=t.surfaces[slot];if(e.target.value)recipe.textureId=e.target.value;else delete recipe.textureId;
              })}><option value="">Procedural pattern</option>{MAP_TEXTURES.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              {mapTexture(current.theme.surfaces![slot].textureId)&&<img alt={slot+" selected texture preview"} className="h-20 w-20 border border-white/20" style={{imageRendering:"pixelated"}} src={mapTexture(current.theme.surfaces![slot].textureId)!.path}/>}
              <Picker label={slot+" fallback pattern"} value={current.theme.surfaces![slot].pattern}
                options={["concrete","metal","grate","planks","rust","moss","brick","stone","pavers","snow","asphalt","grass"]}
                save={v=>editTheme(t=>{if(t.surfaces)t.surfaces[slot].pattern=v as SurfacePattern;})}/>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="Tile units" value={current.theme.surfaces![slot].tileSize} save={v=>editTheme(t=>{if(t.surfaces)t.surfaces[slot].tileSize=v;})}/>
                <NumberInput label="Roughness" value={current.theme.surfaces![slot].roughness} save={v=>editTheme(t=>{if(t.surfaces)t.surfaces[slot].roughness=Math.max(0,Math.min(1,v));})}/>
              </div>
            </div>)}
          </details>}
          <button className={btn+" w-full"} disabled={!MAP_DOCUMENTS[id]} onClick={()=>{
            if(!window.confirm("Restore shipped "+id+"? You can undo."))return;
            edit(d=>{d[id]=clone(MAP_DOCUMENTS[id]);},"Restored shipped map");
          }}><RotateCcw className="h-3.5 w-3.5"/> Restore shipped map</button>
        </div>}
        <section className="mt-5 border-t border-white/10 pt-3 text-xs">
          <strong className="text-zinc-300">Validation</strong>
          <p className="my-2 text-zinc-400">{faults.length} structural problems · {issues.filter(i=>i.severity==="error").length} placement errors · {issues.filter(i=>i.severity==="warning").length} warnings</p>
          <div className="max-h-40 space-y-1 overflow-auto">
            {faults.map((m,i)=><p className="text-rose-300" key={i}>{m}</p>)}
            {issues.slice(0,25).map((p,i)=><div key={i} className={p.severity==="error"?"text-rose-300":"text-amber-300"}>
              <p>{p.message}</p>{p.featureId&&<button className={btn+" mt-1"} onClick={()=>{const index=plan.features.findIndex(f=>f.id===p.featureId);if(index>=0){setSelection({type:"feature",index});setTool("select");}}}>Select object</button>}
              {p.canJoin&&<button className={btn+" ml-1 mt-1"} onClick={()=>editPlan(bp=>{const a=bp.features.findIndex(f=>f.id===p.featureId),b=bp.features.find(f=>f.id===p.relatedFeatureId);if(a>=0&&b){const joined=joinFeatureFaces(bp.features[a],b);if(joined)bp.features[a]=joined;}},"Closed measured wall gap")}>Close gap</button>}
            </div>)}
            {!faults.length&&!issues.length&&<p className="text-emerald-300">Automated checks clear. Still playtest movement and spawns.</p>}
          </div>
          <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={showCollision} onChange={e=>setShowCollision(e.target.checked)}/> Collision boxes</label>
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={showIssues} onChange={e=>setShowIssues(e.target.checked)}/> Safety markers</label>
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={showRoutes} onChange={e=>setShowRoutes(e.target.checked)}/> District links</label>
          <Picker label="Offline playtest bots" value={String(bots)} options={["0","3","6"]} save={n=>setBots(Number(n))}/>
          {((plan.legacyCoverDisabled?.length??0)+(plan.legacyEnvironmentDisabled?.length??0))>0&&
            <details className="mt-3"><summary>Hidden built-in objects</summary>
              {(plan.legacyCoverDisabled??[]).map(n=><button key={"c"+n} className={btn+" m-1"} onClick={()=>editPlan(p=>{p.legacyCoverDisabled=toggleOriginalIndex(p.legacyCoverDisabled,n,false);})}>Restore cover {n}</button>)}
              {(plan.legacyEnvironmentDisabled??[]).map(n=><button key={"e"+n} className={btn+" m-1"} onClick={()=>editPlan(p=>{p.legacyEnvironmentDisabled=toggleOriginalIndex(p.legacyEnvironmentDisabled,n,false);})}>Restore hazard {n}</button>)}
            </details>}
        </section>
      </aside>
    </div>
    <footer className="flex shrink-0 items-center gap-4 border-t border-white/10 bg-[#10151c] px-3 py-1 text-[11px] text-zinc-400">
      <span className="whitespace-nowrap text-amber-300">{libraryDirty} · {id}</span>
      <span role="status" className="truncate">{message}</span>
      <span className="ml-auto hidden whitespace-nowrap md:block">Auto-save · Single JSON per map · No direct multiplayer publishing</span>
    </footer>
  </main>;
}
