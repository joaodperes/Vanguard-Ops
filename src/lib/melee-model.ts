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
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.027,.026,.63,12),metal);
    shaft.rotation.x=Math.PI/2;place(shaft,0,-.05,-.16);
    box(.10,.04,.045,grip,0,-.05,.08);
    return -.47;
  }
  const isShiv=id==="shiv",isMachete=id==="machete";
  box(isShiv?.035:.04,isShiv?.035:.04,isShiv?.08:.10,grip,0,-.05,.08);
  box(isShiv?.02:isMachete?.03:.025,isShiv?.035:isMachete?.06:.05,
    isShiv?.22:isMachete?.45:.32,metal,0,-.05,isShiv?-.13:isMachete?-.22:-.18);
  return isShiv?-.25:isMachete?-.45:-.35;
}
