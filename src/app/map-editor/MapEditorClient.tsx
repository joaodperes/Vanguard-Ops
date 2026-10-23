"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MAP_BLUEPRINTS, insideRegions, validateBlueprint,
  type MapBlueprint, type MapBlueprintFile, type MapFeature, type MapRegion,
} from "@/lib/map-blueprints";
import { ArrowLeft, Copy, Download, FileUp, Plus, RotateCcw, Trash2, MousePointer2, Grid2x2, Layers3, Flag, AlertTriangle, Save } from "lucide-react";

type BlueprintDoc = Omit<MapBlueprintFile,"maps"> & {maps:Record<string,MapBlueprint>};
type Team="ffa"|"red"|"blue";
type Selection={type:"region"|"feature"|"spawn";index:number;team?:Team};
type Tool="select"|"region"|"cover"|"platform"|"ffa"|"red"|"blue";
type Point={x:number;z:number};
type Drag =
  | {mode:"create";start:Point;tool:Tool}
  | {mode:"move";start:Point;item:Selection;source:MapRegion|MapFeature|[number,number,number]};
const STARTER:BlueprintDoc=MAP_BLUEPRINTS as BlueprintDoc;
const snap=(n:number,step=2)=>Math.round(n/step)*step;
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const color:Record<Team,string>={ffa:"#fbbf24",red:"#f87171",blue:"#38bdf8"};
const fieldClass="w-full rounded-md border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-amber-400/70 outline-none";
const btn="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-zinc-800/80 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-30";

