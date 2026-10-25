"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MapStudio3D, {type StudioSelection,type StudioMode,type StudioTransform} from "./MapStudio3D";
import {
  MAP_BLUEPRINTS, insideRegions, validateBlueprint, nearestPlatformSnap, snapCoverToPlatform, stairFeatureBoxes, regionRectangles,
  type MapBlueprint, type MapBlueprintFile, type MapFeature, type MapRegion, type MapHazard,
} from "@/lib/map-blueprints";
import { MAP_VISUAL_THEMES, visualThemeForMap, SURFACE_PATTERNS, type MapVisualTheme, type MapProp } from "@/lib/map-visuals";
import { getMap } from "@/lib/game-protocol";
import { overrideBox } from "@/lib/map-blueprints";
import { stairFlightBounds, transformStairFlight, maxLegacyFlightRise } from "@/lib/legacy-stair-flights";
import { legacyCoverToFeature, legacyFlightToFeature, legacyEnvironmentToHazard, toggleOriginalIndex } from "@/lib/map-object-actions";
import { elevationSpan, yAtElevationFace, type ElevationAnchor } from "@/lib/map-studio-elevation";
import { ArrowLeft, Copy, Download, FileUp, Plus, RotateCcw, Trash2, MousePointer2, Grid2x2, Layers3, Flag, AlertTriangle, Save } from "lucide-react";

type BlueprintDoc = Omit<MapBlueprintFile,"maps"> & {maps:Record<string,MapBlueprint>};
type Team="ffa"|"red"|"blue";
type Selection=StudioSelection;
type Tool="select"|"region"|"circle"|"triangle"|"cover"|"platform"|"stairs"|"hazard"|"prop"|"ffa"|"red"|"blue";
type Point={x:number;z:number};
type Drag =
  | {mode:"create";start:Point;tool:Tool}
  | {mode:"move";start:Point;item:Selection;source:MapRegion|MapFeature|MapHazard|MapProp|[number,number,number]};
const STARTER:BlueprintDoc=MAP_BLUEPRINTS as BlueprintDoc;
const snap=(n:number,step=2)=>Math.round(n/step)*step;
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const color:Record<Team,string>={ffa:"#fbbf24",red:"#f87171",blue:"#38bdf8"};
const fieldClass="w-full rounded-md border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-amber-400/70 outline-none";
const btn="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-zinc-800/80 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-30";

