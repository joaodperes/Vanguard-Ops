"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {GameCanvas} from "@/components/game/GameCanvas";
import {compileMapStudioDraft,type MapDef,type MapId,type LoadoutWire} from "@/lib/game-protocol";
import type {MapBlueprint} from "@/lib/map-blueprints";
import type {MapVisualTheme} from "@/lib/map-visuals";
import {WEAPONS,WEAPON_SKINS,PLAYER_SKINS,isPrimaryWeaponCategory} from "@/lib/game-data";

type Draft={mapId:string;blueprint:MapBlueprint;theme:MapVisualTheme};
const STORAGE_KEY="vanguard-map-studio-playtest-v1";

export default function MapDraftPlaytest(){
  const [preview,setPreview]=useState<{map:MapDef;mapId:MapId}|null>(null);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    try{
      const raw=sessionStorage.getItem(STORAGE_KEY);
      if(!raw)throw Error("No draft was sent from Map Studio.");
      const draft=JSON.parse(raw) as Draft;
      if(!draft.mapId||!draft.blueprint?.regions?.length||!draft.blueprint.spawns||
          !draft.theme?.palette)throw Error("The draft is missing a map, regions, spawns or visual theme.");
      const map=compileMapStudioDraft(draft.mapId,draft.blueprint,draft.theme);
      setPreview({map,mapId:draft.mapId as MapId});
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  },[]);
  const primary=WEAPONS.find(w=>isPrimaryWeaponCategory(w.category))??WEAPONS[0];
  const loadout:LoadoutWire={
    weaponId:primary?.id??"rifle_assault",weaponSkinId:WEAPON_SKINS[0]?.id??"default",
    playerSkinId:PLAYER_SKINS[0]?.id??"default",
    attachments:{sight:null,barrel:null,grip:null,magazine:null},
  };
  const exit=()=>{window.location.href="/map-editor";};
  if(error)return <main className="min-h-screen bg-zinc-950 text-white p-8">
    <h1 className="text-xl font-bold">Map playtest unavailable</h1>
    <p className="mt-3 text-amber-300">{error}</p>
    <Link className="underline mt-6 inline-block" href="/map-editor">Return to Map Studio</Link>
  </main>;
  if(!preview)return <main className="min-h-screen bg-zinc-950 p-8 text-white">Preparing local map preview…</main>;
  return <div className="fixed inset-0 bg-black">
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none bg-amber-500/85 text-black text-xs font-bold rounded px-3 py-1">
      LOCAL DRAFT PLAYTEST · Offline · No rewards or publishing
    </div>
    <GameCanvas key={preview.mapId} loadout={loadout} mode="ffa" botCount={0} botDifficulty="normal"
      online={false} previewMap={preview.map} mapId={preview.mapId} playerName="Map Creator"
      playerKey="map-studio-preview" scoreLimit={999} timeLimitMin={30}
      onMatchEnd={exit} onExit={exit}/>
  </div>;
}
