import {NextRequest,NextResponse} from 'next/server';
import {resolvePlayerKey} from '@/lib/auth';
import {db} from '@/lib/db';
import {operationById,normalizeOperationProgress,type OperationState} from '@/lib/operations';
import {readOperationProgress,writeOperationProgress} from '@/lib/operations-progress';
export const dynamic='force-dynamic';
async function identity(req:NextRequest,key?:string){
 const {playerKey,session}=await resolvePlayerKey(req,key);
 if(!playerKey||typeof playerKey!=='string'||playerKey.length>128)return null;
 // Guest IDs remain supported, but account-owned progress requires its session.
 if(!session){const player=await db.player.findUnique({where:{playerKey},select:{user:{select:{id:true}}}});if(player?.user)return null;}
 return playerKey;
}
export async function GET(req:NextRequest){
 const key=await identity(req,req.nextUrl.searchParams.get('playerKey')??undefined);
 if(!key)return NextResponse.json({error:'Player session required'},{status:401});
 return NextResponse.json(await readOperationProgress(key));
}
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null);if(!body)return NextResponse.json({error:'Invalid request'},{status:400});
 const key=await identity(req,body.playerKey);if(!key)return NextResponse.json({error:'Player session required'},{status:401});
 if(body.kind==='import')return NextResponse.json(await writeOperationProgress(key,{progress:normalizeOperationProgress(body.progress)}));
 const s=body.state as OperationState,m=operationById(s?.missionId);
 if(body.kind!=='complete'||!m||s.status!=='won'||s.stage!==m.objectives.length||!Number.isFinite(s.elapsed)||s.elapsed<=0||s.elapsed>m.parSeconds*2||typeof s.intel!=='boolean'||!Number.isInteger(body.deaths)||body.deaths<0||body.deaths>1000||typeof body.runId!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(body.runId))return NextResponse.json({error:'Invalid campaign completion'},{status:400});
 return NextResponse.json(await writeOperationProgress(key,{runId:body.runId,state:s,deaths:body.deaths}));
}
