import { defineWebSocketHandler } from "nitro";

import {
  loadRoom,
  sendMessage,
  setPlayback,
  setWebOpen,
} from "../../src/lib/nexora/server";

import {
  addRealtimePeer,
  removeRealtimePeer,
  broadcastRealtime,
} from "../lib/realtime";

function now() {
  return Date.now();
}

function getParams(peer: { request: { url: string } }) {
  const url = new URL(peer.request.url);

  return {
    code: url.searchParams.get("code")?.trim().toUpperCase() ?? "",
    participantId:
      url.searchParams.get("participantId")?.trim() ?? "",
  };
}

export default defineWebSocketHandler({
  async open(peer) {
    const { code, participantId } = getParams(peer);

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

    peer.send({
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
  },

  async message(peer, message) {
    const { code, participantId } = getParams(peer);

    if (!code || !participantId) return;

    let data: unknown;

    try {
      data = JSON.parse(message.text());
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
      peer.send({
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
        const room = await setWebOpen(
          code,
          participantId,
          payload.open,
          payload.url,
        );

        broadcastRealtime(code, {
          type: "web",
          open: room.web_open,
          url: room.web_url,
          server_time: now(),
        });
      } catch {
        // invalid room/participant
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
        // Invalid participant/message is rejected.
      }
    }
  },

  close(peer) {
    const { code, participantId } = getParams(peer);

    if (!code || !participantId) return;

    removeRealtimePeer(code, peer);

    broadcastRealtime(code, {
      type: "presence",
      participant_id: participantId,
      online: false,
      server_time: now(),
    });
  },
});
