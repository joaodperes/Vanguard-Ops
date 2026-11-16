import {test,expect} from 'bun:test';
import {io,type Socket} from 'socket.io-client';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import type {C2S,S2C,LoadoutWire,CreateRoomConfig} from '../src/lib/game-protocol';
const loadout:LoadoutWire={weaponId:'rifle_ar',weaponSkinId:'default',playerSkinId:'default',attachments:{sight:null,barrel:null,grip:null,magazine:null}};

test('Operations rooms support a two-player co-op campaign and preserve mission difficulty',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vanguard-operations-coop-'));
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
 try{
  const host=await connect(),partner=await connect();
  const campaign:CreateRoomConfig={mode:'survival',operationId:'orbital_blackout',mapId:'orbital_nexus',teamSize:5,fillWithBots:false,password:null,botDifficulty:'veteran',survivalPlayers:2,survivalTier:'default'};
  send(host,{t:'createRoom',playerKey:host.id!,name:'Host',loadout,config:campaign});
  const joined=await wait(host,'roomJoined');
  expect(joined.config.operationId).toBe('orbital_blackout');
  send(host,{t:'listRooms'});
  const rooms=(await wait(host,'roomList')).rooms;
  expect(rooms.some(room=>room.id===joined.matchId&&room.operationId==='orbital_blackout'&&room.capacity===2)).toBe(true);
  send(partner,{t:'joinRoom',playerKey:partner.id!,name:'Partner',loadout,roomId:joined.matchId,password:null});
  const partnerJoined=await wait(partner,'roomJoined');
  expect(partnerJoined.matchId).toBe(joined.matchId);
  send(host,{t:'startMatch'});
  const snapshot=await wait(host,'snapshot',m=>!!m.operation);
  expect(snapshot.operation?.missionId).toBe('orbital_blackout');
  expect(snapshot.operation?.difficulty).toBe('veteran');
  expect(snapshot.players.filter(p=>!p.isBot)).toHaveLength(2);
 }finally{clients.forEach(s=>s.disconnect());server.kill();await server.exited;await rm(dir,{recursive:true,force:true});}
},60000);
