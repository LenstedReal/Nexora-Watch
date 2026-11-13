import { useState } from "react";
import { ArrowLeft, Copy, Share2, LogOut, Power, MoreVertical, Users, Radio } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n";
import { InviteSheet } from "@/components/room/InviteSheet";

const DOT = { connected: "ok", connecting: "", reconnecting: "", offline: "err", failed: "err" };

export const TopBar = ({ room, ident, status, attempt, isHost, onBack, onLeave, onClose, onTogglePublic }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); toast.success(msg); } catch { toast(text); }
  };
  const label = status === "reconnecting" ? t("st_reconnecting", { n: attempt }) : t(`st_${status}`);
  return (
    <header className="top" data-testid="room-topbar">
      <button className="ib" onClick={onBack} aria-label={t("back")} data-testid="room-back-btn"><ArrowLeft size={20} /></button>
      <div className="top-title">
        <b data-testid="room-name">{room.name}</b>
        <button className="code" onClick={() => copy(room.code, t("code_copied"))} data-testid="room-code-copy-btn">{room.code} <Copy size={11} /></button>
      </div>
      <span className="online-pill" title={t("online")} data-testid="online-count"><Users size={12} /> {room.participants.filter((p) => p.online).length}</span>
      <span className={`dot ${DOT[status] ?? ""}`} title={label} data-testid="connection-status" />
      <span className="status-txt">{label}</span>
      <button className="invite" onClick={() => setSheet(true)} aria-label={t("invite")} title={t("invite")} data-testid="invite-btn"><Share2 size={15} /> <span>{t("invite")}</span></button>
      <div className="menu-wrap">
        <button className="ib" onClick={() => setOpen((o) => !o)} aria-label={t("menu")} data-testid="room-menu-btn"><MoreVertical size={20} /></button>
        {open && (
          <>
            <div className="backdrop" onClick={() => setOpen(false)} />
            <div className="menu" data-testid="room-menu">
              <button onClick={() => { setOpen(false); onLeave(); }} data-testid="leave-room-btn"><LogOut size={16} /> {t("leave")}</button>
              {isHost && onTogglePublic && (
                <button onClick={() => { setOpen(false); onTogglePublic(!room.public); }} aria-pressed={!!room.public} data-testid="public-room-toggle">
                  <Radio size={16} /> {room.public ? t("public_off") : t("public_on")}
                </button>
              )}
              {isHost && <button className="danger" onClick={() => { setOpen(false); onClose(); }} data-testid="close-room-btn"><Power size={16} /> {t("close_room")}</button>}
            </div>
          </>
        )}
      </div>
      {sheet && <InviteSheet room={room} ident={ident} onClose={() => setSheet(false)} />}
    </header>
  );
};
