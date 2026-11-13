// Anonymous device identity (no accounts): a random id + secret kept in localStorage "nx:dev", registered once with
// POST /api/devices. Sent as X-Nexora-Device / X-Nexora-Key so the server can remember who watched together.
const KEY = "nx:dev";

const rand = (n) => {
  const a = new Uint8Array(n);
  (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); });
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
};

export function getDevice() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (d && d.id && d.key) return d;
  } catch {}
  const d = { id: rand(12), key: rand(24), reg: false };
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
  return d;
}

export function markRegistered() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...getDevice(), reg: true })); } catch {}
}

export const deviceHeaders = () => {
  const d = getDevice();
  return { "X-Nexora-Device": d.id, "X-Nexora-Key": d.key };
};
