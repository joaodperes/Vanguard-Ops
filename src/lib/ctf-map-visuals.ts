import * as THREE from "three";
import type {FlagTeam} from "./ctf-rules";
import type {Vec3} from "./game-protocol";

/** Default for CTF maps without a bespoke scenery marker. Matches the shared
 * 4.7-unit delivery radius, stays depth-tested and never adds solid collision. */
export function ctfDeliveryMarker(team:FlagTeam,base:Vec3):THREE.Mesh {
  const marker=new THREE.Mesh(new THREE.RingGeometry(3,4.25,40),
    new THREE.MeshBasicMaterial({color:team==="red"?0xff5959:0x55c8ff,
      side:THREE.DoubleSide,transparent:true,opacity:.85,depthTest:true,depthWrite:false}));
  marker.rotation.x=-Math.PI/2;
  marker.position.set(base[0],base[1]+.07,base[2]);
  return marker;
}
