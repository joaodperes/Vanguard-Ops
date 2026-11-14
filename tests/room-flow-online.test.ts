import {test,expect} from "bun:test";
import {io,type Socket} from "socket.io-client";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {createServer} from "node:net";
import type {C2S,S2C,LoadoutWire,GameMode} from "../src/lib/game-protocol";
const loadout:LoadoutWire={weaponId:"rifle_ar",weaponSkinId:"default",playerSkinId:"default",attachments:{sight:null,barrel:null,grip:null,magazine:null}};

test("real sockets retain a private group across voting, results, rematches and host departure",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"vanguard-room-test-"));
  await writeFile(join(dir,"test.sqlite"),"");
  const env={...process.env,DATABASE_URL:`file:${join(dir,"test.sqlite")}`};
  const setup=Bun.spawn([process.execPath,"node_modules/prisma/build/index.js","db","push","--skip-generate"],{env,stdout:"pipe",stderr:"pipe"});
  const setupOutput=await new Response(setup.stderr).text();expect(await setup.exited,setupOutput).toBe(0);
  const port=await new Promise<number>(res=>{const s=createServer();s.listen(0,"127.0.0.1",()=>{const p=(s.address() as any).port;s.close(()=>res(p));});});
  // Accelerate only simulation ticks. Room cleanup retains its real 15-second delay.
  const server=Bun.spawn([process.execPath,"--eval",`import {startGameServer} from ${JSON.stringify(resolve("src/lib/game-server.ts"))}; const interval=globalThis.setInterval; globalThis.setInterval=(fn,ms,...args)=>interval(fn,ms===50?1:ms,...args); await startGameServer(${port});`],{env,stdout:"pipe",stderr:"pipe"});
  const clients:Socket[]=[];const messages=new Map<Socket,S2C[]>();
  async function connect(){
    const s=io(`http://127.0.0.1:${port}`,{path:"/",transports:["websocket"],reconnection:true,reconnectionDelay:100,timeout:1000});
    clients.push(s);messages.set(s,[]);s.on("message",m=>messages.get(s)!.push(m));
    await new Promise<void>((res,rej)=>{const timer=setTimeout(()=>rej(new Error("Connection timeout")),10000);s.once("connect",()=>{clearTimeout(timer);res();});});return s;
  }
  async function wait<T extends S2C["t"]>(s:Socket,type:T,predicate:(m:Extract<S2C,{t:T}>)=>boolean=()=>true):Promise<Extract<S2C,{t:T}>>{
    const deadline=Date.now()+25000;
    while(Date.now()<deadline){const rows=messages.get(s)!;const i=rows.findIndex(m=>m.t===type&&predicate(m as any));if(i>=0)return rows.splice(i,1)[0] as any;await Bun.sleep(10);}
    throw new Error(`Timed out waiting for ${type}: ${messages.get(s)!.map(m=>m.t).join(",")}`);
  }
  function send(s:Socket,msg:C2S){s.emit("message",msg);}
  function enter(s:Socket,id:string,password:string|null){send(s,{t:"joinRoom",playerKey:s.id!,name:s.id!,loadout,roomId:id,password});}
  try{
    const host=await connect(),guest=await connect();
    send(host,{t:"createRoom",playerKey:host.id!,name:"Host",loadout,config:{mode:"tdm",mapId:"compound",teamSize:3,fillWithBots:false,password:"secret",botDifficulty:"normal",scoreLimit:0,timeLimit:0.1}});
    const id=(await wait(host,"roomJoined")).matchId;
    enter(guest,id,"wrong");expect((await wait(guest,"roomError")).message).toContain("password");
    enter(guest,id,"secret");expect((await wait(guest,"roomJoined")).matchId).toBe(id);
    const lobby=(await wait(host,"roomStatus",m=>m.status.players.length===2)).status;
    const mapId=lobby.candidates[1];expect(mapId).toBeDefined();
    send(host,{t:"voteMap",mapId});send(guest,{t:"voteMap",mapId});await wait(host,"roomStatus",m=>Object.keys(m.status.votes).length===2);
    send(guest,{t:"startMatch"});expect((await wait(guest,"roomError")).message).toContain("host");
    send(host,{t:"startMatch"});const launched=await wait(host,"roundLaunched");expect(launched.roomId).toBe(id);expect(launched.mapId).toBe(mapId);await wait(host,"matchStarted");
    enter(host,id,"secret");expect((await wait(host,"roomJoined")).players.filter(p=>!p.isBot)).toHaveLength(2);
    await wait(host,"matchEnd");const ended=(await wait(host,"roomStatus",m=>m.status.phase==="ended")).status;expect(ended.players).toHaveLength(2);
    await Bun.sleep(15500);
    send(host,{t:"readyNextRound"});send(host,{t:"startMatch"});expect((await wait(host,"roomError")).message).toContain("saving");
    send(guest,{t:"readyNextRound"});await wait(host,"roomStatus",m=>m.status.ready.length===2);
    send(guest,{t:"voteMap",mapId:ended.candidates[1]});await wait(host,"roomStatus",m=>m.status.votes[guest.id!]===ended.candidates[1]);
    messages.set(host,messages.get(host)!.filter(m=>m.t!=="snapshot"));
    send(host,{t:"startMatch"});const rematch=await wait(host,"roundLaunched");expect(rematch.roomId).toBe(id);expect(rematch.mapId).toBe(ended.candidates[1]);
    const snap=await wait(host,"snapshot",m=>m.players.filter(p=>!p.isBot).length===2);
    expect(snap.players.filter(p=>!p.isBot)).toHaveLength(2);expect(snap.players.every(p=>p.kills===0&&p.deaths===0&&p.health===100)).toBe(true);expect(snap.teamScores).toEqual({red:0,blue:0});
    await wait(host,"matchEnd");const oldHostId=host.id;host.disconnect();
    const transfer=(await wait(guest,"roomStatus",m=>m.status.hostSocketId===guest.id)).status;expect(transfer.players.some(p=>p.id===oldHostId)).toBe(false);
    send(guest,{t:"readyNextRound"});send(guest,{t:"startMatch"});expect((await wait(guest,"roundLaunched")).roomId).toBe(id);
    const quick1=await connect(),quick2=await connect();
    send(quick1,{t:"quickPlay",playerKey:quick1.id!,name:"Quick 1",loadout,mode:"tdm"});const quickJoined=await wait(quick1,"roomJoined");expect(quickJoined.matchId).not.toBe(id);await wait(quick1,"matchStarted");
    send(quick2,{t:"quickPlay",playerKey:quick2.id!,name:"Quick 2",loadout,mode:"tdm"});expect((await wait(quick2,"roomJoined")).matchId).toBe(quickJoined.matchId);
    expect((await wait(quick2,"roomStatus",m=>m.status.players.length===2)).status.room.hasPassword).toBe(false);
    for(const mode of ["ffa","killconfirmed","ctf","survival","gungame"] as GameMode[]){const s=await connect();send(s,{t:"quickPlay",playerKey:s.id!,name:mode,loadout,mode});expect((await wait(s,"roomJoined")).mode).toBe(mode);expect((await wait(s,"roundLaunched")).mode).toBe(mode);await wait(s,"matchStarted");s.disconnect();}
  }finally{clients.forEach(s=>s.disconnect());server.kill();await server.exited;await rm(dir,{recursive:true,force:true});}
},120000);
