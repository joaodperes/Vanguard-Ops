import {strict as assert} from 'node:assert';
import {NextRequest} from 'next/server';
import {db} from '../../src/lib/db';
import {getOrCreatePlayer} from '../../src/lib/player-service';
import {createSessionToken,SESSION_COOKIE} from '../../src/lib/auth';
import {GET,POST} from '../../src/app/api/operations/progress/route';
import {createOperationState,OPERATIONS} from '../../src/lib/operations';
const a=await getOrCreatePlayer('account-a'),b=await getOrCreatePlayer('account-b');
await db.user.create({data:{email:'operations-test@example.invalid',passwordHash:'test-only',playerId:a.id}});
const cookie=`${SESSION_COOKIE}=${createSessionToken(a.id)}`;
function request(body:unknown,auth=true){return new NextRequest('http://localhost/api/operations/progress',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{cookie}:{})},body:JSON.stringify(body)});}
const read=(key:string,auth=true)=>GET(new NextRequest('http://localhost/api/operations/progress?playerKey='+key,{headers:auth?{cookie}:{}}));
const won={...createOperationState(OPERATIONS[0].id),status:'won',stage:OPERATIONS[0].objectives.length,intel:true,elapsed:123};
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
 console.log('Operations account persistence passed');
}finally{await db.$disconnect();}
