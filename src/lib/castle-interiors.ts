/** Medieval workshop and household interiors. The fixture positions and footprints
 * come from castle-scenery.ts, so gameplay and visuals share one room plan.
 * These detailed meshes replace the previously-visible anonymous stone AABBs.
 */
import * as THREE from "three";
import {castleFixtures,castleBallisticId,castleBallisticMaterial,type CastleProp,type CastleFixture} from "./castle-scenery";
const mat=(color:number,metal=0,emissive=0)=>new THREE.MeshStandardMaterial({
  color,roughness:.82,metalness:metal,emissive,emissiveIntensity:emissive?.28:0});
const wood=mat(0x95663f),darkWood=mat(0x523927),iron=mat(0x565b5a,.64),
  pewter=mat(0x9e9690,.42),straw=mat(0xb79b58),linen=mat(0xc7b9a0),
  sack=mat(0x918065),leather=mat(0x704a34),stone=mat(0x81796d),
  red=mat(0x853a32),herb=mat(0x54734f),charcoal=mat(0x282725),
  ceramic=mat(0xa5a39b),fire=new THREE.MeshBasicMaterial({color:0xf69837});
function box(g:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number){
  const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  obj.position.set(x,y,z);obj.castShadow=h>.45;obj.receiveShadow=true;g.add(obj);
  return obj;
}
function cylinder(g:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,r:number,h:number,sides=10){
  const obj=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,sides),m);
  obj.position.set(x,y,z);obj.castShadow=h>.5;g.add(obj);return obj;
}
function frame(g:THREE.Object3D,w:number,d:number,h:number){
  for(const sx of [-1,1])for(const sz of [-1,1])
    box(g,darkWood,sx*(w/2-.08),h*.35,sz*(d/2-.08),.13,h*.7,.13);
}
function bench(g:THREE.Object3D,w:number,d:number,h:number){
  box(g,wood,0,h*.79,0,w,.18,d);
  for(const sx of [-1,1])box(g,darkWood,sx*w*.37,h*.37,0,.14,h*.69,d*.62);
}
function cask(g:THREE.Object3D,x:number,z:number,r:number,h:number){
  cylinder(g,wood,x,h/2,z,r*.88,h);
  for(const y of [h*.19,h*.82])cylinder(g,iron,x,y,z,r,.09);
}
function bed(g:THREE.Object3D,w:number,d:number,bunk:boolean){
  box(g,darkWood,0,.31,0,w,.30,d);
  box(g,linen,0,.55,0,w*.92,.20,d*.88);
  box(g,linen,0,.68,-d*.30,w*.73,.16,d*.18);
  if(bunk){
    for(const sx of [-1,1])for(const sz of [-1,1])
      box(g,wood,sx*w*.44,1.10,sz*d*.42,.12,2.05,.12);
    box(g,darkWood,0,1.43,0,w,.19,d);
    box(g,linen,0,1.61,0,w*.92,.20,d*.86);
    box(g,linen,0,1.75,-d*.30,w*.73,.12,d*.18);
    for(const y of [.48,.90,1.34])box(g,wood,w*.48,y,d*.28,.13,.09,d*.27);
  }
}
function visibleFixture(g:THREE.Object3D,f:CastleFixture):void {
  const {w,d,h,style}=f;
  const r=Math.min(w,d)*.36;
  switch(style){
    case "forge":case "oven":{
      box(g,stone,0,h*.43,0,w,h*.85,d);
      box(g,charcoal,0,h*.51,d*.505,w*.61,h*.48,.08);
      for(const x of [-w*.23,0,w*.23]){
        const flame=new THREE.Mesh(new THREE.ConeGeometry(.13,.45,5),fire);
        flame.position.set(x,h*.50,d*.55);g.add(flame);
      }
      box(g,stone,0,h*.91,0,w*.97,.15,d*.97);
      break;
    }
    case "anvil":{
      box(g,darkWood,0,.42,0,w*.56,.81,d*.57);
      box(g,iron,0,1.04,0,w*.74,.27,d*.44);
      box(g,iron,-w*.33,1.12,0,w*.26,.16,d*.20);
      box(g,pewter,0,1.24,0,w*.37,.14,d*.28);
      break;
    }
    case "coal":case "grain_bin":case "feed_bin":{
      box(g,wood,0,h*.34,0,w,h*.67,d);
      box(g,style==="coal"?charcoal:style==="grain_bin"?sack:straw,
        0,h*.70,0,w*.81,.12,d*.76);
      for(const x of [-w*.40,w*.40])box(g,darkWood,x,h*.44,d*.48,.12,h*.78,.12);
      break;
    }
    case "bellows":{
      box(g,wood,0,.24,0,w*.89,.46,d*.85);
      box(g,leather,0,.73,0,w*.72,.48,d*.70);
      box(g,wood,0,1.02,0,w*.79,.12,d*.67);
      box(g,iron,w*.29,1.04,-d*.08,.13,.24,.15);
      break;
    }
    case "trough":{
      // Stable manger, with a visible recessed bed of fodder and timber rim.
      box(g,darkWood,0,h*.45,0,w*.93,h*.83,d*.90);
      box(g,straw,0,h*.84,0,w*.72,.09,d*.68);
      for(const x of [-w*.4,w*.4])
        box(g,iron,x,h*.47,d*.45,.10,h*.75,.07);
      break;
    }
    case "quench":case "water_tub":case "basin":{
      box(g,darkWood,0,h*.32,0,w*.90,h*.62,d*.90);
      box(g,pewter,0,h*.65,0,w*.91,.10,d*.91);
      box(g,iron,0,h*.70,0,w*.66,.03,d*.66);
      break;
    }
    case "tool_rack":case "tack":case "weapon_rack":case "helmet_stand":{
      frame(g,w,d,h);box(g,wood,0,h*.69,0,w*.90,.12,d*.82);
      for(const x of [-w*.31,0,w*.31]){
        const metal=style==="tack"?leather:iron;
        box(g,metal,x,h*.42,0,.12,h*.45,.15);
        if(style==="helmet_stand")cylinder(g,metal,x,h*.80,0,.20,.14,8);
        if(style==="weapon_rack")box(g,metal,x,h*.85,0,.11,.42,.10);
      }
      break;
    }
    case "ingots":case "crate_stack":case "woodpile":case "firewood":{
      for(const y of [.22,.55,.87]){
        for(const x of [-w*.24,w*.24]){
          const m=style==="ingots"?iron:style==="woodpile"||style==="firewood"?wood:darkWood;
          box(g,m,x,y,0,w*.42,.25,d*.72);
        }
      }
      break;
    }
    case "workbench":case "prep_table":case "mess_table":case "treatment":case "scale":{
      bench(g,w,d,h);
      if(style==="scale"){
        box(g,iron,0,h*.96,0,.12,.22,d*.77);
        for(const z of [-d*.29,d*.29])cylinder(g,pewter,0,h*.86,z,.22,.06);
      }else if(style==="prep_table"){
        box(g,wood,-w*.15,h*.93,0,w*.30,.08,d*.41);
        box(g,iron,w*.28,h*.95,0,w*.15,.06,d*.38);
      }else if(style==="workbench"){
        box(g,iron,-w*.24,h*.96,0,w*.21,.11,d*.34);
        box(g,wood,w*.22,h*.99,0,w*.24,.14,d*.22);
      }else if(style==="mess_table"){
        cylinder(g,pewter,-w*.20,h*.94,0,.20,.05);
        cylinder(g,pewter,w*.21,h*.94,0,.18,.05);
      }else if(style==="treatment"){
        box(g,linen,0,h*.94,0,w*.81,.11,d*.80);
      }
      break;
    }
    case "hay":case "sacks":case "bandages":case "bread":{
      for(const [i,x] of [-.28,.01,.29].entries()){
        box(g,style==="hay"?straw:style==="bread"?sack:linen,
          x*w,.26+(i===1?.18:0),0,w*.28,.49,d*.73);
      }
      if(style==="bandages")box(g,linen,0,h*.84,0,w*.82,.13,d*.75);
      break;
    }
    case "stall_fence":case "screen":{
      for(const x of [-w*.36,0,w*.36]){
        box(g,style==="screen"?wood:darkWood,x,h*.52,0,.13,h*.96,.13);
      }
      for(const y of [h*.30,h*.67]){
        box(g,style==="screen"?linen:wood,0,y,0,w*.90,style==="screen"?.48:.16,d*.22);
      }
      break;
    }
    case "saddle":{
      frame(g,w,d,h);
      box(g,leather,0,h*.73,0,w*.83,.28,d*.78);
      box(g,iron,0,h*.85,0,w*.23,.09,d*.19);
      break;
    }
    case "bunk":bed(g,w,d,true);break;
    case "cot":bed(g,w,d,false);break;
    case "locker":case "medicine":case "pantry":case "shelf":{
      for(const x of [-w*.44,w*.44])box(g,darkWood,x,h*.50,0,.14,h,d);
      for(const y of [h*.10,h*.43,h*.73,h*.97]){
        box(g,wood,0,y,0,w*.94,.11,d*.94);
      }
      if(style==="medicine"||style==="pantry"){
        for(const x of [-w*.25,w*.24])for(const y of [h*.55,h*.83])
          cylinder(g,style==="medicine"?herb:linen,x,y,0,.12,.22,7);
      }
      break;
    }
    case "bench":{
      bench(g,w,d,h);
      break;
    }
    case "chest":{
      box(g,darkWood,0,h*.36,0,w,h*.68,d);
      box(g,wood,0,h*.77,0,w*.97,.16,d*.98);
      for(const x of [-w*.39,w*.39])box(g,iron,x,h*.38,d*.5,.10,h*.52,.07);
      break;
    }
    case "barrel_stack":case "pots":{
      for(const x of [-w*.26,w*.26])
        cask(g,x,0,Math.min(d*.31,w*.23),h*.60);
      if(style==="barrel_stack")cask(g,0,-d*.02,Math.min(d*.24,w*.22),h*.88);
      break;
    }
    case "basket":{
      cylinder(g,wood,0,h*.42,0,r,h*.77,9);
      for(const x of [-w*.21,w*.21])
        box(g,straw,x,h*.83,0,w*.29,.12,d*.54);
      break;
    }
    case "cauldron":{
      box(g,stone,0,.30,0,w*.80,.56,d*.78);
      cylinder(g,iron,0,h*.59,0,r,h*.41,10);
      cylinder(g,pewter,0,h*.82,0,r*.8,.06,10);
      break;
    }
    case "herbs":{
      for(const x of [-w*.3,0,w*.3]){
        cylinder(g,ceramic,x,.42,0,.17,.60,8);
        box(g,herb,x,1.06,0,.23,1.10,.27);
      }
      break;
    }
    default:{
      // Complete, recognizable fallback for any future recipe style.
      bench(g,w,d,h);
    }
  }
}
/**
 * Wall ornaments and service-specific tool clusters sit against existing
 * collision walls; no freestanding invisible blockers or labels.
 */
