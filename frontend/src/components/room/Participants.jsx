import { Crown, Loader2 } from "lucide-react";
import { useT } from "@/i18n";
import { avatarColor, initials } from "@/lib/avatar";

export const Avatar = ({ name, online = true, host = false, size }) => (
  <span className={`av ${online ? "" : "off"}`} style={{ background: avatarColor(name), width: size, height: size }}>
    {initials(name)}
    {host && <Crown size={12} className="crown" fill="currentColor" />}
    {online && <i />}
  </span>
);

export const PeopleStrip = ({ room, me }) => (
  <div className="strip" data-testid="participants-strip">
    {room.participants.map((p) => (
      <div key={p.id} className={`pp ${p.id === me ? "me" : ""}`} data-testid={`participant-${p.id}`}>
        <Avatar name={p.nickname} online={p.online} host={p.is_host} />
        <span>{p.nickname}</span>
      </div>
    ))}
  </div>
);

export const PeopleList = ({ room, me, peerState, isHost, onReport, onKick, onMakeHost }) => {
  const t = useT();
  const online = room.participants.filter((p) => p.online).length;
  return (
    <>
      <div className="ph">{t("people")} <span data-testid="participants-count">{online} {t("online")}</span></div>
      <div className="plist" data-testid="participants-panel">
        {room.participants.map((p) => (
          <div key={p.id} className="prow" data-testid={`participant-${p.id}`}>
            <Avatar name={p.nickname} online={p.online} host={p.is_host} />
            <div className="nm">
              <b>{p.nickname}{p.id === me ? ` (${t("you")})` : ""}</b>
              <small>{p.online ? t("online") : "—"}</small>
            </div>
            {peerState[p.id]?.buffering && <Loader2 size={14} className="spin" />}
            {p.is_host && <span className="tag">HOST</span>}
            {p.id !== me && onReport && (
              <button className="pact" onClick={() => onReport(p)} title={t("report_title")} data-testid={`report-${p.id}`}>{t("report_short")}</button>
            )}
            {isHost && !p.is_host && p.id !== me && p.online && onMakeHost && (
              <button className="pact" onClick={() => onMakeHost(p)} data-testid={`make-host-${p.id}`}>{t("make_host")}</button>
            )}
            {isHost && !p.is_host && p.id !== me && onKick && (
              <button className="pact danger" onClick={() => onKick(p)} data-testid={`kick-${p.id}`}>{t("kick")}</button>
            )}
          </div>
        ))}
      </div>
    </>
  );
};
