import { o as __toESM } from "./_runtime.mjs";
import { a as require_react, i as require_jsx_runtime, r as useQueryClient, t as useQuery } from "./_libs/react+tanstack__react-query.mjs";
import { a as Users, d as MessageCircle, f as LogOut, g as Copy, i as Video, m as Globe, r as X, s as Upload, u as Send, v as ArrowLeft } from "./_libs/lucide-react.mjs";
import { r as upload } from "./_libs/@vercel/blob+[...].mjs";
import { i as normalizeWebUrl, n as Route$4, r as DEFAULT_WEB_URL } from "./_ssr/router-xRwoUlRM.mjs";
import { a as getSavedNickname, i as getRoomSession, l as wsUrl, n as api, o as messageKey$1, r as clearRoomSession, t as ApiError } from "./_ssr/session-hq0f4atC.mjs";
import { t as Hls } from "./_libs/hls.js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_code-axC6qpiT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function useRoom({ code, participantId }) {
	const queryClient = useQueryClient();
	const [connected, setConnected] = (0, import_react.useState)(false);
	const [serverOffset, setServerOffset] = (0, import_react.useState)(0);
	const offsetRef = (0, import_react.useRef)(0);
	const socketRef = (0, import_react.useRef)(null);
	const enabled = !!participantId;
	const roomQuery = useQuery({
		queryKey: ["room", code],
		queryFn: () => api.getRoom(code),
		enabled,
		retry: (count, err) => !(err instanceof ApiError && (err.status === 404 || err.status === 410)) && count < 2,
		refetchInterval: 1e3
	});
	const messagesQuery = useQuery({
		queryKey: ["messages", code],
		queryFn: () => api.getMessages(code),
		enabled,
		refetchInterval: 1e3
	});
	const sendRealtime = (0, import_react.useCallback)((payload) => {
		try {
			const socket = socketRef.current;
			if (socket?.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify(payload));
				return true;
			}
		} catch {}
		return false;
	}, []);
	const applyOffset = (0, import_react.useCallback)((serverTime) => {
		if (!serverTime) return;
		const next = serverTime - Date.now();
		if (Math.abs(next - offsetRef.current) > 150) {
			offsetRef.current = next;
			setServerOffset(next);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		if (roomQuery.data?.server_time) applyOffset(roomQuery.data.server_time);
	}, [roomQuery.data?.server_time, applyOffset]);
	(0, import_react.useEffect)(() => {
		if (!participantId) return;
		let socket = null;
		let closed = false;
		let retry = null;
		let ping = null;
		const connect = () => {
			if (closed) return;
			try {
				socket = new WebSocket(wsUrl(code, participantId));
				socketRef.current = socket;
			} catch {
				retry = setTimeout(connect, 3e3);
				return;
			}
			socket.onopen = () => {
				setConnected(true);
				ping = setInterval(() => {
					try {
						socket?.send(JSON.stringify({ type: "ping" }));
					} catch {}
				}, 2e4);
			};
			socket.onmessage = (ev) => {
				let data;
				try {
					data = JSON.parse(String(ev.data));
				} catch {
					return;
				}
				applyOffset(data.server_time);
				if (data.type === "room") queryClient.setQueryData(["room", code], data.room);
				else if (data.type === "playback") queryClient.setQueryData(["room", code], (old) => old ? {
					...old,
					playback: data.playback,
					server_time: data.server_time ?? old.server_time
				} : old);
				else if (data.type === "web") {
					const payload = data;
					const open = Boolean(payload.open);
					const url = typeof payload.url === "string" && payload.url.trim() ? payload.url : void 0;
					queryClient.setQueryData(["room", code], (old) => old ? {
						...old,
						web_open: open,
						web_url: url ?? old.web_url
					} : old);
					window.dispatchEvent(new CustomEvent("nexora:web-sync", { detail: {
						open,
						url
					} }));
				} else if (data.type === "message") {
					const msg = data.message;
					queryClient.setQueryData(["messages", code], (old) => {
						const list = old ?? [];
						const key = messageKey$1(msg);
						if (list.some((m) => messageKey$1(m) === key)) return list;
						return [...list, msg];
					});
				}
			};
			const onClose = () => {
				setConnected(false);
				if (ping) clearInterval(ping);
				ping = null;
				if (!closed) retry = setTimeout(connect, 2500);
			};
			socket.onclose = onClose;
			socket.onerror = () => {
				try {
					socket?.close();
				} catch {}
			};
		};
		connect();
		return () => {
			closed = true;
			if (retry) clearTimeout(retry);
			if (ping) clearInterval(ping);
			try {
				socket?.close();
			} catch {}
		};
	}, [
		code,
		participantId,
		queryClient,
		applyOffset
	]);
	return {
		room: roomQuery.data ?? null,
		roomError: roomQuery.error,
		roomLoading: roomQuery.isLoading,
		messages: messagesQuery.data ?? [],
		connected,
		serverOffset,
		transport: connected ? "realtime" : "polling",
		sendRealtime
	};
}
function RoomPage() {
	const { code } = Route$4.useParams();
	const queryClient = useQueryClient();
	const [participantId, setParticipantId] = (0, import_react.useState)(null);
	const [sessionReady, setSessionReady] = (0, import_react.useState)(false);
	const [nickname, setNickname] = (0, import_react.useState)("");
	const [message, setMessage] = (0, import_react.useState)("");
	const [videoUrl, setVideoUrl] = (0, import_react.useState)("");
	const [localVideo, setLocalVideo] = (0, import_react.useState)(null);
	const [webOpen, setWebOpen] = (0, import_react.useState)(false);
	const [webUrl, setWebUrl] = (0, import_react.useState)(DEFAULT_WEB_URL);
	const [localUploading, setLocalUploading] = (0, import_react.useState)(false);
	const [uploadProgress, setUploadProgress] = (0, import_react.useState)(0);
	const [sending, setSending] = (0, import_react.useState)(false);
	const [notice, setNotice] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		return () => {
			if (localVideo?.url) URL.revokeObjectURL(localVideo.url);
		};
	}, [localVideo?.url]);
	(0, import_react.useEffect)(() => {
		setParticipantId(getRoomSession(code));
		setNickname(getSavedNickname());
		setSessionReady(true);
	}, [code]);
	const { room, roomError, roomLoading, messages, connected, serverOffset, sendRealtime } = useRoom({
		code,
		participantId
	});
	const isHost = (0, import_react.useMemo)(() => room?.participants.find((participant) => participant.id === participantId) ?? null, [room, participantId])?.is_host === true;
	const hostWebAppliedRef = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		hostWebAppliedRef.current = false;
		setWebOpen(false);
	}, [code]);
	(0, import_react.useEffect)(() => {
		if (typeof room?.web_open !== "boolean") return;
		if (isHost && hostWebAppliedRef.current) {
			if (typeof room.web_url === "string" && room.web_url.trim()) setWebUrl(room.web_url);
			return;
		}
		if (isHost) hostWebAppliedRef.current = true;
		setWebOpen(room.web_open);
		if (typeof room.web_url === "string" && room.web_url.trim()) setWebUrl(room.web_url);
	}, [
		isHost,
		room?.web_open,
		room?.web_url
	]);
	(0, import_react.useEffect)(() => {
		const onWebSync = (event) => {
			const detail = event.detail;
			if (typeof detail?.open === "boolean") setWebOpen(detail.open);
			if (typeof detail?.url === "string" && detail.url.trim()) setWebUrl(detail.url);
		};
		window.addEventListener("nexora:web-sync", onWebSync);
		return () => {
			window.removeEventListener("nexora:web-sync", onWebSync);
		};
	}, []);
	const openSyncedWeb = (0, import_react.useCallback)((open, nextUrl) => {
		if (!isHost || !participantId) return;
		const resolvedUrl = nextUrl ? normalizeWebUrl(nextUrl) : webUrl || "https://www.google.com/search?igu=1&hl=tr";
		setWebOpen(open);
		setWebUrl(resolvedUrl);
		queryClient.setQueryData(["room", code], (old) => old ? {
			...old,
			web_open: open,
			web_url: resolvedUrl
		} : old);
		window.dispatchEvent(new CustomEvent("nexora:web-sync", { detail: {
			open,
			url: resolvedUrl
		} }));
		sendRealtime({
			type: "web",
			open,
			url: resolvedUrl
		});
		api.setWebOpen(code, participantId, open, resolvedUrl).then((updatedRoom) => {
			queryClient.setQueryData(["room", code], updatedRoom);
			if (updatedRoom.web_url) setWebUrl(updatedRoom.web_url);
		}).catch(() => {});
	}, [
		isHost,
		participantId,
		code,
		queryClient,
		sendRealtime,
		webUrl
	]);
	(0, import_react.useEffect)(() => {
		if (!room?.video?.url) return;
		setVideoUrl(room.video.url);
	}, [room?.video?.url]);
	const flash = (text) => {
		setNotice(text);
		window.setTimeout(() => setNotice(""), 2500);
	};
	const sendMessage = async () => {
		const text = message.trim();
		if (!text || !participantId || sending) return;
		setSending(true);
		try {
			await api.sendMessage(code, participantId, text);
			setMessage("");
		} catch (error) {
			flash(error instanceof Error ? error.message : "Mesaj gönderilemedi.");
		} finally {
			setSending(false);
		}
	};
	const selectLocalVideo = async (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!(file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name))) {
			flash("Desteklenmeyen video formatı.");
			event.target.value = "";
			return;
		}
		if (!participantId || !isHost) {
			flash("Yerel videoyu yalnızca oda sahibi yükleyebilir.");
			event.target.value = "";
			return;
		}
		if (file.size > 2147483648) {
			flash("Video en fazla 2 GB olabilir.");
			event.target.value = "";
			return;
		}
		const previewUrl = URL.createObjectURL(file);
		setLocalVideo((previous) => {
			if (previous?.url?.startsWith("blob:")) URL.revokeObjectURL(previous.url);
			return {
				url: previewUrl,
				name: file.name
			};
		});
		setLocalUploading(true);
		setUploadProgress(0);
		try {
			let updatedRoom = null;
			try {
				const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-180);
				const blob = await upload(`rooms/${code}/${Date.now()}-${safeName}`, file, {
					access: "public",
					handleUploadUrl: "/api/blob-upload",
					clientPayload: JSON.stringify({
						code,
						participantId,
						filename: file.name
					}),
					multipart: true,
					onUploadProgress: ({ percentage }) => {
						setUploadProgress(Math.round(percentage));
					}
				});
				updatedRoom = await api.setVideo(code, participantId, blob.url);
			} catch {
				updatedRoom = (await postLocalVideo(file, code, participantId, (pct) => setUploadProgress(pct))).room;
			}
			if (updatedRoom) {
				queryClient.setQueryData(["room", code], updatedRoom);
				if (updatedRoom.video?.url) setVideoUrl(updatedRoom.video.url);
			}
			setLocalVideo((previous) => {
				if (previous?.url?.startsWith("blob:")) URL.revokeObjectURL(previous.url);
				return null;
			});
			flash("Yerel video odaya yüklendi ve senkronize edildi.");
		} catch (error) {
			console.error("[Nexora local video upload]", error);
			flash(error instanceof Error ? error.message : "Video yüklenemedi.");
		} finally {
			setLocalUploading(false);
			event.target.value = "";
		}
	};
	const updateVideo = async () => {
		const url = videoUrl.trim();
		if (!url || !participantId || !isHost || sending) return;
		setSending(true);
		try {
			const updatedRoom = await api.setVideo(code, participantId, url);
			queryClient.setQueryData(["room", code], updatedRoom);
			if (webOpen) openSyncedWeb(false);
			flash("Video kaynağı güncellendi.");
		} catch {
			openSyncedWeb(true, url);
			flash("Web paylaşıldı. Video bulunursa filme döner.");
		} finally {
			setSending(false);
		}
	};
	const copyCode = async () => {
		try {
			await navigator.clipboard.writeText(room?.code ?? code);
			flash("Oda kodu kopyalandı.");
		} catch {
			flash("Oda kodu kopyalanamadı.");
		}
	};
	const leaveRoom = async () => {
		if (participantId) {
			try {
				await api.leaveRoom(code, participantId);
			} catch {}
			clearRoomSession(code);
		}
		window.location.href = "/";
	};
	if (!sessionReady || roomLoading && !room) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-surface text-on-surface",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Oda yükleniyor..."
			})]
		})
	});
	if (!room) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-surface px-4 text-on-surface",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md rounded-xl border border-border bg-surface-secondary p-6 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-xl font-bold",
					children: "Oda yüklenemedi"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: roomError?.message ?? "Oda bulunamadı veya süresi dolmuş olabilir."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: "/",
					className: "mt-5 inline-flex min-h-11 items-center rounded-md bg-brand px-5 font-display text-sm font-bold text-on-brand",
					children: "Ana sayfaya dön"
				})
			]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "min-h-dvh bg-surface text-on-surface",
		style: {
			width: "1024px",
			maxWidth: "none",
			zoom: "min(1, calc(100vw / 1024px))"
		},
		children: [
			notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed top-4 right-4 left-4 z-50 mx-auto max-w-md rounded-lg border border-brand/40 bg-surface-secondary px-4 py-3 text-center text-sm shadow-lg",
				children: notice
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "border-b border-border bg-surface-secondary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: "/",
							className: "rounded-md p-2 text-muted hover:text-on-surface",
							"aria-label": "Ana sayfa",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "truncate font-display text-base font-bold",
								children: room.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => void copyCode(),
								className: "inline-flex items-center gap-1 text-xs text-brand-secondary",
								children: [room.code, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3" })]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden items-center gap-2 text-xs text-muted sm:flex",
							title: connected ? "Gerçek zamanlı bağlantı aktif" : "HTTP bağlantısı aktif; gerçek zamanlı bağlantı bekleniyor",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `size-2 rounded-full ${connected ? "bg-success" : "bg-warning"}` }), connected ? "Gerçek zamanlı" : "Bağlantı aktif"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => void leaveRoom(),
							className: "inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-4" }), "Çık"]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "min-w-0 space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VideoPlayer, {
							room,
							participantId,
							isHost,
							serverOffset,
							webOpen,
							webUrl,
							onWebChange: openSyncedWeb,
							localVideo
						}),
						isHost ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-xl border border-glass-border bg-surface-secondary p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-3 flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, { className: "size-4 text-brand" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-display text-sm font-bold",
										children: "Video kaynağı"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-auto text-[10px] font-bold text-brand-secondary",
										children: "HOST"
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: videoUrl,
											onChange: (event) => setVideoUrl(event.target.value),
											onKeyDown: (event) => {
												if (event.key === "Enter") updateVideo();
											},
											placeholder: "YouTube / Drive / MP4 / M3U8",
											className: "min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-tertiary px-3 text-sm outline-none focus:border-brand"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: !videoUrl.trim() || sending,
											onClick: () => void updateVideo(),
											className: "min-h-11 shrink-0 rounded-md bg-brand px-4 font-display text-sm font-bold text-on-brand disabled:opacity-50",
											children: "Ayarla"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "relative flex min-h-20 w-full cursor-pointer items-center gap-4 overflow-hidden rounded-lg border border-dashed border-brand/40 bg-surface-tertiary/60 px-4 py-3 transition hover:border-brand hover:bg-surface-tertiary",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "grid size-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-5" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "min-w-0 flex-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "block font-display text-sm font-bold",
														children: "Cihazdan video seç"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "mt-1 block text-xs text-muted",
														children: "MP4, WebM, MOV veya M4V • Android / PC"
													}),
													localUploading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "mt-1 block text-xs text-brand-secondary",
														children: ["Yükleniyor %", uploadProgress]
													}) : localVideo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "mt-1 block truncate text-xs text-brand-secondary",
														children: ["Seçildi: ", localVideo.name]
													}) : null
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "shrink-0 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted",
												children: "Seç"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "file",
												accept: "video/*,.mp4,.webm,.mov,.m4v",
												className: "absolute inset-0 z-10 cursor-pointer opacity-0",
												disabled: localUploading,
												onChange: selectLocalVideo
											})
										]
									}),
									localVideo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-3 rounded-md border border-border bg-surface-tertiary px-3 py-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "truncate text-xs font-semibold",
												children: localVideo.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[10px] text-muted",
												children: "Bu cihazda oynatılıyor"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												URL.revokeObjectURL(localVideo.url);
												setLocalVideo(null);
											},
											className: "shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-on-surface",
											children: "Kaldır"
										})]
									}) : null
								]
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-xl border border-border bg-surface-secondary px-4 py-3 text-xs text-muted",
							children: "Videoyu yalnızca oda sahibi değiştirebilir."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-xl border border-glass-border bg-surface-secondary p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-3 flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4 text-brand-secondary" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-display text-sm font-bold",
										children: "Katılımcılar"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-auto text-xs text-muted",
										children: room.participants.length
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-2",
								children: room.participants.map((participant) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "inline-flex items-center gap-2 rounded-full border border-border bg-surface-tertiary px-3 py-2 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `size-2 rounded-full ${participant.online ? "bg-success" : "bg-muted"}` }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: participant.nickname }),
										participant.is_host ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-bold text-brand-secondary",
											children: "HOST"
										}) : null
									]
								}, participant.id))
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-glass-border bg-surface-secondary",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-h-14 items-center gap-2 border-b border-border px-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "size-4 text-brand" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-sm font-bold",
									children: "Sohbet"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-auto text-xs text-muted",
									children: messages.length
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 space-y-3 overflow-y-auto p-4",
							children: messages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex min-h-40 items-center justify-center text-center text-xs text-muted",
								children: [
									"Henüz mesaj yok.",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"İlk mesajı sen gönder."
								]
							}) : messages.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatMessage, { message: item }, messageKey(item)))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-t border-border p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mb-2 flex flex-wrap gap-1",
								children: [
									"😀",
									"😂",
									"❤️",
									"🔥",
									"👍",
									"😎",
									"😭",
									"😡",
									"👀",
									"🎉",
									"💀",
									"🤣"
								].map((emoji) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setMessage((current) => `${current}${emoji}`),
									className: "grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface-tertiary text-base transition hover:border-brand hover:bg-surface-tertiary/80 active:scale-95",
									"aria-label": `${emoji} ekle`,
									children: emoji
								}, emoji))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: message,
									maxLength: 1e3,
									onChange: (event) => setMessage(event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											sendMessage();
										}
									},
									placeholder: nickname ? `${nickname} olarak yaz...` : "Mesaj yaz...",
									className: "min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-tertiary px-3 text-sm outline-none focus:border-brand"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: !message.trim() || !participantId || sending,
									onClick: () => void sendMessage(),
									className: "grid size-11 shrink-0 place-items-center rounded-md bg-brand text-on-brand disabled:opacity-50",
									"aria-label": "Mesaj gönder",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" })
								})]
							})]
						})
					]
				})]
			})
		]
	});
}
function loadYouTubeApi() {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	if (window.__nexoraYouTubeApiPromise) return window.__nexoraYouTubeApiPromise;
	window.__nexoraYouTubeApiPromise = new Promise((resolve, reject) => {
		const previousReady = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previousReady?.();
			if (window.YT?.Player) resolve(window.YT);
			else reject(/* @__PURE__ */ new Error("YouTube IFrame API yüklenemedi."));
		};
		if (document.querySelector("script[src=\"https://www.youtube.com/iframe_api\"]")) return;
		const script = document.createElement("script");
		script.src = "https://www.youtube.com/iframe_api";
		script.async = true;
		script.onerror = () => reject(/* @__PURE__ */ new Error("YouTube IFrame API script yüklenemedi."));
		document.head.appendChild(script);
	});
	return window.__nexoraYouTubeApiPromise;
}
function postLocalVideo(file, code, participantId, onProgress) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const form = new FormData();
		form.append("code", code);
		form.append("participant_id", participantId);
		form.append("file", file, file.name);
		xhr.open("POST", "/api/upload");
		xhr.timeout = 0;
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable && event.total > 0) onProgress(Math.round(event.loaded / event.total * 100));
		};
		xhr.onload = () => {
			let data = {};
			try {
				data = JSON.parse(xhr.responseText);
			} catch {
				reject(/* @__PURE__ */ new Error("Video yüklenemedi"));
				return;
			}
			if (xhr.status >= 200 && xhr.status < 300 && data.room && data.url) {
				resolve({
					url: data.url,
					name: data.name ?? file.name,
					room: data.room
				});
				return;
			}
			reject(new Error(data.detail || "Video yüklenemedi"));
		};
		xhr.onerror = () => reject(/* @__PURE__ */ new Error("Yükleme bağlantısı koptu"));
		xhr.ontimeout = () => reject(/* @__PURE__ */ new Error("Yükleme zaman aşımı"));
		xhr.send(form);
	});
}
function VideoPlayer({ room, participantId, isHost, webOpen, webUrl, onWebChange, serverOffset, localVideo }) {
	const videoRef = (0, import_react.useRef)(null);
	const hlsRef = (0, import_react.useRef)(null);
	const syncingRemote = (0, import_react.useRef)(false);
	const lastServerUpdate = (0, import_react.useRef)(0);
	const hostNativeReadyRef = (0, import_react.useRef)(false);
	const roomVideo = room.video;
	const source = roomVideo?.stream_url ?? roomVideo?.embed_url ?? roomVideo?.url ?? "";
	const isHls = /\.m3u8(?:$|[?#])/i.test(source) || roomVideo?.title?.toLowerCase().includes(".m3u8") === true;
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (!video || localVideo || !roomVideo) return;
		if (hlsRef.current) {
			hlsRef.current.destroy();
			hlsRef.current = null;
		}
		if ((roomVideo.kind === "direct" || roomVideo.kind === "hls") && isHls) {
			if (Hls.isSupported()) {
				const hls = new Hls({
					enableWorker: true,
					lowLatencyMode: true,
					liveSyncDurationCount: 3,
					liveMaxLatencyDurationCount: 6,
					maxBufferLength: 30,
					backBufferLength: 30
				});
				hlsRef.current = hls;
				hls.loadSource(source);
				hls.attachMedia(video);
				return () => {
					hls.destroy();
					hlsRef.current = null;
				};
			}
			if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = source;
			return;
		}
		if (roomVideo.kind === "direct" || roomVideo.kind === "hls") {
			video.src = source;
			return () => {
				video.removeAttribute("src");
				video.load();
			};
		}
	}, [
		source,
		roomVideo,
		localVideo,
		isHls
	]);
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (!video || !isHost || !participantId || localVideo || !roomVideo) return;
		const publish = (playing) => {
			if (syncingRemote.current) return;
			if (!hostNativeReadyRef.current) return;
			lastServerUpdate.current = Date.now();
			api.setPlayback(room.code, participantId, playing, Math.max(0, video.currentTime)).catch(() => {});
		};
		const handlePlay = () => {
			publish(true);
		};
		const handlePause = () => {
			publish(false);
		};
		const handleSeeked = () => {
			publish(!video.paused);
		};
		const heartbeat = window.setInterval(() => {
			if (syncingRemote.current) return;
			if (!hostNativeReadyRef.current) return;
			const now = Date.now();
			if (now - lastServerUpdate.current < 1200) return;
			lastServerUpdate.current = now;
			api.setPlayback(room.code, participantId, !video.paused, Math.max(0, video.currentTime)).catch(() => {});
		}, 1e3);
		video.addEventListener("play", handlePlay);
		video.addEventListener("pause", handlePause);
		video.addEventListener("seeked", handleSeeked);
		return () => {
			window.clearInterval(heartbeat);
			video.removeEventListener("play", handlePlay);
			video.removeEventListener("pause", handlePause);
			video.removeEventListener("seeked", handleSeeked);
		};
	}, [
		room.code,
		participantId,
		isHost,
		localVideo,
		roomVideo
	]);
	(0, import_react.useEffect)(() => {
		hostNativeReadyRef.current = false;
	}, [
		source,
		localVideo?.url,
		roomVideo?.kind,
		webOpen
	]);
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (!video || !isHost || localVideo || !roomVideo) return;
		const applyPersisted = () => {
			if (hostNativeReadyRef.current) return;
			const playback = room.playback;
			let target = Math.max(0, playback.position);
			if (playback.playing) {
				const serverNow = Date.now() + serverOffset;
				target += Math.max(0, (serverNow - playback.updated_at) / 1e3);
			}
			if (!Number.isFinite(target)) {
				hostNativeReadyRef.current = true;
				return;
			}
			syncingRemote.current = true;
			try {
				video.currentTime = target;
			} catch {}
			if (playback.playing) video.play().catch(() => {});
			else video.pause();
			hostNativeReadyRef.current = true;
			window.setTimeout(() => {
				syncingRemote.current = false;
			}, 350);
		};
		if (video.readyState >= 1) {
			applyPersisted();
			return;
		}
		video.addEventListener("loadedmetadata", applyPersisted);
		return () => {
			video.removeEventListener("loadedmetadata", applyPersisted);
		};
	}, [
		isHost,
		localVideo,
		roomVideo,
		source,
		serverOffset,
		room.playback.playing,
		room.playback.position,
		room.playback.updated_at
	]);
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (!video || isHost || localVideo || !roomVideo) return;
		const sync = () => {
			const playback = room.playback;
			let target = Math.max(0, playback.position);
			if (playback.playing) {
				const serverNow = Date.now() + serverOffset;
				target += Math.max(0, (serverNow - playback.updated_at) / 1e3);
			}
			if (!Number.isFinite(target)) return;
			const drift = target - video.currentTime;
			if (Math.abs(drift) > 1.5) {
				syncingRemote.current = true;
				try {
					video.currentTime = target;
				} catch {}
				window.setTimeout(() => {
					syncingRemote.current = false;
				}, 200);
			}
			if (playback.playing && video.paused) {
				syncingRemote.current = true;
				video.play().catch(() => {});
				window.setTimeout(() => {
					syncingRemote.current = false;
				}, 350);
			}
			if (!playback.playing && !video.paused) {
				syncingRemote.current = true;
				video.pause();
				window.setTimeout(() => {
					syncingRemote.current = false;
				}, 200);
			}
		};
		sync();
		const interval = window.setInterval(sync, 1e3);
		return () => {
			window.clearInterval(interval);
		};
	}, [
		room.playback.playing,
		room.playback.position,
		room.playback.updated_at,
		serverOffset,
		isHost,
		localVideo,
		roomVideo
	]);
	if (webOpen) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute inset-0 flex flex-col bg-surface-secondary",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative z-20 flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "size-4 text-brand" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-xs font-bold",
						children: "Web"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] text-muted",
						children: "Google"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => onWebChange(false),
						className: "ml-auto inline-flex min-h-8 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-semibold text-muted transition hover:text-on-surface",
						"aria-label": "Filme dön",
						title: "Filme dön",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), "Film"]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-h-0 flex-1 bg-white",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
					src: webUrl || "https://www.google.com/search?igu=1&hl=tr",
					title: "Nexora Web",
					className: "absolute inset-0 h-full w-full border-0 bg-white",
					allow: "autoplay; clipboard-read; clipboard-write; fullscreen",
					allowFullScreen: true,
					referrerPolicy: "strict-origin-when-cross-origin"
				}), !isHost ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 z-10",
					"aria-hidden": "true"
				}) : null]
			})]
		})
	});
	if (localVideo) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-xl border border-glass-border bg-black",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative aspect-[1.25] w-full sm:aspect-video",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerWebButton, {
				visible: isHost,
				onClick: () => onWebChange(true)
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				src: localVideo.url,
				controls: isHost,
				playsInline: true,
				preload: "metadata",
				className: "absolute inset-0 h-full w-full object-contain"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "border-t border-glass-border bg-surface-secondary px-3 py-2 text-xs text-muted",
			children: ["Bu cihazdaki video: ", localVideo.name]
		})]
	});
	if (!roomVideo) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex aspect-[1.25] items-center justify-center rounded-xl border border-glass-border bg-black sm:aspect-video",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerWebButton, {
			visible: isHost,
			onClick: () => onWebChange(true)
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, { className: "mx-auto size-10 text-muted" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 font-display text-sm font-bold",
					children: "Video bekleniyor"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 px-4 text-xs text-muted",
					children: "Oda sahibi bir video kaynağı eklediğinde burada görünecek."
				})
			]
		})]
	});
	if (roomVideo.kind === "youtube" && roomVideo.video_id) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(YouTubeRoomPlayer, {
		room,
		participantId,
		isHost,
		serverOffset,
		videoId: roomVideo.video_id,
		onOpenWeb: () => onWebChange(true)
	}, `${room.code}:${roomVideo.video_id}`);
	if (roomVideo.kind === "drive" || roomVideo.kind === "embed") {
		if (roomVideo.stream_url) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerWebButton, {
					visible: isHost,
					onClick: () => onWebChange(true)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					ref: videoRef,
					src: roomVideo.stream_url,
					controls: isHost,
					playsInline: true,
					preload: "metadata",
					className: "absolute inset-0 block h-full w-full object-contain"
				}),
				!isHost && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 z-10",
					"aria-hidden": "true"
				}),
				!isHost && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 z-20",
					"aria-hidden": "true"
				})
			]
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerWebButton, {
				visible: isHost,
				onClick: () => onWebChange(true)
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
				src: roomVideo.embed_url ?? roomVideo.url,
				title: roomVideo.title || "Nexora Watch",
				className: "absolute inset-0 block h-full w-full border-0",
				allow: "autoplay; encrypted-media; fullscreen; picture-in-picture",
				allowFullScreen: true,
				referrerPolicy: "strict-origin-when-cross-origin"
			})]
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerWebButton, {
				visible: isHost,
				onClick: () => onWebChange(true)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				ref: videoRef,
				controls: isHost,
				playsInline: true,
				preload: "metadata",
				className: "absolute inset-0 block h-full w-full object-contain"
			}),
			!isHost && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-10",
				"aria-hidden": "true"
			})
		]
	});
}
function YouTubeRoomPlayer({ room, participantId, isHost, serverOffset, videoId, onOpenWeb }) {
	const containerRef = (0, import_react.useRef)(null);
	const playerRef = (0, import_react.useRef)(null);
	const applyingRemoteRef = (0, import_react.useRef)(false);
	const sourceKeyRef = (0, import_react.useRef)(videoId);
	const lastPublishedPosition = (0, import_react.useRef)(0);
	const lastPublishedPlaying = (0, import_react.useRef)(null);
	const lastServerUpdate = (0, import_react.useRef)(0);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [needsGesture, setNeedsGesture] = (0, import_react.useState)(false);
	const playback = room.playback;
	const getTargetPosition = () => {
		let target = Math.max(0, playback.position);
		if (playback.playing) {
			const serverNow = Date.now() + serverOffset;
			target += Math.max(0, (serverNow - playback.updated_at) / 1e3);
		}
		return Number.isFinite(target) ? target : 0;
	};
	const publish = (playing, position) => {
		if (!isHost || !participantId || applyingRemoteRef.current) return;
		const safePosition = Math.max(0, Number.isFinite(position) ? position : 0);
		lastPublishedPlaying.current = playing;
		lastPublishedPosition.current = safePosition;
		lastServerUpdate.current = Date.now();
		api.setPlayback(room.code, participantId, playing, safePosition).catch(() => {});
	};
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		sourceKeyRef.current = videoId;
		setReady(false);
		setNeedsGesture(false);
		const create = async () => {
			try {
				const YT = await loadYouTubeApi();
				if (cancelled || !containerRef.current) return;
				const container = containerRef.current;
				container.innerHTML = "";
				const element = document.createElement("div");
				element.className = "absolute inset-0 h-full w-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:block [&>iframe]:h-full [&>iframe]:w-full";
				container.appendChild(element);
				const player = new YT.Player(element, {
					width: Math.max(200, container.clientWidth),
					height: Math.max(200, container.clientHeight),
					videoId,
					playerVars: {
						autoplay: 0,
						controls: isHost ? 1 : 0,
						disablekb: isHost ? 0 : 1,
						fs: isHost ? 1 : 0,
						playsinline: 1,
						rel: 0,
						enablejsapi: 1,
						origin: window.location.origin
					},
					events: {
						onReady: (event) => {
							if (cancelled || sourceKeyRef.current !== videoId) return;
							playerRef.current = event.target;
							setReady(true);
							const target = getTargetPosition();
							applyingRemoteRef.current = true;
							if (Math.abs(event.target.getCurrentTime() - target) > 1) event.target.seekTo(target, true);
							if (playback.playing) try {
								event.target.playVideo();
								window.setTimeout(() => {
									if (!cancelled && sourceKeyRef.current === videoId) applyingRemoteRef.current = false;
								}, 500);
							} catch {
								applyingRemoteRef.current = false;
								if (!isHost) setNeedsGesture(true);
							}
							else {
								event.target.pauseVideo();
								applyingRemoteRef.current = false;
							}
						},
						onStateChange: (event) => {
							if (cancelled || sourceKeyRef.current !== videoId) return;
							if (!isHost) {
								if (applyingRemoteRef.current) return;
								const target = getTargetPosition();
								if (event.data === 1 && !playback.playing) {
									applyingRemoteRef.current = true;
									event.target.pauseVideo();
									event.target.seekTo(target, true);
									window.setTimeout(() => {
										applyingRemoteRef.current = false;
									}, 250);
									return;
								}
								if (event.data === 2 && playback.playing) {
									applyingRemoteRef.current = true;
									event.target.seekTo(target, true);
									try {
										event.target.playVideo();
									} catch {
										setNeedsGesture(true);
									}
									window.setTimeout(() => {
										applyingRemoteRef.current = false;
									}, 500);
									return;
								}
								if (event.data === 0) {
									applyingRemoteRef.current = true;
									if (playback.playing) {
										event.target.seekTo(target, true);
										try {
											event.target.playVideo();
										} catch {
											setNeedsGesture(true);
										}
									} else event.target.seekTo(target, true);
									window.setTimeout(() => {
										applyingRemoteRef.current = false;
									}, 500);
								}
								return;
							}
							if (event.data === 1) {
								publish(true, event.target.getCurrentTime());
								return;
							}
							if (event.data === 2) {
								publish(false, event.target.getCurrentTime());
								return;
							}
							if (event.data === 0) publish(false, event.target.getCurrentTime());
						}
					}
				});
				playerRef.current = player;
			} catch {
				if (!cancelled) setReady(false);
			}
		};
		create();
		return () => {
			cancelled = true;
			sourceKeyRef.current = "";
			const player = playerRef.current;
			playerRef.current = null;
			try {
				player?.destroy();
			} catch {}
			if (containerRef.current) containerRef.current.innerHTML = "";
		};
	}, [videoId, isHost]);
	(0, import_react.useEffect)(() => {
		if (!isHost || !participantId || !ready) return;
		const interval = window.setInterval(() => {
			const player = playerRef.current;
			if (!player || applyingRemoteRef.current) return;
			let state = -1;
			let position = 0;
			try {
				state = player.getPlayerState();
				position = Math.max(0, player.getCurrentTime());
			} catch {
				return;
			}
			if (state !== 1 && state !== 2) return;
			const playing = state === 1;
			const positionDelta = Math.abs(position - lastPublishedPosition.current);
			const now = Date.now();
			if (positionDelta >= .75 || playing !== lastPublishedPlaying.current || now - lastServerUpdate.current >= 1500) publish(playing, position);
		}, 500);
		return () => {
			window.clearInterval(interval);
		};
	}, [
		isHost,
		participantId,
		ready,
		room.code
	]);
	(0, import_react.useEffect)(() => {
		if (isHost || !ready) return;
		const sync = () => {
			const player = playerRef.current;
			if (!player || applyingRemoteRef.current) return;
			const target = getTargetPosition();
			let current = 0;
			try {
				current = Math.max(0, player.getCurrentTime());
			} catch {
				return;
			}
			if (Math.abs(current - target) > 1.5) {
				applyingRemoteRef.current = true;
				try {
					player.seekTo(target, true);
				} catch {}
				window.setTimeout(() => {
					applyingRemoteRef.current = false;
				}, 250);
			}
			if (playback.playing) {
				let state = -1;
				try {
					state = player.getPlayerState();
				} catch {
					return;
				}
				if (state !== 1) {
					applyingRemoteRef.current = true;
					try {
						player.playVideo();
						setNeedsGesture(false);
					} catch {
						setNeedsGesture(true);
					}
					window.setTimeout(() => {
						applyingRemoteRef.current = false;
					}, 500);
				}
			} else {
				let state = -1;
				try {
					state = player.getPlayerState();
				} catch {
					return;
				}
				if (state === 1 || state === 3) {
					applyingRemoteRef.current = true;
					try {
						player.pauseVideo();
					} catch {}
					window.setTimeout(() => {
						applyingRemoteRef.current = false;
					}, 250);
				}
			}
		};
		sync();
		const interval = window.setInterval(sync, 1e3);
		return () => {
			window.clearInterval(interval);
		};
	}, [
		isHost,
		ready,
		playback.playing,
		playback.position,
		playback.updated_at,
		serverOffset
	]);
	const manualSync = () => {
		const player = playerRef.current;
		if (!player) return;
		const target = getTargetPosition();
		applyingRemoteRef.current = true;
		try {
			player.seekTo(target, true);
			if (playback.playing) player.playVideo();
			else player.pauseVideo();
			setNeedsGesture(false);
		} catch {
			setNeedsGesture(true);
		}
		window.setTimeout(() => {
			applyingRemoteRef.current = false;
		}, 600);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative aspect-[1.25] w-full overflow-hidden rounded-xl border border-glass-border bg-black sm:aspect-video",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlayerWebButton, {
				visible: isHost,
				onClick: onOpenWeb
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: containerRef,
				className: "absolute inset-0"
			}),
			!isHost && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-10",
				"aria-label": "Oda sahibi tarafından kontrol edilen video"
			}),
			!isHost && needsGesture && playback.playing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-[1px]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: manualSync,
					className: "rounded-lg border border-white/20 bg-black/80 px-4 py-3 text-xs font-semibold text-white shadow-lg transition hover:border-brand hover:bg-black",
					children: "Senkronize et"
				})
			}),
			!ready && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/35",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-md bg-black/70 px-3 py-2 text-xs text-white",
					children: "YouTube yükleniyor..."
				})
			}),
			!isHost && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute bottom-3 left-3 z-20 rounded-md bg-black/70 px-2.5 py-1.5 text-[10px] text-white backdrop-blur-sm",
				children: "Video oda sahibi tarafından kontrol ediliyor"
			})
		]
	});
}
function PlayerWebButton({ onClick, visible = true }) {
	if (!visible) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: "absolute top-3 right-3 z-30 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-white/15 bg-black/65 px-2.5 text-[10px] font-semibold text-white backdrop-blur-sm transition hover:border-brand hover:bg-black/80",
		"aria-label": "Web'i player içinde aç",
		title: "Web'i player içinde aç",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "size-3.5" }), "Web"]
	});
}
function ChatMessage({ message }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "break-words",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-1 flex items-baseline gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs font-bold text-brand-secondary",
				children: message.nickname
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[10px] text-muted",
				children: formatTime(message.created_at)
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "rounded-lg bg-surface-tertiary px-3 py-2 text-sm leading-5",
			children: message.text
		})]
	});
}
function messageKey(message) {
	return message.id ?? message._id ?? `${message.created_at}-${message.nickname}-${message.text}`;
}
function formatTime(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleTimeString("tr-TR", {
		hour: "2-digit",
		minute: "2-digit"
	});
}
//#endregion
export { RoomPage as component };
