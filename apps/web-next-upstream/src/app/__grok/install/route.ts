import { renderInstallPageHtml } from "../../../../scripts/grok-pwa-shared.mjs";
import { installPageTemplate } from "@/lib/pwa/install-page";

function requestHost(request: Request) {
  return (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = requestHost(request);

  return new Response(
    renderInstallPageHtml(installPageTemplate, {
      host,
      url: url.toString(),
    }),
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
