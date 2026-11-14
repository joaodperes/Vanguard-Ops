import type {Vec3,GameMode} from "./game-protocol";
export type SquadCommand="attack"|"defend"|"regroup";
export interface SquadOrder {kind:SquadCommand;pos:Vec3;team:string;issuer:string;expiresAt:number}
export interface SquadMember {id:string;team:string;pos:Vec3;alive:boolean;health:number;ai?:{archetype?:string}}
export function validSquadOrder(kind:unknown,pos:unknown,source:Vec3,team:string,issuer:string,now:number):SquadOrder|null{
 if(!["attack","defend","regroup"].includes(kind as string)||!Array.isArray(pos)||pos.length!==3||!pos.every(v=>typeof v==="number"&&Number.isFinite(v))||Math.hypot(pos[0]-source[0],pos[1]-source[1],pos[2]-source[2])>60||!["red","blue"].includes(team))return null;
 return {kind:kind as SquadCommand,pos:[...pos] as Vec3,team,issuer,expiresAt:now+15000};
}
/** Team-only observations/orders; never supplies unseen enemy coordinates or permission to shoot. */
export function squadIntent(args:{self:SquadMember;allies:SquadMember[];mode:GameMode;now:number;target?:Vec3;order?:SquadOrder;critical?:boolean}):{goal:Vec3;role:string}|null{
 const {self,mode,now}=args;
 if(mode==="ffa"||mode==="gungame"||mode==="survival"||args.critical)return null;
 const allies=args.allies.filter(a=>a.alive&&a.team===self.team&&a.id!==self.id);
 if(!allies.length)return null;
 const order=args.order&&args.allies.some(p=>p.id===args.order!.issuer&&p.alive)&&args.order.team===self.team&&args.order.expiresAt>now?args.order:undefined;
 const roster=[...allies,self].sort((a,b)=>a.id.localeCompare(b.id));const slot=roster.findIndex(a=>a.id===self.id);
 const nearest=allies.reduce((a,b)=>Math.hypot(a.pos[0]-self.pos[0],a.pos[2]-self.pos[2])<Math.hypot(b.pos[0]-self.pos[0],b.pos[2]-self.pos[2])?a:b);
 if(self.health<30)return {goal:[...nearest.pos],role:"falling back"};
 const wounded=allies.find(a=>a.health<30);
 if(wounded&&args.target&&(self.ai?.archetype==="support"||self.ai?.archetype==="marksman")){const dx=args.target[0]-wounded.pos[0],dz=args.target[2]-wounded.pos[2],len=Math.hypot(dx,dz)||1;return {goal:[wounded.pos[0]+dx/len*5,wounded.pos[1],wounded.pos[2]+dz/len*5],role:"covering retreat"};}
 if(order){const angle=slot*2.4,radius=order.kind==="attack"?2:4;return {goal:[order.pos[0]+Math.sin(angle)*radius,order.pos[1],order.pos[2]+Math.cos(angle)*radius],role:order.kind};}
 if(!args.target)return null;
 const target=args.target,dx=target[0]-self.pos[0],dz=target[2]-self.pos[2],len=Math.hypot(dx,dz)||1;
 if(slot%3===0)return null; // Anchors retain their existing firing posture.
 const side=slot%2?1:-1;
 const staging=now%8000<1800;
 return {goal:[target[0]-dx/len*(staging?14:7)+dz/len*6*side,target[1],target[2]-dz/len*(staging?14:7)-dx/len*6*side],role:staging?"staging":"flanking"};
}

export function squadOrderPoint(pos:Vec3,yaw:number,kind:SquadCommand,spawns:Vec3[]):Vec3 {
 if(kind!=="attack")return [...pos];
 const desired:Vec3=[pos[0]+Math.sin(yaw)*20,pos[1],pos[2]+Math.cos(yaw)*20];
 const nearby=spawns.filter(p=>Math.abs(p[1]-pos[1])<2.5&&Math.hypot(p[0]-pos[0],p[2]-pos[2])<55);
 return nearby.length?[...nearby.reduce((a,b)=>Math.hypot(a[0]-desired[0],a[2]-desired[2])<Math.hypot(b[0]-desired[0],b[2]-desired[2])?a:b)]:desired;
}
