import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  addRealtimePeer,
  broadcastRealtime,
  removeRealtimePeer,
} from "../src/lib/realtime";

import {
  loadRoom,
  sendMessage,
  setPlayback,
  setWebOpen,
} from "../src/lib/nexora/server";

function now() {
  return Date.now();
}

function topic(code: string) {
  return `nexora-room:${code.toUpperCase()}`;
}

function getParams(urlString: string) {
  const url = new URL(urlString, "http://localhost");

  return {
    code: url.searchParams.get("code")?.trim().toUpperCase() ?? "",
    participantId:
      url.searchParams.get("participantId")?.trim() ?? "",
  };
}



function sendRealtime(peer: RealtimePeer, data: unknown) {
  if (peer.readyState !== WebSocket.OPEN) return;

  try {
    peer.send(JSON.stringify(data));
  } catch {
    // Ignore a peer that disappeared during send.
  }
}


const server = createServer((_request, response) => {
  response.writeHead(426, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end("WebSocket upgrade required");
});

const wss = new WebSocketServer({ server });

wss.on("connection", async (peer, request) => {
  const { code, participantId } = getParams(
    request.url ?? "/api/ws",
  );

  if (!code || !participantId) {
    peer.close(1008, "Geçersiz bağlantı");
    return;
  }

  let room;

  try {
    room = await loadRoom(code);
  } catch {
    peer.close(1008, "Oda bulunamadı");
    return;
  }

  addRealtimePeer(code, peer);

  sendRealtime(peer, {
    type: "room",
    room,
    server_time: now(),
  });

  broadcastRealtime(code, {
    type: "presence",
    participant_id: participantId,
    online: true,
    server_time: now(),
  });

  peer.on("message", async (raw) => {
    let data: unknown;

    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("type" in data)
    ) {
      return;
    }

    const type = (data as { type?: unknown }).type;

    if (type === "ping") {
      sendRealtime(peer, {
        type: "pong",
        server_time: now(),
      });
      return;
    }

    if (type === "playback") {
      const payload = data as {
        playing?: unknown;
        position?: unknown;
      };

      if (
        typeof payload.playing !== "boolean" ||
        typeof payload.position !== "number" ||
        !Number.isFinite(payload.position) ||
        payload.position < 0
      ) {
        return;
      }

      try {
        const playback = await setPlayback(
          code,
          participantId,
          payload.playing,
          payload.position,
        );

        broadcastRealtime(code, {
          type: "playback",
          playback,
          server_time: now(),
        });
      } catch {
        // HTTP API validation remains authoritative.
      }

      return;
    }

    if (type === "web") {
      const payload = data as {
        open?: unknown;
        url?: unknown;
      };

      if (typeof payload.open !== "boolean") {
        return;
      }

      try {
        const updatedRoom = await setWebOpen(
          code,
          participantId,
          payload.open,
          payload.url,
        );

        broadcastRealtime(code, {
          type: "web",
          open: updatedRoom.web_open,
          url: updatedRoom.web_url,
          server_time: now(),
        });
      } catch {
        // Invalid room/participant.
      }

      return;
    }

    if (type === "message") {
      const payload = data as {
        text?: unknown;
      };

      if (
        typeof payload.text !== "string" ||
        !payload.text.trim() ||
        payload.text.length > 1000
      ) {
        return;
      }

      try {
        const messageResult = await sendMessage(
          code,
          participantId,
          payload.text.trim(),
        );

        broadcastRealtime(code, {
          type: "message",
          message: messageResult,
          server_time: now(),
        });
      } catch {
        // Invalid participant/message.
      }
    }
  });

  peer.on("close", () => {
    removeRealtimePeer(code, peer);

    broadcastRealtime(code, {
      type: "presence",
      participant_id: participantId,
      online: false,
      server_time: now(),
    });
  });

  peer.on("error", () => {
    removeRealtimePeer(code, peer);
  });
});

export { server };

export default server;
