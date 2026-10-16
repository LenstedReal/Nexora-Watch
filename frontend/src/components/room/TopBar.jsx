import { ArrowLeft, Copy, Share2, LogOut, Power, Activity } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n";

const PILL = { connected: "ok", connecting: "warn", reconnecting: "warn", offline: "err", failed: "err" };

export const TopBar = ({ room, status, attempt, isHost, onBack, onLeave, onClose, onToggleHud }) => {
  const t = useT();
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); toast.success(msg); } catch { toast(text); }
  };
  const invite = `${window.location.origin}/room/${room.code}`;
  const share = () => (navigator.share ? navigator.share({ title: room.name, url: invite }).catch(() => {}) : copy(invite, t("invite_copied")));
  const label = status === "reconnecting" ? t("st_reconnecting", { n: attempt }) : t(`st_${status}`);
  return (
    <header className="top" data-testid="room-topbar">
      <button className="icon-btn" onClick={onBack} aria-label="back" data-testid="room-back-btn"><ArrowLeft size={18} /></button>
      <div className="top-title">
        <b data-testid="room-name">{room.name}</b>
        <button className="code" onClick={() => copy(room.code, t("code_copied"))} data-testid="room-code-copy-btn">
          {room.code} <Copy size={11} />
        </button>
      </div>
      <span className={`pill ${PILL[status] || "warn"}`} data-testid="connection-status"><i /><span className="pill-txt">{label}</span></span>
      <span className="sp" />
      <button className="icon-btn" onClick={onToggleHud} aria-label="sync" data-testid="sync-hud-toggle"><Activity size={17} /></button>
      <button className="icon-btn" onClick={share} aria-label="invite" data-testid="invite-btn"><Share2 size={17} /></button>
      {isHost && <button className="icon-btn danger" onClick={onClose} aria-label="close" data-testid="close-room-btn"><Power size={17} /></button>}
      <button className="btn" onClick={onLeave} data-testid="leave-room-btn"><LogOut size={14} /> <span className="hide-sm">{t("leave")}</span></button>
    </header>
  );
};
