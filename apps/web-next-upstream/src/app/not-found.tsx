import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 text-on-surface">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-secondary p-6 text-center">
        <h1 className="font-display text-xl font-bold">Sayfa bulunamadı</h1>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-brand px-5 font-display text-sm font-bold text-on-brand"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
