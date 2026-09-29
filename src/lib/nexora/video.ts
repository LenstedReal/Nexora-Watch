export type VideoKind =
  | "youtube"
  | "drive"
  | "direct"
  | "hls"
  | "embed"
  | "web";

export type ResolveMethod =
  | "provider"
  | "direct"
  | "html-media"
  | "player-config"
  | "embed"
  | "fallback";

export type ResolvedVideo = {
  url: string;
  kind: VideoKind;
  video_id: string | null;
  embed_url: string | null;
  stream_url: string | null;
  title: string;
  mime_type: string | null;
  provider: string;
  confidence: number;
  method: ResolveMethod;
};

type Candidate = {
  url?: string | null;
  embed_url?: string | null;
  kind: VideoKind;
  provider: string;
  title: string;
  mime_type?: string | null;
  confidence: number;
  method: ResolveMethod;
};

const DIRECT_EXTENSIONS =
  /\.(mp4|webm|mov|m4v)(?:$|[?#])/i;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function blocked(url: URL): boolean {
  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;

  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return true;
  }

  const private172 = host.match(/^172\.(\d+)\./);

  if (private172) {
    const second = Number(private172[1]);

    if (second >= 16 && second <= 31) {
      return true;
    }
  }

  return false;
}

function absolute(value: string, base: URL): string | null {
  let cleaned = value
    .trim()
    .replace(/^['"`]|['"`]$/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003F/gi, "?")
    .replace(/\\\//g, "/");

  if (!cleaned) return null;

  try {
    const url = new URL(cleaned, base);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();

  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    return url.pathname.replace(/^\/+/, "").split("/")[0] || null;
  }

  if (
    host === "youtube.com" ||
    host.endsWith(".youtube.com")
  ) {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    const match = url.pathname.match(
      /^\/(?:embed|shorts|live)\/([^/?#]+)/,
    );

    return match?.[1] ?? null;
  }

  return null;
}

function driveId(url: URL): string | null {
  // /file/d/VIDEO_ID/view
  const fileMatch = url.pathname.match(
    /\/file\/d\/([^/]+)/i,
  );

  if (fileMatch?.[1]) {
    return decodeURIComponent(fileMatch[1]);
  }

  // /open?id=VIDEO_ID
  // /uc?id=VIDEO_ID
  // ?id=VIDEO_ID
  const queryId = url.searchParams.get("id");

  if (queryId) {
    return queryId;
  }

  // Bazı Drive bağlantılarında resourcekey vb. parametrelerle
  // birlikte gelen file ID.
  const pathParts = url.pathname.split("/").filter(Boolean);

  for (const part of pathParts) {
    if (/^[A-Za-z0-9_-]{20,}$/.test(part)) {
      return part;
    }
  }

  return null;
}

function directMime(url: URL): string | null {
  const path = url.pathname.toLowerCase();

  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".m4v")) return "video/x-m4v";

  return null;
}

function isHls(url: URL): boolean {
  return (
    url.pathname.toLowerCase().endsWith(".m3u8") ||
    url.searchParams.get("format")?.toLowerCase() === "m3u8" ||
    url.searchParams.get("type")?.toLowerCase() === "m3u8"
  );
}

function mediaKind(
  value: string,
): "direct" | "hls" | null {
  const url = parseUrl(value);

  if (!url) return null;

  if (isHls(url)) {
    return "hls";
  }

  if (DIRECT_EXTENSIONS.test(url.pathname)) {
    return "direct";
  }

  return null;
}

function pageTitle(
  html: string,
  fallback: string,
): string {
  const title = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  )?.[1];

  if (!title) return fallback;

  return title
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300) || fallback;
}

function pushUnique(
  list: string[],
  value: string | null,
) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

/*
 * Generic media discovery.
 *
 * This deliberately does not depend on one website.
 * It understands common HTML/player conventions:
 *
 * <video src="">
 * <source src="">
 * data-src
 * data-video
 * data-file
 * data-stream
 * data-url
 * JWPlayer
 * Video.js
 * Plyr
 * generic source/file/url/stream objects
 * escaped JSON URLs
 * iframe/embed/player URLs
 */
function discoverMedia(
  html: string,
  pageUrl: URL,
): string[] {
  const found: string[] = [];

  const add = (raw?: string) => {
    if (!raw) return;

    const value = absolute(raw, pageUrl);

    if (!value) return;

    if (mediaKind(value)) {
      pushUnique(found, value);
    }
  };

  const patterns = [
    /<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
    /<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,

    /\bdata-(?:src|video|file|stream|url)\s*=\s*["']([^"']+)["']/gi,

    /(?:["'`](?:src|file|source|stream|url)["'`])\s*:\s*["'`](https?:\/\/[^"'`\\]+)["'`]/gi,

    /(?:src|file|source|stream|url)\s*[:=]\s*["'`](https?:\/\/[^"'`\\]+)["'`]/gi,

    /https?:\\\/\\\/[^"'`\s]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\\u0026[^"'`\s]+)*/gi,

    /https?:\/\/[^"'`\s<>]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\?[^"'`\s<>]*)?/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      add(match[1] ?? match[0]);
    }
  }

  return found;
}

function discoverEmbeds(
  html: string,
  pageUrl: URL,
): string[] {
  const found: string[] = [];

  const add = (raw?: string) => {
    if (!raw) return;

    const value = absolute(raw, pageUrl);

    if (!value || found.includes(value)) {
      return;
    }

    found.push(value);
  };

  const patterns = [
    /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,

    /<embed\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,

    /(?:embedUrl|embed_url|playerUrl|player_url)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi,

    /(?:iframe|embed)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      add(match[1]);
    }
  }

  return found;
}

async function fetchPage(
  url: URL,
): Promise<{
  html: string;
  finalUrl: URL;
  contentType: string;
}> {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    8000,
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Web sayfası ${response.status} döndürdü`,
      );
    }

    const finalUrl = new URL(
      response.url || url.toString(),
    );

    if (blocked(finalUrl)) {
      const error = new Error("Yönlendirilen adres engellendi");
      error.name = "BlockedWebTargetError";
      throw error;
    }

    return {
      html: await response.text(),
      finalUrl,
      contentType:
        response.headers.get("content-type") ?? "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function localMediaResolve(input: string): ResolvedVideo | null {
  const trimmed = input.trim();
  let path = trimmed;

  try {
    const parsed = new URL(trimmed, "https://nexora.local");
    if (parsed.pathname.startsWith("/api/media/")) {
      path = parsed.pathname;
    }
  } catch {
    // keep original
  }

  if (/^\/api\/media\/[A-Za-z0-9._-]+$/.test(path)) {
    const name = path.split("/").pop() || "video";
    return {
      url: path,
      kind: "direct",
      video_id: null,
      embed_url: null,
      stream_url: path,
      title: name,
      mime_type: name.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4",
      provider: "nexora",
      confidence: 1,
      method: "direct",
    };
  }

  const url = parseUrl(input);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  if (host.endsWith("vercel-storage.com") || host.endsWith("blob.vercel-storage.com")) {
    return {
      url: input,
      kind: "direct",
      video_id: null,
      embed_url: null,
      stream_url: input,
      title: url.pathname.split("/").pop() || "video",
      mime_type: null,
      provider: "blob",
      confidence: 1,
      method: "direct",
    };
  }

  return null;
}

function providerResolve(
  input: string,
): ResolvedVideo | null {
  const url = parseUrl(input);

  if (!url) {
    throw new Error("Geçersiz video adresi");
  }

  const youtube = youtubeId(url);

  if (youtube) {
    return {
      url: input,
      kind: "youtube",
      video_id: youtube,
      embed_url:
        `https://www.youtube.com/embed/${encodeURIComponent(youtube)}`,
      stream_url: null,
      title: input,
      mime_type: null,
      provider: "youtube",
      confidence: 1,
      method: "provider",
    };
  }

  const host = url.hostname.toLowerCase();

  const drive =
    host === "drive.google.com" ||
    host.endsWith(".drive.google.com") ||
    host === "docs.google.com" ||
    host.endsWith(".docs.google.com");

  if (drive) {
    const id = driveId(url);

    if (!id) {
      return null;
    }

    return {
      url: input,
      kind: "drive",
      video_id: id,
      embed_url:
        `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`,
      // Önce kendi proxy endpoint'imizi dene.
      // Proxy Range/Content-Range aktararak native video player'ın
      // seek/stream davranışını mümkün olduğunca korur.
      stream_url:
        `/api/drive/${encodeURIComponent(id)}`,
      title: input,
      mime_type: null,
      provider: "google-drive",
      confidence: 1,
      method: "provider",
    };
  }

  return null;
}

