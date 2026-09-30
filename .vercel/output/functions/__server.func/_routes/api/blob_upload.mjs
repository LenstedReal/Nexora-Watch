import { n as handleUpload } from "../../_libs/@vercel/blob+[...].mjs";
import { t as loadRoom } from "../../_chunks/server.mjs";
//#region src/lib/nexora/blob-handler.ts
var ALLOWED_TYPES = [
	"video/mp4",
	"video/webm",
	"video/quicktime",
	"video/x-m4v"
];
var MAX_BYTES = 2147483648;
async function toRequest(input) {
	if (input instanceof Request) return {
		request: input,
		body: await input.clone().json()
	};
	const event = input;
	if (event?.request instanceof Request) {
		const body = await event.request.clone().json();
		return {
			request: event.request,
			body
		};
	}
	let parsed = event?.body ?? {};
	if (typeof event?.json === "function") parsed = await event.json();
	const body = parsed;
	return {
		request: new Request("https://nexora.local/api/blob-upload", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body ?? {})
		}),
		body
	};
}
async function handleNexoraBlobUpload(input) {
	const { request, body } = await toRequest(input);
	try {
		const jsonResponse = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async (pathname, clientPayload) => {
				let payload = {};
				try {
					payload = typeof clientPayload === "string" ? JSON.parse(clientPayload) : {};
				} catch {
					throw new Error("Geçersiz upload bilgisi");
				}
				const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
				const participantId = typeof payload.participantId === "string" ? payload.participantId.trim() : "";
				if (!code || !participantId) throw new Error("Geçersiz oda bilgisi");
				const participant = (await loadRoom(code)).participants.find((item) => item.id === participantId);
				if (!participant) throw new Error("Odaya katılım bulunamadı");
				if (!participant.is_host) throw new Error("Video yüklemeyi yalnızca oda sahibi yapabilir");
				if (!pathname.startsWith(`rooms/${code}/`)) throw new Error("Geçersiz video yolu");
				return {
					allowedContentTypes: ALLOWED_TYPES,
					maximumSizeInBytes: MAX_BYTES,
					addRandomSuffix: true,
					tokenPayload: JSON.stringify({
						code,
						participantId
					})
				};
			},
			onUploadCompleted: async () => {}
		});
		return Response.json(jsonResponse);
	} catch (error) {
		console.error("[Nexora Blob upload]", error);
		return Response.json({ error: error instanceof Error ? error.message : "Video yükleme yetkilendirmesi başarısız" }, { status: 400 });
	}
}
//#endregion
//#region server/api/blob-upload.post.ts
async function handler(event) {
	return handleNexoraBlobUpload(event);
}
//#endregion
export { handler as default };
