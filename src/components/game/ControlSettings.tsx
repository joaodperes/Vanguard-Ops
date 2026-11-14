"use client";
import {useEffect,useState} from 'react';
import {useSettings} from '@/lib/settings-store';
import {CONTROL_LABELS,DEFAULT_KEYS,bindKey,keyLabel} from '@/lib/control-settings';
export function ControlSettings(){
 const {settings:s,update}=useSettings();const [capture,setCapture]=useState<string|null>(null);
 useEffect(()=>{if(!capture)return;const listener=(e:KeyboardEvent)=>{e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(e.code==='Escape'){setCapture(null);return;}const next=bindKey(s.keyBindings,capture,e.code);if(next!==s.keyBindings){update({keyBindings:next});setCapture(null);}};window.addEventListener('keydown',listener,true);return()=>window.removeEventListener('keydown',listener,true);},[capture,s.keyBindings,update]);
 const range=(key:'adsSensitivity'|'controllerSensitivity'|'controllerDeadzone'|'touchScale'|'touchOpacity'|'touchInset',label:string,min:number,max:number,step:number)=><label className="block text-white/80 text-sm space-y-2">{label} <span className="text-amber-200">{s[key].toFixed(2)}</span><input aria-label={label} className="w-full accent-amber-400" type="range" min={min} max={max} step={step} value={s[key]} onChange={e=>update({[key]:Number(e.target.value)})}/></label>;
 return <section data-binding-capture={capture?'true':'false'} className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 space-y-5"><h3 className="text-white font-bold">Controls & accessibility</h3>
 {range('adsSensitivity','ADS sensitivity',.1,2.5,.05)}
 {(['reducedMotion','controllerEnabled','touchLeftHanded'] as const).map((key,i)=><label key={key} className="flex gap-3 text-white text-sm"><input type="checkbox" checked={s[key]} onChange={e=>update({[key]:e.target.checked})}/>{['Reduced motion','Enable standard gamepads','Left-handed touch layout'][i]}</label>)}
 <p className="text-xs text-white/60">Reduced motion removes weapon bob, sprint sway and HUD animation. Weapon recoil and combat timing remain consistent.</p>
 <h4 className="text-white font-semibold">Keyboard</h4><p className="text-xs text-white/60">Select an action and press a key. Conflicts swap assignments; Escape cancels. Mouse buttons fire and aim. Escape always opens the menu.</p>
 <div className="grid sm:grid-cols-2 gap-2">{Object.keys(DEFAULT_KEYS).map(key=><button type="button" key={key} aria-label={`Rebind ${CONTROL_LABELS[key]}`} aria-pressed={capture===key} onClick={()=>setCapture(capture===key?null:key)} className="flex justify-between gap-3 rounded-lg border border-white/20 p-3 text-white text-sm"><span>{CONTROL_LABELS[key]}</span><kbd className="text-amber-200">{capture===key?'Press key…':keyLabel(s.keyBindings[key])}</kbd></button>)}</div>
 <button type="button" className="text-amber-200 text-sm underline" onClick={()=>{setCapture(null);update({keyBindings:{...DEFAULT_KEYS}});}}>Reset keyboard bindings</button>
 <h4 className="text-white font-semibold">Controller</h4><p className="text-xs text-white/60 leading-relaxed">Press Start/Menu to play or pause. Sticks move/look, L3 sprints, RT fires, LT aims (right Akimbo gun / Juggernaut secondary). A jumps, X reloads, Y swaps, B interacts, R3 melees, RB uses tactical, LB equips Wonder. D-pad up/down/left selects primary/secondary/melee; View holds scoreboard. In-game menus use mouse, keyboard or touch. Browser standard mapping is required; separate Joy-Cons may need combining through your OS.</p>
 {range('controllerSensitivity','Controller look sensitivity',.25,3,.05)}{range('controllerDeadzone','Stick deadzone',.05,.4,.01)}
 <h4 className="text-white font-semibold">Touch layout</h4>{range('touchScale','Touch button size',.7,1.3,.05)}{range('touchOpacity','Touch opacity',.3,1,.05)}{range('touchInset','Touch edge spacing',8,80,4)}
 </section>;
}
