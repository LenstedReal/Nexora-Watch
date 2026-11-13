/**
 * Ad rules for the Android app (InMobi). Pure logic, no React / native imports, unit-tested in ads.test.ts.
 *
 * Owner's rules:
 *  - never an ad while the WebView shows /room/...
 *  - banner only on the home screen ("/")
 *  - interstitial only when leaving a room back to home, at most once per 3 minutes,
 *    never at app start, never on return from background, never if the next route is a room
 *  - with any ID empty everything is a silent no-op
 */

export type AdIds = { accountId: string; bannerId: string; interstitialId: string };
export type Route = "home" | "room" | "other";

export const ADS = {
  INTERSTITIAL_GAP_MS: 3 * 60_000,
  /** Route changes this soon after start / resume never show an interstitial (WebView restoring its page). */
  QUIET_AFTER_RESUME_MS: 5_000,
} as const;

/** All three IDs present (placement IDs are InMobi's numeric "long" IDs). */
export function adsEnabled(ids: Partial<AdIds> | null | undefined): ids is AdIds {
  if (!ids) return false;
  const acc = (ids.accountId ?? "").trim();
  const b = (ids.bannerId ?? "").trim();
  const i = (ids.interstitialId ?? "").trim();
  return acc.length > 0 && /^\d+$/.test(b) && /^\d+$/.test(i);
}

/** Route of a WebView URL or path. Only our own host counts as home/room; anything else is "other". */
export function routeOf(urlOrPath: string, webHost?: string): Route {
  let path = urlOrPath;
  if (/^[a-z][a-z0-9+.-]*:/i.test(urlOrPath)) {
    try {
      const u = new URL(urlOrPath);
      if (webHost && u.host !== webHost) return "other";
      path = u.pathname;
    } catch {
      return "other";
    }
  } else {
    path = path.split(/[?#]/)[0];
  }
  if (/^\/room(\/|$)/i.test(path)) return "room";
  if (path === "" || path === "/") return "home";
  return "other";
}

export type AdState = {
  enabled: boolean;
  route: Route | null;
  foreground: boolean;
  /** Time of start or of the last resume from background. */
  quietSince: number;
  lastInterstitialAt: number | null;
};

export type AdEffects = {
  /** Banner should be visible now. */
  banner: boolean;
  /** Load an interstitial now so it is ready when the user leaves the room. */
  preloadInterstitial: boolean;
  /** Show the (already loaded) interstitial now. */
  showInterstitial: boolean;
};

const NONE: AdEffects = { banner: false, preloadInterstitial: false, showInterstitial: false };

export function initialAdState(ids: Partial<AdIds> | null | undefined, now: number): AdState {
  return { enabled: adsEnabled(ids), route: null, foreground: true, quietSince: now, lastInterstitialAt: null };
}

function bannerFor(s: AdState): boolean {
  return s.enabled && s.foreground && s.route === "home";
}

/** The WebView reports a new route. */
export function onRoute(s: AdState, next: Route, now: number): [AdState, AdEffects] {
  if (!s.enabled) return [{ ...s, route: next }, NONE];
  const prev = s.route;
  const ns: AdState = { ...s, route: next };
  let show = false;
  if (
    prev === "room" &&
    next === "home" &&
    s.foreground &&
    now - s.quietSince >= ADS.QUIET_AFTER_RESUME_MS &&
    (s.lastInterstitialAt === null || now - s.lastInterstitialAt >= ADS.INTERSTITIAL_GAP_MS)
  ) {
    show = true;
    ns.lastInterstitialAt = now;
  }
  const preload = next === "room" && prev !== "room";
  return [ns, { banner: bannerFor(ns), preloadInterstitial: preload, showInterstitial: show }];
}

/** App went to background (AppState "background"/"inactive"). */
export function onBackground(s: AdState): [AdState, AdEffects] {
  return [{ ...s, foreground: false }, NONE];
}

/** App came back to foreground. Never shows an interstitial. */
export function onResume(s: AdState, now: number): [AdState, AdEffects] {
  const ns: AdState = { ...s, foreground: true, quietSince: now };
  return [ns, { banner: bannerFor(ns), preloadInterstitial: false, showInterstitial: false }];
}

/** Script injected into the page: reports SPA navigations (pushState / replaceState / popstate) as {type:"route"}. */
export const ROUTE_REPORTER = `(function(){try{if(window.__nexoraRouteHook)return;window.__nexoraRouteHook=1;
var last=null;function send(){try{var p=location.pathname;if(p===last)return;last=p;
window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:"route",path:p}));}catch(e){}}
["pushState","replaceState"].forEach(function(k){var o=history[k];history[k]=function(){var r=o.apply(this,arguments);setTimeout(send,0);return r;};});
window.addEventListener("popstate",function(){setTimeout(send,0);});
if(document.readyState!=="loading")send();else document.addEventListener("DOMContentLoaded",send);}catch(e){}})();`;
