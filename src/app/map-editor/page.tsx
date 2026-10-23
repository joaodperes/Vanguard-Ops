"use client";
import dynamic from "next/dynamic";

// Browser-only editor: prevent a stale client draft or dev hot-reload snapshot
// from hydrating against a different server-rendered map catalog.
const MapEditorClient=dynamic(()=>import("./MapEditorClient"),{
  ssr:false,
  loading:()=> <main className="min-h-screen bg-[#090b10] p-8 text-zinc-200">Loading Map Studio…</main>,
});
export default function MapEditorPage(){return <MapEditorClient/>;}
