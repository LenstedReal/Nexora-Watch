export const DEFAULT_WEB_URL =
  "https://www.google.com/search?igu=1&hl=tr";

const MAX_WEB_URL = 2000;

function googleSearchUrl(query: string): string {
  const url = new URL(DEFAULT_WEB_URL);
  url.searchParams.set("q", query.slice(0, 500));
  url.searchParams.set("igu", "1");
  url.searchParams.set("hl", "tr");
  return url.toString();
}

export function normalizeWebUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) return DEFAULT_WEB_URL;

  const looksLikeUrl =
    /^(https?:\/\/)/i.test(trimmed) ||
    /^www\./i.test(trimmed) ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#]|$)/i.test(trimmed);

  if (!looksLikeUrl) {
    return googleSearchUrl(trimmed);
  }

  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProto);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return googleSearchUrl(trimmed);
    }

    const host = url.hostname.toLowerCase();

    if (host === "google.com" || host.endsWith(".google.com") || host.includes("google.")) {
      url.searchParams.set("igu", "1");
      if (!url.searchParams.get("hl")) {
        url.searchParams.set("hl", "tr");
      }
    }

    return url.toString().slice(0, MAX_WEB_URL);
  } catch {
    return googleSearchUrl(trimmed);
  }
}

export function webQueryFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host.includes("google.")
    ) {
      return parsed.searchParams.get("q") || "";
    }

    return url;
  } catch {
    return url;
  }
}
