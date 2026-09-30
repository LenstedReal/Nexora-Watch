import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";

import { loadRoom } from "./server";

const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

async function toRequest(input: unknown): Promise<{
  request: Request;
  body: HandleUploadBody;
}> {
  if (input instanceof Request) {
    const clone = input.clone();
    const body = (await clone.json()) as HandleUploadBody;
    return { request: input, body };
  }

  const event = input as {
    request?: Request;
    json?: () => Promise<unknown>;
    body?: unknown;
  };

  if (event?.request instanceof Request) {
    const clone = event.request.clone();
    const body = (await clone.json()) as HandleUploadBody;
    return { request: event.request, body };
  }

  let parsed: unknown = event?.body ?? {};

  if (typeof event?.json === "function") {
    parsed = await event.json();
  }

  const body = parsed as HandleUploadBody;
  const request = new Request("https://nexora.local/api/blob-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  return { request, body };
}

export async function handleNexoraBlobUpload(
  input: unknown,
): Promise<Response> {
  const { request, body } = await toRequest(input);

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
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

        const room = await loadRoom(code);
        const participant = room.participants.find(
          (item) => item.id === participantId,
        );

        if (!participant) {
          throw new Error("Odaya katılım bulunamadı");
        }

        if (!participant.is_host) {
          throw new Error("Video yüklemeyi yalnızca oda sahibi yapabilir");
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
      onUploadCompleted: async () => {
        // Video URL oda kaydına istemci setVideo ile yazılır.
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
