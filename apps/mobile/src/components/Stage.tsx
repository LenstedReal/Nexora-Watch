import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme";
import { api, absUrl, errorText } from "../core/api";
import type { Identity, VideoSource } from "../core/types";
import { EmbedPlayer, NativePlayer, PlayerMessage, YouTubePlayer, type PlayerHandle } from "./players";

/** Resolves the playable URL for the room video (uploads need a short-lived signed URL) and picks the player. */
export function Stage({
  video,
  isHost,
  ident,
  playerRef,
  onAddVideo,
  onPlayerError,
  fill,
}: {
  video: VideoSource | null;
  isHost: boolean;
  ident: Identity;
  playerRef: RefObject<PlayerHandle | null>;
  onAddVideo: () => void;
  onPlayerError: (msg: string) => void;
  fill?: boolean;
}) {
  const [uploadUrl, setUploadUrl] = useState<{ id: string; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setErr(null);
    if (video?.kind !== "upload") return;
    let alive = true;
    api
      .mediaUrl(video.media_id, ident)
      .then((r) => alive && setUploadUrl({ id: video.media_id, url: absUrl(r.url) }))
      .catch((e) => alive && setErr(errorText(e)));
    return () => {
      alive = false;
    };
  }, [video?.kind, video?.media_id, ident, nonce]);

  const onError = (msg: string) => {
    setErr(msg);
    onPlayerError(msg);
  };

  let body: ReactNode;
  if (!video) {
    body = isHost ? (
      <Pressable style={styles.center} onPress={onAddVideo}>
        <View style={styles.glow}>
          <Ionicons name="add" size={34} color="#fff" />
        </View>
        <Text style={styles.title}>Video ekle</Text>
        <Text style={styles.detail}>YouTube, bağlantı, siteden algıla veya galeriden yükle</Text>
      </Pressable>
    ) : (
      <PlayerMessage icon={<Ionicons name="film-outline" size={34} color={C.dim} />} title="Video bekleniyor" detail="Oda sahibi bir video seçince burada başlayacak." />
    );
  } else if (err) {
    body = (
      <View style={styles.center}>
        <Ionicons name="alert-circle" size={30} color={C.error} />
        <Text style={styles.title}>{err}</Text>
        <Pressable
          style={styles.retry}
          onPress={() => {
            setErr(null);
            setNonce((n) => n + 1);
          }}
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700" }}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  } else if (video.kind === "youtube" && video.video_id) {
    body = <YouTubePlayer key={`${video.media_id}-${nonce}`} ref={playerRef} videoId={video.video_id} controls={isHost} onError={onError} />;
  } else if (video.kind === "drive_embed" && video.embed_url) {
    body = <EmbedPlayer url={video.embed_url} />;
  } else if (video.kind === "upload") {
    body =
      uploadUrl && uploadUrl.id === video.media_id ? (
        <NativePlayer key={`${uploadUrl.url}-${nonce}`} ref={playerRef} uri={uploadUrl.url} controls={isHost} onError={onError} />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={C.cyan} />
        </View>
      );
  } else {
    const uri = video.stream_url || video.url;
    body = <NativePlayer key={`${uri}-${nonce}`} ref={playerRef} uri={uri} headers={video.headers} controls={isHost} onError={onError} />;
  }

  return (
    <View style={[styles.stage, fill && { aspectRatio: undefined, flex: 1 }]}>
      {body}
      {!isHost && !!video?.title && !err && video.kind !== "youtube" && (
        <View pointerEvents="none" style={styles.titleBar}>
          <Text numberOfLines={1} style={styles.titleText}>
            {video.title}
          </Text>
        </View>
      )}
      {!isHost && video && video.kind !== "drive_embed" && (
        // Guests follow the host: the player is display-only.
        <View style={StyleSheet.absoluteFill} pointerEvents="auto" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", overflow: "hidden" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
  glow: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.purple, alignItems: "center", justifyContent: "center", shadowColor: C.purple, shadowOpacity: 0.8, shadowRadius: 20, elevation: 10 },
  title: { color: C.text, fontSize: 15, fontWeight: "800", textAlign: "center" },
  detail: { color: C.muted, fontSize: 13, textAlign: "center" },
  retry: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: C.cardHi, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginTop: 4 },
  titleBar: { position: "absolute", top: 0, left: 0, right: 0, padding: 10, backgroundColor: "rgba(0,0,0,0.35)" },
  titleText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
