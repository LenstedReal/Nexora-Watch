// Background notifications (no push server): shown only while the tab/app is hidden and the user turned them on in
// Settings. In the app's WebView the Notification API usually does not exist: then everything here is a silent no-op.
const KEY = "nx:notify";
export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;
export const notifyOn = () => {
  try {
    return localStorage.getItem(KEY) === "1" && notifySupported() && Notification.permission === "granted";
  } catch {
    return false;
  }
};
export const setNotifyPref = (on) => {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage disabled */
  }
};
// Asked ONLY from the settings toggle. Resolves to true when notifications are now on.
export async function enableNotify() {
  if (!notifySupported()) return false;
  let p = Notification.permission;
  if (p === "default") {
    try {
      p = await Notification.requestPermission();
    } catch {
      p = "denied";
    }
  }
  setNotifyPref(p === "granted");
  return p === "granted";
}
export function notify(title, body, tag) {
  if (typeof document === "undefined" || document.visibilityState !== "hidden" || !notifyOn()) return false;
  try {
    const n = new Notification(title, { body: String(body || "").slice(0, 140), tag, icon: "/branding/logo-256.jpg" });
    n.onclick = () => { try { window.focus(); n.close(); } catch { /* ignore */ } };
    return true;
  } catch {
    return false; // e.g. Android Chrome needs a service worker for notifications: skip silently
  }
}
