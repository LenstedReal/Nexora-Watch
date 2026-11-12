import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/i18n";

/** In-page replacement for window.confirm(): works and looks the same in every browser and inside the mobile app. */
export const ConfirmDialog = ({ title, text, confirmLabel, danger = false, busy = false, onConfirm, onCancel }) => {
  const t = useT();
  const cancelRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return (
    <div className="modal-bg" onClick={() => !busy && onCancel()} data-testid="confirm-dialog">
      <div className="modal confirm" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={title}>
        <b data-testid="confirm-title">{title}</b>
        {text && <p data-testid="confirm-text">{text}</p>}
        <div className="confirm-row">
          <button ref={cancelRef} className="cancel" onClick={onCancel} disabled={busy} data-testid="confirm-cancel">{t("cancel")}</button>
          <button className={danger ? "ok danger" : "ok"} onClick={onConfirm} disabled={busy} data-testid="confirm-ok">
            {busy ? <Loader2 size={16} className="spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
