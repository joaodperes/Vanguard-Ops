export const DEFAULT_KEYS: Record<string,string> = Object.fromEntries(['KeyW','KeyS','KeyA','KeyD','ShiftLeft','Space','KeyR','KeyE','KeyX','KeyG','KeyF','Digit1','Digit2','Digit3','Digit4','KeyQ','Tab','KeyZ','KeyC','KeyV'].map(k=>[k,k]));
export const CONTROL_LABELS: Record<string,string> = Object.fromEntries(Object.keys(DEFAULT_KEYS).map((k,i)=>[k,['Forward','Back','Left','Right','Sprint','Jump','Reload','Interact','Exit Juggernaut','Tactical','Quick melee','Primary','Secondary','Melee slot','Wonder','Quick swap','Scoreboard','Attack order','Defend order','Regroup order'][i]]));
export const keyLabel=(key:string)=>key.replace(/^Key|^Digit/,'').replace('Left',' L').replace('Right',' R');
export function bindKey(keys:Record<string,string>,action:string,code:string){
 if(!DEFAULT_KEYS[action]||!/^(Key[A-Z]|Digit[0-9]|Space|Tab|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Arrow(Up|Down|Left|Right))$/.test(code))return keys;
 const next={...keys};const other=Object.keys(next).find(k=>k!==action&&next[k]===code);if(other)next[other]=next[action];next[action]=code;return next;
}
export function canonicalKey(keys:Record<string,string>,code:string){return Object.keys(keys).find(k=>keys[k]===code)??(code==='ShiftRight'&&keys.ShiftLeft==='ShiftLeft'?'ShiftLeft':undefined);}
export interface ControlSettings {keyBindings:Record<string,string>;adsSensitivity:number;controllerSensitivity:number;controllerDeadzone:number;controllerEnabled:boolean;reducedMotion:boolean;touchLeftHanded:boolean;touchScale:number;touchOpacity:number;touchInset:number}
export const DEFAULT_CONTROLS:ControlSettings={keyBindings:DEFAULT_KEYS,adsSensitivity:1,controllerSensitivity:1,controllerDeadzone:.18,controllerEnabled:true,reducedMotion:false,touchLeftHanded:false,touchScale:1,touchOpacity:.9,touchInset:24};
export function normalizeControls(raw:Partial<ControlSettings>):ControlSettings{
 let keys={...DEFAULT_KEYS};if(raw.keyBindings&&typeof raw.keyBindings==='object')for(const key of Object.keys(keys))keys=bindKey(keys,key,raw.keyBindings[key]);
 const number=(k:keyof ControlSettings,min:number,max:number)=>typeof raw[k]==='number'&&Number.isFinite(raw[k])?Math.max(min,Math.min(max,raw[k] as number)):DEFAULT_CONTROLS[k] as number;
 return {keyBindings:keys,adsSensitivity:number('adsSensitivity',.1,2.5),controllerSensitivity:number('controllerSensitivity',.25,3),controllerDeadzone:number('controllerDeadzone',.05,.4),controllerEnabled:typeof raw.controllerEnabled==='boolean'?raw.controllerEnabled:true,reducedMotion:raw.reducedMotion===true,touchLeftHanded:raw.touchLeftHanded===true,touchScale:number('touchScale',.7,1.3),touchOpacity:number('touchOpacity',.3,1),touchInset:number('touchInset',8,80)};
}
export function stick(x:number,y:number,deadzone:number):[number,number]{const length=Math.hypot(x,y);if(!Number.isFinite(length)||length<=deadzone)return[0,0];const factor=Math.min(1,(length-deadzone)/(1-deadzone))/length;return[x*factor,y*factor];}
