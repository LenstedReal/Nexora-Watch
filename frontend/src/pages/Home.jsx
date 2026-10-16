import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Zap, Youtube, Cloud, Film, Upload, Sparkles, ArrowRight, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { errorText, useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { lastNickname, saveIdent, saveNickname } from "@/lib/session";

export default function Home() {
  const { t, lang, setLang, langs } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("join") ? "j" : "c");
  const [nick, setNick] = useState(lastNickname());
  const [name, setName] = useState("");
  const [code, setCode] = useState((params.get("join") || "").toUpperCase());
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Nexora Watch"; }, []);

  const go = async (e) => {
    e.preventDefault();
    const n = nick.trim();
    if (!n) return toast.error(t("need_nickname"));
    const c = code.trim().toUpperCase();
    if (mode === "j" && c.length !== 6) return toast.error(t("need_code"));
    setBusy(true);
    try {
      const res = mode === "c" ? await api.createRoom(n, name.trim()) : await api.joinRoom(c, n);
      saveNickname(n);
      saveIdent(res.room.code, { participant_id: res.participant.id, token: res.token, nickname: n });
      nav(`/room/${res.room.code}`, { state: { room: res.room } });
    } catch (ex) {
      toast.error(errorText(t, ex));
      setBusy(false);
    }
  };

  return (
    <main className="home" data-testid="home-page">
      <div className="hero">
        <div className="hero-top">
          <span className="chip" data-testid="hero-chip"><Zap size={12} /> {t("chip")}</span>
          <label className="lang"><Globe size={13} />
            <select value={lang} onChange={(e) => setLang(e.target.value)} data-testid="language-select">
              {langs.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <img className="logo" src="/branding/logo-256.jpg" alt="Nexora Watch" />
        <h1 data-testid="hero-title">Better Than Rave.</h1>
        <div className="by">BY LENSTEDREAL</div>
        <p className="sub">{t("hero_sub")}</p>
        <div className="src">
          <span><Youtube size={13} /> YouTube</span><span><Cloud size={13} /> Drive</span>
          <span><Film size={13} /> MP4 / M3U8</span><span><Upload size={13} /> {t("upload_video")}</span>
        </div>
      </div>
      <form className="card" onSubmit={go} data-testid="room-form">
        <div className="tabs">
          <button type="button" className={mode === "c" ? "on" : ""} onClick={() => setMode("c")} data-testid="tab-create">{t("tab_create")}</button>
          <button type="button" className={mode === "j" ? "on" : ""} onClick={() => setMode("j")} data-testid="tab-join">{t("tab_join")}</button>
        </div>
        <label>{t("nickname")}</label>
        <input value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} placeholder={t("nickname_ph")} data-testid="nickname-input" />
        {mode === "c" ? (
          <>
            <label>{t("room_name")}</label>
            <input value={name} maxLength={48} onChange={(e) => setName(e.target.value)} placeholder={t("room_name_ph")} data-testid="room-name-input" />
          </>
        ) : (
          <>
            <label>{t("room_code")}</label>
            <input className="code-in" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="U2ECN6" data-testid="room-code-input" />
          </>
        )}
        <button className="go" disabled={busy} data-testid="room-submit-btn">
          {busy ? <Loader2 size={18} className="spin" /> : mode === "c" ? <Sparkles size={17} /> : <ArrowRight size={17} />}
          {mode === "c" ? t("create") : t("join")}
        </button>
        <p className="note">{t("home_note")}</p>
      </form>
    </main>
  );
}
