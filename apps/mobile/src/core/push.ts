// Invite notifications (push worker). Only expo-notifications' JS API: permission is asked when the user taps
// "Bildirimlere izin ver" in the web app (bridge message "push_enable"); the device's FCM token goes to the server
// under the web app's anonymous device id/key. Tapping a notification opens its room.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { WEB_URL } from "./api";

export type PushResult = { ok: boolean; reason?: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export async function enablePush(deviceId: unknown, key: unknown): Promise<PushResult> {
  if (typeof deviceId !== "string" || !ID_RE.test(deviceId) || typeof key !== "string" || key.length < 16) return { ok: false, reason: "bad_device" };
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("invites", { name: "Davetler", importance: Notifications.AndroidImportance.HIGH });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: "denied" };
    const tok = await Notifications.getDevicePushTokenAsync(); // FCM token on Android (needs google-services.json)
    const res = await fetch(`${WEB_URL}/api/devices/me/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nexora-Device": deviceId, "X-Nexora-Key": key },
      body: JSON.stringify({ token: String(tok.data), platform: Platform.OS === "ios" ? "ios" : "android" }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: `http_${res.status}` };
  } catch {
    return { ok: false, reason: "unavailable" }; // e.g. a build without google-services.json: push stays off
  }
}

/** The room link carried by a notification ({room, url} data sent by the server). */
export function linkFromNotification(n: Notifications.Notification | null | undefined): string | null {
  const d: any = n?.request?.content?.data ?? {};
  if (typeof d.url === "string" && d.url) return d.url;
  return typeof d.room === "string" && /^[A-Za-z2-9]{6}$/.test(d.room) ? `nexora://room/${d.room}` : null;
}

/** Calls onLink for the notification that launched the app and for every later tap. */
export function onNotificationTap(onLink: (link: string) => void): () => void {
  Notifications.getLastNotificationResponseAsync()
    .then((r) => { const l = linkFromNotification(r?.notification); if (l) onLink(l); })
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const l = linkFromNotification(r.notification);
    if (l) onLink(l);
  });
  return () => sub.remove();
}
