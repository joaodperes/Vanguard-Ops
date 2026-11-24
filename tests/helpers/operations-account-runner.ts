import {strict as assert} from 'node:assert';
import {NextRequest} from 'next/server';
import {db} from '../../src/lib/db';
import {buildProfileView,getOrCreatePlayer} from '../../src/lib/player-service';
import {createSessionToken,SESSION_COOKIE} from '../../src/lib/auth';
import {GET,POST} from '../../src/app/api/operations/progress/route';
import {createOperationState,OPERATIONS} from '../../src/lib/operations';
import {MAX_PLAYER_LEVEL,totalXpForLevel} from '../../src/lib/progression';
const a=await getOrCreatePlayer('account-a'),b=await getOrCreatePlayer('account-b');
await db.user.create({data:{email:'operations-test@example.invalid',passwordHash:'test-only',playerId:a.id}});
const cookie=`${SESSION_COOKIE}=${createSessionToken(a.id)}`;
function request(body:unknown,auth=true){return new NextRequest('http://localhost/api/operations/progress',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{cookie}:{})},body:JSON.stringify(body)});}
const read=(key:string,auth=true)=>GET(new NextRequest('http://localhost/api/operations/progress?playerKey='+key,{headers:auth?{cookie}:{}}));
const won={...createOperationState(OPERATIONS[0].id,'veteran'),status:'won',stage:OPERATIONS[0].objectives.length,intel:true,elapsed:123};
const payload={kind:'complete',playerKey:b.playerKey,runId:'completion_test_0001',state:won,deaths:0};
try{
 const legacy=await db.player.findUniqueOrThrow({where:{id:'legacy-operations'}});assert.equal(legacy.operationsProgress,'{}');assert.equal(legacy.xp,1234);assert.equal(legacy.credits,5678);
 const firstResponse=await POST(request(payload));assert.equal(firstResponse.status,200);const firstBody=await firstResponse.json();assert.deepEqual(firstBody.firstClearRewards,[{missionId:'silent_entry',xp:150,credits:75}]);
 // A new request/browser with the account cookie sees its stored progress;
 // a forged body/query key never redirects account writes to another player.
 const records=await (await read(b.playerKey)).json();assert.equal(records.silent_entry.stars,3);
 assert.equal((await db.player.findUniqueOrThrow({where:{id:b.id}})).operationsProgress,'{}');
 const duplicateResponse=await POST(request(payload));const duplicateBody=await duplicateResponse.json();assert.deepEqual(duplicateBody.firstClearRewards,[{missionId:'silent_entry',xp:150,credits:75}]);assert.equal((await (await read(a.playerKey)).json()).silent_entry.completions,1);
 const replayResponse=await POST(request({...payload,runId:'completion_test_0002'}));assert.deepEqual((await replayResponse.json()).firstClearRewards,[]);
 const imported={silent_entry:{stars:2,bestSeconds:200,intel:false,completions:4}};
 await POST(request({kind:'import',progress:imported}));await POST(request({kind:'import',progress:imported}));
 const merged=await (await read(a.playerKey)).json();assert.deepEqual(merged.silent_entry,{stars:3,bestSeconds:123,intel:true,completions:4,firstClearRewarded:true,firstClearRunId:'completion_test_0001',firstClearXp:150,firstClearCredits:75});
 assert.equal((await read(a.playerKey,false)).status,401);assert.equal((await POST(request({...payload,playerKey:a.playerKey},false))).status,401);
 assert.equal((await POST(request({...payload,runId:'completion_test_0002',state:{...won,elapsed:NaN}}))).status,400);
 assert.equal((await POST(request({...payload,runId:'deadline_test_0001',state:{...won,elapsed:1801}}))).status,400);
 assert.equal((await POST(request({kind:'complete',playerKey:b.playerKey,runId:'guest_completion_01',state:won,deaths:1},false))).status,200);
 assert.equal((await (await read(b.playerKey,false)).json()).silent_entry.stars,2);
 const career=await db.player.findUniqueOrThrow({where:{id:a.id}});assert.equal(career.xp,a.xp+150);assert.equal(career.credits,a.credits+75);assert.equal(career.careerXp,a.careerXp);assert.equal(career.survivalBestWave,a.survivalBestWave);
 const guest=await db.player.findUniqueOrThrow({where:{id:b.id}});assert.equal(guest.xp,b.xp+150);assert.equal(guest.credits,b.credits+75);
 const capPlayer=await getOrCreatePlayer('operations-career-cap'),capXp=totalXpForLevel(MAX_PLAYER_LEVEL);
 await db.player.update({where:{id:capPlayer.id},data:{xp:capXp,level:MAX_PLAYER_LEVEL}});
 const capAward=await POST(request({...payload,playerKey:capPlayer.playerKey,runId:'career_cap_test_0001'},false));assert.equal(capAward.status,200);
 const capped=await db.player.findUniqueOrThrow({where:{id:capPlayer.id}});assert.equal(capped.xp,capXp+150);assert.equal(capped.careerXp,150);assert.equal(capped.credits,capPlayer.credits+75);
 // Act finale rewards are permanent account entitlements, independent of stars.
 const act1=await getOrCreatePlayer('operations-act1-reward');
 const act1State={...createOperationState('cold_trail','normal'),status:'won',stage:OPERATIONS.find(m=>m.id==='cold_trail')!.objectives.length,intel:false,elapsed:300};
 const act1Response=await POST(request({kind:'complete',playerKey:act1.playerKey,runId:'act1_reward_test_0001',state:act1State,deaths:4},false));
 assert.deepEqual((await act1Response.json()).actRewards.map((r:any)=>r.id),['act1_wonder_weapon_perk']);
 const act1Fresh=await db.player.findUniqueOrThrow({where:{id:act1.id}});
 assert.deepEqual(JSON.parse(act1Fresh.operationsActRewards),['act1_wonder_weapon_perk']);
 assert.deepEqual((await buildProfileView(act1.playerKey))?.unlocks.perks,['wonder_weapon']);
 const act2=await getOrCreatePlayer('operations-act2-reward');
 const act2State={...createOperationState('relay_siege','normal'),status:'won',stage:OPERATIONS.find(m=>m.id==='relay_siege')!.objectives.length,elapsed:300};
 const act2Response=await POST(request({kind:'complete',playerKey:act2.playerKey,runId:'act2_reward_test_0001',state:act2State,deaths:0},false));
 assert.deepEqual((await act2Response.json()).actRewards.map((r:any)=>r.id),['act2_pistol_arc']);
 assert.ok(await db.weaponUnlock.findUnique({where:{playerId_weaponId:{playerId:act2.id,weaponId:'pistol_arc'}}}));
 const act3=await getOrCreatePlayer('operations-act3-reward');
 const act3State={...createOperationState('zero_hour','normal'),status:'won',stage:OPERATIONS.find(m=>m.id==='zero_hour')!.objectives.length,elapsed:300};
 const act3Response=await POST(request({kind:'complete',playerKey:act3.playerKey,runId:'act3_reward_test_0001',state:act3State,deaths:0},false));
 assert.deepEqual((await act3Response.json()).actRewards.map((r:any)=>r.id),['act3_juggernaut_mk1']);
 assert.ok(await db.wonderUnlock.findUnique({where:{playerId_weaponId:{playerId:act3.id,weaponId:'wonder_juggernaut'}}}));
 const act3Replay=await POST(request({kind:'complete',playerKey:act3.playerKey,runId:'act3_reward_test_0002',state:act3State,deaths:0},false));
 assert.deepEqual((await act3Replay.json()).actRewards,[]);
 // Existing server-verified finale records receive their missing reward on read.
 const legacyAct=await getOrCreatePlayer('operations-legacy-act-reward');
 await db.player.update({where:{id:legacyAct.id},data:{operationsProgress:JSON.stringify({cold_trail:{stars:1,bestSeconds:300,intel:false,completions:1,firstClearRewarded:true,firstClearRunId:'legacy_act1_run_001',firstClearXp:200,firstClearCredits:100}})}});
 await read(legacyAct.playerKey,false);
 const legacyActFresh=await db.player.findUniqueOrThrow({where:{id:legacyAct.id}});
 assert.deepEqual(JSON.parse(legacyActFresh.operationsActRewards),['act1_wonder_weapon_perk']);
 console.log('Operations account persistence passed');
}finally{await db.$disconnect();}
