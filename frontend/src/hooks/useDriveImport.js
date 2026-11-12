import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorText, useT } from "@/i18n";
import { api } from "@/lib/api";

const TOAST = { id: "drive-import" }; // the status poll and the server's notice may both report the same result: one toast

/**
 * Google Drive import (the server downloads the file into the room's storage). The state lives in the room, not in
 * the panel that started it, so the progress and the result survive switching tabs on a phone.
 */
export function useDriveImport({ code, ident }) {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const [imp, setImp] = useState(null); // {media_id, done, size, filename}
  const poll = useRef(null);
  const current = useRef(null);

  const finish = useCallback((ok, why) => {
    clearInterval(poll.current);
    poll.current = null;
    current.current = null;
    setImp(null);
    if (ok) toast.success(tRef.current("drive_done"), TOAST);
    else toast.error(errorText(tRef.current, { code: why?.code || "import_failed", message: why?.detail }), TOAST);
  }, []);

  const start = useCallback(async (url) => {
    const res = await api.importDrive(code, ident, url);
    const id = res.media_id;
    current.current = id;
    setImp({ media_id: id, done: 0, size: res.size, filename: res.filename });
    clearInterval(poll.current);
    poll.current = setInterval(async () => {
      try {
        const st = await api.importStatus(id, ident);
        if (current.current !== id) return;
        if (st.status === "completed") finish(true);
        else if (st.status === "failed") finish(false, { code: st.error_code, detail: st.error });
        else setImp((x) => x && { ...x, done: st.bytes_done, size: st.size || x.size });
      } catch {
        /* keep polling */
      }
    }, 1500);
  }, [code, ident, finish]);

  /** The server's own notice about a failed import; it arrives over the room connection. */
  const onNotice = useCallback((e) => {
    if (current.current && e.media_id && e.media_id !== current.current) return;
    finish(false, { code: e.reason, detail: e.detail });
  }, [finish]);

  useEffect(() => () => clearInterval(poll.current), []);

  return { imp, start, onNotice };
}
