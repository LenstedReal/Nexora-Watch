import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import data, { FALLBACK, LANGS, RTL } from "./locales";

const Ctx = createContext(null);

export function detect() {
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

/** Text for an API / WebSocket error ({code, message | detail}), in the reader's language. */
export function errorText(t, err) {
  if (!err) return "";
  const code = String(err.code || "");
  const known = (k) => {
    const s = t(k);
    return s === k ? "" : s;
  };
  // Answers that never reached our API (proxy errors) only carry an HTTP status.
  const byStatus = /^http_5\d\d$/.test(code) ? "err_server" : code === "http_429" ? "err_rate_limited" : code === "http_413" ? "err_too_large" : "";
  const text = (code && known(`err_${code}`)) || (byStatus && known(byStatus));
  if (text) return text;
  // No text for this code yet. The server's own sentence is Turkish, so only Turkish readers are shown it.
  const own = typeof err.message === "string" && err.message ? err.message : typeof err.detail === "string" ? err.detail : "";
  const turkish = typeof document !== "undefined" && document.documentElement.lang === "tr";
  return (turkish && own) || known("err_generic") || own || code || "error";
}

const TR_SUFFIX = {};
[["aıâáàãå", "ın"], ["eiéèêëîíìïä", "in"], ["ouôóòõûúù", "un"], ["öü", "ün"]].forEach(([vowels, suffix]) => [...vowels].forEach((v) => { TR_SUFFIX[v] = suffix; }));

/** Turkish "X's" with vowel harmony: Deniz'in, Ayşe'nin, Umut'un, Gül'ün. A name that does not end in a letter gets no suffix. */
export function trPossessive(name) {
  const low = name.trim().replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
  const last = low.slice(-1);
  if (!last || last.toUpperCase() === last.toLowerCase()) return name;
  const vowel = [...low].reverse().find((c) => TR_SUFFIX[c]);
  if (!vowel) return `${name}'in`;
  return `${name}'${TR_SUFFIX[last] ? "n" : ""}${TR_SUFFIX[vowel]}`;
}

/** Room name used when the field is left empty, in the creator's language. */
export const defaultRoomName = (t, lang, nickname) => t("default_room", { name: lang === "tr" ? trPossessive(nickname) : nickname }).slice(0, 48);

/** One line of a chat's system messages ("X joined"), in the reader's language; older messages only have the server's text. */
export function systemText(t, m) {
  if (m.event && m.subject) {
    const key = `sys_${m.event}`;
    const s = t(key, { name: m.subject });
    if (s !== key) return s;
  }
  return m.text;
}
