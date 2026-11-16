/** Shared, deterministic first-person Bastion .45 cylinder geometry and reload timing.
 * All distances are in unscaled weapon-local units (+Z points towards the
 * player's eye, -Z along the barrel). The engine applies vmScale and the
 * same rigid weapon quaternion used for the body and hand. */
export const BASTION_CYLINDER_CENTER = [0, -.034, -.17] as const;
export const BASTION_CHAMBER_RADIUS = .052; // make the six-chamber outline visibly wider than the frame
export const BASTION_CYLINDER_HALF_LENGTH = .071;
export const BASTION_CYLINDER_OPEN_X = -.17;
export const BASTION_CARTRIDGE_SEATED_Z = .014;
export const BASTION_CARTRIDGE_TRAVEL_Z = .14;
/** Both sights and frame geometry share these rest-space mounting dimensions.
 * The rear notch sits ON the topstrap, not 9 cm behind the grip in empty air. */
export const BASTION_TOPSTRAP = {x:0,y:.052,z:-.158,width:.066,height:.026,length:.36} as const;
export const BASTION_REAR_SIGHT = {x:0,y:.082,z:-.035} as const;
export const BASTION_FRONT_SIGHT_Y = .080;

const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
const smooth=(a:number,b:number,p:number)=>{
  const t=clamp01((p-a)/(b-a));
  return t*t*(3-2*t);
};

/** Opening, insertion and withdrawal always use the same normalized clock. */
export function bastionReloadFrame(progress:number) {
  const p=clamp01(progress);
  const open=smooth(.12,.30,p)*(1-smooth(.76,.93,p));
  const insertion=smooth(.48,.69,p);
  // Loader approaches the open breech, seats rounds, then withdraws before close.
  const loaderZ=.22-.132*smooth(.43,.66,p)+.138*smooth(.70,.79,p);
  return {
    open, insertion, loaderZ,
    loaderVisible:p>=.41&&p<.79,
    cartridgesVisible:p>=.44,
  };
}

/** Loader's collar sits behind the cylinder (rear face is +Z), in the
 * exact same moving coordinate system as its six cartridge meshes. */
export function bastionLoaderContact(progress:number,viewmodelScale=1):[number,number,number] {
  const frame=bastionReloadFrame(progress);
  return [
    (BASTION_CYLINDER_CENTER[0]+BASTION_CYLINDER_OPEN_X*frame.open)*viewmodelScale,
    BASTION_CYLINDER_CENTER[1]*viewmodelScale,
    (BASTION_CYLINDER_CENTER[2]+frame.loaderZ)*viewmodelScale,
  ];
}
