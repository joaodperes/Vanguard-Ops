// Real Socket.IO host/clients in one isolated process and disposable database.
import assert from "node:assert/strict";
import {io,type Socket} from "socket.io-client";
import {startGameServer,getGameServerPerformanceStats} from "../../src/lib/game-server";
import {db} from "../../src/lib/db";
import {getOrCreatePlayer} from "../../src/lib/player-service";
import {teamSizesForMap,roomCapacity,mapAllowedForMode,type S2C,type C2S,type LoadoutWire,type MapId} from "../../src/lib/game-protocol";
import {MovementSendBudget} from "../../src/lib/movement-send-budget";

type Snapshot=Extract<S2C,{t:"snapshot"}>;
type Client={socket:Socket;last?:Snapshot;packets:number;playerKey:string};
const clients:Client[]=[],errors:string[]=[],results:unknown[]=[];
const logError=console.error;
console.error=(...args:unknown[])=>{errors.push(args.join(" "));logError(...args);};
const loadout:LoadoutWire={weaponId:"rifle_ar",secondaryWeaponId:"pistol_side",meleeWeaponId:"knife_tactical",
  weaponSkinId:"default",playerSkinId:"red",equipmentId:"frag",perkId:"battle_hardened",
  attachments:{sight:null,barrel:null,grip:null,magazine:null}};

function waitFor(client:Client,predicate:(msg:S2C)=>boolean,timeout=12000):Promise<S2C>{
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{client.socket.off("message",receive);reject(new Error("Socket message timeout"));},timeout);
    const receive=(msg:S2C)=>{
      if(msg.t==="roomError"){clearTimeout(timer);client.socket.off("message",receive);reject(new Error(msg.message));}
      else if(predicate(msg)){clearTimeout(timer);client.socket.off("message",receive);resolve(msg);}
    };
    client.socket.on("message",receive);
  });
}
async function connect(index:number):Promise<Client>{
  const playerKey="perf-client-"+index;await getOrCreatePlayer(playerKey);
  const socket=io("http://127.0.0.1:3103",{path:"/",transports:["websocket"],autoConnect:false,reconnection:false});
  const client:Client={socket,packets:0,playerKey};clients.push(client);
  socket.on("message",(msg:S2C)=>{if(msg.t==="snapshot"){client.last=msg;client.packets++;}});
  await new Promise<void>((resolve,reject)=>{socket.once("connect",()=>resolve());socket.once("connect_error",reject);socket.connect();});
  return client;
}

try{
  await startGameServer(3103);
  for(const [mapId,humans,fill] of [["emberhold",1,true],["arena_neon",1,true],["floodgate",1,true],["floodgate",32,false]] as const){
    const mode=mapAllowedForMode("tdm",mapId)?"tdm":"ffa";
    const host=await connect(clients.length),teamSize=teamSizesForMap(mapId,mode).at(-1)!;
    const capacity=roomCapacity(mode,teamSize),joined=waitFor(host,msg=>msg.t==="roomJoined");
    host.socket.emit("message",{t:"createRoom",playerKey:host.playerKey,name:"Performance host",loadout,
      config:{mode,mapId:mapId as MapId,teamSize,fillWithBots:fill,password:null,botDifficulty:"normal",scoreLimit:100000,timeLimit:0}} satisfies C2S);
    const room=await joined as Extract<S2C,{t:"roomJoined"}>,party=[host];
    for(let i=1;i<humans;i++){
      const client=await connect(clients.length),joined=waitFor(client,msg=>msg.t==="roomJoined");
      client.socket.emit("message",{t:"joinRoom",playerKey:client.playerKey,name:"Performance client "+i,
        loadout,roomId:room.matchId,password:null,team:"auto"} satisfies C2S);
      await joined;party.push(client);
    }
    const active=waitFor(host,msg=>msg.t==="snapshot"&&!msg.preMatchCountdown);
    host.socket.emit("message",{t:"startMatch"} satisfies C2S);
    await active;
    const before=host.packets,start=performance.now(),budgets=party.map(()=>new MovementSendBudget());
    let movementPackets=0;
    const movement=setInterval(()=>{
      for(let i=0;i<party.length;i++){
        const client=party[i],self=client.last?.players.find(p=>p.id===client.socket.id);
        if(!self?.alive)continue;
        const state:Extract<C2S,{t:"state"}>={t:"state",pos:[...self.pos],yaw:(performance.now()-start)*.0002,pitch:0,
          aiming:false,firing:false,reloading:false,alive:true,sprinting:false};
        if(budgets[i].shouldSend(performance.now(),state)){client.socket.emit("message",state);movementPackets++;}
      }
    },1000/144);
    await new Promise(resolve=>setTimeout(resolve,1500));clearInterval(movement);
    assert(host.packets-before>=5,"authoritative tick stalled");
    assert.equal(host.last!.players.length,fill?capacity:humans);
    for(const client of party){
      assert(client.packets>0);assert.equal(client.last!.players.length,host.last!.players.length);
      assert(client.last!.players.every(p=>p.pos.every(Number.isFinite)&&Number.isFinite(p.health)));
    }
    const diagnostics=getGameServerPerformanceStats().find(r=>r.roomId===room.matchId)!;
    assert(diagnostics.tickMs&&diagnostics.tickMs.samples>0);
    assert(diagnostics.tickMs.p95>=0);
    const elapsed=(performance.now()-start)/1000;
    assert(movementPackets<=party.length*(Math.ceil(elapsed*30)+1));
    results.push({mapId,humans,actors:host.last!.players.length,snapshots:host.packets-before,
      movementPackets,seconds:elapsed,...diagnostics});
    for(const client of party)client.socket.disconnect();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(results,null,2));
  console.log("Multiplayer performance scenarios passed");
}catch(error){
  logError(error);process.exitCode=1;
}finally{
  for(const client of clients)client.socket.disconnect();
  await (globalThis as any).__vanguardGameServerInstance?.shutdown();
  await db.$disconnect();
}
