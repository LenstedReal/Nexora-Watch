import { absUrl, api, ApiError } from "./api";

const CONCURRENCY = 3;
const MAX_TRIES = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function putPart(url, blob, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, `http_${xhr.status}`, `HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new ApiError(0, "network", "Ağ hatası"));
    xhr.onabort = () => reject(new ApiError(-1, "aborted", "İptal edildi"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

// Streams File slices part by part; the browser never loads the whole file into memory.
export async function uploadVideo({ file, code, ident, onProgress, signal }) {
  const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
  const init = await api.uploadInit({
    code, participant_id: ident.participant_id, token: ident.token,
    filename: file.name, size: file.size, mime: file.type || undefined, fingerprint,
  });
  const mediaId = init.media_id;
  if (init.status === "completed") {
    onProgress({ phase: "finalizing", loaded: file.size, total: file.size });
    return { mediaId, ...(await api.uploadComplete(mediaId, ident)) };
  }

  const { part_size: partSize, part_count: partCount } = init;
  const done = new Set(init.parts_done || []);
  const partBytes = (n) => (n < partCount ? partSize : file.size - partSize * (partCount - 1));
  let base = [...done].reduce((s, n) => s + partBytes(n), 0);
  const inflight = {};
  const started = Date.now();
  const baseAtStart = base;
  const report = () => {
    const loaded = base + Object.values(inflight).reduce((a, b) => a + b, 0);
    const elapsed = (Date.now() - started) / 1000;
    const speed = elapsed > 0.5 ? (loaded - baseAtStart) / elapsed : 0;
    onProgress({ phase: "uploading", loaded, total: file.size, speed, eta: speed > 0 ? (file.size - loaded) / speed : null, mediaId });
  };
  report();

  const queue = Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !done.has(n));
  const urls = {};
  const urlFor = async (n) => {
    if (!urls[n] || urls[n].exp < Date.now()) {
      const batch = queue.filter((x) => x >= n).slice(0, 20);
      const res = await api.partUrls(mediaId, ident, batch.length ? batch : [n]);
      const exp = Date.now() + (res.expires_in - 120) * 1000;
      Object.entries(res.urls).forEach(([k, u]) => (urls[k] = { url: absUrl(u), exp }));
    }
    return urls[n].url;
  };

  const worker = async () => {
    while (queue.length) {
      const n = queue.shift();
      const blob = file.slice((n - 1) * partSize, (n - 1) * partSize + partBytes(n));
      for (let attempt = 1; ; attempt += 1) {
        if (signal.aborted) throw new ApiError(-1, "aborted", "İptal edildi");
        try {
          const url = await urlFor(n);
          await putPart(url, blob, (l) => { inflight[n] = l; report(); }, signal);
          delete inflight[n];
          base += blob.size;
          report();
          break;
        } catch (e) {
          delete inflight[n];
          if (e.code === "aborted" || attempt >= MAX_TRIES || (e.status >= 400 && e.status < 500 && e.status !== 403 && e.status !== 408)) throw e;
          if (e.status === 403) delete urls[n];
          while (!navigator.onLine && !signal.aborted) await sleep(1000);
          await sleep(Math.min(15000, 800 * 2 ** attempt) * (0.5 + Math.random() / 2));
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
  onProgress({ phase: "finalizing", loaded: file.size, total: file.size, mediaId });
  return { mediaId, ...(await api.uploadComplete(mediaId, ident)) };
}
