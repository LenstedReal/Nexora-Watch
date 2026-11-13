import { useState } from "react";
import { ListVideo, Loader2, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { errorText, useT } from "@/i18n";
import { api } from "@/lib/api";

// "Sıra": everyone adds links and votes; only the host plays or removes items. The server keeps the order (votes, then time).
export const QueuePanel = ({ code, ident, queue, isHost, onRoom }) => {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(null); // "add" or an item id
  const items = queue || [];
  const me = ident.participant_id;

  const run = async (key, fn) => {
    setBusy(key);
    try {
      return await fn();
    } catch (ex) {
      toast.error(errorText(t, ex));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const link = url.trim();
    if (!link) return;
    const res = await run("add", () => api.queueAdd(code, ident, link));
    if (res) {
      setUrl("");
      toast.success(t("q_added"));
    }
  };

  const play = (id) => run(id, async () => {
    const res = await api.queueNext(code, ident, { item_id: id });
    if (res?.room) onRoom(res.room);
  });

  return (
    <section className="src-card q-card" data-testid="queue-panel">
      <div className="src-head">
        <ListVideo size={16} />
        <b>{t("q_title")}</b>
        <span className="q-n" data-testid="queue-count">{items.length}</span>
      </div>
      <form className="row" onSubmit={add}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("q_ph")} data-testid="queue-url-input" />
        <button className="set" disabled={busy === "add"} aria-label={t("q_add")} title={t("q_add")} data-testid="queue-add-btn">
          {busy === "add" ? <Loader2 size={15} className="spin" /> : <><Plus size={15} /> <span className="q-add-lbl">{t("q_add")}</span></>}
        </button>
      </form>
      {items.length === 0 ? (
        <div className="q-empty" data-testid="queue-empty">{t("q_empty")}</div>
      ) : (
        <ol className="q-list" data-testid="queue-list">
          {items.map((it) => {
            const voted = it.votes.includes(me);
            return (
              <li key={it.id} data-testid="queue-item" data-id={it.id}>
                <div className="q-txt">
                  <b title={it.url}>{it.title || it.url}</b>
                  {it.added_by_name && <span>{t("q_by", { name: it.added_by_name })}</span>}
                </div>
                <button className={`q-vote${voted ? " on" : ""}`} aria-pressed={voted} aria-label={t("q_vote")} title={t("q_vote")}
                  disabled={busy === it.id} onClick={() => run(it.id, () => api.queueVote(code, ident, it.id))} data-testid="queue-vote-btn">
                  <span aria-hidden="true">👍</span> <i data-testid="queue-votes">{it.votes.length}</i>
                </button>
                {isHost && (
                  <>
                    <button className="q-act" aria-label={t("q_play")} title={t("q_play")} disabled={busy === it.id} onClick={() => play(it.id)} data-testid="queue-play-btn"><Play size={15} /></button>
                    <button className="q-act" aria-label={t("q_remove")} title={t("q_remove")} disabled={busy === it.id} onClick={() => run(it.id, () => api.queueRemove(code, ident, it.id))} data-testid="queue-remove-btn"><X size={15} /></button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {items.length > 0 && <div className="q-foot">{t(isHost ? "q_auto" : "q_guest")}</div>}
    </section>
  );
};
