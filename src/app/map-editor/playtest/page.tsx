import dynamic from "next/dynamic";
const MapDraftPlaytest=dynamic(()=>import("./MapDraftPlaytest"),{ssr:false,loading:()=>null});
export default function MapStudioPlaytestPage(){return <MapDraftPlaytest/>;}
