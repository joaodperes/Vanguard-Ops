"use client";
import {useEffect,useRef,useState} from 'react';
import {useGame} from '@/lib/game-store';
import {OPERATIONS,operationUnlocked,operationFirstClearReward,type OperationProgress,type OperationMission} from '@/lib/operations';
import {syncOperationProgress} from '@/lib/operations-client';
import {getMap} from '@/lib/game-protocol';
import {waitForAttachmentSaves} from '@/lib/attachment-save-queue';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';

export function Operations(){
 const {playerKey,profile,setScreen,setRoomConnect,setPlayConfig,refreshProfile}=useGame();
 const [progress,setProgress]=useState<OperationProgress>({}),[selected,setSelected]=useState(OPERATIONS[0].id),[launching,setLaunching]=useState(false);
 const launchLock=useRef(false);
 const [loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState(false);
 const [reload,setReload]=useState(0);
 useEffect(()=>{let cancelled=false;setLoaded(false);setLoadError(false);setProgress({});
  syncOperationProgress(playerKey).then(result=>{if(cancelled)return;const saved=result.progress;setProgress(saved);setSelected((OPERATIONS.find(m=>operationUnlocked(m.id,saved)&&!saved[m.id]?.completions)??OPERATIONS[0]).id);setLoaded(true);for(const reward of result.firstClearRewards){const awarded=OPERATIONS.find(m=>m.id===reward.missionId);toast.success(`First clear reward${awarded?`: ${awarded.title}`:''}`,{description:`+${reward.xp} XP · +${reward.credits} CR`});}if(result.firstClearRewards.length)void refreshProfile();}).catch(error=>{if(!cancelled){setLoadError(true);toast.error(error.message);}});
  return ()=>{cancelled=true;};
 },[playerKey,reload]);
 const mission=OPERATIONS.find(m=>m.id===selected)!,unlocked=operationUnlocked(mission.id,progress);
 const completed=OPERATIONS.filter(m=>progress[m.id]?.completions).length;
 const record=progress[mission.id],firstClear=operationFirstClearReward(mission);
 async function deploy(m:OperationMission){
  if(!loaded||launchLock.current||!operationUnlocked(m.id,progress))return;
  launchLock.current=true;setLaunching(true);
  try{
   await waitForAttachmentSaves();
   const response=await fetch(`/api/profile?playerKey=${encodeURIComponent(playerKey)}`,{cache:'no-store'});
   if(!response.ok)throw new Error('Unable to load your saved loadout.');
   const fresh=await response.json();if(!fresh?.loadout)throw new Error('A saved loadout is required.');
   useGame.getState().setProfile(fresh);
   setPlayConfig({mode:'survival',operationId:m.id,mapId:m.mapId,online:false,botCount:0,scoreLimit:0,timeLimit:0,botDifficulty:'normal',survivalTier:'default'});
   setRoomConnect(null);
   setScreen('playing');
  }catch(error){toast.error(error instanceof Error?error.message:'Unable to deploy.');}
  finally{launchLock.current=false;setLaunching(false);}
 }
 return <main className="mx-auto max-w-6xl px-4 py-8 text-white">
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
   <div><p className="text-amber-400 text-xs tracking-[.3em] uppercase">Vanguard campaign</p><h1 className="text-4xl font-black mt-2">Operations</h1></div>
   <div className="text-sm text-amber-200">{completed}/{OPERATIONS.length} complete · {Object.values(progress).reduce((n,r)=>n+r.stars,0)}/{OPERATIONS.length*3} ★</div>
  </div>
  {!loaded&&<p role="status" className="text-amber-200 mb-4">{loadError?<>Unable to load campaign progress. <button onClick={()=>setReload(n=>n+1)} className="underline">Retry</button></>:"Loading player campaign progress…"}</p>}
  <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
   <section aria-label="Campaign missions" className="space-y-5">
    {[1,2,3].map(act=><div key={act}><h2 className="text-sm font-bold text-white/70 mb-2">ACT {act} · {['Trace the Signal','Break the Network','Shut It Down'][act-1]}</h2>
     <div className="grid sm:grid-cols-2 gap-2">{OPERATIONS.filter(m=>m.act===act).map(m=>{
      const available=operationUnlocked(m.id,progress),record=progress[m.id];
      return <button key={m.id} aria-pressed={selected===m.id} onClick={()=>setSelected(m.id)} className={`text-left rounded-lg border p-3 transition-colors ${selected===m.id?'border-amber-400 bg-amber-500/15':'border-white/10 bg-white/5 hover:bg-white/10'}`}>
       <span className="text-xs text-white/50">{String(OPERATIONS.indexOf(m)+1).padStart(2,'0')} · {getMap(m.mapId).name}</span><span className="block font-bold mt-1">{!available?'🔒 ':''}{m.title}</span>
       <span className="text-amber-300 text-xs">{record?`${'★'.repeat(record.stars)}${'☆'.repeat(3-record.stars)} · ${Math.floor(record.bestSeconds/60)}:${String(record.bestSeconds%60).padStart(2,'0')}`:available?'Ready to deploy':'Complete the preceding mission'}</span>
      </button>;
     })}</div></div>)}
   </section>
   <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-6 self-start lg:sticky lg:top-20" aria-label="Mission briefing">
    <p className="text-xs text-amber-300 uppercase tracking-widest">Act {mission.act} · {getMap(mission.mapId).name}</p><h2 className="text-3xl font-black mt-2">{mission.title}</h2><p className="text-white/70 mt-4 leading-relaxed">{mission.briefing}</p>
    <ol className="mt-5 space-y-2 text-sm text-white/80 list-decimal pl-5">{mission.objectives.map((g,i)=><li key={i}>{g.label}{g.seconds>0&&<span className="text-white/40"> · {g.seconds}s</span>}</li>)}</ol>
    <div className="text-sm text-white/60 my-5 space-y-2">
     <p><strong className="text-white/80">◆ Main goal</strong> Complete every listed objective and extract. Stand at each marker to interact automatically; nearby enemies contest the site.</p>
     <p><strong className="text-white/80">◇ Optional objective</strong> Recover the intel cache at the optional marker for an additional star.</p>
     <p>Deliveries require you to carry the package to the destination. If you are downed, it drops at your last position. Extraction requires you to reach the zone and clear the area.</p>
     <p>Choose a run upgrade after each objective. Defence stages bring timed reinforcements. Run upgrades reset on a new deployment.</p>
     <p>★ Complete the mission.</p>
     <p>★ Recover the optional intel.</p>
     <p>★ Finish within {Math.floor(mission.parSeconds/60)} minutes without any personal deaths.</p>
    </div>
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-4">
     <p className="text-xs uppercase tracking-widest text-amber-300 font-bold mb-2">First clear rewards</p>
     <p className="text-sm text-white/85">+{firstClear.xp} XP</p>
     <p className="text-sm text-white/85">+{firstClear.credits} credits</p>
     <p className="text-xs text-white/45 mt-2">{record?.firstClearRewarded?'Claimed':record?.completions?'Previously cleared':'Awarded once on your first successful clear'}</p>
    </div>
    {!unlocked&&<p className="text-amber-200 mb-3">Complete the preceding mission to unlock this deployment.</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={!loaded||!unlocked||launching||!profile} onClick={()=>deploy(mission)} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">{launching?'Deploying…':'Deploy solo'}</Button></div>
   </section>
  </div>
 </main>;
}
