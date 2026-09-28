import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";

import { loadRoom } from "../../src/lib/nexora/server";

const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

export default async function handler(request: Request) {
  const body =
    (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (
        pathname,
        clientPayload,
      ) => {
        let payload: {
          code?: unknown;
          participantId?: unknown;
        } = {};

        try {
          payload =
            typeof clientPayload === "string"
              ? JSON.parse(clientPayload)
              : {};
        } catch {
          throw new Error("Geçersiz upload bilgisi");
        }

        const code =
          typeof payload.code === "string"
            ? payload.code.trim().toUpperCase()
            : "";

        const participantId =
          typeof payload.participantId === "string"
            ? payload.participantId.trim()
            : "";

        if (!code || !participantId) {
          throw new Error("Geçersiz oda bilgisi");
        }

        let room;

        try {
          room = await loadRoom(code);
        } catch (error) {
          if (error instanceof Response) {
            throw new Error("Oda bulunamadı");
          }

          throw error;
        }

        const participant = room.participants.find(
          (item) => item.id === participantId,
        );

        if (!participant) {
          throw new Error("Odaya katılım bulunamadı");
        }

        if (!participant.is_host) {
          throw new Error(
            "Video yüklemeyi yalnızca oda sahibi yapabilir",
          );
        }

        if (!pathname.startsWith(`rooms/${code}/`)) {
          throw new Error("Geçersiz video yolu");
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            code,
            participantId,
          }),
        };
      },

      onUploadCompleted: async ({ blob }) => {
        console.log(
          "[Nexora Blob] upload completed:",
          blob.url,
        );
      },
    });

    return Response.json(jsonResponse);
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
}
