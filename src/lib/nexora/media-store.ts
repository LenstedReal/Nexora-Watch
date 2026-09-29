import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { put } from "@vercel/blob";

export type StoredMedia = {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  path?: string;
};

const DIR = "/tmp/nexora-media";
const files = new Map<string, StoredMedia>();

const SAFE_NAME = /[^a-zA-Z0-9._-]+/g;
const SAFE_ID = /^[A-Za-z0-9-]+$/;

function mimeOf(name: string, fallback: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (fallback.startsWith("video/")) return fallback;
  return "video/mp4";
}

function extOf(name: string, mime: string): string {
  const match = name.toLowerCase().match(/\.(mp4|webm|mov|m4v|m3u8)$/);
  if (match) return match[0];
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("quicktime")) return ".mov";
  return ".mp4";
}

export async function saveUploadedVideo(file: File): Promise<StoredMedia> {
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
      contentType: mime,
    });

    const stored: StoredMedia = {
      id,
      name: original,
      mime,
      size: file.size,
      url: blob.url,
    };
    files.set(id, stored);
    return stored;
  }

  await mkdir(DIR, { recursive: true });
  const path = join(DIR, `${id}${ext}`);
  const nodeStream = Readable.fromWeb(
    file.stream() as import("node:stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(path));
  const info = await stat(path);

  const stored: StoredMedia = {
    id,
    name: original,
    mime,
    size: info.size,
    url: `/api/media/${id}`,
    path,
  };
  files.set(id, stored);
  return stored;
}

export async function readStoredMedia(id: string): Promise<StoredMedia | null> {
  if (!SAFE_ID.test(id)) return null;

  const cached = files.get(id);
  if (cached) return cached;

  try {
    await mkdir(DIR, { recursive: true });
    const names = await readdir(DIR);
    const match = names.find(
      (name) => name === id || name.startsWith(`${id}.`),
    );

    if (!match) return null;

    const path = join(DIR, match);
    const info = await stat(path);
    if (!info.isFile()) return null;

    const stored: StoredMedia = {
      id,
      name: match,
      mime: mimeOf(match, ""),
      size: info.size,
      url: `/api/media/${id}`,
      path,
    };
    files.set(id, stored);
    return stored;
  } catch {
    return null;
  }
}

export function mediaStream(stored: StoredMedia, start: number, end: number): ReadableStream {
  if (!stored.path) {
    throw new Error("Bu video uzak depoda; yerel stream yok");
  }
  return Readable.toWeb(
    createReadStream(stored.path, { start, end }),
  ) as unknown as ReadableStream;
}
