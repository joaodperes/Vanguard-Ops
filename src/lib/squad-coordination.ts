import type {Vec3,GameMode} from "./game-protocol";
export interface SquadMember {id:string;team:string;pos:Vec3;alive:boolean;health:number;ai?:{archetype?:string}}
/** Team-only observations; never supplies unseen enemy coordinates or permission to shoot. */
export function squadIntent(args:{self:SquadMember;allies:SquadMember[];mode:GameMode;now:number;target?:Vec3;critical?:boolean}):{goal:Vec3;role:string}|null{
 const {self,mode,now}=args;
 if(mode==="ffa"||mode==="gungame"||mode==="survival"||args.critical)return null;
 const allies=args.allies.filter(a=>a.alive&&a.team===self.team&&a.id!==self.id);
 if(!allies.length)return null;
 const roster=[...allies,self].sort((a,b)=>a.id.localeCompare(b.id));const slot=roster.findIndex(a=>a.id===self.id);
 const nearest=allies.reduce((a,b)=>Math.hypot(a.pos[0]-self.pos[0],a.pos[2]-self.pos[2])<Math.hypot(b.pos[0]-self.pos[0],b.pos[2]-self.pos[2])?a:b);
 if(self.health<30)return {goal:[...nearest.pos],role:"falling back"};
 const wounded=allies.find(a=>a.health<30);
 if(wounded&&args.target&&(self.ai?.archetype==="support"||self.ai?.archetype==="marksman")){const dx=args.target[0]-wounded.pos[0],dz=args.target[2]-wounded.pos[2],len=Math.hypot(dx,dz)||1;return {goal:[wounded.pos[0]+dx/len*5,wounded.pos[1],wounded.pos[2]+dz/len*5],role:"covering retreat"};}
 if(!args.target)return null;
 const target=args.target,dx=target[0]-self.pos[0],dz=target[2]-self.pos[2],len=Math.hypot(dx,dz)||1;
 if(slot%3===0)return null; // Anchors retain their existing firing posture.
 const side=slot%2?1:-1;
 const staging=now%8000<1800;
 return {goal:[target[0]-dx/len*(staging?14:7)+dz/len*6*side,target[1],target[2]-dz/len*(staging?14:7)-dx/len*6*side],role:staging?"staging":"flanking"};
}
