import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { useI18n } from "@/i18n";
import { EMOJI_LIST as EMOJI } from "@/hooks/useRoomConnection";
import { Avatar } from "./Participants";

const time = (iso, lang) => new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });

export const Chat = ({ messages, me, onSend }) => {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const box = useRef(null);
  const last = messages[messages.length - 1];
  useEffect(() => {
    const b = box.current;
    if (b && (last?.participant_id === me || b.scrollHeight - b.scrollTop - b.clientHeight < 160)) b.scrollTop = b.scrollHeight;
  }, [last?.id, last?.participant_id, me]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, []);
  const submit = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText("");
  };
  return (
    <div className="chat" data-testid="chat-panel">
      <div className="msgs" ref={box} data-testid="chat-messages">
        {messages.map((m) =>
          m.kind === "system" ? (
            <div key={m.id} className="sys">{m.text}</div>
          ) : (
            <div key={m.id} className={`msg ${m.participant_id === me ? "mine" : ""} ${EMOJI.includes(m.text) ? "big" : ""}`} data-testid="chat-message">
              <Avatar name={m.nickname} />
              <div className="col">
                <div className="meta"><b>{m.nickname}</b><span>{time(m.created_at, lang)}</span></div>
                <div className="bub">{m.text}</div>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="emo">
        {EMOJI.map((e) => <button key={e} onClick={() => onSend(e)} data-testid={`reaction-${e}`}>{e}</button>)}
      </div>
      <form className="send" onSubmit={submit}>
        <input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={t("msg_ph")} data-testid="chat-input" />
        <button aria-label="send" data-testid="chat-send-btn"><SendHorizontal size={18} /></button>
      </form>
    </div>
  );
};
