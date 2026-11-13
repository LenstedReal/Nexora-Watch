import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ClipboardPaste, ExternalLink, Info, Loader2, Search, X } from "lucide-react";
import { errorText, useT } from "@/i18n";
import { useAppConfig } from "@/lib/config";
import "@/browse.css";

// "Browse sites & find a video" on the web. The mobile app opens the supported site inside its own browser and finds
// the video itself. A web page cannot read another site, so here the site opens in a new tab and the person brings
// the link back: by the paste button, by typing it, or (once clipboard access was allowed) it is offered on return.

const isUrl = (s) => /^https?:\/\/\S+$/i.test(s);
const isDomain = (s) => /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s);
const siteHome = (domain) => `https://${domain === "youtube.com" ? "www.youtube.com" : domain}`;
// Sites whose page address is not enough: the room needs the address of the video file itself (the app finds it alone).
const FILE_LINK_SITES = new Set(["archive.org"]);
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

function parts(url) {
  try {
    const u = new URL(url);
    const rest = (u.pathname + u.search).replace(/^\/$/, "");
    return { host: u.host.replace(/^www\./, ""), rest: rest.length > 46 ? `${rest.slice(0, 45)}…` : rest };
  } catch {
    return { host: url.slice(0, 40), rest: "" };
  }
}

/** Text on the clipboard: {text}, or {reason: "unavailable" | "denied"}. Never throws. */
async function readClipboard() {
  if (!navigator.clipboard?.readText) return { reason: "unavailable" };
  try {
    return { text: String((await navigator.clipboard.readText()) || "").trim() };
  } catch {
    return { reason: "denied" };
  }
}

/** True only when the browser has already been given clipboard access: reading then asks nothing. */
async function clipboardAllowed() {
  try {
    return (await navigator.permissions.query({ name: "clipboard-read" })).state === "granted";
  } catch {
    return false; // browsers without this permission name ask on every read: we only read on a button press there
  }
}

