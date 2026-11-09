import { prestigeTokens } from "./weapon-prestige";
export interface WonderWallet {
 earned:number; unlocked:number; shopSpent:number; available:number;
}
export function calculateWonderWallet(awards:number,legacyCredits:number,unlocked:number,
 purchases:readonly {currency:string;cost:number}[]):WonderWallet{
 const earned=Math.max(0,awards+legacyCredits);
 const shopSpent=purchases.filter(p=>p.currency==="wonder").reduce((sum,p)=>sum+Math.max(0,p.cost),0);
 return {earned,unlocked,shopSpent,available:prestigeTokens(earned,unlocked+shopSpent)};
}
/** Caller must acquire a per-player write lock *before* reading these rows.
 * SQLite transactions serialize spenders, preventing duplicate token use. */
export async function lockedWonderWallet(tx:{
 wonderTokenAward:{count:(args:unknown)=>Promise<number>};
 wonderUnlock:{count:(args:unknown)=>Promise<number>};
 careerShopPurchase:{findMany:(args:unknown)=>Promise<{currency:string;cost:number}[]>};
 player:{findUniqueOrThrow:(args:unknown)=>Promise<{wonderLegacyCredits:number}>}
},playerId:string):Promise<WonderWallet>{
 const [awards,unlocked,purchases,player]=await Promise.all([
  tx.wonderTokenAward.count({where:{playerId}}),
  tx.wonderUnlock.count({where:{playerId}}),
  tx.careerShopPurchase.findMany({where:{playerId,currency:"wonder"},select:{currency:true,cost:true}}),
  tx.player.findUniqueOrThrow({where:{id:playerId},select:{wonderLegacyCredits:true}})
 ]);
 return calculateWonderWallet(awards,player.wonderLegacyCredits,unlocked,purchases);
}
