import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import data, { FALLBACK, LANGS, RTL } from "./locales";

const Ctx = createContext(null);

function detect() {
  let saved = null;
  try {
    saved = localStorage.getItem("nx:lang");
  } catch {
    /* storage disabled */
  }
  if (saved && data[saved]) return saved;
  const nav = (navigator.language || "tr").slice(0, 2).toLowerCase();
  return data[nav] ? nav : "tr";
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detect);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.has(lang) ? "rtl" : "ltr";
  }, [lang]);
  const setLang = useCallback((l) => {
    try {
      localStorage.setItem("nx:lang", l);
    } catch {
      /* storage disabled: the choice lasts for this visit */
    }
    setLangState(l);
  }, []);
  const t = useCallback(
    (key, vars) => {
      const s = data[lang]?.[key] ?? data[FALLBACK][key] ?? data.tr[key] ?? key;
      return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : s;
    },
    [lang],
  );
  const value = useMemo(() => ({ lang, setLang, t, langs: LANGS }), [lang, setLang, t]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;

export function errorText(t, err) {
  if (!err) return "";
  const key = `err_${err.code}`;
  const s = t(key);
  return s === key ? err.message || String(err) : s;
}
