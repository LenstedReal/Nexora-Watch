import { createFileRoute } from "@tanstack/react-router";

const DRIVE_HOST = "https://drive.usercontent.google.com/download";

function validId(value: string): boolean {
  return /^[A-Za-z0-9_-]{10,300}$/.test(value);
}

export const Route = createFileRoute("/api/drive/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const id = params.id;

        if (!id || !validId(id)) {
          return new Response("Geçersiz Drive dosya ID", {
            status: 400,
          });
        }

        const incomingRange =
          request.headers.get("range");

        const headers = new Headers({
          Accept: "*/*",
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        });

        if (incomingRange) {
          headers.set("Range", incomingRange);
        }

        const target =
          `${DRIVE_HOST}?id=${encodeURIComponent(id)}&export=download&confirm=t`;

        try {
          const response = await fetch(target, {
            method: "GET",
            redirect: "follow",
            headers,
          });

          if (!response.ok && response.status !== 206) {
            return new Response(
              `Drive ${response.status}`,
              {
                status: response.status,
              },
            );
          }

          const contentType =
            response.headers.get("content-type") ||
            "application/octet-stream";

          // Drive bazen dosya yerine HTML onay sayfası döndürebilir.
          // Böyle durumda native player'a HTML göndermiyoruz.
          if (
            contentType.includes("text/html") ||
            contentType.includes("text/plain")
          ) {
            return new Response(
              "Drive dosyası doğrudan medya olarak alınamadı",
              { status: 502 },
            );
          }

          const out = new Headers();

          for (const name of [
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges",
            "cache-control",
            "etag",
            "last-modified",
          ]) {
            const value = response.headers.get(name);

            if (value) {
              out.set(name, value);
            }
          }

          out.set(
            "Content-Disposition",
            "inline",
          );

          out.set(
            "Access-Control-Allow-Origin",
            "*",
          );

          return new Response(response.body, {
            status: response.status,
            headers: out,
          });
        } catch (error) {
          console.error(
            "[Drive proxy]",
            error,
          );

          return new Response(
            "Drive bağlantısı alınamadı",
            { status: 502 },
          );
        }
      },
    },
  },
});
