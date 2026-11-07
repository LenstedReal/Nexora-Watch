import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useT } from "@/i18n";

const KEY = "nx.consent.v1";
const LEGAL = ["/gizlilik", "/kosullar", "/kvkk", "/telif", "/veri-silme", "/cocuk-guvenligi"];

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Age (13+) and terms confirmation, shown once on web and in the app (Play Console / KVKK requirement). */
export function ConsentGate({ children }) {
  const t = useT();
  const { pathname } = useLocation();
  const [ok, setOk] = useState(read);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  if (ok || LEGAL.includes(pathname)) return children;
  const accept = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: ask again next time */
    }
    setOk(true);
  };
  return (
    <main className="gate consent" data-testid="consent-gate">
      <img className="logo" src="/branding/logo-256.jpg" alt="" />
      <h2>{t("age_title")}</h2>
      <label className="chk">
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} data-testid="consent-age" />
        <span>{t("age_13")}</span>
      </label>
      <label className="chk">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} data-testid="consent-terms" />
        <span>{t("age_terms")}</span>
      </label>
      <p className="note">
        <Link to="/kosullar">{t("lp_terms")}</Link> · <Link to="/gizlilik">{t("lp_privacy")}</Link> · <Link to="/kvkk">KVKK</Link>
      </p>
      <button className="go" disabled={!age || !terms} onClick={accept} data-testid="consent-accept">{t("age_go")}</button>
    </main>
  );
}
