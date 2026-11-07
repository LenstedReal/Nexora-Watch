import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, MessageCircle, Users, Film } from "lucide-react";
import { toast } from "sonner";
import { errorText, useT } from "@/i18n";
import { api } from "@/lib/api";
import { clearIdent, getIdent, lastNickname, saveIdent, saveNickname } from "@/lib/session";
import { useRoomConnection } from "@/hooks/useRoomConnection";
import { usePlaybackSync } from "@/hooks/usePlaybackSync";
import { useUpload } from "@/hooks/useUpload";
import { Stage } from "@/components/player/Stage";
import { TopBar } from "@/components/room/TopBar";
import { ConnectionBanner } from "@/components/room/ConnectionBanner";
import { SourcePanel } from "@/components/room/SourcePanel";
import { PeopleList, PeopleStrip } from "@/components/room/Participants";
import { Chat } from "@/components/room/Chat";

const Gate = ({ title, children }) => {
  const nav = useNavigate();
  const t = useT();
  return (
    <main className="gate" data-testid="room-gate">
      <img className="logo" src="/branding/logo-256.jpg" alt="" />
      <h2 data-testid="room-gate-title">{title}</h2>
      {children}
      <button className="btn" onClick={() => nav("/")} data-testid="gate-home-btn">{t("home")}</button>
    </main>
  );
};

const GATE_KEYS = { room_closed: "closed_title", room_expired: "expired_title", room_not_found: "notfound_title", kicked: "kicked_title" };

