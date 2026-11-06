import { handleNexoraBlobUpload } from "@/lib/nexora/blob-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleNexoraBlobUpload(request);
}
