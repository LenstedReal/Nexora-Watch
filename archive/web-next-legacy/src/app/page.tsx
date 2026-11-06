"use client";

import { useRouter } from "next/navigation";
import { CircleHelp, Film, Globe, Key, Sparkles, User, Youtube, Zap } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/nexora/api";
import { getSavedNickname, saveNickname, saveRoomSession } from "@/lib/nexora/session";

const HERO =
  "https://images.unsplash.com/photo-1678247539441-05ad26a18343?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const SOURCES = [
  { icon: Youtube, label: "YouTube" },
  { icon: Globe, label: "Drive" },
  { icon: Film, label: "MP4 / M3U8" },
  { icon: Globe, label: "Web" },
] as const;

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [nickname, setNickname] = useState("");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "error" | "success" } | null>(null);
  const [webHintOpen, setWebHintOpen] = useState(false);
  const webHelpButtonRef = useRef<HTMLButtonElement | null>(null);

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
      router.push(`/room/${res.room.code}`);
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Bir hata oluştu", kind: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex justify-center text-on-surface select-none">
      <main className="w-full max-w-md min-h-screen bg-surface flex flex-col relative pb-8 shadow-2xl" data-testid="home-screen">
        {toast ? (
          <div className="pointer-events-none fixed top-4 right-0 left-0 z-50 flex justify-center px-4">
            <div
              className={`max-w-xs rounded-xl border bg-surface-tertiary px-4 py-3 text-center text-xs text-on-surface shadow-lg ${toast.kind === "error" ? "border-error" : "border-success"}`}
            >
              {toast.text}
            </div>
          </div>
        ) : null}

        {/* Mobile App Header & Hero */}
        <section className="relative h-[320px] w-full shrink-0">
          <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-surface/80 to-surface" />
          
          <div className="relative flex h-full flex-col justify-end gap-2 px-5 pb-3">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-glass-border bg-glass px-2.5 py-1">
              <Zap className="size-3 text-brand" />
              <span className="font-text text-[10px] font-bold tracking-[1.5px] text-brand">SENKRON İZLEME</span>
            </div>

            <div className="flex items-center">
              <img
                src="/branding/nexora-logo.jpg"
                alt="Nexora Watch"
                className="h-12 w-auto max-w-[220px] rounded-lg object-contain shadow-md"
              />
            </div>

            <h1 className="font-display text-xl font-bold leading-tight tracking-tight text-on-surface">
              Better Than Rave.
            </h1>
            <p className="font-text text-[11px] font-semibold tracking-[1.6px] text-brand-secondary uppercase">
              by LenstedReal
            </p>
            <p className="font-text text-[13px] leading-snug text-on-surface-tertiary">
              Sevdiklerinle aynı anda, aynı karede. YouTube, Drive ve daha fazlası.
            </p>

            {/* Source chips */}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-tertiary/90 px-2.5 py-1"
                >
                  <s.icon className="size-3 text-brand-secondary" />
                  <span className="font-text text-[11px] text-on-surface-tertiary">
                    {s.label}
                    {s.label === "Web" && (
                      <span className="ml-1 text-[8px] font-bold text-brand-secondary">
                        (BETA)
                      </span>
                    )}
                  </span>
                  {s.label === "Web" && (
                    <button
                      ref={webHelpButtonRef}
                      type="button"
                      onClick={() => setWebHintOpen(!webHintOpen)}
                      className="ml-0.5 text-muted hover:text-on-surface"
                      aria-label="Web bilgisi"
                    >
                      <CircleHelp className="size-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {webHintOpen && (
              <div className="mt-1 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-center font-text text-[11px] text-on-surface shadow-md">
                Şu anda bu özellik test aşamasındadır.
              </div>
            )}
          </div>
        </section>

        {/* Mobile Action Card */}
        <section className="mx-4 mt-2 rounded-2xl border border-glass-border bg-surface-secondary p-5 shadow-xl flex-1 flex flex-col justify-between">
          <div>
            {/* Mode Switcher */}
            <div className="mb-4 flex rounded-xl bg-surface-tertiary p-1">
              {(["create", "join"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={m === "create" ? "mode-create-tab" : "mode-join-tab"}
                  onClick={() => setMode(m)}
                  className={`min-h-11 flex-1 rounded-lg font-display text-sm font-semibold transition ${
                    mode === m
                      ? "border border-brand-secondary bg-brand-tertiary text-on-surface shadow-sm"
                      : "text-muted hover:text-on-surface"
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
          </div>

          <div>
            <button
              type="button"
              data-testid="home-submit-button"
              disabled={!canSubmit || loading}
              onClick={submit}
              className="relative mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 font-display text-base font-bold tracking-wide text-on-brand disabled:opacity-50 transition active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-brand to-brand-secondary" />
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
            <p className="mt-4 text-center font-text text-[11px] leading-4 text-muted">
              Odalar 24 saat sonra otomatik kapanır. Videoyu yalnızca oda sahibi kontrol eder.
            </p>
          </div>
        </section>
      </main>
    </div>
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
    <label className="mb-3 block">
      <span className="mb-1.5 block font-text text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</span>
      <span className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-border bg-surface-tertiary px-3.5 focus-within:border-brand transition">
        <span className="text-muted">{icon}</span>
        <input
          data-testid={testId}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`min-w-0 flex-1 bg-transparent py-2.5 font-text text-sm text-on-surface outline-none placeholder:text-muted ${className}`}
        />
      </span>
    </label>
  );
}
