/** Industrial machine dressing shared by Map Studio and the FPS renderer.
 *
 * These meshes wrap existing authored factory COVER/PLATFORM boxes. Their
 * silhouettes intentionally do not create a second set of physics colliders:
 * the corresponding blueprint features are the authoritative gameplay solids.
 */
import * as THREE from "three";

export const FACTORY_MACHINE_KINDS=[
  "furnace","conveyor","hydraulic_press","generator","storage_rack",
  "vent_stack","industrial_pipe","steel_coil","cargo_pallet",
] as const;
export type FactoryMachineKind=typeof FACTORY_MACHINE_KINDS[number];
export function isFactoryMachineKind(kind:string):kind is FactoryMachineKind{
  return (FACTORY_MACHINE_KINDS as readonly string[]).includes(kind);
}

export function buildFactoryMachinery(
  group:THREE.Group,kind:FactoryMachineKind,w:number,d:number,h:number,
  paintColor?:string,
):void{
  if(w<=0||d<=0||h<=0)return;
  const steel=new THREE.MeshStandardMaterial({color:0x46545c,roughness:.6,metalness:.72});
  const paint=paintColor?new THREE.MeshStandardMaterial({color:paintColor,roughness:.62,metalness:.32}):steel;
  const iron=new THREE.MeshStandardMaterial({color:0x29363d,roughness:.8,metalness:.52});
  const silver=new THREE.MeshStandardMaterial({color:0x8d9ea5,roughness:.36,metalness:.86});
  const rust=new THREE.MeshStandardMaterial({color:0x9b6550,roughness:.87,metalness:.24});
  const hazard=new THREE.MeshStandardMaterial({color:0xeab54e,roughness:.6,metalness:.35});
  const black=new THREE.MeshStandardMaterial({color:0x131d23,roughness:.9});
  const ember=new THREE.MeshStandardMaterial({
    color:0xff8d36,emissive:0xff450c,emissiveIntensity:2.4,roughness:.35,
  });
  const teal=new THREE.MeshStandardMaterial({
    color:0x72e0e2,emissive:0x16a0a0,emissiveIntensity:1.4,roughness:.38,
  });
  const box=(mat:THREE.Material,x:number,y:number,z:number,bw:number,bh:number,bd:number)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.03,bw),Math.max(.03,bh),Math.max(.03,bd)),mat);
    mesh.position.set(x,y,z);mesh.castShadow=bh>.8;mesh.receiveShadow=true;
    group.add(mesh);return mesh;
  };
  const cylinder=(mat:THREE.Material,x:number,y:number,z:number,r:number,height:number,
    rotationZ=0,rotationX=0)=>{
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,Math.max(.04,height),12),mat);
    mesh.position.set(x,y,z);mesh.rotation.z=rotationZ;mesh.rotation.x=rotationX;
    mesh.castShadow=height>.7;group.add(mesh);return mesh;
  };
  const front=d/2+.11;
  if(kind==="furnace"){
    // Brick-insulated tall shell with a radiant open tapping portal.
    for(const side of [-1,1]){
      box(rust,side*(w/2+.13),h*.5,0,.34,h*.92,d+.12);
      box(silver,side*(w*.34),h*.73,front+.02,.20,h*.34,.20);
      for(let level=0;level<3;level++)
        box(steel,side*(w*.36),h*(.21+level*.20),front+.12,w*.12,.14,.25);
    }
    box(iron,0,h*.34,front+.09,w*.58,h*.55,.27);
    box(ember,0,h*.33,front+.25,w*.42,h*.38,.09);
    box(hazard,0,h*.63,front+.28,w*.55,.22,.22);
    box(black,0,h*.17,front+.33,w*.49,.17,.21);
    for(let i=-2;i<=2;i++)
      box(iron,i*w*.084,h*.32,front+.31,.07,h*.32,.14);
    box(steel,0,h+.13,0,w*.78,.26,d*.70);
    cylinder(iron,0,h+.85,-d*.12,Math.min(w,d)*.19,1.6);
    cylinder(silver,0,h+1.7,-d*.12,Math.min(w,d)*.22,.18);
    const light=new THREE.PointLight(0xff6521,2.1,Math.max(12,w*1.1));
    light.position.set(0,h*.39,front+1.2);group.add(light);
  }else if(kind==="conveyor"){
    // Dark rubber running belt, tension rollers and amber safety rails.
    box(iron,0,h+.07,0,w*.97,.22,d*.86);
    box(black,0,h+.22,0,w*.88,.11,d*.66);
    for(const side of [-1,1]){
      box(hazard,0,h+.35,side*d*.45,w*.99,.25,.18);
      for(let i=0;i<Math.max(3,Math.round(w/2.4));i++){
        const x=-w*.46+(i+.5)*w*.92/Math.max(3,Math.round(w/2.4));
        box(silver,x,h+.28,side*d*.30,.12,.14,.40);
      }
    }
    for(const side of [-1,1])
      cylinder(silver,side*w*.455,h+.24,0,d*.27,.35,0,Math.PI/2);
    for(let i=0;i<Math.max(2,Math.floor(w/3));i++){
      const x=-w*.38+i*(w*.76/Math.max(1,Math.floor(w/3)-1));
      box(steel,x,h*.49,front,w*.075,h*.72,.12);
    }
    box(hazard,0,h*.80,front+.08,w*.90,.14,.10);
  }else if(kind==="hydraulic_press"){
    // Repeating piston heads make long generic cover strips read as a press line.
    const count=Math.max(2,Math.floor(d/8));
    for(let i=0;i<count;i++){
      const z=-d/2+(i+.5)*d/count;
      for(const side of [-1,1])
        box(steel,side*(w/2+.13),h*.52,z,.34,h*.95,d/count*.78);
      box(iron,0,h*.91,z,w+.4,.46,d/count*.79);
      cylinder(silver,0,h*.70,z,Math.min(w*.15,.8),h*.33);
      box(hazard,0,h*.49,z,w*.68,.22,d/count*.68);
      box(rust,0,h*.30,z,w*.75,.35,d/count*.65);
      for(const side of [-1,1])
        box(silver,side*w*.31,h*.69,z,.14,h*.47,.14);
    }
  }else if(kind==="generator"){
    // Alternator skid with louvres, top manifolds and circular cooling fan.
    box(paint,0,h*.31,front+.1,w*.94,h*.53,.25);
    for(let i=0;i<7;i++){
      const x=-w*.40+i*w*.8/6;
      box(black,x,h*.33,front+.24,.16,h*.36,.10);
    }
    box(hazard,0,h*.69,front+.14,w*.75,.17,.24);
    // Authored factory colors cover large machine faces, not just one trim pixel.
    for(const side of [-1,1])box(paint,side*(w*.43),h*.50,0,.24,h*.83,d*.90);
    box(paint,0,h+.055,0,w*.84,.11,d*.81);
    for(const side of [-1,1]){
      cylinder(iron,side*w*.27,h+.26,0,Math.min(d*.24,1),.32);
      box(silver,side*w*.38,h*.56,-d/2-.1,.18,h*.50,.21);
    }
    box(teal,0,h*.78,front+.20,w*.18,.24,.12);
  }else if(kind==="storage_rack"){
    // Steel frame over solid inventory feature, populated with colour-coded bins.
    for(const x of [-w/2+.17,w/2-.17])for(const z of [-d/2+.2,d/2-.2])
      box(silver,x,h*.52,z,.24,h*.94,.24);
    for(let level=1;level<=3;level++){
      const y=h*level/3;
      box(steel,0,y,0,w*.95,.19,d*.94);
      for(let row=0;row<3;row++){
        const x=-w*.30+row*w*.30;
        box(row%2?rust:hazard,x,y+.30,front-.35,w*.20,.48,d*.21);
      }
    }
    box(black,0,h*.80,front+.23,w*.85,.08,.15);
  }else if(kind==="vent_stack"){
    // Ribbed exhaust duct, pipe chimneys and a cross-braced metal facade.
    for(const side of [-1,1]){
      cylinder(steel,side*w*.26,h+.55,0,Math.min(w,d)*.15,1.5);
      cylinder(silver,side*w*.26,h+1.30,0,Math.min(w,d)*.19,.14);
      box(silver,side*w*.44,h*.5,front,.16,h*.9,.15);
    }
    for(let i=0;i<7;i++)
      box(iron,0,h*(.1+i*.12),front+.10,w*.85,.16,.16);
    box(hazard,0,h*.85,front+.22,w*.92,.19,.17);
  }else if(kind==="industrial_pipe"){
    // Suspended duct section. Place high (prop.y) as visual-only ceiling dressing.
    const alongX=w>=d;
    const radius=Math.max(.2,Math.min(w,d)*.36);
    const barrel=cylinder(steel,0,h*.54,0,radius,(alongX?w:d)*.96,
      alongX?Math.PI/2:0,alongX?0:Math.PI/2);
    barrel.castShadow=false;
    for(const sign of [-1,1]){
      const offset=(alongX?w:d)*.42;
      cylinder(hazard,alongX?sign*offset:0,h*.54,alongX?0:sign*offset,
        radius*1.13,.24,alongX?Math.PI/2:0,alongX?0:Math.PI/2);
    }
    for(const axis of [-.34,.34])
      box(iron,alongX?w*axis:0,h*.95,alongX?0:d*axis,.18,h*.8,.18);
  }else if(kind==="steel_coil"){
    // Steel rolls strapped onto the original crate geometry.
    const count=Math.max(1,Math.round(w/2.6)),r=Math.min(d*.30,h*.32);
    for(let i=0;i<count;i++){
      const x=-w*.38+(i+.5)*w*.76/count;
      cylinder(silver,x,h+.28,0,r,Math.min(w/count*.76,2.2),Math.PI/2);
      cylinder(black,x-w/count*.38,h+.28,0,r*.31,.12,Math.PI/2);
      cylinder(black,x+w/count*.38,h+.28,0,r*.31,.12,Math.PI/2);
    }
    for(const z of [-d*.33,d*.33])
      box(hazard,0,h+.52,z,w*.9,.07,.16);
  }else if(kind==="cargo_pallet"){
    // Wood-and-steel loading palette with staged ingots and banding.
    for(const z of [-d*.36,0,d*.36])
      box(rust,0,h+.14,z,w*.86,.16,d*.19);
    const rows=2;
    for(let row=0;row<rows;row++)for(let i=0;i<3;i++){
      const x=-w*.31+i*w*.31;
      box(i===1?silver:steel,x,h+.35+row*.34,0,w*.24,.30,d*.75);
    }
    for(const x of [-w*.35,w*.35])
      box(hazard,x,h+.59,0,.12,.74,d*.8);
  }
}
