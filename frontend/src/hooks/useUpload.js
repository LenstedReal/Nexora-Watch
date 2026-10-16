import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { uploadVideo } from "@/lib/uploader";

export function useUpload({ code, ident }) {
  const t = useT();
  const [file, setFile] = useState(null);
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState(null);
  const ctrl = useRef(null);

  const start = useCallback(async (f) => {
    if (!f) return;
    setErr(null);
    ctrl.current = new AbortController();
    setProg({ phase: "preparing", loaded: 0, total: f.size });
    try {
      await uploadVideo({ file: f, code, ident, signal: ctrl.current.signal, onProgress: setProg });
      setProg((p) => ({ ...p, phase: "done" }));
      toast.success(t("upload_done"));
    } catch (e) {
      if (e.code === "aborted") setProg(null);
      else { setErr(e); setProg((p) => ({ ...p, phase: "error" })); }
    }
  }, [code, ident, t]);

  const pick = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setProg(null);
    start(f);
  }, [start]);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    setProg((p) => { if (p?.mediaId) api.uploadAbort(p.mediaId, ident).catch(() => {}); return null; });
  }, [ident]);

  const busy = !!prog && ["preparing", "uploading", "finalizing"].includes(prog.phase);
  return { file, prog, err, busy, pick, cancel, retry: () => start(file) };
}
