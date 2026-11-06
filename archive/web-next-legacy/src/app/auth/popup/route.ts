import { handleAuthPopupRequest } from "@/lib/auth/popup.server";

export async function GET(request: Request) {
  return handleAuthPopupRequest(request);
}
