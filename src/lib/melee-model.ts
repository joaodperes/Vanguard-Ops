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
      // Curved top and bottom flares and a rounded cutting face on the left.
      const outline=new THREE.Shape();
      outline.moveTo(-.10,-.075);
      outline.quadraticCurveTo(-.26,-.15,-.32,-.065);
      outline.quadraticCurveTo(-.37,0,-.32,.065);
      outline.quadraticCurveTo(-.26,.15,-.10,.075);
      outline.lineTo(.065,.075);outline.lineTo(.065,-.075);outline.closePath();
      const blade=new THREE.ExtrudeGeometry(outline,{depth:.075,bevelEnabled:true,bevelSize:.013,bevelThickness:.013,bevelSegments:3,steps:1});
      place(new THREE.Mesh(blade,metal),0,-.045,-.53);
      box(.035,.14,.085,grip,.085,-.045,-.49);
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