export function BrowseSheet({ onClose, onBring }) {
  const t = useT();
  const cfg = useAppConfig();
  // Drive files are not browsed: their share link is pasted and the server imports the file.
  const sites = cfg.allowed_sites.filter((s) => s.domain !== "drive.google.com");
  const [step, setStep] = useState("sites"); // "sites" → "link"
  const [site, setSite] = useState(null); // {name, url, file}: what was opened in the other tab
  const [q, setQ] = useState("");
  const [link, setLink] = useState("");
  const [found, setFound] = useState(null); // a link seen on the clipboard, waiting for a click
  const [hint, setHint] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  const linkRef = useRef(null);
  const offered = useRef("");
  const alive = useRef(true);
  const busyRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Dialog behaviour: focus moves in and comes back, Tab stays inside, Escape closes, the page behind does not scroll.
  useEffect(() => {
    alive.current = true;
    const opener = document.activeElement;
    const box = boxRef.current;
    box?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const items = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === box)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !box.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      alive.current = false;
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  // Coming back from the other tab: when clipboard access is already allowed, a copied link is offered (never set).
  useEffect(() => {
    const look = async () => {
      if (document.visibilityState !== "visible" || !(await clipboardAllowed())) return;
      const res = await readClipboard();
      if (!alive.current || !res.text || !isUrl(res.text) || res.text === offered.current) return;
      offered.current = res.text;
      setFound(res.text);
    };
    look();
    document.addEventListener("visibilitychange", look);
    window.addEventListener("focus", look);
    return () => {
      document.removeEventListener("visibilitychange", look);
      window.removeEventListener("focus", look);
    };
  }, []);

  const bring = useCallback(async (raw) => {
    let url = String(raw || "").trim();
    if (!url || busyRef.current) return;
    if (!/^https?:\/\//i.test(url) && isDomain(url)) url = `https://${url}`;
    busyRef.current = true;
    setBusy(true);
    setErr(null);
    setHint("");
    try {
      await onBring(url);
      if (alive.current) closeRef.current();
    } catch (ex) {
      busyRef.current = false;
      if (!alive.current) return;
      setBusy(false);
      setErr(ex);
      setLink(url); // the answer is shown next to the link it is about
      setStep("link");
    }
  }, [onBring]);

  const toLinkStep = (opened) => {
    setSite(opened);
    setStep("link");
    setErr(null);
    setHint("");
  };

  const openSite = (s) => {
    const url = siteHome(s.domain);
    window.open(url, "_blank", "noopener");
    toLinkStep({ name: s.name, url, file: FILE_LINK_SITES.has(s.domain) });
  };

  const search = (e) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (isUrl(v) || isDomain(v)) {
      const url = isUrl(v) ? v : `https://${v}`;
      const { host, rest } = parts(url);
      const home = !rest && sites.find((s) => host === s.domain || host.endsWith(`.${s.domain}`));
      setQ("");
      if (home) {
        openSite(home); // just a supported site's address: open it, as the app does
        return;
      }
      setLink(url);
      toLinkStep(null);
      setTimeout(() => linkRef.current?.focus(), 0);
      return;
    }
    // Free text is searched on YouTube (a supported site), not on the open web.
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(v)}`;
    window.open(url, "_blank", "noopener");
    setQ("");
    toLinkStep({ name: "YouTube", url });
  };

  const paste = async () => {
    if (busyRef.current) return;
    setErr(null);
    const res = await readClipboard();
    if (!alive.current) return;
    if (res.text && (isUrl(res.text) || isDomain(res.text))) {
      setHint("");
      setLink(res.text);
      offered.current = res.text;
      setFound(null);
      bring(res.text);
      return;
    }
    setHint(t(res.reason ? "bs_paste_denied" : "bs_paste_empty"));
    linkRef.current?.focus();
  };

  const foundParts = found ? parts(found) : null;
  const foundCard = found && (
    <div className="bs-found" data-testid="browse-found">
      <div className="bs-found-t">
        <small>{t("bs_found")}</small>
        <b>{foundParts.host}</b>
        {foundParts.rest && <span>{foundParts.rest}</span>}
      </div>
      <button type="button" className="set" onClick={() => bring(found)} disabled={busy} data-testid="browse-found-bring">{t("bs_bring")}</button>
      <button type="button" className="bs-x" onClick={() => setFound(null)} aria-label={t("bs_dismiss")} title={t("bs_dismiss")} data-testid="browse-found-dismiss"><X size={16} /></button>
    </div>
  );

  return createPortal(
    <div className="bs-bg" data-testid="browse-sheet-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bs" role="dialog" aria-modal="true" aria-labelledby="bs-title" tabIndex={-1} ref={boxRef} data-testid="browse-sheet" data-step={step}>
        <header className="bs-top">
          <button type="button" className="ib" onClick={onClose} aria-label={t("close")} title={t("close")} data-testid="browse-close"><X size={20} /></button>
          <form className="bs-search" onSubmit={search} role="search">
            <Search size={15} aria-hidden="true" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("bs_ph")} aria-label={t("bs_ph")}
              enterKeyHint="go" autoCapitalize="none" autoCorrect="off" spellCheck={false} data-testid="browse-search"
            />
          </form>
        </header>

        <div className="bs-body">
          {step === "sites" ? (
            <>
              {foundCard}
              <h2 id="bs-title">{t("bs_title")}</h2>
              <p className="bs-sub">{t("bs_sub")}</p>
              <div className="bs-grid" data-testid="browse-sites">
                {sites.map((s) => (
                  <button type="button" key={s.domain} className="bs-site" onClick={() => openSite(s)} data-testid={`browse-site-${s.domain}`}>
                    <span className="bs-tile" aria-hidden="true">{s.name.slice(0, 1)}</span>
                    <b>{s.name}</b>
                    <small>{s.domain}</small>
                    <ExternalLink className="bs-ext" size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p className="bs-note" data-testid="browse-web-note">{t("bs_web_note")}</p>
              <div className="bs-legal"><Info size={16} aria-hidden="true" /><span>{t("bs_legal")}</span></div>
            </>
          ) : (
            <>
              <button type="button" className="bs-back" onClick={() => { setStep("sites"); setErr(null); setHint(""); }} data-testid="browse-back"><ArrowLeft size={16} /> {t("bs_title")}</button>
              <h2 id="bs-title" data-testid="browse-link-title">{site ? t("bs_opened", { site: site.name }) : t("bs_link_title")}</h2>
              {site && (
                <ol className="bs-steps" data-testid="browse-steps">
                  <li>{t("bs_step1")}</li>
                  <li>{t(site.file ? "bs_step2_file" : "bs_step2")}</li>
                  <li>{t("bs_step3")}</li>
                </ol>
              )}
              {foundCard}
              <button type="button" className="bs-paste" onClick={paste} disabled={busy} data-testid="browse-paste">
                {busy ? <Loader2 size={18} className="spin" /> : <ClipboardPaste size={18} />} {t("bs_paste")}
              </button>
              <form className="bs-link" onSubmit={(e) => { e.preventDefault(); bring(link); }}>
                <input
                  ref={linkRef} value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("bs_link_ph")} aria-label={t("bs_link_ph")}
                  inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} data-testid="browse-link-input"
                />
                <button className="set" disabled={busy || !link.trim()} data-testid="browse-bring">{busy ? <Loader2 size={15} className="spin" /> : t("bs_bring")}</button>
              </form>
              {hint && <p className="bs-hint" role="status" data-testid="browse-hint">{hint}</p>}
              {err && <p className="bs-err" role="alert" data-testid="browse-error">{errorText(t, err)}</p>}
              {site && <a className="bs-reopen" href={site.url} target="_blank" rel="noopener noreferrer" data-testid="browse-reopen"><ExternalLink size={14} /> {t("bs_reopen")}</a>}
              <p className="bs-note" data-testid="browse-web-note">{t("bs_web_note")}</p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
