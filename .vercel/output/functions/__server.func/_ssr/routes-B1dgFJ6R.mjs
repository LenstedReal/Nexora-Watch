import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, i as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as CircleHelp, h as Film, l as Sparkles, m as Globe, n as Youtube, o as User, p as Key, t as Zap } from "../_libs/lucide-react.mjs";
import { a as getSavedNickname, c as saveRoomSession, n as api, s as saveNickname } from "./session-D3l43MuA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B1dgFJ6R.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var HERO = "https://images.unsplash.com/photo-1678247539441-05ad26a18343?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
var SOURCES = [
	{
		icon: Youtube,
		label: "YouTube"
	},
	{
		icon: Globe,
		label: "Drive"
	},
	{
		icon: Film,
		label: "MP4 / M3U8"
	},
	{
		icon: Globe,
		label: "Web"
	}
];
function Home() {
	const navigate = useNavigate();
	const [mode, setMode] = (0, import_react.useState)("create");
	const [nickname, setNickname] = (0, import_react.useState)("");
	const [roomName, setRoomName] = (0, import_react.useState)("");
	const [code, setCode] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [toast, setToast] = (0, import_react.useState)(null);
	const [webHintOpen, setWebHintOpen] = (0, import_react.useState)(false);
	const webHelpButtonRef = (0, import_react.useRef)(null);
	const [webHintPos, setWebHintPos] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const n = getSavedNickname();
		if (n) setNickname(n);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!toast) return;
		const t = setTimeout(() => setToast(null), 2600);
		return () => clearTimeout(t);
	}, [toast]);
	(0, import_react.useEffect)(() => {
		if (!webHintOpen) return;
		const t = setTimeout(() => setWebHintOpen(false), 5e3);
		return () => clearTimeout(t);
	}, [webHintOpen]);
	const openWebHint = () => {
		setWebHintOpen(true);
		requestAnimationFrame(() => {
			const button = webHelpButtonRef.current;
			if (!button) return;
			const rect = button.getBoundingClientRect();
			const margin = 12;
			const width = Math.min(208, window.innerWidth - 24);
			const left = Math.min(Math.max(margin, rect.right - width), window.innerWidth - width - margin);
			setWebHintPos({
				left,
				top: Math.max(56, rect.top - 8),
				width
			});
		});
	};
	const canSubmit = nickname.trim().length > 0 && (mode === "create" || code.trim().length === 6);
	const submit = async () => {
		const nick = nickname.trim();
		if (!nick) return setToast({
			text: "Bir rumuz gir",
			kind: "error"
		});
		setLoading(true);
		try {
			saveNickname(nick);
			const res = mode === "create" ? await api.createRoom(nick, roomName.trim() || `${nick}'in odası`) : await api.joinRoom(code.trim().toUpperCase(), nick);
			saveRoomSession(res.room.code, res.participant.id);
			await navigate({
				to: "/room/$code",
				params: { code: res.room.code }
			});
		} catch (e) {
			setToast({
				text: e instanceof Error ? e.message : "Bir hata oluştu",
				kind: "error"
			});
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "min-h-dvh bg-surface",
		"data-testid": "home-screen",
		children: [
			toast ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none fixed top-4 right-0 left-0 z-50 flex justify-center px-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `max-w-md rounded-md border bg-surface-tertiary px-4 py-3 text-center text-sm text-on-surface ${toast.kind === "error" ? "border-error" : "border-success"}`,
					children: toast.text
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative h-[380px]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: HERO,
						alt: "",
						className: "absolute inset-0 h-full w-full object-cover"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-linear-to-b from-transparent via-overlay to-surface" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative flex h-full flex-col justify-end gap-2.5 px-6 pt-16 pb-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "inline-flex w-fit items-center gap-1.5 rounded-pill border border-glass-border bg-glass px-2.5 py-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3 text-brand" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-text text-[11px] tracking-[1.5px] text-brand",
									children: "SENKRON İZLEME"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: "/branding/nexora-logo.jpg",
									alt: "Nexora Watch",
									className: "h-14 w-auto max-w-[260px] rounded-md object-contain"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-1 max-w-[340px] font-display text-2xl font-bold leading-tight tracking-tight text-on-surface",
								children: "Better Than Rave."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-text text-xs tracking-[1.6px] text-brand-secondary uppercase",
								children: "by LenstedReal"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-text max-w-80 text-[15px] leading-5.5 text-on-surface-tertiary",
								children: "Sevdiklerinle aynı anda, aynı karede. YouTube, Drive ve daha fazlası."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 flex flex-wrap gap-2",
								children: SOURCES.map((s) => s.label === "Web" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-tertiary px-2.5 py-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(s.icon, { className: "size-3.5 text-brand-secondary" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-text text-xs text-on-surface-tertiary",
											children: ["Web", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-1 text-[9px] font-semibold text-brand-secondary",
												children: "(BETA)"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "relative",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												ref: webHelpButtonRef,
												type: "button",
												onClick: openWebHint,
												className: "grid size-5 place-items-center rounded-full text-muted transition hover:text-on-surface",
												"aria-label": "Web özelliği hakkında bilgi",
												"aria-expanded": webHintOpen,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleHelp, { className: "size-3.5" })
											}), webHintOpen && webHintPos ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												role: "status",
												className: "pointer-events-none fixed z-[100] -translate-y-full rounded-md border border-border bg-surface-secondary px-3 py-2 text-center font-text text-[10px] leading-4 text-on-surface shadow-2xl",
												style: {
													left: webHintPos.left,
													top: webHintPos.top,
													width: webHintPos.width
												},
												children: "Şu anda bu özellik test aşamasındadır."
											}) : null]
										})
									]
								}, s.label) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-tertiary px-2.5 py-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(s.icon, { className: "size-3.5 text-brand-secondary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-text text-xs text-on-surface-tertiary",
										children: s.label
									})]
								}, s.label))
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mx-4 mt-2 mb-8 rounded-lg border border-glass-border bg-surface-secondary p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-4 flex rounded-md bg-surface-tertiary p-1",
						children: ["create", "join"].map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"data-testid": m === "create" ? "mode-create-tab" : "mode-join-tab",
							onClick: () => setMode(m),
							className: `min-h-11 flex-1 rounded-sm font-display text-sm font-semibold ${mode === m ? "border border-brand-secondary bg-brand-tertiary text-on-surface" : "text-muted"}`,
							children: m === "create" ? "Oda Kur" : "Odaya Katıl"
						}, m))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						testId: "nickname-input",
						label: "Rumuz",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-4" }),
						placeholder: "Nasıl görünmek istersin?",
						value: nickname,
						maxLength: 24,
						onChange: setNickname
					}),
					mode === "create" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						testId: "room-name-input",
						label: "Oda adı",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, { className: "size-4" }),
						placeholder: "Cuma gecesi filmi",
						value: roomName,
						maxLength: 48,
						onChange: setRoomName
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						testId: "room-code-input",
						label: "Oda kodu",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { className: "size-4" }),
						placeholder: "6 haneli kod",
						value: code,
						maxLength: 6,
						onChange: (v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)),
						className: "tracking-[6px] text-xl font-bold"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"data-testid": "home-submit-button",
						disabled: !canSubmit || loading,
						onClick: submit,
						className: "relative mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-md px-5 font-display text-base font-bold tracking-wide text-on-brand disabled:opacity-50",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-0 bg-linear-to-br from-brand to-brand-secondary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "relative flex items-center gap-2",
							children: loading ? "…" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" }), mode === "create" ? "Odayı Kur" : "Katıl"] })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-center font-text text-xs leading-4.5 text-muted",
						children: "Odalar 24 saat sonra otomatik kapanır. Videoyu yalnızca oda sahibi kontrol eder."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
				href: "https://link.me/lenstedreal",
				target: "_blank",
				rel: "noreferrer",
				"aria-label": "LenstedReal portfolio",
				className: "absolute top-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-glass-border bg-surface-secondary/80 px-3 py-2 backdrop-blur-md transition-all hover:border-brand-secondary hover:bg-surface-tertiary",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-brand shadow-[0_0_8px_currentColor] text-brand" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-text text-xs font-semibold text-on-surface",
						children: "LenstedReal"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-text text-[10px] text-muted",
						children: "Portfolio ↗"
					})
				]
			})
		]
	});
}
function Field({ label, icon, placeholder, value, onChange, testId, maxLength, className = "" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "mb-4 block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-2 block font-text text-xs tracking-widest text-muted uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex min-h-[52px] items-center gap-2.5 rounded-md border border-border bg-surface-tertiary px-3.5 focus-within:border-brand",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted",
				children: icon
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				"data-testid": testId,
				value,
				maxLength,
				placeholder,
				onChange: (e) => onChange(e.target.value),
				className: `min-w-0 flex-1 bg-transparent py-3 font-text text-base text-on-surface outline-none placeholder:text-muted ${className}`
			})]
		})]
	});
}
//#endregion
export { Home as component };
