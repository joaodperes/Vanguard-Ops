"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { getMap, type CoverBox } from "@/lib/game-protocol";
import { featureBoxes, regionBoundary, overrideBox, type MapBlueprint } from "@/lib/map-blueprints";
import { cityBuildingBoxes, mapProps, CITY_USE_FACADE_COLORS, CITY_FACADE_TINTS, type MapProp, type MapVisualTheme } from "@/lib/map-visuals";
import { stairFlightBounds } from "@/lib/legacy-stair-flights";
import { horizontalSnap } from "@/lib/map-studio-elevation";
import {lockedPosition,normalizeTurns,rotatedExtents,type StudioAxis} from "@/lib/map-studio-transform";
import type {StudioMapIssue,StudioRegionLink} from "@/lib/map-studio-diagnostics";

export type StudioSelection={
  type:"region"|"feature"|"hazard"|"prop"|"spawn"|"legacyCover"|"legacyStairs"|"legacyEnvironment"|"generatedBuilding";
  index:number;team?:"ffa"|"red"|"blue";
};
export type StudioMode="select"|"move"|"rotate"|"resize";
export interface StudioTransform {
  x:number;y:number;z:number;w:number;h:number;d:number;
  /** Positive clockwise quarter-turns about world Y. Geometry remains axis-aligned. */
  turns:number;
}
interface Props {
  mapId:string;map:MapBlueprint;theme:MapVisualTheme;selected:StudioSelection|null;
  mode:StudioMode;moveAxis:StudioAxis;snap:number;tool:string;placementProp?:MapProp;legacySpawns?:[number,number,number][];showCollision?:boolean;
  warnings?:StudioMapIssue[];regionLinks?:StudioRegionLink[];placementProblem?:(x:number,z:number)=>string|null;
  onInvalidPlacement?:(reason:string)=>void;placementKit?:{w:number;d:number};
  onAddAt:(tool:string,point:{x:number;z:number})=>void;
  onSelect:(selection:StudioSelection|null)=>void;
  onTransform:(selection:StudioSelection,transform:StudioTransform)=>void;
}
interface ObjectMeta {
  selection:StudioSelection;
  initial:StudioTransform;
}
type Context={
  renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera;
  orbit:OrbitControls;transform:TransformControls;root:THREE.Group;
  objects:Map<string,THREE.Group>; keys:Set<string>;preview:THREE.Group;
};
const idFor=(s:StudioSelection)=>s.type+":"+s.index+":"+(s.team??"");
const minSize=.2;
const editableHex=(hex:string)=>/^#[0-9a-f]{6}$/i.test(hex)?hex:"#a3e635";

/** Three.js geometry preview. Map Studio exports data, not an executable map.
 * Physics uses the same box dimensions in src/lib/map-blueprints.ts. */
