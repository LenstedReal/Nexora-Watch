import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Zap, Youtube, Film, Upload, Sparkles, ArrowRight, Loader2, Globe, History, ChevronRight, RefreshCw, ScanSearch,
  MessageCircle, ShieldCheck, Download, Smartphone, MonitorPlay, ChevronDown, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { errorText, useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { lastNickname, saveIdent, saveNickname } from "@/lib/session";
import { useAppConfig } from "@/lib/config";
import { SiteFooter } from "@/pages/Legal";
import "@/landing.css";

const recentRooms = () => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith("nx:ident:"))
      .map((k) => {
        const v = JSON.parse(localStorage.getItem(k) || "null");
        return v && { code: k.slice(9), nickname: v.nickname || "" };
      })
      .filter((r) => r && /^[A-Z2-9]{6}$/.test(r.code))
      .slice(-5)
      .reverse();
  } catch {
    return [];
  }
};

const FEATURES = [
  { icon: RefreshCw, k: "f1" },
  { icon: ScanSearch, k: "f2", note: true },
  { icon: Youtube, k: "f3" },
  { icon: Upload, k: "f4" },
  { icon: MessageCircle, k: "f5" },
  { icon: ShieldCheck, k: "f6" },
];

const FAQ = ["1", "2", "3", "4", "5"];

function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState(0);
  return (
    <div className="lp-faq">
      {FAQ.map((n, i) => (
        <div key={n} className={`lp-faq-item ${open === i ? "open" : ""}`}>
          <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span>{t(`q${n}`)}</span>
            <ChevronDown size={18} />
          </button>
          {open === i && <p>{t(`a${n}`)}</p>}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { t, lang, setLang, langs } = useI18n();
  const cfg = useAppConfig();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("join") ? "j" : "c");
  const [nick, setNick] = useState(lastNickname());
  const [name, setName] = useState("");
  const [code, setCode] = useState((params.get("join") || "").toUpperCase());
  const [busy, setBusy] = useState(false);
  const [recent] = useState(recentRooms);
  const formRef = useRef(null);

  useEffect(() => {
    document.title = "Nexora Watch — Better than Rave";
    if (params.get("join")) formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [params]);

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

  const toForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  const storeUrl = cfg.play_url || cfg.apk_url;

  return (
    <div className="lp" data-testid="home-page">
      <div className="lp-bg" aria-hidden="true">
        <span className="orb o1" />
        <span className="orb o2" />
        <span className="orb o3" />
        <span className="grid" />
      </div>

      <header className="lp-nav">
        <a className="lp-brand" href="/">
          <img src="/branding/logo-256.jpg" alt="" />
          <span>Nexora<b>Watch</b></span>
        </a>
        <div className="lp-nav-r">
          <label className="lang"><Globe size={13} />
            <select value={lang} onChange={(e) => setLang(e.target.value)} data-testid="language-select">
              {langs.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <a className="lp-nav-cta" href={storeUrl} target="_blank" rel="noreferrer"><Download size={15} /> {t("lp_download")}</a>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-badge" data-testid="hero-chip"><Zap size={13} /> Better than Rave</span>
          <h1 className="lp-title" data-testid="hero-title">
            {t("lp_title_a")} <span className="grad">{t("lp_title_b")}</span>
          </h1>
          <p className="lp-pitch">{t("lp_pitch")}</p>
          <div className="lp-ctas">
            {cfg.play_url ? (
              <a className="lp-btn primary" href={cfg.play_url} target="_blank" rel="noreferrer" data-testid="cta-store">
                <Smartphone size={18} /> {t("lp_play")}
              </a>
            ) : (
              <a className="lp-btn primary" href={cfg.apk_url} target="_blank" rel="noreferrer" data-testid="cta-store">
                <Download size={18} /> {t("lp_apk")}
              </a>
            )}
            <button className="lp-btn ghost" onClick={toForm} data-testid="cta-web">
              <MonitorPlay size={18} /> {t("lp_web")}
            </button>
          </div>
          {!cfg.play_url && <p className="lp-soon"><Sparkles size={13} /> {t("lp_soon")}</p>}
          <div className="lp-src">
            <span><Youtube size={13} /> YouTube</span><span><Film size={13} /> MP4 / HLS</span>
            <span><Upload size={13} /> {t("upload_video")}</span><span><Lock size={13} /> {t("lp_noacc")}</span>
          </div>
        </div>

        <div className="lp-hero-side" ref={formRef}>
          <form className="card lp-card" onSubmit={go} data-testid="room-form">
            <div className="lp-card-h">
              <b>{t("lp_start")}</b>
              <span>{t("lp_start_sub")}</span>
            </div>
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
            <p className="note">
              {t("lp_accept")} <Link to="/kosullar">{t("lp_terms")}</Link> · <Link to="/gizlilik">{t("lp_privacy")}</Link>
            </p>
          </form>

          {recent.length > 0 && (
            <section className="recent lp-recent" data-testid="recent-rooms">
              <div className="recent-h"><History size={14} /> {t("recent_rooms")}</div>
              {recent.map((r) => (
                <button key={r.code} className="recent-row" onClick={() => nav(`/room/${r.code}`)} data-testid={`recent-room-${r.code}`}>
                  <span className="recent-code">{r.code}</span>
                  <span className="recent-nick">{r.nickname}</span>
                  <span className="recent-go">{t("rejoin")} <ChevronRight size={14} /></span>
                </button>
              ))}
            </section>
          )}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-sec-h">
          <span className="lp-kicker">{t("lp_k_feat")}</span>
          <h2>{t("lp_h_feat")}</h2>
        </div>
        <div className="lp-features">
          {FEATURES.map(({ icon: Icon, k, note }) => (
            <article key={k} className="lp-feature">
              <span className="lp-ic"><Icon size={20} /></span>
              <h3>{t(`${k}_t`)}</h3>
              <p>{t(`${k}_d`)}</p>
              {note && <small>{t(`${k}_n`)}</small>}
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-sec-h">
          <span className="lp-kicker">{t("lp_k_how")}</span>
          <h2>{t("lp_h_how")}</h2>
        </div>
        <ol className="lp-steps">
          {[1, 2, 3].map((n) => (
            <li key={n}><b>{n}</b><div><h3>{t(`s${n}_t`)}</h3><p>{t(`s${n}_d`)}</p></div></li>
          ))}
        </ol>
      </section>

      <section className="lp-section">
        <div className="lp-sec-h">
          <span className="lp-kicker">{t("lp_k_sites")}</span>
          <h2>{t("lp_h_sites")}</h2>
          <p>{t("lp_p_sites")}</p>
        </div>
        <div className="lp-sites">
          {cfg.allowed_sites.map((s) => (
            <span key={s.domain} className="lp-site"><Globe size={14} /> {s.name}<small>{s.domain}</small></span>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-sec-h">
          <span className="lp-kicker">{t("lp_k_faq")}</span>
          <h2>{t("lp_h_faq")}</h2>
        </div>
        <Faq />
      </section>

      <section className="lp-section lp-final">
        <h2>{t("lp_final")}</h2>
        <div className="lp-ctas center">
          <a className="lp-btn primary" href={storeUrl} target="_blank" rel="noreferrer">
            <Download size={18} /> {cfg.play_url ? t("lp_play") : t("lp_apk")}
          </a>
          <button className="lp-btn ghost" onClick={toForm}><MonitorPlay size={18} /> {t("lp_web")}</button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
