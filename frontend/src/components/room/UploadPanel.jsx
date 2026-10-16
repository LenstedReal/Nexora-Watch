import { useRef } from "react";
import { UploadCloud, X, RotateCw, CheckCircle2, FileVideo } from "lucide-react";
import { errorText, useT } from "@/i18n";
import { fmtBytes } from "@/lib/session";

const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v";

export const UploadPanel = ({ upload }) => {
  const t = useT();
  const inputRef = useRef(null);
  const { file, prog, err, busy, pick, cancel, retry } = upload;
  const pct = prog ? Math.floor((prog.loaded / prog.total) * 100) : 0;
  const onPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    pick(f);
  };
  return (
    <div className="upload" data-testid="upload-panel">
      <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={onPick} data-testid="upload-file-input" />
      {!busy && (
        <button className="drop" onClick={() => inputRef.current.click()} data-testid="upload-pick-btn">
          <UploadCloud size={22} />
          <b>{t("pick_file")}</b>
          <span>{t("upload_hint", { max: "2 GB" })}</span>
        </button>
      )}
      {file && prog && (
        <div className="up-card" data-testid="upload-progress">
          <div className="up-row"><FileVideo size={15} /><b className="ell">{file.name}</b><span>{fmtBytes(file.size)}</span></div>
          <div className="bar"><i style={{ width: `${prog.phase === "done" ? 100 : pct}%` }} /></div>
          <div className="up-row small">
            <span data-testid="upload-progress-text">
              {prog.phase === "finalizing" ? t("finalizing") : prog.phase === "done" ? t("upload_done") : prog.phase === "error" ? errorText(t, err) : `${t("uploading")} ${pct}% · ${fmtBytes(prog.loaded)} / ${fmtBytes(prog.total)}`}
            </span>
            {prog.speed > 0 && prog.phase === "uploading" && <span>{fmtBytes(prog.speed)}/s · {Math.ceil(prog.eta || 0)}s</span>}
            {prog.phase === "done" && <CheckCircle2 size={15} className="ok-c" />}
          </div>
          {busy && <button className="btn sm" onClick={cancel} data-testid="upload-cancel-btn"><X size={13} /> {t("cancel")}</button>}
          {prog.phase === "error" && err?.code !== "too_large" && (
            <button className="btn sm" onClick={retry} data-testid="upload-retry-btn"><RotateCw size={13} /> {t("retry")}</button>
          )}
        </div>
      )}
    </div>
  );
};
