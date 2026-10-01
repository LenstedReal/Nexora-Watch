import { broadcastRealtime } from "../../../../../server/lib/realtime";
import {
  getMessages,
  joinRoom,
  leaveRoom,
  loadRoom,
  sendMessage,
  setPlayback,
  setVideo,
  setWebOpen,
} from "@/lib/nexora/server";

export const dynamic = "force-dynamic";

function jsonErrorResponse(error: unknown): Response {
  if (error instanceof Response) return error;
  console.error("[Nexora API]", error);
  return Response.json({ detail: "Sunucu hatası" }, { status: 500 });
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object") return {};
    return value as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const parts = (await context.params).path ?? [];
    if (parts.length === 1) {
      return Response.json(await loadRoom(parts[0]));
    }
    if (parts.length === 2 && parts[1] === "messages") {
      return Response.json(await getMessages(parts[0]));
    }
    return Response.json({ detail: "Endpoint bulunamadı" }, { status: 404 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const parts = (await context.params).path ?? [];
    const data = await body(request);

    if (parts.length === 2 && parts[1] === "join") {
      return Response.json(
        await joinRoom(parts[0], data.nickname, data.participant_id),
      );
    }
    if (parts.length === 2 && parts[1] === "messages") {
      return Response.json(
        await sendMessage(parts[0], data.participant_id, data.text),
        { status: 201 },
      );
    }
    if (parts.length === 2 && parts[1] === "leave") {
      return Response.json(await leaveRoom(parts[0], data.participant_id));
    }
    return Response.json({ detail: "Endpoint bulunamadı" }, { status: 404 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const parts = (await context.params).path ?? [];
    const data = await body(request);

    if (parts.length === 2 && parts[1] === "video") {
      const room = await setVideo(parts[0], data.participant_id, data.url);
      broadcastRealtime(parts[0], {
        type: "room",
        room,
        server_time: Date.now(),
      });
      return Response.json(room);
    }

    if (parts.length === 2 && parts[1] === "playback") {
      const playback = await setPlayback(
        parts[0],
        data.participant_id,
        data.playing,
        data.position,
      );
      broadcastRealtime(parts[0], {
        type: "playback",
        playback,
        server_time: Date.now(),
      });
      return Response.json(playback);
    }

    if (parts.length === 2 && parts[1] === "web") {
      const room = await setWebOpen(
        parts[0],
        data.participant_id,
        data.open,
        data.url,
      );
      broadcastRealtime(parts[0], {
        type: "web",
        open: room.web_open,
        url: room.web_url,
        server_time: Date.now(),
      });
      return Response.json(room);
    }

    return Response.json({ detail: "Endpoint bulunamadı" }, { status: 404 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
