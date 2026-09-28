import { i as defineWebSocketHandler } from "../../_libs/h3+rou3.mjs";
import { i as setWebOpen, n as sendMessage, r as setPlayback, t as loadRoom } from "../../_chunks/server.mjs";
//#region server/lib/realtime.ts
var peers = /* @__PURE__ */ new Map();
function topic(code) {
	return `nexora-room:${code.toUpperCase()}`;
}
function addRealtimePeer(code, peer) {
	const key = topic(code);
	let set = peers.get(key);
	if (!set) {
		set = /* @__PURE__ */ new Set();
		peers.set(key, set);
	}
	set.add(peer);
}
function removeRealtimePeer(code, peer) {
	const key = topic(code);
	const set = peers.get(key);
	if (!set) return;
	set.delete(peer);
	if (set.size === 0) peers.delete(key);
}
function broadcastRealtime(code, data) {
	const set = peers.get(topic(code));
	if (!set) return;
	for (const peer of set) try {
		peer.send(data);
	} catch {
		set.delete(peer);
	}
}
//#endregion
//#region server/api/ws.ts
function now() {
	return Date.now();
}
function getParams(peer) {
	const url = new URL(peer.request.url);
	return {
		code: url.searchParams.get("code")?.trim().toUpperCase() ?? "",
		participantId: url.searchParams.get("participantId")?.trim() ?? ""
	};
}
var ws_default = defineWebSocketHandler({
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
			server_time: now()
		});
		broadcastRealtime(code, {
			type: "presence",
			participant_id: participantId,
			online: true,
			server_time: now()
		});
	},
	async message(peer, message) {
		const { code, participantId } = getParams(peer);
		if (!code || !participantId) return;
		let data;
		try {
			data = JSON.parse(message.text());
		} catch {
			return;
		}
		if (typeof data !== "object" || data === null || !("type" in data)) return;
		const type = data.type;
		if (type === "ping") {
			peer.send({
				type: "pong",
				server_time: now()
			});
			return;
		}
		if (type === "playback") {
			const payload = data;
			if (typeof payload.playing !== "boolean" || typeof payload.position !== "number" || !Number.isFinite(payload.position) || payload.position < 0) return;
			try {
				broadcastRealtime(code, {
					type: "playback",
					playback: await setPlayback(code, participantId, payload.playing, payload.position),
					server_time: now()
				});
			} catch {}
			return;
		}
		if (type === "web") {
			const payload = data;
			if (typeof payload.open !== "boolean") return;
			try {
				broadcastRealtime(code, {
					type: "web",
					open: (await setWebOpen(code, participantId, payload.open)).web_open,
					server_time: now()
				});
			} catch {}
			return;
		}
		if (type === "message") {
			const payload = data;
			if (typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 1e3) return;
			try {
				broadcastRealtime(code, {
					type: "message",
					message: await sendMessage(code, participantId, payload.text.trim()),
					server_time: now()
				});
			} catch {}
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
			server_time: now()
		});
	}
});
//#endregion
export { ws_default as default };
