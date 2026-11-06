export const C = {
  bg: "#09090D",
  card: "#14141F",
  cardHi: "#1B1B2A",
  input: "#202033",
  border: "#2A2A3A",
  text: "#F5F5FA",
  muted: "#8B8B9E",
  dim: "#5A5A6E",
  cyan: "#00F3FF",
  purple: "#B952FF",
  purpleDeep: "#290A45",
  success: "#00E096",
  warning: "#FFC83D",
  error: "#FF3B5C",
};

export const R = { sm: 10, md: 14, lg: 20, pill: 999 };

const AVATAR = ["#B952FF", "#00C2FF", "#FF5C8A", "#00E096", "#FFB020", "#7C5CFF", "#FF7A45", "#2DD4BF"];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR[Math.abs(h) % AVATAR.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
