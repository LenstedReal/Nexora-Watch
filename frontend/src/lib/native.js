// Bridge to the Nexora Watch mobile app. The Android/iOS app shows this same web app in a WebView and injects
// window.__NEXORA_APP__ before the page loads; native-only features (site browser with video detection,
// screen rotation) are reached through postMessage.
export const inApp = () => typeof window !== "undefined" && !!window.__NEXORA_APP__ && !!window.ReactNativeWebView;

export const appInfo = () => (inApp() ? window.__NEXORA_APP__ : null);

export function postNative(msg) {
  if (!inApp()) return false;
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    return true;
  } catch {
    return false;
  }
}

/** Opens the native site browser; resolves with {url, referer, title} or null when the user closes it. */
export function pickFromNativeBrowser() {
  return new Promise((resolve) => {
    const prev = window.__nexoraPick;
    window.__nexoraPick = (res) => {
      window.__nexoraPick = prev;
      resolve(res && res.url ? res : null);
    };
    if (!postNative({ type: "open_browser" })) {
      window.__nexoraPick = prev;
      resolve(null);
    }
  });
}

/**
 * Opens an address outside the app, in the phone's browser; in a normal browser it opens a new tab. Returns false when
 * this app version cannot do it (older versions keep our own address inside the app): the caller then offers the address
 * another way.
 */
export function openExternal(url) {
  if (!inApp()) {
    window.open(url, "_blank", "noopener");
    return true;
  }
  if (!appInfo()?.caps?.includes("open_external")) return false;
  return postNative({ type: "open_external", url });
}

export const setOrientation = (mode) => postNative({ type: "orientation", mode }); // "landscape" | "portrait"
export const setKeepAwake = (on) => postNative({ type: "keep_awake", on: !!on });

/** Asks the app for notification permission and lets it send its push token for this device. Resolves with
 * {ok, reason?}; outside the app (or an older app version without "push") resolves {ok:false, reason:"no_app"}. */
export function enableAppPush(device) {
  return new Promise((resolve) => {
    if (!appInfo()?.caps?.includes("push")) return resolve({ ok: false, reason: "no_app" });
    const prev = window.__nexoraPush;
    window.__nexoraPush = (res) => {
      window.__nexoraPush = prev;
      resolve(res || { ok: false });
    };
    if (!postNative({ type: "push_enable", device_id: device.id, key: device.key, origin: window.location.origin })) {
      window.__nexoraPush = prev;
      resolve({ ok: false, reason: "no_app" });
    }
  });
}
export const canAppPush = () => !!appInfo()?.caps?.includes("push");
