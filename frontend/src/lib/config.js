import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export const DEFAULT_CONFIG = {
  allowed_sites: [
    { domain: "youtube.com", name: "YouTube" },
    { domain: "vimeo.com", name: "Vimeo" },
    { domain: "twitch.tv", name: "Twitch" },
    { domain: "kick.com", name: "Kick" },
    { domain: "archive.org", name: "Internet Archive" },
    { domain: "drive.google.com", name: "Google Drive" },
  ],
  web_url: "https://nexora.lenstedreal.info",
  play_url: "",
  apk_url: "https://github.com/LenstedReal/Nexora-Watch/releases/latest",
  contact_email: "contact.nexorawatch@protonmail.com",
  min_age: 16,
  owner: { name: "", address: "" },
};

let cache = null;

/** Public app config from GET /api/config, with safe defaults when the API is unreachable. */
export function useAppConfig() {
  const [cfg, setCfg] = useState(cache || DEFAULT_CONFIG);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    api
      .config()
      .then((c) => {
        cache = { ...DEFAULT_CONFIG, ...c, allowed_sites: c?.allowed_sites?.length ? c.allowed_sites : DEFAULT_CONFIG.allowed_sites };
        if (alive) setCfg(cache);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
}
