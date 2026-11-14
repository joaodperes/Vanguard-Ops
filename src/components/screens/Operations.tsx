"use client";
import {useEffect,useRef,useState} from 'react';
import {useGame} from '@/lib/game-store';
import {OPERATIONS,loadOperationProgress,operationUnlocked,type OperationProgress,type OperationMission} from '@/lib/operations';
import {getMap,recommendedTeamSize} from '@/lib/game-protocol';
import {waitForAttachmentSaves} from '@/lib/attachment-save-queue';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';

export function Operations(){
 const {playerKey,profile,setScreen,setRoomConnect,setPlayConfig}=useGame();
 const [progress,setProgress]=useState<OperationProgress>({}),[selected,setSelected]=useState(OPERATIONS[0].id),[launching,setLaunching]=useState(false);
 const launchLock=useRef(false);
 useEffect(()=>{const saved=loadOperationProgress(playerKey);setProgress(saved);setSelected((OPERATIONS.find(m=>operationUnlocked(m.id,saved)&&!saved[m.id]?.completions)??OPERATIONS[0]).id);},[playerKey]);
 const mission=OPERATIONS.find(m=>m.id===selected)!,unlocked=operationUnlocked(mission.id,progress);
 const completed=OPERATIONS.filter(m=>progress[m.id]?.completions).length;
 async function deploy(m:OperationMission,online:boolean){
  if(launchLock.current||!operationUnlocked(m.id,progress))return;
  launchLock.current=true;setLaunching(true);
  try{
   await waitForAttachmentSaves();
   const response=await fetch(`/api/profile?playerKey=${encodeURIComponent(playerKey)}`,{cache:'no-store'});
   if(!response.ok)throw new Error('Unable to load your saved loadout.');
   const fresh=await response.json();if(!fresh?.loadout)throw new Error('A saved loadout is required.');
   useGame.getState().setProfile(fresh);
   setPlayConfig({mode:'survival',operationId:m.id,mapId:m.mapId,online,botCount:0,scoreLimit:0,timeLimit:0,botDifficulty:'normal',survivalTier:'default'});
   setRoomConnect(online?{kind:'create',config:{mode:'survival',operationId:m.id,mapId:m.mapId,teamSize:recommendedTeamSize(m.mapId,'survival'),fillWithBots:false,password:null,roomName:`Operations · ${m.title}`,botDifficulty:'normal',survivalPlayers:2,survivalTier:'default'}}:null);
   setScreen('playing');
  }catch(error){toast.error(error instanceof Error?error.message:'Unable to deploy.');}
  finally{launchLock.current=false;setLaunching(false);}
 }
 return <main className="mx-auto max-w-6xl px-4 py-8 text-white">
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
   <div><p className="text-amber-400 text-xs tracking-[.3em] uppercase">Vanguard campaign</p><h1 className="text-4xl font-black mt-2">Operations</h1><p className="text-white/60 mt-2">Three acts. Twelve missions. One network to bring down.</p></div>
   <div className="text-sm text-amber-200">{completed}/{OPERATIONS.length} complete · {Object.values(progress).reduce((n,r)=>n+r.stars,0)}/{OPERATIONS.length*3} ★</div>
  </div>
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
     <p>◆ Objective · ◇ Optional intel. Stand at the marker to interact automatically. Defeat each encounter before advancing; nearby enemies contest the site.</p>
     <p>Deliveries require the carrier at the destination. Death drops the package. Extraction requires all surviving teammates and a clear area.</p>
     <p>Choose a run upgrade after each objective. Defence stages bring timed reinforcements. Fallen co-op teammates recover between stages; a squad wipe ends the mission.</p>
     <p>★ Finish · ★ Recover intel · ★ No personal deaths and finish within {Math.floor(mission.parSeconds/60)} minutes. Abort deadline: {Math.floor(mission.parSeconds*2/60)} active minutes.</p>
    </div>
    {!unlocked&&<p className="text-amber-200 mb-3">Complete the preceding mission to unlock this deployment.</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={!unlocked||launching||!profile} onClick={()=>deploy(mission,false)} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">{launching?'Deploying…':'Deploy solo'}</Button><Button disabled={!unlocked||launching||!profile} onClick={()=>deploy(mission,true)} variant="outline">Host 2-player co-op</Button><Button onClick={()=>setScreen('play')} variant="ghost">Browse co-op rooms</Button></div>
    <p className="text-xs text-white/40 mt-4">Your partner joins through Play → Browse or a room invitation. Stay together on the results screen to replay or launch the next mission. Campaign ratings and unlocks save per player in this browser. Operations do not award career XP, credits or Survival milestones.</p>
   </section>
  </div>
 </main>;
}
