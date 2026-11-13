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
  // Phone notifications (Firebase) inside the app: allow, then send a test to this phone.
  const allowPush = async () => {
    try { await api.people(); } catch { /* registers the device; the list itself is not needed here */ }
    const r = await enableAppPush(getDevice());
    toast[r.ok ? "success" : "error"](t(r.ok ? "push_on" : "push_off"));
  };
  const testPush = async () => {
    try {
      const r = await api.testPush();
      if (r.sent) toast.success(t("push_test_sent"));
      else toast.error(t(r.reason === "no_push_token" ? "push_test_no_token" : r.reason === "push_not_configured" ? "inv_no_push" : "inv_failed"));
    } catch (e) { toast.error(t("inv_failed")); }
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
      <section className="settings-row">
        <label htmlFor="set-notif"><Bell size={16} /> {t("notifications")}</label>
        <input id="set-notif" type="checkbox" className="switch" checked={notif} disabled={!supported} onChange={toggleNotif} data-testid="settings-notify" />
      </section>
      <p className="settings-note">{supported ? t("notify_hint") : t("notify_unsupported")}</p>
      {canAppPush() && (
        <section className="settings-row">
          <span><Bell size={16} /> {t("push_test_title")}</span>
          <div className="settings-inline">
            <button className="settings-btn" onClick={allowPush} data-testid="settings-push-allow">{t("push_allow")}</button>
            <button className="settings-btn" onClick={testPush} data-testid="settings-push-test">{t("push_test")}</button>
          </div>
        </section>
      )}
      <section className="settings-row">
        <span><Trash2 size={16} /> {t("wipe_data")}</span>
        <button className="settings-btn danger" onClick={wipe} data-testid="settings-wipe">{t("wipe_btn")}</button>
      </section>
      <p className="settings-note">{t("wipe_hint")} <Link to="/veri-silme">{t("lp_privacy")}</Link></p>
    </main>
  );
}
