import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Radio, Users } from "lucide-react";
import { useT } from "@/i18n";
import { api } from "@/lib/api";

// "Açık odalar": rooms whose host opened them to everyone. Refreshes every 20 s, only while the page is visible.
export const PublicRooms = () => {
  const t = useT();
  const nav = useNavigate();
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      api.publicRooms().then((r) => alive && setRooms(Array.isArray(r?.rooms) ? r.rooms : [])).catch(() => {});
    };
    load();
    const id = setInterval(load, 20000);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  if (!rooms.length) return null;
  return (
    <section className="recent lp-recent" data-testid="public-rooms">
      <div className="recent-h"><Radio size={14} /> {t("public_rooms")}</div>
      {rooms.map((r) => (
        <button key={r.code} className="recent-row" onClick={() => nav(`/room/${r.code}`)} data-testid={`public-room-${r.code}`}>
          <span className="recent-nick" style={{ color: "var(--txt, inherit)" }}>
            <b>{r.name}</b>{r.video_title ? ` · ${r.video_title}` : ""}
          </span>
          <span className="recent-go"><Users size={12} /> {r.people}</span>
          <span className="recent-go">{t("join")} <ChevronRight size={14} /></span>
        </button>
      ))}
    </section>
  );
};
