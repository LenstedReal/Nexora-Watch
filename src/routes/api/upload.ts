import { createFileRoute } from "@tanstack/react-router";
import { broadcastRealtime } from "../../../server/lib/realtime";
import { saveUploadedVideo } from "@/lib/nexora/media-store";
import { setVideo } from "@/lib/nexora/server";

const ALLOWED =
  /^(video\/(mp4|webm|quicktime|x-m4v|mpeg)|application\/octet-stream)?$/i;

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const code = String(form.get("code") ?? "").trim().toUpperCase();
          const participantId = String(form.get("participant_id") ?? "").trim();
          const file = form.get("file");

          if (!code || !participantId) {
            return Response.json({ detail: "Oda bilgisi eksik" }, { status: 400 });
          }

          if (!(file instanceof File) || file.size < 1) {
            return Response.json({ detail: "Video dosyası seçilmedi" }, { status: 400 });
          }

          if (file.size > MAX_BYTES) {
            return Response.json({ detail: "Video en fazla 2 GB olabilir" }, { status: 400 });
          }

          const namedOk = /\.(mp4|webm|mov|m4v)$/i.test(file.name);
          const typeOk = !file.type || ALLOWED.test(file.type) || file.type.startsWith("video/");

          if (!namedOk && !typeOk) {
            return Response.json({ detail: "Desteklenmeyen video formatı" }, { status: 400 });
          }

          const stored = await saveUploadedVideo(file);
          const room = await setVideo(code, participantId, stored.url);

          broadcastRealtime(code, {
            type: "room",
            room,
            server_time: Date.now(),
          });

          return Response.json({ url: stored.url, name: stored.name, room });
        } catch (error) {
          if (error instanceof Response) return error;
          console.error("[Nexora upload]", error);
          return Response.json(
            {
              detail:
                error instanceof Error ? error.message : "Video yüklenemedi",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
