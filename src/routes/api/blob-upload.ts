import { createFileRoute } from "@tanstack/react-router";
import { handleNexoraBlobUpload } from "@/lib/nexora/blob-handler";

export const Route = createFileRoute("/api/blob-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleNexoraBlobUpload(request);
        } catch (error) {
          console.error("[Nexora Blob upload]", error);
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Video yükleme yetkilendirmesi başarısız",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
