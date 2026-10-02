import { renderWebManifest } from "../../../../scripts/grok-pwa-shared.mjs";

function requestHost(request: Request) {
  return (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host
  );
}

export async function GET(request: Request) {
  return new Response(renderWebManifest(requestHost(request)), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
