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

export const setOrientation = (mode) => postNative({ type: "orientation", mode }); // "landscape" | "portrait"
export const setKeepAwake = (on) => postNative({ type: "keep_awake", on: !!on });
