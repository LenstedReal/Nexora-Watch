//#region migrations/0002_nexora_rooms.sql?raw
var _0002_nexora_rooms_default = "create table if not exists nexora_rooms (\n  id text primary key,\n  code text not null unique,\n  name text not null,\n  host_id text not null,\n  created_at timestamptz not null,\n  expires_at timestamptz not null,\n  participants jsonb not null default '[]'::jsonb,\n  video jsonb,\n  playback jsonb not null default '{\"playing\":false,\"position\":0,\"updated_at\":0}'::jsonb\n);\n\ncreate table if not exists nexora_messages (\n  id text primary key,\n  room_code text not null,\n  participant_id text,\n  nickname text not null,\n  text text not null,\n  kind text not null default 'chat',\n  created_at timestamptz not null\n);\n\ncreate index if not exists nexora_messages_room_created_idx\non nexora_messages(room_code, created_at);\n";
//#endregion
//#region migrations/0003_nexora_web_open.sql?raw
var _0003_nexora_web_open_default = "alter table nexora_rooms\n  add column if not exists web_open boolean not null default false;\n";
//#endregion
//#region migrations/0004_nexora_web_url.sql?raw
var _0004_nexora_web_url_default = "alter table nexora_rooms\n  add column if not exists web_url text not null default 'https://www.google.com/search?igu=1';\n";
//#endregion
//#region scripts/migration-plan.mjs
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
//#endregion
//#region src/lib/db.ts
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
//#endregion
//#region src/lib/nexora/web.ts
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
//#endregion
//#region src/lib/nexora/server.ts
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
async function updatePlaybackRow(code, playback) {
	await (await getSql()).query(`update nexora_rooms
        set playback = $2::jsonb
      where code = $1`, [code, JSON.stringify(playback)]);
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
//#endregion
export { setWebOpen as i, sendMessage as n, setPlayback as r, loadRoom as t };
