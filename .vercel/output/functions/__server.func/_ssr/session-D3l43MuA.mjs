//#region node_modules/.nitro/vite/services/ssr/assets/session-D3l43MuA.js
var ApiError = class extends Error {
	status;
	constructor(status, message) {
		super(message);
		this.status = status;
	}
};
function base() {
	if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
	return "";
}
async function request(path, init) {
	const root = base();
	if (!root) throw new ApiError(0, "Sunucu adresi tanımlı değil.");
	let res;
	try {
		res = await fetch(`${root}/api${path}`, {
			...init,
			headers: {
				"Content-Type": "application/json",
				...init?.headers ?? {}
			}
		});
	} catch {
		throw new ApiError(0, "Sunucuya ulaşılamadı.");
	}
	if (!res.ok) {
		let detail = "İstek başarısız oldu";
		try {
			const body = await res.json();
			if (typeof body?.detail === "string") detail = body.detail;
		} catch {}
		throw new ApiError(res.status, detail);
	}
	return await res.json();
}
var api = {
	createRoom: (nickname, name) => request("/rooms", {
		method: "POST",
		body: JSON.stringify({
			nickname,
			name
		})
	}),
	joinRoom: (code, nickname, participant_id) => request(`/rooms/${code}/join`, {
		method: "POST",
		body: JSON.stringify({
			nickname,
			participant_id: participant_id ?? null
		})
	}),
	getRoom: (code) => request(`/rooms/${code}`),
	getMessages: (code) => request(`/rooms/${code}/messages`),
	sendMessage: (code, participant_id, text) => request(`/rooms/${code}/messages`, {
		method: "POST",
		body: JSON.stringify({
			participant_id,
			text
		})
	}),
	setVideo: (code, participant_id, url) => request(`/rooms/${code}/video`, {
		method: "PUT",
		body: JSON.stringify({
			participant_id,
			url
		})
	}),
	setPlayback: (code, participant_id, playing, position) => request(`/rooms/${code}/playback`, {
		method: "PUT",
		body: JSON.stringify({
			participant_id,
			playing,
			position
		})
	}),
	setWebOpen: (code, participant_id, open) => request(`/rooms/${code}/web`, {
		method: "PUT",
		body: JSON.stringify({
			participant_id,
			open
		})
	}),
	leaveRoom: (code, participant_id) => request(`/rooms/${code}/leave`, {
		method: "POST",
		body: JSON.stringify({ participant_id })
	})
};
function wsUrl(code, participantId) {
	return `${typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:"}//${typeof window !== "undefined" ? window.location.host : "localhost:8080"}/api/ws?code=${encodeURIComponent(code)}&participantId=${encodeURIComponent(participantId)}`;
}
function messageKey(m) {
	return m.id ?? m._id ?? `${m.created_at}-${m.nickname}`;
}
var NICK_KEYS = ["nexorawatch:nickname", "sinerave:nickname"];
var roomKeys = (code) => {
	const c = code.toUpperCase();
	return [`nexorawatch:room:${c}`, `sinerave:room:${c}`];
};
function read(key) {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return "";
		const parsed = JSON.parse(raw);
		return typeof parsed === "string" ? parsed : raw;
	} catch {
		return "";
	}
}
function write(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {}
}
function remove(key) {
	try {
		localStorage.removeItem(key);
	} catch {}
}
function getSavedNickname() {
	for (const key of NICK_KEYS) {
		const value = read(key);
		if (value) return value;
	}
	return "";
}
function saveNickname(nickname) {
	write(NICK_KEYS[0], nickname);
	write(NICK_KEYS[1], nickname);
}
function saveRoomSession(code, participantId) {
	const [primary, legacy] = roomKeys(code);
	write(primary, participantId);
	write(legacy, participantId);
}
function getRoomSession(code) {
	for (const key of roomKeys(code)) {
		const value = read(key);
		if (value) return value;
	}
	return null;
}
function clearRoomSession(code) {
	for (const key of roomKeys(code)) remove(key);
}
//#endregion
export { getSavedNickname as a, saveRoomSession as c, getRoomSession as i, wsUrl as l, api as n, messageKey as o, clearRoomSession as r, saveNickname as s, ApiError as t };
