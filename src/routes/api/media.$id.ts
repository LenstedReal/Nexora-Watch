import { createFileRoute } from "@tanstack/react-router";
import { mediaStream, readStoredMedia } from "@/lib/nexora/media-store";

function mediaHeaders(
  stored: { mime: string; size: number },
  extra?: Record<string, string>,
): Headers {
  return new Headers({
    "Content-Type": stored.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  });
}

export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      HEAD: async ({ params }) => {
        const stored = await readStoredMedia(params.id);

        if (!stored?.path) {
          return new Response("Video bulunamadı", { status: 404 });
        }

        return new Response(null, {
          status: 200,
          headers: mediaHeaders(stored, {
            "Content-Length": String(stored.size),
          }),
        });
      },
      GET: async ({ params, request }) => {
        const stored = await readStoredMedia(params.id);

        if (!stored?.path) {
          return new Response("Video bulunamadı", { status: 404 });
        }

        const range = request.headers.get("range");
        const size = stored.size;

        if (range) {
          const match = range.match(/bytes=(\d*)-(\d*)/);
          const start = match?.[1] ? Number(match[1]) : 0;
          const end = match?.[2] ? Number(match[2]) : size - 1;

          if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            start < 0 ||
            end >= size ||
            start > end
          ) {
            return new Response("Geçersiz aralık", {
              status: 416,
              headers: { "Content-Range": `bytes */${size}` },
            });
          }

          const stream = mediaStream(stored, start, end);

          return new Response(stream, {
            status: 206,
            headers: mediaHeaders(stored, {
              "Content-Length": String(end - start + 1),
              "Content-Range": `bytes ${start}-${end}/${size}`,
            }),
          });
        }

        const stream = mediaStream(stored, 0, size - 1);

        return new Response(stream, {
          status: 200,
          headers: mediaHeaders(stored, {
            "Content-Length": String(size),
          }),
        });
      },
    },
  },
});
