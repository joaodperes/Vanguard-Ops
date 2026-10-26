"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import MapStudio3D,{type StudioSelection,type StudioMode,type StudioTransform} from "./MapStudio3D";
import {MAP_DOCUMENTS,validateMapDocument,type MapDocument} from "@/lib/map-documents";
import {importMapDocuments,exportMapLibrary,type MapDocumentLibrary} from "@/lib/map-document-io";
import {validateBlueprint,overrideBox,nearestPlatformSnap,snapCoverToPlatform,
  type MapRegion,type MapFeature,type MapHazard} from "@/lib/map-blueprints";
import {mapProps,visualThemeForMap,type MapProp,type MapVisualTheme,type PropKind,type SurfacePattern} from "@/lib/map-visuals";
import {getMap} from "@/lib/game-protocol";
import {studioMapIssues,studioRegionLinks,studioBuildingPlacementIssues} from "@/lib/map-studio-diagnostics";
import {STUDIO_BUILDING_PRESETS,STUDIO_STRUCTURE_PRESETS,studioBuildingPrefab,studioStructurePrefab,
  type StudioBuildingPresetId,type StudioStructurePresetId} from "@/lib/map-studio-prefabs";
import {legacyCoverToFeature,legacyFlightToFeature,legacyEnvironmentToHazard,toggleOriginalIndex} from "@/lib/map-object-actions";
import {stairFlightBounds,transformStairFlight,maxLegacyFlightRise} from "@/lib/legacy-stair-flights";
import {Undo2,Redo2,Download,Upload,Play,Copy,Trash2,RotateCcw,Plus} from "lucide-react";

type Team="ffa"|"red"|"blue";
type Tool="select"|"region"|"circle"|"triangle"|"cover"|"platform"|"stairs"|"hazard"|"prop"|"kit"|"ffa"|"red"|"blue";
type Point={x:number;z:number};
const teams:Team[]=["ffa","red","blue"];
const tools:{heading:string;items:[Tool,string][]}[]=[
  {heading:"Floor and districts",items:[["region","Rectangle"],["circle","Ellipse"],["triangle","Triangle"]]},
  {heading:"Combat geometry",items:[["cover","Cover"],["platform","Platform"],["stairs","Stairs"],["kit","Structure kit"]]},
  {heading:"Objects",items:[["prop","Prop / building"],["hazard","Hazard"]]},
  {heading:"Player starts",items:[["ffa","FFA"],["red","Red team"],["blue","Blue team"]]},
];
const kinds:PropKind[]=["tree","bush","rock","ruin","temple","shop","lamp","container","crane","terminal","sign","antenna","building","boat","dock","garden","bench","bandstand"];
const hazardKinds:MapHazard["type"][]=["fire","spikes","jump_pad","moving_platform","destructible_wall"];
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

