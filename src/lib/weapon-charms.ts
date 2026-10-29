import * as THREE from "three";
import { cosmeticById } from "./cosmetics";
import { WEAPON_VISUALS } from "./weapon-models";

/** Shared bounds keep charms visible on the receiver without obscuring sights. */
export function weaponCharmMountPoint(weaponId:string,view:"firstPerson"|"thirdPerson"):[number,number,number]{
  const width=WEAPON_VISUALS[weaponId]?.receiver[0]??.13;
  const edge=Math.max(.115,width/2+.045);
  return [view==="firstPerson"?-edge:edge,.065,-.22];
}

/** Model dimensions relative to the previous release: first person 1.22,
 * third person 1.00. The mount itself does not move with this reduction. */
export const CHARM_SCALE={firstPerson:.82,thirdPerson:.76} as const;

/** Individual procedural pendants, each with its own geometry. Purely visual;
 * never added to collision detection, weapons stats or bullet calculations. */
export function createWeaponCharm(id:string,firstPerson=false):THREE.Group|null{
  const cosmetic=cosmeticById(id,"charm");
  if(!cosmetic||id==="none")return null;

  const root=new THREE.Group();root.name="weapon_charm";
  root.scale.setScalar(firstPerson?CHARM_SCALE.firstPerson:CHARM_SCALE.thirdPerson);
  root.userData.cosmeticId=id;
  const basic=(color:THREE.ColorRepresentation)=>new THREE.MeshBasicMaterial({color});
  const silver=firstPerson?basic(0xb9c8d5):
    new THREE.MeshStandardMaterial({color:0xb9c8d5,metalness:.5,roughness:.38});
  const main=firstPerson?basic(cosmetic.color):
    new THREE.MeshStandardMaterial({color:cosmetic.color,metalness:.4,roughness:.34,
      emissive:new THREE.Color(cosmetic.color),emissiveIntensity:.16});
  const dark=basic(0x161820);
  const bright=basic(0xf5eac9);

  const add=(parent:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,
    x:number,y:number,z:number,name?:string)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);
    if(name)mesh.name=name;
    parent.add(mesh);
    return mesh;
  };

  add(root,new THREE.TorusGeometry(.028,.008,7,12),silver,0,-.020,0,"attachment_ring");
  add(root,new THREE.CylinderGeometry(.005,.005,.065,6),silver,0,-.064,0,"hanging_link");
  const pendant=new THREE.Group();
  pendant.name="weapon_charm_pendant";
  pendant.position.y=-.105;
  root.add(pendant);

  if(id==="charm_tag"){
    add(pendant,new THREE.BoxGeometry(.072,.098,.018),main,0,-.042,0,"tag");
    add(pendant,new THREE.BoxGeometry(.052,.008,.020),silver,0,-.064,.005,"tag_stripe");
  }else if(id==="charm_skull"){
    add(pendant,new THREE.DodecahedronGeometry(.052,0),main,0,-.042,0,"skull");
    add(pendant,new THREE.BoxGeometry(.058,.027,.038),main,0,-.079,.016,"jaw");
    for(const x of [-.020,.020])
      add(pendant,new THREE.SphereGeometry(.011,8,7),dark,x,-.034,.049,"eye_socket");
    const nose=add(pendant,new THREE.ConeGeometry(.007,.015,3),dark,0,-.055,.052,"nose");
    nose.rotation.z=Math.PI;
    for(const x of [-.020,-.007,.007,.020])
      add(pendant,new THREE.BoxGeometry(.009,.013,.004),silver,x,-.088,.037,"tooth");
  }else if(id==="charm_orb"){
    add(pendant,new THREE.IcosahedronGeometry(.049,1),main,0,-.042,0,"nebula_orb");
    const cage=add(pendant,new THREE.TorusGeometry(.060,.004,5,20),silver,0,-.042,0,"orb_cage");
    cage.rotation.y=.4;
  }else if(id==="charm_reactor"){
    const core=add(pendant,new THREE.CylinderGeometry(.047,.047,.031,6),main,0,-.042,0,"reactor_case");
    core.rotation.x=Math.PI/2;
    add(pendant,new THREE.SphereGeometry(.021,10,8),basic(0x9ff6ff),0,-.042,.029,"reactor_light");
  }else if(id==="charm_casing"){
    add(pendant,new THREE.CylinderGeometry(.022,.028,.091,10),main,0,-.044,0,"brass_casing");
    add(pendant,new THREE.CylinderGeometry(.031,.031,.013,10),silver,0,-.092,0,"casing_rim");
    add(pendant,new THREE.ConeGeometry(.023,.050,10),basic(0xe79b57),0,.023,0,"copper_tip");
    add(pendant,new THREE.CylinderGeometry(.010,.010,.003,8),dark,0,-.100,0,"primer");
  }else if(id==="charm_dice"){
    add(pendant,new THREE.BoxGeometry(.077,.077,.077),main,0,-.046,0,"lucky_die");
    // Six readable pips on the outward face.
    for(const x of [-.023,.023])for(const y of [-.069,-.046,-.023])
      add(pendant,new THREE.SphereGeometry(.0065,7,6),dark,x,y,.040,"pip");
    add(pendant,new THREE.BoxGeometry(.077,.006,.077),silver,0,-.006,0,"die_rim");
  }else if(id==="charm_compass"){
    const body=add(pendant,new THREE.CylinderGeometry(.052,.052,.022,20),main,0,-.046,0,"compass_case");
    body.rotation.x=Math.PI/2;
    add(pendant,new THREE.TorusGeometry(.048,.006,7,24),silver,0,-.046,.017,"compass_bezel");
    const needle=add(pendant,new THREE.ConeGeometry(.013,.047,3),basic(0xf43f5e),0,-.027,.020,"compass_needle");
    needle.rotation.z=Math.PI;
    const south=add(pendant,new THREE.ConeGeometry(.013,.037,3),bright,0,-.065,.020,"compass_south");
    south.rotation.z=0;
    add(pendant,new THREE.SphereGeometry(.007,6,6),dark,0,-.047,.026,"compass_pin");
  }else if(id==="charm_drone"){
    add(pendant,new THREE.BoxGeometry(.062,.035,.038),main,0,-.044,0,"drone_body");
    add(pendant,new THREE.SphereGeometry(.014,8,7),dark,0,-.044,.025,"drone_camera");
    add(pendant,new THREE.BoxGeometry(.146,.012,.012),silver,0,-.038,0,"drone_arm");
    for(const x of [-.068,.068]){
      add(pendant,new THREE.CylinderGeometry(.013,.013,.010,8),silver,x,-.038,0,"rotor_hub");
      add(pendant,new THREE.TorusGeometry(.025,.004,5,16),main,x,-.038,0,"rotor_guard");
      add(pendant,new THREE.BoxGeometry(.045,.005,.008),bright,x,-.038,.006,"rotor_blades");
    }
    add(pendant,new THREE.BoxGeometry(.024,.013,.027),dark,0,-.069,0,"drone_battery");
  }else if(id==="charm_phoenix"){
    const outline=new THREE.Shape();
    outline.moveTo(-.015,.022);
    outline.bezierCurveTo(.055,.013,.061,-.041,.035,-.071);
    outline.bezierCurveTo(.016,-.092,-.002,-.105,-.040,-.124);
    outline.bezierCurveTo(-.018,-.069,-.064,-.019,-.015,.022);
    const feather=add(pendant,new THREE.ExtrudeGeometry(outline,{
      depth:.010,bevelEnabled:false,curveSegments:7}),main,0,.015,0,"phoenix_feather");
    feather.rotation.z=-.18;
    const quill=add(pendant,new THREE.CylinderGeometry(.003,.004,.147,7),bright,-.008,-.031,.014,"feather_quill");
    quill.rotation.z=-.29;
    for(let i=0;i<3;i++){
      const barb=add(pendant,new THREE.BoxGeometry(.041,.004,.005),silver,.010,-.026-i*.024,.018,"feather_barb");
      barb.rotation.z=.35+i*.18;
    }
  }else if(id==="charm_prism"){
    add(pendant,new THREE.OctahedronGeometry(.058,0),main,0,-.044,0,"void_crystal");
    const halo=add(pendant,new THREE.TorusGeometry(.065,.006,6,16),silver,0,-.044,0,"prism_halo");
    halo.rotation.x=.65;
    add(pendant,new THREE.OctahedronGeometry(.022,0),bright,0,-.044,.047,"prism_glint");
  }else if(id==="charm_solar"){
    add(pendant,new THREE.SphereGeometry(.033,12,8),main,0,-.045,0,"sun_disc");
    add(pendant,new THREE.TorusGeometry(.036,.006,6,16),silver,0,-.045,.010,"sun_ring");
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      const ray=add(pendant,new THREE.ConeGeometry(.010,.028,5),main,
        Math.sin(angle)*.061,-.045+Math.cos(angle)*.061,0,"sun_ray");
      ray.rotation.z=-angle;
    }
  }else if(id==="charm_satellite"){
    add(pendant,new THREE.BoxGeometry(.037,.052,.037),silver,0,-.044,0,"satellite_body");
    add(pendant,new THREE.BoxGeometry(.023,.026,.041),main,0,-.044,.004,"satellite_transmitter");
    for(const x of [-.069,.069]){
      add(pendant,new THREE.BoxGeometry(.079,.046,.008),main,x,-.045,0,"solar_panel");
      add(pendant,new THREE.BoxGeometry(.006,.046,.012),silver,x,-.045,.002,"panel_strut");
      for(const offset of [-.019,.019])
        add(pendant,new THREE.BoxGeometry(.004,.043,.010),dark,x+offset,-.045,.004,"solar_cell_divider");
    }
    add(pendant,new THREE.CylinderGeometry(.003,.003,.038,6),silver,0,.001,0,"satellite_antenna");
    add(pendant,new THREE.SphereGeometry(.009,6,6),main,0,.024,0,"antenna_tip");
  }else{
    return null;
  }
  root.traverse(obj=>{obj.frustumCulled=false;});
  return root;
}

/** Pendant-only pendulum sway; fixed mount stays anchored to the gun. */
export function swingWeaponCharm(charm:THREE.Object3D,now:number){
  const pendant=charm.getObjectByName("weapon_charm_pendant");
  if(pendant){pendant.rotation.z=Math.sin(now*.004)*.16;pendant.rotation.x=Math.cos(now*.003)*.09;}
}
