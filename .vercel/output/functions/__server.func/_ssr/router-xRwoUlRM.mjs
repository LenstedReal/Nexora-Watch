import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, i as require_jsx_runtime, n as QueryClientProvider } from "../_libs/react+tanstack__react-query.mjs";
import { _ as createFileRoute, b as useRouter, d as Scripts, f as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, v as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { n as handleUpload, t as put } from "../_libs/@vercel/blob+[...].mjs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { join } from "node:path";
import { mkdir, readdir, stat } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/router-xRwoUlRM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var styles_default = "/assets/styles-Dtf1LgNP.css";
var APP_NAME = "Nexora Watch";
var Route$9 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#09090D"
			},
			{
				name: "google-adsense-account",
				content: "ca-pub-4558868217074430"
			},
			{
				name: "description",
				content: "Sevdiklerinle aynı anda, aynı karede. Nexora Watch by LenstedReal."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				property: "og:title",
				content: "Nexora Watch"
			},
			{
				property: "og:description",
				content: "Sevdiklerinle aynı anda, aynı karede. Nexora Watch by LenstedReal."
			},
			{
				property: "og:image",
				content: "https://nexora-watch1.vercel.app/branding/nexora-logo.jpg"
			},
			{
				name: "twitter:card",
				content: "summary"
			},
			{
				name: "twitter:title",
				content: "Nexora Watch"
			},
			{
				name: "twitter:description",
				content: "Sevdiklerinle aynı anda, aynı karede."
			},
			{
				name: "twitter:image",
				content: "https://nexora-watch1.vercel.app/branding/nexora-logo.jpg"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/jpeg",
				href: "/branding/nexora-logo.jpg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/branding/nexora-logo.jpg"
			}
		]
	}),
	component: RootDocument
});
function RootDocument() {
	const [client] = (0, import_react.useState)(() => new QueryClient());
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "tr",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("head", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", {
			async: true,
			src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4558868217074430",
			crossOrigin: "anonymous"
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "bg-surface text-on-surface antialiased",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
					client,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	});
}
var $$splitComponentImporter$1 = () => import("./routes-Dq3uw_RD.mjs");
var Route$8 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var _0002_nexora_rooms_default = "create table if not exists nexora_rooms (\n  id text primary key,\n  code text not null unique,\n  name text not null,\n  host_id text not null,\n  created_at timestamptz not null,\n  expires_at timestamptz not null,\n  participants jsonb not null default '[]'::jsonb,\n  video jsonb,\n  playback jsonb not null default '{\"playing\":false,\"position\":0,\"updated_at\":0}'::jsonb\n);\n\ncreate table if not exists nexora_messages (\n  id text primary key,\n  room_code text not null,\n  participant_id text,\n  nickname text not null,\n  text text not null,\n  kind text not null default 'chat',\n  created_at timestamptz not null\n);\n\ncreate index if not exists nexora_messages_room_created_idx\non nexora_messages(room_code, created_at);\n";
var _0003_nexora_web_open_default = "alter table nexora_rooms\n  add column if not exists web_open boolean not null default false;\n";
var _0004_nexora_web_url_default = "alter table nexora_rooms\n  add column if not exists web_url text not null default 'https://www.google.com/search?igu=1';\n";
/**
* Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
* (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
*
* Applied files are keyed by BASENAME, so the same file applies once no matter
* which directory it is globbed from. That is what makes the auth schema safe to
* copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
* a database that already has `0001_auth.sql` will not re-run it.
*
* Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
* out of scope for both until it is copied up.
*/
/**
* The `_migrations` key for a migration path (or bare filename).
* @param {string} path
* @returns {string}
*/
function migrationName(path) {
	return path.split("/").pop() ?? path;
}
/**
* @param {string} path
* @returns {boolean}
*/
function isMigrationFile(path) {
	return path.endsWith(".sql");
}
/**
* Migrations in `paths` that are not yet in `applied`, in apply order.
* Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
* @param {Iterable<string>} paths
* @param {Iterable<string>} applied
* @returns {Array<{ name: string, path: string }>}
*/
function pendingMigrations(paths, applied) {
	const done = new Set(applied);
	return [...paths].filter(isMigrationFile).map((path) => ({
		name: migrationName(path),
		path
	})).sort((a, b) => a.name.localeCompare(b.name)).filter(({ name }) => !done.has(name));
}
var rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : void 0;
var databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : void 0;
/**
* Active backend: real **Neon** when `DATABASE_URL` is set (deployed / configured
* sandbox), otherwise a local embedded **PGLite** (Postgres compiled to WASM) so
* the app has a working database even with nothing configured — the live preview
* included. Swap in Neon later by just setting `DATABASE_URL`; no code changes.
*/
var dbSource = databaseUrl ? "neon" : "pglite";
/**
* Init state lives on globalThis as promises: dev HMR creates new instances of
* this module, and two instances racing module-level state would open a second
* pool or run two concurrent PGLite migration passes (whose duplicate
* `_migrations` insert rejects — and would get memoized, poisoning every later
* `getSql()`). A failed init clears its slot so the next call retries.
*/
var globalRef = globalThis;
/**
* Result-type parity: Postgres sends every value as text plus a type OID — the
* JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
* int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
* JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
* production return identical, JSON-safe shapes:
*   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
*                                   `::text` if you ever need huge integers)
*   date                         -> 'YYYY-MM-DD' string
*   interval                     -> Postgres interval text
* numeric already comes back as a string on both (arbitrary precision).
*/
var OID_INT8 = 20;
var OID_DATE = 1082;
var OID_INTERVAL = 1186;
var identity = (v) => v;
/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run) {
	const sql = (async (strings, ...values) => {
		let text = strings[0];
		for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
		return run(text, values);
	});
	sql.query = (text, params = []) => run(text, params);
	return sql;
}
function createNeonSql() {
	globalRef.__pgSqlPromise__ ??= (async () => {
		const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
		types.setTypeParser(OID_INT8, Number);
		types.setTypeParser(OID_DATE, identity);
		types.setTypeParser(OID_INTERVAL, identity);
		const pool = new Pool({ connectionString: databaseUrl });
		return toSql(async (text, params) => {
			return (await pool.query(text, params)).rows;
		});
	})().catch((err) => {
		globalRef.__pgSqlPromise__ = void 0;
		throw err;
	});
	return globalRef.__pgSqlPromise__;
}
async function createPgliteSql() {
	globalRef.__pgliteInstance__ ??= (async () => {
		const { PGlite } = await import("../_libs/electric-sql__pglite.mjs").then((n) => n.t);
		const pg = new PGlite({ parsers: {
			[OID_INT8]: Number,
			[OID_DATE]: identity,
			[OID_INTERVAL]: identity
		} });
		await pg.waitReady;
		await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
		return pg;
	})().catch((err) => {
		globalRef.__pgliteInstance__ = void 0;
		throw err;
	});
	const pg = await globalRef.__pgliteInstance__;
	const migrate = async () => {
		const migrations = /* #__PURE__ */ Object.assign({
			"/migrations/0002_nexora_rooms.sql": _0002_nexora_rooms_default,
			"/migrations/0003_nexora_web_open.sql": _0003_nexora_web_open_default,
			"/migrations/0004_nexora_web_url.sql": _0004_nexora_web_url_default
		});
		const done = (await pg.query("select name from _migrations")).rows.map((r) => r.name);
		for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) await pg.transaction(async (tx) => {
			await tx.exec(migrations[path]);
			await tx.query("insert into _migrations (name) values ($1)", [name]);
		});
	};
	const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve()).catch(() => void 0).then(migrate);
	globalRef.__pgliteMigrateChain__ = pass;
	await pass;
	return toSql(async (text, params) => {
		return (await pg.query(text, params)).rows;
	});
}
var sqlPromise = null;
async function createSql() {
	if (typeof window !== "undefined") throw new Error("@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.");
	return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}