export default function MapEditor() {
  const [doc,setDoc]=useState<BlueprintDoc>(()=>clone(STARTER));
  const [mapId,setMapId]=useState("compound");
  const [tool,setTool]=useState<Tool>("select");
  const [selected,setSelected]=useState<Selection|null>(null);
  const [preview,setPreview]=useState<{start:Point;end:Point}|null>(null);
  const [newId,setNewId]=useState("");
  const [zoom,setZoom]=useState(100);
  const [gridSnapEnabled,setGridSnapEnabled]=useState(true);
  const [gridSnapStep,setGridSnapStep]=useState(2);
  const [status,setStatus]=useState("Export the JSON into src/data/map-blueprints.json to publish changes.");
  const svg=useRef<SVGSVGElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const drag=useRef<Drag|null>(null);
  const history=useRef<BlueprintDoc[]>([]);
  const map=doc.maps[mapId];

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
      sel.type==="feature"?map.features[sel.index]:map.spawns[sel.team!][sel.index];
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
    update(m=>{
      if(sel.type==="region")return {...m,regions:m.regions.map((r,i)=>i===sel.index?
        {...r,x:(source as MapRegion).x+dx,z:(source as MapRegion).z+dz}:r)};
      if(sel.type==="feature")return {...m,features:m.features.map((f,i)=>i===sel.index?
        {...f,x:(source as MapFeature).x+dx,z:(source as MapFeature).z+dz}:f)};
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
        const w=Math.max(d.tool==="region"?12:4,Math.abs(p.x-start.x));
        const depth=Math.max(d.tool==="region"?12:4,Math.abs(p.z-start.z));
        const x=(start.x+p.x)/2,z=(start.z+p.z)/2;
        if(d.tool==="region"){
          const index=map.regions.length;
          update(m=>({...m,regions:[...m.regions,{x,z,w,d:depth}]}));
          setSelected({type:"region",index});
        }else{
          const index=map.features.length;
          const kind=d.tool as "cover"|"platform";
          const feature:MapFeature={id:`custom-${Date.now().toString(36)}-${index}`,
            x,z,w:Math.max(w,kind==="platform"?10:4),d:Math.max(depth,kind==="platform"?10:4),
            h:kind==="platform"?4.2:2.8,kind,label:"New "+kind};
          update(m=>({...m,features:[...m.features,feature]}));
          setSelected({type:"feature",index});
        }
      }
      setTool("select");
    }
    drag.current=null;setPreview(null);
    try{svg.current?.releasePointerCapture(e.pointerId);}catch{}
  };
  const changeSelected=(key:string,value:string|number)=>{
    if(!selected)return;
    pushUndo();
    const sel=selected;
    update(m=>{
      if(sel.type==="region"){
        return {...m,regions:m.regions.map((r,i)=>i===sel.index?
          {...r,[key]:Number(value)}:r)};
      }
      if(sel.type==="feature"){
        return {...m,features:m.features.map((r,i)=>i===sel.index?
          {...r,[key]:["id","kind","label"].includes(key)?value:Number(value)}:r)};
      }
      const t=sel.team!,axis=Number(key);
      return {...m,spawns:{...m.spawns,[t]:m.spawns[t].map((r,i)=>i===sel.index?
        r.map((v,j)=>j===axis?Number(value):v) as [number,number,number]:r)}};
    });
  };
  const remove=()=>{
    if(!selected)return;pushUndo();
    const s=selected;
    update(m=>s.type==="region"?{...m,regions:m.regions.filter((_,i)=>i!==s.index)}:
      s.type==="feature"?{...m,features:m.features.filter((_,i)=>i!==s.index)}:
      {...m,spawns:{...m.spawns,[s.team!]:m.spawns[s.team!].filter((_,i)=>i!==s.index)}});
    setSelected(null);
  };
  const duplicate=()=>{
    if(!selected||selected.type==="spawn")return;pushUndo();
    const s=selected;
    if(s.type==="region"){const index=map.regions.length;
      update(m=>({...m,regions:[...m.regions,{...m.regions[s.index],x:m.regions[s.index].x+12}]}));
      setSelected({type:"region",index});
    }else{const index=map.features.length;update(m=>({...m,features:[...m.features,
      {...m.features[s.index],id:`copy-${Date.now().toString(36)}`,x:m.features[s.index].x+10}]}));
      setSelected({type:"feature",index});
    }
  };
  const createMap=()=>{
    const id=newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"_");
    if(!id||doc.maps[id]){setStatus("Choose a new, unique map ID.");return;}
    pushUndo();
    const template=map.templateMapId || (["bunker","shipyard","compound","terminal","skybridge","arena_neon"].includes(mapId)?mapId:"compound");
    setDoc(v=>({...v,maps:{...v.maps,[id]:{...clone(map),name:id.replace(/_/g," ").toUpperCase(),shortName:id.slice(0,3).toUpperCase(),templateMapId:template}}}));
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
  const selectedObject=selected?(selected.type==="region"?map.regions[selected.index]:
    selected.type==="feature"?map.features[selected.index]:map.spawns[selected.team!][selected.index]):null;
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
        if(map.features.some(f=>f.kind!=="accent" && Math.abs(p[0]-f.x)<f.w/2+1 &&
          Math.abs(p[2]-f.z)<f.d/2+1 && p[1]<f.h))
          problems.push(`${team} spawn ${i+1} intersects an authored solid`);
      });
    return problems;
  },[map]);
  if(!map)return <main className="p-10 bg-zinc-950 text-white">No map selected.</main>;
  const extent=Math.max(85,...map.regions.flatMap(r=>[Math.abs(r.x)+r.w/2,Math.abs(r.z)+r.d/2]))+28;
  const radius=extent*100/zoom;
  const shape=preview?{x:(preview.start.x+preview.end.x)/2,z:(preview.start.z+preview.end.z)/2,
    w:Math.max(4,Math.abs(preview.end.x-preview.start.x)),d:Math.max(4,Math.abs(preview.end.z-preview.start.z))}:null;

  return <div className="min-h-screen bg-[#090b10] text-zinc-100">
    <header className="border-b border-white/10 bg-zinc-950 px-4 py-3 flex flex-wrap items-center gap-3">
      <Link href="/" className={btn}><ArrowLeft size={15}/> Game</Link>
      <div><div className="text-sm font-black tracking-[.22em]">VANGUARD / MAP STUDIO</div>
        <div className="text-[11px] text-zinc-500">Visual authoring • JSON source of truth • local drafts</div></div>
      <div className="ml-auto flex gap-2 flex-wrap">
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
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Paint tools</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["select","Select / Move",MousePointer2],["region","Region",Grid2x2],
              ["cover","Hard cover",Layers3],["platform","High platform",Layers3],
              ["ffa","FFA spawn",Flag],["red","Red spawn",Flag],["blue","Blue spawn",Flag]
            ] as const).map(([key,label,Icon])=>
              <button key={key} onClick={()=>{setTool(key);setSelected(null);}} className={`rounded-lg p-2 border text-left text-xs flex items-center gap-1.5 ${tool===key?"bg-amber-500/15 border-amber-500 text-amber-200":"bg-zinc-900 border-white/10 hover:bg-zinc-800 text-zinc-300"}`}>
                <Icon size={14}/>{label}
              </button>)}
          </div>
          <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
            Drag on the grid to draw regions or structures. Click to place a spawn.
            Use Select to drag and reposition. Adjust exact dimensions in the inspector.
            Platforms automatically generate two walkable stair approaches.
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
          <p className="text-[11px] text-zinc-500 mt-2">Snap applies to X/Z placement. Platform stairs already match platform height automatically.</p>
        </section>
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
            <p className="text-xs text-zinc-500">{map.regions.length} regions · {map.features.length} features · {Object.values(map.spawns).flat().length} spawn points</p></div>
          <label className="text-xs text-zinc-400 flex items-center gap-2">Zoom
            <input aria-label="Zoom" type="range" min="55" max="180" step="5" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>
            <span className="tabular-nums w-10">{zoom}%</span></label>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0b1118] overflow-hidden shadow-2xl">
          <svg ref={svg} viewBox={`${-radius} ${-radius} ${radius*2} ${radius*2}`}
            className="w-full h-[63vh] min-h-[420px] max-h-[880px] select-none"
            style={{touchAction:"none"}} onPointerDown={onPointerDown}
            onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <defs><pattern id="mapgrid" patternUnits="userSpaceOnUse" width="10" height="10">
              <path d="M10 0H0V10" fill="none" stroke="#405063" strokeOpacity=".38" strokeWidth=".28"/>
            </pattern></defs>
            <rect x={-radius} y={-radius} width={radius*2} height={radius*2} fill="url(#mapgrid)"/>
            <path d={`M${-radius} 0 H${radius} M0 ${-radius} V${radius}`} stroke="#8191a3" strokeWidth=".4" strokeDasharray="4 3"/>
            {map.regions.map((r,i)=><rect key={i} x={r.x-r.w/2} y={r.z-r.d/2} width={r.w} height={r.d}
              fill="#15403d" fillOpacity=".43" stroke={selected?.type==="region"&&selected.index===i?"#f59e0b":"#34d399"}
              strokeWidth={selected?.type==="region"&&selected.index===i?1.6:0.65} pointerEvents={tool==="select"?"all":"stroke"}
              style={{cursor:tool==="select"?"move":"crosshair"}}
              onPointerDown={e=>beginMove(e,{type:"region",index:i})}/>)}
            {map.features.map((f,i)=><g key={f.id||i} onPointerDown={e=>beginMove(e,{type:"feature",index:i})}
              style={{cursor:tool==="select"?"move":"crosshair"}}>
              <rect x={f.x-f.w/2} y={f.z-f.d/2} width={f.w} height={f.d}
                fill={f.kind==="platform"?"#cb8b47":f.kind==="accent"?"#a855f7":"#64748b"}
                stroke={selected?.type==="feature"&&selected.index===i?"#fef08a":"#d1d5db"}
                strokeWidth={selected?.type==="feature"&&selected.index===i?1.5:0.5} rx=".45"/>
              {f.kind==="platform"&&<><rect x={f.x-2} y={f.z+f.d/2} width="4" height={Math.ceil(f.h/.42)*.76} fill="#fbbf24" fillOpacity=".35" stroke="#f59e0b" strokeWidth=".25"/>
                <rect x={f.x-2} y={f.z-f.d/2-Math.ceil(f.h/.42)*.76} width="4" height={Math.ceil(f.h/.42)*.76} fill="#fbbf24" fillOpacity=".35" stroke="#f59e0b" strokeWidth=".25"/></>}
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
              <rect x={shape.x-shape.w/2} y={shape.z-shape.d/2} width={shape.w} height={shape.d}
                fill="#f59e0b" fillOpacity=".2" stroke="#fbbf24" strokeWidth="1.4" strokeDasharray="3 2" pointerEvents="none"/>}
            <text x={-radius+7} y={-radius+12} fill="#9ca3af" fontSize="7">N ↑</text>
            <text x={radius-5} y={radius-6} fill="#64748b" fontSize="5" textAnchor="end">X → / Z ↓ · 10u grid</text>
          </svg>
        </div>
        <p role="status" className="text-xs text-zinc-400 mt-3">{status}</p>
      </main>
      <aside className="border-l border-white/10 bg-zinc-950/60 p-4 space-y-5">
        <section><h2 className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-3">Inspector</h2>
          {selected&&selectedObject?
            <div className="space-y-3">
              <div className="text-sm font-semibold capitalize text-amber-300">{selected.type} #{selected.index+1}
                {selected.team?" / "+selected.team.toUpperCase():""}</div>
              {selected.type==="spawn"?(
                <div className="grid grid-cols-3 gap-2">{["0","1","2"].map((a,i)=>
                  <label key={a} className="text-xs text-zinc-500">{["X","Y","Z"][i]}
                    <input className={fieldClass} type="number" value={(selectedObject as number[])[i]}
                      onChange={e=>changeSelected(a,e.target.value)}/></label>)}</div>
              ):<>
                {selected.type==="feature"&&<><label className="block text-xs text-zinc-400">ID
                  <input className={fieldClass} value={(selectedObject as MapFeature).id} onChange={e=>changeSelected("id",e.target.value)}/></label>
                  <label className="block text-xs text-zinc-400">Label
                    <input className={fieldClass} value={(selectedObject as MapFeature).label||""} onChange={e=>changeSelected("label",e.target.value)}/></label></>}
                <div className="grid grid-cols-2 gap-2">{(["x","z","w","d",...(selected.type==="feature"?["h"]:[])] as string[]).map(k=>
                  <label key={k} className="text-xs text-zinc-500 uppercase">{k==="w"?"Width":k==="d"?"Depth":k==="h"?"Height":k}
                    <input type="number" step="0.5" className={fieldClass} value={(selectedObject as unknown as Record<string,number>)[k]}
                      onChange={e=>changeSelected(k,e.target.value)}/></label>)}</div>
                {selected.type==="feature"&&<label className="block text-xs text-zinc-400">Type
                  <select className={fieldClass} value={(selectedObject as MapFeature).kind} onChange={e=>changeSelected("kind",e.target.value)}>
                    <option value="cover">Hard cover</option><option value="platform">Elevated platform + stairs</option><option value="accent">Decorative / nonblocking</option>
                  </select></label>}
                {selected.type==="feature"&&(selectedObject as MapFeature).kind==="platform"&&
                  <p className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-zinc-300">
                    Automatic north/south stairs: {Math.ceil(Math.max(.3,(selectedObject as MapFeature).h)/.42)} steps
                    per side, about {(Math.ceil(Math.max(.3,(selectedObject as MapFeature).h)/.42)*.76).toFixed(1)}u
                    of run. The Height field controls the landing elevation; stairs match it automatically.
                  </p>}
              </>}
              <div className="flex gap-2">
                {selected.type!=="spawn"&&<button className={btn} onClick={duplicate}><Copy size={13}/> Duplicate</button>}
                <button className={btn+" text-rose-300"} onClick={remove}><Trash2 size={13}/> Delete</button>
              </div>
            </div>:
            <p className="text-xs text-zinc-500">Select a region, solid, platform, or spawn to edit its properties.</p>}
        </section>
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
