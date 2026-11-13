import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Share2, Copy, Bell, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { getDevice } from "@/lib/device";
import { canAppPush, enableAppPush } from "@/lib/native";

const RESULT = { sent: "inv_sent", push_not_configured: "inv_no_push", no_push_token: "inv_no_app", rate_limited: "inv_limit" };

// "Davet et" sheet: share the link, or call someone you watched with before (push to their phone, app only).
export function InviteSheet({ room, ident, onClose }) {
  const t = useT();
  const link = `${window.location.origin}/room/${room.code}`;
  const [people, setPeople] = useState(null);
  const [res, setRes] = useState({});
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let alive = true;
    api.people().then((r) => alive && setPeople(r.people || [])).catch(() => alive && setPeople([]));
    return () => { alive = false; };
  }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success(t("invite_copied")); } catch { toast(link); }
  };
  const share = () => (navigator.share ? navigator.share({ title: room.name, text: `${t("invite")} · ${room.code}`, url: link }).catch(() => {}) : copy());
  const call = async (p) => {
    setBusy(p.device_id);
    let key;
    try {
      const r = await api.invitePerson(room.code, ident, p.device_id);
      key = r.sent ? "sent" : r.reason || "push_not_configured";
    } catch (e) {
      key = e.code === "rate_limited" ? "rate_limited" : "error";
    }
    setBusy("");
    setRes((m) => ({ ...m, [p.device_id]: key }));
  };
  const allow = async () => {
    const r = await enableAppPush(getDevice());
    toast[r.ok ? "success" : "error"](t(r.ok ? "push_on" : "push_off"));
  };
  return createPortal(
    <div className="inv-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="invite-sheet-bg">
      <div className="inv" role="dialog" aria-modal="true" aria-label={t("invite")} data-testid="invite-sheet">
        <header className="inv-top">
          <b>{t("invite")}</b>
          <button type="button" className="ib" onClick={onClose} aria-label={t("close")} data-testid="invite-sheet-close"><X size={18} /></button>
        </header>
        <div className="inv-acts">
          <button type="button" className="set" onClick={share} data-testid="invite-share-btn"><Share2 size={15} /> {t("share_link")}</button>
          <button type="button" className="set" onClick={copy} data-testid="invite-copy-btn"><Copy size={15} /> {room.code}</button>
        </div>
        <section className="inv-people" data-testid="together-section">
          <div className="inv-h"><UserPlus size={14} /> {t("together_title")}</div>
          {people === null ? <p className="inv-mut">…</p> : people.length === 0 ? (
            <p className="inv-mut" data-testid="together-empty">{t("together_empty")}</p>
          ) : people.map((p) => (
            <div className="inv-row" key={p.device_id} data-testid="together-row">
              <div className="inv-who"><b>{p.nickname}</b><span>{new Date(p.last).toLocaleDateString()}</span></div>
              {res[p.device_id] ? (
                <span className={`inv-res ${res[p.device_id] === "sent" ? "ok" : ""}`} data-testid="together-result">{t(RESULT[res[p.device_id]] || "inv_failed")}</span>
              ) : (
                <button type="button" className="set" disabled={busy === p.device_id} onClick={() => call(p)} data-testid="together-invite-btn">{t("invite")}</button>
              )}
            </div>
          ))}
        </section>
        {canAppPush() && <button type="button" className="inv-allow" onClick={allow} data-testid="push-allow-btn"><Bell size={15} /> {t("push_allow")}</button>}
      </div>
    </div>,
    document.body,
  );
}
