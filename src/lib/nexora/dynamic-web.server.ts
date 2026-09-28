import { isIP } from "node:net";
import chromium from "@sparticuz/chromium-min";

export type DynamicWebResult = {
  kind: "direct" | "hls" | "embed" | "web";
  url: string;
  stream_url: string | null;
  embed_url: string | null;
  title: string;
  mime_type: string | null;
  provider: string;
  confidence: number;
  method: "direct" | "embed" | "fallback";
};

type MediaCandidate = {
  url: string;
  mime_type: string | null;
  score: number;
};

const CHROMIUM_VERSION = "153.0.0";

const DIRECT_MEDIA_RE =
  /\.(mp4|webm|m4v|mov)(?:$|[?#&])/i;

const HLS_RE =
  /\.m3u8(?:$|[?#&])/i;

const PLAYER_HINT_RE =
  /(?:embed|player|video|watch|stream|live|media|playback|hls)/i;

const MEDIA_MIME_RE =
  /^(?:video\/(?:mp4|webm|quicktime)|application\/(?:vnd\.apple\.mpegurl|x-mpegurl)|audio\/mpegurl)/i;

function isBlockedUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return true;
    }

    const hostname = url.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname === "localhost.localdomain" ||
      hostname === "metadata.google.internal" ||
      hostname === "metadata.google"
    ) {
      return true;
    }

    const ipVersion = isIP(hostname);

    if (ipVersion === 4) {
      const parts = hostname.split(".").map(Number);

      const [a, b] = parts;

      if (a === 127) return true;
      if (a === 10) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
    }

    if (ipVersion === 6) {
      const normalized = hostname.toLowerCase();

      if (normalized === "::1") return true;
      if (normalized.startsWith("fc")) return true;
      if (normalized.startsWith("fd")) return true;
      if (normalized.startsWith("fe8")) return true;
      if (normalized.startsWith("fe9")) return true;
      if (normalized.startsWith("fea")) return true;
      if (normalized.startsWith("feb")) return true;
    }

    if (hostname.endsWith(".localhost")) return true;
    if (hostname.endsWith(".local")) return true;

    return false;
  } catch {
    return true;
  }
}

function classifyMedia(
  url: string,
  mimeType: string | null,
  resourceType: string,
  pageHost: string,
): MediaCandidate | null {
  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  if (isBlockedUrl(url)) {
    return null;
  }

  const cleanMime =
    mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";

  let score = 0;

  if (HLS_RE.test(url)) {
    score = 120;
  } else if (DIRECT_MEDIA_RE.test(url)) {
    score = 110;
  } else if (MEDIA_MIME_RE.test(cleanMime)) {
    score = 100;
  } else if (resourceType === "media") {
    score = 75;
  }

  if (score === 0) {
    return null;
  }

  try {
    const hostname = new URL(url).hostname;

    if (hostname === pageHost) {
      score += 15;
    }

    if (PLAYER_HINT_RE.test(url)) {
      score += 5;
    }
  } catch {
    // URL zaten yukarıda doğrulandı.
  }

  return {
    url,
    mime_type: cleanMime || null,
    score,
  };
}