function directResolve(
  input: string,
): ResolvedVideo | null {
  const url = parseUrl(input);

  if (!url) return null;

  if (isHls(url)) {
    return {
      url: input,
      kind: "hls",
      video_id: null,
      embed_url: null,
      stream_url: input,
      title:
        url.pathname.split("/").pop() ||
        url.hostname,
      mime_type:
        "application/vnd.apple.mpegurl",
      provider: url.hostname,
      confidence: 1,
      method: "direct",
    };
  }

  if (DIRECT_EXTENSIONS.test(url.pathname)) {
    return {
      url: input,
      kind: "direct",
      video_id: null,
      embed_url: null,
      stream_url: input,
      title:
        url.pathname.split("/").pop() ||
        url.hostname,
      mime_type: directMime(url),
      provider: url.hostname,
      confidence: 1,
      method: "direct",
    };
  }

  return null;
}

async function discoverScriptMedia(
  html: string,
  pageUrl: URL,
  title: string,
): Promise<Candidate[]> {
  const scripts: string[] = [];

  for (const match of html.matchAll(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
  )) {
    const src = absolute(match[1], pageUrl);

    if (!src) continue;

    const scriptUrl = parseUrl(src);

    if (!scriptUrl) continue;

    /*
     * Player JS'i sayfanın kendi hostundan almaya devam ediyoruz.
     */
    const sameHost =
      scriptUrl.hostname === pageUrl.hostname ||
      scriptUrl.hostname.endsWith(
        `.${pageUrl.hostname}`,
      );

    if (!sameHost) {
      continue;
    }

    if (blocked(scriptUrl)) {
      continue;
    }

    if (!scripts.includes(src)) {
      scripts.push(src);
    }

    if (scripts.length >= 8) {
      break;
    }
  }

  const candidates: Candidate[] = [];

  for (const script of scripts) {
    const scriptUrl = parseUrl(script);

    if (!scriptUrl) continue;

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      5000,
    );

    try {
      const response = await fetch(scriptUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept:
            "application/javascript,text/javascript,*/*;q=0.5",
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
        },
      });

      if (!response.ok) {
        continue;
      }

      const finalUrl = new URL(
        response.url || scriptUrl.toString(),
      );

      const sameHost =
        finalUrl.hostname === pageUrl.hostname ||
        finalUrl.hostname.endsWith(
          `.${pageUrl.hostname}`,
        );

      if (!sameHost) {
        continue;
      }

      const js = await response.text();

      /*
       * Büyük bundle'ların resolver'ı kilitlemesini önlüyoruz
       * ama 500 KB yerine biraz daha geniş tarıyoruz.
       */
      const source = js.slice(0, 750_000);

      const found: string[] = [];

      const decodeJsUrl = (raw: string) =>
        raw
          .replace(/\\u002f/gi, "/")
          .replace(/\\u0026/gi, "&")
          .replace(/\\u003f/gi, "?")
          .replace(/\\u003d/gi, "=")
          .replace(/\\u002e/gi, ".")
          .replace(/\\\//g, "/")
          .replace(/&amp;/gi, "&")
          .replace(/&quot;/gi, '"')
          .replace(/&#x2f;/gi, "/")
          .trim();

      const add = (raw?: string) => {
        if (!raw) return;

        const decoded = decodeJsUrl(raw);

        const value = absolute(
          decoded,
          finalUrl,
        );

        if (!value) return;

        const media = mediaKind(value);

        if (!media) return;

        pushUnique(found, value);
      };

      const patterns = [
        /*
         * Normal / escaped direct media URL.
         */
        /(?:https?:)?\\\/\\\/[^"'`\s<>]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\\u0026[^"'`\s<>]*)?/gi,

        /(?:https?:\/\/[^"'`\s<>]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\?[^"'`\s<>]*)?)/gi,

        /*
         * Player config / JSON config.
         */
        /["']?(?:file|source|src|stream|url|videoUrl|video_url|hls|hlsUrl|hls_url|manifest|playlist|mp4Url|videoFile|media|mediaUrl)["']?\s*[:=]\s*["'`](https?:\/\/[^"'`]+)["'`]/gi,

        /["']?(?:file|source|src|stream|url|videoUrl|video_url|hls|hlsUrl|hls_url|manifest|playlist|mp4Url|videoFile|media|mediaUrl)["']?\s*[:=]\s*["'`](\/[^"'`]+)["'`]/gi,

        /*
         * Protocol-relative / escaped protocol-relative.
         */
        /["'`](\/\/[^"'`]+\.(?:m3u8|mp4|webm|m4v|mov)(?:\?[^"'`]*)?)["'`]/gi,

        /["'`](\\\/\\\/[^"'`]+\.(?:m3u8|mp4|webm|m4v|mov)(?:\\u0026[^"'`]*)?)["'`]/gi,
      ];

      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
          add(match[1] ?? match[0]);
        }
      }

      for (const media of found) {
        const kind = mediaKind(media);

        if (!kind) {
          continue;
        }

        const mediaUrl = new URL(media);

        candidates.push({
          url: media,
          kind:
            kind === "hls"
              ? "hls"
              : "direct",
          provider: pageUrl.hostname,
          title,
          mime_type:
            kind === "hls"
              ? "application/vnd.apple.mpegurl"
              : directMime(mediaUrl),
          confidence:
            kind === "hls"
              ? 0.97
              : 0.96,
          method: "player-config",
        });
      }
    } catch {
      /*
       * Tek bir JS dosyası patlarsa diğer asset'lere devam.
       */
    } finally {
      clearTimeout(timeout);
    }
  }

  /*
   * KRİTİK:
   * Burada artık URL'de "player/video/embed/watch" kelimesi
   * var mı diye gerçek medya adaylarını çöpe atmıyoruz.
   */
  return candidates;
}

