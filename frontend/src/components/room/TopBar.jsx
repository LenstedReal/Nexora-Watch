import { useState } from "react";
import { ArrowLeft, Copy, Share2, LogOut, Power, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n";

const DOT = { connected: "ok", connecting: "", reconnecting: "", offline: "err", failed: "err" };

export const TopBar = ({ room, status, attempt, isHost, onBack, onLeave, onClose }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); toast.success(msg); } catch { toast(text); }
  };
  const invite = `${window.location.origin}/room/${room.code}`;
  const share = () => (navigator.share ? navigator.share({ title: room.name, text: `${t("invite")} · ${room.code}`, url: invite }).catch(() => {}) : copy(invite, t("invite_copied")));
  const label = status === "reconnecting" ? t("st_reconnecting", { n: attempt }) : t(`st_${status}`);
  return (
    <header className="top" data-testid="room-topbar">
      <button className="ib" onClick={onBack} aria-label="back" data-testid="room-back-btn"><ArrowLeft size={20} /></button>
      <div className="top-title">
        <b data-testid="room-name">{room.name}</b>
        <button className="code" onClick={() => copy(room.code, t("code_copied"))} data-testid="room-code-copy-btn">{room.code} <Copy size={11} /></button>
      </div>
      <span className={`dot ${DOT[status] ?? ""}`} title={label} data-testid="connection-status" />
      <span className="status-txt">{label}</span>
      <button className="invite" onClick={share} data-testid="invite-btn"><Share2 size={15} /> {t("invite")}</button>
      <div className="menu-wrap">
        <button className="ib" onClick={() => setOpen((o) => !o)} aria-label={t("menu")} data-testid="room-menu-btn"><MoreVertical size={20} /></button>
        {open && (
          <>
            <div className="backdrop" onClick={() => setOpen(false)} />
            <div className="menu" data-testid="room-menu">
              <button onClick={() => { setOpen(false); onLeave(); }} data-testid="leave-room-btn"><LogOut size={16} /> {t("leave")}</button>
              {isHost && <button className="danger" onClick={() => { setOpen(false); onClose(); }} data-testid="close-room-btn"><Power size={16} /> {t("close_room")}</button>}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
