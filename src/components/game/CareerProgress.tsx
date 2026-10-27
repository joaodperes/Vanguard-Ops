"use client";
import { useState } from "react";
import { useGame } from "@/lib/game-store";
import { Button } from "@/components/ui/button";
import { Award, Coins, CheckCircle2 } from "lucide-react";

export function CareerProgress() {
  const {profile,playerKey,refreshProfile,setScreen}=useGame();
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const career=profile?.career;
  if(!career)return null;
  async function claim(){
    if(!career?.canClaim||busy)return;
    setBusy(true);setError("");
    try{
      const res=await fetch("/api/profile/career",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({playerKey})});
      if(!res.ok)throw new Error((await res.json().catch(()=>({}))).error??"Unable to claim token");
      await refreshProfile();
    }catch(e){setError(e instanceof Error?e.message:"Unable to claim");}
    finally{setBusy(false);}
  }
  return <section aria-label="Career Contracts" className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/30 to-zinc-950 p-5 mb-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-white font-bold flex items-center gap-2"><Award className="w-5 h-5 text-violet-300"/>Career Contracts · Set {career.cycle}</h2>
      <span className="text-sm text-violet-200">{career.tokens} Career Tokens</span>
    </div>
    <p className="text-sm text-white/65 mt-2">At level 40, finish any three of five long-term contracts to claim one token for exclusive Shop cosmetics. No gameplay bonuses or resets. Your previously earned Career titles are retained.</p>
    {career.unlocked?<div className="mt-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-violet-200">
        <span>{career.completed} / {career.required} required contracts completed</span>
        <Button size="sm" variant="outline" onClick={()=>setScreen("shop")} className="border-violet-500/40 text-violet-200">Visit Career Shop</Button>
      </div>
      {career.contracts.map(contract=><div key={contract.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
        <div className="flex justify-between gap-3 text-sm">
          <span className="font-medium text-white">{contract.completed?<CheckCircle2 className="inline h-4 w-4 text-emerald-400 mr-1"/>:null}{contract.title}</span>
          <span className="shrink-0 text-white/55 tabular-nums">{contract.progress.toLocaleString()} / {contract.goal.toLocaleString()}</span>
        </div>
        <p className="mt-0.5 text-xs text-white/50">{contract.description}</p>
        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-violet-400" style={{width:`${Math.min(100,100*contract.progress/contract.goal)}%`}}/>
        </div>
      </div>)}
      <Button disabled={!career.canClaim||busy} onClick={()=>void claim()} className="bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-50">
        <Coins className="h-4 w-4 mr-2"/>{busy?"Claiming…":"Claim 1 Career Token"}
      </Button>
      {error&&<p role="alert" className="text-rose-400 text-sm">{error}</p>}
    </div>:<p className="text-sm text-white/50 mt-3">Unlocks at level {career.unlockLevel}. Only matches played after contracts become active count towards their progress.</p>}
  </section>;
}
