"use client";
import {useEffect,useMemo,useState} from "react";
import {formatCredits} from "@/lib/format-credits";
import {useGame} from "@/lib/game-store";
import {shopCategoriesForCurrency,shopCategoryLabel,shopItemById,shopItemsForCategory,shopPurchaseStatus,shopItemKey,
  type ShopCategory,type ShopCurrency,type ShopPurchaseStatus} from "@/lib/shop-catalog";
import type {DailyShopRotation,DailyShopOffer} from "@/lib/shop-rotation";
import {cosmeticById} from "@/lib/cosmetics";
import {WEAPONS,WEAPON_SKINS,PLAYER_SKINS} from "@/lib/game-data";
import {ownsWeapon} from "@/lib/collection-ownership";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {Coins,Gem,ShoppingBag,Lock,RefreshCw,Check} from "lucide-react";
import {toast} from "sonner";

const statusStyles:Record<ShopPurchaseStatus,string>={
  owned:"bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 disabled:opacity-100",
  "weapon-locked":"bg-rose-950/70 border border-rose-500/50 text-rose-300 disabled:opacity-100",
  "career-locked":"bg-violet-950/80 border border-violet-500/60 text-violet-300 disabled:opacity-100",
  "credits-short":"bg-amber-950/70 border border-amber-600/50 text-amber-300 disabled:opacity-100",
  "tokens-short":"bg-fuchsia-950/70 border border-fuchsia-500/50 text-fuchsia-300 disabled:opacity-100",
  available:"bg-amber-500 hover:bg-amber-400 text-black font-semibold",
};