export default function RoomPage() {
  const { code: raw } = useParams();
  const code = raw.toUpperCase();
  const t = useT();
  const loc = useLocation();
  const [ident, setIdent] = useState(() => getIdent(code));
  const [room, setRoom] = useState(loc.state?.room || null);
  const [gate, setGate] = useState(null);
  const [nick, setNick] = useState(lastNickname());

  const join = useCallback(async (nickname, existing) => {
    try {
      const res = await api.joinRoom(code, nickname, existing);
      const next = { participant_id: res.participant.id, token: res.token, nickname };
      saveIdent(code, next);
      saveNickname(nickname);
      setRoom(res.room);
      setIdent(next);
      setGate(null);
    } catch (e) {
      if (e.status === 404 || e.status === 410) setGate(e.code);
      else setGate({ error: e });
    }
  }, [code]);

  useEffect(() => {
    if (ident && !room) join(ident.nickname, ident);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (gate && GATE_KEYS[gate]) return <Gate title={t(GATE_KEYS[gate])} />;
  if (gate?.error) {
    return (
      <Gate title={errorText(t, gate.error)}>
        <button className="go" onClick={() => join(ident?.nickname || nick, ident)} data-testid="room-join-retry-btn">{t("retry")}</button>
      </Gate>
    );
  }
  if (!ident) {
    return (
      <Gate title={`${t("join_title")} · ${code}`}>
        <form className="card slim" onSubmit={(e) => { e.preventDefault(); if (nick.trim()) join(nick.trim()); else toast.error(t("need_nickname")); }}>
          <label>{t("nickname")}</label>
          <input value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} placeholder={t("nickname_ph")} data-testid="invite-nickname-input" />
          <button className="go" data-testid="invite-join-btn">{t("join")}</button>
        </form>
      </Gate>
    );
  }
  if (!room) return <main className="gate"><Loader2 className="spin" size={28} /></main>;
  return <RoomView code={code} ident={ident} initialRoom={room} onIdentLost={() => { clearIdent(code); setIdent(null); setRoom(null); }} />;
}

function RoomView({ code, ident, initialRoom, onIdentLost }) {
  const t = useT();
  const nav = useNavigate();
  const playerRef = useRef(null);
  const [tab, setTab] = useState("chat");
  const [unread, setUnread] = useState(0);
  const [reporting, setReporting] = useState(null);
  const conn = useRoomConnection(code, ident, initialRoom, (e) => toast.error(errorText(t, e)));
  const { room } = conn;
  const isHost = room.host_id === ident.participant_id;
  const sync = usePlaybackSync({ room, isHost, conn, playerRef, ident });
  const upload = useUpload({ code, ident });
  const msgCount = conn.messages.length;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    if (conn.status === "unauthorized") onIdentLost();
  }, [conn.status, onIdentLost]);
  useEffect(() => { document.title = `${room.name} · Nexora Watch`; }, [room.name]);
  useEffect(() => { if (tabRef.current !== "chat") setUnread((u) => u + 1); }, [msgCount]);
  const switchTab = (k) => { setTab(k); if (k === "chat") setUnread(0); };

  if (GATE_KEYS[conn.status]) return <Gate title={t(GATE_KEYS[conn.status])} />;
  if (conn.status === "replaced") return <Gate title={t("replaced")} />;

  const send = (v) => conn.sendChat(v).catch((e) => toast.error(errorText(t, e)));
  const report = (person, messageId) => setReporting({ person, messageId });
  const submitReport = async (reason) => {
    const r = reporting;
    setReporting(null);
    if (!r) return;
    try {
      await api.report(code, ident, { target_id: r.person?.id || null, message_id: r.messageId || null, reason });
      toast.success(t("report_sent"));
    } catch (e) {
      toast.error(errorText(t, e));
    }
  };
  const kick = async (person) => {
    if (!window.confirm(`${person.nickname} — ${t("kick_confirm")}`)) return;
    try {
      conn.setRoom(await api.kick(code, ident, person.id));
    } catch (e) {
      toast.error(errorText(t, e));
    }
  };
  const leave = async () => {
    await api.leave(code, ident).catch(() => {});
    nav("/");
  };
  const close = async () => {
    if (!window.confirm(t("close_confirm"))) return;
    try { await api.close(code, ident); } catch (e) { toast.error(errorText(t, e)); }
  };
  const source = isHost ? <SourcePanel code={code} ident={ident} video={room.video} upload={upload} onRoom={conn.setRoom} /> : null;

  return (
    <div className="room" data-testid="room-page">
      <TopBar room={room} status={conn.status} attempt={conn.attempt} isHost={isHost} onBack={() => nav("/")} onLeave={leave} onClose={close} />
      <ConnectionBanner status={conn.status} attempt={conn.attempt} onRetry={conn.retryNow} />
      <div className="body">
        <section className="main">
          <Stage video={room.video} playback={room.playback} isHost={isHost} ident={ident} playerRef={playerRef} sync={sync} onAddVideo={() => switchTab("video")} />
          {room.video && room.video.capabilities?.sync === false && <div className="hint">{t("no_sync")}</div>}
          {source && <div className="desk-only">{source}</div>}
        </section>
        <aside className="side">
          <nav className="tabs-bar mob-only" data-testid="room-tabs">
            <button className={tab === "chat" ? "on" : ""} onClick={() => switchTab("chat")} data-testid="tab-chat"><MessageCircle size={16} /> {t("chat")}{unread > 0 && tab !== "chat" && <span className="badge" data-testid="chat-unread">{unread}</span>}</button>
            <button className={tab === "people" ? "on" : ""} onClick={() => switchTab("people")} data-testid="tab-people"><Users size={16} /> {t("people")}</button>
            {isHost && <button className={tab === "video" ? "on" : ""} onClick={() => switchTab("video")} data-testid="tab-video"><Film size={16} /> {t("video")}</button>}
          </nav>
          <div className="desk-only"><PeopleStrip room={room} me={ident.participant_id} /></div>
          <div className="pane">
            {tab === "people" && <div className="pane-sec mob-only"><PeopleList room={room} me={ident.participant_id} peerState={conn.peerState} isHost={isHost} onReport={report} onKick={kick} /></div>}
            {tab === "video" && isHost && <div className="pane-sec mob-only video-mob">{source}</div>}
            <div className={`pane-sec chat-sec ${tab === "chat" ? "" : "hidden"}`}>
              <Chat messages={conn.messages} me={ident.participant_id} onSend={send} onReport={(m) => report({ id: m.participant_id, nickname: m.nickname }, m.id)} />
            </div>
          </div>
        </aside>
      </div>
      {reporting && (
        <div className="modal-bg" onClick={() => setReporting(null)} data-testid="report-dialog">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <b>{t("report_title")}{reporting.person?.nickname ? ` · ${reporting.person.nickname}` : ""}</b>
            {[["spam", "Spam"], ["abuse", t("reason_abuse")], ["sexual", t("reason_sexual")], ["violence", t("reason_violence")], ["copyright", t("reason_copyright")], ["other", t("reason_other")]].map(([k, label]) => (
              <button key={k} onClick={() => submitReport(k)} data-testid={`report-reason-${k}`}>{label}</button>
            ))}
            <button className="cancel" onClick={() => setReporting(null)}>{t("cancel")}</button>
          </div>
        </div>
      )}
      {conn.reactions.map((r) => <div key={r.id} className="fly" style={{ left: `${r.left}%` }}>{r.emoji}</div>)}
    </div>
  );
}
