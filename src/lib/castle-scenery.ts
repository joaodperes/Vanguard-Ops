/** Shared client/server geometry for the working medieval bailey. */
import type {CoverBox,Vec3} from "./game-protocol";

export const CASTLE_SERVICES=["smithy","stables","barracks","granary","kitchens","infirmary"] as const;
export type CastleService=(typeof CASTLE_SERVICES)[number];
export const CASTLE_PROP_KINDS=["castle_building","castle_well","castle_stall","castle_cart","castle_target","castle_barrel","castle_brazier"] as const;
export type CastlePropKind=(typeof CASTLE_PROP_KINDS)[number];
export function isCastlePropKind(k:string):k is CastlePropKind{return (CASTLE_PROP_KINDS as readonly string[]).includes(k);}
export interface CastleProp {
  kind:string;x:number;z:number;y?:number;w?:number;d?:number;h?:number;
  turns?:0|1|2|3;castleUse?:CastleService;text?:string;color?:string;
}
export interface CastleFixture {x:number;z:number;w:number;d:number;h:number;style:string}
/** Deterministic furniture recipes shared by collision and three.js decoration. */
export function castleFixtures(p:CastleProp):CastleFixture[]{
  const q=p.turns??0,w=q%2?p.d??10:p.w??10,d=q%2?p.w??10:p.d??10;
  const use=p.castleUse??"barracks";
  const styles:Record<CastleService,[string,string,string]>={
    smithy:["forge","anvil","rack"],stables:["trough","hay","stall"],
    barracks:["bunk","bunk","rack"],granary:["sacks","shelf","sacks"],
    kitchens:["oven","table","shelf"],infirmary:["cot","cot","table"],
  };
  const [a,b,c]=styles[use],x=w*.30,fw=Math.min(2,w*.22),fd=Math.min(2.5,d*.29);
  return [
    {x:-x,z:-d*.25,w:fw,d:fd,h:a==="forge"||a==="oven"?2.1:1.45,style:a},
    {x:x,z:-d*.25,w:fw,d:fd,h:1.35,style:b},
    {x:-x,z:d*.23,w:fw,d:Math.min(1.65,d*.20),h:1.35,style:c},
  ];
}
/** Castle map props are world-elevated: y is the ground level, not box centre. */
export function castleSceneryBoxes(p:CastleProp):CoverBox[]{
  if(!isCastlePropKind(p.kind))return [];
  const q=((p.turns??0)%4+4)%4,odd=!!(q%2),w=odd?p.d??10:p.w??10,d=odd?p.w??10:p.d??10;
  const h=p.h??4.5,base=p.y??0,a:CoverBox[]=[];
  const cos=[1,0,-1,0][q],sin=[0,1,0,-1][q];
  const box=(x:number,y:number,z:number,wx:number,hy:number,dz:number)=>{
    if(wx<=0||hy<=0||dz<=0)return;
    a.push({kind:"cover",pos:[p.x+cos*x+sin*z,base+y,p.z-sin*x+cos*z] as Vec3,
      size:[odd?dz:wx,hy,odd?wx:dz] as Vec3});
  };
  if(p.kind==="castle_building"){
    const door=Math.min(3.6,w*.39),side=(w-door)/4,t=.38;
    box(0,h/2,-d/2,w/2,h/2,t);
    for(const s of [-1,1]){
      box(s*w/2,h/2,0,t,h/2,d/2);
      box(s*(w+door)/4,h/2,d/2,side,h/2,t);
    }
    box(0,(h+2.75)/2,d/2,door/2,(h-2.75)/2,t);
    box(0,h+.14,0,w/2,.14,d/2); // closed roof, no accidental drop-through
    for(const f of castleFixtures(p))box(f.x,f.h/2,f.z,f.w/2,f.h/2,f.d/2);
  }else if(p.kind==="castle_well"){
    const r=Math.min(w,d)*.44,t=.36;
    for(const s of [-1,1]){box(0,.625,s*r,r,.625,t);box(s*r,.625,0,t,.625,r-t);}
  }else if(p.kind==="castle_stall"){
    for(const sx of [-1,1])for(const sz of [-1,1])
      box(sx*(w/2-.22),h/2,sz*(d/2-.22),.22,h/2,.22);
    box(0,.65,-d*.24,w*.42,.65,d*.13);
    box(0,h+.10,0,w/2,.10,d/2);
  }else if(p.kind==="castle_cart"){box(0,.70,0,w*.44,.70,d*.39);
  }else if(p.kind==="castle_target"){box(0,h*.52,0,w*.42,h*.48,.18);
  }else if(p.kind==="castle_barrel"){box(0,h/2,0,w*.44,h/2,d*.44);
  }else if(p.kind==="castle_brazier"){box(0,.65,0,w*.40,.65,d*.40);}
  return a;
}
