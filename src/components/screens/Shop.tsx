"use client";
import {useMemo,useState} from "react";
import {useGame} from "@/lib/game-store";
import {SHOP_CATEGORIES,shopItemKey,shopItemsForCategory,type ShopCategory,type ShopCurrency} from "@/lib/shop-catalog";
import { cosmeticById } from "@/lib/cosmetics";
import {WEAPONS,WEAPON_SKINS,PLAYER_SKINS,levelForXp} from "@/lib/game-data";
import {ownsWeapon} from "@/lib/collection-ownership";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {ArrowLeft,Coins,Gem,ShoppingBag,Lock} from "lucide-react";
import {toast} from "sonner";

export function Shop(){
  const {profile,playerKey,setScreen,refreshProfile}=useGame();
  const [busy,setBusy]=useState(""),[weaponId,setWeaponId]=useState("");
  const [currency,setCurrency]=useState<ShopCurrency>("credits");
  const [category,setCategory]=useState<ShopCategory>("all");
  const owned=useMemo(()=>WEAPONS.filter(w=>!w.wonder&&!!profile&&ownsWeapon(w,profile.level,profile.unlocks.weapons)),[profile]);
  const choice=owned.some(w=>w.id===weaponId)?weaponId:(owned.find(w=>w.id===profile?.loadout.weapon.id)?.id??owned[0]?.id??"");
  async function buy(id:string){
    if(!profile||!playerKey||busy)return;
    setBusy(id);
    try{
      const res=await fetch("/api/shop",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({playerKey,itemId:id,weaponId:choice})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error??"Purchase failed");
      toast.success("Cosmetic unlocked permanently");
      await refreshProfile();
    }catch(e){toast.error(e instanceof Error?e.message:"Purchase failed");}
    finally{setBusy("");}
  }
  const section=(currency:ShopCurrency)=><div className="mt-5 space-y-6">
    {SHOP_CATEGORIES.filter(group=>group.id!=="all"&&(category==="all"||group.id===category)).map(group=>{
      const items=shopItemsForCategory(currency,group.id);
      if(!items.length)return null;
      return <section key={group.id} aria-label={group.label}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">{group.label}</h2>
          <span className="text-xs text-white/45">{items.length}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-3">
        {items.map(item=>{
      const finish=WEAPON_SKINS.find(s=>s.id===(item.skinId??"")),operator=PLAYER_SKINS.find(s=>s.id===(item.skinId??""));
      const skin=finish??operator,cosmetic=cosmeticById(item.cosmeticId??"");
      const isOwned=item.kind==="weaponSkin"?
        (profile?.unlocks.skinsByWeapon[choice]??[]).includes(item.skinId??""):
        item.kind==="playerSkin"?(profile?.unlocks.playerSkins??[]).includes(item.skinId??""):
        (profile?.ownedCosmetics??[]).includes(item.cosmeticId??"");
      const canPay=currency==="credits"?(profile?.credits??0)>=item.cost:(profile?.career.tokens??0)>=item.cost;
      const locked=currency==="career"&&!profile?.career.unlocked;
      return <article key={shopItemKey(item,choice)} className="border border-white/10 bg-zinc-900/70 rounded-2xl p-4">
        <div className="h-16 rounded-lg mb-3 border border-white/10 flex items-center justify-center"
          style={{background:`linear-gradient(125deg,#080c13,${skin?.color??cosmetic?.color??"#444"}55,#111827)`}}>
          {cosmetic&&<span className="text-3xl" style={{color:cosmetic.color,textShadow:`0 0 10px ${cosmetic.color}88`}}>{cosmetic.symbol}</span>}
        </div>
        <h3 className="font-semibold text-white">{item.name}</h3>
        <p className="text-sm text-white/55 mt-1 min-h-10">{item.description}</p>
        <p className="text-xs text-white/40 mt-2">{item.kind==="weaponSkin"?`Weapon finish · ${WEAPONS.find(w=>w.id===choice)?.name??"Select a weapon"}`:item.kind==="playerSkin"?"Operative skin":item.kind==="reticle"?"Hipfire reticle · existing colors and size remain free":item.kind==="charm"?"Account-owned charm · equip in Armory":"Account-wide player nameplate"}</p>
        <Button className="w-full mt-3" disabled={busy!==""||isOwned||!canPay||locked||item.kind==="weaponSkin"&&!choice}
          onClick={()=>void buy(item.id)}>
          {isOwned?"Owned":locked?<><Lock className="w-4 h-4 mr-1"/>Level 40 required</>:
            <>{currency==="credits"?<Coins className="w-4 h-4 mr-1"/>:<Gem className="w-4 h-4 mr-1"/>}
              {item.cost.toLocaleString()} {currency==="credits"?"CR":"Career Tokens"}</>}
        </Button>
      </article>;
        })}
        </div>
      </section>;
    })}
  </div>;
  return <div className="min-h-screen bg-[#0a0a0a] text-white">
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/75">
      <div className="max-w-6xl mx-auto flex items-center gap-3 px-5 py-4">
        <Button variant="ghost" onClick={()=>setScreen("menu")}><ArrowLeft className="w-4 h-4 mr-1"/>Back</Button>
        <ShoppingBag className="w-5 h-5 text-violet-300"/><h1 className="text-xl font-bold">Cosmetic Shop</h1>
      </div>
    </header>
    <main className="max-w-6xl mx-auto p-5">

      <div className="flex gap-4 text-sm mb-5"><span className="text-amber-300">{profile?.credits??0} CR</span><span className="text-violet-300">{profile?.career.tokens??0} Career Tokens</span></div>
      {(category==="all"||category==="weaponSkin")&&<>
        <label htmlFor="shop-weapon" className="text-xs text-white/70 block mb-1">Weapon finish for</label>
        <select id="shop-weapon" className="bg-zinc-900 border border-white/20 rounded-lg p-2 mb-5 w-full max-w-md"
          value={choice} onChange={e=>setWeaponId(e.target.value)}>
          {owned.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </>}
      <Tabs value={currency} onValueChange={v=>setCurrency(v as ShopCurrency)}>
        <TabsList className="bg-zinc-900 border border-white/10">
          <TabsTrigger value="credits">Credit Shop</TabsTrigger><TabsTrigger value="career">Career Token Shop</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-2 mt-5" role="group" aria-label="Shop categories">
          {SHOP_CATEGORIES.map(group=>{
            const count=shopItemsForCategory(currency,group.id).length;
            return <button type="button" key={group.id} aria-pressed={category===group.id}
              onClick={()=>setCategory(group.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${category===group.id
                ?"border-violet-400/60 bg-violet-500/15 text-violet-100"
                :"border-white/10 bg-zinc-900/60 text-white/60 hover:border-white/30 hover:text-white"}`}>
              {group.label} <span className="ml-1 opacity-60">{count}</span>
            </button>;
          })}
        </div>
        <TabsContent value="credits">{section("credits")}</TabsContent>
        <TabsContent value="career">{section("career")}</TabsContent>
      </Tabs>
      <p className="text-xs text-white/40 mt-6">Equip weapon cosmetics in Armory and nameplates in Profile. Purchases are permanent and cosmetic-only.</p>
    </main>
  </div>;
}
