import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Film, Globe, Key, Sparkles, User, Youtube, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/nexora/api";
import { getSavedNickname, saveNickname, saveRoomSession } from "@/lib/nexora/session";

export const Route = createFileRoute("/")({ component: Home });

const HERO =
  "https://images.unsplash.com/photo-1678247539441-05ad26a18343?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const SOURCES = [
  { icon: Youtube, label: "YouTube" },
  { icon: Globe, label: "Drive" },
  { icon: Film, label: "MP4 / M3U8" },
  { icon: Globe, label: "Web" },
] as const;

function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [nickname, setNickname] = useState("");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "error" | "success" } | null>(null);

  useEffect(() => {
    const n = getSavedNickname();
    if (n) setNickname(n);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const canSubmit = nickname.trim().length > 0 && (mode === "create" || code.trim().length === 6);

  const submit = async () => {
    const nick = nickname.trim();
    if (!nick) return setToast({ text: "Bir rumuz gir", kind: "error" });
    setLoading(true);
    try {
      saveNickname(nick);
      const res =
        mode === "create"
          ? await api.createRoom(nick, roomName.trim() || `${nick}'in odası`)
          : await api.joinRoom(code.trim().toUpperCase(), nick);
      saveRoomSession(res.room.code, res.participant.id);
      await navigate({ to: "/room/$code", params: { code: res.room.code } });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Bir hata oluştu", kind: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-surface" data-testid="home-screen">
      {toast ? (
        <div className="pointer-events-none fixed top-4 right-0 left-0 z-50 flex justify-center px-4">
          <div
            className={`max-w-md rounded-md border bg-surface-tertiary px-4 py-3 text-center text-sm text-on-surface ${toast.kind === "error" ? "border-error" : "border-success"}`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}

      <section className="relative h-[380px]">
        <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-overlay to-surface" />
        <div className="relative flex h-full flex-col justify-end gap-2.5 px-6 pt-16 pb-4">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-pill border border-glass-border bg-glass px-2.5 py-1">
            <Zap className="size-3 text-brand" />
            <span className="font-text text-[11px] tracking-[1.5px] text-brand">SENKRON İZLEME</span>
          </div>
          <h1 className="font-display text-[44px] leading-none font-extrabold tracking-tight text-on-surface">
            Nexora Watch
          </h1>
          <p className="font-text text-xs tracking-[1.6px] text-brand-secondary uppercase">by LenstedReal</p>
          <p className="font-text max-w-80 text-[15px] leading-5.5 text-on-surface-tertiary">
            Sevdiklerinle aynı anda, aynı karede. YouTube, Drive ve daha fazlası.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-tertiary px-2.5 py-1.5"
              >
                <s.icon className="size-3.5 text-brand-secondary" />
                <span className="font-text text-xs text-on-surface-tertiary">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-4 mt-2 mb-8 rounded-lg border border-glass-border bg-surface-secondary p-5">
        <div className="mb-4 flex rounded-md bg-surface-tertiary p-1">
          {(["create", "join"] as const).map((m) => (
            <button
              key={m}
              type="button"
              data-testid={m === "create" ? "mode-create-tab" : "mode-join-tab"}
              onClick={() => setMode(m)}
              className={`min-h-11 flex-1 rounded-sm font-display text-sm font-semibold ${
                mode === m
                  ? "border border-brand-secondary bg-brand-tertiary text-on-surface"
                  : "text-muted"
              }`}
            >
              {m === "create" ? "Oda Kur" : "Odaya Katıl"}
            </button>
          ))}
        </div>

        <Field
          testId="nickname-input"
          label="Rumuz"
          icon={<User className="size-4" />}
          placeholder="Nasıl görünmek istersin?"
          value={nickname}
          maxLength={24}
          onChange={setNickname}
        />
        {mode === "create" ? (
          <Field
            testId="room-name-input"
            label="Oda adı"
            icon={<Film className="size-4" />}
            placeholder="Cuma gecesi filmi"
            value={roomName}
            maxLength={48}
            onChange={setRoomName}
          />
        ) : (
          <Field
            testId="room-code-input"
            label="Oda kodu"
            icon={<Key className="size-4" />}
            placeholder="6 haneli kod"
            value={code}
            maxLength={6}
            onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            className="tracking-[6px] text-xl font-bold"
          />
        )}

        <button
          type="button"
          data-testid="home-submit-button"
          disabled={!canSubmit || loading}
          onClick={submit}
          className="relative mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-md px-5 font-display text-base font-bold tracking-wide text-on-brand disabled:opacity-50"
        >
          <span className="absolute inset-0 bg-linear-to-br from-brand to-brand-secondary" />
          <span className="relative flex items-center gap-2">
            {loading ? (
              "…"
            ) : (
              <>
                <Sparkles className="size-4" />
                {mode === "create" ? "Odayı Kur" : "Katıl"}
              </>
            )}
          </span>
        </button>
        <p className="mt-4 text-center font-text text-xs leading-4.5 text-muted">
          Odalar 24 saat sonra otomatik kapanır. Videoyu yalnızca oda sahibi kontrol eder.
        </p>
      </section>
    </main>
  );
}

function Field({
  label,
  icon,
  placeholder,
  value,
  onChange,
  testId,
  maxLength,
  className = "",
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block font-text text-xs tracking-widest text-muted uppercase">{label}</span>
      <span className="flex min-h-[52px] items-center gap-2.5 rounded-md border border-border bg-surface-tertiary px-3.5 focus-within:border-brand">
        <span className="text-muted">{icon}</span>
        <input
          data-testid={testId}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`min-w-0 flex-1 bg-transparent py-3 font-text text-base text-on-surface outline-none placeholder:text-muted ${className}`}
        />
      </span>
    </label>
  );
}
