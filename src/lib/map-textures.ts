/** Build-time allowlist; map JSON stores IDs, never arbitrary resource URLs. */
export const MAP_TEXTURES=[1,4,6,8,10,13].map(n=>({id:"kenney_"+String(n).padStart(2,"0"),
  name:"Kenney panel "+String(n).padStart(2,"0"),path:"/textures/kenney/texture_"+String(n).padStart(2,"0")+".png",
  author:"Kenney",license:"CC0-1.0",source:"https://kenney.nl/assets/prototype-textures"}));
export function mapTexture(id:unknown){return MAP_TEXTURES.find(t=>t.id===id);}