/**
* Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
* otherwise the local PGLite fallback. Memoized — safe to call per request.
*
* Schema comes from `migrations/*.sql`, auto-applied before the first query on
* both backends — define tables there, never inline in server functions.
*/
function getSql() {
	sqlPromise ??= createSql().catch((err) => {
		sqlPromise = null;
		throw err;
	});
	return sqlPromise;
}
/**
* Finish DB bootstrap before the server handles traffic.
*
* - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
*   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
* - **Neon**: no-op (pool is created lazily on first query).
*
* Vite `configureServer` awaits this at dev startup; production imports of this
* module kick it off immediately (see bottom of file).
*/
function ensureDbReady() {
	if (dbSource !== "pglite") return Promise.resolve();
	return getSql().then(() => void 0);
}
var globalBoot = globalThis;
if (typeof window === "undefined" && dbSource === "pglite") globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
	globalBoot.__pgBootstrapPromise__ = void 0;
	console.error("[db] PGLite bootstrap failed:", err);
	throw err;
});
var DIRECT_EXTENSIONS = /\.(mp4|webm|mov|m4v)(?:$|[?#])/i;
var BLOCKED_HOSTS = /* @__PURE__ */ new Set([
	"localhost",
	"localhost.localdomain",
	"metadata.google.internal",
	"metadata.google"
]);
function parseUrl(value) {
	try {
		return new URL(value.trim());
	} catch {
		return null;
	}
}
function blocked(url) {
	const host = url.hostname.toLowerCase();
	if (BLOCKED_HOSTS.has(host)) return true;
	if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
	if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
	const private172 = host.match(/^172\.(\d+)\./);
	if (private172) {
		const second = Number(private172[1]);
		if (second >= 16 && second <= 31) return true;
	}
	return false;
}
function absolute(value, base) {
	let cleaned = value.trim().replace(/^['"`]|['"`]$/g, "").replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/\\u003F/gi, "?").replace(/\\\//g, "/");
	if (!cleaned) return null;
	try {
		const url = new URL(cleaned, base);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url.toString();
	} catch {
		return null;
	}
}
function youtubeId(url) {
	const host = url.hostname.toLowerCase();
	if (host === "youtu.be" || host.endsWith(".youtu.be")) return url.pathname.replace(/^\/+/, "").split("/")[0] || null;
	if (host === "youtube.com" || host.endsWith(".youtube.com")) {
		if (url.pathname === "/watch") return url.searchParams.get("v");
		return url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ?? null;
	}
	return null;
}
function driveId(url) {
	const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/i);
	if (fileMatch?.[1]) return decodeURIComponent(fileMatch[1]);
	const queryId = url.searchParams.get("id");
	if (queryId) return queryId;
	const pathParts = url.pathname.split("/").filter(Boolean);
	for (const part of pathParts) if (/^[A-Za-z0-9_-]{20,}$/.test(part)) return part;
	return null;
}
function directMime(url) {
	const path = url.pathname.toLowerCase();
	if (path.endsWith(".mp4")) return "video/mp4";
	if (path.endsWith(".webm")) return "video/webm";
	if (path.endsWith(".mov")) return "video/quicktime";
	if (path.endsWith(".m4v")) return "video/x-m4v";
	return null;
}
function isHls(url) {
	return url.pathname.toLowerCase().endsWith(".m3u8") || url.searchParams.get("format")?.toLowerCase() === "m3u8" || url.searchParams.get("type")?.toLowerCase() === "m3u8";
}
function mediaKind(value) {
	const url = parseUrl(value);
	if (!url) return null;
	if (isHls(url)) return "hls";
	if (DIRECT_EXTENSIONS.test(url.pathname)) return "direct";
	return null;
}
function pageTitle(html, fallback) {
	const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
	if (!title) return fallback;
	return title.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 300) || fallback;
}
function pushUnique(list, value) {
	if (value && !list.includes(value)) list.push(value);
}
function discoverMedia(html, pageUrl) {
	const found = [];
	const add = (raw) => {
		if (!raw) return;
		const value = absolute(raw, pageUrl);
		if (!value) return;
		if (mediaKind(value)) pushUnique(found, value);
	};
	for (const pattern of [
		/<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
		/<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
		/\bdata-(?:src|video|file|stream|url)\s*=\s*["']([^"']+)["']/gi,
		/(?:["'`](?:src|file|source|stream|url)["'`])\s*:\s*["'`](https?:\/\/[^"'`\\]+)["'`]/gi,
		/(?:src|file|source|stream|url)\s*[:=]\s*["'`](https?:\/\/[^"'`\\]+)["'`]/gi,
		/https?:\\\/\\\/[^"'`\s]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\\u0026[^"'`\s]+)*/gi,
		/https?:\/\/[^"'`\s<>]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\?[^"'`\s<>]*)?/gi
	]) for (const match of html.matchAll(pattern)) add(match[1] ?? match[0]);
	return found;
}
function discoverEmbeds(html, pageUrl) {
	const found = [];
	const add = (raw) => {
		if (!raw) return;
		const value = absolute(raw, pageUrl);
		if (!value || found.includes(value)) return;
		found.push(value);
	};
	for (const pattern of [
		/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
		/<embed\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
		/(?:embedUrl|embed_url|playerUrl|player_url)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi,
		/(?:iframe|embed)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi
	]) for (const match of html.matchAll(pattern)) add(match[1]);
	return found;
}
async function fetchPage(url) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8e3);
	try {
		const response = await fetch(url, {
			method: "GET",
			redirect: "follow",
			signal: controller.signal,
			headers: {
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
			}
		});
		if (!response.ok) throw new Error(`Web sayfası ${response.status} döndürdü`);
		const finalUrl = new URL(response.url || url.toString());
		if (blocked(finalUrl)) {
			const error = /* @__PURE__ */ new Error("Yönlendirilen adres engellendi");
			error.name = "BlockedWebTargetError";
			throw error;
		}
		return {
			html: await response.text(),
			finalUrl,
			contentType: response.headers.get("content-type") ?? ""
		};
	} finally {
		clearTimeout(timeout);
	}
}
function localMediaResolve(input) {
	const trimmed = input.trim();
	let path = trimmed;
	try {
		const parsed = new URL(trimmed, "https://nexora.local");
		if (parsed.pathname.startsWith("/api/media/")) path = parsed.pathname;
	} catch {}
	if (/^\/api\/media\/[A-Za-z0-9._-]+$/.test(path)) {
		const name = path.split("/").pop() || "video";
		return {
			url: path,
			kind: "direct",
			video_id: null,
			embed_url: null,
			stream_url: path,
			title: name,
			mime_type: name.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4",
			provider: "nexora",
			confidence: 1,
			method: "direct"
		};
	}
	const url = parseUrl(input);
	if (!url) return null;
	const host = url.hostname.toLowerCase();
	if (host.endsWith("vercel-storage.com") || host.endsWith("blob.vercel-storage.com")) return {
		url: input,
		kind: "direct",
		video_id: null,
		embed_url: null,
		stream_url: input,
		title: url.pathname.split("/").pop() || "video",
		mime_type: null,
		provider: "blob",
		confidence: 1,
		method: "direct"
	};
	return null;
}
function providerResolve(input) {
	const url = parseUrl(input);
	if (!url) throw new Error("Geçersiz video adresi");
	const youtube = youtubeId(url);
	if (youtube) return {
		url: input,
		kind: "youtube",
		video_id: youtube,
		embed_url: `https://www.youtube.com/embed/${encodeURIComponent(youtube)}`,
		stream_url: null,
		title: input,
		mime_type: null,
		provider: "youtube",
		confidence: 1,
		method: "provider"
	};
	const host = url.hostname.toLowerCase();
	if (host === "drive.google.com" || host.endsWith(".drive.google.com") || host === "docs.google.com" || host.endsWith(".docs.google.com")) {
		const id = driveId(url);
		if (!id) return null;
		return {
			url: input,
			kind: "drive",
			video_id: id,
			embed_url: `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`,
			stream_url: `/api/drive/${encodeURIComponent(id)}`,
			title: input,
			mime_type: null,
			provider: "google-drive",
			confidence: 1,
			method: "provider"
		};
	}
	return null;
}
function directResolve(input) {
	const url = parseUrl(input);
	if (!url) return null;
	if (isHls(url)) return {
		url: input,
		kind: "hls",
		video_id: null,
		embed_url: null,
		stream_url: input,
		title: url.pathname.split("/").pop() || url.hostname,
		mime_type: "application/vnd.apple.mpegurl",
		provider: url.hostname,
		confidence: 1,
		method: "direct"
	};
	if (DIRECT_EXTENSIONS.test(url.pathname)) return {
		url: input,
		kind: "direct",
		video_id: null,
		embed_url: null,
		stream_url: input,
		title: url.pathname.split("/").pop() || url.hostname,
		mime_type: directMime(url),
		provider: url.hostname,
		confidence: 1,
		method: "direct"
	};
	return null;
}
async function discoverScriptMedia(html, pageUrl, title) {
	const scripts = [];
	for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
		const src = absolute(match[1], pageUrl);
		if (!src) continue;
		const scriptUrl = parseUrl(src);
		if (!scriptUrl) continue;
		if (!(scriptUrl.hostname === pageUrl.hostname || scriptUrl.hostname.endsWith(`.${pageUrl.hostname}`))) continue;
		if (blocked(scriptUrl)) continue;
		if (!scripts.includes(src)) scripts.push(src);
		if (scripts.length >= 8) break;
	}
	const candidates = [];
	for (const script of scripts) {
		const scriptUrl = parseUrl(script);
		if (!scriptUrl) continue;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5e3);
		try {
			const response = await fetch(scriptUrl, {
				method: "GET",
				redirect: "follow",
				signal: controller.signal,
				headers: {
					Accept: "application/javascript,text/javascript,*/*;q=0.5",
					"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/153 Safari/537.36"
				}
			});
			if (!response.ok) continue;
			const finalUrl = new URL(response.url || scriptUrl.toString());
			if (!(finalUrl.hostname === pageUrl.hostname || finalUrl.hostname.endsWith(`.${pageUrl.hostname}`))) continue;
			const source = (await response.text()).slice(0, 75e4);
			const found = [];
			const decodeJsUrl = (raw) => raw.replace(/\\u002f/gi, "/").replace(/\\u0026/gi, "&").replace(/\\u003f/gi, "?").replace(/\\u003d/gi, "=").replace(/\\u002e/gi, ".").replace(/\\\//g, "/").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#x2f;/gi, "/").trim();
			const add = (raw) => {
				if (!raw) return;
				const value = absolute(decodeJsUrl(raw), finalUrl);
				if (!value) return;
				if (!mediaKind(value)) return;
				pushUnique(found, value);
			};
			for (const pattern of [
				/(?:https?:)?\\\/\\\/[^"'`\s<>]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\\u0026[^"'`\s<>]*)?/gi,
				/(?:https?:\/\/[^"'`\s<>]+?\.(?:m3u8|mp4|webm|m4v|mov)(?:\?[^"'`\s<>]*)?)/gi,
				/["']?(?:file|source|src|stream|url|videoUrl|video_url|hls|hlsUrl|hls_url|manifest|playlist|mp4Url|videoFile|media|mediaUrl)["']?\s*[:=]\s*["'`](https?:\/\/[^"'`]+)["'`]/gi,
				/["']?(?:file|source|src|stream|url|videoUrl|video_url|hls|hlsUrl|hls_url|manifest|playlist|mp4Url|videoFile|media|mediaUrl)["']?\s*[:=]\s*["'`](\/[^"'`]+)["'`]/gi,
				/["'`](\/\/[^"'`]+\.(?:m3u8|mp4|webm|m4v|mov)(?:\?[^"'`]*)?)["'`]/gi,
				/["'`](\\\/\\\/[^"'`]+\.(?:m3u8|mp4|webm|m4v|mov)(?:\\u0026[^"'`]*)?)["'`]/gi
			]) for (const match of source.matchAll(pattern)) add(match[1] ?? match[0]);
			for (const media of found) {
				const kind = mediaKind(media);
				if (!kind) continue;
				const mediaUrl = new URL(media);
				candidates.push({
					url: media,
					kind: kind === "hls" ? "hls" : "direct",
					provider: pageUrl.hostname,
					title,
					mime_type: kind === "hls" ? "application/vnd.apple.mpegurl" : directMime(mediaUrl),
					confidence: kind === "hls" ? .97 : .96,
					method: "player-config"
				});
			}
		} catch {} finally {
			clearTimeout(timeout);
		}
	}
	return candidates;
}
function candidateToResolved(candidate, sourceUrl) {
	const stream = candidate.url ?? null;
	return {
		url: sourceUrl,
		kind: candidate.kind,
		video_id: null,
		embed_url: candidate.embed_url ?? null,
		stream_url: stream,
		title: candidate.title,
		mime_type: candidate.mime_type ?? null,
		provider: candidate.provider,
		confidence: candidate.confidence,
		method: candidate.method
	};
}
function chooseCandidate(candidates) {
	if (!candidates.length) return null;
	return [...candidates].sort((a, b) => b.confidence - a.confidence)[0];
}
async function resolveVideoSource(input) {
	const raw = input.trim();
	if (!raw) throw new Error("Video adresi boş");
	const local = localMediaResolve(raw);
	if (local) return local;
	const provider = providerResolve(raw);
	if (provider) return provider;
	const direct = directResolve(raw);
	if (direct) return direct;
	const pageUrl = parseUrl(raw);
	if (!pageUrl || !/^https?:$/.test(pageUrl.protocol)) throw new Error("Geçersiz web adresi");
	if (blocked(pageUrl)) throw new Error("Bu web adresine erişilemez");
	let response = null;
	try {
		response = await fetchPage(pageUrl);
	} catch (error) {
		if (error instanceof Error && error.name === "BlockedWebTargetError") throw error;
		throw new Error("Bu adreste oynatılabilir video bulunamadı");
	}
	if (!response) throw new Error("Web sayfası çözümlenemedi");
	if (!response.contentType.includes("text/html")) {
		const finalKind = mediaKind(response.finalUrl.toString());
		if (finalKind) return {
			url: raw,
			kind: finalKind === "hls" ? "hls" : "direct",
			video_id: null,
			embed_url: null,
			stream_url: response.finalUrl.toString(),
			title: response.finalUrl.pathname.split("/").pop() || response.finalUrl.hostname,
			mime_type: finalKind === "hls" ? "application/vnd.apple.mpegurl" : directMime(response.finalUrl),
			provider: response.finalUrl.hostname,
			confidence: .99,
			method: "direct"
		};
	}
	const title = pageTitle(response.html, response.finalUrl.hostname);
	const candidates = [];
	for (const media of discoverMedia(response.html, response.finalUrl)) {
		const kind = mediaKind(media);
		if (!kind) continue;
		const mediaUrl = new URL(media);
		candidates.push({
			url: media,
			kind: kind === "hls" ? "hls" : "direct",
			provider: response.finalUrl.hostname,
			title,
			mime_type: kind === "hls" ? "application/vnd.apple.mpegurl" : directMime(mediaUrl),
			confidence: kind === "hls" ? .98 : .97,
			method: "html-media"
		});
	}
	for (const media of discoverMedia(response.html, response.finalUrl)) {
		const kind = mediaKind(media);
		if (!kind) continue;
		const mediaUrl = new URL(media);
		candidates.push({
			url: media,
			kind: kind === "hls" ? "hls" : "direct",
			provider: response.finalUrl.hostname,
			title,
			mime_type: kind === "hls" ? "application/vnd.apple.mpegurl" : directMime(mediaUrl),
			confidence: kind === "hls" ? .94 : .93,
			method: "player-config"
		});
	}
	for (const embed of discoverEmbeds(response.html, response.finalUrl)) candidates.push({
		embed_url: embed,
		kind: "embed",
		provider: parseUrl(embed)?.hostname ?? response.finalUrl.hostname,
		title,
		confidence: .78,
		method: "embed"
	});
	const scriptCandidates = await discoverScriptMedia(response.html, response.finalUrl, title);
	candidates.push(...scriptCandidates);
	const best = chooseCandidate(candidates);
	if (best) return candidateToResolved(best, raw);
	throw new Error("Bu adres bir video kaynağı değil. Web özelliği Google üzerinden açılır.");
}
var DEFAULT_WEB_URL = "https://www.google.com/search?igu=1&hl=tr";
var MAX_WEB_URL = 2e3;
function googleSearchUrl(query) {
	const url = new URL(DEFAULT_WEB_URL);
	url.searchParams.set("q", query.slice(0, 500));
	url.searchParams.set("igu", "1");
	url.searchParams.set("hl", "tr");
	return url.toString();
}
function normalizeWebUrl(input) {
	const trimmed = input.trim();
	if (!trimmed) return DEFAULT_WEB_URL;
	if (!(/^(https?:\/\/)/i.test(trimmed) || /^www\./i.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#]|$)/i.test(trimmed))) return googleSearchUrl(trimmed);
	try {
		const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		const url = new URL(withProto);
		if (url.protocol !== "http:" && url.protocol !== "https:") return googleSearchUrl(trimmed);
		const host = url.hostname.toLowerCase();
		if (host === "google.com" || host.endsWith(".google.com") || host.includes("google.")) {
			url.searchParams.set("igu", "1");
			if (!url.searchParams.get("hl")) url.searchParams.set("hl", "tr");
		}
		return url.toString().slice(0, MAX_WEB_URL);
	} catch {
		return googleSearchUrl(trimmed);
	}
}
var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var ROOM_LIFETIME = 864e5;
function jsonError(status, detail) {
	return new Response(JSON.stringify({ detail }), {
		status,
		headers: { "Content-Type": "application/json" }
	});
}
function normalizeCode(code) {
	return code.trim().toUpperCase();
}
function asIso(value) {
	if (value instanceof Date) return value.toISOString();
	const text = String(value ?? "");
	const parsed = Date.parse(text);
	return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}
function parseJson(value, fallback) {
	if (value == null) return fallback;
	if (typeof value === "string") try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
	return value;
}
function rowToRoom(row) {
	return {
		id: row.id,
		code: normalizeCode(row.code),
		name: row.name,
		host_id: row.host_id,
		created_at: asIso(row.created_at),
		expires_at: asIso(row.expires_at),
		participants: parseJson(row.participants, []),
		video: parseJson(row.video, null),
		playback: parseJson(row.playback, {
			playing: false,
			position: 0,
			updated_at: 0
		}),
		web_open: Boolean(row.web_open),
		web_url: typeof row.web_url === "string" && row.web_url.trim() ? row.web_url : DEFAULT_WEB_URL,
		server_time: Date.now()
	};
}
async function updateParticipants(code, participants) {
	await (await getSql()).query(`update nexora_rooms
        set participants = $2::jsonb
      where code = $1`, [code, JSON.stringify(participants)]);
}
async function updatePlaybackRow(code, playback) {
	await (await getSql()).query(`update nexora_rooms
        set playback = $2::jsonb
      where code = $1`, [code, JSON.stringify(playback)]);
}
async function updateVideoRow(code, video, playback) {
	await (await getSql()).query(`update nexora_rooms
        set video = $2::jsonb,
            playback = $3::jsonb
      where code = $1`, [
		code,
		JSON.stringify(video),
		JSON.stringify(playback)
	]);
}
async function updateWebOpenRow(code, webOpen, webUrl) {
	await (await getSql()).query(`update nexora_rooms
        set web_open = $2,
            web_url = $3
      where code = $1`, [
		code,
		webOpen,
		webUrl
	]);
}
async function deleteRoom(code) {
	const sql = await getSql();
	await sql.query(`delete from nexora_messages where room_code = $1`, [code]);
	await sql.query(`delete from nexora_rooms where code = $1`, [code]);
}
async function generateCode() {
	const sql = await getSql();
	for (let attempt = 0; attempt < 50; attempt += 1) {
		let code = "";
		for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[Math.floor(Math.random() * 32)];
		if ((await sql.query(`select id from nexora_rooms where code = $1 limit 1`, [code])).length === 0) return code;
	}
	throw jsonError(500, "Kod üretilemedi");
}
function validateNickname(value) {
	const nickname = typeof value === "string" ? value.trim() : "";
	if (!nickname || nickname.length > 24) throw jsonError(400, "Takma ad 1-24 karakter olmalı");
	return nickname;
}
function validateRoomName(value) {
	const name = typeof value === "string" ? value.trim() : "";
	if (!name || name.length > 48) throw jsonError(400, "Oda adı 1-48 karakter olmalı");
	return name;
}
async function loadRoom(code) {
	const normalized = normalizeCode(code);
	const row = (await (await getSql()).query(`select
       id,
       code,
       name,
       host_id,
       created_at,
       expires_at,
       participants,
       video,
       playback,
       web_open,
       web_url
     from nexora_rooms
     where code = $1
     limit 1`, [normalized]))[0];
	if (!row) throw jsonError(404, "Oda bulunamadı");
	const room = rowToRoom(row);
	if (Date.parse(room.expires_at) < Date.now()) {
		await deleteRoom(normalized);
		throw jsonError(410, "Odanın süresi doldu (24 saat)");
	}
	room.server_time = Date.now();
	return room;
}
async function createRoom(nicknameInput, nameInput) {
	const nickname = validateNickname(nicknameInput);
	const name = validateRoomName(nameInput);
	const created = /* @__PURE__ */ new Date();
	const expires = new Date(created.getTime() + ROOM_LIFETIME);
	const participant = {
		id: crypto.randomUUID(),
		nickname,
		is_host: true,
		online: true,
		joined_at: created.toISOString()
	};
	const playback = {
		playing: false,
		position: 0,
		updated_at: Date.now()
	};
	const id = crypto.randomUUID();
	const sql = await getSql();
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const code = await generateCode();
		try {
			await sql.query(`insert into nexora_rooms
          (
            id,
            code,
            name,
            host_id,
            created_at,
            expires_at,
            participants,
            video,
            playback,
            web_open,
            web_url
          )
         values
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7::jsonb,
            $8::jsonb,
            $9::jsonb,
            $10,
            $11
          )`, [
				id,
				code,
				name,
				participant.id,
				created.toISOString(),
				expires.toISOString(),
				JSON.stringify([participant]),
				JSON.stringify(null),
				JSON.stringify(playback),
				false,
				DEFAULT_WEB_URL
			]);
			return {
				room: {
					id,
					code,
					name,
					host_id: participant.id,
					created_at: created.toISOString(),
					expires_at: expires.toISOString(),
					participants: [participant],
					video: null,
					playback,
					web_open: false,
					web_url: DEFAULT_WEB_URL,
					server_time: Date.now()
				},
				participant
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.toLowerCase().includes("unique") && !message.toLowerCase().includes("duplicate")) throw error;
		}
	}
	throw jsonError(500, "Kod üretilemedi");
}
async function joinRoom(code, nicknameInput, participantIdInput) {
	const room = await loadRoom(code);
	const nickname = validateNickname(nicknameInput);
	const participantId = typeof participantIdInput === "string" && participantIdInput.trim() ? participantIdInput.trim() : null;
	const existing = participantId ? room.participants.find((p) => p.id === participantId) : void 0;
	const participant = existing ? {
		...existing,
		nickname,
		online: true
	} : {
		id: crypto.randomUUID(),
		nickname,
		is_host: false,
		online: true,
		joined_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	room.participants = existing ? room.participants.map((p) => p.id === participant.id ? participant : p) : [...room.participants, participant];
	room.server_time = Date.now();
	await updateParticipants(room.code, room.participants);
	return {
		room,
		participant
	};
}
function validateParticipantId(value) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) throw jsonError(400, "Katılımcı kimliği gerekli");
	return id;
}
async function participantForRoom(code, participantIdInput) {
	const room = await loadRoom(code);
	const participantId = validateParticipantId(participantIdInput);
	const participant = room.participants.find((item) => item.id === participantId);
	if (!participant) throw jsonError(403, "Bu katılımcı odada değil");
	return {
		room,
		participant
	};
}
async function getMessages(code) {
	const room = await loadRoom(code);
	return (await (await getSql()).query(`select
       id,
       room_code,
       participant_id,
       nickname,
       text,
       kind,
       created_at
     from nexora_messages
     where room_code = $1
     order by created_at asc
     limit 500`, [room.code])).map((row) => ({
		id: row.id,
		room_code: row.room_code,
		participant_id: row.participant_id,
		nickname: row.nickname,
		text: row.text,
		kind: row.kind === "system" ? "system" : "chat",
		created_at: asIso(row.created_at)
	}));
}
function validateMessage(value) {
	const text = typeof value === "string" ? value.trim() : "";
	if (!text) throw jsonError(400, "Mesaj boş olamaz");
	if (text.length > 1e3) throw jsonError(400, "Mesaj en fazla 1000 karakter olabilir");
	return text;
}
async function sendMessage(code, participantIdInput, textInput) {
	const { room, participant } = await participantForRoom(code, participantIdInput);
	const text = validateMessage(textInput);
	const message = {
		id: crypto.randomUUID(),
		room_code: room.code,
		participant_id: participant.id,
		nickname: participant.nickname,
		text,
		kind: "chat",
		created_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	const sql = await getSql();
	await sql.query(`insert into nexora_messages
      (
        id,
        room_code,
        participant_id,
        nickname,
        text,
        kind,
        created_at
      )
     values
      ($1, $2, $3, $4, $5, $6, $7)`, [
		message.id,
		message.room_code,
		message.participant_id,
		message.nickname,
		message.text,
		message.kind,
		message.created_at
	]);
	await sql.query(`delete from nexora_messages
     where room_code = $1
       and id not in (
         select id
         from nexora_messages
         where room_code = $1
         order by created_at desc
         limit 500
       )`, [room.code]);
	return message;
}
async function setVideo(code, participantIdInput, urlInput) {
	const { room, participant } = await participantForRoom(code, participantIdInput);
	if (!participant.is_host) throw jsonError(403, "Videoyu yalnızca oda sahibi değiştirebilir");
	const url = typeof urlInput === "string" ? urlInput.trim() : "";
	if (!url || url.length > 8e3) throw jsonError(400, "Geçerli bir video adresi gerekli");
	let resolved;
	try {
		resolved = await resolveVideoSource(url);
	} catch {
		throw jsonError(400, "Geçersiz video adresi");
	}
	const video = {
		url: resolved.url,
		kind: resolved.kind,
		video_id: resolved.video_id,
		embed_url: resolved.embed_url,
		stream_url: resolved.stream_url,
		title: resolved.title,
		mime_type: resolved.mime_type,
		provider: resolved.provider,
		confidence: resolved.confidence,
		method: resolved.method
	};
	const now = Date.now();
	room.video = video;
	room.playback = {
		playing: false,
		position: 0,
		updated_at: now
	};
	room.server_time = now;
	await updateVideoRow(room.code, room.video, room.playback);
	return room;
}
async function setPlayback(code, participantIdInput, playingInput, positionInput) {
	const { room, participant } = await participantForRoom(code, participantIdInput);
	if (!participant.is_host) throw jsonError(403, "Oynatmayı yalnızca oda sahibi kontrol edebilir");
	const playing = Boolean(playingInput);
	const rawPosition = typeof positionInput === "number" ? positionInput : Number(positionInput);
	if (!Number.isFinite(rawPosition) || rawPosition < 0) throw jsonError(400, "Geçersiz oynatma konumu");
	const now = Date.now();
	const playback = {
		playing,
		position: rawPosition,
		updated_at: now
	};
	room.playback = playback;
	room.server_time = now;
	await updatePlaybackRow(room.code, playback);
	return playback;
}
async function leaveRoom(code, participantIdInput) {
	const { room, participant } = await participantForRoom(code, participantIdInput);
	room.participants = room.participants.map((item) => item.id === participant.id ? {
		...item,
		online: false
	} : item);
	room.server_time = Date.now();
	await updateParticipants(room.code, room.participants);
	return { ok: true };
}
async function setWebOpen(code, participantIdInput, openInput, urlInput) {
	const { room, participant } = await participantForRoom(code, participantIdInput);
	if (!participant.is_host) throw jsonError(403, "Web görünümünü yalnızca oda sahibi kontrol edebilir");
	const open = Boolean(openInput);
	const nextUrl = typeof urlInput === "string" && urlInput.trim() ? normalizeWebUrl(urlInput) : room.web_url || "https://www.google.com/search?igu=1&hl=tr";
	room.web_open = open;
	room.web_url = nextUrl;
	room.server_time = Date.now();
	await updateWebOpenRow(room.code, open, nextUrl);
	return room;
}
var ALLOWED_TYPES = [
	"video/mp4",
	"video/webm",
	"video/quicktime",
	"video/x-m4v"
];
var MAX_BYTES$1 = 2147483648;
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
					maximumSizeInBytes: MAX_BYTES$1,
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
var Route$7 = createFileRoute("/api/blob-upload")({ server: { handlers: { POST: async ({ request }) => {
	try {
		return await handleNexoraBlobUpload(request);
	} catch (error) {
		console.error("[Nexora Blob upload]", error);
		return Response.json({ error: error instanceof Error ? error.message : "Video yükleme yetkilendirmesi başarısız" }, { status: 400 });
	}
} } } });
var Route$6 = createFileRoute("/api/resolve")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const body = await request.json();
		const url = typeof body.url === "string" ? body.url.trim() : "";
		if (!url || url.length > 2e3) return Response.json({
			ok: false,
			error: "Geçerli bir video adresi gerekli"
		}, { status: 400 });
		const resolved = await resolveVideoSource(url);
		if (resolved.kind === "web") return Response.json({
			ok: false,
			error: "Bu adres video kaynağı değil. Web özelliği Google üzerinden açılır."
		}, { status: 422 });
		return Response.json({
			ok: true,
			source: {
				url: resolved.url,
				kind: resolved.kind,
				video_id: resolved.video_id,
				embed_url: resolved.embed_url,
				stream_url: resolved.stream_url,
				title: resolved.title,
				mime_type: resolved.mime_type,
				provider: resolved.provider,
				confidence: resolved.confidence,
				method: resolved.method
			}
		});
	} catch (error) {
		return Response.json({
			ok: false,
			error: error instanceof Error ? error.message : "Video kaynağı çözülemedi"
		}, { status: 422 });
	}
} } } });
var peers = /* @__PURE__ */ new Map();
function topic(code) {
	return `nexora-room:${code.toUpperCase()}`;
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
var DIR = "/tmp/nexora-media";
var files = /* @__PURE__ */ new Map();
var SAFE_NAME = /[^a-zA-Z0-9._-]+/g;
var SAFE_ID = /^[A-Za-z0-9-]+$/;
function mimeOf(name, fallback) {
	const lower = name.toLowerCase();
	if (lower.endsWith(".webm")) return "video/webm";
	if (lower.endsWith(".mov")) return "video/quicktime";
	if (lower.endsWith(".m4v")) return "video/x-m4v";
	if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
	if (fallback.startsWith("video/")) return fallback;
	return "video/mp4";
}
function extOf(name, mime) {
	const match = name.toLowerCase().match(/\.(mp4|webm|mov|m4v|m3u8)$/);
	if (match) return match[0];
	if (mime.includes("webm")) return ".webm";
	if (mime.includes("quicktime")) return ".mov";
	return ".mp4";
}
async function saveUploadedVideo(file) {
	const original = file.name.replace(SAFE_NAME, "-").replace(/-+/g, "-").slice(-180) || "video.mp4";
	const mime = mimeOf(original, file.type || "");
	const ext = extOf(original, mime);
	const id = `${Date.now()}-${crypto.randomUUID()}`;
	const token = process.env.BLOB_READ_WRITE_TOKEN;
	if (token) {
		const blob = await put(`nexora/${id}${ext}`, file, {
			access: "public",
			token,
			addRandomSuffix: false,
			contentType: mime
		});
		const stored = {
			id,
			name: original,
			mime,
			size: file.size,
			url: blob.url
		};
		files.set(id, stored);
		return stored;
	}
	await mkdir(DIR, { recursive: true });
	const path = join(DIR, `${id}${ext}`);
	const nodeStream = Readable.fromWeb(file.stream());
	await pipeline(nodeStream, createWriteStream(path));
	const stored = {
		id,
		name: original,
		mime,
		size: (await stat(path)).size,
		url: `/api/media/${id}`,
		path
	};
	files.set(id, stored);
	return stored;
}
async function readStoredMedia(id) {
	if (!SAFE_ID.test(id)) return null;
	const cached = files.get(id);
	if (cached) return cached;
	try {
		await mkdir(DIR, { recursive: true });
		const match = (await readdir(DIR)).find((name) => name === id || name.startsWith(`${id}.`));
		if (!match) return null;
		const path = join(DIR, match);
		const info = await stat(path);
		if (!info.isFile()) return null;
		const stored = {
			id,
			name: match,
			mime: mimeOf(match, ""),
			size: info.size,
			url: `/api/media/${id}`,
			path
		};
		files.set(id, stored);
		return stored;
	} catch {
		return null;
	}
}
function mediaStream(stored, start, end) {
	if (!stored.path) throw new Error("Bu video uzak depoda; yerel stream yok");
	return Readable.toWeb(createReadStream(stored.path, {
		start,
		end
	}));
}
var ALLOWED = /^(video\/(mp4|webm|quicktime|x-m4v|mpeg)|application\/octet-stream)?$/i;
var MAX_BYTES = 2147483648;
var Route$5 = createFileRoute("/api/upload")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const form = await request.formData();
		const code = String(form.get("code") ?? "").trim().toUpperCase();
		const participantId = String(form.get("participant_id") ?? "").trim();
		const file = form.get("file");
		if (!code || !participantId) return Response.json({ detail: "Oda bilgisi eksik" }, { status: 400 });
		if (!(file instanceof File) || file.size < 1) return Response.json({ detail: "Video dosyası seçilmedi" }, { status: 400 });
		if (file.size > MAX_BYTES) return Response.json({ detail: "Video en fazla 2 GB olabilir" }, { status: 400 });
		const namedOk = /\.(mp4|webm|mov|m4v)$/i.test(file.name);
		const typeOk = !file.type || ALLOWED.test(file.type) || file.type.startsWith("video/");
		if (!namedOk && !typeOk) return Response.json({ detail: "Desteklenmeyen video formatı" }, { status: 400 });
		const stored = await saveUploadedVideo(file);
		const room = await setVideo(code, participantId, stored.url);
		broadcastRealtime(code, {
			type: "room",
			room,
			server_time: Date.now()
		});
		return Response.json({
			url: stored.url,
			name: stored.name,
			room
		});
	} catch (error) {
		if (error instanceof Response) return error;
		console.error("[Nexora upload]", error);
		return Response.json({ detail: error instanceof Error ? error.message : "Video yüklenemedi" }, { status: 400 });
	}
} } } });
var $$splitComponentImporter = () => import("../_code-axC6qpiT.mjs");
var Route$4 = createFileRoute("/room/$code")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var DRIVE_HOST = "https://drive.usercontent.google.com/download";
function validId(value) {
	return /^[A-Za-z0-9_-]{10,300}$/.test(value);
}
var Route$3 = createFileRoute("/api/drive/$id")({ server: { handlers: { GET: async ({ request, params }) => {
	const id = params.id;
	if (!id || !validId(id)) return new Response("Geçersiz Drive dosya ID", { status: 400 });
	const incomingRange = request.headers.get("range");
	const headers = new Headers({
		Accept: "*/*",
		"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
	});
	if (incomingRange) headers.set("Range", incomingRange);
	const target = `${DRIVE_HOST}?id=${encodeURIComponent(id)}&export=download&confirm=t`;
	try {
		const response = await fetch(target, {
			method: "GET",
			redirect: "follow",
			headers
		});
		if (!response.ok && response.status !== 206) return new Response(`Drive ${response.status}`, { status: response.status });
		const contentType = response.headers.get("content-type") || "application/octet-stream";
		if (contentType.includes("text/html") || contentType.includes("text/plain")) return new Response("Drive dosyası doğrudan medya olarak alınamadı", { status: 502 });
		const out = new Headers();
		for (const name of [
			"content-type",
			"content-length",
			"content-range",
			"accept-ranges",
			"cache-control",
			"etag",
			"last-modified"
		]) {
			const value = response.headers.get(name);
			if (value) out.set(name, value);
		}
		out.set("Content-Disposition", "inline");
		out.set("Access-Control-Allow-Origin", "*");
		return new Response(response.body, {
			status: response.status,
			headers: out
		});
	} catch (error) {
		console.error("[Drive proxy]", error);
		return new Response("Drive bağlantısı alınamadı", { status: 502 });
	}
} } } });
function mediaHeaders(stored, extra) {
	return new Headers({
		"Content-Type": stored.mime,
		"Accept-Ranges": "bytes",
		"Cache-Control": "private, max-age=3600",
		"X-Content-Type-Options": "nosniff",
		...extra
	});
}
var Route$2 = createFileRoute("/api/media/$id")({ server: { handlers: {
	HEAD: async ({ params }) => {
		const stored = await readStoredMedia(params.id);
		if (!stored?.path) return new Response("Video bulunamadı", { status: 404 });
		return new Response(null, {
			status: 200,
			headers: mediaHeaders(stored, { "Content-Length": String(stored.size) })
		});
	},
	GET: async ({ params, request }) => {
		const stored = await readStoredMedia(params.id);
		if (!stored?.path) return new Response("Video bulunamadı", { status: 404 });
		const range = request.headers.get("range");
		const size = stored.size;
		if (range) {
			const match = range.match(/bytes=(\d*)-(\d*)/);
			const start = match?.[1] ? Number(match[1]) : 0;
			const end = match?.[2] ? Number(match[2]) : size - 1;
			if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= size || start > end) return new Response("Geçersiz aralık", {
				status: 416,
				headers: { "Content-Range": `bytes */${size}` }
			});
			const stream = mediaStream(stored, start, end);
			return new Response(stream, {
				status: 206,
				headers: mediaHeaders(stored, {
					"Content-Length": String(end - start + 1),
					"Content-Range": `bytes ${start}-${end}/${size}`
				})
			});
		}
		const stream = mediaStream(stored, 0, size - 1);
		return new Response(stream, {
			status: 200,
			headers: mediaHeaders(stored, { "Content-Length": String(size) })
		});
	}
} } });
var Route$1 = createFileRoute("/api/rooms/")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const body = await request.json();
		const result = await createRoom(body?.nickname, body?.name);
		return Response.json(result, { status: 201 });
	} catch (error) {
		if (error instanceof Response) return error;
		console.error("[POST /api/rooms]", error);
		return Response.json({ detail: "Oda oluşturulurken sunucu hatası oluştu" }, { status: 500 });
	}
} } } });
function jsonErrorResponse(error) {
	if (error instanceof Response) return error;
	console.error("[Nexora API]", error);
	return Response.json({ detail: "Sunucu hatası" }, { status: 500 });
}
async function body(request) {
	try {
		const value = await request.json();
		if (!value || typeof value !== "object") return {};
		return value;
	} catch {
		return {};
	}
}
function segments(request) {
	const pathname = new URL(request.url).pathname;
	if (!pathname.startsWith("/api/rooms/")) return [];
	return pathname.slice(11).split("/").filter(Boolean).map((part) => decodeURIComponent(part));
}
var Route = createFileRoute("/api/rooms/$")({ server: { handlers: {
	GET: async ({ request }) => {
		try {
			const parts = segments(request);
			if (parts.length === 1) return Response.json(await loadRoom(parts[0]));
			if (parts.length === 2 && parts[1] === "messages") return Response.json(await getMessages(parts[0]));
			return Response.json({ detail: "Endpoint bulunamadı" }, { status: 404 });
		} catch (error) {
			return jsonErrorResponse(error);
		}
	},
	POST: async ({ request }) => {
		try {
			const parts = segments(request);
			const data = await body(request);
			if (parts.length === 1 && parts[0] === "") return Response.json({ detail: "Oda oluşturmak için /api/rooms kullanın" }, { status: 400 });
			if (parts.length === 2 && parts[1] === "join") {
				const result = await joinRoom(parts[0], data.nickname, data.participant_id);
				return Response.json(result);
			}
			if (parts.length === 2 && parts[1] === "messages") {
				const result = await sendMessage(parts[0], data.participant_id, data.text);
				return Response.json(result, { status: 201 });
			}
			if (parts.length === 2 && parts[1] === "leave") {
				const result = await leaveRoom(parts[0], data.participant_id);
				return Response.json(result);
			}
			return Response.json({ detail: "Endpoint bulunamadı" }, { status: 404 });
		} catch (error) {
			return jsonErrorResponse(error);
		}
	},
	PUT: async ({ request }) => {
		try {
			const parts = segments(request);
			const data = await body(request);
			if (parts.length === 2 && parts[1] === "video") {
				const room = await setVideo(parts[0], data.participant_id, data.url);
				broadcastRealtime(parts[0], {
					type: "room",
					room,
					server_time: Date.now()
				});
				return Response.json(room);
			}
			if (parts.length === 2 && parts[1] === "playback") {
				const playback = await setPlayback(parts[0], data.participant_id, data.playing, data.position);
				broadcastRealtime(parts[0], {
					type: "playback",
					playback,
					server_time: Date.now()
				});
				return Response.json(playback);
			}
			if (parts.length === 2 && parts[1] === "web") {
				const room = await setWebOpen(parts[0], data.participant_id, data.open, data.url);
				broadcastRealtime(parts[0], {
					type: "web",
					open: room.web_open,
					url: room.web_url,
					server_time: Date.now()
				});
				return Response.json(room);
			}
			return Response.json({ detail: "Endpoint bulunamadı" }, { status: 404 });
		} catch (error) {
			return jsonErrorResponse(error);
		}
	}
} } });
var IndexRoute = Route$8.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$9
});
var ApiBlobUploadRoute = Route$7.update({
	id: "/api/blob-upload",
	path: "/api/blob-upload",
	getParentRoute: () => Route$9
});
var ApiResolveRoute = Route$6.update({
	id: "/api/resolve",
	path: "/api/resolve",
	getParentRoute: () => Route$9
});
var ApiUploadRoute = Route$5.update({
	id: "/api/upload",
	path: "/api/upload",
	getParentRoute: () => Route$9
});
var RoomCodeRoute = Route$4.update({
	id: "/room/$code",
	path: "/room/$code",
	getParentRoute: () => Route$9
});
var ApiDriveIdRoute = Route$3.update({
	id: "/api/drive/$id",
	path: "/api/drive/$id",
	getParentRoute: () => Route$9
});
var ApiMediaIdRoute = Route$2.update({
	id: "/api/media/$id",
	path: "/api/media/$id",
	getParentRoute: () => Route$9
});
var ApiRoomsIndexRoute = Route$1.update({
	id: "/api/rooms/",
	path: "/api/rooms/",
	getParentRoute: () => Route$9
});
var rootRouteChildren = {
	IndexRoute,
	ApiBlobUploadRoute,
	ApiResolveRoute,
	ApiUploadRoute,
	RoomCodeRoute,
	ApiDriveIdRoute,
	ApiMediaIdRoute,
	ApiRoomsSplatRoute: Route.update({
		id: "/api/rooms/$",
		path: "/api/rooms/$",
		getParentRoute: () => Route$9
	}),
	ApiRoomsIndexRoute
};
var routeTree = Route$9._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { normalizeWebUrl as i, Route$4 as n, DEFAULT_WEB_URL as r, router_exports as t };
