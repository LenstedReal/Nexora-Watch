"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Globe,
  LogOut,
  MessageCircle,
  Send,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";

import { useParams } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { api, type Message, type Room } from "@/lib/nexora/api";
import {
  clearRoomSession,
  getRoomSession,
  getSavedNickname,
} from "@/lib/nexora/session";
import { useRoom } from "@/lib/nexora/use-room";
import { DEFAULT_WEB_URL, normalizeWebUrl } from "@/lib/nexora/web";

export default function RoomPage() {
  const { code: codeParam } = useParams<{ code: string }>();
  const code = String(codeParam ?? "").toUpperCase();
  const queryClient = useQueryClient();

  const [participantId, setParticipantId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [localVideo, setLocalVideo] = useState<{
    url: string;
    name: string;
  } | null>(null);

  // Web görünümü oda seviyesinde tutulur.
  // Böylece host/guest player state'i birbirinden kopmaz.
  const [webOpen, setWebOpen] = useState(false);
  const [webUrl, setWebUrl] = useState(DEFAULT_WEB_URL);
  const [localUploading, setLocalUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    return () => {
      if (localVideo?.url) {
        URL.revokeObjectURL(localVideo.url);
      }
    };
  }, [localVideo?.url]);

  useEffect(() => {
    setParticipantId(getRoomSession(code));
    setNickname(getSavedNickname());
    setSessionReady(true);
  }, [code]);

  const {
    room,
    roomError,
    roomLoading,
    messages,
    connected,
    serverOffset,
    sendRealtime,
  } = useRoom({
    code,
    participantId,
  });

  const me = useMemo(
    () =>
      room?.participants.find(
        (participant) => participant.id === participantId,
      ) ?? null,
    [room, participantId],
  );

  const isHost = me?.is_host === true;
  const hostWebAppliedRef = useRef(false);

  useEffect(() => {
    hostWebAppliedRef.current = false;
    setWebOpen(false);
  }, [code]);

  // Sunucudan gelen Web durumunu oda seviyesinde uygula.
  useEffect(() => {
    if (typeof room?.web_open !== "boolean") return;
    if (isHost && hostWebAppliedRef.current) {
      if (typeof room.web_url === "string" && room.web_url.trim()) {
        setWebUrl(room.web_url);
      }
      return;
    }
    if (isHost) hostWebAppliedRef.current = true;
    setWebOpen(room.web_open);
    if (typeof room.web_url === "string" && room.web_url.trim()) {
      setWebUrl(room.web_url);
    }
  }, [isHost, room?.web_open, room?.web_url]);

  useEffect(() => {
    const onWebSync = (event: Event) => {
      const detail = (
        event as CustomEvent<{ open?: unknown; url?: unknown }>
      ).detail;

      if (typeof detail?.open === "boolean") {
        setWebOpen(detail.open);
      }
      if (typeof detail?.url === "string" && detail.url.trim()) {
        setWebUrl(detail.url);
      }
    };

    window.addEventListener("nexora:web-sync", onWebSync);

    return () => {
      window.removeEventListener("nexora:web-sync", onWebSync);
    };
  }, []);

  const openSyncedWeb = useCallback(
    (open: boolean, nextUrl?: string) => {
      if (!isHost || !participantId) return;

      const resolvedUrl = nextUrl
        ? normalizeWebUrl(nextUrl)
        : webUrl || DEFAULT_WEB_URL;

      setWebOpen(open);
      setWebUrl(resolvedUrl);

      queryClient.setQueryData<Room>(["room", code], (old) =>
        old
          ? { ...old, web_open: open, web_url: resolvedUrl }
          : old,
      );

      window.dispatchEvent(
        new CustomEvent("nexora:web-sync", {
          detail: { open, url: resolvedUrl },
        }),
      );

      sendRealtime({
        type: "web",
        open,
        url: resolvedUrl,
      });

      void api
        .setWebOpen(code, participantId, open, resolvedUrl)
        .then((updatedRoom) => {
          queryClient.setQueryData(["room", code], updatedRoom);
          if (updatedRoom.web_url) setWebUrl(updatedRoom.web_url);
        })
        .catch(() => {});
    },
    [isHost, participantId, code, queryClient, sendRealtime, webUrl],
  );

  useEffect(() => {
    if (!room?.video?.url) return;
    setVideoUrl(room.video.url);
  }, [room?.video?.url]);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2500);
  };

  const sendMessage = async () => {
    const text = message.trim();

    if (!text || !participantId || sending) return;

    setSending(true);

    try {
      await api.sendMessage(code, participantId, text);
      setMessage("");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  };

  const selectLocalVideo = async (
  event: React.ChangeEvent<HTMLInputElement>,
) => {
  const file = event.target.files?.[0];

  if (!file) return;

  const allowed =
    file.type.startsWith("video/") ||
    /\.(mp4|webm|mov|m4v)$/i.test(file.name);

  if (!allowed) {
    flash("Desteklenmeyen video formatı.");
    event.target.value = "";
    return;
  }

  if (!participantId || !isHost) {
    flash("Yerel videoyu yalnızca oda sahibi yükleyebilir.");
    event.target.value = "";
    return;
  }

  const MAX_BYTES = 2 * 1024 * 1024 * 1024;

  if (file.size > MAX_BYTES) {
    flash("Video en fazla 2 GB olabilir.");
    event.target.value = "";
    return;
  }

  // Upload devam ederken bile host kendi cihazındaki videoyu görebilsin.
  const previewUrl = URL.createObjectURL(file);

  setLocalVideo((previous) => {
    if (previous?.url?.startsWith("blob:")) {
      URL.revokeObjectURL(previous.url);
    }

    return {
      url: previewUrl,
      name: file.name,
    };
  });

  setLocalUploading(true);
  setUploadProgress(0);

  try {
    let updatedRoom: Room | null = null;

    try {
      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .slice(-180);

      const blob = await upload(
        `rooms/${code}/${Date.now()}-${safeName}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/blob-upload",
          clientPayload: JSON.stringify({
            code,
            participantId,
            filename: file.name,
          }),
          multipart: true,
          onUploadProgress: ({ percentage }) => {
            setUploadProgress(Math.round(percentage));
          },
        },
      );

      updatedRoom = await api.setVideo(code, participantId, blob.url);
    } catch {
      const uploaded = await postLocalVideo(
        file,
        code,
        participantId,
        (pct) => setUploadProgress(pct),
      );
      updatedRoom = uploaded.room;
    }

    if (updatedRoom) {
      queryClient.setQueryData(["room", code], updatedRoom);
      if (updatedRoom.video?.url) setVideoUrl(updatedRoom.video.url);
    }

    setLocalVideo((previous) => {
      if (previous?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(previous.url);
      }
      return null;
    });

    flash("Yerel video odaya yüklendi ve senkronize edildi.");
  } catch (error) {
    console.error("[Nexora local video upload]", error);
    flash(
      error instanceof Error
        ? error.message
        : "Video yüklenemedi.",
    );
  } finally {
    setLocalUploading(false);
    event.target.value = "";
  }
};

const updateVideo = async () => {
    const url = videoUrl.trim();

    if (!url || !participantId || !isHost || sending) return;

    setSending(true);

    try {
      const updatedRoom = await api.setVideo(
        code,
        participantId,
        url,
      );

      queryClient.setQueryData(["room", code], updatedRoom);

      if (webOpen) {
        openSyncedWeb(false);
      }

      flash("Video kaynağı güncellendi.");
    } catch {
      openSyncedWeb(true, url);
      flash("Web paylaşıldı. Video bulunursa filme döner.");
    } finally {
      setSending(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room?.code ?? code);
      flash("Oda kodu kopyalandı.");
    } catch {
      flash("Oda kodu kopyalanamadı.");
    }
  };

  const leaveRoom = async () => {
    if (participantId) {
      try {
        await api.leaveRoom(code, participantId);
      } catch {
        // Room may already be unavailable.
      }

      clearRoomSession(code);
    }

    window.location.href = "/";
  };

  if (!sessionReady || (roomLoading && !room)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface text-on-surface">
        <div className="text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="mt-3 text-sm text-muted">Oda yükleniyor...</p>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface px-4 text-on-surface">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface-secondary p-6 text-center">
          <h1 className="font-display text-xl font-bold">
            Oda yüklenemedi
          </h1>

          <p className="mt-2 text-sm text-muted">
            {roomError?.message ?? "Oda bulunamadı veya süresi dolmuş olabilir."}
          </p>

          <a
            href="/"
            className="mt-5 inline-flex min-h-11 items-center rounded-md bg-brand px-5 font-display text-sm font-bold text-on-brand"
          >
            Ana sayfaya dön
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-dvh bg-surface text-on-surface"
      style={{
        width: "1024px",
        maxWidth: "none",
        zoom: "min(1, calc(100vw / 1024px))",
      }}
    >
      {notice ? (
        <div className="fixed top-4 right-4 left-4 z-50 mx-auto max-w-md rounded-lg border border-brand/40 bg-surface-secondary px-4 py-3 text-center text-sm shadow-lg">
          {notice}
        </div>
      ) : null}

      <header className="border-b border-border bg-surface-secondary">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4">
          <a
            href="/"
            className="rounded-md p-2 text-muted hover:text-on-surface"
            aria-label="Ana sayfa"
          >
            <ArrowLeft className="size-5" />
          </a>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold">
              {room.name}
            </h1>

            <button
              type="button"
              onClick={() => void copyCode()}
              className="inline-flex items-center gap-1 text-xs text-brand-secondary"
            >
              {room.code}
              <Copy className="size-3" />
            </button>
          </div>

          <div
            className="hidden items-center gap-2 text-xs text-muted sm:flex"
            title={
              connected
                ? "Gerçek zamanlı bağlantı aktif"
                : "HTTP bağlantısı aktif; gerçek zamanlı bağlantı bekleniyor"
            }
          >
            <span
              className={`size-2 rounded-full ${
                connected ? "bg-success" : "bg-warning"
              }`}
            />
            {connected ? "Gerçek zamanlı" : "Bağlantı aktif"}
          </div>

          <button
            type="button"
            onClick={() => void leaveRoom()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted"
          >
            <LogOut className="size-4" />
            Çık
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <VideoPlayer
            room={room}
            participantId={participantId}
            isHost={isHost}
            serverOffset={serverOffset}
            webOpen={webOpen}
            webUrl={webUrl}
            onWebChange={openSyncedWeb}
            localVideo={localVideo}
          />

          {isHost ? (
            <section className="rounded-xl border border-glass-border bg-surface-secondary p-4">
              <div className="mb-3 flex items-center gap-2">
                <Video className="size-4 text-brand" />

                <h2 className="font-display text-sm font-bold">
                  Video kaynağı
                </h2>

                <span className="ml-auto text-[10px] font-bold text-brand-secondary">
                  HOST
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void updateVideo();
                      }
                    }}
                    placeholder="YouTube / Drive / MP4 / M3U8"
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-tertiary px-3 text-sm outline-none focus:border-brand"
                  />

                  <button
                    type="button"
                    disabled={!videoUrl.trim() || sending}
                    onClick={() => void updateVideo()}
                    className="min-h-11 shrink-0 rounded-md bg-brand px-4 font-display text-sm font-bold text-on-brand disabled:opacity-50"
                  >
                    Ayarla
                  </button>
                </div>

                <label
                  className="relative flex min-h-20 w-full cursor-pointer items-center gap-4 overflow-hidden rounded-lg border border-dashed border-brand/40 bg-surface-tertiary/60 px-4 py-3 transition hover:border-brand hover:bg-surface-tertiary"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Upload className="size-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-bold">
                      Cihazdan video seç
                    </span>

                    <span className="mt-1 block text-xs text-muted">
                      MP4, WebM, MOV veya M4V • Android / PC
                    </span>

                    {localUploading ? (
                      <span className="mt-1 block text-xs text-brand-secondary">
                        Yükleniyor %{uploadProgress}
                      </span>
                    ) : localVideo ? (
                      <span className="mt-1 block truncate text-xs text-brand-secondary">
                        Seçildi: {localVideo.name}
                      </span>
                    ) : null}
                  </span>

                  <span className="shrink-0 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted">
                    Seç
                  </span>

                  <input
                    type="file"
                    accept="video/*,.mp4,.webm,.mov,.m4v"
                    className="absolute inset-0 z-10 cursor-pointer opacity-0"
                    disabled={localUploading}
                    onChange={selectLocalVideo}
                  />
                </label>

                {localVideo ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-tertiary px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {localVideo.name}
                      </p>
                      <p className="text-[10px] text-muted">
                        Bu cihazda oynatılıyor
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(localVideo.url);
                        setLocalVideo(null);
                      }}
                      className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-on-surface"
                    >
                      Kaldır
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          ) : (
            <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3 text-xs text-muted">
              Videoyu yalnızca oda sahibi değiştirebilir.
            </div>
          )}

          <section className="rounded-xl border border-glass-border bg-surface-secondary p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="size-4 text-brand-secondary" />

              <h2 className="font-display text-sm font-bold">
                Katılımcılar
              </h2>

              <span className="ml-auto text-xs text-muted">
                {room.participants.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {room.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-tertiary px-3 py-2 text-xs"
                >
                  <span
                    className={`size-2 rounded-full ${
                      participant.online ? "bg-success" : "bg-muted"
                    }`}
                  />

                  <span>{participant.nickname}</span>

                  {participant.is_host ? (
                    <span className="text-[10px] font-bold text-brand-secondary">
                      HOST
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-glass-border bg-surface-secondary">
          <div className="flex min-h-14 items-center gap-2 border-b border-border px-4">
            <MessageCircle className="size-4 text-brand" />

            <h2 className="font-display text-sm font-bold">
              Sohbet
            </h2>

            <span className="ml-auto text-xs text-muted">
              {messages.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center text-center text-xs text-muted">
                Henüz mesaj yok.
                <br />
                İlk mesajı sen gönder.
              </div>
            ) : (
              messages.map((item) => (
                <ChatMessage key={messageKey(item)} message={item} />
              ))
            )}
          </div>

          <div className="border-t border-border p-3">
    <div className="mb-2 flex flex-wrap gap-1">
      {[
        "😀",
        "😂",
        "❤️",
        "🔥",
        "👍",
        "😎",
        "😭",
        "😡",
        "👀",
        "🎉",
        "💀",
        "🤣",
      ].map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() =>
            setMessage((current) => `${current}${emoji}`)
          }
          className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface-tertiary text-base transition hover:border-brand hover:bg-surface-tertiary/80 active:scale-95"
          aria-label={`${emoji} ekle`}
        >
          {emoji}
        </button>
      ))}
    </div>
            <div className="flex gap-2">
              <input
                value={message}
                maxLength={1000}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={
                  nickname
                    ? `${nickname} olarak yaz...`
                    : "Mesaj yaz..."
                }
                className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-tertiary px-3 text-sm outline-none focus:border-brand"
              />

              <button
                type="button"
                disabled={!message.trim() || !participantId || sending}
                onClick={() => void sendMessage()}
                className="grid size-11 shrink-0 place-items-center rounded-md bg-brand text-on-brand disabled:opacity-50"
                aria-label="Mesaj gönder"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: number;
      height?: number;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange?: (event: {
          target: YouTubePlayerInstance;
          data: number;
        }) => void;
      };
    },
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
    __nexoraYouTubeApiPromise?: Promise<YouTubeApi>;
  }
}

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__nexoraYouTubeApiPromise) {
    return window.__nexoraYouTubeApiPromise;
  }

  window.__nexoraYouTubeApiPromise = new Promise<YouTubeApi>(
    (resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();

        if (window.YT?.Player) {
          resolve(window.YT);
        } else {
          reject(new Error("YouTube IFrame API yüklenemedi."));
        }
      };

      const existing = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      );

      if (existing) {
        return;
      }

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () =>
        reject(new Error("YouTube IFrame API script yüklenemedi."));
      document.head.appendChild(script);
    },
  );

  return window.__nexoraYouTubeApiPromise;
}

function postLocalVideo(
  file: File,
  code: string,
  participantId: string,
  onProgress: (pct: number) => void,
): Promise<{ url: string; name: string; room: Room }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("code", code);
    form.append("participant_id", participantId);
    form.append("file", file, file.name);
    xhr.open("POST", "/api/upload");
    xhr.timeout = 0;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let data: { detail?: string; url?: string; name?: string; room?: Room } = {};
      try {
        data = JSON.parse(xhr.responseText) as typeof data;
      } catch {
        reject(new Error("Video yüklenemedi"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.room && data.url) {
        resolve({ url: data.url, name: data.name ?? file.name, room: data.room });
        return;
      }
      reject(new Error(data.detail || "Video yüklenemedi"));
    };
    xhr.onerror = () => reject(new Error("Yükleme bağlantısı koptu"));
    xhr.ontimeout = () => reject(new Error("Yükleme zaman aşımı"));
    xhr.send(form);
  });
}

function VideoPlayer({
  room,
  participantId,
  isHost,
  webOpen,
  webUrl,
  onWebChange,
  serverOffset,
  localVideo,
}: {
  room: Room;
  participantId: string | null;
  isHost: boolean;
  webOpen: boolean;
  webUrl: string;
  onWebChange: (open: boolean) => void;
  serverOffset: number;
  localVideo: { url: string; name: string } | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const syncingRemote = useRef(false);
  const lastServerUpdate = useRef(0);
  const hostNativeReadyRef = useRef(false);

  const roomVideo = room.video;

  const source =
    roomVideo?.stream_url ??
    roomVideo?.embed_url ??
    roomVideo?.url ??
    "";

  const isHls =
    /\.m3u8(?:$|[?#])/i.test(source) ||
    roomVideo?.title?.toLowerCase().includes(".m3u8") === true;

  /*
   * Native MP4 / WebM / HLS player.
   */
  useEffect(() => {
    const video = videoRef.current;

    if (!video || localVideo || !roomVideo) {
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (
      (roomVideo.kind === "direct" || roomVideo.kind === "hls") &&
      isHls
    ) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
          maxBufferLength: 30,
          backBufferLength: 30,
        });

        hlsRef.current = hls;
        hls.loadSource(source);
        hls.attachMedia(video);

        return () => {
          hls.destroy();
          hlsRef.current = null;
        };
      }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = source;
      }

      return;
    }

    if (roomVideo.kind === "direct" || roomVideo.kind === "hls") {
      video.src = source;

      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }
  }, [source, roomVideo, localVideo, isHls]);

  /*
   * Host native player -> authoritative room playback.
   */
  useEffect(() => {
    const video = videoRef.current;

    if (
      !video ||
      !isHost ||
      !participantId ||
      localVideo ||
      !roomVideo
    ) {
      return;
    }

    const publish = (playing: boolean) => {
      if (syncingRemote.current) {
        return;
      }

      if (!hostNativeReadyRef.current) {
        return;
      }

      lastServerUpdate.current = Date.now();

      void api
        .setPlayback(
          room.code,
          participantId,
          playing,
          Math.max(0, video.currentTime),
        )
        .catch(() => {});
    };

    const handlePlay = () => {
      publish(true);
    };

    const handlePause = () => {
      publish(false);
    };

    const handleSeeked = () => {
      publish(!video.paused);
    };

    const heartbeat = window.setInterval(() => {
      if (syncingRemote.current) {
        return;
      }

      if (!hostNativeReadyRef.current) {
        return;
      }

      const now = Date.now();

      if (now - lastServerUpdate.current < 1200) {
        return;
      }

      lastServerUpdate.current = now;

      void api
        .setPlayback(
          room.code,
          participantId,
          !video.paused,
          Math.max(0, video.currentTime),
        )
        .catch(() => {});
    }, 1000);

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeked", handleSeeked);

    return () => {
      window.clearInterval(heartbeat);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [
    room.code,
    participantId,
    isHost,
    localVideo,
    roomVideo,
  ]);

  /*
   * Host native player should resume the persisted room playback
   * after refresh instead of publishing 0:00 from a fresh <video>.
   */
  useEffect(() => {
    hostNativeReadyRef.current = false;
  }, [source, localVideo?.url, roomVideo?.kind, webOpen]);

  useEffect(() => {
    const video = videoRef.current;

    if (
      !video ||
      !isHost ||
      localVideo ||
      !roomVideo
    ) {
      return;
    }

    const applyPersisted = () => {
      if (hostNativeReadyRef.current) {
        return;
      }

      const playback = room.playback;
      let target = Math.max(0, playback.position);

      if (playback.playing) {
        const serverNow = Date.now() + serverOffset;

        target += Math.max(
          0,
          (serverNow - playback.updated_at) / 1000,
        );
      }

      if (!Number.isFinite(target)) {
        hostNativeReadyRef.current = true;
        return;
      }

      syncingRemote.current = true;

      try {
        video.currentTime = target;
      } catch {
        // Native seek can fail before the first frame.
      }

      if (playback.playing) {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }

      hostNativeReadyRef.current = true;

      window.setTimeout(() => {
        syncingRemote.current = false;
      }, 350);
    };

    if (video.readyState >= 1) {
      applyPersisted();
      return;
    }

    video.addEventListener("loadedmetadata", applyPersisted);

    return () => {
      video.removeEventListener("loadedmetadata", applyPersisted);
    };
  }, [
    isHost,
    localVideo,
    roomVideo,
    source,
    serverOffset,
    room.playback.playing,
    room.playback.position,
    room.playback.updated_at,
  ]);

  /*
   * Guest native player -> authoritative room playback.
   */
  useEffect(() => {
    const video = videoRef.current;

    if (
      !video ||
      isHost ||
      localVideo ||
      !roomVideo
    ) {
      return;
    }

    const sync = () => {
      const playback = room.playback;

      let target = Math.max(0, playback.position);

      if (playback.playing) {
        const serverNow = Date.now() + serverOffset;

        target += Math.max(
          0,
          (serverNow - playback.updated_at) / 1000,
        );
      }

      if (!Number.isFinite(target)) {
        return;
      }

      const drift = target - video.currentTime;

      if (Math.abs(drift) > 1.5) {
        syncingRemote.current = true;

        try {
          video.currentTime = target;
        } catch {
          // Ignore transient media-sync failures.
        }

        window.setTimeout(() => {
          syncingRemote.current = false;
        }, 200);
      }

      if (playback.playing && video.paused) {
        syncingRemote.current = true;

        void video.play().catch(() => {});

        window.setTimeout(() => {
          syncingRemote.current = false;
        }, 350);
      }

      if (!playback.playing && !video.paused) {
        syncingRemote.current = true;
        video.pause();

        window.setTimeout(() => {
          syncingRemote.current = false;
        }, 200);
      }
    };

    sync();

    const interval = window.setInterval(sync, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    room.playback.playing,
    room.playback.position,
    room.playback.updated_at,
    serverOffset,
    isHost,
    localVideo,
    roomVideo,
  ]);

  /*
   * Oda içi Google Web.
   * Video senkronundan tamamen bağımsız.
   */
  if (webOpen) {
    return (
      <div className="relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video">
        <div className="absolute inset-0 flex flex-col bg-surface-secondary">
          <div className="relative z-20 flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-3">
            <Globe className="size-4 text-brand" />

            <span className="font-display text-xs font-bold">
              Web
            </span>

            <span className="text-[10px] text-muted">
              Google
            </span>

            <button
              type="button"
              onClick={() => onWebChange(false)}
              className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-semibold text-muted transition hover:text-on-surface"
              aria-label="Filme dön"
              title="Filme dön"
            >
              <X className="size-4" />
              Film
            </button>
          </div>

          <div className="relative min-h-0 flex-1 bg-white">
            <iframe
              src={webUrl || DEFAULT_WEB_URL}
              title="Nexora Web"
              className="absolute inset-0 h-full w-full border-0 bg-white"
              allow="autoplay; clipboard-read; clipboard-write; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            {!isHost ? (
              <div className="absolute inset-0 z-10" aria-hidden="true" />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  /*
   * Local device video.
   */
  if (localVideo) {
    return (
      <div className="overflow-hidden rounded-xl border border-glass-border bg-black">
        <div className="relative aspect-[1.25] w-full sm:aspect-video">
          <PlayerWebButton
        visible={isHost}
        onClick={() => onWebChange(true)}
      />

          <video
            src={localVideo.url}
            controls={isHost}
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>

        <div className="border-t border-glass-border bg-surface-secondary px-3 py-2 text-xs text-muted">
          Bu cihazdaki video: {localVideo.name}
        </div>
      </div>
    );
  }

  /*
   * No room video.
   */
  if (!roomVideo) {
    return (
      <div className="relative flex aspect-[1.25] items-center justify-center rounded-xl border border-glass-border bg-black sm:aspect-video">
        <PlayerWebButton
        visible={isHost}
        onClick={() => onWebChange(true)}
      />

        <div className="text-center">
          <Video className="mx-auto size-10 text-muted" />

          <p className="mt-3 font-display text-sm font-bold">
            Video bekleniyor
          </p>

          <p className="mt-1 px-4 text-xs text-muted">
            Oda sahibi bir video kaynağı eklediğinde burada görünecek.
          </p>
        </div>
      </div>
    );
  }

  /*
   * YouTube.
   *
   * YouTube iframe artık basit iframe değil:
   * - Host API üzerinden player'ı yönetir.
   * - Guest yalnızca server playback state'ini takip eder.
   * - Guest'in iframe'e doğrudan müdahalesi engellenir.
   */
  if (
    roomVideo.kind === "youtube" &&
    roomVideo.video_id
  ) {
    return (
      <YouTubeRoomPlayer
        key={`${room.code}:${roomVideo.video_id}`}
        room={room}
        participantId={participantId}
        isHost={isHost}
        serverOffset={serverOffset}
        videoId={roomVideo.video_id}
        onOpenWeb={() => onWebChange(true)}
      />
    );
  }

  /*
   * Drive / generic embed.
   */
  if (
    roomVideo.kind === "drive" ||
    roomVideo.kind === "embed"
  ) {
    if (roomVideo.stream_url) {
      return (
        <div className="relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video">
          <PlayerWebButton
        visible={isHost}
        onClick={() => onWebChange(true)}
      />

          <video
            ref={videoRef}
            src={roomVideo.stream_url}
            controls={isHost}
            playsInline
            preload="metadata"
            className="absolute inset-0 block h-full w-full object-contain"
          />
      {!isHost && <div className="absolute inset-0 z-10" aria-hidden="true" />}
          {!isHost && (
            <div
              className="absolute inset-0 z-20"
              aria-hidden="true"
            />
          )}
        </div>
      );
    }

    return (
      <div className="relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video">
        <PlayerWebButton
        visible={isHost}
        onClick={() => onWebChange(true)}
      />

        <iframe
          src={roomVideo.embed_url ?? roomVideo.url}
          title={roomVideo.title || "Nexora Watch"}
          className="absolute inset-0 block h-full w-full border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  /*
   * MP4 / WebM / MOV / M3U8.
   */
  return (
    <div className="relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video">
      <PlayerWebButton
        visible={isHost}
        onClick={() => onWebChange(true)}
      />

      <video
        ref={videoRef}
        controls={isHost}
        playsInline
        preload="metadata"
        className="absolute inset-0 block h-full w-full object-contain"
      />
      {!isHost && <div className="absolute inset-0 z-10" aria-hidden="true" />}
    </div>
  );
}

function YouTubeRoomPlayer({
  room,
  participantId,
  isHost,
  serverOffset,
  videoId,
  onOpenWeb,
}: {
  room: Room;
  participantId: string | null;
  isHost: boolean;
  serverOffset: number;
  videoId: string;
  onOpenWeb: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const applyingRemoteRef = useRef(false);
  const sourceKeyRef = useRef(videoId);

  const lastPublishedPosition = useRef(0);
  const lastPublishedPlaying = useRef<boolean | null>(null);
  const lastServerUpdate = useRef(0);

  const [ready, setReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  const playback = room.playback;

  const getTargetPosition = () => {
    let target = Math.max(0, playback.position);

    if (playback.playing) {
      const serverNow = Date.now() + serverOffset;

      target += Math.max(
        0,
        (serverNow - playback.updated_at) / 1000,
      );
    }

    return Number.isFinite(target) ? target : 0;
  };

  const publish = (
    playing: boolean,
    position: number,
  ) => {
    if (
      !isHost ||
      !participantId ||
      applyingRemoteRef.current
    ) {
      return;
    }

    const safePosition = Math.max(
      0,
      Number.isFinite(position) ? position : 0,
    );

    lastPublishedPlaying.current = playing;
    lastPublishedPosition.current = safePosition;
    lastServerUpdate.current = Date.now();

    void api
      .setPlayback(
        room.code,
        participantId,
        playing,
        safePosition,
      )
      .catch(() => {});
  };

  /*
   * Create/destroy YouTube player for this exact video.
   */
  useEffect(() => {
    let cancelled = false;

    sourceKeyRef.current = videoId;
    setReady(false);
    setNeedsGesture(false);

    const create = async () => {
      try {
        const YT = await loadYouTubeApi();

        if (cancelled || !containerRef.current) {
          return;
        }

        const container = containerRef.current;

        container.innerHTML = "";

        const element = document.createElement("div");
        element.className =
          "absolute inset-0 h-full w-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:block [&>iframe]:h-full [&>iframe]:w-full";
        container.appendChild(element);

        const player = new YT.Player(element, {
          width: Math.max(200, container.clientWidth),
          height: Math.max(200, container.clientHeight),
          videoId,
          playerVars: {
            autoplay: 0,
            controls: isHost ? 1 : 0,
            disablekb: isHost ? 0 : 1,
            fs: isHost ? 1 : 0,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (
                cancelled ||
                sourceKeyRef.current !== videoId
              ) {
                return;
              }

              playerRef.current = event.target;
              setReady(true);

              const target = getTargetPosition();

              applyingRemoteRef.current = true;

              if (Math.abs(
                event.target.getCurrentTime() - target,
              ) > 1) {
                event.target.seekTo(target, true);
              }

              if (playback.playing) {
                try {
                  event.target.playVideo();

                  window.setTimeout(() => {
                    if (
                      !cancelled &&
                      sourceKeyRef.current === videoId
                    ) {
                      applyingRemoteRef.current = false;
                    }
                  }, 500);
                } catch {
                  applyingRemoteRef.current = false;
                  if (!isHost) {
                    setNeedsGesture(true);
                  }
                }
              } else {
                event.target.pauseVideo();
                applyingRemoteRef.current = false;
              }
            },

            onStateChange: (event) => {
              if (
                cancelled ||
                sourceKeyRef.current !== videoId
              ) {
                return;
              }

              /*
               * YT:
               * -1 unstarted
               *  0 ended
               *  1 playing
               *  2 paused
               *  3 buffering
               *  5 cued
               */

              if (!isHost) {
                if (
                  applyingRemoteRef.current
                ) {
                  return;
                }

                /*
                 * Guest cannot become authoritative.
                 * Any local interaction is reconciled
                 * back to room.playback.
                 */
                const target = getTargetPosition();

                if (event.data === 1 && !playback.playing) {
                  applyingRemoteRef.current = true;
                  event.target.pauseVideo();
                  event.target.seekTo(target, true);

                  window.setTimeout(() => {
                    applyingRemoteRef.current = false;
                  }, 250);

                  return;
                }

                if (
                  event.data === 2 &&
                  playback.playing
                ) {
                  applyingRemoteRef.current = true;

                  event.target.seekTo(target, true);

                  try {
                    event.target.playVideo();
                  } catch {
                    setNeedsGesture(true);
                  }

                  window.setTimeout(() => {
                    applyingRemoteRef.current = false;
                  }, 500);

                  return;
                }

                if (event.data === 0) {
                  applyingRemoteRef.current = true;

                  if (playback.playing) {
                    event.target.seekTo(target, true);

                    try {
                      event.target.playVideo();
                    } catch {
                      setNeedsGesture(true);
                    }
                  } else {
                    event.target.seekTo(target, true);
                  }

                  window.setTimeout(() => {
                    applyingRemoteRef.current = false;
                  }, 500);
                }

                return;
              }

              /*
               * Host is the only authority.
               *
               * BUFFERING is intentionally ignored.
               */
              if (event.data === 1) {
                publish(
                  true,
                  event.target.getCurrentTime(),
                );
                return;
              }

              if (event.data === 2) {
                publish(
                  false,
                  event.target.getCurrentTime(),
                );
                return;
              }

              if (event.data === 0) {
                publish(
                  false,
                  event.target.getCurrentTime(),
                );
              }
            },
          },
        });

        playerRef.current = player;
      } catch {
        if (!cancelled) {
          setReady(false);
        }
      }
    };

    void create();

    return () => {
      cancelled = true;

      sourceKeyRef.current = "";

      const player = playerRef.current;
      playerRef.current = null;

      try {
        player?.destroy();
      } catch {
        // Ignore player teardown failures during unmount.
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [videoId, isHost]);

  /*
   * Host heartbeat.
   *
   * This is important because YouTube does not expose
   * a native "seeked" DOM event like <video>.
   */
  useEffect(() => {
    if (
      !isHost ||
      !participantId ||
      !ready
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      const player = playerRef.current;

      if (!player || applyingRemoteRef.current) {
        return;
      }

      let state = -1;
      let position = 0;

      try {
        state = player.getPlayerState();
        position = Math.max(
          0,
          player.getCurrentTime(),
        );
      } catch {
        return;
      }

      if (state !== 1 && state !== 2) {
        return;
      }

      const playing = state === 1;
      const positionDelta = Math.abs(
        position - lastPublishedPosition.current,
      );

      const now = Date.now();

      /*
       * Normal heartbeat every ~1.5 sec.
       * A larger jump means host sought.
       */
      if (
        positionDelta >= 0.75 ||
        playing !== lastPublishedPlaying.current ||
        now - lastServerUpdate.current >= 1500
      ) {
        publish(playing, position);
      }
    }, 500);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    isHost,
    participantId,
    ready,
    room.code,
  ]);

  /*
   * Guest follows the authoritative server playback.
   */
  useEffect(() => {
    if (
      isHost ||
      !ready
    ) {
      return;
    }

    const sync = () => {
      const player = playerRef.current;

      if (!player || applyingRemoteRef.current) {
        return;
      }

      const target = getTargetPosition();

      let current = 0;

      try {
        current = Math.max(
          0,
          player.getCurrentTime(),
        );
      } catch {
        return;
      }

      const drift = Math.abs(current - target);

      if (drift > 1.5) {
        applyingRemoteRef.current = true;

        try {
          player.seekTo(target, true);
        } catch {
          // Ignore transient player seek failures.
        }

        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 250);
      }

      if (playback.playing) {
        let state = -1;

        try {
          state = player.getPlayerState();
        } catch {
          return;
        }

        if (state !== 1) {
          applyingRemoteRef.current = true;

          try {
            player.playVideo();
            setNeedsGesture(false);
          } catch {
            setNeedsGesture(true);
          }

          window.setTimeout(() => {
            applyingRemoteRef.current = false;
          }, 500);
        }
      } else {
        let state = -1;

        try {
          state = player.getPlayerState();
        } catch {
          return;
        }

        if (state === 1 || state === 3) {
          applyingRemoteRef.current = true;

          try {
            player.pauseVideo();
          } catch {
            // Ignore transient player pause failures.
          }

          window.setTimeout(() => {
            applyingRemoteRef.current = false;
          }, 250);
        }
      }
    };

    sync();

    const interval = window.setInterval(sync, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    isHost,
    ready,
    playback.playing,
    playback.position,
    playback.updated_at,
    serverOffset,
  ]);

  const manualSync = () => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    const target = getTargetPosition();

    applyingRemoteRef.current = true;

    try {
      player.seekTo(target, true);

      if (playback.playing) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }

      setNeedsGesture(false);
    } catch {
      setNeedsGesture(true);
    }

    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 600);
  };

  return (
    <div className="relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video">
      <PlayerWebButton
        visible={isHost}
        onClick={onOpenWeb}
      />

      <div
        ref={containerRef}
        className="absolute inset-0"
      />

      {!isHost && (
        <div
          className="absolute inset-0 z-10"
          aria-label="Oda sahibi tarafından kontrol edilen video"
        />
      )}

      {!isHost && needsGesture && playback.playing && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-[1px]">
          <button
            type="button"
            onClick={manualSync}
            className="rounded-lg border border-white/20 bg-black/80 px-4 py-3 text-xs font-semibold text-white shadow-lg transition hover:border-brand hover:bg-black"
          >
            Senkronize et
          </button>
        </div>
      )}

      {!ready && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/35">
          <span className="rounded-md bg-black/70 px-3 py-2 text-xs text-white">
            YouTube yükleniyor...
          </span>
        </div>
      )}

      {!isHost && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md bg-black/70 px-2.5 py-1.5 text-[10px] text-white backdrop-blur-sm">
          Video oda sahibi tarafından kontrol ediliyor
        </div>
      )}
    </div>
  );
}

function PlayerWebButton({
  onClick,
  visible = true,
}: {
  onClick: () => void;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-3 right-3 z-30 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-white/15 bg-black/65 px-2.5 text-[10px] font-semibold text-white backdrop-blur-sm transition hover:border-brand hover:bg-black/80"
      aria-label="Web'i player içinde aç"
      title="Web'i player içinde aç"
    >
      <Globe className="size-3.5" />
      Web
    </button>
  );
}

function ChatMessage({ message }: { message: Message }) {
  return (
    <div className="break-words">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs font-bold text-brand-secondary">
          {message.nickname}
        </span>

        <span className="text-[10px] text-muted">
          {formatTime(message.created_at)}
        </span>
      </div>

      <p className="rounded-lg bg-surface-tertiary px-3 py-2 text-sm leading-5">
        {message.text}
      </p>
    </div>
  );
}

function messageKey(message: Message) {
  return (
    message.id ??
    message._id ??
    `${message.created_at}-${message.nickname}-${message.text}`
  );
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
