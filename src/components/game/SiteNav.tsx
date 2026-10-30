"use client";
import {useGame} from "@/lib/game-store";
import {Button} from "@/components/ui/button";
import {Crosshair,Sliders,ShoppingBag,Trophy,Play as PlayIcon} from "lucide-react";

/** One navigation bar shared by all menu pages, hidden only during live play. */
export function SiteNav(){
  const {screen,setScreen}=useGame();
  const items=[
    {id:"play" as const,label:"Play",icon:PlayIcon},
    {id:"armory" as const,label:"Armory",icon:Crosshair},
    {id:"shop" as const,label:"Shop",icon:ShoppingBag},
    {id:"profile" as const,label:"Profile",icon:Trophy},
    {id:"settings" as const,label:"Settings",icon:Sliders},
  ];
  return <header className="sticky top-0 z-[60] border-b border-white/10 bg-zinc-950/95 backdrop-blur">
    <nav aria-label="Main navigation" className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3">
      <button type="button" onClick={()=>setScreen("menu")} aria-label="Home" className="shrink-0 flex items-center gap-2 hover:opacity-85">
        <span className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center">
          <Crosshair className="w-5 h-5 text-white"/>
        </span>
        <span className="hidden sm:block text-left">
          <span className="block font-black tracking-[.16em] text-xs leading-none text-white">VANGUARD</span>
          <span className="block text-[10px] tracking-[.3em] text-amber-400 mt-0.5">OPS</span>
        </span>
      </button>
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1 overflow-x-auto min-w-0">
        {items.map(item=>{
          const Icon=item.icon;
          const selected=screen===item.id;
          return <Button key={item.id} variant={selected?"secondary":"ghost"} size="sm"
            aria-current={selected?"page":undefined} onClick={()=>setScreen(item.id)}
            className={`shrink-0 h-9 px-2 sm:px-3 ${selected?"bg-amber-500/20 text-amber-200":"text-white/70 hover:text-white hover:bg-white/10"}`}>
            <Icon className="w-4 h-4 sm:mr-1.5"/><span className="hidden sm:inline">{item.label}</span>
            <span className="sr-only sm:hidden">{item.label}</span>
          </Button>;
        })}
      </div>
    </nav>
  </header>;
}
