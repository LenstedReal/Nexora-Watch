/**
 * Fetch-Metadata sibling isolation — server-only.
 *
 * Apps deployed on *.grok.me are "same-site" to each other but MUTUALLY
 * UNTRUSTED. A SameSite=Lax session cookie can still be sent on same-site
 * scripted requests, so we explicitly reject cross-site/sibling scripted
 * requests.
 *
 * The Request is passed explicitly by Next.js Route Handlers/server code.
 */
export class CrossSiteRequestError extends Error {
  readonly status = 403;

  constructor() {
    super("Forbidden: cross-site request blocked");
    this.name = "CrossSiteRequestError";
  }
}

/** Throw CrossSiteRequestError for a scripted cross-site/sibling request. */
export function assertSameSiteRequest(request?: Request): void {
  if (!request) return;

  const h = request.headers;
  const site = h.get("sec-fetch-site");

  // Non-browser client, same-origin request, or direct navigation.
  if (!site || site === "same-origin" || site === "none") return;

  // Top-level GET navigation (OAuth callback / normal page load).
  const dest = h.get("sec-fetch-dest");
  const isTopLevelGet =
    h.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET" &&
    dest !== "object" &&
    dest !== "embed";

  if (isTopLevelGet) return;

  throw new CrossSiteRequestError();
}
