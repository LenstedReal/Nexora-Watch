import { NextResponse } from "next/server";

function acceptsHtml(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

function isInstallQuery(url: URL) {
  const install = url.searchParams.get("install");
  const platform = url.searchParams.get("platform");
  return (
    (install === "1" || install === "true") &&
    platform === "ios"
  );
}

export function proxy(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Never rewrite the install page itself or framework/API/static requests.
  if (
    path === "/__grok/install" ||
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/__grok/manifest") ||
    /\.[^/]+$/.test(path)
  ) {
    return NextResponse.next();
  }

  if (!acceptsHtml(request) || !isInstallQuery(url)) {
    return NextResponse.next();
  }

  const target = new URL("/__grok/install", request.url);
  target.search = url.search;

  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ["/:path*"],
};
