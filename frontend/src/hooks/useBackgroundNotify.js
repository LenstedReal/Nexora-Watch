import { useEffect, useRef } from "react";
import { notify } from "@/lib/notify";

// Background notifications for a room: new chat message, the host changed the video, someone joined. notify() itself
// does nothing unless the tab is hidden and the user turned notifications on in Settings (and the API exists).
export function useBackgroundNotify({ t, room, messages, me }) {
  const seen = useRef(null); // message ids already known; null until the first render (history is not announced)
  const video = useRef(undefined);
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(messages.map((m) => m.id)); return; }
    for (const m of messages) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      if (m.participant_id === me) continue;
      if (m.kind === "system") {
        if (m.event === "joined") notify(room.name, t("notif_joined", { name: m.subject || m.nickname }), `nx-join-${m.id}`);
      } else {
        notify(t("notif_message", { name: m.nickname, room: room.name }), m.text, `nx-msg-${room.code}`);
      }
    }
  }, [messages, me, room.name, room.code, t]);
  const vkey = room.video ? `${room.video.kind || ""}|${room.video.url || room.video.id || ""}` : "";
  useEffect(() => {
    if (video.current !== undefined && vkey && vkey !== video.current && room.host_id !== me) {
      notify(t("notif_video"), room.video?.title || room.name, `nx-video-${room.code}`);
    }
    video.current = vkey;
  }, [vkey]); // eslint-disable-line react-hooks/exhaustive-deps
}
