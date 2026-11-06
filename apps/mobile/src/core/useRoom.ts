import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { ApiError, api, wsUrl } from "./api";
import { ClockEstimator } from "./sync";
import type { ChatMessage, Identity, Playback, PlaybackCommand, Room } from "./types";

export const MAX_ATTEMPTS = 6;
const PING_MS = 10000;
const DEAD_MS = 25000;
export const REACTIONS = ["😂", "❤️", "🔥", "👍", "😎", "😭", "👀", "🎉", "💀", "😡"];
const SERVER_REACTIONS = new Set(["😀", "😂", "❤️", "🔥", "👍", "😎", "😭", "😡", "👀", "🎉", "💀", "🤣"]);

export type ConnStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "room_closed"
  | "room_expired"
  | "room_not_found"
  | "unauthorized"
  | "replaced";

export const TERMINAL: ConnStatus[] = ["room_closed", "room_expired", "room_not_found", "unauthorized", "replaced"];

export type FlyingReaction = { id: string; emoji: string; left: number };

export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * One WebSocket per room with exponential backoff + jitter, ping/pong clock sync, revision-guarded playback state,
 * idempotent chat (client_id) and HTTP fallbacks. Mirrors the protocol in docs/PLAYBACK-SYNC.md.
 */
export function useRoom(code: string, ident: Identity, initialRoom: Room, onNotice: (text: string) => void) {
  const [room, setRoomState] = useState<Room>(initialRoom);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [peerBuffering, setPeerBuffering] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<FlyingReaction[]>([]);
  const [rtt, setRtt] = useState<number | null>(null);

  const roomRef = useRef(room);
  roomRef.current = room;
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPong = useRef(0);
  const stopped = useRef(false);
  const lastError = useRef<string | null>(null);
  const clock = useRef(new ClockEstimator());
  const reconnects = useRef(0);
  const listeners = useRef(new Set<(pb: Playback) => void>());
  const connectRef = useRef<() => void>(() => {});
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;

  const mergeRoom = useCallback((next: Room | null | undefined) => {
    if (!next) return;
    setRoomState((prev) => {
      const keepPb = (prev.playback?.revision ?? -1) > (next.playback?.revision ?? -1);
      return { ...next, playback: keepPb ? prev.playback : next.playback };
    });
  }, []);

  const applyPlayback = useCallback((pb: Playback) => {
    setRoomState((prev) => (pb.revision > (prev.playback?.revision ?? -1) ? { ...prev, playback: pb } : prev));
    listeners.current.forEach((fn) => fn(pb));
  }, []);

  const fly = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setReactions((r) => [...r.slice(-14), { id, emoji, left: 8 + Math.random() * 78 }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2400);
  }, []);

  const addMessages = useCallback((list: ChatMessage[]) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = list.filter((m) => m && !seen.has(m.id));
      if (!add.length) return prev;
      return [...prev, ...add].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).slice(-300);
    });
  }, []);

  const closeSocket = useCallback(() => {
    if (pingTimer.current) clearInterval(pingTimer.current);
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
  }, []);

  const stop = useCallback(
    (reason: ConnStatus) => {
      stopped.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      closeSocket();
      setStatus(reason);
    },
    [closeSocket],
  );

  const scheduleRetry = useCallback(() => {
    if (stopped.current) return;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    attemptRef.current += 1;
    setAttempt(attemptRef.current);
    if (attemptRef.current > MAX_ATTEMPTS) {
      setStatus("failed");
      return;
    }
    setStatus("reconnecting");
    const base = Math.min(30000, 1000 * 2 ** (attemptRef.current - 1));
    retryTimer.current = setTimeout(() => connectRef.current(), base / 2 + (Math.random() * base) / 2);
  }, []);

  const sendRaw = useCallback((payload: object): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const ping = useCallback(() => sendRaw({ type: "ping", client_time: Date.now() }), [sendRaw]);

  const handle = useCallback(
    (data: any) => {
      switch (data?.type) {
        case "hello":
          mergeRoom(data.room);
          if (typeof data.server_time === "number") clock.current.seed(data.server_time, Date.now());
          api.getMessages(code).then(addMessages).catch(() => {});
          break;
        case "room":
          mergeRoom(data.room);
          break;
        case "playback":
          if (data.playback) applyPlayback(data.playback);
          break;
        case "message":
          if (data.message) {
            addMessages([data.message]);
            if (SERVER_REACTIONS.has(data.message.text)) fly(data.message.text);
          }
          break;
        case "presence":
          setRoomState((prev) => ({
            ...prev,
            participants: prev.participants.map((p) => (p.id === data.participant_id ? { ...p, online: !!data.online } : p)),
          }));
          if (data.online && !roomRef.current.participants.some((p) => p.id === data.participant_id)) {
            api.getRoom(code).then(mergeRoom).catch(() => {});
          }
          break;
        case "peer_state":
          setPeerBuffering((s) => ({ ...s, [data.participant_id]: !!data.buffering }));
          break;
        case "reaction":
          if (typeof data.emoji === "string") fly(data.emoji);
          break;
        case "pong": {
          lastPong.current = Date.now();
          if (typeof data.client_time === "number" && typeof data.server_time === "number") {
            const s = clock.current.addPong(data.client_time, data.server_time, Date.now());
            if (s) setRtt(s.rtt);
          }
          break;
        }
        case "room_closed":
          stop("room_closed");
          break;
        case "error":
          lastError.current = data.code;
          if (!["room_closed", "room_expired", "room_not_found", "not_participant", "auth_required"].includes(data.code)) {
            noticeRef.current(typeof data.detail === "string" ? data.detail : "Hata");
          }
          break;
        default:
      }
    },
    [code, mergeRoom, applyPlayback, addMessages, fly, stop],
  );
  const handleRef = useRef(handle);
  handleRef.current = handle;

  const connect = useCallback(async () => {
    if (stopped.current) return;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    setStatus(attemptRef.current ? "reconnecting" : "connecting");
    if (attemptRef.current > 0 || reconnects.current > 0) {
      // Refresh full state before re-opening the socket so nothing missed while offline is lost.
      try {
        mergeRoom(await api.getRoom(code));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return stop("room_not_found");
        if (e instanceof ApiError && e.status === 410) return stop(e.code === "room_closed" ? "room_closed" : "room_expired");
        return scheduleRetry();
      }
    }
    if (stopped.current) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(code, ident));
    } catch {
      return scheduleRetry();
    }
    wsRef.current = ws;
    ws.onopen = () => {
      attemptRef.current = 0;
      setAttempt(0);
      setStatus("connected");
      lastPong.current = Date.now();
      [0, 400, 900].forEach((d) => setTimeout(ping, d));
      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        if (Date.now() - lastPong.current > DEAD_MS) {
          // Half-open socket (common after switching Wi-Fi <-> mobile data): drop and reconnect.
          closeSocket();
          reconnects.current += 1;
          scheduleRetry();
          return;
        }
        ping();
      }, PING_MS);
    };
    ws.onmessage = (ev) => {
      try {
        handleRef.current(JSON.parse(String(ev.data)));
      } catch {
        /* malformed frame */
      }
    };
    ws.onerror = () => {
      /* onclose follows */
    };
    ws.onclose = (ev) => {
      if (wsRef.current === ws) wsRef.current = null;
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (stopped.current) return;
      if (ev.code === 4410) return stop(lastError.current === "room_expired" ? "room_expired" : "room_closed");
      if (ev.code === 4404) return stop("room_not_found");
      if (ev.code === 4403) return stop("unauthorized");
      if (ev.code === 4000) return stop("replaced");
      reconnects.current += 1;
      scheduleRetry();
    };
  }, [code, ident, mergeRoom, ping, scheduleRetry, stop, closeSocket]);
  connectRef.current = connect;

  const retryNow = useCallback(() => {
    stopped.current = false;
    attemptRef.current = 0;
    setAttempt(0);
    connectRef.current();
  }, []);

  useEffect(() => {
    stopped.current = false;
    api.getMessages(code).then(addMessages).catch(() => {});
    connectRef.current();
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active" || stopped.current) return;
      if (!wsRef.current) {
        attemptRef.current = 0;
        connectRef.current();
      } else {
        ping();
        api.getRoom(code).then(mergeRoom).catch(() => {});
      }
    });
    return () => {
      sub.remove();
      stopped.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      closeSocket();
    };
  }, [code, addMessages, ping, mergeRoom, closeSocket]);

  const sendChat = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const client_id = uuid();
      if (!sendRaw({ type: "message", text: clean, client_id })) {
        addMessages([await api.sendMessage(code, ident, clean, client_id)]);
      }
    },
    [code, ident, sendRaw, addMessages],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!SERVER_REACTIONS.has(emoji)) return;
      if (!sendRaw({ type: "reaction", emoji })) fly(emoji);
    },
    [sendRaw, fly],
  );

  const publishPlayback = useCallback(
    (cmd: PlaybackCommand) => {
      const sent_at = clock.current.serverNow(Date.now());
      // Optimistic local state so the host's own sync loop does not republish before the echo arrives.
      setRoomState((prev) => ({
        ...prev,
        playback: { ...prev.playback, playing: cmd.playing, position: cmd.position, updated_at: sent_at },
      }));
      if (!sendRaw({ type: "playback", ...cmd, sent_at })) {
        api
          .setPlayback(code, ident, cmd)
          .then((pb) => pb.applied && applyPlayback(pb))
          .catch(() => {});
      }
    },
    [code, ident, sendRaw, applyPlayback],
  );

  const onPlaybackEvent = useCallback((fn: (pb: Playback) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const serverNow = useCallback(() => clock.current.serverNow(Date.now()), []);

  return {
    room,
    setRoom: mergeRoom,
    messages,
    status,
    attempt,
    peerBuffering,
    reactions,
    rtt,
    reconnects,
    serverNow,
    retryNow,
    sendRaw,
    sendChat,
    sendReaction,
    publishPlayback,
    onPlaybackEvent,
  };
}

export type RoomConn = ReturnType<typeof useRoom>;
