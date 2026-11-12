import { useState } from "react";
import { Link2, Upload, Loader2, Film, PlayCircle, Globe } from "lucide-react";
import { toast } from "sonner";
import { errorText, useT } from "@/i18n";
import { api } from "@/lib/api";
import { UploadPanel } from "./UploadPanel";
import { inApp, pickFromNativeBrowser } from "@/lib/native";

// A phone shows this panel in the "Video" tab and a wide screen next to the player: two copies can exist at once.
// Whatever must survive closing the tab (upload, Drive import) therefore comes from the room: `upload` and `drive`.
export const SourcePanel = ({ code, ident, video, upload, drive, onRoom }) => {
  const t = useT();
  const [tab, setTab] = useState("link");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const imp = drive.imp;
  const isDrive = /drive\.google\.com/i.test(url);

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      if (isDrive) {
        await drive.start(url.trim());
        setUrl("");
      } else {
        onRoom(await api.setVideo(code, ident, url.trim()));
        setUrl("");
      }
    } catch (ex) {
      setErr(ex);
      toast.error(errorText(t, ex));
    } finally {
      setBusy(false);
    }
  };

  const browse = async () => {
    const res = await pickFromNativeBrowser();
    if (!res) return;
    setBusy(true);
    setErr(null);
    try {
      onRoom(await api.setVideo(code, ident, res.url, { referer: res.referer || undefined, title: res.title || undefined }));
    } catch (ex) {
      setErr(ex);
      toast.error(errorText(t, ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="src-card" data-testid="source-panel">
      <div className="src-head">
        {video ? <PlayCircle size={16} className="ok-c" /> : <Film size={16} />}
        <b data-testid="source-title">{video ? video.title || video.url : t("add_video")}</b>
        {video && <span className="np">{t("now_playing")}</span>}
      </div>
      <div className="seg">
        <button className={tab === "link" ? "on" : ""} onClick={() => setTab("link")} data-testid="source-tab-link"><Link2 size={14} /> {t("share_link")}</button>
        <button className={tab === "upload" ? "on" : ""} onClick={() => setTab("upload")} data-testid="source-tab-upload"><Upload size={14} /> {t("upload_video")}</button>
      </div>
      {tab === "link" ? (
        <form className="row" onSubmit={submit}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("url_ph")} data-testid="source-url-input" />
          <button className="set" disabled={busy} data-testid="source-set-btn">{busy ? <Loader2 size={15} className="spin" /> : t("set")}</button>
        </form>
      ) : (
        <UploadPanel upload={upload} />
      )}
      {tab === "link" && inApp() && (
        <button className="browse" onClick={browse} disabled={busy} data-testid="source-browse-btn"><Globe size={15} /> {t("browse_sites")}</button>
      )}
      {tab === "link" && isDrive && <div className="hint" data-testid="drive-hint">{t("drive_hint")}</div>}
      {imp && (
        <div className="drive-prog" data-testid="drive-progress">
          <span>{t("drive_importing")} · {imp.filename}</span>
          <div className="bar"><i style={{ width: `${imp.size ? Math.min(100, Math.round((imp.done / imp.size) * 100)) : 5}%` }} /></div>
        </div>
      )}
      {err && tab === "link" && <div className="inline-err" data-testid="source-error">{errorText(t, err)}</div>}
    </section>
  );
};
