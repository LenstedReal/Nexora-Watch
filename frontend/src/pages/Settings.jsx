import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Globe, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { lastNickname, saveNickname } from "@/lib/session";
import { enableNotify, notifyOn, notifySupported, setNotifyPref } from "@/lib/notify";
import { canAppPush, enableAppPush } from "@/lib/native";
import { getDevice } from "@/lib/device";
import { api } from "@/lib/api";
import "@/landing.css";

// Everything the app keeps on this device starts with "nx:"; the age/terms consent ("nx.consent.v1") stays so the
// gate does not come back right after deleting.
export function clearLocalData() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("nx:")).forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    /* storage disabled: nothing stored */
  }
}

export default function Settings() {
  const { t, lang, setLang, langs } = useI18n();
  const nav = useNavigate();
  const [nick, setNick] = useState(lastNickname());
  const [notif, setNotif] = useState(notifyOn());
  const supported = notifySupported();
  // Inside the app notifications come from the phone (Firebase): one switch, no browser notification row.
  const app = canAppPush();
  const [push, setPush] = useState(() => { try { return localStorage.getItem("nx:push") === "1"; } catch { return false; } });
  const [pushBusy, setPushBusy] = useState(false);
  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (push) {
        try { await api.pushOff(); } catch { /* the phone's switch is what matters */ }
        try { localStorage.setItem("nx:push", "0"); } catch { /* private mode */ }
        setPush(false);
        return;
      }
      try { await api.people(); } catch { /* registers this device on the server; the list itself is not needed */ }
      const r = await enableAppPush(getDevice());
      if (r.ok) {
        try { localStorage.setItem("nx:push", "1"); } catch { /* private mode */ }
        setPush(true);
        toast.success(t("push_on"));
      } else {
        toast.error(t(r.reason === "denied" ? "notify_denied" : r.reason === "unavailable" ? "push_unavailable" : "push_off"));
      }
    } finally { setPushBusy(false); }
  };
  useEffect(() => { document.title = `${t("settings")} · Nexora Watch`; }, [t]);

  const saveNick = () => {
    const n = nick.trim().slice(0, 24);
    saveNickname(n);
    toast.success(t("settings_saved"));
  };
  const toggleNotif = async () => {
    if (notif) { setNotifyPref(false); setNotif(false); return; }
    const on = await enableNotify();
    setNotif(on);
    if (!on) toast.error(t("notify_denied"));
  };
  const wipe = () => {
    if (!window.confirm(t("wipe_confirm"))) return;
    clearLocalData();
    setNick("");
    setNotif(false);
    toast.success(t("wipe_done"));
  };

  return (
    <main className="settings" data-testid="settings-page">
      <header className="settings-h">
        <button className="ib" onClick={() => nav("/")} aria-label={t("back")} data-testid="settings-back"><ArrowLeft size={20} /></button>
        <h1>{t("settings")}</h1>
      </header>
      <section className="settings-row">
        <label htmlFor="set-lang"><Globe size={16} /> {t("language")}</label>
        <select id="set-lang" value={lang} onChange={(e) => setLang(e.target.value)} data-testid="settings-language">
          {langs.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </section>
      <section className="settings-row col">
        <label htmlFor="set-nick"><User size={16} /> {t("default_nickname")}</label>
        <div className="settings-inline">
          <input id="set-nick" value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} placeholder={t("nickname_ph")} data-testid="settings-nickname" />
          <button className="settings-btn" onClick={saveNick} data-testid="settings-nickname-save">{t("save")}</button>
        </div>
      </section>
      {app ? (
        <>
          <section className="settings-row">
            <label htmlFor="set-push"><Bell size={16} /> {t("notifications")}</label>
            <input id="set-push" type="checkbox" className="switch" checked={push} disabled={pushBusy} onChange={togglePush} data-testid="settings-push" />
          </section>
          <p className="settings-note">{t("push_hint")}</p>
        </>
      ) : (
        <>
          <section className="settings-row">
            <label htmlFor="set-notif"><Bell size={16} /> {t("notifications")}</label>
            <input id="set-notif" type="checkbox" className="switch" checked={notif} disabled={!supported} onChange={toggleNotif} data-testid="settings-notify" />
          </section>
          <p className="settings-note">{supported ? t("notify_hint") : t("notify_unsupported")}</p>
        </>
      )}
      <section className="settings-row">
        <span><Trash2 size={16} /> {t("wipe_data")}</span>
        <button className="settings-btn danger" onClick={wipe} data-testid="settings-wipe">{t("wipe_btn")}</button>
      </section>
      <p className="settings-note">{t("wipe_hint")} <Link to="/veri-silme">{t("lp_privacy")}</Link></p>
    </main>
  );
}
