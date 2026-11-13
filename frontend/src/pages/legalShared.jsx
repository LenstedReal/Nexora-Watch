import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { useAppConfig } from "@/lib/config";
import { useI18n } from "@/i18n";
import "@/landing.css";

// Shared by Legal.jsx (Turkish texts) and LegalEn.jsx (English texts); kept separate to avoid circular imports.

// ---- Owner details (edit here) ------------------------------------------------------------------------------
// KVKK md.10 requires the data controller's identity. Fill in your full legal name (and, if you have one, a
// company title / KEP or postal address) before publishing on Google Play.
export const PACKAGE_ID = "com.lenstedreal.nexorawatch";

export const OWNER = {
  brand: "LenstedReal",
  controller: "LenstedReal (Nexora Watch geliştiricisi)",
  controllerEn: "LenstedReal (developer of Nexora Watch)",
  address: "", // e.g. "İl/İlçe, Türkiye" — optional, shown only when filled
};
const UPDATED = { tr: "13 Kasım 2026", en: "13 November 2026" };

const LABELS = {
  tr: {
    "/gizlilik": "Gizlilik Politikası",
    "/kosullar": "Kullanım Koşulları",
    "/kvkk": "KVKK Aydınlatma Metni",
    "/telif": "Telif Hakkı ve İçerik Kaldırma",
    "/veri-silme": "Veri Silme Talebi",
    "/cocuk-guvenligi": "Çocuk Güvenliği Standartları",
  },
  en: {
    "/gizlilik": "Privacy Policy",
    "/kosullar": "Terms of Use",
    "/kvkk": "KVKK Information Notice",
    "/telif": "Copyright and Content Removal",
    "/veri-silme": "Data Deletion Request",
    "/cocuk-guvenligi": "Child Safety Standards",
  },
};
const UI = {
  tr: { updated: "Son güncelleme", download: "İndir", lang: "Dil" },
  en: { updated: "Last updated", download: "Download", lang: "Language" },
};

/** Turkish labels (kept for existing importers); `legalPages(lang)` gives them in either language. */
export const legalPages = (lang = "tr") => Object.entries(LABELS[lang === "en" ? "en" : "tr"]).map(([path, label]) => ({ path, label }));
export const LEGAL_PAGES = legalPages("tr");

// ---- Language ---------------------------------------------------------------------------------------------
const LANG_KEY = "nx:legal-lang";
const valid = (l) => (l === "en" || l === "tr" ? l : null);
const stored = () => {
  try {
    return valid(localStorage.getItem(LANG_KEY));
  } catch {
    return null;
  }
};
const store = (l) => {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* storage disabled: the choice lasts for this page */
  }
};
/** App UI language mapped to the two legal languages: Turkish stays Turkish, anything else reads English. */
const uiLang = (i18n) => (i18n?.lang ? (i18n.lang === "tr" ? "tr" : "en") : null);

const LegalLangCtx = createContext(null);
export const useLegalLangCtx = () => useContext(LegalLangCtx);

/** ?lang=en|tr wins, then the saved legal choice, then the app UI language, then Turkish. */
function useLegalLangState() {
  const i18n = useI18n();
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const fromUrl = valid(new URLSearchParams(search).get("lang"));
  const [lang, setLangState] = useState(() => fromUrl || stored() || uiLang(i18n) || "tr");
  useEffect(() => {
    if (fromUrl) {
      setLangState(fromUrl);
      store(fromUrl); // in-text links and the TOC keep the language
    }
  }, [fromUrl]);
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.lang;
    root.lang = lang;
    // The app's I18nProvider sets <html lang> in its own (parent, so later) effect on first load: apply ours after it.
    const t = setTimeout(() => {
      root.lang = lang;
    }, 0);
    return () => {
      clearTimeout(t);
      root.lang = prev;
    };
  }, [lang]);
  const setLang = useCallback(
    (l) => {
      store(l);
      setLangState(l);
      const q = new URLSearchParams(search);
      q.set("lang", l);
      navigate(`${pathname}?${q}`, { replace: true }); // no reload
    },
    [navigate, pathname, search],
  );
  return { lang, setLang };
}

