const PALETTE = ["#22e5ff", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#c084fc", "#2dd4bf", "#f97316"];

export const avatarColor = (name = "") => PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
export const initials = (name = "") => name.trim().slice(0, 2).toUpperCase() || "?";
