import { useCallback, useEffect, useRef, useState } from "react";
import { api, wsUrl } from "@/lib/api";

export const MAX_ATTEMPTS = 6;
const PING_MS = 10000;
const DEAD_MS = 25000;
export const EMOJI_LIST = ["😀", "😂", "❤️", "🔥", "👍", "😎", "😭", "😡", "👀", "🎉", "💀", "🤣"];
const EMOJI = new Set(EMOJI_LIST);
const TERMINAL = new Set(["room_closed", "room_expired", "room_not_found", "unauthorized", "replaced"]);

export function useRoomConnection(code, ident, initialRoom, onNotice) {
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [attempt, setAttempt] = useState(0);
  const [peerState, setPeerState] = useState({});
  const [reactions, setReactions] = useState([]);
  const [clock, setClock] = useState({ offset: 0, rtt: null });

  const wsRef = useRef(null);
  const attemptRef = useRef(0);
  const timerRef = useRef(null);
  const pingRef = useRef(null);
  const lastPongRef = useRef(0);
  const stoppedRef = useRef(false);
  const lastErrorRef = useRef(null);
  const samplesRef = useRef([]);
  const clockRef = useRef({ offset: 0, rtt: null });
  const statsRef = useRef({ reconnects: 0 });
  const listenersRef = useRef(new Set());
  const connectRef = useRef(() => {});
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;

  const mergeRoom = useCallback((next) => {
    setRoom((prev) => {
      if (!prev || !next) return next || prev;
      const keepPb = (prev.playback?.revision ?? -1) > (next.playback?.revision ?? -1);
      return { ...next, playback: keepPb ? prev.playback : next.playback };
    });
  }, []);

  const applyPlayback = useCallback((pb) => {
    setRoom((prev) => (prev && pb.revision > (prev.playback?.revision ?? -1) ? { ...prev, playback: pb } : prev));
  }, []);

  const addMessages = useCallback((list) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = list.filter((m) => m && !seen.has(m.id));
      if (!add.length) return prev;
      return [...prev, ...add].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).slice(-300);
    });
  }, []);

  const fly = useCallback((emoji) => {
    const id = `${Date.now()}-${Math.random()}`;
    setReactions((r) => [...r.slice(-12), { id, emoji, left: 10 + Math.random() * 80 }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2200);
  }, []);

  const stop = useCallback((reason) => {
    stoppedRef.current = true;
    clearTimeout(timerRef.current);
    clearInterval(pingRef.current);
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      try { ws.close(); } catch { /* already closed */ }
    }
    setStatus(reason);
  }, []);

  const scheduleRetry = useCallback(() => {
    if (stoppedRef.current) return;
    clearTimeout(timerRef.current);
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    attemptRef.current += 1;
    setAttempt(attemptRef.current);
    if (attemptRef.current > MAX_ATTEMPTS) {
      setStatus("failed");
      return;
    }
    setStatus("reconnecting");
    const base = Math.min(30000, 1000 * 2 ** (attemptRef.current - 1));
    timerRef.current = setTimeout(() => connectRef.current(), base / 2 + (Math.random() * base) / 2);
  }, []);

  const sendRaw = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const ping = useCallback(() => sendRaw({ type: "ping", client_time: Date.now() }), [sendRaw]);

  const onPong = useCallback((data) => {
    const now = Date.now();
    lastPongRef.current = now;
    if (typeof data.client_time !== "number") return;
    const rtt = now - data.client_time;
    const sample = { rtt, offset: data.server_time + rtt / 2 - now };
    samplesRef.current = [...samplesRef.current.slice(-7), sample];
    const best = samplesRef.current.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    clockRef.current = { offset: best.offset, rtt };
    setClock({ offset: best.offset, rtt });
  }, []);

  const handle = useCallback(
    (data) => {
      switch (data.type) {
        case "hello":
          mergeRoom(data.room);
          if (!samplesRef.current.length) clockRef.current = { ...clockRef.current, offset: data.server_time - Date.now() };
          api.getMessages(code).then(addMessages).catch(() => {});
          break;
        case "room":
          mergeRoom(data.room);
          break;
        case "playback":
          applyPlayback(data.playback);
          listenersRef.current.forEach((fn) => fn(data));
          break;
        case "message":
          addMessages([data.message]);
          if (EMOJI.has(data.message?.text)) fly(data.message.text);
          break;
        case "presence":
          setRoom((prev) => prev && { ...prev, participants: prev.participants.map((p) => (p.id === data.participant_id ? { ...p, online: data.online } : p)) });
          if (data.online && !room?.participants?.some((p) => p.id === data.participant_id)) api.getRoom(code).then(mergeRoom).catch(() => {});
          break;
        case "peer_state":
          setPeerState((s) => ({ ...s, [data.participant_id]: { buffering: data.buffering } }));
          break;
        case "reaction":
          fly(data.emoji);
          break;
        case "pong":
          onPong(data);
          break;
        case "room_closed":
          stop("room_closed");
          break;
        case "error":
          lastErrorRef.current = data.code;
          if (!TERMINAL.has(data.code) && data.code !== "not_participant") noticeRef.current?.(data);
          break;
        default:
      }
    },
    [code, mergeRoom, applyPlayback, addMessages, onPong, stop, room?.participants, fly],
  );
  const handleRef = useRef(handle);
  handleRef.current = handle;

  const connect = useCallback(async () => {
    if (stoppedRef.current) return;
    clearTimeout(timerRef.current);
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    setStatus(attemptRef.current ? "reconnecting" : "connecting");
    if (attemptRef.current > 0 || statsRef.current.reconnects > 0) {
      try {
        mergeRoom(await api.getRoom(code));
      } catch (e) {
        if (e.status === 404) return stop("room_not_found");
        if (e.status === 410) return stop(e.code === "room_closed" ? "room_closed" : "room_expired");
        return scheduleRetry();
      }
    }
    if (stoppedRef.current) return;
    const ws = new WebSocket(wsUrl(code, ident));
    wsRef.current = ws;
    ws.onopen = () => {
      attemptRef.current = 0;
      setAttempt(0);
      setStatus("connected");
      lastPongRef.current = Date.now();
      [0, 400, 900].forEach((d) => setTimeout(ping, d));
      clearInterval(pingRef.current);
      pingRef.current = setInterval(() => {
        if (Date.now() - lastPongRef.current > DEAD_MS) {
          ws.onclose = null;
          try { ws.close(); } catch { /* noop */ }
          if (wsRef.current === ws) wsRef.current = null;
          clearInterval(pingRef.current);
          statsRef.current.reconnects += 1;
          scheduleRetry();
          return;
        }
        ping();
      }, PING_MS);
    };
    ws.onmessage = (ev) => {
      try {
        handleRef.current(JSON.parse(ev.data));
      } catch { /* malformed frame */ }
    };
    ws.onclose = (ev) => {
      if (wsRef.current === ws) wsRef.current = null;
      clearInterval(pingRef.current);
      if (stoppedRef.current) return;
      if (ev.code === 4410) return stop(lastErrorRef.current === "room_expired" ? "room_expired" : "room_closed");
      if (ev.code === 4404) return stop("room_not_found");
      if (ev.code === 4403) return stop("unauthorized");
      if (ev.code === 4000) return stop("replaced");
      statsRef.current.reconnects += 1;
      scheduleRetry();
    };
  }, [code, ident, mergeRoom, ping, scheduleRetry, stop]);
  connectRef.current = connect;

  const retryNow = useCallback(() => {
    stoppedRef.current = false;
    attemptRef.current = 0;
    setAttempt(0);
    connectRef.current();
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    api.getMessages(code).then(addMessages).catch(() => {});
    connectRef.current();
    const wake = () => {
      if (stoppedRef.current || document.visibilityState !== "visible") return;
      if (!wsRef.current) {
        attemptRef.current = 0;
        connectRef.current();
      } else ping();
    };
    const online = () => {
      if (stoppedRef.current) return;
      attemptRef.current = 0;
      if (!wsRef.current) connectRef.current();
    };
    const offline = () => !stoppedRef.current && setStatus("offline");
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      stoppedRef.current = true;
      clearTimeout(timerRef.current);
      clearInterval(pingRef.current);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onclose = null;
        try { ws.close(); } catch { /* noop */ }
      }
    };
  }, [code, addMessages, ping]);

  const sendChat = useCallback(
    async (text) => {
      const client_id = crypto.randomUUID();
      if (!sendRaw({ type: "message", text, client_id })) {
        addMessages([await api.sendMessage(code, ident, text, client_id)]);
        if (EMOJI.has(text)) fly(text);
      }
    },
    [code, ident, sendRaw, addMessages, fly],
  );

  const publishPlayback = useCallback(
    (cmd) => {
      const sent_at = Date.now() + clockRef.current.offset;
      if (!sendRaw({ type: "playback", ...cmd, sent_at })) {
        api.setPlayback(code, ident, cmd).then((pb) => pb.applied && applyPlayback(pb)).catch(() => {});
      }
    },
    [code, ident, sendRaw, applyPlayback],
  );

  const onPlaybackEvent = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  return {
    room, setRoom: mergeRoom, messages, status, attempt, peerState, reactions, clock, clockRef, statsRef,
    retryNow, sendRaw, sendChat, publishPlayback, onPlaybackEvent, terminal: TERMINAL.has(status),
  };
}
