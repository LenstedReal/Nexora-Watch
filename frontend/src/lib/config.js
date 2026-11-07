import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export const DEFAULT_CONFIG = {
  allowed_sites: [
    { domain: "youtube.com", name: "YouTube" },
    { domain: "twitch.tv", name: "Twitch" },
    { domain: "kick.com", name: "Kick" },
    { domain: "rumble.com", name: "Rumble" },
    { domain: "odysee.com", name: "Odysee" },
    { domain: "dailymotion.com", name: "Dailymotion" },
    { domain: "vimeo.com", name: "Vimeo" },
    { domain: "streamable.com", name: "Streamable" },
    { domain: "reddit.com", name: "Reddit" },
    { domain: "x.com", name: "X (Twitter)" },
    { domain: "twitter.com", name: "Twitter" },
    { domain: "facebook.com", name: "Facebook" },
    { domain: "bilibili.tv", name: "Bilibili" },
    { domain: "archive.org", name: "Internet Archive" },
    { domain: "drive.google.com", name: "Google Drive" },
  ],
  web_url: "https://nexora.lenstedreal.info",
  play_url: "",
  apk_url: "https://github.com/LenstedReal/Nexora-Watch/releases/latest",
  contact_email: "destek@lenstedreal.info",
  min_age: 13,
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
