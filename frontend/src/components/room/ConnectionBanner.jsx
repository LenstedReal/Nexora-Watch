import { WifiOff, RotateCw, Loader2 } from "lucide-react";
import { useT } from "@/i18n";

export const ConnectionBanner = ({ status, attempt, onRetry }) => {
  const t = useT();
  if (status === "connected" || status === "connecting") return null;
  return (
    <div className={`banner ${status === "reconnecting" ? "warn" : "err"}`} role="status" data-testid="connection-banner">
      {status === "reconnecting" ? <Loader2 size={15} className="spin" /> : <WifiOff size={15} />}
      <span>{status === "reconnecting" ? t("st_reconnecting", { n: attempt }) : t(`st_${status}`)}</span>
      {(status === "failed" || status === "offline") && (
        <button className="btn sm" onClick={onRetry} data-testid="connection-retry-btn"><RotateCw size={13} /> {t("retry")}</button>
      )}
    </div>
  );
};
