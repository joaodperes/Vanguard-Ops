/** Map Studio's vertical conventions, shared by authored and legacy geometry.
 * Authored cover/stairs/props store the bottom elevation; engine boxes and
 * hazards store their center. Preserve H when positioning either face. */
export type ElevationAnchor="bottom"|"center"|"point";
export type ElevationFace="bottom"|"top";
export type ElevationSpan={bottom:number;top:number;center:number;height:number};
export function elevationSpan(y:number,height:number,anchor:ElevationAnchor):ElevationSpan{
  const h=anchor==="point"?0:height;
  const bottom=anchor==="center"?y-h/2:y;
  return {bottom,top:bottom+h,center:bottom+h/2,height:h};
}
export function yAtElevationFace(
  target:number,height:number,anchor:ElevationAnchor,face:ElevationFace,
):number{
  if(anchor==="point")return target;
  const bottom=face==="top"?target-height:target;
  return anchor==="center"?bottom+height/2:bottom;
}
/** Translation snapping in 3D only affects the horizontal axes. Vertical
 * positioning remains freely adjustable even when the X/Z grid is enabled. */
export function horizontalSnap(value:number,step:number):number {
  return step>0?Math.round(value/step)*step:value;
}
