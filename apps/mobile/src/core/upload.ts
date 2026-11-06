import * as FileSystem from "expo-file-system";
import { api, absUrl } from "./api";
import type { Identity } from "./types";

export const VIDEO_EXT: Record<string, string> = { mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm", mov: "video/quicktime" };
const PARALLEL = 2;
const RETRIES = 3;

export type UploadProgress = { sent: number; total: number };

export class UploadCancelled extends Error {
  constructor() {
    super("Yükleme iptal edildi");
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** Base64 -> bytes without relying on atob (not guaranteed in every Hermes build). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = i + 2 < len ? LOOKUP[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < len ? LOOKUP[clean.charCodeAt(i + 3)] : 0;
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < len) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < len) out[o++] = ((c & 3) << 6) | d;
  }
  return o === out.length ? out : out.slice(0, o);
}

function putPart(url: string, body: Uint8Array, onProgress: (n: number) => void, signal: { cancelled: boolean; xhrs: Set<XMLHttpRequest> }) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    signal.xhrs.add(xhr);
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      signal.xhrs.delete(xhr);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Parça yüklenemedi (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => {
      signal.xhrs.delete(xhr);
      reject(new Error("Ağ hatası"));
    };
    xhr.onabort = () => {
      signal.xhrs.delete(xhr);
      reject(new UploadCancelled());
    };
    xhr.send(body.buffer as ArrayBuffer);
  });
}

/**
 * Resumable multipart upload: init -> signed part URLs -> PUT parts (2 parallel, 3 retries each) -> complete.
 * Reads one part at a time from disk, so memory stays ~ part size regardless of file size.
 */
export function startUpload(opts: {
  code: string;
  ident: Identity;
  uri: string;
  fileName: string;
  size: number;
  mime: string;
  onProgress: (p: UploadProgress) => void;
}) {
  const signal = { cancelled: false, xhrs: new Set<XMLHttpRequest>() };
  let mediaId: string | null = null;

  const promise = (async () => {
    const { code, ident, uri, fileName, size, mime, onProgress } = opts;
    const init = await api.uploadInit({
      code,
      participant_id: ident.participant_id,
      token: ident.token,
      filename: fileName,
      size,
      mime,
      fingerprint: `${fileName}:${size}`,
    });
    mediaId = init.media_id;
    if (init.status === "completed") {
      onProgress({ sent: size, total: size });
      await api.uploadComplete(init.media_id, ident);
      return;
    }
    const partSize = init.part_size!;
    const partCount = init.part_count!;
    const done = new Set(init.parts_done ?? []);
    const inflight: Record<number, number> = {};
    let finished = 0;
    done.forEach((n) => (finished += n < partCount ? partSize : size - partSize * (partCount - 1)));
    const report = () => onProgress({ sent: Math.min(size, finished + Object.values(inflight).reduce((a, b) => a + b, 0)), total: size });
    report();

    const queue = Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !done.has(n));
    const worker = async () => {
      while (queue.length) {
        if (signal.cancelled) throw new UploadCancelled();
        const n = queue.shift()!;
        const start = (n - 1) * partSize;
        const length = Math.min(partSize, size - start);
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position: start, length });
        const bytes = base64ToBytes(b64);
        if (bytes.length !== length) throw new Error("Dosya okunamadı");
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < RETRIES; attempt++) {
          if (signal.cancelled) throw new UploadCancelled();
          try {
            // Fresh URL per attempt: signed URLs expire after an hour.
            const { urls } = await api.partUrls(mediaId!, ident, [n]);
            await putPart(absUrl(urls[String(n)]), bytes, (x) => {
              inflight[n] = x;
              report();
            }, signal);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            if (e instanceof UploadCancelled) throw e;
            inflight[n] = 0;
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
        if (lastErr) throw lastErr;
        delete inflight[n];
        finished += length;
        report();
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length || 1) }, worker));
    await api.uploadComplete(mediaId, ident);
  })();

  return {
    promise,
    cancel: () => {
      signal.cancelled = true;
      signal.xhrs.forEach((x) => x.abort());
      if (mediaId) api.uploadAbort(mediaId, opts.ident).catch(() => {});
    },
  };
}

export async function fileSize(uri: string, hint?: number | null): Promise<number> {
  if (hint && hint > 0) return hint;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && "size" in info && typeof info.size === "number" ? info.size : 0;
}
