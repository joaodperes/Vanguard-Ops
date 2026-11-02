import {NextResponse} from "next/server";
import {dailyShopRotation} from "@/lib/shop-rotation";

export const dynamic="force-dynamic";
export function GET(){
  return NextResponse.json(dailyShopRotation(),{
    headers:{"Cache-Control":"no-store, max-age=0"}
  });
}
