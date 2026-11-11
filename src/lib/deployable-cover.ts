/** Server/offline shared, axis-aligned deployable tactical barricade.
 * The center slot is a real absence of colliders at standing eye level.
 * Snapping to cardinal directions keeps gameplay collision identical to visuals.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import { blastDistance } from "./explosion-damage-rules";
export const DEPLOY_COVER_HP = 160; // Bulwark: 250
export const DEPLOY_COVER_LIFETIME_MS = 40_000;
export const DEPLOY_COVER_HALF_WIDTH = 1.6;
export const DEPLOY_COVER_HALF_SLIT_WIDTH = .48;
export const DEPLOY_COVER_PREFIX = "tactical_cover:";
export interface DeployedCover {
  id: string; ownerId: string; ownerTeam: string;
  pos: Vec3; yaw: number; hp: number; expiresAt: number;
}
export function coverFacing(yaw:number):number {
  return Math.round(yaw/(Math.PI/2))*(Math.PI/2);
}
export function coverPanels(cover:DeployedCover):CoverBox[] {
  const alongX=Math.abs(Math.cos(cover.yaw))>.5;
  const center=cover.pos;
  const panel=(offset:number,up:number,halfWidth:number,halfHeight:number):CoverBox=>({
    pos:[center[0]+(alongX?offset:0),center[1]+up,center[2]+(alongX?0:offset)],
    size:alongX?[halfWidth,halfHeight,.14]:[.14,halfHeight,halfWidth],
    kind:"solid", environmentId:DEPLOY_COVER_PREFIX+cover.id,
  });
  // From the floor: armor 0-1.34; firing slit 1.34-1.72; top armor 1.72-1.96.
  const sideHalf=(DEPLOY_COVER_HALF_WIDTH-DEPLOY_COVER_HALF_SLIT_WIDTH)/2;
  return [
    panel(0,.67,DEPLOY_COVER_HALF_WIDTH,.67),
    panel(0,1.84,DEPLOY_COVER_HALF_WIDTH,.12),
    panel(-(DEPLOY_COVER_HALF_WIDTH+DEPLOY_COVER_HALF_SLIT_WIDTH)/2,1.53,sideHalf,.19),
    panel((DEPLOY_COVER_HALF_WIDTH+DEPLOY_COVER_HALF_SLIT_WIDTH)/2,1.53,sideHalf,.19),
  ];
}
export function coverPlacement(
  feet:Vec3,yaw:number,world:CoverBox[],mapSize:number,occupants:Vec3[]=[]
):{pos:Vec3;yaw:number}|null {
  const facing=coverFacing(yaw);
  const pos:Vec3=[feet[0]+Math.sin(facing)*2.9,feet[1],feet[2]+Math.cos(facing)*2.9];
  if(Math.abs(pos[0])>mapSize-2 || Math.abs(pos[2])>mapSize-2)return null;
  if(occupants.some(p=>Math.abs(p[1]-pos[1])<2.1 && Math.hypot(p[0]-pos[0],p[2]-pos[2])<2))return null;
  const candidate=coverPanels({id:"preview",ownerId:"",ownerTeam:"",pos,yaw:facing,hp:DEPLOY_COVER_HP,expiresAt:0});
  for(const a of candidate)for(const b of world){
    if(b.kind==="accent"||b.kind==="stair")continue;
    // A slightly raised platform under a barricade is not an obstruction.
    if(Math.abs(a.pos[0]-b.pos[0])<a.size[0]+b.size[0]+.08 &&
       Math.abs(a.pos[1]-b.pos[1])<a.size[1]+b.size[1]-.02 &&
       Math.abs(a.pos[2]-b.pos[2])<a.size[2]+b.size[2]+.08)return null;
  }
  return {pos,yaw:facing};
}
export function coverIdForBox(box:CoverBox):string|null {
  return box.environmentId?.startsWith(DEPLOY_COVER_PREFIX)
    ? box.environmentId.slice(DEPLOY_COVER_PREFIX.length) : null;
}
export function coverNextHp(hp:number,damage:number):number {
  return Math.max(0,hp-Math.max(0,damage));
}
/** Nearest surface on the shield (rather than its foot position). */
export function coverBlastContact(cover:DeployedCover,point:Vec3):Vec3 {
  let closest:Vec3=cover.pos,best=Infinity;
  for(const panel of coverPanels(cover)){
    const face:Vec3=[0,1,2].map(i=>Math.max(panel.pos[i]-panel.size[i],
      Math.min(point[i],panel.pos[i]+panel.size[i]))) as Vec3;
    const d=blastDistance(point,face);
    if(d<best){best=d;closest=face;}
  }
  return closest;
}
export function coverExplosionDamage(cover:DeployedCover,point:Vec3,radius:number,damage:number):number {
  if(!(radius>0))return 0;
  const d=blastDistance(point,coverBlastContact(cover,point));
  return d<radius?damage*Math.max(.15,1-d/radius):0;
}
