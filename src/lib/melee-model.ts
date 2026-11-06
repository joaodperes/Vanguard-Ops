/** All first- and third-person melee builds use this shared physical silhouette.
 * Axes use a rounded beveled cutting blade instead of a hammer-like box.
 */
import * as THREE from "three";
export function buildMeleeWeaponParts(
  id:string,metal:THREE.Material,grip:THREE.Material,
  place:(part:THREE.Mesh,x:number,y:number,z:number)=>void,
):number{
  const box=(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number)=>{
    place(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat),x,y,z);
  };
  if(id==="orbital_reaper"){
    // Curved plasma reaper: its crescent is a luminous cutting arc, never a
    // cross-shaped guard. Shared first/third-person profile.
    const energy=new THREE.MeshStandardMaterial({
      color:0xb98bff,emissive:0x8c36ff,emissiveIntensity:2.25,
      metalness:.25,roughness:.16,side:THREE.DoubleSide,
    });
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.026,.032,.96,10),grip);
    handle.rotation.x=Math.PI/2;place(handle,0,-.045,-.25);
    box(.09,.08,.08,metal,0,-.045,-.68);
    const crescent=new THREE.Shape();
    crescent.moveTo(.03,-.075);
    crescent.quadraticCurveTo(-.1,-.20,-.30,-.27);
    crescent.quadraticCurveTo(-.47,0,-.30,.27);
    crescent.quadraticCurveTo(-.12,.14,.03,.075);
    crescent.quadraticCurveTo(-.18,0,.03,-.075);
    const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(crescent,{
      depth:.05,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,
    }),energy);
    place(blade,0,-.03,-.79);
    const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.09,1),energy);
    place(core,0,-.045,-.79);
    return -.86;
  }
  if(id==="hammer"||id==="axe"){
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.024,.029,.7,10),grip);
    shaft.rotation.x=Math.PI/2;place(shaft,0,-.045,-.17);
    if(id==="hammer"){
      box(.28,.155,.19,metal,0,-.045,-.48);
      box(.045,.16,.195,grip,.15,-.045,-.48);
    }else{
      // Side-profile blade in the XY plane: the broad crescent is unmistakable
      // even when the player pitches the axe upright. Previously the head was
      // turned edge-on (rotated onto XZ) and resembled a hammer attachment.
      const outline=new THREE.Shape();
      outline.moveTo(.105,-.066);
      outline.lineTo(-.065,-.080);
      outline.quadraticCurveTo(-.16,-.13,-.32,-.23);
      outline.quadraticCurveTo(-.385,0,-.32,.23);
      outline.quadraticCurveTo(-.16,.13,-.065,.080);
      outline.lineTo(.105,.066);
      outline.closePath();
      const head=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{
        depth:.09,bevelEnabled:true,bevelSize:.010,
        bevelThickness:.012,bevelSegments:2,steps:1,
      }),metal);
      place(head,0,-.03,-.54);
      // Poll and socket connect the silhouette to the real shaft.
      box(.10,.085,.135,grip,.107,-.045,-.49);
      box(.055,.105,.13,metal,-.062,-.045,-.49);
      // Thin, continuous exposed crescent edge, running top to bottom.
      const edge=new THREE.Mesh(new THREE.BoxGeometry(.016,.43,.065),metal);
      place(edge,-.337,-.03,-.495);
    }
    return -.55;
  }
  if(id==="baton"){
    // Two compact knives with narrow blades and tapered points, not a baton.
    for(const x of [-.055,.055]){
      box(.035,.03,.18,grip,x,-.05,.07);
      box(.045,.018,.05,metal,x,-.05,-.044);
      const blade=new THREE.Mesh(new THREE.ConeGeometry(.04,.3,4),metal);
      blade.rotation.x=-Math.PI/2;place(blade,x,-.05,-.22);
    }
    return -.37;
  }
  const isShiv=id==="shiv",isMachete=id==="machete";
  box(isShiv?.035:.04,isShiv?.035:.04,isShiv?.08:.10,grip,0,-.05,.08);
  box(isShiv?.02:isMachete?.03:.025,isShiv?.035:isMachete?.06:.05,
    isShiv?.22:isMachete?.45:.32,metal,0,-.05,isShiv?-.13:isMachete?-.22:-.18);
  return isShiv?-.25:isMachete?-.45:-.35;
}