/** A legal page in both languages: `withLang(PrivacyTr, PrivacyEn)`. */
export function withLang(Tr, En) {
  return function LegalPage() {
    const value = useLegalLangState();
    return createElement(LegalLangCtx.Provider, { value }, createElement(value.lang === "en" ? En : Tr));
  };
}

// ---- Layout -----------------------------------------------------------------------------------------------
/** Footer with the legal links. On legal pages it follows the legal language, elsewhere the app UI language. */
export function SiteFooter({ lang: forced }) {
  const cfg = useAppConfig();
  const ctx = useLegalLangCtx();
  const i18n = useI18n();
  const lang = valid(forced) || ctx?.lang || uiLang(i18n) || "tr";
  return (
    <footer className="site-footer" lang={lang}>
      <div className="site-footer-in">
        <nav>
          {legalPages(lang).map((p) => (
            <Link key={p.path} to={p.path}>
              {p.label}
            </Link>
          ))}
        </nav>
        <a href={`mailto:${cfg.contact_email}`}>{cfg.contact_email}</a>
        <small>© {new Date().getFullYear()} {OWNER.brand} · Nexora Watch</small>
      </div>
    </footer>
  );
}

export function LegalLayout({ title, children }) {
  const cfg = useAppConfig();
  const { pathname } = useLocation();
  const ctx = useLegalLangCtx();
  const lang = ctx?.lang === "en" ? "en" : "tr";
  const ui = UI[lang];
  useEffect(() => {
    document.title = `${title} · Nexora Watch`;
    window.scrollTo(0, 0);
  }, [title]);
  return (
    <div className="legal">
      <div className="legal-top">
        <header className="lp-nav">
          <Link className="lp-brand" to="/">
            <img src="/branding/logo-256.jpg" alt="" />
            <span>
              Nexora<b>Watch</b>
            </span>
          </Link>
          {/* No download button before the app is on Google Play. */}
          {cfg.play_url && (
            <a className="lp-nav-cta" href={cfg.play_url} target="_blank" rel="noreferrer">
              <Download size={15} /> <span>{ui.download}</span>
            </a>
          )}
        </header>
      </div>
      <article className="legal-doc">
        <div className="legal-lang" role="group" aria-label={ui.lang}>
          {[
            ["tr", "TR"],
            ["en", "EN"],
          ].map(([k, v]) => (
            <button
              key={k}
              type="button"
              lang={k}
              className={lang === k ? "on" : ""}
              aria-pressed={lang === k}
              data-testid={`legal-lang-${k}`}
              onClick={() => ctx?.setLang(k)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="legal-toc">
          {legalPages(lang).map((p) => (
            <Link key={p.path} to={p.path} className={pathname === p.path ? "on" : ""}>
              {p.label}
            </Link>
          ))}
        </div>
        <h1>{title}</h1>
        <p className="updated">
          {ui.updated}: {UPDATED[lang]}
        </p>
        {/* Google Play reviewers look for the package name at the top of every policy page. */}
        <p className="legal-app" data-testid="legal-app">
          {lang === "en" ? (
            <>
              This text applies to the <b>Nexora Watch</b> Android app (package name <b>{PACKAGE_ID}</b>) and the website{" "}
              <b>nexora.lenstedreal.info</b>.
            </>
          ) : (
            <>
              Bu metin, <b>Nexora Watch</b> Android uygulaması (paket adı <b>{PACKAGE_ID}</b>) ve <b>nexora.lenstedreal.info</b> web
              sitesi için geçerlidir.
            </>
          )}
        </p>
        {children}
      </article>
      <SiteFooter />
    </div>
  );
}

// ---- Helpers used inside the texts ------------------------------------------------------------------------
/** Data controller from server config (OWNER_NAME / OWNER_ADDRESS in .env), falling back to OWNER. */
export const useOwner = () => {
  const cfg = useAppConfig();
  const en = useLegalLangCtx()?.lang === "en";
  const name = cfg.owner?.name?.trim();
  const suffix = en ? "developer of Nexora Watch" : "Nexora Watch geliştiricisi";
  return {
    controller: name ? `${name} (${OWNER.brand} — ${suffix})` : en ? OWNER.controllerEn : OWNER.controller,
    address: cfg.owner?.address?.trim() || OWNER.address,
  };
};
export const Ctl = () => useOwner().controller;
export const Addr = ({ pre = ", ", wrap }) => {
  const a = useOwner().address;
  if (!a) return null;
  return wrap ? ` (${a})` : `${pre}${a}`;
};

export const Mail = () => {
  const cfg = useAppConfig();
  return <a href={`mailto:${cfg.contact_email}`}>{cfg.contact_email}</a>;
};

const table = (head, rows) => (
  <table>
    <thead>
      <tr>
        <th>{head[0]}</th>
        <th>{head[1]}</th>
      </tr>
    </thead>
    <tbody>
      {rows.map(([a, b]) => (
        <tr key={a}>
          <td>{a}</td>
          <td>{b}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const RETENTION = table(
  ["Veri", "Saklama süresi"],
  [
    ["Oda bilgileri (oda adı, kod, katılımcı rumuzları), oynatma durumu", "Oda 24 saat sonra sona erer; kayıtlar sona ermeden itibaren en geç 24 saat içinde silinir."],
    ["Sohbet mesajları ve sistem mesajları", "Odanın sona ermesinden itibaren en geç 24 saat içinde silinir."],
    ["Yüklenen videolar ve Google Drive'dan içe aktarılan videolar", "Oda kapatıldıktan veya süresi dolduktan yaklaşık 1 saat sonra; her durumda yüklemeden itibaren en geç 7 gün içinde silinir."],
    ["Senkron ölçüm verileri (gecikme, sapma)", "Oda kayıtlarıyla birlikte silinir."],
    ["Şikâyet kayıtları ve ilgili mesaj kopyası", "İnceleme tamamlanana kadar, en fazla 180 gün; hukuki talep varsa yasal süre boyunca."],
    ["Güvenlik kayıtları (IP adresi, işlem kaydı)", "En fazla 90 gün; 5651 sayılı Kanun kapsamında gerekli olması hâlinde yasal süre boyunca."],
    ['Anonim cihaz kimliği, bildirim anahtarı, "Birlikte izlediklerin" listesi ve davetler', "Son kullanımdan itibaren en geç 90 gün içinde silinir; listeyi ve kişileri istediğin an kendin silebilirsin."],
    ["Hata raporları", "14 gün sonra otomatik silinir."],
    ["Sıra, oylar ve oda altyazıları", "Oda kayıtlarıyla birlikte silinir."],
    ["Cihazdaki oda anahtarı ve rumuz", "Yalnızca cihazında tutulur; uygulamayı silerek veya tarayıcı verilerini temizleyerek kaldırabilirsin."],
  ],
);

export const RETENTION_EN = table(
  ["Data", "Retention period"],
  [
    ["Room details (room name, code, participant nicknames), playback state", "Rooms expire after 24 hours; their records are deleted within 24 hours of expiry at the latest."],
    ["Chat messages and system messages", "Deleted within 24 hours of the room's expiry at the latest."],
    ["Uploaded videos and videos imported from Google Drive", "About 1 hour after the room is closed or expires; in any case no later than 7 days after upload."],
    ["Sync measurements (latency, drift)", "Deleted together with the room records."],
    ["Report records and the copy of the reported message", "Until the review is complete, for at most 180 days; for the statutory period if there is a legal claim."],
    ["Security logs (IP address, activity log)", "At most 90 days; for the statutory period where required under Turkish Law No. 5651."],
    ['Anonymous device ID, notification token, "People you watched with" list and invitations', "Deleted no later than 90 days after last use; you can delete the list and the people on it yourself at any time."],
    ["Error reports", "Deleted automatically after 14 days."],
    ["Queue, votes and room subtitles", "Deleted together with the room records."],
    ["Room key and nickname on your device", "Kept only on your device; you can remove them by uninstalling the app or clearing your browser data."],
  ],
);