async function launchBrowser() {
  const isTermux =
    process.platform === "android" ||
    process.env.PREFIX?.includes("/com.termux/");

  /*
   * Android/Termux:
   * Playwright'ın kendi Chromium binary'sini çalıştırmaya çalışma.
   * Termux'taki native Chromium'a CDP üzerinden bağlan.
   *
   * ÖNEMLİ:
   * Playwright import'u Android'de yapılmıyor. Böylece
   * playwright-core'un "Unsupported platform: android"
   * hatası tamamen ortadan kalkıyor.
   */
  if (isTermux) {
    const endpoint =
      process.env.NEXORA_CDP_URL ||
      "http://127.0.0.1:9222";

    console.info(
      "[NEXORA][dynamic] Android Chromium CDP:",
      endpoint,
    );

    /*
     * Playwright'ın platform kontrolünü tetiklememek için
     * native CDP istemcisini kullanıyoruz.
     *
     * probePage mevcut browser/context/page API'sini kullandığı
     * için CDP bağlantısını Playwright'ın connectOverCDP API'si
     * üzerinden kuruyoruz; ancak import sırasında platformu
     * linux olarak görüyoruz.
     */
    const originalPlatform = process.platform;

    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "linux",
    });

    try {
      const { chromium: playwrightChromium } =
        await import("playwright-core");

      const browser =
        await playwrightChromium.connectOverCDP(
          endpoint,
          {
            timeout: 10000,
            isLocal: true,
          },
        );

      return {
        browser,
        connectedOverCdp: true,
      };
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
    }
  }

  const { chromium: playwrightChromium } =
    await import("playwright-core");

  const defaultPack =
    process.arch === "arm64"
      ? `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_VERSION}/chromium-v${CHROMIUM_VERSION}-pack.arm64.tar`
      : `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_VERSION}/chromium-v${CHROMIUM_VERSION}-pack.tar`;

  const packUrl =
    process.env.NEXORA_CHROMIUM_PACK_URL ||
    defaultPack;

  const executablePath =
    await chromium.executablePath(packUrl);

  const browser =
    await playwrightChromium.launch({
      args: [
        ...chromium.args,
        "--autoplay-policy=no-user-gesture-required",
        "--disable-dev-shm-usage",
      ],
      executablePath,
      headless: true,
    });

  return {
    browser,
    connectedOverCdp: false,
  };
}
async function probePage(
  browser: Awaited<ReturnType<typeof launchBrowser>>["browser"],
  targetUrl: string,
  userAgent: string,
  isMobile: boolean,
): Promise<DynamicWebResult | null> {
  const sourceUrl = new URL(targetUrl);

  if (isBlockedUrl(sourceUrl.toString())) {
    return null;
  }

  const existingContext =
    browser.contexts()[0];

  const ownsContext =
    !existingContext;

  const context =
    existingContext ??
    (await browser.newContext({
      userAgent,
      viewport: isMobile
        ? { width: 412, height: 915 }
        : { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile,
      hasTouch: isMobile,
      javaScriptEnabled: true,
    }));

  const mediaCandidates = new Map<string, MediaCandidate>();
  const observedVideoUrls = new Set<string>();
  const playerFrames = new Map<string, number>();
  const attachedPages = new Set<any>();
  const trackedPages = new Set<any>();

  let detectedStrongPlayer = false;
  let detectedAnyPlayer = false;
  let pageTitle = sourceUrl.hostname;

  const addMedia = (
    url: string,
    mimeType: string | null,
    resourceType: string,
  ) => {
    const candidate = classifyMedia(
      url,
      mimeType,
      resourceType,
      sourceUrl.hostname,
    );

    if (!candidate) {
      return;
    }

    let score = candidate.score;

    if (observedVideoUrls.has(candidate.url)) {
      score += 50;
    }

    const existing = mediaCandidates.get(candidate.url);

    if (!existing || score > existing.score) {
      mediaCandidates.set(candidate.url, {
        ...candidate,
        score,
      });
    }
  };

  const scanFrame = async (frame: any) => {
    try {
      const result = await frame.evaluate(() => {
        const isVisible = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
          );
        };

        const videos = Array.from(
          document.querySelectorAll<HTMLVideoElement>("video"),
        );

        const videoData = videos.map((video) => {
          const rect = video.getBoundingClientRect();

          const source =
            video.currentSrc ||
            video.src ||
            video.querySelector("source")?.src ||
            "";

          return {
            src: source,
            width: video.videoWidth,
            height: video.videoHeight,
            readyState: video.readyState,
            duration:
              Number.isFinite(video.duration) && video.duration > 0
                ? video.duration
                : 0,
            visible: isVisible(video),
            area: rect.width * rect.height,
          };
        });

        for (const video of videos) {
          try {
            video.muted = true;
            video.setAttribute("playsinline", "");
            void video.play().catch(() => {});
          } catch {
            // Player kendi kontrolüne sahipse devam.
          }
        }

        const iframeData = Array.from(
          document.querySelectorAll<HTMLIFrameElement>("iframe"),
        ).map((iframe) => {
          const src = iframe.src || "";
          const allowFullscreen =
            iframe.allowFullscreen ||
            iframe.hasAttribute("allowfullscreen");

          const metadata = [
            src,
            iframe.id,
            iframe.className,
            iframe.title,
            iframe.getAttribute("aria-label") || "",
          ].join(" ");

          let score = 0;

          if (allowFullscreen) {
            score += 45;
          }

          if (
            /(?:embed|player|video|watch|stream|live|media|playback|iframe)/i.test(
              metadata,
            )
          ) {
            score += 35;
          }

          if (src && /^https?:\/\//i.test(src)) {
            score += 5;
          }

          return {
            src,
            allowFullscreen,
            score,
          };
        });

        const markerSelector = [
          ".jwplayer",
          ".video-js",
          ".plyr",
          ".flowplayer",
          '[data-player]',
          '[data-video-player]',
          '[data-video-container]',
          '[class*="video-player"]',
          '[class*="videojs"]',
          '[class*="jwplayer"]',
        ].join(",");

        const playerMarkers = Array.from(
          document.querySelectorAll<HTMLElement>(markerSelector),
        )
          .slice(0, 20)
          .map((element) => {
            const rect = element.getBoundingClientRect();

            return {
              visible: isVisible(element),
              area: rect.width * rect.height,
            };
          });

        const hasStrongVideo = videoData.some(
          (video) =>
            video.visible &&
            video.area >= 3000 &&
            (video.width >= 160 ||
              video.height >= 90 ||
              video.readyState >= 2) &&
            (Boolean(video.src) || video.readyState >= 2),
        );

        const hasPlayerMarker = playerMarkers.some(
          (marker) => marker.visible && marker.area >= 5000,
        );

        const strongIframes = iframeData.filter(
          (iframe) =>
            iframe.src &&
            /^https?:\/\//i.test(iframe.src) &&
            iframe.score >= 45,
        );

        return {
          videoData,
          iframeData,
          strongIframes,
          hasVideo: videos.length > 0,
          hasStrongVideo,
          hasPlayerMarker,
        };
      });

      if (
        result.hasVideo ||
        result.hasPlayerMarker ||
        result.strongIframes.length > 0
      ) {
        detectedAnyPlayer = true;
      }

      if (result.hasStrongVideo || result.hasPlayerMarker) {
        detectedStrongPlayer = true;
      }

      for (const video of result.videoData) {
        if (!video.src) {
          continue;
        }

        if (/^https?:\/\//i.test(video.src)) {
          observedVideoUrls.add(video.src);
          addMedia(video.src, null, "media");
        }
      }

      for (const iframe of result.iframeData) {
        if (!iframe.src) {
          continue;
        }

        if (!/^https?:\/\//i.test(iframe.src)) {
          continue;
        }

        if (iframe.score < 45) {
          continue;
        }

        const current = playerFrames.get(iframe.src) ?? 0;

        if (iframe.score > current) {
          playerFrames.set(iframe.src, iframe.score);
        }
      }
    } catch {
      // Cross-origin / detached frame gibi durumlarda devam.
    }
  };

  const scanPage = async (page: any) => {
    try {
      for (const frame of page.frames()) {
        await scanFrame(frame);
      }
    } catch {
      // Sayfa kapanmış olabilir.
    }
  };

  const attachPage = (page: any) => {
    if (attachedPages.has(page)) {
      return;
    }

    attachedPages.add(page);

    page.on("request", (request: any) => {
      try {
        addMedia(
          request.url(),
          null,
          request.resourceType(),
        );
      } catch {
        // Devam.
      }
    });

    page.on("response", (response: any) => {
      try {
        const headers = response.headers();

        addMedia(
          response.url(),
          headers["content-type"] ?? null,
          response.request().resourceType(),
        );
      } catch {
        // Devam.
      }
    });
  };

  try {
    await context.route("**/*", async (route) => {
      const url = route.request().url();

      if (
        /^https?:\/\//i.test(url) &&
        isBlockedUrl(url)
      ) {
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
    });

    context.on("page", (page) => {
      attachPage(page);
    });

    const page = await context.newPage();
    attachPage(page);

    try {
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 12000,
      });
    } catch {
      /*
       * Timeout olsa bile DOM/player çoğu zaman yüklenmiş olur.
       * Sayfayı çöpe atmıyoruz.
       */
    }

    pageTitle =
      (await page.title().catch(() => "")) ||
      sourceUrl.hostname;

    await page.waitForLoadState("networkidle", {
      timeout: 2500,
    }).catch(() => {});

    /*
     * Lazy-load player'ları tetikle.
     */
    await page.evaluate(() => {
      try {
        window.scrollTo({
          top: Math.min(
            document.body.scrollHeight,
            1600,
          ),
          behavior: "instant",
        });
      } catch {
        // Devam.
      }
    }).catch(() => {});

    /*
     * İlk tarama.
     */
    await scanPage(page);

    /*
     * Bilinen play butonlarını güvenli şekilde tetikle.
     */
    for (const currentPage of context.pages()) {
      attachPage(currentPage);

      for (const frame of currentPage.frames()) {
        await frame.evaluate(() => {
          const selectors = [
            'button[aria-label*="play" i]',
            '[role="button"][aria-label*="play" i]',
            ".vjs-big-play-button",
            ".vjs-play-control",
            ".plyr__control--overlaid",
            ".jw-icon-play",
            '[data-plyr="play"]',
            '[data-action="play"]',
          ];

          for (const selector of selectors) {
            const element =
              document.querySelector<HTMLElement>(selector);

            if (!element) {
              continue;
            }

            const rect = element.getBoundingClientRect();

            if (rect.width <= 0 || rect.height <= 0) {
              continue;
            }

            try {
              element.click();
            } catch {
              // Devam.
            }

            break;
          }
        }).catch(() => {});
      }
    }

    await page.evaluate(() => {
      try {
        window.scrollTo({
          top: 0,
          behavior: "instant",
        });
      } catch {
        // Devam.
      }
    }).catch(() => {});

    /*
     * JS player'ın gerçek network trafiğinin oluşması için
     * kademeli gözlem.
     */
    const observationDelays = [
      900,
      1400,
      1800,
      2200,
    ];

    for (const delay of observationDelays) {
      await page.waitForTimeout(delay);

      for (const currentPage of context.pages()) {
        attachPage(currentPage);
        await scanPage(currentPage);
      }

      /*
       * Gerçek media bulunduysa daha fazla beklemeye gerek yok.
       */
      const currentBest = [
        ...mediaCandidates.values(),
      ].sort((a, b) => b.score - a.score)[0];

      if (currentBest && currentBest.score >= 130) {
        break;
      }
    }

    /*
     * En güçlü network / DOM media adayı.
     */
    const bestMedia = [
      ...mediaCandidates.values(),
    ].sort((a, b) => b.score - a.score)[0];

    if (bestMedia) {
      const isHls =
        HLS_RE.test(bestMedia.url) ||
        /mpegurl/i.test(
          bestMedia.mime_type ?? "",
        );

      console.info(
        "[NEXORA][dynamic] VIDEO DETECTED",
        {
          page: sourceUrl.hostname,
          kind: isHls ? "hls" : "direct",
          media: bestMedia.url,
          mime: bestMedia.mime_type,
          score: bestMedia.score,
        },
      );

      return {
        kind: isHls ? "hls" : "direct",
        url: bestMedia.url,
        stream_url: bestMedia.url,
        embed_url: null,
        title: pageTitle,
        mime_type: bestMedia.mime_type,
        provider: new URL(bestMedia.url).hostname,
        confidence: isHls ? 0.99 : 0.97,
        method: "direct",
      };
    }

    /*
     * Gerçek player iframe'i var ama media URL'si
     * browser network katmanından çıkmadıysa iframe'i
     * mevcut Nexora player'a ver.
     */
    const bestPlayerFrame = [
      ...playerFrames.entries(),
    ].sort((a, b) => b[1] - a[1])[0];

    if (bestPlayerFrame && bestPlayerFrame[1] >= 45) {
      console.info(
        "[NEXORA][dynamic] PLAYER EMBED DETECTED",
        {
          page: sourceUrl.hostname,
          embed: bestPlayerFrame[0],
          score: bestPlayerFrame[1],
        },
      );

      return {
        kind: "embed",
        url: sourceUrl.toString(),
        stream_url: null,
        embed_url: bestPlayerFrame[0],
        title: pageTitle,
        mime_type: null,
        provider: new URL(bestPlayerFrame[0]).hostname,
        confidence:
          bestPlayerFrame[1] >= 75 ? 0.91 : 0.84,
        method: "embed",
      };
    }

    /*
     * Gerçek video/player DOM'u bulundu fakat URL dışarı
     * aktarılmadıysa target sayfayı son fallback olarak ver.
     */
    if (detectedStrongPlayer) {
      console.info(
        "[NEXORA][dynamic] PLAYER DOM DETECTED",
        sourceUrl.hostname,
      );

      return {
        kind: "web",
        url: targetUrl,
        stream_url: null,
        embed_url: targetUrl,
        title: pageTitle,
        mime_type: null,
        provider: sourceUrl.hostname,
        confidence: 0.70,
        method: "fallback",
      };
    }

    if (detectedAnyPlayer) {
      console.info(
        "[NEXORA][dynamic] WEAK PLAYER SIGNAL",
        sourceUrl.hostname,
      );
    }

    return null;
  } finally {
    if (ownsContext) {
      await context.close().catch(() => {});
    }
  }
}

export async function resolveDynamicWeb(
  targetUrl: string,
): Promise<DynamicWebResult | null> {
  const url = new URL(targetUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    return null;
  }

  if (isBlockedUrl(url.toString())) {
    return null;
  }

  const runtime = await launchBrowser();
  const browser = runtime.browser;

  try {
    /*
     * Önce normal masaüstü Chrome.
     */
    const desktop = await probePage(
      browser,
      url.toString(),
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
      false,
    );

    console.info("[NEXORA][dynamic] DESKTOP RESULT", desktop);

    /*
     * Direct/HLS veya gerçek player iframe'i bulunduysa
     * Android denemesine gerek yok.
     *
     * Sadece weak/web fallback geldiyse ikinci görünümle
     * tekrar deniyoruz.
     */
    if (
      desktop &&
      desktop.kind !== "web"
    ) {
      return desktop;
    }

    const android = await probePage(
      browser,
      url.toString(),
      "Mozilla/5.0 (Linux; Android 14; SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
      true,
    );

    console.info("[NEXORA][dynamic] ANDROID RESULT", android);

    if (android) {
      return android;
    }

    return desktop;
  } finally {
    if (!runtime.connectedOverCdp) {
      await browser.close().catch(() => {});
    }
  }
}
