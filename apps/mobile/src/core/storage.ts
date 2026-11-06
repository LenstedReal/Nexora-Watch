import * as SecureStore from "expo-secure-store";
import type { Identity } from "./types";

// SecureStore keys may only contain [A-Za-z0-9._-]; values are kept small.
const k = {
  server: "nx.server",
  nick: "nx.nick",
  recent: "nx.recent",
  ident: (code: string) => `nx.ident.${code.toUpperCase()}`,
};

async function get(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function set(key: string, value: string | null) {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* storage unavailable: app keeps working for this session */
  }
}

export type RecentRoom = { code: string; name: string; at: number };

export const store = {
  getServer: () => get(k.server),
  setServer: (url: string | null) => set(k.server, url),
  getNickname: async () => (await get(k.nick)) ?? "",
  setNickname: (n: string) => set(k.nick, n),

  async getIdent(code: string): Promise<Identity | null> {
    const raw = await get(k.ident(code));
    if (!raw) return null;
    try {
      const v = JSON.parse(raw);
      return v && typeof v.participant_id === "string" && typeof v.token === "string" ? v : null;
    } catch {
      return null;
    }
  },
  setIdent: (code: string, ident: Identity | null) => set(k.ident(code), ident ? JSON.stringify(ident) : null),

  async getRecent(): Promise<RecentRoom[]> {
    const raw = await get(k.recent);
    try {
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  },
  async pushRecent(r: RecentRoom) {
    const list = (await store.getRecent()).filter((x) => x.code !== r.code);
    await set(k.recent, JSON.stringify([{ ...r, name: r.name.slice(0, 40) }, ...list].slice(0, 6)));
  },
  async removeRecent(code: string) {
    const list = (await store.getRecent()).filter((x) => x.code !== code);
    await set(k.recent, JSON.stringify(list));
  },
};
