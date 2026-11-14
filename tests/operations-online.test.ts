import {test,expect} from 'bun:test';
import {io,type Socket} from 'socket.io-client';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import type {C2S,S2C,LoadoutWire,CreateRoomConfig} from '../src/lib/game-protocol';
const loadout:LoadoutWire={weaponId:'rifle_ar',weaponSkinId:'default',playerSkinId:'default',attachments:{sight:null,barrel:null,grip:null,magazine:null}};

test('campaign sockets enforce fixed maps, ready gates, squad retention, replay and mission advancement',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vanguard-operations-'));
 await writeFile(join(dir,'test.sqlite'),'');
 const env={...process.env,DATABASE_URL:`file:${join(dir,'test.sqlite')}`};
 const setup=Bun.spawn([process.execPath,'node_modules/prisma/build/index.js','db','push','--skip-generate'],{env,stdout:'pipe',stderr:'pipe'});
 const setupErr=await new Response(setup.stderr).text();expect(await setup.exited,setupErr).toBe(0);
 const port=await new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=(s.address() as any).port;s.close(()=>resolve(p));});});
 const server=Bun.spawn([process.execPath,'tests/helpers/operations-server-probe.ts'],{env:{...env,OPERATIONS_TEST_PORT:String(port)},stdout:'pipe',stderr:'pipe'});
 const clients:Socket[]=[],messages=new Map<Socket,S2C[]>();
 async function connect(){
  const s=io(`http://127.0.0.1:${port}`,{path:'/',transports:['websocket'],reconnection:true,reconnectionDelay:100,timeout:1000});clients.push(s);messages.set(s,[]);s.on('message',m=>messages.get(s)!.push(m));
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Connection timeout')),20000);s.once('connect',()=>{clearTimeout(timer);resolve();});});return s;
 }
 async function wait<T extends S2C['t']>(s:Socket,t:T,predicate:(m:Extract<S2C,{t:T}>)=>boolean=()=>true):Promise<Extract<S2C,{t:T}>>{
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){const rows=messages.get(s)!,i=rows.findIndex(m=>m.t===t&&predicate(m as any));if(i>=0)return rows.splice(i,1)[0] as any;await Bun.sleep(10);}
  throw Error(`Timed out waiting for ${t}: ${messages.get(s)!.map(m=>m.t).join(',')}`);
 }
 const send=(s:Socket,m:C2S)=>s.emit('message',m);
 const cfg:CreateRoomConfig={mode:'survival',operationId:'orbital_blackout',mapId:'orbital_nexus',teamSize:5,fillWithBots:false,password:null,botDifficulty:'normal',survivalPlayers:2,survivalTier:'default'};
 try{
  const host=await connect(),guest=await connect();
  send(host,{t:'createRoom',playerKey:host.id!,name:'Host',loadout,config:{...cfg,mapId:'compound'}});expect((await wait(host,'roomError')).message).toContain('Invalid Operations');
  send(host,{t:'createRoom',playerKey:host.id!,name:'Host',loadout,config:cfg});
  const joined=await wait(host,'roomJoined'),id=joined.matchId;expect(joined.mapId).toBe('orbital_nexus');expect(joined.config.operationId).toBe(cfg.operationId);
  expect((await wait(host,'roomStatus')).status.candidates).toEqual(['orbital_nexus']);
  send(host,{t:'voteMap',mapId:'compound'});send(host,{t:'voteMap',mapId:'orbital_nexus'});
  const voted=(await wait(host,'roomStatus',m=>m.status.votes[host.id!]==='orbital_nexus')).status;expect(Object.values(voted.votes)).not.toContain('compound');
  send(guest,{t:'listRooms'});const summary=(await wait(guest,'roomList')).rooms.find(r=>r.id===id)!;expect(summary.operationId).toBe(cfg.operationId);expect(summary.capacity).toBe(2);
  send(guest,{t:'joinRoom',playerKey:guest.id!,name:'Partner',loadout,roomId:id,password:null});expect((await wait(guest,'roomJoined')).config.operationId).toBe(cfg.operationId);
  send(host,{t:'startMatch',advanceOperation:true});await wait(host,'roomError'); // Cannot skip a mission before victory.
  send(guest,{t:'startMatch'});expect((await wait(guest,'roomError')).message).toContain('host');
  send(host,{t:'startMatch'});expect((await wait(host,'roundLaunched')).config.operationId).toBe(cfg.operationId);
  const active=await wait(guest,'snapshot',m=>m.operation?.status==='active'&&(m.wave??0)>0);
  expect(active.operation!.stage).toBe(0);expect(active.survivalObjective).toBeUndefined();expect(active.enemiesLeft).toBeGreaterThan(0);
  await wait(host,'matchEnd');await wait(guest,'matchEnd');expect((await wait(host,'snapshot',m=>m.operation?.status==='won')).operation!.stage).toBe(5);
  const ended=(await wait(host,'roomStatus',m=>m.status.phase==='ended')).status;expect(ended.operationComplete).toBe(true);expect(ended.players).toHaveLength(2);
  send(host,{t:'readyNextRound'});send(host,{t:'startMatch',advanceOperation:true});expect((await wait(host,'roomError')).message).toContain('saving');
  send(guest,{t:'readyNextRound'});await wait(host,'roomStatus',m=>m.status.ready.length===2);
  send(guest,{t:'startMatch',advanceOperation:true});expect((await wait(guest,'roomError')).message).toContain('host');
  send(host,{t:'startMatch',advanceOperation:true});const next=await wait(host,'roundLaunched');expect(next.roomId).toBe(id);expect(next.config.operationId).toBe('relay_siege');expect(next.mapId).toBe('compound');
  const reset=await wait(guest,'snapshot',m=>m.operation?.missionId==='relay_siege'&&m.operation.status==='active');expect(reset.operation!.stage).toBe(0);expect(reset.players.filter(p=>!p.isBot)).toHaveLength(2);expect(reset.players.every(p=>p.kills===0&&p.deaths===0)).toBe(true);
  await wait(host,'matchEnd');await wait(guest,'matchEnd');send(host,{t:'readyNextRound'});send(guest,{t:'readyNextRound'});await wait(host,'roomStatus',m=>m.status.phase==='ended'&&m.status.room.operationId==='relay_siege'&&m.status.ready.length===2);
  send(host,{t:'startMatch'});const replay=await wait(host,'roundLaunched');expect(replay.roomId).toBe(id);expect(replay.config.operationId).toBe('relay_siege');
  const quick=await connect();send(quick,{t:'quickPlay',playerKey:quick.id!,name:'Quick',loadout,mode:'survival'});const publicRoom=await wait(quick,'roomJoined');expect(publicRoom.matchId).not.toBe(id);expect(publicRoom.config.operationId).toBeUndefined();
 }finally{clients.forEach(s=>s.disconnect());server.kill();await server.exited;await rm(dir,{recursive:true,force:true});}
},90000);
