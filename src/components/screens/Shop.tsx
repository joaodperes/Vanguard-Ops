"use client";
import {useEffect,useMemo,useState} from "react";
import {useGame} from "@/lib/game-store";
import {SHOP_CATEGORIES,shopItemKey,shopItemsForCategory,type ShopCategory,type ShopCurrency} from "@/lib/shop-catalog";
import type {DailyShopRotation} from "@/lib/shop-rotation";
import {cosmeticById} from "@/lib/cosmetics";
import {WEAPONS,WEAPON_SKINS,PLAYER_SKINS} from "@/lib/game-data";
import {ownsWeapon} from "@/lib/collection-ownership";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {ArrowLeft,Coins,Gem,ShoppingBag,Lock,RefreshCw} from "lucide-react";
import {toast} from "sonner";

export function Shop(){
  const {profile,playerKey,setScreen,refreshProfile}=useGame();
  const [busy,setBusy]=useState(""),[weaponId,setWeaponId]=useState("");
  const [currency,setCurrency]=useState<ShopCurrency>("credits");
  const [category,setCategory]=useState<ShopCategory>("all");
  const [rotation,setRotation]=useState<DailyShopRotation|null>(null);
  const [rotationError,setRotationError]=useState(false);

  useEffect(()=>{
    let active=true;
    async function reload(){
      try{
        const res=await fetch("/api/shop/rotation",{cache:"no-store"});
        if(!res.ok)throw new Error("Rotation unavailable");
        const data=await res.json() as DailyShopRotation;
        if(!Array.isArray(data.itemIds)||!data.dayKey||!data.refreshAt)throw new Error("Invalid rotation");
        if(active){setRotation(data);setRotationError(false);}
      }catch{if(active)setRotationError(true);}
    }
    void reload();
    // Refresh at the day boundary (and when returning to the Shop tab);
    // all offer IDs still come from the authoritative server UTC day.
    const timer=setInterval(()=>void reload(),60000);
    function visible(){if(document.visibilityState==="visible")void reload();}
    document.addEventListener("visibilitychange",visible);
    return()=>{active=false;clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[]);

  const owned=useMemo(()=>WEAPONS.filter(w=>!w.wonder&&!!profile&&ownsWeapon(w,profile.level,profile.unlocks.weapons)),[profile]);
  const choice=owned.some(w=>w.id===weaponId)?weaponId:(owned.find(w=>w.id===profile?.loadout.weapon.id)?.id??owned[0]?.id??"");
  const visibleIds=useMemo(()=>new Set(rotation?.itemIds??[]),[rotation]);
  const offers=(c:ShopCurrency,g:ShopCategory)=>shopItemsForCategory(c,g).filter(i=>visibleIds.has(i.id));

  async function buy(id:string){
    if(!profile||!playerKey||busy||!visibleIds.has(id))return;
    setBusy(id);
    try{
      const res=await fetch("/api/shop",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({playerKey,itemId:id,weaponId:choice})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error??"Purchase failed");
      toast.success("Purchased");
      await refreshProfile();
    }catch(e){toast.error(e instanceof Error?e.message:"Purchase failed");}
    finally{setBusy("");}
  }

  const section=(c:ShopCurrency)=><div className="mt-5 space-y-6">
    {SHOP_CATEGORIES.filter(g=>g.id!=="all"&&(category==="all"||g.id===category)).map(group=>{
      const items=offers(c,group.id);
      if(!items.length)return null;
      return <section key={group.id} aria-label={group.label}>
        <h2 className="text-sm text-white font-semibold">{group.label} <span className="text-xs text-white/45 ml-1">{items.length}/3 today</span></h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-3">
          {items.map(item=>{
            const finish=WEAPON_SKINS.find(s=>s.id===item.skinId),operator=PLAYER_SKINS.find(s=>s.id===item.skinId);
            const skin=finish??operator,cosmetic=cosmeticById(item.cosmeticId??"");
            const isOwned=item.kind==="weaponSkin"
              ?(profile?.unlocks.skinsByWeapon[choice]??[]).includes(item.skinId??"")
              :item.kind==="playerSkin"?(profile?.unlocks.playerSkins??[]).includes(item.skinId??"")
              :(profile?.ownedCosmetics??[]).includes(item.cosmeticId??"");
            const canPay=c==="credits"?(profile?.credits??0)>=item.cost:(profile?.career.tokens??0)>=item.cost;
            const locked=c==="career"&&!profile?.career.unlocked;
            return <article key={shopItemKey(item,choice)} className="border border-white/10 bg-zinc-900/70 rounded-2xl p-4">
              <div className="h-16 rounded-lg mb-3 border border-white/10 flex items-center justify-center"
                style={{background:`linear-gradient(125deg,#080c13,${skin?.color??cosmetic?.color??"#444"}55,#111827)`}}>
                {cosmetic&&<span className="text-3xl" style={{color:cosmetic.color,textShadow:`0 0 10px ${cosmetic.color}88`}}>{cosmetic.symbol}</span>}
                {skin&&<span className="text-xs font-semibold px-3 py-1 rounded border border-white/20 bg-black/30" style={{color:skin.color==="black"?"#fff":skin.color}}>{item.kind==="weaponSkin"?"WEAPON FINISH":"OPERATIVE"}</span>}
              </div>
              <h3 className="font-semibold text-white">{item.name}</h3>
              <p className="text-sm text-white/55 mt-1 min-h-10">{item.description}</p>
              {item.kind==="weaponSkin"
                ?<p className="text-xs text-amber-200 mt-2">For {WEAPONS.find(w=>w.id===choice)?.name??"selected weapon"} only</p>
                :<p className="text-xs text-white/45 mt-2">{item.kind==="playerSkin"?"Account-wide operative":item.kind==="charm"?"Account-wide design; equip per loadout":item.kind==="reticle"?"Account-wide design; equip per loadout":"Account-wide nameplate"}</p>}
              <Button className="w-full mt-3" disabled={busy!==""||isOwned||!canPay||locked||(item.kind==="weaponSkin"&&!choice)}
                onClick={()=>void buy(item.id)}>
                {isOwned?"Owned":locked?<><Lock className="w-4 h-4 mr-1"/>Level 40 required</>:
                  <>{c==="credits"?<Coins className="w-4 h-4 mr-1"/>:<Gem className="w-4 h-4 mr-1"/>}
                    {item.cost.toLocaleString()} {c==="credits"?"CR":"Career Tokens"}</>}
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-4 text-sm"><span className="text-amber-300">{profile?.credits??0} CR</span><span className="text-violet-300">{profile?.career.tokens??0} Career Tokens</span></div>
        <div className="text-xs text-violet-200 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />
          Daily rotation · 3 per category · Resets 00:00 UTC
        </div>
      </div>
      {rotationError&&<p role="alert" className="text-sm text-rose-300 mb-4">Shop rotation unavailable. Retrying automatically.</p>}
      {!rotation?<p className="text-white/50 py-6">Loading today's offers…</p>:<>
        {(category==="all"||category==="weaponSkin")&&<>
          <label htmlFor="shop-weapon" className="text-xs text-white/70 block mb-1">Buy weapon finishes for this weapon only</label>
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
              const count=offers(currency,group.id).length;
              return <button type="button" key={group.id} aria-pressed={category===group.id}
                onClick={()=>setCategory(group.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${category===group.id
                  ?"border-violet-400/60 bg-violet-500/15 text-violet-100"
                  :"border-white/10 bg-zinc-900/60 text-white/60 hover:border-white/30 hover:text-white"}`}>
                {group.label} <span className="ml-1 opacity-60">{count}</span>
              </button>;
            })}
          </div>
          <TabsContent value="credits">{section("credits")}</TabsContent>
          <TabsContent value="career">{section("career")}</TabsContent>
        </Tabs>
      </>}
      <p className="text-xs text-white/40 mt-6">Offers are the same for everyone, including already-owned items. Purchases stay unlocked after rotation. Equip in Armory or Profile.</p>
    </main>
  </div>;
}