function roomIdentity(g:THREE.Group,p:CastleProp):void {
  const q=((p.turns??0)%4+4)%4;
  const w=q%2?p.d??10:p.w??10,d=q%2?p.w??10:p.d??10,h=p.h??5;
  const use=p.castleUse??"barracks";
  const emblem=use==="smithy"?iron:use==="stables"?straw:use==="granary"?sack:
    use==="kitchens"?pewter:use==="infirmary"?linen:red;
  // Ceiling joists + hanging service emblems add detail without collision.
  for(const z of [-d*.24,d*.18]){
    box(g,darkWood,0,h-.28,z,w-.78,.18,.20);
  }
  for(const sx of [-1,1]){
    box(g,emblem,sx*(w/2-.48),h*.70,-d*.24,.10,.73,d*.26);
    if(use==="barracks"||use==="stables"){
      for(const z of [-d*.30,d*.10])
        box(g,iron,sx*(w/2-.37),h*.52,z,.10,.42,.13);
    }else if(use==="infirmary"){
      box(g,linen,sx*(w/2-.4),h*.68,0,.09,.65,d*.18);
    }else if(use==="smithy"){
      for(const z of [-d*.28,d*.13,d*.05])
        box(g,iron,sx*(w/2-.39),h*.54,z,.10,.60,.11);
    }else if(use==="granary"){
      box(g,wood,sx*(w/2-.39),h*.54,0,.10,.78,d*.24);
    }else if(use==="kitchens"){
      for(const z of [-d*.25,d*.05,d*.2])
        cylinder(g,pewter,sx*(w/2-.39),h*.63,z,.17,.11);
    }
  }
  const hanging=new THREE.Mesh(new THREE.IcosahedronGeometry(.14,0),
    new THREE.MeshBasicMaterial({color:0xffbb67}));
  hanging.position.set(0,h-.50,-d*.04);g.add(hanging);
  // Emissive ornaments alone don't illuminate sheltered rooms. A small,
  // shadowless lantern keeps beds, tools and alcoves visible under the roof.
  const lantern=new THREE.PointLight(use==="infirmary"?0xffe0b4:0xffac64,
    use==="smithy"||use==="kitchens"?1.15:.78,Math.max(9,d*1.10),2);
  lantern.position.set(0,h-.62,-d*.04);
  g.add(lantern);
  // No signboards or building names; architecture identifies the building.
}
export function buildCastleInterior(g:THREE.Group,p:CastleProp):void{
  roomIdentity(g,p);
  for(const [index,fixture] of castleFixtures(p).entries()){
    const group=new THREE.Group();
    group.position.set(fixture.x,0,fixture.z);
    // One authored fixture collider corresponds to all of its visual pieces.
    if(castleBallisticMaterial(p,7+index))
      group.userData.ballisticId=castleBallisticId(p,7+index);
    visibleFixture(group,fixture);
    g.add(group);
  }
}
