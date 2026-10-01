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
  const [webHintPos, setWebHintPos] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    const n = getSavedNickname();
    if (n) setNickname(n);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!webHintOpen) return;
    const t = setTimeout(() => setWebHintOpen(false), 5000);
    return () => clearTimeout(t);
  }, [webHintOpen]);


  const openWebHint = () => {
    setWebHintOpen(true);

    requestAnimationFrame(() => {
      const button = webHelpButtonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(208, window.innerWidth - margin * 2);

      const left = Math.min(
        Math.max(margin, rect.right - width),
        window.innerWidth - width - margin,
      );

      setWebHintPos({
        left,
        top: Math.max(56, rect.top - 8),
        width,
      });
    });
  };

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
          <div className="flex items-center">
            <img
              src="/branding/nexora-logo.jpg"
              alt="Nexora Watch"
              className="h-14 w-auto max-w-[260px] rounded-md object-contain"
            />
          </div>
          <h1 className="mt-1 max-w-[340px] font-display text-2xl font-bold leading-tight tracking-tight text-on-surface">
            Better Than Rave.
          </h1>
          <p className="font-text text-xs tracking-[1.6px] text-brand-secondary uppercase">
            by LenstedReal
          </p>
          <p className="font-text max-w-80 text-[15px] leading-5.5 text-on-surface-tertiary">
            Sevdiklerinle aynı anda, aynı karede. YouTube, Drive ve daha fazlası.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
        {SOURCES.map((s) =>
          s.label === "Web" ? (
            <span
              key={s.label}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-tertiary px-2.5 py-1.5"
            >
              <s.icon className="size-3.5 text-brand-secondary" />

              <span className="font-text text-xs text-on-surface-tertiary">
                Web
                <span className="ml-1 text-[9px] font-semibold text-brand-secondary">
                  (BETA)
                </span>
              </span>

              <span className="relative">
                <button
                  ref={webHelpButtonRef}
                  type="button"
                  onClick={openWebHint}
                  className="grid size-5 place-items-center rounded-full text-muted transition hover:text-on-surface"
                  aria-label="Web özelliği hakkında bilgi"
                  aria-expanded={webHintOpen}
                >
                  <CircleHelp className="size-3.5" />
                </button>

                {webHintOpen && webHintPos ? (
                  <span
                    role="status"
                    className="pointer-events-none fixed z-[100] -translate-y-full rounded-md border border-border bg-surface-secondary px-3 py-2 text-center font-text text-[10px] leading-4 text-on-surface shadow-2xl"
                    style={{
                      left: webHintPos.left,
                      top: webHintPos.top,
                      width: webHintPos.width,
                    }}
                  >
                    Şu anda bu özellik test aşamasındadır.
                  </span>
                ) : null}
              </span>
            </span>
          ) : (
            <span
              key={s.label}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-tertiary px-2.5 py-1.5"
            >
              <s.icon className="size-3.5 text-brand-secondary" />
              <span className="font-text text-xs text-on-surface-tertiary">
                {s.label}
              </span>
            </span>
          ),
        )}
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
      <a
        href="https://link.me/lenstedreal"
        target="_blank"
        rel="noreferrer"
        aria-label="LenstedReal portfolio"
        className="absolute top-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-glass-border bg-surface-secondary/80 px-3 py-2 backdrop-blur-md transition-all hover:border-brand-secondary hover:bg-surface-tertiary"
      >
        <span className="size-1.5 rounded-full bg-brand shadow-[0_0_8px_currentColor] text-brand" />
        <span className="font-text text-xs font-semibold text-on-surface">
          LenstedReal
        </span>
        <span className="font-text text-[10px] text-muted">
          Portfolio ↗
        </span>
      </a>
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