export default function MapStudio3D({mapId,map,theme,selected,mode,moveAxis,snap,tool,placementProp,legacySpawns=[],showCollision=false,
  warnings=[],regionLinks=[],placementProblem,onInvalidPlacement,placementKit,onSelect,onTransform,onAddAt}:Props) {
  const host=useRef<HTMLDivElement>(null);
  const [rendererError,setRendererError]=useState<string|null>(null);
  const runtime=useRef<Context|null>(null);
  const callbacks=useRef({selected,mode,moveAxis,snap,tool,onSelect,onTransform,onAddAt,placementProblem,onInvalidPlacement});
  callbacks.current={selected,mode,moveAxis,snap,tool,onSelect,onTransform,onAddAt,placementProblem,onInvalidPlacement};

  useEffect(()=>{
    if(!host.current)return;
    const element=host.current;
    const scene=new THREE.Scene();
    scene.background=new THREE.Color(editableHex(theme.palette.sky));
    scene.fog=new THREE.Fog(editableHex(theme.palette.fog),120,900);
    const camera=new THREE.PerspectiveCamera(60,1,.2,3000);
    camera.position.set(96,100,128);
    let renderer:THREE.WebGLRenderer;
    try {
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    }catch(error){
      setRendererError("3D rendering unavailable on this device. Use the 2D View toggle. "+String(error));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.domElement.tabIndex=0;
    renderer.domElement.style.cssText="width:100%;height:100%;display:block;outline:none";
    element.appendChild(renderer.domElement);
    const orbit=new OrbitControls(camera,renderer.domElement);
    orbit.enableDamping=true;
    orbit.dampingFactor=.12;
    orbit.screenSpacePanning=true;
    orbit.maxDistance=1300;
    orbit.minDistance=3;
    orbit.target.set(0,0,0);
    const transform=new TransformControls(camera,renderer.domElement);
    const helper=transform.getHelper();
    scene.add(helper);
    const root=new THREE.Group();
    const preview=new THREE.Group();preview.visible=false;scene.add(preview);
    scene.add(root);
    scene.add(new THREE.HemisphereLight("#e9f5ff","#5a626b",2));
    const light=new THREE.DirectionalLight("#fff0d9",2.4);
    light.position.set(80,160,35);
    scene.add(light);
    const axes=new THREE.AxesHelper(12);
    axes.position.set(0,.1,0);
    scene.add(axes);
    const floor=new THREE.GridHelper(700,140,"#607185","#303a46");
    floor.position.y=-.20;
    scene.add(floor);
    const ctx:Context={renderer,scene,camera,orbit,transform,root,objects:new Map(),keys:new Set(),preview};
    runtime.current=ctx;
    let gizmoActive=false;
    const onDragging=(event:unknown)=>{
      const dragging=(event as {value?:unknown})?.value===true;
      orbit.enabled=!dragging;
      if(dragging)gizmoActive=true;
    };
    transform.addEventListener("dragging-changed",onDragging);
    // TransformControls has one translationSnap shared by X, Y and Z. It
    // would quantize elevation in 2-unit jumps when the drawing grid is on.
    // Apply the horizontal grid ourselves while preserving sub-unit Y motion.
    const onObjectChange=()=>{
      if(callbacks.current.mode!=="move")return;
      const object=transform.object as THREE.Group|undefined;
      const initial=(object?.userData.editor as ObjectMeta|undefined)?.initial;
      if(!object||!initial)return;
      // Keep the other coordinates locked even if a plane or centre gizmo is hit.
      const position=lockedPosition(initial,object.position,callbacks.current.moveAxis);
      const axis=callbacks.current.moveAxis;
      if(callbacks.current.snap>0&&axis!=="y")
        position[axis]=horizontalSnap(position[axis],callbacks.current.snap);
      object.position.set(position.x,position.y,position.z);
    };
    transform.addEventListener("objectChange",onObjectChange);
    const onMouseUp=()=>{
      const group=transform.object as THREE.Group|undefined;
      const meta=group?.userData?.editor as ObjectMeta|undefined;
      if(!group||!meta)return;
      const d=meta.initial;
      const angle=Math.round(group.rotation.y/(Math.PI/2));
      const dimensions=rotatedExtents(d,angle,group.scale);
      const position=callbacks.current.mode==="move"
        ?lockedPosition(d,group.position,callbacks.current.moveAxis):group.position;
      const transformData:StudioTransform={
        x:position.x,y:position.y,z:position.z,
        w:Math.max(minSize,dimensions.w),h:Math.max(minSize,dimensions.h),
        d:Math.max(minSize,dimensions.d),turns:dimensions.turns
      };
      if(Math.abs(transformData.x-d.x)+Math.abs(transformData.y-d.y)+
        Math.abs(transformData.z-d.z)+Math.abs(transformData.w-d.w)+
        Math.abs(transformData.h-d.h)+Math.abs(transformData.d-d.d)+
        (dimensions.turns!==normalizeTurns(d.turns)?1:0)>.005)
        callbacks.current.onTransform(meta.selection,transformData);
    };
    transform.addEventListener("mouseUp",onMouseUp);
    const raycaster=new THREE.Raycaster();
    const pointer=new THREE.Vector2();
    const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const groundHit=new THREE.Vector3();
    const groundFromPointer=(clientX:number,clientY:number)=>{
      const bounds=renderer.domElement.getBoundingClientRect();
      pointer.set((clientX-bounds.left)/bounds.width*2-1,
        -(clientY-bounds.top)/bounds.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      return raycaster.ray.intersectPlane(ground,groundHit)?groundHit:null;
    };
    const movePreview=(event:PointerEvent)=>{
      if(callbacks.current.tool==="select"){preview.visible=false;return;}
      const hit=groundFromPointer(event.clientX,event.clientY);
      preview.visible=!!hit;
      if(hit){const step=callbacks.current.snap;
        const x=step?horizontalSnap(hit.x,step):hit.x;
        const z=step?horizontalSnap(hit.z,step):hit.z;
        preview.position.set(x,0,z);
        const problem=callbacks.current.placementProblem?.(x,z);
        preview.traverse(obj=>{
          if(obj instanceof THREE.Mesh&&obj.material instanceof THREE.MeshStandardMaterial)
            obj.material.color.set(problem?"#ef4444":"#34d399");
          if(obj instanceof THREE.LineSegments&&obj.material instanceof THREE.LineBasicMaterial)
            obj.material.color.set(problem?"#fca5a5":"#a7f3d0");
        });
      }
    };
    let down:{x:number;y:number}|null=null;
    const downHandler=(event:PointerEvent)=>{if(event.button===0)down={x:event.clientX,y:event.clientY};};
    const upHandler=(event:PointerEvent)=>{
      if(event.button!==0||!down)return;
      const moved=Math.hypot(down.x-event.clientX,down.y-event.clientY);
      down=null;
      // A gizmo pointer-up is never a new scene selection, even if the
      // TransformControls handler has already set dragging=false.
      if(gizmoActive){gizmoActive=false;return;}
      if(moved>5||transform.dragging)return;
      const hit=groundFromPointer(event.clientX,event.clientY);
      if(callbacks.current.tool!=="select"){
        if(hit){const step=callbacks.current.snap;
          const x=step?horizontalSnap(hit.x,step):hit.x;
          const z=step?horizontalSnap(hit.z,step):hit.z;
          const problem=callbacks.current.placementProblem?.(x,z);
          if(problem)callbacks.current.onInvalidPlacement?.("Cannot place here: "+problem);
          else callbacks.current.onAddAt(callbacks.current.tool,{x,z});}
        return;
      }
      const hits=raycaster.intersectObjects([...ctx.objects.values()],true);
      for(const hit of hits){
        let item:THREE.Object3D|null=hit.object;
        while(item&&!item.userData.editor)item=item.parent;
        if(item?.userData.editor){
          callbacks.current.onSelect((item.userData.editor as ObjectMeta).selection);
          return;
        }
      }
      callbacks.current.onSelect(null);
    };
    renderer.domElement.addEventListener("pointermove",movePreview);
    renderer.domElement.addEventListener("pointerdown",downHandler);
    renderer.domElement.addEventListener("pointerup",upHandler);
    let active=false;
    const mouseEnter=()=>{active=true;};
    const mouseLeave=()=>{active=false;ctx.keys.clear();preview.visible=false;};
    renderer.domElement.addEventListener("pointerenter",mouseEnter);
    renderer.domElement.addEventListener("pointerleave",mouseLeave);
    const keyDown=(e:KeyboardEvent)=>{
      if(!active||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
      ctx.keys.add(e.key.toLowerCase());
      if(["w","a","s","d","q","e","arrowup","arrowdown"].includes(e.key.toLowerCase()))e.preventDefault();
    };
    const keyUp=(e:KeyboardEvent)=>ctx.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown",keyDown);
    window.addEventListener("keyup",keyUp);
    const resize=()=>{
      const w=Math.max(1,element.clientWidth),h=Math.max(1,element.clientHeight);
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    };
    const observer=new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let request=0,last=performance.now();
    const forward=new THREE.Vector3(),right=new THREE.Vector3(),displace=new THREE.Vector3();
    function frame(now:number){
      request=requestAnimationFrame(frame);
      const dt=Math.min(.05,(now-last)/1000);last=now;
      if(active&&!transform.dragging){
        camera.getWorldDirection(forward);
        forward.y=0;forward.normalize();
        right.crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
        displace.set(0,0,0);
        const k=ctx.keys;
        if(k.has("w"))displace.add(forward);
        if(k.has("s"))displace.sub(forward);
        if(k.has("a"))displace.sub(right);
        if(k.has("d"))displace.add(right);
        if(k.has("q"))displace.y-=1;
        if(k.has("e"))displace.y+=1;
        if(displace.lengthSq()){
          const distance=dt*(k.has("shift")?110:35);
          displace.normalize().multiplyScalar(distance);
          camera.position.add(displace);orbit.target.add(displace);
        }
      }
      orbit.update();
      renderer.render(scene,camera);
    }
    request=requestAnimationFrame(frame);
    return ()=>{
      cancelAnimationFrame(request);
      observer.disconnect();
      window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);
      renderer.domElement.removeEventListener("pointermove",movePreview);
      renderer.domElement.removeEventListener("pointerdown",downHandler);
      renderer.domElement.removeEventListener("pointerup",upHandler);
      renderer.domElement.removeEventListener("pointerenter",mouseEnter);
      renderer.domElement.removeEventListener("pointerleave",mouseLeave);
      transform.removeEventListener("dragging-changed",onDragging);
      transform.removeEventListener("objectChange",onObjectChange);
      transform.removeEventListener("mouseUp",onMouseUp);
      transform.detach();transform.dispose();scene.remove(helper);
      orbit.dispose();
      disposeGroup(root);disposeGroup(preview);scene.remove(preview);
      renderer.dispose();renderer.domElement.remove();
      runtime.current=null;
    };
  },[]);

  useEffect(()=>{
    const ctx=runtime.current;
    if(!ctx)return;
    ctx.scene.background=new THREE.Color(editableHex(theme.palette.sky));
    ctx.scene.fog=new THREE.Fog(editableHex(theme.palette.fog),120,900);
    ctx.transform.detach();
    disposeGroup(ctx.root);
    ctx.objects.clear();
    const palette=theme.palette;
    const createBox=(group:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,hex:string,opacity=1)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.05,w),Math.max(.05,h),Math.max(.05,d)),
        new THREE.MeshStandardMaterial({color:hex,transparent:opacity<1,opacity,roughness:.78,
          side:THREE.DoubleSide,depthWrite:opacity>=1}));
      mesh.position.set(x,y,z);group.add(mesh);
      return mesh;
    };
    const add=(selection:StudioSelection,p:{x:number;y:number;z:number;w:number;h:number;d:number},
      draw:(g:THREE.Group)=>void,storedTurns=0)=>{
      const group=new THREE.Group();
      group.position.set(p.x,p.y,p.z);
      const turns=normalizeTurns(storedTurns);
      const meta:ObjectMeta={selection,initial:{...p,turns}};
      group.userData.editor=meta;
      // The persisted W/D and physics are already in world space. A visual
      // counter-rotation preserves those world boxes while keeping the real
      // quarter-turn on the transform pivot for future selections.
      group.rotation.y=turns*Math.PI/2;
      const content=new THREE.Group();
      content.rotation.y=-turns*Math.PI/2;
      group.add(content);
      draw(content);
      ctx.root.add(group);
      ctx.objects.set(idFor(selection),group);
    };
    // Coarse playable-district links; these are planning guides, not AI traces.
    for(const link of regionLinks){
      const vertices=new Float32Array([link.ax,.55,link.az,link.px,.55,link.pz,
        link.px,.55,link.pz,link.bx,.55,link.bz]);
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.BufferAttribute(vertices,3));
      ctx.root.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:"#5eead4"})));
      const portal=new THREE.Mesh(new THREE.SphereGeometry(1.35,8,6),
        new THREE.MeshBasicMaterial({color:"#2dd4bf"}));
      portal.position.set(link.px,.7,link.pz);ctx.root.add(portal);
    }
    // 3D error markers remain non-interactive and appear above the affected floor.
    for(const warning of warnings.slice(0,100)){
      const marker=new THREE.Mesh(new THREE.SphereGeometry(warning.severity==="error"?1.9:1.4,9,7),
        new THREE.MeshStandardMaterial({color:warning.severity==="error"?"#f87171":"#fbbf24",
          emissive:warning.severity==="error"?"#681818":"#4b3100"}));
      marker.position.set(warning.x,2.3,warning.z);
      ctx.root.add(marker);
    }
    for(let i=0;i<map.regions.length;i++){
      const r=map.regions[i];
      add({type:"region",index:i},{x:r.x,y:0,z:r.z,w:r.w,h:.2,d:r.d},g=>{
        if(r.shape==="circle"){
          const m=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.2,40),
            new THREE.MeshStandardMaterial({color:palette.floor,transparent:true,opacity:.42,side:THREE.DoubleSide}));
          m.scale.set(r.w,1,r.d);g.add(m);
        } else if(r.shape==="triangle"){
          const shape=new THREE.Shape();
          shape.moveTo(0,.5);shape.lineTo(-.5,-.5);shape.lineTo(.5,-.5);shape.closePath();
          const geometry=new THREE.ShapeGeometry(shape);
          geometry.rotateX(-Math.PI/2);
          geometry.scale(r.w,1,r.d);
          const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
            color:palette.floor,transparent:true,opacity:.42,side:THREE.DoubleSide}));
          g.add(m);
        }else createBox(g,0,0,0,r.w,.2,r.d,palette.floor,.36);
      });
    }
    // Collision perimeter preview is deliberately not clickable; select regions instead.
    const outline=regionBoundary(map.regions);
    for(const edge of outline){
      createBox(ctx.root,edge.pos[0],edge.pos[1],edge.pos[2],
        edge.size[0]*2,edge.size[1]*2,edge.size[2]*2,palette.wall,.17);
    }
    for(let i=0;i<map.features.length;i++){
      const f=map.features[i];
      add({type:"feature",index:i},{x:f.x,y:f.y??0,z:f.z,w:f.w,h:f.h,d:f.d},g=>{
        for(const b of featureBoxes(f)){
          createBox(g,b.pos[0]-f.x,b.pos[1]-(f.y??0),b.pos[2]-f.z,
            b.size[0]*2,b.size[1]*2,b.size[2]*2,b.kind==="stair"?palette.stair:
              f.kind==="platform"?palette.platform:palette.cover,.86);
        }
      },f.turns);
    }
    for(let i=0;i<(map.hazards??[]).length;i++){
      const h=map.hazards![i];
      add({type:"hazard",index:i},{x:h.x,y:h.y,z:h.z,w:h.w,h:h.h,d:h.d},g=>
        createBox(g,0,0,0,h.w,h.h,h.d,h.type==="fire"?"#ef4444":h.type==="spikes"?"#fb7185":
          h.type==="jump_pad"?"#38bdf8":"#f97316",.55),h.turns);
    }
    for(const team of ["ffa","red","blue"] as const){
      const arr=map.spawns[team];
      for(let i=0;i<arr.length;i++){
        const p=arr[i];
        add({type:"spawn",team,index:i},{x:p[0],y:p[1],z:p[2],w:2,h:2,d:2},g=>{
          const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),
            new THREE.MeshStandardMaterial({color:team==="red"?"#f87171":team==="blue"?"#38bdf8":"#fde047"}));
          mesh.position.y=1;g.add(mesh);
        });
      }
    }
    const drawBuilding=(g:THREE.Group,p:MapProp,opacity:number)=>{
      const w=p.w??20,h=p.h??6.4,d=p.d??20;
      // Match the live FPS renderer's exact linear-space façade blending.
      const facade=p.color??("#"+new THREE.Color(CITY_USE_FACADE_COLORS[p.use??"house"]??0x9f8f87)
        .lerp(new THREE.Color(CITY_FACADE_TINTS[p.facade??"brick"]??0xa45b48),.39).getHexString());
      const localY=p.y??0;
      // Both views derive roofs, doors, hatch gaps and stairs from the same
      // authoritative collision grammar. Visual mode hides only dense furniture
      // and non-exterior solids to remain responsive on large city maps.
      const boxes=cityBuildingBoxes(p);
      for(const c of boxes){
        const dx=Math.abs(c.pos[0]-p.x),dz=Math.abs(c.pos[2]-p.z);
        const exterior=dx>w*.31||dz>d*.31;
        if(!showCollision&&c.kind==="cover"&&(!exterior||c.size[1]<Math.min(1.25,h*.20)))continue;
        createBox(g,c.pos[0]-p.x,c.pos[1]-localY,c.pos[2]-p.z,
          c.size[0]*2,c.size[1]*2,c.size[2]*2,
          c.kind==="stair"?palette.stair:c.kind==="platform"?palette.platform:facade,
          showCollision?opacity:Math.min(1,opacity+.12));
      }
      const rows=h>8?2:1;
      for(let row=0;row<rows;row++){
        const y=Math.min(h-1.1,2.8+row*2.9);
        for(const side of [-1,1]){
          createBox(g,side*w*.29,y,-d/2-.25,Math.min(2.4,w*.19),1.15,.16,"#415e70",.94);
        }
      }
      if(["cafe","supermarket","bakery","diner","florist"].includes(p.use??"")){
        createBox(g,0,2.9,d/2+.7,Math.min(w*.78,18),.24,1.5,palette.accent,.95);
      }
    };
    for(let i=0;i<theme.props.length;i++){
      const p=theme.props[i];
      const w=p.w??4,h=p.h??5,d=p.d??4;
      add({type:"prop",index:i},{x:p.x,y:p.y??0,z:p.z,w,h,d},g=>{
        if(p.kind==="building")drawBuilding(g,p,.92);
        else createBox(g,0,h/2,0,w,h,d,p.color??palette.accent,.62);
      },p.turns);
    }
    // Generated city lots are selectable: picking one promotes it into an
    // authored prop and masks its original lot in both game variants.
    if(theme.biome==="city"||theme.biome==="city_day"){
      const generated=mapProps(mapId,map,theme,legacySpawns).filter(
        p=>p.kind==="building"&&!!p.lotId&&!theme.props.includes(p));
      generated.forEach((p,i)=>{
        add({type:"generatedBuilding",index:i},{x:p.x,y:p.y??0,z:p.z,w:p.w??20,h:p.h??6,d:p.d??20},
          g=>drawBuilding(g,p,.8),p.turns);
      });
    }
    const compiled=getMap(mapId);
    const compiledForThisMap=compiled.id===mapId;
    const base=compiledForThisMap?compiled:getMap(map.templateMapId);
    // Treat each original flight as ONE selection/transform target. Source
    // membership is captured before any per-step overrides, so an edited
    // step cannot accidentally split or reassign a flight.
    const stairIndices=new Set<number>();
    for(const flight of base.editorLegacyStairFlights??[]){
      if(flight.indices.every(i=>(map.legacyCoverDisabled??[]).includes(i)))continue;
      const steps=flight.indices.filter(i=>!(map.legacyCoverDisabled??[]).includes(i)).map(i=>{
        stairIndices.add(i);
        const original=base.editorLegacyCoverSource?.[i]??base.cover[i];
        return original?overrideBox(original,map.legacyCoverOverrides?.[String(i)]):null;
      }).filter((b):b is CoverBox=>b!==null);
      if(!steps.length)continue;
      const bounds=stairFlightBounds(steps);
      if(compiledForThisMap){
        add({type:"legacyStairs",index:flight.start},bounds,g=>{
          for(const b of steps){
            createBox(g,b.pos[0]-bounds.x,b.pos[1]-bounds.y,b.pos[2]-bounds.z,
              b.size[0]*2,b.size[1]*2,b.size[2]*2,palette.stair,.8);
          }
        },map.legacyCoverOverrides?.[String(flight.start)]?.turns);
      }else for(const b of steps)createBox(ctx.root,b.pos[0],b.pos[1],b.pos[2],
        b.size[0]*2,b.size[1]*2,b.size[2]*2,palette.stair,.25);
    }
    for(let i=0;i<(base.editorLegacyCoverSource?.length??base.editorLegacyCoverCount??0);i++){
      if(stairIndices.has(i)||(map.legacyCoverDisabled??[]).includes(i))continue;
      const original=base.editorLegacyCoverSource?.[i]??base.cover[i];
      if(!original)continue;
      const b=overrideBox(original,map.legacyCoverOverrides?.[String(i)]);
      if(compiledForThisMap){
        add({type:"legacyCover",index:i},{
          x:b.pos[0],y:b.pos[1],z:b.pos[2],w:b.size[0]*2,h:b.size[1]*2,d:b.size[2]*2},g=>
          createBox(g,0,0,0,b.size[0]*2,b.size[1]*2,b.size[2]*2,
            b.kind==="stair"?palette.stair:"#728399",.64),map.legacyCoverOverrides?.[String(i)]?.turns);
      }else createBox(ctx.root,b.pos[0],b.pos[1],b.pos[2],
        b.size[0]*2,b.size[1]*2,b.size[2]*2,"#728399",.28);
    }
    for(let i=0;i<(base.editorLegacyEnvironmentSource?.length??base.editorLegacyEnvironmentCount??0);i++){
      if((map.legacyEnvironmentDisabled??[]).includes(i))continue;
      const original=base.editorLegacyEnvironmentSource?.[i]??base.environment?.[i];
      if(!original)continue;
      const b=overrideBox(original,map.legacyEnvironmentOverrides?.[String(i)]);
      if(compiledForThisMap){
        add({type:"legacyEnvironment",index:i},{
          x:b.pos[0],y:b.pos[1],z:b.pos[2],w:b.size[0]*2,h:b.size[1]*2,d:b.size[2]*2},g=>
          createBox(g,0,0,0,b.size[0]*2,b.size[1]*2,b.size[2]*2,"#d946ef",.45),
          map.legacyEnvironmentOverrides?.[String(i)]?.turns);
      }else createBox(ctx.root,b.pos[0],b.pos[1],b.pos[2],
        b.size[0]*2,b.size[1]*2,b.size[2]*2,"#d946ef",.25);
    }
  },[map,theme,mapId,showCollision,legacySpawns,warnings,regionLinks]);

  // Ghost placement follows the pointer across the ground plane; one click
  // stamps a new object. The existing camera-focus button remains a fallback.
  useEffect(()=>{
    const ctx=runtime.current;if(!ctx)return;
    const preview=ctx.preview;disposeGroup(preview);preview.visible=tool!=="select";
    if(tool==="select")return;
    const w=tool==="prop"?(placementProp?.w??5):tool==="kit"?(placementKit?.w??24):["region","circle","triangle"].includes(tool)?32:tool==="stairs"?4:12;
    const d=tool==="prop"?(placementProp?.d??5):tool==="kit"?(placementKit?.d??22):["region","circle","triangle"].includes(tool)?32:tool==="stairs"?8:12;
    const h=tool==="prop"?(placementProp?.h??5):["region","circle","triangle"].includes(tool)?0.2:tool==="stairs"||tool==="platform"?4.2:2.8;
    const material=new THREE.MeshStandardMaterial({color:"#fbbf24",transparent:true,opacity:.36,depthWrite:false});
    const geometry=tool==="circle"?new THREE.CylinderGeometry(w/2,w/2,Math.max(.2,h),32):
      new THREE.BoxGeometry(w,Math.max(.2,h),d);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.y=h/2;preview.add(mesh);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:"#fde68a"}));
    edges.position.y=h/2;preview.add(edges);
    return ()=>{disposeGroup(preview);preview.visible=false;};
  },[tool,placementProp?.kind,placementProp?.use,placementProp?.shape,placementProp?.w,placementProp?.d,placementProp?.h,placementKit?.w,placementKit?.d]);

  useEffect(()=>{
    const ctx=runtime.current;
    if(!ctx)return;
    const transform=ctx.transform;
    transform.detach();
    for(const group of ctx.objects.values()){
      group.traverse(object=>{
        const mesh=object as THREE.Mesh;
        if(mesh.material && !Array.isArray(mesh.material) && "emissive" in mesh.material)
          (mesh.material as THREE.MeshStandardMaterial).emissive.set("#000000");
      });
    }
    if(!selected)return;
    const group=ctx.objects.get(idFor(selected));
    if(!group)return;
    group.traverse(object=>{
      const mesh=object as THREE.Mesh;
      if(mesh.material && !Array.isArray(mesh.material) && "emissive" in mesh.material)
        (mesh.material as THREE.MeshStandardMaterial).emissive.set("#554214");
    });
    if(mode==="select")return;
    if(mode==="rotate"&&(selected.type==="region"||selected.type==="spawn"))return;
    transform.attach(group);
    transform.setMode(mode==="move"?"translate":mode==="resize"?"scale":"rotate");
    // Do not use built-in translationSnap: it also snaps Y.
    transform.translationSnap=null;
    transform.setRotationSnap(Math.PI/2);
    transform.setSpace("world");
    // Existing game collision boxes are axis-aligned. Rotate only around Y,
    // with quarter-turn snapping so the exported dimensions match physics.
    transform.showX=mode==="move"?moveAxis==="x":mode!=="rotate";
    transform.showZ=mode==="move"?moveAxis==="z":mode!=="rotate";
    transform.showY=mode==="rotate" || (mode==="move"?moveAxis==="y":
      selected.type!=="region"&&selected.type!=="spawn");
  },[selected,mode,moveAxis,snap,map,theme,mapId]);

  return <div className="relative w-full h-[63vh] min-h-[420px] max-h-[880px] bg-zinc-950">
    <div ref={host} className="absolute inset-0"
      aria-label="Interactive 3D map editor. Drag to orbit, right-drag to pan, scroll to zoom, WASD to fly and Q/E to change elevation."/>
    {rendererError&&<p role="alert" className="absolute inset-0 flex items-center justify-center bg-zinc-950 p-6 text-sm text-amber-200">{rendererError}</p>}
    {tool!=="select"&&!rendererError&&<button className="absolute bottom-4 left-4 z-10 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-black shadow-lg hover:bg-amber-400"
      onClick={()=>{
        const point=runtime.current?.orbit.target;
        if(point)onAddAt(tool,{x:point.x,z:point.z});
      }}>
      Add {tool.replaceAll("_"," ")} at camera focus
    </button>}
    {(selected?.type==="legacyCover"||selected?.type==="legacyStairs")&&
      <div className="pointer-events-none absolute bottom-4 right-4 rounded bg-black/80 px-3 py-2 text-xs text-amber-200">
        {selected.type==="legacyStairs"?"Entire staircase selected — move, rotate or resize the full flight":
          "Existing engine geometry #"+(selected.index+1)} — edit in Inspector or use a 3D gizmo
      </div>}
  </div>;
}

function disposeGroup(root:THREE.Group){
  const resources=new Set<THREE.Material>();
  root.traverse(object=>{
    if(object instanceof THREE.Mesh || object instanceof THREE.LineSegments){
      object.geometry.dispose();
      if(Array.isArray(object.material))object.material.forEach(m=>resources.add(m));
      else resources.add(object.material);
    }
  });
  resources.forEach(m=>m.dispose());
  root.clear();
}
