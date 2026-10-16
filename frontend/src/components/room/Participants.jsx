import { Loader2 } from "lucide-react";
import { useT } from "@/i18n";

export const Participants = ({ room, me, peerState }) => {
  const t = useT();
  const online = room.participants.filter((p) => p.online).length;
  return (
    <section className="panel" data-testid="participants-panel">
      <div className="ph">{t("participants")} <span className="mut" data-testid="participants-count">{online}/{room.participants.length}</span></div>
      <div className="pp">
        {room.participants.map((p) => (
          <span key={p.id} className={p.online ? "" : "off"} data-testid={`participant-${p.id}`}>
            <i className={p.online ? "on" : ""} />
            {p.nickname}
            {p.id === me && <small> ({t("you")})</small>}
            {p.is_host && <em>HOST</em>}
            {peerState[p.id]?.buffering && <Loader2 size={11} className="spin" />}
          </span>
        ))}
      </div>
    </section>
  );
};