export function Shop(){
  const {profile,playerKey,refreshProfile}=useGame();
  const [busy,setBusy]=useState("");
  const [currency,setCurrency]=useState<ShopCurrency>("credits");
  const [category,setCategory]=useState<ShopCategory>("all");
  const [rotation,setRotation]=useState<DailyShopRotation|null>(null);
  const [rotationError,setRotationError]=useState(false);
  const [now,setNow]=useState(0);

  useEffect(()=>{
    let active=true;
    async function reload(){
      try{
        const res=await fetch("/api/shop/rotation",{cache:"no-store"});
        if(!res.ok)throw new Error("Rotation unavailable");
        const data=await res.json() as DailyShopRotation;
        if(!Array.isArray(data.offers)||!data.dayKey||!data.refreshAt)throw new Error("Invalid rotation");
        if(active){setRotation(data);setRotationError(false);}
      }catch{if(active)setRotationError(true);}
    }
    void reload();
    const timer=setInterval(()=>void reload(),10000);
    function visible(){if(document.visibilityState==="visible")void reload();}
    document.addEventListener("visibilitychange",visible);
    return()=>{active=false;clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[]);

  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    tick();
    const timer=setInterval(tick,1000);
    return()=>clearInterval(timer);
  },[]);
  const visibleCategories=shopCategoriesForCurrency(currency);
  const nextRotation=rotation?Math.max(0,Math.ceil((Date.parse(rotation.refreshAt)-now)/1000)):0;
  const countdown=now&&rotation
    ?[Math.floor(nextRotation/3600),Math.floor(nextRotation%3600/60),nextRotation%60]
      .map(n=>String(n).padStart(2,"0")).join(":")
    :"--:--:--";

  const ownedWeapons=useMemo(()=>new Set(WEAPONS.filter(w=>!w.wonder&&!!profile
    &&ownsWeapon(w,profile.level,profile.unlocks.weapons)).map(w=>w.id)),[profile]);
  const offers=(c:ShopCurrency,g:ShopCategory):DailyShopOffer[]=>{
    const eligible=new Set(shopItemsForCategory(c,g).map(item=>item.id));
    return (rotation?.offers??[]).filter(offer=>eligible.has(offer.itemId));
  };

  async function buy(offer:DailyShopOffer){
    if(!profile||!playerKey||busy)return;
    const item=shopItemById(offer.itemId);
    if(!item||!rotation?.offers.some(o=>o.itemId===offer.itemId&&o.weaponId===offer.weaponId))return;
    setBusy(offer.itemId);
    try{
      const res=await fetch("/api/shop",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({playerKey,itemId:offer.itemId,weaponId:offer.weaponId})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error??"Purchase failed");
      toast.success("Purchased");
      await refreshProfile();
    }catch(e){toast.error(e instanceof Error?e.message:"Purchase failed");}
    finally{setBusy("");}
  }

  const section=(c:ShopCurrency)=>(
    <div className="space-y-6">
      {visibleCategories.filter(g=>g.id!=="all"&&(category==="all"||category===g.id)).map(group=>{
        const featured=offers(c,group.id);
        if(!featured.length)return null;
        return <section key={group.id} aria-label={shopCategoryLabel(c,group.id)}>
          {category==="all"&&<h2 className="text-sm font-bold text-white mb-3">{shopCategoryLabel(c,group.id)}</h2>}
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {featured.map(offer=>{
              const item=shopItemById(offer.itemId)!;
              const finish=WEAPON_SKINS.find(s=>s.id===item.skinId);
              const operator=PLAYER_SKINS.find(s=>s.id===item.skinId);
              const skin=finish??operator,cosmetic=cosmeticById(item.cosmeticId??"");
              const weapon=item.kind==="weaponSkin"?WEAPONS.find(w=>w.id===offer.weaponId):
                item.wonderWeaponId?WEAPONS.find(w=>w.id===item.wonderWeaponId):undefined;
              const owned=item.currency==="wonder" ? (profile?.prestige.wonderPurchases??[]).includes(item.id)
                :item.kind==="weaponSkin"
                ?(profile?.unlocks.skinsByWeapon[offer.weaponId??""]??[]).includes(item.skinId??"")
                :item.kind==="playerSkin"?(profile?.unlocks.playerSkins??[]).includes(item.skinId??"")
                :(profile?.ownedCosmetics??[]).includes(item.cosmeticId??"");
              const status=shopPurchaseStatus(item,{
                owned,weaponOwned:!!weapon&&(item.currency==="wonder"?!!profile?.prestige.wonderWeapons.includes(weapon.id):ownedWeapons.has(weapon.id)),
                careerUnlocked:!!profile?.career.unlocked,credits:profile?.credits??0,
                careerTokens:profile?.career.tokens??0,wonderTokens:profile?.prestige.tokens??0,
              });
              return <article key={shopItemKey(item,offer.weaponId)} className="border border-white/10 bg-zinc-900/70 rounded-2xl p-4 flex flex-col">
                {item.currency!=="wonder"&&<div className="h-16 rounded-lg mb-3 border border-white/10 flex items-center justify-center"
                  style={{background:`linear-gradient(125deg,#080c13,${skin?.color??cosmetic?.color??"#444"}55,#111827)`}}>
                  {cosmetic&&<span className="text-3xl" style={{color:cosmetic.color,textShadow:`0 0 10px ${cosmetic.color}88`}}>{cosmetic.symbol}</span>}
                  {skin&&<span className="text-xs font-semibold px-3 py-1 rounded border border-white/20 bg-black/30" style={{color:skin.color==="black"?"#fff":skin.color}}>{item.kind==="weaponSkin"?"WEAPON FINISH":"OPERATIVE"}</span>}
                </div>}
                <h3 className="font-semibold text-white">{item.name}{weapon?` [${weapon.name}]`:""}</h3>
                <p className="text-sm text-white/55 mt-1 flex-1">{item.description}</p>
                <Button type="button" className={`w-full mt-4 ${statusStyles[status]}`}
                  disabled={busy!==""||status!=="available"} onClick={()=>void buy(offer)}>
                  {status==="owned"?<><Check className="w-4 h-4 mr-1"/>Already unlocked</>
                    :status==="weapon-locked"?<><Lock className="w-4 h-4 mr-1"/>{c==="wonder"?"Unlock this Wonder first":"Weapon locked"}</>
                    :status==="career-locked"?<><Lock className="w-4 h-4 mr-1"/>Career locked · LVL 40</>
                    :status==="credits-short"?<><Coins className="w-4 h-4 mr-1"/>Not enough credits</>
                    :status==="tokens-short"?<><Gem className="w-4 h-4 mr-1"/>Not enough {c==="wonder"?"Wonder":"Career"} Tokens</>
                    :busy===offer.itemId?"Purchasing…"
                    :<>{c==="credits"?<Coins className="w-4 h-4 mr-1"/>:<Gem className="w-4 h-4 mr-1"/>}
                      {c==="credits"?formatCredits(item.cost):item.cost} {c==="credits"?"CR":c==="wonder"?"Wonder Token"+(item.cost===1?"":"s"):"Career Tokens"}</>}
                </Button>
              </article>;
            })}
          </div>
        </section>;
      })}
    </div>
  );

  return <div className="min-h-screen bg-[#0a0a0a] text-white">
    <header className="border-b border-white/10 bg-black/40">
      <div className="max-w-6xl mx-auto flex items-center gap-3 px-5 py-4">
        <ShoppingBag className="w-5 h-5 text-violet-300"/><h1 className="text-xl font-bold">Cosmetic Shop</h1>
      </div>
    </header>
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-4 text-sm"><span className="text-amber-300">{formatCredits(profile?.credits??0)} CR</span><span className="text-violet-300">{profile?.career.tokens??0} Career Tokens</span><span className="text-fuchsia-300">{profile?.prestige.tokens??0} Wonder Tokens</span></div>
        <div className="text-xs text-violet-200 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5"/> Next rotation in <span className="tabular-nums font-semibold">{countdown}</span>
        </div>
      </div>
      {rotationError&&<p role="alert" className="text-sm text-rose-300 mb-4">Shop rotation unavailable.</p>}
      {!rotation?<p className="text-white/50 py-6">Loading today's offers…</p>:
        <Tabs value={currency} onValueChange={v=>{setCurrency(v as ShopCurrency);setCategory(v==="wonder"?"wonderModule":"all");}}>
          <TabsList className="bg-zinc-900 border border-white/10">
            <TabsTrigger value="credits">Credit Shop</TabsTrigger>
            <TabsTrigger value="career">Career Token Shop</TabsTrigger>
            <TabsTrigger value="wonder">Wonder Token Shop</TabsTrigger>
          </TabsList>
          <div className="grid grid-cols-[128px_minmax(0,1fr)] sm:grid-cols-[192px_minmax(0,1fr)] gap-4 sm:gap-6 mt-5 items-start">
            <nav aria-label="Shop categories" className="sticky top-20 rounded-xl border border-white/10 bg-zinc-900/60 p-1.5 sm:p-2 flex flex-col gap-1">
              {visibleCategories.map(group=><button type="button" key={group.id}
                aria-current={category===group.id?"page":undefined} onClick={()=>setCategory(group.id)}
                className={`w-full text-left rounded-lg px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors ${category===group.id
                  ?"bg-violet-500/20 text-violet-200 border border-violet-500/40"
                  :"text-white/65 hover:text-white hover:bg-white/5 border border-transparent"}`}>
                {shopCategoryLabel(currency,group.id)}
              </button>)}
            </nav>
            <div className="min-w-0">
              <TabsContent value="credits" className="mt-0">{section("credits")}</TabsContent>
              <TabsContent value="career" className="mt-0">{section("career")}</TabsContent>
              <TabsContent value="wonder" className="mt-0">{section("wonder")}</TabsContent>
            </div>
          </div>
        </Tabs>}

    </main>
  </div>;
}
