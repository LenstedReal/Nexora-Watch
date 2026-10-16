// Source of truth: /app/packages/localization/locales.json (keep in sync via scripts/sync-locales.sh)
import data from "./locales.json";

export const LANGS = [
  ["tr", "Türkçe"], ["en", "English"], ["es", "Español"], ["pt", "Português"], ["de", "Deutsch"], ["fr", "Français"],
  ["it", "Italiano"], ["ru", "Русский"], ["ar", "العربية"], ["zh", "简体中文"], ["ja", "日本語"], ["ko", "한국어"],
];
export const RTL = new Set(["ar"]);
export const FALLBACK = "en";
export default data;
