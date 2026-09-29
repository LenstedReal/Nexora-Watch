import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, messageKey, type Message, type Playback, type Room, wsUrl } from "./api";

type Options = { code: string; participantId: string | null };

export function useRoom({ code, participantId }: Options) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const offsetRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const enabled = !!participantId;

  const roomQuery = useQuery({
    queryKey: ["room", code],
    queryFn: () => api.getRoom(code),
    enabled,
    retry: (count, err) => !(err instanceof ApiError && (err.status === 404 || err.status === 410)) && count < 2,
    refetchInterval: 1000,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", code],
    queryFn: () => api.getMessages(code),
    enabled,
    refetchInterval: 1000,
  });

  const sendRealtime = useCallback((payload: unknown) => {
    try {
      const socket = socketRef.current;

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
        return true;
      }
    } catch {
      // ignore
    }

    return false;
  }, []);

  const applyOffset = useCallback((serverTime?: number) => {
    if (!serverTime) return;
    const next = serverTime - Date.now();
    if (Math.abs(next - offsetRef.current) > 150) {
      offsetRef.current = next;
      setServerOffset(next);
    }
  }, []);

  useEffect(() => {
    if (roomQuery.data?.server_time) applyOffset(roomQuery.data.server_time);
  }, [roomQuery.data?.server_time, applyOffset]);

  useEffect(() => {
    if (!participantId) return;
    let socket: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        socket = new WebSocket(wsUrl(code, participantId));
        socketRef.current = socket;
      } catch {
        retry = setTimeout(connect, 3000);
        return;
      }
      socket.onopen = () => {
        setConnected(true);
        ping = setInterval(() => {
          try {
            socket?.send(JSON.stringify({ type: "ping" }));
          } catch {
            // ignore
          }
        }, 20000);
      };
      socket.onmessage = (ev) => {
        let data: { type?: string; room?: Room; playback?: Playback; message?: Message; server_time?: number };
        try {
          data = JSON.parse(String(ev.data)) as typeof data;
        } catch {
          return;
        }
        applyOffset(data.server_time);
        if (data.type === "room") {
          queryClient.setQueryData<Room>(["room", code], data.room as Room);
        } else if (data.type === "playback") {
          queryClient.setQueryData<Room>(["room", code], (old) =>
            old ? { ...old, playback: data.playback as Playback, server_time: data.server_time ?? old.server_time } : old,
          );
        } else if (data.type === "web") {
          const payload = data as { open?: unknown; url?: unknown };
          const open = Boolean(payload.open);
          const url =
            typeof payload.url === "string" && payload.url.trim()
              ? payload.url
              : undefined;

          queryClient.setQueryData<Room>(["room", code], (old) =>
            old
              ? {
                  ...old,
                  web_open: open,
                  web_url: url ?? old.web_url,
                }
              : old,
          );

          window.dispatchEvent(
            new CustomEvent("nexora:web-sync", {
              detail: { open, url },
            }),
          );
        } else if (data.type === "message") {
          const msg = data.message as Message;
          queryClient.setQueryData<Message[]>(["messages", code], (old) => {
            const list = old ?? [];
            const key = messageKey(msg);
            if (list.some((m) => messageKey(m) === key)) return list;
            return [...list, msg];
          });
        }
      };
      const onClose = () => {
        setConnected(false);
        if (ping) clearInterval(ping);
        ping = null;
        if (!closed) retry = setTimeout(connect, 2500);
      };
      socket.onclose = onClose;
      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          // ignore
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (ping) clearInterval(ping);
      try {
        socket?.close();
      } catch {
        // ignore
      }
    };
  }, [code, participantId, queryClient, applyOffset]);

  return {
    room: roomQuery.data ?? null,
    roomError: roomQuery.error as ApiError | null,
    roomLoading: roomQuery.isLoading,
    messages: messagesQuery.data ?? [],
    connected,
    serverOffset,
    transport: connected ? "realtime" : "polling",
    sendRealtime,
  } as const;
}

export const DRIFT_TOLERANCE = 2;
export const HEARTBEAT_MS = 5000;

export function expectedPosition(playback: Playback, serverOffset: number): number {
  if (!playback.playing) return playback.position;
  const serverNow = Date.now() + serverOffset;
  return Math.max(0, playback.position + (serverNow - playback.updated_at) / 1000);
}
