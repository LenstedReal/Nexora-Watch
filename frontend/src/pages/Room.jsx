import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorText, useT } from "@/i18n";
import { api } from "@/lib/api";
import { clearIdent, getIdent, lastNickname, saveIdent, saveNickname } from "@/lib/session";
import { useRoomConnection } from "@/hooks/useRoomConnection";
import { usePlaybackSync } from "@/hooks/usePlaybackSync";
import { Stage } from "@/components/player/Stage";
import { TopBar } from "@/components/room/TopBar";
import { ConnectionBanner } from "@/components/room/ConnectionBanner";
import { SourcePanel } from "@/components/room/SourcePanel";
import { Participants } from "@/components/room/Participants";
import { Chat } from "@/components/room/Chat";
import { SyncHud } from "@/components/room/SyncHud";

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

const GATE_KEYS = { room_closed: "closed_title", room_expired: "expired_title", room_not_found: "notfound_title" };

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
  const [hud, setHud] = useState(false);
  const conn = useRoomConnection(code, ident, initialRoom, (e) => toast.error(errorText(t, e)));
  const { room } = conn;
  const isHost = room.host_id === ident.participant_id;
  const sync = usePlaybackSync({ room, isHost, conn, playerRef, ident });

  useEffect(() => {
    if (conn.status === "unauthorized") onIdentLost();
  }, [conn.status, onIdentLost]);
  useEffect(() => { document.title = `${room.name} · Nexora Watch`; }, [room.name]);

  if (GATE_KEYS[conn.status]) return <Gate title={t(GATE_KEYS[conn.status])} />;
  if (conn.status === "replaced") return <Gate title={t("replaced")} />;

  const buffName = Object.entries(conn.peerState).find(([id, s]) => s.buffering && id === room.host_id) ? `HOST · ${t("buffering")}` : null;
  const leave = async () => {
    await api.leave(code, ident).catch(() => {});
    nav("/");
  };
  const close = async () => {
    if (!window.confirm(t("close_confirm"))) return;
    try { await api.close(code, ident); } catch (e) { toast.error(errorText(t, e)); }
  };

  return (
    <div className="room" data-testid="room-page">
      <TopBar room={room} status={conn.status} attempt={conn.attempt} isHost={isHost} onBack={() => nav("/")} onLeave={leave} onClose={close} onToggleHud={() => setHud((h) => !h)} />
      <ConnectionBanner status={conn.status} attempt={conn.attempt} onRetry={conn.retryNow} />
      <div className="layout">
        <div className="main-col">
          <Stage video={room.video} isHost={isHost} ident={ident} playerRef={playerRef} sync={sync} peerBuffering={buffName} />
          {room.video && room.video.capabilities?.sync === false && <div className="hint">{t("no_sync")}</div>}
          {isHost && <SourcePanel code={code} ident={ident} onRoom={conn.setRoom} />}
          {hud && <SyncHud code={code} sync={sync} clock={conn.clock} reconnects={conn.statsRef.current.reconnects} />}
        </div>
        <aside className="side">
          <Participants room={room} me={ident.participant_id} peerState={conn.peerState} />
          <Chat messages={conn.messages} me={ident.participant_id} onSend={(v) => conn.sendChat(v).catch((e) => toast.error(errorText(t, e)))} onReact={(e) => conn.sendChat(e).catch((ex) => toast.error(errorText(t, ex)))} />
        </aside>
      </div>
      {conn.reactions.map((r) => <div key={r.id} className="fly" style={{ left: `${r.left}%` }}>{r.emoji}</div>)}
    </div>
  );
}
