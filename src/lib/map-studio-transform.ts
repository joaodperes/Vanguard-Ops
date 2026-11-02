/** Shared transform invariants for Map Studio's axis-aligned collision grammar.
 * Rotation is saved as a quarter-turn, whereas W/D are world-space extents. */
export type StudioAxis="x"|"y"|"z";
export type QuarterTurn=0|1|2|3;
export const normalizeTurns=(turns:number):QuarterTurn=>(((Math.round(turns)%4)+4)%4) as QuarterTurn;
export function lockedPosition(
  start:{x:number;y:number;z:number},
  next:{x:number;y:number;z:number},
  axis:StudioAxis,
):{x:number;y:number;z:number}{
  return {
    x:axis==="x"?next.x:start.x,
    y:axis==="y"?next.y:start.y,
    z:axis==="z"?next.z:start.z,
  };
}
export function rotatedExtents(
  initial:{w:number;h:number;d:number;turns?:number},
  newTurns:number,
  scale:{x:number;y:number;z:number},
):{w:number;h:number;d:number;turns:QuarterTurn}{
  const oldTurn=normalizeTurns(initial.turns??0),turns=normalizeTurns(newTurns);
  // Scale axes are local to the rotated gizmo. Express them in world X/Z
  // before accounting for any additional quarter-turn rotation.
  const xFactor=Math.abs(oldTurn%2?scale.z:scale.x);
  const zFactor=Math.abs(oldTurn%2?scale.x:scale.z);
  const x=initial.w*xFactor,z=initial.d*zFactor;
  const swapped=normalizeTurns(turns-oldTurn)%2===1;
  return {w:swapped?z:x,h:initial.h*Math.abs(scale.y),d:swapped?x:z,turns};
}
