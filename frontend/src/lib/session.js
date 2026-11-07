const key = (code) => `nx:ident:${code}`;
// localStorage can throw (private mode, storage disabled); never let that break the app.
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const getIdent = (code) => {
  try {
    return JSON.parse(ls.get(key(code)) || "null");
  } catch {
    return null;
  }
};
export const saveIdent = (code, ident) => ls.set(key(code), JSON.stringify(ident));
export const clearIdent = (code) => ls.del(key(code));
export const lastNickname = () => ls.get("nx:nick") || "";
export const saveNickname = (n) => ls.set("nx:nick", n);

export const fmtBytes = (n) => {
  if (!n && n !== 0) return "–";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
};
