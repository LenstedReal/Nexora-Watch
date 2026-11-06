// Supported languages: Turkish, English, German.
import data from "./locales.json";

export const LANGS = [["tr", "Türkçe"], ["en", "English"], ["de", "Deutsch"]];
export const RTL = new Set(["ar"]);
export const FALLBACK = "en";
export default data;
