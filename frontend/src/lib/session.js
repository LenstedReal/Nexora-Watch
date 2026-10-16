const key = (code) => `nx:ident:${code}`;

export const getIdent = (code) => {
  try {
    return JSON.parse(localStorage.getItem(key(code)) || "null");
  } catch {
    return null;
  }
};
export const saveIdent = (code, ident) => localStorage.setItem(key(code), JSON.stringify(ident));
export const clearIdent = (code) => localStorage.removeItem(key(code));
export const lastNickname = () => localStorage.getItem("nx:nick") || "";
export const saveNickname = (n) => localStorage.setItem("nx:nick", n);

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
