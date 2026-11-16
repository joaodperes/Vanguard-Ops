/** Shared client/server grammar for Emberhold's working medieval bailey. */
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
export type CastleFixtureStyle=
  "forge"|"anvil"|"coal"|"bellows"|"quench"|"tool_rack"|"ingots"|"workbench"|"woodpile"|
  "hay"|"stall_fence"|"trough"|"water_tub"|"tack"|"saddle"|"feed_bin"|
  "bunk"|"locker"|"chest"|"weapon_rack"|"mess_table"|"bench"|"helmet_stand"|
  "grain_bin"|"sacks"|"shelf"|"barrel_stack"|"crate_stack"|"scale"|"basket"|
  "oven"|"cauldron"|"prep_table"|"pantry"|"bread"|"pots"|"firewood"|
  "cot"|"screen"|"bandages"|"herbs"|"cabinet"|"basin"|"treatment"|"medicine";
export interface CastleFixture {x:number;z:number;w:number;d:number;h:number;style:CastleFixtureStyle}
/** Stable per-part identity used identically by the client, bots and server. */
export function castleBallisticId(p:CastleProp,index:number):string {
  return `castle:${p.kind}:${p.x}:${p.y??0}:${p.z}:${p.turns??0}:${index}`;
}
/** Only non-structural timber can be destroyed; stone masonry and load-bearing
 * posts stay protective. A dressed slate/thatch roof has timber decking beneath.
 * Infirmary uses a stone roof and remains solid. */
const WOODEN_FIXTURES=new Set<CastleFixtureStyle>([
  "bellows","tool_rack","woodpile","stall_fence","trough","water_tub","tack",
  "feed_bin","bunk","locker","chest","weapon_rack","mess_table","bench",
  "helmet_stand","grain_bin","shelf","barrel_stack","crate_stack","basket",
  "prep_table","pantry","firewood","cot","screen","cabinet","treatment",
  "medicine","workbench","quench","saddle","scale",
]);
export function castleBallisticMaterial(p:CastleProp,index:number):
  "thin_wood"|"light_cover"|undefined {
  if(p.kind==="castle_building"){
    if(index===6)return p.castleUse==="infirmary"?undefined:"thin_wood";
    if(index>=7){
      const fixture=castleFixtures(p)[index-7];
      return fixture&&WOODEN_FIXTURES.has(fixture.style)?"thin_wood":undefined;
    }
  }
  if(p.kind==="castle_stall")return index===4?"thin_wood":index===5?"light_cover":undefined;
  if(p.kind==="castle_cart"||p.kind==="castle_target"||p.kind==="castle_barrel")
    return index===0?"thin_wood":undefined;
  return undefined;
}

/**
 * Actual room plans, not a repeated three-block template. All coordinates
 * are building-local; leave the central aisle and the 3.6m entrance clear.
 * Side-hugging furnishings keep even the 9x7 kitchens navigable.
 */
