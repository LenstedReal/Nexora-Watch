import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { errorText, useT } from "@/i18n";
import { api } from "@/lib/api";

const MAX = 1024 * 1024;
const OWN = new Set(["direct", "hls", "upload"]);

/** .srt or .vtt text -> WebVTT (cue numbers may stay: WebVTT allows cue identifiers). */
export function toVtt(text) {
  let s = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (s.startsWith("WEBVTT")) return `${s}\n`;
  s = s.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${s}\n`;
}

// Host only, our own player only (not YouTube or other embeds): one subtitle file for the current video.
export const SubtitlePanel = ({ code, ident, video, onRoom }) => {
  const t = useT();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  if (!video || !OWN.has(video.kind)) return null;
  const sub = video.subtitle;

  const send = async (body) => {
    setBusy(true);
    try {
      onRoom(await api.setSubtitle(code, ident, body));
      return true;
    } catch (ex) {
      toast.error(errorText(t, ex));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(srt|vtt)$/i.test(file.name)) return toast.error(t("sub_type"));
    if (file.size > MAX) return toast.error(t("err_subtitle_too_large"));
    const vtt = toVtt(await file.text());
    if (new Blob([vtt]).size > MAX) return toast.error(t("err_subtitle_too_large"));
    if (await send({ name: file.name, vtt })) toast.success(t("sub_added"));
    return undefined;
  };

  return (
    <section className="src-card sub-card" data-testid="subtitle-panel">
      <div className="src-head">
        <b>{sub ? sub.name : t("sub_title")}</b>
        {busy ? <Loader2 size={15} className="spin" /> : sub ? (
          <button className="q-act" onClick={() => send({ clear: true })} aria-label={t("sub_remove")} title={t("sub_remove")} data-testid="subtitle-remove-btn"><X size={15} /></button>
        ) : (
          <button className="q-act" onClick={() => input.current?.click()} aria-label={t("sub_add")} title={t("sub_add")} data-testid="subtitle-add-btn"><Upload size={15} /></button>
        )}
      </div>
      <input ref={input} type="file" accept=".srt,.vtt,text/vtt" hidden onChange={pick} data-testid="subtitle-file-input" />
    </section>
  );
};
