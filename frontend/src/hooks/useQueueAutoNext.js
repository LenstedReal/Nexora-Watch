import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

// Host client only: when the current video ends by itself, the top queue item starts. The server ignores the call when
// the video already changed (after_media_id), so a second trigger never skips an item.
export function useQueueAutoNext({ code, ident, isHost, room, playerRef, onRoom }) {
  const fired = useRef(null);
  const mediaId = room?.video?.media_id || null;
  const hasQueue = (room?.queue?.length || 0) > 0;
  const onRoomRef = useRef(onRoom);
  onRoomRef.current = onRoom;
  useEffect(() => {
    if (!isHost || !mediaId || !hasQueue) return undefined;
    const tick = () => {
      const p = playerRef.current;
      if (!p || fired.current === mediaId) return;
      const dur = p.getDuration?.();
      const ended = p.isEnded ? p.isEnded() : p.isPaused?.() && Number.isFinite(dur) && dur > 0 && p.getTime?.() >= dur - 0.5;
      if (!ended) return;
      fired.current = mediaId;
      api.queueNext(code, ident, { after_media_id: mediaId }).then((res) => res?.room && onRoomRef.current(res.room)).catch(() => {});
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [code, ident, isHost, mediaId, hasQueue, playerRef]);
}