const SERVICE_LAYOUTS:Record<CastleService,readonly [CastleFixtureStyle,number,number,number,number,number][]>={
  smithy:[
    ["forge",-.33,-.34,.23,.18,2.4],["coal",-.33,-.10,.17,.14,1.0],
    ["workbench",-.33,.15,.22,.18,1.3],["woodpile",-.33,.35,.18,.13,.9],
    ["anvil",.33,-.32,.20,.16,1.35],["bellows",.33,-.10,.18,.15,1.25],
    ["quench",.33,.13,.18,.16,1.0],["tool_rack",.33,.35,.19,.13,2.2],
  ],
  stables:[
    ["stall_fence",-.33,-.34,.18,.15,1.9],["hay",-.33,-.10,.22,.16,1.35],
    ["trough",-.33,.13,.22,.16,1.1],["tack",-.33,.35,.18,.13,2.2],
    ["stall_fence",.33,-.34,.18,.15,1.9],["water_tub",.33,-.10,.20,.16,1.0],
    ["feed_bin",.33,.13,.21,.16,1.35],["saddle",.33,.35,.18,.13,1.5],
  ],
  barracks:[
    ["bunk",-.33,-.34,.22,.18,2.25],["chest",-.33,-.10,.18,.14,1.15],
    ["bunk",-.33,.13,.22,.17,2.25],["helmet_stand",-.33,.35,.17,.12,1.95],
    ["bunk",.33,-.34,.22,.18,2.25],["locker",.33,-.10,.18,.15,2.2],
    ["mess_table",.33,.13,.22,.17,1.25],["weapon_rack",.33,.35,.18,.13,2.25],
  ],
  granary:[
    ["grain_bin",-.33,-.34,.22,.17,1.6],["sacks",-.33,-.10,.22,.17,1.25],
    ["shelf",-.33,.13,.21,.17,2.3],["basket",-.33,.35,.19,.13,1.0],
    ["barrel_stack",.33,-.34,.21,.17,2.15],["crate_stack",.33,-.10,.21,.16,1.8],
    ["grain_bin",.33,.13,.22,.17,1.6],["scale",.33,.35,.18,.14,1.55],
  ],
  kitchens:[
    ["oven",-.33,-.34,.23,.17,2.3],["firewood",-.33,-.10,.19,.15,1.0],
    ["prep_table",-.33,.13,.22,.18,1.2],["bread",-.33,.35,.20,.13,1.3],
    ["cauldron",.33,-.34,.20,.16,1.6],["pots",.33,-.10,.18,.15,1.45],
    ["pantry",.33,.13,.21,.17,2.2],["water_tub",.33,.35,.18,.13,1.0],
  ],
  infirmary:[
    ["cot",-.33,-.34,.22,.17,1.3],["bandages",-.33,-.10,.18,.15,1.5],
    ["cot",-.33,.13,.22,.17,1.3],["medicine",-.33,.35,.18,.13,1.6],
    ["screen",.33,-.34,.18,.16,2.25],["treatment",.33,-.10,.22,.17,1.25],
    ["herbs",.33,.13,.20,.15,2.0],["basin",.33,.35,.19,.13,1.0],
  ],
};
export function castleFixtures(p:CastleProp):CastleFixture[]{
  const q=((p.turns??0)%4+4)%4,w=q%2?p.d??10:p.w??10,d=q%2?p.w??10:p.d??10;
  return SERVICE_LAYOUTS[p.castleUse??"barracks"].map(([style,x,z,fw,fd,h])=>
    ({style,x:x*w,z:z*d,w:fw*w,d:fd*d,h}));
}
/** Castle props are world-elevated: y is a ground surface (typically 5). */
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
    // One durable collider envelops the pitched timber-decked roof (the old
    // 0.28m flat slab missed shots aimed at its visible raised slopes).
    box(0,h+.74,0,w/2,.74,d/2);
    for(const f of castleFixtures(p))box(f.x,f.h/2,f.z,f.w/2,f.h/2,f.d/2);
  }else if(p.kind==="castle_well"){
    const r=Math.min(w,d)*.44,t=.36;
    for(const s of [-1,1]){box(0,.625,s*r,r,.625,t);box(s*r,.625,0,t,.625,r-t);}
  }else if(p.kind==="castle_stall"){
    for(const sx of [-1,1])for(const sz of [-1,1])
      box(sx*(w/2-.22),h/2,sz*(d/2-.22),.22,h/2,.22);
    box(0,.65,-d*.24,w*.42,.65,d*.13);
    // Cover the visible awning, not merely the empty space underneath it.
    box(0,h+.28,0,w/2,.22,d/2);
  }else if(p.kind==="castle_cart"){box(0,.70,0,w*.44,.70,d*.39);
  }else if(p.kind==="castle_target"){box(0,h*.52,0,w*.42,h*.48,.18);
  }else if(p.kind==="castle_barrel"){box(0,h/2,0,w*.44,h/2,d*.44);
  }else if(p.kind==="castle_brazier"){box(0,.65,0,w*.40,.65,d*.40);}
  // These exact IDs are the integrity keys replicated by the multiplayer server.
  // Never use visual color or geometry shape to infer penetrability.
  a.forEach((cover,index)=>{
    const material=castleBallisticMaterial(p,index);
    // Hard masonry and structural posts are explicitly reinforced, not
    // silently treated as concrete just because they lack a material tag.
    cover.material=material??"reinforced";
    if(material)cover.ballisticId=castleBallisticId(p,index);
  });
  return a;
}
/** Models render these fixtures, never a duplicate solid stone proxy.
 * All eight collision boxes remain in the authoritative map for bullets,
 * physics and bots. Seven earlier boxes describe the building envelope. */
export function castleFixtureBoxes(p:CastleProp):CoverBox[]{
  return p.kind==="castle_building"?castleSceneryBoxes(p).slice(7):[];
}