function candidateToResolved(
  candidate: Candidate,
  sourceUrl: string,
): ResolvedVideo {
  const stream = candidate.url ?? null;

  return {
    url: sourceUrl,
    kind: candidate.kind,
    video_id: null,
    embed_url: candidate.embed_url ?? null,
    stream_url: stream,
    title: candidate.title,
    mime_type: candidate.mime_type ?? null,
    provider: candidate.provider,
    confidence: candidate.confidence,
    method: candidate.method,
  };
}

function chooseCandidate(
  candidates: Candidate[],
): Candidate | null {
  if (!candidates.length) {
    return null;
  }

  return [...candidates].sort(
    (a, b) => b.confidence - a.confidence,
  )[0];
}

export async function resolveVideoSource(
  input: string,
): Promise<ResolvedVideo> {
  const raw = input.trim();

  if (!raw) {
    throw new Error("Video adresi boş");
  }

  const local = localMediaResolve(raw);
  if (local) return local;

  const provider = providerResolve(raw);

  if (provider) {
    return provider;
  }

  const direct = directResolve(raw);

  if (direct) {
    return direct;
  }

  const pageUrl = parseUrl(raw);

  if (!pageUrl || !/^https?:$/.test(pageUrl.protocol)) {
    throw new Error("Geçersiz web adresi");
  }

  if (blocked(pageUrl)) {
    throw new Error("Bu web adresine erişilemez");
  }

  let response:
    | Awaited<ReturnType<typeof fetchPage>>
    | null = null;

  try {
    response = await fetchPage(pageUrl);
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "BlockedWebTargetError"
    ) {
      throw error;
    }
    throw new Error(
      "Bu adreste oynatılabilir video bulunamadı",
    );
  }

  if (!response) {
    throw new Error("Web sayfası çözümlenemedi");
  }

  /*
   * If the supplied URL itself resolves to a media response,
   * treat it as a direct source.
   */
  if (
    !response.contentType.includes("text/html")
  ) {
    const finalKind = mediaKind(
      response.finalUrl.toString(),
    );

    if (finalKind) {
      return {
        url: raw,
        kind:
          finalKind === "hls"
            ? "hls"
            : "direct",
        video_id: null,
        embed_url: null,
        stream_url:
          response.finalUrl.toString(),
        title:
          response.finalUrl.pathname.split("/").pop() ||
          response.finalUrl.hostname,
        mime_type:
          finalKind === "hls"
            ? "application/vnd.apple.mpegurl"
            : directMime(response.finalUrl),
        provider: response.finalUrl.hostname,
        confidence: 0.99,
        method: "direct",
      };
    }
  }

  const title = pageTitle(
    response.html,
    response.finalUrl.hostname,
  );

  const candidates: Candidate[] = [];

  /*
   * Layer 1:
   * Real HTML media elements.
   */
  for (const media of discoverMedia(
    response.html,
    response.finalUrl,
  )) {
    const kind = mediaKind(media);

    if (!kind) continue;

    const mediaUrl = new URL(media);

    candidates.push({
      url: media,
      kind:
        kind === "hls"
          ? "hls"
          : "direct",
      provider: response.finalUrl.hostname,
      title,
      mime_type:
        kind === "hls"
          ? "application/vnd.apple.mpegurl"
          : directMime(mediaUrl),
      confidence:
        kind === "hls"
          ? 0.98
          : 0.97,
      method: "html-media",
    });
  }

  /*
   * Layer 2:
   * Common player configuration / JSON.
   */
  for (const media of discoverMedia(
    response.html,
    response.finalUrl,
  )) {
    const kind = mediaKind(media);

    if (!kind) continue;

    const mediaUrl = new URL(media);

    candidates.push({
      url: media,
      kind:
        kind === "hls"
          ? "hls"
          : "direct",
      provider: response.finalUrl.hostname,
      title,
      mime_type:
        kind === "hls"
          ? "application/vnd.apple.mpegurl"
          : directMime(mediaUrl),
      confidence:
        kind === "hls"
          ? 0.94
          : 0.93,
      method: "player-config",
    });
  }

  /*
   * Layer 3:
   * Standard iframe/embed player.
   */
  for (const embed of discoverEmbeds(
    response.html,
    response.finalUrl,
  )) {
    candidates.push({
      embed_url: embed,
      kind: "embed",
      provider:
        parseUrl(embed)?.hostname ??
        response.finalUrl.hostname,
      title,
      confidence: 0.78,
      method: "embed",
    });
  }

  /*
   * Sayfa statik HTML'de kaynak göstermiyorsa,
   * aynı-origin player JS dosyalarını tara.
   */
  const scriptCandidates = await discoverScriptMedia(
    response.html,
    response.finalUrl,
    title,
  );

  candidates.push(...scriptCandidates);

  const best = chooseCandidate(candidates);

  if (best) {
    return candidateToResolved(
      best,
      raw,
    );
  }


  /*
   * Arbitrary webpages are NOT video sources.
   *
   * Web is a separate browser feature whose starting page is Google.
   * Keep real video sources above intact: YouTube, Drive, direct,
   * HLS and supported embeds.
   */
  throw new Error(
    "Bu adres bir video kaynağı değil. Web özelliği Google üzerinden açılır.",
  );
}

export async function extractWebVideo(
  input: string,
): Promise<ResolvedVideo> {
  return resolveVideoSource(input);
}