export default function MapEditorClient(){
  const [library,setLibrary]=useState<MapDocumentLibrary>(()=>clone(MAP_DOCUMENTS));
  const [id,setId]=useState("compound"),[newId,setNewId]=useState("");
  const [selection,setSelection]=useState<StudioSelection|null>(null);
  const [tool,setTool]=useState<Tool>("select");
  const [view,setView]=useState<"3d"|"2d">("3d"),[mode,setMode]=useState<StudioMode>("select");
  const [grid,setGrid]=useState(2),[zoom,setZoom]=useState(1);
  const [moveAxis,setMoveAxis]=useState<"x"|"y"|"z">("x");
  const [stamp,setStamp]=useState(false),[showCollision,setShowCollision]=useState(false);
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
  const issues=useMemo(()=>studioMapIssues(plan,theme.props,legacySpawns),[plan,theme.props,legacySpawns]);
  const routes=useMemo(()=>studioRegionLinks(plan),[plan]);
  const faults=useMemo(()=>[...validateMapDocument(current),...validateBlueprint(plan)],[current,plan]);
  const dirty=JSON.stringify(current)!==JSON.stringify(MAP_DOCUMENTS[id]??null);

  useEffect(()=>{
    try{
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
  useEffect(()=>{try{localStorage.setItem("vanguard-map-studio-v2",JSON.stringify(library));}catch{}},[library]);
  const commit=(next:MapDocumentLibrary,note?:string)=>{
    undoRef.current=[...undoRef.current.slice(-49),library];redoRef.current=[];
    setLibrary(next);setRev(n=>n+1);if(note)setMessage(note);
  };
  const edit=(action:(d:MapDocumentLibrary)=>void,note?:string)=>{
    const next=clone(library);action(next);
    if(afterlight&&next.arena_neon&&next.terminal){
      const other=id==="terminal"?"arena_neon":"terminal";
      const old=next[other].blueprint,b=next[id].blueprint;
      next[other].blueprint={...clone(b),name:old.name,shortName:old.shortName,
        description:old.description,templateMapId:old.templateMapId};
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
  const buildingIssue=(x:number,z:number)=>{
    const house=studioBuildingPrefab(buildingKit,x,z);
    const spawns=[...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue,...legacySpawns];
    return studioBuildingPlacementIssues(house,plan,theme.props,spawns)[0]?.message??null;
  };
  const place=(kind:Tool,p:Point,rect?:{w:number;d:number})=>{
    const snap=(x:number)=>grid?Math.round(x/grid)*grid:x;
    const x=snap(p.x),z=snap(p.z),w=rect?.w,d=rect?.d;
    if(kind==="prop"&&propKind==="building"){
      const problem=buildingIssue(x,z);if(problem){setMessage(problem);return;}
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
        bp.features.push({id:unique("feature"),kind:type,x,z,w:w??(type==="stairs"?4:12),
          d:d??(type==="stairs"?10:12),h:type==="cover"?2.8:4.2,
          label:"New "+type,...(type==="stairs"?{axis:"z" as const,sign:1 as const}:{})});
      }else if(kind==="kit"){
        chosen={type:"feature",index:bp.features.length};
        bp.features.push(...studioStructurePrefab(structureKit,x,z).map(f=>({...f,id:unique("kit")})));
      }else if(kind==="hazard"){
        bp.hazards??=[];chosen={type:"hazard",index:bp.hazards.length};
        bp.hazards.push({id:unique("hazard"),type:hazardKind,x,z,y:1,w:w??6,d:d??6,h:2,
          dps:7,damage:25,period:5,activeFor:2,hp:120,launchY:18,toX:x+12,toY:1,toZ:z});
      }else if(kind==="prop"){
        const list=all[afterlight?"arena_neon":id].theme.props;
        chosen={type:"prop",index:list.length};
        list.push(propKind==="building"?studioBuildingPrefab(buildingKit,x,z):{kind:propKind,x,z,w:w??5,d:d??5,h:5});
      }else if(kind==="ffa"||kind==="red"||kind==="blue"){
        chosen={type:"spawn",team:kind,index:bp.spawns[kind].length};
        bp.spawns[kind].push([x,0,z]);
      }
    },"Placed "+kind);
    setSelection(chosen);if(!stamp)setTool("select");setMode("move");
  };
  const move=(s:StudioSelection,dx:number,dz:number)=>{
    if(!dx&&!dz)return;
    edit(d=>{
      const bp=d[id].blueprint;
      const item=s.type==="region"?bp.regions[s.index]:s.type==="feature"?bp.features[s.index]:
        s.type==="hazard"?bp.hazards?.[s.index]:
        s.type==="prop"?d[afterlight?"arena_neon":id].theme.props[s.index]:null;
      if(item){item.x+=dx;item.z+=dz;}
      if(s.type==="spawn"&&s.team){const p=bp.spawns[s.team][s.index];if(p){p[0]+=dx;p[2]+=dz;}}
    },"Moved "+caption(s));
  };
  const editSelected=(key:string,value:string|number|boolean)=>{
    if(!selection)return;
    const s=selection;
    edit(d=>{
      const bp=d[id].blueprint;
      if(s.type==="spawn"&&s.team){
        const p=bp.spawns[s.team][s.index];if(p)p[Number(key)]=Number(value);
        return;
      }
      const item=s.type==="region"?bp.regions[s.index]:s.type==="feature"?bp.features[s.index]:
        s.type==="hazard"?bp.hazards?.[s.index]:
        s.type==="prop"?d[afterlight?"arena_neon":id].theme.props[s.index]:null;
      if(item)Object.assign(item,{[key]:value});
    });
  };
  const transform=(s:StudioSelection,t:StudioTransform)=>{
    if(s.type==="generatedBuilding")return;
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
    const s=selection;if(s.type==="generatedBuilding"){promote();return;}
    let chosen:StudioSelection|null=null;
    edit(d=>{
      const bp=d[id].blueprint;
      if(s.type==="region"){const item=bp.regions[s.index];if(item){chosen={type:"region",index:bp.regions.length};bp.regions.push({...item,x:item.x+12});}}
      if(s.type==="feature"){const item=bp.features[s.index];if(item){chosen={type:"feature",index:bp.features.length};bp.features.push({...item,id:unique("feature"),x:item.x+10});}}
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
      if(s.type==="feature")bp.features.splice(s.index,1);
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
    draft.blueprint.templateMapId=(["bunker","shipyard","compound","terminal","skybridge","arena_neon"].includes(id)?id:plan.templateMapId)??"compound";
    draft.theme=clone(theme);delete draft.theme.inheritPropsFrom;
    commit({...library,[name]:draft},"Created "+name+". Register the exported file in map-documents.ts to publish.");
    setId(name);setNewId("");setSelection(null);
  };
  const exportMap=()=>{saveFile(id+".json",current);setMessage("Exported "+id+".json — publish to src/data/maps/"+id+".json");};
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
      sessionStorage.setItem("vanguard-map-studio-playtest-v1",JSON.stringify({mapId:id,blueprint:plan,theme,botCount:bots}));
      window.location.assign("/map-editor/playtest");
    }catch(error){setMessage("Playtest failed: "+String(error));}
  };
  const fromPointer=(e:React.PointerEvent<SVGElement>):Point=>{
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
    if(kind==="move"&&sel)move(sel,to.x-from.x,to.z-from.z);
    if(kind==="place"){
      if(teams.includes(tool as Team))place(tool,to);
      else place(tool,{x:(from.x+to.x)/2,z:(from.z+to.z)/2},
        {w:Math.max(12,Math.abs(to.x-from.x)),d:Math.max(12,Math.abs(to.z-from.z))});
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
  const feature=selection?.type==="feature"?plan.features[selection.index]:undefined;
  const hazard=selection?.type==="hazard"?plan.hazards?.[selection.index]:undefined;
  const prop=selection?.type==="prop"?theme.props[selection.index]:undefined;
  const region=selection?.type==="region"?plan.regions[selection.index]:undefined;
  const item=feature??hazard??prop??region;
  const spawn=selection?.type==="spawn"&&selection.team?plan.spawns[selection.team][selection.index]:undefined;
  const libraryDirty=dirty?"Unsaved export":"Shipped source";

  return <main className="flex h-screen min-h-[540px] flex-col overflow-hidden bg-[#080b10] text-zinc-100">
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#10151c] px-3 py-2">
      <Link href="/" className={btn}>Vanguard</Link>
      <strong className="mr-2 text-sm uppercase tracking-[.15em] text-amber-300">Map Studio 2</strong>
      <select className={control+" max-w-[170px]"} value={id} onChange={e=>{setId(e.target.value);setSelection(null);setTool("select");}}>
        {Object.keys(library).sort().map(key=><option key={key} value={key}>{library[key].blueprint.name} · {key}</option>)}
      </select>
      <input className={control+" w-28"} value={newId} onChange={e=>setNewId(e.target.value)} placeholder="new_map_id" aria-label="New map ID"/>
      <button className={btn} onClick={createMap}><Plus className="h-3 w-3"/> New</button>
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
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="w-full shrink-0 overflow-y-auto border-b border-white/10 bg-[#10151c] p-3 lg:w-56 lg:border-b-0 lg:border-r">
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
        {tool==="hazard"&&<Picker label="Hazard" value={hazardKind} options={hazardKinds} save={v=>setHazardKind(v as MapHazard["type"])}/>}
        {tool==="kit"&&<Picker label="Kit" value={structureKit} options={STUDIO_STRUCTURE_PRESETS.map(p=>p.id)}
          save={v=>setStructureKit(v as StudioStructurePresetId)}/>}
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={stamp} onChange={e=>setStamp(e.target.checked)}/> Repeat placement</label>
        <h3 className="mt-5 border-t border-white/10 pt-3 text-xs font-semibold uppercase text-zinc-400">Object layers</h3>
        {([
          ["Regions",plan.regions.map((_,index)=>({type:"region",index}))],
          ["Geometry",plan.features.map((_,index)=>({type:"feature",index}))],
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
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded-lg bg-black/80 p-2 text-xs">
          <span>Snap</span>
          <select value={grid} onChange={e=>setGrid(Number(e.target.value))} className="bg-zinc-900">
            {[0,1,2,5,10].map(n=><option key={n} value={n}>{n===0?"off":n+"u"}</option>)}
          </select>
          {view==="2d"&&<input aria-label="2D zoom" type="range" min=".5" max="2" step=".1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>}
        </div>
        {view==="3d"?
          <MapStudio3D mapId={id} map={plan} theme={theme} selected={selection} mode={mode} moveAxis={moveAxis} snap={grid}
            tool={tool} legacySpawns={legacySpawns} showCollision={showCollision}
            placementProp={tool==="prop"?(propKind==="building"?studioBuildingPrefab(buildingKit,0,0):{kind:propKind,x:0,z:0,w:5,d:5,h:5}):undefined}
            placementKit={tool==="kit"?(()=>{const p=STUDIO_STRUCTURE_PRESETS.find(p=>p.id===structureKit);return p?{w:p.width,d:p.depth}:undefined;})():undefined}
            warnings={showIssues?issues:[]} regionLinks={showRoutes?routes:[]}
            placementProblem={tool==="prop"&&propKind==="building"?buildingIssue:undefined}
            onInvalidPlacement={setMessage} onSelect={setSelection} onTransform={transform}
            onAddAt={(name,p)=>place(name as Tool,p)}/>
        :<svg ref={svgRef} viewBox={[bounds.x,bounds.z,bounds.w,bounds.d].join(" ")}
          preserveAspectRatio="xMidYMid meet" className="h-full w-full touch-none"
          onPointerDown={canvasDown} onPointerMove={e=>{if(gesture.current)setGhost({from:gesture.current.from,to:fromPointer(e)});}}
          onPointerUp={canvasUp} onPointerCancel={()=>{gesture.current=null;setGhost(null);}}>
          <rect x={bounds.x} y={bounds.z} width={bounds.w} height={bounds.d} fill="#131b25"/>
          {Array.from({length:Math.min(150,Math.ceil(bounds.w/20)+2)},(_,i)=>{
            const x=Math.floor(bounds.x/20)*20+i*20;return <line key={"x"+i} x1={x} x2={x} y1={bounds.z} y2={bounds.z+bounds.d} stroke="#475569" strokeWidth=".25"/>;
          })}
          {Array.from({length:Math.min(150,Math.ceil(bounds.d/20)+2)},(_,i)=>{
            const z=Math.floor(bounds.z/20)*20+i*20;return <line key={"z"+i} x1={bounds.x} x2={bounds.x+bounds.w} y1={z} y2={z} stroke="#475569" strokeWidth=".25"/>;
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
          {plan.features.map((f,i)=><rect key={f.id} x={f.x-f.w/2} y={f.z-f.d/2} width={f.w} height={f.d}
            fill={f.kind==="stairs"?theme.palette.stair:f.kind==="platform"?theme.palette.platform:theme.palette.cover}
            stroke={selection?.type==="feature"&&selection.index===i?"#fbbf24":"#1f2937"} strokeWidth="1"
            onPointerDown={e=>objectDown(e,{type:"feature",index:i})}/>)}
          {(plan.hazards??[]).map((h,i)=><rect key={h.id} x={h.x-h.w/2} y={h.z-h.d/2} width={h.w} height={h.d}
            fill="#fb7185" fillOpacity=".65" stroke={selection?.type==="hazard"&&selection.index===i?"white":"#9333ea"}
            onPointerDown={e=>objectDown(e,{type:"hazard",index:i})}/>)}
          {theme.props.map((p,i)=><rect key={i} x={p.x-(p.w??5)/2} y={p.z-(p.d??5)/2} width={p.w??5} height={p.d??5}
            fill={p.kind==="building"?"#a3ad9d":"#34d399"} fillOpacity=".64"
            stroke={selection?.type==="prop"&&selection.index===i?"#fbbf24":"#065f46"}
            strokeWidth="1" onPointerDown={e=>objectDown(e,{type:"prop",index:i})}/>)}
          {teams.flatMap(team=>plan.spawns[team].map((p,i)=><circle key={team+i} cx={p[0]} cy={p[2]} r={2}
            fill={team==="ffa"?"#fbbf24":team==="red"?"#f87171":"#38bdf8"} stroke="#111"
            onPointerDown={e=>objectDown(e,{type:"spawn",index:i,team})}/>))}
          {showIssues&&issues.map((p,i)=><circle key={i} cx={p.x} cy={p.z} r={2.5}
            fill="none" stroke={p.severity==="error"?"#ef4444":"#fbbf24"} strokeWidth=".8" pointerEvents="none"/>)}
          {ghost&&<rect x={Math.min(ghost.from.x,ghost.to.x)} y={Math.min(ghost.from.z,ghost.to.z)}
            width={Math.max(2,Math.abs(ghost.to.x-ghost.from.x))} height={Math.max(2,Math.abs(ghost.to.z-ghost.from.z))}
            fill="#fbbf24" fillOpacity=".2" stroke="#fbbf24" strokeDasharray="2 2" pointerEvents="none"/>}
        </svg>}
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/75 px-3 py-1.5 text-[11px] text-zinc-300">
          {view==="3d"?"Left drag orbit · Right drag pan · Wheel zoom · WASD/QE fly · Click to place or select":
            tool==="select"?"Click an object, then drag to move.":"Drag to draw an object."}
        </p>
      </section>
      <aside className="w-full shrink-0 overflow-auto border-t border-white/10 bg-[#10151c] p-4 lg:w-72 lg:border-l lg:border-t-0">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-300">Inspector</h2>
        {selection?.type==="generatedBuilding"?<div className="space-y-2 text-xs">
          <p className="text-zinc-300">Generated city building. Convert it into authored geometry to move or edit it.</p>
          <button className={btn+" w-full"} onClick={promote}>Convert to editable</button>
        </div>:item?<div className="space-y-2">
          <p className="text-sm text-amber-300">{selection&&caption(selection)}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["x","z","w","d"] as const).map(key=><NumberInput key={key} label={key.toUpperCase()} value={item[key]??0}
              save={n=>editSelected(key,n)}/>)}
            {"h" in item&&<NumberInput label="Height" value={item.h??0} save={n=>editSelected("h",n)}/>}
            {"y" in item&&<NumberInput label="Y elevation" value={item.y??0} save={n=>editSelected("y",n)}/>}
          </div>
          {region&&<Picker label="Region shape" value={region.shape??"rect"} options={["rect","circle","triangle"]} save={n=>editSelected("shape",n)}/>}
          {feature&&<>
            <TextInput label="Label" value={feature.label??""} save={n=>editSelected("label",n)}/>
            <Picker label="Kind" value={feature.kind} options={["cover","accent","platform","stairs"]} save={n=>editSelected("kind",n)}/>
            {feature.kind==="stairs"&&<>
              <Picker label="Axis" value={feature.axis??"z"} options={["x","z"]} save={n=>editSelected("axis",n)}/>
              <Picker label="Downhill sign" value={String(feature.sign??1)} options={["1","-1"]}
                save={n=>editSelected("sign",Number(n))}/>
              <button className={btn+" w-full"} onClick={()=>{const result=nearestPlatformSnap(feature,plan.features);if(result)editPlan(p=>{p.features[selection!.index]=result;});}}>Snap to nearest platform</button>
            </>}
            {feature.kind==="cover"&&<button className={btn+" w-full"} onClick={()=>{const result=snapCoverToPlatform(feature,plan.features);if(result)editPlan(p=>{p.features[selection!.index]=result;});}}>Snap cover to platform top</button>}
            {feature.kind==="platform"&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={feature.autoStairs!==false} onChange={e=>editSelected("autoStairs",e.target.checked)}/> Auto stairs</label>}
          </>}
          {hazard&&<>
            <Picker label="Hazard type" value={hazard.type} options={hazardKinds} save={n=>editSelected("type",n)}/>
            {(hazard.type==="fire"?["dps"]:hazard.type==="spikes"?["damage","period","activeFor","offset"]:
              hazard.type==="jump_pad"?["launchX","launchY","launchZ"]:
              hazard.type==="moving_platform"?["toX","toY","toZ","period"]:["hp"]).map(k=>
              <NumberInput key={k} label={k} value={Number((hazard as unknown as Record<string,unknown>)[k]??0)} save={n=>editSelected(k,n)}/>)}
          </>}
          {prop&&<>
            <Picker label="Prop kind" value={prop.kind} options={kinds} save={n=>editSelected("kind",n)}/>
            <TextInput label="Signage / label" value={prop.text??""} save={n=>editSelected("text",n)}/>
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
        </div>:spawn?<div className="space-y-3">
          <p className="text-sm text-amber-300">{selection&&caption(selection)}</p>
          <div className="grid grid-cols-3 gap-1">
            {spawn.map((n,index)=><NumberInput key={index} label={["X","Y","Z"][index]} value={n} save={v=>editSelected(String(index),v)}/>)}
          </div>
          <button className={btn} onClick={duplicate}>Duplicate</button>
          <button className={btn+" ml-2 text-rose-300"} onClick={remove}>Delete</button>
        </div>:selection?.type.startsWith("legacy")?<div className="space-y-2 text-xs text-zinc-300">
          <p>{caption(selection)} · Existing engine geometry</p>
          <p>Use the 3D Move / Rotate / Resize gizmos. Overrides retain stable engine indices.</p>
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
              <Picker label={slot+" pattern"} value={current.theme.surfaces![slot].pattern}
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
            {issues.slice(0,25).map((p,i)=><p key={i} className={p.severity==="error"?"text-rose-300":"text-amber-300"}>{p.message}</p>)}
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
      <span className="truncate">{message}</span>
      <span className="ml-auto hidden whitespace-nowrap md:block">Auto-save · Single JSON per map · No direct multiplayer publishing</span>
    </footer>
  </main>;
}
