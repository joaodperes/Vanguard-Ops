/** Pairs of corrugation ribs on BOTH long container faces.
 * Local positions are relative to the container centre, before world placement.
 * Shared with the renderer and regressions so neither long side can be omitted. */
export interface ContainerStripe {x:number;y:number;z:number;w:number;h:number;d:number}
export function containerSideStripes(w:number,d:number,h:number):ContainerStripe[]{
  if(!Number.isFinite(w)||!Number.isFinite(d)||!Number.isFinite(h)||w<=0||d<=0||h<=0)return [];
  const longAlongX=w>=d,length=longAlongX?w:d,shortHalf=(longAlongX?d:w)/2;
  const stripes:ContainerStripe[]=[];
  for(let distance=-length/2+.75;distance<length/2-.3;distance+=1.25){
    for(const side of [-1,1]){
      stripes.push(longAlongX
        ?{x:distance,y:h/2,z:side*(shortHalf+.045),w:.10,h:h*.75,d:.08}
        :{x:side*(shortHalf+.045),y:h/2,z:distance,w:.08,h:h*.75,d:.10});
    }
  }
  return stripes;
}
