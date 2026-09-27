const NICK_KEYS = ["nexorawatch:nickname", "sinerave:nickname"] as const;
const roomKeys = (code: string) => {
  const c = code.toUpperCase();
  return [`nexorawatch:room:${c}`, `sinerave:room:${c}`] as const;
};

function read(key: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "string" ? parsed : raw;
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getSavedNickname(): string {
  for (const key of NICK_KEYS) {
    const value = read(key);
    if (value) return value;
  }
  return "";
}

export function saveNickname(nickname: string) {
  write(NICK_KEYS[0], nickname);
  write(NICK_KEYS[1], nickname);
}

export function saveRoomSession(code: string, participantId: string) {
  const [primary, legacy] = roomKeys(code);
  write(primary, participantId);
  write(legacy, participantId);
}

export function getRoomSession(code: string): string | null {
  for (const key of roomKeys(code)) {
    const value = read(key);
    if (value) return value;
  }
  return null;
}

export function clearRoomSession(code: string) {
  for (const key of roomKeys(code)) remove(key);
}
