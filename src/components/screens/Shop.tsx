"use client";
import {useMemo,useState} from "react";
import {useGame} from "@/lib/game-store";
import {SHOP_ITEMS,shopItemKey,type ShopCurrency} from "@/lib/shop-catalog";
import {WEAPONS,WEAPON_SKINS,PLAYER_SKINS,levelForXp} from "@/lib/game-data";
import {ownsWeapon} from "@/lib/collection-ownership";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {ArrowLeft,Coins,Gem,ShoppingBag,Lock} from "lucide-react";
import {toast} from "sonner";

export function Shop(){
  const {profile,playerKey,setScreen,refreshProfile}=useGame();
  const [busy,setBusy]=useState(""),[weaponId,setWeaponId]=useState("");
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
  const section=(currency:ShopCurrency)=><div className="grid gap-4 md:grid-cols-2 mt-5">
    {SHOP_ITEMS.filter(item=>item.currency===currency).map(item=>{
      const finish=WEAPON_SKINS.find(s=>s.id===item.skinId),operator=PLAYER_SKINS.find(s=>s.id===item.skinId);
      const skin=finish??operator;const isOwned=item.kind==="weaponSkin"?
        (profile?.unlocks.skinsByWeapon[choice]??[]).includes(item.skinId):
        (profile?.unlocks.playerSkins??[]).includes(item.skinId);
      const canPay=currency==="credits"?(profile?.credits??0)>=item.cost:(profile?.career.tokens??0)>=item.cost;
      const locked=currency==="career"&&!profile?.career.unlocked;
      return <article key={shopItemKey(item,choice)} className="border border-white/10 bg-zinc-900/70 rounded-2xl p-4">
        <div className="h-16 rounded-lg mb-3 border border-white/10" style={{background:`linear-gradient(125deg,#080c13,${skin?.color??"#444"},#111827)`}}/>
        <h3 className="font-semibold text-white">{item.name}</h3>
        <p className="text-sm text-white/55 mt-1 min-h-10">{item.description}</p>
        <p className="text-xs text-white/40 mt-2">{item.kind==="weaponSkin"?`Weapon finish · ${WEAPONS.find(w=>w.id===choice)?.name??"Select a weapon"}`:"Operative skin"}</p>
        <Button className="w-full mt-3" disabled={busy!==""||isOwned||!canPay||locked||item.kind==="weaponSkin"&&!choice}
          onClick={()=>void buy(item.id)}>
          {isOwned?"Owned":locked?<><Lock className="w-4 h-4 mr-1"/>Level 40 required</>:
            <>{currency==="credits"?<Coins className="w-4 h-4 mr-1"/>:<Gem className="w-4 h-4 mr-1"/>}
              {item.cost.toLocaleString()} {currency==="credits"?"CR":"Career Tokens"}</>}
        </Button>
      </article>;
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
      <p className="text-white/60 mb-5">Credits buy additional cosmetic options; Career Tokens unlock exclusive finishes. Reticle selection and all gameplay controls remain free.</p>
      <div className="flex gap-4 text-sm mb-5"><span className="text-amber-300">{profile?.credits??0} CR</span><span className="text-violet-300">{profile?.career.tokens??0} Career Tokens</span></div>
      <label htmlFor="shop-weapon" className="text-xs text-white/70 block mb-1">Preview/purchase weapon finishes for</label>
      <select id="shop-weapon" className="bg-zinc-900 border border-white/20 rounded-lg p-2 mb-5 w-full max-w-md"
        value={choice} onChange={e=>setWeaponId(e.target.value)}>
        {owned.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <Tabs defaultValue="credits">
        <TabsList className="bg-zinc-900 border border-white/10">
          <TabsTrigger value="credits">Credit Shop</TabsTrigger><TabsTrigger value="career">Career Token Shop</TabsTrigger>
        </TabsList>
        <TabsContent value="credits">{section("credits")}</TabsContent>
        <TabsContent value="career">{section("career")}</TabsContent>
      </Tabs>
      <p className="text-xs text-white/40 mt-6">Purchases are permanent. Equip newly purchased finishes and operative skins in the Armory. No equipment stats, reticles, or gameplay advantages are sold here.</p>
    </main>
  </div>;
}
