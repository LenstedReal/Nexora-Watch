import { NextResponse } from "next/server";
import { isConnectorTokenReady } from "@/lib/app-data/client.server";

export async function POST(request: Request) {
  return NextResponse.json({
    ready: isConnectorTokenReady(request),
  });
}
