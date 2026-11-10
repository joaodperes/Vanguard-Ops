"use client";

import {useState} from "react";
import {useGame} from "@/lib/game-store";
import {type WeaponDef} from "@/lib/game-data";
import {wonderModulesFor,wonderModuleById,wonderModuleModifiers,wonderFinishesFor,wonderKillEffectsFor} from "@/lib/wonder-expansion";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {Check,Lock,TestTube2} from "lucide-react";

type WonderField="wonderModuleId"|"wonderSkinId"|"wonderKillEffectId";

export function WonderCustomizationDialog({weapon,open,onOpenChange,busy,onEquip}:{
  weapon:WeaponDef;open:boolean;onOpenChange:(open:boolean)=>void;busy:boolean;
  onEquip:(weaponId:string,field:WonderField,value:string)=>Promise<void>;
}){
  const {profile,setRangeWeaponId,setScreen}=useGame();
  const setup=profile?.prestige.wonderSetups[weapon.id];
  const purchases=profile?.prestige.wonderPurchases??[];
  const [previewModuleId,setPreviewModuleId]=useState<string|null>(null);
  const previewValid=previewModuleId!==null&&wonderModulesFor(weapon.id).some(m=>m.id===previewModuleId);
  const inspectedModule=wonderModuleById(previewValid?previewModuleId!:setup?.moduleId??"");
  const groups=[
    {id:"modules",label:"Modules",field:"wonderModuleId" as const,selected:setup?.moduleId??"",
      entries:wonderModulesFor(weapon.id).map(m=>({
        id:m.id,name:m.name,description:m.description,owned:purchases.includes("module_"+m.id)
      }))},
    {id:"finishes",label:"Finishes",field:"wonderSkinId" as const,selected:setup?.skinId??"",
      entries:wonderFinishesFor(weapon.id).map(f=>({
        id:f.id,name:f.name,description:f.description,owned:purchases.includes(f.id+"_"+weapon.id)
      }))},
    {id:"kill-effects",label:"Kill effects",field:"wonderKillEffectId" as const,selected:setup?.killEffectId??"",
      entries:wonderKillEffectsFor(weapon.id).map(f=>({
        id:f.id,name:f.name,description:f.description,owned:purchases.includes(f.id+"_"+weapon.id)
      }))},
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="bg-zinc-950 border-violet-500/25 !max-w-[1120px] sm:!max-w-[1120px] w-[min(96vw,1120px)] h-[min(91vh,900px)] max-h-[91vh] flex flex-col gap-3 overflow-hidden">
      <DialogHeader>
        <div className="flex items-center gap-3 pr-8">
          <div className="w-1 h-12 rounded-full bg-violet-500"/>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-xl text-white">{weapon.name}</DialogTitle>
            <DialogDescription className="text-white/50">WONDER WEAPON · SLOT 4 · COSMETICS &amp; MODULES</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <Tabs defaultValue="modules" className="flex flex-col flex-1 min-h-0">
        <TabsList className="bg-zinc-900/60 border border-white/10 w-full">
          {groups.map(group=><TabsTrigger key={group.id} value={group.id}
            className="flex-1 data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-200 text-white/60">
            {group.label}
          </TabsTrigger>)}
        </TabsList>
        <div className="grid grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_310px] gap-4 min-h-0 flex-1">
          <div className="overflow-y-auto min-h-0 pr-1 lg:pr-2">
            {groups.map(group=><TabsContent key={group.id} value={group.id} className="mt-4 space-y-3">
              <p className="text-xs text-white/55">Select one option at a time. Locked options appear in the rotating Wonder Token Shop.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[{id:"",name:"Default",description:"Use the standard Wonder configuration.",owned:true},...group.entries].map(entry=>{
                  const selected=group.selected===entry.id;
                  return <div key={entry.id} className={`p-4 rounded-xl border ${selected?"border-violet-400/60 bg-violet-500/10":"border-white/10 bg-black/30"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold text-sm">{entry.name}</span>
                      {selected&&<Check className="w-4 h-4 ml-auto text-emerald-300"/>}
                      {!entry.owned&&<Lock className="w-4 h-4 ml-auto text-white/40"/>}
                    </div>
                    <p className="text-xs text-white/50 min-h-10">{entry.description}</p>
                    <div className="flex gap-2 mt-3">
                      {group.id==="modules"&&<Button size="sm" variant="outline" className="border-violet-500/30 text-violet-200"
                        onClick={()=>setPreviewModuleId(entry.id)}>Details</Button>}
                      <Button size="sm" className="flex-1" disabled={busy||selected||!entry.owned}
                        onClick={()=>void onEquip(weapon.id,group.field,entry.id)}>
                        {selected?"Equipped":entry.owned?"Equip":"Locked · Wonder Shop"}
                      </Button>
                    </div>
                  </div>;
                })}
              </div>
              {group.id==="modules"&&<div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 mt-4" aria-live="polite">
                <div className="text-violet-200 font-semibold text-sm">Module effects · {inspectedModule?.name??"Standard configuration"}</div>
                <p className="text-white/60 text-xs mt-1">{inspectedModule?.description??weapon.description}</p>
                <div className="mt-3 text-xs text-white/60">Base stats: {weapon.stats.damage} damage · {weapon.stats.range}m range · {weapon.wonder?.maxCharges??0} charges</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {wonderModuleModifiers(inspectedModule,weapon.id).map(mod=><span key={mod.label}
                    className="rounded-md border border-violet-500/25 bg-black/30 px-2.5 py-1.5 text-xs text-violet-200">{mod.label}: {mod.value}</span>)}
                  {!inspectedModule&&<span className="text-white/45 text-xs">No additional modifiers.</span>}
                </div>
              </div>}
            </TabsContent>)}
          </div>
          <aside className="rounded-xl border border-white/10 bg-black/40 p-4 overflow-y-auto">
            <h3 className="text-violet-200 font-semibold mb-2">Wonder configuration</h3>
            <p className="text-xs text-white/55 mb-4">{weapon.description}</p>
            {groups.map(group=><div key={group.id} className="flex flex-col gap-1 border-t border-white/10 py-3 text-xs">
              <span className="text-white/45 uppercase tracking-wider">{group.label}</span>
              <span className="text-white font-semibold">{group.entries.find(e=>e.id===group.selected)?.name??"Default"}</span>
            </div>)}
            <p className="text-xs text-white/45 my-3">The firing range lets you preview effects without saving changes or spending tokens.</p>
            <Button className="w-full bg-violet-500 hover:bg-violet-400 text-white" onClick={()=>{
              setRangeWeaponId(weapon.id);onOpenChange(false);setScreen("range");
            }}>
              <TestTube2 className="w-4 h-4 mr-1.5"/> Test in firing range
            </Button>
          </aside>
        </div>
      </Tabs>
    </DialogContent>
  </Dialog>;
}
