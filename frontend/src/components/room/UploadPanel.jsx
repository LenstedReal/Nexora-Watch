import { useEffect, useRef, useState } from "react";
import { UploadCloud, X, RotateCw, CheckCircle2, FileVideo } from "lucide-react";
import { toast } from "sonner";
import { errorText, useT } from "@/i18n";
import { api } from "@/lib/api";
import { fmtBytes } from "@/lib/session";
import { uploadVideo } from "@/lib/uploader";

const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v";

export const UploadPanel = ({ code, ident }) => {
  const t = useT();
  const [usage, setUsage] = useState(null);
  const [file, setFile] = useState(null);
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState(null);
  const ctrl = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { api.storageUsage().then(setUsage).catch(() => {}); }, [prog?.phase]);

  const start = async (f = file) => {
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
  };
  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (usage && f.size > usage.max_upload_bytes) { setErr({ code: "too_large" }); setFile(f); return; }
    setFile(f);
    setProg(null);
    start(f);
  };
  const cancel = async () => {
    ctrl.current?.abort();
    if (prog?.mediaId) api.uploadAbort(prog.mediaId, ident).catch(() => {});
    setProg(null);
  };

  const pct = prog ? Math.floor((prog.loaded / prog.total) * 100) : 0;
  const busy = prog && ["preparing", "uploading", "finalizing"].includes(prog.phase);
  return (
    <div className="upload" data-testid="upload-panel">
      <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={pick} data-testid="upload-file-input" />
      {!busy && (
        <button className="drop" onClick={() => inputRef.current.click()} data-testid="upload-pick-btn">
          <UploadCloud size={22} />
          <b>{t("pick_file")}</b>
          <span>{t("upload_hint", { max: usage ? fmtBytes(usage.max_upload_bytes) : "2 GB" })}</span>
        </button>
      )}
      {file && prog && (
        <div className="up-card" data-testid="upload-progress">
          <div className="up-row"><FileVideo size={15} /><b className="ell">{file.name}</b><span>{fmtBytes(file.size)}</span></div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="up-row small">
            <span data-testid="upload-progress-text">
              {prog.phase === "finalizing" ? t("finalizing") : prog.phase === "done" ? t("upload_done") : `${t("uploading")} ${pct}% · ${fmtBytes(prog.loaded)} / ${fmtBytes(prog.total)}`}
            </span>
            {prog.speed > 0 && prog.phase === "uploading" && <span>{fmtBytes(prog.speed)}/s · {Math.ceil(prog.eta || 0)}s</span>}
            {prog.phase === "done" && <CheckCircle2 size={15} className="ok-c" />}
          </div>
          {busy && <button className="btn sm" onClick={cancel} data-testid="upload-cancel-btn"><X size={13} /> {t("cancel")}</button>}
        </div>
      )}
      {err && (
        <div className="inline-err" data-testid="upload-error">
          {errorText(t, err)}
          {file && err.code !== "too_large" && <button className="btn sm" onClick={() => start()} data-testid="upload-retry-btn"><RotateCw size={13} /> {t("retry")}</button>}
        </div>
      )}
      {usage && (
        <div className={`usage ${usage.warn ? "warn" : ""}`} data-testid="storage-usage">
          {t("storage")}: {fmtBytes(usage.used_bytes)} / {fmtBytes(usage.quota_bytes)} · {t(usage.driver === "oci" ? "storage_oci" : "storage_temp")}
        </div>
      )}
    </div>
  );
};