export default function MapEditor() {
  const [doc,setDoc]=useState<BlueprintDoc>(()=>clone(STARTER));
  const [mapId,setMapId]=useState("compound");
  const [editorTab,setEditorTab]=useState<"blueprint"|"theme">("blueprint");
  const [hazardKind,setHazardKind]=useState<MapHazard["type"]>("fire");
  const [propKind,setPropKind]=useState<MapProp["kind"]>("tree");
  const [themes,setThemes]=useState<Record<string,MapVisualTheme>>(()=>clone(MAP_VISUAL_THEMES));
  const [tool,setTool]=useState<Tool>("select");
  const [selected,setSelected]=useState<Selection|null>(null);
  const [preview,setPreview]=useState<{start:Point;end:Point}|null>(null);
  const [newId,setNewId]=useState("");
  const [zoom,setZoom]=useState(100);
  const [viewport,setViewport]=useState<"3d"|"2d">("3d");
  const [editMode,setEditMode]=useState<StudioMode>("select");
  const [gridSnapEnabled,setGridSnapEnabled]=useState(true);
  const [gridSnapStep,setGridSnapStep]=useState(2);
  const [status,setStatus]=useState("Export the JSON into src/data/map-blueprints.json to publish changes.");
  const svg=useRef<SVGSVGElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const themeFileRef=useRef<HTMLInputElement>(null);
  const drag=useRef<Drag|null>(null);
  const history=useRef<BlueprintDoc[]>([]);
  const map=doc.maps[mapId];
  // A newly authored map does not enter the compiled runtime registry until
  // export and rebuild; preview its chosen template rather than always compound.
  const compiledMap=getMap(mapId);
  const baseMap=compiledMap.id===mapId?compiledMap:getMap(map?.templateMapId);
  const canEditBuiltIn=compiledMap.id===mapId;
  const theme=themes[mapId]??visualThemeForMap(mapId,map?.templateMapId);
  const updateTheme=(fn:(t:MapVisualTheme)=>MapVisualTheme)=>setThemes(prev=>({
    ...prev,[mapId]:fn(prev[mapId]??clone(visualThemeForMap(mapId,map?.templateMapId)))
  }));
  const downloadJSON=(name:string,value:unknown)=>{
    const blob=new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const exportTheme=()=>{downloadJSON(mapId+".json",theme);setStatus("Exported "+mapId+".json. Register new themes in src/lib/map-visuals.ts.");};
  const importTheme=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const t=JSON.parse(await file.text()) as MapVisualTheme;
      if(!t.biome||!t.label||!t.palette||!Array.isArray(t.props)||!Number.isFinite(t.ambient)||!Number.isFinite(t.vegetation))
        throw Error("Expected a map theme with biome, palette, ambient, vegetation and props.");
      for(const key of ["floor","wall","cover","accent","platform","stair","sky","fog","grid"] as const)
        if(!/^#[a-fA-F0-9]{6}$/.test(t.palette[key]))throw Error("Invalid palette color "+key);
      setThemes(old=>({...old,[mapId]:t}));setStatus("Imported theme for "+mapId+".");
    }catch(err){setStatus("Theme import failed: "+String(err));}
    e.target.value="";
  };

  useEffect(()=>{
    try {
      const saved=localStorage.getItem("vanguard-map-studio-v1");
      if(saved){const parsed=JSON.parse(saved) as BlueprintDoc;
        if(parsed.version===1 && parsed.maps && Object.keys(parsed.maps).length) {
          setDoc(parsed);setStatus("Restored local map draft.");
        }
      }
    }catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem("vanguard-map-studio-v1",JSON.stringify(doc));}catch{}},[doc]);
  useEffect(()=>{
    try{
      const saved=localStorage.getItem("vanguard-map-studio-themes-v1");
      if(saved){const parsed=JSON.parse(saved) as Record<string,MapVisualTheme>;if(parsed&&typeof parsed==="object")setThemes(old=>({...old,...parsed}));}
    }catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem("vanguard-map-studio-themes-v1",JSON.stringify(themes));}catch{}},[themes]);
  const pushUndo=()=>{history.current=[...history.current.slice(-24),clone(doc)];};
  const update=(fn:(m:MapBlueprint)=>MapBlueprint)=>{
    setDoc(prev=>({...prev,maps:{...prev.maps,[mapId]:fn(prev.maps[mapId])}}));
  };
  const getPoint=(e:React.PointerEvent<SVGSVGElement>):Point=>{
    const s=svg.current; if(!s)return {x:0,z:0};
    const p=s.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
    const matrix=s.getScreenCTM();
    if(!matrix)return {x:0,z:0};
    const world=p.matrixTransform(matrix.inverse());
    const toGrid=(n:number)=>gridSnapEnabled?snap(n,gridSnapStep):Math.round(n*100)/100;
    return {x:toGrid(world.x),z:toGrid(world.y)};
  };
  const beginMove=(e:React.PointerEvent<SVGElement>,sel:Selection)=>{
    if(tool!=="select")return;
    e.stopPropagation();pushUndo();
    const pos=getPoint(e as unknown as React.PointerEvent<SVGSVGElement>);
    const source=sel.type==="region"?map.regions[sel.index]:
      sel.type==="feature"?map.features[sel.index]:
      sel.type==="hazard"?(map.hazards??[])[sel.index]:
      sel.type==="prop"?theme.props[sel.index]:map.spawns[sel.team!][sel.index];
    drag.current={mode:"move",item:sel,start:pos,source:clone(source)};
    setSelected(sel);svg.current?.setPointerCapture(e.pointerId);
  };
  const onPointerDown=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(e.button!==0)return;
    const pos=getPoint(e);
    if(tool==="select"){setSelected(null);return;}
    pushUndo();drag.current={mode:"create",start:pos,tool};
    setPreview({start:pos,end:pos});
    svg.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(!drag.current)return;
    const p=getPoint(e),d=drag.current;
    if(d.mode==="create"){setPreview({start:d.start,end:p});return;}
    const dx=p.x-d.start.x,dz=p.z-d.start.z,source=d.source,sel=d.item;
    if(sel.type==="prop"){
      updateTheme(t=>({...t,props:t.props.map((item,i)=>i===sel.index?
        {...item,x:(source as MapProp).x+dx,z:(source as MapProp).z+dz}:item)}));
      return;
    }
    update(m=>{
      if(sel.type==="region")return {...m,regions:m.regions.map((r,i)=>i===sel.index?
        {...r,x:(source as MapRegion).x+dx,z:(source as MapRegion).z+dz}:r)};
      if(sel.type==="feature")return {...m,features:m.features.map((f,i)=>i===sel.index?
        {...f,x:(source as MapFeature).x+dx,z:(source as MapFeature).z+dz}:f)};
      if(sel.type==="hazard")return {...m,hazards:(m.hazards??[]).map((h,i)=>i===sel.index?
        {...h,x:(source as MapHazard).x+dx,z:(source as MapHazard).z+dz}:h)};
      const team=sel.team!;
      return {...m,spawns:{...m.spawns,[team]:m.spawns[team].map((v,i)=>i===sel.index?
        [((source as number[])[0])+dx,(source as number[])[1],((source as number[])[2])+dz] as [number,number,number]:v)}};
    });
  };
  const onPointerUp=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(!drag.current)return;
    const d=drag.current;
    if(d.mode==="create"){
      const p=getPoint(e),start=d.start;
      if(["red","blue","ffa"].includes(d.tool)){
        const team=d.tool as Team,index=map.spawns[team].length;
        update(m=>({...m,spawns:{...m.spawns,[team]:[...m.spawns[team],[p.x,0,p.z]]}}));
        setSelected({type:"spawn",team,index});
      }else{
        const w=Math.max(["region","circle","triangle"].includes(d.tool)?12:4,Math.abs(p.x-start.x));
        const depth=Math.max(["region","circle","triangle"].includes(d.tool)?12:4,Math.abs(p.z-start.z));
        const x=(start.x+p.x)/2,z=(start.z+p.z)/2;
        if(["region","circle","triangle"].includes(d.tool)){
          const index=map.regions.length;
          update(m=>({...m,regions:[...m.regions,{x,z,w,d:depth,shape:d.tool==="region"?"rect":d.tool as "circle"|"triangle"}]}));
          setSelected({type:"region",index});
        }else if(d.tool==="hazard"){
          const index=(map.hazards??[]).length;
          const base:MapHazard={id:"hazard_"+Date.now().toString(36),type:hazardKind,x,z,y:1,w,d:depth,h:2,
            dps:7,damage:25,period:5,activeFor:2,hp:120,launchY:18,toX:x+12,toY:1,toZ:z};
          update(m=>({...m,hazards:[...(m.hazards??[]),base]}));
          setSelected({type:"hazard",index});
        }else if(d.tool==="prop"){
          const index=theme.props.length;
          const p:MapProp={kind:propKind,x,z,w,d:depth,h:Math.max(2,w)};
          updateTheme(t=>({...t,props:[...t.props,p]}));
          setSelected({type:"prop",index});setEditorTab("theme");
        }else{
          const index=map.features.length;
          const kind=d.tool as "cover"|"platform"|"stairs";
          const feature:MapFeature={id:`custom-${Date.now().toString(36)}-${index}`,
            x,z,w:Math.max(w,kind==="platform"?10:4),d:Math.max(depth,kind==="platform"?10:4),
            h:kind==="platform"||kind==="stairs"?4.2:2.8,kind,label:"New "+kind,
            ...(kind==="stairs"?{axis:"z" as const,sign:1 as const}: {})};
          update(m=>({...m,features:[...m.features,feature]}));
          setSelected({type:"feature",index});
        }
      }
      setTool("select");
    }
    drag.current=null;setPreview(null);
    try{svg.current?.releasePointerCapture(e.pointerId);}catch{}
  };
  const legacyFlight=(index:number)=>baseMap.editorLegacyStairFlights?.find(f=>f.start===index);
  const effectiveLegacyCover=()=>(baseMap.editorLegacyCoverSource??baseMap.cover).map((box,i)=>
    overrideBox(box,map.legacyCoverOverrides?.[String(i)]));
  const legacyFlightBounds=(index:number)=>{
    const flight=legacyFlight(index);
    if(!flight)return null;
    const effective=effectiveLegacyCover();
    return stairFlightBounds(flight.indices.map(i=>effective[i]));
  };
  /** One editor action updates every collision tread in this flight.
   * Preserve stable source indices for publishing in legacyCoverOverrides. */
  const editLegacyFlight=(index:number,t:StudioTransform)=>{
    const flight=legacyFlight(index);
    if(!flight)return;
    const effective=effectiveLegacyCover();
    const current=stairFlightBounds(flight.indices.map(i=>effective[i]));
    const maximum=Math.max(current.h,maxLegacyFlightRise(flight.indices.length)+.02);
    if(t.h>maximum+.001){
      setStatus(`This original flight has ${flight.indices.length} steps. Maximum safe rise: ${maximum.toFixed(2)}u. For taller stairs add a new authored flight, which generates more steps.`);
      return;
    }
    const changes=transformStairFlight(effective,flight.indices,t);
    pushUndo();
    update(m=>({...m,legacyCoverOverrides:{...(m.legacyCoverOverrides??{}),...changes}}));
    setStatus(`Updated the entire staircase (${flight.indices.length} treads) in one edit.`);
  };
  const changeSelected=(key:string,value:string|number|boolean)=>{
    if(!selected)return;
    const sel=selected;
    if(sel.type==="legacyStairs"){
      const bounds=legacyFlightBounds(sel.index);
      if(bounds&&["x","y","z","w","h","d"].includes(key))
        editLegacyFlight(sel.index,{...bounds,[key]:Number(value),turns:0});
      return;
    }
    pushUndo();
    if(sel.type==="legacyCover"||sel.type==="legacyEnvironment"){
      const overridesKey=sel.type==="legacyCover"?"legacyCoverOverrides":"legacyEnvironmentOverrides";
      const base=baseMap;
      const source=sel.type==="legacyCover"?(base.editorLegacyCoverSource?.[sel.index]??base.cover[sel.index]):(base.editorLegacyEnvironmentSource?.[sel.index]??base.environment?.[sel.index]);
      if(!source)return;
      const initial={x:source.pos[0],y:source.pos[1],z:source.pos[2],
        w:source.size[0]*2,h:source.size[1]*2,d:source.size[2]*2};
      update(m=>({...m,[overridesKey]:{...(m[overridesKey]??{}),
        [sel.index]:{...initial,...m[overridesKey]?.[String(sel.index)],[key]:Number(value)}}}));
      return;
    }
    if(sel.type==="prop"){
      updateTheme(t=>({...t,props:t.props.map((p,i)=>i===sel.index?
        {...p,[key]:["kind","text","color"].includes(key)?value:Number(value)}:p)}));
      return;
    }
    update(m=>{
      if(sel.type==="region"){
        return {...m,regions:m.regions.map((r,i)=>i===sel.index?
          {...r,[key]:key==="shape"?value:Number(value)}:r)};
      }
      if(sel.type==="feature"){
        return {...m,features:m.features.map((r,i)=>i===sel.index?
          {...r,[key]:["id","kind","label","axis","autoStairs"].includes(key)?value:Number(value)}:r)};
      }
      if(sel.type==="hazard")return {...m,hazards:(m.hazards??[]).map((h,i)=>i===sel.index?
        {...h,[key]:["id","type"].includes(key)?value:Number(value)}:h)};
      const t=sel.team!,axis=Number(key);
      return {...m,spawns:{...m.spawns,[t]:m.spawns[t].map((r,i)=>i===sel.index?
        r.map((v,j)=>j===axis?Number(value):v) as [number,number,number]:r)}};
    });
  };
  const remove=()=>{
    if(!selected)return;
    const selectedItem=selected;
    if(selectedItem.type==="legacyStairs"){
      const flight=legacyFlight(selectedItem.index);
      if(!flight)return;
      pushUndo();
      update(m=>{
        let disabled=m.legacyCoverDisabled??[];
        for(const index of flight.indices)disabled=toggleOriginalIndex(disabled,index,true);
        return {...m,legacyCoverDisabled:disabled};
      });
      setStatus(`Deleted built-in staircase (${flight.indices.length} treads). Restore it below, or Undo.`);
      setSelected(null);return;
    }
    if(selectedItem.type==="legacyCover"||selectedItem.type==="legacyEnvironment"){
      pushUndo();
      const key=selectedItem.type==="legacyCover"?"legacyCoverDisabled":"legacyEnvironmentDisabled";
      update(m=>({...m,[key]:toggleOriginalIndex(m[key],selectedItem.index,true)}));
      setStatus("Deleted built-in object. Its gameplay collision is excluded after exporting and rebuilding.");
      setSelected(null);return;
    }
    pushUndo();
    if(selectedItem.type==="prop"){
      updateTheme(t=>({...t,props:t.props.filter((_,i)=>i!==selectedItem.index)}));
      setSelected(null);return;
    }
    update(m=>selectedItem.type==="region"?{...m,regions:m.regions.filter((_,i)=>i!==selectedItem.index)}:
      selectedItem.type==="feature"?{...m,features:m.features.filter((_,i)=>i!==selectedItem.index)}:
      selectedItem.type==="hazard"?{...m,hazards:(m.hazards??[]).filter((_,i)=>i!==selectedItem.index)}:
      {...m,spawns:{...m.spawns,[selectedItem.team!]:m.spawns[selectedItem.team!].filter((_,i)=>i!==selectedItem.index)}});
    setSelected(null);
  };
  const resetLegacyEdits=()=>{
    if(!selected)return;
    const item=selected;
    if(item.type==="legacyStairs"){
      const flight=legacyFlight(item.index);
      if(!flight)return;
      pushUndo();
      update(m=>{
        const overrides={...(m.legacyCoverOverrides??{})};
        for(const i of flight.indices)delete overrides[String(i)];
        return {...m,legacyCoverOverrides:overrides};
      });
      setStatus("Reset all stair tread edits to the original dimensions.");
    }else if(item.type==="legacyCover"||item.type==="legacyEnvironment"){
      pushUndo();
      const key=item.type==="legacyCover"?"legacyCoverOverrides":"legacyEnvironmentOverrides";
      update(m=>{
        const overrides={...(m[key]??{})};
        delete overrides[String(item.index)];
        return {...m,[key]:overrides};
      });
      setStatus("Reset object position and dimensions to their original values.");
    }
  };
  const duplicate=()=>{
    if(!selected)return;
    const item=selected;
    const suffix=Date.now().toString(36);
    if(item.type==="legacyStairs"){
      const flight=legacyFlight(item.index);
      if(!flight)return;
      const boxes=effectiveLegacyCover();
      const stair=legacyFlightToFeature(flight.indices.map(i=>boxes[i]),`copied_stairs_${suffix}_${map.features.length}`);
      pushUndo();
      const index=map.features.length;
      update(m=>({...m,features:[...m.features,stair]}));
      setSelected({type:"feature",index});setEditMode("move");
      setStatus("Duplicated the original staircase as a single editable, auto-generated stair flight.");
      return;
    }
    if(item.type==="legacyCover"){
      const box=effectiveLegacyCover()[item.index];
      if(!box)return;
      const feature=legacyCoverToFeature(box,`copied_cover_${suffix}_${map.features.length}`);
      pushUndo();
      const index=map.features.length;
      update(m=>({...m,features:[...m.features,feature]}));
      setSelected({type:"feature",index});setEditMode("move");
      setStatus("Duplicated the built-in object as editable map geometry.");
      return;
    }
    if(item.type==="legacyEnvironment"){
      const original=baseMap.editorLegacyEnvironmentSource?.[item.index]??baseMap.environment?.[item.index];
      if(!original)return;
      const box=overrideBox(original,map.legacyEnvironmentOverrides?.[String(item.index)]);
      const hazard=legacyEnvironmentToHazard(box,`copied_hazard_${suffix}_${(map.hazards??[]).length}`);
      pushUndo();
      const index=(map.hazards??[]).length;
      update(m=>({...m,hazards:[...(m.hazards??[]),hazard]}));
      setSelected({type:"hazard",index});setEditMode("move");
      setStatus("Duplicated the built-in hazard as an independently editable authored hazard.");
      return;
    }
    if(item.type==="spawn"){
      const spawn=map.spawns[item.team!][item.index];
      if(!spawn)return;
      pushUndo();
      const index=map.spawns[item.team!].length;
      update(m=>({...m,spawns:{...m.spawns,[item.team!]:[...m.spawns[item.team!],
        [spawn[0]+10,spawn[1],spawn[2]] as [number,number,number]]}}));
      setSelected({type:"spawn",team:item.team,index});
      return;
    }
    pushUndo();
    if(item.type==="region"){const index=map.regions.length;
      update(m=>({...m,regions:[...m.regions,{...m.regions[item.index],x:m.regions[item.index].x+12}]}));
      setSelected({type:"region",index});
    }else if(item.type==="hazard"){
      const index=(map.hazards??[]).length;
      update(m=>({...m,hazards:[...(m.hazards??[]),{...m.hazards![item.index],id:"copy_"+suffix+"_"+index,x:m.hazards![item.index].x+10}]}));
      setSelected({type:"hazard",index});
    }else if(item.type==="prop"){
      const index=theme.props.length;
      updateTheme(t=>({...t,props:[...t.props,{...t.props[item.index],x:t.props[item.index].x+10}]}));
      setSelected({type:"prop",index});
    }else if(item.type==="feature"){
      const index=map.features.length;
      update(m=>({...m,features:[...m.features,
        {...m.features[item.index],id:`copy_${suffix}_${index}`,x:m.features[item.index].x+10}]}));
      setSelected({type:"feature",index});
    }
  };
  const createMap=()=>{
    const id=newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"_");
    if(!id||doc.maps[id]){setStatus("Choose a new, unique map ID.");return;}
    pushUndo();
    const template=map.templateMapId || (["bunker","shipyard","compound","terminal","skybridge","arena_neon"].includes(mapId)?mapId:"compound");
    setDoc(v=>({...v,maps:{...v.maps,[id]:{...clone(map),name:id.replace(/_/g," ").toUpperCase(),shortName:id.slice(0,3).toUpperCase(),templateMapId:template}}}));
    setThemes(old=>({...old,[id]:clone(theme)}));
    setMapId(id);setSelected(null);setNewId("");setStatus(`Created ${id}. Export JSON and restart the game dev server to make it playable.`);
  };
  const undo=()=>{
    const previous=history.current.pop();if(previous){setDoc(previous);setSelected(null);setStatus("Undid last edit.");}
  };
  const exportFile=()=>{
    const blob=new Blob([JSON.stringify(doc,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="map-blueprints.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus("Downloaded map-blueprints.json. Replace src/data/map-blueprints.json in the repository to publish.");
  };
  const importFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    try {
      const parsed=JSON.parse(await file.text()) as BlueprintDoc;
      if(parsed.version!==1||!parsed.maps||!Object.keys(parsed.maps).length)throw new Error("Expected version 1 and a maps dictionary");
      for(const [id,b] of Object.entries(parsed.maps)){
        if(!/^[a-z0-9_-]+$/.test(id))throw new Error("Invalid map ID "+id);
        if(!b.regions||!b.features||!b.spawns)throw new Error("Missing fields on "+id);
      }
      pushUndo();setDoc(parsed);setMapId(Object.keys(parsed.maps)[0]);setSelected(null);
      setStatus("JSON imported. Review validation warnings before publishing.");
    }catch(err){setStatus("Import failed: "+(err instanceof Error?err.message:String(err)));}
    e.target.value="";
  };
  const legacyObject=(sel:Selection)=>{
    const source=sel.type==="legacyCover"?(baseMap.editorLegacyCoverSource?.[sel.index]??baseMap.cover[sel.index]):(baseMap.editorLegacyEnvironmentSource?.[sel.index]??baseMap.environment?.[sel.index]);
    if(!source)return null;
    const original={x:source.pos[0],y:source.pos[1],z:source.pos[2],
      w:source.size[0]*2,h:source.size[1]*2,d:source.size[2]*2};
    const existing=sel.type==="legacyCover"?map.legacyCoverOverrides?.[String(sel.index)]:
      map.legacyEnvironmentOverrides?.[String(sel.index)];
    return {...original,...existing};
  };
  const apply3DTransform=(sel:StudioSelection,t:StudioTransform)=>{
    if(sel.type==="legacyStairs"){editLegacyFlight(sel.index,t);return;}
    pushUndo();
    if(sel.type==="legacyCover"||sel.type==="legacyEnvironment"){
      const key=sel.type==="legacyCover"?"legacyCoverOverrides":"legacyEnvironmentOverrides";
      update(m=>({...m,[key]:{...(m[key]??{}),
        [sel.index]:{x:t.x,y:t.y,z:t.z,w:t.w,h:t.h,d:t.d}}}));
      return;
    }
    if(sel.type==="prop"){
      updateTheme(current=>({...current,props:current.props.map((p,i)=>i===sel.index?
        {...p,x:t.x,y:t.y,z:t.z,w:t.w,h:t.h,d:t.d}:p)}));
      return;
    }
    update(current=>{
      if(sel.type==="region")return {...current,regions:current.regions.map((r,i)=>i===sel.index?
        {...r,x:t.x,z:t.z,w:t.w,d:t.d}:r)};
      if(sel.type==="feature")return {...current,features:current.features.map((f,i)=>{
        if(i!==sel.index)return f;
        const quarter=((t.turns%4)+4)%4;
        const rotate=quarter*Math.PI/2;
        const axis=f.axis??"z",sign=f.sign??1;
        const dx=axis==="x"?sign:0,dz=axis==="z"?sign:0;
        const rotatedX=Math.round(Math.cos(rotate)*dx+Math.sin(rotate)*dz);
        const rotatedZ=Math.round(-Math.sin(rotate)*dx+Math.cos(rotate)*dz);
        return {...f,x:t.x,y:t.y,z:t.z,h:Math.max(.3,t.h),
          w:f.kind==="stairs"&&quarter%2?t.d:t.w,
          d:f.kind==="stairs"&&quarter%2?t.w:t.d,
          ...(f.kind==="stairs"?{axis:rotatedX!==0?"x" as const:"z" as const,
            sign:(rotatedX!==0?rotatedX:rotatedZ) as 1|-1}:{})};
      })};
      if(sel.type==="hazard")return {...current,hazards:(current.hazards??[]).map((h,i)=>i===sel.index?
        {...h,x:t.x,y:t.y,z:t.z,w:t.w,h:t.h,d:t.d}:h)};
      if(sel.type==="spawn"){
        const team=sel.team!;
        return {...current,spawns:{...current.spawns,[team]:current.spawns[team].map((p,i)=>i===sel.index?
          [t.x,t.y,t.z] as [number,number,number]:p)}};
      }
      return current;
    });
  };
  const add3DAt=(kind:string,point:{x:number;z:number})=>{
    const x=gridSnapEnabled?snap(point.x,gridSnapStep):Math.round(point.x*100)/100;
    const z=gridSnapEnabled?snap(point.z,gridSnapStep):Math.round(point.z*100)/100;
    pushUndo();
    if(["region","circle","triangle"].includes(kind)){
      const index=map.regions.length;
      update(m=>({...m,regions:[...m.regions,{x,z,w:32,d:32,
        shape:kind==="region"?"rect":kind as "circle"|"triangle"}]}));
      setSelected({type:"region",index});
    }else if(["cover","platform","stairs"].includes(kind)){
      const index=map.features.length;
      const featureKind=kind as "cover"|"platform"|"stairs";
      const feature:MapFeature={id:"editor_"+Date.now().toString(36)+"_"+index,
        kind:featureKind,x,z,w:featureKind==="stairs"?4:12,
        d:featureKind==="stairs"?8:12,h:featureKind==="cover"?2.8:4.2,
        ...(featureKind==="stairs"?{axis:"z" as const,sign:1 as const}:{})};
      update(m=>({...m,features:[...m.features,feature]}));
      setSelected({type:"feature",index});
    }else if(kind==="hazard"){
      const index=(map.hazards??[]).length;
      const item:MapHazard={id:"hazard_"+Date.now().toString(36)+"_"+index,
        type:hazardKind,x,y:1,z,w:6,h:2,d:6,dps:7,damage:25,
        period:5,activeFor:2,hp:120,launchY:18,toX:x+10,toY:1,toZ:z};
      update(m=>({...m,hazards:[...(m.hazards??[]),item]}));
      setSelected({type:"hazard",index});
    }else if(kind==="prop"){
      const index=theme.props.length;
      updateTheme(t=>({...t,props:[...t.props,{kind:propKind,x,z,w:5,d:5,h:5}]}));
      setSelected({type:"prop",index});
    }else if(["ffa","red","blue"].includes(kind)){
      const team=kind as Team,index=map.spawns[team].length;
      update(m=>({...m,spawns:{...m.spawns,[team]:[...m.spawns[team],[x,0,z]]}}));
      setSelected({type:"spawn",team,index});
    }
    setTool("select");
    setEditMode("move");
    setStatus("Created object at the 3D camera focus. Move or resize it, then export JSON.");
  };
  const selectedObject=selected?(selected.type==="legacyStairs"?legacyFlightBounds(selected.index):
    selected.type==="legacyCover"||selected.type==="legacyEnvironment"?
    legacyObject(selected):selected.type==="region"?map.regions[selected.index]:
    selected.type==="feature"?map.features[selected.index]:
    selected.type==="hazard"?(map.hazards??[])[selected.index]:
    selected.type==="prop"?theme.props[selected.index]:map.spawns[selected.team!][selected.index]):null;
  // Authored solids and props store Y at their base. Engine boxes and hazards
  // store Y at their center. Expose both faces with consistent world elevation.
  const selectedAnchor:ElevationAnchor=selected?.type==="feature"||selected?.type==="prop"?"bottom":
    selected?.type==="spawn"?"point":"center";
  const selectedDimensions=selected&&selectedObject&&selected.type!=="region"?
    selected.type==="spawn"?{y:(selectedObject as number[])[1],h:0}:
    {y:(selectedObject as {y?:number}).y??0,
      h:(selectedObject as {h?:number}).h??(selected.type==="prop"?5:0)}:null;
  const selectedSpan=selectedDimensions?
    elevationSpan(selectedDimensions.y,selectedDimensions.h,selectedAnchor):null;
  const setPreciseElevation=(face:"bottom"|"top",input:string)=>{
    if(!selected||!selectedSpan||input.trim()==="")return;
    const wanted=Number(input);
    if(!Number.isFinite(wanted))return;
    const y=yAtElevationFace(wanted,selectedSpan.height,selectedAnchor,face);
    changeSelected(selected.type==="spawn"?"1":"y",y);
  };
  const issues=useMemo(()=>{
    if(!map)return [];
    const problems=validateBlueprint(map);
    map.regions.forEach((r,i)=>{
      if(i===0)return;
      if(!map.regions.some((other,j)=>i!==j &&
        Math.abs(r.x-other.x)<(r.w+other.w)/2-0.2 &&
        Math.abs(r.z-other.z)<(r.d+other.d)/2-0.2))
        problems.push(`Region ${i+1} has no connected overlap with another area`);
    });
    for(const [team,positions] of Object.entries(map.spawns) as [Team,[number,number,number][]][])
      positions.forEach((p,i)=>{
        if(map.features.some(f=>f.kind!=="accent" && f.kind!=="stairs" && Math.abs(p[0]-f.x)<f.w/2+1 &&
          Math.abs(p[2]-f.z)<f.d/2+1 && p[1]<(f.y??0)+f.h&&p[1]+1.8>(f.y??0)))
          problems.push(`${team} spawn ${i+1} intersects an authored solid`);
      });
    for(const h of map.hazards??[])for(const [team,points] of Object.entries(map.spawns) as [Team,[number,number,number][]][])
      if(points.some(p=>Math.abs(p[0]-h.x)<h.w/2+1&&Math.abs(p[2]-h.z)<h.d/2+1))
        problems.push(`Hazard ${h.id} intersects a ${team} spawn`);
    return problems;
  },[map]);
  if(!map)return <main className="p-10 bg-zinc-950 text-white">No map selected.</main>;
  const extent=Math.max(85,...map.regions.flatMap(r=>[Math.abs(r.x)+r.w/2,Math.abs(r.z)+r.d/2]))+28;
  const uiHazards=map.hazards??[];
  const inherited=(baseMap.editorLegacyEnvironmentSource??baseMap.environment??[])
    .map((source,index)=>({index,object:overrideBox(source,map.legacyEnvironmentOverrides?.[String(index)])}))
    .filter(({index,object})=>!(map.legacyEnvironmentDisabled??[]).includes(index)&&
      !uiHazards.some(h=>h.id===object.id));
  const inheritedCovers=(baseMap.editorLegacyCoverSource??baseMap.cover)
    .map((source,index)=>({index,box:overrideBox(source,map.legacyCoverOverrides?.[String(index)])}))
    .filter(({index,box})=>box.kind!=="stair"&&!(map.legacyCoverDisabled??[]).includes(index));
  const inheritedStairs=(baseMap.editorLegacyCoverSource??baseMap.cover)
    .filter((o,i)=>o.kind==="stair"&&!(map.legacyCoverDisabled??[]).includes(i));
  const hiddenStairIndexes=new Set((baseMap.editorLegacyStairFlights??[]).flatMap(f=>f.indices));
  const deletedFlights=(baseMap.editorLegacyStairFlights??[])
    .filter(f=>f.indices.some(i=>(map.legacyCoverDisabled??[]).includes(i)));
  const deletedCover=(map.legacyCoverDisabled??[]).filter(i=>!hiddenStairIndexes.has(i));
  const deletedEnvironment=map.legacyEnvironmentDisabled??[];
  const deletedCount=deletedFlights.length+deletedCover.length+deletedEnvironment.length;
  const restoreOriginal=(kind:"flight"|"cover"|"environment",index:number)=>{
    pushUndo();
    if(kind==="flight"){
      const flight=legacyFlight(index);
      if(!flight)return;
      update(m=>{
        let disabled=m.legacyCoverDisabled??[];
        for(const i of flight.indices)disabled=toggleOriginalIndex(disabled,i,false);
        return {...m,legacyCoverDisabled:disabled};
      });
    }else if(kind==="cover"){
      update(m=>({...m,legacyCoverDisabled:toggleOriginalIndex(m.legacyCoverDisabled,index,false)}));
    }else {
      update(m=>({...m,legacyEnvironmentDisabled:toggleOriginalIndex(m.legacyEnvironmentDisabled,index,false)}));
    }
    setStatus("Restored built-in map object. Export JSON to publish this change.");
  };
  const radius=extent*100/zoom;
  const shape=preview?{x:(preview.start.x+preview.end.x)/2,z:(preview.start.z+preview.end.z)/2,
    w:Math.max(4,Math.abs(preview.end.x-preview.start.x)),d:Math.max(4,Math.abs(preview.end.z-preview.start.z))}:null;

  return <div className="min-h-screen bg-[#090b10] text-zinc-100">
    <header className="border-b border-white/10 bg-zinc-950 px-4 py-3 flex flex-wrap items-center gap-3">
      <Link href="/" className={btn}><ArrowLeft size={15}/> Game</Link>
      <div><div className="text-sm font-black tracking-[.22em]">VANGUARD / MAP STUDIO</div>
        <div className="text-[11px] text-zinc-500">Visual authoring • JSON source of truth • local drafts</div></div>
      <div className="ml-auto flex gap-2 flex-wrap">
        <button className={btn} onClick={()=>{setEditorTab("blueprint");setSelected(null);}}>Geometry</button>
        <button className={btn} onClick={()=>{setEditorTab("theme");setSelected(null);}}>Theme & props</button>
        {editorTab==="theme"&&<><button className={btn} onClick={()=>themeFileRef.current?.click()}><FileUp size={14}/> Import theme</button>
          <input ref={themeFileRef} type="file" accept=".json,application/json" className="hidden" onChange={importTheme}/>
          <button className={btn} onClick={exportTheme}><Download size={14}/> Export theme</button></>}
        <button className={btn} onClick={undo} disabled={!history.current.length}><RotateCcw size={14}/> Undo</button>
        <button className={btn} onClick={()=>fileRef.current?.click()}><FileUp size={14}/> Import JSON</button>
        <input ref={fileRef} className="hidden" type="file" accept="application/json,.json" onChange={importFile}/>
        <button className={btn} onClick={async()=>{await navigator.clipboard.writeText(JSON.stringify(doc,null,2));setStatus("JSON copied to clipboard.");}}><Copy size={14}/> Copy JSON</button>
        <button className="inline-flex gap-2 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-2 text-xs" onClick={exportFile}><Download size={14}/> Export JSON</button>
      </div>
    </header>
    <div className="grid grid-cols-1 xl:grid-cols-[275px_minmax(0,1fr)_285px] min-h-[calc(100vh-70px)]">
      <aside className="border-r border-white/10 bg-zinc-950/60 p-4 space-y-5">
        <section>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Map</div>
          <select value={mapId} className={fieldClass} onChange={e=>{setMapId(e.target.value);setSelected(null);setTool("select");}}>
            {Object.entries(doc.maps).map(([id,m])=><option key={id} value={id}>{m.name} ({id})</option>)}
          </select>
          <div className="grid grid-cols-[1fr_auto] gap-1.5 mt-2">
            <input className={fieldClass} value={newId} onChange={e=>setNewId(e.target.value)} placeholder="new_map_id"/>
            <button className={btn} onClick={createMap}><Plus size={14}/> New</button>
          </div>
        </section>
        <section>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{editorTab==="theme"?"Theme props":"Paint tools"}</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["select","Select / Move",MousePointer2],
              ...(editorTab==="theme" ? [["prop","Place prop",Layers3]] as const : [
                ["region","Rectangle",Grid2x2],["circle","Circle / ellipse",Grid2x2],
                ["triangle","Triangle",Grid2x2],
                ["cover","Hard cover",Layers3],["platform","High platform",Layers3],
                ["stairs","Independent stairs",Layers3],["hazard","Place hazard",AlertTriangle],
                ["ffa","FFA spawn",Flag],["red","Red spawn",Flag],["blue","Blue spawn",Flag]
              ] as const)
            ] as readonly (readonly [Tool,string,typeof MousePointer2])[]).map(([key,label,Icon])=>
              <button key={key} onClick={()=>{setTool(key);setSelected(null);}} className={`rounded-lg p-2 border text-left text-xs flex items-center gap-1.5 ${tool===key?"bg-amber-500/15 border-amber-500 text-amber-200":"bg-zinc-900 border-white/10 hover:bg-zinc-800 text-zinc-300"}`}>
                <Icon size={14}/>{label}
              </button>)}
          </div>
          {editorTab==="blueprint"&&<label className="block text-xs text-zinc-400 mt-3">New hazard type
            <select value={hazardKind} className={fieldClass} onChange={e=>setHazardKind(e.target.value as MapHazard["type"])}>
              {(["fire","spikes","jump_pad","moving_platform","destructible_wall"] as const).map(kind=>
                <option key={kind} value={kind}>{kind.replaceAll("_"," ")}</option>)}
            </select></label>}
          {editorTab==="theme"&&<label className="block text-xs text-zinc-400 mt-3">New prop type
            <select value={propKind} className={fieldClass} onChange={e=>setPropKind(e.target.value as MapProp["kind"])}>
              {(["tree","bush","rock","ruin","temple","shop","lamp","container","crane","terminal","sign","antenna","building","boat","dock","garden","bench","bandstand"] as const)
                .map(kind=><option key={kind} value={kind}>{kind}</option>)}
            </select></label>}
          <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
            Drag on the grid to draw regions or structures. Click to place a spawn.
            Use Select to drag and reposition. Adjust exact dimensions in the inspector.
            Platforms can generate two automatic stairs or accept independently placed stair flights.
            Select stairs and click Snap to nearest platform for height/steps.
          </p>
        </section>
        <section className="rounded-lg border border-white/10 bg-zinc-900/45 p-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Placement precision</div>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={gridSnapEnabled} onChange={e=>setGridSnapEnabled(e.target.checked)}/>
            Snap drawing and movement to grid
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-zinc-400 mt-2">Grid step
            <select aria-label="Grid snap step" className={fieldClass+" max-w-24"} value={gridSnapStep}
              disabled={!gridSnapEnabled} onChange={e=>setGridSnapStep(Number(e.target.value))}>
              {[1,2,5,10].map(step=><option key={step} value={step}>{step}u</option>)}
            </select>
          </label>
          <p className="text-[11px] text-zinc-500 mt-2">Snap only affects X/Z placement; Y moves freely. Use Exact vertical placement in the Inspector to enter precise bottom or top elevations.</p>
        </section>
        {editorTab==="theme"&&<section className="rounded-lg border border-white/10 p-3 space-y-2">
          <div className="text-xs font-bold text-amber-300">Visual theme — {mapId}</div>
          <label className="block text-xs">Theme label
            <input className={fieldClass} value={theme.label} onChange={e=>updateTheme(t=>({...t,label:e.target.value}))}/>
          </label>
          <label className="block text-xs">Biome
            <input className={fieldClass} value={theme.biome} onChange={e=>updateTheme(t=>({...t,biome:e.target.value}))}/>
          </label>
          <label className="block text-xs">Ambient intensity
            <input type="number" min="0.01" step=".05" className={fieldClass} value={theme.ambient}
              onChange={e=>updateTheme(t=>({...t,ambient:Number(e.target.value)}))}/>
          </label>
          <label className="block text-xs">Vegetation density (0–1)
            <input type="number" min="0" max="1" step=".05" className={fieldClass} value={theme.vegetation}
              onChange={e=>updateTheme(t=>({...t,vegetation:Number(e.target.value)}))}/>
          </label>
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 pt-2">Palette</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(theme.palette) as (keyof MapVisualTheme["palette"])[]).map(key=><label key={key} className="text-xs capitalize">
              {key}
              <div className="flex items-center gap-1">
                <input type="color" className="w-8 h-7 bg-transparent" value={theme.palette[key]}
                  onChange={e=>updateTheme(t=>({...t,palette:{...t.palette,[key]:e.target.value}}))}/>
                <input className={fieldClass+" min-w-0"} value={theme.palette[key]}
                  onChange={e=>updateTheme(t=>({...t,palette:{...t.palette,[key]:e.target.value}}))}/>
              </div>
            </label>)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 pt-2">Surface materials</div>
          {theme.surfaces&&(["floor","wall","cover","stair","platform"] as const).map(slot=>
            <div key={slot} className="rounded-md border border-white/10 p-2 text-xs">
              <div className="capitalize mb-1">{slot}</div>
              <select className={fieldClass} value={theme.surfaces![slot].pattern}
                onChange={e=>updateTheme(t=>({...t,surfaces:{...t.surfaces!,[slot]:{...t.surfaces![slot],pattern:e.target.value as typeof SURFACE_PATTERNS[number]}}}))}>
                {SURFACE_PATTERNS.map(pattern=><option key={pattern} value={pattern}>{pattern}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <label>Tile size<input className={fieldClass} type="number" step=".2" min=".01" max="100"
                  value={theme.surfaces![slot].tileSize} onChange={e=>updateTheme(t=>({...t,surfaces:{...t.surfaces!,[slot]:{...t.surfaces![slot],tileSize:Number(e.target.value)}}}))}/></label>
                <label>Roughness<input className={fieldClass} type="number" step=".05" min="0" max="1"
                  value={theme.surfaces![slot].roughness} onChange={e=>updateTheme(t=>({...t,surfaces:{...t.surfaces!,[slot]:{...t.surfaces![slot],roughness:Number(e.target.value)}}}))}/></label>
              </div>
            </div>)}
          <p className="text-[11px] text-zinc-500">Theme exports are separate from map-blueprints.json. Props can be selected and moved on the canvas.</p>
        </section>}
        <section>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Map metadata</div>
          <label className="block text-xs text-zinc-400 mb-2">Name
            <input className={fieldClass} value={map.name} onChange={e=>update(m=>({...m,name:e.target.value}))}/></label>
          <label className="block text-xs text-zinc-400 mb-2">Short name
            <input className={fieldClass} value={map.shortName} maxLength={8} onChange={e=>update(m=>({...m,shortName:e.target.value}))}/></label>
          <label className="block text-xs text-zinc-400 mb-2">Pace
            <select className={fieldClass} value={map.pace} onChange={e=>update(m=>({...m,pace:e.target.value as MapBlueprint["pace"]}))}>
              <option value="compact">Compact</option><option value="balanced">Balanced</option><option value="tactical">Tactical</option>
            </select></label>
          <label className="block text-xs text-zinc-400">Description
            <textarea className={fieldClass} rows={3} value={map.description} onChange={e=>update(m=>({...m,description:e.target.value}))}/></label>
        </section>
      </aside>
      <main className="p-3 md:p-5 overflow-hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h1 className="text-xl font-bold">{map.name}</h1>
            <p className="text-xs text-zinc-500">{map.regions.length} regions · {map.features.length} features · {uiHazards.length} hazards · {theme.props.length} props · {Object.values(map.spawns).flat().length} spawn points</p></div>
          {viewport==="2d"&&<label className="text-xs text-zinc-400 flex items-center gap-2">Zoom
            <input aria-label="Zoom" type="range" min="55" max="180" step="5" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>
            <span className="tabular-nums w-10">{zoom}%</span></label>}
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex rounded-md border border-white/15 overflow-hidden" aria-label="Viewport">
            {(["3d","2d"] as const).map(v=><button key={v} className={btn+(viewport===v?" bg-amber-600 text-zinc-950":"")}
              onClick={()=>{setViewport(v);setSelected(null);setEditMode("select");}}>{v.toUpperCase()} view</button>)}
          </div>
          {viewport==="3d"&&<div className="inline-flex rounded-md border border-white/15 flex-wrap" aria-label="Edit mode">
            {(["select","move","rotate","resize"] as StudioMode[]).map(m=><button key={m}
              className={btn+(editMode===m?" bg-amber-500 text-zinc-950":"")}
              onClick={()=>setEditMode(m)}>{m==="select"?"Camera / select":m==="move"?"Move object":m==="rotate"?"Rotate 90°":"Resize object"}</button>)}
          </div>}
          {selected&&<div className="inline-flex items-center gap-1.5">
            <button className={btn} title="Copy the selected object, including built-in map geometry" onClick={duplicate}>
              <Copy size={14}/> Duplicate selected
            </button>
            <button className={btn+" text-rose-300"} title="Delete the selected object from the exported map" onClick={remove}>
              <Trash2 size={14}/> Delete selected
            </button>
          </div>}
          <span className="text-xs text-zinc-500">3D: drag to orbit · right-drag to pan · wheel to zoom · WASD to fly · Q/E elevation · Shift faster</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b1118] overflow-hidden shadow-2xl">
          {viewport==="3d"?
            <MapStudio3D mapId={mapId} map={map} theme={theme} selected={selected}
              mode={editMode} snap={gridSnapEnabled?gridSnapStep:0} tool={tool}
              onSelect={setSelected} onTransform={apply3DTransform} onAddAt={add3DAt}/>:
          <svg ref={svg} viewBox={`${-radius} ${-radius} ${radius*2} ${radius*2}`}
            className="w-full h-[63vh] min-h-[420px] max-h-[880px] select-none"
            style={{touchAction:"none"}} onPointerDown={onPointerDown}
            onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <defs><pattern id="mapgrid" patternUnits="userSpaceOnUse" width="10" height="10">
              <path d="M10 0H0V10" fill="none" stroke="#405063" strokeOpacity=".38" strokeWidth=".28"/>
            </pattern></defs>
            <rect x={-radius} y={-radius} width={radius*2} height={radius*2} fill="url(#mapgrid)"/>
            <path d={`M${-radius} 0 H${radius} M0 ${-radius} V${radius}`} stroke="#8191a3" strokeWidth=".4" strokeDasharray="4 3"/>
            {map.regions.map((r,i)=>{
              const common={fill:editorTab==="theme"?theme.palette.floor:"#15403d",fillOpacity:.43,
                stroke:selected?.type==="region"&&selected.index===i?"#f59e0b":"#34d399",
                strokeWidth:selected?.type==="region"&&selected.index===i?1.6:.65,
                pointerEvents:(tool==="select"?"all":"stroke") as "all"|"stroke",
                style:{cursor:tool==="select"?"move":"crosshair"},
                onPointerDown:(e:React.PointerEvent<SVGElement>)=>beginMove(e,{type:"region",index:i})};
              return r.shape==="circle"?
                <ellipse key={i} {...common} cx={r.x} cy={r.z} rx={r.w/2} ry={r.d/2}/>:
                r.shape==="triangle"?
                <polygon key={i} {...common} points={`${r.x},${r.z-r.d/2} ${r.x-r.w/2},${r.z+r.d/2} ${r.x+r.w/2},${r.z+r.d/2}`}/>:
                <rect key={i} {...common} x={r.x-r.w/2} y={r.z-r.d/2} width={r.w} height={r.d}/>;
            })}
            {/* Pre-existing engine stairs are informative only: JSON export doesn't replace template geometry. */}
            {inheritedStairs.map((step,i)=><rect key={"legacy-stair-"+i} pointerEvents="none"
              x={step.pos[0]-step.size[0]} y={step.pos[2]-step.size[2]}
              width={step.size[0]*2} height={step.size[2]*2}
              fill="#fbbf24" fillOpacity=".10" stroke="#fbbf24" strokeOpacity=".28" strokeWidth=".2"/>)}
            {/* Original template stairs: one selectable outline per complete
                flight in 2D, rather than dozens of individual step rectangles. */}
            {(baseMap.editorLegacyStairFlights??[]).map(flight=>{
              if(!canEditBuiltIn||flight.indices.every(i=>(map.legacyCoverDisabled??[]).includes(i)))return null;
              const bounds=legacyFlightBounds(flight.start);
              if(!bounds)return null;
              const active=selected?.type==="legacyStairs"&&selected.index===flight.start;
              return <g key={"flight-"+flight.start}
                onPointerDown={e=>{
                  if(tool!=="select"||!canEditBuiltIn)return;
                  e.stopPropagation();
                  setSelected({type:"legacyStairs",index:flight.start});
                }}
                style={{cursor:tool==="select"?"pointer":"crosshair"}}>
                <rect x={bounds.x-bounds.w/2} y={bounds.z-bounds.d/2}
                  width={bounds.w} height={bounds.d} pointerEvents={tool==="select"?"all":"none"}
                  fill="#f59e0b" fillOpacity={active ? .2 : .045}
                  stroke={active?"#fde68a":"#fbbf24"} strokeWidth={active?1.4:.35}
                  strokeDasharray={active?undefined:"1 1"}/>
                {active&&<text x={bounds.x} y={bounds.z} textAnchor="middle"
                  fill="#fff7ed" fontSize="4.5" pointerEvents="none">STAIR FLIGHT</text>}
              </g>;
            })}
            {inheritedCovers.map(({index,box})=><rect key={"legacy-cover-"+index}
              x={box.pos[0]-box.size[0]} y={box.pos[2]-box.size[2]}
              width={box.size[0]*2} height={box.size[2]*2}
              fill="#94a3b8" fillOpacity=".07"
              stroke={selected?.type==="legacyCover"&&selected.index===index?"#fde68a":"#94a3b8"}
              strokeWidth={selected?.type==="legacyCover"&&selected.index===index?1.1:.16}
              pointerEvents={tool==="select"&&canEditBuiltIn?"all":"none"}
              style={{cursor:canEditBuiltIn?"pointer":"default"}}
              onPointerDown={e=>{
                if(tool!=="select"||!canEditBuiltIn)return;e.stopPropagation();
                setSelected({type:"legacyCover",index});
              }}/>)}
            {map.features.map((f,i)=><g key={f.id||i} onPointerDown={e=>beginMove(e,{type:"feature",index:i})}
              style={{cursor:tool==="select"?"move":"crosshair"}}>
              <rect x={f.kind==="stairs"&&f.axis==="x"?(f.sign===-1?f.x-f.d:f.x):f.x-f.w/2}
                y={f.kind==="stairs"&&f.axis!=="x"?(f.sign===-1?f.z-f.d:f.z):f.z-(f.kind==="stairs"?f.w:f.d)/2}
                width={f.kind==="stairs"&&f.axis==="x"?f.d:f.w}
                height={f.kind==="stairs"&&f.axis!=="x"?f.d:(f.kind==="stairs"?f.w:f.d)}
                fill={f.kind==="platform"?"#cb8b47":f.kind==="stairs"?"#f59e0b":f.kind==="accent"?"#a855f7":"#64748b"}
                stroke={selected?.type==="feature"&&selected.index===i?"#fef08a":"#d1d5db"}
                strokeWidth={selected?.type==="feature"&&selected.index===i?1.5:0.5} rx=".45"/>
              {f.kind==="platform"&&f.autoStairs!==false&&<><rect x={f.x-2} y={f.z+f.d/2} width="4" height={Math.ceil(f.h/.42)*.76} fill="#fbbf24" fillOpacity=".35" stroke="#f59e0b" strokeWidth=".25"/>
                <rect x={f.x-2} y={f.z-f.d/2-Math.ceil(f.h/.42)*.76} width="4" height={Math.ceil(f.h/.42)*.76} fill="#fbbf24" fillOpacity=".35" stroke="#f59e0b" strokeWidth=".25"/></>}
            </g>)}
            {inherited.map(({index,object:h})=><rect key={"inherited-"+index}
              pointerEvents={tool==="select"&&canEditBuiltIn?"all":"none"}
              onPointerDown={e=>{
                if(tool!=="select"||!canEditBuiltIn)return;e.stopPropagation();
                setSelected({type:"legacyEnvironment",index});
              }}
              style={{cursor:"pointer"}}
              x={h.pos[0]-h.size[0]} y={h.pos[2]-h.size[2]}
              width={h.size[0]*2} height={h.size[2]*2} fill="#a855f7" fillOpacity=".10"
              stroke={selected?.type==="legacyEnvironment"&&selected.index===index?"#fde68a":"#e879f9"}
              strokeDasharray="2 2" strokeWidth={selected?.type==="legacyEnvironment"&&selected.index===index?1.2:.5}/>)}
            {uiHazards.map((h,i)=><g key={h.id||i} onPointerDown={e=>beginMove(e,{type:"hazard",index:i})}>
              <rect x={h.x-h.w/2} y={h.z-h.d/2} width={h.w} height={h.d} rx=".5"
                fill={h.type==="fire"?"#ef4444":h.type==="spikes"?"#fb7185":h.type==="jump_pad"?"#38bdf8":"#f97316"}
                fillOpacity=".35" stroke={selected?.type==="hazard"&&selected.index===i?"#fef08a":"#fda4af"}
                strokeWidth={selected?.type==="hazard"&&selected.index===i?1.5:.5}/>
              <text x={h.x} y={h.z} textAnchor="middle" fill="#fff" fontSize="5" pointerEvents="none">{h.type.replaceAll("_"," ")}</text>
            </g>)}
            {theme.props.map((p,i)=><g key={"prop-"+i} onPointerDown={e=>beginMove(e,{type:"prop",index:i})}>
              <circle cx={p.x} cy={p.z} r={Math.max(2,Math.min(8,(p.w??5)/2))}
                fill={p.color??theme.palette.accent} fillOpacity=".32"
                stroke={selected?.type==="prop"&&selected.index===i?"#fef08a":theme.palette.accent}
                strokeWidth=".7"/>
              <text x={p.x} y={p.z-4} fill="#fff" textAnchor="middle" fontSize="3.6" pointerEvents="none">{p.kind}</text>
            </g>)}
            {(["ffa","red","blue"] as Team[]).flatMap(team=>map.spawns[team].map((p,i)=>
              <g key={team+i} transform={`translate(${p[0]} ${p[2]})`}
                onPointerDown={e=>beginMove(e,{type:"spawn",team,index:i})}
                style={{cursor:"move"}}>
                <circle r="3.5" fill={color[team]} fillOpacity=".22"/>
                <circle r="1.7" fill={color[team]} stroke="#fff" strokeWidth=".35"/>
                {selected?.type==="spawn"&&selected.team===team&&selected.index===i&&<circle r="5" fill="none" stroke="#fef08a" strokeWidth=".8"/>}
              </g>))}
            {shape&&tool!=="select"&&!["ffa","blue","red"].includes(tool)&&
              (tool==="circle"?<ellipse cx={shape.x} cy={shape.z} rx={shape.w/2} ry={shape.d/2}
                fill="#f59e0b" fillOpacity=".2" stroke="#fbbf24" pointerEvents="none"/>:
              tool==="triangle"?<polygon points={`${shape.x},${shape.z-shape.d/2} ${shape.x-shape.w/2},${shape.z+shape.d/2} ${shape.x+shape.w/2},${shape.z+shape.d/2}`}
                fill="#f59e0b" fillOpacity=".2" stroke="#fbbf24" pointerEvents="none"/>:
              <rect x={shape.x-shape.w/2} y={shape.z-shape.d/2} width={shape.w} height={shape.d}
                fill="#f59e0b" fillOpacity=".2" stroke="#fbbf24" strokeWidth="1.4" strokeDasharray="3 2" pointerEvents="none"/> )}
            <text x={-radius+7} y={-radius+12} fill="#9ca3af" fontSize="7">N ↑</text>
            <text x={radius-5} y={radius-6} fill="#64748b" fontSize="5" textAnchor="end">X → / Z ↓ · 10u grid</text>
          </svg>}
        </div>
        <p role="status" className="text-xs text-zinc-400 mt-3">{status}</p>
      </main>
      <aside className="border-l border-white/10 bg-zinc-950/60 p-4 space-y-5">
        <section><h2 className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-3">Inspector</h2>
          {selected&&selectedObject?
            <div className="space-y-3">
              <div className="text-sm font-semibold capitalize text-amber-300">{selected.type==="legacyStairs"?"Staircase flight":selected.type} #{selected.index+1}
                {selected.team?" / "+selected.team.toUpperCase():""}</div>
              {(selected.type==="legacyCover"||selected.type==="legacyStairs"||selected.type==="legacyEnvironment")?
                <div className="space-y-3">
                  <p className="text-xs text-amber-200/80">
                    {selected.type==="legacyStairs"?
                      `Complete staircase selected — ${legacyFlight(selected.index)?.indices.length??0} collision steps. Move, rotate or resize the whole flight together. Exported JSON stores the coordinated step overrides.`:
                      "Existing game geometry: this edit is saved as an override in the map blueprint. The original TypeScript template remains unchanged."}
                  </p>
                  {selected.type==="legacyStairs"&&<p className="text-xs text-zinc-500">
                    X/Y/Z = flight center · W/D = total footprint · H = total rise. Step count stays fixed for legacy stairs; new authored stairs regenerate steps automatically.
                  </p>}
                  <div className="grid grid-cols-2 gap-2">
                    {(["x","y","z","w","h","d"] as const).map(key=>
                      <label key={key} className="text-xs text-zinc-400">{key==="y"?"CENTER Y":key==="h"?"HEIGHT":key.toUpperCase()}
                        <input className={fieldClass} type="number" step="any" min={["w","h","d"].includes(key)?0.1:undefined}
                          value={(selectedObject as unknown as Record<string,number>)[key]}
                          onChange={e=>changeSelected(key,e.target.value)}/>
                      </label>)}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {selected.type==="legacyStairs"?"Every tread is updated together. Use Rotate for 90° quarter-turns and Reset flight to undo all saved edits to this staircase.":
                    "W/H/D are full dimensions; Y is the center elevation. Use Move or Resize in 3D to modify the selected object."}
                  </p>
                </div>:
              selected.type==="spawn"?
                <div className="grid grid-cols-3 gap-2">{["0","1","2"].map((key,i)=><label key={key} className="text-xs text-zinc-400">{["X","Y","Z"][i]}
                  <input type="number" className={fieldClass} value={(selectedObject as number[])[i]}
                    onChange={e=>changeSelected(key,e.target.value)}/></label>)}</div>:
                <>
                  {(selected.type==="feature"||selected.type==="hazard")&&<label className="block text-xs">Object ID
                    <input className={fieldClass} value={(selectedObject as MapFeature|MapHazard).id}
                      onChange={e=>changeSelected("id",e.target.value)}/></label>}
                  {selected.type==="feature"&&<label className="block text-xs">Label
                    <input className={fieldClass} value={(selectedObject as MapFeature).label??""}
                      onChange={e=>changeSelected("label",e.target.value)}/></label>}
                  {selected.type==="region"&&<label className="block text-xs">Region shape
                    <select className={fieldClass} value={(selectedObject as MapRegion).shape??"rect"}
                      onChange={e=>changeSelected("shape",e.target.value)}>
                      <option value="rect">Rectangle</option><option value="circle">Circle / ellipse</option>
                      <option value="triangle">Triangle</option>
                    </select></label>}
                  <div className="grid grid-cols-2 gap-2">
                    {(["x","z","w","d",...(["feature","hazard","prop"].includes(selected.type)?["h"]:[]),
                      ...(["feature","hazard","prop"].includes(selected.type)?["y"]:[])] as string[]).map(key=><label key={key} className="text-xs text-zinc-400">{key==="y"?
                        (selected.type==="feature"||selected.type==="prop"?"BASE Y":"CENTER Y"):
                        key==="h"?"HEIGHT":key.toUpperCase()}
                      <input type="number" step="any" className={fieldClass}
                        value={(selectedObject as unknown as Record<string,number>)[key]??(key==="y"?0:"")}
                        onChange={e=>changeSelected(key,e.target.value)}/></label>)}
                  </div>
                  {selected.type==="feature"&&<label className="block text-xs">Feature type
                    <select className={fieldClass} value={(selectedObject as MapFeature).kind}
                      onChange={e=>changeSelected("kind",e.target.value)}>
                      {(["cover","platform","accent","stairs"] as const).map(kind=>
                        <option key={kind} value={kind}>{kind}</option>)}
                    </select></label>}
                  {selected.type==="feature"&&(selectedObject as MapFeature).kind==="cover"&&
                    <button className={btn+" w-full"} onClick={()=>{
                      const next=snapCoverToPlatform(selectedObject as MapFeature,map.features);
                      if(!next){setStatus("Add a platform before snapping cover.");return;}
                      pushUndo();
                      update(m=>({...m,features:m.features.map((f,i)=>i===selected.index?next:f)}));
                      setStatus("Cover bottom snapped to platform top, preserving wall height.");
                    }}>Snap cover onto platform top</button>}
                  {selected.type==="feature"&&(selectedObject as MapFeature).kind==="platform"&&
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={(selectedObject as MapFeature).autoStairs!==false}
                        onChange={e=>changeSelected("autoStairs",e.target.checked)}/> Auto-generate north/south stairs
                    </label>}
                  {selected.type==="feature"&&(selectedObject as MapFeature).kind==="stairs"&&<>
                    <label className="block text-xs">Orientation
                      <select className={fieldClass} value={(selectedObject as MapFeature).axis??"z"}
                        onChange={e=>changeSelected("axis",e.target.value)}>
                        <option value="x">East/west (X)</option><option value="z">North/south (Z)</option>
                      </select></label>
                    <label className="block text-xs">Extends outward
                      <select className={fieldClass} value={(selectedObject as MapFeature).sign??1}
                        onChange={e=>changeSelected("sign",Number(e.target.value))}>
                        <option value={1}>Positive axis</option><option value={-1}>Negative axis</option>
                      </select></label>
                    <button className={btn+" w-full"} onClick={()=>{
                      const snapped=nearestPlatformSnap(selectedObject as MapFeature,map.features);
                      if(!snapped){setStatus("Add a platform before snapping.");return;}
                      update(m=>({...m,features:m.features.map((obj,i)=>i===selected.index?snapped:obj)}));
                      setStatus("Stairs snapped to landing height and edge.");
                    }}>Snap to nearest platform (height + steps)</button>
                    <p className="text-xs text-zinc-400">Rise {(selectedObject as MapFeature).h}u;
                      {Math.ceil((selectedObject as MapFeature).h/.42)} steps;
                      run {(selectedObject as MapFeature).d}u.</p>
                  </>}
                  {selected.type==="feature"&&(selectedObject as MapFeature).kind==="platform"&&
                    <p className="text-xs text-zinc-400">
                      {(selectedObject as MapFeature).autoStairs===false?"Manual stair placement enabled.":"Automatic north/south stairs enabled."}
                    </p>}
                  {selected.type==="hazard"&&<>
                    <label className="block text-xs">Hazard kind
                      <select className={fieldClass} value={(selectedObject as MapHazard).type}
                        onChange={e=>changeSelected("type",e.target.value)}>
                        {(["fire","spikes","jump_pad","moving_platform","destructible_wall"] as const).map(kind=>
                          <option key={kind} value={kind}>{kind}</option>)}
                      </select></label>
                    {(["dps","damage","period","activeFor","offset","hp","launchX","launchY","launchZ","toX","toY","toZ"] as const)
                      .filter(key=>({
                        fire:["dps"],spikes:["damage","period","activeFor","offset"],
                        jump_pad:["launchX","launchY","launchZ"],
                        moving_platform:["period","toX","toY","toZ"],destructible_wall:["hp"],
                      }[(selectedObject as MapHazard).type] as readonly string[]).includes(key))
                      .map(key=><label key={key} className="block text-xs">{key}
                        <input type="number" step=".1" className={fieldClass}
                          value={(selectedObject as MapHazard)[key]??0}
                          onChange={e=>changeSelected(key,e.target.value)}/></label>)}
                  </>}
                  {selected.type==="prop"&&<>
                    <label className="block text-xs">Prop type
                      <select className={fieldClass} value={(selectedObject as MapProp).kind}
                        onChange={e=>changeSelected("kind",e.target.value)}>
                        {(["tree","bush","rock","ruin","temple","shop","lamp","container","crane","terminal","sign","antenna","building","boat","dock","garden","bench","bandstand"] as const).map(kind=>
                          <option key={kind} value={kind}>{kind}</option>)}
                      </select></label>
                    <label className="block text-xs">Text (optional)
                      <input className={fieldClass} value={(selectedObject as MapProp).text??""}
                        onChange={e=>changeSelected("text",e.target.value)}/></label>
                    <label className="block text-xs">Color (optional)
                      <input className={fieldClass} value={(selectedObject as MapProp).color??""}
                        onChange={e=>changeSelected("color",e.target.value)}/></label>
                  </>}
                </>
              }
              {selectedSpan&&<div className="rounded-lg border border-white/10 bg-zinc-900/50 p-2.5 space-y-2">
                <p className="text-xs font-semibold text-amber-200">Exact vertical placement</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["bottom","top"] as const).map(face=><label key={face} className="text-xs text-zinc-400">
                    {face==="bottom"?"Bottom Y":"Top Y"}
                    <input aria-label={face==="bottom"?"Bottom elevation":"Top elevation"}
                      className={fieldClass} type="number" step="any"
                      value={Math.round(selectedSpan[face]*10000)/10000}
                      onChange={e=>setPreciseElevation(face,e.target.value)}/>
                  </label>)}
                </div>
                <p className="text-[11px] text-zinc-500">Moves the object without changing its height. Values accept decimals (for example, 5.25). Grid snapping affects X/Z only.</p>
              </div>}
              <div className="flex gap-2">
                <button className={btn} onClick={duplicate}><Copy size={13}/> Duplicate</button>
                {(selected.type==="legacyCover"||selected.type==="legacyStairs"||selected.type==="legacyEnvironment")&&
                  <button className={btn} onClick={resetLegacyEdits}><RotateCcw size={13}/> Reset edits</button>}
                <button className={btn+" text-rose-300"} onClick={remove}>
                  <Trash2 size={13}/> Delete
                </button>
              </div>
            </div>:
            <p className="text-xs text-zinc-500">Select a region, existing staircase/cover, hazard, prop, or spawn in 3D to edit its properties.</p>}
        </section>
        {deletedCount>0&&<section className="border-t border-white/10 pt-4 space-y-2">
          <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-400">Deleted built-in objects ({deletedCount})</h2>
          <p className="text-xs text-zinc-500">Hidden originals stay excluded from exported map physics. Restore individual objects here or use Undo.</p>
          <div className="max-h-40 overflow-auto space-y-1">
            {deletedFlights.map(f=><div key={"flight-"+f.start} className="flex justify-between items-center gap-2 text-xs">
              <span>Staircase #{f.start+1} ({f.indices.length} steps)</span>
              <button className={btn} onClick={()=>restoreOriginal("flight",f.start)}><RotateCcw size={12}/> Restore</button>
            </div>)}
            {deletedCover.map(i=><div key={"cover-"+i} className="flex justify-between items-center gap-2 text-xs">
              <span>Cover #{i+1}</span>
              <button className={btn} onClick={()=>restoreOriginal("cover",i)}><RotateCcw size={12}/> Restore</button>
            </div>)}
            {deletedEnvironment.map(i=><div key={"environment-"+i} className="flex justify-between items-center gap-2 text-xs">
              <span>Hazard #{i+1}</span>
              <button className={btn} onClick={()=>restoreOriginal("environment",i)}><RotateCcw size={12}/> Restore</button>
            </div>)}
          </div>
        </section>}
        <section className="border-t border-white/10 pt-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-3 flex items-center gap-2"><AlertTriangle size={14}/> Design checks</h2>
          {issues.length? <div className="space-y-2 max-h-64 overflow-auto">
            {issues.slice(0,30).map((err,i)=><div key={i} className="text-xs text-amber-200/80 border-l-2 border-amber-500/50 pl-2">{err}</div>)}
            {issues.length>30&&<div className="text-xs text-amber-300">+ {issues.length-30} more warnings</div>}</div>:
            <p className="text-xs text-emerald-400">No basic schema, connectivity or spawn/feature overlaps detected.</p>}
          <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">Checks are static. Live spawn fairness, bot pathing and sightlines still need playtesting.</p>
        </section>
        <section className="border-t border-white/10 pt-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-2">Publishing</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Drafts auto-save only in this browser. <strong className="text-zinc-300">Export JSON</strong>,
            replace <code className="text-amber-300">src/data/map-blueprints.json</code> in the repo,
            then restart or rebuild Next.js. Both offline and online sessions use the same compiled map definitions.
          </p>
          <button className={btn+" mt-3 w-full"} onClick={()=>{if(confirm("Discard local edits and restore committed blueprints?")){
            pushUndo();setDoc(clone(STARTER));setSelected(null);setStatus("Restored committed definitions.");}}}>
            <RotateCcw size={13}/> Restore shipped maps
          </button>
        </section>
      </aside>
    </div>
  </div>;
}
